(() => {
  // biome-ignore lint/suspicious/noExplicitAny: Composition-root runtime wiring relies on dynamic owner injection.
  type AnyFn = (...args: unknown[]) => any;
  type LooseRecord = Record<string, unknown>;
  type RequireFunction = <T>(name: string, value: unknown) => T;

  type TraceContractsRuntime = {
    corePrimitives: LooseRecord;
    apiContracts: LooseRecord;
  };

  type StorageRuntime = {
    storageSet: (key: string, value: unknown) => unknown;
  };

  type DataInitializationRuntime = {
    initializeTraceAndContracts: (context: LooseRecord, bindings: LooseRecord) => TraceContractsRuntime;
    initializePreferredAudioAndStorage: (
      context: LooseRecord,
      bindings: LooseRecord,
      traceContractsRuntime: TraceContractsRuntime,
    ) => StorageRuntime;
    initializeAuthImageAndRatings: (
      context: LooseRecord,
      bindings: LooseRecord,
      traceContractsRuntime: TraceContractsRuntime,
    ) => void;
    initializeWatchlistHistoryAndPreview: (
      context: LooseRecord,
      bindings: LooseRecord,
      traceContractsRuntime: TraceContractsRuntime,
    ) => void;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord;
    };
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing content runtime setup data initialization dependency: ${name}`);
    }
    return value as T;
  }

  function toRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return value as LooseRecord;
  }

  function bindBootstrapHelpersRuntimeInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    traceContractsRuntime: TraceContractsRuntime,
    storageSet: (key: string, value: unknown) => unknown,
    requireFn: RequireFunction,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives;
    const runtimeBootstrapHelpersModule = toRecord(context.runtimeBootstrapHelpersModule);
    const runtimeConstants = toRecord(context.runtimeConstants);
    const bootstrapHelpersRuntime = requireFn<AnyFn>(
      'createBootstrapHelpersRuntime',
      runtimeBootstrapHelpersModule.createBootstrapHelpersRuntime,
    )({
      state: context.state,
      windowRef: context.windowRef,
      runtimeEvent: bindings.runtimeEvent,
      storageSet: (key: string, value: unknown) => storageSet(key, value),
      settingsKey: runtimeConstants.settingsKey,
      ratingCacheKey: runtimeConstants.ratingCacheKey,
      watchHistoryCacheKey: runtimeConstants.watchHistoryCacheKey,
      watchlistCacheKey: runtimeConstants.watchlistCacheKey,
      preferredAudioCacheTtlMs: runtimeConstants.preferredAudioCacheTtlMs,
      normalizeAudioLocale: (value: unknown) => (corePrimitives.normalizeAudioLocale as AnyFn)(value),
      detectPreferredAudioLanguage: () => (bindings.detectPreferredAudioLanguage as AnyFn)(),
      isLocalizedRatingDataMissingForEntries: (entries: unknown, audioLocale: unknown) =>
        (bindings.isLocalizedRatingDataMissingForEntries as AnyFn)(entries, audioLocale),
      isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown, audioLocale: unknown) =>
        (bindings.isLocalizedWatchHistoryDataMissingForEntries as AnyFn)(entries, audioLocale),
      getAccessToken: (forceRefresh = false) => (bindings.getAccessToken as AnyFn)(forceRefresh),
      preloadRatingsForEntries: (entries: unknown, tokenEntry: unknown, preferredAudioLanguage: unknown) =>
        (bindings.preloadRatingsForEntries as AnyFn)(entries, tokenEntry, preferredAudioLanguage),
      preloadWatchHistoryForEntries: (
        entries: unknown,
        tokenEntry: unknown,
        force: unknown,
        preferredAudioLanguage: unknown,
      ) => (bindings.preloadWatchHistoryForEntries as AnyFn)(entries, tokenEntry, force, preferredAudioLanguage),
    }) as LooseRecord;

    (context.assertRuntimeMethods as AnyFn)('bootstrap helpers runtime', bootstrapHelpersRuntime, [
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
    ]);

    bindings.scheduleSaveRatings = bootstrapHelpersRuntime.scheduleSaveRatings;
    bindings.scheduleSaveWatchHistory = bootstrapHelpersRuntime.scheduleSaveWatchHistory;
    bindings.scheduleSaveWatchlistCache = bootstrapHelpersRuntime.scheduleSaveWatchlistCache;
    bindings.getPreferredAudioLanguage = bootstrapHelpersRuntime.getPreferredAudioLanguage;
    bindings.preloadRatingsForSelectedAudioLocale = bootstrapHelpersRuntime.preloadRatingsForSelectedAudioLocale;
    bindings.preloadWatchHistoryForSelectedAudioLocale =
      bootstrapHelpersRuntime.preloadWatchHistoryForSelectedAudioLocale;
    bindings.toggleCuratedFavorite = bootstrapHelpersRuntime.toggleCuratedFavorite;
    bindings.removeCuratedSeries = bootstrapHelpersRuntime.removeCuratedSeries;
    bindings.isLikelyVideoUrl = bootstrapHelpersRuntime.isLikelyVideoUrl;
    bindings.isEntryWatchReady = bootstrapHelpersRuntime.isEntryWatchReady;
    bindings.withMutedObserver = bootstrapHelpersRuntime.withMutedObserver;
    bindings.applyCardLayoutUi = bootstrapHelpersRuntime.applyCardLayoutUi;
    bindings.persistSettings = bootstrapHelpersRuntime.persistSettings;
  }

  function initializeTraceAndContractsInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    requireFn: RequireFunction,
  ): TraceContractsRuntime {
    const runtimeTraceModule = toRecord(context.runtimeTraceModule);
    const runtimeConstants = toRecord(context.runtimeConstants);
    const corePrimitivesModule = toRecord(context.corePrimitivesModule);
    const apiContractsModule = toRecord(context.apiContractsModule);
    const windowRef = context.windowRef as Window;

    const runtimeTrace = requireFn<AnyFn>(
      'createRuntimeTrace',
      runtimeTraceModule.createRuntimeTrace,
    )({
      windowRef,
      state: context.state,
      apiTraceLimitPerEndpoint: runtimeConstants.apiTraceLimitPerEndpoint,
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('runtime trace', runtimeTrace, ['runtimeEvent', 'pushApiTrace']);
    bindings.runtimeEvent = runtimeTrace.runtimeEvent;
    bindings.pushApiTrace = runtimeTrace.pushApiTrace;

    const corePrimitives = requireFn<AnyFn>(
      'createCorePrimitives',
      corePrimitivesModule.createCorePrimitives,
    )({
      extractCoverImagesFromApiImages: (images: unknown) => (bindings.extractCoverImagesFromApiImages as AnyFn)(images),
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('core primitives', corePrimitives, [
      'sanitizeRating',
      'parseCmsObjectRecord',
      'deriveDisplayStatusBase',
    ]);

    const apiContracts = requireFn<AnyFn>(
      'createApiContracts',
      apiContractsModule.createApiContracts,
    )({
      windowRef,
      navigatorRef: windowRef.navigator,
      runtimeEvent: bindings.runtimeEvent,
      parseDateMs: (value: unknown) => (corePrimitives.parseDateMs as AnyFn)(value),
      getWatchlistSeriesId: (entry: unknown) => (corePrimitives.getWatchlistSeriesId as AnyFn)(entry),
      getWatchHistorySeriesId: (entry: unknown) => (corePrimitives.getWatchHistorySeriesId as AnyFn)(entry),
      fetchBackoffBaseMs: runtimeConstants.fetchBackoffBaseMs,
      fetchBackoffJitterMs: runtimeConstants.fetchBackoffJitterMs,
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('api contracts', apiContracts, [
      'shouldRetryStatus',
      'requirePayloadDataArray',
      'resolveApiHref',
    ]);

    bindings.resolveApiHref = apiContracts.resolveApiHref;
    return { corePrimitives, apiContracts };
  }

  function initializePreferredAudioAndStorageInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    traceContractsRuntime: TraceContractsRuntime,
    requireFn: RequireFunction,
  ): StorageRuntime {
    const corePrimitives = traceContractsRuntime.corePrimitives;
    const runtimeConstants = toRecord(context.runtimeConstants);
    const runtimePreferredAudioModule = toRecord(context.runtimePreferredAudioModule);
    const runtimeBootstrapFinalizeModule = toRecord(context.runtimeBootstrapFinalizeModule);
    const storageModule = toRecord(context.storageModule);
    const windowRef = context.windowRef as Window;

    const safeJsonParse = (value: unknown, fallback: unknown) =>
      requireFn<AnyFn>('safeJsonParse', runtimeBootstrapFinalizeModule.safeJsonParse)(value, fallback);

    const preferredAudioDetector = requireFn<AnyFn>(
      'createPreferredAudioDetector',
      runtimePreferredAudioModule.createPreferredAudioDetector,
    )({
      normalizeAudioLocale: (value: unknown) => (corePrimitives.normalizeAudioLocale as AnyFn)(value),
      parseJson: safeJsonParse,
      localStorageRef: windowRef.localStorage,
      navigatorRef: windowRef.navigator,
      documentRef: windowRef.document,
      storageScanLimit: runtimeConstants.preferredAudioStorageScanLimit,
      valueScanLimit: runtimeConstants.preferredAudioValueScanLimit,
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('preferred audio detector', preferredAudioDetector, [
      'detectPreferredAudioLanguage',
    ]);
    bindings.detectPreferredAudioLanguage = () =>
      (preferredAudioDetector.detectPreferredAudioLanguage as AnyFn)() as string;

    const storageAdapter = requireFn<AnyFn>(
      'createStorageAdapter',
      storageModule.createStorageAdapter,
    )({
      storageArea: context.storageLocalArea,
      parseJson: safeJsonParse,
      localStorageRef: windowRef.localStorage,
      timeoutMs: 1500,
    });
    const storageAccessors = requireFn<AnyFn>(
      'createStorageAccessors',
      runtimeBootstrapFinalizeModule.createStorageAccessors,
    )({
      storageAdapter,
    }) as LooseRecord;
    const storageSet = (key: string, value: unknown) => (storageAccessors.storageSet as AnyFn)(key, value);

    bindBootstrapHelpersRuntimeInternal(context, bindings, traceContractsRuntime, storageSet, requireFn);
    return { storageSet };
  }

  function initializeAuthAndImageRuntimeInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    traceContractsRuntime: TraceContractsRuntime,
    requireFn: RequireFunction,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives;
    const apiContracts = traceContractsRuntime.apiContracts;
    const runtimeConstants = toRecord(context.runtimeConstants);
    const authClientModule = toRecord(context.authClientModule);
    const imageVariantsModule = toRecord(context.imageVariantsModule);
    const windowRef = context.windowRef as Window;

    const authClient = requireFn<AnyFn>(
      'createAuthClient',
      authClientModule.createAuthClient,
    )({
      state: context.state,
      runtimeEvent: bindings.runtimeEvent,
      pushApiTrace: bindings.pushApiTrace,
      resolveApiHref: bindings.resolveApiHref,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt as AnyFn,
      shouldRetryStatus: apiContracts.shouldRetryStatus as AnyFn,
      computeFetchRetryDelayMs: apiContracts.computeFetchRetryDelayMs as AnyFn,
      sleep: apiContracts.sleep as AnyFn,
      fetchTimeoutMs: runtimeConstants.fetchTimeoutMs,
      fetchMaxAttempts: runtimeConstants.fetchMaxAttempts,
      authTokenSkewMs: runtimeConstants.authTokenSkewMs,
      authClientBasic: runtimeConstants.authClientBasic,
      authDeviceKey: runtimeConstants.authDeviceKey,
      localStorageRef: windowRef.localStorage,
      navigatorRef: windowRef.navigator,
      cryptoRef: windowRef.crypto,
      fetchImpl: windowRef.fetch.bind(windowRef),
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('auth client', authClient, [
      'fetchWithResilience',
      'getAccessToken',
      'createAuthRefreshHandler',
    ]);
    bindings.fetchWithResilience = authClient.fetchWithResilience;
    bindings.getAccessToken = authClient.getAccessToken;
    bindings.createAuthRefreshHandler = authClient.createAuthRefreshHandler;

    const imageVariants = requireFn<AnyFn>(
      'createImageVariants',
      imageVariantsModule.createImageVariants,
    )({
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt as AnyFn,
      resolveApiHref: bindings.resolveApiHref,
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('image variants', imageVariants, [
      'normalizeImageUrlCandidate',
      'extractCoverImagesFromApiImages',
      'extractThumbnailImageFromApiImages',
    ]);
    bindings.normalizeImageUrlCandidate = imageVariants.normalizeImageUrlCandidate;
    bindings.extractCoverImagesFromApiImages = imageVariants.extractCoverImagesFromApiImages;
    bindings.extractThumbnailImageFromApiImages = imageVariants.extractThumbnailImageFromApiImages;
  }

  function initializeRatingsRuntimeInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    traceContractsRuntime: TraceContractsRuntime,
    requireFn: RequireFunction,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives;
    const apiContracts = traceContractsRuntime.apiContracts;
    const runtimeConstants = toRecord(context.runtimeConstants);
    const ratingsClientModule = toRecord(context.ratingsClientModule);
    const ratingsRepositoryModule = toRecord(context.ratingsRepositoryModule);

    const ratingsClient = requireFn<AnyFn>(
      'createRatingsClient',
      ratingsClientModule.createRatingsClient,
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
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('ratings client', ratingsClient, ['fetchRatingsBatch', 'fetchRating']);
    bindings.fetchRatingsBatch = ratingsClient.fetchRatingsBatch;
    bindings.fetchRating = ratingsClient.fetchRating;

    const ratingsRepository = requireFn<AnyFn>(
      'createRatingsRepository',
      ratingsRepositoryModule.createRatingsRepository,
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
      ratingBatchSize: runtimeConstants.ratingBatchSize,
      ratingBatchParallelChunks: runtimeConstants.ratingBatchParallelChunks,
      ratingCacheTtlMs: runtimeConstants.ratingCacheTtlMs,
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('ratings repository', ratingsRepository, [
      'getSeriesRating',
      'preloadRatingsForEntries',
      'getCachedRating',
      'isLocalizedRatingDataMissingForEntries',
    ]);
    bindings.preloadRatingsForEntries = ratingsRepository.preloadRatingsForEntries;
    bindings.getCachedRating = ratingsRepository.getCachedRating;
    bindings.isLocalizedRatingDataMissingForEntries = ratingsRepository.isLocalizedRatingDataMissingForEntries;
  }

  function initializeAuthImageAndRatingsInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    traceContractsRuntime: TraceContractsRuntime,
    requireFn: RequireFunction,
  ): void {
    initializeAuthAndImageRuntimeInternal(context, bindings, traceContractsRuntime, requireFn);
    initializeRatingsRuntimeInternal(context, bindings, traceContractsRuntime, requireFn);
  }

  function initializeWatchlistRuntimeInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    traceContractsRuntime: TraceContractsRuntime,
    requireFn: RequireFunction,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives;
    const apiContracts = traceContractsRuntime.apiContracts;
    const watchlistClientModule = toRecord(context.watchlistClientModule);
    const watchlistRepositoryModule = toRecord(context.watchlistRepositoryModule);
    const runtimeConstants = toRecord(context.runtimeConstants);

    const watchlistClient = requireFn<AnyFn>(
      'createWatchlistClient',
      watchlistClientModule.createWatchlistClient,
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
      watchlistPageSize: runtimeConstants.watchlistPageSize,
      watchlistMaxPages: runtimeConstants.watchlistMaxPages,
      watchlistParallelRequests: runtimeConstants.watchlistParallelRequests,
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('watchlist client', watchlistClient, ['fetchAllWatchlistRows']);
    bindings.fetchAllWatchlistRows = watchlistClient.fetchAllWatchlistRows;

    const watchlistRepository = requireFn<AnyFn>(
      'createWatchlistRepository',
      watchlistRepositoryModule.createWatchlistRepository,
    )({
      state: context.state,
      createWatchlistCacheSnapshot: context.createWatchlistCacheSnapshot,
      scheduleSaveWatchlistCache: bindings.scheduleSaveWatchlistCache,
      watchlistCacheTtlMs: runtimeConstants.watchlistCacheTtlMs,
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('watchlist repository', watchlistRepository, [
      'normalizeStoredWatchlistCache',
      'isWatchlistCacheValid',
      'resetWatchlistCacheOnAccountMismatch',
      'setWatchlistCacheRows',
    ]);
    bindings.normalizeStoredWatchlistCache = watchlistRepository.normalizeStoredWatchlistCache;
    bindings.isWatchlistCacheValid = watchlistRepository.isWatchlistCacheValid;
    bindings.resetWatchlistCacheOnAccountMismatch = watchlistRepository.resetWatchlistCacheOnAccountMismatch;
    bindings.setWatchlistCacheRows = watchlistRepository.setWatchlistCacheRows;
  }

  function initializeHistoryAndPreviewRuntimeInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    traceContractsRuntime: TraceContractsRuntime,
    requireFn: RequireFunction,
  ): void {
    const corePrimitives = traceContractsRuntime.corePrimitives;
    const apiContracts = traceContractsRuntime.apiContracts;
    const runtimeConstants = toRecord(context.runtimeConstants);
    const historyRepositoryModule = toRecord(context.historyRepositoryModule);
    const previewRepositoryModule = toRecord(context.previewRepositoryModule);

    const historyRepository = requireFn<AnyFn>(
      'createHistoryRepository',
      historyRepositoryModule.createHistoryRepository,
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
      watchHistoryCacheVersion: runtimeConstants.watchHistoryCacheVersion,
      watchHistoryCacheTtlMs: runtimeConstants.watchHistoryCacheTtlMs,
      watchHistoryPageSize: runtimeConstants.watchHistoryPageSize,
      watchHistoryMaxPages: runtimeConstants.watchHistoryMaxPages,
      watchHistoryNoMatchPageLimit: runtimeConstants.watchHistoryNoMatchPageLimit,
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('history repository', historyRepository, [
      'normalizeStoredWatchHistoryCache',
      'isWatchHistoryCacheValid',
      'getCachedWatchHistory',
      'getCachedWatchHistoryProgress',
      'preloadWatchHistoryForEntries',
      'isLocalizedWatchHistoryDataMissingForEntries',
    ]);
    bindings.normalizeStoredWatchHistoryCache = historyRepository.normalizeStoredWatchHistoryCache;
    bindings.isWatchHistoryCacheValid = historyRepository.isWatchHistoryCacheValid;
    bindings.getCachedWatchHistory = historyRepository.getCachedWatchHistory;
    bindings.getCachedWatchHistoryProgress = historyRepository.getCachedWatchHistoryProgress;
    bindings.preloadWatchHistoryForEntries = historyRepository.preloadWatchHistoryForEntries;
    bindings.isLocalizedWatchHistoryDataMissingForEntries =
      historyRepository.isLocalizedWatchHistoryDataMissingForEntries;

    const previewRepository = requireFn<AnyFn>(
      'createPreviewRepository',
      previewRepositoryModule.createPreviewRepository,
    )({
      state: context.state,
      resolveApiHref: bindings.resolveApiHref,
      getAccessToken: bindings.getAccessToken,
      fetchWithResilience: bindings.fetchWithResilience,
      createAuthRefreshHandler: bindings.createAuthRefreshHandler,
      pushApiTrace: bindings.pushApiTrace,
      runtimeEvent: bindings.runtimeEvent,
    }) as LooseRecord;
    (context.assertRuntimeMethods as AnyFn)('preview repository', previewRepository, ['fetchPreviewUrlForEntry']);
    bindings.fetchPreviewUrlForEntry = previewRepository.fetchPreviewUrlForEntry;
  }

  function initializeWatchlistHistoryAndPreviewInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    traceContractsRuntime: TraceContractsRuntime,
    requireFn: RequireFunction,
  ): void {
    initializeWatchlistRuntimeInternal(context, bindings, traceContractsRuntime, requireFn);
    initializeHistoryAndPreviewRuntimeInternal(context, bindings, traceContractsRuntime, requireFn);
  }

  /**
   * Splits setup-time data owner wiring out of `ContentRuntimeSetup` so bootstrap orchestration
   * remains focused on sequencing while this module owns all auth/API/storage/repository bindings.
   */
  function createContentRuntimeSetupDataInitializationRuntime(options: LooseRecord = {}): DataInitializationRuntime {
    const requireFn = (options.requireFunction as RequireFunction | undefined) ?? requireFunction;
    return {
      initializeTraceAndContracts: (context: LooseRecord, bindings: LooseRecord) =>
        initializeTraceAndContractsInternal(context, bindings, requireFn),
      initializePreferredAudioAndStorage: (
        context: LooseRecord,
        bindings: LooseRecord,
        traceContractsRuntime: TraceContractsRuntime,
      ) => initializePreferredAudioAndStorageInternal(context, bindings, traceContractsRuntime, requireFn),
      initializeAuthImageAndRatings: (
        context: LooseRecord,
        bindings: LooseRecord,
        traceContractsRuntime: TraceContractsRuntime,
      ) => initializeAuthImageAndRatingsInternal(context, bindings, traceContractsRuntime, requireFn),
      initializeWatchlistHistoryAndPreview: (
        context: LooseRecord,
        bindings: LooseRecord,
        traceContractsRuntime: TraceContractsRuntime,
      ) => initializeWatchlistHistoryAndPreviewInternal(context, bindings, traceContractsRuntime, requireFn),
    };
  }

  moduleRegistry.runtimeContentRuntimeSetupDataInitialization = {
    createContentRuntimeSetupDataInitializationRuntime,
  };
})();
