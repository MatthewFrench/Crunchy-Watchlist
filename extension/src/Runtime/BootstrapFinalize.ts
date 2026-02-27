;(() => {
  type BootstrapWindow = Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: Record<string, unknown>
      __CW_WATCHLIST_CURATOR_DEBUG__?: {
        listSeries: () => unknown
        dumpSeriesApiData: (query: unknown) => unknown
        printSeriesApiData: (query: unknown) => unknown
      }
    }

  type StorageAdapter = {
    get: (key: string, fallback: unknown) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
  }

  type StorageAccessorOptions = {
    storageAdapter?: unknown
  }

  type StorageAccessors = {
    storageGet: (key: string, fallback: unknown) => Promise<unknown>
    storageSet: (key: string, value: unknown) => Promise<void>
  }

  type BootstrapFinalizeRuntime = {
    processWatchlist: () => Promise<void>
    startRouteWatcher: () => void
    syncRoute: () => void
    loadInitialState: () => Promise<void>
    destroy: () => void
    init: () => Promise<void>
  }

  type BootstrapFinalizeOptions = {
    windowRef?: unknown
    runtimeEvent?: unknown
    runtimeLifecycleModule?: unknown
    runtimeLifecycleOptions?: unknown
    runtimeStateLoaderModule?: unknown
    runtimeStateLoaderOptions?: unknown
    listKnownSeries?: unknown
    dumpSeriesApiData?: unknown
    printSeriesApiData?: unknown
  }

  type RuntimeLifecycle = {
    processWatchlist: () => Promise<void>
    startRouteWatcher: () => void
    stopRouteWatcher?: () => void
    syncRoute: () => void
    stopObserver?: () => void
    unmount?: () => void
  }

  type StateLoader = {
    loadInitialState: () => Promise<void>
  }

  type BootstrapDebugApiDependencies = {
    listKnownSeries: () => unknown[]
    dumpSeriesApiData: (query: unknown) => unknown
    printSeriesApiData: (query: unknown) => unknown
  }

  type BootstrapFinalizeLifecycleRuntime = Pick<
    BootstrapFinalizeRuntime,
    'processWatchlist' | 'startRouteWatcher' | 'syncRoute' | 'destroy'
  >

  const root = (typeof window !== 'undefined' ? window : globalThis) as BootstrapWindow
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as Record<string, unknown>
  }

  function toBootstrapWindow(value: unknown): BootstrapWindow {
    if (value && typeof value === 'object') {
      return value as BootstrapWindow
    }
    return root
  }

  function toFunction<T>(value: unknown, fallback: T): T {
    return typeof value === 'function' ? (value as T) : fallback
  }

  function safeJsonParse(value: unknown, fallback: unknown): unknown {
    if (typeof value !== 'string') {
      return fallback
    }

    try {
      return JSON.parse(value)
    } catch (_) {
      return fallback
    }
  }

  function toStorageAdapter(value: unknown): StorageAdapter | null {
    const record = toRecord(value)
    if (typeof record.get !== 'function' || typeof record.set !== 'function') {
      return null
    }

    return {
      get: record.get as StorageAdapter['get'],
      set: record.set as StorageAdapter['set'],
    }
  }

  function createStorageAccessors(options: StorageAccessorOptions = {}): StorageAccessors {
    const storageAdapter = toStorageAdapter(options.storageAdapter)
    if (!storageAdapter) {
      return {
        storageGet: async (_key: string, fallback: unknown) => fallback,
        storageSet: async () => {},
      }
    }

    return {
      storageGet: (key: string, fallback: unknown) => storageAdapter.get(key, fallback),
      storageSet: async (key: string, value: unknown) => {
        await storageAdapter.set(key, value)
      },
    }
  }

  function toRuntimeLifecycle(value: unknown): RuntimeLifecycle | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const runtime = value as Partial<RuntimeLifecycle>
    if (
      typeof runtime.processWatchlist !== 'function' ||
      typeof runtime.startRouteWatcher !== 'function' ||
      typeof runtime.syncRoute !== 'function'
    ) {
      return null
    }

    return runtime as RuntimeLifecycle
  }

  function toStateLoader(value: unknown): StateLoader | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const runtime = value as Partial<StateLoader>
    if (typeof runtime.loadInitialState !== 'function') {
      return null
    }

    return runtime as StateLoader
  }

  function resolveBootstrapDebugApiDependencies(options: BootstrapFinalizeOptions): BootstrapDebugApiDependencies {
    const dumpSeriesApiData = toFunction<(query: unknown) => unknown>(options.dumpSeriesApiData, (query: unknown) => ({
      query: String(query || ''),
      error: 'Debug API unavailable.',
      availableSeries: [],
    }))

    return {
      listKnownSeries: toFunction<() => unknown[]>(options.listKnownSeries, () => []),
      dumpSeriesApiData,
      printSeriesApiData: toFunction<(query: unknown) => unknown>(options.printSeriesApiData, (query: unknown) =>
        dumpSeriesApiData(query),
      ),
    }
  }

  function createLifecycleDestroyRuntime(lifecycle: RuntimeLifecycle): () => void {
    return () => {
      try {
        lifecycle.stopRouteWatcher?.()
      } catch {
        // no-op
      }
      try {
        lifecycle.stopObserver?.()
      } catch {
        // no-op
      }
      try {
        lifecycle.unmount?.()
      } catch {
        // no-op
      }
    }
  }

  function resolveBootstrapFinalizeLifecycleRuntime(
    options: BootstrapFinalizeOptions,
  ): BootstrapFinalizeLifecycleRuntime {
    let processWatchlist: () => Promise<void> = async () => {}
    let startRouteWatcher = () => {}
    let syncRoute = () => {}
    let destroy = () => {}
    const lifecycleFactory = toRecord(options.runtimeLifecycleModule).createRouteLifecycle

    if (typeof lifecycleFactory !== 'function') {
      return { processWatchlist, startRouteWatcher, syncRoute, destroy }
    }

    try {
      const lifecycle = toRuntimeLifecycle(lifecycleFactory(toRecord(options.runtimeLifecycleOptions)))
      if (!lifecycle) {
        return { processWatchlist, startRouteWatcher, syncRoute, destroy }
      }

      processWatchlist = () => lifecycle.processWatchlist()
      startRouteWatcher = () => lifecycle.startRouteWatcher()
      syncRoute = () => lifecycle.syncRoute()
      destroy = createLifecycleDestroyRuntime(lifecycle)
    } catch (_) {
      // no-op
    }

    return { processWatchlist, startRouteWatcher, syncRoute, destroy }
  }

  function resolveBootstrapFinalizeStateLoader(options: BootstrapFinalizeOptions): () => Promise<void> {
    let loadInitialState: () => Promise<void> = async () => {}
    const stateLoaderFactory = toRecord(options.runtimeStateLoaderModule).createStateLoader

    if (typeof stateLoaderFactory !== 'function') {
      return loadInitialState
    }

    try {
      const stateLoader = toStateLoader(stateLoaderFactory(toRecord(options.runtimeStateLoaderOptions)))
      if (stateLoader) {
        loadInitialState = () => stateLoader.loadInitialState()
      }
    } catch (_) {
      // no-op
    }

    return loadInitialState
  }

  function createBootstrapFinalizeRuntime(options: BootstrapFinalizeOptions = {}): BootstrapFinalizeRuntime {
    const windowRef = toBootstrapWindow(options.windowRef)
    const runtimeEvent = toFunction<(event: string, payload?: unknown) => void>(options.runtimeEvent, () => {})
    const { listKnownSeries, dumpSeriesApiData, printSeriesApiData } = resolveBootstrapDebugApiDependencies(options)
    const lifecycleRuntime = resolveBootstrapFinalizeLifecycleRuntime(options)
    const loadInitialState = resolveBootstrapFinalizeStateLoader(options)

    function exposeDebugApi(): void {
      windowRef.__CW_WATCHLIST_CURATOR_DEBUG__ = {
        listSeries: () => listKnownSeries(),
        dumpSeriesApiData: (query: unknown) => dumpSeriesApiData(query),
        printSeriesApiData: (query: unknown) => printSeriesApiData(query),
      }
    }

    async function init(): Promise<void> {
      runtimeEvent('init-start')
      exposeDebugApi()
      await loadInitialState()
      lifecycleRuntime.startRouteWatcher()
      lifecycleRuntime.syncRoute()
      runtimeEvent('init-done')
    }

    return {
      processWatchlist: () => lifecycleRuntime.processWatchlist(),
      startRouteWatcher: () => lifecycleRuntime.startRouteWatcher(),
      syncRoute: () => lifecycleRuntime.syncRoute(),
      loadInitialState: () => loadInitialState(),
      destroy: () => lifecycleRuntime.destroy(),
      init: () => init(),
    }
  }

  moduleRegistry.runtimeBootstrapFinalize = {
    safeJsonParse,
    createStorageAccessors,
    createBootstrapFinalizeRuntime,
  }
})()
