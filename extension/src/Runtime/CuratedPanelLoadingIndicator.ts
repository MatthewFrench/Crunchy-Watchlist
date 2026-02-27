;(() => {
  type RequestProgress = {
    started: number
    completed: number
    inProgress: number
  }

  type CuratedPanelLoadingIndicatorSyncOptions = {
    documentRef: Document
    loadingIndicatorEl: Element
    loading: boolean
    firstLoadInFlight: boolean
    pendingRequests: string[]
    requestProgress: RequestProgress
  }

  type CuratedPanelLoadingIndicatorRuntime = {
    syncLoadingIndicator: (options: CuratedPanelLoadingIndicatorSyncOptions) => void
  }

  type LoadingIndicatorDetailsNodes = {
    details: Element
    progress: Element
    requests: Element
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function hasClassToken(className: unknown, token: string): boolean {
    return (
      typeof className === 'string' &&
      className
        .split(' ')
        .map((item) => item.trim())
        .filter(Boolean)
        .includes(token)
    )
  }

  function getChildElements(element: Element): Element[] {
    const children = (element as Element & { children?: ArrayLike<Element> }).children
    if (!children) {
      return []
    }
    return Array.from(children)
  }

  function findElementByClassTokenWithin(rootElement: Element, classToken: string): Element | null {
    const searchable = rootElement as Element & {
      querySelector?: (selector: string) => Element | null
    }
    if (typeof searchable.querySelector === 'function') {
      const match = searchable.querySelector(`.${classToken}`)
      if (match) {
        return match
      }
    }

    const stack = getChildElements(rootElement)
    while (stack.length) {
      const next = stack.shift() as Element
      if (hasClassToken((next as Element & { className?: string }).className, classToken)) {
        return next
      }
      stack.push(...getChildElements(next))
    }

    return null
  }

  function removeNestedLoadingComponentDuplicates(loadingIndicatorEl: Element): void {
    const mutableIndicator = loadingIndicatorEl as Element & {
      removeChild?: (child: Element) => void
    }
    if (typeof mutableIndicator.removeChild !== 'function') {
      return
    }

    getChildElements(loadingIndicatorEl).forEach((child) => {
      const className = (child as Element & { className?: string }).className
      if (hasClassToken(className, 'cw-loading')) {
        mutableIndicator.removeChild?.(child)
      }
    })
  }

  function appendChildElement(parent: Element, child: Element): void {
    const mutableParent = parent as Element & {
      appendChild?: (child: Element) => unknown
    }
    mutableParent.appendChild?.(child)
  }

  function setElementDisplayStyle(element: Element, displayValue: string): void {
    const style = (element as Element & { style?: { display?: string } }).style
    if (!style) {
      return
    }
    style.display = displayValue
  }

  function setLoadingBoxVisibility(loadingIndicatorEl: Element, loading: boolean): void {
    const parent = (loadingIndicatorEl as Element & { parentNode?: unknown }).parentNode
    if (!parent || typeof parent !== 'object') {
      return
    }

    const parentElement = parent as Element & { className?: string }
    if (!hasClassToken(parentElement.className, 'cw-loading-box')) {
      return
    }

    setElementDisplayStyle(parentElement, loading ? 'block' : 'none')
  }

  function ensureLoadingIndicatorDetailsNodes(
    documentRef: Document,
    loadingIndicatorEl: Element,
  ): LoadingIndicatorDetailsNodes {
    let details = findElementByClassTokenWithin(loadingIndicatorEl, 'cw-loading__details')
    if (!details) {
      details = documentRef.createElement('span')
      details.className = 'cw-loading__details'

      const detailsTitle = documentRef.createElement('span')
      detailsTitle.className = 'cw-loading__details-title'
      detailsTitle.textContent = 'Request progress'
      appendChildElement(details, detailsTitle)

      appendChildElement(loadingIndicatorEl, details)
    }

    let progress = findElementByClassTokenWithin(details, 'cw-loading__progress')
    if (!progress) {
      progress = documentRef.createElement('span')
      progress.className = 'cw-loading__progress'
      appendChildElement(details, progress)
    }

    let requests = findElementByClassTokenWithin(details, 'cw-loading__requests')
    if (!requests) {
      requests = documentRef.createElement('ul')
      requests.className = 'cw-loading__requests'
      appendChildElement(details, requests)
    }

    return {
      details,
      progress,
      requests,
    }
  }

  function syncLoadingIndicatorDetails(
    documentRef: Document,
    loadingIndicatorEl: Element,
    loading: boolean,
    pendingRequests: string[],
    requestProgress: RequestProgress,
  ): void {
    removeNestedLoadingComponentDuplicates(loadingIndicatorEl)
    const { details, progress, requests } = ensureLoadingIndicatorDetailsNodes(documentRef, loadingIndicatorEl)

    const totalCount = Math.max(requestProgress.started, requestProgress.completed + requestProgress.inProgress)
    const showDetails = loading && (pendingRequests.length > 0 || totalCount > 0)

    setElementDisplayStyle(details, showDetails ? 'block' : 'none')
    if (!showDetails) {
      progress.textContent = ''
      requests.textContent = ''
      return
    }

    progress.textContent = `Completed ${requestProgress.completed} of ${totalCount} • In progress ${requestProgress.inProgress}`
    requests.textContent = ''
    pendingRequests.forEach((requestLabel) => {
      const requestItem = documentRef.createElement('li')
      requestItem.className = 'cw-loading__request'
      requestItem.textContent = requestLabel
      appendChildElement(requests, requestItem)
    })

    setElementDisplayStyle(requests, pendingRequests.length ? 'grid' : 'none')
  }

  function syncLoadingIndicator(options: CuratedPanelLoadingIndicatorSyncOptions): void {
    const { documentRef, loadingIndicatorEl, loading, firstLoadInFlight, pendingRequests, requestProgress } = options
    syncLoadingIndicatorDetails(documentRef, loadingIndicatorEl, loading, pendingRequests, requestProgress)
    setLoadingBoxVisibility(loadingIndicatorEl, firstLoadInFlight)
    setElementDisplayStyle(loadingIndicatorEl, firstLoadInFlight ? 'flex' : 'none')
  }

  function createCuratedPanelLoadingIndicatorRuntime(): CuratedPanelLoadingIndicatorRuntime {
    return {
      syncLoadingIndicator,
    }
  }

  moduleRegistry.runtimeCuratedPanelLoadingIndicator = {
    createCuratedPanelLoadingIndicatorRuntime,
  }
})()
