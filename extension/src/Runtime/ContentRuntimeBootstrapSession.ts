import { createContentRuntimeBootstrapFinalizeFlowRuntime } from './ContentRuntimeBootstrapFinalizeFlow.js';
import { createContentRuntimeBootstrapSessionAssemblyRuntime } from './ContentRuntimeBootstrapSessionAssembly.js';
import { createContentRuntimeBootstrapSessionSupportRuntime } from './ContentRuntimeBootstrapSessionSupport.js';
import { createContentRuntimeBootstrapSetupBindingsRuntime } from './ContentRuntimeBootstrapSetupBindings.js';
import { createContentRuntimeSetup } from './ContentRuntimeSetup.js';

type RuntimeBoundaryValue = LooseRecord[string];
type SortModeControlOption = {
  optionValue: string;
  title: string;
};
type RuntimeEventHandler = (event: string, payload?: RuntimeBoundaryValue) => void;
type ProcessWatchlistHandler = () => void | Promise<void>;
type DestroyRuntimeHandler = (payload?: LooseRecord) => void;
type SyncRouteRuntimeHandler = () => void;
type AssertRuntimeMethods = (owner: string, runtime: LooseRecord, requiredMethods: string[]) => void;
type WatchlistHealthRuntime = LooseRecord & {
  runCheck?: () => void;
  start?: () => void;
  stop?: () => void;
};

type RuntimeWindow = Window &
  typeof globalThis & {
    __CW_WATCHLIST_CURATOR_LOADED__?: {
      version?: string;
    };
  };

type RuntimeBootstrapHelpersContext = {
  windowRef: RuntimeWindow;
  browserRef: RuntimeBoundaryValue;
  chromeRef: RuntimeBoundaryValue;
  setRuntimeControl: (patch: LooseRecord) => void;
  runtimeInstanceId: string;
  runtimeInstanceStartedAt: number;
  isCurrentRuntimeActive: () => boolean;
};

type RuntimeLockLifecycleOptions = {
  state: LooseRecord;
  getRuntimeEvent: () => RuntimeEventHandler;
  getDestroyRuntime: () => DestroyRuntimeHandler;
  getWatchlistHealthRuntime: () => WatchlistHealthRuntime;
};

type RuntimeLockLifecycleControl = {
  startDomRuntimeLockHeartbeat: () => void;
  startRuntimeTakeoverRequestListener: () => void;
  shutdownRuntime: (payload?: LooseRecord) => void;
};

type BootstrapRuntimeSession = {
  runtimeLifecycleModule: LooseRecord;
  storageModule: LooseRecord;
  assertRuntimeMethods: AssertRuntimeMethods;
  defaultSortMode: RuntimeBoundaryValue;
  validSortModes: RuntimeBoundaryValue;
  sortModeControlOptions: SortModeControlOption[];
  defaultSettings: LooseRecord;
  runtimeConstants: LooseRecord;
  state: LooseRecord;
  storageLocalArea: RuntimeBoundaryValue;
  isWatchlistPath: (pathname: string) => boolean;
  getWatchlistRoot: (documentRef: Document) => Element | null;
  getWatchlistHeader: (documentRef: Document) => Element | null;
  debounceProcess: () => void;
  createEmptyWatchHistoryCache: (watchHistoryCacheVersion: RuntimeBoundaryValue) => RuntimeBoundaryValue;
  createWatchlistCacheSnapshot: (...args: RuntimeBoundaryValue[]) => RuntimeBoundaryValue;
  bootstrapModulesRuntime: LooseRecord;
  setRuntimeEvent: (nextRuntimeEvent: RuntimeEventHandler) => void;
  setProcessWatchlist: (nextProcessWatchlist: ProcessWatchlistHandler) => void;
  setDestroyRuntime: (nextDestroyRuntime: DestroyRuntimeHandler) => void;
  setSyncRouteRuntime: (nextSyncRouteRuntime: SyncRouteRuntimeHandler) => void;
  getRuntimeEvent: () => RuntimeEventHandler;
  startDomRuntimeLockHeartbeat: () => void;
  shutdownRuntime: DestroyRuntimeHandler;
  startWatchlistHealthRuntime: () => void;
};

type RuntimeBootstrapSessionRuntime = {
  createRuntimeSetup: (options: LooseRecord) => LooseRecord;
  createRuntimeSetupOptions: (options: LooseRecord) => LooseRecord;
  applyRuntimeSetupBindings: (options: {
    runtimeSetupResult: LooseRecord;
    setRuntimeEvent: (nextRuntimeEvent: RuntimeEventHandler) => void;
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
  }) => RuntimeBoundaryValue;
  bindBootstrapFinalizeRuntimeMethods: (options: {
    bootstrapFinalizeRuntime: LooseRecord;
    disposeRuntimeSetup?: (() => void) | null;
    setProcessWatchlist: (nextProcessWatchlist: ProcessWatchlistHandler) => void;
    setSyncRouteRuntime: (nextSyncRouteRuntime: SyncRouteRuntimeHandler) => void;
    setDestroyRuntime: (nextDestroyRuntime: DestroyRuntimeHandler) => void;
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
    setRuntimeEvent: (nextRuntimeEvent: RuntimeEventHandler) => void;
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
  }) => RuntimeBoundaryValue;
  bindBootstrapFinalizeRuntimeMethods: (options: {
    bootstrapFinalizeRuntime: LooseRecord;
    disposeRuntimeSetup?: (() => void) | null;
    setProcessWatchlist: (nextProcessWatchlist: ProcessWatchlistHandler) => void;
    setSyncRouteRuntime: (nextSyncRouteRuntime: SyncRouteRuntimeHandler) => void;
    setDestroyRuntime: (nextDestroyRuntime: DestroyRuntimeHandler) => void;
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
  setRuntimeEvent: (nextRuntimeEvent: RuntimeEventHandler) => void;
  setProcessWatchlist: (nextProcessWatchlist: ProcessWatchlistHandler) => void;
  setDestroyRuntime: (nextDestroyRuntime: DestroyRuntimeHandler) => void;
  setSyncRouteRuntime: (nextSyncRouteRuntime: SyncRouteRuntimeHandler) => void;
  setWatchlistHealthRuntime: (nextWatchlistHealthRuntime: WatchlistHealthRuntime) => void;
  getRuntimeEvent: () => RuntimeEventHandler;
  getProcessWatchlist: () => ProcessWatchlistHandler;
  getDestroyRuntime: () => DestroyRuntimeHandler;
  getSyncRouteRuntime: () => SyncRouteRuntimeHandler;
  getWatchlistHealthRuntime: () => WatchlistHealthRuntime;
};

type RuntimeBootstrapSessionSupportRuntime = {
  createRuntimeBootstrapMutableAccessors: () => RuntimeBootstrapMutableAccessors;
  resolveStorageLocalArea: (context: RuntimeBootstrapHelpersContext) => RuntimeBoundaryValue;
  createDebounceProcess: (options: {
    context: RuntimeBootstrapHelpersContext;
    state: LooseRecord;
    runtimeConstants: LooseRecord;
    getProcessWatchlist: () => ProcessWatchlistHandler;
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

function toRecord(value: RuntimeBoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as LooseRecord;
}

function requireFunction<T>(name: string, value: RuntimeBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing content-runtime-bootstrap-session dependency: ${name}`);
  }

  return value as T;
}

function resolveRuntimeSetupBindingsRuntime(value: RuntimeBoundaryValue): RuntimeSetupBindingsRuntime {
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

function resolveBootstrapFinalizeFlowRuntime(value: RuntimeBoundaryValue): RuntimeBootstrapFinalizeFlowRuntime {
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

function resolveBootstrapSessionSupportRuntime(value: RuntimeBoundaryValue): RuntimeBootstrapSessionSupportRuntime {
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

function resolveBootstrapSessionAssemblyRuntime(value: RuntimeBoundaryValue): RuntimeBootstrapSessionAssemblyRuntime {
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
      disposeRuntimeSetup?: (() => void) | null;
      setProcessWatchlist: (nextProcessWatchlist: ProcessWatchlistHandler) => void;
      setSyncRouteRuntime: (nextSyncRouteRuntime: SyncRouteRuntimeHandler) => void;
      setDestroyRuntime: (nextDestroyRuntime: DestroyRuntimeHandler) => void;
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
