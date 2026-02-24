;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type ScopePair = {
    label: string
    value: string
  }

  type LastWatchedPresentation = {
    state: string
    text: string
  }

  type CuratedEntry = {
    fullyWatched?: unknown
    nextEpisodeLabel?: unknown
    description?: unknown
    statusBase?: unknown
    votes?: unknown
    distribution?: unknown
  } & Record<string, unknown>

  type CardViewContext = {
    getLastWatchedPresentation: (entry: CuratedEntry) => LastWatchedPresentation
    setLabeledValue: (element: HTMLElement, label: string, value: string) => void
    getSeriesScopePairs: (entry: CuratedEntry) => ScopePair[]
    setLabeledValuePairs: (element: HTMLElement, pairs: ScopePair[]) => void
    appendLabeledValue: (element: HTMLElement, label: string, value: string) => void
    getGenreValue: (entry: CuratedEntry) => string
    makeRatingHistogram: (distribution: unknown, votes: unknown) => HTMLElement
    formatVotes: (votes: number) => string
  }

  type CardViewDeps = {
    getLastWatchedPresentation?: unknown
    setLabeledValue?: unknown
    getSeriesScopePairs?: unknown
    setLabeledValuePairs?: unknown
    appendLabeledValue?: unknown
    getGenreValue?: unknown
    makeRatingHistogram?: unknown
    formatVotes?: unknown
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing UI dependency: ${name}`)
    }
    return value as T
  }

  function createCardViewContext(deps: CardViewDeps = {}): CardViewContext {
    return {
      getLastWatchedPresentation: requireFunction(
        'getLastWatchedPresentation',
        deps.getLastWatchedPresentation,
      ) as CardViewContext['getLastWatchedPresentation'],
      setLabeledValue: requireFunction('setLabeledValue', deps.setLabeledValue) as CardViewContext['setLabeledValue'],
      getSeriesScopePairs: requireFunction(
        'getSeriesScopePairs',
        deps.getSeriesScopePairs,
      ) as CardViewContext['getSeriesScopePairs'],
      setLabeledValuePairs: requireFunction(
        'setLabeledValuePairs',
        deps.setLabeledValuePairs,
      ) as CardViewContext['setLabeledValuePairs'],
      appendLabeledValue: requireFunction(
        'appendLabeledValue',
        deps.appendLabeledValue,
      ) as CardViewContext['appendLabeledValue'],
      getGenreValue: requireFunction('getGenreValue', deps.getGenreValue) as CardViewContext['getGenreValue'],
      makeRatingHistogram: requireFunction(
        'makeRatingHistogram',
        deps.makeRatingHistogram,
      ) as CardViewContext['makeRatingHistogram'],
      formatVotes: requireFunction('formatVotes', deps.formatVotes) as CardViewContext['formatVotes'],
    }
  }

  function toEntry(value: unknown): CuratedEntry {
    if (!value || typeof value !== 'object') {
      return {}
    }

    return value as CuratedEntry
  }

  function createNextEpisodeElementInternal(context: CardViewContext, entry: CuratedEntry): HTMLElement {
    const nextEpisode = document.createElement('div')
    nextEpisode.className = 'cw-curated-card__next'

    if (entry.fullyWatched) {
      context.setLabeledValue(nextEpisode, 'Next unwatched', 'none')
    } else if (typeof entry.nextEpisodeLabel === 'string' && entry.nextEpisodeLabel) {
      context.setLabeledValue(nextEpisode, 'Next unwatched', entry.nextEpisodeLabel)
    } else {
      context.setLabeledValue(nextEpisode, 'Next unwatched', 'unknown')
    }

    return nextEpisode
  }

  function createScopeElementInternal(context: CardViewContext, entry: CuratedEntry): HTMLElement {
    const scope = document.createElement('div')
    scope.className = 'cw-curated-card__scope'

    const scopePairs = context.getSeriesScopePairs(entry)
    if (!scopePairs.length) {
      scope.textContent = 'Series totals unavailable'
      return scope
    }

    const summaryPairs = scopePairs.filter(({ label }) => label !== 'Unwatched left')
    const unwatchedPair = scopePairs.find(({ label }) => label === 'Unwatched left')

    if (summaryPairs.length) {
      context.setLabeledValuePairs(scope, summaryPairs)
    }

    if (!unwatchedPair) {
      return scope
    }

    if (summaryPairs.length) {
      scope.appendChild(document.createElement('br'))
    } else {
      scope.textContent = ''
    }

    context.appendLabeledValue(scope, unwatchedPair.label, unwatchedPair.value)
    return scope
  }

  function createGenresElementInternal(
    context: CardViewContext,
    entry: CuratedEntry,
  ): { genreValue: string; genres: HTMLElement | null } {
    const genreValue = context.getGenreValue(entry)
    if (!genreValue) {
      return { genreValue: '', genres: null }
    }

    const genres = document.createElement('div')
    genres.className = 'cw-curated-card__genres'
    context.setLabeledValue(genres, 'Genres', genreValue)

    return { genreValue, genres }
  }

  function createActionsRowInternal(context: CardViewContext, entry: CuratedEntry, actions: HTMLElement): HTMLElement {
    const actionsRow = document.createElement('div')
    actionsRow.className = 'cw-curated-card__actions-row'

    const ratingMeta = document.createElement('div')
    ratingMeta.className = 'cw-curated-card__rating-meta'

    const votes = typeof entry.votes === 'number' && Number.isFinite(entry.votes) ? entry.votes : null
    context.setLabeledValue(ratingMeta, 'Ratings', votes != null ? context.formatVotes(votes) : 'none')

    actionsRow.appendChild(ratingMeta)
    actionsRow.appendChild(actions)
    return actionsRow
  }

  function createCuratedCardBodyInternal(
    context: CardViewContext,
    inputEntry: unknown,
    actions: HTMLElement,
  ): HTMLElement {
    const entry = toEntry(inputEntry)

    const body = document.createElement('div')
    body.className = 'cw-curated-card__body'

    const description = document.createElement('div')
    description.className = 'cw-curated-card__description'
    description.textContent =
      typeof entry.description === 'string' && entry.description ? entry.description : 'No description available.'

    const status = document.createElement('div')
    status.className = 'cw-curated-card__status'
    status.textContent = typeof entry.statusBase === 'string' && entry.statusBase ? entry.statusBase : 'Up Next'

    const lastWatched = document.createElement('div')
    lastWatched.className = 'cw-curated-card__last-watched'
    const lastWatchedPresentation = context.getLastWatchedPresentation(entry)
    lastWatched.dataset.cwLastWatchedState = lastWatchedPresentation.state
    context.setLabeledValue(lastWatched, 'Last watched', lastWatchedPresentation.text)

    const nextEpisode = createNextEpisodeElementInternal(context, entry)
    const scope = createScopeElementInternal(context, entry)
    const { genreValue, genres } = createGenresElementInternal(context, entry)
    const histogram = context.makeRatingHistogram(entry.distribution, entry.votes)
    const actionsRow = createActionsRowInternal(context, entry, actions)

    body.appendChild(description)
    body.appendChild(status)
    body.appendChild(lastWatched)
    body.appendChild(nextEpisode)
    body.appendChild(scope)
    if (genreValue && genres) {
      body.appendChild(genres)
    }
    body.appendChild(histogram)
    body.appendChild(actionsRow)

    return body
  }

  function createCardView(deps: CardViewDeps = {}) {
    const context = createCardViewContext(deps)
    return {
      createCuratedCardBody: (entry: unknown, actions: HTMLElement) =>
        createCuratedCardBodyInternal(context, entry, actions),
    }
  }

  let uiRegistry = moduleRegistry.ui
  if (!uiRegistry || typeof uiRegistry !== 'object') {
    uiRegistry = {}
    moduleRegistry.ui = uiRegistry
  }

  ;(uiRegistry as Record<string, unknown>).cardView = {
    createCardView,
  }
})()
