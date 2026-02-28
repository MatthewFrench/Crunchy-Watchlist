(() => {
  type ApiObjectRecord = Record<string, unknown>;

  type RuntimeEventFn = (eventName: string, payload: ApiObjectRecord) => void;

  type ApiContractsDeps = {
    windowRef?: unknown;
    navigatorRef?: unknown;
    runtimeEvent?: unknown;
    parseDateMs?: unknown;
    getWatchlistSeriesId?: unknown;
    getWatchHistorySeriesId?: unknown;
    fetchBackoffBaseMs?: unknown;
    fetchBackoffJitterMs?: unknown;
  };

  type ApiContractsContext = {
    windowRef: Window & typeof globalThis;
    navigatorRef: Navigator;
    runtimeEvent: RuntimeEventFn;
    parseDateMs: (value: unknown) => number | null;
    getWatchlistSeriesId: (entry: ApiObjectRecord) => string | null;
    getWatchHistorySeriesId: (entry: ApiObjectRecord) => string | null;
    fetchBackoffBaseMs: number;
    fetchBackoffJitterMs: number;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing API contract dependency: ${name}`);
    }
    return value as T;
  }

  function requireWindowRef(value: unknown): Window & typeof globalThis {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing API contract dependency: windowRef');
    }
    const candidate = value as { setTimeout?: unknown; location?: { origin?: unknown } };
    if (typeof candidate.setTimeout !== 'function') {
      throw new Error('[CW] Missing API contract dependency: windowRef.setTimeout');
    }
    if (!candidate.location || typeof candidate.location.origin !== 'string') {
      throw new Error('[CW] Missing API contract dependency: windowRef.location.origin');
    }
    return value as Window & typeof globalThis;
  }

  function requireNavigatorRef(value: unknown): Navigator {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing API contract dependency: navigatorRef');
    }
    return value as Navigator;
  }

  function toPositiveNumber(value: unknown, fallback: number): number {
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
      runtimeEvent: requireFunction('runtimeEvent', deps.runtimeEvent) as RuntimeEventFn,
      parseDateMs: requireFunction('parseDateMs', deps.parseDateMs) as ApiContractsContext['parseDateMs'],
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

  function sleepInternal(context: ApiContractsContext, ms: unknown): Promise<void> {
    return new Promise((resolve) => {
      context.windowRef.setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });
  }

  function parseRetryAfterMsInternal(response: unknown): number | null {
    try {
      const headers = response && typeof response === 'object' ? (response as { headers?: Headers }).headers : null;
      const raw = headers?.get('retry-after');
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
    attemptNumber: unknown,
    response: unknown,
  ): number {
    const retryAfterMs = parseRetryAfterMsInternal(response);
    if (retryAfterMs != null) {
      return retryAfterMs;
    }

    const exponent = Math.max(0, Number(attemptNumber) - 1);
    const exponential = context.fetchBackoffBaseMs * 2 ** exponent;
    const jitter = Math.round(Math.random() * context.fetchBackoffJitterMs);
    return Math.min(10000, exponential + jitter);
  }

  function shouldRetryStatusInternal(statusCode: unknown): boolean {
    const status = Number(statusCode);
    return status === 429 || (status >= 500 && status < 600);
  }

  function emitApiContractWarningInternal(
    context: ApiContractsContext,
    endpointName: string,
    message: string,
    extra: Record<string, unknown> = {},
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
    extra: Record<string, unknown> = {},
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
    payload: unknown,
  ): ApiObjectRecord[] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw makeApiContractErrorInternal(context, endpointName, 'expected a JSON object with a data[] array');
    }

    const data = (payload as ApiObjectRecord).data;
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

  function resolveApiHrefInternal(context: ApiContractsContext, href: unknown): string {
    if (!href || typeof href !== 'string') {
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
      sleep: (ms: unknown) => sleepInternal(context, ms),
      parseRetryAfterMs: (response: unknown) => parseRetryAfterMsInternal(response),
      computeFetchRetryDelayMs: (attemptNumber: unknown, response: unknown) =>
        computeFetchRetryDelayMsInternal(context, attemptNumber, response),
      shouldRetryStatus: (statusCode: unknown) => shouldRetryStatusInternal(statusCode),
      makeApiContractError: (endpointName: string, message: string, extra: Record<string, unknown> = {}) =>
        makeApiContractErrorInternal(context, endpointName, message, extra),
      emitApiContractWarning: (endpointName: string, message: string, extra: Record<string, unknown> = {}) =>
        emitApiContractWarningInternal(context, endpointName, message, extra),
      requirePayloadDataArray: (endpointName: string, payload: unknown) =>
        requirePayloadDataArrayInternal(context, endpointName, payload),
      auditWatchlistRowsContract: (rows: ApiObjectRecord[]) => auditWatchlistRowsContractInternal(context, rows),
      auditWatchHistoryRowsContract: (rows: ApiObjectRecord[]) => auditWatchHistoryRowsContractInternal(context, rows),
      auditCmsObjectContract: (records: ApiObjectRecord[]) => auditCmsObjectContractInternal(context, records),
      resolveApiHref: (href: unknown) => resolveApiHrefInternal(context, href),
      getLocale: () => getLocaleInternal(context),
    };
  }

  (moduleRegistry as Record<string, unknown>).apiContracts = {
    createApiContracts,
  };
})();
