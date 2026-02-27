;(() => {
  type WatchHistoryCache = {
    version: number
    accountId: string
    updatedAt: number
    bySeriesId: Record<string, unknown>
    bySeriesIdAudioLocale: Record<string, unknown>
    bySeriesIdProgress: Record<string, unknown>
    bySeriesIdAudioLocaleProgress: Record<string, unknown>
  }

  type WatchlistCacheSnapshot = {
    accountId: string
    profileId: string
    updatedAt: number
    rows: unknown[]
  }

  type ApiTraceBuckets = {
    authToken: unknown[]
    watchlist: unknown[]
    watchHistory: unknown[]
    cmsObjects: unknown[]
    legacyRating: unknown[]
    preview: unknown[]
  }

  type RuntimeStateOptions = {
    defaultSettings?: Record<string, unknown>
    watchHistoryCacheVersion?: unknown
  }

  type RuntimeState = {
    mounted: boolean
    observer: MutationObserver | null
    routeWatcherStarted: boolean
    routeSyncTimer: number | null
    processTimer: number | null
    saveRatingsTimer: number | null
    saveWatchHistoryTimer: number | null
    saveWatchlistCacheTimer: number | null
    settings: Record<string, unknown>
    ratingCache: Record<string, unknown>
    ratingInflight: Map<string, Promise<unknown>>
    ratingLocalePreloadInflight: Map<string, Promise<unknown>>
    watchHistoryLocalePreloadInflight: Map<string, Promise<unknown>>
    watchHistoryCache: WatchHistoryCache
    watchHistoryStatus: string
    watchlistCache: WatchlistCacheSnapshot
    watchHistoryInflight: Promise<unknown> | null
    preferredAudioLanguage: string | null
    preferredAudioLanguageUpdatedAt: number
    apiTrace: ApiTraceBuckets
    previewCache: Record<string, unknown>
    previewInflight: Map<string, Promise<unknown>>
    authToken: unknown
    authTokenInflight: Promise<unknown> | null
    curatedEntries: unknown[]
    curatedError: unknown
    curatedSource: string
    curatedInflight: Promise<unknown> | null
    curatedInitialLoadDone: boolean
    curatedPendingRequests: string[]
    curatedPendingRequestStartedCount: number
    curatedPendingRequestCompletedCount: number
    curatedObservedPromise: Promise<unknown> | null
    curatedLastRevalidateAt: number
    mutationMuted: boolean
    hostEl: Element | null
    tabCrunchyrollEl: Element | null
    tabCuratedEl: Element | null
    curatedPanelEl: Element | null
    controlsEl: Element | null
    loadingIndicatorEl: Element | null
    audioFilterSelectEl: Element | null
    genreFilterSelectEl: Element | null
    statsEl: Element | null
    gridEl: Element | null
    curatedGridRenderSignature: string
    framedRootEl: Element | null
    nativeHiddenNodes: Element[]
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function createEmptyWatchHistoryCache(watchHistoryCacheVersion: unknown): WatchHistoryCache {
    return {
      version: Number.isFinite(Number(watchHistoryCacheVersion)) ? Number(watchHistoryCacheVersion) : 0,
      accountId: '',
      updatedAt: 0,
      bySeriesId: {},
      bySeriesIdAudioLocale: {},
      bySeriesIdProgress: {},
      bySeriesIdAudioLocaleProgress: {},
    }
  }

  type WatchlistCacheSnapshotArgs = {
    profileId: string
    updatedAt: number
    rows: unknown[]
  }

  // Keep compatibility with legacy call-sites that still pass:
  // (accountId, updatedAt, rows). New call-sites pass:
  // (accountId, profileId, updatedAt, rows).
  function resolveWatchlistCacheSnapshotArgs(
    profileIdOrUpdatedAt: unknown,
    updatedAtOrRows: unknown,
    rowsMaybe: unknown,
  ): WatchlistCacheSnapshotArgs {
    if ((rowsMaybe !== undefined && Array.isArray(rowsMaybe)) || typeof profileIdOrUpdatedAt === 'string') {
      return {
        profileId: typeof profileIdOrUpdatedAt === 'string' ? profileIdOrUpdatedAt : '',
        updatedAt: typeof updatedAtOrRows === 'number' ? updatedAtOrRows : 0,
        rows: Array.isArray(rowsMaybe) ? rowsMaybe : [],
      }
    }

    return {
      profileId: '',
      updatedAt: typeof profileIdOrUpdatedAt === 'number' ? profileIdOrUpdatedAt : 0,
      rows: Array.isArray(updatedAtOrRows) ? updatedAtOrRows : [],
    }
  }

  function createWatchlistCacheSnapshot(
    accountId: unknown = '',
    profileIdOrUpdatedAt: unknown = '',
    updatedAtOrRows: unknown = 0,
    rowsMaybe?: unknown,
  ): WatchlistCacheSnapshot {
    const normalizedArgs = resolveWatchlistCacheSnapshotArgs(profileIdOrUpdatedAt, updatedAtOrRows, rowsMaybe)
    return {
      accountId: typeof accountId === 'string' ? accountId : '',
      profileId: normalizedArgs.profileId,
      updatedAt: normalizedArgs.updatedAt,
      rows: normalizedArgs.rows,
    }
  }

  function createApiTraceBuckets(): ApiTraceBuckets {
    return {
      authToken: [],
      watchlist: [],
      watchHistory: [],
      cmsObjects: [],
      legacyRating: [],
      preview: [],
    }
  }

  function createRuntimeState(options: RuntimeStateOptions = {}): RuntimeState {
    const defaultSettings =
      options.defaultSettings && typeof options.defaultSettings === 'object' ? options.defaultSettings : {}
    const watchHistoryCacheVersion = options.watchHistoryCacheVersion

    return {
      mounted: false,
      observer: null,
      routeWatcherStarted: false,
      routeSyncTimer: null,
      processTimer: null,
      saveRatingsTimer: null,
      saveWatchHistoryTimer: null,
      saveWatchlistCacheTimer: null,
      settings: { ...defaultSettings },
      ratingCache: {},
      ratingInflight: new Map(),
      ratingLocalePreloadInflight: new Map(),
      watchHistoryLocalePreloadInflight: new Map(),
      watchHistoryCache: createEmptyWatchHistoryCache(watchHistoryCacheVersion),
      watchHistoryStatus: 'idle',
      watchlistCache: createWatchlistCacheSnapshot(),
      watchHistoryInflight: null,
      preferredAudioLanguage: null,
      preferredAudioLanguageUpdatedAt: 0,
      apiTrace: createApiTraceBuckets(),
      previewCache: {},
      previewInflight: new Map(),
      authToken: null,
      authTokenInflight: null,
      curatedEntries: [],
      curatedError: null,
      curatedSource: 'none',
      curatedInflight: null,
      curatedInitialLoadDone: false,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedObservedPromise: null,
      curatedLastRevalidateAt: 0,
      mutationMuted: false,
      hostEl: null,
      tabCrunchyrollEl: null,
      tabCuratedEl: null,
      curatedPanelEl: null,
      controlsEl: null,
      loadingIndicatorEl: null,
      audioFilterSelectEl: null,
      genreFilterSelectEl: null,
      statsEl: null,
      gridEl: null,
      curatedGridRenderSignature: '',
      framedRootEl: null,
      nativeHiddenNodes: [],
    }
  }

  moduleRegistry.runtimeStore = {
    createEmptyWatchHistoryCache,
    createWatchlistCacheSnapshot,
    createApiTraceBuckets,
    createRuntimeState,
  }
})()
