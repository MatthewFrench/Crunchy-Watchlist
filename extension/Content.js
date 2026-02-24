;(() => {
  const moduleRegistry = window.__CW_WATCHLIST_CURATOR_MODULES__ || {}
  const runtimeContentBootstrapModule = moduleRegistry.runtimeContentBootstrap
  const runtimeContentCompositionModule = moduleRegistry.runtimeContentComposition
  if (
    !runtimeContentBootstrapModule ||
    typeof runtimeContentBootstrapModule.createContentBootstrapPrelude !== 'function'
  ) {
    // eslint-disable-next-line no-console
    console.error('[CW] missing-content-bootstrap-module')
    return
  }

  const bootstrapPrelude = runtimeContentBootstrapModule.createContentBootstrapPrelude({
    windowRef: window,
    consoleRef: console,
    browserRef: typeof browser !== 'undefined' ? browser : undefined,
    chromeRef: typeof chrome !== 'undefined' ? chrome : undefined,
  })
  if (!bootstrapPrelude || bootstrapPrelude.ok !== true) {
    return
  }
  const {
    updateDiagnostics,
    setBootstrapIssue,
    runtimeBootstrapGateModule,
    runtimeBootstrapModulesModule,
    runtimeBootstrapFinalizeModule,
    bootstrapModulesRuntime,
  } = bootstrapPrelude
  if (
    !runtimeContentCompositionModule ||
    typeof runtimeContentCompositionModule.createContentComposition !== 'function'
  ) {
    setBootstrapIssue('missing-content-composition-module')
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
    fetchWithResilience,
    getAccessToken,
    createAuthRefreshHandler,
    fetchAllWatchlistRows,
    normalizeStoredWatchlistCache,
    isWatchlistCacheValid,
    resetWatchlistCacheOnAccountMismatch,
    fetchRatingsBatch,
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
    ensureCuratedDataLoad,
    renderCuratedPanel,
    clearRootFrame,
    setNativeVisibility,
    applyTabUi,
    ensureInterface,
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
    persistSettings,
    printSeriesApiData
  let setWatchlistCacheRows = (accountId = '', rows = [], updatedAt = Date.now()) => {
    state.watchlistCache = createWatchlistCacheSnapshot(accountId, updatedAt, rows)
    return state.watchlistCache
  }

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
    scheduleSaveRatings = bootstrapHelpersRuntime.scheduleSaveRatings
    scheduleSaveWatchHistory = bootstrapHelpersRuntime.scheduleSaveWatchHistory
    scheduleSaveWatchlistCache = bootstrapHelpersRuntime.scheduleSaveWatchlistCache
    getPreferredAudioLanguage = bootstrapHelpersRuntime.getPreferredAudioLanguage
    preloadRatingsForSelectedAudioLocale = bootstrapHelpersRuntime.preloadRatingsForSelectedAudioLocale
    preloadWatchHistoryForSelectedAudioLocale = bootstrapHelpersRuntime.preloadWatchHistoryForSelectedAudioLocale
    toggleCuratedFavorite = bootstrapHelpersRuntime.toggleCuratedFavorite
    removeCuratedSeries = bootstrapHelpersRuntime.removeCuratedSeries
    isLikelyVideoUrl = bootstrapHelpersRuntime.isLikelyVideoUrl
    isEntryWatchReady = bootstrapHelpersRuntime.isEntryWatchReady
    withMutedObserver = bootstrapHelpersRuntime.withMutedObserver
    applyCardLayoutUi = bootstrapHelpersRuntime.applyCardLayoutUi
    persistSettings = bootstrapHelpersRuntime.persistSettings

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
    normalizeImageUrlCandidate = imageVariants.normalizeImageUrlCandidate
    extractCoverImagesFromApiImages = imageVariants.extractCoverImagesFromApiImages
    extractThumbnailImageFromApiImages = imageVariants.extractThumbnailImageFromApiImages

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

    const contentCompositionRuntime = runtimeContentCompositionModule.createContentComposition({
      windowRef: window,
      state,
      runtimeConstants,
      sortModeControlOptions: SORT_MODE_CONTROL_OPTIONS,
      assertRuntimeMethods,
      corePrimitives,
      modules: {
        entryNormalizerModule,
        sortMetricsModule,
        entrySortingModule,
        cardMetadataModule,
        controlsViewModule,
        cardViewModule,
        cardShellModule,
        runtimeRenderableModule,
        runtimeCuratedPanelModule,
        runtimeCuratedLoaderModule,
        runtimeNativeBridgeModule,
        runtimeCuratedInteractionsModule,
        runtimeInterfaceShellModule,
        runtimeDebugModule,
      },
      dependencies: {
        extractCoverImagesFromApiImages,
        extractThumbnailImageFromApiImages,
        normalizeImageUrlCandidate,
        getPreferredAudioLanguage,
        getCachedRating,
        getCachedWatchHistory,
        getCachedWatchHistoryProgress,
        isEntryWatchReady,
        isLocalizedRatingDataMissingForEntries,
        isLocalizedWatchHistoryDataMissingForEntries,
        preloadRatingsForSelectedAudioLocale,
        preloadWatchHistoryForSelectedAudioLocale,
        getAccessToken,
        resetWatchlistCacheOnAccountMismatch,
        fetchAllWatchlistRows,
        preloadRatingsForEntries,
        preloadWatchHistoryForEntries,
        setWatchlistCacheRows,
        fetchPreviewUrlForEntry,
        isLikelyVideoUrl,
        toggleCuratedFavorite,
        removeCuratedSeries,
        persistSettings,
        debounceProcess,
        isWatchlistPath,
        withMutedObserver,
        applyCardLayoutUi,
        createEmptyWatchHistoryCache: () => createEmptyWatchHistoryCache(),
        getWatchlistRoot: (documentRef) => runtimeBootstrapGateModule.getWatchlistRoot(documentRef),
        getWatchlistHeader: (documentRef) => runtimeBootstrapGateModule.getWatchlistHeader(documentRef),
        storageSet: (key, value) => storageSet(key, value),
        runtimeEvent,
        resolveApiHref,
      },
    })
    assertRuntimeMethods('content composition runtime', contentCompositionRuntime, [
      'normalizeEntriesFromApiRows',
      'ensureInterface',
      'listKnownSeries',
    ])
    ;({
      normalizeEntriesFromApiRows,
      ensureCuratedDataLoad,
      renderCuratedPanel,
      clearRootFrame,
      setNativeVisibility,
      applyTabUi,
      ensureInterface,
      listKnownSeries,
      dumpSeriesApiData,
      printSeriesApiData,
    } = contentCompositionRuntime)
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
      ensureInterface,
      applyTabUi,
      ensureCuratedDataLoad,
      renderCuratedPanel,
      setNativeVisibility,
      clearRootFrame,
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
    processWatchlist = bootstrapFinalizeRuntime.processWatchlist
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
