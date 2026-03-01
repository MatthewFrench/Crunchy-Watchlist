import { createCuratedPanelGridRuntime as createCuratedPanelGridRuntimeFactory } from './CuratedPanelGrid.js';
import { createCuratedPanelLoadingIndicatorRuntime as createCuratedPanelLoadingIndicatorRuntimeFactory } from './CuratedPanelLoadingIndicator.js';

type CuratedBoundaryValue = CwBoundaryValue;
type CuratedBoundaryRecord = Record<string, CuratedBoundaryValue>;
type CuratedBoundaryArray = CuratedBoundaryValue[];
type CuratedBoundaryPromise = Promise<CuratedBoundaryValue>;
type CuratedRenderableEntry = CuratedBoundaryRecord;
type CuratedCardFactory = (entry: CuratedRenderableEntry) => Element;
type CuratedCardPatchFn = (card: Element, entry: CuratedRenderableEntry) => void;
type LocalizedMetadataMissingFn = (entries: CuratedBoundaryArray, audioLocale: CuratedBoundaryValue) => boolean;
type LocalizedMetadataPreloadFn = (audioLocale: string) => CuratedBoundaryPromise;

type RenderableResult = {
  mode: 'none' | 'dim' | 'hide' | 'hide_not_started';
  total: number;
  visible: CuratedRenderableEntry[];
  audioOptions: Array<{ optionValue: string; title: string }>;
  genreOptions: Array<{ optionValue: string; title: string }>;
  selectedAudioFilter: string;
  selectedGenreFilter: string;
};

type RuntimeState = {
  mounted: boolean;
  curatedError: CuratedBoundaryValue;
  curatedEntries: CuratedBoundaryArray;
  curatedInflight: CuratedBoundaryPromise | null;
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

type RequestProgress = {
  started: number;
  completed: number;
  inProgress: number;
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
  dispose?: () => void;
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
  createCuratedCard: CuratedCardFactory;
  patchCuratedCard: CuratedCardPatchFn | null;
  applyCardLayoutUi: () => void;
  buildRenderableEntries: () => RenderableResult;
  withMutedObserver: (work: () => void) => void;
  isLocalizedRatingDataMissingForEntries: LocalizedMetadataMissingFn;
  isLocalizedWatchHistoryDataMissingForEntries: LocalizedMetadataMissingFn;
  preloadRatingsForSelectedAudioLocale: LocalizedMetadataPreloadFn;
  preloadWatchHistoryForSelectedAudioLocale: LocalizedMetadataPreloadFn;
  isWatchlistPath: (pathname: string) => boolean;
  curatedPanelGridRuntime: CuratedPanelGridRuntime;
  curatedPanelLoadingIndicatorRuntime: CuratedPanelLoadingIndicatorRuntime;
};

type CuratedPanelOptions = {
  state?: CuratedBoundaryValue;
  documentRef?: CuratedBoundaryValue;
  locationRef?: CuratedBoundaryValue;
  createCuratedCard?: CuratedBoundaryValue;
  patchCuratedCard?: CuratedBoundaryValue;
  applyCardLayoutUi?: CuratedBoundaryValue;
  buildRenderableEntries?: CuratedBoundaryValue;
  withMutedObserver?: CuratedBoundaryValue;
  isLocalizedRatingDataMissingForEntries?: CuratedBoundaryValue;
  isLocalizedWatchHistoryDataMissingForEntries?: CuratedBoundaryValue;
  preloadRatingsForSelectedAudioLocale?: CuratedBoundaryValue;
  preloadWatchHistoryForSelectedAudioLocale?: CuratedBoundaryValue;
  isWatchlistPath?: CuratedBoundaryValue;
};

type CuratedPanelRuntime = {
  renderCuratedPanel: () => void;
  requestCuratedPanelRender: () => void;
  refreshCuratedLoadingIndicator: () => void;
  dispose: () => void;
};

type CuratedPanelRenderScheduler = {
  renderNow: () => void;
  requestRender: () => void;
  dispose: () => void;
};

type SelectLike = {
  options: ArrayLike<{ value: string }>;
  value: string;
  textContent: string | null;
  appendChild: (child: Element) => Element;
};

type SelectOption = {
  optionValue: string;
  title: string;
};

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;

function requireFunction<T>(name: string, value: CuratedBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing curated panel dependency: ${name}`);
  }

  return value as T;
}

function resolveCuratedPanelGridRuntime(): CuratedPanelGridRuntime {
  const runtime = createCuratedPanelGridRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated panel dependency: runtimeCuratedPanelGrid.runtime');
  }

  return {
    renderCuratedGridIfNeeded: requireFunction(
      'runtimeCuratedPanelGrid.renderCuratedGridIfNeeded',
      (runtime as CuratedBoundaryRecord).renderCuratedGridIfNeeded,
    ),
  };
}

function resolveCuratedPanelLoadingIndicatorRuntime(): CuratedPanelLoadingIndicatorRuntime {
  const runtime = createCuratedPanelLoadingIndicatorRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated panel dependency: runtimeCuratedPanelLoadingIndicator.runtime');
  }

  return {
    syncLoadingIndicator: requireFunction(
      'runtimeCuratedPanelLoadingIndicator.syncLoadingIndicator',
      (runtime as CuratedBoundaryRecord).syncLoadingIndicator,
    ),
  };
}

function getPendingRequestItems(value: CuratedBoundaryValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => Boolean(item));
}

function toNonNegativeInt(value: CuratedBoundaryValue): number {
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
    preloadRatingsForSelectedAudioLocale: requireFunction<CuratedPanelContext['preloadRatingsForSelectedAudioLocale']>(
      'preloadRatingsForSelectedAudioLocale',
      options.preloadRatingsForSelectedAudioLocale,
    ),
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

function getRenderableSeriesId(entry: CuratedRenderableEntry, index: number): string {
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

function hashRenderableEntryRevision(hash: number, entry: CuratedRenderableEntry, index: number): number {
  const revisionFields: CuratedBoundaryValue[] = [
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

function buildVisibleRevisionSignature(visible: CuratedRenderableEntry[]): string {
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
  visible: CuratedRenderableEntry[],
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

function asSelectLike(value: CuratedBoundaryValue): SelectLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Partial<SelectLike>;
  if (!record.options || typeof record.appendChild !== 'function') {
    return null;
  }
  return record as SelectLike;
}

function asSelectOptions(value: CuratedBoundaryValue): SelectOption[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is SelectOption => {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const record = item as CuratedBoundaryRecord;
    return typeof record.optionValue === 'string' && typeof record.title === 'string';
  });
}

function setSelectOptionsInternal(
  documentRef: Document,
  selectValue: CuratedBoundaryValue,
  optionsValue: CuratedBoundaryValue,
  selectedValue: CuratedBoundaryValue,
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

function getWatchHistoryCacheUpdatedAtInternal(state: RuntimeState): number {
  const watchHistoryCache = state.watchHistoryCache;
  if (!watchHistoryCache || typeof watchHistoryCache !== 'object') {
    return 0;
  }

  const updatedAtValue = Number((watchHistoryCache as CuratedBoundaryRecord).updatedAt);
  return Number.isFinite(updatedAtValue) && updatedAtValue > 0 ? Math.round(updatedAtValue) : 0;
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

  const initialRatingCacheRevision = Number(context.state.ratingCacheRevision) || 0;
  const initialWatchHistoryUpdatedAt = getWatchHistoryCacheUpdatedAtInternal(context.state);
  const preloadTasks: CuratedBoundaryPromise[] = [];
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

    const nextRatingCacheRevision = Number(context.state.ratingCacheRevision) || 0;
    const nextWatchHistoryUpdatedAt = getWatchHistoryCacheUpdatedAtInternal(context.state);
    if (
      nextRatingCacheRevision === initialRatingCacheRevision &&
      nextWatchHistoryUpdatedAt === initialWatchHistoryUpdatedAt
    ) {
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
  const hasNoCuratedEntries = !Array.isArray(context.state.curatedEntries) || context.state.curatedEntries.length === 0;
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
    setSelectOptionsInternal(context.documentRef, context.state.audioFilterSelectEl, audioOptions, selectedAudioFilter);
    setSelectOptionsInternal(context.documentRef, context.state.genreFilterSelectEl, genreOptions, selectedGenreFilter);

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
  let disposed = false;

  const runQueuedRender = (): void => {
    if (disposed) {
      return;
    }
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
    if (disposed) {
      return;
    }
    renderQueued = true;
    if (renderInProgress || flushScheduled) {
      return;
    }

    flushScheduled = true;
    queueMicrotaskInternal(() => {
      if (disposed) {
        return;
      }
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
      if (disposed) {
        return;
      }
      renderQueued = false;
      runQueuedRender();
    },
    requestRender,
    dispose: () => {
      disposed = true;
      renderQueued = false;
      flushScheduled = false;
    },
  };
}

class CuratedPanelOwner implements CuratedPanelRuntime {
  private readonly context: CuratedPanelContext;
  private readonly renderScheduler: CuratedPanelRenderScheduler;
  private disposed = false;

  constructor(options: CuratedPanelOptions = {}) {
    this.context = createCuratedPanelContext(options);
    this.renderScheduler = createCuratedPanelRenderScheduler(this.context);
  }

  readonly renderCuratedPanel = (): void => {
    if (this.disposed) {
      return;
    }
    this.renderScheduler.renderNow();
  };

  readonly requestCuratedPanelRender = (): void => {
    if (this.disposed) {
      return;
    }
    this.renderScheduler.requestRender();
  };

  readonly refreshCuratedLoadingIndicator = (): void => {
    if (this.disposed) {
      return;
    }
    refreshCuratedLoadingIndicatorInternal(this.context);
  };

  readonly dispose = (): void => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderScheduler.dispose();
    this.context.curatedPanelGridRuntime.dispose?.();
  };
}

function createCuratedPanelRuntime(options: CuratedPanelOptions = {}): CuratedPanelRuntime {
  return new CuratedPanelOwner(options);
}

const runtimeCuratedPanelModule = {
  createCuratedPanelRuntime,
};

export function createRuntimeCuratedPanelRuntime(): object {
  return runtimeCuratedPanelModule;
}
