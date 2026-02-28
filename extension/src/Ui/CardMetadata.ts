(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type CardMetadataDeps = {
    getPlausiblePastTimestamp?: unknown;
    estimateUnwatchedEpisodesLeft?: unknown;
    sanitizePositiveInt?: unknown;
    normalizeTagList?: unknown;
    sanitizePercentage?: unknown;
    getStarCountFromDistribution?: unknown;
    getWatchHistoryStatus?: unknown;
    documentRef?: unknown;
  };

  type CardMetadataContext = {
    getPlausiblePastTimestamp: (value: unknown) => number | null;
    estimateUnwatchedEpisodesLeft: (entry: unknown) => number | null;
    sanitizePositiveInt: (value: unknown) => number | null;
    normalizeTagList: (values: unknown[]) => string[];
    sanitizePercentage: (value: unknown) => number | null;
    getStarCountFromDistribution: (votes: unknown, distribution: unknown, starLevel: unknown) => number | null;
    getWatchHistoryStatus: () => string;
    documentRef: Document;
  };

  type LastWatchedPresentation = {
    state: string;
    text: string;
  };

  type CardMetadataRuntime = {
    formatVotes: (votes: unknown) => string;
    sanitizePercentage: (value: unknown) => number | null;
    getStarCountFromDistribution: (votes: unknown, distribution: unknown, starLevel: unknown) => number | null;
    getLastWatchedPresentation: (entry: unknown) => LastWatchedPresentation;
    appendLabeledValue: (element: HTMLElement, label: string, value: unknown) => void;
    setLabeledValue: (element: HTMLElement, label: string, value: unknown) => void;
    setLabeledValuePairs: (element: HTMLElement, pairs: Array<{ label: string; value: unknown }>) => void;
    getSeriesScopePairs: (entry: unknown) => Array<{ label: string; value: number }>;
    getGenreValue: (entry: unknown) => string;
    makeRatingBadge: (rating: unknown, votes: unknown) => HTMLElement;
    makeRatingHistogram: (distribution: unknown, votes: unknown) => HTMLElement;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing card metadata dependency: ${name}`);
    }
    return value as T;
  }

  function resolveDocumentRef(value: unknown): Document {
    if (value && typeof value === 'object' && 'createElement' in (value as Record<string, unknown>)) {
      return value as Document;
    }
    if (typeof document !== 'undefined') {
      return document;
    }
    throw new Error('[CW] Missing card metadata dependency: documentRef');
  }

  function createCardMetadataContext(deps: CardMetadataDeps = {}): CardMetadataContext {
    return {
      getPlausiblePastTimestamp: requireFunction(
        'getPlausiblePastTimestamp',
        deps.getPlausiblePastTimestamp,
      ) as CardMetadataContext['getPlausiblePastTimestamp'],
      estimateUnwatchedEpisodesLeft: requireFunction(
        'estimateUnwatchedEpisodesLeft',
        deps.estimateUnwatchedEpisodesLeft,
      ) as CardMetadataContext['estimateUnwatchedEpisodesLeft'],
      sanitizePositiveInt: requireFunction(
        'sanitizePositiveInt',
        deps.sanitizePositiveInt,
      ) as CardMetadataContext['sanitizePositiveInt'],
      normalizeTagList: requireFunction(
        'normalizeTagList',
        deps.normalizeTagList,
      ) as CardMetadataContext['normalizeTagList'],
      sanitizePercentage: requireFunction(
        'sanitizePercentage',
        deps.sanitizePercentage,
      ) as CardMetadataContext['sanitizePercentage'],
      getStarCountFromDistribution: requireFunction(
        'getStarCountFromDistribution',
        deps.getStarCountFromDistribution,
      ) as CardMetadataContext['getStarCountFromDistribution'],
      getWatchHistoryStatus: requireFunction(
        'getWatchHistoryStatus',
        deps.getWatchHistoryStatus,
      ) as CardMetadataContext['getWatchHistoryStatus'],
      documentRef: resolveDocumentRef(deps.documentRef),
    };
  }

  function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return value as Record<string, unknown>;
  }

  function formatVotesInternal(votes: unknown): string {
    if (votes == null) {
      return '';
    }
    try {
      return Number(votes).toLocaleString();
    } catch (_) {
      return String(votes);
    }
  }

  function formatLastWatchedValueInternal(context: CardMetadataContext, value: unknown): string | null {
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
    } catch (_) {
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
    entryValue: unknown,
  ): LastWatchedPresentation {
    const entry = asRecord(entryValue);
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
      state: 'unknown',
      text: 'unknown',
    };
  }

  function appendLabeledValueInternal(element: HTMLElement, label: string, value: unknown): void {
    const labelNode = element.ownerDocument.createElement('span');
    labelNode.textContent = `${label}: `;

    const valueNode = element.ownerDocument.createElement('span');
    valueNode.className = 'cw-curated-card__value';
    valueNode.textContent = String(value);

    element.appendChild(labelNode);
    element.appendChild(valueNode);
  }

  function setLabeledValueInternal(element: HTMLElement, label: string, value: unknown): void {
    element.textContent = '';
    appendLabeledValueInternal(element, label, value);
  }

  function setLabeledValuePairsInternal(element: HTMLElement, pairs: Array<{ label: string; value: unknown }>): void {
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
    entryValue: unknown,
  ): Array<{ label: string; value: number }> {
    const entry = asRecord(entryValue);
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

  function getGenreValueInternal(context: CardMetadataContext, entryValue: unknown): string {
    const entry = asRecord(entryValue);
    const genreTags = context.normalizeTagList(Array.isArray(entry.genreTags) ? entry.genreTags : []);
    if (!genreTags.length) {
      return '';
    }
    return genreTags.slice(0, 3).join(', ');
  }

  function makeRatingBadgeInternal(context: CardMetadataContext, rating: unknown, votes: unknown): HTMLElement {
    const badge = context.documentRef.createElement('span');
    badge.className = 'cw-rating-badge';

    if (rating != null && Number.isFinite(Number(rating))) {
      const normalized = Number(rating);
      badge.dataset.cwRatingState = 'ok';
      badge.textContent = `★ ${normalized.toFixed(1)}`;
      badge.title =
        votes != null ? `${normalized.toFixed(1)} (${formatVotesInternal(votes)} ratings)` : `${normalized.toFixed(1)}`;
      return badge;
    }

    badge.dataset.cwRatingState = 'missing';
    badge.textContent = 'NR';
    badge.title = 'No rating found';
    return badge;
  }

  function makeRatingHistogramInternal(
    context: CardMetadataContext,
    distribution: unknown,
    votes: unknown,
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

    const distributionRecord = distribution as Record<string, unknown>;
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

  function createCardMetadata(deps: CardMetadataDeps = {}): CardMetadataRuntime {
    const context = createCardMetadataContext(deps);
    return {
      formatVotes: (votes) => formatVotesInternal(votes),
      sanitizePercentage: (value) => context.sanitizePercentage(value),
      getStarCountFromDistribution: (votes, distribution, starLevel) =>
        context.getStarCountFromDistribution(votes, distribution, starLevel),
      getLastWatchedPresentation: (entry) => getLastWatchedPresentationInternal(context, entry),
      appendLabeledValue: (element, label, value) => appendLabeledValueInternal(element, label, value),
      setLabeledValue: (element, label, value) => setLabeledValueInternal(element, label, value),
      setLabeledValuePairs: (element, pairs) => setLabeledValuePairsInternal(element, pairs),
      getSeriesScopePairs: (entry) => getSeriesScopePairsInternal(context, entry),
      getGenreValue: (entry) => getGenreValueInternal(context, entry),
      makeRatingBadge: (rating, votes) => makeRatingBadgeInternal(context, rating, votes),
      makeRatingHistogram: (distribution, votes) => makeRatingHistogramInternal(context, distribution, votes),
    };
  }

  let uiRegistry = moduleRegistry.ui;
  if (!uiRegistry || typeof uiRegistry !== 'object') {
    uiRegistry = {};
    moduleRegistry.ui = uiRegistry;
  }

  (uiRegistry as Record<string, unknown>).cardMetadata = {
    createCardMetadata,
  };
})();
