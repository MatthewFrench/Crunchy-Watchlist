;(() => {
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

  function toRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as LooseRecord
  }

  function toHistoryPreloadEntries(value: unknown): HistoryPreloadEntry[] {
    return Array.isArray(value)
      ? value.filter((entry): entry is HistoryPreloadEntry => !!entry && typeof entry === 'object')
      : []
  }

  function requireContextFunction<
    K extends keyof HistoryRepositoryPreloadContext & keyof HistoryRepositoryPreloadOptions,
  >(options: HistoryRepositoryPreloadOptions, name: K): HistoryRepositoryPreloadContext[K] {
    return requireFunction(String(name), options[name]) as HistoryRepositoryPreloadContext[K]
  }

  function resolveRequiredHistoryRepositoryPreloadDependencies(
    options: HistoryRepositoryPreloadOptions,
  ): Omit<
    HistoryRepositoryPreloadContext,
    | 'state'
    | 'resolveHistoryPreloadPlan'
    | 'getHistoryPayloadTotal'
    | 'collectWatchHistoryUpdateBuckets'
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

  function createHistoryRepositoryPreloadContext(
    options: HistoryRepositoryPreloadOptions = {},
  ): HistoryRepositoryPreloadContext {
    const state = toWatchHistoryState(options.state)
    if (!state) {
      throw new Error('[CW] Missing history repository state')
    }

    const planningModule = toRecord(moduleRegistry.historyRepositoryPreloadPlanning)
    const collectorModule = toRecord(moduleRegistry.historyRepositoryPreloadCollector)

    return {
      state,
      ...resolveRequiredHistoryRepositoryPreloadDependencies(options),
      resolveHistoryPreloadPlan: requireFunction(
        'resolveHistoryPreloadPlan',
        planningModule.resolveHistoryPreloadPlan,
      ) as HistoryRepositoryPreloadContext['resolveHistoryPreloadPlan'],
      getHistoryPayloadTotal: requireFunction(
        'getHistoryPayloadTotal',
        planningModule.getHistoryPayloadTotal,
      ) as HistoryRepositoryPreloadContext['getHistoryPayloadTotal'],
      collectWatchHistoryUpdateBuckets: requireFunction(
        'collectWatchHistoryUpdateBuckets',
        collectorModule.collectWatchHistoryUpdateBuckets,
      ) as HistoryRepositoryPreloadContext['collectWatchHistoryUpdateBuckets'],
      pushApiTrace:
        typeof options.pushApiTrace === 'function'
          ? (options.pushApiTrace as HistoryRepositoryPreloadContext['pushApiTrace'])
          : () => {},
      runtimeEvent:
        typeof options.runtimeEvent === 'function'
          ? (options.runtimeEvent as HistoryRepositoryPreloadContext['runtimeEvent'])
          : () => {},
      watchHistoryCacheVersion: Number(options.watchHistoryCacheVersion) || 0,
      watchHistoryPageSize: Math.max(1, Number(options.watchHistoryPageSize) || 1),
      watchHistoryMaxPages: Math.max(1, Number(options.watchHistoryMaxPages) || 1),
      watchHistoryNoMatchPageLimit: Math.max(1, Number(options.watchHistoryNoMatchPageLimit) || 1),
    }
  }

  function requireHistoryAccountId(
    context: HistoryRepositoryPreloadContext,
    tokenEntry: TokenEntry,
    pageNumber: number,
  ): string {
    const accountId = typeof tokenEntry?.accountId === 'string' ? tokenEntry.accountId : ''
    if (accountId) {
      return accountId
    }

    context.runtimeEvent('watch-history-contract-warning', {
      reason: 'missing-account-id',
      page: Math.max(1, Number(pageNumber) || 1),
    })
    throw new Error('watch history request missing account id')
  }

  function createWatchHistoryRequestParams(
    context: HistoryRepositoryPreloadContext,
    pageNumber: number,
    preferredAudioLanguage: unknown,
  ): URLSearchParams {
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
    return params
  }

  async function parseWatchHistoryPayload(
    context: HistoryRepositoryPreloadContext,
    response: Response,
    pageNumber: number,
    requestUrl: string,
  ): Promise<unknown> {
    try {
      return await response.json()
    } catch (_) {
      context.runtimeEvent('watch-history-contract-warning', {
        reason: 'invalid-json-payload',
        page: Math.max(1, Number(pageNumber) || 1),
        requestUrl,
      })
      throw new Error('watch history page payload parse failed')
    }
  }

  async function fetchWatchHistoryPageInternal(
    context: HistoryRepositoryPreloadContext,
    tokenEntry: TokenEntry,
    pageNumber: number,
    preferredAudioLanguage: unknown = context.getPreferredAudioLanguage(),
  ): Promise<{ rows: LooseRecord[]; total: number }> {
    const accountId = requireHistoryAccountId(context, tokenEntry, pageNumber)
    const resolvedPageNumber = Math.max(1, Number(pageNumber) || 1)
    const params = createWatchHistoryRequestParams(context, pageNumber, preferredAudioLanguage)

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

    const payload = await parseWatchHistoryPayload(context, response, pageNumber, url)
    const rows = context.requirePayloadDataArray('watch-history', payload)
    context.auditWatchHistoryRowsContract(rows)
    const total = context.getHistoryPayloadTotal({
      payload,
      fallback: rows.length,
      pageNumber,
      requestUrl: url,
      runtimeEvent: context.runtimeEvent,
    })

    context.pushApiTrace('watchHistory', {
      at: Date.now(),
      request: {
        url,
        page: resolvedPageNumber,
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

  function applyWatchHistoryBucketsToState(
    context: HistoryRepositoryPreloadContext,
    buckets: HistoryUpdateBuckets,
    preloadPlan: WatchHistoryPreloadPlan,
    tokenAccountId: string,
  ): void {
    const latestCache = context.normalizeStoredWatchHistoryCache(context.state.watchHistoryCache)
    const mergedCache = mergeWatchHistoryCacheWithBucketsInternal(
      context,
      latestCache,
      buckets,
      preloadPlan.isDefaultPreferredAudio,
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
      preferredAudioLanguage: preloadPlan.effectivePreferredAudioLanguage,
      pages: buckets.pages,
      fetchedRows: buckets.fetchedRows,
      mappedSeries: mergedCache.mappedSeries,
      mappedSeriesByAudioLocale: mergedCache.mappedSeriesByAudioLocale,
      mappedProgressSeries: mergedCache.mappedProgressSeries,
      mappedProgressSeriesByAudioLocale: mergedCache.mappedProgressSeriesByAudioLocale,
      matchedCandidates: preloadPlan.candidateSeriesIds.length - buckets.remainingSeriesIds.size,
      candidates: preloadPlan.candidateSeriesIds.length,
      noMatchPageStreak: buckets.noMatchPageStreak,
    })
  }

  function handleWatchHistoryPreloadFailure(
    context: HistoryRepositoryPreloadContext,
    error: unknown,
    preloadPlan: WatchHistoryPreloadPlan,
    tokenAccountId: string,
  ): void {
    context.state.watchHistoryStatus =
      preloadPlan.isDefaultPreferredAudio ||
      !context.isWatchHistoryCacheValid(context.state.watchHistoryCache, tokenAccountId)
        ? 'failed'
        : 'ready'
    context.runtimeEvent('watch-history-preload-failed', {
      preferredAudioLanguage: preloadPlan.effectivePreferredAudioLanguage,
      message: error instanceof Error ? error.message : 'unknown',
    })
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

    const preloadPlan = context.resolveHistoryPreloadPlan({
      entries,
      preferredAudioLanguage,
      getPreferredAudioLanguage: context.getPreferredAudioLanguage,
      normalizeAudioLocale: context.normalizeAudioLocale,
    })

    if (!force && context.isWatchHistoryCacheValid(context.state.watchHistoryCache, tokenAccountId)) {
      context.state.watchHistoryStatus = 'ready'
      return
    }

    if (!force && context.state.watchHistoryInflight) {
      return context.state.watchHistoryInflight
    }

    const inflight = (async () => {
      context.state.watchHistoryStatus = 'loading'
      const buckets = await context.collectWatchHistoryUpdateBuckets({
        tokenEntry,
        effectivePreferredAudioLanguage: preloadPlan.effectivePreferredAudioLanguage,
        candidateSeriesIds: preloadPlan.candidateSeriesIds,
        isDefaultPreferredAudio: preloadPlan.isDefaultPreferredAudio,
        watchHistoryMaxPages: context.watchHistoryMaxPages,
        watchHistoryPageSize: context.watchHistoryPageSize,
        watchHistoryNoMatchPageLimit: context.watchHistoryNoMatchPageLimit,
        fetchWatchHistoryPage: (
          tokenEntryForPage: TokenEntry,
          pageNumber: number,
          preferredAudioLanguageForPage: unknown = preloadPlan.effectivePreferredAudioLanguage,
        ) => fetchWatchHistoryPageInternal(context, tokenEntryForPage, pageNumber, preferredAudioLanguageForPage),
        normalizeAudioLocale: context.normalizeAudioLocale,
        sanitizePositiveInt: context.sanitizePositiveInt,
        parseDateMs: context.parseDateMs,
        deriveCanonicalEpisodeKeyFromEpisodeMetadata: context.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
        getAbsoluteEpisodeNumberFromEpisodeMetadata: context.getAbsoluteEpisodeNumberFromEpisodeMetadata,
        shouldReplaceWatchHistoryProgress: context.shouldReplaceWatchHistoryProgress,
      })
      applyWatchHistoryBucketsToState(context, buckets, preloadPlan, tokenAccountId)
    })()
      .catch((error: unknown) => {
        handleWatchHistoryPreloadFailure(context, error, preloadPlan, tokenAccountId)
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
