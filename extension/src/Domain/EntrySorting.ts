type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type SanitizeNumberFn = (value: BoundaryValue) => number | null;
type VotesDistributionStarMetricFn = (
  votes: BoundaryValue,
  distribution: BoundaryValue,
  starLevel: BoundaryValue,
) => number | null;
type DistributionMetricFn = (distribution: BoundaryValue) => number | null;
type EntryMetricFn = (entry: BoundaryValue) => number | null;

type EntrySortingDeps = {
  sanitizeVotes?: SanitizeNumberFn;
  sanitizePositiveInt?: SanitizeNumberFn;
  parseDateMs?: SanitizeNumberFn;
  getStarCountFromDistribution?: VotesDistributionStarMetricFn;
  getStarPercentageFromDistribution?: (distribution: BoundaryValue, starLevel: BoundaryValue) => number | null;
  getTotalStarPoints?: (votes: BoundaryValue, distribution: BoundaryValue) => number | null;
  getConsensusQualityScore?: DistributionMetricFn;
  getControversyScore?: DistributionMetricFn;
  getQualityFloorScore?: DistributionMetricFn;
  getQuickWinScore?: EntryMetricFn;
  getDormantBacklogScore?: EntryMetricFn;
  getRewatchMemoryScore?: EntryMetricFn;
  getWatchedEpisodeEstimate?: EntryMetricFn;
  getRewatchActivityTimestamp?: EntryMetricFn;
  getMostRecentActivityTimestamp?: EntryMetricFn;
  getPlausiblePastTimestamp?: SanitizeNumberFn;
};

type EntrySortingContext = {
  sanitizeVotes: SanitizeNumberFn;
  sanitizePositiveInt: SanitizeNumberFn;
  parseDateMs: SanitizeNumberFn;
  getStarCountFromDistribution: VotesDistributionStarMetricFn;
  getStarPercentageFromDistribution: (distribution: BoundaryValue, starLevel: BoundaryValue) => number | null;
  getTotalStarPoints: (votes: BoundaryValue, distribution: BoundaryValue) => number | null;
  getConsensusQualityScore: DistributionMetricFn;
  getControversyScore: DistributionMetricFn;
  getQualityFloorScore: DistributionMetricFn;
  getQuickWinScore: EntryMetricFn;
  getDormantBacklogScore: EntryMetricFn;
  getRewatchMemoryScore: EntryMetricFn;
  getWatchedEpisodeEstimate: EntryMetricFn;
  getRewatchActivityTimestamp: EntryMetricFn;
  getMostRecentActivityTimestamp: EntryMetricFn;
  getPlausiblePastTimestamp: SanitizeNumberFn;
};

type EntrySortingRuntime = {
  compareRenderableEntries: (left: BoundaryValue, right: BoundaryValue, sortMode: BoundaryValue) => number;
};

type EntrySortingModule = {
  createEntrySorting: (deps?: EntrySortingDeps) => EntrySortingRuntime;
};

function requireFunction<T>(name: string, value: T | undefined): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing entry sorting dependency: ${name}`);
  }
  return value;
}

function createEntrySortingContext(deps: EntrySortingDeps = {}): EntrySortingContext {
  return {
    sanitizeVotes: requireFunction<SanitizeNumberFn>('sanitizeVotes', deps.sanitizeVotes),
    sanitizePositiveInt: requireFunction<SanitizeNumberFn>('sanitizePositiveInt', deps.sanitizePositiveInt),
    parseDateMs: requireFunction<SanitizeNumberFn>('parseDateMs', deps.parseDateMs),
    getStarCountFromDistribution: requireFunction<VotesDistributionStarMetricFn>(
      'getStarCountFromDistribution',
      deps.getStarCountFromDistribution,
    ),
    getStarPercentageFromDistribution: requireFunction<
      (distribution: BoundaryValue, starLevel: BoundaryValue) => number | null
    >('getStarPercentageFromDistribution', deps.getStarPercentageFromDistribution),
    getTotalStarPoints: requireFunction<(votes: BoundaryValue, distribution: BoundaryValue) => number | null>(
      'getTotalStarPoints',
      deps.getTotalStarPoints,
    ),
    getConsensusQualityScore: requireFunction<DistributionMetricFn>(
      'getConsensusQualityScore',
      deps.getConsensusQualityScore,
    ),
    getControversyScore: requireFunction<DistributionMetricFn>('getControversyScore', deps.getControversyScore),
    getQualityFloorScore: requireFunction<DistributionMetricFn>('getQualityFloorScore', deps.getQualityFloorScore),
    getQuickWinScore: requireFunction<EntryMetricFn>('getQuickWinScore', deps.getQuickWinScore),
    getDormantBacklogScore: requireFunction<EntryMetricFn>('getDormantBacklogScore', deps.getDormantBacklogScore),
    getRewatchMemoryScore: requireFunction<EntryMetricFn>('getRewatchMemoryScore', deps.getRewatchMemoryScore),
    getWatchedEpisodeEstimate: requireFunction<EntryMetricFn>(
      'getWatchedEpisodeEstimate',
      deps.getWatchedEpisodeEstimate,
    ),
    getRewatchActivityTimestamp: requireFunction<EntryMetricFn>(
      'getRewatchActivityTimestamp',
      deps.getRewatchActivityTimestamp,
    ),
    getMostRecentActivityTimestamp: requireFunction<EntryMetricFn>(
      'getMostRecentActivityTimestamp',
      deps.getMostRecentActivityTimestamp,
    ),
    getPlausiblePastTimestamp: requireFunction<SanitizeNumberFn>(
      'getPlausiblePastTimestamp',
      deps.getPlausiblePastTimestamp,
    ),
  };
}

function asRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as BoundaryRecord;
}

function compareByOriginalIndex(left: BoundaryValue, right: BoundaryValue): number {
  const leftIndex = Number(asRecord(left).originalIndex ?? 0);
  const rightIndex = Number(asRecord(right).originalIndex ?? 0);
  return leftIndex - rightIndex;
}

function compareOptionalNumbers(
  leftValue: number | null,
  rightValue: number | null,
  { ascending = false, missingSentinel }: { ascending?: boolean; missingSentinel?: number } = {},
): number {
  const sentinel = missingSentinel ?? (ascending ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  const normalizedLeft = leftValue == null ? sentinel : leftValue;
  const normalizedRight = rightValue == null ? sentinel : rightValue;
  if (normalizedLeft === normalizedRight) {
    return 0;
  }
  return ascending ? normalizedLeft - normalizedRight : normalizedRight - normalizedLeft;
}

function compareRatingSortMode(
  left: BoundaryValue,
  right: BoundaryValue,
  leftRating: number | null,
  rightRating: number | null,
  ascending: boolean,
): number {
  const diff = compareOptionalNumbers(leftRating, rightRating, { ascending });
  if (diff !== 0) {
    return diff;
  }
  return compareByOriginalIndex(left, right);
}

function compareHiddenGemsSortMode(
  context: EntrySortingContext,
  left: BoundaryValue,
  right: BoundaryValue,
  leftRating: number | null,
  rightRating: number | null,
): number {
  const ratingDiff = compareOptionalNumbers(leftRating, rightRating, { ascending: false });
  if (ratingDiff !== 0) {
    return ratingDiff;
  }
  const leftVotes = context.sanitizeVotes(asRecord(left).votes);
  const rightVotes = context.sanitizeVotes(asRecord(right).votes);
  const votesDiff = compareOptionalNumbers(leftVotes, rightVotes, { ascending: true });
  if (votesDiff !== 0) {
    return votesDiff;
  }
  return compareByOriginalIndex(left, right);
}

function compareRewatchMemorySortMode(context: EntrySortingContext, left: BoundaryValue, right: BoundaryValue): number {
  const scoreDiff = compareOptionalNumbers(context.getRewatchMemoryScore(left), context.getRewatchMemoryScore(right), {
    ascending: false,
  });
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const watchedDiff = compareOptionalNumbers(
    context.getWatchedEpisodeEstimate(left),
    context.getWatchedEpisodeEstimate(right),
    { ascending: false },
  );
  if (watchedDiff !== 0) {
    return watchedDiff;
  }

  const leftEpisodeCount = context.sanitizePositiveInt(asRecord(left).episodeCount);
  const rightEpisodeCount = context.sanitizePositiveInt(asRecord(right).episodeCount);
  const episodesDiff = compareOptionalNumbers(leftEpisodeCount, rightEpisodeCount, { ascending: false });
  if (episodesDiff !== 0) {
    return episodesDiff;
  }

  const leftRecord = asRecord(left);
  const rightRecord = asRecord(right);
  const leftActivityMs =
    context.getRewatchActivityTimestamp(leftRecord) ??
    context.getPlausiblePastTimestamp(leftRecord.dateUpdatedMs) ??
    context.getPlausiblePastTimestamp(leftRecord.dateAddedMs);
  const rightActivityMs =
    context.getRewatchActivityTimestamp(rightRecord) ??
    context.getPlausiblePastTimestamp(rightRecord.dateUpdatedMs) ??
    context.getPlausiblePastTimestamp(rightRecord.dateAddedMs);
  const activityDiff = compareOptionalNumbers(leftActivityMs, rightActivityMs, { ascending: true });
  if (activityDiff !== 0) {
    return activityDiff;
  }

  return compareByOriginalIndex(left, right);
}

function getNumericSortValue(context: EntrySortingContext, entry: BoundaryValue, sortMode: string): number | null {
  const record = asRecord(entry);
  switch (sortMode) {
    case 'votes_desc':
      return context.sanitizeVotes(record.votes);
    case 'star_points_desc':
      return context.getTotalStarPoints(record.votes, record.distribution);
    case 'star_5_desc':
      return context.getStarCountFromDistribution(record.votes, record.distribution, 5);
    case 'star_4_desc':
      return context.getStarCountFromDistribution(record.votes, record.distribution, 4);
    case 'star_3_desc':
      return context.getStarCountFromDistribution(record.votes, record.distribution, 3);
    case 'star_2_desc':
      return context.getStarCountFromDistribution(record.votes, record.distribution, 2);
    case 'star_1_desc':
      return context.getStarCountFromDistribution(record.votes, record.distribution, 1);
    case 'star_5_pct_desc':
      return context.getStarPercentageFromDistribution(record.distribution, 5);
    case 'star_4_pct_desc':
      return context.getStarPercentageFromDistribution(record.distribution, 4);
    case 'star_3_pct_desc':
      return context.getStarPercentageFromDistribution(record.distribution, 3);
    case 'star_2_pct_desc':
      return context.getStarPercentageFromDistribution(record.distribution, 2);
    case 'star_1_pct_desc':
      return context.getStarPercentageFromDistribution(record.distribution, 1);
    case 'consensus_quality_desc':
      return context.getConsensusQualityScore(record.distribution);
    case 'controversial_desc':
      return context.getControversyScore(record.distribution);
    case 'quality_floor_asc':
      return context.getQualityFloorScore(record.distribution);
    case 'quick_wins_asc':
      return context.getQuickWinScore(record);
    case 'dormant_backlog_asc':
      return context.getDormantBacklogScore(record);
    case 'recent_activity_desc':
      return context.getMostRecentActivityTimestamp(record);
    case 'date_added_desc':
    case 'date_added_asc':
      return context.parseDateMs(record.dateAddedMs);
    case 'date_updated_desc':
    case 'date_updated_asc':
      return context.parseDateMs(record.dateUpdatedMs);
    default:
      return null;
  }
}

function compareNumericSortMode(
  context: EntrySortingContext,
  left: BoundaryValue,
  right: BoundaryValue,
  sortMode: string,
): number | null {
  const leftValue = getNumericSortValue(context, left, sortMode);
  const rightValue = getNumericSortValue(context, right, sortMode);
  if (leftValue == null && rightValue == null) {
    return null;
  }
  const isAscending = sortMode.endsWith('_asc');
  const diff = compareOptionalNumbers(leftValue, rightValue, { ascending: isAscending });
  if (diff !== 0) {
    return diff;
  }
  return compareByOriginalIndex(left, right);
}

function compareRenderableEntriesInternal(
  context: EntrySortingContext,
  left: BoundaryValue,
  right: BoundaryValue,
  sortModeValue: BoundaryValue,
): number {
  const sortMode = typeof sortModeValue === 'string' ? sortModeValue : 'none';
  const leftRatingRecord = asRecord(left);
  const rightRatingRecord = asRecord(right);
  const leftRating = leftRatingRecord.rating == null ? null : Number(leftRatingRecord.rating);
  const rightRating = rightRatingRecord.rating == null ? null : Number(rightRatingRecord.rating);

  if (sortMode === 'rating_desc') {
    return compareRatingSortMode(left, right, leftRating, rightRating, false);
  }
  if (sortMode === 'rating_asc') {
    return compareRatingSortMode(left, right, leftRating, rightRating, true);
  }
  if (sortMode === 'hidden_gems_desc') {
    return compareHiddenGemsSortMode(context, left, right, leftRating, rightRating);
  }
  if (sortMode === 'rewatch_memory_desc') {
    return compareRewatchMemorySortMode(context, left, right);
  }

  const numericSortResult = compareNumericSortMode(context, left, right, sortMode);
  if (numericSortResult != null) {
    return numericSortResult;
  }
  return compareByOriginalIndex(left, right);
}

function createEntrySorting(deps: EntrySortingDeps = {}): EntrySortingRuntime {
  const context = createEntrySortingContext(deps);
  return {
    compareRenderableEntries: (left, right, sortMode) =>
      compareRenderableEntriesInternal(context, left, right, sortMode),
  };
}

const entrySortingRuntime: EntrySortingModule = {
  createEntrySorting,
};

export function createEntrySortingRuntime(): EntrySortingModule {
  return entrySortingRuntime;
}
