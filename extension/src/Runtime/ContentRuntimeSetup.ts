(() => {
  type UnknownFn = (...args: unknown[]) => unknown;
  type RequireFunction = <T>(name: string, value: unknown) => T;
  type SetWatchlistCacheRowsFn = (
    accountId?: string,
    profileId?: string,
    rows?: unknown[],
    updatedAt?: number,
  ) => unknown;
  type WatchlistCacheSnapshotFactory = (
    accountId: string,
    profileId: string,
    updatedAt: number,
    rows: unknown[],
  ) => unknown;

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
    runtimeEvent: UnknownFn;
    pushApiTrace: UnknownFn;
    normalizeEntriesFromApiRows: UnknownFn;
    fetchWithResilience: UnknownFn;
    getAccessToken: UnknownFn;
    createAuthRefreshHandler: UnknownFn;
    fetchAllWatchlistRows: UnknownFn;
    normalizeStoredWatchlistCache: UnknownFn;
    isWatchlistCacheValid: UnknownFn;
    resetWatchlistCacheOnAccountMismatch: UnknownFn;
    fetchRatingsBatch: UnknownFn;
    fetchRating: UnknownFn;
    preloadRatingsForEntries: UnknownFn;
    fetchPreviewUrlForEntry: UnknownFn;
    normalizeStoredWatchHistoryCache: UnknownFn;
    isWatchHistoryCacheValid: UnknownFn;
    getCachedWatchHistory: UnknownFn;
    getCachedWatchHistoryProgress: UnknownFn;
    preloadWatchHistoryForEntries: UnknownFn;
    isLocalizedWatchHistoryDataMissingForEntries: UnknownFn;
    getCachedRating: UnknownFn;
    isLocalizedRatingDataMissingForEntries: UnknownFn;
    detectPreferredAudioLanguage: UnknownFn;
    ensureCuratedDataLoad: UnknownFn;
    renderCuratedPanel: UnknownFn;
    clearRootFrame: UnknownFn;
    setNativeVisibility: UnknownFn;
    applyTabUi: UnknownFn;
    ensureInterface: UnknownFn;
    listKnownSeries: UnknownFn;
    getCuratedDomStats: UnknownFn;
    dumpSeriesApiData: UnknownFn;
    resolveApiHref: UnknownFn;
    normalizeImageUrlCandidate: UnknownFn;
    extractCoverImagesFromApiImages: UnknownFn;
    extractThumbnailImageFromApiImages: UnknownFn;
    scheduleSaveRatings: UnknownFn;
    scheduleSaveWatchHistory: UnknownFn;
    scheduleSaveWatchlistCache: UnknownFn;
    getPreferredAudioLanguage: UnknownFn;
    preloadRatingsForSelectedAudioLocale: UnknownFn;
    preloadWatchHistoryForSelectedAudioLocale: UnknownFn;
    toggleCuratedFavorite: UnknownFn;
    removeCuratedSeries: UnknownFn;
    isLikelyVideoUrl: UnknownFn;
    isEntryWatchReady: UnknownFn;
    withMutedObserver: UnknownFn;
    applyCardLayoutUi: UnknownFn;
    persistSettings: UnknownFn;
    printSeriesApiData: UnknownFn;
    setWatchlistCacheRows: SetWatchlistCacheRowsFn;
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
    debounceProcess: UnknownFn;
    createEmptyWatchHistoryCache: () => unknown;
    createWatchlistCacheSnapshot: WatchlistCacheSnapshotFactory;
  };

  type SetupCompositionRuntime = {
    initializeCompositionBinding: (
      context: ContentRuntimeSetupContext,
      bindings: RuntimeBindings,
      corePrimitives: Record<string, unknown>,
      storageSet: (key: string, value: unknown) => unknown,
    ) => void;
    buildContentRuntimeSetupSuccess: (
      context: ContentRuntimeSetupContext,
      bindings: RuntimeBindings,
    ) => ContentRuntimeSetupResult;
  };

  type DataInitializationRuntime = {
    initializeTraceAndContracts: (
      context: ContentRuntimeSetupContext,
      bindings: RuntimeBindings,
    ) => TraceContractsRuntime;
    initializePreferredAudioAndStorage: (
      context: ContentRuntimeSetupContext,
      bindings: RuntimeBindings,
      traceContractsRuntime: TraceContractsRuntime,
    ) => StorageRuntime;
    initializeAuthImageAndRatings: (
      context: ContentRuntimeSetupContext,
      bindings: RuntimeBindings,
      traceContractsRuntime: TraceContractsRuntime,
    ) => void;
    initializeWatchlistHistoryAndPreview: (
      context: ContentRuntimeSetupContext,
      bindings: RuntimeBindings,
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

  function requireModuleWithFactory(
    ownerName: string,
    moduleValue: unknown,
    factoryName: string,
  ): Record<string, unknown> {
    const moduleRecord = toRecord(moduleValue);
    if (typeof moduleRecord[factoryName] !== 'function') {
      throw new Error(`[CW] Missing content runtime setup dependency: ${ownerName}.${factoryName}`);
    }
    return moduleRecord;
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
      runtimeContentRuntimeSetupCompositionModule: requireModuleWithFactory(
        'runtimeContentRuntimeSetupCompositionModule',
        options.runtimeContentRuntimeSetupCompositionModule,
        'createContentRuntimeSetupCompositionRuntime',
      ),
      runtimeContentRuntimeSetupDataInitializationModule: requireModuleWithFactory(
        'runtimeContentRuntimeSetupDataInitializationModule',
        options.runtimeContentRuntimeSetupDataInitializationModule,
        'createContentRuntimeSetupDataInitializationRuntime',
      ),
      defaultSettings: toRecord(options.defaultSettings),
      defaultSortMode: options.defaultSortMode,
      validSortModes: options.validSortModes,
      sortModeControlOptions: Array.isArray(options.sortModeControlOptions) ? options.sortModeControlOptions : [],
      storageLocalArea: options.storageLocalArea,
      isWatchlistPath: requireFunction<(pathname: string) => boolean>('isWatchlistPath', options.isWatchlistPath),
      debounceProcess: requireFunction<UnknownFn>('debounceProcess', options.debounceProcess),
      createEmptyWatchHistoryCache: requireFunction<() => unknown>(
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
    state: Record<string, unknown>,
    createWatchlistCacheSnapshot: WatchlistCacheSnapshotFactory,
  ): RuntimeBindings {
    const noop: UnknownFn = () => undefined;
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
      setWatchlistCacheRows: (accountId = '', profileId = '', rows: unknown[] = [], updatedAt = Date.now()) => {
        state.watchlistCache = createWatchlistCacheSnapshot(accountId, profileId, updatedAt, rows);
        return state.watchlistCache;
      },
    };
  }

  function createSetupCompositionRuntime(context: ContentRuntimeSetupContext): SetupCompositionRuntime {
    const createSetupRuntime = requireFunction<(options?: Record<string, unknown>) => Record<string, unknown>>(
      'createContentRuntimeSetupCompositionRuntime',
      context.runtimeContentRuntimeSetupCompositionModule.createContentRuntimeSetupCompositionRuntime,
    );
    const setupCompositionRuntime = createSetupRuntime({
      requireFunction: requireFunction as RequireFunction,
    });
    context.assertRuntimeMethods('content runtime setup composition runtime', setupCompositionRuntime, [
      'initializeCompositionBinding',
      'buildContentRuntimeSetupSuccess',
    ]);
    return setupCompositionRuntime as SetupCompositionRuntime;
  }

  function createDataInitializationRuntime(context: ContentRuntimeSetupContext): DataInitializationRuntime {
    const createDataInitializationRuntimeFactory = requireFunction<
      (options?: Record<string, unknown>) => Record<string, unknown>
    >(
      'createContentRuntimeSetupDataInitializationRuntime',
      context.runtimeContentRuntimeSetupDataInitializationModule.createContentRuntimeSetupDataInitializationRuntime,
    );
    const dataInitializationRuntime = createDataInitializationRuntimeFactory({
      requireFunction: requireFunction as RequireFunction,
    });
    context.assertRuntimeMethods('content runtime setup data initialization runtime', dataInitializationRuntime, [
      'initializeTraceAndContracts',
      'initializePreferredAudioAndStorage',
      'initializeAuthImageAndRatings',
      'initializeWatchlistHistoryAndPreview',
    ]);
    return dataInitializationRuntime as DataInitializationRuntime;
  }

  function createContentRuntimeSetup(options: ContentRuntimeSetupOptions = {}): ContentRuntimeSetupResult {
    try {
      const context = resolveContentRuntimeSetupContext(options);
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
