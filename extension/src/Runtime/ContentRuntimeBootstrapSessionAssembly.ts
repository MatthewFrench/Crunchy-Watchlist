import { createWatchlistHealthRuntime } from './WatchlistHealth.js';

type RuntimeBoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, RuntimeBoundaryValue>;
type RuntimeEventHandler = (event: string, payload?: RuntimeBoundaryValue) => void;
type ProcessWatchlistHandler = () => RuntimeBoundaryValue;
type DestroyRuntimeHandler = (payload?: LooseRecord) => void;
type SyncRouteRuntimeHandler = () => void;
type AssertRuntimeMethods = (owner: string, runtime: LooseRecord, requiredMethods: string[]) => void;
type WatchlistHealthRuntime = LooseRecord & {
  runCheck?: () => void;
  start?: () => void;
  stop?: () => void;
};
type RuntimeStoreModule = {
  createRuntimeState: (options: {
    defaultSettings: LooseRecord;
    watchHistoryCacheVersion: RuntimeBoundaryValue;
  }) => LooseRecord;
  createEmptyWatchHistoryCache: (watchHistoryCacheVersion: RuntimeBoundaryValue) => RuntimeBoundaryValue;
  createWatchlistCacheSnapshot: (...args: RuntimeBoundaryValue[]) => RuntimeBoundaryValue;
};

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
  isWatchlistPath: (pathname: string) => boolean;
  getWatchlistRoot: (documentRef: Document) => Element | null;
  getWatchlistHeader: (documentRef: Document) => Element | null;
  assertRuntimeMethods: AssertRuntimeMethods;
  bootstrapModulesRuntime: LooseRecord;
};

type BootstrapSessionDependencies = {
  runtimeLifecycleModule: LooseRecord;
  storageModule: LooseRecord;
  assertRuntimeMethods: AssertRuntimeMethods;
  defaultSortMode: RuntimeBoundaryValue;
  validSortModes: RuntimeBoundaryValue;
  sortModeControlOptions: RuntimeBoundaryValue[];
  defaultSettings: LooseRecord;
  runtimeConstants: LooseRecord;
  state: LooseRecord;
  createEmptyWatchHistoryCache: (watchHistoryCacheVersion: RuntimeBoundaryValue) => RuntimeBoundaryValue;
  createWatchlistCacheSnapshot: (...args: RuntimeBoundaryValue[]) => RuntimeBoundaryValue;
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

type BootstrapRuntimeSession = {
  runtimeLifecycleModule: LooseRecord;
  storageModule: LooseRecord;
  assertRuntimeMethods: AssertRuntimeMethods;
  defaultSortMode: RuntimeBoundaryValue;
  validSortModes: RuntimeBoundaryValue;
  sortModeControlOptions: RuntimeBoundaryValue[];
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
    throw new Error(`[CW] Missing bootstrap session dependency: ${name}`);
  }

  return value as T;
}

function resolveBootstrapSessionCoreModules(bootstrapContext: LooseRecord): BootstrapSessionCoreModules {
  return {
    isWatchlistPath: requireFunction<(pathname: string) => boolean>(
      'isWatchlistPath',
      bootstrapContext.isWatchlistPath,
    ),
    getWatchlistRoot: requireFunction<(documentRef: Document) => Element | null>(
      'getWatchlistRoot',
      bootstrapContext.getWatchlistRoot,
    ),
    getWatchlistHeader: requireFunction<(documentRef: Document) => Element | null>(
      'getWatchlistHeader',
      bootstrapContext.getWatchlistHeader,
    ),
    assertRuntimeMethods: requireFunction<AssertRuntimeMethods>(
      'assertRuntimeMethods',
      bootstrapContext.assertRuntimeMethods,
    ),
    bootstrapModulesRuntime: toRecord(bootstrapContext.bootstrapModulesRuntime),
  };
}

function resolveRuntimeStoreModule(value: RuntimeBoundaryValue): RuntimeStoreModule {
  const runtimeStoreRecord = toRecord(value);
  return {
    createRuntimeState: requireFunction<RuntimeStoreModule['createRuntimeState']>(
      'runtimeStoreModule.createRuntimeState',
      runtimeStoreRecord.createRuntimeState,
    ),
    createEmptyWatchHistoryCache: requireFunction<RuntimeStoreModule['createEmptyWatchHistoryCache']>(
      'runtimeStoreModule.createEmptyWatchHistoryCache',
      runtimeStoreRecord.createEmptyWatchHistoryCache,
    ),
    createWatchlistCacheSnapshot: requireFunction<RuntimeStoreModule['createWatchlistCacheSnapshot']>(
      'runtimeStoreModule.createWatchlistCacheSnapshot',
      runtimeStoreRecord.createWatchlistCacheSnapshot,
    ),
  };
}

function resolveBootstrapSessionDependencies(coreModules: BootstrapSessionCoreModules): BootstrapSessionDependencies {
  const runtimeStoreModule = resolveRuntimeStoreModule(coreModules.bootstrapModulesRuntime.runtimeStoreModule);
  const runtimeConstants = toRecord(coreModules.bootstrapModulesRuntime.runtimeConstants);
  const defaultSettings = toRecord(coreModules.bootstrapModulesRuntime.defaultSettings);

  return {
    runtimeLifecycleModule: toRecord(coreModules.bootstrapModulesRuntime.runtimeLifecycleModule),
    storageModule: toRecord(coreModules.bootstrapModulesRuntime.storageModule),
    assertRuntimeMethods: coreModules.assertRuntimeMethods,
    defaultSortMode: coreModules.bootstrapModulesRuntime.defaultSortMode,
    validSortModes: coreModules.bootstrapModulesRuntime.validSortModes,
    sortModeControlOptions: Array.isArray(coreModules.bootstrapModulesRuntime.sortModeControlOptions)
      ? coreModules.bootstrapModulesRuntime.sortModeControlOptions
      : [],
    defaultSettings,
    runtimeConstants,
    state: runtimeStoreModule.createRuntimeState({
      defaultSettings,
      watchHistoryCacheVersion: runtimeConstants.watchHistoryCacheVersion,
    }),
    createEmptyWatchHistoryCache: () =>
      runtimeStoreModule.createEmptyWatchHistoryCache(runtimeConstants.watchHistoryCacheVersion),
    createWatchlistCacheSnapshot: (...args: RuntimeBoundaryValue[]) =>
      runtimeStoreModule.createWatchlistCacheSnapshot(...args),
  };
}

function activateRuntimeControlForSession(
  context: RuntimeBootstrapHelpersContext,
  getRuntimeEvent: () => RuntimeEventHandler,
  shutdownRuntime: DestroyRuntimeHandler,
): void {
  context.setRuntimeControl({
    version: context.windowRef.__CW_WATCHLIST_CURATOR_LOADED__?.version || '0',
    active: true,
    activeInstanceId: context.runtimeInstanceId,
    activeInstanceClaimedAt: context.runtimeInstanceStartedAt,
    shutdown: (payload: RuntimeBoundaryValue) => {
      getRuntimeEvent()('shutdown-requested', payload || null);
      shutdownRuntime(toRecord(payload));
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
  getRuntimeEvent: () => RuntimeEventHandler;
  getProcessWatchlist: () => ProcessWatchlistHandler;
  getSyncRouteRuntime: () => SyncRouteRuntimeHandler;
}): WatchlistHealthRuntime {
  return createWatchlistHealthRuntime({
    state,
    windowRef: context.windowRef,
    runtimeEvent: (event: string, data: RuntimeBoundaryValue) => getRuntimeEvent()(event, data),
    isRuntimeActive: () => context.isCurrentRuntimeActive(),
    isWatchlistPath: (pathname: string) => isWatchlistPath(pathname),
    getWatchlistRoot: (documentRef: Document) => coreModules.getWatchlistRoot(documentRef),
    processWatchlist: () => getProcessWatchlist()(),
    syncRouteRuntime: () => getSyncRouteRuntime()(),
  }) as WatchlistHealthRuntime;
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
  createRuntimeLockLifecycleControl,
}: {
  context: RuntimeBootstrapHelpersContext;
  coreModules: BootstrapSessionCoreModules;
  sessionDependencies: BootstrapSessionDependencies;
  accessors: RuntimeBootstrapMutableAccessors;
  createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) => RuntimeLockLifecycleControl;
}): BootstrapSessionAssembledRuntime {
  const runtimeLockLifecycleControl = createRuntimeLockLifecycleControlForSession({
    sessionDependencies,
    accessors,
    createRuntimeLockLifecycleControl,
  });
  const isWatchlistPath = coreModules.isWatchlistPath;
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
    runtimeLifecycleModule: sessionDependencies.runtimeLifecycleModule,
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
    getWatchlistRoot: coreModules.getWatchlistRoot,
    getWatchlistHeader: coreModules.getWatchlistHeader,
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
