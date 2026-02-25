;(() => {
  type SortModeOption = {
    optionValue: string
    title: string
  }

  type RuntimeConstants = {
    settingsKey: string
    ratingCacheKey: string
    watchHistoryCacheKey: string
    watchlistCacheKey: string
    watchHistoryCacheVersion: number
    ratingCacheTtlMs: number
    watchHistoryCacheTtlMs: number
    watchlistCacheTtlMs: number
    processDebounceMs: number
    watchlistPageSize: number
    watchlistMaxPages: number
    watchlistRevalidateCooldownMs: number
    watchHistoryPageSize: number
    watchHistoryMaxPages: number
    watchHistoryNoMatchPageLimit: number
    ratingBatchSize: number
    fetchTimeoutMs: number
    fetchMaxAttempts: number
    fetchBackoffBaseMs: number
    fetchBackoffJitterMs: number
    authClientBasic: string
    authDeviceKey: string
    authTokenSkewMs: number
    previewHoverDelayMs: number
    preferredAudioCacheTtlMs: number
    preferredAudioStorageScanLimit: number
    preferredAudioValueScanLimit: number
    apiTraceLimitPerEndpoint: number
  }

  type BootstrapConfig = {
    defaultSortMode: string
    validSortModes: Set<string>
    sortModeControlOptions: SortModeOption[]
    runtimeConstants: RuntimeConstants
    defaultSettings: {
      activeTab: string
      watchReadyFilterMode: string
      audioLocaleFilter: string
      genreFilter: string
      cardLayout: string
      sortMode: string
      secondarySortMode: string
    }
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  const DEFAULT_SORT_MODE = 'consensus_quality_desc'
  const VALID_SORT_MODE_VALUES = [
    'none',
    'rating_desc',
    'rating_asc',
    'hidden_gems_desc',
    'consensus_quality_desc',
    'controversial_desc',
    'quality_floor_asc',
    'quick_wins_asc',
    'dormant_backlog_asc',
    'rewatch_memory_desc',
    'recent_activity_desc',
    'date_added_desc',
    'date_added_asc',
    'date_updated_desc',
    'date_updated_asc',
    'votes_desc',
    'star_points_desc',
    'star_5_desc',
    'star_4_desc',
    'star_3_desc',
    'star_2_desc',
    'star_1_desc',
    'star_5_pct_desc',
    'star_4_pct_desc',
    'star_3_pct_desc',
    'star_2_pct_desc',
    'star_1_pct_desc',
  ] as const

  const SORT_MODE_CONTROL_OPTIONS: SortModeOption[] = [
    { optionValue: 'consensus_quality_desc', title: 'Consensus quality (default)' },
    { optionValue: 'rating_desc', title: 'Rating high to low' },
    { optionValue: 'rating_asc', title: 'Rating low to high' },
    { optionValue: 'hidden_gems_desc', title: 'Hidden gems (high rating, fewer ratings)' },
    { optionValue: 'controversial_desc', title: 'Most controversial' },
    { optionValue: 'quality_floor_asc', title: 'Quality floor (lowest 1★/2★)' },
    { optionValue: 'quick_wins_asc', title: 'Quick wins (few unwatched left)' },
    { optionValue: 'dormant_backlog_asc', title: 'Dormant backlog (oldest activity)' },
    { optionValue: 'rewatch_memory_desc', title: 'May need re-watch to remember' },
    { optionValue: 'recent_activity_desc', title: 'Most recent activity (any type)' },
    { optionValue: 'date_added_desc', title: 'Recently added' },
    { optionValue: 'date_added_asc', title: 'Oldest added' },
    { optionValue: 'date_updated_desc', title: 'Recently updated' },
    { optionValue: 'date_updated_asc', title: 'Oldest updated' },
    { optionValue: 'votes_desc', title: 'Most ratings (count)' },
    { optionValue: 'star_points_desc', title: 'Most total stars' },
    { optionValue: 'star_5_desc', title: 'Most 5-star ratings' },
    { optionValue: 'star_4_desc', title: 'Most 4-star ratings' },
    { optionValue: 'star_3_desc', title: 'Most 3-star ratings' },
    { optionValue: 'star_2_desc', title: 'Most 2-star ratings' },
    { optionValue: 'star_1_desc', title: 'Most 1-star ratings' },
    { optionValue: 'star_5_pct_desc', title: 'Most 5-star ratings (%)' },
    { optionValue: 'star_4_pct_desc', title: 'Most 4-star ratings (%)' },
    { optionValue: 'star_3_pct_desc', title: 'Most 3-star ratings (%)' },
    { optionValue: 'star_2_pct_desc', title: 'Most 2-star ratings (%)' },
    { optionValue: 'star_1_pct_desc', title: 'Most 1-star ratings (%)' },
  ]

  const DEFAULT_SETTINGS = {
    activeTab: 'curated',
    watchReadyFilterMode: 'hide',
    audioLocaleFilter: 'any',
    genreFilter: 'any',
    cardLayout: 'portrait',
    sortMode: DEFAULT_SORT_MODE,
    secondarySortMode: 'none',
  } as const

  const RUNTIME_CONSTANTS: RuntimeConstants = {
    settingsKey: 'cw_settings_v1',
    ratingCacheKey: 'cw_rating_cache_v2',
    watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    watchlistCacheKey: 'cw_watchlist_cache_v1',
    watchHistoryCacheVersion: 3,
    ratingCacheTtlMs: 12 * 60 * 60 * 1000,
    watchHistoryCacheTtlMs: 12 * 60 * 60 * 1000,
    watchlistCacheTtlMs: 24 * 60 * 60 * 1000,
    processDebounceMs: 180,
    watchlistPageSize: 100,
    watchlistMaxPages: 30,
    watchlistRevalidateCooldownMs: 10 * 60 * 1000,
    watchHistoryPageSize: 100,
    watchHistoryMaxPages: 40,
    watchHistoryNoMatchPageLimit: 5,
    ratingBatchSize: 50,
    fetchTimeoutMs: 12000,
    fetchMaxAttempts: 3,
    fetchBackoffBaseMs: 400,
    fetchBackoffJitterMs: 220,
    authClientBasic: 'Basic bm9haWhkZXZtXzZpeWcwYThsMHE6',
    authDeviceKey: 'cw_auth_device_id_v1',
    authTokenSkewMs: 60 * 1000,
    previewHoverDelayMs: 220,
    preferredAudioCacheTtlMs: 2 * 60 * 1000,
    preferredAudioStorageScanLimit: 120,
    preferredAudioValueScanLimit: 1200,
    apiTraceLimitPerEndpoint: 30,
  }

  function cloneSortModeControlOptions(): SortModeOption[] {
    return SORT_MODE_CONTROL_OPTIONS.map((option) => ({
      optionValue: option.optionValue,
      title: option.title,
    }))
  }

  function cloneRuntimeConstants(): RuntimeConstants {
    return { ...RUNTIME_CONSTANTS }
  }

  function createBootstrapConfig(): BootstrapConfig {
    return {
      defaultSortMode: DEFAULT_SORT_MODE,
      validSortModes: new Set(VALID_SORT_MODE_VALUES),
      sortModeControlOptions: cloneSortModeControlOptions(),
      runtimeConstants: cloneRuntimeConstants(),
      defaultSettings: {
        activeTab: DEFAULT_SETTINGS.activeTab,
        watchReadyFilterMode: DEFAULT_SETTINGS.watchReadyFilterMode,
        audioLocaleFilter: DEFAULT_SETTINGS.audioLocaleFilter,
        genreFilter: DEFAULT_SETTINGS.genreFilter,
        cardLayout: DEFAULT_SETTINGS.cardLayout,
        sortMode: DEFAULT_SETTINGS.sortMode,
        secondarySortMode: DEFAULT_SETTINGS.secondarySortMode,
      },
    }
  }

  moduleRegistry.runtimeBootstrapConfig = {
    createBootstrapConfig,
  }
})()
