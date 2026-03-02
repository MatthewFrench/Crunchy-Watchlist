import { createBootstrapFinalizeRuntimeModule } from './BootstrapFinalize.js';
import { createRuntimeStateLoaderRuntime } from './StateLoader.js';

type BoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, BoundaryValue>;
type RuntimeEventHandler = (event: string, payload?: LooseRecord) => void;
type ProcessWatchlistHandler = () => BoundaryValue;
type SyncRouteRuntimeHandler = () => void;
type DestroyRuntimeHandler = (payload?: LooseRecord) => void;
type StorageGetHandler = (key: string, fallback: BoundaryValue) => BoundaryValue;
type RuntimeCallback = (...args: BoundaryValue[]) => BoundaryValue;
type SafeJsonParseHandler = (value: BoundaryValue, fallback: BoundaryValue) => BoundaryValue;
type CreateStorageAdapterHandler = (options: {
  storageArea: BoundaryValue;
  parseJson: SafeJsonParseHandler;
  localStorageRef: Storage;
  timeoutMs: number;
}) => BoundaryValue;
type CreateStorageAccessorsHandler = (options: { storageAdapter: BoundaryValue }) => {
  storageGet: StorageGetHandler;
};
type CreateBootstrapFinalizeRuntimeHandler = (options: LooseRecord) => LooseRecord;

type RuntimeWindow = Window & typeof globalThis;

type RuntimeBootstrapHelpersContextLike = {
  isCurrentRuntimeActive: () => boolean;
};

type RuntimeBootstrapSessionLike = {
  storageModule: LooseRecord;
  storageLocalArea: BoundaryValue;
  runtimeLifecycleModule: LooseRecord;
  state: LooseRecord;
  isWatchlistPath: (pathname: string) => boolean;
  debounceProcess: () => void;
  defaultSettings: LooseRecord;
  validSortModes: BoundaryValue;
  defaultSortMode: BoundaryValue;
  runtimeConstants: LooseRecord;
};

type RuntimeSetupResultLike = {
  runtimeEvent?: RuntimeEventHandler;
  ensureInterface?: RuntimeCallback;
  applyTabUi?: RuntimeCallback;
  ensureCuratedDataLoad?: RuntimeCallback;
  renderCuratedPanel?: RuntimeCallback;
  setNativeVisibility?: RuntimeCallback;
  clearRootFrame?: RuntimeCallback;
  getAccessToken?: RuntimeCallback;
  normalizeStoredWatchHistoryCache?: RuntimeCallback;
  isWatchHistoryCacheValid?: RuntimeCallback;
  normalizeStoredWatchlistCache?: RuntimeCallback;
  isWatchlistCacheValid?: RuntimeCallback;
  normalizeEntriesFromApiRows?: RuntimeCallback;
  listKnownSeries?: RuntimeCallback;
  getCuratedDomStats?: RuntimeCallback;
  dumpSeriesApiData?: RuntimeCallback;
  printSeriesApiData?: RuntimeCallback;
  dispose?: () => void;
};

type CreateBootstrapFinalizeRuntimeFromSetupResultOptions = {
  context: RuntimeBootstrapHelpersContextLike;
  windowRef: RuntimeWindow;
  runtimeSetupResult: RuntimeSetupResultLike;
  runtimeBootstrapSession: RuntimeBootstrapSessionLike;
};

type BindBootstrapFinalizeRuntimeMethodsOptions = {
  bootstrapFinalizeRuntime: BootstrapFinalizeRuntime;
  disposeRuntimeSetup?: (() => void) | null;
  setProcessWatchlist: (nextProcessWatchlist: ProcessWatchlistHandler) => void;
  setSyncRouteRuntime: (nextSyncRouteRuntime: SyncRouteRuntimeHandler) => void;
  setDestroyRuntime: (nextDestroyRuntime: DestroyRuntimeHandler) => void;
  setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
  clearStaleInjectedShell: (reason: string) => void;
};

type RunBootstrapFinalizeInitFlowOptions = {
  bootstrapFinalizeRuntime: BootstrapFinalizeRuntime;
  updateDiagnostics: (payload: LooseRecord) => void;
  startDomRuntimeLockHeartbeat: () => void;
  startWatchlistHealthRuntime: () => void;
  runtimeEvent: RuntimeEventHandler;
  setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
  shutdownRuntime: DestroyRuntimeHandler;
  clearStaleInjectedShell: (reason: string) => void;
};

type BootstrapFinalizeRuntime = LooseRecord & {
  init?: () => Promise<BoundaryValue>;
  processWatchlist?: ProcessWatchlistHandler;
  syncRoute?: SyncRouteRuntimeHandler;
  destroy?: () => void;
};

type BootstrapFinalizeRuntimeOptionInputs = {
  windowRef: RuntimeWindow;
  runtimeEvent: RuntimeEventHandler;
  runtimeLifecycleModule: LooseRecord;
  state: LooseRecord;
  isWatchlistPath: (pathname: string) => boolean;
  ensureInterface?: RuntimeCallback;
  applyTabUi?: RuntimeCallback;
  ensureCuratedDataLoad?: RuntimeCallback;
  renderCuratedPanel?: RuntimeCallback;
  setNativeVisibility?: RuntimeCallback;
  clearRootFrame?: RuntimeCallback;
  debounceProcess: () => void;
  storageGet: StorageGetHandler;
  getAccessToken?: RuntimeCallback;
  normalizeStoredWatchHistoryCache?: RuntimeCallback;
  isWatchHistoryCacheValid?: RuntimeCallback;
  normalizeStoredWatchlistCache?: RuntimeCallback;
  isWatchlistCacheValid?: RuntimeCallback;
  normalizeEntriesFromApiRows?: RuntimeCallback;
  defaultSettings: LooseRecord;
  validSortModes: BoundaryValue;
  defaultSortMode: BoundaryValue;
  runtimeConstants: LooseRecord;
  listKnownSeries?: RuntimeCallback;
  getCuratedDomStats?: RuntimeCallback;
  dumpSeriesApiData?: RuntimeCallback;
  printSeriesApiData?: RuntimeCallback;
};

type RuntimeBootstrapFinalizeFlowRuntime = {
  createBootstrapFinalizeRuntimeOptions: (
    context: RuntimeBootstrapHelpersContextLike,
    options: BootstrapFinalizeRuntimeOptionInputs,
  ) => BootstrapFinalizeRuntimeOptionInputs & {
    runtimeLifecycleOptions: LooseRecord;
    loadInitialState: () => Promise<void>;
  };
  createBootstrapFinalizeRuntimeFromSetupResult: (
    options: CreateBootstrapFinalizeRuntimeFromSetupResultOptions,
  ) => BootstrapFinalizeRuntime;
  bindBootstrapFinalizeRuntimeMethods: (options: BindBootstrapFinalizeRuntimeMethodsOptions) => boolean;
  runBootstrapFinalizeInitFlow: (options: RunBootstrapFinalizeInitFlowOptions) => void;
};

function toRecord(value: BoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function requireFunction<T extends (...args: never[]) => BoundaryValue>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing bootstrap finalize flow dependency: ${name}`);
  }
  return value as T;
}

function toErrorMessage(error: BoundaryValue): string {
  if (!error || typeof error !== 'object') {
    return 'unavailable';
  }

  const message = (error as { message?: BoundaryValue }).message;
  return message ? String(message) : 'unavailable';
}

function createBootstrapFinalizeRuntimeLifecycleOptionsInternal(
  context: RuntimeBootstrapHelpersContextLike,
  options: BootstrapFinalizeRuntimeOptionInputs,
): LooseRecord {
  return {
    state: options.state,
    runtimeEvent: options.runtimeEvent,
    isRuntimeActive: () => context.isCurrentRuntimeActive(),
    isWatchlistPath: options.isWatchlistPath,
    ensureInterface: options.ensureInterface,
    applyTabUi: options.applyTabUi,
    ensureCuratedDataLoad: options.ensureCuratedDataLoad,
    renderCuratedPanel: options.renderCuratedPanel,
    setNativeVisibility: options.setNativeVisibility,
    clearRootFrame: options.clearRootFrame,
    debounceProcess: options.debounceProcess,
  };
}

function createBootstrapFinalizeRuntimeStateLoaderOptionsInternal(
  options: BootstrapFinalizeRuntimeOptionInputs,
): LooseRecord {
  const runtimeConstants = toRecord(options.runtimeConstants);
  return {
    state: options.state,
    storageGet: options.storageGet,
    getAccessToken: options.getAccessToken,
    runtimeEvent: options.runtimeEvent,
    normalizeStoredWatchHistoryCache: options.normalizeStoredWatchHistoryCache,
    isWatchHistoryCacheValid: options.isWatchHistoryCacheValid,
    normalizeStoredWatchlistCache: options.normalizeStoredWatchlistCache,
    isWatchlistCacheValid: options.isWatchlistCacheValid,
    normalizeEntriesFromApiRows: options.normalizeEntriesFromApiRows,
    defaultSettings: options.defaultSettings,
    validSortModes: options.validSortModes,
    defaultSortMode: options.defaultSortMode,
    settingsKey: runtimeConstants.settingsKey,
    ratingCacheKey: runtimeConstants.ratingCacheKey,
    watchHistoryCacheKey: runtimeConstants.watchHistoryCacheKey,
    watchlistCacheKey: runtimeConstants.watchlistCacheKey,
  };
}

function createBootstrapFinalizeLoadInitialStateInternal(
  options: BootstrapFinalizeRuntimeOptionInputs,
): () => Promise<void> {
  try {
    const stateLoaderRuntime = createRuntimeStateLoaderRuntime();
    const stateLoader = stateLoaderRuntime.createStateLoader(
      createBootstrapFinalizeRuntimeStateLoaderOptionsInternal(options),
    );
    return () => stateLoader.loadInitialState();
  } catch {
    return async () => {};
  }
}

function createBootstrapFinalizeRuntimeOptionsInternal(
  context: RuntimeBootstrapHelpersContextLike,
  options: BootstrapFinalizeRuntimeOptionInputs,
): BootstrapFinalizeRuntimeOptionInputs & {
  runtimeLifecycleOptions: LooseRecord;
  loadInitialState: () => Promise<void>;
} {
  return {
    ...options,
    runtimeLifecycleOptions: createBootstrapFinalizeRuntimeLifecycleOptionsInternal(context, options),
    loadInitialState: createBootstrapFinalizeLoadInitialStateInternal(options),
  };
}

function createBootstrapFinalizeRuntimeFromSetupResultInternal({
  context,
  windowRef,
  runtimeSetupResult,
  runtimeBootstrapSession,
}: CreateBootstrapFinalizeRuntimeFromSetupResultOptions): BootstrapFinalizeRuntime {
  const runtimeBootstrapFinalizeModule = toRecord(createBootstrapFinalizeRuntimeModule());
  const storageModule = runtimeBootstrapSession.storageModule;
  const safeJsonParseFn = requireFunction<SafeJsonParseHandler>(
    'safeJsonParse',
    runtimeBootstrapFinalizeModule.safeJsonParse,
  );
  const createStorageAccessors = requireFunction<CreateStorageAccessorsHandler>(
    'createStorageAccessors',
    runtimeBootstrapFinalizeModule.createStorageAccessors,
  );
  const createBootstrapFinalizeRuntime = requireFunction<CreateBootstrapFinalizeRuntimeHandler>(
    'createBootstrapFinalizeRuntime',
    runtimeBootstrapFinalizeModule.createBootstrapFinalizeRuntime,
  );
  const createStorageAdapter = requireFunction<CreateStorageAdapterHandler>(
    'createStorageAdapter',
    storageModule.createStorageAdapter,
  );
  const safeJsonParse = (value: BoundaryValue, fallback: BoundaryValue) => safeJsonParseFn(value, fallback);
  const storageAdapter = createStorageAdapter({
    storageArea: runtimeBootstrapSession.storageLocalArea,
    parseJson: safeJsonParse,
    localStorageRef: windowRef.localStorage,
    timeoutMs: 1500,
  });
  const storageAccessors = createStorageAccessors({
    storageAdapter,
  });
  const storageGet = (key: string, fallback: BoundaryValue) => storageAccessors.storageGet(key, fallback);

  const runtimeEvent =
    typeof runtimeSetupResult.runtimeEvent === 'function' ? runtimeSetupResult.runtimeEvent : () => undefined;
  const finalizeRuntimeOptions: BootstrapFinalizeRuntimeOptionInputs = {
    windowRef,
    runtimeEvent,
    runtimeLifecycleModule: runtimeBootstrapSession.runtimeLifecycleModule,
    state: runtimeBootstrapSession.state,
    isWatchlistPath: runtimeBootstrapSession.isWatchlistPath,
    debounceProcess: runtimeBootstrapSession.debounceProcess,
    storageGet,
    defaultSettings: runtimeBootstrapSession.defaultSettings,
    validSortModes: runtimeBootstrapSession.validSortModes,
    defaultSortMode: runtimeBootstrapSession.defaultSortMode,
    runtimeConstants: runtimeBootstrapSession.runtimeConstants,
    ...(typeof runtimeSetupResult.ensureInterface === 'function'
      ? { ensureInterface: runtimeSetupResult.ensureInterface }
      : {}),
    ...(typeof runtimeSetupResult.applyTabUi === 'function' ? { applyTabUi: runtimeSetupResult.applyTabUi } : {}),
    ...(typeof runtimeSetupResult.ensureCuratedDataLoad === 'function'
      ? { ensureCuratedDataLoad: runtimeSetupResult.ensureCuratedDataLoad }
      : {}),
    ...(typeof runtimeSetupResult.renderCuratedPanel === 'function'
      ? { renderCuratedPanel: runtimeSetupResult.renderCuratedPanel }
      : {}),
    ...(typeof runtimeSetupResult.setNativeVisibility === 'function'
      ? { setNativeVisibility: runtimeSetupResult.setNativeVisibility }
      : {}),
    ...(typeof runtimeSetupResult.clearRootFrame === 'function'
      ? { clearRootFrame: runtimeSetupResult.clearRootFrame }
      : {}),
    ...(typeof runtimeSetupResult.getAccessToken === 'function'
      ? { getAccessToken: runtimeSetupResult.getAccessToken }
      : {}),
    ...(typeof runtimeSetupResult.normalizeStoredWatchHistoryCache === 'function'
      ? { normalizeStoredWatchHistoryCache: runtimeSetupResult.normalizeStoredWatchHistoryCache }
      : {}),
    ...(typeof runtimeSetupResult.isWatchHistoryCacheValid === 'function'
      ? { isWatchHistoryCacheValid: runtimeSetupResult.isWatchHistoryCacheValid }
      : {}),
    ...(typeof runtimeSetupResult.normalizeStoredWatchlistCache === 'function'
      ? { normalizeStoredWatchlistCache: runtimeSetupResult.normalizeStoredWatchlistCache }
      : {}),
    ...(typeof runtimeSetupResult.isWatchlistCacheValid === 'function'
      ? { isWatchlistCacheValid: runtimeSetupResult.isWatchlistCacheValid }
      : {}),
    ...(typeof runtimeSetupResult.normalizeEntriesFromApiRows === 'function'
      ? { normalizeEntriesFromApiRows: runtimeSetupResult.normalizeEntriesFromApiRows }
      : {}),
    ...(typeof runtimeSetupResult.listKnownSeries === 'function'
      ? { listKnownSeries: runtimeSetupResult.listKnownSeries }
      : {}),
    ...(typeof runtimeSetupResult.getCuratedDomStats === 'function'
      ? { getCuratedDomStats: runtimeSetupResult.getCuratedDomStats }
      : {}),
    ...(typeof runtimeSetupResult.dumpSeriesApiData === 'function'
      ? { dumpSeriesApiData: runtimeSetupResult.dumpSeriesApiData }
      : {}),
    ...(typeof runtimeSetupResult.printSeriesApiData === 'function'
      ? { printSeriesApiData: runtimeSetupResult.printSeriesApiData }
      : {}),
  };

  return toRecord(
    createBootstrapFinalizeRuntime(createBootstrapFinalizeRuntimeOptionsInternal(context, finalizeRuntimeOptions)),
  ) as BootstrapFinalizeRuntime;
}

function bindBootstrapFinalizeRuntimeMethodsInternal({
  bootstrapFinalizeRuntime,
  disposeRuntimeSetup,
  setProcessWatchlist,
  setSyncRouteRuntime,
  setDestroyRuntime,
  setBootstrapIssue,
  clearStaleInjectedShell,
}: BindBootstrapFinalizeRuntimeMethodsOptions): boolean {
  if (typeof bootstrapFinalizeRuntime.processWatchlist === 'function') {
    setProcessWatchlist(() => bootstrapFinalizeRuntime.processWatchlist?.());
  }
  if (typeof bootstrapFinalizeRuntime.syncRoute === 'function') {
    setSyncRouteRuntime(() => bootstrapFinalizeRuntime.syncRoute?.());
  }
  if (typeof bootstrapFinalizeRuntime.destroy === 'function' || typeof disposeRuntimeSetup === 'function') {
    setDestroyRuntime(() => {
      try {
        bootstrapFinalizeRuntime.destroy?.();
      } catch {
        // no-op
      }
      try {
        disposeRuntimeSetup?.();
      } catch {
        // no-op
      }
    });
  }
  if (typeof bootstrapFinalizeRuntime.init !== 'function') {
    setBootstrapIssue('missing-bootstrap-finalize-runtime');
    clearStaleInjectedShell('missing-bootstrap-finalize-runtime');
    return false;
  }
  return true;
}

function runBootstrapFinalizeInitFlowInternal({
  bootstrapFinalizeRuntime,
  updateDiagnostics,
  startDomRuntimeLockHeartbeat,
  startWatchlistHealthRuntime,
  runtimeEvent,
  setBootstrapIssue,
  shutdownRuntime,
  clearStaleInjectedShell,
}: RunBootstrapFinalizeInitFlowOptions): void {
  updateDiagnostics({
    ok: false,
    stage: 'init-started',
  });

  const init = bootstrapFinalizeRuntime.init;
  if (typeof init !== 'function') {
    setBootstrapIssue('missing-bootstrap-finalize-runtime');
    clearStaleInjectedShell('missing-bootstrap-finalize-runtime');
    return;
  }

  init()
    .then(() => {
      updateDiagnostics({
        ok: true,
        stage: 'init-complete',
      });
      startDomRuntimeLockHeartbeat();
      startWatchlistHealthRuntime();
    })
    .catch((error: BoundaryValue) => {
      const message = toErrorMessage(error);
      runtimeEvent('init-error', {
        message,
      });
      setBootstrapIssue('init-error', {
        message,
      });
      shutdownRuntime({
        reason: 'init-error',
        message,
      });
      clearStaleInjectedShell('init-error');
    });
}

export function createContentRuntimeBootstrapFinalizeFlowRuntime(): RuntimeBootstrapFinalizeFlowRuntime {
  return {
    createBootstrapFinalizeRuntimeOptions: (context, options) =>
      createBootstrapFinalizeRuntimeOptionsInternal(context, options),
    createBootstrapFinalizeRuntimeFromSetupResult: (options) =>
      createBootstrapFinalizeRuntimeFromSetupResultInternal(options),
    bindBootstrapFinalizeRuntimeMethods: (options) => bindBootstrapFinalizeRuntimeMethodsInternal(options),
    runBootstrapFinalizeInitFlow: (options) => runBootstrapFinalizeInitFlowInternal(options),
  };
}
