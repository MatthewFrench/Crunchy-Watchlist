import { createBootstrapFinalizeRuntimeModule } from './BootstrapFinalize.js';
import { createRuntimeBootstrapHelpersRuntime } from './BootstrapHelpers.js';
import { initializeWatchlistHistoryAndPreviewRuntime } from './ContentRuntimeSetupDataInitializationWatchlistHistory.js';

type RuntimeBoundaryValue = CwBoundaryValue;
type RuntimeCallback = (...args: RuntimeBoundaryValue[]) => RuntimeBoundaryValue;
export type UnknownFn = RuntimeCallback;
export type LooseRecord = Record<string, RuntimeBoundaryValue>;
export type RequireFunction = <T>(name: string, value: RuntimeBoundaryValue) => T;
type EntryList = RuntimeBoundaryValue[];
type MaybeAudioLocale = string | null;
type TokenEntry = LooseRecord;
type NormalizeAudioLocaleFn = (value: RuntimeBoundaryValue) => MaybeAudioLocale;
type DetectPreferredAudioLanguageFn = () => MaybeAudioLocale;
type IsLocalizedDataMissingFn = (entries: EntryList, audioLocale: MaybeAudioLocale) => boolean;
type GetAccessTokenFn = (forceRefresh?: boolean) => Promise<TokenEntry | null>;
type PreloadRatingsForEntriesFn = (
  entries: EntryList,
  tokenEntry: TokenEntry,
  preferredAudioLanguage?: MaybeAudioLocale,
) => Promise<void>;
type PreloadWatchHistoryForEntriesFn = (
  entries: EntryList,
  tokenEntry: TokenEntry,
  force?: boolean,
  preferredAudioLanguage?: MaybeAudioLocale,
) => Promise<void>;
type StorageSetFn = (key: string, value: RuntimeBoundaryValue) => RuntimeBoundaryValue;

export type TraceContractsRuntime = {
  corePrimitives: LooseRecord;
  apiContracts: LooseRecord;
};

export type StorageRuntime = {
  storageSet: StorageSetFn;
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

export type DataInitializationDependencyOptions = {
  runtimeBootstrapFinalizeModule?: RuntimeBoundaryValue;
  runtimeBootstrapHelpersModule?: RuntimeBoundaryValue;
  createBootstrapFinalizeRuntimeModule?: () => RuntimeBoundaryValue;
  createRuntimeBootstrapHelpersRuntime?: () => RuntimeBoundaryValue;
};

type DataInitializationResolvedDependencies = {
  runtimeBootstrapFinalizeModule: LooseRecord;
  runtimeBootstrapHelpersModule: LooseRecord;
};

function toRecord(value: RuntimeBoundaryValue): LooseRecord {
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

function hasMethods(value: LooseRecord, methodNames: string[]): boolean {
  return methodNames.every((methodName) => typeof value[methodName] === 'function');
}

function resolveBootstrapFinalizeModuleFromOptions(options: DataInitializationDependencyOptions): LooseRecord {
  const overrideModule = toRecord(options.runtimeBootstrapFinalizeModule);
  if (hasMethods(overrideModule, ['safeJsonParse', 'createStorageAccessors'])) {
    return overrideModule;
  }

  const bootstrapFinalizeModuleFactory =
    typeof options.createBootstrapFinalizeRuntimeModule === 'function'
      ? options.createBootstrapFinalizeRuntimeModule
      : createBootstrapFinalizeRuntimeModule;

  return toRecord(bootstrapFinalizeModuleFactory());
}

function resolveBootstrapHelpersModuleFromOptions(options: DataInitializationDependencyOptions): LooseRecord {
  const overrideModule = toRecord(options.runtimeBootstrapHelpersModule);
  if (hasMethods(overrideModule, ['createBootstrapHelpersRuntime'])) {
    return overrideModule;
  }

  const bootstrapHelpersModuleFactory =
    typeof options.createRuntimeBootstrapHelpersRuntime === 'function'
      ? options.createRuntimeBootstrapHelpersRuntime
      : createRuntimeBootstrapHelpersRuntime;

  return toRecord(bootstrapHelpersModuleFactory());
}

function resolveDataInitializationDependencies(
  options: DataInitializationDependencyOptions,
): DataInitializationResolvedDependencies {
  return {
    runtimeBootstrapFinalizeModule: resolveBootstrapFinalizeModuleFromOptions(options),
    runtimeBootstrapHelpersModule: resolveBootstrapHelpersModuleFromOptions(options),
  };
}

function requireRecordFunction<T>(owner: string, value: LooseRecord, name: string): T {
  const candidate = value[name];
  if (typeof candidate !== 'function') {
    throw new Error(`[CW] Missing ${owner} dependency: ${name}`);
  }
  return candidate as T;
}

function createDeferredBindingFunction<T>(owner: string, bindings: LooseRecord, name: string): T {
  return ((...args: RuntimeBoundaryValue[]) => {
    const callback = requireRecordFunction<RuntimeCallback>(owner, bindings, name);
    return callback(...args);
  }) as T;
}

type BootstrapHelperDependencyFns = {
  normalizeAudioLocale: NormalizeAudioLocaleFn;
  detectPreferredAudioLanguage: DetectPreferredAudioLanguageFn;
  isLocalizedRatingDataMissingForEntries: IsLocalizedDataMissingFn;
  isLocalizedWatchHistoryDataMissingForEntries: IsLocalizedDataMissingFn;
  getAccessToken: GetAccessTokenFn;
  preloadRatingsForEntries: PreloadRatingsForEntriesFn;
  preloadWatchHistoryForEntries: PreloadWatchHistoryForEntriesFn;
};

function resolveBootstrapHelperDependencyFns(
  traceContractsRuntime: TraceContractsRuntime,
  bindings: LooseRecord,
): BootstrapHelperDependencyFns {
  const corePrimitives = traceContractsRuntime.corePrimitives;
  return {
    normalizeAudioLocale: requireRecordFunction<NormalizeAudioLocaleFn>(
      'core primitives',
      corePrimitives,
      'normalizeAudioLocale',
    ),
    detectPreferredAudioLanguage: requireRecordFunction<DetectPreferredAudioLanguageFn>(
      'content runtime setup bindings',
      bindings,
      'detectPreferredAudioLanguage',
    ),
    isLocalizedRatingDataMissingForEntries: createDeferredBindingFunction<IsLocalizedDataMissingFn>(
      'content runtime setup bindings',
      bindings,
      'isLocalizedRatingDataMissingForEntries',
    ),
    isLocalizedWatchHistoryDataMissingForEntries: createDeferredBindingFunction<IsLocalizedDataMissingFn>(
      'content runtime setup bindings',
      bindings,
      'isLocalizedWatchHistoryDataMissingForEntries',
    ),
    getAccessToken: createDeferredBindingFunction<GetAccessTokenFn>(
      'content runtime setup bindings',
      bindings,
      'getAccessToken',
    ),
    preloadRatingsForEntries: createDeferredBindingFunction<PreloadRatingsForEntriesFn>(
      'content runtime setup bindings',
      bindings,
      'preloadRatingsForEntries',
    ),
    preloadWatchHistoryForEntries: createDeferredBindingFunction<PreloadWatchHistoryForEntriesFn>(
      'content runtime setup bindings',
      bindings,
      'preloadWatchHistoryForEntries',
    ),
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
  storageSet: StorageSetFn,
  runtimeBootstrapHelpersModule: LooseRecord,
  requireFn: RequireFunction,
): void {
  const assertRuntimeMethods = resolveAssertRuntimeMethods(context);
  const dependencyFns = resolveBootstrapHelperDependencyFns(traceContractsRuntime, bindings);
  const runtimeConstants = toRecord(context.runtimeConstants);
  const createBootstrapHelpersRuntime = requireFn<RuntimeCallback>(
    'createBootstrapHelpersRuntime',
    runtimeBootstrapHelpersModule.createBootstrapHelpersRuntime,
  );
  const bootstrapHelpersRuntime = toRecord(
    createBootstrapHelpersRuntime({
      state: context.state,
      windowRef: context.windowRef,
      runtimeEvent: bindings.runtimeEvent,
      storageSet: (key: string, value: RuntimeBoundaryValue) => storageSet(key, value),
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
        entries: EntryList,
        tokenEntry: TokenEntry,
        force = false,
        preferredAudioLanguage: MaybeAudioLocale = null,
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

  const createRuntimeTrace = requireFn<RuntimeCallback>('createRuntimeTrace', runtimeTraceModule.createRuntimeTrace);
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

  const createCorePrimitives = requireFn<RuntimeCallback>(
    'createCorePrimitives',
    corePrimitivesModule.createCorePrimitives,
  );
  const corePrimitives = toRecord(
    createCorePrimitives({
      extractCoverImagesFromApiImages: createDeferredBindingFunction<
        (images: RuntimeBoundaryValue) => RuntimeBoundaryValue
      >('content runtime setup bindings', bindings, 'extractCoverImagesFromApiImages'),
    }),
  );
  assertRuntimeMethods('core primitives', corePrimitives, [
    'sanitizeRating',
    'parseCmsObjectRecord',
    'deriveDisplayStatusBase',
  ]);
  const parseDateMs = requireRecordFunction<(value: RuntimeBoundaryValue) => number | null>(
    'core primitives',
    corePrimitives,
    'parseDateMs',
  );
  const getWatchlistSeriesId = requireRecordFunction<(entry: RuntimeBoundaryValue) => string | null>(
    'core primitives',
    corePrimitives,
    'getWatchlistSeriesId',
  );
  const getWatchHistorySeriesId = requireRecordFunction<(entry: RuntimeBoundaryValue) => string | null>(
    'core primitives',
    corePrimitives,
    'getWatchHistorySeriesId',
  );

  const createApiContracts = requireFn<RuntimeCallback>('createApiContracts', apiContractsModule.createApiContracts);
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
    'parsePayloadDataEnvelope',
    'resolveApiHref',
  ]);

  bindings.resolveApiHref = apiContracts.resolveApiHref;
  return { corePrimitives, apiContracts };
}

function initializePreferredAudioAndStorage(
  context: LooseRecord,
  bindings: LooseRecord,
  traceContractsRuntime: TraceContractsRuntime,
  dependencies: DataInitializationResolvedDependencies,
  requireFn: RequireFunction,
): StorageRuntime {
  const assertRuntimeMethods = resolveAssertRuntimeMethods(context);
  const corePrimitives = traceContractsRuntime.corePrimitives;
  const runtimeConstants = toRecord(context.runtimeConstants);
  const runtimePreferredAudioModule = toRecord(context.runtimePreferredAudioModule);
  const runtimeBootstrapFinalizeModule = dependencies.runtimeBootstrapFinalizeModule;
  const storageModule = toRecord(context.storageModule);
  const windowRef = resolveWindowRef(context);
  const normalizeAudioLocale = requireRecordFunction<NormalizeAudioLocaleFn>(
    'core primitives',
    corePrimitives,
    'normalizeAudioLocale',
  );

  const safeJsonParseImpl = requireFn<RuntimeCallback>('safeJsonParse', runtimeBootstrapFinalizeModule.safeJsonParse);
  const safeJsonParse = (value: RuntimeBoundaryValue, fallback: RuntimeBoundaryValue) =>
    safeJsonParseImpl(value, fallback);

  const createPreferredAudioDetector = requireFn<RuntimeCallback>(
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
  const detectPreferredAudioLanguage = requireRecordFunction<DetectPreferredAudioLanguageFn>(
    'preferred audio detector',
    preferredAudioDetector,
    'detectPreferredAudioLanguage',
  );
  bindings.detectPreferredAudioLanguage = () => detectPreferredAudioLanguage();

  const createStorageAdapter = requireFn<RuntimeCallback>('createStorageAdapter', storageModule.createStorageAdapter);
  const storageAdapter = createStorageAdapter({
    storageArea: context.storageLocalArea,
    parseJson: safeJsonParse,
    localStorageRef: windowRef.localStorage,
    timeoutMs: 1500,
  });
  const createStorageAccessors = requireFn<RuntimeCallback>(
    'createStorageAccessors',
    runtimeBootstrapFinalizeModule.createStorageAccessors,
  );
  const storageAccessors = toRecord(
    createStorageAccessors({
      storageAdapter,
    }),
  );
  const storageSet = requireRecordFunction<StorageSetFn>('storage accessors', storageAccessors, 'storageSet');

  bindBootstrapHelpersRuntime(
    context,
    bindings,
    traceContractsRuntime,
    storageSet,
    dependencies.runtimeBootstrapHelpersModule,
    requireFn,
  );
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
  const sanitizePositiveInt = requireRecordFunction<RuntimeCallback>(
    'core primitives',
    corePrimitives,
    'sanitizePositiveInt',
  );
  const shouldRetryStatus = requireRecordFunction<RuntimeCallback>('api contracts', apiContracts, 'shouldRetryStatus');
  const computeFetchRetryDelayMs = requireRecordFunction<RuntimeCallback>(
    'api contracts',
    apiContracts,
    'computeFetchRetryDelayMs',
  );
  const sleep = requireRecordFunction<RuntimeCallback>('api contracts', apiContracts, 'sleep');

  const createAuthClient = requireFn<RuntimeCallback>('createAuthClient', authClientModule.createAuthClient);
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

  const createImageVariants = requireFn<RuntimeCallback>(
    'createImageVariants',
    imageVariantsModule.createImageVariants,
  );
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
  normalizeAudioLocale: RuntimeCallback;
  normalizeAudioLocales: RuntimeCallback;
  sanitizePositiveInt: RuntimeCallback;
  normalizeTagList: RuntimeCallback;
  getAudioLocaleCountFromMap: RuntimeCallback;
  mergeAudioLocaleCountMap: RuntimeCallback;
  chunkArray: RuntimeCallback;
  parseCmsObjectRecord: RuntimeCallback;
  parseRatingPayload: RuntimeCallback;
  sanitizeRating: RuntimeCallback;
  sanitizeVotes: RuntimeCallback;
  getLocale: RuntimeCallback;
  parsePayloadDataEnvelope: RuntimeCallback;
  auditCmsObjectContract: RuntimeCallback;
};

function resolveRatingsRuntimeDependencyFns(
  corePrimitives: LooseRecord,
  apiContracts: LooseRecord,
): RatingsRuntimeDependencyFns {
  return {
    normalizeAudioLocale: requireRecordFunction<RuntimeCallback>(
      'core primitives',
      corePrimitives,
      'normalizeAudioLocale',
    ),
    normalizeAudioLocales: requireRecordFunction<RuntimeCallback>(
      'core primitives',
      corePrimitives,
      'normalizeAudioLocales',
    ),
    sanitizePositiveInt: requireRecordFunction<RuntimeCallback>(
      'core primitives',
      corePrimitives,
      'sanitizePositiveInt',
    ),
    normalizeTagList: requireRecordFunction<RuntimeCallback>('core primitives', corePrimitives, 'normalizeTagList'),
    getAudioLocaleCountFromMap: requireRecordFunction<RuntimeCallback>(
      'core primitives',
      corePrimitives,
      'getAudioLocaleCountFromMap',
    ),
    mergeAudioLocaleCountMap: requireRecordFunction<RuntimeCallback>(
      'core primitives',
      corePrimitives,
      'mergeAudioLocaleCountMap',
    ),
    chunkArray: requireRecordFunction<RuntimeCallback>('core primitives', corePrimitives, 'chunkArray'),
    parseCmsObjectRecord: requireRecordFunction<RuntimeCallback>(
      'core primitives',
      corePrimitives,
      'parseCmsObjectRecord',
    ),
    parseRatingPayload: requireRecordFunction<RuntimeCallback>('core primitives', corePrimitives, 'parseRatingPayload'),
    sanitizeRating: requireRecordFunction<RuntimeCallback>('core primitives', corePrimitives, 'sanitizeRating'),
    sanitizeVotes: requireRecordFunction<RuntimeCallback>('core primitives', corePrimitives, 'sanitizeVotes'),
    getLocale: requireRecordFunction<RuntimeCallback>('api contracts', apiContracts, 'getLocale'),
    parsePayloadDataEnvelope: requireRecordFunction<RuntimeCallback>(
      'api contracts',
      apiContracts,
      'parsePayloadDataEnvelope',
    ),
    auditCmsObjectContract: requireRecordFunction<RuntimeCallback>(
      'api contracts',
      apiContracts,
      'auditCmsObjectContract',
    ),
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

  const createRatingsClient = requireFn<RuntimeCallback>(
    'createRatingsClient',
    ratingsClientModule.createRatingsClient,
  );
  const ratingsClient = toRecord(
    createRatingsClient({
      fetchWithResilience: bindings.fetchWithResilience,
      getAccessToken: bindings.getAccessToken,
      createAuthRefreshHandler: bindings.createAuthRefreshHandler,
      resolveApiHref: bindings.resolveApiHref,
      normalizeAudioLocale: ratingsDependencyFns.normalizeAudioLocale,
      getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
      getLocale: ratingsDependencyFns.getLocale,
      parsePayloadDataEnvelope: ratingsDependencyFns.parsePayloadDataEnvelope,
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

  const createRatingsRepository = requireFn<RuntimeCallback>(
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
  dependencyOptions: DataInitializationDependencyOptions = {},
): DataInitializationRuntime {
  const dependencies = resolveDataInitializationDependencies(dependencyOptions);

  return {
    initializeTraceAndContracts: (context: LooseRecord, bindings: LooseRecord) =>
      initializeTraceAndContracts(context, bindings, requireFn),
    initializePreferredAudioAndStorage: (
      context: LooseRecord,
      bindings: LooseRecord,
      traceContractsRuntime: TraceContractsRuntime,
    ) => initializePreferredAudioAndStorage(context, bindings, traceContractsRuntime, dependencies, requireFn),
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
