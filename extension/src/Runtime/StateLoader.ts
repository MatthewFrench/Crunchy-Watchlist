;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type RuntimeState = {
    settings: Record<string, unknown>
    ratingCache: Record<string, unknown>
    watchHistoryCache: unknown
    watchHistoryStatus: string
    watchlistCache: unknown
    curatedEntries: unknown[]
    curatedSource: string
    curatedLastRevalidateAt: number
  }

  type StateLoaderContext = {
    state: RuntimeState
    storageGet: (key: string, fallback: unknown) => Promise<unknown>
    runtimeEvent: (event: string, data?: unknown) => void
    normalizeStoredWatchHistoryCache: (raw: unknown) => unknown
    isWatchHistoryCacheValid: (cache: unknown) => boolean
    normalizeStoredWatchlistCache: (raw: unknown) => unknown
    isWatchlistCacheValid: (cache: unknown) => boolean
    normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[]
    defaultSettings: Record<string, unknown>
    validSortModes: Set<string>
    defaultSortMode: string
    settingsKey: string
    ratingCacheKey: string
    watchHistoryCacheKey: string
    watchlistCacheKey: string
  }

  type StateLoaderOptions = {
    state?: unknown
    storageGet?: unknown
    runtimeEvent?: unknown
    normalizeStoredWatchHistoryCache?: unknown
    isWatchHistoryCacheValid?: unknown
    normalizeStoredWatchlistCache?: unknown
    isWatchlistCacheValid?: unknown
    normalizeEntriesFromApiRows?: unknown
    defaultSettings?: unknown
    validSortModes?: unknown
    defaultSortMode?: unknown
    settingsKey?: unknown
    ratingCacheKey?: unknown
    watchHistoryCacheKey?: unknown
    watchlistCacheKey?: unknown
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing runtime state-loader dependency: ${name}`)
    }

    return value as T
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {}
    }

    return value as Record<string, unknown>
  }

  function getString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value : fallback
  }

  function getNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
  }

  function createStateLoaderContext(options: StateLoaderOptions = {}): StateLoaderContext {
    const state = options.state && typeof options.state === 'object' ? (options.state as RuntimeState) : null
    if (!state) {
      throw new Error('[CW] Missing runtime state-loader state')
    }

    const defaultSettings =
      options.defaultSettings && typeof options.defaultSettings === 'object'
        ? (options.defaultSettings as Record<string, unknown>)
        : {}
    const validSortModes = options.validSortModes instanceof Set ? options.validSortModes : new Set<string>()
    const defaultSortMode = getString(options.defaultSortMode, 'consensus_quality_desc')

    return {
      state,
      storageGet: requireFunction('storageGet', options.storageGet) as StateLoaderContext['storageGet'],
      runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as StateLoaderContext['runtimeEvent'],
      normalizeStoredWatchHistoryCache: requireFunction(
        'normalizeStoredWatchHistoryCache',
        options.normalizeStoredWatchHistoryCache,
      ) as StateLoaderContext['normalizeStoredWatchHistoryCache'],
      isWatchHistoryCacheValid: requireFunction(
        'isWatchHistoryCacheValid',
        options.isWatchHistoryCacheValid,
      ) as StateLoaderContext['isWatchHistoryCacheValid'],
      normalizeStoredWatchlistCache: requireFunction(
        'normalizeStoredWatchlistCache',
        options.normalizeStoredWatchlistCache,
      ) as StateLoaderContext['normalizeStoredWatchlistCache'],
      isWatchlistCacheValid: requireFunction(
        'isWatchlistCacheValid',
        options.isWatchlistCacheValid,
      ) as StateLoaderContext['isWatchlistCacheValid'],
      normalizeEntriesFromApiRows: requireFunction(
        'normalizeEntriesFromApiRows',
        options.normalizeEntriesFromApiRows,
      ) as StateLoaderContext['normalizeEntriesFromApiRows'],
      defaultSettings,
      validSortModes,
      defaultSortMode,
      settingsKey: getString(options.settingsKey, 'cw_settings_v1'),
      ratingCacheKey: getString(options.ratingCacheKey, 'cw_rating_cache_v2'),
      watchHistoryCacheKey: getString(options.watchHistoryCacheKey, 'cw_watch_history_cache_v1'),
      watchlistCacheKey: getString(options.watchlistCacheKey, 'cw_watchlist_cache_v1'),
    }
  }

  async function loadInitialStateInternal(context: StateLoaderContext): Promise<void> {
    const storedSettingsRaw = await context.storageGet(context.settingsKey, context.defaultSettings)
    const storedSettings = toRecord(storedSettingsRaw)
    const nextSettings: Record<string, unknown> = {
      ...context.defaultSettings,
      ...storedSettings,
    }

    if (typeof nextSettings.audioLocaleFilter !== 'string' && typeof storedSettings.requireEnglishAudio === 'boolean') {
      nextSettings.audioLocaleFilter = storedSettings.requireEnglishAudio ? 'en-US' : 'any'
    }

    if (typeof nextSettings.audioLocaleFilter !== 'string' && typeof storedSettings.requireDubTag === 'boolean') {
      nextSettings.audioLocaleFilter = storedSettings.requireDubTag ? 'en-US' : 'any'
    }

    nextSettings.audioLocaleFilter = getString(nextSettings.audioLocaleFilter, 'any')
    nextSettings.genreFilter = getString(nextSettings.genreFilter, 'any')

    if (nextSettings.cardLayout !== 'portrait' && nextSettings.cardLayout !== 'landscape') {
      nextSettings.cardLayout = 'portrait'
    }

    if (typeof storedSettings.watchReadyFilterMode === 'string') {
      nextSettings.watchReadyFilterMode = storedSettings.watchReadyFilterMode
    } else if (typeof storedSettings.actionabilityMode === 'string') {
      nextSettings.watchReadyFilterMode = storedSettings.actionabilityMode
    } else if (typeof storedSettings.hideNonActionable === 'boolean') {
      nextSettings.watchReadyFilterMode = storedSettings.hideNonActionable ? 'hide' : 'none'
    }

    if (
      nextSettings.watchReadyFilterMode !== 'none' &&
      nextSettings.watchReadyFilterMode !== 'dim' &&
      nextSettings.watchReadyFilterMode !== 'hide'
    ) {
      nextSettings.watchReadyFilterMode = 'hide'
    }

    const sortMode = typeof nextSettings.sortMode === 'string' ? nextSettings.sortMode : ''
    if (!context.validSortModes.has(sortMode)) {
      nextSettings.sortMode = context.defaultSortMode
    }
    const defaultSecondarySortMode = getString(context.defaultSettings.secondarySortMode, 'none')
    const secondarySortMode = typeof nextSettings.secondarySortMode === 'string' ? nextSettings.secondarySortMode : ''
    if (!context.validSortModes.has(secondarySortMode)) {
      nextSettings.secondarySortMode = defaultSecondarySortMode
    }
    if (nextSettings.secondarySortMode === nextSettings.sortMode) {
      nextSettings.secondarySortMode = defaultSecondarySortMode
    }

    context.state.settings = nextSettings

    const rawRatingCache = await context.storageGet(context.ratingCacheKey, {})
    if (rawRatingCache && typeof rawRatingCache === 'object') {
      context.state.ratingCache = rawRatingCache as Record<string, unknown>
    }

    const rawWatchHistoryCache = await context.storageGet(context.watchHistoryCacheKey, null)
    if (rawWatchHistoryCache && typeof rawWatchHistoryCache === 'object') {
      context.state.watchHistoryCache = context.normalizeStoredWatchHistoryCache(rawWatchHistoryCache)
    }

    context.state.watchHistoryStatus = context.isWatchHistoryCacheValid(context.state.watchHistoryCache)
      ? 'ready'
      : 'idle'

    const rawWatchlistCache = await context.storageGet(context.watchlistCacheKey, null)
    if (rawWatchlistCache && typeof rawWatchlistCache === 'object') {
      context.state.watchlistCache = context.normalizeStoredWatchlistCache(rawWatchlistCache)
    }

    if (context.isWatchlistCacheValid(context.state.watchlistCache)) {
      const watchlistCacheRecord = toRecord(context.state.watchlistCache)
      const rows = Array.isArray(watchlistCacheRecord.rows) ? watchlistCacheRecord.rows : []
      const updatedAt = getNumber(watchlistCacheRecord.updatedAt, 0)

      context.state.curatedEntries = context.normalizeEntriesFromApiRows(rows)
      context.state.curatedSource = 'cache'
      context.state.curatedLastRevalidateAt = updatedAt

      context.runtimeEvent('curated-cache-hydrated', {
        total: context.state.curatedEntries.length,
        updatedAt,
      })
    }

    context.runtimeEvent('state-load-done', {
      tab: context.state.settings.activeTab,
      cachedCurated: context.state.curatedEntries.length,
    })
  }

  function createStateLoader(options: StateLoaderOptions = {}) {
    const context = createStateLoaderContext(options)
    return {
      loadInitialState: () => loadInitialStateInternal(context),
    }
  }

  moduleRegistry.runtimeStateLoader = {
    createStateLoader,
  }
})()
