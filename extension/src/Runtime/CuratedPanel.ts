;(() => {
  type RenderableResult = {
    mode: 'none' | 'dim' | 'hide' | 'hide_not_started'
    total: number
    visible: Array<Record<string, unknown>>
    audioOptions: Array<{ optionValue: string; title: string }>
    genreOptions: Array<{ optionValue: string; title: string }>
    selectedAudioFilter: string
    selectedGenreFilter: string
  }

  type RuntimeState = {
    mounted: boolean
    curatedError: unknown
    curatedEntries: unknown[]
    curatedInflight: Promise<unknown> | null
    curatedInitialLoadDone?: boolean
    curatedPendingRequests: string[]
    curatedPendingRequestStartedCount: number
    curatedPendingRequestCompletedCount: number
    curatedGridRenderSignature: string
    gridEl: (Element & { textContent: string | null }) | null
    statsEl: (Element & { textContent: string | null }) | null
    loadingIndicatorEl: (Element & { style?: Record<string, string> }) | null
    audioFilterSelectEl: Element | null
    genreFilterSelectEl: Element | null
    settings: Record<string, unknown>
  }

  type RequestProgress = {
    started: number
    completed: number
    inProgress: number
  }

  type FavoriteButtonLike = Element & {
    className?: string
    textContent: string | null
    title?: string
    setAttribute?: (name: string, value: string) => void
  }

  type RectSnapshot = {
    left: number
    top: number
    width: number
    height: number
  }

  type LeavingCardSnapshot = {
    card: Element
    rect: RectSnapshot
  }

  type CuratedPanelContext = {
    state: RuntimeState
    documentRef: Document
    locationRef: Location
    createCuratedCard: (entry: Record<string, unknown>) => Element
    applyCardLayoutUi: () => void
    buildRenderableEntries: () => RenderableResult
    withMutedObserver: (work: () => void) => void
    isLocalizedRatingDataMissingForEntries: (entries: unknown[], audioLocale: unknown) => boolean
    isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown[], audioLocale: unknown) => boolean
    preloadRatingsForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>
    preloadWatchHistoryForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>
    isWatchlistPath: (pathname: string) => boolean
  }

  type CuratedPanelOptions = {
    state?: unknown
    documentRef?: unknown
    locationRef?: unknown
    createCuratedCard?: unknown
    applyCardLayoutUi?: unknown
    buildRenderableEntries?: unknown
    withMutedObserver?: unknown
    isLocalizedRatingDataMissingForEntries?: unknown
    isLocalizedWatchHistoryDataMissingForEntries?: unknown
    preloadRatingsForSelectedAudioLocale?: unknown
    preloadWatchHistoryForSelectedAudioLocale?: unknown
    isWatchlistPath?: unknown
  }

  type CuratedPanelRuntime = {
    renderCuratedPanel: () => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>
  const cardMoveDurationMs = 220
  const cardExitDurationMs = 180

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated panel dependency: ${name}`)
    }

    return value as T
  }

  function getPendingRequestItems(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return []
    }

    return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item) => Boolean(item))
  }

  function toNonNegativeInt(value: unknown): number {
    const number = Number(value)
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0
  }

  function getPendingRequestProgressInternal(context: CuratedPanelContext, pendingRequests: string[]): RequestProgress {
    const started = toNonNegativeInt(context.state.curatedPendingRequestStartedCount)
    const completed = Math.min(toNonNegativeInt(context.state.curatedPendingRequestCompletedCount), started)
    return {
      started,
      completed,
      inProgress: pendingRequests.length,
    }
  }

  function createCuratedPanelContext(options: CuratedPanelOptions = {}): CuratedPanelContext {
    const state = options.state && typeof options.state === 'object' ? (options.state as RuntimeState) : null
    if (!state) {
      throw new Error('[CW] Missing curated panel state')
    }
    const documentRef =
      options.documentRef && typeof options.documentRef === 'object' ? (options.documentRef as Document) : null
    if (!documentRef) {
      throw new Error('[CW] Missing curated panel documentRef')
    }
    const locationRef =
      options.locationRef && typeof options.locationRef === 'object' ? (options.locationRef as Location) : null
    if (!locationRef) {
      throw new Error('[CW] Missing curated panel locationRef')
    }

    return {
      state,
      documentRef,
      locationRef,
      createCuratedCard: requireFunction<CuratedPanelContext['createCuratedCard']>(
        'createCuratedCard',
        options.createCuratedCard,
      ),
      applyCardLayoutUi: requireFunction<CuratedPanelContext['applyCardLayoutUi']>(
        'applyCardLayoutUi',
        options.applyCardLayoutUi,
      ),
      buildRenderableEntries: requireFunction<CuratedPanelContext['buildRenderableEntries']>(
        'buildRenderableEntries',
        options.buildRenderableEntries,
      ),
      withMutedObserver: requireFunction<CuratedPanelContext['withMutedObserver']>(
        'withMutedObserver',
        options.withMutedObserver,
      ),
      isLocalizedRatingDataMissingForEntries: requireFunction<
        CuratedPanelContext['isLocalizedRatingDataMissingForEntries']
      >('isLocalizedRatingDataMissingForEntries', options.isLocalizedRatingDataMissingForEntries),
      isLocalizedWatchHistoryDataMissingForEntries: requireFunction<
        CuratedPanelContext['isLocalizedWatchHistoryDataMissingForEntries']
      >('isLocalizedWatchHistoryDataMissingForEntries', options.isLocalizedWatchHistoryDataMissingForEntries),
      preloadRatingsForSelectedAudioLocale: requireFunction<
        CuratedPanelContext['preloadRatingsForSelectedAudioLocale']
      >('preloadRatingsForSelectedAudioLocale', options.preloadRatingsForSelectedAudioLocale),
      preloadWatchHistoryForSelectedAudioLocale: requireFunction<
        CuratedPanelContext['preloadWatchHistoryForSelectedAudioLocale']
      >('preloadWatchHistoryForSelectedAudioLocale', options.preloadWatchHistoryForSelectedAudioLocale),
      isWatchlistPath: requireFunction<CuratedPanelContext['isWatchlistPath']>(
        'isWatchlistPath',
        options.isWatchlistPath,
      ),
    }
  }

  function resolveCuratedGridEmptyStateKey(context: CuratedPanelContext, total: number, loading: boolean): string {
    if (context.state.curatedError && total === 0) {
      return `error:${context.state.curatedError}`
    }
    if (loading && total === 0) {
      return 'loading'
    }
    if (total > 0) {
      return 'no-match'
    }
    return 'no-watchlist'
  }

  function getEntrySeriesId(entry: Record<string, unknown>): string {
    const value = entry.seriesId
    if (typeof value === 'string') {
      return value.trim()
    }
    if (value == null) {
      return ''
    }
    return String(value).trim()
  }

  function buildCuratedCardContentSignature(entry: Record<string, unknown>, cardLayout: unknown): string {
    const { isFavorite: _ignoredFavorite, ...rest } = entry
    try {
      return (
        JSON.stringify({
          cardLayout: cardLayout === 'landscape' ? 'landscape' : 'portrait',
          entry: rest,
        }) || ''
      )
    } catch {
      return ''
    }
  }

  function getElementDataAttribute(element: Element, datasetKey: string, attributeName: string): string {
    const datasetValue = (element as Element & { dataset?: Record<string, unknown> }).dataset?.[datasetKey]
    if (typeof datasetValue === 'string') {
      return datasetValue
    }
    if (typeof element.getAttribute !== 'function') {
      return ''
    }
    return element.getAttribute(attributeName) || ''
  }

  function setElementDataAttribute(element: Element, datasetKey: string, attributeName: string, value: string): void {
    const dataset = (element as Element & { dataset?: Record<string, unknown> }).dataset
    if (dataset && typeof dataset === 'object') {
      dataset[datasetKey] = value
      return
    }
    if (typeof element.setAttribute === 'function') {
      element.setAttribute(attributeName, value)
    }
  }

  function toggleClassNameToken(className: string, token: string, enabled: boolean): string {
    const classTokens = className
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
    const hasToken = classTokens.includes(token)
    if (enabled && !hasToken) {
      classTokens.push(token)
    }
    if (!enabled && hasToken) {
      return classTokens.filter((item) => item !== token).join(' ')
    }
    return classTokens.join(' ')
  }

  function patchFavoriteButtonState(card: Element, isFavorite: boolean): void {
    const searchableCard = card as Element & {
      querySelector?: (selectors: string) => Element | null
    }
    if (typeof searchableCard.querySelector !== 'function') {
      return
    }

    const favoriteButton = searchableCard.querySelector(
      'button[data-cw-action="favorite"]',
    ) as FavoriteButtonLike | null
    if (!favoriteButton) {
      return
    }

    favoriteButton.className = toggleClassNameToken(favoriteButton.className || '', 'is-active', isFavorite)
    if (typeof favoriteButton.setAttribute === 'function') {
      favoriteButton.setAttribute('aria-label', isFavorite ? 'Unfavorite' : 'Favorite')
      favoriteButton.setAttribute('aria-pressed', isFavorite ? 'true' : 'false')
    }
    favoriteButton.title = isFavorite ? 'Unfavorite' : 'Favorite'
    favoriteButton.textContent = isFavorite ? '♥' : '♡'
  }

  function annotateCuratedCardElement(
    card: Element,
    seriesId: string,
    contentSignature: string,
    isFavorite: boolean,
    detailsLoading: boolean,
  ): void {
    setElementDataAttribute(card, 'cwSeriesId', 'data-cw-series-id', seriesId)
    setElementDataAttribute(card, 'cwCardContentSignature', 'data-cw-card-content-signature', contentSignature)
    setElementDataAttribute(card, 'cwLoadingDetails', 'data-cw-loading-details', detailsLoading ? 'true' : 'false')
    patchFavoriteButtonState(card, isFavorite)
  }

  function isFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value))
  }

  function hasPositivePlaybackValue(value: unknown): boolean {
    const number = Number(value)
    return Number.isFinite(number) && number > 0
  }

  function hasRenderableWatchHistoryData(entry: Record<string, unknown>): boolean {
    if (entry.neverWatched) {
      return true
    }

    if (isFiniteNumber(entry.lastWatchedMs) && Number(entry.lastWatchedMs) > 0) {
      return true
    }

    const progressEntry =
      entry.watchHistoryProgressEntry && typeof entry.watchHistoryProgressEntry === 'object'
        ? (entry.watchHistoryProgressEntry as Record<string, unknown>)
        : null
    if (!progressEntry) {
      return false
    }

    if (progressEntry.fullyWatched) {
      return true
    }

    return (
      hasPositivePlaybackValue(progressEntry.playhead) ||
      hasPositivePlaybackValue(progressEntry.playheadMs) ||
      hasPositivePlaybackValue(progressEntry.progressMs)
    )
  }

  function isRenderableEntryMetadataLoading(entry: Record<string, unknown>): boolean {
    const ratingMissing = !isFiniteNumber(entry.rating)
    const votesMissing = !isFiniteNumber(entry.votes)
    const distributionMissing = !entry.distribution || typeof entry.distribution !== 'object'
    if (ratingMissing || votesMissing || distributionMissing) {
      return true
    }

    if (!hasRenderableWatchHistoryData(entry)) {
      return true
    }

    return false
  }

  function parseCardLayoutFromContentSignature(signature: string): 'portrait' | 'landscape' | null {
    if (!signature) {
      return null
    }
    try {
      const parsed = JSON.parse(signature) as { cardLayout?: unknown }
      if (parsed.cardLayout === 'landscape') {
        return 'landscape'
      }
      if (parsed.cardLayout === 'portrait') {
        return 'portrait'
      }
      return null
    } catch {
      return null
    }
  }

  function createOrReuseCuratedCard(
    context: CuratedPanelContext,
    existingCardsBySeriesId: Map<string, Element>,
    usedSeriesIds: Set<string>,
    entry: Record<string, unknown>,
    detailsLoading: boolean,
  ): Element {
    const seriesId = getEntrySeriesId(entry)
    const isFavorite = Boolean(entry.isFavorite)
    const normalizedCardLayout = context.state.settings.cardLayout === 'landscape' ? 'landscape' : 'portrait'
    const contentSignature = buildCuratedCardContentSignature(entry, normalizedCardLayout)
    const existingCard = seriesId && !usedSeriesIds.has(seriesId) ? existingCardsBySeriesId.get(seriesId) || null : null

    if (seriesId) {
      usedSeriesIds.add(seriesId)
    }

    if (existingCard) {
      const previousSignature = getElementDataAttribute(
        existingCard,
        'cwCardContentSignature',
        'data-cw-card-content-signature',
      )
      const previousCardLayout = parseCardLayoutFromContentSignature(previousSignature)
      const hasMatchingSignature = previousSignature === contentSignature
      // Preserve existing nodes while metadata is still enriching so skeleton shimmers don't reset.
      const canDeferContentRefresh =
        detailsLoading && Boolean(previousSignature) && previousCardLayout === normalizedCardLayout
      if (hasMatchingSignature || canDeferContentRefresh) {
        annotateCuratedCardElement(
          existingCard,
          seriesId,
          hasMatchingSignature ? contentSignature : previousSignature,
          isFavorite,
          detailsLoading,
        )
        return existingCard
      }
    }

    const nextCard = context.createCuratedCard(entry)
    annotateCuratedCardElement(nextCard, seriesId, contentSignature, isFavorite, detailsLoading)
    return nextCard
  }

  function reorderCuratedGridChildrenBare(gridElement: Element, nextCards: Element[]): void {
    nextCards.forEach((nextCard, index) => {
      const currentChild = gridElement.children[index] || null
      if (currentChild === nextCard) {
        return
      }
      gridElement.insertBefore(nextCard, currentChild)
    })

    while (gridElement.children.length > nextCards.length) {
      const overflow = gridElement.children[nextCards.length]
      if (!overflow) {
        break
      }
      gridElement.removeChild(overflow)
    }
  }

  function isCardElement(value: unknown): value is Element {
    if (!value || typeof value !== 'object') {
      return false
    }
    const className = (value as Element & { className?: string }).className
    return hasClassToken(className, 'cw-curated-card') && !hasClassToken(className, 'cw-curated-card--leaving')
  }

  function toRectSnapshot(
    value: DOMRect | { left?: unknown; top?: unknown; width?: unknown; height?: unknown },
  ): RectSnapshot {
    return {
      left: Number(value.left) || 0,
      top: Number(value.top) || 0,
      width: Number(value.width) || 0,
      height: Number(value.height) || 0,
    }
  }

  function getElementRectSnapshot(element: Element): RectSnapshot | null {
    const measurableElement = element as Element & {
      getBoundingClientRect?: () => DOMRect
    }
    if (typeof measurableElement.getBoundingClientRect !== 'function') {
      return null
    }

    return toRectSnapshot(measurableElement.getBoundingClientRect())
  }

  function canAnimateCards(gridElement: Element, cards: Element[]): boolean {
    if (!cards.length) {
      return false
    }

    if (typeof (gridElement as Element & { appendChild?: unknown }).appendChild !== 'function') {
      return false
    }

    return cards.every((card) => getElementRectSnapshot(card) != null)
  }

  function captureCardRects(cards: Element[]): Map<Element, RectSnapshot> {
    const snapshots = new Map<Element, RectSnapshot>()
    cards.forEach((card) => {
      const snapshot = getElementRectSnapshot(card)
      if (snapshot) {
        snapshots.set(card, snapshot)
      }
    })
    return snapshots
  }

  function markCardEntering(card: Element): void {
    const cardElement = card as Element & { className?: string }
    cardElement.className = toggleClassNameToken(cardElement.className || '', 'cw-curated-card--entering', true)

    const removeEnterClass = () => {
      cardElement.className = toggleClassNameToken(cardElement.className || '', 'cw-curated-card--entering', false)
    }

    if (typeof root.requestAnimationFrame === 'function') {
      root.requestAnimationFrame(() => {
        root.requestAnimationFrame(removeEnterClass)
      })
      return
    }

    setTimeout(removeEnterClass, 0)
  }

  function animateCardMove(card: Element, previousRect: RectSnapshot, currentRect: RectSnapshot): void {
    const deltaX = previousRect.left - currentRect.left
    const deltaY = previousRect.top - currentRect.top
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
      return
    }

    const animatedElement = card as Element & {
      animate?: (
        keyframes: Keyframe[] | PropertyIndexedKeyframes,
        options?: number | KeyframeAnimationOptions,
      ) => Animation
    }
    if (typeof animatedElement.animate === 'function') {
      animatedElement.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px)`,
          },
          {
            transform: 'translate(0px, 0px)',
          },
        ],
        {
          duration: cardMoveDurationMs,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        },
      )
      return
    }

    const styledElement = card as Element & {
      style?: Record<string, string>
      getBoundingClientRect?: () => DOMRect
    }
    if (!styledElement.style) {
      return
    }

    styledElement.style.transition = 'none'
    styledElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`
    if (typeof styledElement.getBoundingClientRect === 'function') {
      styledElement.getBoundingClientRect()
    }
    styledElement.style.transition = ''
    styledElement.style.transform = ''
  }

  function createLeavingCardSnapshots(gridElement: Element, nextCards: Element[]): LeavingCardSnapshot[] {
    const nextCardSet = new Set(nextCards)
    return Array.from(gridElement.children)
      .filter((child) => isCardElement(child) && !nextCardSet.has(child))
      .map((child) => {
        const rect = getElementRectSnapshot(child)
        if (!rect) {
          return null
        }
        return {
          card: child,
          rect,
        }
      })
      .filter((snapshot): snapshot is LeavingCardSnapshot => snapshot != null)
  }

  function animateRemovedCards(gridElement: Element, leavingCardSnapshots: LeavingCardSnapshot[]): void {
    if (!leavingCardSnapshots.length) {
      return
    }

    const gridRect = getElementRectSnapshot(gridElement)
    if (!gridRect) {
      return
    }

    // Clone + overlay removed cards so filter/sort removals can fade out without blocking grid reflow.
    leavingCardSnapshots.forEach(({ card, rect }) => {
      const cloneSource = card as Element & { cloneNode?: (deep?: boolean) => Node }
      if (typeof cloneSource.cloneNode !== 'function') {
        return
      }

      const clonedNode = cloneSource.cloneNode(true)
      const leavingCard = clonedNode as Element & {
        className?: string
        style?: Record<string, string>
        removeAttribute?: (name: string) => void
        setAttribute?: (name: string, value: string) => void
        animate?: (
          keyframes: Keyframe[] | PropertyIndexedKeyframes,
          options?: number | KeyframeAnimationOptions,
        ) => Animation
      }
      if (!leavingCard || !leavingCard.style) {
        return
      }

      leavingCard.className = toggleClassNameToken(leavingCard.className || '', 'cw-curated-card--leaving', true)
      leavingCard.removeAttribute?.('data-cw-curated-title')
      leavingCard.removeAttribute?.('data-cw-series-id')
      leavingCard.removeAttribute?.('data-cw-card-content-signature')
      leavingCard.removeAttribute?.('data-cw-loading-details')
      leavingCard.setAttribute?.('data-cw-transition-clone', 'true')
      leavingCard.style.position = 'absolute'
      leavingCard.style.left = `${Math.max(0, rect.left - gridRect.left)}px`
      leavingCard.style.top = `${Math.max(0, rect.top - gridRect.top)}px`
      leavingCard.style.width = `${Math.max(0, rect.width)}px`
      leavingCard.style.height = `${Math.max(0, rect.height)}px`
      leavingCard.style.zIndex = '2'
      leavingCard.style.pointerEvents = 'none'
      leavingCard.style.margin = '0'

      gridElement.appendChild(leavingCard)

      const removeClone = () => {
        if (leavingCard.parentNode === gridElement) {
          gridElement.removeChild(leavingCard)
        }
      }

      if (typeof leavingCard.animate === 'function') {
        const animation = leavingCard.animate(
          [
            {
              opacity: 1,
              transform: 'translateY(0px) scale(1)',
            },
            {
              opacity: 0,
              transform: 'translateY(6px) scale(0.985)',
            },
          ],
          {
            duration: cardExitDurationMs,
            easing: 'ease-out',
            fill: 'forwards',
          },
        )
        animation.addEventListener('finish', removeClone, { once: true })
      } else {
        leavingCard.style.opacity = '0'
        setTimeout(removeClone, cardExitDurationMs)
      }
    })
  }

  function reorderCuratedGridChildren(gridElement: Element, nextCards: Element[]): void {
    const existingCards = Array.from(gridElement.children).filter((child) => isCardElement(child))
    const shouldAnimate = canAnimateCards(gridElement, existingCards)
    if (!shouldAnimate) {
      reorderCuratedGridChildrenBare(gridElement, nextCards)
      return
    }

    const previousRectsByCard = captureCardRects(existingCards)
    const leavingCardSnapshots = createLeavingCardSnapshots(gridElement, nextCards)
    reorderCuratedGridChildrenBare(gridElement, nextCards)
    animateRemovedCards(gridElement, leavingCardSnapshots)

    nextCards.forEach((card) => {
      const previousRect = previousRectsByCard.get(card) || null
      const currentRect = getElementRectSnapshot(card)
      if (!currentRect) {
        return
      }

      if (!previousRect) {
        markCardEntering(card)
        return
      }

      animateCardMove(card, previousRect, currentRect)
    })
  }

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

  function buildCuratedGridRenderSignature(
    context: CuratedPanelContext,
    visible: Array<Record<string, unknown>>,
    total: number,
    loading: boolean,
    metadataLoading: boolean,
    pendingRequests: string[],
    requestProgress: RequestProgress,
  ): string {
    if (visible.length) {
      return JSON.stringify({
        layout: context.state.settings.cardLayout,
        metadataLoading,
        visible,
      })
    }

    return JSON.stringify({
      layout: context.state.settings.cardLayout,
      emptyState: resolveCuratedGridEmptyStateKey(context, total, loading),
      pendingRequests: loading ? pendingRequests : [],
      requestProgress: loading ? requestProgress : { started: 0, completed: 0, inProgress: 0 },
    })
  }

  function getChildElements(element: Element): Element[] {
    const children = (element as Element & { children?: ArrayLike<Element> }).children
    if (!children) {
      return []
    }
    return Array.from(children)
  }

  function findElementByClassTokenWithin(root: Element, classToken: string): Element | null {
    const searchable = root as Element & {
      querySelector?: (selector: string) => Element | null
    }
    if (typeof searchable.querySelector === 'function') {
      const match = searchable.querySelector(`.${classToken}`)
      if (match) {
        return match
      }
    }

    const stack = getChildElements(root)
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

  type LoadingIndicatorDetailsNodes = {
    details: Element
    progress: Element
    requests: Element
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

  type SelectLike = {
    options: ArrayLike<{ value: string }>
    value: string
    textContent: string | null
    appendChild: (child: Element) => unknown
  }

  type SelectOption = {
    optionValue: string
    title: string
  }

  function asSelectLike(value: unknown): SelectLike | null {
    if (!value || typeof value !== 'object') {
      return null
    }
    const record = value as Partial<SelectLike>
    if (!record.options || typeof record.appendChild !== 'function') {
      return null
    }
    return record as SelectLike
  }

  function asSelectOptions(value: unknown): SelectOption[] {
    if (!Array.isArray(value)) {
      return []
    }
    return value.filter((item): item is SelectOption => {
      if (!item || typeof item !== 'object') {
        return false
      }
      const record = item as Record<string, unknown>
      return typeof record.optionValue === 'string' && typeof record.title === 'string'
    })
  }

  function setSelectOptionsInternal(
    documentRef: Document,
    selectValue: unknown,
    optionsValue: unknown,
    selectedValue: unknown,
  ): void {
    const select = asSelectLike(selectValue)
    if (!select) {
      return
    }

    const options = asSelectOptions(optionsValue)
    const currentValue = String(selectedValue ?? '')
    const existing = Array.from(select.options).map((option) => option.value)
    const next = options.map((option) => option.optionValue)
    const unchanged = existing.length === next.length && existing.every((value, index) => value === next[index])

    if (!unchanged) {
      select.textContent = ''
      options.forEach(({ optionValue, title }) => {
        const option = documentRef.createElement('option') as HTMLOptionElement
        option.value = optionValue
        option.textContent = title
        select.appendChild(option)
      })
    }

    select.value = next.includes(currentValue) ? currentValue : options[0]?.optionValue || ''
  }

  function createCuratedGridEmptyElement(context: CuratedPanelContext, total: number): Element {
    const empty = context.documentRef.createElement('div')
    empty.className = 'cw-empty'

    if (context.state.curatedError && total === 0) {
      empty.textContent = String(context.state.curatedError)
      return empty
    }

    if (total > 0) {
      empty.textContent = 'No shows match the current filters.'
      return empty
    }

    empty.textContent = 'No watchlist items were returned by Crunchyroll.'
    return empty
  }

  function renderCuratedGridIfNeeded(
    context: CuratedPanelContext,
    visible: Array<Record<string, unknown>>,
    total: number,
    loading: boolean,
    metadataLoading: boolean,
    gridRenderSignature: string,
  ): void {
    if (!context.state.gridEl) {
      return
    }

    const canSkipBySignature = context.state.curatedGridRenderSignature === gridRenderSignature
    if (canSkipBySignature) {
      const children = Array.from(context.state.gridEl.children)
      if (visible.length > 0) {
        const hasExpectedCards =
          children.length === visible.length &&
          children.every((child) =>
            hasClassToken((child as Element & { className?: string }).className, 'cw-curated-card'),
          )
        if (hasExpectedCards) {
          return
        }
      } else {
        const firstChild = children[0] as (Element & { className?: string }) | undefined
        if (loading && total === 0 && children.length === 0) {
          return
        }
        if (children.length === 1 && hasClassToken(firstChild?.className, 'cw-empty')) {
          return
        }
      }
    }

    if (!visible.length) {
      context.state.gridEl.textContent = ''
      if (!(loading && total === 0)) {
        context.state.gridEl.appendChild(createCuratedGridEmptyElement(context, total))
      }
    } else {
      const existingCardsBySeriesId = new Map<string, Element>()
      Array.from(context.state.gridEl.children).forEach((child) => {
        const seriesId = getElementDataAttribute(child, 'cwSeriesId', 'data-cw-series-id')
        if (seriesId && !existingCardsBySeriesId.has(seriesId)) {
          existingCardsBySeriesId.set(seriesId, child)
        }
      })
      const usedSeriesIds = new Set<string>()
      const nextCards = visible.map((entry) =>
        createOrReuseCuratedCard(
          context,
          existingCardsBySeriesId,
          usedSeriesIds,
          entry,
          metadataLoading && isRenderableEntryMetadataLoading(entry),
        ),
      )
      reorderCuratedGridChildren(context.state.gridEl, nextCards)
    }

    context.state.curatedGridRenderSignature = gridRenderSignature
  }

  function resolveCuratedStatsText(
    context: CuratedPanelContext,
    watchReadyFilterMode: string,
    total: number,
    visibleCount: number,
    loading: boolean,
  ): string {
    const shouldShowFilteredCount = watchReadyFilterMode === 'hide' || watchReadyFilterMode === 'hide_not_started'
    if (context.state.curatedError && total === 0) {
      return 'API load failed'
    }
    if (loading && total === 0) {
      return ''
    }
    if (loading && total > 0) {
      const base = shouldShowFilteredCount ? `Showing ${visibleCount} of ${total}` : `${total} shows`
      return `${base} (refreshing...)`
    }
    if (context.state.curatedError) {
      return String(context.state.curatedError)
    }
    return shouldShowFilteredCount ? `Showing ${visibleCount} of ${total}` : `${total} shows`
  }

  function queueLocalizedCuratedPreloads(
    context: CuratedPanelContext,
    selectedAudioFilter: string,
    onRenderRequested: () => void,
  ): void {
    const shouldPreloadLocalizedRatings =
      selectedAudioFilter !== 'any' &&
      context.isLocalizedRatingDataMissingForEntries(context.state.curatedEntries, selectedAudioFilter)
    const shouldPreloadLocalizedWatchHistory =
      selectedAudioFilter !== 'any' &&
      context.isLocalizedWatchHistoryDataMissingForEntries(context.state.curatedEntries, selectedAudioFilter)

    if (!shouldPreloadLocalizedRatings && !shouldPreloadLocalizedWatchHistory) {
      return
    }

    const preloadTasks: Array<Promise<unknown>> = []
    if (shouldPreloadLocalizedRatings) {
      preloadTasks.push(context.preloadRatingsForSelectedAudioLocale(selectedAudioFilter))
    }
    if (shouldPreloadLocalizedWatchHistory) {
      preloadTasks.push(context.preloadWatchHistoryForSelectedAudioLocale(selectedAudioFilter))
    }

    Promise.allSettled(preloadTasks).then(() => {
      if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
        return
      }
      onRenderRequested()
    })
  }

  function renderCuratedPanelInternal(context: CuratedPanelContext): void {
    if (!context.state.gridEl || !context.state.statsEl) {
      return
    }
    const statsEl = context.state.statsEl
    const loadingIndicatorEl = context.state.loadingIndicatorEl

    context.applyCardLayoutUi()

    const {
      mode: watchReadyFilterMode,
      total,
      visible,
      audioOptions,
      genreOptions,
      selectedAudioFilter,
      selectedGenreFilter,
    } = context.buildRenderableEntries()
    const loading = Boolean(context.state.curatedInflight)
    const firstLoadInFlight = loading && context.state.curatedInitialLoadDone !== true
    const pendingRequests = getPendingRequestItems(context.state.curatedPendingRequests)
    const metadataLoading = loading
    const requestProgress = getPendingRequestProgressInternal(context, pendingRequests)
    const gridRenderSignature = buildCuratedGridRenderSignature(
      context,
      visible,
      total,
      loading,
      metadataLoading,
      pendingRequests,
      requestProgress,
    )

    context.withMutedObserver(() => {
      setSelectOptionsInternal(
        context.documentRef,
        context.state.audioFilterSelectEl,
        audioOptions,
        selectedAudioFilter,
      )
      setSelectOptionsInternal(
        context.documentRef,
        context.state.genreFilterSelectEl,
        genreOptions,
        selectedGenreFilter,
      )

      if (loadingIndicatorEl) {
        syncLoadingIndicatorDetails(context.documentRef, loadingIndicatorEl, loading, pendingRequests, requestProgress)
        setLoadingBoxVisibility(loadingIndicatorEl, firstLoadInFlight)
        if (loadingIndicatorEl.style) {
          loadingIndicatorEl.style.display = firstLoadInFlight ? 'flex' : 'none'
        }
      }

      renderCuratedGridIfNeeded(context, visible, total, loading, metadataLoading, gridRenderSignature)
      statsEl.textContent = resolveCuratedStatsText(context, watchReadyFilterMode, total, visible.length, loading)
    })

    queueLocalizedCuratedPreloads(context, selectedAudioFilter, () => {
      renderCuratedPanelInternal(context)
    })
  }

  function createCuratedPanelRuntime(options: CuratedPanelOptions = {}): CuratedPanelRuntime {
    const context = createCuratedPanelContext(options)
    return {
      renderCuratedPanel: () => renderCuratedPanelInternal(context),
    }
  }

  moduleRegistry.runtimeCuratedPanel = {
    createCuratedPanelRuntime,
  }
})()
