type CardMetadataRuntimeFactory = {
  createCardMetadata: (deps?: CardMetadataDeps) => CardMetadataRuntime;
};

let createCardMetadataRuntimeFactory: (() => CardMetadataRuntimeFactory) | null = null;

type BoundaryValue = LooseRecord[string];
type BoundaryRecord = Record<string, BoundaryValue>;
type LabelValuePair = { label: string; value: BoundaryValue };

type CardMetadataEntry = BoundaryRecord;

type GetPlausiblePastTimestamp = (value: BoundaryValue) => number | null;
type EstimateUnwatchedEpisodesLeft = (entry: CardMetadataEntry) => number | null;
type SanitizePositiveInt = (value: BoundaryValue) => number | null;
type NormalizeTagList = (values: BoundaryValue[]) => string[];
type SanitizePercentage = (value: BoundaryValue) => number | null;
type GetStarCountFromDistribution = (
  votes: BoundaryValue,
  distribution: BoundaryValue,
  starLevel: BoundaryValue,
) => number | null;
type GetWatchHistoryStatus = () => string;

type CardMetadataContext = {
  getPlausiblePastTimestamp: GetPlausiblePastTimestamp;
  estimateUnwatchedEpisodesLeft: EstimateUnwatchedEpisodesLeft;
  sanitizePositiveInt: SanitizePositiveInt;
  normalizeTagList: NormalizeTagList;
  sanitizePercentage: SanitizePercentage;
  getStarCountFromDistribution: GetStarCountFromDistribution;
  getWatchHistoryStatus: GetWatchHistoryStatus;
  documentRef: Document;
};

type CardMetadataDeps = Partial<Omit<CardMetadataContext, 'documentRef'>> & {
  documentRef?: BoundaryValue;
};

type LastWatchedPresentation = {
  state: string;
  text: string;
};

type CardMetadataRuntime = {
  formatVotes: (votes: BoundaryValue) => string;
  sanitizePercentage: (value: BoundaryValue) => number | null;
  getStarCountFromDistribution: (
    votes: BoundaryValue,
    distribution: BoundaryValue,
    starLevel: BoundaryValue,
  ) => number | null;
  getLastWatchedPresentation: (entry: BoundaryValue) => LastWatchedPresentation;
  appendLabeledValue: (element: HTMLElement, label: string, value: BoundaryValue) => void;
  setLabeledValue: (element: HTMLElement, label: string, value: BoundaryValue) => void;
  setLabeledValuePairs: (element: HTMLElement, pairs: LabelValuePair[]) => void;
  getSeriesScopePairs: (entry: BoundaryValue) => Array<{ label: string; value: number }>;
  getGenreValue: (entry: BoundaryValue) => string;
  makeRatingBadge: (rating: BoundaryValue, votes: BoundaryValue) => HTMLElement;
  makeRatingHistogram: (distribution: BoundaryValue, votes: BoundaryValue) => HTMLElement;
};

function requireFunction<T>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing card metadata dependency: ${name}`);
  }
  return value as T;
}

function resolveDocumentRef(value: BoundaryValue): Document {
  if (value && typeof value === 'object' && 'createElement' in (value as BoundaryRecord)) {
    return value as Document;
  }
  throw new Error('[CW] Missing card metadata dependency: documentRef');
}

function createCardMetadataContext(deps: CardMetadataDeps = {}): CardMetadataContext {
  return {
    getPlausiblePastTimestamp: requireFunction<GetPlausiblePastTimestamp>(
      'getPlausiblePastTimestamp',
      deps.getPlausiblePastTimestamp,
    ),
    estimateUnwatchedEpisodesLeft: requireFunction<EstimateUnwatchedEpisodesLeft>(
      'estimateUnwatchedEpisodesLeft',
      deps.estimateUnwatchedEpisodesLeft,
    ),
    sanitizePositiveInt: requireFunction<SanitizePositiveInt>('sanitizePositiveInt', deps.sanitizePositiveInt),
    normalizeTagList: requireFunction<NormalizeTagList>('normalizeTagList', deps.normalizeTagList),
    sanitizePercentage: requireFunction<SanitizePercentage>('sanitizePercentage', deps.sanitizePercentage),
    getStarCountFromDistribution: requireFunction<GetStarCountFromDistribution>(
      'getStarCountFromDistribution',
      deps.getStarCountFromDistribution,
    ),
    getWatchHistoryStatus: requireFunction<GetWatchHistoryStatus>('getWatchHistoryStatus', deps.getWatchHistoryStatus),
    documentRef: resolveDocumentRef(deps.documentRef),
  };
}

function asRecord(value: BoundaryValue): CardMetadataEntry {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as CardMetadataEntry;
}

function formatVotesInternal(votes: BoundaryValue): string {
  if (votes == null) {
    return '';
  }
  try {
    return Number(votes).toLocaleString();
  } catch {
    return String(votes);
  }
}

function formatLastWatchedValueInternal(context: CardMetadataContext, value: BoundaryValue): string | null {
  const timestamp = context.getPlausiblePastTimestamp(value);
  if (timestamp == null) {
    return null;
  }

  let dateLabel = '';
  try {
    dateLabel = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(timestamp);
  } catch {
    dateLabel = new Date(timestamp).toISOString().slice(0, 10);
  }

  const daysAgo = Math.max(0, Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000)));
  if (daysAgo === 0) {
    return `${dateLabel} (today)`;
  }
  if (daysAgo === 1) {
    return `${dateLabel} (1 day ago)`;
  }
  return `${dateLabel} (${daysAgo} days ago)`;
}

function getLastWatchedPresentationInternal(
  context: CardMetadataContext,
  entry: CardMetadataEntry,
): LastWatchedPresentation {
  if (entry.neverWatched) {
    return {
      state: 'never',
      text: 'never',
    };
  }

  const formatted = formatLastWatchedValueInternal(context, entry.lastWatchedMs);
  if (formatted) {
    return {
      state: 'dated',
      text: formatted,
    };
  }

  const watchHistoryStatus = context.getWatchHistoryStatus();
  if (watchHistoryStatus === 'ready') {
    return {
      state: 'retained-miss',
      text: 'not in retained history',
    };
  }
  if (watchHistoryStatus === 'failed') {
    return {
      state: 'history-unavailable',
      text: 'history unavailable',
    };
  }
  return {
    state: 'pending',
    text: 'pending',
  };
}

function appendLabeledValueInternal(element: HTMLElement, label: string, value: BoundaryValue): void {
  const labelNode = element.ownerDocument.createElement('span');
  labelNode.textContent = `${label}: `;

  const valueNode = element.ownerDocument.createElement('span');
  valueNode.className = 'cw-curated-card__value';
  valueNode.textContent = String(value);

  element.appendChild(labelNode);
  element.appendChild(valueNode);
}

function setLabeledValueInternal(element: HTMLElement, label: string, value: BoundaryValue): void {
  element.textContent = '';
  appendLabeledValueInternal(element, label, value);
}

function setLabeledValuePairsInternal(element: HTMLElement, pairs: LabelValuePair[]): void {
  element.textContent = '';
  pairs.forEach(({ label, value }, index) => {
    if (index > 0) {
      element.appendChild(element.ownerDocument.createTextNode(' | '));
    }
    appendLabeledValueInternal(element, label, value);
  });
}

function getSeriesScopePairsInternal(
  context: CardMetadataContext,
  entry: CardMetadataEntry,
): Array<{ label: string; value: number }> {
  const pairs: Array<{ label: string; value: number }> = [];
  const seasons = context.sanitizePositiveInt(entry.seasonCount);
  const episodes = context.sanitizePositiveInt(entry.episodeCount);
  const left = context.estimateUnwatchedEpisodesLeft(entry);

  if (seasons != null) {
    pairs.push({ label: 'Seasons', value: seasons });
  }
  if (episodes != null) {
    pairs.push({ label: 'Episodes', value: episodes });
  }
  if (left != null) {
    pairs.push({ label: 'Unwatched left', value: left });
  }
  return pairs;
}

function getGenreValueInternal(context: CardMetadataContext, entry: CardMetadataEntry): string {
  const genreTags = context.normalizeTagList(Array.isArray(entry.genreTags) ? entry.genreTags : []);
  if (!genreTags.length) {
    return '';
  }
  return genreTags.slice(0, 3).join(', ');
}

function makeRatingBadgeInternal(
  context: CardMetadataContext,
  rating: BoundaryValue,
  votes: BoundaryValue,
): HTMLElement {
  const badge = context.documentRef.createElement('span');
  badge.className = 'cw-rating-badge';

  if (rating != null && Number.isFinite(Number(rating))) {
    const normalized = Number(rating);
    badge.textContent = `★ ${normalized.toFixed(1)}`;
    badge.title =
      votes != null ? `${normalized.toFixed(1)} (${formatVotesInternal(votes)} ratings)` : `${normalized.toFixed(1)}`;
    return badge;
  }

  badge.className = 'cw-rating-badge cw-rating-badge--missing';
  badge.textContent = 'NR';
  badge.title = 'No rating found';
  return badge;
}

function makeRatingHistogramInternal(
  context: CardMetadataContext,
  distribution: BoundaryValue,
  votes: BoundaryValue,
): HTMLElement {
  const histogram = context.documentRef.createElement('div');
  histogram.className = 'cw-rating-histogram';

  if (!distribution || typeof distribution !== 'object') {
    const missing = context.documentRef.createElement('div');
    missing.className = 'cw-rating-histogram__missing';
    missing.textContent = 'Rating distribution unavailable';
    histogram.appendChild(missing);
    return histogram;
  }

  const distributionRecord = distribution as BoundaryRecord;
  for (let star = 5; star >= 1; star -= 1) {
    const row = context.documentRef.createElement('div');
    row.className = 'cw-rating-row';

    const label = context.documentRef.createElement('span');
    label.className = 'cw-rating-row__label';
    label.textContent = `${star}★`;

    const track = context.documentRef.createElement('span');
    track.className = 'cw-rating-row__track';

    const fill = context.documentRef.createElement('span');
    fill.className = 'cw-rating-row__fill';
    const percentage = context.sanitizePercentage(distributionRecord[String(star)]) ?? 0;
    fill.style.width = `${percentage}%`;

    const percentageText = context.documentRef.createElement('span');
    percentageText.className = 'cw-rating-row__percentage';
    percentageText.textContent = `${percentage}%`;

    const countText = context.documentRef.createElement('span');
    countText.className = 'cw-rating-row__count';
    const starCount = context.getStarCountFromDistribution(votes, distributionRecord, star);
    countText.textContent = starCount != null ? formatVotesInternal(starCount) : '-';

    track.appendChild(fill);
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(percentageText);
    row.appendChild(countText);
    histogram.appendChild(row);
  }

  return histogram;
}

class CardMetadataOwner implements CardMetadataRuntime {
  private readonly context: CardMetadataContext;

  constructor(deps: CardMetadataDeps = {}) {
    this.context = createCardMetadataContext(deps);
  }

  readonly formatVotes = (votes: BoundaryValue): string => {
    return formatVotesInternal(votes);
  };

  readonly sanitizePercentage = (value: BoundaryValue): number | null => {
    return this.context.sanitizePercentage(value);
  };

  readonly getStarCountFromDistribution = (
    votes: BoundaryValue,
    distribution: BoundaryValue,
    starLevel: BoundaryValue,
  ): number | null => {
    return this.context.getStarCountFromDistribution(votes, distribution, starLevel);
  };

  readonly getLastWatchedPresentation = (entry: BoundaryValue): LastWatchedPresentation => {
    return getLastWatchedPresentationInternal(this.context, asRecord(entry));
  };

  readonly appendLabeledValue = (element: HTMLElement, label: string, value: BoundaryValue): void => {
    appendLabeledValueInternal(element, label, value);
  };

  readonly setLabeledValue = (element: HTMLElement, label: string, value: BoundaryValue): void => {
    setLabeledValueInternal(element, label, value);
  };

  readonly setLabeledValuePairs = (element: HTMLElement, pairs: LabelValuePair[]): void => {
    setLabeledValuePairsInternal(element, pairs);
  };

  readonly getSeriesScopePairs = (entry: BoundaryValue): Array<{ label: string; value: number }> => {
    return getSeriesScopePairsInternal(this.context, asRecord(entry));
  };

  readonly getGenreValue = (entry: BoundaryValue): string => {
    return getGenreValueInternal(this.context, asRecord(entry));
  };

  readonly makeRatingBadge = (rating: BoundaryValue, votes: BoundaryValue): HTMLElement => {
    return makeRatingBadgeInternal(this.context, rating, votes);
  };

  readonly makeRatingHistogram = (distribution: BoundaryValue, votes: BoundaryValue): HTMLElement => {
    return makeRatingHistogramInternal(this.context, distribution, votes);
  };
}

function createCardMetadata(deps: CardMetadataDeps = {}): CardMetadataRuntime {
  return new CardMetadataOwner(deps);
}

const cardMetadataRuntime = {
  createCardMetadata,
};
createCardMetadataRuntimeFactory = () => cardMetadataRuntime;

export function createCardMetadataRuntime(): CardMetadataRuntimeFactory {
  if (typeof createCardMetadataRuntimeFactory !== 'function') {
    throw new Error('[CW] Card metadata runtime factory was not initialized.');
  }
  return createCardMetadataRuntimeFactory();
}
