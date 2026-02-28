import { createContentComposition as createContentCompositionFactory } from './ContentComposition.js';

let createContentRuntimeSetupCompositionRuntimeFactory: ((options?: LooseRecord) => LooseRecord) | null = null;

(() => {
  type LooseRecord = Record<string, unknown>;
  type RequireFunction = <T>(name: string, value: unknown) => T;

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing content runtime setup composition dependency: ${name}`);
    }
    return value as T;
  }

  function createCompositionModulesInternal(context: LooseRecord): LooseRecord {
    return {
      entryNormalizerModule: context.entryNormalizerModule,
      sortMetricsModule: context.sortMetricsModule,
      entrySortingModule: context.entrySortingModule,
      cardMetadataModule: context.cardMetadataModule,
      controlsViewModule: context.controlsViewModule,
      cardViewModule: context.cardViewModule,
      cardShellModule: context.cardShellModule,
      runtimeRenderableModule: context.runtimeRenderableModule,
      runtimeCuratedPanelModule: context.runtimeCuratedPanelModule,
      runtimeCuratedLoaderModule: context.runtimeCuratedLoaderModule,
      runtimeNativeBridgeModule: context.runtimeNativeBridgeModule,
      runtimeCuratedInteractionsModule: context.runtimeCuratedInteractionsModule,
      runtimeInterfaceShellModule: context.runtimeInterfaceShellModule,
      runtimeDebugModule: context.runtimeDebugModule,
    };
  }

  function createCompositionDependenciesInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    storageSet: (key: string, value: unknown) => unknown,
    requireFn: RequireFunction,
  ): LooseRecord {
    return {
      extractCoverImagesFromApiImages: bindings.extractCoverImagesFromApiImages,
      extractThumbnailImageFromApiImages: bindings.extractThumbnailImageFromApiImages,
      normalizeImageUrlCandidate: bindings.normalizeImageUrlCandidate,
      getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
      getCachedRating: bindings.getCachedRating,
      getCachedWatchHistory: bindings.getCachedWatchHistory,
      getCachedWatchHistoryProgress: bindings.getCachedWatchHistoryProgress,
      isEntryWatchReady: bindings.isEntryWatchReady,
      isLocalizedRatingDataMissingForEntries: bindings.isLocalizedRatingDataMissingForEntries,
      isLocalizedWatchHistoryDataMissingForEntries: bindings.isLocalizedWatchHistoryDataMissingForEntries,
      preloadRatingsForSelectedAudioLocale: bindings.preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale: bindings.preloadWatchHistoryForSelectedAudioLocale,
      getAccessToken: bindings.getAccessToken,
      fetchWithResilience: bindings.fetchWithResilience,
      createAuthRefreshHandler: bindings.createAuthRefreshHandler,
      resetWatchlistCacheOnAccountMismatch: bindings.resetWatchlistCacheOnAccountMismatch,
      fetchAllWatchlistRows: bindings.fetchAllWatchlistRows,
      preloadRatingsForEntries: bindings.preloadRatingsForEntries,
      preloadWatchHistoryForEntries: bindings.preloadWatchHistoryForEntries,
      setWatchlistCacheRows: bindings.setWatchlistCacheRows,
      fetchPreviewUrlForEntry: bindings.fetchPreviewUrlForEntry,
      isLikelyVideoUrl: bindings.isLikelyVideoUrl,
      toggleCuratedFavorite: bindings.toggleCuratedFavorite,
      removeCuratedSeries: bindings.removeCuratedSeries,
      persistSettings: bindings.persistSettings,
      debounceProcess: context.debounceProcess,
      isWatchlistPath: context.isWatchlistPath,
      withMutedObserver: bindings.withMutedObserver,
      applyCardLayoutUi: bindings.applyCardLayoutUi,
      createEmptyWatchHistoryCache: () =>
        requireFn<() => unknown>('createEmptyWatchHistoryCache', context.createEmptyWatchHistoryCache)(),
      getWatchlistRoot: (documentRef: Document) =>
        requireFn<(documentRef: Document) => unknown>(
          'getWatchlistRoot',
          context.runtimeBootstrapGateModule && (context.runtimeBootstrapGateModule as LooseRecord).getWatchlistRoot,
        )(documentRef),
      getWatchlistHeader: (documentRef: Document) =>
        requireFn<(documentRef: Document) => unknown>(
          'getWatchlistHeader',
          context.runtimeBootstrapGateModule && (context.runtimeBootstrapGateModule as LooseRecord).getWatchlistHeader,
        )(documentRef),
      storageSet: (key: string, value: unknown) => storageSet(key, value),
      runtimeEvent: bindings.runtimeEvent,
      resolveApiHref: bindings.resolveApiHref,
    };
  }

  function createContentCompositionRuntimeInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    corePrimitives: LooseRecord,
    storageSet: (key: string, value: unknown) => unknown,
    requireFn: RequireFunction,
  ): LooseRecord {
    const createContentComposition = requireFn<(options: LooseRecord) => LooseRecord>(
      'createContentComposition',
      context.createContentComposition || createContentCompositionFactory,
    );
    return createContentComposition({
      windowRef: context.windowRef,
      state: context.state,
      runtimeConstants: context.runtimeConstants,
      sortModeControlOptions: context.sortModeControlOptions,
      assertRuntimeMethods: context.assertRuntimeMethods,
      corePrimitives,
      modules: createCompositionModulesInternal(context),
      dependencies: createCompositionDependenciesInternal(context, bindings, storageSet, requireFn),
    }) as LooseRecord;
  }

  function bindCompositionRuntimeInternal(
    bindings: LooseRecord,
    compositionRuntime: LooseRecord,
    requireFn: RequireFunction,
  ): void {
    bindings.normalizeEntriesFromApiRows = requireFn(
      'normalizeEntriesFromApiRows',
      compositionRuntime.normalizeEntriesFromApiRows,
    );
    bindings.ensureCuratedDataLoad = requireFn('ensureCuratedDataLoad', compositionRuntime.ensureCuratedDataLoad);
    bindings.renderCuratedPanel = requireFn('renderCuratedPanel', compositionRuntime.renderCuratedPanel);
    bindings.clearRootFrame = requireFn('clearRootFrame', compositionRuntime.clearRootFrame);
    bindings.setNativeVisibility = requireFn('setNativeVisibility', compositionRuntime.setNativeVisibility);
    bindings.applyTabUi = requireFn('applyTabUi', compositionRuntime.applyTabUi);
    bindings.ensureInterface = requireFn('ensureInterface', compositionRuntime.ensureInterface);
    bindings.listKnownSeries = requireFn('listKnownSeries', compositionRuntime.listKnownSeries);
    bindings.getCuratedDomStats = requireFn('getCuratedDomStats', compositionRuntime.getCuratedDomStats);
    bindings.dumpSeriesApiData = requireFn('dumpSeriesApiData', compositionRuntime.dumpSeriesApiData);
    bindings.printSeriesApiData = requireFn('printSeriesApiData', compositionRuntime.printSeriesApiData);
  }

  function initializeCompositionBindingInternal(
    context: LooseRecord,
    bindings: LooseRecord,
    corePrimitives: LooseRecord,
    storageSet: (key: string, value: unknown) => unknown,
    requireFn: RequireFunction,
  ): void {
    const compositionRuntime = createContentCompositionRuntimeInternal(
      context,
      bindings,
      corePrimitives,
      storageSet,
      requireFn,
    );
    const assertRuntimeMethods = requireFn<(ownerLabel: string, instance: unknown, methodNames: string[]) => void>(
      'assertRuntimeMethods',
      context.assertRuntimeMethods,
    );
    assertRuntimeMethods('content composition runtime', compositionRuntime, [
      'normalizeEntriesFromApiRows',
      'ensureInterface',
      'listKnownSeries',
      'getCuratedDomStats',
    ]);
    bindCompositionRuntimeInternal(bindings, compositionRuntime, requireFn);
  }

  function buildContentRuntimeSetupSuccessInternal(context: LooseRecord, bindings: LooseRecord): LooseRecord {
    return {
      ok: true,
      runtimeEvent: bindings.runtimeEvent,
      pushApiTrace: bindings.pushApiTrace,
      normalizeEntriesFromApiRows: bindings.normalizeEntriesFromApiRows,
      fetchWithResilience: bindings.fetchWithResilience,
      getAccessToken: bindings.getAccessToken,
      createAuthRefreshHandler: bindings.createAuthRefreshHandler,
      fetchAllWatchlistRows: bindings.fetchAllWatchlistRows,
      normalizeStoredWatchlistCache: bindings.normalizeStoredWatchlistCache,
      isWatchlistCacheValid: bindings.isWatchlistCacheValid,
      resetWatchlistCacheOnAccountMismatch: bindings.resetWatchlistCacheOnAccountMismatch,
      preloadRatingsForEntries: bindings.preloadRatingsForEntries,
      fetchPreviewUrlForEntry: bindings.fetchPreviewUrlForEntry,
      normalizeStoredWatchHistoryCache: bindings.normalizeStoredWatchHistoryCache,
      isWatchHistoryCacheValid: bindings.isWatchHistoryCacheValid,
      getCachedWatchHistory: bindings.getCachedWatchHistory,
      getCachedWatchHistoryProgress: bindings.getCachedWatchHistoryProgress,
      preloadWatchHistoryForEntries: bindings.preloadWatchHistoryForEntries,
      isLocalizedWatchHistoryDataMissingForEntries: bindings.isLocalizedWatchHistoryDataMissingForEntries,
      getCachedRating: bindings.getCachedRating,
      isLocalizedRatingDataMissingForEntries: bindings.isLocalizedRatingDataMissingForEntries,
      detectPreferredAudioLanguage: bindings.detectPreferredAudioLanguage,
      ensureCuratedDataLoad: bindings.ensureCuratedDataLoad,
      renderCuratedPanel: bindings.renderCuratedPanel,
      clearRootFrame: bindings.clearRootFrame,
      setNativeVisibility: bindings.setNativeVisibility,
      applyTabUi: bindings.applyTabUi,
      ensureInterface: bindings.ensureInterface,
      listKnownSeries: bindings.listKnownSeries,
      getCuratedDomStats: bindings.getCuratedDomStats,
      dumpSeriesApiData: bindings.dumpSeriesApiData,
      resolveApiHref: bindings.resolveApiHref,
      normalizeImageUrlCandidate: bindings.normalizeImageUrlCandidate,
      extractCoverImagesFromApiImages: bindings.extractCoverImagesFromApiImages,
      extractThumbnailImageFromApiImages: bindings.extractThumbnailImageFromApiImages,
      scheduleSaveRatings: bindings.scheduleSaveRatings,
      scheduleSaveWatchHistory: bindings.scheduleSaveWatchHistory,
      scheduleSaveWatchlistCache: bindings.scheduleSaveWatchlistCache,
      getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
      preloadRatingsForSelectedAudioLocale: bindings.preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale: bindings.preloadWatchHistoryForSelectedAudioLocale,
      toggleCuratedFavorite: bindings.toggleCuratedFavorite,
      removeCuratedSeries: bindings.removeCuratedSeries,
      isLikelyVideoUrl: bindings.isLikelyVideoUrl,
      isEntryWatchReady: bindings.isEntryWatchReady,
      withMutedObserver: bindings.withMutedObserver,
      applyCardLayoutUi: bindings.applyCardLayoutUi,
      persistSettings: bindings.persistSettings,
      printSeriesApiData: bindings.printSeriesApiData,
      setWatchlistCacheRows: bindings.setWatchlistCacheRows,
      defaultSettings: context.defaultSettings,
      defaultSortMode: context.defaultSortMode,
      validSortModes: context.validSortModes,
    };
  }

  function createContentRuntimeSetupCompositionRuntime(options: LooseRecord = {}): LooseRecord {
    const requireFn = (options.requireFunction as RequireFunction | undefined) ?? requireFunction;
    return {
      initializeCompositionBinding: (
        context: LooseRecord,
        bindings: LooseRecord,
        corePrimitives: LooseRecord,
        storageSet: (key: string, value: unknown) => unknown,
      ) => initializeCompositionBindingInternal(context, bindings, corePrimitives, storageSet, requireFn),
      buildContentRuntimeSetupSuccess: (context: LooseRecord, bindings: LooseRecord) =>
        buildContentRuntimeSetupSuccessInternal(context, bindings),
    };
  }

  createContentRuntimeSetupCompositionRuntimeFactory = createContentRuntimeSetupCompositionRuntime;
  moduleRegistry.runtimeContentRuntimeSetupComposition = {
    createContentRuntimeSetupCompositionRuntime,
  };
})();

export function createContentRuntimeSetupCompositionRuntime(options: LooseRecord = {}): LooseRecord {
  if (typeof createContentRuntimeSetupCompositionRuntimeFactory !== 'function') {
    throw new Error('[CW] Content runtime setup composition factory was not initialized.');
  }
  return createContentRuntimeSetupCompositionRuntimeFactory(options);
}
