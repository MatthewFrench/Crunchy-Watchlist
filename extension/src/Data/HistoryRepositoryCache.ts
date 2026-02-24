;(() => {
  type AnyFn = (...args: unknown[]) => unknown
  type LooseRecord = {
    [key: string]: unknown
    panel?: LooseRecord
    episode_metadata?: LooseRecord
    series_metadata?: LooseRecord
  }

  type WatchHistoryEntry = {
    seriesId: string
    datePlayedMs: number
    datePlayed: string
    seasonNumber: number | null
    episodeNumber: number | null
    absoluteEpisodeNumber: number | null
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

  type WatchHistoryState = {
    watchHistoryCache: WatchHistoryCache
  } & LooseRecord

  type HistoryRepositoryCacheContext = {
    state: WatchHistoryState
    normalizeAudioLocale: (value: unknown) => string
    sanitizePositiveInt: (value: unknown) => number | null
    parseDateMs: (value: unknown) => number | null
    pickFirstPositiveInt: (values: Array<number | null | undefined>) => number | null
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: (metadata: LooseRecord, seriesId?: unknown) => string
    createEmptyWatchHistoryCache: () => WatchHistoryCache
    watchHistoryCacheVersion: number
    watchHistoryCacheTtlMs: number
  }

  type HistoryRepositoryCacheOptions = {
    state?: unknown
    normalizeAudioLocale?: unknown
    sanitizePositiveInt?: unknown
    parseDateMs?: unknown
    pickFirstPositiveInt?: unknown
    deriveCanonicalEpisodeKeyFromEpisodeMetadata?: unknown
    createEmptyWatchHistoryCache?: unknown
    watchHistoryCacheVersion?: unknown
    watchHistoryCacheTtlMs?: unknown
  }

  type HistoryRepositoryCache = {
    normalizeStoredWatchHistoryCache: (raw: unknown) => WatchHistoryCache
    normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: unknown) => Record<string, WatchHistoryLocaleMap>
    normalizeWatchHistoryEntry: (value: unknown) => WatchHistoryEntry | null
    isWatchHistoryCacheValid: (cache: unknown, accountId?: unknown) => boolean
    shouldReplaceWatchHistoryProgress: (
      previous: LooseRecord | null | undefined,
      next: LooseRecord | null | undefined,
    ) => boolean
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

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing history cache dependency: ${name}`)
    }
    return value as T
  }

  function toWatchHistoryState(value: unknown): WatchHistoryState | null {
    if (!value || typeof value !== 'object') {
      return null
    }
    return value as WatchHistoryState
  }

  function createHistoryRepositoryCacheContext(
    options: HistoryRepositoryCacheOptions = {},
  ): HistoryRepositoryCacheContext {
    const state = toWatchHistoryState(options.state)
    if (!state) {
      throw new Error('[CW] Missing history repository state')
    }

    return {
      state,
      normalizeAudioLocale: requireFunction(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ) as HistoryRepositoryCacheContext['normalizeAudioLocale'],
      sanitizePositiveInt: requireFunction(
        'sanitizePositiveInt',
        options.sanitizePositiveInt,
      ) as HistoryRepositoryCacheContext['sanitizePositiveInt'],
      parseDateMs: requireFunction('parseDateMs', options.parseDateMs) as HistoryRepositoryCacheContext['parseDateMs'],
      pickFirstPositiveInt: requireFunction(
        'pickFirstPositiveInt',
        options.pickFirstPositiveInt,
      ) as HistoryRepositoryCacheContext['pickFirstPositiveInt'],
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: requireFunction(
        'deriveCanonicalEpisodeKeyFromEpisodeMetadata',
        options.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      ) as HistoryRepositoryCacheContext['deriveCanonicalEpisodeKeyFromEpisodeMetadata'],
      createEmptyWatchHistoryCache: requireFunction(
        'createEmptyWatchHistoryCache',
        options.createEmptyWatchHistoryCache,
      ) as HistoryRepositoryCacheContext['createEmptyWatchHistoryCache'],
      watchHistoryCacheVersion: Number(options.watchHistoryCacheVersion) || 0,
      watchHistoryCacheTtlMs: Math.max(1, Number(options.watchHistoryCacheTtlMs) || 1),
    }
  }

  function isWatchHistoryCacheValidInternal(
    context: HistoryRepositoryCacheContext,
    cache: unknown = context.state.watchHistoryCache,
    accountId?: unknown,
  ): boolean {
    if (!cache || typeof cache !== 'object') {
      return false
    }

    const cacheRecord = cache as LooseRecord

    if (Number(cacheRecord.version) !== context.watchHistoryCacheVersion) {
      return false
    }

    if (
      !cacheRecord.bySeriesId ||
      typeof cacheRecord.bySeriesId !== 'object' ||
      Array.isArray(cacheRecord.bySeriesId)
    ) {
      return false
    }

    if (typeof cacheRecord.updatedAt !== 'number') {
      return false
    }

    if (typeof accountId === 'string' && accountId && cacheRecord.accountId !== accountId) {
      return false
    }

    return Date.now() - cacheRecord.updatedAt < context.watchHistoryCacheTtlMs
  }

  function getWatchHistoryProgressIndexInternal(
    context: HistoryRepositoryCacheContext,
    value: LooseRecord | null | undefined,
  ): number | null {
    const absoluteEpisodeNumber = context.pickFirstPositiveInt([
      context.sanitizePositiveInt(value?.absoluteEpisodeNumber),
      context.sanitizePositiveInt(value?.sequenceNumber),
      context.sanitizePositiveInt(value?.sequence_number),
    ])
    if (absoluteEpisodeNumber != null) {
      return absoluteEpisodeNumber
    }

    const seasonNumber = context.sanitizePositiveInt(value?.seasonNumber)
    const episodeNumber = context.sanitizePositiveInt(value?.episodeNumber)
    if (seasonNumber != null && episodeNumber != null) {
      return seasonNumber * 100000 + episodeNumber
    }

    return null
  }

  function shouldReplaceWatchHistoryProgressInternal(
    context: HistoryRepositoryCacheContext,
    previous: LooseRecord | null | undefined,
    next: LooseRecord | null | undefined,
  ): boolean {
    if (!previous) {
      return true
    }

    const previousAudioInferred = Boolean(previous?.audioLocaleInferred)
    const nextAudioInferred = Boolean(next?.audioLocaleInferred)
    const previousDateMs = context.parseDateMs(previous?.datePlayedMs ?? previous?.datePlayed) ?? 0
    const nextDateMs = context.parseDateMs(next?.datePlayedMs ?? next?.datePlayed) ?? 0

    if (previousAudioInferred !== nextAudioInferred) {
      return !nextAudioInferred
    }

    if (previousAudioInferred && nextAudioInferred) {
      if (nextDateMs !== previousDateMs) {
        return nextDateMs > previousDateMs
      }
    }

    const previousIndex = getWatchHistoryProgressIndexInternal(context, previous)
    const nextIndex = getWatchHistoryProgressIndexInternal(context, next)

    if (nextIndex != null && previousIndex != null && nextIndex !== previousIndex) {
      return nextIndex > previousIndex
    }

    if (nextIndex != null && previousIndex == null) {
      return true
    }

    if (nextIndex == null && previousIndex != null) {
      return false
    }

    const previousCompleted = Boolean(previous?.fullyWatched)
    const nextCompleted = Boolean(next?.fullyWatched)
    if (nextCompleted !== previousCompleted) {
      return nextCompleted
    }

    return nextDateMs > previousDateMs
  }

  function normalizeWatchHistoryEntryInternal(
    context: HistoryRepositoryCacheContext,
    value: LooseRecord | null | undefined,
  ): WatchHistoryEntry | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const datePlayedMs = context.parseDateMs(value.datePlayedMs ?? value.datePlayed)
    if (datePlayedMs == null) {
      return null
    }

    const seasonNumber = context.sanitizePositiveInt(
      value.seasonNumber ?? value?.panel?.episode_metadata?.season_number,
    )
    const episodeNumber = context.sanitizePositiveInt(
      value.episodeNumber ?? value?.panel?.episode_metadata?.episode_number,
    )
    const absoluteEpisodeNumber = context.pickFirstPositiveInt([
      context.sanitizePositiveInt(value.absoluteEpisodeNumber),
      context.sanitizePositiveInt(value.sequenceNumber),
      context.sanitizePositiveInt(value.sequence_number),
      context.sanitizePositiveInt(value?.panel?.episode_metadata?.sequence_number),
      context.sanitizePositiveInt(value?.panel?.episode_metadata?.episode_sequence_number),
      context.sanitizePositiveInt(value?.panel?.episode_metadata?.global_episode_number),
      context.sanitizePositiveInt(value?.panel?.episode_metadata?.global_episode_num),
      seasonNumber === 1 ? episodeNumber : null,
    ])
    const audioLocale = context.normalizeAudioLocale(
      value.audioLocale ??
        value.audio_locale ??
        value?.panel?.episode_metadata?.audio_locale ??
        value?.panel?.audio_locale,
    )
    const seriesId =
      typeof value?.seriesId === 'string'
        ? value.seriesId
        : typeof value?.panel?.episode_metadata?.series_id === 'string'
          ? value.panel.episode_metadata.series_id
          : ''
    const episodeId =
      typeof value?.episodeId === 'string'
        ? value.episodeId
        : typeof value?.id === 'string'
          ? value.id
          : typeof value?.panel?.id === 'string'
            ? value.panel.id
            : null
    const identifier =
      typeof value?.identifier === 'string'
        ? value.identifier
        : typeof value?.panel?.episode_metadata?.identifier === 'string'
          ? value.panel.episode_metadata.identifier
          : ''
    const canonicalEpisodeKey =
      typeof value?.canonicalEpisodeKey === 'string' && value.canonicalEpisodeKey
        ? value.canonicalEpisodeKey
        : context.deriveCanonicalEpisodeKeyFromEpisodeMetadata(value?.panel?.episode_metadata || {}, seriesId)

    return {
      seriesId,
      datePlayedMs,
      datePlayed: new Date(datePlayedMs).toISOString(),
      seasonNumber,
      episodeNumber,
      absoluteEpisodeNumber,
      episodeId,
      identifier,
      canonicalEpisodeKey,
      episodeTitle:
        typeof value.episodeTitle === 'string'
          ? value.episodeTitle
          : typeof value?.panel?.title === 'string'
            ? value.panel.title
            : '',
      playhead: Number(value.playhead || 0),
      fullyWatched: Boolean(value.fullyWatched ?? value.fully_watched),
      audioLocale,
      audioLocaleInferred: Boolean(value?.audioLocaleInferred),
    }
  }

  function normalizeStoredWatchHistoryBySeriesAudioLocaleInternal(
    context: HistoryRepositoryCacheContext,
    raw: unknown,
  ): Record<string, WatchHistoryLocaleMap> {
    if (!raw || typeof raw !== 'object') {
      return {}
    }

    const normalizedBySeries: Record<string, WatchHistoryLocaleMap> = {}

    Object.entries(raw as LooseRecord).forEach(([seriesId, localeMapValue]) => {
      if (!seriesId || !localeMapValue || typeof localeMapValue !== 'object' || Array.isArray(localeMapValue)) {
        return
      }

      const normalizedLocaleMap: WatchHistoryLocaleMap = {}

      Object.entries(localeMapValue as LooseRecord).forEach(([localeKey, entryValue]) => {
        const normalizedEntry = normalizeWatchHistoryEntryInternal(context, entryValue as LooseRecord)
        if (!normalizedEntry) {
          return
        }

        const locale = context.normalizeAudioLocale(normalizedEntry.audioLocale || localeKey)
        if (!locale) {
          return
        }

        const localeStorageKey = locale.toLowerCase()
        const previousEntry = normalizedLocaleMap[localeStorageKey]
        if (!previousEntry || normalizedEntry.datePlayedMs > previousEntry.datePlayedMs) {
          normalizedLocaleMap[localeStorageKey] = {
            ...normalizedEntry,
            audioLocale: locale,
          }
        }
      })

      if (Object.keys(normalizedLocaleMap).length) {
        normalizedBySeries[seriesId] = normalizedLocaleMap
      }
    })

    return normalizedBySeries
  }

  function normalizeStoredWatchHistoryCacheInternal(
    context: HistoryRepositoryCacheContext,
    raw: unknown,
  ): WatchHistoryCache {
    if (!raw || typeof raw !== 'object') {
      return context.createEmptyWatchHistoryCache()
    }

    const rawRecord = raw as LooseRecord
    const bySeriesIdRaw =
      rawRecord.bySeriesId && typeof rawRecord.bySeriesId === 'object' ? (rawRecord.bySeriesId as LooseRecord) : {}
    const bySeriesId: Record<string, WatchHistoryEntry> = {}

    Object.entries(bySeriesIdRaw).forEach(([seriesId, value]) => {
      if (!seriesId) {
        return
      }
      const normalized = normalizeWatchHistoryEntryInternal(context, value as LooseRecord)
      if (normalized) {
        bySeriesId[seriesId] = normalized
      }
    })

    const bySeriesIdAudioLocale = normalizeStoredWatchHistoryBySeriesAudioLocaleInternal(
      context,
      rawRecord.bySeriesIdAudioLocale,
    )
    const bySeriesIdProgressRaw =
      rawRecord.bySeriesIdProgress && typeof rawRecord.bySeriesIdProgress === 'object'
        ? (rawRecord.bySeriesIdProgress as LooseRecord)
        : {}
    const bySeriesIdProgress: Record<string, WatchHistoryEntry> = {}

    Object.entries(bySeriesIdProgressRaw).forEach(([seriesId, value]) => {
      if (!seriesId) {
        return
      }
      const normalized = normalizeWatchHistoryEntryInternal(context, value as LooseRecord)
      if (normalized) {
        bySeriesIdProgress[seriesId] = normalized
      }
    })

    const bySeriesIdAudioLocaleProgress = normalizeStoredWatchHistoryBySeriesAudioLocaleInternal(
      context,
      rawRecord.bySeriesIdAudioLocaleProgress,
    )

    return {
      version: Number(rawRecord.version) || 0,
      accountId: typeof rawRecord.accountId === 'string' ? rawRecord.accountId : '',
      updatedAt: typeof rawRecord.updatedAt === 'number' ? rawRecord.updatedAt : 0,
      bySeriesId,
      bySeriesIdAudioLocale,
      bySeriesIdProgress,
      bySeriesIdAudioLocaleProgress,
    }
  }

  function getCachedWatchHistoryFromBucketsInternal(
    context: HistoryRepositoryCacheContext,
    seriesBucket: Record<string, WatchHistoryEntry>,
    seriesByLocaleBucket: Record<string, WatchHistoryLocaleMap> | null | undefined,
    seriesId: unknown,
    audioLocale: unknown = null,
    allowSeriesFallback = true,
  ): WatchHistoryEntry | null {
    if (typeof seriesId !== 'string' || !seriesId || !seriesBucket || typeof seriesBucket !== 'object') {
      return null
    }

    const normalizedAudioLocale = context.normalizeAudioLocale(audioLocale)
    if (normalizedAudioLocale) {
      const perSeriesLocaleMap =
        seriesByLocaleBucket &&
        typeof seriesByLocaleBucket === 'object' &&
        !Array.isArray(seriesByLocaleBucket[seriesId]) &&
        typeof seriesByLocaleBucket[seriesId] === 'object'
          ? seriesByLocaleBucket[seriesId]
          : null

      if (perSeriesLocaleMap) {
        const matchedByLocale = normalizeWatchHistoryEntryInternal(
          context,
          perSeriesLocaleMap[normalizedAudioLocale.toLowerCase()],
        )
        if (matchedByLocale) {
          return {
            ...matchedByLocale,
            audioLocale: context.normalizeAudioLocale(matchedByLocale.audioLocale) || normalizedAudioLocale,
          }
        }
      }
    }

    if (!allowSeriesFallback) {
      return null
    }

    return normalizeWatchHistoryEntryInternal(context, seriesBucket[seriesId])
  }

  function getCachedWatchHistoryInternal(
    context: HistoryRepositoryCacheContext,
    seriesId: unknown,
    audioLocale: unknown = null,
    allowSeriesFallback = true,
  ): WatchHistoryEntry | null {
    if (
      typeof seriesId !== 'string' ||
      !seriesId ||
      !context.state.watchHistoryCache ||
      typeof context.state.watchHistoryCache !== 'object'
    ) {
      return null
    }

    const bySeriesId = context.state.watchHistoryCache.bySeriesId
    const bySeriesIdAudioLocale = context.state.watchHistoryCache.bySeriesIdAudioLocale
    if (!bySeriesId || typeof bySeriesId !== 'object') {
      return null
    }

    return getCachedWatchHistoryFromBucketsInternal(
      context,
      bySeriesId,
      bySeriesIdAudioLocale,
      seriesId,
      audioLocale,
      allowSeriesFallback,
    )
  }

  function getCachedWatchHistoryProgressInternal(
    context: HistoryRepositoryCacheContext,
    seriesId: unknown,
    audioLocale: unknown = null,
    allowSeriesFallback = true,
  ): WatchHistoryEntry | null {
    if (
      typeof seriesId !== 'string' ||
      !seriesId ||
      !context.state.watchHistoryCache ||
      typeof context.state.watchHistoryCache !== 'object'
    ) {
      return null
    }

    const bySeriesIdProgress = context.state.watchHistoryCache.bySeriesIdProgress
    const bySeriesIdAudioLocaleProgress = context.state.watchHistoryCache.bySeriesIdAudioLocaleProgress
    if (!bySeriesIdProgress || typeof bySeriesIdProgress !== 'object') {
      return null
    }

    return getCachedWatchHistoryFromBucketsInternal(
      context,
      bySeriesIdProgress,
      bySeriesIdAudioLocaleProgress,
      seriesId,
      audioLocale,
      allowSeriesFallback,
    )
  }

  function createHistoryRepositoryCache(options: HistoryRepositoryCacheOptions = {}): HistoryRepositoryCache {
    const context = createHistoryRepositoryCacheContext(options)

    return {
      normalizeStoredWatchHistoryCache: (raw: unknown) => normalizeStoredWatchHistoryCacheInternal(context, raw),
      normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: unknown) =>
        normalizeStoredWatchHistoryBySeriesAudioLocaleInternal(context, raw),
      normalizeWatchHistoryEntry: (value: unknown) => normalizeWatchHistoryEntryInternal(context, value as LooseRecord),
      isWatchHistoryCacheValid: (cache: unknown, accountId?: unknown) =>
        isWatchHistoryCacheValidInternal(context, cache, accountId),
      shouldReplaceWatchHistoryProgress: (
        previous: LooseRecord | null | undefined,
        next: LooseRecord | null | undefined,
      ) => shouldReplaceWatchHistoryProgressInternal(context, previous, next),
      getCachedWatchHistory: (seriesId: unknown, audioLocale?: unknown, allowSeriesFallback = true) =>
        getCachedWatchHistoryInternal(context, seriesId, audioLocale, allowSeriesFallback),
      getCachedWatchHistoryProgress: (seriesId: unknown, audioLocale?: unknown, allowSeriesFallback = true) =>
        getCachedWatchHistoryProgressInternal(context, seriesId, audioLocale, allowSeriesFallback),
    }
  }

  moduleRegistry.historyRepositoryCache = {
    createHistoryRepositoryCache,
  }
})()
