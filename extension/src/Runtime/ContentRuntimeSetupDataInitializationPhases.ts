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

type AssertRuntimeMethods = (owner: string, runtime: LooseRecord, requiredMethods: string[]) => void;

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as LooseRecord;
}

function resolveWindowRef(context: LooseRecord): Window {
  if (!context.windowRef || typeof context.windowRef !== 'object') {
    throw new Error('[CW] Missing runtime setup context dependency: windowRef');
  }

  return context.windowRef as Window;
}

function resolveAssertRuntimeMethods(context: LooseRecord): AssertRuntimeMethods {
  return requireRecordFunction<AssertRuntimeMethods>('runtime setup context', context, 'assertRuntimeMethods');
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

function requireRecordFunction<T>(owner: string, value: LooseRecord, name: string): T {
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
  const assertRuntimeMethods = resolveAssertRuntimeMethods(context);
  const dependencyFns = resolveBootstrapHelperDependencyFns(traceContractsRuntime, bindings);
  const runtimeBootstrapHelpersModule = toRecord(context.runtimeBootstrapHelpersModule);
  const runtimeConstants = toRecord(context.runtimeConstants);
  const createBootstrapHelpersRuntime = requireFn<UnknownFn>(
    'createBootstrapHelpersRuntime',
    runtimeBootstrapHelpersModule.createBootstrapHelpersRuntime,
  );
  const bootstrapHelpersRuntime = toRecord(
    createBootstrapHelpersRuntime({
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
    }),
  );

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
  ]);

  applyBootstrapHelpersRuntimeBindings(bindings, bootstrapHelpersRuntime);
}

function initializeTraceAndContracts(
  context: LooseRecord,
  bindings: LooseRecord,
  requireFn: RequireFunction,
): TraceContractsRuntime {
  const assertRuntimeMethods = resolveAssertRuntimeMethods(context);
  const runtimeTraceModule = toRecord(context.runtimeTraceModule);
  const runtimeConstants = toRecord(context.runtimeConstants);
  const corePrimitivesModule = toRecord(context.corePrimitivesModule);
  const apiContractsModule = toRecord(context.apiContractsModule);
  const windowRef = resolveWindowRef(context);

  const createRuntimeTrace = requireFn<UnknownFn>('createRuntimeTrace', runtimeTraceModule.createRuntimeTrace);
  const runtimeTrace = toRecord(
    createRuntimeTrace({
      windowRef,
      state: context.state,
      apiTraceLimitPerEndpoint: runtimeConstants.apiTraceLimitPerEndpoint,
    }),
  );
  assertRuntimeMethods('runtime trace', runtimeTrace, ['runtimeEvent', 'pushApiTrace']);
  bindings.runtimeEvent = runtimeTrace.runtimeEvent;
  bindings.pushApiTrace = runtimeTrace.pushApiTrace;

  const createCorePrimitives = requireFn<UnknownFn>('createCorePrimitives', corePrimitivesModule.createCorePrimitives);
  const corePrimitives = toRecord(
    createCorePrimitives({
      extractCoverImagesFromApiImages: createDeferredBindingFunction<(images: unknown) => unknown>(
        'content runtime setup bindings',
        bindings,
        'extractCoverImagesFromApiImages',
      ),
    }),
  );
  assertRuntimeMethods('core primitives', corePrimitives, [
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

  const createApiContracts = requireFn<UnknownFn>('createApiContracts', apiContractsModule.createApiContracts);
  const apiContracts = toRecord(
    createApiContracts({
      windowRef,
      navigatorRef: windowRef.navigator,
      runtimeEvent: bindings.runtimeEvent,
      parseDateMs,
      getWatchlistSeriesId,
      getWatchHistorySeriesId,
      fetchBackoffBaseMs: runtimeConstants.fetchBackoffBaseMs,
      fetchBackoffJitterMs: runtimeConstants.fetchBackoffJitterMs,
    }),
  );
  assertRuntimeMethods('api contracts', apiContracts, [
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
  const assertRuntimeMethods = resolveAssertRuntimeMethods(context);
  const corePrimitives = traceContractsRuntime.corePrimitives;
  const runtimeConstants = toRecord(context.runtimeConstants);
  const runtimePreferredAudioModule = toRecord(context.runtimePreferredAudioModule);
  const runtimeBootstrapFinalizeModule = resolveBootstrapFinalizeModule(context);
  const storageModule = toRecord(context.storageModule);
  const windowRef = resolveWindowRef(context);
  const normalizeAudioLocale = requireRecordFunction<(value: unknown) => unknown>(
    'core primitives',
    corePrimitives,
    'normalizeAudioLocale',
  );

  const safeJsonParseImpl = requireFn<UnknownFn>('safeJsonParse', runtimeBootstrapFinalizeModule.safeJsonParse);
  const safeJsonParse = (value: unknown, fallback: unknown) => safeJsonParseImpl(value, fallback);

  const createPreferredAudioDetector = requireFn<UnknownFn>(
    'createPreferredAudioDetector',
    runtimePreferredAudioModule.createPreferredAudioDetector,
  );
  const preferredAudioDetector = toRecord(
    createPreferredAudioDetector({
      normalizeAudioLocale,
      parseJson: safeJsonParse,
      localStorageRef: windowRef.localStorage,
      navigatorRef: windowRef.navigator,
      documentRef: windowRef.document,
      storageScanLimit: runtimeConstants.preferredAudioStorageScanLimit,
      valueScanLimit: runtimeConstants.preferredAudioValueScanLimit,
    }),
  );
  assertRuntimeMethods('preferred audio detector', preferredAudioDetector, ['detectPreferredAudioLanguage']);
  const detectPreferredAudioLanguage = requireRecordFunction<() => unknown>(
    'preferred audio detector',
    preferredAudioDetector,
    'detectPreferredAudioLanguage',
  );
  bindings.detectPreferredAudioLanguage = () => detectPreferredAudioLanguage() as string;

  const createStorageAdapter = requireFn<UnknownFn>('createStorageAdapter', storageModule.createStorageAdapter);
  const storageAdapter = createStorageAdapter({
    storageArea: context.storageLocalArea,
    parseJson: safeJsonParse,
    localStorageRef: windowRef.localStorage,
    timeoutMs: 1500,
  });
  const createStorageAccessors = requireFn<UnknownFn>(
    'createStorageAccessors',
    runtimeBootstrapFinalizeModule.createStorageAccessors,
  );
  const storageAccessors = toRecord(
    createStorageAccessors({
      storageAdapter,
    }),
  );
  const storageSet = requireRecordFunction<(key: string, value: unknown) => unknown>(
    'storage accessors',
    storageAccessors,
    'storageSet',
  );

  bindBootstrapHelpersRuntime(context, bindings, traceContractsRuntime, storageSet, requireFn);
  return { storageSet };
}

function initializeAuthAndImageRuntime(
  context: LooseRecord,
  bindings: LooseRecord,
  traceContractsRuntime: TraceContractsRuntime,
  requireFn: RequireFunction,
): void {
  const assertRuntimeMethods = resolveAssertRuntimeMethods(context);
  const corePrimitives = traceContractsRuntime.corePrimitives;
  const apiContracts = traceContractsRuntime.apiContracts;
  const runtimeConstants = toRecord(context.runtimeConstants);
  const authClientModule = toRecord(context.authClientModule);
  const imageVariantsModule = toRecord(context.imageVariantsModule);
  const windowRef = resolveWindowRef(context);
  const sanitizePositiveInt = requireRecordFunction<UnknownFn>(
    'core primitives',
    corePrimitives,
    'sanitizePositiveInt',
  );
  const shouldRetryStatus = requireRecordFunction<UnknownFn>('api contracts', apiContracts, 'shouldRetryStatus');
  const computeFetchRetryDelayMs = requireRecordFunction<UnknownFn>(
    'api contracts',
    apiContracts,
    'computeFetchRetryDelayMs',
  );
  const sleep = requireRecordFunction<UnknownFn>('api contracts', apiContracts, 'sleep');

  const createAuthClient = requireFn<UnknownFn>('createAuthClient', authClientModule.createAuthClient);
  const authClient = toRecord(
    createAuthClient({
      state: context.state,
      runtimeEvent: bindings.runtimeEvent,
      pushApiTrace: bindings.pushApiTrace,
      resolveApiHref: bindings.resolveApiHref,
      sanitizePositiveInt,
      shouldRetryStatus,
      computeFetchRetryDelayMs,
      sleep,
      fetchTimeoutMs: runtimeConstants.fetchTimeoutMs,
      fetchMaxAttempts: runtimeConstants.fetchMaxAttempts,
      authTokenSkewMs: runtimeConstants.authTokenSkewMs,
      authClientBasic: runtimeConstants.authClientBasic,
      authDeviceKey: runtimeConstants.authDeviceKey,
      localStorageRef: windowRef.localStorage,
      navigatorRef: windowRef.navigator,
      cryptoRef: windowRef.crypto,
      fetchImpl: windowRef.fetch.bind(windowRef),
    }),
  );
  assertRuntimeMethods('auth client', authClient, [
    'fetchWithResilience',
    'getAccessToken',
    'createAuthRefreshHandler',
  ]);
  bindings.fetchWithResilience = authClient.fetchWithResilience;
  bindings.getAccessToken = authClient.getAccessToken;
  bindings.createAuthRefreshHandler = authClient.createAuthRefreshHandler;

  const createImageVariants = requireFn<UnknownFn>('createImageVariants', imageVariantsModule.createImageVariants);
  const imageVariants = toRecord(
    createImageVariants({
      sanitizePositiveInt,
      resolveApiHref: bindings.resolveApiHref,
    }),
  );
  assertRuntimeMethods('image variants', imageVariants, [
    'normalizeImageUrlCandidate',
    'extractCoverImagesFromApiImages',
    'extractThumbnailImageFromApiImages',
  ]);
  bindings.normalizeImageUrlCandidate = imageVariants.normalizeImageUrlCandidate;
  bindings.extractCoverImagesFromApiImages = imageVariants.extractCoverImagesFromApiImages;
  bindings.extractThumbnailImageFromApiImages = imageVariants.extractThumbnailImageFromApiImages;
}

type RatingsRuntimeDependencyFns = {
  normalizeAudioLocale: UnknownFn;
  normalizeAudioLocales: UnknownFn;
  sanitizePositiveInt: UnknownFn;
  normalizeTagList: UnknownFn;
  getAudioLocaleCountFromMap: UnknownFn;
  mergeAudioLocaleCountMap: UnknownFn;
  chunkArray: UnknownFn;
  parseCmsObjectRecord: UnknownFn;
  parseRatingPayload: UnknownFn;
  sanitizeRating: UnknownFn;
  sanitizeVotes: UnknownFn;
  getLocale: UnknownFn;
  requirePayloadDataArray: UnknownFn;
  auditCmsObjectContract: UnknownFn;
};

function resolveRatingsRuntimeDependencyFns(
  corePrimitives: LooseRecord,
  apiContracts: LooseRecord,
): RatingsRuntimeDependencyFns {
  return {
    normalizeAudioLocale: requireRecordFunction<UnknownFn>('core primitives', corePrimitives, 'normalizeAudioLocale'),
    normalizeAudioLocales: requireRecordFunction<UnknownFn>('core primitives', corePrimitives, 'normalizeAudioLocales'),
    sanitizePositiveInt: requireRecordFunction<UnknownFn>('core primitives', corePrimitives, 'sanitizePositiveInt'),
    normalizeTagList: requireRecordFunction<UnknownFn>('core primitives', corePrimitives, 'normalizeTagList'),
    getAudioLocaleCountFromMap: requireRecordFunction<UnknownFn>(
      'core primitives',
      corePrimitives,
      'getAudioLocaleCountFromMap',
    ),
    mergeAudioLocaleCountMap: requireRecordFunction<UnknownFn>(
      'core primitives',
      corePrimitives,
      'mergeAudioLocaleCountMap',
    ),
    chunkArray: requireRecordFunction<UnknownFn>('core primitives', corePrimitives, 'chunkArray'),
    parseCmsObjectRecord: requireRecordFunction<UnknownFn>('core primitives', corePrimitives, 'parseCmsObjectRecord'),
    parseRatingPayload: requireRecordFunction<UnknownFn>('core primitives', corePrimitives, 'parseRatingPayload'),
    sanitizeRating: requireRecordFunction<UnknownFn>('core primitives', corePrimitives, 'sanitizeRating'),
    sanitizeVotes: requireRecordFunction<UnknownFn>('core primitives', corePrimitives, 'sanitizeVotes'),
    getLocale: requireRecordFunction<UnknownFn>('api contracts', apiContracts, 'getLocale'),
    requirePayloadDataArray: requireRecordFunction<UnknownFn>('api contracts', apiContracts, 'requirePayloadDataArray'),
    auditCmsObjectContract: requireRecordFunction<UnknownFn>('api contracts', apiContracts, 'auditCmsObjectContract'),
  };
}

function initializeRatingsRuntime(
  context: LooseRecord,
  bindings: LooseRecord,
  traceContractsRuntime: TraceContractsRuntime,
  requireFn: RequireFunction,
): void {
  const assertRuntimeMethods = resolveAssertRuntimeMethods(context);
  const corePrimitives = traceContractsRuntime.corePrimitives;
  const apiContracts = traceContractsRuntime.apiContracts;
  const runtimeConstants = toRecord(context.runtimeConstants);
  const ratingsClientModule = toRecord(context.ratingsClientModule);
  const ratingsRepositoryModule = toRecord(context.ratingsRepositoryModule);
  const ratingsDependencyFns = resolveRatingsRuntimeDependencyFns(corePrimitives, apiContracts);

  const createRatingsClient = requireFn<UnknownFn>('createRatingsClient', ratingsClientModule.createRatingsClient);
  const ratingsClient = toRecord(
    createRatingsClient({
      fetchWithResilience: bindings.fetchWithResilience,
      getAccessToken: bindings.getAccessToken,
      createAuthRefreshHandler: bindings.createAuthRefreshHandler,
      resolveApiHref: bindings.resolveApiHref,
      normalizeAudioLocale: ratingsDependencyFns.normalizeAudioLocale,
      getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
      getLocale: ratingsDependencyFns.getLocale,
      requirePayloadDataArray: ratingsDependencyFns.requirePayloadDataArray,
      auditCmsObjectContract: ratingsDependencyFns.auditCmsObjectContract,
      parseCmsObjectRecord: ratingsDependencyFns.parseCmsObjectRecord,
      parseRatingPayload: ratingsDependencyFns.parseRatingPayload,
      sanitizeRating: ratingsDependencyFns.sanitizeRating,
      sanitizeVotes: ratingsDependencyFns.sanitizeVotes,
      pushApiTrace: bindings.pushApiTrace,
    }),
  );
  assertRuntimeMethods('ratings client', ratingsClient, ['fetchRatingsBatch', 'fetchRating']);
  bindings.fetchRatingsBatch = ratingsClient.fetchRatingsBatch;
  bindings.fetchRating = ratingsClient.fetchRating;

  const createRatingsRepository = requireFn<UnknownFn>(
    'createRatingsRepository',
    ratingsRepositoryModule.createRatingsRepository,
  );
  const ratingsRepository = toRecord(
    createRatingsRepository({
      state: context.state,
      normalizeAudioLocale: ratingsDependencyFns.normalizeAudioLocale,
      normalizeAudioLocales: ratingsDependencyFns.normalizeAudioLocales,
      sanitizePositiveInt: ratingsDependencyFns.sanitizePositiveInt,
      normalizeTagList: ratingsDependencyFns.normalizeTagList,
      normalizeImageUrlCandidate: bindings.normalizeImageUrlCandidate,
      getAudioLocaleCountFromMap: ratingsDependencyFns.getAudioLocaleCountFromMap,
      mergeAudioLocaleCountMap: ratingsDependencyFns.mergeAudioLocaleCountMap,
      getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
      chunkArray: ratingsDependencyFns.chunkArray,
      fetchRatingsBatch: bindings.fetchRatingsBatch,
      fetchRating: bindings.fetchRating,
      scheduleSaveRatings: bindings.scheduleSaveRatings,
      runtimeEvent: bindings.runtimeEvent,
      ratingBatchSize: runtimeConstants.ratingBatchSize,
      ratingBatchParallelChunks: runtimeConstants.ratingBatchParallelChunks,
      ratingCacheTtlMs: runtimeConstants.ratingCacheTtlMs,
    }),
  );
  assertRuntimeMethods('ratings repository', ratingsRepository, [
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
