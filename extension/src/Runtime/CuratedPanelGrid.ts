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

  type CuratedPanelGridTransitionsRuntime = {
    reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[]) => void
  }

  type FavoriteButtonLike = Element & {
    className?: string
    textContent: string | null
    title?: string
    setAttribute?: (name: string, value: string) => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated panel grid dependency: ${name}`)
    }

    return value as T
  }

  function requireRuntimeFactory<T>(moduleName: string, factoryName: string): () => T {
    const moduleValue = moduleRegistry[moduleName]
    if (!moduleValue || typeof moduleValue !== 'object') {
      throw new Error(`[CW] Missing curated panel grid dependency: ${moduleName}`)
    }

    const factory = (moduleValue as Record<string, unknown>)[factoryName]
    if (typeof factory !== 'function') {
      throw new Error(`[CW] Missing curated panel grid dependency: ${moduleName}.${factoryName}`)
    }

    return factory as () => T
  }

  function resolveCuratedPanelGridTransitionsRuntime(): CuratedPanelGridTransitionsRuntime {
    const createRuntime = requireRuntimeFactory<unknown>(
      'runtimeCuratedPanelGridTransitions',
      'createCuratedPanelGridTransitionsRuntime',
    )
    const runtime = createRuntime()
    if (!runtime || typeof runtime !== 'object') {
      throw new Error('[CW] Missing curated panel grid dependency: runtimeCuratedPanelGridTransitions.runtime')
    }

    return {
      reorderCuratedGridChildren: requireFunction(
        'runtimeCuratedPanelGridTransitions.reorderCuratedGridChildren',
        (runtime as Record<string, unknown>).reorderCuratedGridChildren,
      ),
    }
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

  function renderCuratedGridIfNeeded(
    options: CuratedPanelGridRenderOptions,
    transitionsRuntime: CuratedPanelGridTransitionsRuntime,
  ): void {
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
      transitionsRuntime.reorderCuratedGridChildren(gridEl, nextCards)
    }

    state.curatedGridRenderSignature = gridRenderSignature
  }

  function createCuratedPanelGridRuntime(): CuratedPanelGridRuntime {
    const transitionsRuntime = resolveCuratedPanelGridTransitionsRuntime()
    return {
      renderCuratedGridIfNeeded: (options) => renderCuratedGridIfNeeded(options, transitionsRuntime),
    }
  }

  moduleRegistry.runtimeCuratedPanelGrid = {
    createCuratedPanelGridRuntime,
  }
})()
