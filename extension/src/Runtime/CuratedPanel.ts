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
  ): void {
    setElementDataAttribute(card, 'cwSeriesId', 'data-cw-series-id', seriesId)
    setElementDataAttribute(card, 'cwCardContentSignature', 'data-cw-card-content-signature', contentSignature)
    patchFavoriteButtonState(card, isFavorite)
  }

  function createOrReuseCuratedCard(
    context: CuratedPanelContext,
    existingCardsBySeriesId: Map<string, Element>,
    usedSeriesIds: Set<string>,
    entry: Record<string, unknown>,
  ): Element {
    const seriesId = getEntrySeriesId(entry)
    const isFavorite = Boolean(entry.isFavorite)
    const contentSignature = buildCuratedCardContentSignature(entry, context.state.settings.cardLayout)
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
      if (previousSignature === contentSignature) {
        annotateCuratedCardElement(existingCard, seriesId, contentSignature, isFavorite)
        return existingCard
      }
    }

    const nextCard = context.createCuratedCard(entry)
    annotateCuratedCardElement(nextCard, seriesId, contentSignature, isFavorite)
    return nextCard
  }

  function reorderCuratedGridChildren(gridElement: Element, nextCards: Element[]): void {
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

  function buildCuratedGridRenderSignature(
    context: CuratedPanelContext,
    visible: Array<Record<string, unknown>>,
    total: number,
    loading: boolean,
    pendingRequests: string[],
    requestProgress: RequestProgress,
  ): string {
    if (visible.length) {
      return JSON.stringify({
        layout: context.state.settings.cardLayout,
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

  function createLoadingIndicatorInternal(
    documentRef: Document,
    text: string,
    pendingRequests: string[] = [],
    requestProgress: RequestProgress = { started: 0, completed: 0, inProgress: 0 },
  ): Element {
    const loading = documentRef.createElement('span')
    loading.className = 'cw-loading'

    const heading = documentRef.createElement('span')
    heading.className = 'cw-loading__heading'

    const spinner = documentRef.createElement('span')
    spinner.className = 'cw-spinner'
    spinner.setAttribute('aria-hidden', 'true')

    const label = documentRef.createElement('span')
    label.className = 'cw-loading__label'
    label.textContent = text

    heading.appendChild(spinner)
    heading.appendChild(label)
    loading.appendChild(heading)

    if (!pendingRequests.length && requestProgress.started === 0 && requestProgress.completed === 0) {
      return loading
    }

    const details = documentRef.createElement('span')
    details.className = 'cw-loading__details'

    const detailsTitle = documentRef.createElement('span')
    detailsTitle.className = 'cw-loading__details-title'
    detailsTitle.textContent = 'Request progress'
    details.appendChild(detailsTitle)

    const progress = documentRef.createElement('span')
    progress.className = 'cw-loading__progress'
    const totalCount = Math.max(requestProgress.started, requestProgress.completed + requestProgress.inProgress)
    progress.textContent = `Completed ${requestProgress.completed} of ${totalCount} • In progress ${requestProgress.inProgress}`
    details.appendChild(progress)

    if (!pendingRequests.length) {
      loading.appendChild(details)
      return loading
    }

    const requests = documentRef.createElement('ul')
    requests.className = 'cw-loading__requests'

    pendingRequests.forEach((requestLabel) => {
      const requestItem = documentRef.createElement('li')
      requestItem.className = 'cw-loading__request'
      requestItem.textContent = requestLabel
      requests.appendChild(requestItem)
    })

    details.appendChild(requests)
    loading.appendChild(details)
    return loading
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

  function createCuratedGridEmptyElement(context: CuratedPanelContext, total: number, loading: boolean): Element {
    const empty = context.documentRef.createElement('div')
    empty.className = 'cw-empty'

    if (context.state.curatedError && total === 0) {
      empty.textContent = String(context.state.curatedError)
      return empty
    }

    if (loading && total === 0) {
      const pendingRequests = getPendingRequestItems(context.state.curatedPendingRequests)
      const requestProgress = getPendingRequestProgressInternal(context, pendingRequests)
      const loadingContent = createLoadingIndicatorInternal(
        context.documentRef,
        'Loading curated watchlist from Crunchyroll API...',
        pendingRequests,
        requestProgress,
      )
      empty.appendChild(loadingContent)
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
        if (children.length === 1 && hasClassToken(firstChild?.className, 'cw-empty')) {
          return
        }
      }
    }

    if (!visible.length) {
      context.state.gridEl.textContent = ''
      context.state.gridEl.appendChild(createCuratedGridEmptyElement(context, total, loading))
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
        createOrReuseCuratedCard(context, existingCardsBySeriesId, usedSeriesIds, entry),
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
    const pendingRequests = getPendingRequestItems(context.state.curatedPendingRequests)
    const requestProgress = getPendingRequestProgressInternal(context, pendingRequests)
    const gridRenderSignature = buildCuratedGridRenderSignature(
      context,
      visible,
      total,
      loading,
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

      if (loadingIndicatorEl?.style) {
        loadingIndicatorEl.style.display = loading ? 'inline-flex' : 'none'
      }

      renderCuratedGridIfNeeded(context, visible, total, loading, gridRenderSignature)
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
