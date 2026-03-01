type BoundaryValue = LooseRecord[string];
type BoundaryRecord = Record<string, BoundaryValue>;
type ApiObjectRecord = BoundaryRecord;
type ApiObjectLike = BoundaryRecord;
type RetryAfterHeaders = { get: (headerName: string) => string | null };
type RetryAfterResponseLike = { headers?: RetryAfterHeaders | null } | null;
type ApiPayloadDataEnvelope = {
  rows: ApiObjectRecord[];
  total: number | null;
};

type RuntimeEventFn = (eventName: string, payload: ApiObjectRecord) => void;

type ApiContractsDeps = {
  windowRef?: BoundaryValue;
  navigatorRef?: BoundaryValue;
  runtimeEvent?: BoundaryValue;
  parseDateMs?: BoundaryValue;
  getWatchlistSeriesId?: BoundaryValue;
  getWatchHistorySeriesId?: BoundaryValue;
  fetchBackoffBaseMs?: BoundaryValue;
  fetchBackoffJitterMs?: BoundaryValue;
};

type ApiContractsContext = {
  windowRef: Window & typeof globalThis;
  navigatorRef: Navigator;
  runtimeEvent: RuntimeEventFn;
  parseDateMs: (value: BoundaryValue) => number | null;
  getWatchlistSeriesId: (entry: ApiObjectRecord) => string | null;
  getWatchHistorySeriesId: (entry: ApiObjectRecord) => string | null;
  fetchBackoffBaseMs: number;
  fetchBackoffJitterMs: number;
};

function requireFunction<T extends (...args: never[]) => BoundaryValue>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing API contract dependency: ${name}`);
  }
  return value as T;
}

function toObjectLike(value: BoundaryValue): ApiObjectLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as ApiObjectLike;
}

function requireWindowRef(value: BoundaryValue): Window & typeof globalThis {
  const candidate = toObjectLike(value);
  if (!candidate) {
    throw new Error('[CW] Missing API contract dependency: windowRef');
  }
  if (typeof candidate.setTimeout !== 'function') {
    throw new Error('[CW] Missing API contract dependency: windowRef.setTimeout');
  }
  const location = toObjectLike(candidate.location);
  if (!location || typeof location.origin !== 'string') {
    throw new Error('[CW] Missing API contract dependency: windowRef.location.origin');
  }

  return value as Window & typeof globalThis;
}

function requireNavigatorRef(value: BoundaryValue): Navigator {
  const candidate = toObjectLike(value);
  if (!candidate) {
    throw new Error('[CW] Missing API contract dependency: navigatorRef');
  }

  return value as Navigator;
}

function toPositiveNumber(value: BoundaryValue, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return numeric;
}

function createApiContractsContext(deps: ApiContractsDeps = {}): ApiContractsContext {
  return {
    windowRef: requireWindowRef(deps.windowRef),
    navigatorRef: requireNavigatorRef(deps.navigatorRef),
    runtimeEvent: requireFunction('runtimeEvent', deps.runtimeEvent),
    parseDateMs: requireFunction('parseDateMs', deps.parseDateMs),
    getWatchlistSeriesId: requireFunction<ApiContractsContext['getWatchlistSeriesId']>(
      'getWatchlistSeriesId',
      deps.getWatchlistSeriesId,
    ),
    getWatchHistorySeriesId: requireFunction<ApiContractsContext['getWatchHistorySeriesId']>(
      'getWatchHistorySeriesId',
      deps.getWatchHistorySeriesId,
    ),
    fetchBackoffBaseMs: toPositiveNumber(deps.fetchBackoffBaseMs, 400),
    fetchBackoffJitterMs: toPositiveNumber(deps.fetchBackoffJitterMs, 220),
  };
}

function toNonNegativeNumber(value: BoundaryValue): number {
  return Math.max(0, Number(value) || 0);
}

function toRetryAfterResponseLike(response: BoundaryValue): RetryAfterResponseLike {
  const responseRecord = toObjectLike(response);
  if (!responseRecord) {
    return null;
  }
  const headers = toObjectLike(responseRecord.headers);
  if (!headers) {
    return {
      headers: null,
    };
  }

  return {
    headers: typeof headers.get === 'function' ? (headers as RetryAfterHeaders) : null,
  };
}

function sleepInternal(context: ApiContractsContext, ms: number): Promise<void> {
  return new Promise((resolve) => {
    context.windowRef.setTimeout(resolve, ms);
  });
}

function parseRetryAfterMsInternal(response: RetryAfterResponseLike): number | null {
  try {
    const raw = response?.headers?.get('retry-after');
    if (!raw) {
      return null;
    }

    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(30000, Math.round(seconds * 1000));
    }

    const when = Date.parse(raw);
    if (Number.isFinite(when)) {
      return Math.min(30000, Math.max(0, when - Date.now()));
    }
  } catch (_) {
    // no-op
  }

  return null;
}

function computeFetchRetryDelayMsInternal(
  context: ApiContractsContext,
  attemptNumber: number,
  response: RetryAfterResponseLike,
): number {
  const retryAfterMs = parseRetryAfterMsInternal(response);
  if (retryAfterMs != null) {
    return retryAfterMs;
  }

  const exponent = Math.max(0, attemptNumber - 1);
  const exponential = context.fetchBackoffBaseMs * 2 ** exponent;
  const jitter = Math.round(Math.random() * context.fetchBackoffJitterMs);
  return Math.min(10000, exponential + jitter);
}

function shouldRetryStatusInternal(statusCode: number): boolean {
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

function emitApiContractWarningInternal(
  context: ApiContractsContext,
  endpointName: string,
  message: string,
  extra: ApiObjectRecord = {},
): void {
  context.runtimeEvent('api-contract-warning', {
    endpoint: endpointName,
    message,
    ...extra,
  });
}

function makeApiContractErrorInternal(
  context: ApiContractsContext,
  endpointName: string,
  message: string,
  extra: ApiObjectRecord = {},
): Error {
  context.runtimeEvent('api-contract-error', {
    endpoint: endpointName,
    message,
    ...extra,
  });
  return new Error(`Crunchyroll API contract changed for ${endpointName}: ${message}`);
}

function requirePayloadDataArrayInternal(
  context: ApiContractsContext,
  endpointName: string,
  payload: BoundaryValue,
): ApiObjectRecord[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw makeApiContractErrorInternal(context, endpointName, 'expected a JSON object with a data[] array');
  }

  const payloadRecord = payload as ApiObjectRecord;
  const data = payloadRecord.data;
  if (!Array.isArray(data)) {
    throw makeApiContractErrorInternal(context, endpointName, 'expected a JSON object with a data[] array');
  }

  const normalizedRows: ApiObjectRecord[] = [];
  let nonObjectCount = 0;
  for (const row of data) {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      normalizedRows.push(row as ApiObjectRecord);
    } else {
      normalizedRows.push({});
      nonObjectCount += 1;
    }
  }

  if (nonObjectCount > 0) {
    emitApiContractWarningInternal(context, endpointName, 'payload data[] contained non-object rows', {
      rowCount: data.length,
      nonObjectCount,
    });
  }

  return normalizedRows;
}

function parsePayloadTotalInternal(payloadRecord: ApiObjectRecord): number | null {
  const parsed = Number(payloadRecord.total);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

function parsePayloadDataEnvelopeInternal(
  context: ApiContractsContext,
  endpointName: string,
  payload: BoundaryValue,
): ApiPayloadDataEnvelope {
  const rows = requirePayloadDataArrayInternal(context, endpointName, payload);
  const payloadRecord = payload as ApiObjectRecord;
  return {
    rows,
    total: parsePayloadTotalInternal(payloadRecord),
  };
}

function auditWatchlistRowsContractInternal(context: ApiContractsContext, rows: ApiObjectRecord[]): void {
  let missingPanelCount = 0;
  let missingSeriesCount = 0;
  let missingEpisodeMetaCount = 0;

  for (const row of rows) {
    if (!row.panel || typeof row.panel !== 'object' || Array.isArray(row.panel)) {
      missingPanelCount += 1;
      continue;
    }

    const panel = row.panel as ApiObjectRecord;
    if (!panel.episode_metadata || typeof panel.episode_metadata !== 'object') {
      missingEpisodeMetaCount += 1;
    }

    if (!context.getWatchlistSeriesId(row)) {
      missingSeriesCount += 1;
    }
  }

  if (missingPanelCount || missingEpisodeMetaCount || missingSeriesCount) {
    emitApiContractWarningInternal(context, 'watchlist', 'rows are missing expected fields', {
      rowCount: rows.length,
      missingPanelCount,
      missingEpisodeMetaCount,
      missingSeriesCount,
    });
  }
}

function auditWatchHistoryRowsContractInternal(context: ApiContractsContext, rows: ApiObjectRecord[]): void {
  let missingSeriesCount = 0;
  let missingDatePlayedCount = 0;

  for (const row of rows) {
    if (!context.getWatchHistorySeriesId(row)) {
      missingSeriesCount += 1;
    }
    if (context.parseDateMs(row.date_played) == null) {
      missingDatePlayedCount += 1;
    }
  }

  if (missingSeriesCount || missingDatePlayedCount) {
    emitApiContractWarningInternal(context, 'watch-history', 'rows are missing expected fields', {
      rowCount: rows.length,
      missingSeriesCount,
      missingDatePlayedCount,
    });
  }
}

function auditCmsObjectContractInternal(context: ApiContractsContext, records: ApiObjectRecord[]): void {
  let missingIdCount = 0;
  let missingSeriesMetadataCount = 0;
  let missingRatingCount = 0;

  for (const record of records) {
    if (typeof record.id !== 'string' || !record.id) {
      missingIdCount += 1;
    }
    if (!record.series_metadata || typeof record.series_metadata !== 'object') {
      missingSeriesMetadataCount += 1;
    }
    if (!record.rating || typeof record.rating !== 'object') {
      missingRatingCount += 1;
    }
  }

  if (missingIdCount || missingSeriesMetadataCount) {
    emitApiContractWarningInternal(context, 'cms-objects', 'records are missing expected fields', {
      recordCount: records.length,
      missingIdCount,
      missingSeriesMetadataCount,
      missingRatingCount,
    });
  }
}

function resolveApiHrefInternal(context: ApiContractsContext, href: string): string {
  if (!href) {
    return '';
  }

  try {
    return new URL(href, context.windowRef.location.origin).toString();
  } catch (_) {
    return '';
  }
}

function getLocaleInternal(context: ApiContractsContext): string {
  return (context.navigatorRef.language || 'en-US').trim() || 'en-US';
}

function createApiContracts(deps: ApiContractsDeps = {}) {
  const context = createApiContractsContext(deps);
  return {
    sleep: (ms: BoundaryValue) => sleepInternal(context, toNonNegativeNumber(ms)),
    parseRetryAfterMs: (response: BoundaryValue) => parseRetryAfterMsInternal(toRetryAfterResponseLike(response)),
    computeFetchRetryDelayMs: (attemptNumber: BoundaryValue, response: BoundaryValue) =>
      computeFetchRetryDelayMsInternal(context, toNonNegativeNumber(attemptNumber), toRetryAfterResponseLike(response)),
    shouldRetryStatus: (statusCode: BoundaryValue) => shouldRetryStatusInternal(Number(statusCode)),
    makeApiContractError: (endpointName: string, message: string, extra: ApiObjectRecord = {}) =>
      makeApiContractErrorInternal(context, endpointName, message, extra),
    emitApiContractWarning: (endpointName: string, message: string, extra: ApiObjectRecord = {}) =>
      emitApiContractWarningInternal(context, endpointName, message, extra),
    requirePayloadDataArray: (endpointName: string, payload: BoundaryValue) =>
      requirePayloadDataArrayInternal(context, endpointName, payload),
    parsePayloadDataEnvelope: (endpointName: string, payload: BoundaryValue) =>
      parsePayloadDataEnvelopeInternal(context, endpointName, payload),
    auditWatchlistRowsContract: (rows: ApiObjectRecord[]) => auditWatchlistRowsContractInternal(context, rows),
    auditWatchHistoryRowsContract: (rows: ApiObjectRecord[]) => auditWatchHistoryRowsContractInternal(context, rows),
    auditCmsObjectContract: (records: ApiObjectRecord[]) => auditCmsObjectContractInternal(context, records),
    resolveApiHref: (href: BoundaryValue) => resolveApiHrefInternal(context, typeof href === 'string' ? href : ''),
    getLocale: () => getLocaleInternal(context),
  };
}

const apiContractsRuntime = {
  createApiContracts,
};

export function createApiContractsRuntime(): object {
  return apiContractsRuntime;
}
