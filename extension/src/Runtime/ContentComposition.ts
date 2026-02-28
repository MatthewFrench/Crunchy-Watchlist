import { type CuratedCardEntry, createCardShell } from '../Ui/CuratedCardShell.js';

(() => {
  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing content composition dependency: ${name}`);
    }
    return value as T;
  }

  function toFunctionRecord(value: unknown): AnyFunctionRecord {
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
    createEntryNormalizerBinding: (options: ContentCompositionOptions) => (rows: unknown[]) => unknown[];
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
      normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[],
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

  function createContentCompositionBindingsRuntime(): ContentCompositionBindingsRuntime {
    const bindingsModule = toFunctionRecord(moduleRegistry.runtimeContentCompositionBindings);
    const createRuntime = requireFunction<AnyFn>(
      'createContentCompositionBindingsRuntime',
      bindingsModule.createContentCompositionBindingsRuntime,
    );
    return createRuntime() as ContentCompositionBindingsRuntime;
  }

  function createContentCompositionRuntimeBindingsRuntime(): ContentCompositionRuntimeBindingsRuntime {
    const runtimeBindingsModule = toFunctionRecord(moduleRegistry.runtimeContentCompositionRuntimeBindings);
    const createRuntime = requireFunction<AnyFn>(
      'createContentCompositionRuntimeBindingsRuntime',
      runtimeBindingsModule.createContentCompositionRuntimeBindingsRuntime,
    );
    return createRuntime() as ContentCompositionRuntimeBindingsRuntime;
  }

  function createSortRuntime(options: ContentCompositionOptions): SortRuntime {
    const corePrimitives = options.corePrimitives;
    const sortMetrics = requireFunction<AnyFn>(
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

    const entrySorting = requireFunction<AnyFn>(
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
      compareRenderableEntries: requireFunction<AnyFn>(
        'compareRenderableEntries',
        entrySorting.compareRenderableEntries,
      ) as SortRuntime['compareRenderableEntries'],
    };
  }

  function createCardMetadataRuntime(options: ContentCompositionOptions, sortRuntime: SortRuntime): AnyFunctionRecord {
    const corePrimitives = options.corePrimitives;
    const cardMetadata = requireFunction<AnyFn>(
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
    const controlsView = requireFunction<AnyFn>(
      'createControlsView',
      options.modules.controlsViewModule.createControlsView,
    )({
      documentRef: options.windowRef.document,
    }) as AnyFunctionRecord;
    options.assertRuntimeMethods('controls view', controlsView, ['createCuratedInterfaceControls']);
    return () =>
      requireFunction<AnyFn>('createCuratedInterfaceControls', controlsView.createCuratedInterfaceControls)(
        getSettingsRecord(options.state),
        options.sortModeControlOptions,
      );
  }

  function createCardViewBinding(
    options: ContentCompositionOptions,
    cardMetadata: AnyFunctionRecord,
  ): Pick<CardRuntime, 'createCuratedCardBody' | 'patchCuratedCardBody' | 'getCuratedCardBodyRefs'> {
    const cardView = requireFunction<AnyFn>(
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
      createCuratedCardBody: requireFunction<AnyFn>(
        'createCuratedCardBody',
        cardView.createCuratedCardBody,
      ) as CardRuntime['createCuratedCardBody'],
      patchCuratedCardBody: requireFunction<AnyFn>(
        'patchCuratedCardBody',
        cardView.patchCuratedCardBody,
      ) as CardRuntime['patchCuratedCardBody'],
      getCuratedCardBodyRefs: requireFunction<AnyFn>(
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
    const normalizeImageUrlCandidate = requireFunction<(value: unknown) => string>(
      'normalizeImageUrlCandidate',
      options.dependencies.normalizeImageUrlCandidate,
    );
    const resolveApiHref = requireFunction<(href: unknown) => string>(
      'resolveApiHref',
      options.dependencies.resolveApiHref,
    );
    const makeRatingBadge = requireFunction<(rating: unknown, votes: unknown) => HTMLElement>(
      'makeRatingBadge',
      cardMetadata.makeRatingBadge,
    );
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
      getCuratedCardBodyRefs: (value: unknown) => getCuratedCardBodyRefs(value) as CwCuratedCardBodyRefs | null,
      patchCuratedCardBody: (card: Element, entry: CuratedCardEntry) => {
        patchCuratedCardBody(card, entry);
      },
      installCuratedCardPreview: (
        thumbLink: unknown,
        entry: unknown,
        coverImageUrl: unknown,
        hoverPreviewImageUrl: unknown,
        thumbImage: unknown,
      ) =>
        deferredCallbacks.installCuratedCardPreview(thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage),
    };

    const moduleCardShellFactory = toFunctionRecord(options.modules.cardShellModule).createCardShell;
    if (typeof moduleCardShellFactory === 'function') {
      const cardShellRuntime = (moduleCardShellFactory as AnyFn)(cardShellDeps) as AnyFunctionRecord;
      options.assertRuntimeMethods('card shell', cardShellRuntime, ['createCuratedCard', 'patchCuratedCard']);
      return {
        createCuratedCard: requireFunction<AnyFn>(
          'createCuratedCard',
          cardShellRuntime.createCuratedCard,
        ) as CardRuntime['createCuratedCard'],
        patchCuratedCard: requireFunction<AnyFn>(
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

  function createContentComposition(input: ContentCompositionOptions): ContentCompositionRuntime {
    const options: ContentCompositionOptions = {
      ...input,
      corePrimitives: toFunctionRecord(input.corePrimitives),
    };
    requireFunction('normalizeImageUrlCandidate', options.dependencies.normalizeImageUrlCandidate);
    requireFunction('extractCoverImagesFromApiImages', options.dependencies.extractCoverImagesFromApiImages);
    requireFunction('extractThumbnailImageFromApiImages', options.dependencies.extractThumbnailImageFromApiImages);
    requireFunction('getWatchlistRoot', options.dependencies.getWatchlistRoot);
    requireFunction('getWatchlistHeader', options.dependencies.getWatchlistHeader);
    const compositionBindingsRuntime = createContentCompositionBindingsRuntime();
    const runtimeBindingsRuntime = createContentCompositionRuntimeBindingsRuntime();

    const deferredCallbacks: DeferredCompositionCallbacks = {
      createCuratedCardActions: () => [],
      installCuratedCardPreview: () => undefined,
      resetCuratedCachesForRefresh: () => undefined,
    };

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
      createCuratedInterfaceControls: cardRuntime.createCuratedInterfaceControls,
      createCuratedCardBody: cardRuntime.createCuratedCardBody,
      createCuratedCard: cardRuntime.createCuratedCard,
      patchCuratedCard: cardRuntime.patchCuratedCard,
      buildRenderableEntries: curatedRuntime.buildRenderableEntries,
      createCuratedCardActions: interactionsRuntime.createCuratedCardActions,
      compareRenderableEntries: sortRuntime.compareRenderableEntries,
      triggerNativeCardAction: curatedRuntime.triggerNativeCardAction,
      installCuratedCardPreview: curatedRuntime.installCuratedCardPreview,
      bindCuratedInterfaceControls: interactionsRuntime.bindCuratedInterfaceControls,
      ensureCuratedDataLoad: curatedRuntime.ensureCuratedDataLoad,
      renderCuratedPanel: curatedRuntime.renderCuratedPanel,
      clearRootFrame: interfaceRuntime.clearRootFrame,
      setNativeVisibility: interfaceRuntime.setNativeVisibility,
      applyTabUi: interfaceRuntime.applyTabUi,
      resetCuratedCachesForRefresh: interfaceRuntime.resetCuratedCachesForRefresh,
      ensureInterface: interfaceRuntime.ensureInterface,
      listKnownSeries: debugRuntime.listKnownSeries,
      getCuratedDomStats: debugRuntime.getCuratedDomStats,
      dumpSeriesApiData: debugRuntime.dumpSeriesApiData,
      printSeriesApiData: debugRuntime.printSeriesApiData,
    };
  }

  let runtimeRegistry = moduleRegistry.runtimeContentComposition;
  if (!runtimeRegistry || typeof runtimeRegistry !== 'object') {
    runtimeRegistry = {};
    moduleRegistry.runtimeContentComposition = runtimeRegistry;
  }

  (runtimeRegistry as LooseRecord).createContentComposition = createContentComposition;
})();
