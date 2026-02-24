type ContentCompositionModuleSet = {
  entryNormalizerModule: AnyFunctionRecord
  sortMetricsModule: AnyFunctionRecord
  entrySortingModule: AnyFunctionRecord
  cardMetadataModule: AnyFunctionRecord
  controlsViewModule: AnyFunctionRecord
  cardViewModule: AnyFunctionRecord
  cardShellModule: AnyFunctionRecord
  runtimeRenderableModule: AnyFunctionRecord
  runtimeCuratedPanelModule: AnyFunctionRecord
  runtimeCuratedLoaderModule: AnyFunctionRecord
  runtimeNativeBridgeModule: AnyFunctionRecord
  runtimeCuratedInteractionsModule: AnyFunctionRecord
  runtimeInterfaceShellModule: AnyFunctionRecord
  runtimeDebugModule: AnyFunctionRecord
}

type ContentCompositionDependencies = {
  extractCoverImagesFromApiImages: AnyFn
  extractThumbnailImageFromApiImages: AnyFn
  normalizeImageUrlCandidate: AnyFn
  getPreferredAudioLanguage: AnyFn
  getCachedRating: AnyFn
  getCachedWatchHistory: AnyFn
  getCachedWatchHistoryProgress: AnyFn
  isEntryWatchReady: AnyFn
  isLocalizedRatingDataMissingForEntries: AnyFn
  isLocalizedWatchHistoryDataMissingForEntries: AnyFn
  preloadRatingsForSelectedAudioLocale: AnyFn
  preloadWatchHistoryForSelectedAudioLocale: AnyFn
  getAccessToken: AnyFn
  resetWatchlistCacheOnAccountMismatch: AnyFn
  fetchAllWatchlistRows: AnyFn
  preloadRatingsForEntries: AnyFn
  preloadWatchHistoryForEntries: AnyFn
  setWatchlistCacheRows: AnyFn
  fetchPreviewUrlForEntry: AnyFn
  isLikelyVideoUrl: AnyFn
  toggleCuratedFavorite: AnyFn
  removeCuratedSeries: AnyFn
  persistSettings: AnyFn
  debounceProcess: AnyFn
  isWatchlistPath: AnyFn
  withMutedObserver: AnyFn
  applyCardLayoutUi: AnyFn
  createEmptyWatchHistoryCache: AnyFn
  getWatchlistRoot: AnyFn
  getWatchlistHeader: AnyFn
  storageSet: AnyFn
  runtimeEvent: AnyFn
  resolveApiHref: AnyFn
}

type ContentCompositionOptions = {
  windowRef: Window & typeof globalThis
  state: LooseRecord
  runtimeConstants: LooseRecord
  sortModeControlOptions: unknown
  assertRuntimeMethods: (ownerName: string, runtime: unknown, methodNames: string[]) => void
  corePrimitives: AnyFunctionRecord
  modules: ContentCompositionModuleSet
  dependencies: ContentCompositionDependencies
}

type DeferredCompositionCallbacks = {
  createCuratedCardActions: (entry: unknown) => unknown
  installCuratedCardPreview: (
    thumbLink: unknown,
    entry: unknown,
    coverImageUrl: unknown,
    hoverPreviewImageUrl: unknown,
    thumbImage: unknown,
  ) => unknown
  resetCuratedCachesForRefresh: () => unknown
}

type SortRuntime = {
  sortMetrics: AnyFunctionRecord
  compareRenderableEntries: (left: unknown, right: unknown, sortMode?: unknown) => unknown
}

type CardRuntime = {
  createCuratedInterfaceControls: () => unknown
  createCuratedCardBody: (entry: unknown) => unknown
  createCuratedCard: (entry: unknown) => unknown
}

type CuratedRuntime = {
  buildRenderableEntries: () => unknown
  renderCuratedPanel: () => unknown
  ensureCuratedDataLoad: (force?: unknown) => Promise<unknown>
  triggerNativeCardAction: (seriesId: unknown, actionType: unknown) => unknown
  installCuratedCardPreview: DeferredCompositionCallbacks['installCuratedCardPreview']
}

type InteractionRuntime = {
  createCuratedCardActions: (entry: unknown) => unknown
  bindCuratedInterfaceControls: () => unknown
}

type InterfaceRuntime = {
  clearRootFrame: () => unknown
  setNativeVisibility: (isVisible: unknown) => unknown
  applyTabUi: () => unknown
  resetCuratedCachesForRefresh: () => unknown
  ensureInterface: () => unknown
}

type DebugRuntime = {
  listKnownSeries: () => unknown
  dumpSeriesApiData: (query: unknown) => unknown
  printSeriesApiData: (query: unknown) => unknown
}

type ContentCompositionRuntime = {
  normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[]
  createCuratedInterfaceControls: () => unknown
  createCuratedCardBody: (entry: unknown) => unknown
  createCuratedCard: (entry: unknown) => unknown
  buildRenderableEntries: () => unknown
  createCuratedCardActions: (entry: unknown) => unknown
  compareRenderableEntries: (left: unknown, right: unknown, sortMode?: unknown) => unknown
  triggerNativeCardAction: (seriesId: unknown, actionType: unknown) => unknown
  installCuratedCardPreview: DeferredCompositionCallbacks['installCuratedCardPreview']
  bindCuratedInterfaceControls: () => unknown
  ensureCuratedDataLoad: (force?: unknown) => Promise<unknown>
  renderCuratedPanel: () => unknown
  clearRootFrame: () => unknown
  setNativeVisibility: (isVisible: unknown) => unknown
  applyTabUi: () => unknown
  resetCuratedCachesForRefresh: () => unknown
  ensureInterface: () => unknown
  listKnownSeries: () => unknown
  dumpSeriesApiData: (query: unknown) => unknown
  printSeriesApiData: (query: unknown) => unknown
}
