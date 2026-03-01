import { CuratedPanelControlsSyncOwner } from './CuratedPanelControlsSync.js';
import { createCuratedPanelGridRuntime as createCuratedPanelGridRuntimeFactory } from './CuratedPanelGrid.js';
import { createCuratedPanelLoadingIndicatorRuntime as createCuratedPanelLoadingIndicatorRuntimeFactory } from './CuratedPanelLoadingIndicator.js';
import { CuratedPanelLocalizedPreloadCoordinator } from './CuratedPanelLocalizedPreloadCoordinator.js';
import { CuratedPanelRenderOrchestrator } from './CuratedPanelRenderOrchestrator.js';

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
  controlsSyncOwner: CuratedPanelControlsSyncOwner;
  localizedPreloadCoordinator: CuratedPanelLocalizedPreloadCoordinator;
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

  const resolvedRuntime: CuratedPanelGridRuntime = {
    renderCuratedGridIfNeeded: requireFunction(
      'runtimeCuratedPanelGrid.renderCuratedGridIfNeeded',
      (runtime as CuratedBoundaryRecord).renderCuratedGridIfNeeded,
    ),
  };
  if (typeof (runtime as CuratedBoundaryRecord).dispose === 'function') {
    resolvedRuntime.dispose = (runtime as CuratedBoundaryRecord).dispose as () => void;
  }
  return resolvedRuntime;
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

  const createCuratedCard = requireFunction<CuratedPanelContext['createCuratedCard']>(
    'createCuratedCard',
    options.createCuratedCard,
  );
  const patchCuratedCard =
    typeof options.patchCuratedCard === 'function'
      ? (options.patchCuratedCard as CuratedPanelContext['patchCuratedCard'])
      : null;
  const applyCardLayoutUi = requireFunction<CuratedPanelContext['applyCardLayoutUi']>(
    'applyCardLayoutUi',
    options.applyCardLayoutUi,
  );
  const buildRenderableEntries = requireFunction<CuratedPanelContext['buildRenderableEntries']>(
    'buildRenderableEntries',
    options.buildRenderableEntries,
  );
  const withMutedObserver = requireFunction<CuratedPanelContext['withMutedObserver']>(
    'withMutedObserver',
    options.withMutedObserver,
  );
  const isLocalizedRatingDataMissingForEntries = requireFunction<
    CuratedPanelContext['isLocalizedRatingDataMissingForEntries']
  >('isLocalizedRatingDataMissingForEntries', options.isLocalizedRatingDataMissingForEntries);
  const isLocalizedWatchHistoryDataMissingForEntries = requireFunction<
    CuratedPanelContext['isLocalizedWatchHistoryDataMissingForEntries']
  >('isLocalizedWatchHistoryDataMissingForEntries', options.isLocalizedWatchHistoryDataMissingForEntries);
  const preloadRatingsForSelectedAudioLocale = requireFunction<
    CuratedPanelContext['preloadRatingsForSelectedAudioLocale']
  >('preloadRatingsForSelectedAudioLocale', options.preloadRatingsForSelectedAudioLocale);
  const preloadWatchHistoryForSelectedAudioLocale = requireFunction<
    CuratedPanelContext['preloadWatchHistoryForSelectedAudioLocale']
  >('preloadWatchHistoryForSelectedAudioLocale', options.preloadWatchHistoryForSelectedAudioLocale);
  const isWatchlistPath = requireFunction<CuratedPanelContext['isWatchlistPath']>(
    'isWatchlistPath',
    options.isWatchlistPath,
  );

  const localizedPreloadCoordinator = new CuratedPanelLocalizedPreloadCoordinator({
    state,
    locationRef,
    isWatchlistPath,
    isLocalizedRatingDataMissingForEntries,
    isLocalizedWatchHistoryDataMissingForEntries,
    preloadRatingsForSelectedAudioLocale,
    preloadWatchHistoryForSelectedAudioLocale,
  });

  return {
    state,
    documentRef,
    locationRef,
    createCuratedCard,
    patchCuratedCard,
    applyCardLayoutUi,
    buildRenderableEntries,
    withMutedObserver,
    isLocalizedRatingDataMissingForEntries,
    isLocalizedWatchHistoryDataMissingForEntries,
    preloadRatingsForSelectedAudioLocale,
    preloadWatchHistoryForSelectedAudioLocale,
    isWatchlistPath,
    curatedPanelGridRuntime: resolveCuratedPanelGridRuntime(),
    curatedPanelLoadingIndicatorRuntime: resolveCuratedPanelLoadingIndicatorRuntime(),
    controlsSyncOwner: new CuratedPanelControlsSyncOwner({
      state,
      documentRef,
    }),
    localizedPreloadCoordinator,
  };
}

class CuratedPanelOwner implements CuratedPanelRuntime {
  private readonly context: CuratedPanelContext;
  private readonly renderOrchestrator: CuratedPanelRenderOrchestrator;
  private disposed = false;

  constructor(options: CuratedPanelOptions = {}) {
    this.context = createCuratedPanelContext(options);
    this.renderOrchestrator = new CuratedPanelRenderOrchestrator({
      state: this.context.state,
      documentRef: this.context.documentRef,
      createCuratedCard: this.context.createCuratedCard,
      patchCuratedCard: this.context.patchCuratedCard,
      applyCardLayoutUi: this.context.applyCardLayoutUi,
      buildRenderableEntries: this.context.buildRenderableEntries,
      withMutedObserver: this.context.withMutedObserver,
      curatedPanelGridRuntime: this.context.curatedPanelGridRuntime,
      curatedPanelLoadingIndicatorRuntime: this.context.curatedPanelLoadingIndicatorRuntime,
      controlsSyncOwner: this.context.controlsSyncOwner,
      localizedPreloadCoordinator: this.context.localizedPreloadCoordinator,
    });
  }

  readonly renderCuratedPanel = (): void => {
    if (this.disposed) {
      return;
    }
    this.renderOrchestrator.renderNow();
  };

  readonly requestCuratedPanelRender = (): void => {
    if (this.disposed) {
      return;
    }
    this.renderOrchestrator.requestRender();
  };

  readonly refreshCuratedLoadingIndicator = (): void => {
    if (this.disposed) {
      return;
    }
    this.renderOrchestrator.refreshLoadingIndicator();
  };

  readonly dispose = (): void => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.renderOrchestrator.dispose();
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
