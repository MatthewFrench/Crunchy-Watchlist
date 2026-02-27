;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type EventLike = {
    preventDefault?: AnyFn
    stopPropagation?: AnyFn
  }

  type EventTargetLike = {
    addEventListener: (eventName: string, listener: (event?: EventLike) => void | Promise<void>) => void
  }

  type SelectLike = EventTargetLike & {
    value: string
  }

  type CheckboxLike = EventTargetLike & {
    checked: boolean
  }

  type ButtonLike = EventTargetLike
  type MutableButtonLike = ButtonLike & {
    disabled?: boolean
    setAttribute?: (name: string, value: string) => void
  }

  type RuntimeState = {
    mounted: boolean
    settings: Record<string, unknown>
  }

  type CuratedInteractionsContext = {
    documentRef: Document
    alertRef: (message: string) => void
    confirmRef: (message: string) => boolean
    triggerNativeCardAction: (seriesId: string, actionType: string, favoriteValue?: unknown) => Promise<boolean>
    toggleCuratedFavorite: (seriesId: string) => void
    removeCuratedSeries: (seriesId: string) => void
    renderCuratedPanel: () => void
    state: RuntimeState
    locationRef: Location
    persistSettings: () => Promise<unknown>
    normalizeAudioLocale: (locale: unknown) => string | null
    preloadRatingsForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>
    preloadWatchHistoryForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>
    isWatchlistPath: (pathname: string) => boolean
    resetCuratedCachesForRefresh: () => Promise<unknown>
    ensureCuratedDataLoad: (force?: boolean) => Promise<unknown>
    debounceProcess: () => void
  }

  type CuratedInteractionsOptions = {
    documentRef?: unknown
    alertRef?: unknown
    confirmRef?: unknown
    triggerNativeCardAction?: unknown
    toggleCuratedFavorite?: unknown
    removeCuratedSeries?: unknown
    renderCuratedPanel?: unknown
    state?: unknown
    locationRef?: unknown
    persistSettings?: unknown
    normalizeAudioLocale?: unknown
    preloadRatingsForSelectedAudioLocale?: unknown
    preloadWatchHistoryForSelectedAudioLocale?: unknown
    isWatchlistPath?: unknown
    resetCuratedCachesForRefresh?: unknown
    ensureCuratedDataLoad?: unknown
    debounceProcess?: unknown
  }

  type CuratedInteractionsRuntime = {
    createCuratedCardActions: (entry: unknown) => HTMLElement
    bindCuratedInterfaceControls: (controlsContext: unknown) => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated interactions dependency: ${name}`)
    }

    return value as T
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    return value as Record<string, unknown>
  }

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
  }

  function toSelect(value: unknown): SelectLike | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const candidate = value as Partial<SelectLike>
    if (typeof candidate.addEventListener !== 'function') {
      return null
    }

    return candidate as SelectLike
  }

  function toCheckbox(value: unknown): CheckboxLike | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const candidate = value as Partial<CheckboxLike>
    if (typeof candidate.addEventListener !== 'function') {
      return null
    }

    return candidate as CheckboxLike
  }

  function toButton(value: unknown): ButtonLike | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const candidate = value as Partial<ButtonLike>
    if (typeof candidate.addEventListener !== 'function') {
      return null
    }

    return candidate as ButtonLike
  }

  function resolveState(value: unknown): RuntimeState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('[CW] Missing curated interactions state')
    }

    const stateRecord = value as Record<string, unknown>
    if (!stateRecord.settings || typeof stateRecord.settings !== 'object' || Array.isArray(stateRecord.settings)) {
      stateRecord.settings = {}
    }

    return stateRecord as unknown as RuntimeState
  }

  function resolveLocationRef(value: unknown): Location {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing curated interactions locationRef')
    }

    return value as Location
  }

  function resolveDocumentRef(value: unknown): Document {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing curated interactions documentRef')
    }

    return value as Document
  }

  function createCuratedInteractionsContext(options: CuratedInteractionsOptions = {}): CuratedInteractionsContext {
    return {
      documentRef: resolveDocumentRef(options.documentRef),
      alertRef: requireFunction('alertRef', options.alertRef) as CuratedInteractionsContext['alertRef'],
      confirmRef: requireFunction('confirmRef', options.confirmRef) as CuratedInteractionsContext['confirmRef'],
      triggerNativeCardAction: requireFunction(
        'triggerNativeCardAction',
        options.triggerNativeCardAction,
      ) as CuratedInteractionsContext['triggerNativeCardAction'],
      toggleCuratedFavorite: requireFunction(
        'toggleCuratedFavorite',
        options.toggleCuratedFavorite,
      ) as CuratedInteractionsContext['toggleCuratedFavorite'],
      removeCuratedSeries: requireFunction(
        'removeCuratedSeries',
        options.removeCuratedSeries,
      ) as CuratedInteractionsContext['removeCuratedSeries'],
      renderCuratedPanel: requireFunction(
        'renderCuratedPanel',
        options.renderCuratedPanel,
      ) as CuratedInteractionsContext['renderCuratedPanel'],
      state: resolveState(options.state),
      locationRef: resolveLocationRef(options.locationRef),
      persistSettings: requireFunction(
        'persistSettings',
        options.persistSettings,
      ) as CuratedInteractionsContext['persistSettings'],
      normalizeAudioLocale: requireFunction(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ) as CuratedInteractionsContext['normalizeAudioLocale'],
      preloadRatingsForSelectedAudioLocale: requireFunction(
        'preloadRatingsForSelectedAudioLocale',
        options.preloadRatingsForSelectedAudioLocale,
      ) as CuratedInteractionsContext['preloadRatingsForSelectedAudioLocale'],
      preloadWatchHistoryForSelectedAudioLocale: requireFunction(
        'preloadWatchHistoryForSelectedAudioLocale',
        options.preloadWatchHistoryForSelectedAudioLocale,
      ) as CuratedInteractionsContext['preloadWatchHistoryForSelectedAudioLocale'],
      isWatchlistPath: requireFunction(
        'isWatchlistPath',
        options.isWatchlistPath,
      ) as CuratedInteractionsContext['isWatchlistPath'],
      resetCuratedCachesForRefresh: requireFunction(
        'resetCuratedCachesForRefresh',
        options.resetCuratedCachesForRefresh,
      ) as CuratedInteractionsContext['resetCuratedCachesForRefresh'],
      ensureCuratedDataLoad: requireFunction(
        'ensureCuratedDataLoad',
        options.ensureCuratedDataLoad,
      ) as CuratedInteractionsContext['ensureCuratedDataLoad'],
      debounceProcess: requireFunction(
        'debounceProcess',
        options.debounceProcess,
      ) as CuratedInteractionsContext['debounceProcess'],
    }
  }

  function stopCardActionEvent(event: EventLike | undefined): void {
    if (typeof event?.preventDefault === 'function') {
      event.preventDefault()
    }
    if (typeof event?.stopPropagation === 'function') {
      event.stopPropagation()
    }
  }

  function createCuratedCardActionsInternal(context: CuratedInteractionsContext, entry: unknown): HTMLElement {
    const entryRecord = toRecord(entry)
    const seriesId = getString(entryRecord.seriesId)
    const initialFavorite = Boolean(entryRecord.isFavorite)
    const title = getString(entryRecord.title)

    const actions = context.documentRef.createElement('div')
    actions.className = 'cw-curated-card__actions'

    const favoriteButton = context.documentRef.createElement('button')
    favoriteButton.type = 'button'
    favoriteButton.className = `cw-card-action cw-card-action--favorite${initialFavorite ? ' is-active' : ''}`
    favoriteButton.dataset.cwAction = 'favorite'
    favoriteButton.setAttribute('aria-label', initialFavorite ? 'Unfavorite' : 'Favorite')
    favoriteButton.setAttribute('aria-pressed', initialFavorite ? 'true' : 'false')
    favoriteButton.title = initialFavorite ? 'Unfavorite' : 'Favorite'
    favoriteButton.textContent = initialFavorite ? '♥' : '♡'

    const removeButton = context.documentRef.createElement('button')
    removeButton.type = 'button'
    removeButton.className = 'cw-card-action cw-card-action--remove'
    removeButton.dataset.cwAction = 'remove'
    removeButton.setAttribute('aria-label', 'Remove from watchlist')
    removeButton.title = 'Remove from watchlist'
    removeButton.textContent = '🗑'

    if (!seriesId) {
      favoriteButton.disabled = true
      removeButton.disabled = true
    }

    const failedActionMessage = 'Crunchyroll watchlist update failed. Please refresh and try again.'

    favoriteButton.addEventListener('click', async (event) => {
      stopCardActionEvent(event)
      if (!seriesId) {
        return
      }

      const wasFavoriteButtonDisabled = favoriteButton.disabled
      const wasRemoveButtonDisabled = removeButton.disabled
      favoriteButton.disabled = true
      removeButton.disabled = true

      try {
        const nextFavorite = favoriteButton.getAttribute('aria-pressed') !== 'true'
        const applied = await context.triggerNativeCardAction(seriesId, 'favorite', nextFavorite)
        if (!applied) {
          context.alertRef(failedActionMessage)
          return
        }

        context.toggleCuratedFavorite(seriesId)
        context.renderCuratedPanel()
      } finally {
        favoriteButton.disabled = wasFavoriteButtonDisabled
        removeButton.disabled = wasRemoveButtonDisabled
      }
    })

    removeButton.addEventListener('click', async (event) => {
      stopCardActionEvent(event)
      if (!seriesId) {
        return
      }

      const confirmed = context.confirmRef(`Remove "${title}" from your Crunchyroll watchlist?`)
      if (!confirmed) {
        return
      }

      const wasFavoriteButtonDisabled = favoriteButton.disabled
      const wasRemoveButtonDisabled = removeButton.disabled
      favoriteButton.disabled = true
      removeButton.disabled = true

      try {
        const applied = await context.triggerNativeCardAction(seriesId, 'remove')
        if (!applied) {
          context.alertRef(failedActionMessage)
          return
        }

        context.removeCuratedSeries(seriesId)
        context.renderCuratedPanel()
      } finally {
        favoriteButton.disabled = wasFavoriteButtonDisabled
        removeButton.disabled = wasRemoveButtonDisabled
      }
    })

    actions.appendChild(favoriteButton)
    actions.appendChild(removeButton)
    return actions
  }

  function bindWatchReadyFilterInternal(
    context: CuratedInteractionsContext,
    watchReadyFilterControl: Record<string, unknown>,
  ): void {
    const select = toSelect(watchReadyFilterControl.select)
    if (!select) {
      return
    }

    select.addEventListener('change', async () => {
      context.state.settings.watchReadyFilterMode = select.value
      await context.persistSettings()
      context.renderCuratedPanel()
    })
  }

  function bindCardLayoutFilterInternal(
    context: CuratedInteractionsContext,
    cardLayoutControl: Record<string, unknown>,
  ): void {
    const input = toCheckbox(cardLayoutControl.input)
    if (!input) {
      return
    }

    input.addEventListener('change', async () => {
      context.state.settings.cardLayout = input.checked ? 'landscape' : 'portrait'
      await context.persistSettings()
      context.renderCuratedPanel()
    })
  }

  function bindAudioFilterInternal(
    context: CuratedInteractionsContext,
    audioFilterControl: Record<string, unknown>,
  ): void {
    const select = toSelect(audioFilterControl.select)
    if (!select) {
      return
    }

    select.addEventListener('change', async () => {
      context.state.settings.audioLocaleFilter = select.value || 'any'
      await context.persistSettings()
      context.renderCuratedPanel()

      const selectedAudioLocale = context.normalizeAudioLocale(context.state.settings.audioLocaleFilter)
      if (!selectedAudioLocale) {
        return
      }

      Promise.allSettled([
        context.preloadRatingsForSelectedAudioLocale(selectedAudioLocale),
        context.preloadWatchHistoryForSelectedAudioLocale(selectedAudioLocale),
      ]).then(() => {
        if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
          return
        }
        context.renderCuratedPanel()
      })
    })
  }

  function bindGenreFilterInternal(
    context: CuratedInteractionsContext,
    genreFilterControl: Record<string, unknown>,
  ): void {
    const select = toSelect(genreFilterControl.select)
    if (!select) {
      return
    }

    select.addEventListener('change', async () => {
      context.state.settings.genreFilter = select.value || 'any'
      await context.persistSettings()
      context.renderCuratedPanel()
    })
  }

  function bindSortFilterInternal(context: CuratedInteractionsContext, sortControl: Record<string, unknown>): void {
    const select = toSelect(sortControl.select)
    if (!select) {
      return
    }

    select.addEventListener('change', async () => {
      context.state.settings.sortMode = select.value
      await context.persistSettings()
      context.renderCuratedPanel()
    })
  }

  function bindSecondarySortFilterInternal(
    context: CuratedInteractionsContext,
    secondarySortControl: Record<string, unknown>,
  ): void {
    const select = toSelect(secondarySortControl.select)
    if (!select) {
      return
    }

    select.addEventListener('change', async () => {
      context.state.settings.secondarySortMode = select.value || 'none'
      await context.persistSettings()
      context.renderCuratedPanel()
    })
  }

  function bindRefreshButtonInternal(context: CuratedInteractionsContext, refreshButton: unknown): void {
    const button = toButton(refreshButton) as MutableButtonLike | null
    if (!button) {
      return
    }

    let refreshInFlight: Promise<unknown> | null = null

    button.addEventListener('click', async () => {
      if (refreshInFlight) {
        return
      }

      const wasDisabled = Boolean(button.disabled)
      button.disabled = true
      button.setAttribute?.('aria-busy', 'true')

      refreshInFlight = (async () => {
        await context.resetCuratedCachesForRefresh()
        const refreshPromise = context.ensureCuratedDataLoad(true)
        context.renderCuratedPanel()
        context.debounceProcess()
        await refreshPromise
      })()

      try {
        await refreshInFlight
      } finally {
        refreshInFlight = null
        button.setAttribute?.('aria-busy', 'false')
        button.disabled = wasDisabled
      }
    })
  }

  function bindCuratedInterfaceControlsInternal(context: CuratedInteractionsContext, controlsContext: unknown): void {
    const controls = toRecord(controlsContext)
    bindWatchReadyFilterInternal(context, toRecord(controls.watchReadyFilterControl))
    bindCardLayoutFilterInternal(context, toRecord(controls.cardLayoutControl))
    bindAudioFilterInternal(context, toRecord(controls.audioFilterControl))
    bindGenreFilterInternal(context, toRecord(controls.genreFilterControl))
    bindSortFilterInternal(context, toRecord(controls.sortControl))
    bindSecondarySortFilterInternal(context, toRecord(controls.secondarySortControl))
    bindRefreshButtonInternal(context, controls.refreshButton)
  }

  function createCuratedInteractionsRuntime(options: CuratedInteractionsOptions = {}): CuratedInteractionsRuntime {
    const context = createCuratedInteractionsContext(options)
    return {
      createCuratedCardActions: (entry: unknown) => createCuratedCardActionsInternal(context, entry),
      bindCuratedInterfaceControls: (controlsContext: unknown) =>
        bindCuratedInterfaceControlsInternal(context, controlsContext),
    }
  }

  moduleRegistry.runtimeCuratedInteractions = {
    createCuratedInteractionsRuntime,
  }
})()
