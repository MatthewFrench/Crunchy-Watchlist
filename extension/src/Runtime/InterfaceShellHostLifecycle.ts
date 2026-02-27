;(() => {
  type LooseRecord = Record<string, unknown>

  type RuntimeStateLike = {
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
  }

  type InterfaceShellHostLifecycleContextLike = {
    state: RuntimeStateLike
    windowRef: Window
    getWatchlistRoot: () => Element | null
  }

  type InterfaceShellHostLifecycleRuntime = {
    isConnectedElement: (value: unknown) => value is Element
    clearInterfaceReferences: (context: InterfaceShellHostLifecycleContextLike) => void
    resetInterfaceShell: (context: InterfaceShellHostLifecycleContextLike, removeHost: boolean) => void
    isInterfaceShellIntact: (context: InterfaceShellHostLifecycleContextLike) => boolean
    ensureRootFrame: (context: InterfaceShellHostLifecycleContextLike, rootElement: Element | null) => void
    clearRootFrame: (context: InterfaceShellHostLifecycleContextLike) => void
    setNativeVisibility: (context: InterfaceShellHostLifecycleContextLike, showNative: boolean) => void
    restoreActiveCuratedHostVisibility: (context: InterfaceShellHostLifecycleContextLike) => void
    removeOrphanCuratedHosts: (context: InterfaceShellHostLifecycleContextLike, rootElement: Element) => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord
    }
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function asRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object') {
      return {}
    }
    return value as LooseRecord
  }

  function isElementWithDisplayState(value: unknown): value is HTMLElement {
    if (!value || typeof value !== 'object') {
      return false
    }
    const record = value as LooseRecord
    return (
      typeof record.style === 'object' &&
      record.style != null &&
      typeof record.dataset === 'object' &&
      record.dataset != null &&
      typeof record.classList === 'object'
    )
  }

  function isConnectedElement(value: unknown): value is Element {
    return Boolean(value && typeof value === 'object' && asRecord(value).isConnected === true)
  }

  function isCuratedHostElement(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false
    }
    const element = value as Element
    return Boolean(
      element.classList && typeof element.classList.contains === 'function' && element.classList.contains('cw-host'),
    )
  }

  function clearPreviousDisplayMarker(node: Element): void {
    if (!isElementWithDisplayState(node)) {
      return
    }
    if (!Object.hasOwn(node.dataset, 'cwPrevDisplay')) {
      return
    }
    node.style.display = node.dataset.cwPrevDisplay != null ? node.dataset.cwPrevDisplay : ''
    delete node.dataset.cwPrevDisplay
  }

  function restoreActiveCuratedHostVisibility(context: InterfaceShellHostLifecycleContextLike): void {
    const hostElement = context.state.hostEl
    if (!isElementWithDisplayState(hostElement)) {
      return
    }

    clearPreviousDisplayMarker(hostElement)
    if (hostElement.style.display === 'none') {
      hostElement.style.display = ''
    }
  }

  function removeOrphanCuratedHosts(context: InterfaceShellHostLifecycleContextLike, rootElement: Element): void {
    const children = Array.from(rootElement.children)
    children.forEach((child) => {
      if (!isCuratedHostElement(child)) {
        return
      }
      if (child === context.state.hostEl) {
        return
      }
      child.remove()
    })
  }

  function clearInterfaceReferences(context: InterfaceShellHostLifecycleContextLike): void {
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
    context.state.curatedGridRenderSignature = ''
  }

  function resetInterfaceShell(context: InterfaceShellHostLifecycleContextLike, removeHost: boolean): void {
    if (removeHost && isConnectedElement(context.state.hostEl)) {
      context.state.hostEl.remove()
    }
    clearInterfaceReferences(context)
  }

  function isConnectedHostDescendant(host: Element, candidate: unknown): boolean {
    if (!isConnectedElement(candidate)) {
      return false
    }
    if (typeof host.contains !== 'function') {
      return true
    }
    return host.contains(candidate)
  }

  function isInterfaceShellIntact(context: InterfaceShellHostLifecycleContextLike): boolean {
    const hostElement = context.state.hostEl
    if (!isConnectedElement(hostElement)) {
      return false
    }

    return (
      isConnectedHostDescendant(hostElement, context.state.tabCrunchyrollEl) &&
      isConnectedHostDescendant(hostElement, context.state.tabCuratedEl) &&
      isConnectedHostDescendant(hostElement, context.state.curatedPanelEl) &&
      isConnectedHostDescendant(hostElement, context.state.controlsEl) &&
      isConnectedHostDescendant(hostElement, context.state.loadingIndicatorEl) &&
      isConnectedHostDescendant(hostElement, context.state.audioFilterSelectEl) &&
      isConnectedHostDescendant(hostElement, context.state.genreFilterSelectEl) &&
      isConnectedHostDescendant(hostElement, context.state.statsEl) &&
      isConnectedHostDescendant(hostElement, context.state.gridEl)
    )
  }

  function ensureRootFrame(context: InterfaceShellHostLifecycleContextLike, rootElement: Element | null): void {
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

  function clearRootFrame(context: InterfaceShellHostLifecycleContextLike): void {
    if (context.state.framedRootEl && asRecord(context.state.framedRootEl).isConnected) {
      context.state.framedRootEl.classList.remove('cw-watchlist-frame')
    }
    context.state.framedRootEl = null
  }

  function restoreNativeVisibility(context: InterfaceShellHostLifecycleContextLike, rootElement: Element): void {
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

  function hideNativeVisibility(context: InterfaceShellHostLifecycleContextLike, rootElement: Element): void {
    const children = Array.from(rootElement.children).filter((child) => child !== context.state.hostEl)
    context.state.nativeHiddenNodes = []

    children.forEach((node) => {
      if (isCuratedHostElement(node)) {
        clearPreviousDisplayMarker(node)
        if (isElementWithDisplayState(node) && node.style.display === 'none') {
          node.style.display = ''
        }
        return
      }
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

  function setNativeVisibility(context: InterfaceShellHostLifecycleContextLike, showNative: boolean): void {
    const rootElement = context.getWatchlistRoot()
    if (!rootElement) {
      return
    }

    if (showNative) {
      restoreNativeVisibility(context, rootElement)
      return
    }

    hideNativeVisibility(context, rootElement)
  }

  function createInterfaceShellHostLifecycleRuntime(): InterfaceShellHostLifecycleRuntime {
    return {
      isConnectedElement: (value) => isConnectedElement(value),
      clearInterfaceReferences: (context) => clearInterfaceReferences(context),
      resetInterfaceShell: (context, removeHost) => resetInterfaceShell(context, removeHost),
      isInterfaceShellIntact: (context) => isInterfaceShellIntact(context),
      ensureRootFrame: (context, rootElement) => ensureRootFrame(context, rootElement),
      clearRootFrame: (context) => clearRootFrame(context),
      setNativeVisibility: (context, showNative) => setNativeVisibility(context, showNative),
      restoreActiveCuratedHostVisibility: (context) => restoreActiveCuratedHostVisibility(context),
      removeOrphanCuratedHosts: (context, rootElement) => removeOrphanCuratedHosts(context, rootElement),
    }
  }

  moduleRegistry.runtimeInterfaceShellHostLifecycle = {
    createInterfaceShellHostLifecycleRuntime,
  }
})()
