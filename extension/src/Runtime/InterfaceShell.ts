;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type RuntimeState = {
    framedRootEl: Element | null
    nativeHiddenNodes: Element[]
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
    curatedGridRenderSignature: string
    settings: Record<string, unknown>
    ratingCache: Record<string, unknown>
    ratingInflight: Map<string, Promise<unknown>>
    ratingLocalePreloadInflight: Map<string, Promise<unknown>>
    watchHistoryLocalePreloadInflight: Map<string, Promise<unknown>>
    watchHistoryCache: unknown
    watchHistoryStatus: string
    watchHistoryInflight: Promise<unknown> | null
    curatedEntries: unknown[]
    curatedError: unknown
    curatedPendingRequests: string[]
    curatedPendingRequestStartedCount: number
    curatedPendingRequestCompletedCount: number
  }

  type SelectControl = {
    select: Element
  }

  type ControlsContext = {
    controls: Element
    loadingIndicator: Element
    audioFilterControl: SelectControl
    genreFilterControl: SelectControl
    stats: Element
  }

  type InterfaceShellContext = {
    state: RuntimeState
    documentRef: Document
    windowRef: Window
    getWatchlistRoot: () => Element | null
    getWatchlistHeader: () => Element | null
    runtimeEvent: (event: string, data?: unknown) => void
    withMutedObserver: (work: () => void) => void
    persistSettings: () => Promise<unknown>
    applyCardLayoutUi: () => void
    createCuratedInterfaceControls: () => ControlsContext
    bindCuratedInterfaceControls: (context: ControlsContext) => void
    ensureCuratedDataLoad: (force: boolean) => Promise<unknown>
    renderCuratedPanel: () => void
    debounceProcess: () => void
    createEmptyWatchHistoryCache: () => unknown
    storageSet: (key: string, value: unknown) => Promise<unknown>
    ratingCacheKey: string
    watchHistoryCacheKey: string
  }

  type InterfaceShellOptions = {
    state?: unknown
    documentRef?: unknown
    windowRef?: unknown
    getWatchlistRoot?: unknown
    getWatchlistHeader?: unknown
    runtimeEvent?: unknown
    withMutedObserver?: unknown
    persistSettings?: unknown
    applyCardLayoutUi?: unknown
    createCuratedInterfaceControls?: unknown
    bindCuratedInterfaceControls?: unknown
    ensureCuratedDataLoad?: unknown
    renderCuratedPanel?: unknown
    debounceProcess?: unknown
    createEmptyWatchHistoryCache?: unknown
    storageSet?: unknown
    ratingCacheKey?: unknown
    watchHistoryCacheKey?: unknown
  }

  type InterfaceShellRuntime = {
    clearRootFrame: () => void
    setNativeVisibility: (showNative: boolean) => void
    applyTabUi: () => void
    resetCuratedCachesForRefresh: () => Promise<void>
    ensureInterface: () => void
  }

  type InterfaceShellCoreDependencies = Pick<
    InterfaceShellContext,
    'state' | 'documentRef' | 'windowRef' | 'ratingCacheKey' | 'watchHistoryCacheKey'
  >

  type InterfaceShellFunctionDependencies = Omit<
    InterfaceShellContext,
    'state' | 'documentRef' | 'windowRef' | 'ratingCacheKey' | 'watchHistoryCacheKey'
  >

  type InterfaceShellHostLifecycleRuntime = {
    isConnectedElement: (value: unknown) => value is Element
    clearInterfaceReferences: (context: InterfaceShellContext) => void
    resetInterfaceShell: (context: InterfaceShellContext, removeHost: boolean) => void
    isInterfaceShellIntact: (context: InterfaceShellContext) => boolean
    ensureRootFrame: (context: InterfaceShellContext, rootElement: Element | null) => void
    clearRootFrame: (context: InterfaceShellContext) => void
    setNativeVisibility: (context: InterfaceShellContext, showNative: boolean) => void
    restoreActiveCuratedHostVisibility: (context: InterfaceShellContext) => void
    removeOrphanCuratedHosts: (context: InterfaceShellContext, rootElement: Element) => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing interface shell dependency: ${name}`)
    }
    return value as T
  }

  function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {}
    }
    return value as Record<string, unknown>
  }

  function asRuntimeState(value: unknown): RuntimeState | null {
    if (!value || typeof value !== 'object') {
      return null
    }
    return value as RuntimeState
  }

  function resolveDocumentRef(value: unknown): Document | null {
    if (!value || typeof value !== 'object') {
      return null
    }
    if (typeof (value as Document).createElement !== 'function') {
      return null
    }
    return value as Document
  }

  function resolveWindowRef(value: unknown): Window | null {
    if (!value || typeof value !== 'object') {
      return null
    }
    const record = value as Record<string, unknown>
    if (typeof record.requestAnimationFrame !== 'function') {
      return null
    }
    if (typeof record.dispatchEvent !== 'function') {
      return null
    }
    return value as Window
  }

  function requireStorageKey(options: InterfaceShellOptions, key: 'ratingCacheKey' | 'watchHistoryCacheKey'): string {
    const value = typeof options[key] === 'string' ? options[key] : ''
    if (!value) {
      throw new Error(`[CW] Missing interface shell ${key}`)
    }
    return value
  }

  function resolveInterfaceShellCoreDependencies(options: InterfaceShellOptions): InterfaceShellCoreDependencies {
    const state = asRuntimeState(options.state)
    if (!state) {
      throw new Error('[CW] Missing interface shell state')
    }

    const documentRef = resolveDocumentRef(options.documentRef)
    if (!documentRef) {
      throw new Error('[CW] Missing interface shell documentRef')
    }

    const windowRef = resolveWindowRef(options.windowRef)
    if (!windowRef) {
      throw new Error('[CW] Missing interface shell windowRef')
    }

    return {
      state,
      documentRef,
      windowRef,
      ratingCacheKey: requireStorageKey(options, 'ratingCacheKey'),
      watchHistoryCacheKey: requireStorageKey(options, 'watchHistoryCacheKey'),
    }
  }

  function resolveInterfaceShellFunctionDependencies(
    options: InterfaceShellOptions,
  ): InterfaceShellFunctionDependencies {
    return {
      getWatchlistRoot: requireFunction(
        'getWatchlistRoot',
        options.getWatchlistRoot,
      ) as InterfaceShellContext['getWatchlistRoot'],
      getWatchlistHeader: requireFunction(
        'getWatchlistHeader',
        options.getWatchlistHeader,
      ) as InterfaceShellContext['getWatchlistHeader'],
      runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as InterfaceShellContext['runtimeEvent'],
      withMutedObserver: requireFunction(
        'withMutedObserver',
        options.withMutedObserver,
      ) as InterfaceShellContext['withMutedObserver'],
      persistSettings: requireFunction(
        'persistSettings',
        options.persistSettings,
      ) as InterfaceShellContext['persistSettings'],
      applyCardLayoutUi: requireFunction(
        'applyCardLayoutUi',
        options.applyCardLayoutUi,
      ) as InterfaceShellContext['applyCardLayoutUi'],
      createCuratedInterfaceControls: requireFunction(
        'createCuratedInterfaceControls',
        options.createCuratedInterfaceControls,
      ) as InterfaceShellContext['createCuratedInterfaceControls'],
      bindCuratedInterfaceControls: requireFunction(
        'bindCuratedInterfaceControls',
        options.bindCuratedInterfaceControls,
      ) as InterfaceShellContext['bindCuratedInterfaceControls'],
      ensureCuratedDataLoad: requireFunction(
        'ensureCuratedDataLoad',
        options.ensureCuratedDataLoad,
      ) as InterfaceShellContext['ensureCuratedDataLoad'],
      renderCuratedPanel: requireFunction(
        'renderCuratedPanel',
        options.renderCuratedPanel,
      ) as InterfaceShellContext['renderCuratedPanel'],
      debounceProcess: requireFunction(
        'debounceProcess',
        options.debounceProcess,
      ) as InterfaceShellContext['debounceProcess'],
      createEmptyWatchHistoryCache: requireFunction(
        'createEmptyWatchHistoryCache',
        options.createEmptyWatchHistoryCache,
      ) as InterfaceShellContext['createEmptyWatchHistoryCache'],
      storageSet: requireFunction('storageSet', options.storageSet) as InterfaceShellContext['storageSet'],
    }
  }

  function createInterfaceShellContext(options: InterfaceShellOptions = {}): InterfaceShellContext {
    return {
      ...resolveInterfaceShellCoreDependencies(options),
      ...resolveInterfaceShellFunctionDependencies(options),
    }
  }

  function createInterfaceShellHostLifecycleRuntime(): InterfaceShellHostLifecycleRuntime {
    const hostLifecycleModule = asRecord(moduleRegistry.runtimeInterfaceShellHostLifecycle)
    return requireFunction<() => InterfaceShellHostLifecycleRuntime>(
      'createInterfaceShellHostLifecycleRuntime',
      hostLifecycleModule.createInterfaceShellHostLifecycleRuntime,
    )()
  }

  function isElementWithDisplayState(value: unknown): value is HTMLElement {
    if (!value || typeof value !== 'object') {
      return false
    }
    const record = value as Record<string, unknown>
    return (
      typeof record.style === 'object' &&
      record.style != null &&
      typeof record.dataset === 'object' &&
      record.dataset != null &&
      typeof record.classList === 'object'
    )
  }

  function setNativeVisibilityInternal(
    context: InterfaceShellContext,
    hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
    showNative: boolean,
  ): void {
    hostLifecycleRuntime.setNativeVisibility(context, showNative)
  }

  function clearRootFrameInternal(
    context: InterfaceShellContext,
    hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
  ): void {
    hostLifecycleRuntime.clearRootFrame(context)
  }

  function applyTabUiInternal(
    context: InterfaceShellContext,
    hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
  ): void {
    const tabCrunchyroll = context.state.tabCrunchyrollEl
    const tabCurated = context.state.tabCuratedEl
    const curatedPanel = context.state.curatedPanelEl

    if (!tabCrunchyroll || !tabCurated || !curatedPanel) {
      return
    }

    const curatedActive = context.state.settings.activeTab === 'curated'
    if (curatedActive) {
      hostLifecycleRuntime.restoreActiveCuratedHostVisibility(context)
    }

    context.withMutedObserver(() => {
      tabCrunchyroll.setAttribute('aria-selected', curatedActive ? 'false' : 'true')
      tabCurated.setAttribute('aria-selected', curatedActive ? 'true' : 'false')
      tabCrunchyroll.classList.toggle('cw-tab--active', !curatedActive)
      tabCurated.classList.toggle('cw-tab--active', curatedActive)
      if (isElementWithDisplayState(curatedPanel)) {
        curatedPanel.style.display = curatedActive ? 'block' : 'none'
      }
    })

    setNativeVisibilityInternal(context, hostLifecycleRuntime, !curatedActive)
  }

  async function setActiveTabInternal(
    context: InterfaceShellContext,
    hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
    tabValue: string,
  ): Promise<void> {
    if (tabValue !== 'crunchyroll' && tabValue !== 'curated') {
      return
    }

    if (context.state.settings.activeTab === tabValue) {
      applyTabUiInternal(context, hostLifecycleRuntime)
      if (tabValue === 'curated') {
        context.renderCuratedPanel()
      }
      return
    }

    context.state.settings.activeTab = tabValue
    await context.persistSettings()
    applyTabUiInternal(context, hostLifecycleRuntime)

    if (tabValue === 'curated') {
      void context.ensureCuratedDataLoad(false)
      context.renderCuratedPanel()
    }

    context.debounceProcess()
  }

  async function resetCuratedCachesForRefreshInternal(context: InterfaceShellContext): Promise<void> {
    // Manual refresh uses stale-while-revalidate semantics:
    // keep cached cards visible and only reset transient request diagnostics.
    context.state.curatedError = null
    context.state.curatedPendingRequests = []
    context.state.curatedPendingRequestStartedCount = 0
    context.state.curatedPendingRequestCompletedCount = 0
  }

  function createTabButtonInternal(context: InterfaceShellContext, label: string, tabValue: string): HTMLButtonElement {
    const button = context.documentRef.createElement('button')
    button.type = 'button'
    button.className = 'cw-tab'
    button.textContent = label
    button.dataset.cwTab = tabValue
    return button
  }

  function createCuratedInterfaceTabsInternal(
    context: InterfaceShellContext,
    hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
  ) {
    const tabs = context.documentRef.createElement('div')
    tabs.className = 'cw-tabs'

    const tabCrunchyroll = createTabButtonInternal(context, 'Crunchyroll', 'crunchyroll')
    const tabCurated = createTabButtonInternal(context, 'Curated', 'curated')

    tabCrunchyroll.addEventListener('click', () => {
      void setActiveTabInternal(context, hostLifecycleRuntime, 'crunchyroll')
    })
    tabCurated.addEventListener('click', () => {
      void setActiveTabInternal(context, hostLifecycleRuntime, 'curated')
    })

    tabs.appendChild(tabCrunchyroll)
    tabs.appendChild(tabCurated)

    return {
      tabs,
      tabCrunchyroll,
      tabCurated,
    }
  }

  function ensureInterfaceInternal(
    context: InterfaceShellContext,
    hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
  ): void {
    const rootElement = context.getWatchlistRoot()
    const headerElement = context.getWatchlistHeader()
    if (!rootElement || !headerElement) {
      // During SPA churn Crunchyroll can temporarily replace watchlist nodes; fall back to native content
      // so users do not get stuck in an empty framed shell while structure reattaches.
      setNativeVisibilityInternal(context, hostLifecycleRuntime, true)
      clearRootFrameInternal(context, hostLifecycleRuntime)
      if (!hostLifecycleRuntime.isConnectedElement(context.state.hostEl)) {
        hostLifecycleRuntime.clearInterfaceReferences(context)
      }
      context.runtimeEvent('ui-missing-watchlist-structure')
      return
    }

    hostLifecycleRuntime.ensureRootFrame(context, rootElement)
    hostLifecycleRuntime.removeOrphanCuratedHosts(context, rootElement)

    if (hostLifecycleRuntime.isInterfaceShellIntact(context)) {
      return
    }

    if (context.state.hostEl) {
      context.runtimeEvent('ui-shell-repair', {
        reason: hostLifecycleRuntime.isConnectedElement(context.state.hostEl)
          ? 'invalid-structure'
          : 'disconnected-host',
      })
      hostLifecycleRuntime.resetInterfaceShell(context, true)
    } else {
      hostLifecycleRuntime.clearInterfaceReferences(context)
    }

    const host = context.documentRef.createElement('section')
    host.className = 'cw-host'

    const { tabs, tabCrunchyroll, tabCurated } = createCuratedInterfaceTabsInternal(context, hostLifecycleRuntime)
    const panel = context.documentRef.createElement('div')
    panel.className = 'cw-panel'
    const controlsContext = context.createCuratedInterfaceControls()
    context.bindCuratedInterfaceControls(controlsContext)
    const loadingBox = context.documentRef.createElement('div')
    loadingBox.className = 'cw-empty cw-loading-box'
    if (loadingBox.style) {
      loadingBox.style.display = 'none'
    }

    const loadingBoxTitle = context.documentRef.createElement('div')
    loadingBoxTitle.className = 'cw-loading-box__title'
    loadingBoxTitle.textContent = 'Loading watchlist results...'

    loadingBox.appendChild(loadingBoxTitle)
    loadingBox.appendChild(controlsContext.loadingIndicator)

    const grid = context.documentRef.createElement('div')
    grid.className = 'cw-curated-grid'

    panel.appendChild(controlsContext.controls)
    panel.appendChild(loadingBox)
    panel.appendChild(grid)
    host.appendChild(tabs)
    host.appendChild(panel)
    headerElement.insertAdjacentElement('beforebegin', host)

    context.state.hostEl = host
    context.state.tabCrunchyrollEl = tabCrunchyroll
    context.state.tabCuratedEl = tabCurated
    context.state.curatedPanelEl = panel
    context.state.controlsEl = controlsContext.controls
    context.state.loadingIndicatorEl = controlsContext.loadingIndicator
    context.state.audioFilterSelectEl = controlsContext.audioFilterControl.select
    context.state.genreFilterSelectEl = controlsContext.genreFilterControl.select
    context.state.statsEl = controlsContext.stats
    context.state.gridEl = grid
    context.state.curatedGridRenderSignature = ''

    context.runtimeEvent('ui-mounted', {
      headerClass: String(headerElement.className || ''),
    })

    context.applyCardLayoutUi()
    applyTabUiInternal(context, hostLifecycleRuntime)
  }

  function createInterfaceShellRuntime(options: InterfaceShellOptions = {}): InterfaceShellRuntime {
    const context = createInterfaceShellContext(options)
    const hostLifecycleRuntime = createInterfaceShellHostLifecycleRuntime()
    return {
      clearRootFrame: () => clearRootFrameInternal(context, hostLifecycleRuntime),
      setNativeVisibility: (showNative) => setNativeVisibilityInternal(context, hostLifecycleRuntime, showNative),
      applyTabUi: () => applyTabUiInternal(context, hostLifecycleRuntime),
      resetCuratedCachesForRefresh: () => resetCuratedCachesForRefreshInternal(context),
      ensureInterface: () => ensureInterfaceInternal(context, hostLifecycleRuntime),
    }
  }

  moduleRegistry.runtimeInterfaceShell = {
    createInterfaceShellRuntime,
  }
})()
