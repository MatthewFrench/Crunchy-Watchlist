type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryList = BoundaryValue[];

type BootstrapWindow = Window &
  typeof globalThis & {
    __CW_WATCHLIST_CURATOR_DEBUG__?: {
      listSeries: () => BoundaryList;
      getCuratedDomStats: () => BoundaryValue;
      dumpSeriesApiData: (query: BoundaryValue) => BoundaryValue;
      printSeriesApiData: (query: BoundaryValue) => BoundaryValue;
    };
  };

type StorageAdapter = {
  get: (key: string, fallback: BoundaryValue) => Promise<BoundaryValue>;
  set: (key: string, value: BoundaryValue) => Promise<void>;
};

type StorageAccessorOptions = {
  storageAdapter?: BoundaryValue;
};

type StorageAccessors = {
  storageGet: (key: string, fallback: BoundaryValue) => Promise<BoundaryValue>;
  storageSet: (key: string, value: BoundaryValue) => Promise<void>;
};

type BootstrapFinalizeRuntime = {
  processWatchlist: () => Promise<void>;
  startRouteWatcher: () => void;
  syncRoute: () => void;
  loadInitialState: () => Promise<void>;
  destroy: () => void;
  init: () => Promise<void>;
};

type BootstrapFinalizeOptions = {
  windowRef?: BoundaryValue;
  runtimeEvent?: BoundaryValue;
  runtimeLifecycleModule?: BoundaryValue;
  runtimeLifecycleOptions?: BoundaryValue;
  loadInitialState?: BoundaryValue;
  listKnownSeries?: BoundaryValue;
  getCuratedDomStats?: BoundaryValue;
  dumpSeriesApiData?: BoundaryValue;
  printSeriesApiData?: BoundaryValue;
};

type RuntimeLifecycle = {
  processWatchlist: () => Promise<void>;
  startRouteWatcher: () => void;
  stopRouteWatcher?: () => void;
  syncRoute: () => void;
  stopObserver?: () => void;
  unmount?: () => void;
};

type BootstrapDebugApiDependencies = {
  listKnownSeries: () => BoundaryList;
  getCuratedDomStats: () => BoundaryValue;
  dumpSeriesApiData: (query: BoundaryValue) => BoundaryValue;
  printSeriesApiData: (query: BoundaryValue) => BoundaryValue;
};

type BootstrapFinalizeLifecycleRuntime = Pick<
  BootstrapFinalizeRuntime,
  'processWatchlist' | 'startRouteWatcher' | 'syncRoute' | 'destroy'
>;

const root = (typeof window !== 'undefined' ? window : globalThis) as BootstrapWindow;

function toRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as BoundaryRecord;
}

function toBootstrapWindow(value: BoundaryValue): BootstrapWindow {
  if (value && typeof value === 'object') {
    return value as BootstrapWindow;
  }
  return root;
}

function toFunction<T>(value: BoundaryValue, fallback: T): T {
  return typeof value === 'function' ? (value as T) : fallback;
}

function safeJsonParse(value: BoundaryValue, fallback: BoundaryValue): BoundaryValue {
  if (typeof value !== 'string') {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function toStorageAdapter(value: BoundaryValue): StorageAdapter | null {
  const record = toRecord(value);
  if (typeof record.get !== 'function' || typeof record.set !== 'function') {
    return null;
  }

  return {
    get: record.get as StorageAdapter['get'],
    set: record.set as StorageAdapter['set'],
  };
}

function createStorageAccessors(options: StorageAccessorOptions = {}): StorageAccessors {
  const storageAdapter = toStorageAdapter(options.storageAdapter);
  if (!storageAdapter) {
    return {
      storageGet: async (_key: string, fallback: BoundaryValue) => fallback,
      storageSet: async () => {},
    };
  }

  return {
    storageGet: (key: string, fallback: BoundaryValue) => storageAdapter.get(key, fallback),
    storageSet: async (key: string, value: BoundaryValue) => {
      await storageAdapter.set(key, value);
    },
  };
}

function toRuntimeLifecycle(value: BoundaryValue): RuntimeLifecycle | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const runtime = value as Partial<RuntimeLifecycle>;
  if (
    typeof runtime.processWatchlist !== 'function' ||
    typeof runtime.startRouteWatcher !== 'function' ||
    typeof runtime.syncRoute !== 'function'
  ) {
    return null;
  }

  return runtime as RuntimeLifecycle;
}

function resolveBootstrapDebugApiDependencies(options: BootstrapFinalizeOptions): BootstrapDebugApiDependencies {
  const dumpSeriesApiData = toFunction<(query: BoundaryValue) => BoundaryValue>(
    options.dumpSeriesApiData,
    (query: BoundaryValue) => ({
      query: String(query || ''),
      error: 'Debug API unavailable.',
      availableSeries: [],
    }),
  );

  return {
    listKnownSeries: toFunction<() => BoundaryList>(options.listKnownSeries, () => []),
    getCuratedDomStats: toFunction<() => BoundaryValue>(options.getCuratedDomStats, () => ({
      counters: {
        created: 0,
        patched: 0,
        parked: 0,
        unparked: 0,
        disposed: 0,
        renderPasses: 0,
      },
      totalLifecycleMutations: 0,
      identityChurnRate: 0,
      watchHistoryPreloadAttempts: {
        totalAttempts: 0,
        byLocale: {},
        byLocaleRevision: {},
        lastAttempt: null,
      },
      perfDiagnostics: {
        routeObserverBatchesProcessed: 0,
        routeObserverBatchesIgnored: 0,
        routeStructureChecks: 0,
        routeStructureSyncs: 0,
        gridLayoutCacheHits: 0,
        gridLayoutCacheMisses: 0,
        retainedCardHideScheduled: 0,
        retainedCardHideCompleted: 0,
        localizedPreloadRenderRequestsQueued: 0,
        localizedPreloadRenderRequestsDeduped: 0,
      },
    })),
    dumpSeriesApiData,
    printSeriesApiData: toFunction<(query: BoundaryValue) => BoundaryValue>(
      options.printSeriesApiData,
      (query: BoundaryValue) => dumpSeriesApiData(query),
    ),
  };
}

function createLifecycleDestroyRuntime(lifecycle: RuntimeLifecycle): () => void {
  return () => {
    try {
      lifecycle.stopRouteWatcher?.();
    } catch {
      // no-op
    }
    try {
      lifecycle.stopObserver?.();
    } catch {
      // no-op
    }
    try {
      lifecycle.unmount?.();
    } catch {
      // no-op
    }
  };
}

function resolveBootstrapFinalizeLifecycleRuntime(
  options: BootstrapFinalizeOptions,
): BootstrapFinalizeLifecycleRuntime {
  let processWatchlist: () => Promise<void> = async () => {};
  let startRouteWatcher = () => {};
  let syncRoute = () => {};
  let destroy = () => {};
  const lifecycleFactory = toRecord(options.runtimeLifecycleModule).createRouteLifecycle;

  if (typeof lifecycleFactory !== 'function') {
    return { processWatchlist, startRouteWatcher, syncRoute, destroy };
  }

  try {
    const lifecycle = toRuntimeLifecycle(lifecycleFactory(toRecord(options.runtimeLifecycleOptions)));
    if (!lifecycle) {
      return { processWatchlist, startRouteWatcher, syncRoute, destroy };
    }

    processWatchlist = () => lifecycle.processWatchlist();
    startRouteWatcher = () => lifecycle.startRouteWatcher();
    syncRoute = () => lifecycle.syncRoute();
    destroy = createLifecycleDestroyRuntime(lifecycle);
  } catch (_) {
    // no-op
  }

  return { processWatchlist, startRouteWatcher, syncRoute, destroy };
}

function resolveBootstrapFinalizeStateLoader(options: BootstrapFinalizeOptions): () => Promise<void> {
  return toFunction<() => Promise<void>>(options.loadInitialState, async () => {});
}

function createBootstrapFinalizeRuntime(options: BootstrapFinalizeOptions = {}): BootstrapFinalizeRuntime {
  const windowRef = toBootstrapWindow(options.windowRef);
  const runtimeEvent = toFunction<(event: string, payload?: BoundaryValue) => void>(options.runtimeEvent, () => {});
  const { listKnownSeries, getCuratedDomStats, dumpSeriesApiData, printSeriesApiData } =
    resolveBootstrapDebugApiDependencies(options);
  const lifecycleRuntime = resolveBootstrapFinalizeLifecycleRuntime(options);
  const loadInitialState = resolveBootstrapFinalizeStateLoader(options);

  function exposeDebugApi(): void {
    windowRef.__CW_WATCHLIST_CURATOR_DEBUG__ = {
      listSeries: () => listKnownSeries(),
      getCuratedDomStats: () => getCuratedDomStats(),
      dumpSeriesApiData: (query: BoundaryValue) => dumpSeriesApiData(query),
      printSeriesApiData: (query: BoundaryValue) => printSeriesApiData(query),
    };
  }

  async function init(): Promise<void> {
    runtimeEvent('init-start');
    exposeDebugApi();
    await loadInitialState();
    lifecycleRuntime.startRouteWatcher();
    lifecycleRuntime.syncRoute();
    // Ensure the initial watchlist frame render executes deterministically on startup.
    await lifecycleRuntime.processWatchlist();
    runtimeEvent('init-done');
  }

  return {
    processWatchlist: () => lifecycleRuntime.processWatchlist(),
    startRouteWatcher: () => lifecycleRuntime.startRouteWatcher(),
    syncRoute: () => lifecycleRuntime.syncRoute(),
    loadInitialState: () => loadInitialState(),
    destroy: () => lifecycleRuntime.destroy(),
    init: () => init(),
  };
}

const runtimeBootstrapFinalize = {
  safeJsonParse,
  createStorageAccessors,
  createBootstrapFinalizeRuntime,
};

export function createBootstrapFinalizeRuntimeModule(): object {
  return runtimeBootstrapFinalize;
}
