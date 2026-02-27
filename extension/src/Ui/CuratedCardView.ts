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

  function resolveStatusTextInternal(entry: CuratedEntry): string {
    const statusBase =
      typeof entry.statusBase === 'string' && entry.statusBase.trim() ? entry.statusBase.trim() : 'Up Next'
    if (entry.fullyWatched) {
      return statusBase
    }

    const nextEpisodeLabel =
      typeof entry.nextEpisodeLabel === 'string' && entry.nextEpisodeLabel.trim() ? entry.nextEpisodeLabel.trim() : ''
    if (!nextEpisodeLabel) {
      return statusBase
    }

    return `${statusBase}: ${nextEpisodeLabel}`
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
  ): { genreValue: string; genres: HTMLElement } {
    const genreValue = context.getGenreValue(entry)
    const genres = document.createElement('div')
    genres.className = 'cw-curated-card__genres'

    if (!genreValue) {
      genres.dataset.cwEmpty = 'true'
      return { genreValue: '', genres }
    }

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

  function createDetailsSkeletonInternal(): HTMLElement {
    const skeleton = document.createElement('div')
    skeleton.className = 'cw-curated-card__details-skeleton'
    skeleton.setAttribute('aria-hidden', 'true')

    const lineClassNames = [
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--status',
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--last-watched',
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--scope',
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--genres',
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--star-row cw-curated-card__details-skeleton-line--star-row-5',
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--star-row cw-curated-card__details-skeleton-line--star-row-4',
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--star-row cw-curated-card__details-skeleton-line--star-row-3',
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--star-row cw-curated-card__details-skeleton-line--star-row-2',
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--star-row cw-curated-card__details-skeleton-line--star-row-1',
      'cw-curated-card__details-skeleton-line cw-curated-card__details-skeleton-line--rating-meta',
    ]

    lineClassNames.forEach((className) => {
      const line = document.createElement('span')
      line.className = className
      skeleton.appendChild(line)
    })

    return skeleton
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
    status.textContent = resolveStatusTextInternal(entry)

    const lastWatched = document.createElement('div')
    lastWatched.className = 'cw-curated-card__last-watched'
    const lastWatchedPresentation = context.getLastWatchedPresentation(entry)
    lastWatched.dataset.cwLastWatchedState = lastWatchedPresentation.state
    context.setLabeledValue(lastWatched, 'Last watched', lastWatchedPresentation.text)

    const scope = createScopeElementInternal(context, entry)
    const { genres } = createGenresElementInternal(context, entry)
    const histogram = context.makeRatingHistogram(entry.distribution, entry.votes)
    const actionsRow = createActionsRowInternal(context, entry, actions)
    const detailsSkeleton = createDetailsSkeletonInternal()

    body.appendChild(description)
    body.appendChild(status)
    body.appendChild(lastWatched)
    body.appendChild(scope)
    body.appendChild(genres)
    body.appendChild(histogram)
    body.appendChild(actionsRow)
    body.appendChild(detailsSkeleton)

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
