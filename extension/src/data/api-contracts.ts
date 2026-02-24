;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type RuntimeEventFn = (eventName: string, payload: Record<string, unknown>) => void

  type ApiContractsDeps = {
    windowRef?: unknown
    navigatorRef?: unknown
    runtimeEvent?: unknown
    parseDateMs?: unknown
    getWatchlistSeriesId?: unknown
    getWatchHistorySeriesId?: unknown
    fetchBackoffBaseMs?: unknown
    fetchBackoffJitterMs?: unknown
  }

  type ApiContractsContext = {
    windowRef: Window & typeof globalThis
    navigatorRef: Navigator
    runtimeEvent: RuntimeEventFn
    parseDateMs: (value: unknown) => number | null
    getWatchlistSeriesId: (entry: unknown) => string | null
    getWatchHistorySeriesId: (entry: unknown) => string | null
    fetchBackoffBaseMs: number
    fetchBackoffJitterMs: number
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing API contract dependency: ${name}`)
    }
    return value as T
  }

  function requireWindowRef(value: unknown): Window & typeof globalThis {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing API contract dependency: windowRef')
    }
    const candidate = value as { setTimeout?: unknown; location?: { origin?: unknown } }
    if (typeof candidate.setTimeout !== 'function') {
      throw new Error('[CW] Missing API contract dependency: windowRef.setTimeout')
    }
    if (!candidate.location || typeof candidate.location.origin !== 'string') {
      throw new Error('[CW] Missing API contract dependency: windowRef.location.origin')
    }
    return value as Window & typeof globalThis
  }

  function requireNavigatorRef(value: unknown): Navigator {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing API contract dependency: navigatorRef')
    }
    return value as Navigator
  }

  function toPositiveNumber(value: unknown, fallback: number): number {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return fallback
    }
    return numeric
  }

  function createApiContractsContext(deps: ApiContractsDeps = {}): ApiContractsContext {
    return {
      windowRef: requireWindowRef(deps.windowRef),
      navigatorRef: requireNavigatorRef(deps.navigatorRef),
      runtimeEvent: requireFunction('runtimeEvent', deps.runtimeEvent) as RuntimeEventFn,
      parseDateMs: requireFunction('parseDateMs', deps.parseDateMs) as ApiContractsContext['parseDateMs'],
      getWatchlistSeriesId: requireFunction(
        'getWatchlistSeriesId',
        deps.getWatchlistSeriesId,
      ) as ApiContractsContext['getWatchlistSeriesId'],
      getWatchHistorySeriesId: requireFunction(
        'getWatchHistorySeriesId',
        deps.getWatchHistorySeriesId,
      ) as ApiContractsContext['getWatchHistorySeriesId'],
      fetchBackoffBaseMs: toPositiveNumber(deps.fetchBackoffBaseMs, 400),
      fetchBackoffJitterMs: toPositiveNumber(deps.fetchBackoffJitterMs, 220),
    }
  }

  function sleepInternal(context: ApiContractsContext, ms: unknown): Promise<void> {
    return new Promise((resolve) => {
      context.windowRef.setTimeout(resolve, Math.max(0, Number(ms) || 0))
    })
  }

  function parseRetryAfterMsInternal(response: unknown): number | null {
    try {
      const headers = response && typeof response === 'object' ? (response as { headers?: Headers }).headers : null
      const raw = headers?.get('retry-after')
      if (!raw) {
        return null
      }

      const seconds = Number(raw)
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(30000, Math.round(seconds * 1000))
      }

      const when = Date.parse(raw)
      if (Number.isFinite(when)) {
        return Math.min(30000, Math.max(0, when - Date.now()))
      }
    } catch (_) {
      // no-op
    }

    return null
  }

  function computeFetchRetryDelayMsInternal(
    context: ApiContractsContext,
    attemptNumber: unknown,
    response: unknown,
  ): number {
    const retryAfterMs = parseRetryAfterMsInternal(response)
    if (retryAfterMs != null) {
      return retryAfterMs
    }

    const exponent = Math.max(0, Number(attemptNumber) - 1)
    const exponential = context.fetchBackoffBaseMs * 2 ** exponent
    const jitter = Math.round(Math.random() * context.fetchBackoffJitterMs)
    return Math.min(10000, exponential + jitter)
  }

  function shouldRetryStatusInternal(statusCode: unknown): boolean {
    const status = Number(statusCode)
    return status === 429 || (status >= 500 && status < 600)
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
    })
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
    })
    return new Error(`Crunchyroll API contract changed for ${endpointName}: ${message}`)
  }

  function requirePayloadDataArrayInternal(
    context: ApiContractsContext,
    endpointName: string,
    payload: unknown,
  ): unknown[] {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw makeApiContractErrorInternal(context, endpointName, 'expected a JSON object with a data[] array')
    }

    const data = (payload as Record<string, unknown>).data
    if (!Array.isArray(data)) {
      throw makeApiContractErrorInternal(context, endpointName, 'expected a JSON object with a data[] array')
    }

    return data
  }

  function auditWatchlistRowsContractInternal(context: ApiContractsContext, rows: unknown[]): void {
    let missingPanelCount = 0
    let missingSeriesCount = 0
    let missingEpisodeMetaCount = 0

    for (const row of rows) {
      if (!row || typeof row !== 'object') {
        missingPanelCount += 1
        continue
      }

      const rowRecord = row as Record<string, unknown>
      if (!rowRecord.panel || typeof rowRecord.panel !== 'object') {
        missingPanelCount += 1
        continue
      }

      const panel = rowRecord.panel as Record<string, unknown>
      if (!panel.episode_metadata || typeof panel.episode_metadata !== 'object') {
        missingEpisodeMetaCount += 1
      }

      if (!context.getWatchlistSeriesId(row)) {
        missingSeriesCount += 1
      }
    }

    if (missingPanelCount || missingEpisodeMetaCount || missingSeriesCount) {
      emitApiContractWarningInternal(context, 'watchlist', 'rows are missing expected fields', {
        rowCount: rows.length,
        missingPanelCount,
        missingEpisodeMetaCount,
        missingSeriesCount,
      })
    }
  }

  function auditWatchHistoryRowsContractInternal(context: ApiContractsContext, rows: unknown[]): void {
    let missingSeriesCount = 0
    let missingDatePlayedCount = 0

    for (const row of rows) {
      const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
      if (!context.getWatchHistorySeriesId(row)) {
        missingSeriesCount += 1
      }
      if (context.parseDateMs(record.date_played) == null) {
        missingDatePlayedCount += 1
      }
    }

    if (missingSeriesCount || missingDatePlayedCount) {
      emitApiContractWarningInternal(context, 'watch-history', 'rows are missing expected fields', {
        rowCount: rows.length,
        missingSeriesCount,
        missingDatePlayedCount,
      })
    }
  }

  function auditCmsObjectContractInternal(context: ApiContractsContext, records: unknown[]): void {
    let missingIdCount = 0
    let missingSeriesMetadataCount = 0
    let missingRatingCount = 0

    for (const record of records) {
      if (!record || typeof record !== 'object') {
        missingIdCount += 1
        missingSeriesMetadataCount += 1
        missingRatingCount += 1
        continue
      }

      const row = record as Record<string, unknown>
      if (typeof row.id !== 'string' || !row.id) {
        missingIdCount += 1
      }
      if (!row.series_metadata || typeof row.series_metadata !== 'object') {
        missingSeriesMetadataCount += 1
      }
      if (!row.rating || typeof row.rating !== 'object') {
        missingRatingCount += 1
      }
    }

    if (missingIdCount || missingSeriesMetadataCount) {
      emitApiContractWarningInternal(context, 'cms-objects', 'records are missing expected fields', {
        recordCount: records.length,
        missingIdCount,
        missingSeriesMetadataCount,
        missingRatingCount,
      })
    }
  }

  function resolveApiHrefInternal(context: ApiContractsContext, href: unknown): string {
    if (!href || typeof href !== 'string') {
      return ''
    }

    try {
      return new URL(href, context.windowRef.location.origin).toString()
    } catch (_) {
      return ''
    }
  }

  function getLocaleInternal(context: ApiContractsContext): string {
    return (context.navigatorRef.language || 'en-US').trim() || 'en-US'
  }

  function createApiContracts(deps: ApiContractsDeps = {}) {
    const context = createApiContractsContext(deps)
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
      auditWatchlistRowsContract: (rows: unknown[]) => auditWatchlistRowsContractInternal(context, rows),
      auditWatchHistoryRowsContract: (rows: unknown[]) => auditWatchHistoryRowsContractInternal(context, rows),
      auditCmsObjectContract: (records: unknown[]) => auditCmsObjectContractInternal(context, records),
      resolveApiHref: (href: unknown) => resolveApiHrefInternal(context, href),
      getLocale: () => getLocaleInternal(context),
    }
  }

  ;(moduleRegistry as Record<string, unknown>).apiContracts = {
    createApiContracts,
  }
})()
