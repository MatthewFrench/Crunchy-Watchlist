;(() => {
  type AnyFn = (...args: unknown[]) => unknown
  type LooseRecord = Record<string, unknown>

  type WatchHistoryEntry = {
    seriesId: string
    datePlayedMs: number
    datePlayed: string
    seasonNumber: number | null
    episodeNumber: number | null
    absoluteEpisodeNumber: number | null
    episodeDurationMs: number | null
    episodeId: string | null
    identifier: string
    canonicalEpisodeKey: string
    episodeTitle: string
    playhead: number
    fullyWatched: boolean
    audioLocale: string
    audioLocaleInferred: boolean
  }

  type WatchHistoryLocaleMap = Record<string, WatchHistoryEntry>

  type WatchHistoryCache = {
    version: number
    accountId: string
    updatedAt: number
    bySeriesId: Record<string, WatchHistoryEntry>
    bySeriesIdAudioLocale: Record<string, WatchHistoryLocaleMap>
    bySeriesIdProgress: Record<string, WatchHistoryEntry>
    bySeriesIdAudioLocaleProgress: Record<string, WatchHistoryLocaleMap>
  }

  type HistoryRepositoryOptions = {
    state?: unknown
    normalizeAudioLocale?: unknown
    sanitizePositiveInt?: unknown
    parseDateMs?: unknown
    pickFirstPositiveInt?: unknown
    deriveCanonicalEpisodeKeyFromEpisodeMetadata?: unknown
    getAbsoluteEpisodeNumberFromEpisodeMetadata?: unknown
    getPreferredAudioLanguage?: unknown
    getLocale?: unknown
    resolveApiHref?: unknown
    fetchWithResilience?: unknown
    createAuthRefreshHandler?: unknown
    requirePayloadDataArray?: unknown
    auditWatchHistoryRowsContract?: unknown
    createEmptyWatchHistoryCache?: unknown
    scheduleSaveWatchHistory?: unknown
    pushApiTrace?: unknown
    runtimeEvent?: unknown
    watchHistoryCacheVersion?: unknown
    watchHistoryCacheTtlMs?: unknown
    watchHistoryPageSize?: unknown
    watchHistoryMaxPages?: unknown
    watchHistoryNoMatchPageLimit?: unknown
  }

  type HistoryRepository = {
    normalizeStoredWatchHistoryCache: (raw: unknown) => WatchHistoryCache
    isWatchHistoryCacheValid: (cache: unknown, accountId?: unknown) => boolean
    getCachedWatchHistory: (
      seriesId: unknown,
      audioLocale?: unknown,
      allowSeriesFallback?: boolean,
    ) => WatchHistoryEntry | null
    getCachedWatchHistoryProgress: (
      seriesId: unknown,
      audioLocale?: unknown,
      allowSeriesFallback?: boolean,
    ) => WatchHistoryEntry | null
    preloadWatchHistoryForEntries: (
      entries: unknown,
      tokenEntry: unknown,
      force?: boolean,
      preferredAudioLanguage?: unknown,
    ) => Promise<unknown>
    isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown, audioLocale: unknown) => boolean
  }

  type HistoryRepositoryCache = {
    normalizeStoredWatchHistoryCache: (raw: unknown) => WatchHistoryCache
    normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: unknown) => Record<string, WatchHistoryLocaleMap>
    normalizeWatchHistoryEntry: (value: unknown) => WatchHistoryEntry | null
    isWatchHistoryCacheValid: (cache: unknown, accountId?: unknown) => boolean
    shouldReplaceWatchHistoryProgress: (previous: unknown, next: unknown) => boolean
    getCachedWatchHistory: (
      seriesId: unknown,
      audioLocale?: unknown,
      allowSeriesFallback?: boolean,
    ) => WatchHistoryEntry | null
    getCachedWatchHistoryProgress: (
      seriesId: unknown,
      audioLocale?: unknown,
      allowSeriesFallback?: boolean,
    ) => WatchHistoryEntry | null
  }

  type HistoryRepositoryPreload = {
    preloadWatchHistoryForEntries: (
      entries: unknown,
      tokenEntry: unknown,
      force?: boolean,
      preferredAudioLanguage?: unknown,
    ) => Promise<unknown>
    isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown, audioLocale: unknown) => boolean
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function toRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object') {
      return {}
    }
    return value as LooseRecord
  }

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing history repository dependency: ${name}`)
    }
    return value as T
  }

  function assertCacheRepository(value: unknown): asserts value is HistoryRepositoryCache {
    const cacheRepository = toRecord(value)
    const requiredMethods = [
      'normalizeStoredWatchHistoryCache',
      'normalizeStoredWatchHistoryBySeriesAudioLocale',
      'normalizeWatchHistoryEntry',
      'isWatchHistoryCacheValid',
      'shouldReplaceWatchHistoryProgress',
      'getCachedWatchHistory',
      'getCachedWatchHistoryProgress',
    ]

    requiredMethods.forEach((methodName) => {
      if (typeof cacheRepository[methodName] !== 'function') {
        throw new Error(`[CW] Missing history cache repository method: ${methodName}`)
      }
    })
  }

  function assertPreloadRepository(value: unknown): asserts value is HistoryRepositoryPreload {
    const preloadRepository = toRecord(value)
    const requiredMethods = ['preloadWatchHistoryForEntries', 'isLocalizedWatchHistoryDataMissingForEntries']

    requiredMethods.forEach((methodName) => {
      if (typeof preloadRepository[methodName] !== 'function') {
        throw new Error(`[CW] Missing history preload repository method: ${methodName}`)
      }
    })
  }

  function createHistoryRepository(options: HistoryRepositoryOptions = {}): HistoryRepository {
    const cacheModule = toRecord(moduleRegistry.historyRepositoryCache)
    const preloadModule = toRecord(moduleRegistry.historyRepositoryPreload)

    const createHistoryRepositoryCache = requireFunction<(value: unknown) => unknown>(
      'createHistoryRepositoryCache',
      cacheModule.createHistoryRepositoryCache,
    )
    const createHistoryRepositoryPreload = requireFunction<(value: unknown) => unknown>(
      'createHistoryRepositoryPreload',
      preloadModule.createHistoryRepositoryPreload,
    )

    const cacheRepositoryCandidate = createHistoryRepositoryCache(options)
    assertCacheRepository(cacheRepositoryCandidate)
    const cacheRepository = cacheRepositoryCandidate

    const preloadRepositoryCandidate = createHistoryRepositoryPreload({
      ...options,
      normalizeStoredWatchHistoryCache: cacheRepository.normalizeStoredWatchHistoryCache,
      normalizeStoredWatchHistoryBySeriesAudioLocale: cacheRepository.normalizeStoredWatchHistoryBySeriesAudioLocale,
      normalizeWatchHistoryEntry: cacheRepository.normalizeWatchHistoryEntry,
      isWatchHistoryCacheValid: cacheRepository.isWatchHistoryCacheValid,
      shouldReplaceWatchHistoryProgress: cacheRepository.shouldReplaceWatchHistoryProgress,
      getCachedWatchHistory: cacheRepository.getCachedWatchHistory,
    })
    assertPreloadRepository(preloadRepositoryCandidate)
    const preloadRepository = preloadRepositoryCandidate

    return {
      normalizeStoredWatchHistoryCache: cacheRepository.normalizeStoredWatchHistoryCache,
      isWatchHistoryCacheValid: cacheRepository.isWatchHistoryCacheValid,
      getCachedWatchHistory: cacheRepository.getCachedWatchHistory,
      getCachedWatchHistoryProgress: cacheRepository.getCachedWatchHistoryProgress,
      preloadWatchHistoryForEntries: preloadRepository.preloadWatchHistoryForEntries,
      isLocalizedWatchHistoryDataMissingForEntries: preloadRepository.isLocalizedWatchHistoryDataMissingForEntries,
    }
  }

  moduleRegistry.historyRepository = {
    createHistoryRepository,
  }
})()
