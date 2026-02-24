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

  function ensureRootFrameInternal(context: InterfaceShellContext, rootElement: Element | null): void {
    if (!rootElement || !isElementWithDisplayState(rootElement)) {
      return
    }

    if (
      context.state.framedRootEl &&
      context.state.framedRootEl !== rootElement &&
      asRecord(context.state.framedRootEl).isConnected
    ) {
      context.state.framedRootEl.classList.remove('cw-watchlist-frame')
    }

    rootElement.classList.add('cw-watchlist-frame')
    context.state.framedRootEl = rootElement
  }

  function clearRootFrameInternal(context: InterfaceShellContext): void {
    if (context.state.framedRootEl && asRecord(context.state.framedRootEl).isConnected) {
      context.state.framedRootEl.classList.remove('cw-watchlist-frame')
    }
    context.state.framedRootEl = null
  }

  function restoreNativeVisibilityInternal(context: InterfaceShellContext, rootElement: Element): void {
    const flaggedNodes = Array.from(rootElement.querySelectorAll('[data-cw-prev-display]'))
    const restoreCandidates = new Set([...context.state.nativeHiddenNodes, ...flaggedNodes])

    restoreCandidates.forEach((node) => {
      if (!isElementWithDisplayState(node)) {
        return
      }
      if (asRecord(node).isConnected === false) {
        return
      }

      const previousDisplay = node.dataset.cwPrevDisplay
      node.style.display = previousDisplay != null ? previousDisplay : ''
      delete node.dataset.cwPrevDisplay
    })

    context.state.nativeHiddenNodes = []

    context.windowRef.requestAnimationFrame(() => {
      try {
        context.windowRef.dispatchEvent(new Event('resize'))
        context.windowRef.dispatchEvent(new Event('scroll'))
      } catch (_) {
        // no-op
      }
    })
  }

  function hideNativeVisibilityInternal(context: InterfaceShellContext, rootElement: Element): void {
    const children = Array.from(rootElement.children).filter((child) => child !== context.state.hostEl)
    context.state.nativeHiddenNodes = []

    children.forEach((node) => {
      if (!isElementWithDisplayState(node)) {
        return
      }
      if (!Object.hasOwn(node.dataset, 'cwPrevDisplay')) {
        node.dataset.cwPrevDisplay = node.style.display || ''
      }
      node.style.display = 'none'
      context.state.nativeHiddenNodes.push(node)
    })
  }

  function setNativeVisibilityInternal(context: InterfaceShellContext, showNative: boolean): void {
    const rootElement = context.getWatchlistRoot()
    if (!rootElement) {
      return
    }

    if (showNative) {
      restoreNativeVisibilityInternal(context, rootElement)
      return
    }

    hideNativeVisibilityInternal(context, rootElement)
  }

  function applyTabUiInternal(context: InterfaceShellContext): void {
    const tabCrunchyroll = context.state.tabCrunchyrollEl
    const tabCurated = context.state.tabCuratedEl
    const curatedPanel = context.state.curatedPanelEl

    if (!tabCrunchyroll || !tabCurated || !curatedPanel) {
      return
    }

    const curatedActive = context.state.settings.activeTab === 'curated'

    context.withMutedObserver(() => {
      tabCrunchyroll.setAttribute('aria-selected', curatedActive ? 'false' : 'true')
      tabCurated.setAttribute('aria-selected', curatedActive ? 'true' : 'false')
      tabCrunchyroll.classList.toggle('cw-tab--active', !curatedActive)
      tabCurated.classList.toggle('cw-tab--active', curatedActive)
      if (isElementWithDisplayState(curatedPanel)) {
        curatedPanel.style.display = curatedActive ? 'block' : 'none'
      }
    })

    setNativeVisibilityInternal(context, !curatedActive)
  }

  async function setActiveTabInternal(context: InterfaceShellContext, tabValue: string): Promise<void> {
    if (tabValue !== 'crunchyroll' && tabValue !== 'curated') {
      return
    }

    if (context.state.settings.activeTab === tabValue) {
      applyTabUiInternal(context)
      if (tabValue === 'curated') {
        context.renderCuratedPanel()
      }
      return
    }

    context.state.settings.activeTab = tabValue
    await context.persistSettings()
    applyTabUiInternal(context)

    if (tabValue === 'curated') {
      void context.ensureCuratedDataLoad(false)
      context.renderCuratedPanel()
    }

    context.debounceProcess()
  }

  async function resetCuratedCachesForRefreshInternal(context: InterfaceShellContext): Promise<void> {
    context.state.ratingCache = {}
    context.state.ratingInflight.clear()
    context.state.ratingLocalePreloadInflight.clear()
    context.state.watchHistoryLocalePreloadInflight.clear()
    context.state.watchHistoryCache = context.createEmptyWatchHistoryCache()
    context.state.watchHistoryStatus = 'idle'
    context.state.watchHistoryInflight = null
    await context.storageSet(context.ratingCacheKey, context.state.ratingCache)
    await context.storageSet(context.watchHistoryCacheKey, context.state.watchHistoryCache)
    context.state.curatedEntries = []
    context.state.curatedError = null
    context.state.curatedPendingRequests = []
  }

  function createTabButtonInternal(context: InterfaceShellContext, label: string, tabValue: string): HTMLButtonElement {
    const button = context.documentRef.createElement('button')
    button.type = 'button'
    button.className = 'cw-tab'
    button.textContent = label
    button.dataset.cwTab = tabValue
    return button
  }

  function createCuratedInterfaceTabsInternal(context: InterfaceShellContext) {
    const tabs = context.documentRef.createElement('div')
    tabs.className = 'cw-tabs'

    const tabCrunchyroll = createTabButtonInternal(context, 'Crunchyroll', 'crunchyroll')
    const tabCurated = createTabButtonInternal(context, 'Curated', 'curated')

    tabCrunchyroll.addEventListener('click', () => {
      void setActiveTabInternal(context, 'crunchyroll')
    })
    tabCurated.addEventListener('click', () => {
      void setActiveTabInternal(context, 'curated')
    })

    tabs.appendChild(tabCrunchyroll)
    tabs.appendChild(tabCurated)

    return {
      tabs,
      tabCrunchyroll,
      tabCurated,
    }
  }

  function ensureInterfaceInternal(context: InterfaceShellContext): void {
    const rootElement = context.getWatchlistRoot()
    const headerElement = context.getWatchlistHeader()
    if (!rootElement || !headerElement) {
      context.runtimeEvent('ui-missing-watchlist-structure')
      return
    }

    ensureRootFrameInternal(context, rootElement)

    if (context.state.hostEl && asRecord(context.state.hostEl).isConnected) {
      return
    }

    const host = context.documentRef.createElement('section')
    host.className = 'cw-host'

    const { tabs, tabCrunchyroll, tabCurated } = createCuratedInterfaceTabsInternal(context)
    const panel = context.documentRef.createElement('div')
    panel.className = 'cw-panel'
    const controlsContext = context.createCuratedInterfaceControls()
    context.bindCuratedInterfaceControls(controlsContext)
    const grid = context.documentRef.createElement('div')
    grid.className = 'cw-curated-grid'

    panel.appendChild(controlsContext.controls)
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
    applyTabUiInternal(context)
  }

  function createInterfaceShellRuntime(options: InterfaceShellOptions = {}): InterfaceShellRuntime {
    const context = createInterfaceShellContext(options)
    return {
      clearRootFrame: () => clearRootFrameInternal(context),
      setNativeVisibility: (showNative) => setNativeVisibilityInternal(context, showNative),
      applyTabUi: () => applyTabUiInternal(context),
      resetCuratedCachesForRefresh: () => resetCuratedCachesForRefreshInternal(context),
      ensureInterface: () => ensureInterfaceInternal(context),
    }
  }

  moduleRegistry.runtimeInterfaceShell = {
    createInterfaceShellRuntime,
  }
})()
