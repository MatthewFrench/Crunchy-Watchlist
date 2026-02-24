;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type RuntimeState = {
    mounted: boolean
    observer: MutationObserver | null
    routeWatcherStarted: boolean
    routeSyncTimer: number | null
    processTimer: number | null
    mutationMuted: boolean
    hostEl: Element | null
    tabCrunchyrollEl: Element | null
    tabCuratedEl: Element | null
    curatedPanelEl: Element | null
    controlsEl: Element | null
    loadingIndicatorEl: Element | null
    audioFilterSelectEl: Element | null
    genreFilterSelectEl: Element | null
    statsEl: Element | null
    gridEl: Element | null
    settings: Record<string, unknown>
    curatedObservedPromise: Promise<unknown> | null
  }

  type RouteLifecycleContext = {
    state: RuntimeState
    runtimeEvent: (event: string, data?: unknown) => void
    isWatchlistPath: (pathname: string) => boolean
    ensureInterface: () => void
    applyTabUi: () => void
    ensureCuratedDataLoad: (force: boolean) => Promise<unknown>
    renderCuratedPanel: () => void
    setNativeVisibility: (visible: boolean) => void
    clearRootFrame: () => void
    debounceProcess: () => void
  }

  type RouteLifecycleOptions = {
    state?: unknown
    runtimeEvent?: unknown
    isWatchlistPath?: unknown
    ensureInterface?: unknown
    applyTabUi?: unknown
    ensureCuratedDataLoad?: unknown
    renderCuratedPanel?: unknown
    setNativeVisibility?: unknown
    clearRootFrame?: unknown
    debounceProcess?: unknown
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing runtime lifecycle dependency: ${name}`)
    }

    return value as T
  }

  function createRouteLifecycleContext(options: RouteLifecycleOptions = {}): RouteLifecycleContext {
    const state = options.state && typeof options.state === 'object' ? (options.state as RuntimeState) : null
    if (!state) {
      throw new Error('[CW] Missing runtime lifecycle state')
    }

    return {
      state,
      runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as RouteLifecycleContext['runtimeEvent'],
      isWatchlistPath: requireFunction(
        'isWatchlistPath',
        options.isWatchlistPath,
      ) as RouteLifecycleContext['isWatchlistPath'],
      ensureInterface: requireFunction(
        'ensureInterface',
        options.ensureInterface,
      ) as RouteLifecycleContext['ensureInterface'],
      applyTabUi: requireFunction('applyTabUi', options.applyTabUi) as RouteLifecycleContext['applyTabUi'],
      ensureCuratedDataLoad: requireFunction(
        'ensureCuratedDataLoad',
        options.ensureCuratedDataLoad,
      ) as RouteLifecycleContext['ensureCuratedDataLoad'],
      renderCuratedPanel: requireFunction(
        'renderCuratedPanel',
        options.renderCuratedPanel,
      ) as RouteLifecycleContext['renderCuratedPanel'],
      setNativeVisibility: requireFunction(
        'setNativeVisibility',
        options.setNativeVisibility,
      ) as RouteLifecycleContext['setNativeVisibility'],
      clearRootFrame: requireFunction(
        'clearRootFrame',
        options.clearRootFrame,
      ) as RouteLifecycleContext['clearRootFrame'],
      debounceProcess: requireFunction(
        'debounceProcess',
        options.debounceProcess,
      ) as RouteLifecycleContext['debounceProcess'],
    }
  }

  async function processWatchlistInternal(context: RouteLifecycleContext): Promise<void> {
    if (!context.state.mounted || !context.isWatchlistPath(root.location.pathname)) {
      return
    }

    context.ensureInterface()
    context.applyTabUi()
    const loadPromise = context.ensureCuratedDataLoad(false)
    context.renderCuratedPanel()

    if (context.state.settings.activeTab !== 'curated') {
      return
    }

    await loadPromise
    context.renderCuratedPanel()
  }

  function startObserverInternal(context: RouteLifecycleContext): void {
    if (context.state.observer) {
      context.state.observer.disconnect()
      context.state.observer = null
    }

    const target = root.document.body || root.document.documentElement
    if (!target) {
      return
    }

    const observer = new MutationObserver((records) => {
      if (context.state.mutationMuted) {
        return
      }

      if (
        context.state.hostEl &&
        records.length > 0 &&
        records.every((record) => record.target instanceof Node && context.state.hostEl?.contains(record.target))
      ) {
        return
      }

      context.debounceProcess()
    })

    observer.observe(target, {
      childList: true,
      subtree: true,
    })

    context.state.observer = observer
    context.runtimeEvent('observer-started')
  }

  function stopObserverInternal(context: RouteLifecycleContext): void {
    if (context.state.observer) {
      context.state.observer.disconnect()
      context.state.observer = null
    }
  }

  function unmountInternal(context: RouteLifecycleContext): void {
    context.state.mounted = false
    stopObserverInternal(context)

    context.setNativeVisibility(true)
    context.clearRootFrame()

    if (context.state.hostEl?.isConnected) {
      context.state.hostEl.remove()
    }

    context.state.hostEl = null
    context.state.tabCrunchyrollEl = null
    context.state.tabCuratedEl = null
    context.state.curatedPanelEl = null
    context.state.controlsEl = null
    context.state.loadingIndicatorEl = null
    context.state.audioFilterSelectEl = null
    context.state.genreFilterSelectEl = null
    context.state.statsEl = null
    context.state.gridEl = null

    if (context.state.processTimer != null) {
      root.clearTimeout(context.state.processTimer)
    }
    context.state.processTimer = null
    context.state.curatedObservedPromise = null
  }

  function mountInternal(context: RouteLifecycleContext): void {
    if (context.state.mounted) {
      return
    }

    context.state.mounted = true
    context.runtimeEvent('mounted')
    startObserverInternal(context)
    context.debounceProcess()
  }

  function syncRouteInternal(context: RouteLifecycleContext): void {
    if (context.isWatchlistPath(root.location.pathname)) {
      mountInternal(context)
      context.debounceProcess()
      return
    }

    unmountInternal(context)
  }

  function scheduleRouteSyncInternal(context: RouteLifecycleContext): void {
    if (context.state.routeSyncTimer != null) {
      return
    }

    context.state.routeSyncTimer = root.setTimeout(() => {
      context.state.routeSyncTimer = null
      syncRouteInternal(context)
    }, 0)
  }

  function patchHistoryForRouteSyncInternal(context: RouteLifecycleContext): void {
    const historyRef = root.history as unknown as Record<string, unknown>
    if (!historyRef) {
      return
    }

    ;['pushState', 'replaceState'].forEach((methodName) => {
      const original = historyRef[methodName]
      if (typeof original !== 'function') {
        return
      }

      try {
        historyRef[methodName] = function patchedHistoryState(this: unknown, ...args: unknown[]) {
          const result = (original as (...innerArgs: unknown[]) => unknown).apply(this, args)
          scheduleRouteSyncInternal(context)
          return result
        }
      } catch (_error) {
        // Some browsers lock history methods. Popstate/hashchange still cover most navigation.
      }
    })
  }

  function startRouteWatcherInternal(context: RouteLifecycleContext): void {
    if (context.state.routeWatcherStarted) {
      return
    }

    context.state.routeWatcherStarted = true
    patchHistoryForRouteSyncInternal(context)
    root.addEventListener('popstate', () => {
      scheduleRouteSyncInternal(context)
    })
    root.addEventListener('hashchange', () => {
      scheduleRouteSyncInternal(context)
    })
    root.addEventListener('pageshow', () => {
      scheduleRouteSyncInternal(context)
    })
  }

  function createRouteLifecycle(options: RouteLifecycleOptions = {}) {
    const context = createRouteLifecycleContext(options)
    return {
      processWatchlist: () => processWatchlistInternal(context),
      startObserver: () => startObserverInternal(context),
      stopObserver: () => stopObserverInternal(context),
      mount: () => mountInternal(context),
      unmount: () => unmountInternal(context),
      syncRoute: () => syncRouteInternal(context),
      scheduleRouteSync: () => scheduleRouteSyncInternal(context),
      startRouteWatcher: () => startRouteWatcherInternal(context),
    }
  }

  moduleRegistry.runtimeLifecycle = {
    createRouteLifecycle,
  }
})()
