(() => {
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic composition-root wiring requires permissive factory return typing.
  type AnyFn = (...args: unknown[]) => any;

  type ContentRuntimeSetupResult =
    | ({
        ok: true;
      } & Record<string, unknown>)
    | {
        ok: false;
        message: string;
      };

  type ContentRuntimeSetupOptions = Record<string, unknown>;

  type TraceContractsRuntime = {
    corePrimitives: Record<string, unknown>;
    apiContracts: Record<string, unknown>;
  };

  type StorageRuntime = {
    storageSet: (key: string, value: unknown) => unknown;
  };

  type RuntimeBindings = {
    runtimeEvent: AnyFn;
    pushApiTrace: AnyFn;
    normalizeEntriesFromApiRows: AnyFn;
    fetchWithResilience: AnyFn;
    getAccessToken: AnyFn;
    createAuthRefreshHandler: AnyFn;
    fetchAllWatchlistRows: AnyFn;
    normalizeStoredWatchlistCache: AnyFn;
    isWatchlistCacheValid: AnyFn;
    resetWatchlistCacheOnAccountMismatch: AnyFn;
    fetchRatingsBatch: AnyFn;
    fetchRating: AnyFn;
    preloadRatingsForEntries: AnyFn;
    fetchPreviewUrlForEntry: AnyFn;
    normalizeStoredWatchHistoryCache: AnyFn;
    isWatchHistoryCacheValid: AnyFn;
    getCachedWatchHistory: AnyFn;
    getCachedWatchHistoryProgress: AnyFn;
    preloadWatchHistoryForEntries: AnyFn;
    isLocalizedWatchHistoryDataMissingForEntries: AnyFn;
    getCachedRating: AnyFn;
    isLocalizedRatingDataMissingForEntries: AnyFn;
    detectPreferredAudioLanguage: AnyFn;
    ensureCuratedDataLoad: AnyFn;
    renderCuratedPanel: AnyFn;
    clearRootFrame: AnyFn;
    setNativeVisibility: AnyFn;
    applyTabUi: AnyFn;
    ensureInterface: AnyFn;
    listKnownSeries: AnyFn;
    getCuratedDomStats: AnyFn;
    dumpSeriesApiData: AnyFn;
    resolveApiHref: AnyFn;
    normalizeImageUrlCandidate: AnyFn;
    extractCoverImagesFromApiImages: AnyFn;
    extractThumbnailImageFromApiImages: AnyFn;
    scheduleSaveRatings: AnyFn;
    scheduleSaveWatchHistory: AnyFn;
    scheduleSaveWatchlistCache: AnyFn;
    getPreferredAudioLanguage: AnyFn;
    preloadRatingsForSelectedAudioLocale: AnyFn;
    preloadWatchHistoryForSelectedAudioLocale: AnyFn;
    toggleCuratedFavorite: AnyFn;
    removeCuratedSeries: AnyFn;
    isLikelyVideoUrl: AnyFn;
    isEntryWatchReady: AnyFn;
    withMutedObserver: AnyFn;
    applyCardLayoutUi: AnyFn;
    persistSettings: AnyFn;
    printSeriesApiData: AnyFn;
    setWatchlistCacheRows: AnyFn;
  };

  type ContentRuntimeSetupContext = {
    windowRef: Window;
    state: Record<string, unknown>;
    runtimeConstants: Record<string, unknown>;
    assertRuntimeMethods: (ownerLabel: string, instance: unknown, methodNames: string[]) => void;
    runtimeTraceModule: Record<string, unknown>;
    runtimePreferredAudioModule: Record<string, unknown>;
    runtimeBootstrapHelpersModule: Record<string, unknown>;
    runtimeBootstrapGateModule: Record<string, unknown>;
    runtimeBootstrapFinalizeModule: Record<string, unknown>;
    storageModule: Record<string, unknown>;
    apiContractsModule: Record<string, unknown>;
    authClientModule: Record<string, unknown>;
    watchlistClientModule: Record<string, unknown>;
    watchlistRepositoryModule: Record<string, unknown>;
    historyRepositoryModule: Record<string, unknown>;
    ratingsClientModule: Record<string, unknown>;
    ratingsRepositoryModule: Record<string, unknown>;
    previewRepositoryModule: Record<string, unknown>;
    corePrimitivesModule: Record<string, unknown>;
    imageVariantsModule: Record<string, unknown>;
    entryNormalizerModule: Record<string, unknown>;
    sortMetricsModule: Record<string, unknown>;
    entrySortingModule: Record<string, unknown>;
    cardMetadataModule: Record<string, unknown>;
    controlsViewModule: Record<string, unknown>;
    cardViewModule: Record<string, unknown>;
    cardShellModule: Record<string, unknown>;
    runtimeRenderableModule: Record<string, unknown>;
    runtimeCuratedPanelModule: Record<string, unknown>;
    runtimeCuratedLoaderModule: Record<string, unknown>;
    runtimeNativeBridgeModule: Record<string, unknown>;
    runtimeCuratedInteractionsModule: Record<string, unknown>;
    runtimeInterfaceShellModule: Record<string, unknown>;
    runtimeDebugModule: Record<string, unknown>;
    runtimeContentCompositionModule: Record<string, unknown>;
    runtimeContentRuntimeSetupCompositionModule: Record<string, unknown>;
    runtimeContentRuntimeSetupDataInitializationModule: Record<string, unknown>;
    defaultSettings: Record<string, unknown>;
    defaultSortMode: unknown;
    validSortModes: unknown;
    sortModeControlOptions: unknown[];
    storageLocalArea: unknown;
    isWatchlistPath: (pathname: string) => boolean;
    debounceProcess: AnyFn;
    createEmptyWatchHistoryCache: AnyFn;
    createWatchlistCacheSnapshot: AnyFn;
  };

  type SetupCompositionRuntime = {
    initializeCompositionBinding: (
      context: Record<string, unknown>,
      bindings: Record<string, unknown>,
      corePrimitives: Record<string, unknown>,
      storageSet: (key: string, value: unknown) => unknown,
    ) => void;
    buildContentRuntimeSetupSuccess: (
      context: Record<string, unknown>,
      bindings: Record<string, unknown>,
    ) => ContentRuntimeSetupResult;
  };

  type DataInitializationRuntime = {
    initializeTraceAndContracts: (
      context: Record<string, unknown>,
      bindings: Record<string, unknown>,
    ) => TraceContractsRuntime;
    initializePreferredAudioAndStorage: (
      context: Record<string, unknown>,
      bindings: Record<string, unknown>,
      traceContractsRuntime: TraceContractsRuntime,
    ) => StorageRuntime;
    initializeAuthImageAndRatings: (
      context: Record<string, unknown>,
      bindings: Record<string, unknown>,
      traceContractsRuntime: TraceContractsRuntime,
    ) => void;
    initializeWatchlistHistoryAndPreview: (
      context: Record<string, unknown>,
      bindings: Record<string, unknown>,
      traceContractsRuntime: TraceContractsRuntime,
    ) => void;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing content runtime setup dependency: ${name}`);
    }
    return value as T;
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return value as Record<string, unknown>;
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
      runtimeContentRuntimeSetupDataInitializationModule: toRecord(
        options.runtimeContentRuntimeSetupDataInitializationModule ??
          moduleRegistry.runtimeContentRuntimeSetupDataInitialization,
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
    };
  }

  function createContentRuntimeBindings(
    state: Record<string, unknown>,
    createWatchlistCacheSnapshot: AnyFn,
  ): RuntimeBindings {
    const noop: AnyFn = () => undefined;
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
      setWatchlistCacheRows: ((accountId = '', profileId = '', rows: unknown[] = [], updatedAt = Date.now()) => {
        state.watchlistCache = createWatchlistCacheSnapshot(accountId, profileId, updatedAt, rows);
        return state.watchlistCache;
      }) as AnyFn,
    };
  }

  function createSetupCompositionRuntime(context: ContentRuntimeSetupContext): SetupCompositionRuntime {
    const setupCompositionRuntime = requireFunction<AnyFn>(
      'createContentRuntimeSetupCompositionRuntime',
      context.runtimeContentRuntimeSetupCompositionModule.createContentRuntimeSetupCompositionRuntime,
    )({
      requireFunction,
    }) as Record<string, unknown>;
    context.assertRuntimeMethods('content runtime setup composition runtime', setupCompositionRuntime, [
      'initializeCompositionBinding',
      'buildContentRuntimeSetupSuccess',
    ]);
    return setupCompositionRuntime as unknown as SetupCompositionRuntime;
  }

  function createDataInitializationRuntime(context: ContentRuntimeSetupContext): DataInitializationRuntime {
    const dataInitializationRuntime = requireFunction<AnyFn>(
      'createContentRuntimeSetupDataInitializationRuntime',
      context.runtimeContentRuntimeSetupDataInitializationModule.createContentRuntimeSetupDataInitializationRuntime,
    )({
      requireFunction,
    }) as Record<string, unknown>;
    context.assertRuntimeMethods('content runtime setup data initialization runtime', dataInitializationRuntime, [
      'initializeTraceAndContracts',
      'initializePreferredAudioAndStorage',
      'initializeAuthImageAndRatings',
      'initializeWatchlistHistoryAndPreview',
    ]);
    return dataInitializationRuntime as unknown as DataInitializationRuntime;
  }

  function createContentRuntimeSetup(options: ContentRuntimeSetupOptions = {}): ContentRuntimeSetupResult {
    const context = resolveContentRuntimeSetupContext(options);
    const bindings = createContentRuntimeBindings(context.state, context.createWatchlistCacheSnapshot);

    try {
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
        context as unknown as Record<string, unknown>,
        bindings as unknown as Record<string, unknown>,
        traceContractsRuntime.corePrimitives as Record<string, unknown>,
        storageRuntime.storageSet,
      );
      return setupCompositionRuntime.buildContentRuntimeSetupSuccess(
        context as unknown as Record<string, unknown>,
        bindings as unknown as Record<string, unknown>,
      ) as ContentRuntimeSetupResult;
    } catch (error) {
      return {
        ok: false,
        message: (error as { message?: unknown })?.message
          ? String((error as { message?: unknown }).message)
          : 'unknown',
      };
    }
  }

  moduleRegistry.runtimeContentRuntimeSetup = {
    createContentRuntimeSetup,
  };
})();
