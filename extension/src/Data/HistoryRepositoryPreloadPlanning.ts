;(() => {
  type LooseRecord = Record<string, unknown>

  type HistoryPreloadEntry = {
    seriesId?: unknown
    neverWatched?: unknown
    playheadMs?: unknown
  }

  type ResolveHistoryPreloadPlanOptions = {
    entries: HistoryPreloadEntry[]
    preferredAudioLanguage: unknown
    getPreferredAudioLanguage: () => string
    normalizeAudioLocale: (value: unknown) => string
  }

  type ResolveHistoryPreloadPlanResult = {
    effectivePreferredAudioLanguage: string
    isDefaultPreferredAudio: boolean
    candidateSeriesIds: string[]
  }

  type GetHistoryPayloadTotalOptions = {
    payload: unknown
    fallback: number
    pageNumber: number
    requestUrl: string
    runtimeEvent: (event: string, payload?: unknown) => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function toRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as LooseRecord
  }

  function resolveHistoryPreloadPlan(options: ResolveHistoryPreloadPlanOptions): ResolveHistoryPreloadPlanResult {
    const defaultPreferredAudioLanguage = options.getPreferredAudioLanguage()
    const effectivePreferredAudioLanguage =
      options.normalizeAudioLocale(options.preferredAudioLanguage) || defaultPreferredAudioLanguage
    const isDefaultPreferredAudio =
      effectivePreferredAudioLanguage.toLowerCase() === defaultPreferredAudioLanguage.toLowerCase()
    const candidateSeriesIds = Array.from(
      new Set(
        options.entries
          .filter((entry) => entry?.seriesId)
          .filter((entry) => !entry.neverWatched || Number(entry.playheadMs || 0) > 0)
          .map((entry) => (typeof entry.seriesId === 'string' ? entry.seriesId : ''))
          .filter((seriesId): seriesId is string => !!seriesId),
      ),
    )

    return {
      effectivePreferredAudioLanguage,
      isDefaultPreferredAudio,
      candidateSeriesIds,
    }
  }

  function getHistoryPayloadTotal(options: GetHistoryPayloadTotalOptions): number {
    const totalValue = toRecord(options.payload).total
    const parsedTotal = Number(totalValue)
    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      options.runtimeEvent('watch-history-contract-warning', {
        reason: 'invalid-total-value',
        totalValue,
        fallbackTotal: options.fallback,
        page: Math.max(1, Number(options.pageNumber) || 1),
        requestUrl: options.requestUrl,
      })
      return options.fallback
    }

    return Math.round(parsedTotal)
  }

  moduleRegistry.historyRepositoryPreloadPlanning = {
    getHistoryPayloadTotal,
    resolveHistoryPreloadPlan,
  }
})()
