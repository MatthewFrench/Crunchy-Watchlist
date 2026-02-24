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
    watchHistoryStatus: string
    watchHistoryInflight: Promise<unknown> | null
  } & LooseRecord

  type TokenEntry = {
    accessToken?: unknown
    accountId?: unknown
  } & LooseRecord

  type HistoryPreloadEntry = {
    seriesId?: unknown
    neverWatched?: unknown
    playheadMs?: unknown
  } & LooseRecord

  type HistoryUpdateBuckets = {
    remainingSeriesIds: Set<string>
    seriesUpdates: Record<string, WatchHistoryEntry>
    seriesProgressUpdates: Record<string, WatchHistoryEntry>
    localeUpdates: Record<string, WatchHistoryLocaleMap>
    localeProgressUpdates: Record<string, WatchHistoryLocaleMap>
    pages: number
    totalRows: number | null
    fetchedRows: number
    noMatchPageStreak: number
    seenRowKeys: Set<string>
  }

  type HistoryRepositoryPreloadContext = {
    state: WatchHistoryState
    normalizeAudioLocale: (value: unknown) => string
    sanitizePositiveInt: (value: unknown) => number | null
    parseDateMs: (value: unknown) => number | null
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: (metadata: LooseRecord, seriesId?: unknown) => string
    getAbsoluteEpisodeNumberFromEpisodeMetadata: (metadata: LooseRecord) => number | null
    getPreferredAudioLanguage: () => string
    getLocale: () => string
    resolveApiHref: (value: string) => string
    fetchWithResilience: (url: string, init: RequestInit, options: LooseRecord) => Promise<Response>
    createAuthRefreshHandler: (tokenEntry: TokenEntry) => unknown
    requirePayloadDataArray: (name: string, payload: unknown) => LooseRecord[]
    auditWatchHistoryRowsContract: (rows: LooseRecord[]) => void
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
    scheduleSaveWatchHistory: () => void
    pushApiTrace: (bucket: string, payload: unknown) => void
    runtimeEvent: (event: string, payload?: unknown) => void
    watchHistoryCacheVersion: number
    watchHistoryPageSize: number
    watchHistoryMaxPages: number
    watchHistoryNoMatchPageLimit: number
  }

  type HistoryRepositoryPreloadOptions = {
    state?: unknown
    normalizeAudioLocale?: unknown
    sanitizePositiveInt?: unknown
    parseDateMs?: unknown
    deriveCanonicalEpisodeKeyFromEpisodeMetadata?: unknown
    getAbsoluteEpisodeNumberFromEpisodeMetadata?: unknown
    getPreferredAudioLanguage?: unknown
    getLocale?: unknown
    resolveApiHref?: unknown
    fetchWithResilience?: unknown
    createAuthRefreshHandler?: unknown
    requirePayloadDataArray?: unknown
    auditWatchHistoryRowsContract?: unknown
    normalizeStoredWatchHistoryCache?: unknown
    normalizeStoredWatchHistoryBySeriesAudioLocale?: unknown
    normalizeWatchHistoryEntry?: unknown
    isWatchHistoryCacheValid?: unknown
    shouldReplaceWatchHistoryProgress?: unknown
    getCachedWatchHistory?: unknown
    scheduleSaveWatchHistory?: unknown
    pushApiTrace?: unknown
    runtimeEvent?: unknown
    watchHistoryCacheVersion?: unknown
    watchHistoryPageSize?: unknown
    watchHistoryMaxPages?: unknown
    watchHistoryNoMatchPageLimit?: unknown
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

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing history preload dependency: ${name}`)
    }
    return value as T
  }

  function toWatchHistoryState(value: unknown): WatchHistoryState | null {
    return value && typeof value === 'object' ? (value as WatchHistoryState) : null
  }

  function toTokenEntry(value: unknown): TokenEntry {
    return value && typeof value === 'object' ? (value as TokenEntry) : {}
  }

  function toHistoryPreloadEntries(value: unknown): HistoryPreloadEntry[] {
    return Array.isArray(value)
      ? value.filter((entry): entry is HistoryPreloadEntry => !!entry && typeof entry === 'object')
      : []
  }

  function requireContextFunction<K extends keyof HistoryRepositoryPreloadContext>(
    options: HistoryRepositoryPreloadOptions,
    name: K,
  ): HistoryRepositoryPreloadContext[K] {
    return requireFunction(String(name), options[name]) as HistoryRepositoryPreloadContext[K]
  }

  function resolveRequiredHistoryRepositoryPreloadDependencies(
    options: HistoryRepositoryPreloadOptions,
  ): Omit<
    HistoryRepositoryPreloadContext,
    | 'state'
    | 'pushApiTrace'
    | 'runtimeEvent'
    | 'watchHistoryCacheVersion'
    | 'watchHistoryPageSize'
    | 'watchHistoryMaxPages'
    | 'watchHistoryNoMatchPageLimit'
  > {
    return {
      normalizeAudioLocale: requireContextFunction(options, 'normalizeAudioLocale'),
      sanitizePositiveInt: requireContextFunction(options, 'sanitizePositiveInt'),
      parseDateMs: requireContextFunction(options, 'parseDateMs'),
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: requireContextFunction(
        options,
        'deriveCanonicalEpisodeKeyFromEpisodeMetadata',
      ),
      getAbsoluteEpisodeNumberFromEpisodeMetadata: requireContextFunction(
        options,
        'getAbsoluteEpisodeNumberFromEpisodeMetadata',
      ),
      getPreferredAudioLanguage: requireContextFunction(options, 'getPreferredAudioLanguage'),
      getLocale: requireContextFunction(options, 'getLocale'),
      resolveApiHref: requireContextFunction(options, 'resolveApiHref'),
      fetchWithResilience: requireContextFunction(options, 'fetchWithResilience'),
      createAuthRefreshHandler: requireContextFunction(options, 'createAuthRefreshHandler'),
      requirePayloadDataArray: requireContextFunction(options, 'requirePayloadDataArray'),
      auditWatchHistoryRowsContract: requireContextFunction(options, 'auditWatchHistoryRowsContract'),
      normalizeStoredWatchHistoryCache: requireContextFunction(options, 'normalizeStoredWatchHistoryCache'),
      normalizeStoredWatchHistoryBySeriesAudioLocale: requireContextFunction(
        options,
        'normalizeStoredWatchHistoryBySeriesAudioLocale',
      ),
      normalizeWatchHistoryEntry: requireContextFunction(options, 'normalizeWatchHistoryEntry'),
      isWatchHistoryCacheValid: requireContextFunction(options, 'isWatchHistoryCacheValid'),
      shouldReplaceWatchHistoryProgress: requireContextFunction(options, 'shouldReplaceWatchHistoryProgress'),
      getCachedWatchHistory: requireContextFunction(options, 'getCachedWatchHistory'),
      scheduleSaveWatchHistory: requireContextFunction(options, 'scheduleSaveWatchHistory'),
    }
  }

  function resolveOptionalHistoryRepositoryPreloadDependencies(
    options: HistoryRepositoryPreloadOptions,
  ): Pick<HistoryRepositoryPreloadContext, 'pushApiTrace' | 'runtimeEvent'> {
    return {
      pushApiTrace:
        typeof options.pushApiTrace === 'function'
          ? (options.pushApiTrace as HistoryRepositoryPreloadContext['pushApiTrace'])
          : () => {},
      runtimeEvent:
        typeof options.runtimeEvent === 'function'
          ? (options.runtimeEvent as HistoryRepositoryPreloadContext['runtimeEvent'])
          : () => {},
    }
  }

  function resolveHistoryRepositoryPreloadNumericOptions(
    options: HistoryRepositoryPreloadOptions,
  ): Pick<
    HistoryRepositoryPreloadContext,
    'watchHistoryCacheVersion' | 'watchHistoryPageSize' | 'watchHistoryMaxPages' | 'watchHistoryNoMatchPageLimit'
  > {
    return {
      watchHistoryCacheVersion: Number(options.watchHistoryCacheVersion) || 0,
      watchHistoryPageSize: Math.max(1, Number(options.watchHistoryPageSize) || 1),
      watchHistoryMaxPages: Math.max(1, Number(options.watchHistoryMaxPages) || 1),
      watchHistoryNoMatchPageLimit: Math.max(1, Number(options.watchHistoryNoMatchPageLimit) || 1),
    }
  }

  function createHistoryRepositoryPreloadContext(
    options: HistoryRepositoryPreloadOptions = {},
  ): HistoryRepositoryPreloadContext {
    const state = toWatchHistoryState(options.state)
    if (!state) {
      throw new Error('[CW] Missing history repository state')
    }

    return {
      state,
      ...resolveRequiredHistoryRepositoryPreloadDependencies(options),
      ...resolveOptionalHistoryRepositoryPreloadDependencies(options),
      ...resolveHistoryRepositoryPreloadNumericOptions(options),
    }
  }

  async function fetchWatchHistoryPageInternal(
    context: HistoryRepositoryPreloadContext,
    tokenEntry: TokenEntry,
    pageNumber: number,
    preferredAudioLanguage: unknown = context.getPreferredAudioLanguage(),
  ): Promise<{ rows: LooseRecord[]; total: number }> {
    const accountId = typeof tokenEntry?.accountId === 'string' ? tokenEntry.accountId : ''
    const effectivePreferredAudioLanguage =
      context.normalizeAudioLocale(preferredAudioLanguage) || context.getPreferredAudioLanguage()
    const params = new root.URLSearchParams({
      page_size: String(context.watchHistoryPageSize),
      preferred_audio_language: effectivePreferredAudioLanguage,
      locale: context.getLocale(),
    })

    if (pageNumber > 1) {
      params.set('page', String(pageNumber))
    }

    const url = context.resolveApiHref(
      `/content/v2/${encodeURIComponent(accountId)}/watch-history?${params.toString()}`,
    )
    const response = await context.fetchWithResilience(
      url,
      {
        credentials: 'include',
      },
      {
        label: 'watch history page request',
        bearerToken: tokenEntry?.accessToken,
        refreshBearerToken: context.createAuthRefreshHandler(tokenEntry),
      },
    )

    if (!response.ok) {
      throw new Error(`watch history page request failed: ${response.status}`)
    }

    const payload = (await response.json()) as LooseRecord
    const rows = context.requirePayloadDataArray('watch-history', payload)
    context.auditWatchHistoryRowsContract(rows)
    const total = Number(payload?.total || rows.length)

    context.pushApiTrace('watchHistory', {
      at: Date.now(),
      request: {
        url,
        page: Math.max(1, Number(pageNumber) || 1),
        page_size: context.watchHistoryPageSize,
        preferred_audio_language: params.get('preferred_audio_language'),
        locale: params.get('locale'),
      },
      response: {
        total,
        rowCount: rows.length,
      },
      data: rows,
    })

    return {
      rows,
      total,
    }
  }

  function parseWatchHistoryRowInternal(
    context: HistoryRepositoryPreloadContext,
    entry: LooseRecord | null | undefined,
    fallbackAudioLocale: unknown = null,
  ): WatchHistoryEntry | null {
    const resolvedSeriesId = entry?.panel?.episode_metadata?.series_id || entry?.panel?.series_metadata?.series_id
    if (typeof resolvedSeriesId !== 'string' || !resolvedSeriesId) {
      return null
    }
    const seriesId = resolvedSeriesId

    const datePlayedMs = context.parseDateMs(entry?.date_played)
    if (datePlayedMs == null) {
      return null
    }

    const meta = entry?.panel?.episode_metadata || {}
    const seasonNumber = context.sanitizePositiveInt(meta?.season_number)
    const episodeNumber = context.sanitizePositiveInt(meta?.episode_number)
    const absoluteEpisodeNumber = context.getAbsoluteEpisodeNumberFromEpisodeMetadata(meta)
    const explicitAudioLocale = context.normalizeAudioLocale(
      meta?.audio_locale || entry?.panel?.audio_locale || entry?.audio_locale || entry?.audioLocale,
    )
    const audioLocale = explicitAudioLocale || context.normalizeAudioLocale(fallbackAudioLocale)
    const identifier = typeof meta?.identifier === 'string' ? meta.identifier : ''
    const canonicalEpisodeKey = context.deriveCanonicalEpisodeKeyFromEpisodeMetadata(meta, seriesId)
    const episodeId =
      typeof entry?.id === 'string' ? entry.id : typeof entry?.panel?.id === 'string' ? entry.panel.id : null

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
      episodeTitle: typeof entry?.panel?.title === 'string' ? entry.panel.title : '',
      playhead: Number(entry?.playhead || 0),
      fullyWatched: Boolean(entry?.fully_watched),
      audioLocale,
      audioLocaleInferred: !explicitAudioLocale && Boolean(audioLocale),
    }
  }

  function resolveWatchHistoryPreloadContextInternal(
    context: HistoryRepositoryPreloadContext,
    entries: HistoryPreloadEntry[],
    preferredAudioLanguage: unknown = context.getPreferredAudioLanguage(),
  ): {
    effectivePreferredAudioLanguage: string
    isDefaultPreferredAudio: boolean
    candidateSeriesIds: string[]
  } {
    const defaultPreferredAudioLanguage = context.getPreferredAudioLanguage()
    const effectivePreferredAudioLanguage =
      context.normalizeAudioLocale(preferredAudioLanguage) || defaultPreferredAudioLanguage
    const isDefaultPreferredAudio =
      effectivePreferredAudioLanguage.toLowerCase() === defaultPreferredAudioLanguage.toLowerCase()
    const candidateSeriesIds = Array.from(
      new Set(
        entries
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

  function createWatchHistoryUpdateBucketsInternal(candidateSeriesIds: string[]): HistoryUpdateBuckets {
    return {
      remainingSeriesIds: new Set<string>(candidateSeriesIds),
      seriesUpdates: {},
      seriesProgressUpdates: {},
      localeUpdates: {},
      localeProgressUpdates: {},
      pages: 0,
      totalRows: null,
      fetchedRows: 0,
      noMatchPageStreak: 0,
      seenRowKeys: new Set<string>(),
    }
  }

  function mergeWatchHistoryParsedEntryInternal(
    context: HistoryRepositoryPreloadContext,
    parsed: WatchHistoryEntry,
    buckets: HistoryUpdateBuckets,
    isDefaultPreferredAudio: boolean,
  ): boolean {
    let matchedCandidate = false

    if (isDefaultPreferredAudio) {
      const previous = buckets.seriesUpdates[parsed.seriesId]
      if (!previous || parsed.datePlayedMs > previous.datePlayedMs) {
        buckets.seriesUpdates[parsed.seriesId] = parsed
      }

      const previousProgress = buckets.seriesProgressUpdates[parsed.seriesId]
      if (context.shouldReplaceWatchHistoryProgress(previousProgress, parsed)) {
        buckets.seriesProgressUpdates[parsed.seriesId] = parsed
      }
    }

    const locale = context.normalizeAudioLocale(parsed.audioLocale)
    if (locale) {
      const localeStorageKey = locale.toLowerCase()
      const perSeriesLocaleMap: WatchHistoryLocaleMap = buckets.localeUpdates[parsed.seriesId] || {}
      const previousByLocale = perSeriesLocaleMap[localeStorageKey]
      if (!previousByLocale || parsed.datePlayedMs > previousByLocale.datePlayedMs) {
        perSeriesLocaleMap[localeStorageKey] = {
          ...parsed,
          audioLocale: locale,
        }
      }
      buckets.localeUpdates[parsed.seriesId] = perSeriesLocaleMap

      const perSeriesLocaleProgressMap: WatchHistoryLocaleMap = buckets.localeProgressUpdates[parsed.seriesId] || {}
      const previousProgressByLocale = perSeriesLocaleProgressMap[localeStorageKey]
      if (context.shouldReplaceWatchHistoryProgress(previousProgressByLocale, parsed)) {
        perSeriesLocaleProgressMap[localeStorageKey] = {
          ...parsed,
          audioLocale: locale,
        }
      }
      buckets.localeProgressUpdates[parsed.seriesId] = perSeriesLocaleProgressMap
    }

    if (buckets.remainingSeriesIds.has(parsed.seriesId)) {
      buckets.remainingSeriesIds.delete(parsed.seriesId)
      matchedCandidate = true
    }

    return matchedCandidate
  }

  async function collectWatchHistoryUpdateBucketsInternal(
    context: HistoryRepositoryPreloadContext,
    tokenEntry: TokenEntry,
    effectivePreferredAudioLanguage: string,
    candidateSeriesIds: string[],
    isDefaultPreferredAudio: boolean,
  ): Promise<HistoryUpdateBuckets> {
    const buckets = createWatchHistoryUpdateBucketsInternal(candidateSeriesIds)

    while (buckets.pages < context.watchHistoryMaxPages) {
      buckets.pages += 1
      const page = await fetchWatchHistoryPageInternal(
        context,
        tokenEntry,
        buckets.pages,
        effectivePreferredAudioLanguage,
      )
      let matchedOnPage = 0

      if (buckets.totalRows == null) {
        buckets.totalRows = page.total
      }

      buckets.fetchedRows += page.rows.length

      page.rows.forEach((row: LooseRecord) => {
        const parsed = parseWatchHistoryRowInternal(context, row, effectivePreferredAudioLanguage)
        if (!parsed || !parsed.seriesId || parsed.datePlayedMs == null) {
          return
        }

        const rowKey =
          parsed.canonicalEpisodeKey ||
          parsed.episodeId ||
          `${parsed.seriesId}|${parsed.absoluteEpisodeNumber || ''}|${parsed.datePlayedMs}`
        if (buckets.seenRowKeys.has(rowKey)) {
          return
        }
        buckets.seenRowKeys.add(rowKey)

        if (mergeWatchHistoryParsedEntryInternal(context, parsed, buckets, isDefaultPreferredAudio)) {
          matchedOnPage += 1
        }
      })

      if (matchedOnPage === 0 && buckets.remainingSeriesIds.size > 0) {
        buckets.noMatchPageStreak += 1
      } else {
        buckets.noMatchPageStreak = 0
      }

      if (!page.rows.length || page.rows.length < context.watchHistoryPageSize) {
        break
      }

      if (buckets.totalRows != null && buckets.fetchedRows >= buckets.totalRows) {
        break
      }

      if (!buckets.remainingSeriesIds.size) {
        break
      }

      if (buckets.remainingSeriesIds.size && buckets.noMatchPageStreak >= context.watchHistoryNoMatchPageLimit) {
        break
      }
    }

    return buckets
  }

  function mergeWatchHistoryCacheWithBucketsInternal(
    context: HistoryRepositoryPreloadContext,
    latestCache: WatchHistoryCache,
    buckets: HistoryUpdateBuckets,
    isDefaultPreferredAudio: boolean,
  ): {
    bySeriesId: Record<string, WatchHistoryEntry>
    bySeriesIdAudioLocale: Record<string, WatchHistoryLocaleMap>
    bySeriesIdProgress: Record<string, WatchHistoryEntry>
    bySeriesIdAudioLocaleProgress: Record<string, WatchHistoryLocaleMap>
    mappedSeries: number
    mappedSeriesByAudioLocale: number
    mappedProgressSeries: number
    mappedProgressSeriesByAudioLocale: number
  } {
    const nextBySeriesId = isDefaultPreferredAudio ? { ...latestCache.bySeriesId } : latestCache.bySeriesId
    const nextBySeriesIdProgress = isDefaultPreferredAudio
      ? { ...latestCache.bySeriesIdProgress }
      : latestCache.bySeriesIdProgress
    const nextBySeriesIdAudioLocale = context.normalizeStoredWatchHistoryBySeriesAudioLocale(
      latestCache.bySeriesIdAudioLocale,
    )
    const nextBySeriesIdAudioLocaleProgress = context.normalizeStoredWatchHistoryBySeriesAudioLocale(
      latestCache.bySeriesIdAudioLocaleProgress,
    )

    if (isDefaultPreferredAudio) {
      Object.entries(buckets.seriesUpdates).forEach(([seriesId, updateEntry]) => {
        const previous = context.normalizeWatchHistoryEntry(nextBySeriesId[seriesId])
        if (!previous || updateEntry.datePlayedMs > previous.datePlayedMs) {
          nextBySeriesId[seriesId] = updateEntry
        }
      })

      Object.entries(buckets.seriesProgressUpdates).forEach(([seriesId, updateEntry]) => {
        const previous = context.normalizeWatchHistoryEntry(nextBySeriesIdProgress[seriesId])
        if (context.shouldReplaceWatchHistoryProgress(previous, updateEntry)) {
          nextBySeriesIdProgress[seriesId] = updateEntry
        }
      })
    }

    Object.entries(buckets.localeUpdates).forEach(([seriesId, localeMapUpdates]) => {
      const nextLocaleMap: WatchHistoryLocaleMap = { ...(nextBySeriesIdAudioLocale[seriesId] || {}) }

      Object.entries(localeMapUpdates).forEach(([localeStorageKey, updateEntry]) => {
        const previous = context.normalizeWatchHistoryEntry(nextLocaleMap[localeStorageKey])
        if (!previous || updateEntry.datePlayedMs > previous.datePlayedMs) {
          nextLocaleMap[localeStorageKey] = updateEntry
        }
      })

      if (Object.keys(nextLocaleMap).length) {
        nextBySeriesIdAudioLocale[seriesId] = nextLocaleMap
      }
    })

    Object.entries(buckets.localeProgressUpdates).forEach(([seriesId, localeMapUpdates]) => {
      const nextLocaleProgressMap: WatchHistoryLocaleMap = { ...(nextBySeriesIdAudioLocaleProgress[seriesId] || {}) }

      Object.entries(localeMapUpdates).forEach(([localeStorageKey, updateEntry]) => {
        const previous = context.normalizeWatchHistoryEntry(nextLocaleProgressMap[localeStorageKey])
        if (context.shouldReplaceWatchHistoryProgress(previous, updateEntry)) {
          nextLocaleProgressMap[localeStorageKey] = updateEntry
        }
      })

      if (Object.keys(nextLocaleProgressMap).length) {
        nextBySeriesIdAudioLocaleProgress[seriesId] = nextLocaleProgressMap
      }
    })

    return {
      bySeriesId: nextBySeriesId,
      bySeriesIdAudioLocale: nextBySeriesIdAudioLocale,
      bySeriesIdProgress: nextBySeriesIdProgress,
      bySeriesIdAudioLocaleProgress: nextBySeriesIdAudioLocaleProgress,
      mappedSeries: Object.keys(nextBySeriesId).length,
      mappedSeriesByAudioLocale: Object.keys(nextBySeriesIdAudioLocale).length,
      mappedProgressSeries: Object.keys(nextBySeriesIdProgress).length,
      mappedProgressSeriesByAudioLocale: Object.keys(nextBySeriesIdAudioLocaleProgress).length,
    }
  }

  async function preloadWatchHistoryForEntriesInternal(
    context: HistoryRepositoryPreloadContext,
    entries: HistoryPreloadEntry[],
    tokenEntry: TokenEntry,
    force = false,
    preferredAudioLanguage: unknown = context.getPreferredAudioLanguage(),
  ): Promise<unknown> {
    const tokenAccountId = typeof tokenEntry?.accountId === 'string' ? tokenEntry.accountId : ''
    if (!tokenEntry?.accessToken || !tokenAccountId) {
      context.state.watchHistoryStatus = 'unavailable'
      return
    }

    const { effectivePreferredAudioLanguage, isDefaultPreferredAudio, candidateSeriesIds } =
      resolveWatchHistoryPreloadContextInternal(context, entries, preferredAudioLanguage)

    if (!force && context.isWatchHistoryCacheValid(context.state.watchHistoryCache, tokenAccountId)) {
      context.state.watchHistoryStatus = 'ready'
      return
    }

    if (!force && context.state.watchHistoryInflight) {
      return context.state.watchHistoryInflight
    }

    const inflight = (async () => {
      context.state.watchHistoryStatus = 'loading'
      const buckets = await collectWatchHistoryUpdateBucketsInternal(
        context,
        tokenEntry,
        effectivePreferredAudioLanguage,
        candidateSeriesIds,
        isDefaultPreferredAudio,
      )

      const latestCache = context.normalizeStoredWatchHistoryCache(context.state.watchHistoryCache)
      const mergedCache = mergeWatchHistoryCacheWithBucketsInternal(
        context,
        latestCache,
        buckets,
        isDefaultPreferredAudio,
      )

      context.state.watchHistoryCache = {
        version: context.watchHistoryCacheVersion,
        accountId: tokenAccountId,
        updatedAt: Date.now(),
        bySeriesId: mergedCache.bySeriesId,
        bySeriesIdAudioLocale: mergedCache.bySeriesIdAudioLocale,
        bySeriesIdProgress: mergedCache.bySeriesIdProgress,
        bySeriesIdAudioLocaleProgress: mergedCache.bySeriesIdAudioLocaleProgress,
      }
      context.state.watchHistoryStatus = 'ready'
      context.scheduleSaveWatchHistory()

      context.runtimeEvent('watch-history-preload', {
        preferredAudioLanguage: effectivePreferredAudioLanguage,
        pages: buckets.pages,
        fetchedRows: buckets.fetchedRows,
        mappedSeries: mergedCache.mappedSeries,
        mappedSeriesByAudioLocale: mergedCache.mappedSeriesByAudioLocale,
        mappedProgressSeries: mergedCache.mappedProgressSeries,
        mappedProgressSeriesByAudioLocale: mergedCache.mappedProgressSeriesByAudioLocale,
        matchedCandidates: candidateSeriesIds.length - buckets.remainingSeriesIds.size,
        candidates: candidateSeriesIds.length,
        noMatchPageStreak: buckets.noMatchPageStreak,
      })
    })()
      .catch((error: unknown) => {
        context.state.watchHistoryStatus =
          isDefaultPreferredAudio || !context.isWatchHistoryCacheValid(context.state.watchHistoryCache, tokenAccountId)
            ? 'failed'
            : 'ready'
        context.runtimeEvent('watch-history-preload-failed', {
          preferredAudioLanguage: effectivePreferredAudioLanguage,
          message: error instanceof Error ? error.message : 'unknown',
        })
      })
      .finally(() => {
        if (context.state.watchHistoryInflight === inflight) {
          context.state.watchHistoryInflight = null
        }
      })

    context.state.watchHistoryInflight = inflight
    return inflight
  }

  function isLocalizedWatchHistoryDataMissingForEntriesInternal(
    context: HistoryRepositoryPreloadContext,
    entries: HistoryPreloadEntry[],
    audioLocale: unknown,
  ): boolean {
    const selectedAudioLocale = context.normalizeAudioLocale(audioLocale)
    if (!selectedAudioLocale || !entries.length) {
      return false
    }

    const isDefaultPreferredAudio =
      selectedAudioLocale.toLowerCase() === context.getPreferredAudioLanguage().toLowerCase()

    return entries.some((entry) => {
      const seriesId = entry?.seriesId
      if (!seriesId) {
        return false
      }

      if (entry.neverWatched && Number(entry.playheadMs || 0) <= 0) {
        return false
      }

      const localizedEntry = context.getCachedWatchHistory(seriesId, selectedAudioLocale, false)
      if (localizedEntry) {
        return false
      }

      if (isDefaultPreferredAudio) {
        return !context.getCachedWatchHistory(seriesId)
      }

      return true
    })
  }

  function createHistoryRepositoryPreload(options: HistoryRepositoryPreloadOptions = {}): HistoryRepositoryPreload {
    const context = createHistoryRepositoryPreloadContext(options)

    return {
      preloadWatchHistoryForEntries: (
        entries: unknown,
        tokenEntry: unknown,
        force = false,
        preferredAudioLanguage?: unknown,
      ) =>
        preloadWatchHistoryForEntriesInternal(
          context,
          toHistoryPreloadEntries(entries),
          toTokenEntry(tokenEntry),
          force,
          preferredAudioLanguage,
        ),
      isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown, audioLocale: unknown) =>
        isLocalizedWatchHistoryDataMissingForEntriesInternal(context, toHistoryPreloadEntries(entries), audioLocale),
    }
  }

  moduleRegistry.historyRepositoryPreload = {
    createHistoryRepositoryPreload,
  }
})()
