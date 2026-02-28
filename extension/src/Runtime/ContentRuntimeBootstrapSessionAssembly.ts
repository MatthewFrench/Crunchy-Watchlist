import { createWatchlistHealthRuntime } from './WatchlistHealth.js';

type AnyFn = (...args: unknown[]) => unknown;
type LooseRecord = Record<string, unknown>;

type RuntimeControl = LooseRecord & {
  active?: boolean;
  activeInstanceId?: string | null;
};

type RuntimeWindow = Window &
  typeof globalThis & {
    __CW_WATCHLIST_CURATOR_CONTROL__?: RuntimeControl;
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

type BootstrapSessionRuntimeControlDependencies = {
  sessionDependencies: BootstrapSessionDependencies;
  accessors: RuntimeBootstrapMutableAccessors;
  createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) => RuntimeLockLifecycleControl;
};

type BootstrapSessionAssembledRuntime = {
  runtimeLockLifecycleControl: RuntimeLockLifecycleControl;
  isWatchlistPath: (pathname: string) => boolean;
};

type BootstrapSessionCoreModules = {
  runtimeBootstrapGateModule: LooseRecord;
  assertRuntimeMethods: AnyFn;
  runtimeBootstrapFinalizeModule: LooseRecord;
  bootstrapModulesRuntime: LooseRecord;
};

type BootstrapSessionDependencies = {
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
  createEmptyWatchHistoryCache: AnyFn;
  createWatchlistCacheSnapshot: AnyFn;
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

type BootstrapRuntimeSession = {
  runtimeBootstrapGateModule: LooseRecord;
  runtimeBootstrapFinalizeModule: LooseRecord;
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

const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeWindow;
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

function resolveBootstrapSessionCoreModules(bootstrapContext: LooseRecord): BootstrapSessionCoreModules {
  return {
    runtimeBootstrapGateModule: toRecord(bootstrapContext.runtimeBootstrapGateModule),
    assertRuntimeMethods: bootstrapContext.assertRuntimeMethods as AnyFn,
    runtimeBootstrapFinalizeModule: toRecord(bootstrapContext.runtimeBootstrapFinalizeModule),
    bootstrapModulesRuntime: toRecord(bootstrapContext.bootstrapModulesRuntime),
  };
}

function resolveBootstrapSessionDependencies(coreModules: BootstrapSessionCoreModules): BootstrapSessionDependencies {
  const runtimeStoreModule = toRecord(coreModules.bootstrapModulesRuntime.runtimeStoreModule);
  const runtimeConstants = toRecord(coreModules.bootstrapModulesRuntime.runtimeConstants);
  const defaultSettings = toRecord(coreModules.bootstrapModulesRuntime.defaultSettings);

  return {
    runtimeStateLoaderModule: toRecord(coreModules.bootstrapModulesRuntime.runtimeStateLoaderModule),
    runtimeLifecycleModule: toRecord(coreModules.bootstrapModulesRuntime.runtimeLifecycleModule),
    runtimeBootstrapHelpersModule: toRecord(coreModules.bootstrapModulesRuntime.runtimeBootstrapHelpersModule),
    storageModule: toRecord(coreModules.bootstrapModulesRuntime.storageModule),
    assertRuntimeMethods: coreModules.assertRuntimeMethods,
    defaultSortMode: coreModules.bootstrapModulesRuntime.defaultSortMode,
    validSortModes: coreModules.bootstrapModulesRuntime.validSortModes,
    sortModeControlOptions: Array.isArray(coreModules.bootstrapModulesRuntime.sortModeControlOptions)
      ? coreModules.bootstrapModulesRuntime.sortModeControlOptions
      : [],
    defaultSettings,
    runtimeConstants,
    state: (runtimeStoreModule.createRuntimeState as AnyFn)({
      defaultSettings,
      watchHistoryCacheVersion: runtimeConstants.watchHistoryCacheVersion,
    }) as LooseRecord,
    createEmptyWatchHistoryCache: () =>
      (runtimeStoreModule.createEmptyWatchHistoryCache as AnyFn)(runtimeConstants.watchHistoryCacheVersion),
    createWatchlistCacheSnapshot: (...args: unknown[]) =>
      (runtimeStoreModule.createWatchlistCacheSnapshot as AnyFn)(...args),
  };
}

function activateRuntimeControlForSession(
  context: RuntimeBootstrapHelpersContext,
  getRuntimeEvent: () => AnyFn,
  shutdownRuntime: (payload?: LooseRecord) => void,
): void {
  context.setRuntimeControl({
    version: context.windowRef.__CW_WATCHLIST_CURATOR_LOADED__?.version || '0',
    active: true,
    activeInstanceId: context.runtimeInstanceId,
    activeInstanceClaimedAt: context.runtimeInstanceStartedAt,
    shutdown: (payload: unknown) => {
      getRuntimeEvent()('shutdown-requested', payload || null);
      shutdownRuntime((payload || {}) as LooseRecord);
    },
  });
}

function createWatchlistHealthRuntimeForSession({
  context,
  coreModules,
  state,
  isWatchlistPath,
  getRuntimeEvent,
  getProcessWatchlist,
  getSyncRouteRuntime,
}: {
  context: RuntimeBootstrapHelpersContext;
  coreModules: BootstrapSessionCoreModules;
  state: LooseRecord;
  isWatchlistPath: (pathname: string) => boolean;
  getRuntimeEvent: () => AnyFn;
  getProcessWatchlist: () => AnyFn;
  getSyncRouteRuntime: () => AnyFn;
}): LooseRecord {
  return createWatchlistHealthRuntime({
    state,
    windowRef: context.windowRef,
    runtimeEvent: (event: string, data: unknown) => getRuntimeEvent()(event, data),
    isRuntimeActive: () => context.isCurrentRuntimeActive(),
    isWatchlistPath: (pathname: string) => isWatchlistPath(pathname),
    getWatchlistRoot: (documentRef: Document) =>
      (coreModules.runtimeBootstrapGateModule.getWatchlistRoot as AnyFn)(documentRef),
    processWatchlist: () => getProcessWatchlist()(),
    syncRouteRuntime: () => getSyncRouteRuntime()(),
  }) as LooseRecord;
}

function createRuntimeLockLifecycleControlForSession({
  sessionDependencies,
  accessors,
  createRuntimeLockLifecycleControl,
}: BootstrapSessionRuntimeControlDependencies): RuntimeLockLifecycleControl {
  return createRuntimeLockLifecycleControl({
    state: sessionDependencies.state,
    getRuntimeEvent: accessors.getRuntimeEvent,
    getDestroyRuntime: accessors.getDestroyRuntime,
    getWatchlistHealthRuntime: accessors.getWatchlistHealthRuntime,
  });
}

function attachWatchlistHealthRuntimeForSession({
  context,
  coreModules,
  sessionDependencies,
  accessors,
  isWatchlistPath,
}: {
  context: RuntimeBootstrapHelpersContext;
  coreModules: BootstrapSessionCoreModules;
  sessionDependencies: BootstrapSessionDependencies;
  accessors: RuntimeBootstrapMutableAccessors;
  isWatchlistPath: (pathname: string) => boolean;
}): void {
  const watchlistHealthRuntime = createWatchlistHealthRuntimeForSession({
    context,
    coreModules,
    state: sessionDependencies.state,
    isWatchlistPath,
    getRuntimeEvent: accessors.getRuntimeEvent,
    getProcessWatchlist: accessors.getProcessWatchlist,
    getSyncRouteRuntime: accessors.getSyncRouteRuntime,
  });
  sessionDependencies.assertRuntimeMethods('watchlist health runtime', watchlistHealthRuntime, [
    'runCheck',
    'start',
    'stop',
  ]);
  accessors.setWatchlistHealthRuntime(watchlistHealthRuntime);
}

function assembleBootstrapSessionRuntimeForContext({
  context,
  coreModules,
  sessionDependencies,
  accessors,
  supportRuntime,
  createRuntimeLockLifecycleControl,
}: {
  context: RuntimeBootstrapHelpersContext;
  coreModules: BootstrapSessionCoreModules;
  sessionDependencies: BootstrapSessionDependencies;
  accessors: RuntimeBootstrapMutableAccessors;
  supportRuntime: RuntimeBootstrapSessionSupportRuntime;
  createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) => RuntimeLockLifecycleControl;
}): BootstrapSessionAssembledRuntime {
  const runtimeLockLifecycleControl = createRuntimeLockLifecycleControlForSession({
    sessionDependencies,
    accessors,
    createRuntimeLockLifecycleControl,
  });
  const isWatchlistPath = supportRuntime.createIsWatchlistPath(coreModules.runtimeBootstrapGateModule);
  activateRuntimeControlForSession(context, accessors.getRuntimeEvent, runtimeLockLifecycleControl.shutdownRuntime);
  runtimeLockLifecycleControl.startRuntimeTakeoverRequestListener();
  attachWatchlistHealthRuntimeForSession({
    context,
    coreModules,
    sessionDependencies,
    accessors,
    isWatchlistPath,
  });
  return {
    runtimeLockLifecycleControl,
    isWatchlistPath,
  };
}

function createBootstrapRuntimeSessionForContext({
  context,
  coreModules,
  sessionDependencies,
  accessors,
  supportRuntime,
  runtimeLockLifecycleControl,
  isWatchlistPath,
}: {
  context: RuntimeBootstrapHelpersContext;
  coreModules: BootstrapSessionCoreModules;
  sessionDependencies: BootstrapSessionDependencies;
  accessors: RuntimeBootstrapMutableAccessors;
  supportRuntime: RuntimeBootstrapSessionSupportRuntime;
  runtimeLockLifecycleControl: RuntimeLockLifecycleControl;
  isWatchlistPath: (pathname: string) => boolean;
}): BootstrapRuntimeSession {
  return {
    runtimeBootstrapGateModule: coreModules.runtimeBootstrapGateModule,
    runtimeBootstrapFinalizeModule: coreModules.runtimeBootstrapFinalizeModule,
    runtimeStateLoaderModule: sessionDependencies.runtimeStateLoaderModule,
    runtimeLifecycleModule: sessionDependencies.runtimeLifecycleModule,
    runtimeBootstrapHelpersModule: sessionDependencies.runtimeBootstrapHelpersModule,
    storageModule: sessionDependencies.storageModule,
    assertRuntimeMethods: sessionDependencies.assertRuntimeMethods,
    defaultSortMode: sessionDependencies.defaultSortMode,
    validSortModes: sessionDependencies.validSortModes,
    sortModeControlOptions: sessionDependencies.sortModeControlOptions,
    defaultSettings: sessionDependencies.defaultSettings,
    runtimeConstants: sessionDependencies.runtimeConstants,
    state: sessionDependencies.state,
    storageLocalArea: supportRuntime.resolveStorageLocalArea(context),
    isWatchlistPath,
    debounceProcess: supportRuntime.createDebounceProcess({
      context,
      state: sessionDependencies.state,
      runtimeConstants: sessionDependencies.runtimeConstants,
      getProcessWatchlist: accessors.getProcessWatchlist,
    }),
    createEmptyWatchHistoryCache: sessionDependencies.createEmptyWatchHistoryCache,
    createWatchlistCacheSnapshot: sessionDependencies.createWatchlistCacheSnapshot,
    bootstrapModulesRuntime: coreModules.bootstrapModulesRuntime,
    setRuntimeEvent: accessors.setRuntimeEvent,
    setProcessWatchlist: accessors.setProcessWatchlist,
    setDestroyRuntime: accessors.setDestroyRuntime,
    setSyncRouteRuntime: accessors.setSyncRouteRuntime,
    getRuntimeEvent: accessors.getRuntimeEvent,
    startDomRuntimeLockHeartbeat: runtimeLockLifecycleControl.startDomRuntimeLockHeartbeat,
    shutdownRuntime: runtimeLockLifecycleControl.shutdownRuntime,
    startWatchlistHealthRuntime: () => {
      supportRuntime.startWatchlistHealthRuntime(accessors);
    },
  };
}

// Session assembly performs side-effectful ownership wiring in one pass so takeover control,
// watchlist health, and mutable accessors stay consistent for the same runtime instance.
function createRuntimeBootstrapSessionForContext(
  context: RuntimeBootstrapHelpersContext,
  supportRuntime: RuntimeBootstrapSessionSupportRuntime,
  {
    bootstrapContext,
    createRuntimeLockLifecycleControl,
  }: {
    bootstrapContext: LooseRecord;
    createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) => RuntimeLockLifecycleControl;
  },
): BootstrapRuntimeSession | null {
  const coreModules = resolveBootstrapSessionCoreModules(bootstrapContext);
  const sessionDependencies = resolveBootstrapSessionDependencies(coreModules);
  const accessors = supportRuntime.createRuntimeBootstrapMutableAccessors();
  const assembledRuntime = assembleBootstrapSessionRuntimeForContext({
    context,
    coreModules,
    sessionDependencies,
    accessors,
    supportRuntime,
    createRuntimeLockLifecycleControl,
  });

  return createBootstrapRuntimeSessionForContext({
    context,
    coreModules,
    sessionDependencies,
    accessors,
    supportRuntime,
    runtimeLockLifecycleControl: assembledRuntime.runtimeLockLifecycleControl,
    isWatchlistPath: assembledRuntime.isWatchlistPath,
  });
}

export function createContentRuntimeBootstrapSessionAssemblyRuntime(): RuntimeBootstrapSessionAssemblyRuntime {
  return {
    createRuntimeBootstrapSessionForContext: (context, supportRuntime, options) =>
      createRuntimeBootstrapSessionForContext(context, supportRuntime, options),
  };
}

function registerContentRuntimeBootstrapSessionAssemblyRuntime(): void {
  moduleRegistry.runtimeContentRuntimeBootstrapSessionAssembly = {
    createContentRuntimeBootstrapSessionAssemblyRuntime,
  };
}

registerContentRuntimeBootstrapSessionAssemblyRuntime();
