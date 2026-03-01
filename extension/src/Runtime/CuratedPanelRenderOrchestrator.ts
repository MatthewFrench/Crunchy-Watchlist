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
  audioFilterSelectEl: Element | null;
  genreFilterSelectEl: Element | null;
  settings: CuratedBoundaryRecord;
};

type CuratedPanelGridRuntime = {
  renderCuratedGridIfNeeded: (options: {
    state: RuntimeState;
    documentRef: Document;
    visible: CuratedRenderableEntry[];
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
    watchReadyFilterMode: string,
    total: number,
    visibleCount: number,
    loading: boolean,
  ) => void;
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
  private renderQueued = false;
  private flushScheduled = false;
  private renderInProgress = false;
  private disposed = false;

  constructor(options: CuratedPanelRenderOrchestratorOptions) {
    this.context = options;
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
    });
  };

  readonly dispose = (): void => {
    this.disposed = true;
    this.renderQueued = false;
    this.flushScheduled = false;
    this.renderInProgress = false;
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
    if (!state.gridEl || !state.statsEl) {
      return;
    }

    const statsEl = state.statsEl;
    this.context.applyCardLayoutUi();

    const {
      mode: watchReadyFilterMode,
      total,
      visible,
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
    const gridRenderSignature = this.buildCuratedGridRenderSignature(
      visible,
      total,
      loading,
      metadataLoading,
      pendingRequests,
      requestProgress,
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
        total,
        loading,
        metadataLoading,
        gridRenderSignature,
        createCuratedCard: this.context.createCuratedCard,
        patchCuratedCard: this.context.patchCuratedCard,
      });
      this.context.controlsSyncOwner.updateStatsText(statsEl, watchReadyFilterMode, total, visible.length, loading);
    });

    this.context.localizedPreloadCoordinator.queue(selectedAudioFilter, this.requestRender);
  };

  private readonly syncLoadingIndicator = (): void => {
    const { state } = this.context;
    const loadingIndicatorEl = state.loadingIndicatorEl;
    if (!loadingIndicatorEl) {
      return;
    }

    const loading = Boolean(state.curatedInflight);
    const hasNoCuratedEntries = !Array.isArray(state.curatedEntries) || state.curatedEntries.length === 0;
    const firstLoadInFlight = loading && (state.curatedInitialLoadDone !== true || hasNoCuratedEntries);
    const pendingRequests = this.getPendingRequestItems(state.curatedPendingRequests);
    const requestProgress = this.getPendingRequestProgress(pendingRequests);

    this.context.curatedPanelLoadingIndicatorRuntime.syncLoadingIndicator({
      documentRef: this.context.documentRef,
      loadingIndicatorEl,
      loadingBoxEl: state.loadingBoxEl,
      loading,
      firstLoadInFlight,
      pendingRequests,
      requestProgress,
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

    let revisionHash = 2_166_136_261;
    visible.forEach((entry, index) => {
      revisionHash = this.hashRenderableEntryRevision(revisionHash, entry, index);
    });

    const firstSeriesId = this.getRenderableSeriesId(visible[0] || {}, 0);
    const lastSeriesId = this.getRenderableSeriesId(visible[visible.length - 1] || {}, visible.length - 1);
    return `count:${visible.length}|first:${firstSeriesId}|last:${lastSeriesId}|hash:${revisionHash.toString(16)}`;
  };

  private readonly buildCuratedGridRenderSignature = (
    visible: CuratedRenderableEntry[],
    total: number,
    loading: boolean,
    metadataLoading: boolean,
    pendingRequests: string[],
    requestProgress: RequestProgress,
  ): string => {
    const normalizedCardLayout = this.context.state.settings.cardLayout === 'landscape' ? 'landscape' : 'portrait';
    if (visible.length) {
      return `layout:${normalizedCardLayout}|meta:${metadataLoading ? '1' : '0'}|visible:${this.buildVisibleRevisionSignature(
        visible,
      )}`;
    }

    const progress = loading ? requestProgress : { started: 0, completed: 0, inProgress: 0 };
    return [
      `layout:${normalizedCardLayout}`,
      `empty:${this.resolveCuratedGridEmptyStateKey(total, loading)}`,
      `pending:${loading ? pendingRequests.join('\u001f') : ''}`,
      `progress:${progress.started}/${progress.completed}/${progress.inProgress}`,
    ].join('|');
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
