import { createContentComposition as createContentCompositionFactory } from './ContentComposition.js';
import { createContentRuntimeSetupCompositionRuntime as createContentRuntimeSetupCompositionRuntimeFactory } from './ContentRuntimeSetupComposition.js';
import { createContentRuntimeSetupDataInitializationRuntime as createContentRuntimeSetupDataInitializationRuntimeFactory } from './ContentRuntimeSetupDataInitialization.js';
import type { DataInitializationRuntime } from './ContentRuntimeSetupDataInitializationPhases.js';

type RuntimeBoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, RuntimeBoundaryValue>;
type RuntimeBindingHandler = (...args: RuntimeBoundaryValue[]) => RuntimeBoundaryValue;
type RequireFunction = <T>(name: string, value: RuntimeBoundaryValue) => T;
type SetWatchlistCacheRowsFn = (
  accountId?: string,
  profileId?: string,
  rows?: RuntimeBoundaryValue[],
  updatedAt?: number,
) => RuntimeBoundaryValue;
type WatchlistCacheSnapshotFactory = (
  accountId: string,
  profileId: string,
  updatedAt: number,
  rows: RuntimeBoundaryValue[],
) => RuntimeBoundaryValue;

type ContentRuntimeSetupResult =
  | ({
      ok: true;
    } & LooseRecord)
  | {
      ok: false;
      message: string;
    };

type ContentRuntimeSetupOptions = {
  windowRef?: RuntimeBoundaryValue;
  state?: RuntimeBoundaryValue;
  runtimeConstants?: RuntimeBoundaryValue;
  assertRuntimeMethods?: RuntimeBoundaryValue;
  runtimeTraceModule?: RuntimeBoundaryValue;
  runtimePreferredAudioModule?: RuntimeBoundaryValue;
  storageModule?: RuntimeBoundaryValue;
  apiContractsModule?: RuntimeBoundaryValue;
  authClientModule?: RuntimeBoundaryValue;
  watchlistClientModule?: RuntimeBoundaryValue;
  watchlistRepositoryModule?: RuntimeBoundaryValue;
  historyRepositoryModule?: RuntimeBoundaryValue;
  ratingsClientModule?: RuntimeBoundaryValue;
  ratingsRepositoryModule?: RuntimeBoundaryValue;
  previewRepositoryModule?: RuntimeBoundaryValue;
  corePrimitivesModule?: RuntimeBoundaryValue;
  imageVariantsModule?: RuntimeBoundaryValue;
  entryNormalizerModule?: RuntimeBoundaryValue;
  sortMetricsModule?: RuntimeBoundaryValue;
  entrySortingModule?: RuntimeBoundaryValue;
  cardMetadataModule?: RuntimeBoundaryValue;
  controlsViewModule?: RuntimeBoundaryValue;
  cardViewModule?: RuntimeBoundaryValue;
  cardShellModule?: RuntimeBoundaryValue;
  runtimeRenderableModule?: RuntimeBoundaryValue;
  runtimeCuratedPanelModule?: RuntimeBoundaryValue;
  runtimeCuratedLoaderModule?: RuntimeBoundaryValue;
  runtimeNativeBridgeModule?: RuntimeBoundaryValue;
  runtimeCuratedInteractionsModule?: RuntimeBoundaryValue;
  runtimeInterfaceShellModule?: RuntimeBoundaryValue;
  runtimeDebugModule?: RuntimeBoundaryValue;
  createContentComposition?: RuntimeBoundaryValue;
  createContentRuntimeSetupCompositionRuntime?: RuntimeBoundaryValue;
  createContentRuntimeSetupDataInitializationRuntime?: RuntimeBoundaryValue;
  defaultSettings?: RuntimeBoundaryValue;
  defaultSortMode?: RuntimeBoundaryValue;
  validSortModes?: RuntimeBoundaryValue;
  sortModeControlOptions?: RuntimeBoundaryValue;
  storageLocalArea?: RuntimeBoundaryValue;
  isWatchlistPath?: RuntimeBoundaryValue;
  getWatchlistRoot?: RuntimeBoundaryValue;
  getWatchlistHeader?: RuntimeBoundaryValue;
  debounceProcess?: RuntimeBoundaryValue;
  createEmptyWatchHistoryCache?: RuntimeBoundaryValue;
  createWatchlistCacheSnapshot?: RuntimeBoundaryValue;
};

type RuntimeBindings = {
  runtimeEvent: RuntimeBindingHandler;
  pushApiTrace: RuntimeBindingHandler;
  normalizeEntriesFromApiRows: RuntimeBindingHandler;
  fetchWithResilience: RuntimeBindingHandler;
  getAccessToken: RuntimeBindingHandler;
  createAuthRefreshHandler: RuntimeBindingHandler;
  fetchAllWatchlistRows: RuntimeBindingHandler;
  normalizeStoredWatchlistCache: RuntimeBindingHandler;
  isWatchlistCacheValid: RuntimeBindingHandler;
  resetWatchlistCacheOnAccountMismatch: RuntimeBindingHandler;
  fetchRatingsBatch: RuntimeBindingHandler;
  fetchRating: RuntimeBindingHandler;
  preloadRatingsForEntries: RuntimeBindingHandler;
  fetchPreviewUrlForEntry: RuntimeBindingHandler;
  normalizeStoredWatchHistoryCache: RuntimeBindingHandler;
  isWatchHistoryCacheValid: RuntimeBindingHandler;
  getCachedWatchHistory: RuntimeBindingHandler;
  getCachedWatchHistoryProgress: RuntimeBindingHandler;
  preloadWatchHistoryForEntries: RuntimeBindingHandler;
  isLocalizedWatchHistoryDataMissingForEntries: RuntimeBindingHandler;
  getCachedRating: RuntimeBindingHandler;
  isLocalizedRatingDataMissingForEntries: RuntimeBindingHandler;
  detectPreferredAudioLanguage: RuntimeBindingHandler;
  ensureCuratedDataLoad: RuntimeBindingHandler;
  renderCuratedPanel: RuntimeBindingHandler;
  clearRootFrame: RuntimeBindingHandler;
  setNativeVisibility: RuntimeBindingHandler;
  applyTabUi: RuntimeBindingHandler;
  ensureInterface: RuntimeBindingHandler;
  listKnownSeries: RuntimeBindingHandler;
  getCuratedDomStats: RuntimeBindingHandler;
  dumpSeriesApiData: RuntimeBindingHandler;
  resolveApiHref: RuntimeBindingHandler;
  normalizeImageUrlCandidate: RuntimeBindingHandler;
  extractCoverImagesFromApiImages: RuntimeBindingHandler;
  extractThumbnailImageFromApiImages: RuntimeBindingHandler;
  scheduleSaveRatings: RuntimeBindingHandler;
  scheduleSaveWatchHistory: RuntimeBindingHandler;
  scheduleSaveWatchlistCache: RuntimeBindingHandler;
  getPreferredAudioLanguage: RuntimeBindingHandler;
  preloadRatingsForSelectedAudioLocale: RuntimeBindingHandler;
  preloadWatchHistoryForSelectedAudioLocale: RuntimeBindingHandler;
  toggleCuratedFavorite: RuntimeBindingHandler;
  removeCuratedSeries: RuntimeBindingHandler;
  isLikelyVideoUrl: RuntimeBindingHandler;
  isEntryWatchReady: RuntimeBindingHandler;
  withMutedObserver: RuntimeBindingHandler;
  applyCardLayoutUi: RuntimeBindingHandler;
  persistSettings: RuntimeBindingHandler;
  printSeriesApiData: RuntimeBindingHandler;
  dispose: RuntimeBindingHandler;
  setWatchlistCacheRows: SetWatchlistCacheRowsFn;
};

type RuntimeSetupState = LooseRecord & {
  watchlistCache?: RuntimeBoundaryValue;
};

type CreateContentCompositionFactory = typeof createContentCompositionFactory;
type CreateContentRuntimeSetupCompositionRuntimeFactory = typeof createContentRuntimeSetupCompositionRuntimeFactory;
type CreateContentRuntimeSetupDataInitializationRuntimeFactory =
  typeof createContentRuntimeSetupDataInitializationRuntimeFactory;

type ContentRuntimeSetupContext = {
  windowRef: Window;
  state: RuntimeSetupState;
  runtimeConstants: LooseRecord;
  assertRuntimeMethods: (ownerLabel: string, instance: RuntimeBoundaryValue, methodNames: string[]) => void;
  runtimeTraceModule: LooseRecord;
  runtimePreferredAudioModule: LooseRecord;
  storageModule: LooseRecord;
  apiContractsModule: LooseRecord;
  authClientModule: LooseRecord;
  watchlistClientModule: LooseRecord;
  watchlistRepositoryModule: LooseRecord;
  historyRepositoryModule: LooseRecord;
  ratingsClientModule: LooseRecord;
  ratingsRepositoryModule: LooseRecord;
  previewRepositoryModule: LooseRecord;
  corePrimitivesModule: LooseRecord;
  imageVariantsModule: LooseRecord;
  entryNormalizerModule: LooseRecord;
  sortMetricsModule: LooseRecord;
  entrySortingModule: LooseRecord;
  cardMetadataModule: LooseRecord;
  controlsViewModule: LooseRecord;
  cardViewModule: LooseRecord;
  cardShellModule: LooseRecord;
  runtimeRenderableModule: LooseRecord;
  runtimeCuratedPanelModule: LooseRecord;
  runtimeCuratedLoaderModule: LooseRecord;
  runtimeNativeBridgeModule: LooseRecord;
  runtimeCuratedInteractionsModule: LooseRecord;
  runtimeInterfaceShellModule: LooseRecord;
  runtimeDebugModule: LooseRecord;
  createContentComposition: CreateContentCompositionFactory;
  createContentRuntimeSetupCompositionRuntime: CreateContentRuntimeSetupCompositionRuntimeFactory;
  createContentRuntimeSetupDataInitializationRuntime: CreateContentRuntimeSetupDataInitializationRuntimeFactory;
  defaultSettings: LooseRecord;
  defaultSortMode: RuntimeBoundaryValue;
  validSortModes: RuntimeBoundaryValue;
  sortModeControlOptions: RuntimeBoundaryValue[];
  storageLocalArea: RuntimeBoundaryValue;
  isWatchlistPath: (pathname: string) => boolean;
  getWatchlistRoot: (documentRef: Document) => Element | null;
  getWatchlistHeader: (documentRef: Document) => Element | null;
  debounceProcess: RuntimeBindingHandler;
  createEmptyWatchHistoryCache: () => RuntimeBoundaryValue;
  createWatchlistCacheSnapshot: WatchlistCacheSnapshotFactory;
};

type SetupCompositionRuntime = {
  initializeCompositionBinding: (
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
    corePrimitives: LooseRecord,
    storageSet: (key: string, value: RuntimeBoundaryValue) => RuntimeBoundaryValue,
  ) => void;
  buildContentRuntimeSetupSuccess: (
    context: ContentRuntimeSetupContext,
    bindings: RuntimeBindings,
  ) => ContentRuntimeSetupResult;
};

type ContentRuntimeSetupModuleBindings = Pick<
  ContentRuntimeSetupContext,
  | 'runtimeTraceModule'
  | 'runtimePreferredAudioModule'
  | 'storageModule'
  | 'apiContractsModule'
  | 'authClientModule'
  | 'watchlistClientModule'
  | 'watchlistRepositoryModule'
  | 'historyRepositoryModule'
  | 'ratingsClientModule'
  | 'ratingsRepositoryModule'
  | 'previewRepositoryModule'
  | 'corePrimitivesModule'
  | 'imageVariantsModule'
  | 'entryNormalizerModule'
  | 'sortMetricsModule'
  | 'entrySortingModule'
  | 'cardMetadataModule'
  | 'controlsViewModule'
  | 'cardViewModule'
  | 'cardShellModule'
  | 'runtimeRenderableModule'
  | 'runtimeCuratedPanelModule'
  | 'runtimeCuratedLoaderModule'
  | 'runtimeNativeBridgeModule'
  | 'runtimeCuratedInteractionsModule'
  | 'runtimeInterfaceShellModule'
  | 'runtimeDebugModule'
>;

type ContentRuntimeSetupFactories = Pick<
  ContentRuntimeSetupContext,
  | 'createContentComposition'
  | 'createContentRuntimeSetupCompositionRuntime'
  | 'createContentRuntimeSetupDataInitializationRuntime'
>;

function requireFunction<T>(name: string, value: RuntimeBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing content runtime setup dependency: ${name}`);
  }
  return value as T;
}

function toRecord(value: RuntimeBoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function toContentRuntimeSetupOptions(value: RuntimeBoundaryValue): ContentRuntimeSetupOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as ContentRuntimeSetupOptions;
}

function toWindowRef(value: RuntimeBoundaryValue): Window {
  if (value && typeof value === 'object') {
    return value as Window;
  }
  return window;
}

function resolveContentRuntimeSetupModuleBindings(
  options: ContentRuntimeSetupOptions,
): ContentRuntimeSetupModuleBindings {
  return {
    runtimeTraceModule: toRecord(options.runtimeTraceModule),
    runtimePreferredAudioModule: toRecord(options.runtimePreferredAudioModule),
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
  };
}

function resolveContentRuntimeSetupFactories(options: ContentRuntimeSetupOptions): ContentRuntimeSetupFactories {
  return {
    createContentComposition: requireFunction<CreateContentCompositionFactory>(
      'createContentComposition',
      options.createContentComposition ?? createContentCompositionFactory,
    ),
    createContentRuntimeSetupCompositionRuntime: requireFunction<CreateContentRuntimeSetupCompositionRuntimeFactory>(
      'createContentRuntimeSetupCompositionRuntime',
      options.createContentRuntimeSetupCompositionRuntime ?? createContentRuntimeSetupCompositionRuntimeFactory,
    ),
    createContentRuntimeSetupDataInitializationRuntime:
      requireFunction<CreateContentRuntimeSetupDataInitializationRuntimeFactory>(
        'createContentRuntimeSetupDataInitializationRuntime',
        options.createContentRuntimeSetupDataInitializationRuntime ??
          createContentRuntimeSetupDataInitializationRuntimeFactory,
      ),
  };
}

function resolveContentRuntimeSetupContext(options: ContentRuntimeSetupOptions): ContentRuntimeSetupContext {
  return {
    windowRef: toWindowRef(options.windowRef),
    state: toRecord(options.state),
    runtimeConstants: toRecord(options.runtimeConstants),
    assertRuntimeMethods: requireFunction<
      (ownerLabel: string, instance: RuntimeBoundaryValue, methodNames: string[]) => void
    >('assertRuntimeMethods', options.assertRuntimeMethods),
    ...resolveContentRuntimeSetupModuleBindings(options),
    ...resolveContentRuntimeSetupFactories(options),
    defaultSettings: toRecord(options.defaultSettings),
    defaultSortMode: options.defaultSortMode,
    validSortModes: options.validSortModes,
    sortModeControlOptions: Array.isArray(options.sortModeControlOptions) ? options.sortModeControlOptions : [],
    storageLocalArea: options.storageLocalArea,
    isWatchlistPath: requireFunction<(pathname: string) => boolean>('isWatchlistPath', options.isWatchlistPath),
    getWatchlistRoot: requireFunction<(documentRef: Document) => Element | null>(
      'getWatchlistRoot',
      options.getWatchlistRoot,
    ),
    getWatchlistHeader: requireFunction<(documentRef: Document) => Element | null>(
      'getWatchlistHeader',
      options.getWatchlistHeader,
    ),
    debounceProcess: requireFunction<RuntimeBindingHandler>('debounceProcess', options.debounceProcess),
    createEmptyWatchHistoryCache: requireFunction<() => RuntimeBoundaryValue>(
      'createEmptyWatchHistoryCache',
      options.createEmptyWatchHistoryCache,
    ),
    createWatchlistCacheSnapshot: requireFunction<WatchlistCacheSnapshotFactory>(
      'createWatchlistCacheSnapshot',
      options.createWatchlistCacheSnapshot,
    ),
  };
}

function createContentRuntimeBindings(
  state: RuntimeSetupState,
  createWatchlistCacheSnapshot: WatchlistCacheSnapshotFactory,
): RuntimeBindings {
  const noop: RuntimeBindingHandler = () => undefined;
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
    getCuratedDomStats: noop,
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
    dispose: noop,
    setWatchlistCacheRows: (
      accountId = '',
      profileId = '',
      rows: RuntimeBoundaryValue[] = [],
      updatedAt = Date.now(),
    ) => {
      state.watchlistCache = createWatchlistCacheSnapshot(accountId, profileId, updatedAt, rows);
      return state.watchlistCache;
    },
  };
}

function createSetupCompositionRuntime(context: ContentRuntimeSetupContext): SetupCompositionRuntime {
  const createSetupRuntime = requireFunction<CreateContentRuntimeSetupCompositionRuntimeFactory>(
    'createContentRuntimeSetupCompositionRuntime',
    context.createContentRuntimeSetupCompositionRuntime,
  );
  const setupCompositionRuntime = toRecord(
    createSetupRuntime({
      requireFunction: requireFunction as RequireFunction,
    }),
  );
  context.assertRuntimeMethods('content runtime setup composition runtime', setupCompositionRuntime, [
    'initializeCompositionBinding',
    'buildContentRuntimeSetupSuccess',
  ]);
  return setupCompositionRuntime as SetupCompositionRuntime;
}

function createDataInitializationRuntime(context: ContentRuntimeSetupContext): DataInitializationRuntime {
  const createDataInitializationRuntimeFactory =
    requireFunction<CreateContentRuntimeSetupDataInitializationRuntimeFactory>(
      'createContentRuntimeSetupDataInitializationRuntime',
      context.createContentRuntimeSetupDataInitializationRuntime,
    );
  const dataInitializationRuntime = toRecord(
    createDataInitializationRuntimeFactory({
      requireFunction: requireFunction as RequireFunction,
    }),
  );
  context.assertRuntimeMethods('content runtime setup data initialization runtime', dataInitializationRuntime, [
    'initializeTraceAndContracts',
    'initializePreferredAudioAndStorage',
    'initializeAuthImageAndRatings',
    'initializeWatchlistHistoryAndPreview',
  ]);
  return dataInitializationRuntime as DataInitializationRuntime;
}

export function createContentRuntimeSetup(options: RuntimeBoundaryValue = {}): ContentRuntimeSetupResult {
  try {
    const context = resolveContentRuntimeSetupContext(toContentRuntimeSetupOptions(options));
    const bindings = createContentRuntimeBindings(context.state, context.createWatchlistCacheSnapshot);
    const setupCompositionRuntime = createSetupCompositionRuntime(context);
    const dataInitializationRuntime = createDataInitializationRuntime(context);
    const traceContractsRuntime = dataInitializationRuntime.initializeTraceAndContracts(context, bindings);
    const storageRuntime = dataInitializationRuntime.initializePreferredAudioAndStorage(
      context,
      bindings,
      traceContractsRuntime,
    );
    dataInitializationRuntime.initializeAuthImageAndRatings(context, bindings, traceContractsRuntime);
    dataInitializationRuntime.initializeWatchlistHistoryAndPreview(context, bindings, traceContractsRuntime);
    setupCompositionRuntime.initializeCompositionBinding(
      context,
      bindings,
      traceContractsRuntime.corePrimitives,
      storageRuntime.storageSet,
    );
    return setupCompositionRuntime.buildContentRuntimeSetupSuccess(context, bindings);
  } catch (error) {
    const errorMessage = (error as { message?: RuntimeBoundaryValue })?.message;
    return {
      ok: false,
      message: errorMessage ? String(errorMessage) : 'unavailable',
    };
  }
}
