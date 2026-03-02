type CardViewRuntimeFactory = {
  createCardView: (deps?: CardViewDeps) => CardViewRuntime;
};

let createCardViewRuntimeFactory: (() => CardViewRuntimeFactory) | null = null;

type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type ScopePair = {
  label: string;
  value: string | number;
};

type LastWatchedPresentation = {
  state: string;
  text: string;
};

type CuratedEntry = BoundaryRecord & {
  fullyWatched?: boolean | null;
  nextEpisodeLabel?: string | null;
  description?: string | null;
  statusBase?: string | null;
  votes?: number | string | null;
  distribution?: BoundaryRecord | null;
};

type CardViewContext = {
  documentRef: Document;
  getLastWatchedPresentation: (entry: CuratedEntry) => LastWatchedPresentation;
  setLabeledValue: (element: HTMLElement, label: string, value: string | number) => void;
  getSeriesScopePairs: (entry: CuratedEntry) => ScopePair[];
  setLabeledValuePairs: (element: HTMLElement, pairs: ScopePair[]) => void;
  appendLabeledValue: (element: HTMLElement, label: string, value: string | number) => void;
  getGenreValue: (entry: CuratedEntry) => string;
  makeRatingHistogram: (distribution: CuratedEntry['distribution'], votes: CuratedEntry['votes']) => HTMLElement;
  formatVotes: (votes: number | string) => string;
  sanitizePercentage: (value: BoundaryValue) => number | null;
  getStarCountFromDistribution: (
    votes: CuratedEntry['votes'],
    distribution: BoundaryRecord,
    starLevel: number,
  ) => number | null;
};

type CardViewDeps = Partial<Omit<CardViewContext, 'documentRef'>> & {
  documentRef?: BoundaryValue;
};

type RatingHistogramRowRefs = CwCuratedCardHistogramRowRefs;

type CardBodyRefs = CwCuratedCardBodyRefs;

function requireFunction<T>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing UI dependency: ${name}`);
  }
  return value as T;
}

function resolveDocumentRef(value: BoundaryValue): Document {
  if (value && typeof value === 'object' && typeof (value as Document).createElement === 'function') {
    return value as Document;
  }
  throw new Error('[CW] Missing UI dependency: documentRef');
}

function createCardViewContext(deps: CardViewDeps = {}): CardViewContext {
  return {
    documentRef: resolveDocumentRef(deps.documentRef),
    getLastWatchedPresentation: requireFunction<CardViewContext['getLastWatchedPresentation']>(
      'getLastWatchedPresentation',
      deps.getLastWatchedPresentation,
    ),
    setLabeledValue: requireFunction<CardViewContext['setLabeledValue']>('setLabeledValue', deps.setLabeledValue),
    getSeriesScopePairs: requireFunction<CardViewContext['getSeriesScopePairs']>(
      'getSeriesScopePairs',
      deps.getSeriesScopePairs,
    ),
    setLabeledValuePairs: requireFunction<CardViewContext['setLabeledValuePairs']>(
      'setLabeledValuePairs',
      deps.setLabeledValuePairs,
    ),
    appendLabeledValue: requireFunction<CardViewContext['appendLabeledValue']>(
      'appendLabeledValue',
      deps.appendLabeledValue,
    ),
    getGenreValue: requireFunction<CardViewContext['getGenreValue']>('getGenreValue', deps.getGenreValue),
    makeRatingHistogram: requireFunction<CardViewContext['makeRatingHistogram']>(
      'makeRatingHistogram',
      deps.makeRatingHistogram,
    ),
    formatVotes: requireFunction<CardViewContext['formatVotes']>('formatVotes', deps.formatVotes),
    sanitizePercentage: requireFunction<CardViewContext['sanitizePercentage']>(
      'sanitizePercentage',
      deps.sanitizePercentage,
    ),
    getStarCountFromDistribution: requireFunction<CardViewContext['getStarCountFromDistribution']>(
      'getStarCountFromDistribution',
      deps.getStarCountFromDistribution,
    ),
  };
}

function toEntry(value: BoundaryValue): CuratedEntry {
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

type TextContentElement = {
  textContent?: string | null;
};

type DatasetElement = {
  dataset?: Record<string, string | undefined>;
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
};

function setElementTextContent(element: TextContentElement | null | undefined, nextValue: string): void {
  if (!element || element.textContent === nextValue) {
    return;
  }
  element.textContent = nextValue;
}

function setElementDatasetValue(
  element: DatasetElement | null | undefined,
  datasetKey: string,
  nextValue: string,
): void {
  if (!element) {
    return;
  }

  if (element.dataset && typeof element.dataset === 'object') {
    if (element.dataset[datasetKey] !== nextValue) {
      element.dataset[datasetKey] = nextValue;
    }
    return;
  }

  if (typeof element.setAttribute === 'function') {
    const dashedKey = datasetKey.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
    element.setAttribute(`data-${dashedKey}`, nextValue);
  }
}

function removeElementDatasetValue(element: DatasetElement | null | undefined, datasetKey: string): void {
  if (!element) {
    return;
  }

  if (element.dataset && typeof element.dataset === 'object' && Object.hasOwn(element.dataset, datasetKey)) {
    delete element.dataset[datasetKey];
    return;
  }

  if (typeof element.removeAttribute === 'function') {
    const dashedKey = datasetKey.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
    element.removeAttribute(`data-${dashedKey}`);
  }
}

function resolveVotesNumber(value: CuratedEntry['votes']): number | null {
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

function toDistributionRecord(value: CuratedEntry['distribution']): BoundaryRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as BoundaryRecord;
}

function buildHistogramSignature(distribution: CuratedEntry['distribution'], votes: CuratedEntry['votes']): string {
  const distributionRecord = toDistributionRecord(distribution);
  if (!distributionRecord) {
    return 'missing';
  }
  const values = [5, 4, 3, 2, 1].map((star) => distributionRecord[String(star)] ?? '');
  return `${resolveVotesNumber(votes) ?? ''}|${values.join('|')}`;
}

function toElement(value: BoundaryValue): Element | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Element;
}

function toElementWithChildren(value: BoundaryValue): (Element & { children?: ArrayLike<Element> }) | null {
  const element = toElement(value);
  if (!element) {
    return null;
  }

  return element as Element & { children?: ArrayLike<Element> };
}

function createScopeElementInternal(context: CardViewContext, entry: CuratedEntry): HTMLElement {
  const scope = context.documentRef.createElement('div');
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
    scope.appendChild(context.documentRef.createElement('br'));
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
  const genres = context.documentRef.createElement('div');
  genres.className = 'cw-curated-card__genres';

  if (!genreValue) {
    genres.dataset.cwEmpty = 'true';
    return { genreValue: '', genres };
  }

  context.setLabeledValue(genres, 'Genres', genreValue);

  return { genreValue, genres };
}

function createActionsRowInternal(context: CardViewContext, entry: CuratedEntry, actions: HTMLElement): HTMLElement {
  const actionsRow = context.documentRef.createElement('div');
  actionsRow.className = 'cw-curated-card__actions-row';

  const ratingMeta = context.documentRef.createElement('div');
  ratingMeta.className = 'cw-curated-card__rating-meta';

  const votes = typeof entry.votes === 'number' && Number.isFinite(entry.votes) ? entry.votes : null;
  context.setLabeledValue(ratingMeta, 'Ratings', votes != null ? context.formatVotes(votes) : 'none');

  actionsRow.appendChild(ratingMeta);
  actionsRow.appendChild(actions);
  return actionsRow;
}

function createDetailsSkeletonInternal(context: CardViewContext): HTMLElement {
  const skeleton = context.documentRef.createElement('div');
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
    const line = context.documentRef.createElement('span');
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
  cardBodyRefsByElement: WeakMap<Element, CardBodyRefs>,
  inputEntry: BoundaryValue,
  actions: HTMLElement,
): HTMLElement {
  const entry = toEntry(inputEntry);

  const body = context.documentRef.createElement('div');
  body.className = 'cw-curated-card__body';

  const description = context.documentRef.createElement('div');
  description.className = 'cw-curated-card__description';
  description.textContent = resolveDescriptionTextInternal(entry);

  const status = context.documentRef.createElement('div');
  status.className = 'cw-curated-card__status';
  status.textContent = resolveStatusTextInternal(entry);

  const lastWatched = context.documentRef.createElement('div');
  lastWatched.className = 'cw-curated-card__last-watched';
  const lastWatchedPresentation = context.getLastWatchedPresentation(entry);
  lastWatched.dataset.cwLastWatchedState = lastWatchedPresentation.state;
  context.setLabeledValue(lastWatched, 'Last watched', lastWatchedPresentation.text);

  const scope = createScopeElementInternal(context, entry);
  const { genres } = createGenresElementInternal(context, entry);
  const histogram = context.makeRatingHistogram(entry.distribution, entry.votes);
  const { histogramMissingElement, histogramRowsByStar } = createHistogramRefsInternal(histogram);
  const actionsRow = createActionsRowInternal(context, entry, actions);
  const detailsSkeleton = createDetailsSkeletonInternal(context);

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
    entry.distribution && typeof entry.distribution === 'object' ? toDistributionRecord(entry.distribution) : null;
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

function getCardBodyRefsFromValue(
  cardBodyRefsByElement: WeakMap<Element, CardBodyRefs>,
  value: BoundaryValue,
): CardBodyRefs | null {
  const directElement = toElement(value);
  if (directElement) {
    const directRefs = cardBodyRefsByElement.get(directElement);
    if (directRefs) {
      return directRefs;
    }
  }

  const cardElement = toElementWithChildren(value);
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

class CuratedCardBodyRefsStore {
  private readonly refsByElement = new WeakMap<Element, CardBodyRefs>();

  readonly set = (element: Element, refs: CardBodyRefs): void => {
    this.refsByElement.set(element, refs);
  };

  readonly getMap = (): WeakMap<Element, CardBodyRefs> => {
    return this.refsByElement;
  };

  readonly get = (value: BoundaryValue): CardBodyRefs | null => {
    return getCardBodyRefsFromValue(this.refsByElement, value);
  };
}

class CuratedCardBodyFactoryOwner {
  private readonly context: CardViewContext;
  private readonly refsStore: CuratedCardBodyRefsStore;

  constructor(context: CardViewContext, refsStore: CuratedCardBodyRefsStore) {
    this.context = context;
    this.refsStore = refsStore;
  }

  readonly create = (entry: BoundaryValue, actions: HTMLElement): HTMLElement => {
    return createCuratedCardBodyInternal(this.context, this.refsStore.getMap(), entry, actions);
  };
}

class CuratedCardBodyPatchOwner {
  private readonly context: CardViewContext;
  private readonly refsStore: CuratedCardBodyRefsStore;

  constructor(context: CardViewContext, refsStore: CuratedCardBodyRefsStore) {
    this.context = context;
    this.refsStore = refsStore;
  }

  readonly patch = (cardValue: BoundaryValue, inputEntry: BoundaryValue): void => {
    patchCuratedCardBodyInternal(this.context, this.refsStore.getMap(), cardValue, inputEntry);
  };
}

function patchCuratedCardBodyInternal(
  context: CardViewContext,
  cardBodyRefsByElement: WeakMap<Element, CardBodyRefs>,
  cardValue: BoundaryValue,
  inputEntry: BoundaryValue,
): void {
  const refs = getCardBodyRefsFromValue(cardBodyRefsByElement, cardValue);
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

class CardViewOwner {
  private readonly context: CardViewContext;
  private readonly refsStore = new CuratedCardBodyRefsStore();
  private readonly bodyFactoryOwner: CuratedCardBodyFactoryOwner;
  private readonly bodyPatchOwner: CuratedCardBodyPatchOwner;

  constructor(deps: CardViewDeps = {}) {
    this.context = createCardViewContext(deps);
    this.bodyFactoryOwner = new CuratedCardBodyFactoryOwner(this.context, this.refsStore);
    this.bodyPatchOwner = new CuratedCardBodyPatchOwner(this.context, this.refsStore);
  }

  readonly createCuratedCardBody = (entry: BoundaryValue, actions: HTMLElement): HTMLElement => {
    return this.bodyFactoryOwner.create(entry, actions);
  };

  readonly patchCuratedCardBody = (card: BoundaryValue, entry: BoundaryValue): void => {
    this.bodyPatchOwner.patch(card, entry);
  };

  readonly getCuratedCardBodyRefs = (value: BoundaryValue): CardBodyRefs | null => {
    return this.refsStore.get(value);
  };
}

type CardViewRuntime = {
  createCuratedCardBody: (entry: BoundaryValue, actions: HTMLElement) => HTMLElement;
  patchCuratedCardBody: (card: BoundaryValue, entry: BoundaryValue) => void;
  getCuratedCardBodyRefs: (value: BoundaryValue) => CardBodyRefs | null;
};

function createCardView(deps: CardViewDeps = {}): CardViewRuntime {
  return new CardViewOwner(deps);
}

const cardViewRuntime = {
  createCardView,
};
createCardViewRuntimeFactory = () => cardViewRuntime;

export function createCardViewRuntime(): CardViewRuntimeFactory {
  if (typeof createCardViewRuntimeFactory !== 'function') {
    throw new Error('[CW] Card view runtime factory was not initialized.');
  }
  return createCardViewRuntimeFactory();
}
