;(() => {
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic composition-root wiring requires permissive factory return typing.
  type AnyFn = (...args: unknown[]) => any

  type ContentRuntimeSetupResult =
    | ({
        ok: true
      } & Record<string, unknown>)
    | {
        ok: false
        message: string
      }

  type ContentRuntimeSetupOptions = Record<string, unknown>

  type TraceContractsRuntime = {
    corePrimitives: Record<string, unknown>
    apiContracts: Record<string, unknown>
  }

  type StorageRuntime = {
    storageSet: (key: string, value: unknown) => unknown
  }

  type RuntimeBindings = {
    runtimeEvent: AnyFn
    pushApiTrace: AnyFn
    normalizeEntriesFromApiRows: AnyFn
    fetchWithResilience: AnyFn
    getAccessToken: AnyFn
    createAuthRefreshHandler: AnyFn
    fetchAllWatchlistRows: AnyFn
    normalizeStoredWatchlistCache: AnyFn
    isWatchlistCacheValid: AnyFn
    resetWatchlistCacheOnAccountMismatch: AnyFn
    fetchRatingsBatch: AnyFn
    fetchRating: AnyFn
    preloadRatingsForEntries: AnyFn
    fetchPreviewUrlForEntry: AnyFn
    normalizeStoredWatchHistoryCache: AnyFn
    isWatchHistoryCacheValid: AnyFn
    getCachedWatchHistory: AnyFn
    getCachedWatchHistoryProgress: AnyFn
    preloadWatchHistoryForEntries: AnyFn
    isLocalizedWatchHistoryDataMissingForEntries: AnyFn
    getCachedRating: AnyFn
    isLocalizedRatingDataMissingForEntries: AnyFn
    detectPreferredAudioLanguage: AnyFn
    ensureCuratedDataLoad: AnyFn
    renderCuratedPanel: AnyFn
    clearRootFrame: AnyFn
    setNativeVisibility: AnyFn
    applyTabUi: AnyFn
    ensureInterface: AnyFn
    listKnownSeries: AnyFn
    dumpSeriesApiData: AnyFn
    resolveApiHref: AnyFn
    normalizeImageUrlCandidate: AnyFn
    extractCoverImagesFromApiImages: AnyFn
    extractThumbnailImageFromApiImages: AnyFn
    scheduleSaveRatings: AnyFn
    scheduleSaveWatchHistory: AnyFn
    scheduleSaveWatchlistCache: AnyFn
    getPreferredAudioLanguage: AnyFn
    preloadRatingsForSelectedAudioLocale: AnyFn
    preloadWatchHistoryForSelectedAudioLocale: AnyFn
    toggleCuratedFavorite: AnyFn
    removeCuratedSeries: AnyFn
    isLikelyVideoUrl: AnyFn
    isEntryWatchReady: AnyFn
    withMutedObserver: AnyFn
    applyCardLayoutUi: AnyFn
    persistSettings: AnyFn
    printSeriesApiData: AnyFn
    setWatchlistCacheRows: AnyFn
  }

  type ContentRuntimeSetupContext = {
    windowRef: Window
    state: Record<string, unknown>
    runtimeConstants: Record<string, unknown>
    assertRuntimeMethods: (ownerLabel: string, instance: unknown, methodNames: string[]) => void
    runtimeTraceModule: Record<string, unknown>
    runtimePreferredAudioModule: Record<string, unknown>
    runtimeBootstrapHelpersModule: Record<string, unknown>
    runtimeBootstrapGateModule: Record<string, unknown>
    runtimeBootstrapFinalizeModule: Record<string, unknown>
    storageModule: Record<string, unknown>
    apiContractsModule: Record<string, unknown>
    authClientModule: Record<string, unknown>
    watchlistClientModule: Record<string, unknown>
    watchlistRepositoryModule: Record<string, unknown>
    historyRepositoryModule: Record<string, unknown>
    ratingsClientModule: Record<string, unknown>
    ratingsRepositoryModule: Record<string, unknown>
    previewRepositoryModule: Record<string, unknown>
    corePrimitivesModule: Record<string, unknown>
    imageVariantsModule: Record<string, unknown>
    entryNormalizerModule: Record<string, unknown>
    sortMetricsModule: Record<string, unknown>
    entrySortingModule: Record<string, unknown>
    cardMetadataModule: Record<string, unknown>
    controlsViewModule: Record<string, unknown>
    cardViewModule: Record<string, unknown>
    cardShellModule: Record<string, unknown>
    runtimeRenderableModule: Record<string, unknown>
    runtimeCuratedPanelModule: Record<string, unknown>
    runtimeCuratedLoaderModule: Record<string, unknown>
    runtimeNativeBridgeModule: Record<string, unknown>
    runtimeCuratedInteractionsModule: Record<string, unknown>
    runtimeInterfaceShellModule: Record<string, unknown>
    runtimeDebugModule: Record<string, unknown>
    runtimeContentCompositionModule: Record<string, unknown>
    runtimeContentRuntimeSetupCompositionModule: Record<string, unknown>
    defaultSettings: Record<string, unknown>
    defaultSortMode: unknown
    validSortModes: unknown
    sortModeControlOptions: unknown[]
    storageLocalArea: unknown
    isWatchlistPath: (pathname: string) => boolean
    debounceProcess: AnyFn
    createEmptyWatchHistoryCache: AnyFn
    createWatchlistCacheSnapshot: AnyFn
  }

  type SetupCompositionRuntime = {
    initializeCompositionBinding: (
      context: Record<string, unknown>,
      bindings: Record<string, unknown>,
      corePrimitives: Record<string, unknown>,
      storageSet: (key: string, value: unknown) => unknown,
    ) => void
    buildContentRuntimeSetupSuccess: (
      context: Record<string, unknown>,
      bindings: Record<string, unknown>,
    ) => ContentRuntimeSetupResult
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing content runtime setup dependency: ${name}`)
    }
    return value as T
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {}
    }
    return value as Record<string, unknown>
  }

  function resolveContentRuntimeSetupContext(options: ContentRuntimeSetupOptions): ContentRuntimeSetupContext {
    return {
      windowRef: ((options.windowRef as unknown) ?? window) as Window,
      state: toRecord(options.state),
      runtimeConstants: toRecord(options.runtimeConstants),
      assertRuntimeMethods: requireFunction<(ownerLabel: string, instance: unknown, methodNames: string[]) => void>(
        'assertRuntimeMethods',
        options.assertRuntimeMethods,
      ),
      runtimeTraceModule: toRecord(options.runtimeTraceModule),
      runtimePreferredAudioModule: toRecord(options.runtimePreferredAudioModule),
      runtimeBootstrapHelpersModule: toRecord(options.runtimeBootstrapHelpersModule),
      runtimeBootstrapGateModule: toRecord(options.runtimeBootstrapGateModule),
      runtimeBootstrapFinalizeModule: toRecord(options.runtimeBootstrapFinalizeModule),
      storageModule: toRecord(options.storageModule),
      apiContractsModule: toRecord(options.apiContractsModule),
      authClientModule: toRecord(options.authClientModule),
      watchlistClientModule: toRecord(options.watchlistClientModule),
      watchlistRepositoryModule: toRecord(options.watchlistRepositoryModule),
      historyRepositoryModule: toRecord(options.historyRepositoryModule),
      ratingsClientModule: toRecord(options.ratingsClientModule),
      ratingsRepositoryModule: toRecord(options.ratingsRepositoryModule),
      previewRepositoryModule: toRecord(options.previewRepositoryModule),
      corePrimitivesModule: toRecord(options.corePrimitivesModule),
      imageVariantsModule: toRecord(options.imageVariantsModule),
      entryNormalizerModule: toRecord(options.entryNormalizerModule),
      sortMetricsModule: toRecord(options.sortMetricsModule),
      entrySortingModule: toRecord(options.entrySortingModule),
      cardMetadataModule: toRecord(options.cardMetadataModule),
      controlsViewModule: toRecord(options.controlsViewModule),
      cardViewModule: toRecord(options.cardViewModule),
      cardShellModule: toRecord(options.cardShellModule),
      runtimeRenderableModule: toRecord(options.runtimeRenderableModule),
      runtimeCuratedPanelModule: toRecord(options.runtimeCuratedPanelModule),
      runtimeCuratedLoaderModule: toRecord(options.runtimeCuratedLoaderModule),
      runtimeNativeBridgeModule: toRecord(options.runtimeNativeBridgeModule),
      runtimeCuratedInteractionsModule: toRecord(options.runtimeCuratedInteractionsModule),
      runtimeInterfaceShellModule: toRecord(options.runtimeInterfaceShellModule),
      runtimeDebugModule: toRecord(options.runtimeDebugModule),
      runtimeContentCompositionModule: toRecord(options.runtimeContentCompositionModule),
      runtimeContentRuntimeSetupCompositionModule: toRecord(
        options.runtimeContentRuntimeSetupCompositionModule ?? moduleRegistry.runtimeContentRuntimeSetupComposition,
      ),
      defaultSettings: toRecord(options.defaultSettings),
      defaultSortMode: options.defaultSortMode,
      validSortModes: options.validSortModes,
      sortModeControlOptions: Array.isArray(options.sortModeControlOptions) ? options.sortModeControlOptions : [],
      storageLocalArea: options.storageLocalArea,
      isWatchlistPath: requireFunction<(pathname: string) => boolean>('isWatchlistPath', options.isWatchlistPath),
      debounceProcess: requireFunction<AnyFn>('debounceProcess', options.debounceProcess),
      createEmptyWatchHistoryCache: requireFunction<AnyFn>(
        'createEmptyWatchHistoryCache',
        options.createEmptyWatchHistoryCache,
      ),
      createWatchlistCacheSnapshot: requireFunction<AnyFn>(
        'createWatchlistCacheSnapshot',
        options.createWatchlistCacheSnapshot,
      ),
    }
  }

  function createContentRuntimeBindings(
    state: Record<string, unknown>,
    createWatchlistCacheSnapshot: AnyFn,
  ): RuntimeBindings {
    const noop: AnyFn = () => undefined
    return {
      runtimeEvent: noop,
      pushApiTrace: noop,
      normalizeEntriesFromApiRows: noop,
      fetchWithResilience: noop,
      getAccessToken: noop,
      createAuthRefreshHandler: noop,
      fetchAllWatchlistRows: noop,
      normalizeStoredWatchlistCache: noop,
      isWatchlistCacheValid: noop,
      resetWatchlistCacheOnAccountMismatch: noop,
      fetchRatingsBatch: noop,
      fetchRating: noop,
      preloadRatingsForEntries: noop,
      fetchPreviewUrlForEntry: noop,
      normalizeStoredWatchHistoryCache: noop,
      isWatchHistoryCacheValid: noop,
      getCachedWatchHistory: noop,
      getCachedWatchHistoryProgress: noop,
      preloadWatchHistoryForEntries: noop,
      isLocalizedWatchHistoryDataMissingForEntries: noop,
      getCachedRating: noop,
      isLocalizedRatingDataMissingForEntries: noop,
      detectPreferredAudioLanguage: noop,
      ensureCuratedDataLoad: noop,
      renderCuratedPanel: noop,
      clearRootFrame: noop,
      setNativeVisibility: noop,
      applyTabUi: noop,
      ensureInterface: noop,
      listKnownSeries: noop,
      dumpSeriesApiData: noop,
      resolveApiHref: noop,
      normalizeImageUrlCandidate: noop,
      extractCoverImagesFromApiImages: noop,
      extractThumbnailImageFromApiImages: noop,
      scheduleSaveRatings: noop,
      scheduleSaveWatchHistory: noop,
      scheduleSaveWatchlistCache: noop,
      getPreferredAudioLanguage: noop,
      preloadRatingsForSelectedAudioLocale: noop,
      preloadWatchHistoryForSelectedAudioLocale: noop,
      toggleCuratedFavorite: noop,
      removeCuratedSeries: noop,
      isLikelyVideoUrl: noop,
      isEntryWatchReady: noop,
      withMutedObserver: noop,
      applyCardLayoutUi: noop,
      persistSettings: noop,
      printSeriesApiData: noop,
      setWatchlistCacheRows: ((accountId = '', profileId = '', rows: unknown[] = [], updatedAt = Date.now()) => {
        state.watchlistCache = createWatchlistCacheSnapshot(accountId, profileId, updatedAt, rows)
        return state.watchlistCache
      }) as AnyFn,
    }
  }

  function initializeTraceAndContracts(
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
  ): TraceContractsRuntime {
    const runtimeTrace = requireFunction<AnyFn>(
      'createRuntimeTrace',
      context.runtimeTraceModule.createRuntimeTrace,
    )({
      windowRef: context.windowRef,
      state: context.state,
      apiTraceLimitPerEndpoint: context.runtimeConstants.apiTraceLimitPerEndpoint,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('runtime trace', runtimeTrace, ['runtimeEvent', 'pushApiTrace'])
    bindings.runtimeEvent = runtimeTrace.runtimeEvent as AnyFn
    bindings.pushApiTrace = runtimeTrace.pushApiTrace as AnyFn

    const corePrimitives = requireFunction<AnyFn>(
      'createCorePrimitives',
      context.corePrimitivesModule.createCorePrimitives,
    )({
      extractCoverImagesFromApiImages: (images: unknown) => bindings.extractCoverImagesFromApiImages(images),
    }) as Record<string, unknown>
    context.assertRuntimeMethods('core primitives', corePrimitives, [
      'sanitizeRating',
      'parseCmsObjectRecord',
      'deriveDisplayStatusBase',
    ])

    const apiContracts = requireFunction<AnyFn>(
      'createApiContracts',
      context.apiContractsModule.createApiContracts,
    )({
      windowRef: context.windowRef,
      navigatorRef: context.windowRef.navigator,
      runtimeEvent: bindings.runtimeEvent,
      parseDateMs: (value: unknown) => (corePrimitives.parseDateMs as AnyFn)(value),
      getWatchlistSeriesId: (entry: unknown) => (corePrimitives.getWatchlistSeriesId as AnyFn)(entry),
      getWatchHistorySeriesId: (entry: unknown) => (corePrimitives.getWatchHistorySeriesId as AnyFn)(entry),
      fetchBackoffBaseMs: context.runtimeConstants.fetchBackoffBaseMs,
      fetchBackoffJitterMs: context.runtimeConstants.fetchBackoffJitterMs,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('api contracts', apiContracts, [
      'shouldRetryStatus',
      'requirePayloadDataArray',
      'resolveApiHref',
    ])

    bindings.resolveApiHref = apiContracts.resolveApiHref as AnyFn
    return { corePrimitives, apiContracts }
  }

  function bindBootstrapHelpersRuntime(
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
    traceContractsRuntime: TraceContractsRuntime,
    storageSet: (key: string, value: unknown) => unknown,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives
    const bootstrapHelpersRuntime = requireFunction<AnyFn>(
      'createBootstrapHelpersRuntime',
      context.runtimeBootstrapHelpersModule.createBootstrapHelpersRuntime,
    )({
      state: context.state,
      windowRef: context.windowRef,
      runtimeEvent: bindings.runtimeEvent,
      storageSet: (key: string, value: unknown) => storageSet(key, value),
      settingsKey: context.runtimeConstants.settingsKey,
      ratingCacheKey: context.runtimeConstants.ratingCacheKey,
      watchHistoryCacheKey: context.runtimeConstants.watchHistoryCacheKey,
      watchlistCacheKey: context.runtimeConstants.watchlistCacheKey,
      preferredAudioCacheTtlMs: context.runtimeConstants.preferredAudioCacheTtlMs,
      normalizeAudioLocale: (value: unknown) => (corePrimitives.normalizeAudioLocale as AnyFn)(value),
      detectPreferredAudioLanguage: () => bindings.detectPreferredAudioLanguage(),
      isLocalizedRatingDataMissingForEntries: (entries: unknown, audioLocale: unknown) =>
        bindings.isLocalizedRatingDataMissingForEntries(entries, audioLocale),
      isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown, audioLocale: unknown) =>
        bindings.isLocalizedWatchHistoryDataMissingForEntries(entries, audioLocale),
      getAccessToken: (forceRefresh = false) => bindings.getAccessToken(forceRefresh),
      preloadRatingsForEntries: (entries: unknown, tokenEntry: unknown, preferredAudioLanguage: unknown) =>
        bindings.preloadRatingsForEntries(entries, tokenEntry, preferredAudioLanguage),
      preloadWatchHistoryForEntries: (
        entries: unknown,
        tokenEntry: unknown,
        force: unknown,
        preferredAudioLanguage: unknown,
      ) => bindings.preloadWatchHistoryForEntries(entries, tokenEntry, force, preferredAudioLanguage),
    }) as Record<string, unknown>
    context.assertRuntimeMethods('bootstrap helpers runtime', bootstrapHelpersRuntime, [
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
    bindings.scheduleSaveRatings = bootstrapHelpersRuntime.scheduleSaveRatings as AnyFn
    bindings.scheduleSaveWatchHistory = bootstrapHelpersRuntime.scheduleSaveWatchHistory as AnyFn
    bindings.scheduleSaveWatchlistCache = bootstrapHelpersRuntime.scheduleSaveWatchlistCache as AnyFn
    bindings.getPreferredAudioLanguage = bootstrapHelpersRuntime.getPreferredAudioLanguage as AnyFn
    bindings.preloadRatingsForSelectedAudioLocale =
      bootstrapHelpersRuntime.preloadRatingsForSelectedAudioLocale as AnyFn
    bindings.preloadWatchHistoryForSelectedAudioLocale =
      bootstrapHelpersRuntime.preloadWatchHistoryForSelectedAudioLocale as AnyFn
    bindings.toggleCuratedFavorite = bootstrapHelpersRuntime.toggleCuratedFavorite as AnyFn
    bindings.removeCuratedSeries = bootstrapHelpersRuntime.removeCuratedSeries as AnyFn
    bindings.isLikelyVideoUrl = bootstrapHelpersRuntime.isLikelyVideoUrl as AnyFn
    bindings.isEntryWatchReady = bootstrapHelpersRuntime.isEntryWatchReady as AnyFn
    bindings.withMutedObserver = bootstrapHelpersRuntime.withMutedObserver as AnyFn
    bindings.applyCardLayoutUi = bootstrapHelpersRuntime.applyCardLayoutUi as AnyFn
    bindings.persistSettings = bootstrapHelpersRuntime.persistSettings as AnyFn
  }

  function initializePreferredAudioAndStorage(
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
    traceContractsRuntime: TraceContractsRuntime,
  ): StorageRuntime {
    const corePrimitives = traceContractsRuntime.corePrimitives
    const safeJsonParse = (value: unknown, fallback: unknown) =>
      requireFunction<AnyFn>('safeJsonParse', context.runtimeBootstrapFinalizeModule.safeJsonParse)(value, fallback)
    const preferredAudioDetector = requireFunction<AnyFn>(
      'createPreferredAudioDetector',
      context.runtimePreferredAudioModule.createPreferredAudioDetector,
    )({
      normalizeAudioLocale: (value: unknown) => (corePrimitives.normalizeAudioLocale as AnyFn)(value),
      parseJson: safeJsonParse,
      localStorageRef: context.windowRef.localStorage,
      navigatorRef: context.windowRef.navigator,
      documentRef: context.windowRef.document,
      storageScanLimit: context.runtimeConstants.preferredAudioStorageScanLimit,
      valueScanLimit: context.runtimeConstants.preferredAudioValueScanLimit,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('preferred audio detector', preferredAudioDetector, ['detectPreferredAudioLanguage'])
    bindings.detectPreferredAudioLanguage = () =>
      (preferredAudioDetector.detectPreferredAudioLanguage as AnyFn)() as string

    const storageAdapter = requireFunction<AnyFn>(
      'createStorageAdapter',
      context.storageModule.createStorageAdapter,
    )({
      storageArea: context.storageLocalArea,
      parseJson: safeJsonParse,
      localStorageRef: context.windowRef.localStorage,
      timeoutMs: 1500,
    })
    const storageAccessors = requireFunction<AnyFn>(
      'createStorageAccessors',
      context.runtimeBootstrapFinalizeModule.createStorageAccessors,
    )({
      storageAdapter,
    }) as Record<string, unknown>
    const storageSet = (key: string, value: unknown) => (storageAccessors.storageSet as AnyFn)(key, value)

    bindBootstrapHelpersRuntime(context, bindings, traceContractsRuntime, storageSet)
    return { storageSet }
  }

  function initializeAuthAndImageRuntime(
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
    traceContractsRuntime: TraceContractsRuntime,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives
    const apiContracts = traceContractsRuntime.apiContracts
    const authClient = requireFunction<AnyFn>(
      'createAuthClient',
      context.authClientModule.createAuthClient,
    )({
      state: context.state,
      runtimeEvent: bindings.runtimeEvent,
      pushApiTrace: bindings.pushApiTrace,
      resolveApiHref: bindings.resolveApiHref,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt as AnyFn,
      shouldRetryStatus: apiContracts.shouldRetryStatus as AnyFn,
      computeFetchRetryDelayMs: apiContracts.computeFetchRetryDelayMs as AnyFn,
      sleep: apiContracts.sleep as AnyFn,
      fetchTimeoutMs: context.runtimeConstants.fetchTimeoutMs,
      fetchMaxAttempts: context.runtimeConstants.fetchMaxAttempts,
      authTokenSkewMs: context.runtimeConstants.authTokenSkewMs,
      authClientBasic: context.runtimeConstants.authClientBasic,
      authDeviceKey: context.runtimeConstants.authDeviceKey,
      localStorageRef: context.windowRef.localStorage,
      navigatorRef: context.windowRef.navigator,
      cryptoRef: context.windowRef.crypto,
      fetchImpl: context.windowRef.fetch.bind(context.windowRef),
    }) as Record<string, unknown>
    context.assertRuntimeMethods('auth client', authClient, [
      'fetchWithResilience',
      'getAccessToken',
      'createAuthRefreshHandler',
    ])
    bindings.fetchWithResilience = authClient.fetchWithResilience as AnyFn
    bindings.getAccessToken = authClient.getAccessToken as AnyFn
    bindings.createAuthRefreshHandler = authClient.createAuthRefreshHandler as AnyFn

    const imageVariants = requireFunction<AnyFn>(
      'createImageVariants',
      context.imageVariantsModule.createImageVariants,
    )({
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt as AnyFn,
      resolveApiHref: bindings.resolveApiHref,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('image variants', imageVariants, [
      'normalizeImageUrlCandidate',
      'extractCoverImagesFromApiImages',
      'extractThumbnailImageFromApiImages',
    ])
    bindings.normalizeImageUrlCandidate = imageVariants.normalizeImageUrlCandidate as AnyFn
    bindings.extractCoverImagesFromApiImages = imageVariants.extractCoverImagesFromApiImages as AnyFn
    bindings.extractThumbnailImageFromApiImages = imageVariants.extractThumbnailImageFromApiImages as AnyFn
  }

  function initializeRatingsRuntime(
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
    traceContractsRuntime: TraceContractsRuntime,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives
    const apiContracts = traceContractsRuntime.apiContracts
    const ratingsClient = requireFunction<AnyFn>(
      'createRatingsClient',
      context.ratingsClientModule.createRatingsClient,
    )({
      fetchWithResilience: bindings.fetchWithResilience,
      getAccessToken: bindings.getAccessToken,
      createAuthRefreshHandler: bindings.createAuthRefreshHandler,
      resolveApiHref: bindings.resolveApiHref,
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale as AnyFn,
      getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
      getLocale: apiContracts.getLocale as AnyFn,
      requirePayloadDataArray: apiContracts.requirePayloadDataArray as AnyFn,
      auditCmsObjectContract: apiContracts.auditCmsObjectContract as AnyFn,
      parseCmsObjectRecord: corePrimitives.parseCmsObjectRecord as AnyFn,
      parseRatingPayload: corePrimitives.parseRatingPayload as AnyFn,
      sanitizeRating: corePrimitives.sanitizeRating as AnyFn,
      sanitizeVotes: corePrimitives.sanitizeVotes as AnyFn,
      pushApiTrace: bindings.pushApiTrace,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('ratings client', ratingsClient, ['fetchRatingsBatch', 'fetchRating'])
    bindings.fetchRatingsBatch = ratingsClient.fetchRatingsBatch as AnyFn
    bindings.fetchRating = ratingsClient.fetchRating as AnyFn

    const ratingsRepository = requireFunction<AnyFn>(
      'createRatingsRepository',
      context.ratingsRepositoryModule.createRatingsRepository,
    )({
      state: context.state,
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale as AnyFn,
      normalizeAudioLocales: corePrimitives.normalizeAudioLocales as AnyFn,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt as AnyFn,
      normalizeTagList: corePrimitives.normalizeTagList as AnyFn,
      normalizeImageUrlCandidate: bindings.normalizeImageUrlCandidate,
      getAudioLocaleCountFromMap: corePrimitives.getAudioLocaleCountFromMap as AnyFn,
      mergeAudioLocaleCountMap: corePrimitives.mergeAudioLocaleCountMap as AnyFn,
      getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
      chunkArray: corePrimitives.chunkArray as AnyFn,
      fetchRatingsBatch: bindings.fetchRatingsBatch,
      fetchRating: bindings.fetchRating,
      scheduleSaveRatings: bindings.scheduleSaveRatings,
      runtimeEvent: bindings.runtimeEvent,
      ratingBatchSize: context.runtimeConstants.ratingBatchSize,
      ratingBatchParallelChunks: context.runtimeConstants.ratingBatchParallelChunks,
      ratingCacheTtlMs: context.runtimeConstants.ratingCacheTtlMs,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('ratings repository', ratingsRepository, [
      'getSeriesRating',
      'preloadRatingsForEntries',
      'getCachedRating',
      'isLocalizedRatingDataMissingForEntries',
    ])
    bindings.preloadRatingsForEntries = ratingsRepository.preloadRatingsForEntries as AnyFn
    bindings.getCachedRating = ratingsRepository.getCachedRating as AnyFn
    bindings.isLocalizedRatingDataMissingForEntries = ratingsRepository.isLocalizedRatingDataMissingForEntries as AnyFn
  }

  function initializeAuthImageAndRatings(
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
    traceContractsRuntime: TraceContractsRuntime,
  ): void {
    initializeAuthAndImageRuntime(context, bindings, traceContractsRuntime)
    initializeRatingsRuntime(context, bindings, traceContractsRuntime)
  }

  function initializeWatchlistRuntime(
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
    traceContractsRuntime: TraceContractsRuntime,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives
    const apiContracts = traceContractsRuntime.apiContracts
    const watchlistClient = requireFunction<AnyFn>(
      'createWatchlistClient',
      context.watchlistClientModule.createWatchlistClient,
    )({
      fetchWithResilience: bindings.fetchWithResilience,
      createAuthRefreshHandler: bindings.createAuthRefreshHandler,
      resolveApiHref: bindings.resolveApiHref,
      requirePayloadDataArray: apiContracts.requirePayloadDataArray as AnyFn,
      auditWatchlistRowsContract: apiContracts.auditWatchlistRowsContract as AnyFn,
      getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
      getLocale: apiContracts.getLocale as AnyFn,
      getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId as AnyFn,
      pushApiTrace: bindings.pushApiTrace,
      runtimeEvent: bindings.runtimeEvent,
      watchlistPageSize: context.runtimeConstants.watchlistPageSize,
      watchlistMaxPages: context.runtimeConstants.watchlistMaxPages,
      watchlistParallelRequests: context.runtimeConstants.watchlistParallelRequests,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('watchlist client', watchlistClient, ['fetchAllWatchlistRows'])
    bindings.fetchAllWatchlistRows = watchlistClient.fetchAllWatchlistRows as AnyFn

    const watchlistRepository = requireFunction<AnyFn>(
      'createWatchlistRepository',
      context.watchlistRepositoryModule.createWatchlistRepository,
    )({
      state: context.state,
      createWatchlistCacheSnapshot: context.createWatchlistCacheSnapshot,
      scheduleSaveWatchlistCache: bindings.scheduleSaveWatchlistCache,
      watchlistCacheTtlMs: context.runtimeConstants.watchlistCacheTtlMs,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('watchlist repository', watchlistRepository, [
      'normalizeStoredWatchlistCache',
      'isWatchlistCacheValid',
      'resetWatchlistCacheOnAccountMismatch',
      'setWatchlistCacheRows',
    ])
    bindings.normalizeStoredWatchlistCache = watchlistRepository.normalizeStoredWatchlistCache as AnyFn
    bindings.isWatchlistCacheValid = watchlistRepository.isWatchlistCacheValid as AnyFn
    bindings.resetWatchlistCacheOnAccountMismatch = watchlistRepository.resetWatchlistCacheOnAccountMismatch as AnyFn
    bindings.setWatchlistCacheRows = watchlistRepository.setWatchlistCacheRows as AnyFn
  }

  function initializeHistoryAndPreviewRuntime(
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
    traceContractsRuntime: TraceContractsRuntime,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives
    const apiContracts = traceContractsRuntime.apiContracts
    const historyRepository = requireFunction<AnyFn>(
      'createHistoryRepository',
      context.historyRepositoryModule.createHistoryRepository,
    )({
      state: context.state,
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale as AnyFn,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt as AnyFn,
      parseDateMs: corePrimitives.parseDateMs as AnyFn,
      pickFirstPositiveInt: corePrimitives.pickFirstPositiveInt as AnyFn,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata:
        corePrimitives.deriveCanonicalEpisodeKeyFromEpisodeMetadata as AnyFn,
      getAbsoluteEpisodeNumberFromEpisodeMetadata: corePrimitives.getAbsoluteEpisodeNumberFromEpisodeMetadata as AnyFn,
      getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
      getLocale: apiContracts.getLocale as AnyFn,
      resolveApiHref: bindings.resolveApiHref,
      fetchWithResilience: bindings.fetchWithResilience,
      createAuthRefreshHandler: bindings.createAuthRefreshHandler,
      requirePayloadDataArray: apiContracts.requirePayloadDataArray as AnyFn,
      auditWatchHistoryRowsContract: apiContracts.auditWatchHistoryRowsContract as AnyFn,
      createEmptyWatchHistoryCache: context.createEmptyWatchHistoryCache,
      scheduleSaveWatchHistory: bindings.scheduleSaveWatchHistory,
      pushApiTrace: bindings.pushApiTrace,
      runtimeEvent: bindings.runtimeEvent,
      watchHistoryCacheVersion: context.runtimeConstants.watchHistoryCacheVersion,
      watchHistoryCacheTtlMs: context.runtimeConstants.watchHistoryCacheTtlMs,
      watchHistoryPageSize: context.runtimeConstants.watchHistoryPageSize,
      watchHistoryMaxPages: context.runtimeConstants.watchHistoryMaxPages,
      watchHistoryNoMatchPageLimit: context.runtimeConstants.watchHistoryNoMatchPageLimit,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('history repository', historyRepository, [
      'normalizeStoredWatchHistoryCache',
      'isWatchHistoryCacheValid',
      'getCachedWatchHistory',
      'getCachedWatchHistoryProgress',
      'preloadWatchHistoryForEntries',
      'isLocalizedWatchHistoryDataMissingForEntries',
    ])
    bindings.normalizeStoredWatchHistoryCache = historyRepository.normalizeStoredWatchHistoryCache as AnyFn
    bindings.isWatchHistoryCacheValid = historyRepository.isWatchHistoryCacheValid as AnyFn
    bindings.getCachedWatchHistory = historyRepository.getCachedWatchHistory as AnyFn
    bindings.getCachedWatchHistoryProgress = historyRepository.getCachedWatchHistoryProgress as AnyFn
    bindings.preloadWatchHistoryForEntries = historyRepository.preloadWatchHistoryForEntries as AnyFn
    bindings.isLocalizedWatchHistoryDataMissingForEntries =
      historyRepository.isLocalizedWatchHistoryDataMissingForEntries as AnyFn

    const previewRepository = requireFunction<AnyFn>(
      'createPreviewRepository',
      context.previewRepositoryModule.createPreviewRepository,
    )({
      state: context.state,
      resolveApiHref: bindings.resolveApiHref,
      getAccessToken: bindings.getAccessToken,
      fetchWithResilience: bindings.fetchWithResilience,
      createAuthRefreshHandler: bindings.createAuthRefreshHandler,
      pushApiTrace: bindings.pushApiTrace,
      runtimeEvent: bindings.runtimeEvent,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('preview repository', previewRepository, ['fetchPreviewUrlForEntry'])
    bindings.fetchPreviewUrlForEntry = previewRepository.fetchPreviewUrlForEntry as AnyFn
  }

  function initializeWatchlistHistoryAndPreview(
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
    traceContractsRuntime: TraceContractsRuntime,
  ): void {
    initializeWatchlistRuntime(context, bindings, traceContractsRuntime)
    initializeHistoryAndPreviewRuntime(context, bindings, traceContractsRuntime)
  }

  function createSetupCompositionRuntime(context: ContentRuntimeSetupContext): SetupCompositionRuntime {
    const setupCompositionRuntime = requireFunction<AnyFn>(
      'createContentRuntimeSetupCompositionRuntime',
      context.runtimeContentRuntimeSetupCompositionModule.createContentRuntimeSetupCompositionRuntime,
    )({
      requireFunction,
    }) as Record<string, unknown>
    context.assertRuntimeMethods('content runtime setup composition runtime', setupCompositionRuntime, [
      'initializeCompositionBinding',
      'buildContentRuntimeSetupSuccess',
    ])
    return setupCompositionRuntime as unknown as SetupCompositionRuntime
  }

  function createContentRuntimeSetup(options: ContentRuntimeSetupOptions = {}): ContentRuntimeSetupResult {
    const context = resolveContentRuntimeSetupContext(options)
    const bindings = createContentRuntimeBindings(context.state, context.createWatchlistCacheSnapshot)

    try {
      const setupCompositionRuntime = createSetupCompositionRuntime(context)
      const traceContractsRuntime = initializeTraceAndContracts(context, bindings)
      const storageRuntime = initializePreferredAudioAndStorage(context, bindings, traceContractsRuntime)
      initializeAuthImageAndRatings(context, bindings, traceContractsRuntime)
      initializeWatchlistHistoryAndPreview(context, bindings, traceContractsRuntime)
      setupCompositionRuntime.initializeCompositionBinding(
        context as unknown as Record<string, unknown>,
        bindings as unknown as Record<string, unknown>,
        traceContractsRuntime.corePrimitives as Record<string, unknown>,
        storageRuntime.storageSet,
      )
      return setupCompositionRuntime.buildContentRuntimeSetupSuccess(
        context as unknown as Record<string, unknown>,
        bindings as unknown as Record<string, unknown>,
      ) as ContentRuntimeSetupResult
    } catch (error) {
      return {
        ok: false,
        message: (error as { message?: unknown })?.message
          ? String((error as { message?: unknown }).message)
          : 'unknown',
      }
    }
  }

  moduleRegistry.runtimeContentRuntimeSetup = {
    createContentRuntimeSetup,
  }
})()
