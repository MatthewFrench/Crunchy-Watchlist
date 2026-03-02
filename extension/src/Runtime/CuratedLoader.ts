import { createCuratedLoaderDeferredMetadataRuntime as createCuratedLoaderDeferredMetadataRuntimeFactory } from './CuratedLoaderDeferredMetadata.js';
import { createCuratedLoaderLoadCycleRuntime as createCuratedLoaderLoadCycleRuntimeFactory } from './CuratedLoaderLoadCycle.js';
import { createCuratedLoaderPendingRequestsRuntime as createCuratedLoaderPendingRequestsRuntimeFactory } from './CuratedLoaderPendingRequests.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryArray = BoundaryValue[];
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryPromise = Promise<BoundaryValue>;
type BoundaryArrayPromise = Promise<BoundaryArray>;

type RuntimeState = {
  mounted: boolean;
  curatedError: BoundaryValue;
  curatedEntries: BoundaryArray;
  curatedInflight: BoundaryArrayPromise | null;
  curatedDeferredMetadataInFlight?: boolean;
  curatedPendingRequests: string[];
  curatedPendingRequestStartedCount: number;
  curatedPendingRequestCompletedCount: number;
  curatedSource: string;
  curatedLastRevalidateAt: number;
  curatedObservedPromise: BoundaryArrayPromise | null;
  curatedInitialLoadDone?: boolean;
  settings: BoundaryRecord;
};

type PendingRequestProgress = {
  started: number;
  completed: number;
};

type TokenEntry = {
  accessToken?: BoundaryValue;
  accountId?: BoundaryValue;
  profileId?: BoundaryValue;
};

type CuratedLoaderContext = {
  state: RuntimeState;
  windowRef: Window;
  documentRef: Document | null;
  locationRef: Location;
  runtimeEvent: (event: string, data?: BoundaryValue) => void;
  getAccessToken: (forceRefresh: boolean) => Promise<TokenEntry | null>;
  resetWatchlistCacheOnAccountMismatch: (accountId: string, profileId: string) => BoundaryValue;
  fetchAllWatchlistRows: (tokenEntry: TokenEntry) => BoundaryArrayPromise;
  normalizeEntriesFromApiRows: (rows: BoundaryArray) => BoundaryArray;
  preloadRatingsForEntries: (
    entries: BoundaryArray,
    tokenEntry: TokenEntry,
    preferredAudioLanguage?: string,
  ) => BoundaryPromise;
  preloadWatchHistoryForEntries: (
    entries: BoundaryArray,
    tokenEntry: TokenEntry,
    force?: boolean,
    preferredAudioLanguage?: string,
  ) => BoundaryPromise;
  isLocalizedWatchHistoryDataMissingForEntries: (entries: BoundaryArray, audioLocale: BoundaryValue) => boolean;
  normalizeAudioLocale: (locale: BoundaryValue) => string | null;
  getPreferredAudioLanguage: () => string;
  setWatchlistCacheRows: (
    accountId: string,
    profileId: string,
    rows: BoundaryArray,
    updatedAt?: number,
  ) => BoundaryValue;
  isWatchlistPath: (pathname: string) => boolean;
  renderCuratedPanel: () => void;
  refreshCuratedLoadingIndicator: () => void;
  watchlistRevalidateCooldownMs: number;
  watchlistCacheSourceRevalidateCooldownMs: number;
  metadataPriorityEntryCount: number;
  metadataDeferredChunkSize: number;
  metadataDeferredIdleTimeoutMs: number;
  metadataDeferredHiddenDelayMs: number;
  metadataViewportPriorityCount: number;
  deferredMetadataRunId: number;
};

type CuratedLoaderOptions = {
  state?: BoundaryValue;
  windowRef?: BoundaryValue;
  documentRef?: BoundaryValue;
  locationRef?: BoundaryValue;
  runtimeEvent?: BoundaryValue;
  getAccessToken?: BoundaryValue;
  resetWatchlistCacheOnAccountMismatch?: BoundaryValue;
  fetchAllWatchlistRows?: BoundaryValue;
  normalizeEntriesFromApiRows?: BoundaryValue;
  preloadRatingsForEntries?: BoundaryValue;
  preloadWatchHistoryForEntries?: BoundaryValue;
  isLocalizedWatchHistoryDataMissingForEntries?: BoundaryValue;
  normalizeAudioLocale?: BoundaryValue;
  getPreferredAudioLanguage?: BoundaryValue;
  setWatchlistCacheRows?: BoundaryValue;
  isWatchlistPath?: BoundaryValue;
  renderCuratedPanel?: BoundaryValue;
  refreshCuratedLoadingIndicator?: BoundaryValue;
  watchlistRevalidateCooldownMs?: BoundaryValue;
  watchlistCacheSourceRevalidateCooldownMs?: BoundaryValue;
  metadataPriorityEntryCount?: BoundaryValue;
  metadataDeferredChunkSize?: BoundaryValue;
  metadataDeferredIdleTimeoutMs?: BoundaryValue;
  metadataDeferredHiddenDelayMs?: BoundaryValue;
  metadataViewportPriorityCount?: BoundaryValue;
};

type CuratedLoaderRuntime = {
  loadCuratedEntries: (force?: boolean) => BoundaryArrayPromise;
  ensureCuratedDataLoad: (force?: boolean) => BoundaryArrayPromise;
};

type CuratedLoaderDeferredMetadataRuntime = {
  splitMetadataPreloadEntries: (
    context: CuratedLoaderContext,
    entries: BoundaryArray,
  ) => { priorityEntries: BoundaryArray; deferredEntries: BoundaryArray };
  queueDeferredMetadataPreload: (options: {
    context: CuratedLoaderContext;
    deferredEntries: BoundaryArray;
    tokenEntry: TokenEntry;
    preloadMetadataForEntries: (entries: BoundaryArray, tokenEntry: TokenEntry) => Promise<void>;
  }) => void;
};

type CuratedLoaderPendingRequestsRuntime = {
  syncPendingRequestDiagnostics: (
    context: Pick<CuratedLoaderContext, 'state' | 'locationRef' | 'isWatchlistPath' | 'refreshCuratedLoadingIndicator'>,
    activeRequests: string[],
    progress: PendingRequestProgress,
  ) => void;
  withTrackedPendingRequest: <T>(
    context: Pick<CuratedLoaderContext, 'state' | 'locationRef' | 'isWatchlistPath' | 'refreshCuratedLoadingIndicator'>,
    activeRequests: string[],
    progress: PendingRequestProgress,
    label: string,
    work: () => Promise<T>,
  ) => Promise<T>;
};

type CuratedLoaderLoadCycleRuntime = {
  runCuratedLoadCycle: (options: {
    context: CuratedLoaderContext;
    deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime;
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime;
    activeRequests: string[];
    pendingProgress: PendingRequestProgress;
    force: boolean;
  }) => BoundaryArrayPromise;
  handleCuratedLoadFailure: (context: CuratedLoaderContext, error: BoundaryValue) => BoundaryArray;
};

type CuratedLoaderResolvedDependencies = Omit<
  CuratedLoaderContext,
  'state' | 'windowRef' | 'documentRef' | 'locationRef'
>;

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;

function requireFunction<T>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing curated loader dependency: ${name}`);
  }

  return value as T;
}

function normalizePositiveNumber(value: BoundaryValue, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }
  return Math.round(number);
}

function resolveCuratedLoaderState(value: BoundaryValue): RuntimeState {
  const state = value && typeof value === 'object' ? (value as RuntimeState) : null;
  if (!state) {
    throw new Error('[CW] Missing curated loader state');
  }
  return state;
}

function resolveCuratedLoaderLocationRef(value: BoundaryValue): Location {
  const locationRef = value && typeof value === 'object' ? (value as Location) : null;
  if (!locationRef) {
    throw new Error('[CW] Missing curated loader locationRef');
  }
  return locationRef;
}

function resolveCuratedLoaderWindowRef(value: BoundaryValue): Window {
  return value && typeof value === 'object' ? (value as Window) : (root as Window);
}

function resolveCuratedLoaderDocumentRef(value: BoundaryValue): Document | null {
  return value && typeof value === 'object' ? (value as Document) : null;
}

function resolveCuratedLoaderRenderers(
  options: CuratedLoaderOptions,
): Pick<CuratedLoaderContext, 'renderCuratedPanel' | 'refreshCuratedLoadingIndicator'> {
  const renderCuratedPanel = requireFunction(
    'renderCuratedPanel',
    options.renderCuratedPanel,
  ) as CuratedLoaderContext['renderCuratedPanel'];
  const refreshCuratedLoadingIndicator =
    typeof options.refreshCuratedLoadingIndicator === 'function'
      ? (options.refreshCuratedLoadingIndicator as CuratedLoaderContext['refreshCuratedLoadingIndicator'])
      : () => renderCuratedPanel();

  return {
    renderCuratedPanel,
    refreshCuratedLoadingIndicator,
  };
}

function resolveCuratedLoaderDependencies(
  options: CuratedLoaderOptions,
  renderers: Pick<CuratedLoaderContext, 'renderCuratedPanel' | 'refreshCuratedLoadingIndicator'>,
): CuratedLoaderResolvedDependencies {
  return {
    runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as CuratedLoaderContext['runtimeEvent'],
    getAccessToken: requireFunction('getAccessToken', options.getAccessToken) as CuratedLoaderContext['getAccessToken'],
    resetWatchlistCacheOnAccountMismatch: requireFunction(
      'resetWatchlistCacheOnAccountMismatch',
      options.resetWatchlistCacheOnAccountMismatch,
    ) as CuratedLoaderContext['resetWatchlistCacheOnAccountMismatch'],
    fetchAllWatchlistRows: requireFunction(
      'fetchAllWatchlistRows',
      options.fetchAllWatchlistRows,
    ) as CuratedLoaderContext['fetchAllWatchlistRows'],
    normalizeEntriesFromApiRows: requireFunction(
      'normalizeEntriesFromApiRows',
      options.normalizeEntriesFromApiRows,
    ) as CuratedLoaderContext['normalizeEntriesFromApiRows'],
    preloadRatingsForEntries: requireFunction(
      'preloadRatingsForEntries',
      options.preloadRatingsForEntries,
    ) as CuratedLoaderContext['preloadRatingsForEntries'],
    preloadWatchHistoryForEntries: requireFunction(
      'preloadWatchHistoryForEntries',
      options.preloadWatchHistoryForEntries,
    ) as CuratedLoaderContext['preloadWatchHistoryForEntries'],
    isLocalizedWatchHistoryDataMissingForEntries: requireFunction(
      'isLocalizedWatchHistoryDataMissingForEntries',
      options.isLocalizedWatchHistoryDataMissingForEntries,
    ) as CuratedLoaderContext['isLocalizedWatchHistoryDataMissingForEntries'],
    normalizeAudioLocale: requireFunction(
      'normalizeAudioLocale',
      options.normalizeAudioLocale,
    ) as CuratedLoaderContext['normalizeAudioLocale'],
    getPreferredAudioLanguage: requireFunction(
      'getPreferredAudioLanguage',
      options.getPreferredAudioLanguage,
    ) as CuratedLoaderContext['getPreferredAudioLanguage'],
    setWatchlistCacheRows: requireFunction(
      'setWatchlistCacheRows',
      options.setWatchlistCacheRows,
    ) as CuratedLoaderContext['setWatchlistCacheRows'],
    isWatchlistPath: requireFunction(
      'isWatchlistPath',
      options.isWatchlistPath,
    ) as CuratedLoaderContext['isWatchlistPath'],
    ...renderers,
    watchlistRevalidateCooldownMs: normalizePositiveNumber(options.watchlistRevalidateCooldownMs, 600_000),
    watchlistCacheSourceRevalidateCooldownMs: normalizePositiveNumber(
      options.watchlistCacheSourceRevalidateCooldownMs,
      45_000,
    ),
    metadataPriorityEntryCount: Math.max(1, normalizePositiveNumber(options.metadataPriorityEntryCount, 36)),
    metadataDeferredChunkSize: Math.max(1, normalizePositiveNumber(options.metadataDeferredChunkSize, 24)),
    metadataDeferredIdleTimeoutMs: Math.max(1, normalizePositiveNumber(options.metadataDeferredIdleTimeoutMs, 180)),
    metadataDeferredHiddenDelayMs: Math.max(1, normalizePositiveNumber(options.metadataDeferredHiddenDelayMs, 900)),
    metadataViewportPriorityCount: Math.max(1, normalizePositiveNumber(options.metadataViewportPriorityCount, 24)),
    deferredMetadataRunId: 0,
  };
}

function createCuratedLoaderContext(options: CuratedLoaderOptions = {}): CuratedLoaderContext {
  const state = resolveCuratedLoaderState(options.state);
  const locationRef = resolveCuratedLoaderLocationRef(options.locationRef);
  const windowRef = resolveCuratedLoaderWindowRef(options.windowRef);
  const documentRef = resolveCuratedLoaderDocumentRef(options.documentRef);
  const renderers = resolveCuratedLoaderRenderers(options);
  return {
    state,
    windowRef,
    documentRef,
    locationRef,
    ...resolveCuratedLoaderDependencies(options, renderers),
  };
}

function createCuratedLoaderDeferredMetadataRuntime(): CuratedLoaderDeferredMetadataRuntime {
  const runtime = createCuratedLoaderDeferredMetadataRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated loader dependency: deferred metadata runtime');
  }
  const runtimeRecord = runtime as BoundaryRecord;

  return {
    splitMetadataPreloadEntries: requireFunction<CuratedLoaderDeferredMetadataRuntime['splitMetadataPreloadEntries']>(
      'runtimeCuratedLoaderDeferredMetadata.splitMetadataPreloadEntries',
      runtimeRecord.splitMetadataPreloadEntries,
    ),
    queueDeferredMetadataPreload: requireFunction<CuratedLoaderDeferredMetadataRuntime['queueDeferredMetadataPreload']>(
      'runtimeCuratedLoaderDeferredMetadata.queueDeferredMetadataPreload',
      runtimeRecord.queueDeferredMetadataPreload,
    ),
  };
}

function createCuratedLoaderPendingRequestsRuntime(): CuratedLoaderPendingRequestsRuntime {
  const runtime = createCuratedLoaderPendingRequestsRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated loader dependency: pending requests runtime');
  }
  const runtimeRecord = runtime as BoundaryRecord;

  return {
    syncPendingRequestDiagnostics: requireFunction<
      CuratedLoaderPendingRequestsRuntime['syncPendingRequestDiagnostics']
    >('runtimeCuratedLoaderPendingRequests.syncPendingRequestDiagnostics', runtimeRecord.syncPendingRequestDiagnostics),
    withTrackedPendingRequest: requireFunction<CuratedLoaderPendingRequestsRuntime['withTrackedPendingRequest']>(
      'runtimeCuratedLoaderPendingRequests.withTrackedPendingRequest',
      runtimeRecord.withTrackedPendingRequest,
    ),
  };
}

function createCuratedLoaderLoadCycleRuntime(): CuratedLoaderLoadCycleRuntime {
  const runtime = createCuratedLoaderLoadCycleRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated loader dependency: load cycle runtime');
  }
  const runtimeRecord = runtime as BoundaryRecord;

  return {
    runCuratedLoadCycle: requireFunction<CuratedLoaderLoadCycleRuntime['runCuratedLoadCycle']>(
      'runtimeCuratedLoaderLoadCycle.runCuratedLoadCycle',
      runtimeRecord.runCuratedLoadCycle,
    ),
    handleCuratedLoadFailure: requireFunction<CuratedLoaderLoadCycleRuntime['handleCuratedLoadFailure']>(
      'runtimeCuratedLoaderLoadCycle.handleCuratedLoadFailure',
      runtimeRecord.handleCuratedLoadFailure,
    ),
  };
}

function hasPromiseFinally<T>(value: BoundaryValue): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).finally === 'function';
}

function clearPendingRequestDiagnosticsInternal(
  context: CuratedLoaderContext,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  pendingProgress: PendingRequestProgress,
): void {
  activeRequests.length = 0;
  pendingRequestsRuntime.syncPendingRequestDiagnostics(context, activeRequests, pendingProgress);
}

function shouldMarkCuratedInitialLoadDone(context: CuratedLoaderContext): boolean {
  const hasCuratedEntries = Array.isArray(context.state.curatedEntries) && context.state.curatedEntries.length > 0;
  const hasApiSource = context.state.curatedSource === 'api';
  const hasLoadError = Boolean(context.state.curatedError);
  return hasApiSource || hasCuratedEntries || !hasLoadError;
}

function finalizeCuratedLoadInflightInternal(
  context: CuratedLoaderContext,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  pendingProgress: PendingRequestProgress,
): void {
  context.state.curatedInflight = null;
  clearPendingRequestDiagnosticsInternal(context, pendingRequestsRuntime, activeRequests, pendingProgress);
  if (context.state.curatedInitialLoadDone !== true && shouldMarkCuratedInitialLoadDone(context)) {
    context.state.curatedInitialLoadDone = true;
  }
}

function ensureCuratedPromiseLoadedStateInternal(
  context: CuratedLoaderContext,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  inflight: BoundaryArrayPromise,
  activeRequests: string[],
  pendingProgress: PendingRequestProgress,
): BoundaryArrayPromise {
  return inflight.finally(() => {
    finalizeCuratedLoadInflightInternal(context, pendingRequestsRuntime, activeRequests, pendingProgress);
  });
}

function loadCuratedEntriesInternal(
  context: CuratedLoaderContext,
  deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  loadCycleRuntime: CuratedLoaderLoadCycleRuntime,
  force = false,
): BoundaryArrayPromise {
  if (context.state.curatedInflight) {
    return context.state.curatedInflight;
  }

  const activeRequests: string[] = [];
  const pendingProgress: PendingRequestProgress = {
    started: 0,
    completed: 0,
  };
  const inflight = loadCycleRuntime
    .runCuratedLoadCycle({
      context,
      deferredMetadataRuntime,
      pendingRequestsRuntime,
      activeRequests,
      pendingProgress,
      force,
    })
    .catch((error: BoundaryValue) => loadCycleRuntime.handleCuratedLoadFailure(context, error));
  const trackedInflight = ensureCuratedPromiseLoadedStateInternal(
    context,
    pendingRequestsRuntime,
    inflight,
    activeRequests,
    pendingProgress,
  );

  context.state.curatedInflight = trackedInflight;
  return trackedInflight;
}

function shouldBackgroundRevalidateCuratedInternal(context: CuratedLoaderContext): boolean {
  if (context.state.curatedInflight || !context.state.curatedEntries.length) {
    return false;
  }

  const now = Date.now();
  if (context.state.curatedSource === 'cache') {
    return now - context.state.curatedLastRevalidateAt > context.watchlistCacheSourceRevalidateCooldownMs;
  }

  return now - context.state.curatedLastRevalidateAt > context.watchlistRevalidateCooldownMs;
}

function observeCuratedLoadPromiseInternal(context: CuratedLoaderContext, promise: BoundaryValue): void {
  if (!hasPromiseFinally<BoundaryArray>(promise)) {
    return;
  }

  if (context.state.curatedObservedPromise === promise) {
    return;
  }

  context.state.curatedObservedPromise = promise;
  promise.finally(() => {
    if (context.state.curatedObservedPromise === promise) {
      context.state.curatedObservedPromise = null;
    }

    if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
      return;
    }
    context.renderCuratedPanel();
  });
}

function ensureCuratedDataLoadInternal(
  context: CuratedLoaderContext,
  deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  loadCycleRuntime: CuratedLoaderLoadCycleRuntime,
  force = false,
): BoundaryArrayPromise {
  if (!force && context.state.curatedEntries.length) {
    if (shouldBackgroundRevalidateCuratedInternal(context)) {
      const backgroundPromise = loadCuratedEntriesInternal(
        context,
        deferredMetadataRuntime,
        pendingRequestsRuntime,
        loadCycleRuntime,
        false,
      );
      observeCuratedLoadPromiseInternal(context, backgroundPromise);
    }
    return Promise.resolve(context.state.curatedEntries);
  }

  const promise = loadCuratedEntriesInternal(
    context,
    deferredMetadataRuntime,
    pendingRequestsRuntime,
    loadCycleRuntime,
    force,
  );
  observeCuratedLoadPromiseInternal(context, promise);
  return promise;
}

function createCuratedLoaderRuntime(options: CuratedLoaderOptions = {}): CuratedLoaderRuntime {
  const context = createCuratedLoaderContext(options);
  const deferredMetadataRuntime = createCuratedLoaderDeferredMetadataRuntime();
  const pendingRequestsRuntime = createCuratedLoaderPendingRequestsRuntime();
  const loadCycleRuntime = createCuratedLoaderLoadCycleRuntime();
  return {
    loadCuratedEntries: (force = false) =>
      loadCuratedEntriesInternal(context, deferredMetadataRuntime, pendingRequestsRuntime, loadCycleRuntime, force),
    ensureCuratedDataLoad: (force = false) =>
      ensureCuratedDataLoadInternal(context, deferredMetadataRuntime, pendingRequestsRuntime, loadCycleRuntime, force),
  };
}

const runtimeCuratedLoaderModule = {
  createCuratedLoaderRuntime,
};

export function createRuntimeCuratedLoaderRuntime(): object {
  return runtimeCuratedLoaderModule;
}
