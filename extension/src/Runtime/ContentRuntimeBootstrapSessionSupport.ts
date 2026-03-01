type RuntimeBoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, RuntimeBoundaryValue>;

type RuntimeWindow = Window & typeof globalThis;

type RuntimeEventHandler = (event: string, payload?: RuntimeBoundaryValue) => void;
type ProcessWatchlistHandler = () => RuntimeBoundaryValue;
type DestroyRuntimeHandler = (payload?: RuntimeBoundaryValue) => void;
type SyncRouteRuntimeHandler = () => void;
type WatchlistHealthRuntime = LooseRecord & {
  start?: () => void;
  stop?: () => void;
  runCheck?: () => void;
};

type RuntimeBootstrapHelpersContextLike = {
  windowRef: RuntimeWindow;
  browserRef: RuntimeBoundaryValue;
  chromeRef: RuntimeBoundaryValue;
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
  resolveStorageLocalArea: (context: RuntimeBootstrapHelpersContextLike) => RuntimeBoundaryValue;
  createDebounceProcess: (options: {
    context: RuntimeBootstrapHelpersContextLike;
    state: LooseRecord;
    runtimeConstants: LooseRecord;
    getProcessWatchlist: () => ProcessWatchlistHandler;
  }) => () => void;
  startWatchlistHealthRuntime: (accessors: RuntimeBootstrapMutableAccessors) => void;
};

function toRecord(value: RuntimeBoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function toTimeoutHandle(value: RuntimeBoundaryValue): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toDebounceDelayMs(value: RuntimeBoundaryValue): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function isPromiseLike(value: RuntimeBoundaryValue): value is PromiseLike<RuntimeBoundaryValue> {
  return Boolean(value) && typeof (value as PromiseLike<RuntimeBoundaryValue>).then === 'function';
}

function createRuntimeBootstrapMutableAccessors(): RuntimeBootstrapMutableAccessors {
  let processWatchlist: ProcessWatchlistHandler = () => {};
  let runtimeEvent: RuntimeEventHandler = () => {};
  let destroyRuntime: DestroyRuntimeHandler = () => {};
  let syncRouteRuntime: SyncRouteRuntimeHandler = () => {};
  let watchlistHealthRuntime: WatchlistHealthRuntime = {
    start: () => {},
    stop: () => {},
    runCheck: () => {},
  };

  return {
    setRuntimeEvent: (nextRuntimeEvent: RuntimeEventHandler) => {
      runtimeEvent = typeof nextRuntimeEvent === 'function' ? nextRuntimeEvent : () => {};
    },
    setProcessWatchlist: (nextProcessWatchlist: ProcessWatchlistHandler) => {
      processWatchlist = typeof nextProcessWatchlist === 'function' ? nextProcessWatchlist : () => {};
    },
    setDestroyRuntime: (nextDestroyRuntime: DestroyRuntimeHandler) => {
      destroyRuntime = typeof nextDestroyRuntime === 'function' ? nextDestroyRuntime : () => {};
    },
    setSyncRouteRuntime: (nextSyncRouteRuntime: SyncRouteRuntimeHandler) => {
      syncRouteRuntime = typeof nextSyncRouteRuntime === 'function' ? nextSyncRouteRuntime : () => {};
    },
    setWatchlistHealthRuntime: (nextWatchlistHealthRuntime: WatchlistHealthRuntime) => {
      watchlistHealthRuntime = toRecord(nextWatchlistHealthRuntime);
    },
    getRuntimeEvent: () => runtimeEvent,
    getProcessWatchlist: () => processWatchlist,
    getDestroyRuntime: () => destroyRuntime,
    getSyncRouteRuntime: () => syncRouteRuntime,
    getWatchlistHealthRuntime: () => watchlistHealthRuntime,
  };
}

function resolveStorageLocalArea(context: RuntimeBootstrapHelpersContextLike): RuntimeBoundaryValue {
  return (
    toRecord(toRecord(context.browserRef).storage).local || toRecord(toRecord(context.chromeRef).storage).local || null
  );
}

function createDebounceProcess({
  context,
  state,
  runtimeConstants,
  getProcessWatchlist,
}: {
  context: RuntimeBootstrapHelpersContextLike;
  state: LooseRecord;
  runtimeConstants: LooseRecord;
  getProcessWatchlist: () => ProcessWatchlistHandler;
}): () => void {
  return () => {
    const activeTimer = toTimeoutHandle(state.processTimer);
    if (activeTimer != null) {
      context.windowRef.clearTimeout(activeTimer);
    }

    state.processTimer = context.windowRef.setTimeout(() => {
      const result = getProcessWatchlist()();
      if (isPromiseLike(result)) {
        void Promise.resolve(result).catch(() => {
          // no-op
        });
      }
    }, toDebounceDelayMs(runtimeConstants.processDebounceMs));
  };
}

function startWatchlistHealthRuntime(accessors: RuntimeBootstrapMutableAccessors): void {
  const watchlistHealthRuntime = accessors.getWatchlistHealthRuntime();
  if (typeof watchlistHealthRuntime.start === 'function') {
    watchlistHealthRuntime.start();
  }
}

export function createContentRuntimeBootstrapSessionSupportRuntime(): RuntimeBootstrapSessionSupportRuntime {
  return {
    createRuntimeBootstrapMutableAccessors: () => createRuntimeBootstrapMutableAccessors(),
    resolveStorageLocalArea: (context) => resolveStorageLocalArea(context),
    createDebounceProcess: (options) => createDebounceProcess(options),
    startWatchlistHealthRuntime: (accessors) => startWatchlistHealthRuntime(accessors),
  };
}
