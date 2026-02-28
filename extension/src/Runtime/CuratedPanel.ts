(() => {
  type RenderableResult = {
    mode: 'none' | 'dim' | 'hide' | 'hide_not_started';
    total: number;
    visible: Array<Record<string, unknown>>;
    audioOptions: Array<{ optionValue: string; title: string }>;
    genreOptions: Array<{ optionValue: string; title: string }>;
    selectedAudioFilter: string;
    selectedGenreFilter: string;
  };

  type RuntimeState = {
    mounted: boolean;
    curatedError: unknown;
    curatedEntries: unknown[];
    curatedInflight: Promise<unknown> | null;
    curatedDeferredMetadataInFlight?: boolean;
    curatedInitialLoadDone?: boolean;
    curatedPendingRequests: string[];
    curatedPendingRequestStartedCount: number;
    curatedPendingRequestCompletedCount: number;
    curatedGridRenderSignature: string;
    gridEl: (Element & { textContent: string | null }) | null;
    statsEl: (Element & { textContent: string | null }) | null;
    loadingBoxEl: Element | null;
    loadingIndicatorEl: (Element & { style?: Record<string, string> }) | null;
    audioFilterSelectEl: Element | null;
    genreFilterSelectEl: Element | null;
    settings: Record<string, unknown>;
  };

  type RequestProgress = {
    started: number;
    completed: number;
    inProgress: number;
  };

  type CuratedPanelGridRuntime = {
    renderCuratedGridIfNeeded: (options: {
      state: RuntimeState;
      documentRef: Document;
      visible: Array<Record<string, unknown>>;
      total: number;
      loading: boolean;
      metadataLoading: boolean;
      gridRenderSignature: string;
      createCuratedCard: (entry: Record<string, unknown>) => Element;
      patchCuratedCard?: ((card: Element, entry: Record<string, unknown>) => void) | null;
    }) => void;
  };

  type CuratedPanelLoadingIndicatorRuntime = {
    syncLoadingIndicator: (options: {
      documentRef: Document;
      loadingIndicatorEl: Element;
      loadingBoxEl?: Element | null;
      loading: boolean;
      firstLoadInFlight: boolean;
      pendingRequests: string[];
      requestProgress: RequestProgress;
    }) => void;
  };

  type CuratedPanelContext = {
    state: RuntimeState;
    documentRef: Document;
    locationRef: Location;
    createCuratedCard: (entry: Record<string, unknown>) => Element;
    patchCuratedCard: ((card: Element, entry: Record<string, unknown>) => void) | null;
    applyCardLayoutUi: () => void;
    buildRenderableEntries: () => RenderableResult;
    withMutedObserver: (work: () => void) => void;
    isLocalizedRatingDataMissingForEntries: (entries: unknown[], audioLocale: unknown) => boolean;
    isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown[], audioLocale: unknown) => boolean;
    preloadRatingsForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>;
    preloadWatchHistoryForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>;
    isWatchlistPath: (pathname: string) => boolean;
    curatedPanelGridRuntime: CuratedPanelGridRuntime;
    curatedPanelLoadingIndicatorRuntime: CuratedPanelLoadingIndicatorRuntime;
  };

  type CuratedPanelOptions = {
    state?: unknown;
    documentRef?: unknown;
    locationRef?: unknown;
    createCuratedCard?: unknown;
    patchCuratedCard?: unknown;
    applyCardLayoutUi?: unknown;
    buildRenderableEntries?: unknown;
    withMutedObserver?: unknown;
    isLocalizedRatingDataMissingForEntries?: unknown;
    isLocalizedWatchHistoryDataMissingForEntries?: unknown;
    preloadRatingsForSelectedAudioLocale?: unknown;
    preloadWatchHistoryForSelectedAudioLocale?: unknown;
    isWatchlistPath?: unknown;
  };

  type CuratedPanelRuntime = {
    renderCuratedPanel: () => void;
    requestCuratedPanelRender: () => void;
    refreshCuratedLoadingIndicator: () => void;
  };

  type CuratedPanelRenderScheduler = {
    renderNow: () => void;
    requestRender: () => void;
  };

  type SelectLike = {
    options: ArrayLike<{ value: string }>;
    value: string;
    textContent: string | null;
    appendChild: (child: Element) => unknown;
  };

  type SelectOption = {
    optionValue: string;
    title: string;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated panel dependency: ${name}`);
    }

    return value as T;
  }

  function requireRuntimeFactory<T>(moduleName: string, factoryName: string): () => T {
    const moduleValue = moduleRegistry[moduleName];
    if (!moduleValue || typeof moduleValue !== 'object') {
      throw new Error(`[CW] Missing curated panel dependency: ${moduleName}`);
    }

    const factory = (moduleValue as Record<string, unknown>)[factoryName];
    if (typeof factory !== 'function') {
      throw new Error(`[CW] Missing curated panel dependency: ${moduleName}.${factoryName}`);
    }

    return factory as () => T;
  }

  function resolveCuratedPanelGridRuntime(): CuratedPanelGridRuntime {
    const createRuntime = requireRuntimeFactory<unknown>('runtimeCuratedPanelGrid', 'createCuratedPanelGridRuntime');
    const runtime = createRuntime();
    if (!runtime || typeof runtime !== 'object') {
      throw new Error('[CW] Missing curated panel dependency: runtimeCuratedPanelGrid.runtime');
    }

    return {
      renderCuratedGridIfNeeded: requireFunction(
        'runtimeCuratedPanelGrid.renderCuratedGridIfNeeded',
        (runtime as Record<string, unknown>).renderCuratedGridIfNeeded,
      ),
    };
  }

  function resolveCuratedPanelLoadingIndicatorRuntime(): CuratedPanelLoadingIndicatorRuntime {
    const createRuntime = requireRuntimeFactory<unknown>(
      'runtimeCuratedPanelLoadingIndicator',
      'createCuratedPanelLoadingIndicatorRuntime',
    );
    const runtime = createRuntime();
    if (!runtime || typeof runtime !== 'object') {
      throw new Error('[CW] Missing curated panel dependency: runtimeCuratedPanelLoadingIndicator.runtime');
    }

    return {
      syncLoadingIndicator: requireFunction(
        'runtimeCuratedPanelLoadingIndicator.syncLoadingIndicator',
        (runtime as Record<string, unknown>).syncLoadingIndicator,
      ),
    };
  }

  function getPendingRequestItems(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => Boolean(item));
  }

  function toNonNegativeInt(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
  }

  function getPendingRequestProgressInternal(context: CuratedPanelContext, pendingRequests: string[]): RequestProgress {
    const started = toNonNegativeInt(context.state.curatedPendingRequestStartedCount);
    const completed = Math.min(toNonNegativeInt(context.state.curatedPendingRequestCompletedCount), started);
    return {
      started,
      completed,
      inProgress: pendingRequests.length,
    };
  }

  function createCuratedPanelContext(options: CuratedPanelOptions = {}): CuratedPanelContext {
    const state = options.state && typeof options.state === 'object' ? (options.state as RuntimeState) : null;
    if (!state) {
      throw new Error('[CW] Missing curated panel state');
    }
    const documentRef =
      options.documentRef && typeof options.documentRef === 'object' ? (options.documentRef as Document) : null;
    if (!documentRef) {
      throw new Error('[CW] Missing curated panel documentRef');
    }
    const locationRef =
      options.locationRef && typeof options.locationRef === 'object' ? (options.locationRef as Location) : null;
    if (!locationRef) {
      throw new Error('[CW] Missing curated panel locationRef');
    }

    return {
      state,
      documentRef,
      locationRef,
      createCuratedCard: requireFunction<CuratedPanelContext['createCuratedCard']>(
        'createCuratedCard',
        options.createCuratedCard,
      ),
      patchCuratedCard:
        typeof options.patchCuratedCard === 'function'
          ? (options.patchCuratedCard as CuratedPanelContext['patchCuratedCard'])
          : null,
      applyCardLayoutUi: requireFunction<CuratedPanelContext['applyCardLayoutUi']>(
        'applyCardLayoutUi',
        options.applyCardLayoutUi,
      ),
      buildRenderableEntries: requireFunction<CuratedPanelContext['buildRenderableEntries']>(
        'buildRenderableEntries',
        options.buildRenderableEntries,
      ),
      withMutedObserver: requireFunction<CuratedPanelContext['withMutedObserver']>(
        'withMutedObserver',
        options.withMutedObserver,
      ),
      isLocalizedRatingDataMissingForEntries: requireFunction<
        CuratedPanelContext['isLocalizedRatingDataMissingForEntries']
      >('isLocalizedRatingDataMissingForEntries', options.isLocalizedRatingDataMissingForEntries),
      isLocalizedWatchHistoryDataMissingForEntries: requireFunction<
        CuratedPanelContext['isLocalizedWatchHistoryDataMissingForEntries']
      >('isLocalizedWatchHistoryDataMissingForEntries', options.isLocalizedWatchHistoryDataMissingForEntries),
      preloadRatingsForSelectedAudioLocale: requireFunction<
        CuratedPanelContext['preloadRatingsForSelectedAudioLocale']
      >('preloadRatingsForSelectedAudioLocale', options.preloadRatingsForSelectedAudioLocale),
      preloadWatchHistoryForSelectedAudioLocale: requireFunction<
        CuratedPanelContext['preloadWatchHistoryForSelectedAudioLocale']
      >('preloadWatchHistoryForSelectedAudioLocale', options.preloadWatchHistoryForSelectedAudioLocale),
      isWatchlistPath: requireFunction<CuratedPanelContext['isWatchlistPath']>(
        'isWatchlistPath',
        options.isWatchlistPath,
      ),
      curatedPanelGridRuntime: resolveCuratedPanelGridRuntime(),
      curatedPanelLoadingIndicatorRuntime: resolveCuratedPanelLoadingIndicatorRuntime(),
    };
  }

  function resolveCuratedGridEmptyStateKey(context: CuratedPanelContext, total: number, loading: boolean): string {
    if (context.state.curatedError && total === 0) {
      return `error:${context.state.curatedError}`;
    }
    if (loading && total === 0) {
      return 'loading';
    }
    if (total > 0) {
      return 'no-match';
    }
    return 'no-watchlist';
  }

  function getRenderableSeriesId(entry: Record<string, unknown>, index: number): string {
    const value = entry.seriesId;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
    return `index:${index}`;
  }

  function updateRevisionHash(hash: number, value: string): number {
    let next = hash >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      next ^= value.charCodeAt(index);
      next = Math.imul(next, 16_777_619);
    }
    return next >>> 0;
  }

  function hashRevisionToken(hash: number, value: unknown): number {
    if (value == null) {
      return updateRevisionHash(hash, '');
    }
    if (typeof value === 'string') {
      return updateRevisionHash(hash, value);
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return updateRevisionHash(hash, String(value));
    }
    if (Array.isArray(value)) {
      let next = updateRevisionHash(hash, `len:${value.length}`);
      value.forEach((item) => {
        next = hashRevisionToken(next, item);
      });
      return next;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      let next = updateRevisionHash(hash, `keys:${keys.length}`);
      keys.forEach((key) => {
        next = updateRevisionHash(next, key);
        next = hashRevisionToken(next, record[key]);
      });
      return next;
    }
    return updateRevisionHash(hash, String(value));
  }

  function hashRenderableEntryRevision(hash: number, entry: Record<string, unknown>, index: number): number {
    const revisionFields: unknown[] = [
      getRenderableSeriesId(entry, index),
      entry.title,
      entry.fixtureTitle,
      entry.href,
      entry.episodeHref,
      entry.description,
      entry.displayStatus,
      entry.nextEpisodeTitle,
      entry.rating,
      entry.votes,
      entry.isFavorite,
      entry.watchReady,
      entry.dimNotWatchReady,
      entry.lastWatchedMs,
      entry.episodeWatchProgressRatio,
      entry.portraitImageUrl,
      entry.landscapeImageUrl,
      entry.imageUrl,
      entry.hoverPreviewImageUrl,
      entry.episodeCount,
      entry.seasonCount,
      entry.fullyWatched,
      entry.neverWatched,
      entry.genreTags,
      entry.audioLocales,
      entry.distribution,
      entry.watchHistoryProgressEntry,
    ];

    let next = hashRevisionToken(hash, index);
    revisionFields.forEach((field) => {
      next = hashRevisionToken(next, field);
    });
    return next;
  }

  function buildVisibleRevisionSignature(visible: Array<Record<string, unknown>>): string {
    if (!visible.length) {
      return 'count:0|first:|last:|hash:0';
    }

    let revisionHash = 2_166_136_261;
    visible.forEach((entry, index) => {
      revisionHash = hashRenderableEntryRevision(revisionHash, entry, index);
    });

    const firstSeriesId = getRenderableSeriesId(visible[0] || {}, 0);
    const lastSeriesId = getRenderableSeriesId(visible[visible.length - 1] || {}, visible.length - 1);
    return `count:${visible.length}|first:${firstSeriesId}|last:${lastSeriesId}|hash:${revisionHash.toString(16)}`;
  }

  function buildCuratedGridRenderSignature(
    context: CuratedPanelContext,
    visible: Array<Record<string, unknown>>,
    total: number,
    loading: boolean,
    metadataLoading: boolean,
    pendingRequests: string[],
    requestProgress: RequestProgress,
  ): string {
    const normalizedCardLayout = context.state.settings.cardLayout === 'landscape' ? 'landscape' : 'portrait';
    if (visible.length) {
      return `layout:${normalizedCardLayout}|meta:${metadataLoading ? '1' : '0'}|visible:${buildVisibleRevisionSignature(
        visible,
      )}`;
    }

    const progress = loading ? requestProgress : { started: 0, completed: 0, inProgress: 0 };
    return [
      `layout:${normalizedCardLayout}`,
      `empty:${resolveCuratedGridEmptyStateKey(context, total, loading)}`,
      `pending:${loading ? pendingRequests.join('\u001f') : ''}`,
      `progress:${progress.started}/${progress.completed}/${progress.inProgress}`,
    ].join('|');
  }

  function asSelectLike(value: unknown): SelectLike | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const record = value as Partial<SelectLike>;
    if (!record.options || typeof record.appendChild !== 'function') {
      return null;
    }
    return record as SelectLike;
  }

  function asSelectOptions(value: unknown): SelectOption[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is SelectOption => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const record = item as Record<string, unknown>;
      return typeof record.optionValue === 'string' && typeof record.title === 'string';
    });
  }

  function setSelectOptionsInternal(
    documentRef: Document,
    selectValue: unknown,
    optionsValue: unknown,
    selectedValue: unknown,
  ): void {
    const select = asSelectLike(selectValue);
    if (!select) {
      return;
    }

    const options = asSelectOptions(optionsValue);
    const currentValue = String(selectedValue ?? '');
    const existing = Array.from(select.options).map((option) => option.value);
    const next = options.map((option) => option.optionValue);
    const unchanged = existing.length === next.length && existing.every((value, index) => value === next[index]);

    if (!unchanged) {
      select.textContent = '';
      options.forEach(({ optionValue, title }) => {
        const option = documentRef.createElement('option') as HTMLOptionElement;
        option.value = optionValue;
        option.textContent = title;
        select.appendChild(option);
      });
    }

    select.value = next.includes(currentValue) ? currentValue : options[0]?.optionValue || '';
  }

  function resolveCuratedStatsText(
    context: CuratedPanelContext,
    watchReadyFilterMode: string,
    total: number,
    visibleCount: number,
    loading: boolean,
  ): string {
    const shouldShowFilteredCount = watchReadyFilterMode === 'hide' || watchReadyFilterMode === 'hide_not_started';
    if (context.state.curatedError && total === 0) {
      return 'API load failed';
    }
    if (loading && total === 0) {
      return '';
    }
    if (loading && total > 0) {
      const base = shouldShowFilteredCount ? `Showing ${visibleCount} of ${total}` : `${total} shows`;
      return `${base} (refreshing...)`;
    }
    if (context.state.curatedError) {
      return String(context.state.curatedError);
    }
    return shouldShowFilteredCount ? `Showing ${visibleCount} of ${total}` : `${total} shows`;
  }

  function queueLocalizedCuratedPreloads(
    context: CuratedPanelContext,
    selectedAudioFilter: string,
    onRenderRequested: () => void,
  ): void {
    const shouldPreloadLocalizedRatings =
      selectedAudioFilter !== 'any' &&
      context.isLocalizedRatingDataMissingForEntries(context.state.curatedEntries, selectedAudioFilter);
    const shouldPreloadLocalizedWatchHistory =
      selectedAudioFilter !== 'any' &&
      context.isLocalizedWatchHistoryDataMissingForEntries(context.state.curatedEntries, selectedAudioFilter);

    if (!shouldPreloadLocalizedRatings && !shouldPreloadLocalizedWatchHistory) {
      return;
    }

    const preloadTasks: Array<Promise<unknown>> = [];
    if (shouldPreloadLocalizedRatings) {
      preloadTasks.push(context.preloadRatingsForSelectedAudioLocale(selectedAudioFilter));
    }
    if (shouldPreloadLocalizedWatchHistory) {
      preloadTasks.push(context.preloadWatchHistoryForSelectedAudioLocale(selectedAudioFilter));
    }

    Promise.allSettled(preloadTasks).then(() => {
      if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
        return;
      }
      onRenderRequested();
    });
  }

  function syncLoadingIndicatorInternal(context: CuratedPanelContext): void {
    const loadingIndicatorEl = context.state.loadingIndicatorEl;
    if (!loadingIndicatorEl) {
      return;
    }

    const loading = Boolean(context.state.curatedInflight);
    const hasNoCuratedEntries =
      !Array.isArray(context.state.curatedEntries) || context.state.curatedEntries.length === 0;
    const firstLoadInFlight = loading && (context.state.curatedInitialLoadDone !== true || hasNoCuratedEntries);
    const pendingRequests = getPendingRequestItems(context.state.curatedPendingRequests);
    const requestProgress = getPendingRequestProgressInternal(context, pendingRequests);
    context.curatedPanelLoadingIndicatorRuntime.syncLoadingIndicator({
      documentRef: context.documentRef,
      loadingIndicatorEl,
      loadingBoxEl: context.state.loadingBoxEl,
      loading,
      firstLoadInFlight,
      pendingRequests,
      requestProgress,
    });
  }

  function refreshCuratedLoadingIndicatorInternal(context: CuratedPanelContext): void {
    context.withMutedObserver(() => {
      syncLoadingIndicatorInternal(context);
    });
  }

  function renderCuratedPanelInternal(context: CuratedPanelContext, requestRender: () => void): void {
    if (!context.state.gridEl || !context.state.statsEl) {
      return;
    }
    const statsEl = context.state.statsEl;
    context.applyCardLayoutUi();

    const {
      mode: watchReadyFilterMode,
      total,
      visible,
      audioOptions,
      genreOptions,
      selectedAudioFilter,
      selectedGenreFilter,
    } = context.buildRenderableEntries();
    const loading = Boolean(context.state.curatedInflight);
    const deferredMetadataLoading = Boolean(context.state.curatedDeferredMetadataInFlight);
    const pendingRequests = getPendingRequestItems(context.state.curatedPendingRequests);
    const metadataLoading = loading || deferredMetadataLoading;
    const requestProgress = getPendingRequestProgressInternal(context, pendingRequests);
    const gridRenderSignature = buildCuratedGridRenderSignature(
      context,
      visible,
      total,
      loading,
      metadataLoading,
      pendingRequests,
      requestProgress,
    );

    context.withMutedObserver(() => {
      setSelectOptionsInternal(
        context.documentRef,
        context.state.audioFilterSelectEl,
        audioOptions,
        selectedAudioFilter,
      );
      setSelectOptionsInternal(
        context.documentRef,
        context.state.genreFilterSelectEl,
        genreOptions,
        selectedGenreFilter,
      );

      syncLoadingIndicatorInternal(context);

      context.curatedPanelGridRuntime.renderCuratedGridIfNeeded({
        state: context.state,
        documentRef: context.documentRef,
        visible,
        total,
        loading,
        metadataLoading,
        gridRenderSignature,
        createCuratedCard: context.createCuratedCard,
        patchCuratedCard: context.patchCuratedCard,
      });
      statsEl.textContent = resolveCuratedStatsText(context, watchReadyFilterMode, total, visible.length, loading);
    });

    queueLocalizedCuratedPreloads(context, selectedAudioFilter, requestRender);
  }

  function queueMicrotaskInternal(work: () => void): void {
    if (typeof root.queueMicrotask === 'function') {
      root.queueMicrotask(work);
      return;
    }
    Promise.resolve()
      .then(work)
      .catch(() => {});
  }

  function createCuratedPanelRenderScheduler(context: CuratedPanelContext): CuratedPanelRenderScheduler {
    let renderQueued = false;
    let flushScheduled = false;
    let renderInProgress = false;

    const runQueuedRender = (): void => {
      if (renderInProgress) {
        renderQueued = true;
        return;
      }

      renderInProgress = true;
      try {
        renderCuratedPanelInternal(context, requestRender);
      } finally {
        renderInProgress = false;
      }

      if (!renderQueued) {
        return;
      }

      requestRender();
    };

    const requestRender = (): void => {
      renderQueued = true;
      if (renderInProgress || flushScheduled) {
        return;
      }

      flushScheduled = true;
      queueMicrotaskInternal(() => {
        flushScheduled = false;
        if (!renderQueued) {
          return;
        }
        renderQueued = false;
        runQueuedRender();
      });
    };

    return {
      renderNow: () => {
        renderQueued = false;
        runQueuedRender();
      },
      requestRender,
    };
  }

  function createCuratedPanelRuntime(options: CuratedPanelOptions = {}): CuratedPanelRuntime {
    const context = createCuratedPanelContext(options);
    const renderScheduler = createCuratedPanelRenderScheduler(context);
    return {
      renderCuratedPanel: () => renderScheduler.renderNow(),
      requestCuratedPanelRender: () => renderScheduler.requestRender(),
      refreshCuratedLoadingIndicator: () => refreshCuratedLoadingIndicatorInternal(context),
    };
  }

  moduleRegistry.runtimeCuratedPanel = {
    createCuratedPanelRuntime,
  };
})();
