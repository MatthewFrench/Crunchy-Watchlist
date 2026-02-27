;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type RuntimeState = {
    settings: Record<string, unknown>
    ratingCache: Record<string, unknown>
    watchHistoryCache: unknown
    watchHistoryStatus: string
    watchlistCache: unknown
    authToken?: unknown
    curatedEntries: unknown[]
    curatedSource: string
    curatedLastRevalidateAt: number
    curatedInitialLoadDone?: boolean
  }

  type TokenEntry = {
    accountId?: unknown
    profileId?: unknown
  }

  type StateLoaderContext = {
    state: RuntimeState
    storageGet: (key: string, fallback: unknown) => Promise<unknown>
    getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null>
    runtimeEvent: (event: string, data?: unknown) => void
    normalizeStoredWatchHistoryCache: (raw: unknown) => unknown
    isWatchHistoryCacheValid: (cache: unknown) => boolean
    normalizeStoredWatchlistCache: (raw: unknown) => unknown
    isWatchlistCacheValid: (cache: unknown, accountId?: unknown, profileId?: unknown) => boolean
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
    getAccessToken?: unknown
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

  function applyLegacyAudioSettingsInternal(
    nextSettings: Record<string, unknown>,
    storedSettings: Record<string, unknown>,
  ): void {
    if (typeof nextSettings.audioLocaleFilter === 'string') {
      return
    }

    if (typeof storedSettings.requireEnglishAudio === 'boolean') {
      nextSettings.audioLocaleFilter = storedSettings.requireEnglishAudio ? 'en-US' : 'any'
      return
    }

    if (typeof storedSettings.requireDubTag === 'boolean') {
      nextSettings.audioLocaleFilter = storedSettings.requireDubTag ? 'en-US' : 'any'
    }
  }

  function applyLegacyWatchReadySettingsInternal(
    nextSettings: Record<string, unknown>,
    storedSettings: Record<string, unknown>,
  ): void {
    if (typeof storedSettings.watchReadyFilterMode === 'string') {
      nextSettings.watchReadyFilterMode = storedSettings.watchReadyFilterMode
      return
    }

    if (typeof storedSettings.actionabilityMode === 'string') {
      nextSettings.watchReadyFilterMode = storedSettings.actionabilityMode
      return
    }

    if (typeof storedSettings.hideNonActionable === 'boolean') {
      nextSettings.watchReadyFilterMode = storedSettings.hideNonActionable ? 'hide' : 'none'
    }
  }

  function normalizeWatchReadyFilterModeInternal(value: unknown): 'none' | 'dim' | 'hide' | 'hide_not_started' {
    if (value === 'none' || value === 'dim' || value === 'hide' || value === 'hide_not_started') {
      return value
    }
    return 'hide'
  }

  function normalizeSortSettingsInternal(context: StateLoaderContext, nextSettings: Record<string, unknown>): void {
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
  }

  function normalizeSettingsInternal(context: StateLoaderContext, storedSettingsRaw: unknown): Record<string, unknown> {
    const storedSettings = toRecord(storedSettingsRaw)
    const nextSettings: Record<string, unknown> = {
      ...context.defaultSettings,
      ...storedSettings,
    }

    applyLegacyAudioSettingsInternal(nextSettings, storedSettings)
    applyLegacyWatchReadySettingsInternal(nextSettings, storedSettings)

    nextSettings.audioLocaleFilter = getString(nextSettings.audioLocaleFilter, 'any')
    nextSettings.genreFilter = getString(nextSettings.genreFilter, 'any')

    if (nextSettings.cardLayout !== 'portrait' && nextSettings.cardLayout !== 'landscape') {
      nextSettings.cardLayout = 'portrait'
    }

    nextSettings.watchReadyFilterMode = normalizeWatchReadyFilterModeInternal(nextSettings.watchReadyFilterMode)
    normalizeSortSettingsInternal(context, nextSettings)
    return nextSettings
  }

  async function hydrateRatingCacheInternal(context: StateLoaderContext): Promise<void> {
    const rawRatingCache = await context.storageGet(context.ratingCacheKey, {})
    if (rawRatingCache && typeof rawRatingCache === 'object') {
      context.state.ratingCache = rawRatingCache as Record<string, unknown>
    }
  }

  async function hydrateWatchHistoryCacheInternal(context: StateLoaderContext): Promise<void> {
    const rawWatchHistoryCache = await context.storageGet(context.watchHistoryCacheKey, null)
    if (rawWatchHistoryCache && typeof rawWatchHistoryCache === 'object') {
      context.state.watchHistoryCache = context.normalizeStoredWatchHistoryCache(rawWatchHistoryCache)
    }

    context.state.watchHistoryStatus = context.isWatchHistoryCacheValid(context.state.watchHistoryCache)
      ? 'ready'
      : 'idle'
  }

  async function hydrateWatchlistCacheInternal(context: StateLoaderContext): Promise<void> {
    const rawWatchlistCache = await context.storageGet(context.watchlistCacheKey, null)
    if (rawWatchlistCache && typeof rawWatchlistCache === 'object') {
      context.state.watchlistCache = context.normalizeStoredWatchlistCache(rawWatchlistCache)
    }

    const tokenEntry = await context.getAccessToken(true)
    const accountId = getString(tokenEntry?.accountId, '')
    const profileId = getString(tokenEntry?.profileId, '')
    if (!accountId) {
      context.runtimeEvent('curated-cache-scope-unavailable', {
        hasAccountId: Boolean(accountId),
        hasProfileId: Boolean(profileId),
      })
      return
    }

    const watchlistCacheRecord = toRecord(context.state.watchlistCache)
    const cachedProfileId = getString(watchlistCacheRecord.profileId, '')
    if (!profileId && cachedProfileId) {
      context.runtimeEvent('curated-cache-scope-unavailable', {
        hasAccountId: true,
        hasProfileId: false,
        requiresProfileScope: true,
      })
      return
    }

    if (!context.isWatchlistCacheValid(context.state.watchlistCache, accountId, profileId)) {
      return
    }

    const rows = Array.isArray(watchlistCacheRecord.rows) ? watchlistCacheRecord.rows : []
    const updatedAt = getNumber(watchlistCacheRecord.updatedAt, 0)

    context.state.curatedEntries = context.normalizeEntriesFromApiRows(rows)
    context.state.curatedSource = 'cache'
    context.state.curatedLastRevalidateAt = updatedAt
    context.state.curatedInitialLoadDone = true

    context.runtimeEvent('curated-cache-hydrated', {
      total: context.state.curatedEntries.length,
      updatedAt,
      accountId,
      profileId: profileId || null,
    })
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
      getAccessToken: requireFunction('getAccessToken', options.getAccessToken) as StateLoaderContext['getAccessToken'],
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
    context.state.settings = normalizeSettingsInternal(context, storedSettingsRaw)
    await hydrateRatingCacheInternal(context)
    await hydrateWatchHistoryCacheInternal(context)
    await hydrateWatchlistCacheInternal(context)

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
