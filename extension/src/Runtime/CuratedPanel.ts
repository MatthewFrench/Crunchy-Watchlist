;(() => {
  type RenderableResult = {
    mode: 'none' | 'dim' | 'hide'
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
    curatedGridRenderSignature: string
    gridEl: (Element & { textContent: string | null }) | null
    statsEl: (Element & { textContent: string | null }) | null
    loadingIndicatorEl: (Element & { style?: Record<string, string> }) | null
    audioFilterSelectEl: Element | null
    genreFilterSelectEl: Element | null
    settings: Record<string, unknown>
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

  function buildCuratedGridRenderSignature(
    context: CuratedPanelContext,
    visible: Array<Record<string, unknown>>,
    total: number,
    loading: boolean,
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
    })
  }

  function createLoadingIndicatorInternal(documentRef: Document, text: string): Element {
    const loading = documentRef.createElement('span')
    loading.className = 'cw-loading'

    const spinner = documentRef.createElement('span')
    spinner.className = 'cw-spinner'
    spinner.setAttribute('aria-hidden', 'true')

    const label = documentRef.createElement('span')
    label.className = 'cw-loading__label'
    label.textContent = text

    loading.appendChild(spinner)
    loading.appendChild(label)
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
      const loadingContent = createLoadingIndicatorInternal(
        context.documentRef,
        'Loading curated watchlist from Crunchyroll API...',
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
    if (!context.state.gridEl || context.state.curatedGridRenderSignature === gridRenderSignature) {
      return
    }

    context.state.gridEl.textContent = ''

    if (!visible.length) {
      context.state.gridEl.appendChild(createCuratedGridEmptyElement(context, total, loading))
    } else {
      const fragment = context.documentRef.createDocumentFragment()
      visible.forEach((entry) => {
        fragment.appendChild(context.createCuratedCard(entry))
      })
      context.state.gridEl.appendChild(fragment)
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
    if (context.state.curatedError && total === 0) {
      return 'API load failed'
    }
    if (loading && total === 0) {
      return 'Loading...'
    }
    if (loading && total > 0) {
      const base = watchReadyFilterMode === 'hide' ? `Showing ${visibleCount} of ${total}` : `${total} shows`
      return `${base} (refreshing...)`
    }
    if (context.state.curatedError) {
      return String(context.state.curatedError)
    }
    return watchReadyFilterMode === 'hide' ? `Showing ${visibleCount} of ${total}` : `${total} shows`
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
    const gridRenderSignature = buildCuratedGridRenderSignature(context, visible, total, loading)

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
