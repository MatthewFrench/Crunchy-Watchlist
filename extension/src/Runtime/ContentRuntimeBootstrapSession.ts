import { createContentRuntimeBootstrapFinalizeFlowRuntime } from './ContentRuntimeBootstrapFinalizeFlow.js';
import { createContentRuntimeBootstrapSessionAssemblyRuntime } from './ContentRuntimeBootstrapSessionAssembly.js';
import { createContentRuntimeBootstrapSessionSupportRuntime } from './ContentRuntimeBootstrapSessionSupport.js';
import { createContentRuntimeBootstrapSetupBindingsRuntime } from './ContentRuntimeBootstrapSetupBindings.js';

type AnyFn = (...args: unknown[]) => unknown;
type LooseRecord = Record<string, unknown>;

type RuntimeWindow = Window &
  typeof globalThis & {
    __CW_WATCHLIST_CURATOR_LOADED__?: {
      version?: string;
    };
    __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord;
  };

type RuntimeBootstrapHelpersContext = {
  windowRef: RuntimeWindow;
  browserRef: unknown;
  chromeRef: unknown;
  setRuntimeControl: (patch: LooseRecord) => void;
  runtimeInstanceId: string;
  runtimeInstanceStartedAt: number;
  isCurrentRuntimeActive: () => boolean;
};

type RuntimeLockLifecycleOptions = {
  state: LooseRecord;
  getRuntimeEvent: () => AnyFn;
  getDestroyRuntime: () => AnyFn;
  getWatchlistHealthRuntime: () => LooseRecord;
};

type RuntimeLockLifecycleControl = {
  startDomRuntimeLockHeartbeat: () => void;
  startRuntimeTakeoverRequestListener: () => void;
  shutdownRuntime: (payload?: LooseRecord) => void;
};

type BootstrapRuntimeSession = {
  runtimeBootstrapGateModule: LooseRecord;
  runtimeBootstrapFinalizeModule: LooseRecord;
  runtimeContentCompositionModule: LooseRecord;
  runtimeContentRuntimeSetupModule: LooseRecord;
  runtimeStateLoaderModule: LooseRecord;
  runtimeLifecycleModule: LooseRecord;
  runtimeBootstrapHelpersModule: LooseRecord;
  storageModule: LooseRecord;
  assertRuntimeMethods: AnyFn;
  defaultSortMode: unknown;
  validSortModes: unknown;
  sortModeControlOptions: unknown[];
  defaultSettings: LooseRecord;
  runtimeConstants: LooseRecord;
  state: LooseRecord;
  storageLocalArea: unknown;
  isWatchlistPath: (pathname: string) => boolean;
  debounceProcess: () => void;
  createEmptyWatchHistoryCache: AnyFn;
  createWatchlistCacheSnapshot: AnyFn;
  bootstrapModulesRuntime: LooseRecord;
  setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void;
  setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void;
  setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void;
  setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void;
  getRuntimeEvent: () => AnyFn;
  startDomRuntimeLockHeartbeat: () => void;
  shutdownRuntime: (payload?: LooseRecord) => void;
  startWatchlistHealthRuntime: () => void;
};

type RuntimeBootstrapSessionRuntime = {
  createRuntimeSetupOptions: (options: LooseRecord) => LooseRecord;
  applyRuntimeSetupBindings: (options: {
    runtimeSetupResult: LooseRecord;
    setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void;
    setRuntimeSetupBindings: (runtimeSetupBindings: LooseRecord) => void;
  }) => void;
  createRuntimeBootstrapSession: ({
    bootstrapContext,
  }: {
    bootstrapContext: LooseRecord;
  }) => BootstrapRuntimeSession | null;
  createBootstrapFinalizeRuntimeOptions: (options: LooseRecord) => LooseRecord;
  createBootstrapFinalizeRuntimeFromSetupResult: (options: {
    windowRef: RuntimeWindow;
    runtimeSetupResult: LooseRecord;
    runtimeBootstrapSession: BootstrapRuntimeSession;
  }) => unknown;
  bindBootstrapFinalizeRuntimeMethods: (options: {
    bootstrapFinalizeRuntime: LooseRecord;
    setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void;
    setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void;
    setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void;
    setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
  }) => boolean;
  runBootstrapFinalizeInitFlow: (options: {
    bootstrapFinalizeRuntime: LooseRecord;
    updateDiagnostics: (payload: LooseRecord) => void;
    startDomRuntimeLockHeartbeat: () => void;
    startWatchlistHealthRuntime: () => void;
    runtimeEvent: (event: string, payload?: LooseRecord) => void;
    setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
    shutdownRuntime: (payload?: LooseRecord) => void;
  }) => void;
};

type RuntimeSetupBindingsRuntime = {
  createRuntimeSetupOptions: (options: LooseRecord) => LooseRecord;
  applyRuntimeSetupBindings: (options: {
    runtimeSetupResult: LooseRecord;
    setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void;
    setRuntimeSetupBindings: (runtimeSetupBindings: LooseRecord) => void;
  }) => void;
};

type RuntimeBootstrapFinalizeFlowRuntime = {
  createBootstrapFinalizeRuntimeOptions: (context: RuntimeBootstrapHelpersContext, options: LooseRecord) => LooseRecord;
  createBootstrapFinalizeRuntimeFromSetupResult: (options: {
    context: RuntimeBootstrapHelpersContext;
    windowRef: RuntimeWindow;
    runtimeSetupResult: LooseRecord;
    runtimeBootstrapSession: BootstrapRuntimeSession;
  }) => unknown;
  bindBootstrapFinalizeRuntimeMethods: (options: {
    bootstrapFinalizeRuntime: LooseRecord;
    setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void;
    setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void;
    setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void;
    setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
    clearStaleInjectedShell: (reason: string) => void;
  }) => boolean;
  runBootstrapFinalizeInitFlow: (options: {
    bootstrapFinalizeRuntime: LooseRecord;
    updateDiagnostics: (payload: LooseRecord) => void;
    startDomRuntimeLockHeartbeat: () => void;
    startWatchlistHealthRuntime: () => void;
    runtimeEvent: (event: string, payload?: LooseRecord) => void;
    setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
    shutdownRuntime: (payload?: LooseRecord) => void;
    clearStaleInjectedShell: (reason: string) => void;
  }) => void;
};

type RuntimeBootstrapMutableAccessors = {
  setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void;
  setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void;
  setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void;
  setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void;
  setWatchlistHealthRuntime: (nextWatchlistHealthRuntime: LooseRecord) => void;
  getRuntimeEvent: () => AnyFn;
  getProcessWatchlist: () => AnyFn;
  getDestroyRuntime: () => AnyFn;
  getSyncRouteRuntime: () => AnyFn;
  getWatchlistHealthRuntime: () => LooseRecord;
};

type RuntimeBootstrapSessionSupportRuntime = {
  createRuntimeBootstrapMutableAccessors: () => RuntimeBootstrapMutableAccessors;
  resolveStorageLocalArea: (context: RuntimeBootstrapHelpersContext) => unknown;
  createIsWatchlistPath: (runtimeBootstrapGateModule: LooseRecord) => (pathname: string) => boolean;
  createDebounceProcess: (options: {
    context: RuntimeBootstrapHelpersContext;
    state: LooseRecord;
    runtimeConstants: LooseRecord;
    getProcessWatchlist: () => AnyFn;
  }) => () => void;
  startWatchlistHealthRuntime: (accessors: RuntimeBootstrapMutableAccessors) => void;
};

type RuntimeBootstrapSessionAssemblyRuntime = {
  createRuntimeBootstrapSessionForContext: (
    context: RuntimeBootstrapHelpersContext,
    supportRuntime: RuntimeBootstrapSessionSupportRuntime,
    options: {
      bootstrapContext: LooseRecord;
      createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) => RuntimeLockLifecycleControl;
    },
  ) => BootstrapRuntimeSession | null;
};

function createRuntimeSetupBindingsRuntime(): RuntimeSetupBindingsRuntime {
  return createContentRuntimeBootstrapSetupBindingsRuntime() as RuntimeSetupBindingsRuntime;
}

function createBootstrapFinalizeFlowRuntime(): RuntimeBootstrapFinalizeFlowRuntime {
  return createContentRuntimeBootstrapFinalizeFlowRuntime() as RuntimeBootstrapFinalizeFlowRuntime;
}

function createBootstrapSessionSupportRuntime(): RuntimeBootstrapSessionSupportRuntime {
  return createContentRuntimeBootstrapSessionSupportRuntime() as RuntimeBootstrapSessionSupportRuntime;
}

function createBootstrapSessionAssemblyRuntime(): RuntimeBootstrapSessionAssemblyRuntime {
  return createContentRuntimeBootstrapSessionAssemblyRuntime() as RuntimeBootstrapSessionAssemblyRuntime;
}

export function createContentRuntimeBootstrapSessionRuntime({
  context,
  clearStaleInjectedShell,
  createRuntimeLockLifecycleControl,
}: {
  context: RuntimeBootstrapHelpersContext;
  clearStaleInjectedShell: (reason: string) => void;
  createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) => RuntimeLockLifecycleControl;
}): RuntimeBootstrapSessionRuntime {
  const runtimeSetupBindingsRuntime = createRuntimeSetupBindingsRuntime();
  const bootstrapFinalizeFlowRuntime = createBootstrapFinalizeFlowRuntime();
  const supportRuntime = createBootstrapSessionSupportRuntime();
  const bootstrapSessionAssemblyRuntime = createBootstrapSessionAssemblyRuntime();

  return {
    createRuntimeSetupOptions: runtimeSetupBindingsRuntime.createRuntimeSetupOptions,
    applyRuntimeSetupBindings: runtimeSetupBindingsRuntime.applyRuntimeSetupBindings,
    createRuntimeBootstrapSession: ({ bootstrapContext }: { bootstrapContext: LooseRecord }) =>
      bootstrapSessionAssemblyRuntime.createRuntimeBootstrapSessionForContext(context, supportRuntime, {
        bootstrapContext,
        createRuntimeLockLifecycleControl,
      }),
    createBootstrapFinalizeRuntimeOptions: (options: LooseRecord) =>
      bootstrapFinalizeFlowRuntime.createBootstrapFinalizeRuntimeOptions(context, options),
    createBootstrapFinalizeRuntimeFromSetupResult: ({
      windowRef,
      runtimeSetupResult,
      runtimeBootstrapSession,
    }: {
      windowRef: RuntimeWindow;
      runtimeSetupResult: LooseRecord;
      runtimeBootstrapSession: BootstrapRuntimeSession;
    }) =>
      bootstrapFinalizeFlowRuntime.createBootstrapFinalizeRuntimeFromSetupResult({
        context,
        windowRef,
        runtimeSetupResult,
        runtimeBootstrapSession,
      }),
    bindBootstrapFinalizeRuntimeMethods: (options: {
      bootstrapFinalizeRuntime: LooseRecord;
      setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void;
      setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void;
      setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void;
      setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
    }) =>
      bootstrapFinalizeFlowRuntime.bindBootstrapFinalizeRuntimeMethods({
        ...options,
        clearStaleInjectedShell,
      }),
    runBootstrapFinalizeInitFlow: (options: {
      bootstrapFinalizeRuntime: LooseRecord;
      updateDiagnostics: (payload: LooseRecord) => void;
      startDomRuntimeLockHeartbeat: () => void;
      startWatchlistHealthRuntime: () => void;
      runtimeEvent: (event: string, payload?: LooseRecord) => void;
      setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
      shutdownRuntime: (payload?: LooseRecord) => void;
    }) =>
      bootstrapFinalizeFlowRuntime.runBootstrapFinalizeInitFlow({
        ...options,
        clearStaleInjectedShell,
      }),
  };
}

function registerContentRuntimeBootstrapSessionRuntime(): void {
  const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeWindow;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }

  root.__CW_WATCHLIST_CURATOR_MODULES__.runtimeContentRuntimeBootstrapSession = {
    createContentRuntimeBootstrapSessionRuntime,
  };
}

registerContentRuntimeBootstrapSessionRuntime();
