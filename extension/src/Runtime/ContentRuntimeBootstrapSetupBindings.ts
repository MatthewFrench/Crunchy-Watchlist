type RuntimeBoundaryValue = CwBoundaryValue;
type RuntimeCallback = (...args: RuntimeBoundaryValue[]) => RuntimeBoundaryValue;

const runtimeSetupBindingKeys = [
  'runtimeEvent',
  'normalizeEntriesFromApiRows',
  'fetchWithResilience',
  'getAccessToken',
  'createAuthRefreshHandler',
  'fetchAllWatchlistRows',
  'normalizeStoredWatchlistCache',
  'isWatchlistCacheValid',
  'resetWatchlistCacheOnAccountMismatch',
  'preloadRatingsForEntries',
  'fetchPreviewUrlForEntry',
  'normalizeStoredWatchHistoryCache',
  'isWatchHistoryCacheValid',
  'getCachedWatchHistory',
  'getCachedWatchHistoryProgress',
  'preloadWatchHistoryForEntries',
  'isLocalizedWatchHistoryDataMissingForEntries',
  'getCachedRating',
  'isLocalizedRatingDataMissingForEntries',
  'detectPreferredAudioLanguage',
  'ensureCuratedDataLoad',
  'renderCuratedPanel',
  'clearRootFrame',
  'setNativeVisibility',
  'applyTabUi',
  'ensureInterface',
  'listKnownSeries',
  'getCuratedDomStats',
  'dumpSeriesApiData',
  'resolveApiHref',
  'normalizeImageUrlCandidate',
  'extractCoverImagesFromApiImages',
  'extractThumbnailImageFromApiImages',
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
  'printSeriesApiData',
  'dispose',
  'setWatchlistCacheRows',
] as const;

const setupModuleBindingKeys = [
  'runtimeTraceModule',
  'runtimePreferredAudioModule',
  'storageModule',
  'apiContractsModule',
  'authClientModule',
  'watchlistClientModule',
  'watchlistRepositoryModule',
  'historyRepositoryModule',
  'ratingsClientModule',
  'ratingsRepositoryModule',
  'previewRepositoryModule',
  'corePrimitivesModule',
  'imageVariantsModule',
  'entryNormalizerModule',
  'sortMetricsModule',
  'entrySortingModule',
  'cardMetadataModule',
  'controlsViewModule',
  'cardViewModule',
  'cardShellModule',
  'runtimeRenderableModule',
  'runtimeCuratedPanelModule',
  'runtimeCuratedLoaderModule',
  'runtimeNativeBridgeModule',
  'runtimeCuratedInteractionsModule',
  'runtimeInterfaceShellModule',
  'runtimeDebugModule',
] as const;

type RuntimeSetupBindingKey = (typeof runtimeSetupBindingKeys)[number];
type SetupModuleBindingKey = (typeof setupModuleBindingKeys)[number];
type RuntimeSetupResult = Partial<Record<RuntimeSetupBindingKey, RuntimeBoundaryValue>>;
type RuntimeSetupBindings = RuntimeSetupResult;
type RuntimeSetupModules = Partial<Record<SetupModuleBindingKey, RuntimeBoundaryValue>>;

type RuntimeSetupBindingsConfig = {
  runtimeSetupResult: RuntimeSetupResult;
  setRuntimeEvent: (nextRuntimeEvent: RuntimeCallback) => void;
  setRuntimeSetupBindings: (runtimeSetupBindings: RuntimeSetupBindings) => void;
};

type CreateRuntimeSetupOptionsInput = {
  windowRef: RuntimeBoundaryValue;
  state: RuntimeBoundaryValue;
  runtimeConstants: RuntimeBoundaryValue;
  assertRuntimeMethods: RuntimeBoundaryValue;
  defaultSettings: RuntimeBoundaryValue;
  defaultSortMode: RuntimeBoundaryValue;
  validSortModes: RuntimeBoundaryValue;
  sortModeControlOptions: RuntimeBoundaryValue;
  storageLocalArea: RuntimeBoundaryValue;
  isWatchlistPath: RuntimeBoundaryValue;
  getWatchlistRoot: RuntimeBoundaryValue;
  getWatchlistHeader: RuntimeBoundaryValue;
  debounceProcess: RuntimeBoundaryValue;
  createEmptyWatchHistoryCache: RuntimeBoundaryValue;
  createWatchlistCacheSnapshot: RuntimeBoundaryValue;
  bootstrapModulesRuntime: RuntimeBoundaryValue;
};

type RuntimeSetupOptions = RuntimeSetupModules & {
  windowRef: RuntimeBoundaryValue;
  state: RuntimeBoundaryValue;
  runtimeConstants: RuntimeBoundaryValue;
  assertRuntimeMethods: RuntimeBoundaryValue;
  defaultSettings: RuntimeBoundaryValue;
  defaultSortMode: RuntimeBoundaryValue;
  validSortModes: RuntimeBoundaryValue;
  sortModeControlOptions: RuntimeBoundaryValue;
  storageLocalArea: RuntimeBoundaryValue;
  isWatchlistPath: RuntimeBoundaryValue;
  getWatchlistRoot: RuntimeBoundaryValue;
  getWatchlistHeader: RuntimeBoundaryValue;
  debounceProcess: RuntimeBoundaryValue;
  createEmptyWatchHistoryCache: RuntimeBoundaryValue;
  createWatchlistCacheSnapshot: RuntimeBoundaryValue;
};

type RuntimeSetupBindingsRuntime = {
  createRuntimeSetupOptions: (options: CreateRuntimeSetupOptionsInput) => RuntimeSetupOptions;
  applyRuntimeSetupBindings: (options: RuntimeSetupBindingsConfig) => void;
};

const noopRuntimeCallback: RuntimeCallback = () => undefined;

function toRecord(value: RuntimeBoundaryValue): Record<string, RuntimeBoundaryValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, RuntimeBoundaryValue>;
}

function createRuntimeSetupModuleOptions(bootstrapModulesRuntime: RuntimeBoundaryValue): RuntimeSetupModules {
  const modulesRuntime = toRecord(bootstrapModulesRuntime);
  const runtimeSetupModules: RuntimeSetupModules = {};

  for (const moduleKey of setupModuleBindingKeys) {
    runtimeSetupModules[moduleKey] = modulesRuntime[moduleKey];
  }

  return runtimeSetupModules;
}

function createRuntimeSetupOptions({
  windowRef,
  state,
  runtimeConstants,
  assertRuntimeMethods,
  defaultSettings,
  defaultSortMode,
  validSortModes,
  sortModeControlOptions,
  storageLocalArea,
  isWatchlistPath,
  getWatchlistRoot,
  getWatchlistHeader,
  debounceProcess,
  createEmptyWatchHistoryCache,
  createWatchlistCacheSnapshot,
  bootstrapModulesRuntime,
}: CreateRuntimeSetupOptionsInput): RuntimeSetupOptions {
  return {
    ...createRuntimeSetupModuleOptions(bootstrapModulesRuntime),
    windowRef,
    state,
    runtimeConstants,
    assertRuntimeMethods,
    defaultSettings,
    defaultSortMode,
    validSortModes,
    sortModeControlOptions,
    storageLocalArea,
    isWatchlistPath,
    getWatchlistRoot,
    getWatchlistHeader,
    debounceProcess,
    createEmptyWatchHistoryCache,
    createWatchlistCacheSnapshot,
  };
}

function extractRuntimeSetupBindings(runtimeSetupResult: RuntimeSetupResult): RuntimeSetupBindings {
  return runtimeSetupBindingKeys.reduce<RuntimeSetupBindings>((bindings, key) => {
    bindings[key] = runtimeSetupResult[key];
    return bindings;
  }, {});
}

function applyRuntimeSetupBindings({
  runtimeSetupResult,
  setRuntimeEvent,
  setRuntimeSetupBindings,
}: RuntimeSetupBindingsConfig): void {
  const runtimeSetupBindings = extractRuntimeSetupBindings(runtimeSetupResult);
  const runtimeEvent =
    typeof runtimeSetupBindings.runtimeEvent === 'function'
      ? (runtimeSetupBindings.runtimeEvent as RuntimeCallback)
      : noopRuntimeCallback;
  setRuntimeEvent(runtimeEvent);
  setRuntimeSetupBindings(runtimeSetupBindings);
}

export function createContentRuntimeBootstrapSetupBindingsRuntime(): RuntimeSetupBindingsRuntime {
  return {
    createRuntimeSetupOptions,
    applyRuntimeSetupBindings,
  };
}
