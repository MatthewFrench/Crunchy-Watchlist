import { type CuratedCardEntry, createCardShell } from '../Ui/CuratedCardShell.js';
import { createContentCompositionBindingsRuntime as createContentCompositionBindingsRuntimeFactory } from './ContentCompositionBindings.js';
import { createContentCompositionRuntimeBindingsRuntime as createContentCompositionRuntimeBindingsRuntimeFactory } from './ContentCompositionRuntimeBindings.js';

type BoundaryValue = CwBoundaryValue;
type RuntimeFn = (...args: BoundaryValue[]) => BoundaryValue;

function requireFunction<T extends RuntimeFn>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing content composition dependency: ${name}`);
  }
  return value as T;
}

function toFunctionRecord(value: BoundaryValue): AnyFunctionRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as AnyFunctionRecord;
}

function getSettingsRecord(state: LooseRecord): LooseRecord {
  if (!state.settings || typeof state.settings !== 'object') {
    return {};
  }
  return state.settings as LooseRecord;
}

type ContentCompositionBindingsRuntime = {
  createEntryNormalizerBinding: (options: ContentCompositionOptions) => (rows: BoundaryValue[]) => BoundaryValue[];
  createDebugRuntime: (options: {
    state: LooseRecord;
    corePrimitives: AnyFunctionRecord;
    modules: LooseRecord;
    assertRuntimeMethods: (owner: string, runtime: AnyFunctionRecord, methods: string[]) => void;
    consoleRef: Console;
  }) => DebugRuntime;
};

type ContentCompositionRuntimeBindingsRuntime = {
  createCuratedRuntime: (
    options: ContentCompositionOptions,
    sortRuntime: SortRuntime,
    cardRuntime: CardRuntime,
    normalizeEntriesFromApiRows: (rows: BoundaryValue[]) => BoundaryValue[],
  ) => CuratedRuntime;
  createInteractionRuntime: (
    options: ContentCompositionOptions,
    deferredCallbacks: DeferredCompositionCallbacks,
    curatedRuntime: CuratedRuntime,
  ) => InteractionRuntime;
  createInterfaceRuntime: (
    options: ContentCompositionOptions,
    cardRuntime: CardRuntime,
    curatedRuntime: CuratedRuntime,
    interactionsRuntime: InteractionRuntime,
  ) => InterfaceRuntime;
};

type ContentCompositionAssembly = {
  normalizeEntriesFromApiRows: (rows: BoundaryValue[]) => BoundaryValue[];
  cardRuntime: CardRuntime;
  sortRuntime: SortRuntime;
  curatedRuntime: CuratedRuntime;
  interactionsRuntime: InteractionRuntime;
  interfaceRuntime: InterfaceRuntime;
  debugRuntime: DebugRuntime;
};

function createContentCompositionBindingsRuntime(): ContentCompositionBindingsRuntime {
  return createContentCompositionBindingsRuntimeFactory() as ContentCompositionBindingsRuntime;
}

function createContentCompositionRuntimeBindingsRuntime(): ContentCompositionRuntimeBindingsRuntime {
  return createContentCompositionRuntimeBindingsRuntimeFactory() as ContentCompositionRuntimeBindingsRuntime;
}

function createSortRuntime(options: ContentCompositionOptions): SortRuntime {
  const corePrimitives = options.corePrimitives;
  const sortMetrics = requireFunction<RuntimeFn>(
    'createSortMetrics',
    options.modules.sortMetricsModule.createSortMetrics,
  )({
    sanitizePercentage: corePrimitives.sanitizePercentage,
    sanitizeVotes: corePrimitives.sanitizeVotes,
    sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
    parseDateMs: corePrimitives.parseDateMs,
    pickFirstPositiveInt: corePrimitives.pickFirstPositiveInt,
  }) as AnyFunctionRecord;
  options.assertRuntimeMethods('sort metrics', sortMetrics, [
    'getStarCountFromDistribution',
    'getStarPercentageFromDistribution',
    'getTotalStarPoints',
    'getConsensusQualityScore',
    'getControversyScore',
    'getQualityFloorScore',
    'getQuickWinScore',
    'getWatchedEpisodeEstimate',
    'getPlausiblePastTimestamp',
    'getRewatchActivityTimestamp',
    'getMostRecentActivityTimestamp',
    'getDormantBacklogScore',
    'getRewatchMemoryScore',
    'estimateUnwatchedEpisodesLeft',
  ]);

  const entrySorting = requireFunction<RuntimeFn>(
    'createEntrySorting',
    options.modules.entrySortingModule.createEntrySorting,
  )({
    sanitizeVotes: corePrimitives.sanitizeVotes,
    sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
    parseDateMs: corePrimitives.parseDateMs,
    getStarCountFromDistribution: sortMetrics.getStarCountFromDistribution,
    getStarPercentageFromDistribution: sortMetrics.getStarPercentageFromDistribution,
    getTotalStarPoints: sortMetrics.getTotalStarPoints,
    getConsensusQualityScore: sortMetrics.getConsensusQualityScore,
    getControversyScore: sortMetrics.getControversyScore,
    getQualityFloorScore: sortMetrics.getQualityFloorScore,
    getQuickWinScore: sortMetrics.getQuickWinScore,
    getDormantBacklogScore: sortMetrics.getDormantBacklogScore,
    getRewatchMemoryScore: sortMetrics.getRewatchMemoryScore,
    getWatchedEpisodeEstimate: sortMetrics.getWatchedEpisodeEstimate,
    getRewatchActivityTimestamp: sortMetrics.getRewatchActivityTimestamp,
    getMostRecentActivityTimestamp: sortMetrics.getMostRecentActivityTimestamp,
    getPlausiblePastTimestamp: sortMetrics.getPlausiblePastTimestamp,
  }) as AnyFunctionRecord;
  options.assertRuntimeMethods('entry sorting', entrySorting, ['compareRenderableEntries']);

  return {
    sortMetrics,
    compareRenderableEntries: requireFunction<RuntimeFn>(
      'compareRenderableEntries',
      entrySorting.compareRenderableEntries,
    ) as SortRuntime['compareRenderableEntries'],
  };
}

function createCardMetadataRuntime(options: ContentCompositionOptions, sortRuntime: SortRuntime): AnyFunctionRecord {
  const corePrimitives = options.corePrimitives;
  const cardMetadata = requireFunction<RuntimeFn>(
    'createCardMetadata',
    options.modules.cardMetadataModule.createCardMetadata,
  )({
    getPlausiblePastTimestamp: sortRuntime.sortMetrics.getPlausiblePastTimestamp,
    estimateUnwatchedEpisodesLeft: sortRuntime.sortMetrics.estimateUnwatchedEpisodesLeft,
    sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
    normalizeTagList: corePrimitives.normalizeTagList,
    sanitizePercentage: corePrimitives.sanitizePercentage,
    getStarCountFromDistribution: sortRuntime.sortMetrics.getStarCountFromDistribution,
    getWatchHistoryStatus: () => options.state.watchHistoryStatus,
    documentRef: options.windowRef.document,
  }) as AnyFunctionRecord;
  options.assertRuntimeMethods('card metadata', cardMetadata, [
    'formatVotes',
    'sanitizePercentage',
    'getStarCountFromDistribution',
    'getLastWatchedPresentation',
    'appendLabeledValue',
    'setLabeledValue',
    'setLabeledValuePairs',
    'getSeriesScopePairs',
    'getGenreValue',
    'makeRatingHistogram',
    'makeRatingBadge',
  ]);
  return cardMetadata;
}

function createControlsBinding(options: ContentCompositionOptions): CardRuntime['createCuratedInterfaceControls'] {
  const controlsView = requireFunction<RuntimeFn>(
    'createControlsView',
    options.modules.controlsViewModule.createControlsView,
  )({
    documentRef: options.windowRef.document,
  }) as AnyFunctionRecord;
  options.assertRuntimeMethods('controls view', controlsView, ['createCuratedInterfaceControls']);
  return () =>
    requireFunction<RuntimeFn>('createCuratedInterfaceControls', controlsView.createCuratedInterfaceControls)(
      getSettingsRecord(options.state),
      options.sortModeControlOptions,
    );
}

function createCardViewBinding(
  options: ContentCompositionOptions,
  cardMetadata: AnyFunctionRecord,
): Pick<CardRuntime, 'createCuratedCardBody' | 'patchCuratedCardBody' | 'getCuratedCardBodyRefs'> {
  const cardView = requireFunction<RuntimeFn>(
    'createCardView',
    options.modules.cardViewModule.createCardView,
  )({
    documentRef: options.windowRef.document,
    getLastWatchedPresentation: cardMetadata.getLastWatchedPresentation,
    setLabeledValue: cardMetadata.setLabeledValue,
    getSeriesScopePairs: cardMetadata.getSeriesScopePairs,
    setLabeledValuePairs: cardMetadata.setLabeledValuePairs,
    appendLabeledValue: cardMetadata.appendLabeledValue,
    getGenreValue: cardMetadata.getGenreValue,
    makeRatingHistogram: cardMetadata.makeRatingHistogram,
    formatVotes: cardMetadata.formatVotes,
    sanitizePercentage: cardMetadata.sanitizePercentage,
    getStarCountFromDistribution: cardMetadata.getStarCountFromDistribution,
  }) as AnyFunctionRecord;
  options.assertRuntimeMethods('card view', cardView, [
    'createCuratedCardBody',
    'patchCuratedCardBody',
    'getCuratedCardBodyRefs',
  ]);
  return {
    createCuratedCardBody: requireFunction<RuntimeFn>(
      'createCuratedCardBody',
      cardView.createCuratedCardBody,
    ) as CardRuntime['createCuratedCardBody'],
    patchCuratedCardBody: requireFunction<RuntimeFn>(
      'patchCuratedCardBody',
      cardView.patchCuratedCardBody,
    ) as CardRuntime['patchCuratedCardBody'],
    getCuratedCardBodyRefs: requireFunction<RuntimeFn>(
      'getCuratedCardBodyRefs',
      cardView.getCuratedCardBodyRefs,
    ) as CardRuntime['getCuratedCardBodyRefs'],
  };
}

function createCardShellBinding(
  options: ContentCompositionOptions,
  cardMetadata: AnyFunctionRecord,
  createCuratedCardBody: CardRuntime['createCuratedCardBody'],
  getCuratedCardBodyRefs: CardRuntime['getCuratedCardBodyRefs'],
  patchCuratedCardBody: CardRuntime['patchCuratedCardBody'],
  deferredCallbacks: DeferredCompositionCallbacks,
): Pick<CardRuntime, 'createCuratedCard' | 'patchCuratedCard'> {
  const normalizeImageUrlCandidate = requireFunction<(value: BoundaryValue) => string>(
    'normalizeImageUrlCandidate',
    options.dependencies.normalizeImageUrlCandidate,
  );
  const resolveApiHref = requireFunction<(href: BoundaryValue) => string>(
    'resolveApiHref',
    options.dependencies.resolveApiHref,
  );
  const makeRatingBadge = requireFunction<(rating: BoundaryValue, votes: BoundaryValue) => HTMLElement>(
    'makeRatingBadge',
    cardMetadata.makeRatingBadge,
  );
  const installCuratedCardPreview: DeferredCompositionCallbacks['installCuratedCardPreview'] = (
    thumbLink,
    entry,
    coverImageUrl,
    hoverPreviewImageUrl,
    thumbImage,
  ) => deferredCallbacks.installCuratedCardPreview(thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage);
  const cardShellDeps = {
    documentRef: options.windowRef.document,
    windowRef: options.windowRef,
    getCardLayout: () => getSettingsRecord(options.state).cardLayout,
    normalizeImageUrlCandidate,
    resolveApiHref,
    makeRatingBadge,
    createCuratedCardActions: (entry: CuratedCardEntry) =>
      deferredCallbacks.createCuratedCardActions(entry) as CwCuratedActionsElement,
    createCuratedCardBody: (entry: CuratedCardEntry, actions: CwCuratedActionsElement) =>
      createCuratedCardBody(entry, actions) as HTMLElement,
    getCuratedCardBodyRefs: (value: BoundaryValue) => getCuratedCardBodyRefs(value) as CwCuratedCardBodyRefs | null,
    patchCuratedCardBody: (card: Element, entry: CuratedCardEntry) => {
      patchCuratedCardBody(card, entry);
    },
    installCuratedCardPreview,
  };

  const moduleCardShellFactory = toFunctionRecord(options.modules.cardShellModule).createCardShell;
  if (typeof moduleCardShellFactory === 'function') {
    const cardShellRuntime = (moduleCardShellFactory as RuntimeFn)(cardShellDeps) as AnyFunctionRecord;
    options.assertRuntimeMethods('card shell', cardShellRuntime, ['createCuratedCard', 'patchCuratedCard']);
    return {
      createCuratedCard: requireFunction<RuntimeFn>(
        'createCuratedCard',
        cardShellRuntime.createCuratedCard,
      ) as CardRuntime['createCuratedCard'],
      patchCuratedCard: requireFunction<RuntimeFn>(
        'patchCuratedCard',
        cardShellRuntime.patchCuratedCard,
      ) as CardRuntime['patchCuratedCard'],
    };
  }

  const cardShell = createCardShell(cardShellDeps);
  return {
    createCuratedCard: cardShell.createCuratedCard as CardRuntime['createCuratedCard'],
    patchCuratedCard: cardShell.patchCuratedCard as CardRuntime['patchCuratedCard'],
  };
}

function createCardRuntime(
  options: ContentCompositionOptions,
  sortRuntime: SortRuntime,
  deferredCallbacks: DeferredCompositionCallbacks,
): CardRuntime {
  const cardMetadata = createCardMetadataRuntime(options, sortRuntime);
  const createCuratedInterfaceControls = createControlsBinding(options);
  const cardView = createCardViewBinding(options, cardMetadata);
  const cardShell = createCardShellBinding(
    options,
    cardMetadata,
    cardView.createCuratedCardBody,
    cardView.getCuratedCardBodyRefs,
    cardView.patchCuratedCardBody,
    deferredCallbacks,
  );
  return {
    createCuratedInterfaceControls,
    createCuratedCardBody: cardView.createCuratedCardBody,
    getCuratedCardBodyRefs: cardView.getCuratedCardBodyRefs,
    patchCuratedCardBody: cardView.patchCuratedCardBody,
    createCuratedCard: cardShell.createCuratedCard,
    patchCuratedCard: cardShell.patchCuratedCard,
  };
}

function assertContentCompositionDependencies(options: ContentCompositionOptions): void {
  requireFunction('normalizeImageUrlCandidate', options.dependencies.normalizeImageUrlCandidate);
  requireFunction('extractCoverImagesFromApiImages', options.dependencies.extractCoverImagesFromApiImages);
  requireFunction('extractThumbnailImageFromApiImages', options.dependencies.extractThumbnailImageFromApiImages);
  requireFunction('getWatchlistRoot', options.dependencies.getWatchlistRoot);
  requireFunction('getWatchlistHeader', options.dependencies.getWatchlistHeader);
}

function createDeferredCallbacks(): DeferredCompositionCallbacks {
  return {
    createCuratedCardActions: () => [],
    installCuratedCardPreview: () => undefined,
    resetCuratedCachesForRefresh: () => undefined,
  };
}

function assembleContentCompositionRuntimes(options: ContentCompositionOptions): ContentCompositionAssembly {
  const compositionBindingsRuntime = createContentCompositionBindingsRuntime();
  const runtimeBindingsRuntime = createContentCompositionRuntimeBindingsRuntime();
  const deferredCallbacks = createDeferredCallbacks();
  const normalizeEntriesFromApiRows = compositionBindingsRuntime.createEntryNormalizerBinding(options);
  const sortRuntime = createSortRuntime(options);
  const cardRuntime = createCardRuntime(options, sortRuntime, deferredCallbacks);
  const curatedRuntime = runtimeBindingsRuntime.createCuratedRuntime(
    options,
    sortRuntime,
    cardRuntime,
    normalizeEntriesFromApiRows,
  );

  deferredCallbacks.installCuratedCardPreview = curatedRuntime.installCuratedCardPreview;

  const interactionsRuntime = runtimeBindingsRuntime.createInteractionRuntime(
    options,
    deferredCallbacks,
    curatedRuntime,
  );
  deferredCallbacks.createCuratedCardActions = interactionsRuntime.createCuratedCardActions;
  const interfaceRuntime = runtimeBindingsRuntime.createInterfaceRuntime(
    options,
    cardRuntime,
    curatedRuntime,
    interactionsRuntime,
  );
  deferredCallbacks.resetCuratedCachesForRefresh = interfaceRuntime.resetCuratedCachesForRefresh;
  const debugRuntime = compositionBindingsRuntime.createDebugRuntime({
    state: options.state,
    corePrimitives: options.corePrimitives,
    modules: options.modules,
    assertRuntimeMethods: options.assertRuntimeMethods,
    consoleRef: console,
  });

  return {
    normalizeEntriesFromApiRows,
    cardRuntime,
    sortRuntime,
    curatedRuntime,
    interactionsRuntime,
    interfaceRuntime,
    debugRuntime,
  };
}

function createContentCompositionInternal(input: ContentCompositionOptions): ContentCompositionRuntime {
  const options: ContentCompositionOptions = {
    ...input,
    corePrimitives: toFunctionRecord(input.corePrimitives),
  };
  assertContentCompositionDependencies(options);
  const assembly = assembleContentCompositionRuntimes(options);
  let disposed = false;
  const dispose = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    assembly.interfaceRuntime.dispose?.();
    assembly.interactionsRuntime.dispose?.();
    assembly.curatedRuntime.dispose?.();
  };

  return {
    normalizeEntriesFromApiRows: assembly.normalizeEntriesFromApiRows,
    createCuratedInterfaceControls: assembly.cardRuntime.createCuratedInterfaceControls,
    createCuratedCardBody: assembly.cardRuntime.createCuratedCardBody,
    createCuratedCard: assembly.cardRuntime.createCuratedCard,
    patchCuratedCard: assembly.cardRuntime.patchCuratedCard,
    buildRenderableEntries: assembly.curatedRuntime.buildRenderableEntries,
    createCuratedCardActions: assembly.interactionsRuntime.createCuratedCardActions,
    compareRenderableEntries: assembly.sortRuntime.compareRenderableEntries,
    triggerNativeCardAction: assembly.curatedRuntime.triggerNativeCardAction,
    installCuratedCardPreview: assembly.curatedRuntime.installCuratedCardPreview,
    bindCuratedInterfaceControls: assembly.interactionsRuntime.bindCuratedInterfaceControls,
    ensureCuratedDataLoad: assembly.curatedRuntime.ensureCuratedDataLoad,
    renderCuratedPanel: assembly.curatedRuntime.renderCuratedPanel,
    clearRootFrame: assembly.interfaceRuntime.clearRootFrame,
    setNativeVisibility: assembly.interfaceRuntime.setNativeVisibility,
    applyTabUi: assembly.interfaceRuntime.applyTabUi,
    resetCuratedCachesForRefresh: assembly.interfaceRuntime.resetCuratedCachesForRefresh,
    ensureInterface: assembly.interfaceRuntime.ensureInterface,
    listKnownSeries: assembly.debugRuntime.listKnownSeries,
    getCuratedDomStats: assembly.debugRuntime.getCuratedDomStats,
    dumpSeriesApiData: assembly.debugRuntime.dumpSeriesApiData,
    printSeriesApiData: assembly.debugRuntime.printSeriesApiData,
    dispose,
  };
}

export function createContentComposition(options: LooseRecord = {}): object {
  return createContentCompositionInternal((options || {}) as ContentCompositionOptions);
}
