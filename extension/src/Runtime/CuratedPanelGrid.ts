;(() => {
  type CuratedPanelGridState = {
    curatedError: unknown
    curatedGridRenderSignature: string
    gridEl: (Element & { textContent: string | null }) | null
    settings: Record<string, unknown>
  }

  type CuratedPanelGridRenderOptions = {
    state: CuratedPanelGridState
    documentRef: Document
    visible: Array<Record<string, unknown>>
    total: number
    loading: boolean
    metadataLoading: boolean
    gridRenderSignature: string
    createCuratedCard: (entry: Record<string, unknown>) => Element
  }

  type CuratedPanelGridRuntime = {
    renderCuratedGridIfNeeded: (options: CuratedPanelGridRenderOptions) => void
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

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>
  const cardMoveDurationMs = 220
  const cardExitDurationMs = 180

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
    state: CuratedPanelGridState,
    createCuratedCard: (entry: Record<string, unknown>) => Element,
    existingCardsBySeriesId: Map<string, Element>,
    usedSeriesIds: Set<string>,
    entry: Record<string, unknown>,
    detailsLoading: boolean,
  ): Element {
    const seriesId = getEntrySeriesId(entry)
    const isFavorite = Boolean(entry.isFavorite)
    const normalizedCardLayout = state.settings.cardLayout === 'landscape' ? 'landscape' : 'portrait'
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

    const nextCard = createCuratedCard(entry)
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

  function createCuratedGridEmptyElement(documentRef: Document, state: CuratedPanelGridState, total: number): Element {
    const empty = documentRef.createElement('div')
    empty.className = 'cw-empty'

    if (state.curatedError && total === 0) {
      empty.textContent = String(state.curatedError)
      return empty
    }

    if (total > 0) {
      empty.textContent = 'No shows match the current filters.'
      return empty
    }

    empty.textContent = 'No watchlist items were returned by Crunchyroll.'
    return empty
  }

  function renderCuratedGridIfNeeded(options: CuratedPanelGridRenderOptions): void {
    const { state, documentRef, visible, total, loading, metadataLoading, gridRenderSignature, createCuratedCard } =
      options
    if (!state.gridEl) {
      return
    }

    const gridEl = state.gridEl
    const canSkipBySignature = state.curatedGridRenderSignature === gridRenderSignature
    if (canSkipBySignature) {
      const children = Array.from(gridEl.children)
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
      gridEl.textContent = ''
      if (!(loading && total === 0)) {
        gridEl.appendChild(createCuratedGridEmptyElement(documentRef, state, total))
      }
    } else {
      const existingCardsBySeriesId = new Map<string, Element>()
      Array.from(gridEl.children).forEach((child) => {
        const seriesId = getElementDataAttribute(child, 'cwSeriesId', 'data-cw-series-id')
        if (seriesId && !existingCardsBySeriesId.has(seriesId)) {
          existingCardsBySeriesId.set(seriesId, child)
        }
      })
      const usedSeriesIds = new Set<string>()
      const nextCards = visible.map((entry) =>
        createOrReuseCuratedCard(
          state,
          createCuratedCard,
          existingCardsBySeriesId,
          usedSeriesIds,
          entry,
          metadataLoading && isRenderableEntryMetadataLoading(entry),
        ),
      )
      reorderCuratedGridChildren(gridEl, nextCards)
    }

    state.curatedGridRenderSignature = gridRenderSignature
  }

  function createCuratedPanelGridRuntime(): CuratedPanelGridRuntime {
    return {
      renderCuratedGridIfNeeded,
    }
  }

  moduleRegistry.runtimeCuratedPanelGrid = {
    createCuratedPanelGridRuntime,
  }
})()
