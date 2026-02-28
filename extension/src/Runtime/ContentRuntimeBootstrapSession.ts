import { createContentRuntimeBootstrapFinalizeFlowRuntime } from './ContentRuntimeBootstrapFinalizeFlow.js';
import { createContentRuntimeBootstrapSessionAssemblyRuntime } from './ContentRuntimeBootstrapSessionAssembly.js';
import { createContentRuntimeBootstrapSessionSupportRuntime } from './ContentRuntimeBootstrapSessionSupport.js';
import { createContentRuntimeBootstrapSetupBindingsRuntime } from './ContentRuntimeBootstrapSetupBindings.js';
import { createContentRuntimeSetup } from './ContentRuntimeSetup.js';

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
  getWatchlistRoot: (documentRef: Document) => Element | null;
  getWatchlistHeader: (documentRef: Document) => Element | null;
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
  createRuntimeSetup: (options: LooseRecord) => LooseRecord;
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

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as LooseRecord;
}

function requireFunction<T>(name: string, value: unknown): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing content-runtime-bootstrap-session dependency: ${name}`);
  }

  return value as T;
}

function resolveRuntimeSetupBindingsRuntime(value: unknown): RuntimeSetupBindingsRuntime {
  const runtimeRecord = toRecord(value);
  return {
    createRuntimeSetupOptions: requireFunction<RuntimeSetupBindingsRuntime['createRuntimeSetupOptions']>(
      'runtimeSetupBindingsRuntime.createRuntimeSetupOptions',
      runtimeRecord.createRuntimeSetupOptions,
    ),
    applyRuntimeSetupBindings: requireFunction<RuntimeSetupBindingsRuntime['applyRuntimeSetupBindings']>(
      'runtimeSetupBindingsRuntime.applyRuntimeSetupBindings',
      runtimeRecord.applyRuntimeSetupBindings,
    ),
  };
}

function resolveBootstrapFinalizeFlowRuntime(value: unknown): RuntimeBootstrapFinalizeFlowRuntime {
  const runtimeRecord = toRecord(value);
  return {
    createBootstrapFinalizeRuntimeOptions: requireFunction<
      RuntimeBootstrapFinalizeFlowRuntime['createBootstrapFinalizeRuntimeOptions']
    >(
      'bootstrapFinalizeFlowRuntime.createBootstrapFinalizeRuntimeOptions',
      runtimeRecord.createBootstrapFinalizeRuntimeOptions,
    ),
    createBootstrapFinalizeRuntimeFromSetupResult: requireFunction<
      RuntimeBootstrapFinalizeFlowRuntime['createBootstrapFinalizeRuntimeFromSetupResult']
    >(
      'bootstrapFinalizeFlowRuntime.createBootstrapFinalizeRuntimeFromSetupResult',
      runtimeRecord.createBootstrapFinalizeRuntimeFromSetupResult,
    ),
    bindBootstrapFinalizeRuntimeMethods: requireFunction<
      RuntimeBootstrapFinalizeFlowRuntime['bindBootstrapFinalizeRuntimeMethods']
    >(
      'bootstrapFinalizeFlowRuntime.bindBootstrapFinalizeRuntimeMethods',
      runtimeRecord.bindBootstrapFinalizeRuntimeMethods,
    ),
    runBootstrapFinalizeInitFlow: requireFunction<RuntimeBootstrapFinalizeFlowRuntime['runBootstrapFinalizeInitFlow']>(
      'bootstrapFinalizeFlowRuntime.runBootstrapFinalizeInitFlow',
      runtimeRecord.runBootstrapFinalizeInitFlow,
    ),
  };
}

function resolveBootstrapSessionSupportRuntime(value: unknown): RuntimeBootstrapSessionSupportRuntime {
  const runtimeRecord = toRecord(value);
  return {
    createRuntimeBootstrapMutableAccessors: requireFunction<
      RuntimeBootstrapSessionSupportRuntime['createRuntimeBootstrapMutableAccessors']
    >(
      'bootstrapSessionSupportRuntime.createRuntimeBootstrapMutableAccessors',
      runtimeRecord.createRuntimeBootstrapMutableAccessors,
    ),
    resolveStorageLocalArea: requireFunction<RuntimeBootstrapSessionSupportRuntime['resolveStorageLocalArea']>(
      'bootstrapSessionSupportRuntime.resolveStorageLocalArea',
      runtimeRecord.resolveStorageLocalArea,
    ),
    createDebounceProcess: requireFunction<RuntimeBootstrapSessionSupportRuntime['createDebounceProcess']>(
      'bootstrapSessionSupportRuntime.createDebounceProcess',
      runtimeRecord.createDebounceProcess,
    ),
    startWatchlistHealthRuntime: requireFunction<RuntimeBootstrapSessionSupportRuntime['startWatchlistHealthRuntime']>(
      'bootstrapSessionSupportRuntime.startWatchlistHealthRuntime',
      runtimeRecord.startWatchlistHealthRuntime,
    ),
  };
}

function resolveBootstrapSessionAssemblyRuntime(value: unknown): RuntimeBootstrapSessionAssemblyRuntime {
  const runtimeRecord = toRecord(value);
  return {
    createRuntimeBootstrapSessionForContext: requireFunction<
      RuntimeBootstrapSessionAssemblyRuntime['createRuntimeBootstrapSessionForContext']
    >(
      'bootstrapSessionAssemblyRuntime.createRuntimeBootstrapSessionForContext',
      runtimeRecord.createRuntimeBootstrapSessionForContext,
    ),
  };
}

function createRuntimeSetupBindingsRuntime(): RuntimeSetupBindingsRuntime {
  return resolveRuntimeSetupBindingsRuntime(createContentRuntimeBootstrapSetupBindingsRuntime());
}

function createBootstrapFinalizeFlowRuntime(): RuntimeBootstrapFinalizeFlowRuntime {
  return resolveBootstrapFinalizeFlowRuntime(createContentRuntimeBootstrapFinalizeFlowRuntime());
}

function createBootstrapSessionSupportRuntime(): RuntimeBootstrapSessionSupportRuntime {
  return resolveBootstrapSessionSupportRuntime(createContentRuntimeBootstrapSessionSupportRuntime());
}

function createBootstrapSessionAssemblyRuntime(): RuntimeBootstrapSessionAssemblyRuntime {
  return resolveBootstrapSessionAssemblyRuntime(createContentRuntimeBootstrapSessionAssemblyRuntime());
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
    createRuntimeSetup: (options: LooseRecord) => toRecord(createContentRuntimeSetup(options)),
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
