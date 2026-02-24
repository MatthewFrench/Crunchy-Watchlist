;(() => {
  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing content composition dependency: ${name}`)
    }
    return value as T
  }

  function toFunctionRecord(value: unknown): AnyFunctionRecord {
    if (!value || typeof value !== 'object') {
      return {}
    }
    return value as AnyFunctionRecord
  }

  function getSettingsRecord(state: LooseRecord): LooseRecord {
    if (!state.settings || typeof state.settings !== 'object') {
      return {}
    }
    return state.settings as LooseRecord
  }

  function createEntryNormalizerBinding(options: ContentCompositionOptions): (rows: unknown[]) => unknown[] {
    const corePrimitives = options.corePrimitives
    const entryNormalizer = requireFunction<AnyFn>(
      'createEntryNormalizer',
      options.modules.entryNormalizerModule.createEntryNormalizer,
    )({
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      getAbsoluteEpisodeNumberFromEpisodeMetadata: corePrimitives.getAbsoluteEpisodeNumberFromEpisodeMetadata,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: corePrimitives.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      formatEpisodeIdentifier: corePrimitives.formatEpisodeIdentifier,
      hasEnUsAudio: corePrimitives.hasEnUsAudio,
      extractCoverImagesFromApiImages: options.dependencies.extractCoverImagesFromApiImages,
      extractThumbnailImageFromApiImages: options.dependencies.extractThumbnailImageFromApiImages,
      pickFirstDateMs: corePrimitives.pickFirstDateMs,
      getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId,
      getEpisodeAvailabilityByAudioLocale: corePrimitives.getEpisodeAvailabilityByAudioLocale,
      mergeEpisodeAvailabilityByAudioLocale: corePrimitives.mergeEpisodeAvailabilityByAudioLocale,
      normalizeAudioLocales: corePrimitives.normalizeAudioLocales,
    }) as AnyFunctionRecord
    return (rows) =>
      requireFunction<AnyFn>(
        'normalizeEntriesFromApiRows',
        entryNormalizer.normalizeEntriesFromApiRows,
      )(rows) as unknown[]
  }

  function createSortRuntime(options: ContentCompositionOptions): SortRuntime {
    const corePrimitives = options.corePrimitives
    const sortMetrics = requireFunction<AnyFn>(
      'createSortMetrics',
      options.modules.sortMetricsModule.createSortMetrics,
    )({
      sanitizePercentage: corePrimitives.sanitizePercentage,
      sanitizeVotes: corePrimitives.sanitizeVotes,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      parseDateMs: corePrimitives.parseDateMs,
      pickFirstPositiveInt: corePrimitives.pickFirstPositiveInt,
    }) as AnyFunctionRecord
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
    ])

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
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('entry sorting', entrySorting, ['compareRenderableEntries'])

    return {
      sortMetrics,
      compareRenderableEntries: requireFunction<AnyFn>(
        'compareRenderableEntries',
        entrySorting.compareRenderableEntries,
      ) as SortRuntime['compareRenderableEntries'],
    }
  }

  function createCardMetadataRuntime(options: ContentCompositionOptions, sortRuntime: SortRuntime): AnyFunctionRecord {
    const corePrimitives = options.corePrimitives
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
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('card metadata', cardMetadata, [
      'formatVotes',
      'getLastWatchedPresentation',
      'appendLabeledValue',
      'setLabeledValue',
      'setLabeledValuePairs',
      'getSeriesScopePairs',
      'getGenreValue',
      'makeRatingHistogram',
      'makeRatingBadge',
    ])
    return cardMetadata
  }

  function createControlsBinding(options: ContentCompositionOptions): CardRuntime['createCuratedInterfaceControls'] {
    const controlsView = requireFunction<AnyFn>(
      'createControlsView',
      options.modules.controlsViewModule.createControlsView,
    )() as AnyFunctionRecord
    options.assertRuntimeMethods('controls view', controlsView, ['createCuratedInterfaceControls'])
    return () =>
      requireFunction<AnyFn>('createCuratedInterfaceControls', controlsView.createCuratedInterfaceControls)(
        getSettingsRecord(options.state),
        options.sortModeControlOptions,
      )
  }

  function createCardViewBinding(
    options: ContentCompositionOptions,
    cardMetadata: AnyFunctionRecord,
  ): CardRuntime['createCuratedCardBody'] {
    const cardView = requireFunction<AnyFn>(
      'createCardView',
      options.modules.cardViewModule.createCardView,
    )({
      getLastWatchedPresentation: cardMetadata.getLastWatchedPresentation,
      setLabeledValue: cardMetadata.setLabeledValue,
      getSeriesScopePairs: cardMetadata.getSeriesScopePairs,
      setLabeledValuePairs: cardMetadata.setLabeledValuePairs,
      appendLabeledValue: cardMetadata.appendLabeledValue,
      getGenreValue: cardMetadata.getGenreValue,
      makeRatingHistogram: cardMetadata.makeRatingHistogram,
      formatVotes: cardMetadata.formatVotes,
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('card view', cardView, ['createCuratedCardBody'])
    return requireFunction<AnyFn>(
      'createCuratedCardBody',
      cardView.createCuratedCardBody,
    ) as CardRuntime['createCuratedCardBody']
  }

  function createCardShellBinding(
    options: ContentCompositionOptions,
    cardMetadata: AnyFunctionRecord,
    createCuratedCardBody: CardRuntime['createCuratedCardBody'],
    deferredCallbacks: DeferredCompositionCallbacks,
  ): CardRuntime['createCuratedCard'] {
    const cardShell = requireFunction<AnyFn>(
      'createCardShell',
      options.modules.cardShellModule.createCardShell,
    )({
      documentRef: options.windowRef.document,
      windowRef: options.windowRef,
      getCardLayout: () => getSettingsRecord(options.state).cardLayout,
      normalizeImageUrlCandidate: options.dependencies.normalizeImageUrlCandidate,
      resolveApiHref: options.dependencies.resolveApiHref,
      makeRatingBadge: cardMetadata.makeRatingBadge,
      createCuratedCardActions: (entry: unknown) => deferredCallbacks.createCuratedCardActions(entry),
      createCuratedCardBody,
      installCuratedCardPreview: (
        thumbLink: unknown,
        entry: unknown,
        coverImageUrl: unknown,
        hoverPreviewImageUrl: unknown,
        thumbImage: unknown,
      ) =>
        deferredCallbacks.installCuratedCardPreview(thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage),
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('card shell', cardShell, ['createCuratedCard'])
    return requireFunction<AnyFn>('createCuratedCard', cardShell.createCuratedCard) as CardRuntime['createCuratedCard']
  }

  function createCardRuntime(
    options: ContentCompositionOptions,
    sortRuntime: SortRuntime,
    deferredCallbacks: DeferredCompositionCallbacks,
  ): CardRuntime {
    const cardMetadata = createCardMetadataRuntime(options, sortRuntime)
    const createCuratedInterfaceControls = createControlsBinding(options)
    const createCuratedCardBody = createCardViewBinding(options, cardMetadata)
    const createCuratedCard = createCardShellBinding(options, cardMetadata, createCuratedCardBody, deferredCallbacks)
    return {
      createCuratedInterfaceControls,
      createCuratedCardBody,
      createCuratedCard,
    }
  }

  function createCuratedRenderableBinding(
    options: ContentCompositionOptions,
    sortRuntime: SortRuntime,
  ): CuratedRuntime['buildRenderableEntries'] {
    const corePrimitives = options.corePrimitives
    const dependencies = options.dependencies
    const curatedRenderable = requireFunction<AnyFn>(
      'createCuratedRenderable',
      options.modules.runtimeRenderableModule.createCuratedRenderable,
    )({
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
      getPreferredAudioLanguage: dependencies.getPreferredAudioLanguage,
      getCachedRating: dependencies.getCachedRating,
      getCachedWatchHistory: dependencies.getCachedWatchHistory,
      getCachedWatchHistoryProgress: dependencies.getCachedWatchHistoryProgress,
      normalizeAudioLocales: corePrimitives.normalizeAudioLocales,
      hasEnUsAudio: corePrimitives.hasEnUsAudio,
      normalizeTagList: corePrimitives.normalizeTagList,
      normalizeImageUrlCandidate: dependencies.normalizeImageUrlCandidate,
      getAudioLocaleCountFromMap: corePrimitives.getAudioLocaleCountFromMap,
      getLocalizedSeriesCount: corePrimitives.getLocalizedSeriesCount,
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      pickFirstDateMs: corePrimitives.pickFirstDateMs,
      deriveDisplayStatusBase: corePrimitives.deriveDisplayStatusBase,
      isEntryWatchReady: dependencies.isEntryWatchReady,
      compareRenderableEntries: (left: unknown, right: unknown, sortMode = getSettingsRecord(options.state).sortMode) =>
        sortRuntime.compareRenderableEntries(left, right, sortMode),
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('curated renderable', curatedRenderable, ['buildRenderableEntries'])
    return () =>
      requireFunction<AnyFn>('buildRenderableEntries', curatedRenderable.buildRenderableEntries)(
        options.state.curatedEntries,
        getSettingsRecord(options.state),
      )
  }

  function createCuratedPanelBinding(
    options: ContentCompositionOptions,
    cardRuntime: CardRuntime,
    buildRenderableEntries: CuratedRuntime['buildRenderableEntries'],
  ): CuratedRuntime['renderCuratedPanel'] {
    const dependencies = options.dependencies
    const curatedPanelRuntime = requireFunction<AnyFn>(
      'createCuratedPanelRuntime',
      options.modules.runtimeCuratedPanelModule.createCuratedPanelRuntime,
    )({
      state: options.state,
      documentRef: options.windowRef.document,
      locationRef: options.windowRef.location,
      createCuratedCard: cardRuntime.createCuratedCard,
      applyCardLayoutUi: dependencies.applyCardLayoutUi,
      buildRenderableEntries,
      withMutedObserver: dependencies.withMutedObserver,
      isLocalizedRatingDataMissingForEntries: dependencies.isLocalizedRatingDataMissingForEntries,
      isLocalizedWatchHistoryDataMissingForEntries: dependencies.isLocalizedWatchHistoryDataMissingForEntries,
      preloadRatingsForSelectedAudioLocale: dependencies.preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale: dependencies.preloadWatchHistoryForSelectedAudioLocale,
      isWatchlistPath: dependencies.isWatchlistPath,
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('curated panel runtime', curatedPanelRuntime, ['renderCuratedPanel'])
    return requireFunction<AnyFn>(
      'renderCuratedPanel',
      curatedPanelRuntime.renderCuratedPanel,
    ) as CuratedRuntime['renderCuratedPanel']
  }

  function createCuratedLoaderBinding(
    options: ContentCompositionOptions,
    normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[],
    renderCuratedPanel: CuratedRuntime['renderCuratedPanel'],
  ): CuratedRuntime['ensureCuratedDataLoad'] {
    const corePrimitives = options.corePrimitives
    const dependencies = options.dependencies
    const curatedLoaderRuntime = requireFunction<AnyFn>(
      'createCuratedLoaderRuntime',
      options.modules.runtimeCuratedLoaderModule.createCuratedLoaderRuntime,
    )({
      state: options.state,
      locationRef: options.windowRef.location,
      runtimeEvent: dependencies.runtimeEvent,
      getAccessToken: dependencies.getAccessToken,
      resetWatchlistCacheOnAccountMismatch: dependencies.resetWatchlistCacheOnAccountMismatch,
      fetchAllWatchlistRows: dependencies.fetchAllWatchlistRows,
      normalizeEntriesFromApiRows,
      preloadRatingsForEntries: dependencies.preloadRatingsForEntries,
      preloadWatchHistoryForEntries: dependencies.preloadWatchHistoryForEntries,
      normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
      getPreferredAudioLanguage: dependencies.getPreferredAudioLanguage,
      setWatchlistCacheRows: dependencies.setWatchlistCacheRows,
      isWatchlistPath: dependencies.isWatchlistPath,
      renderCuratedPanel,
      watchlistRevalidateCooldownMs: options.runtimeConstants.watchlistRevalidateCooldownMs,
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('curated loader runtime', curatedLoaderRuntime, [
      'loadCuratedEntries',
      'ensureCuratedDataLoad',
    ])
    return requireFunction<AnyFn>(
      'ensureCuratedDataLoad',
      curatedLoaderRuntime.ensureCuratedDataLoad,
    ) as CuratedRuntime['ensureCuratedDataLoad']
  }

  function createNativeBridgeBinding(
    options: ContentCompositionOptions,
  ): Pick<CuratedRuntime, 'triggerNativeCardAction' | 'installCuratedCardPreview'> {
    const dependencies = options.dependencies
    const nativeBridgeRuntime = requireFunction<AnyFn>(
      'createNativeBridgeRuntime',
      options.modules.runtimeNativeBridgeModule.createNativeBridgeRuntime,
    )({
      documentRef: options.windowRef.document,
      windowRef: options.windowRef,
      runtimeEvent: dependencies.runtimeEvent,
      normalizeImageUrlCandidate: dependencies.normalizeImageUrlCandidate,
      fetchPreviewUrlForEntry: dependencies.fetchPreviewUrlForEntry,
      isLikelyVideoUrl: dependencies.isLikelyVideoUrl,
      previewHoverDelayMs: options.runtimeConstants.previewHoverDelayMs,
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('native bridge runtime', nativeBridgeRuntime, [
      'triggerNativeCardAction',
      'installCuratedCardPreview',
    ])
    return {
      triggerNativeCardAction: requireFunction<AnyFn>(
        'triggerNativeCardAction',
        nativeBridgeRuntime.triggerNativeCardAction,
      ) as CuratedRuntime['triggerNativeCardAction'],
      installCuratedCardPreview: requireFunction<AnyFn>(
        'installCuratedCardPreview',
        nativeBridgeRuntime.installCuratedCardPreview,
      ) as CuratedRuntime['installCuratedCardPreview'],
    }
  }

  function createCuratedRuntime(
    options: ContentCompositionOptions,
    sortRuntime: SortRuntime,
    cardRuntime: CardRuntime,
    normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[],
  ): CuratedRuntime {
    const buildRenderableEntries = createCuratedRenderableBinding(options, sortRuntime)
    const renderCuratedPanel = createCuratedPanelBinding(options, cardRuntime, buildRenderableEntries)
    const ensureCuratedDataLoad = createCuratedLoaderBinding(options, normalizeEntriesFromApiRows, renderCuratedPanel)
    const nativeBridge = createNativeBridgeBinding(options)
    return {
      buildRenderableEntries,
      renderCuratedPanel,
      ensureCuratedDataLoad,
      triggerNativeCardAction: nativeBridge.triggerNativeCardAction,
      installCuratedCardPreview: nativeBridge.installCuratedCardPreview,
    }
  }

  function createInteractionRuntime(
    options: ContentCompositionOptions,
    deferredCallbacks: DeferredCompositionCallbacks,
    curatedRuntime: CuratedRuntime,
  ): InteractionRuntime {
    const runtime = requireFunction<AnyFn>(
      'createCuratedInteractionsRuntime',
      options.modules.runtimeCuratedInteractionsModule.createCuratedInteractionsRuntime,
    )({
      documentRef: options.windowRef.document,
      alertRef: (message: unknown) => options.windowRef.alert(message as string),
      confirmRef: (message: unknown) => options.windowRef.confirm(message as string),
      triggerNativeCardAction: curatedRuntime.triggerNativeCardAction,
      toggleCuratedFavorite: options.dependencies.toggleCuratedFavorite,
      removeCuratedSeries: options.dependencies.removeCuratedSeries,
      renderCuratedPanel: curatedRuntime.renderCuratedPanel,
      state: options.state,
      locationRef: options.windowRef.location,
      persistSettings: options.dependencies.persistSettings,
      normalizeAudioLocale: options.corePrimitives.normalizeAudioLocale,
      preloadRatingsForSelectedAudioLocale: options.dependencies.preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale: options.dependencies.preloadWatchHistoryForSelectedAudioLocale,
      isWatchlistPath: options.dependencies.isWatchlistPath,
      resetCuratedCachesForRefresh: () => deferredCallbacks.resetCuratedCachesForRefresh(),
      ensureCuratedDataLoad: curatedRuntime.ensureCuratedDataLoad,
      debounceProcess: options.dependencies.debounceProcess,
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('curated interactions runtime', runtime, [
      'createCuratedCardActions',
      'bindCuratedInterfaceControls',
    ])

    return {
      createCuratedCardActions: requireFunction<AnyFn>('createCuratedCardActions', runtime.createCuratedCardActions),
      bindCuratedInterfaceControls: requireFunction<AnyFn>(
        'bindCuratedInterfaceControls',
        runtime.bindCuratedInterfaceControls,
      ) as InteractionRuntime['bindCuratedInterfaceControls'],
    }
  }

  function createInterfaceRuntime(
    options: ContentCompositionOptions,
    cardRuntime: CardRuntime,
    curatedRuntime: CuratedRuntime,
    interactionsRuntime: InteractionRuntime,
  ): InterfaceRuntime {
    const runtime = requireFunction<AnyFn>(
      'createInterfaceShellRuntime',
      options.modules.runtimeInterfaceShellModule.createInterfaceShellRuntime,
    )({
      state: options.state,
      documentRef: options.windowRef.document,
      windowRef: options.windowRef,
      getWatchlistRoot: () => options.dependencies.getWatchlistRoot(options.windowRef.document),
      getWatchlistHeader: () => options.dependencies.getWatchlistHeader(options.windowRef.document),
      runtimeEvent: options.dependencies.runtimeEvent,
      withMutedObserver: options.dependencies.withMutedObserver,
      persistSettings: options.dependencies.persistSettings,
      applyCardLayoutUi: options.dependencies.applyCardLayoutUi,
      createCuratedInterfaceControls: cardRuntime.createCuratedInterfaceControls,
      bindCuratedInterfaceControls: interactionsRuntime.bindCuratedInterfaceControls,
      ensureCuratedDataLoad: curatedRuntime.ensureCuratedDataLoad,
      renderCuratedPanel: curatedRuntime.renderCuratedPanel,
      debounceProcess: options.dependencies.debounceProcess,
      createEmptyWatchHistoryCache: options.dependencies.createEmptyWatchHistoryCache,
      storageSet: options.dependencies.storageSet,
      ratingCacheKey: options.runtimeConstants.ratingCacheKey,
      watchHistoryCacheKey: options.runtimeConstants.watchHistoryCacheKey,
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('interface shell runtime', runtime, [
      'clearRootFrame',
      'setNativeVisibility',
      'applyTabUi',
      'resetCuratedCachesForRefresh',
      'ensureInterface',
    ])

    return {
      clearRootFrame: requireFunction<AnyFn>('clearRootFrame', runtime.clearRootFrame),
      setNativeVisibility: requireFunction<AnyFn>('setNativeVisibility', runtime.setNativeVisibility),
      applyTabUi: requireFunction<AnyFn>('applyTabUi', runtime.applyTabUi),
      resetCuratedCachesForRefresh: requireFunction<AnyFn>(
        'resetCuratedCachesForRefresh',
        runtime.resetCuratedCachesForRefresh,
      ),
      ensureInterface: requireFunction<AnyFn>('ensureInterface', runtime.ensureInterface),
    }
  }

  function createDebugRuntime(options: ContentCompositionOptions): DebugRuntime {
    const runtime = requireFunction<AnyFn>(
      'createDebugApiRuntime',
      options.modules.runtimeDebugModule.createDebugApiRuntime,
    )({
      state: options.state,
      getWatchlistSeriesId: options.corePrimitives.getWatchlistSeriesId,
      getWatchHistorySeriesId: options.corePrimitives.getWatchHistorySeriesId,
      getWatchlistSeriesTitle: options.corePrimitives.getWatchlistSeriesTitle,
      getWatchHistorySeriesTitle: options.corePrimitives.getWatchHistorySeriesTitle,
      logRef: (message: unknown) => {
        // eslint-disable-next-line no-console
        console.log(message)
      },
    }) as AnyFunctionRecord
    options.assertRuntimeMethods('debug runtime', runtime, ['listSeries', 'dumpSeriesApiData', 'printSeriesApiData'])

    return {
      listKnownSeries: requireFunction<AnyFn>('listKnownSeries', runtime.listSeries) as DebugRuntime['listKnownSeries'],
      dumpSeriesApiData: requireFunction<AnyFn>(
        'dumpSeriesApiData',
        runtime.dumpSeriesApiData,
      ) as DebugRuntime['dumpSeriesApiData'],
      printSeriesApiData: requireFunction<AnyFn>(
        'printSeriesApiData',
        runtime.printSeriesApiData,
      ) as DebugRuntime['printSeriesApiData'],
    }
  }

  function createContentComposition(input: ContentCompositionOptions): ContentCompositionRuntime {
    const options: ContentCompositionOptions = {
      ...input,
      corePrimitives: toFunctionRecord(input.corePrimitives),
    }
    requireFunction('normalizeImageUrlCandidate', options.dependencies.normalizeImageUrlCandidate)
    requireFunction('extractCoverImagesFromApiImages', options.dependencies.extractCoverImagesFromApiImages)
    requireFunction('extractThumbnailImageFromApiImages', options.dependencies.extractThumbnailImageFromApiImages)
    requireFunction('getWatchlistRoot', options.dependencies.getWatchlistRoot)
    requireFunction('getWatchlistHeader', options.dependencies.getWatchlistHeader)

    const deferredCallbacks: DeferredCompositionCallbacks = {
      createCuratedCardActions: () => [],
      installCuratedCardPreview: () => undefined,
      resetCuratedCachesForRefresh: () => undefined,
    }

    const normalizeEntriesFromApiRows = createEntryNormalizerBinding(options)

    const sortRuntime = createSortRuntime(options)
    const cardRuntime = createCardRuntime(options, sortRuntime, deferredCallbacks)
    const curatedRuntime = createCuratedRuntime(options, sortRuntime, cardRuntime, normalizeEntriesFromApiRows)

    deferredCallbacks.installCuratedCardPreview = curatedRuntime.installCuratedCardPreview

    const interactionsRuntime = createInteractionRuntime(options, deferredCallbacks, curatedRuntime)
    deferredCallbacks.createCuratedCardActions = interactionsRuntime.createCuratedCardActions

    const interfaceRuntime = createInterfaceRuntime(options, cardRuntime, curatedRuntime, interactionsRuntime)
    deferredCallbacks.resetCuratedCachesForRefresh = interfaceRuntime.resetCuratedCachesForRefresh

    const debugRuntime = createDebugRuntime(options)

    return {
      normalizeEntriesFromApiRows,
      createCuratedInterfaceControls: cardRuntime.createCuratedInterfaceControls,
      createCuratedCardBody: cardRuntime.createCuratedCardBody,
      createCuratedCard: cardRuntime.createCuratedCard,
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
      dumpSeriesApiData: debugRuntime.dumpSeriesApiData,
      printSeriesApiData: debugRuntime.printSeriesApiData,
    }
  }

  let runtimeRegistry = moduleRegistry.runtimeContentComposition
  if (!runtimeRegistry || typeof runtimeRegistry !== 'object') {
    runtimeRegistry = {}
    moduleRegistry.runtimeContentComposition = runtimeRegistry
  }

  ;(runtimeRegistry as LooseRecord).createContentComposition = createContentComposition
})()
