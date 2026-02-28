(() => {
  type AnyFn = (...args: unknown[]) => unknown;
  type LooseRecord = Record<string, unknown>;

  type RuntimeWindow = Window & typeof globalThis;

  type RuntimeBootstrapHelpersContextLike = {
    windowRef: RuntimeWindow;
    browserRef: unknown;
    chromeRef: unknown;
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
    resolveStorageLocalArea: (context: RuntimeBootstrapHelpersContextLike) => unknown;
    createIsWatchlistPath: (runtimeBootstrapGateModule: LooseRecord) => (pathname: string) => boolean;
    createDebounceProcess: (options: {
      context: RuntimeBootstrapHelpersContextLike;
      state: LooseRecord;
      runtimeConstants: LooseRecord;
      getProcessWatchlist: () => AnyFn;
    }) => () => void;
    startWatchlistHealthRuntime: (accessors: RuntimeBootstrapMutableAccessors) => void;
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

  function createRuntimeBootstrapMutableAccessors(): RuntimeBootstrapMutableAccessors {
    let processWatchlist: AnyFn = async () => {};
    let runtimeEvent: AnyFn = () => {};
    let destroyRuntime: AnyFn = () => {};
    let syncRouteRuntime: AnyFn = () => {};
    let watchlistHealthRuntime: LooseRecord = {
      start: () => {},
      stop: () => {},
      runCheck: () => {},
    };

    return {
      setRuntimeEvent: (nextRuntimeEvent: AnyFn) => {
        runtimeEvent = typeof nextRuntimeEvent === 'function' ? nextRuntimeEvent : () => {};
      },
      setProcessWatchlist: (nextProcessWatchlist: AnyFn) => {
        processWatchlist = typeof nextProcessWatchlist === 'function' ? nextProcessWatchlist : async () => {};
      },
      setDestroyRuntime: (nextDestroyRuntime: AnyFn) => {
        destroyRuntime = typeof nextDestroyRuntime === 'function' ? nextDestroyRuntime : () => {};
      },
      setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => {
        syncRouteRuntime = typeof nextSyncRouteRuntime === 'function' ? nextSyncRouteRuntime : () => {};
      },
      setWatchlistHealthRuntime: (nextWatchlistHealthRuntime: LooseRecord) => {
        watchlistHealthRuntime = toRecord(nextWatchlistHealthRuntime);
      },
      getRuntimeEvent: () => runtimeEvent,
      getProcessWatchlist: () => processWatchlist,
      getDestroyRuntime: () => destroyRuntime,
      getSyncRouteRuntime: () => syncRouteRuntime,
      getWatchlistHealthRuntime: () => watchlistHealthRuntime,
    };
  }

  function resolveStorageLocalArea(context: RuntimeBootstrapHelpersContextLike): unknown {
    return (
      toRecord(toRecord(context.browserRef).storage).local ||
      toRecord(toRecord(context.chromeRef).storage).local ||
      null
    );
  }

  function createIsWatchlistPath(runtimeBootstrapGateModule: LooseRecord): (pathname: string) => boolean {
    return (pathname: string) => (runtimeBootstrapGateModule.isWatchlistPath as AnyFn)(pathname) as boolean;
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
    getProcessWatchlist: () => AnyFn;
  }): () => void {
    return () => {
      context.windowRef.clearTimeout(state.processTimer as number);
      state.processTimer = context.windowRef.setTimeout(() => {
        (getProcessWatchlist()() as Promise<unknown>).catch(() => {
          // no-op
        });
      }, runtimeConstants.processDebounceMs as number);
    };
  }

  function startWatchlistHealthRuntime(accessors: RuntimeBootstrapMutableAccessors): void {
    const watchlistHealthRuntime = accessors.getWatchlistHealthRuntime();
    if (typeof watchlistHealthRuntime.start === 'function') {
      watchlistHealthRuntime.start();
    }
  }

  function createContentRuntimeBootstrapSessionSupportRuntime(): RuntimeBootstrapSessionSupportRuntime {
    return {
      createRuntimeBootstrapMutableAccessors: () => createRuntimeBootstrapMutableAccessors(),
      resolveStorageLocalArea: (context) => resolveStorageLocalArea(context),
      createIsWatchlistPath: (runtimeBootstrapGateModule) => createIsWatchlistPath(runtimeBootstrapGateModule),
      createDebounceProcess: (options) => createDebounceProcess(options),
      startWatchlistHealthRuntime: (accessors) => startWatchlistHealthRuntime(accessors),
    };
  }

  moduleRegistry.runtimeContentRuntimeBootstrapSessionSupport = {
    createContentRuntimeBootstrapSessionSupportRuntime,
  };
})();
