type AnyFn = (...args: unknown[]) => unknown;
type LooseRecord = Record<string, unknown>;

type RuntimeWindow = Window & typeof globalThis;

type RuntimeBootstrapHelpersContextLike = {
  isCurrentRuntimeActive: () => boolean;
};

type RuntimeBootstrapSessionLike = {
  runtimeBootstrapFinalizeModule: LooseRecord;
  storageModule: LooseRecord;
  storageLocalArea: unknown;
  runtimeLifecycleModule: LooseRecord;
  runtimeStateLoaderModule: LooseRecord;
  state: LooseRecord;
  isWatchlistPath: (pathname: string) => boolean;
  debounceProcess: () => void;
  defaultSettings: LooseRecord;
  validSortModes: unknown;
  defaultSortMode: unknown;
  runtimeConstants: LooseRecord;
};

type CreateBootstrapFinalizeRuntimeFromSetupResultOptions = {
  context: RuntimeBootstrapHelpersContextLike;
  windowRef: RuntimeWindow;
  runtimeSetupResult: LooseRecord;
  runtimeBootstrapSession: RuntimeBootstrapSessionLike;
};

type BindBootstrapFinalizeRuntimeMethodsOptions = {
  bootstrapFinalizeRuntime: LooseRecord;
  setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void;
  setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void;
  setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void;
  setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
  clearStaleInjectedShell: (reason: string) => void;
};

type RunBootstrapFinalizeInitFlowOptions = {
  bootstrapFinalizeRuntime: LooseRecord;
  updateDiagnostics: (payload: LooseRecord) => void;
  startDomRuntimeLockHeartbeat: () => void;
  startWatchlistHealthRuntime: () => void;
  runtimeEvent: (event: string, payload?: LooseRecord) => void;
  setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
  shutdownRuntime: (payload?: LooseRecord) => void;
  clearStaleInjectedShell: (reason: string) => void;
};

type RuntimeBootstrapFinalizeFlowRuntime = {
  createBootstrapFinalizeRuntimeOptions: (
    context: RuntimeBootstrapHelpersContextLike,
    options: LooseRecord,
  ) => LooseRecord;
  createBootstrapFinalizeRuntimeFromSetupResult: (
    options: CreateBootstrapFinalizeRuntimeFromSetupResultOptions,
  ) => unknown;
  bindBootstrapFinalizeRuntimeMethods: (options: BindBootstrapFinalizeRuntimeMethodsOptions) => boolean;
  runBootstrapFinalizeInitFlow: (options: RunBootstrapFinalizeInitFlowOptions) => void;
};

const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeWindow & {
  __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord;
};
if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
  root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
}
const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function createBootstrapFinalizeRuntimeLifecycleOptionsInternal(
  context: RuntimeBootstrapHelpersContextLike,
  options: LooseRecord,
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

function createBootstrapFinalizeRuntimeStateLoaderOptionsInternal(options: LooseRecord): LooseRecord {
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

function createBootstrapFinalizeRuntimeOptionsInternal(
  context: RuntimeBootstrapHelpersContextLike,
  options: LooseRecord,
): LooseRecord {
  return {
    windowRef: options.windowRef,
    runtimeEvent: options.runtimeEvent,
    runtimeLifecycleModule: options.runtimeLifecycleModule,
    runtimeLifecycleOptions: createBootstrapFinalizeRuntimeLifecycleOptionsInternal(context, options),
    runtimeStateLoaderModule: options.runtimeStateLoaderModule,
    runtimeStateLoaderOptions: createBootstrapFinalizeRuntimeStateLoaderOptionsInternal(options),
    listKnownSeries: options.listKnownSeries,
    getCuratedDomStats: options.getCuratedDomStats,
    dumpSeriesApiData: options.dumpSeriesApiData,
    printSeriesApiData: options.printSeriesApiData,
  };
}

function createBootstrapFinalizeRuntimeFromSetupResultInternal({
  context,
  windowRef,
  runtimeSetupResult,
  runtimeBootstrapSession,
}: CreateBootstrapFinalizeRuntimeFromSetupResultOptions): unknown {
  const runtimeBootstrapFinalizeModule = runtimeBootstrapSession.runtimeBootstrapFinalizeModule;
  const storageModule = runtimeBootstrapSession.storageModule;
  const safeJsonParse = (value: unknown, fallback: unknown) =>
    (runtimeBootstrapFinalizeModule.safeJsonParse as AnyFn)(value, fallback);
  const storageAdapter = (storageModule.createStorageAdapter as AnyFn)({
    storageArea: runtimeBootstrapSession.storageLocalArea,
    parseJson: safeJsonParse,
    localStorageRef: windowRef.localStorage,
    timeoutMs: 1500,
  });
  const storageAccessors = (runtimeBootstrapFinalizeModule.createStorageAccessors as AnyFn)({
    storageAdapter,
  }) as LooseRecord;
  const storageGet = (key: string, fallback: unknown) => (storageAccessors.storageGet as AnyFn)(key, fallback);

  return (runtimeBootstrapFinalizeModule.createBootstrapFinalizeRuntime as AnyFn)(
    createBootstrapFinalizeRuntimeOptionsInternal(context, {
      windowRef,
      runtimeEvent: runtimeSetupResult.runtimeEvent,
      runtimeLifecycleModule: runtimeBootstrapSession.runtimeLifecycleModule,
      runtimeStateLoaderModule: runtimeBootstrapSession.runtimeStateLoaderModule,
      state: runtimeBootstrapSession.state,
      isWatchlistPath: runtimeBootstrapSession.isWatchlistPath,
      ensureInterface: runtimeSetupResult.ensureInterface,
      applyTabUi: runtimeSetupResult.applyTabUi,
      ensureCuratedDataLoad: runtimeSetupResult.ensureCuratedDataLoad,
      renderCuratedPanel: runtimeSetupResult.renderCuratedPanel,
      setNativeVisibility: runtimeSetupResult.setNativeVisibility,
      clearRootFrame: runtimeSetupResult.clearRootFrame,
      debounceProcess: runtimeBootstrapSession.debounceProcess,
      storageGet,
      getAccessToken: runtimeSetupResult.getAccessToken,
      normalizeStoredWatchHistoryCache: runtimeSetupResult.normalizeStoredWatchHistoryCache,
      isWatchHistoryCacheValid: runtimeSetupResult.isWatchHistoryCacheValid,
      normalizeStoredWatchlistCache: runtimeSetupResult.normalizeStoredWatchlistCache,
      isWatchlistCacheValid: runtimeSetupResult.isWatchlistCacheValid,
      normalizeEntriesFromApiRows: runtimeSetupResult.normalizeEntriesFromApiRows,
      defaultSettings: runtimeBootstrapSession.defaultSettings,
      validSortModes: runtimeBootstrapSession.validSortModes,
      defaultSortMode: runtimeBootstrapSession.defaultSortMode,
      runtimeConstants: runtimeBootstrapSession.runtimeConstants,
      listKnownSeries: runtimeSetupResult.listKnownSeries,
      getCuratedDomStats: runtimeSetupResult.getCuratedDomStats,
      dumpSeriesApiData: runtimeSetupResult.dumpSeriesApiData,
      printSeriesApiData: runtimeSetupResult.printSeriesApiData,
    }),
  );
}

function bindBootstrapFinalizeRuntimeMethodsInternal({
  bootstrapFinalizeRuntime,
  setProcessWatchlist,
  setSyncRouteRuntime,
  setDestroyRuntime,
  setBootstrapIssue,
  clearStaleInjectedShell,
}: BindBootstrapFinalizeRuntimeMethodsOptions): boolean {
  if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.processWatchlist === 'function') {
    setProcessWatchlist(bootstrapFinalizeRuntime.processWatchlist as AnyFn);
  }
  if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.syncRoute === 'function') {
    setSyncRouteRuntime(() => (bootstrapFinalizeRuntime.syncRoute as AnyFn)());
  }
  if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.destroy === 'function') {
    setDestroyRuntime(() => (bootstrapFinalizeRuntime.destroy as AnyFn)());
  }
  if (!bootstrapFinalizeRuntime || typeof bootstrapFinalizeRuntime.init !== 'function') {
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

  ((bootstrapFinalizeRuntime.init as AnyFn)() as Promise<unknown>)
    .then(() => {
      updateDiagnostics({
        ok: true,
        stage: 'init-complete',
      });
      startDomRuntimeLockHeartbeat();
      startWatchlistHealthRuntime();
    })
    .catch((error: { message?: string }) => {
      runtimeEvent('init-error', {
        message: error?.message || 'unknown',
      });
      setBootstrapIssue('init-error', {
        message: error?.message || 'unknown',
      });
      shutdownRuntime({
        reason: 'init-error',
        message: error?.message || 'unknown',
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

function registerContentRuntimeBootstrapFinalizeFlowRuntime(): void {
  moduleRegistry.runtimeContentRuntimeBootstrapFinalizeFlow = {
    createContentRuntimeBootstrapFinalizeFlowRuntime,
  };
}

registerContentRuntimeBootstrapFinalizeFlowRuntime();
