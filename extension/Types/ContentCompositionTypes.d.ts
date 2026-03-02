type ContentCompositionModuleSet = {
  entryNormalizerModule: AnyFunctionRecord;
  sortMetricsModule: AnyFunctionRecord;
  entrySortingModule: AnyFunctionRecord;
  cardMetadataModule: AnyFunctionRecord;
  controlsViewModule: AnyFunctionRecord;
  cardViewModule: AnyFunctionRecord;
  cardShellModule: AnyFunctionRecord;
  runtimeRenderableModule: AnyFunctionRecord;
  runtimeCuratedPanelModule: AnyFunctionRecord;
  runtimeCuratedLoaderModule: AnyFunctionRecord;
  runtimeNativeBridgeModule: AnyFunctionRecord;
  runtimeCuratedInteractionsModule: AnyFunctionRecord;
  runtimeInterfaceShellModule: AnyFunctionRecord;
  runtimeDebugModule: AnyFunctionRecord;
};

type ContentCompositionDependencies = {
  extractCoverImagesFromApiImages: UnknownFn;
  extractThumbnailImageFromApiImages: UnknownFn;
  normalizeImageUrlCandidate: UnknownFn;
  getPreferredAudioLanguage: UnknownFn;
  getCachedRating: UnknownFn;
  getCachedWatchHistory: UnknownFn;
  getCachedWatchHistoryProgress: UnknownFn;
  isEntryWatchReady: UnknownFn;
  isLocalizedRatingDataMissingForEntries: UnknownFn;
  isLocalizedWatchHistoryDataMissingForEntries: UnknownFn;
  preloadRatingsForSelectedAudioLocale: UnknownFn;
  preloadWatchHistoryForSelectedAudioLocale: UnknownFn;
  getAccessToken: UnknownFn;
  fetchWithResilience: UnknownFn;
  createAuthRefreshHandler: UnknownFn;
  resetWatchlistCacheOnAccountMismatch: UnknownFn;
  fetchAllWatchlistRows: UnknownFn;
  preloadRatingsForEntries: UnknownFn;
  preloadWatchHistoryForEntries: UnknownFn;
  setWatchlistCacheRows: UnknownFn;
  fetchPreviewUrlForEntry: UnknownFn;
  isLikelyVideoUrl: UnknownFn;
  toggleCuratedFavorite: UnknownFn;
  removeCuratedSeries: UnknownFn;
  persistSettings: UnknownFn;
  debounceProcess: UnknownFn;
  isWatchlistPath: UnknownFn;
  withMutedObserver: UnknownFn;
  applyCardLayoutUi: UnknownFn;
  createEmptyWatchHistoryCache: UnknownFn;
  getWatchlistRoot: UnknownFn;
  getWatchlistHeader: UnknownFn;
  storageSet: UnknownFn;
  runtimeEvent: UnknownFn;
  resolveApiHref: UnknownFn;
};

type ContentCompositionOptions = {
  windowRef: Window & typeof globalThis;
  state: LooseRecord;
  runtimeConstants: LooseRecord;
  sortModeControlOptions: unknown;
  assertRuntimeMethods: (ownerName: string, runtime: unknown, methodNames: string[]) => void;
  corePrimitives: AnyFunctionRecord;
  modules: ContentCompositionModuleSet;
  dependencies: ContentCompositionDependencies;
};

type DeferredCompositionCallbacks = {
  createCuratedCardActions: (entry: unknown) => unknown;
  installCuratedCardPreview: (
    thumbLink: unknown,
    entry: unknown,
    coverImageUrl: unknown,
    hoverPreviewImageUrl: unknown,
    thumbImage: unknown,
  ) => unknown;
  resetCuratedCachesForRefresh: () => unknown;
};

type SortRuntime = {
  sortMetrics: AnyFunctionRecord;
  compareRenderableEntries: (left: unknown, right: unknown, sortMode?: unknown) => unknown;
};

type CardRuntime = {
  createCuratedInterfaceControls: () => unknown;
  createCuratedCardBody: (entry: unknown, actions: unknown) => unknown;
  getCuratedCardBodyRefs: (value: unknown) => CwCuratedCardBodyRefs | null;
  patchCuratedCardBody: (card: unknown, entry: unknown) => unknown;
  createCuratedCard: (entry: unknown) => unknown;
  patchCuratedCard: (card: unknown, entry: unknown) => unknown;
};

type CuratedRuntime = {
  buildRenderableEntries: () => unknown;
  renderCuratedPanel: () => unknown;
  refreshCuratedLoadingIndicator: () => unknown;
  ensureCuratedDataLoad: (force?: unknown) => Promise<unknown>;
  triggerNativeCardAction: (seriesId: unknown, actionType: unknown, favoriteValue?: unknown) => Promise<boolean>;
  installCuratedCardPreview: DeferredCompositionCallbacks['installCuratedCardPreview'];
  dispose: () => void;
};

type InteractionRuntime = {
  createCuratedCardActions: (entry: unknown) => unknown;
  bindCuratedInterfaceControls: () => unknown;
  dispose: () => void;
};

type InterfaceRuntime = {
  clearRootFrame: () => unknown;
  setNativeVisibility: (isVisible: unknown) => unknown;
  applyTabUi: () => unknown;
  resetCuratedCachesForRefresh: () => unknown;
  ensureInterface: () => unknown;
  dispose: () => void;
};

type DebugRuntime = {
  listKnownSeries: () => unknown;
  getCuratedDomStats: () => unknown;
  dumpSeriesApiData: (query: unknown) => unknown;
  printSeriesApiData: (query: unknown) => unknown;
};

type ContentCompositionRuntime = {
  normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[];
  createCuratedInterfaceControls: () => unknown;
  createCuratedCardBody: (entry: unknown, actions: unknown) => unknown;
  createCuratedCard: (entry: unknown) => unknown;
  patchCuratedCard: (card: unknown, entry: unknown) => unknown;
  buildRenderableEntries: () => unknown;
  createCuratedCardActions: (entry: unknown) => unknown;
  compareRenderableEntries: (left: unknown, right: unknown, sortMode?: unknown) => unknown;
  triggerNativeCardAction: (seriesId: unknown, actionType: unknown, favoriteValue?: unknown) => Promise<boolean>;
  installCuratedCardPreview: DeferredCompositionCallbacks['installCuratedCardPreview'];
  bindCuratedInterfaceControls: () => unknown;
  ensureCuratedDataLoad: (force?: unknown) => Promise<unknown>;
  renderCuratedPanel: () => unknown;
  clearRootFrame: () => unknown;
  setNativeVisibility: (isVisible: unknown) => unknown;
  applyTabUi: () => unknown;
  resetCuratedCachesForRefresh: () => unknown;
  ensureInterface: () => unknown;
  listKnownSeries: () => unknown;
  getCuratedDomStats: () => unknown;
  dumpSeriesApiData: (query: unknown) => unknown;
  printSeriesApiData: (query: unknown) => unknown;
  dispose: () => void;
};

type CwCuratedCardActionRefs = {
  favoriteButton: HTMLButtonElement;
  removeButton: HTMLButtonElement;
};

type CwCuratedActionsElement = HTMLElement;

type CwCuratedCardHistogramRowRefs = {
  row: HTMLElement;
  label: HTMLElement;
  track: HTMLElement;
  fill: HTMLElement;
  percentage: HTMLElement;
  count: HTMLElement;
};

type CwCuratedCardBodyRefs = {
  body: HTMLElement;
  descriptionElement: HTMLElement;
  statusElement: HTMLElement;
  lastWatchedElement: HTMLElement;
  scopeElement: HTMLElement;
  genresElement: HTMLElement;
  histogramElement: HTMLElement;
  histogramMissingElement: HTMLElement;
  histogramRowsByStar: Record<string, CwCuratedCardHistogramRowRefs>;
  ratingMetaElement: HTMLElement;
  actionsRowElement: HTMLElement;
  detailsSkeletonElement: HTMLElement;
};

type CwCuratedCardShellRefs = {
  card: HTMLElement;
  header: HTMLElement;
  titleLink: HTMLAnchorElement;
  ratingBadge: HTMLElement;
  media: HTMLElement;
  thumbLink: HTMLAnchorElement;
  thumbImage: HTMLImageElement | null;
  thumbPlaceholder: HTMLElement | null;
  thumbProgress: HTMLElement | null;
  thumbProgressFill: HTMLElement | null;
  body: HTMLElement;
  bodyRefs: CwCuratedCardBodyRefs | null;
  actions: CwCuratedActionsElement;
  actionRefs: CwCuratedCardActionRefs | null;
};

type CwCuratedCardElement = HTMLElement;

type CwLoadingIndicatorDetailsRefs = {
  details: HTMLElement;
  progress: HTMLElement;
  requests: HTMLElement;
};

type CwLoadingIndicatorElement = HTMLElement;
