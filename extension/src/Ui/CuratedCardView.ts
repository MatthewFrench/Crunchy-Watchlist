(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type ScopePair = {
    label: string;
    value: string;
  };

  type LastWatchedPresentation = {
    state: string;
    text: string;
  };

  type CuratedEntry = {
    fullyWatched?: unknown;
    nextEpisodeLabel?: unknown;
    description?: unknown;
    statusBase?: unknown;
    votes?: unknown;
    distribution?: unknown;
  } & Record<string, unknown>;

  type CardViewContext = {
    getLastWatchedPresentation: (entry: CuratedEntry) => LastWatchedPresentation;
    setLabeledValue: (element: HTMLElement, label: string, value: string) => void;
    getSeriesScopePairs: (entry: CuratedEntry) => ScopePair[];
    setLabeledValuePairs: (element: HTMLElement, pairs: ScopePair[]) => void;
    appendLabeledValue: (element: HTMLElement, label: string, value: string) => void;
    getGenreValue: (entry: CuratedEntry) => string;
    makeRatingHistogram: (distribution: unknown, votes: unknown) => HTMLElement;
    formatVotes: (votes: number) => string;
    sanitizePercentage: (value: unknown) => number | null;
    getStarCountFromDistribution: (votes: unknown, distribution: unknown, starLevel: unknown) => number | null;
  };

  type CardViewDeps = {
    getLastWatchedPresentation?: unknown;
    setLabeledValue?: unknown;
    getSeriesScopePairs?: unknown;
    setLabeledValuePairs?: unknown;
    appendLabeledValue?: unknown;
    getGenreValue?: unknown;
    makeRatingHistogram?: unknown;
    formatVotes?: unknown;
    sanitizePercentage?: unknown;
    getStarCountFromDistribution?: unknown;
  };

  type RatingHistogramRowRefs = CwCuratedCardHistogramRowRefs;

  type CardBodyRefs = CwCuratedCardBodyRefs;

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;
  const cardBodyRefsByElement = new WeakMap<Element, CardBodyRefs>();

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing UI dependency: ${name}`);
    }
    return value as T;
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
      sanitizePercentage: requireFunction(
        'sanitizePercentage',
        deps.sanitizePercentage,
      ) as CardViewContext['sanitizePercentage'],
      getStarCountFromDistribution: requireFunction(
        'getStarCountFromDistribution',
        deps.getStarCountFromDistribution,
      ) as CardViewContext['getStarCountFromDistribution'],
    };
  }

  function toEntry(value: unknown): CuratedEntry {
    if (!value || typeof value !== 'object') {
      return {};
    }

    return value as CuratedEntry;
  }

  function resolveStatusTextInternal(entry: CuratedEntry): string {
    const statusBase =
      typeof entry.statusBase === 'string' && entry.statusBase.trim() ? entry.statusBase.trim() : 'Up Next';
    if (entry.fullyWatched) {
      return statusBase;
    }

    const nextEpisodeLabel =
      typeof entry.nextEpisodeLabel === 'string' && entry.nextEpisodeLabel.trim() ? entry.nextEpisodeLabel.trim() : '';
    if (!nextEpisodeLabel) {
      return statusBase;
    }

    return `${statusBase}: ${nextEpisodeLabel}`;
  }

  function resolveDescriptionTextInternal(entry: CuratedEntry): string {
    if (typeof entry.description === 'string' && entry.description) {
      return entry.description;
    }
    return 'No description available.';
  }

  function setElementTextContent(element: unknown, nextValue: string): void {
    const target = element as Element & { textContent?: string | null };
    if (!target || target.textContent === nextValue) {
      return;
    }
    target.textContent = nextValue;
  }

  function setElementDatasetValue(element: unknown, datasetKey: string, nextValue: string): void {
    const target = element as Element & {
      dataset?: Record<string, string>;
      setAttribute?: (name: string, value: string) => void;
    };
    if (!target) {
      return;
    }

    if (target.dataset && typeof target.dataset === 'object') {
      if (target.dataset[datasetKey] !== nextValue) {
        target.dataset[datasetKey] = nextValue;
      }
      return;
    }

    if (typeof target.setAttribute === 'function') {
      const dashedKey = datasetKey.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
      target.setAttribute(`data-${dashedKey}`, nextValue);
    }
  }

  function removeElementDatasetValue(element: unknown, datasetKey: string): void {
    const target = element as Element & {
      dataset?: Record<string, string>;
      removeAttribute?: (name: string) => void;
    };
    if (!target) {
      return;
    }

    if (target.dataset && typeof target.dataset === 'object' && Object.hasOwn(target.dataset, datasetKey)) {
      delete target.dataset[datasetKey];
      return;
    }

    if (typeof target.removeAttribute === 'function') {
      const dashedKey = datasetKey.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
      target.removeAttribute(`data-${dashedKey}`);
    }
  }

  function resolveVotesNumber(value: unknown): number | null {
    const votes = Number(value);
    if (!Number.isFinite(votes)) {
      return null;
    }
    return votes;
  }

  function buildScopeSignature(pairs: ScopePair[]): string {
    if (!pairs.length) {
      return '';
    }
    return pairs.map(({ label, value }) => `${label}:${value}`).join('|');
  }

  function buildHistogramSignature(distribution: unknown, votes: unknown): string {
    if (!distribution || typeof distribution !== 'object') {
      return 'missing';
    }
    const distributionRecord = distribution as Record<string, unknown>;
    const values = [5, 4, 3, 2, 1].map((star) => distributionRecord[String(star)] ?? '');
    return `${resolveVotesNumber(votes) ?? ''}|${values.join('|')}`;
  }

  function createScopeElementInternal(context: CardViewContext, entry: CuratedEntry): HTMLElement {
    const scope = document.createElement('div');
    scope.className = 'cw-curated-card__scope';

    const scopePairs = context.getSeriesScopePairs(entry);
    if (!scopePairs.length) {
      scope.textContent = 'Series totals unavailable';
      return scope;
    }

    const summaryPairs = scopePairs.filter(({ label }) => label !== 'Unwatched left');
    const unwatchedPair = scopePairs.find(({ label }) => label === 'Unwatched left');

    if (summaryPairs.length) {
      context.setLabeledValuePairs(scope, summaryPairs);
    }

    if (!unwatchedPair) {
      return scope;
    }

    if (summaryPairs.length) {
      scope.appendChild(document.createElement('br'));
    } else {
      scope.textContent = '';
    }

    context.appendLabeledValue(scope, unwatchedPair.label, unwatchedPair.value);
    return scope;
  }

  function createGenresElementInternal(
    context: CardViewContext,
    entry: CuratedEntry,
  ): { genreValue: string; genres: HTMLElement } {
    const genreValue = context.getGenreValue(entry);
    const genres = document.createElement('div');
    genres.className = 'cw-curated-card__genres';

    if (!genreValue) {
      genres.dataset.cwEmpty = 'true';
      return { genreValue: '', genres };
    }

    context.setLabeledValue(genres, 'Genres', genreValue);

    return { genreValue, genres };
  }

  function createActionsRowInternal(context: CardViewContext, entry: CuratedEntry, actions: HTMLElement): HTMLElement {
    const actionsRow = document.createElement('div');
    actionsRow.className = 'cw-curated-card__actions-row';

    const ratingMeta = document.createElement('div');
    ratingMeta.className = 'cw-curated-card__rating-meta';

    const votes = typeof entry.votes === 'number' && Number.isFinite(entry.votes) ? entry.votes : null;
    context.setLabeledValue(ratingMeta, 'Ratings', votes != null ? context.formatVotes(votes) : 'none');

    actionsRow.appendChild(ratingMeta);
    actionsRow.appendChild(actions);
    return actionsRow;
  }

  function createDetailsSkeletonInternal(): HTMLElement {
    const skeleton = document.createElement('div');
    skeleton.className = 'cw-curated-card__details-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');

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
    ];

    lineClassNames.forEach((className) => {
      const line = document.createElement('span');
      line.className = className;
      skeleton.appendChild(line);
    });

    return skeleton;
  }

  function createHistogramRowRefsInternal(histogramElement: HTMLElement, star: number): RatingHistogramRowRefs {
    const row = histogramElement.ownerDocument.createElement('div');
    row.className = 'cw-rating-row';
    setElementDatasetValue(row, 'cwStar', String(star));

    const label = histogramElement.ownerDocument.createElement('span');
    label.className = 'cw-rating-row__label';

    const track = histogramElement.ownerDocument.createElement('span');
    track.className = 'cw-rating-row__track';

    const fill = histogramElement.ownerDocument.createElement('span');
    fill.className = 'cw-rating-row__fill';
    track.appendChild(fill);

    const percentage = histogramElement.ownerDocument.createElement('span');
    percentage.className = 'cw-rating-row__percentage';

    const count = histogramElement.ownerDocument.createElement('span');
    count.className = 'cw-rating-row__count';

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(percentage);
    row.appendChild(count);
    histogramElement.appendChild(row);

    return {
      row,
      label,
      track,
      fill,
      percentage,
      count,
    };
  }

  function createHistogramRefsInternal(
    histogramElement: HTMLElement,
  ): Pick<CardBodyRefs, 'histogramMissingElement' | 'histogramRowsByStar'> {
    histogramElement.textContent = '';

    const histogramMissingElement = histogramElement.ownerDocument.createElement('div');
    histogramMissingElement.className = 'cw-rating-histogram__missing';
    histogramElement.appendChild(histogramMissingElement);

    const histogramRowsByStar: Record<string, RatingHistogramRowRefs> = {};
    for (let star = 5; star >= 1; star -= 1) {
      histogramRowsByStar[String(star)] = createHistogramRowRefsInternal(histogramElement, star);
    }

    return {
      histogramMissingElement,
      histogramRowsByStar,
    };
  }

  function createCuratedCardBodyInternal(
    context: CardViewContext,
    inputEntry: unknown,
    actions: HTMLElement,
  ): HTMLElement {
    const entry = toEntry(inputEntry);

    const body = document.createElement('div');
    body.className = 'cw-curated-card__body';

    const description = document.createElement('div');
    description.className = 'cw-curated-card__description';
    description.textContent = resolveDescriptionTextInternal(entry);

    const status = document.createElement('div');
    status.className = 'cw-curated-card__status';
    status.textContent = resolveStatusTextInternal(entry);

    const lastWatched = document.createElement('div');
    lastWatched.className = 'cw-curated-card__last-watched';
    const lastWatchedPresentation = context.getLastWatchedPresentation(entry);
    lastWatched.dataset.cwLastWatchedState = lastWatchedPresentation.state;
    context.setLabeledValue(lastWatched, 'Last watched', lastWatchedPresentation.text);

    const scope = createScopeElementInternal(context, entry);
    const { genres } = createGenresElementInternal(context, entry);
    const histogram = context.makeRatingHistogram(entry.distribution, entry.votes);
    const { histogramMissingElement, histogramRowsByStar } = createHistogramRefsInternal(histogram);
    const actionsRow = createActionsRowInternal(context, entry, actions);
    const detailsSkeleton = createDetailsSkeletonInternal();

    body.appendChild(description);
    body.appendChild(status);
    body.appendChild(lastWatched);
    body.appendChild(scope);
    body.appendChild(genres);
    body.appendChild(histogram);
    body.appendChild(actionsRow);
    body.appendChild(detailsSkeleton);

    const ratingMetaElement = actionsRow.children[0] as HTMLElement;
    const refs: CardBodyRefs = {
      body,
      descriptionElement: description,
      statusElement: status,
      lastWatchedElement: lastWatched,
      scopeElement: scope,
      genresElement: genres,
      histogramElement: histogram,
      histogramMissingElement,
      histogramRowsByStar,
      ratingMetaElement,
      actionsRowElement: actionsRow,
      detailsSkeletonElement: detailsSkeleton,
    };
    cardBodyRefsByElement.set(body, refs);
    patchHistogramElementInternal(context, refs, entry);

    return body;
  }

  function patchLastWatchedElementInternal(
    context: CardViewContext,
    lastWatchedElement: HTMLElement,
    entry: CuratedEntry,
  ): void {
    const lastWatchedPresentation = context.getLastWatchedPresentation(entry);
    const signature = `${lastWatchedPresentation.state}|${lastWatchedPresentation.text}`;
    if (lastWatchedElement.dataset?.cwLastWatchedSignature === signature) {
      return;
    }

    setElementDatasetValue(lastWatchedElement, 'cwLastWatchedState', lastWatchedPresentation.state);
    setElementDatasetValue(lastWatchedElement, 'cwLastWatchedSignature', signature);
    context.setLabeledValue(lastWatchedElement, 'Last watched', lastWatchedPresentation.text);
  }

  function patchScopeElementInternal(context: CardViewContext, scopeElement: HTMLElement, entry: CuratedEntry): void {
    const scopePairs = context.getSeriesScopePairs(entry);
    const scopeSignature = buildScopeSignature(scopePairs);
    if (scopeElement.dataset?.cwScopeSignature === scopeSignature) {
      return;
    }

    if (!scopePairs.length) {
      setElementTextContent(scopeElement, 'Series totals unavailable');
      setElementDatasetValue(scopeElement, 'cwScopeSignature', scopeSignature);
      return;
    }

    const summaryPairs = scopePairs.filter(({ label }) => label !== 'Unwatched left');
    const unwatchedPair = scopePairs.find(({ label }) => label === 'Unwatched left');

    if (summaryPairs.length) {
      context.setLabeledValuePairs(scopeElement, summaryPairs);
    } else {
      setElementTextContent(scopeElement, '');
    }

    if (unwatchedPair) {
      if (summaryPairs.length) {
        scopeElement.appendChild(scopeElement.ownerDocument.createElement('br'));
      }
      context.appendLabeledValue(scopeElement, unwatchedPair.label, unwatchedPair.value);
    }

    setElementDatasetValue(scopeElement, 'cwScopeSignature', scopeSignature);
  }

  function patchGenresElementInternal(context: CardViewContext, genresElement: HTMLElement, entry: CuratedEntry): void {
    const genreValue = context.getGenreValue(entry);
    if (genresElement.dataset?.cwGenresSignature === genreValue) {
      return;
    }

    if (!genreValue) {
      setElementTextContent(genresElement, '');
      setElementDatasetValue(genresElement, 'cwEmpty', 'true');
      setElementDatasetValue(genresElement, 'cwGenresSignature', '');
      return;
    }

    removeElementDatasetValue(genresElement, 'cwEmpty');
    context.setLabeledValue(genresElement, 'Genres', genreValue);
    setElementDatasetValue(genresElement, 'cwGenresSignature', genreValue);
  }

  function patchRatingMetaElementInternal(
    context: CardViewContext,
    ratingMetaElement: HTMLElement,
    entry: CuratedEntry,
  ): void {
    const votes = resolveVotesNumber(entry.votes);
    const ratingsValue = votes != null ? context.formatVotes(votes) : 'none';
    if (ratingMetaElement.dataset?.cwRatingMetaSignature === ratingsValue) {
      return;
    }

    context.setLabeledValue(ratingMetaElement, 'Ratings', ratingsValue);
    setElementDatasetValue(ratingMetaElement, 'cwRatingMetaSignature', ratingsValue);
  }

  function patchHistogramElementInternal(context: CardViewContext, refs: CardBodyRefs, entry: CuratedEntry): void {
    const histogramElement = refs.histogramElement;
    const histogramSignature = buildHistogramSignature(entry.distribution, entry.votes);
    if (histogramElement.dataset?.cwHistogramSignature === histogramSignature) {
      return;
    }

    const distributionRecord =
      entry.distribution && typeof entry.distribution === 'object'
        ? (entry.distribution as Record<string, unknown>)
        : null;
    const missingElement = refs.histogramMissingElement;

    if (!distributionRecord) {
      setElementTextContent(missingElement, 'Rating distribution unavailable');
      missingElement.style.display = '';
      Object.values(refs.histogramRowsByStar).forEach((rowRefs) => {
        rowRefs.row.style.display = 'none';
      });
      setElementDatasetValue(histogramElement, 'cwHistogramSignature', histogramSignature);
      setElementDatasetValue(histogramElement, 'cwRatingState', 'missing');
      return;
    }

    missingElement.style.display = 'none';
    for (let star = 5; star >= 1; star -= 1) {
      const rowRefs = refs.histogramRowsByStar[String(star)];
      if (!rowRefs) {
        continue;
      }

      rowRefs.row.style.display = '';
      setElementTextContent(rowRefs.label, `${star}★`);
      const percentage = context.sanitizePercentage(distributionRecord[String(star)]) ?? 0;
      const width = `${percentage}%`;
      if (rowRefs.fill.style.width !== width) {
        rowRefs.fill.style.width = width;
      }

      setElementTextContent(rowRefs.percentage, `${percentage}%`);

      const starCount = context.getStarCountFromDistribution(entry.votes, distributionRecord, star);
      setElementTextContent(rowRefs.count, starCount != null ? context.formatVotes(starCount) : '-');
    }

    setElementDatasetValue(histogramElement, 'cwHistogramSignature', histogramSignature);
    setElementDatasetValue(histogramElement, 'cwRatingState', 'ok');
  }

  function getCardBodyRefsFromValue(value: unknown): CardBodyRefs | null {
    const directElement = value as Element | null;
    if (directElement && typeof directElement === 'object') {
      const directRefs = cardBodyRefsByElement.get(directElement);
      if (directRefs) {
        return directRefs;
      }
    }

    const cardElement = value as Element & { children?: ArrayLike<Element> };
    if (!cardElement || !cardElement.children) {
      return null;
    }
    for (const child of Array.from(cardElement.children)) {
      const childRefs = cardBodyRefsByElement.get(child);
      if (childRefs) {
        return childRefs;
      }
    }
    return null;
  }

  function patchCuratedCardBodyInternal(context: CardViewContext, cardValue: unknown, inputEntry: unknown): void {
    const refs = getCardBodyRefsFromValue(cardValue);
    if (!refs) {
      return;
    }
    const entry = toEntry(inputEntry);

    setElementTextContent(refs.descriptionElement, resolveDescriptionTextInternal(entry));
    setElementTextContent(refs.statusElement, resolveStatusTextInternal(entry));
    patchLastWatchedElementInternal(context, refs.lastWatchedElement, entry);
    patchScopeElementInternal(context, refs.scopeElement, entry);
    patchGenresElementInternal(context, refs.genresElement, entry);
    patchHistogramElementInternal(context, refs, entry);
    patchRatingMetaElementInternal(context, refs.ratingMetaElement, entry);
  }

  function createCardView(deps: CardViewDeps = {}) {
    const context = createCardViewContext(deps);
    return {
      createCuratedCardBody: (entry: unknown, actions: HTMLElement) =>
        createCuratedCardBodyInternal(context, entry, actions),
      patchCuratedCardBody: (card: unknown, entry: unknown) => patchCuratedCardBodyInternal(context, card, entry),
      getCuratedCardBodyRefs: (value: unknown) => getCardBodyRefsFromValue(value),
    };
  }

  let uiRegistry = moduleRegistry.ui;
  if (!uiRegistry || typeof uiRegistry !== 'object') {
    uiRegistry = {};
    moduleRegistry.ui = uiRegistry;
  }

  (uiRegistry as Record<string, unknown>).cardView = {
    createCardView,
  };
})();
