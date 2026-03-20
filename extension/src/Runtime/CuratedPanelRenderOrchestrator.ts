type CuratedBoundaryValue = CwBoundaryValue;
type CuratedBoundaryRecord = Record<string, CuratedBoundaryValue>;
type CuratedBoundaryArray = CuratedBoundaryValue[];
type CuratedRenderableEntry = CuratedBoundaryRecord;

type CuratedCardFactory = (entry: CuratedRenderableEntry) => Element;
type CuratedCardPatchFn = (card: Element, entry: CuratedRenderableEntry) => void;

type RenderableResult = {
  mode: 'none' | 'dim' | 'hide' | 'hide_not_started';
  total: number;
  visible: CuratedRenderableEntry[];
  retainedHidden?: CuratedRenderableEntry[];
  audioOptions: Array<{ optionValue: string; title: string }>;
  genreOptions: Array<{ optionValue: string; title: string }>;
  selectedAudioFilter: string;
  selectedGenreFilter: string;
};

type RequestProgress = {
  started: number;
  completed: number;
  inProgress: number;
};

type LoadingIndicatorStatus = {
  pendingRequests: string[];
  requestProgress: RequestProgress;
};

type RuntimeState = {
  mounted: boolean;
  curatedError: CuratedBoundaryValue;
  curatedEntries: CuratedBoundaryArray;
  curatedInflight: Promise<CuratedBoundaryValue> | null;
  curatedDeferredMetadataInFlight?: boolean;
  curatedInitialLoadDone?: boolean;
  curatedPendingRequests: string[];
  curatedPendingRequestStartedCount: number;
  curatedPendingRequestCompletedCount: number;
  ratingCacheRevision?: number;
  watchHistoryCache?: CuratedBoundaryValue;
  curatedGridRenderSignature: string;
  gridEl: (Element & { textContent: string | null }) | null;
  statsEl: (Element & { textContent: string | null }) | null;
  loadingBoxEl: Element | null;
  loadingIndicatorEl: (Element & { style?: Record<string, string> }) | null;
  controlsLoadingIndicatorEl: Element | null;
  audioFilterSelectEl: Element | null;
  genreFilterSelectEl: Element | null;
  settings: CuratedBoundaryRecord;
};

type CuratedPanelGridRuntime = {
  renderCuratedGridIfNeeded: (options: {
    state: RuntimeState;
    documentRef: Document;
    visible: CuratedRenderableEntry[];
    retainedHidden?: CuratedRenderableEntry[];
    total: number;
    loading: boolean;
    metadataLoading: boolean;
    gridRenderSignature: string;
    createCuratedCard: CuratedCardFactory;
    patchCuratedCard?: CuratedCardPatchFn | null;
  }) => void;
};

type CuratedPanelLoadingIndicatorRuntime = {
  syncLoadingIndicator: (options: {
    documentRef: Document;
    loadingIndicatorEl: Element;
    loadingBoxEl?: Element | null;
    gridEl?: Element | null;
    loading: boolean;
    firstLoadInFlight: boolean;
    pendingRequests: string[];
    requestProgress: RequestProgress;
  }) => void;
};

type CuratedPanelControlsSyncOwner = {
  syncFilterOptions: (
    audioFilterSelectEl: CuratedBoundaryValue,
    genreFilterSelectEl: CuratedBoundaryValue,
    audioOptions: CuratedBoundaryValue,
    genreOptions: CuratedBoundaryValue,
    selectedAudioFilter: string,
    selectedGenreFilter: string,
  ) => void;
  updateStatsText: (
    statsEl: Element & { textContent: string | null },
    summary: {
      totalCount: number;
      visibleCount: number;
      loading: boolean;
    },
  ) => void;
  updateLoadingIndicatorVisibility: (loadingIndicatorEl: CuratedBoundaryValue, loading: boolean) => void;
};

type CuratedPanelLocalizedPreloadCoordinator = {
  queue: (selectedAudioFilter: string, onRenderRequested: () => void) => void;
};

type CuratedPanelRenderOrchestratorOptions = {
  state: RuntimeState;
  documentRef: Document;
  createCuratedCard: CuratedCardFactory;
  patchCuratedCard: CuratedCardPatchFn | null;
  applyCardLayoutUi: () => void;
  buildRenderableEntries: () => RenderableResult;
  withMutedObserver: (work: () => void) => void;
  curatedPanelGridRuntime: CuratedPanelGridRuntime;
  curatedPanelLoadingIndicatorRuntime: CuratedPanelLoadingIndicatorRuntime;
  controlsSyncOwner: CuratedPanelControlsSyncOwner;
  localizedPreloadCoordinator: CuratedPanelLocalizedPreloadCoordinator;
};

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
const deferredMetadataBlockingTaskLabel = 'Finishing remaining card details';

function updateRevisionHash(hash: number, value: string): number {
  let next = hash >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    next ^= value.charCodeAt(index);
    next = Math.imul(next, 16_777_619);
  }
  return next >>> 0;
}

function hashRevisionToken(hash: number, value: CuratedBoundaryValue): number {
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
    const record = value as CuratedBoundaryRecord;
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

export class CuratedPanelRenderOrchestrator {
  private readonly context: CuratedPanelRenderOrchestratorOptions;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly gridMutationObserver: MutationObserver | null;
  private observedResizeTarget: Element | null = null;
  private observedGridElement: Element | null = null;
  private observedGridAvailableWidthKey = '0';
  private cachedVisibleEntries: CuratedRenderableEntry[] | null = null;
  private cachedVisibleRevisionSignature = 'count:0|first:|last:|hash:0';
  private initialLoadingLatched = false;
  private renderQueued = false;
  private flushScheduled = false;
  private renderInProgress = false;
  private disposed = false;

  constructor(options: CuratedPanelRenderOrchestratorOptions) {
    this.context = options;
    const ResizeObserverCtor =
      typeof root.ResizeObserver === 'function' ? (root.ResizeObserver as typeof ResizeObserver) : null;
    this.resizeObserver = ResizeObserverCtor ? new ResizeObserverCtor(this.handleGridResizeObserved) : null;
    const MutationObserverCtor =
      typeof root.MutationObserver === 'function' ? (root.MutationObserver as typeof MutationObserver) : null;
    this.gridMutationObserver = MutationObserverCtor
      ? new MutationObserverCtor(this.handleGridMutationsObserved)
      : null;
  }

  readonly renderNow = (): void => {
    if (this.disposed) {
      return;
    }
    this.renderQueued = false;
    this.runQueuedRender();
  };

  readonly requestRender = (): void => {
    if (this.disposed) {
      return;
    }
    this.renderQueued = true;
    if (this.renderInProgress || this.flushScheduled) {
      return;
    }

    this.flushScheduled = true;
    this.queueMicrotask(() => {
      if (this.disposed) {
        return;
      }
      this.flushScheduled = false;
      if (!this.renderQueued) {
        return;
      }
      this.renderQueued = false;
      this.runQueuedRender();
    });
  };

  readonly refreshLoadingIndicator = (): void => {
    if (this.disposed) {
      return;
    }

    this.context.withMutedObserver(() => {
      this.syncLoadingIndicator();
      const { state } = this.context;
      const loading = Boolean(state.curatedInflight) || Boolean(state.curatedDeferredMetadataInFlight);
      const pendingRequests = this.getPendingRequestItems(state.curatedPendingRequests);
      this.context.controlsSyncOwner.updateLoadingIndicatorVisibility(
        state.controlsLoadingIndicatorEl,
        loading || pendingRequests.length > 0,
      );
    });
  };

  readonly dispose = (): void => {
    this.disposed = true;
    this.renderQueued = false;
    this.flushScheduled = false;
    this.renderInProgress = false;
    if (this.resizeObserver) {
      if (this.observedResizeTarget) {
        this.resizeObserver.unobserve(this.observedResizeTarget);
      }
      this.resizeObserver.disconnect();
    }
    if (this.gridMutationObserver) {
      this.gridMutationObserver.disconnect();
    }
    this.observedResizeTarget = null;
    this.observedGridElement = null;
    this.observedGridAvailableWidthKey = '0';
    this.cachedVisibleEntries = null;
    this.cachedVisibleRevisionSignature = 'count:0|first:|last:|hash:0';
  };

  private readonly runQueuedRender = (): void => {
    if (this.disposed) {
      return;
    }
    if (this.renderInProgress) {
      this.renderQueued = true;
      return;
    }

    this.renderInProgress = true;
    try {
      this.renderCuratedPanel();
    } finally {
      this.renderInProgress = false;
    }

    if (!this.renderQueued) {
      return;
    }

    this.requestRender();
  };

  private readonly renderCuratedPanel = (): void => {
    const { state } = this.context;
    this.syncGridResizeObservation(state.gridEl);
    this.syncGridMutationObservation(state.gridEl);
    if (!state.gridEl || !state.statsEl) {
      return;
    }

    const statsEl = state.statsEl;
    this.context.applyCardLayoutUi();

    const {
      total,
      visible,
      retainedHidden = [],
      audioOptions,
      genreOptions,
      selectedAudioFilter,
      selectedGenreFilter,
    } = this.context.buildRenderableEntries();

    const loading = Boolean(state.curatedInflight);
    const deferredMetadataLoading = Boolean(state.curatedDeferredMetadataInFlight);
    const pendingRequests = this.getPendingRequestItems(state.curatedPendingRequests);
    const metadataLoading = loading || deferredMetadataLoading;
    const requestProgress = this.getPendingRequestProgress(pendingRequests);
    const gridAvailableWidthKey = this.resolveGridAvailableWidthKey(state.gridEl);
    this.observedGridAvailableWidthKey = gridAvailableWidthKey;
    const gridRenderSignature = this.buildCuratedGridRenderSignature(
      visible,
      total,
      loading,
      metadataLoading,
      pendingRequests,
      requestProgress,
      gridAvailableWidthKey,
    );

    this.context.withMutedObserver(() => {
      this.context.controlsSyncOwner.syncFilterOptions(
        state.audioFilterSelectEl,
        state.genreFilterSelectEl,
        audioOptions,
        genreOptions,
        selectedAudioFilter,
        selectedGenreFilter,
      );

      this.syncLoadingIndicator();

      this.context.curatedPanelGridRuntime.renderCuratedGridIfNeeded({
        state,
        documentRef: this.context.documentRef,
        visible,
        retainedHidden,
        total,
        loading,
        metadataLoading,
        gridRenderSignature,
        createCuratedCard: this.context.createCuratedCard,
        patchCuratedCard: this.context.patchCuratedCard,
      });
      this.context.controlsSyncOwner.updateStatsText(statsEl, {
        totalCount: total,
        visibleCount: visible.length,
        loading,
      });
      this.context.controlsSyncOwner.updateLoadingIndicatorVisibility(
        state.controlsLoadingIndicatorEl,
        metadataLoading || pendingRequests.length > 0,
      );
    });

    this.context.localizedPreloadCoordinator.queue(selectedAudioFilter, this.requestRender);
  };

  private readonly syncLoadingIndicator = (): void => {
    const { state } = this.context;
    const loadingIndicatorEl = state.loadingIndicatorEl;
    if (!loadingIndicatorEl) {
      return;
    }

    const loading = Boolean(state.curatedInflight) || Boolean(state.curatedDeferredMetadataInFlight);
    const hasNoCuratedEntries = !Array.isArray(state.curatedEntries) || state.curatedEntries.length === 0;
    const pendingRequests = this.getPendingRequestItems(state.curatedPendingRequests);
    const loadingIndicatorStatus = this.getLoadingIndicatorStatus();
    const showFirstLoadByCurrentState = loading && (state.curatedInitialLoadDone !== true || hasNoCuratedEntries);
    // Latch first-load visibility so the shared loading box stays mounted until
    // all initial work (including deferred metadata) has fully settled.
    if (state.curatedInitialLoadDone !== true && (loading || pendingRequests.length > 0 || hasNoCuratedEntries)) {
      this.initialLoadingLatched = true;
    }
    if (
      this.initialLoadingLatched &&
      state.curatedInitialLoadDone === true &&
      !loading &&
      pendingRequests.length === 0
    ) {
      this.initialLoadingLatched = false;
    }
    const firstLoadInFlight =
      showFirstLoadByCurrentState || (this.initialLoadingLatched && (loading || pendingRequests.length > 0));

    this.context.curatedPanelLoadingIndicatorRuntime.syncLoadingIndicator({
      documentRef: this.context.documentRef,
      loadingIndicatorEl,
      loadingBoxEl: state.loadingBoxEl,
      gridEl: state.gridEl,
      loading,
      firstLoadInFlight,
      pendingRequests: loadingIndicatorStatus.pendingRequests,
      requestProgress: loadingIndicatorStatus.requestProgress,
    });
  };

  private readonly getPendingRequestItems = (value: CuratedBoundaryValue): string[] => {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => Boolean(item));
  };

  private readonly toNonNegativeInt = (value: CuratedBoundaryValue): number => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
  };

  private readonly getPendingRequestProgress = (pendingRequests: string[]): RequestProgress => {
    const { state } = this.context;
    const started = this.toNonNegativeInt(state.curatedPendingRequestStartedCount);
    const completed = Math.min(this.toNonNegativeInt(state.curatedPendingRequestCompletedCount), started);
    return {
      started,
      completed,
      inProgress: pendingRequests.length,
    };
  };

  /**
   * Deferred metadata keeps the shared loading box mounted, so surface it as
   * explicit blocking work after tracked requests have already completed.
   */
  private readonly getLoadingIndicatorStatus = (): LoadingIndicatorStatus => {
    const { state } = this.context;
    const pendingRequests = this.getPendingRequestItems(state.curatedPendingRequests);
    const requestProgress = this.getPendingRequestProgress(pendingRequests);

    if (state.curatedDeferredMetadataInFlight !== true) {
      return {
        pendingRequests,
        requestProgress,
      };
    }

    return {
      pendingRequests: [...pendingRequests, deferredMetadataBlockingTaskLabel],
      requestProgress: {
        started: requestProgress.started + 1,
        completed: requestProgress.completed,
        inProgress: requestProgress.inProgress + 1,
      },
    };
  };

  private readonly resolveCuratedGridEmptyStateKey = (total: number, loading: boolean): string => {
    const { state } = this.context;
    if (state.curatedError && total === 0) {
      return `error:${state.curatedError}`;
    }
    if (loading && total === 0) {
      return 'loading';
    }
    if (total > 0) {
      return 'no-match';
    }
    return 'no-watchlist';
  };

  private readonly getRenderableSeriesId = (entry: CuratedRenderableEntry, index: number): string => {
    const value = entry.seriesId;
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
    return `index:${index}`;
  };

  private readonly hashRenderableEntryRevision = (
    hash: number,
    entry: CuratedRenderableEntry,
    index: number,
  ): number => {
    const revisionFields: CuratedBoundaryValue[] = [
      this.getRenderableSeriesId(entry, index),
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
  };

  private readonly buildVisibleRevisionSignature = (visible: CuratedRenderableEntry[]): string => {
    if (!visible.length) {
      return 'count:0|first:|last:|hash:0';
    }
    if (visible === this.cachedVisibleEntries) {
      return this.cachedVisibleRevisionSignature;
    }

    let revisionHash = 2_166_136_261;
    visible.forEach((entry, index) => {
      revisionHash = this.hashRenderableEntryRevision(revisionHash, entry, index);
    });

    const firstSeriesId = this.getRenderableSeriesId(visible[0] || {}, 0);
    const lastSeriesId = this.getRenderableSeriesId(visible[visible.length - 1] || {}, visible.length - 1);
    const nextSignature = `count:${visible.length}|first:${firstSeriesId}|last:${lastSeriesId}|hash:${revisionHash.toString(16)}`;
    this.cachedVisibleEntries = visible;
    this.cachedVisibleRevisionSignature = nextSignature;
    return nextSignature;
  };

  private readonly buildCuratedGridRenderSignature = (
    visible: CuratedRenderableEntry[],
    total: number,
    loading: boolean,
    metadataLoading: boolean,
    pendingRequests: string[],
    requestProgress: RequestProgress,
    gridAvailableWidthKey: string,
  ): string => {
    const normalizedCardLayout = this.context.state.settings.cardLayout === 'landscape' ? 'landscape' : 'portrait';
    if (visible.length) {
      return `layout:${normalizedCardLayout}|grid:${gridAvailableWidthKey}|meta:${
        metadataLoading ? '1' : '0'
      }|visible:${this.buildVisibleRevisionSignature(visible)}`;
    }

    const progress = loading ? requestProgress : { started: 0, completed: 0, inProgress: 0 };
    return [
      `layout:${normalizedCardLayout}`,
      `grid:${gridAvailableWidthKey}`,
      `empty:${this.resolveCuratedGridEmptyStateKey(total, loading)}`,
      `pending:${loading ? pendingRequests.join('\u001f') : ''}`,
      `progress:${progress.started}/${progress.completed}/${progress.inProgress}`,
    ].join('|');
  };

  private readonly handleGridResizeObserved = (): void => {
    if (this.disposed) {
      return;
    }

    const nextGridElement = this.context.state.gridEl;
    this.syncGridResizeObservation(nextGridElement);
    if (!nextGridElement) {
      return;
    }

    const nextWidthKey = this.resolveGridAvailableWidthKey(nextGridElement);
    if (nextWidthKey === this.observedGridAvailableWidthKey) {
      return;
    }

    this.observedGridAvailableWidthKey = nextWidthKey;
    this.requestRender();
  };

  private readonly handleGridMutationsObserved = (): void => {
    if (this.disposed || this.renderInProgress) {
      return;
    }

    const { state } = this.context;
    const gridElement = this.observedGridElement;
    if (!gridElement || state.gridEl !== gridElement) {
      return;
    }

    const childCount = Number((gridElement as Element & { children?: ArrayLike<Element> }).children?.length) || 0;
    if (childCount > 0) {
      return;
    }

    const loading = Boolean(state.curatedInflight) || Boolean(state.curatedDeferredMetadataInFlight);
    const pendingRequests = this.getPendingRequestItems(state.curatedPendingRequests);
    if (loading || pendingRequests.length > 0) {
      return;
    }

    this.requestRender();
  };

  private readonly syncGridResizeObservation = (gridElement: Element | null): void => {
    if (!this.resizeObserver) {
      return;
    }

    const nextResizeTarget = this.resolveGridResizeTarget(gridElement);
    const previousResizeTarget = this.observedResizeTarget;
    if (previousResizeTarget && previousResizeTarget !== nextResizeTarget) {
      this.resizeObserver.unobserve(previousResizeTarget);
    }
    if (nextResizeTarget && previousResizeTarget !== nextResizeTarget) {
      this.resizeObserver.observe(nextResizeTarget);
    }

    this.observedResizeTarget = nextResizeTarget;
  };

  private readonly syncGridMutationObservation = (gridElement: Element | null): void => {
    if (!this.gridMutationObserver) {
      return;
    }

    if (this.observedGridElement === gridElement) {
      return;
    }

    this.gridMutationObserver.disconnect();
    this.observedGridElement = gridElement;

    if (gridElement) {
      this.gridMutationObserver.observe(gridElement, {
        childList: true,
      });
    }
  };

  private readonly resolveGridResizeTarget = (gridElement: Element | null): Element | null => {
    if (!gridElement) {
      return null;
    }

    const parentElement = (gridElement as Element & { parentElement?: Element | null }).parentElement;
    if (parentElement) {
      return parentElement;
    }

    const parentNode = (gridElement as Element & { parentNode?: object | null }).parentNode;
    if (parentNode && typeof parentNode === 'object') {
      return parentNode as Element;
    }

    return gridElement;
  };

  private readonly resolveGridAvailableWidthKey = (gridElement: Element | null): string => {
    if (!gridElement) {
      return '0';
    }

    const resizeTarget = this.resolveGridResizeTarget(gridElement);
    const widthPx = Math.max(this.resolveElementWidthPx(resizeTarget), this.resolveElementWidthPx(gridElement));
    if (!Number.isFinite(widthPx) || widthPx <= 0) {
      return '0';
    }
    return String(Math.round(widthPx));
  };

  private readonly resolveElementWidthPx = (element: Element | null): number => {
    if (!element) {
      return 0;
    }

    const measurableElement = element as Element & {
      getBoundingClientRect?: () => { width?: number };
      clientWidth?: number;
    };
    const rectWidth = Number(measurableElement.getBoundingClientRect?.().width) || 0;
    if (rectWidth > 0) {
      return rectWidth;
    }
    const clientWidth = Number(measurableElement.clientWidth) || 0;
    if (clientWidth > 0) {
      return clientWidth;
    }
    return 0;
  };

  private readonly queueMicrotask = (work: () => void): void => {
    if (typeof root.queueMicrotask === 'function') {
      root.queueMicrotask(work);
      return;
    }

    Promise.resolve()
      .then(work)
      .catch(() => {});
  };
}
