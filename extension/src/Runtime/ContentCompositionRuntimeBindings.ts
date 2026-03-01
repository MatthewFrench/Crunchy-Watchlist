type RuntimeBoundaryValue = CwBoundaryValue;
type RuntimeCallback = (...args: RuntimeBoundaryValue[]) => RuntimeBoundaryValue;
type LooseRecord = Record<string, RuntimeBoundaryValue>;
type CuratedRenderableBuildResult = {
  total: number;
  visible: Array<Record<string, RuntimeBoundaryValue>>;
  mode?: string;
  audioOptions?: Array<{ optionValue: string; title: string }>;
  genreOptions?: Array<{ optionValue: string; title: string }>;
  selectedAudioFilter?: string;
  selectedGenreFilter?: string;
};
type CuratedRenderableBuildFn = (
  entries: RuntimeBoundaryValue[],
  settings: LooseRecord,
) => CuratedRenderableBuildResult;
type CuratedRenderableFactoryRuntime = {
  buildRenderableEntries: CuratedRenderableBuildFn;
};
type CuratedPanelFactoryRuntime = {
  renderCuratedPanel: CuratedRuntime['renderCuratedPanel'];
  refreshCuratedLoadingIndicator: CuratedRuntime['refreshCuratedLoadingIndicator'];
  requestCuratedPanelRender?: CuratedRuntime['renderCuratedPanel'];
  dispose?: CuratedRuntime['dispose'];
};
type CuratedLoaderFactoryRuntime = {
  loadCuratedEntries: RuntimeCallback;
  ensureCuratedDataLoad: CuratedRuntime['ensureCuratedDataLoad'];
};
type NativeBridgeFactoryRuntime = {
  triggerNativeCardAction: CuratedRuntime['triggerNativeCardAction'];
  installCuratedCardPreview: CuratedRuntime['installCuratedCardPreview'];
  dispose?: CuratedRuntime['dispose'];
};
type CuratedInteractionsFactoryRuntime = {
  createCuratedCardActions: InteractionRuntime['createCuratedCardActions'];
  bindCuratedInterfaceControls: InteractionRuntime['bindCuratedInterfaceControls'];
  dispose?: InteractionRuntime['dispose'];
};
type InterfaceShellFactoryRuntime = {
  clearRootFrame: InterfaceRuntime['clearRootFrame'];
  setNativeVisibility: InterfaceRuntime['setNativeVisibility'];
  applyTabUi: InterfaceRuntime['applyTabUi'];
  resetCuratedCachesForRefresh: InterfaceRuntime['resetCuratedCachesForRefresh'];
  ensureInterface: InterfaceRuntime['ensureInterface'];
  dispose?: InterfaceRuntime['dispose'];
};

type ContentCompositionRuntimeBindingsRuntime = {
  createCuratedRuntime: (
    options: ContentCompositionOptions,
    sortRuntime: SortRuntime,
    cardRuntime: CardRuntime,
    normalizeEntriesFromApiRows: (rows: RuntimeBoundaryValue[]) => RuntimeBoundaryValue[],
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

function requireFunction<T>(name: string, value: RuntimeBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing content composition dependency: ${name}`);
  }
  return value as T;
}

function toSignatureToken(value: RuntimeBoundaryValue, fallback: string): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return fallback;
}

function buildRenderableMemoSignature(
  settings: LooseRecord,
  defaultSortMode: RuntimeBoundaryValue,
  preferredAudioLanguage: RuntimeBoundaryValue,
  ratingCacheRevision: number,
  watchHistoryCacheUpdatedAt: number,
): string {
  const audioLocaleFilter = toSignatureToken(settings.audioLocaleFilter, 'any');
  const genreFilter = toSignatureToken(settings.genreFilter, 'any');
  const watchReadyFilterMode = toSignatureToken(settings.watchReadyFilterMode, 'hide');
  const sortMode = toSignatureToken(settings.sortMode, toSignatureToken(defaultSortMode, 'none'));
  const secondarySortMode = toSignatureToken(settings.secondarySortMode, 'none');
  const preferredAudioToken = toSignatureToken(preferredAudioLanguage, '');
  return `af:${audioLocaleFilter}|gf:${genreFilter}|wf:${watchReadyFilterMode}|sm:${sortMode}|ss:${secondarySortMode}|pal:${preferredAudioToken}|rr:${ratingCacheRevision}|wh:${watchHistoryCacheUpdatedAt}`;
}

function getSettingsRecord(state: LooseRecord): LooseRecord {
  if (!state.settings || typeof state.settings !== 'object') {
    return {};
  }
  return state.settings as LooseRecord;
}

// Curated list memoization must include cache revisions and user-facing filter state.
// If any of these dimensions drift, we recompute to keep sort/filter output coherent.
function createCuratedRenderableBinding(
  options: ContentCompositionOptions,
  sortRuntime: SortRuntime,
): CuratedRuntime['buildRenderableEntries'] {
  const corePrimitives = options.corePrimitives;
  const dependencies = options.dependencies;
  const createCuratedRenderable = requireFunction<(dependencies: LooseRecord) => CuratedRenderableFactoryRuntime>(
    'createCuratedRenderable',
    options.modules.runtimeRenderableModule.createCuratedRenderable,
  );
  const curatedRenderable = createCuratedRenderable({
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
    compareRenderableEntries: (
      left: RuntimeBoundaryValue,
      right: RuntimeBoundaryValue,
      sortMode = getSettingsRecord(options.state).sortMode,
    ) => sortRuntime.compareRenderableEntries(left, right, sortMode),
  });
  options.assertRuntimeMethods('curated renderable', curatedRenderable, ['buildRenderableEntries']);
  const buildRenderableEntries = requireFunction<CuratedRenderableBuildFn>(
    'buildRenderableEntries',
    curatedRenderable.buildRenderableEntries,
  );
  let memoizedEntriesRef: RuntimeBoundaryValue[] | null = null;
  let memoizedSignature = '';
  let memoizedResult: CuratedRenderableBuildResult | null = null;

  return () => {
    const entries = Array.isArray(options.state.curatedEntries) ? options.state.curatedEntries : [];
    const settings = getSettingsRecord(options.state);
    const watchHistoryCacheUpdatedAt =
      options.state.watchHistoryCache &&
      typeof options.state.watchHistoryCache === 'object' &&
      Number.isFinite(Number((options.state.watchHistoryCache as LooseRecord).updatedAt))
        ? Math.max(0, Number((options.state.watchHistoryCache as LooseRecord).updatedAt))
        : 0;
    const ratingCacheRevision = Number(options.state.ratingCacheRevision) || 0;
    const preferredAudioLanguage = options.state.preferredAudioLanguage ?? '';
    const settingsSignature = buildRenderableMemoSignature(
      settings,
      options.runtimeConstants.defaultSortMode,
      preferredAudioLanguage,
      ratingCacheRevision,
      watchHistoryCacheUpdatedAt,
    );

    if (memoizedEntriesRef === entries && memoizedSignature === settingsSignature && memoizedResult != null) {
      return memoizedResult;
    }

    const renderSettings = {
      ...settings,
      __cwPreferredAudioLanguage: preferredAudioLanguage,
      __cwRatingCacheRevision: ratingCacheRevision,
      __cwWatchHistoryCacheUpdatedAt: watchHistoryCacheUpdatedAt,
    };
    const computed = buildRenderableEntries(entries, renderSettings);
    memoizedEntriesRef = entries;
    memoizedSignature = settingsSignature;
    memoizedResult = computed;
    return computed;
  };
}

function createCuratedPanelBinding(
  options: ContentCompositionOptions,
  cardRuntime: CardRuntime,
  buildRenderableEntries: CuratedRuntime['buildRenderableEntries'],
): Pick<CuratedRuntime, 'renderCuratedPanel' | 'refreshCuratedLoadingIndicator' | 'dispose'> {
  const dependencies = options.dependencies;
  const createCuratedPanelRuntime = requireFunction<(dependencies: LooseRecord) => CuratedPanelFactoryRuntime>(
    'createCuratedPanelRuntime',
    options.modules.runtimeCuratedPanelModule.createCuratedPanelRuntime,
  );
  const curatedPanelRuntime = createCuratedPanelRuntime({
    state: options.state,
    documentRef: options.windowRef.document,
    locationRef: options.windowRef.location,
    createCuratedCard: cardRuntime.createCuratedCard,
    patchCuratedCard: cardRuntime.patchCuratedCard,
    applyCardLayoutUi: dependencies.applyCardLayoutUi,
    buildRenderableEntries,
    withMutedObserver: dependencies.withMutedObserver,
    isLocalizedRatingDataMissingForEntries: dependencies.isLocalizedRatingDataMissingForEntries,
    isLocalizedWatchHistoryDataMissingForEntries: dependencies.isLocalizedWatchHistoryDataMissingForEntries,
    preloadRatingsForSelectedAudioLocale: dependencies.preloadRatingsForSelectedAudioLocale,
    preloadWatchHistoryForSelectedAudioLocale: dependencies.preloadWatchHistoryForSelectedAudioLocale,
    isWatchlistPath: dependencies.isWatchlistPath,
  });
  options.assertRuntimeMethods('curated panel runtime', curatedPanelRuntime, [
    'renderCuratedPanel',
    'refreshCuratedLoadingIndicator',
  ]);
  const requestCuratedPanelRender =
    typeof curatedPanelRuntime.requestCuratedPanelRender === 'function'
      ? curatedPanelRuntime.requestCuratedPanelRender
      : null;
  return {
    renderCuratedPanel: requireFunction<CuratedRuntime['renderCuratedPanel']>(
      requestCuratedPanelRender ? 'requestCuratedPanelRender' : 'renderCuratedPanel',
      requestCuratedPanelRender || curatedPanelRuntime.renderCuratedPanel,
    ),
    refreshCuratedLoadingIndicator: requireFunction<CuratedRuntime['refreshCuratedLoadingIndicator']>(
      'refreshCuratedLoadingIndicator',
      curatedPanelRuntime.refreshCuratedLoadingIndicator,
    ),
    dispose:
      typeof curatedPanelRuntime.dispose === 'function'
        ? (curatedPanelRuntime.dispose as CuratedRuntime['dispose'])
        : () => {},
  };
}

function createCuratedLoaderBinding(
  options: ContentCompositionOptions,
  normalizeEntriesFromApiRows: (rows: RuntimeBoundaryValue[]) => RuntimeBoundaryValue[],
  curatedPanelRuntime: Pick<CuratedRuntime, 'renderCuratedPanel' | 'refreshCuratedLoadingIndicator' | 'dispose'>,
): CuratedRuntime['ensureCuratedDataLoad'] {
  const corePrimitives = options.corePrimitives;
  const dependencies = options.dependencies;
  const createCuratedLoaderRuntime = requireFunction<(dependencies: LooseRecord) => CuratedLoaderFactoryRuntime>(
    'createCuratedLoaderRuntime',
    options.modules.runtimeCuratedLoaderModule.createCuratedLoaderRuntime,
  );
  const curatedLoaderRuntime = createCuratedLoaderRuntime({
    state: options.state,
    locationRef: options.windowRef.location,
    runtimeEvent: dependencies.runtimeEvent,
    getAccessToken: dependencies.getAccessToken,
    resetWatchlistCacheOnAccountMismatch: dependencies.resetWatchlistCacheOnAccountMismatch,
    fetchAllWatchlistRows: dependencies.fetchAllWatchlistRows,
    normalizeEntriesFromApiRows,
    preloadRatingsForEntries: dependencies.preloadRatingsForEntries,
    preloadWatchHistoryForEntries: dependencies.preloadWatchHistoryForEntries,
    isLocalizedWatchHistoryDataMissingForEntries: dependencies.isLocalizedWatchHistoryDataMissingForEntries,
    normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
    getPreferredAudioLanguage: dependencies.getPreferredAudioLanguage,
    setWatchlistCacheRows: dependencies.setWatchlistCacheRows,
    isWatchlistPath: dependencies.isWatchlistPath,
    renderCuratedPanel: curatedPanelRuntime.renderCuratedPanel,
    refreshCuratedLoadingIndicator: curatedPanelRuntime.refreshCuratedLoadingIndicator,
    watchlistRevalidateCooldownMs: options.runtimeConstants.watchlistRevalidateCooldownMs,
    watchlistCacheSourceRevalidateCooldownMs: options.runtimeConstants.watchlistCacheSourceRevalidateCooldownMs,
    metadataPriorityEntryCount: options.runtimeConstants.metadataPriorityEntryCount,
    metadataDeferredChunkSize: options.runtimeConstants.metadataDeferredChunkSize,
    metadataDeferredIdleTimeoutMs: options.runtimeConstants.metadataDeferredIdleTimeoutMs,
    metadataDeferredHiddenDelayMs: options.runtimeConstants.metadataDeferredHiddenDelayMs,
    metadataViewportPriorityCount: options.runtimeConstants.metadataViewportPriorityCount,
    windowRef: options.windowRef,
    documentRef: options.windowRef.document,
  });
  options.assertRuntimeMethods('curated loader runtime', curatedLoaderRuntime, [
    'loadCuratedEntries',
    'ensureCuratedDataLoad',
  ]);
  return requireFunction<CuratedRuntime['ensureCuratedDataLoad']>(
    'ensureCuratedDataLoad',
    curatedLoaderRuntime.ensureCuratedDataLoad,
  );
}

function createNativeBridgeBinding(
  options: ContentCompositionOptions,
): Pick<CuratedRuntime, 'triggerNativeCardAction' | 'installCuratedCardPreview' | 'dispose'> {
  const dependencies = options.dependencies;
  const createNativeBridgeRuntime = requireFunction<(dependencies: LooseRecord) => NativeBridgeFactoryRuntime>(
    'createNativeBridgeRuntime',
    options.modules.runtimeNativeBridgeModule.createNativeBridgeRuntime,
  );
  const nativeBridgeRuntime = createNativeBridgeRuntime({
    documentRef: options.windowRef.document,
    windowRef: options.windowRef,
    runtimeEvent: dependencies.runtimeEvent,
    getAccessToken: dependencies.getAccessToken,
    fetchWithResilience: dependencies.fetchWithResilience,
    createAuthRefreshHandler: dependencies.createAuthRefreshHandler,
    resolveApiHref: dependencies.resolveApiHref,
    normalizeImageUrlCandidate: dependencies.normalizeImageUrlCandidate,
    fetchPreviewUrlForEntry: dependencies.fetchPreviewUrlForEntry,
    isLikelyVideoUrl: dependencies.isLikelyVideoUrl,
    previewHoverDelayMs: options.runtimeConstants.previewHoverDelayMs,
  });
  options.assertRuntimeMethods('native bridge runtime', nativeBridgeRuntime, [
    'triggerNativeCardAction',
    'installCuratedCardPreview',
  ]);
  return {
    triggerNativeCardAction: requireFunction<CuratedRuntime['triggerNativeCardAction']>(
      'triggerNativeCardAction',
      nativeBridgeRuntime.triggerNativeCardAction,
    ),
    installCuratedCardPreview: requireFunction<CuratedRuntime['installCuratedCardPreview']>(
      'installCuratedCardPreview',
      nativeBridgeRuntime.installCuratedCardPreview,
    ),
    dispose:
      typeof nativeBridgeRuntime.dispose === 'function'
        ? (nativeBridgeRuntime.dispose as CuratedRuntime['dispose'])
        : () => {},
  };
}

function createCuratedRuntime(
  options: ContentCompositionOptions,
  sortRuntime: SortRuntime,
  cardRuntime: CardRuntime,
  normalizeEntriesFromApiRows: (rows: RuntimeBoundaryValue[]) => RuntimeBoundaryValue[],
): CuratedRuntime {
  const buildRenderableEntries = createCuratedRenderableBinding(options, sortRuntime);
  const curatedPanelRuntime = createCuratedPanelBinding(options, cardRuntime, buildRenderableEntries);
  const ensureCuratedDataLoad = createCuratedLoaderBinding(options, normalizeEntriesFromApiRows, curatedPanelRuntime);
  const nativeBridge = createNativeBridgeBinding(options);
  return {
    buildRenderableEntries,
    renderCuratedPanel: curatedPanelRuntime.renderCuratedPanel,
    refreshCuratedLoadingIndicator: curatedPanelRuntime.refreshCuratedLoadingIndicator,
    ensureCuratedDataLoad,
    triggerNativeCardAction: nativeBridge.triggerNativeCardAction,
    installCuratedCardPreview: nativeBridge.installCuratedCardPreview,
    dispose: () => {
      nativeBridge.dispose();
      curatedPanelRuntime.dispose();
    },
  };
}

function createInteractionRuntime(
  options: ContentCompositionOptions,
  deferredCallbacks: DeferredCompositionCallbacks,
  curatedRuntime: CuratedRuntime,
): InteractionRuntime {
  const createCuratedInteractionsRuntime = requireFunction<
    (dependencies: LooseRecord) => CuratedInteractionsFactoryRuntime
  >(
    'createCuratedInteractionsRuntime',
    options.modules.runtimeCuratedInteractionsModule.createCuratedInteractionsRuntime,
  );
  const runtime = createCuratedInteractionsRuntime({
    documentRef: options.windowRef.document,
    alertRef: (message: string) => options.windowRef.alert(message),
    confirmRef: (message: string) => options.windowRef.confirm(message),
    triggerNativeCardAction: curatedRuntime.triggerNativeCardAction,
    toggleCuratedFavorite: options.dependencies.toggleCuratedFavorite,
    removeCuratedSeries: options.dependencies.removeCuratedSeries,
    renderCuratedPanel: curatedRuntime.renderCuratedPanel,
    state: options.state,
    persistSettings: options.dependencies.persistSettings,
    resetCuratedCachesForRefresh: () => deferredCallbacks.resetCuratedCachesForRefresh(),
    ensureCuratedDataLoad: curatedRuntime.ensureCuratedDataLoad,
    debounceProcess: options.dependencies.debounceProcess,
  });
  options.assertRuntimeMethods('curated interactions runtime', runtime, [
    'createCuratedCardActions',
    'bindCuratedInterfaceControls',
  ]);

  return {
    createCuratedCardActions: requireFunction<InteractionRuntime['createCuratedCardActions']>(
      'createCuratedCardActions',
      runtime.createCuratedCardActions,
    ),
    bindCuratedInterfaceControls: requireFunction<InteractionRuntime['bindCuratedInterfaceControls']>(
      'bindCuratedInterfaceControls',
      runtime.bindCuratedInterfaceControls,
    ),
    dispose: typeof runtime.dispose === 'function' ? (runtime.dispose as InteractionRuntime['dispose']) : () => {},
  };
}

function createInterfaceRuntime(
  options: ContentCompositionOptions,
  cardRuntime: CardRuntime,
  curatedRuntime: CuratedRuntime,
  interactionsRuntime: InteractionRuntime,
): InterfaceRuntime {
  const createInterfaceShellRuntime = requireFunction<(dependencies: LooseRecord) => InterfaceShellFactoryRuntime>(
    'createInterfaceShellRuntime',
    options.modules.runtimeInterfaceShellModule.createInterfaceShellRuntime,
  );
  const runtime = createInterfaceShellRuntime({
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
  });
  options.assertRuntimeMethods('interface shell runtime', runtime, [
    'clearRootFrame',
    'setNativeVisibility',
    'applyTabUi',
    'resetCuratedCachesForRefresh',
    'ensureInterface',
  ]);

  return {
    clearRootFrame: requireFunction<InterfaceRuntime['clearRootFrame']>('clearRootFrame', runtime.clearRootFrame),
    setNativeVisibility: requireFunction<InterfaceRuntime['setNativeVisibility']>(
      'setNativeVisibility',
      runtime.setNativeVisibility,
    ),
    applyTabUi: requireFunction<InterfaceRuntime['applyTabUi']>('applyTabUi', runtime.applyTabUi),
    resetCuratedCachesForRefresh: requireFunction<InterfaceRuntime['resetCuratedCachesForRefresh']>(
      'resetCuratedCachesForRefresh',
      runtime.resetCuratedCachesForRefresh,
    ),
    ensureInterface: requireFunction<InterfaceRuntime['ensureInterface']>('ensureInterface', runtime.ensureInterface),
    dispose: typeof runtime.dispose === 'function' ? (runtime.dispose as InterfaceRuntime['dispose']) : () => {},
  };
}

export function createContentCompositionRuntimeBindingsRuntime(): ContentCompositionRuntimeBindingsRuntime {
  return {
    createCuratedRuntime: (options, sortRuntime, cardRuntime, normalizeEntriesFromApiRows) =>
      createCuratedRuntime(options, sortRuntime, cardRuntime, normalizeEntriesFromApiRows),
    createInteractionRuntime: (options, deferredCallbacks, curatedRuntime) =>
      createInteractionRuntime(options, deferredCallbacks, curatedRuntime),
    createInterfaceRuntime: (options, cardRuntime, curatedRuntime, interactionsRuntime) =>
      createInterfaceRuntime(options, cardRuntime, curatedRuntime, interactionsRuntime),
  };
}
