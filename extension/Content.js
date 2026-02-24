;(() => {
  const moduleRegistry = window.__CW_WATCHLIST_CURATOR_MODULES__ || {}
  const runtimeBootstrapDiagnosticsModule = moduleRegistry.runtimeBootstrapDiagnostics
  if (
    !runtimeBootstrapDiagnosticsModule ||
    typeof runtimeBootstrapDiagnosticsModule.createBootstrapDiagnostics !== 'function'
  ) {
    // eslint-disable-next-line no-console
    console.error('[CW] missing-bootstrap-diagnostics-module')
    return
  }
  const { updateDiagnostics, setBootstrapIssue } = runtimeBootstrapDiagnosticsModule.createBootstrapDiagnostics({
    windowRef: window,
    consoleRef: console,
  })
  updateDiagnostics({ ok: false, stage: 'content-script-loaded', pathname: window.location?.pathname || '' })

  const runtimeBootstrapGateModule = moduleRegistry.runtimeBootstrapGate
  if (
    !runtimeBootstrapGateModule ||
    ['shouldRun', 'isWatchlistPath', 'getWatchlistRoot', 'getWatchlistHeader'].some(
      (methodName) => typeof runtimeBootstrapGateModule[methodName] !== 'function',
    )
  ) {
    setBootstrapIssue('missing-bootstrap-gate-module')
    return
  }

  const shouldRun = runtimeBootstrapGateModule.shouldRun({
    windowRef: window,
    browserRef: typeof browser !== 'undefined' ? browser : undefined,
    chromeRef: typeof chrome !== 'undefined' ? chrome : undefined,
  })
  if (!shouldRun) {
    updateDiagnostics({
      ok: false,
      stage: 'bootstrap-gated',
      pathname: window.location?.pathname || '',
      inTopFrame: window.top === window,
    })
    return
  }

  updateDiagnostics({ ok: false, stage: 'bootstrap-started' })

  const runtimeBootstrapModulesModule = moduleRegistry.runtimeBootstrapModules
  if (
    !runtimeBootstrapModulesModule ||
    typeof runtimeBootstrapModulesModule.createBootstrapModules !== 'function' ||
    typeof runtimeBootstrapModulesModule.assertRuntimeMethods !== 'function'
  ) {
    setBootstrapIssue('missing-bootstrap-modules-module')
    return
  }
  const runtimeBootstrapFinalizeModule = moduleRegistry.runtimeBootstrapFinalize
  if (
    !runtimeBootstrapFinalizeModule ||
    typeof runtimeBootstrapFinalizeModule.createBootstrapFinalizeRuntime !== 'function' ||
    typeof runtimeBootstrapFinalizeModule.createStorageAccessors !== 'function' ||
    typeof runtimeBootstrapFinalizeModule.safeJsonParse !== 'function'
  ) {
    setBootstrapIssue('missing-bootstrap-finalize-module')
    return
  }

  const bootstrapModulesRuntime = runtimeBootstrapModulesModule.createBootstrapModules({ windowRef: window })
  if (!bootstrapModulesRuntime || typeof bootstrapModulesRuntime !== 'object') {
    setBootstrapIssue('invalid-bootstrap-modules-runtime')
    return
  }

  const {
    runtimeStoreModule,
    runtimeTraceModule,
    runtimeStateLoaderModule,
    runtimeLifecycleModule,
    runtimePreferredAudioModule,
    runtimeRenderableModule,
    runtimeCuratedPanelModule,
    runtimeCuratedLoaderModule,
    runtimeNativeBridgeModule,
    runtimeCuratedInteractionsModule,
    runtimeInterfaceShellModule,
    runtimeDebugModule,
    runtimeBootstrapHelpersModule,
    storageModule,
    apiContractsModule,
    authClientModule,
    watchlistClientModule,
    watchlistRepositoryModule,
    historyRepositoryModule,
    ratingsClientModule,
    ratingsRepositoryModule,
    previewRepositoryModule,
    corePrimitivesModule,
    imageVariantsModule,
    entryNormalizerModule,
    sortMetricsModule,
    entrySortingModule,
    cardMetadataModule,
    controlsViewModule,
    cardViewModule,
    cardShellModule,
    defaultSortMode: DEFAULT_SORT_MODE,
    validSortModes: VALID_SORT_MODES,
    sortModeControlOptions: SORT_MODE_CONTROL_OPTIONS,
    defaultSettings: DEFAULT_SETTINGS,
    runtimeConstants,
  } = bootstrapModulesRuntime
  const assertRuntimeMethods = runtimeBootstrapModulesModule.assertRuntimeMethods

  const createEmptyWatchHistoryCache = () =>
    runtimeStoreModule.createEmptyWatchHistoryCache(runtimeConstants.watchHistoryCacheVersion)
  const createWatchlistCacheSnapshot = (...args) => runtimeStoreModule.createWatchlistCacheSnapshot(...args)
  const state = runtimeStoreModule.createRuntimeState({
    defaultSettings: DEFAULT_SETTINGS,
    watchHistoryCacheVersion: runtimeConstants.watchHistoryCacheVersion,
  })

  const storageLocalArea =
    (typeof browser !== 'undefined' && browser.storage && browser.storage.local) ||
    (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) ||
    null

  const isWatchlistPath = (pathname) => runtimeBootstrapGateModule.isWatchlistPath(pathname)
  const getWatchlistRoot = () => runtimeBootstrapGateModule.getWatchlistRoot(document)
  const getWatchlistHeader = () => runtimeBootstrapGateModule.getWatchlistHeader(document)

  let processWatchlist = async () => {}
  let runtimeEvent = () => {}
  let pushApiTrace = () => {}

  function debounceProcess() {
    clearTimeout(state.processTimer)
    state.processTimer = window.setTimeout(() => {
      processWatchlist().catch(() => {
        // no-op
      })
    }, runtimeConstants.processDebounceMs)
  }

  const safeJsonParse = (value, fallback) => runtimeBootstrapFinalizeModule.safeJsonParse(value, fallback)
  const storageAdapter = storageModule.createStorageAdapter({
    storageArea: storageLocalArea,
    parseJson: safeJsonParse,
    localStorageRef: window.localStorage,
    timeoutMs: 1500,
  })
  const storageAccessors = runtimeBootstrapFinalizeModule.createStorageAccessors({
    storageAdapter,
  })
  const storageGet = (key, fallback) => storageAccessors.storageGet(key, fallback)
  const storageSet = (key, value) => storageAccessors.storageSet(key, value)

  let normalizeEntriesFromApiRows,
    getStarCountFromDistributionImpl,
    getStarPercentageFromDistributionImpl,
    getTotalStarPointsImpl,
    getConsensusQualityScoreImpl,
    getControversyScoreImpl,
    getQualityFloorScoreImpl,
    getQuickWinScoreImpl,
    getWatchedEpisodeEstimateImpl,
    getPlausiblePastTimestampImpl,
    getRewatchActivityTimestampImpl,
    getMostRecentActivityTimestampImpl,
    getDormantBacklogScoreImpl,
    getRewatchMemoryScoreImpl,
    estimateUnwatchedEpisodesLeftImpl,
    createCuratedInterfaceControlsImpl,
    createCuratedCardBodyImpl,
    createCuratedCardImpl,
    fetchWithResilience,
    getAccessToken,
    createAuthRefreshHandler,
    fetchAllWatchlistRows,
    normalizeStoredWatchlistCache,
    isWatchlistCacheValid,
    resetWatchlistCacheOnAccountMismatch
  let setWatchlistCacheRows = (accountId = '', rows = [], updatedAt = Date.now()) => {
    state.watchlistCache = createWatchlistCacheSnapshot(accountId, updatedAt, rows)
    return state.watchlistCache
  }
  let fetchRatingsBatch,
    fetchRating,
    preloadRatingsForEntries,
    fetchPreviewUrlForEntry,
    normalizeStoredWatchHistoryCache,
    isWatchHistoryCacheValid,
    getCachedWatchHistory,
    getCachedWatchHistoryProgress,
    preloadWatchHistoryForEntries,
    isLocalizedWatchHistoryDataMissingForEntries,
    getCachedRating,
    isLocalizedRatingDataMissingForEntries,
    detectPreferredAudioLanguage,
    normalizeImageUrlCandidateImpl,
    extractCoverImagesFromApiImagesImpl,
    extractThumbnailImageFromApiImagesImpl,
    buildRenderableEntries,
    createCuratedCardActionsImpl,
    compareRenderableEntriesImpl,
    formatVotesImpl,
    getLastWatchedPresentationImpl,
    appendLabeledValueImpl,
    setLabeledValueImpl,
    setLabeledValuePairsImpl,
    getSeriesScopePairsImpl,
    getGenreValueImpl,
    makeRatingBadgeImpl,
    makeRatingHistogramImpl,
    triggerNativeCardActionImpl,
    installCuratedCardPreviewImpl,
    bindCuratedInterfaceControlsImpl,
    ensureCuratedDataLoad,
    renderCuratedPanel,
    clearRootFrameImpl,
    setNativeVisibilityImpl,
    applyTabUiImpl,
    resetCuratedCachesForRefreshImpl,
    ensureInterfaceImpl,
    listKnownSeries,
    dumpSeriesApiData,
    resolveApiHref,
    normalizeImageUrlCandidate,
    extractCoverImagesFromApiImages,
    extractThumbnailImageFromApiImages,
    scheduleSaveRatings,
    scheduleSaveWatchHistory,
    scheduleSaveWatchlistCache,
    getPreferredAudioLanguage,
    preloadRatingsForSelectedAudioLocale,
    preloadWatchHistoryForSelectedAudioLocale,
    toggleCuratedFavorite,
    removeCuratedSeries,
    isLikelyVideoUrl,
    isEntryWatchReady,
    withMutedObserver,
    applyCardLayoutUi,
    persistSettings
  let printSeriesApiData

  try {
    const runtimeTrace = runtimeTraceModule.createRuntimeTrace({
      windowRef: window,
      state,
      apiTraceLimitPerEndpoint: runtimeConstants.apiTraceLimitPerEndpoint,
    })
    assertRuntimeMethods('runtime trace', runtimeTrace, ['runtimeEvent', 'pushApiTrace'])
    runtimeEvent = runtimeTrace.runtimeEvent
    pushApiTrace = runtimeTrace.pushApiTrace

    const corePrimitives = corePrimitivesModule.createCorePrimitives({
      extractCoverImagesFromApiImages: (images) => extractCoverImagesFromApiImages(images),
    })
    assertRuntimeMethods('core primitives', corePrimitives, [
      'sanitizeRating',
      'parseCmsObjectRecord',
      'deriveDisplayStatusBase',
    ])

    const apiContracts = apiContractsModule.createApiContracts({
      windowRef: window,
      navigatorRef: window.navigator,
      runtimeEvent,
      parseDateMs: (value) => corePrimitives.parseDateMs(value),
      getWatchlistSeriesId: (entry) => corePrimitives.getWatchlistSeriesId(entry),
      getWatchHistorySeriesId: (entry) => corePrimitives.getWatchHistorySeriesId(entry),
      fetchBackoffBaseMs: runtimeConstants.fetchBackoffBaseMs,
      fetchBackoffJitterMs: runtimeConstants.fetchBackoffJitterMs,
    })
    assertRuntimeMethods('api contracts', apiContracts, [
      'shouldRetryStatus',
      'requirePayloadDataArray',
      'resolveApiHref',
    ])

    resolveApiHref = apiContracts.resolveApiHref

    const preferredAudioDetector = runtimePreferredAudioModule.createPreferredAudioDetector({
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
      parseJson: safeJsonParse,
      localStorageRef: window.localStorage,
      navigatorRef: window.navigator,
      documentRef: window.document,
      storageScanLimit: runtimeConstants.preferredAudioStorageScanLimit,
      valueScanLimit: runtimeConstants.preferredAudioValueScanLimit,
    })
    assertRuntimeMethods('preferred audio detector', preferredAudioDetector, ['detectPreferredAudioLanguage'])
    detectPreferredAudioLanguage = () => preferredAudioDetector.detectPreferredAudioLanguage()

    const bootstrapHelpersRuntime = runtimeBootstrapHelpersModule.createBootstrapHelpersRuntime({
      state,
      windowRef: window,
      runtimeEvent,
      storageSet: (key, value) => storageSet(key, value),
      settingsKey: runtimeConstants.settingsKey,
      ratingCacheKey: runtimeConstants.ratingCacheKey,
      watchHistoryCacheKey: runtimeConstants.watchHistoryCacheKey,
      watchlistCacheKey: runtimeConstants.watchlistCacheKey,
      preferredAudioCacheTtlMs: runtimeConstants.preferredAudioCacheTtlMs,
      normalizeAudioLocale: (value) => corePrimitives.normalizeAudioLocale(value),
      detectPreferredAudioLanguage: () => detectPreferredAudioLanguage(),
      isLocalizedRatingDataMissingForEntries: (entries, audioLocale) =>
        isLocalizedRatingDataMissingForEntries(entries, audioLocale),
      isLocalizedWatchHistoryDataMissingForEntries: (entries, audioLocale) =>
        isLocalizedWatchHistoryDataMissingForEntries(entries, audioLocale),
      getAccessToken: (forceRefresh = false) => getAccessToken(forceRefresh),
      preloadRatingsForEntries: (entries, tokenEntry, preferredAudioLanguage) =>
        preloadRatingsForEntries(entries, tokenEntry, preferredAudioLanguage),
      preloadWatchHistoryForEntries: (entries, tokenEntry, force, preferredAudioLanguage) =>
        preloadWatchHistoryForEntries(entries, tokenEntry, force, preferredAudioLanguage),
    })
    assertRuntimeMethods('bootstrap helpers runtime', bootstrapHelpersRuntime, [
      'scheduleSaveRatings',
      'scheduleSaveWatchHistory',
      'scheduleSaveWatchlistCache',
      'getPreferredAudioLanguage',
      'preloadRatingsForSelectedAudioLocale',
      'preloadWatchHistoryForSelectedAudioLocale',
      'toggleCuratedFavorite',
      'removeCuratedSeries',
      'isLikelyVideoUrl',
      'isEntryWatchReady',
      'withMutedObserver',
      'applyCardLayoutUi',
      'persistSettings',
    ])
    scheduleSaveRatings = () => bootstrapHelpersRuntime.scheduleSaveRatings()
    scheduleSaveWatchHistory = () => bootstrapHelpersRuntime.scheduleSaveWatchHistory()
    scheduleSaveWatchlistCache = () => bootstrapHelpersRuntime.scheduleSaveWatchlistCache()
    getPreferredAudioLanguage = () => bootstrapHelpersRuntime.getPreferredAudioLanguage()
    preloadRatingsForSelectedAudioLocale = (audioLocale) =>
      bootstrapHelpersRuntime.preloadRatingsForSelectedAudioLocale(audioLocale)
    preloadWatchHistoryForSelectedAudioLocale = (audioLocale) =>
      bootstrapHelpersRuntime.preloadWatchHistoryForSelectedAudioLocale(audioLocale)
    toggleCuratedFavorite = (seriesId) => bootstrapHelpersRuntime.toggleCuratedFavorite(seriesId)
    removeCuratedSeries = (seriesId) => bootstrapHelpersRuntime.removeCuratedSeries(seriesId)
    isLikelyVideoUrl = (url) => bootstrapHelpersRuntime.isLikelyVideoUrl(url)
    isEntryWatchReady = (entry) => bootstrapHelpersRuntime.isEntryWatchReady(entry)
    withMutedObserver = (work) => bootstrapHelpersRuntime.withMutedObserver(work)
    applyCardLayoutUi = () => bootstrapHelpersRuntime.applyCardLayoutUi()
    persistSettings = () => bootstrapHelpersRuntime.persistSettings()

    const authClient = authClientModule.createAuthClient({
      state,
      runtimeEvent,
      pushApiTrace,
      resolveApiHref,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      shouldRetryStatus: apiContracts.shouldRetryStatus,
      computeFetchRetryDelayMs: apiContracts.computeFetchRetryDelayMs,
      sleep: apiContracts.sleep,
      fetchTimeoutMs: runtimeConstants.fetchTimeoutMs,
      fetchMaxAttempts: runtimeConstants.fetchMaxAttempts,
      authTokenSkewMs: runtimeConstants.authTokenSkewMs,
      authClientBasic: runtimeConstants.authClientBasic,
      authDeviceKey: runtimeConstants.authDeviceKey,
      localStorageRef: window.localStorage,
      navigatorRef: window.navigator,
      cryptoRef: window.crypto,
      fetchImpl: window.fetch.bind(window),
    })
    assertRuntimeMethods('auth client', authClient, [
      'fetchWithResilience',
      'getAccessToken',
      'createAuthRefreshHandler',
    ])
    fetchWithResilience = authClient.fetchWithResilience
    getAccessToken = authClient.getAccessToken
    createAuthRefreshHandler = authClient.createAuthRefreshHandler

    const imageVariants = imageVariantsModule.createImageVariants({
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      resolveApiHref,
    })
    assertRuntimeMethods('image variants', imageVariants, [
      'normalizeImageUrlCandidate',
      'extractCoverImagesFromApiImages',
      'extractThumbnailImageFromApiImages',
    ])
    normalizeImageUrlCandidateImpl = (value) => imageVariants.normalizeImageUrlCandidate(value)
    extractCoverImagesFromApiImagesImpl = (images) => imageVariants.extractCoverImagesFromApiImages(images)
    extractThumbnailImageFromApiImagesImpl = (images) => imageVariants.extractThumbnailImageFromApiImages(images)
    normalizeImageUrlCandidate = (value) => normalizeImageUrlCandidateImpl(value)
    extractCoverImagesFromApiImages = (images) => extractCoverImagesFromApiImagesImpl(images)
    extractThumbnailImageFromApiImages = (images) => extractThumbnailImageFromApiImagesImpl(images)

    const ratingsClient = ratingsClientModule.createRatingsClient({
      fetchWithResilience,
      getAccessToken,
      createAuthRefreshHandler,
      resolveApiHref,
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
      getPreferredAudioLanguage,
      getLocale: apiContracts.getLocale,
      requirePayloadDataArray: apiContracts.requirePayloadDataArray,
      auditCmsObjectContract: apiContracts.auditCmsObjectContract,
      parseCmsObjectRecord: corePrimitives.parseCmsObjectRecord,
      parseRatingPayload: corePrimitives.parseRatingPayload,
      sanitizeRating: corePrimitives.sanitizeRating,
      sanitizeVotes: corePrimitives.sanitizeVotes,
      pushApiTrace,
    })
    assertRuntimeMethods('ratings client', ratingsClient, ['fetchRatingsBatch', 'fetchRating'])
    fetchRatingsBatch = ratingsClient.fetchRatingsBatch
    fetchRating = ratingsClient.fetchRating

    const ratingsRepository = ratingsRepositoryModule.createRatingsRepository({
      state,
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
      normalizeAudioLocales: corePrimitives.normalizeAudioLocales,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      normalizeTagList: corePrimitives.normalizeTagList,
      normalizeImageUrlCandidate,
      getAudioLocaleCountFromMap: corePrimitives.getAudioLocaleCountFromMap,
      mergeAudioLocaleCountMap: corePrimitives.mergeAudioLocaleCountMap,
      getPreferredAudioLanguage,
      chunkArray: corePrimitives.chunkArray,
      fetchRatingsBatch,
      fetchRating,
      scheduleSaveRatings,
      runtimeEvent,
      ratingBatchSize: runtimeConstants.ratingBatchSize,
      ratingCacheTtlMs: runtimeConstants.ratingCacheTtlMs,
    })
    assertRuntimeMethods('ratings repository', ratingsRepository, [
      'getSeriesRating',
      'preloadRatingsForEntries',
      'getCachedRating',
      'isLocalizedRatingDataMissingForEntries',
    ])
    preloadRatingsForEntries = ratingsRepository.preloadRatingsForEntries
    getCachedRating = ratingsRepository.getCachedRating
    isLocalizedRatingDataMissingForEntries = ratingsRepository.isLocalizedRatingDataMissingForEntries

    const watchlistClient = watchlistClientModule.createWatchlistClient({
      fetchWithResilience,
      createAuthRefreshHandler,
      resolveApiHref,
      requirePayloadDataArray: apiContracts.requirePayloadDataArray,
      auditWatchlistRowsContract: apiContracts.auditWatchlistRowsContract,
      getPreferredAudioLanguage,
      getLocale: apiContracts.getLocale,
      getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId,
      pushApiTrace,
      runtimeEvent,
      watchlistPageSize: runtimeConstants.watchlistPageSize,
      watchlistMaxPages: runtimeConstants.watchlistMaxPages,
    })
    assertRuntimeMethods('watchlist client', watchlistClient, ['fetchAllWatchlistRows'])
    fetchAllWatchlistRows = watchlistClient.fetchAllWatchlistRows

    const watchlistRepository = watchlistRepositoryModule.createWatchlistRepository({
      state,
      createWatchlistCacheSnapshot,
      scheduleSaveWatchlistCache,
      watchlistCacheTtlMs: runtimeConstants.watchlistCacheTtlMs,
    })
    assertRuntimeMethods('watchlist repository', watchlistRepository, [
      'normalizeStoredWatchlistCache',
      'isWatchlistCacheValid',
      'resetWatchlistCacheOnAccountMismatch',
      'setWatchlistCacheRows',
    ])
    normalizeStoredWatchlistCache = watchlistRepository.normalizeStoredWatchlistCache
    isWatchlistCacheValid = watchlistRepository.isWatchlistCacheValid
    resetWatchlistCacheOnAccountMismatch = watchlistRepository.resetWatchlistCacheOnAccountMismatch
    setWatchlistCacheRows = watchlistRepository.setWatchlistCacheRows

    const historyRepository = historyRepositoryModule.createHistoryRepository({
      state,
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      parseDateMs: corePrimitives.parseDateMs,
      pickFirstPositiveInt: corePrimitives.pickFirstPositiveInt,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: corePrimitives.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      getAbsoluteEpisodeNumberFromEpisodeMetadata: corePrimitives.getAbsoluteEpisodeNumberFromEpisodeMetadata,
      getPreferredAudioLanguage,
      getLocale: apiContracts.getLocale,
      resolveApiHref,
      fetchWithResilience,
      createAuthRefreshHandler,
      requirePayloadDataArray: apiContracts.requirePayloadDataArray,
      auditWatchHistoryRowsContract: apiContracts.auditWatchHistoryRowsContract,
      createEmptyWatchHistoryCache,
      scheduleSaveWatchHistory,
      pushApiTrace,
      runtimeEvent,
      watchHistoryCacheVersion: runtimeConstants.watchHistoryCacheVersion,
      watchHistoryCacheTtlMs: runtimeConstants.watchHistoryCacheTtlMs,
      watchHistoryPageSize: runtimeConstants.watchHistoryPageSize,
      watchHistoryMaxPages: runtimeConstants.watchHistoryMaxPages,
      watchHistoryNoMatchPageLimit: runtimeConstants.watchHistoryNoMatchPageLimit,
    })
    assertRuntimeMethods('history repository', historyRepository, [
      'normalizeStoredWatchHistoryCache',
      'isWatchHistoryCacheValid',
      'getCachedWatchHistory',
      'getCachedWatchHistoryProgress',
      'preloadWatchHistoryForEntries',
      'isLocalizedWatchHistoryDataMissingForEntries',
    ])
    normalizeStoredWatchHistoryCache = historyRepository.normalizeStoredWatchHistoryCache
    isWatchHistoryCacheValid = historyRepository.isWatchHistoryCacheValid
    getCachedWatchHistory = historyRepository.getCachedWatchHistory
    getCachedWatchHistoryProgress = historyRepository.getCachedWatchHistoryProgress
    preloadWatchHistoryForEntries = historyRepository.preloadWatchHistoryForEntries
    isLocalizedWatchHistoryDataMissingForEntries = historyRepository.isLocalizedWatchHistoryDataMissingForEntries

    const previewRepository = previewRepositoryModule.createPreviewRepository({
      state,
      resolveApiHref,
      getAccessToken,
      fetchWithResilience,
      createAuthRefreshHandler,
      pushApiTrace,
      runtimeEvent,
    })
    assertRuntimeMethods('preview repository', previewRepository, ['fetchPreviewUrlForEntry'])
    fetchPreviewUrlForEntry = previewRepository.fetchPreviewUrlForEntry

    const entryNormalizer = entryNormalizerModule.createEntryNormalizer({
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      getAbsoluteEpisodeNumberFromEpisodeMetadata: corePrimitives.getAbsoluteEpisodeNumberFromEpisodeMetadata,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: corePrimitives.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      formatEpisodeIdentifier: corePrimitives.formatEpisodeIdentifier,
      hasEnUsAudio: corePrimitives.hasEnUsAudio,
      extractCoverImagesFromApiImages,
      extractThumbnailImageFromApiImages,
      pickFirstDateMs: corePrimitives.pickFirstDateMs,
      getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId,
      getEpisodeAvailabilityByAudioLocale: corePrimitives.getEpisodeAvailabilityByAudioLocale,
      mergeEpisodeAvailabilityByAudioLocale: corePrimitives.mergeEpisodeAvailabilityByAudioLocale,
      normalizeAudioLocales: corePrimitives.normalizeAudioLocales,
    })
    normalizeEntriesFromApiRows = (rows) => entryNormalizer.normalizeEntriesFromApiRows(rows)

    const sortMetrics = sortMetricsModule.createSortMetrics({
      sanitizePercentage: corePrimitives.sanitizePercentage,
      sanitizeVotes: corePrimitives.sanitizeVotes,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      parseDateMs: corePrimitives.parseDateMs,
      pickFirstPositiveInt: corePrimitives.pickFirstPositiveInt,
    })
    assertRuntimeMethods('sort metrics', sortMetrics, [
      'getStarCountFromDistribution',
      'getStarPercentageFromDistribution',
      'getTotalStarPoints',
      'getConsensusQualityScore',
      'getControversyScore',
      'getQualityFloorScore',
      'getQuickWinScore',
      'getWatchedEpisodeEstimate',
      'getPlausiblePastTimestamp',
      'getRewatchActivityTimestamp',
      'getMostRecentActivityTimestamp',
      'getDormantBacklogScore',
      'getRewatchMemoryScore',
      'estimateUnwatchedEpisodesLeft',
    ])

    getStarCountFromDistributionImpl = (votes, distribution, starLevel) =>
      sortMetrics.getStarCountFromDistribution(votes, distribution, starLevel)
    getStarPercentageFromDistributionImpl = (distribution, starLevel) =>
      sortMetrics.getStarPercentageFromDistribution(distribution, starLevel)
    getTotalStarPointsImpl = (votes, distribution) => sortMetrics.getTotalStarPoints(votes, distribution)
    getConsensusQualityScoreImpl = (distribution) => sortMetrics.getConsensusQualityScore(distribution)
    getControversyScoreImpl = (distribution) => sortMetrics.getControversyScore(distribution)
    getQualityFloorScoreImpl = (distribution) => sortMetrics.getQualityFloorScore(distribution)
    getQuickWinScoreImpl = (entry) => sortMetrics.getQuickWinScore(entry)
    getWatchedEpisodeEstimateImpl = (entry) => sortMetrics.getWatchedEpisodeEstimate(entry)
    getPlausiblePastTimestampImpl = (value) => sortMetrics.getPlausiblePastTimestamp(value)
    getRewatchActivityTimestampImpl = (entry) => sortMetrics.getRewatchActivityTimestamp(entry)
    getMostRecentActivityTimestampImpl = (entry) => sortMetrics.getMostRecentActivityTimestamp(entry)
    getDormantBacklogScoreImpl = (entry) => sortMetrics.getDormantBacklogScore(entry)
    getRewatchMemoryScoreImpl = (entry) => sortMetrics.getRewatchMemoryScore(entry)
    estimateUnwatchedEpisodesLeftImpl = (entry) => sortMetrics.estimateUnwatchedEpisodesLeft(entry)

    const entrySorting = entrySortingModule.createEntrySorting({
      sanitizeVotes: corePrimitives.sanitizeVotes,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      parseDateMs: corePrimitives.parseDateMs,
      getStarCountFromDistribution: (votes, distribution, starLevel) =>
        getStarCountFromDistributionImpl(votes, distribution, starLevel),
      getStarPercentageFromDistribution: (distribution, starLevel) =>
        getStarPercentageFromDistributionImpl(distribution, starLevel),
      getTotalStarPoints: (votes, distribution) => getTotalStarPointsImpl(votes, distribution),
      getConsensusQualityScore: (distribution) => getConsensusQualityScoreImpl(distribution),
      getControversyScore: (distribution) => getControversyScoreImpl(distribution),
      getQualityFloorScore: (distribution) => getQualityFloorScoreImpl(distribution),
      getQuickWinScore: (entry) => getQuickWinScoreImpl(entry),
      getDormantBacklogScore: (entry) => getDormantBacklogScoreImpl(entry),
      getRewatchMemoryScore: (entry) => getRewatchMemoryScoreImpl(entry),
      getWatchedEpisodeEstimate: (entry) => getWatchedEpisodeEstimateImpl(entry),
      getRewatchActivityTimestamp: (entry) => getRewatchActivityTimestampImpl(entry),
      getMostRecentActivityTimestamp: (entry) => getMostRecentActivityTimestampImpl(entry),
      getPlausiblePastTimestamp: (value) => getPlausiblePastTimestampImpl(value),
    })
    assertRuntimeMethods('entry sorting', entrySorting, ['compareRenderableEntries'])
    compareRenderableEntriesImpl = (left, right, sortMode) =>
      entrySorting.compareRenderableEntries(left, right, sortMode)

    const cardMetadata = cardMetadataModule.createCardMetadata({
      getPlausiblePastTimestamp: (value) => getPlausiblePastTimestampImpl(value),
      estimateUnwatchedEpisodesLeft: (entry) => estimateUnwatchedEpisodesLeftImpl(entry),
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      normalizeTagList: corePrimitives.normalizeTagList,
      sanitizePercentage: corePrimitives.sanitizePercentage,
      getStarCountFromDistribution: (votes, distribution, starLevel) =>
        getStarCountFromDistributionImpl(votes, distribution, starLevel),
      getWatchHistoryStatus: () => state.watchHistoryStatus,
      documentRef: window.document,
    })
    assertRuntimeMethods('card metadata', cardMetadata, [
      'formatVotes',
      'getLastWatchedPresentation',
      'appendLabeledValue',
      'setLabeledValue',
      'setLabeledValuePairs',
      'getSeriesScopePairs',
      'getGenreValue',
      'makeRatingHistogram',
      'makeRatingBadge',
    ])

    formatVotesImpl = (votes) => cardMetadata.formatVotes(votes)
    getLastWatchedPresentationImpl = (entry) => cardMetadata.getLastWatchedPresentation(entry)
    appendLabeledValueImpl = (element, label, value) => cardMetadata.appendLabeledValue(element, label, value)
    setLabeledValueImpl = (element, label, value) => cardMetadata.setLabeledValue(element, label, value)
    setLabeledValuePairsImpl = (element, pairs) => cardMetadata.setLabeledValuePairs(element, pairs)
    getSeriesScopePairsImpl = (entry) => cardMetadata.getSeriesScopePairs(entry)
    getGenreValueImpl = (entry) => cardMetadata.getGenreValue(entry)
    makeRatingBadgeImpl = (rating, votes) => cardMetadata.makeRatingBadge(rating, votes)
    makeRatingHistogramImpl = (distribution, votes) => cardMetadata.makeRatingHistogram(distribution, votes)

    const controlsView = controlsViewModule.createControlsView()
    assertRuntimeMethods('controls view', controlsView, ['createCuratedInterfaceControls'])
    createCuratedInterfaceControlsImpl = () =>
      controlsView.createCuratedInterfaceControls(state.settings, SORT_MODE_CONTROL_OPTIONS)

    const cardView = cardViewModule.createCardView({
      getLastWatchedPresentation: (entry) => getLastWatchedPresentationImpl(entry),
      setLabeledValue: (element, label, value) => setLabeledValueImpl(element, label, value),
      getSeriesScopePairs: (entry) => getSeriesScopePairsImpl(entry),
      setLabeledValuePairs: (element, pairs) => setLabeledValuePairsImpl(element, pairs),
      appendLabeledValue: (element, label, value) => appendLabeledValueImpl(element, label, value),
      getGenreValue: (entry) => getGenreValueImpl(entry),
      makeRatingHistogram: (distribution, votes) => makeRatingHistogramImpl(distribution, votes),
      formatVotes: (votes) => formatVotesImpl(votes),
    })
    assertRuntimeMethods('card view', cardView, ['createCuratedCardBody'])
    createCuratedCardBodyImpl = (entry, actions) => cardView.createCuratedCardBody(entry, actions)

    const cardShell = cardShellModule.createCardShell({
      documentRef: window.document,
      windowRef: window,
      getCardLayout: () => state.settings.cardLayout,
      normalizeImageUrlCandidate,
      resolveApiHref,
      makeRatingBadge: (rating, votes) => makeRatingBadgeImpl(rating, votes),
      createCuratedCardActions: (entry) => createCuratedCardActionsImpl(entry),
      createCuratedCardBody: (entry, actions) => createCuratedCardBodyImpl(entry, actions),
      installCuratedCardPreview: (thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage) => {
        installCuratedCardPreviewImpl(thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage)
      },
    })
    assertRuntimeMethods('card shell', cardShell, ['createCuratedCard'])
    createCuratedCardImpl = (entry) => cardShell.createCuratedCard(entry)

    const curatedRenderable = runtimeRenderableModule.createCuratedRenderable({
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
      getPreferredAudioLanguage,
      getCachedRating,
      getCachedWatchHistory,
      getCachedWatchHistoryProgress,
      normalizeAudioLocales: corePrimitives.normalizeAudioLocales,
      hasEnUsAudio: corePrimitives.hasEnUsAudio,
      normalizeTagList: corePrimitives.normalizeTagList,
      normalizeImageUrlCandidate,
      getAudioLocaleCountFromMap: corePrimitives.getAudioLocaleCountFromMap,
      getLocalizedSeriesCount: corePrimitives.getLocalizedSeriesCount,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      pickFirstDateMs: corePrimitives.pickFirstDateMs,
      deriveDisplayStatusBase: corePrimitives.deriveDisplayStatusBase,
      isEntryWatchReady,
      compareRenderableEntries: (left, right, sortMode = state.settings.sortMode) =>
        compareRenderableEntriesImpl(left, right, sortMode),
    })
    assertRuntimeMethods('curated renderable', curatedRenderable, ['buildRenderableEntries'])
    buildRenderableEntries = () => curatedRenderable.buildRenderableEntries(state.curatedEntries, state.settings)

    const curatedPanelRuntime = runtimeCuratedPanelModule.createCuratedPanelRuntime({
      state,
      documentRef: window.document,
      locationRef: window.location,
      createCuratedCard: (entry) => createCuratedCardImpl(entry),
      applyCardLayoutUi,
      buildRenderableEntries,
      withMutedObserver,
      isLocalizedRatingDataMissingForEntries,
      isLocalizedWatchHistoryDataMissingForEntries,
      preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale,
      isWatchlistPath,
    })
    assertRuntimeMethods('curated panel runtime', curatedPanelRuntime, ['renderCuratedPanel'])
    renderCuratedPanel = () => curatedPanelRuntime.renderCuratedPanel()

    const curatedLoaderRuntime = runtimeCuratedLoaderModule.createCuratedLoaderRuntime({
      state,
      locationRef: window.location,
      runtimeEvent,
      getAccessToken,
      resetWatchlistCacheOnAccountMismatch,
      fetchAllWatchlistRows,
      normalizeEntriesFromApiRows,
      preloadRatingsForEntries,
      preloadWatchHistoryForEntries,
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
      getPreferredAudioLanguage,
      setWatchlistCacheRows,
      isWatchlistPath,
      renderCuratedPanel,
      watchlistRevalidateCooldownMs: runtimeConstants.watchlistRevalidateCooldownMs,
    })
    assertRuntimeMethods('curated loader runtime', curatedLoaderRuntime, [
      'loadCuratedEntries',
      'ensureCuratedDataLoad',
    ])
    ensureCuratedDataLoad = (force = false) => curatedLoaderRuntime.ensureCuratedDataLoad(force)

    const nativeBridgeRuntime = runtimeNativeBridgeModule.createNativeBridgeRuntime({
      documentRef: window.document,
      windowRef: window,
      runtimeEvent,
      normalizeImageUrlCandidate,
      fetchPreviewUrlForEntry,
      isLikelyVideoUrl,
      previewHoverDelayMs: runtimeConstants.previewHoverDelayMs,
    })
    assertRuntimeMethods('native bridge runtime', nativeBridgeRuntime, [
      'triggerNativeCardAction',
      'installCuratedCardPreview',
    ])
    triggerNativeCardActionImpl = (seriesId, actionType) =>
      nativeBridgeRuntime.triggerNativeCardAction(seriesId, actionType)
    installCuratedCardPreviewImpl = (thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage) => {
      nativeBridgeRuntime.installCuratedCardPreview(thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage)
    }

    const curatedInteractionsRuntime = runtimeCuratedInteractionsModule.createCuratedInteractionsRuntime({
      documentRef: window.document,
      alertRef: (message) => window.alert(message),
      confirmRef: (message) => window.confirm(message),
      triggerNativeCardAction: (seriesId, actionType) => triggerNativeCardActionImpl(seriesId, actionType),
      toggleCuratedFavorite,
      removeCuratedSeries,
      renderCuratedPanel,
      state,
      locationRef: window.location,
      persistSettings,
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
      preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale,
      isWatchlistPath,
      resetCuratedCachesForRefresh: () => resetCuratedCachesForRefreshImpl(),
      ensureCuratedDataLoad,
      debounceProcess,
    })
    assertRuntimeMethods('curated interactions runtime', curatedInteractionsRuntime, [
      'createCuratedCardActions',
      'bindCuratedInterfaceControls',
    ])
    createCuratedCardActionsImpl = (entry) => curatedInteractionsRuntime.createCuratedCardActions(entry)
    bindCuratedInterfaceControlsImpl = (context) => curatedInteractionsRuntime.bindCuratedInterfaceControls(context)

    const interfaceShellRuntime = runtimeInterfaceShellModule.createInterfaceShellRuntime({
      state,
      documentRef: window.document,
      windowRef: window,
      getWatchlistRoot,
      getWatchlistHeader,
      runtimeEvent,
      withMutedObserver,
      persistSettings,
      applyCardLayoutUi,
      createCuratedInterfaceControls: () => createCuratedInterfaceControlsImpl(),
      bindCuratedInterfaceControls: (context) => bindCuratedInterfaceControlsImpl(context),
      ensureCuratedDataLoad: (force = false) => ensureCuratedDataLoad(force),
      renderCuratedPanel: () => renderCuratedPanel(),
      debounceProcess,
      createEmptyWatchHistoryCache: () => createEmptyWatchHistoryCache(),
      storageSet: (key, value) => storageSet(key, value),
      ratingCacheKey: runtimeConstants.ratingCacheKey,
      watchHistoryCacheKey: runtimeConstants.watchHistoryCacheKey,
    })
    assertRuntimeMethods('interface shell runtime', interfaceShellRuntime, [
      'clearRootFrame',
      'setNativeVisibility',
      'applyTabUi',
      'resetCuratedCachesForRefresh',
      'ensureInterface',
    ])
    clearRootFrameImpl = () => interfaceShellRuntime.clearRootFrame()
    setNativeVisibilityImpl = (showNative) => interfaceShellRuntime.setNativeVisibility(showNative)
    applyTabUiImpl = () => interfaceShellRuntime.applyTabUi()
    resetCuratedCachesForRefreshImpl = async () => interfaceShellRuntime.resetCuratedCachesForRefresh()
    ensureInterfaceImpl = () => interfaceShellRuntime.ensureInterface()

    const debugRuntime = runtimeDebugModule.createDebugApiRuntime({
      state,
      getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId,
      getWatchHistorySeriesId: corePrimitives.getWatchHistorySeriesId,
      getWatchlistSeriesTitle: corePrimitives.getWatchlistSeriesTitle,
      getWatchHistorySeriesTitle: corePrimitives.getWatchHistorySeriesTitle,
      logRef: (message) => {
        // eslint-disable-next-line no-console
        console.log(message)
      },
    })
    assertRuntimeMethods('debug runtime', debugRuntime, ['listSeries', 'dumpSeriesApiData', 'printSeriesApiData'])
    listKnownSeries = () => debugRuntime.listSeries()
    dumpSeriesApiData = (query) => debugRuntime.dumpSeriesApiData(query)
    printSeriesApiData = (query) => debugRuntime.printSeriesApiData(query)
  } catch (error) {
    setBootstrapIssue('runtime-module-initialization-failed', {
      message: error?.message || 'unknown',
    })
    return
  }
  const bootstrapFinalizeRuntime = runtimeBootstrapFinalizeModule.createBootstrapFinalizeRuntime({
    windowRef: window,
    runtimeEvent,
    runtimeLifecycleModule,
    runtimeLifecycleOptions: {
      state,
      runtimeEvent,
      isWatchlistPath,
      ensureInterface: () => ensureInterfaceImpl(),
      applyTabUi: () => applyTabUiImpl(),
      ensureCuratedDataLoad,
      renderCuratedPanel,
      setNativeVisibility: (showNative) => setNativeVisibilityImpl(showNative),
      clearRootFrame: () => clearRootFrameImpl(),
      debounceProcess,
    },
    runtimeStateLoaderModule,
    runtimeStateLoaderOptions: {
      state,
      storageGet,
      runtimeEvent,
      normalizeStoredWatchHistoryCache,
      isWatchHistoryCacheValid,
      normalizeStoredWatchlistCache,
      isWatchlistCacheValid,
      normalizeEntriesFromApiRows,
      defaultSettings: DEFAULT_SETTINGS,
      validSortModes: VALID_SORT_MODES,
      defaultSortMode: DEFAULT_SORT_MODE,
      settingsKey: runtimeConstants.settingsKey,
      ratingCacheKey: runtimeConstants.ratingCacheKey,
      watchHistoryCacheKey: runtimeConstants.watchHistoryCacheKey,
      watchlistCacheKey: runtimeConstants.watchlistCacheKey,
    },
    listKnownSeries,
    dumpSeriesApiData,
    printSeriesApiData,
  })
  if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.processWatchlist === 'function') {
    processWatchlist = () => bootstrapFinalizeRuntime.processWatchlist()
  }
  if (!bootstrapFinalizeRuntime || typeof bootstrapFinalizeRuntime.init !== 'function') {
    setBootstrapIssue('missing-bootstrap-finalize-runtime')
    return
  }

  updateDiagnostics({
    ok: false,
    stage: 'init-started',
  })

  bootstrapFinalizeRuntime
    .init()
    .then(() => {
      updateDiagnostics({
        ok: true,
        stage: 'init-complete',
      })
    })
    .catch((error) => {
      runtimeEvent('init-error', {
        message: error?.message || 'unknown',
      })
      setBootstrapIssue('init-error', {
        message: error?.message || 'unknown',
      })
    })
})()
