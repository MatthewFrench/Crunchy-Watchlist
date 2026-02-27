;(() => {
  type AnyFn = (...args: unknown[]) => unknown
  type LooseRecord = Record<string, unknown>
  type AnyFunctionRecord = Record<string, unknown>

  type ContentCompositionRuntimeBindingsRuntime = {
    createCuratedRuntime: (
      options: ContentCompositionOptions,
      sortRuntime: SortRuntime,
      cardRuntime: CardRuntime,
      normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[],
    ) => CuratedRuntime
    createInteractionRuntime: (
      options: ContentCompositionOptions,
      deferredCallbacks: DeferredCompositionCallbacks,
      curatedRuntime: CuratedRuntime,
    ) => InteractionRuntime
    createInterfaceRuntime: (
      options: ContentCompositionOptions,
      cardRuntime: CardRuntime,
      curatedRuntime: CuratedRuntime,
      interactionsRuntime: InteractionRuntime,
    ) => InterfaceRuntime
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord
    }
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

  function getSettingsRecord(state: LooseRecord): LooseRecord {
    if (!state.settings || typeof state.settings !== 'object') {
      return {}
    }
    return state.settings as LooseRecord
  }

  // Curated list memoization must include cache revisions and user-facing filter state.
  // If any of these dimensions drift, we recompute to keep sort/filter output coherent.
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
    const buildRenderableEntries = requireFunction<AnyFn>(
      'buildRenderableEntries',
      curatedRenderable.buildRenderableEntries,
    )
    let memoizedEntriesRef: unknown[] | null = null
    let memoizedSignature = ''
    let memoizedResult: unknown = null

    return () => {
      const entries = Array.isArray(options.state.curatedEntries) ? options.state.curatedEntries : []
      const settings = getSettingsRecord(options.state)
      const watchHistoryCacheUpdatedAt =
        options.state.watchHistoryCache &&
        typeof options.state.watchHistoryCache === 'object' &&
        Number.isFinite(Number((options.state.watchHistoryCache as LooseRecord).updatedAt))
          ? Math.max(0, Number((options.state.watchHistoryCache as LooseRecord).updatedAt))
          : 0
      const settingsSignature = JSON.stringify({
        audioLocaleFilter: settings.audioLocaleFilter ?? 'any',
        genreFilter: settings.genreFilter ?? 'any',
        watchReadyFilterMode: settings.watchReadyFilterMode ?? 'hide',
        sortMode: settings.sortMode ?? options.runtimeConstants.defaultSortMode ?? 'none',
        secondarySortMode: settings.secondarySortMode ?? 'none',
        preferredAudioLanguage: options.state.preferredAudioLanguage ?? '',
        ratingCacheRevision: Number(options.state.ratingCacheRevision) || 0,
        watchHistoryCacheUpdatedAt,
      })

      if (memoizedEntriesRef === entries && memoizedSignature === settingsSignature && memoizedResult != null) {
        return memoizedResult
      }

      const computed = buildRenderableEntries(entries, settings)
      memoizedEntriesRef = entries
      memoizedSignature = settingsSignature
      memoizedResult = computed
      return computed
    }
  }

  function createCuratedPanelBinding(
    options: ContentCompositionOptions,
    cardRuntime: CardRuntime,
    buildRenderableEntries: CuratedRuntime['buildRenderableEntries'],
  ): Pick<CuratedRuntime, 'renderCuratedPanel' | 'refreshCuratedLoadingIndicator'> {
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
    options.assertRuntimeMethods('curated panel runtime', curatedPanelRuntime, [
      'renderCuratedPanel',
      'refreshCuratedLoadingIndicator',
    ])
    return {
      renderCuratedPanel: requireFunction<AnyFn>(
        'renderCuratedPanel',
        curatedPanelRuntime.renderCuratedPanel,
      ) as CuratedRuntime['renderCuratedPanel'],
      refreshCuratedLoadingIndicator: requireFunction<AnyFn>(
        'refreshCuratedLoadingIndicator',
        curatedPanelRuntime.refreshCuratedLoadingIndicator,
      ) as CuratedRuntime['refreshCuratedLoadingIndicator'],
    }
  }

  function createCuratedLoaderBinding(
    options: ContentCompositionOptions,
    normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[],
    curatedPanelRuntime: Pick<CuratedRuntime, 'renderCuratedPanel' | 'refreshCuratedLoadingIndicator'>,
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
      getAccessToken: dependencies.getAccessToken,
      fetchWithResilience: dependencies.fetchWithResilience,
      createAuthRefreshHandler: dependencies.createAuthRefreshHandler,
      resolveApiHref: dependencies.resolveApiHref,
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
    const curatedPanelRuntime = createCuratedPanelBinding(options, cardRuntime, buildRenderableEntries)
    const ensureCuratedDataLoad = createCuratedLoaderBinding(options, normalizeEntriesFromApiRows, curatedPanelRuntime)
    const nativeBridge = createNativeBridgeBinding(options)
    return {
      buildRenderableEntries,
      renderCuratedPanel: curatedPanelRuntime.renderCuratedPanel,
      refreshCuratedLoadingIndicator: curatedPanelRuntime.refreshCuratedLoadingIndicator,
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

  function createContentCompositionRuntimeBindingsRuntime(): ContentCompositionRuntimeBindingsRuntime {
    return {
      createCuratedRuntime: (options, sortRuntime, cardRuntime, normalizeEntriesFromApiRows) =>
        createCuratedRuntime(options, sortRuntime, cardRuntime, normalizeEntriesFromApiRows),
      createInteractionRuntime: (options, deferredCallbacks, curatedRuntime) =>
        createInteractionRuntime(options, deferredCallbacks, curatedRuntime),
      createInterfaceRuntime: (options, cardRuntime, curatedRuntime, interactionsRuntime) =>
        createInterfaceRuntime(options, cardRuntime, curatedRuntime, interactionsRuntime),
    }
  }

  moduleRegistry.runtimeContentCompositionRuntimeBindings = {
    createContentCompositionRuntimeBindingsRuntime,
  }
})()
