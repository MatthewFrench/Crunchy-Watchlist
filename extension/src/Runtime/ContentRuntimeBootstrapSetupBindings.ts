(() => {
  type AnyFn = (...args: unknown[]) => unknown;
  type LooseRecord = Record<string, unknown>;

  type RuntimeSetupBindingsConfig = {
    runtimeSetupResult: LooseRecord;
    setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void;
    setRuntimeSetupBindings: (runtimeSetupBindings: LooseRecord) => void;
  };

  type RuntimeSetupBindingsRuntime = {
    createRuntimeSetupOptions: (options: LooseRecord) => LooseRecord;
    applyRuntimeSetupBindings: (options: RuntimeSetupBindingsConfig) => void;
  };

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
    'setWatchlistCacheRows',
  ];

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord;
    };
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

  function toRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as LooseRecord;
  }

  function createRuntimeSetupModuleOptions(bootstrapModulesRuntime: unknown): LooseRecord {
    const modulesRuntime = toRecord(bootstrapModulesRuntime);
    return {
      runtimeTraceModule: modulesRuntime.runtimeTraceModule,
      runtimePreferredAudioModule: modulesRuntime.runtimePreferredAudioModule,
      storageModule: modulesRuntime.storageModule,
      apiContractsModule: modulesRuntime.apiContractsModule,
      authClientModule: modulesRuntime.authClientModule,
      watchlistClientModule: modulesRuntime.watchlistClientModule,
      watchlistRepositoryModule: modulesRuntime.watchlistRepositoryModule,
      historyRepositoryModule: modulesRuntime.historyRepositoryModule,
      ratingsClientModule: modulesRuntime.ratingsClientModule,
      ratingsRepositoryModule: modulesRuntime.ratingsRepositoryModule,
      previewRepositoryModule: modulesRuntime.previewRepositoryModule,
      corePrimitivesModule: modulesRuntime.corePrimitivesModule,
      imageVariantsModule: modulesRuntime.imageVariantsModule,
      entryNormalizerModule: modulesRuntime.entryNormalizerModule,
      sortMetricsModule: modulesRuntime.sortMetricsModule,
      entrySortingModule: modulesRuntime.entrySortingModule,
      cardMetadataModule: modulesRuntime.cardMetadataModule,
      controlsViewModule: modulesRuntime.controlsViewModule,
      cardViewModule: modulesRuntime.cardViewModule,
      cardShellModule: modulesRuntime.cardShellModule,
      runtimeRenderableModule: modulesRuntime.runtimeRenderableModule,
      runtimeCuratedPanelModule: modulesRuntime.runtimeCuratedPanelModule,
      runtimeCuratedLoaderModule: modulesRuntime.runtimeCuratedLoaderModule,
      runtimeNativeBridgeModule: modulesRuntime.runtimeNativeBridgeModule,
      runtimeCuratedInteractionsModule: modulesRuntime.runtimeCuratedInteractionsModule,
      runtimeInterfaceShellModule: modulesRuntime.runtimeInterfaceShellModule,
      runtimeDebugModule: modulesRuntime.runtimeDebugModule,
    };
  }

  function createRuntimeSetupOptions({
    windowRef,
    state,
    runtimeConstants,
    assertRuntimeMethods,
    runtimeBootstrapHelpersModule,
    runtimeBootstrapGateModule,
    runtimeBootstrapFinalizeModule,
    runtimeContentCompositionModule,
    defaultSettings,
    defaultSortMode,
    validSortModes,
    sortModeControlOptions,
    storageLocalArea,
    isWatchlistPath,
    debounceProcess,
    createEmptyWatchHistoryCache,
    createWatchlistCacheSnapshot,
    bootstrapModulesRuntime,
  }: LooseRecord): LooseRecord {
    return {
      ...createRuntimeSetupModuleOptions(bootstrapModulesRuntime),
      windowRef,
      state,
      runtimeConstants,
      assertRuntimeMethods,
      runtimeBootstrapHelpersModule,
      runtimeBootstrapGateModule,
      runtimeBootstrapFinalizeModule,
      runtimeContentCompositionModule,
      defaultSettings,
      defaultSortMode,
      validSortModes,
      sortModeControlOptions,
      storageLocalArea,
      isWatchlistPath,
      debounceProcess,
      createEmptyWatchHistoryCache,
      createWatchlistCacheSnapshot,
    };
  }

  function extractRuntimeSetupBindings(runtimeSetupResult: LooseRecord): LooseRecord {
    return runtimeSetupBindingKeys.reduce<LooseRecord>((bindings, key) => {
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
    setRuntimeEvent(runtimeSetupBindings.runtimeEvent as AnyFn);
    setRuntimeSetupBindings(runtimeSetupBindings);
  }

  function createContentRuntimeBootstrapSetupBindingsRuntime(): RuntimeSetupBindingsRuntime {
    return {
      createRuntimeSetupOptions,
      applyRuntimeSetupBindings,
    };
  }

  let runtimeRegistry = moduleRegistry.runtimeContentRuntimeBootstrapSetupBindings;
  if (!runtimeRegistry || typeof runtimeRegistry !== 'object') {
    runtimeRegistry = {};
    moduleRegistry.runtimeContentRuntimeBootstrapSetupBindings = runtimeRegistry;
  }

  (runtimeRegistry as LooseRecord).createContentRuntimeBootstrapSetupBindingsRuntime =
    createContentRuntimeBootstrapSetupBindingsRuntime;
})();
