import { createBootstrapFinalizeRuntimeModule } from './BootstrapFinalize.js';
import { initializeWatchlistHistoryAndPreviewRuntime } from './ContentRuntimeSetupDataInitializationWatchlistHistory.js';

export type UnknownFn = (...args: unknown[]) => unknown;
export type LooseRecord = Record<string, unknown>;
export type RequireFunction = <T>(name: string, value: unknown) => T;

export type TraceContractsRuntime = {
  corePrimitives: LooseRecord;
  apiContracts: LooseRecord;
};

export type StorageRuntime = {
  storageSet: (key: string, value: unknown) => unknown;
};

export type DataInitializationRuntime = {
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

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as LooseRecord;
}

function resolveBootstrapFinalizeModule(context: LooseRecord): LooseRecord {
  const overrideModule = toRecord(context.runtimeBootstrapFinalizeModule);
  if (
    typeof overrideModule.safeJsonParse === 'function' &&
    typeof overrideModule.createStorageAccessors === 'function'
  ) {
    return overrideModule;
  }
  return toRecord(createBootstrapFinalizeRuntimeModule());
}

function requireRecordFunction<T extends UnknownFn>(owner: string, value: LooseRecord, name: string): T {
  const candidate = value[name];
  if (typeof candidate !== 'function') {
    throw new Error(`[CW] Missing ${owner} dependency: ${name}`);
  }
  return candidate as T;
}

function createDeferredBindingFunction<T extends UnknownFn>(owner: string, bindings: LooseRecord, name: string): T {
  return ((...args: unknown[]) => {
    const callback = requireRecordFunction<UnknownFn>(owner, bindings, name);
    return callback(...args);
  }) as T;
}

type BootstrapHelperDependencyFns = {
  normalizeAudioLocale: (value: unknown) => unknown;
  detectPreferredAudioLanguage: () => unknown;
  isLocalizedRatingDataMissingForEntries: (entries: unknown, audioLocale: unknown) => unknown;
  isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown, audioLocale: unknown) => unknown;
  getAccessToken: (forceRefresh?: unknown) => unknown;
  preloadRatingsForEntries: (entries: unknown, tokenEntry: unknown, preferredAudioLanguage: unknown) => unknown;
  preloadWatchHistoryForEntries: (
    entries: unknown,
    tokenEntry: unknown,
    force: unknown,
    preferredAudioLanguage: unknown,
  ) => unknown;
};

function resolveBootstrapHelperDependencyFns(
  traceContractsRuntime: TraceContractsRuntime,
  bindings: LooseRecord,
): BootstrapHelperDependencyFns {
  const corePrimitives = traceContractsRuntime.corePrimitives;
  return {
    normalizeAudioLocale: requireRecordFunction<(value: unknown) => unknown>(
      'core primitives',
      corePrimitives,
      'normalizeAudioLocale',
    ),
    detectPreferredAudioLanguage: requireRecordFunction<() => unknown>(
      'content runtime setup bindings',
      bindings,
      'detectPreferredAudioLanguage',
    ),
    isLocalizedRatingDataMissingForEntries: createDeferredBindingFunction<
      (entries: unknown, audioLocale: unknown) => unknown
    >('content runtime setup bindings', bindings, 'isLocalizedRatingDataMissingForEntries'),
    isLocalizedWatchHistoryDataMissingForEntries: createDeferredBindingFunction<
      (entries: unknown, audioLocale: unknown) => unknown
    >('content runtime setup bindings', bindings, 'isLocalizedWatchHistoryDataMissingForEntries'),
    getAccessToken: createDeferredBindingFunction<(forceRefresh?: unknown) => unknown>(
      'content runtime setup bindings',
      bindings,
      'getAccessToken',
    ),
    preloadRatingsForEntries: createDeferredBindingFunction<
      (entries: unknown, tokenEntry: unknown, preferredAudioLanguage: unknown) => unknown
    >('content runtime setup bindings', bindings, 'preloadRatingsForEntries'),
    preloadWatchHistoryForEntries: createDeferredBindingFunction<
      (entries: unknown, tokenEntry: unknown, force: unknown, preferredAudioLanguage: unknown) => unknown
    >('content runtime setup bindings', bindings, 'preloadWatchHistoryForEntries'),
  };
}

function applyBootstrapHelpersRuntimeBindings(bindings: LooseRecord, runtime: LooseRecord): void {
  bindings.scheduleSaveRatings = runtime.scheduleSaveRatings;
  bindings.scheduleSaveWatchHistory = runtime.scheduleSaveWatchHistory;
  bindings.scheduleSaveWatchlistCache = runtime.scheduleSaveWatchlistCache;
  bindings.getPreferredAudioLanguage = runtime.getPreferredAudioLanguage;
  bindings.preloadRatingsForSelectedAudioLocale = runtime.preloadRatingsForSelectedAudioLocale;
  bindings.preloadWatchHistoryForSelectedAudioLocale = runtime.preloadWatchHistoryForSelectedAudioLocale;
  bindings.toggleCuratedFavorite = runtime.toggleCuratedFavorite;
  bindings.removeCuratedSeries = runtime.removeCuratedSeries;
  bindings.isLikelyVideoUrl = runtime.isLikelyVideoUrl;
  bindings.isEntryWatchReady = runtime.isEntryWatchReady;
  bindings.withMutedObserver = runtime.withMutedObserver;
  bindings.applyCardLayoutUi = runtime.applyCardLayoutUi;
  bindings.persistSettings = runtime.persistSettings;
}

function bindBootstrapHelpersRuntime(
  context: LooseRecord,
  bindings: LooseRecord,
  traceContractsRuntime: TraceContractsRuntime,
  storageSet: (key: string, value: unknown) => unknown,
  requireFn: RequireFunction,
): void {
  const dependencyFns = resolveBootstrapHelperDependencyFns(traceContractsRuntime, bindings);
  const runtimeBootstrapHelpersModule = toRecord(context.runtimeBootstrapHelpersModule);
  const runtimeConstants = toRecord(context.runtimeConstants);
  const bootstrapHelpersRuntime = requireFn<UnknownFn>(
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
    normalizeAudioLocale: dependencyFns.normalizeAudioLocale,
    detectPreferredAudioLanguage: dependencyFns.detectPreferredAudioLanguage,
    isLocalizedRatingDataMissingForEntries: dependencyFns.isLocalizedRatingDataMissingForEntries,
    isLocalizedWatchHistoryDataMissingForEntries: dependencyFns.isLocalizedWatchHistoryDataMissingForEntries,
    getAccessToken: (forceRefresh = false) => dependencyFns.getAccessToken(forceRefresh),
    preloadRatingsForEntries: dependencyFns.preloadRatingsForEntries,
    preloadWatchHistoryForEntries: (
      entries: unknown,
      tokenEntry: unknown,
      force: unknown,
      preferredAudioLanguage: unknown,
    ) => dependencyFns.preloadWatchHistoryForEntries(entries, tokenEntry, force, preferredAudioLanguage),
  }) as LooseRecord;

  (context.assertRuntimeMethods as UnknownFn)('bootstrap helpers runtime', bootstrapHelpersRuntime, [
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

  applyBootstrapHelpersRuntimeBindings(bindings, bootstrapHelpersRuntime);
}

function initializeTraceAndContracts(
  context: LooseRecord,
  bindings: LooseRecord,
  requireFn: RequireFunction,
): TraceContractsRuntime {
  const runtimeTraceModule = toRecord(context.runtimeTraceModule);
  const runtimeConstants = toRecord(context.runtimeConstants);
  const corePrimitivesModule = toRecord(context.corePrimitivesModule);
  const apiContractsModule = toRecord(context.apiContractsModule);
  const windowRef = context.windowRef as Window;

  const runtimeTrace = requireFn<UnknownFn>(
    'createRuntimeTrace',
    runtimeTraceModule.createRuntimeTrace,
  )({
    windowRef,
    state: context.state,
    apiTraceLimitPerEndpoint: runtimeConstants.apiTraceLimitPerEndpoint,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('runtime trace', runtimeTrace, ['runtimeEvent', 'pushApiTrace']);
  bindings.runtimeEvent = runtimeTrace.runtimeEvent;
  bindings.pushApiTrace = runtimeTrace.pushApiTrace;

  const corePrimitives = requireFn<UnknownFn>(
    'createCorePrimitives',
    corePrimitivesModule.createCorePrimitives,
  )({
    extractCoverImagesFromApiImages: createDeferredBindingFunction<(images: unknown) => unknown>(
      'content runtime setup bindings',
      bindings,
      'extractCoverImagesFromApiImages',
    ),
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('core primitives', corePrimitives, [
    'sanitizeRating',
    'parseCmsObjectRecord',
    'deriveDisplayStatusBase',
  ]);
  const parseDateMs = requireRecordFunction<(value: unknown) => unknown>(
    'core primitives',
    corePrimitives,
    'parseDateMs',
  );
  const getWatchlistSeriesId = requireRecordFunction<(entry: unknown) => unknown>(
    'core primitives',
    corePrimitives,
    'getWatchlistSeriesId',
  );
  const getWatchHistorySeriesId = requireRecordFunction<(entry: unknown) => unknown>(
    'core primitives',
    corePrimitives,
    'getWatchHistorySeriesId',
  );

  const apiContracts = requireFn<UnknownFn>(
    'createApiContracts',
    apiContractsModule.createApiContracts,
  )({
    windowRef,
    navigatorRef: windowRef.navigator,
    runtimeEvent: bindings.runtimeEvent,
    parseDateMs,
    getWatchlistSeriesId,
    getWatchHistorySeriesId,
    fetchBackoffBaseMs: runtimeConstants.fetchBackoffBaseMs,
    fetchBackoffJitterMs: runtimeConstants.fetchBackoffJitterMs,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('api contracts', apiContracts, [
    'shouldRetryStatus',
    'requirePayloadDataArray',
    'resolveApiHref',
  ]);

  bindings.resolveApiHref = apiContracts.resolveApiHref;
  return { corePrimitives, apiContracts };
}

function initializePreferredAudioAndStorage(
  context: LooseRecord,
  bindings: LooseRecord,
  traceContractsRuntime: TraceContractsRuntime,
  requireFn: RequireFunction,
): StorageRuntime {
  const corePrimitives = traceContractsRuntime.corePrimitives;
  const runtimeConstants = toRecord(context.runtimeConstants);
  const runtimePreferredAudioModule = toRecord(context.runtimePreferredAudioModule);
  const runtimeBootstrapFinalizeModule = resolveBootstrapFinalizeModule(context);
  const storageModule = toRecord(context.storageModule);
  const windowRef = context.windowRef as Window;

  const safeJsonParse = (value: unknown, fallback: unknown) =>
    requireFn<UnknownFn>('safeJsonParse', runtimeBootstrapFinalizeModule.safeJsonParse)(value, fallback);

  const preferredAudioDetector = requireFn<UnknownFn>(
    'createPreferredAudioDetector',
    runtimePreferredAudioModule.createPreferredAudioDetector,
  )({
    normalizeAudioLocale: (value: unknown) => (corePrimitives.normalizeAudioLocale as UnknownFn)(value),
    parseJson: safeJsonParse,
    localStorageRef: windowRef.localStorage,
    navigatorRef: windowRef.navigator,
    documentRef: windowRef.document,
    storageScanLimit: runtimeConstants.preferredAudioStorageScanLimit,
    valueScanLimit: runtimeConstants.preferredAudioValueScanLimit,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('preferred audio detector', preferredAudioDetector, [
    'detectPreferredAudioLanguage',
  ]);
  bindings.detectPreferredAudioLanguage = () =>
    (preferredAudioDetector.detectPreferredAudioLanguage as UnknownFn)() as string;

  const storageAdapter = requireFn<UnknownFn>(
    'createStorageAdapter',
    storageModule.createStorageAdapter,
  )({
    storageArea: context.storageLocalArea,
    parseJson: safeJsonParse,
    localStorageRef: windowRef.localStorage,
    timeoutMs: 1500,
  });
  const storageAccessors = requireFn<UnknownFn>(
    'createStorageAccessors',
    runtimeBootstrapFinalizeModule.createStorageAccessors,
  )({
    storageAdapter,
  }) as LooseRecord;
  const storageSet = (key: string, value: unknown) => (storageAccessors.storageSet as UnknownFn)(key, value);

  bindBootstrapHelpersRuntime(context, bindings, traceContractsRuntime, storageSet, requireFn);
  return { storageSet };
}

function initializeAuthAndImageRuntime(
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

  const authClient = requireFn<UnknownFn>(
    'createAuthClient',
    authClientModule.createAuthClient,
  )({
    state: context.state,
    runtimeEvent: bindings.runtimeEvent,
    pushApiTrace: bindings.pushApiTrace,
    resolveApiHref: bindings.resolveApiHref,
    sanitizePositiveInt: corePrimitives.sanitizePositiveInt as UnknownFn,
    shouldRetryStatus: apiContracts.shouldRetryStatus as UnknownFn,
    computeFetchRetryDelayMs: apiContracts.computeFetchRetryDelayMs as UnknownFn,
    sleep: apiContracts.sleep as UnknownFn,
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
  (context.assertRuntimeMethods as UnknownFn)('auth client', authClient, [
    'fetchWithResilience',
    'getAccessToken',
    'createAuthRefreshHandler',
  ]);
  bindings.fetchWithResilience = authClient.fetchWithResilience;
  bindings.getAccessToken = authClient.getAccessToken;
  bindings.createAuthRefreshHandler = authClient.createAuthRefreshHandler;

  const imageVariants = requireFn<UnknownFn>(
    'createImageVariants',
    imageVariantsModule.createImageVariants,
  )({
    sanitizePositiveInt: corePrimitives.sanitizePositiveInt as UnknownFn,
    resolveApiHref: bindings.resolveApiHref,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('image variants', imageVariants, [
    'normalizeImageUrlCandidate',
    'extractCoverImagesFromApiImages',
    'extractThumbnailImageFromApiImages',
  ]);
  bindings.normalizeImageUrlCandidate = imageVariants.normalizeImageUrlCandidate;
  bindings.extractCoverImagesFromApiImages = imageVariants.extractCoverImagesFromApiImages;
  bindings.extractThumbnailImageFromApiImages = imageVariants.extractThumbnailImageFromApiImages;
}

function initializeRatingsRuntime(
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

  const ratingsClient = requireFn<UnknownFn>(
    'createRatingsClient',
    ratingsClientModule.createRatingsClient,
  )({
    fetchWithResilience: bindings.fetchWithResilience,
    getAccessToken: bindings.getAccessToken,
    createAuthRefreshHandler: bindings.createAuthRefreshHandler,
    resolveApiHref: bindings.resolveApiHref,
    normalizeAudioLocale: corePrimitives.normalizeAudioLocale as UnknownFn,
    getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
    getLocale: apiContracts.getLocale as UnknownFn,
    requirePayloadDataArray: apiContracts.requirePayloadDataArray as UnknownFn,
    auditCmsObjectContract: apiContracts.auditCmsObjectContract as UnknownFn,
    parseCmsObjectRecord: corePrimitives.parseCmsObjectRecord as UnknownFn,
    parseRatingPayload: corePrimitives.parseRatingPayload as UnknownFn,
    sanitizeRating: corePrimitives.sanitizeRating as UnknownFn,
    sanitizeVotes: corePrimitives.sanitizeVotes as UnknownFn,
    pushApiTrace: bindings.pushApiTrace,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('ratings client', ratingsClient, ['fetchRatingsBatch', 'fetchRating']);
  bindings.fetchRatingsBatch = ratingsClient.fetchRatingsBatch;
  bindings.fetchRating = ratingsClient.fetchRating;

  const ratingsRepository = requireFn<UnknownFn>(
    'createRatingsRepository',
    ratingsRepositoryModule.createRatingsRepository,
  )({
    state: context.state,
    normalizeAudioLocale: corePrimitives.normalizeAudioLocale as UnknownFn,
    normalizeAudioLocales: corePrimitives.normalizeAudioLocales as UnknownFn,
    sanitizePositiveInt: corePrimitives.sanitizePositiveInt as UnknownFn,
    normalizeTagList: corePrimitives.normalizeTagList as UnknownFn,
    normalizeImageUrlCandidate: bindings.normalizeImageUrlCandidate,
    getAudioLocaleCountFromMap: corePrimitives.getAudioLocaleCountFromMap as UnknownFn,
    mergeAudioLocaleCountMap: corePrimitives.mergeAudioLocaleCountMap as UnknownFn,
    getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
    chunkArray: corePrimitives.chunkArray as UnknownFn,
    fetchRatingsBatch: bindings.fetchRatingsBatch,
    fetchRating: bindings.fetchRating,
    scheduleSaveRatings: bindings.scheduleSaveRatings,
    runtimeEvent: bindings.runtimeEvent,
    ratingBatchSize: runtimeConstants.ratingBatchSize,
    ratingBatchParallelChunks: runtimeConstants.ratingBatchParallelChunks,
    ratingCacheTtlMs: runtimeConstants.ratingCacheTtlMs,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('ratings repository', ratingsRepository, [
    'getSeriesRating',
    'preloadRatingsForEntries',
    'getCachedRating',
    'isLocalizedRatingDataMissingForEntries',
  ]);
  bindings.preloadRatingsForEntries = ratingsRepository.preloadRatingsForEntries;
  bindings.getCachedRating = ratingsRepository.getCachedRating;
  bindings.isLocalizedRatingDataMissingForEntries = ratingsRepository.isLocalizedRatingDataMissingForEntries;
}

function initializeAuthImageAndRatings(
  context: LooseRecord,
  bindings: LooseRecord,
  traceContractsRuntime: TraceContractsRuntime,
  requireFn: RequireFunction,
): void {
  initializeAuthAndImageRuntime(context, bindings, traceContractsRuntime, requireFn);
  initializeRatingsRuntime(context, bindings, traceContractsRuntime, requireFn);
}

export function createContentRuntimeSetupDataInitializationPhases(
  requireFn: RequireFunction,
): DataInitializationRuntime {
  return {
    initializeTraceAndContracts: (context: LooseRecord, bindings: LooseRecord) =>
      initializeTraceAndContracts(context, bindings, requireFn),
    initializePreferredAudioAndStorage: (
      context: LooseRecord,
      bindings: LooseRecord,
      traceContractsRuntime: TraceContractsRuntime,
    ) => initializePreferredAudioAndStorage(context, bindings, traceContractsRuntime, requireFn),
    initializeAuthImageAndRatings: (
      context: LooseRecord,
      bindings: LooseRecord,
      traceContractsRuntime: TraceContractsRuntime,
    ) => initializeAuthImageAndRatings(context, bindings, traceContractsRuntime, requireFn),
    initializeWatchlistHistoryAndPreview: (
      context: LooseRecord,
      bindings: LooseRecord,
      traceContractsRuntime: TraceContractsRuntime,
    ) => initializeWatchlistHistoryAndPreviewRuntime(context, bindings, traceContractsRuntime, requireFn),
  };
}
