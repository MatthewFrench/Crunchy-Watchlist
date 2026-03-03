type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type SanitizeNumberFn = (value: BoundaryValue) => number | null;
type PickFirstPositiveIntFn = (values: BoundaryValue[]) => number | null;

type SortMetricsContext = {
  sanitizePercentage: SanitizeNumberFn;
  sanitizeVotes: SanitizeNumberFn;
  sanitizePositiveInt: SanitizeNumberFn;
  parseDateMs: SanitizeNumberFn;
  pickFirstPositiveInt: PickFirstPositiveIntFn;
};

type SortMetricsDeps = {
  sanitizePercentage?: SanitizeNumberFn;
  sanitizeVotes?: SanitizeNumberFn;
  sanitizePositiveInt?: SanitizeNumberFn;
  parseDateMs?: SanitizeNumberFn;
  pickFirstPositiveInt?: PickFirstPositiveIntFn;
};

type SortMetricsDomain = {
  getStarCountFromDistribution: (
    votes: BoundaryValue,
    distribution: BoundaryValue,
    starLevel: BoundaryValue,
  ) => number | null;
  getStarPercentageFromDistribution: (distribution: BoundaryValue, starLevel: BoundaryValue) => number | null;
  getTotalStarPoints: (votes: BoundaryValue, distribution: BoundaryValue) => number | null;
  getConsensusQualityScore: (distribution: BoundaryValue) => number | null;
  getControversyScore: (distribution: BoundaryValue) => number | null;
  getQualityFloorScore: (distribution: BoundaryValue) => number | null;
  getQuickWinScore: (entry: BoundaryValue) => number | null;
  getWatchedEpisodeEstimate: (entry: BoundaryValue) => number | null;
  getPlausiblePastTimestamp: (value: BoundaryValue) => number | null;
  getRewatchActivityTimestamp: (entry: BoundaryValue) => number | null;
  getMostRecentActivityTimestamp: (entry: BoundaryValue) => number | null;
  getDormantBacklogScore: (entry: BoundaryValue) => number | null;
  getRewatchMemoryScore: (entry: BoundaryValue) => number | null;
  estimateUnwatchedEpisodesLeft: (entry: BoundaryValue) => number | null;
};

type SortMetricsEntry = {
  fullyWatched?: BoundaryValue;
  neverWatched?: BoundaryValue;
  playheadMs?: BoundaryValue;
  episodeCount?: BoundaryValue;
  absoluteEpisodeNumber?: BoundaryValue;
  seasonNumber?: BoundaryValue;
  episodeNumber?: BoundaryValue;
  watchReady?: BoundaryValue;
  lastWatchedMs?: BoundaryValue;
  dateUpdatedMs?: BoundaryValue;
  dateAddedMs?: BoundaryValue;
  watchHistoryProgressEntry?: {
    absoluteEpisodeNumber?: BoundaryValue;
    seasonNumber?: BoundaryValue;
    episodeNumber?: BoundaryValue;
    fullyWatched?: BoundaryValue;
    playhead?: BoundaryValue;
    playheadMs?: BoundaryValue;
    progressMs?: BoundaryValue;
  } | null;
};

type SortMetricsModule = {
  createSortMetrics: (deps?: SortMetricsDeps) => SortMetricsDomain;
};

function requireFunction<T>(name: string, value: T | undefined): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing sort metrics dependency: ${name}`);
  }
  return value;
}

function createSortMetricsContext(deps: SortMetricsDeps = {}): SortMetricsContext {
  return {
    sanitizePercentage: requireFunction<SanitizeNumberFn>('sanitizePercentage', deps.sanitizePercentage),
    sanitizeVotes: requireFunction<SanitizeNumberFn>('sanitizeVotes', deps.sanitizeVotes),
    sanitizePositiveInt: requireFunction<SanitizeNumberFn>('sanitizePositiveInt', deps.sanitizePositiveInt),
    parseDateMs: requireFunction<SanitizeNumberFn>('parseDateMs', deps.parseDateMs),
    pickFirstPositiveInt: requireFunction<PickFirstPositiveIntFn>('pickFirstPositiveInt', deps.pickFirstPositiveInt),
  };
}

function asBoundaryRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as BoundaryRecord;
}

function asSortMetricsEntry(value: BoundaryValue): SortMetricsEntry {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as SortMetricsEntry;
}

function getStarPercentageFromDistributionInternal(
  context: SortMetricsContext,
  distribution: BoundaryValue,
  starLevel: BoundaryValue,
): number | null {
  if (!distribution || typeof distribution !== 'object') {
    return null;
  }
  return context.sanitizePercentage(asBoundaryRecord(distribution)[String(starLevel)]);
}

function getStarCountFromDistributionInternal(
  context: SortMetricsContext,
  votes: BoundaryValue,
  distribution: BoundaryValue,
  starLevel: BoundaryValue,
): number | null {
  const percentage = getStarPercentageFromDistributionInternal(context, distribution, starLevel);
  const normalizedVotes = context.sanitizeVotes(votes);
  if (percentage == null || normalizedVotes == null) {
    return null;
  }
  return Math.round((normalizedVotes * percentage) / 100);
}

function getTotalStarPointsInternal(
  context: SortMetricsContext,
  votes: BoundaryValue,
  distribution: BoundaryValue,
): number | null {
  let total = 0;
  let hasAny = false;

  for (let star = 1; star <= 5; star += 1) {
    const count = getStarCountFromDistributionInternal(context, votes, distribution, star);
    if (count == null) {
      continue;
    }

    hasAny = true;
    total += count * star;
  }

  return hasAny ? total : null;
}

function getConsensusQualityScoreInternal(context: SortMetricsContext, distribution: BoundaryValue): number | null {
  const p5 = getStarPercentageFromDistributionInternal(context, distribution, 5);
  const p4 = getStarPercentageFromDistributionInternal(context, distribution, 4);
  const p2 = getStarPercentageFromDistributionInternal(context, distribution, 2);
  const p1 = getStarPercentageFromDistributionInternal(context, distribution, 1);

  if (p5 == null && p4 == null && p2 == null && p1 == null) {
    return null;
  }

  return (p5 ?? 0) + (p4 ?? 0) - (p2 ?? 0) - (p1 ?? 0);
}

function getControversyScoreInternal(context: SortMetricsContext, distribution: BoundaryValue): number | null {
  if (!distribution || typeof distribution !== 'object') {
    return null;
  }

  const buckets = [];
  for (let star = 1; star <= 5; star += 1) {
    const percentage = getStarPercentageFromDistributionInternal(context, distribution, star);
    if (percentage != null && percentage > 0) {
      buckets.push({ star, percentage });
    }
  }

  const totalPercentage = buckets.reduce((sum, bucket) => sum + bucket.percentage, 0);
  if (!buckets.length || totalPercentage <= 0) {
    return null;
  }

  const mean = buckets.reduce((sum, bucket) => sum + bucket.star * (bucket.percentage / totalPercentage), 0);
  return buckets.reduce((sum, bucket) => sum + (bucket.star - mean) ** 2 * (bucket.percentage / totalPercentage), 0);
}

function getQualityFloorScoreInternal(context: SortMetricsContext, distribution: BoundaryValue): number | null {
  const p1 = getStarPercentageFromDistributionInternal(context, distribution, 1);
  const p2 = getStarPercentageFromDistributionInternal(context, distribution, 2);
  if (p1 == null && p2 == null) {
    return null;
  }

  return (p1 ?? 0) * 2 + (p2 ?? 0);
}

function resolveEpisodeIndexCandidate(
  context: SortMetricsContext,
  totalEpisodes: number | null,
  absoluteEpisodeNumber: BoundaryValue,
  episodeNumber: BoundaryValue,
): number | null {
  const absoluteEpisodeIndex = context.sanitizePositiveInt(absoluteEpisodeNumber);
  if (absoluteEpisodeIndex != null) {
    return absoluteEpisodeIndex;
  }

  const seasonEpisodeIndex = context.sanitizePositiveInt(episodeNumber);
  if (seasonEpisodeIndex == null) {
    return null;
  }

  if (totalEpisodes != null && seasonEpisodeIndex > totalEpisodes) {
    return null;
  }

  return seasonEpisodeIndex;
}

function estimateUnwatchedEpisodesLeftInternal(context: SortMetricsContext, entryValue: BoundaryValue): number | null {
  const entry = asSortMetricsEntry(entryValue);
  const filteredProgressEntry =
    entry.watchHistoryProgressEntry && typeof entry.watchHistoryProgressEntry === 'object'
      ? entry.watchHistoryProgressEntry
      : null;
  const totalEpisodes = context.sanitizePositiveInt(entry.episodeCount);
  if (totalEpisodes == null) {
    return null;
  }

  if (entry.fullyWatched) {
    return 0;
  }

  const overrideEpisodeIndex = resolveEpisodeIndexCandidate(
    context,
    totalEpisodes,
    filteredProgressEntry?.absoluteEpisodeNumber,
    filteredProgressEntry?.episodeNumber,
  );
  const entryEpisodeIndex = resolveEpisodeIndexCandidate(
    context,
    totalEpisodes,
    entry.absoluteEpisodeNumber,
    entry.episodeNumber,
  );
  const hasOverrideProgressSignal =
    overrideEpisodeIndex != null ||
    Number(filteredProgressEntry?.playhead || 0) > 0 ||
    Number(filteredProgressEntry?.playheadMs || 0) > 0 ||
    Number(filteredProgressEntry?.progressMs || 0) > 0;
  const hasEntryProgressSignal = Number(entry.playheadMs || 0) > 0 || entryEpisodeIndex != null;

  if (entry.neverWatched && !hasOverrideProgressSignal && !hasEntryProgressSignal) {
    return totalEpisodes;
  }

  if (filteredProgressEntry?.fullyWatched && overrideEpisodeIndex != null && overrideEpisodeIndex >= totalEpisodes) {
    return 0;
  }

  const overrideNextEpisodeIndex =
    overrideEpisodeIndex != null ? overrideEpisodeIndex + (filteredProgressEntry?.fullyWatched ? 1 : 0) : null;
  const entryNextEpisodeIndex = entryEpisodeIndex;

  const nextEpisodeIndexCandidates = [overrideNextEpisodeIndex, entryNextEpisodeIndex].filter(
    (value): value is number => value != null,
  );
  const nextEpisodeIndex = nextEpisodeIndexCandidates.length > 0 ? Math.max(...nextEpisodeIndexCandidates) : null;

  if (nextEpisodeIndex == null) {
    return null;
  }

  return Math.max(0, totalEpisodes - nextEpisodeIndex + 1);
}

function getWatchedEpisodeEstimateInternal(context: SortMetricsContext, entryValue: BoundaryValue): number | null {
  const entry = asSortMetricsEntry(entryValue);
  const totalEpisodes = context.sanitizePositiveInt(entry.episodeCount);
  if (totalEpisodes == null) {
    return null;
  }

  const unwatchedLeft = estimateUnwatchedEpisodesLeftInternal(context, entry);
  if (unwatchedLeft == null) {
    return null;
  }

  return Math.max(0, totalEpisodes - Math.max(0, Number(unwatchedLeft) || 0));
}

function getPlausiblePastTimestampInternal(context: SortMetricsContext, value: BoundaryValue): number | null {
  const parsed = context.parseDateMs(value);
  if (parsed == null) {
    return null;
  }

  const latestAllowed = Date.now() + 2 * 24 * 60 * 60 * 1000;
  if (parsed > latestAllowed) {
    return null;
  }

  return parsed;
}

function getRewatchActivityTimestampInternal(context: SortMetricsContext, entryValue: BoundaryValue): number | null {
  const entry = asSortMetricsEntry(entryValue);
  const lastWatched = getPlausiblePastTimestampInternal(context, entry.lastWatchedMs);
  if (lastWatched != null) {
    return lastWatched;
  }

  const watchedEpisodes = getWatchedEpisodeEstimateInternal(context, entry);
  if (watchedEpisodes == null || watchedEpisodes <= 0) {
    return null;
  }

  return (
    getPlausiblePastTimestampInternal(context, entry.dateUpdatedMs) ??
    getPlausiblePastTimestampInternal(context, entry.dateAddedMs)
  );
}

function getMostRecentActivityTimestampInternal(context: SortMetricsContext, entryValue: BoundaryValue): number | null {
  const entry = asSortMetricsEntry(entryValue);

  // "Activity of any kind" includes watch progress, watchlist updates, and original add date.
  const candidates = [
    getPlausiblePastTimestampInternal(context, entry.lastWatchedMs),
    getPlausiblePastTimestampInternal(context, entry.dateUpdatedMs),
    getPlausiblePastTimestampInternal(context, entry.dateAddedMs),
  ].filter((value): value is number => value != null);

  if (!candidates.length) {
    return null;
  }

  return Math.max(...candidates);
}

function getQuickWinScoreInternal(context: SortMetricsContext, entryValue: BoundaryValue): number | null {
  const entry = asSortMetricsEntry(entryValue);
  const unwatchedLeft = estimateUnwatchedEpisodesLeftInternal(context, entry);
  const remaining = unwatchedLeft ?? context.sanitizePositiveInt(entry.episodeCount);
  if (remaining == null) {
    return null;
  }

  const watchReadyPenalty = entry.watchReady ? 0 : 100000;
  return watchReadyPenalty + remaining;
}

function getDormantBacklogScoreInternal(context: SortMetricsContext, entryValue: BoundaryValue): number | null {
  const entry = asSortMetricsEntry(entryValue);
  const updatedAt =
    getRewatchActivityTimestampInternal(context, entry) ??
    getPlausiblePastTimestampInternal(context, entry.dateUpdatedMs) ??
    getPlausiblePastTimestampInternal(context, entry.dateAddedMs);
  if (updatedAt == null) {
    return null;
  }

  const watchReadyPenalty = entry.watchReady ? 0 : 10000000000000;
  return watchReadyPenalty + updatedAt;
}

function getRewatchMemoryScoreInternal(context: SortMetricsContext, entryValue: BoundaryValue): number | null {
  const entry = asSortMetricsEntry(entryValue);
  const updatedAt = getRewatchActivityTimestampInternal(context, entry);
  const episodeCount = context.sanitizePositiveInt(entry.episodeCount);
  if (updatedAt == null || episodeCount == null) {
    return null;
  }

  const watchedEpisodes = getWatchedEpisodeEstimateInternal(context, entry);
  if (watchedEpisodes == null || watchedEpisodes <= 0) {
    return null;
  }

  const watchedRatio = watchedEpisodes / episodeCount;
  if (!Number.isFinite(watchedRatio) || watchedRatio < 0.2) {
    return null;
  }

  const dormantDays = Math.max(0, (Date.now() - updatedAt) / (24 * 60 * 60 * 1000));
  if (dormantDays < 21) {
    return null;
  }

  const lengthFactor = 1 + Math.max(0, episodeCount - 12) / 24;
  const progressFactor = 0.5 + watchedRatio;
  return watchedEpisodes * dormantDays * lengthFactor * progressFactor;
}

function createSortMetrics(deps: SortMetricsDeps = {}): SortMetricsDomain {
  const context = createSortMetricsContext(deps);
  return {
    getStarCountFromDistribution: (votes, distribution, starLevel) =>
      getStarCountFromDistributionInternal(context, votes, distribution, starLevel),
    getStarPercentageFromDistribution: (distribution, starLevel) =>
      getStarPercentageFromDistributionInternal(context, distribution, starLevel),
    getTotalStarPoints: (votes, distribution) => getTotalStarPointsInternal(context, votes, distribution),
    getConsensusQualityScore: (distribution) => getConsensusQualityScoreInternal(context, distribution),
    getControversyScore: (distribution) => getControversyScoreInternal(context, distribution),
    getQualityFloorScore: (distribution) => getQualityFloorScoreInternal(context, distribution),
    getQuickWinScore: (entry) => getQuickWinScoreInternal(context, entry),
    getWatchedEpisodeEstimate: (entry) => getWatchedEpisodeEstimateInternal(context, entry),
    getPlausiblePastTimestamp: (value) => getPlausiblePastTimestampInternal(context, value),
    getRewatchActivityTimestamp: (entry) => getRewatchActivityTimestampInternal(context, entry),
    getMostRecentActivityTimestamp: (entry) => getMostRecentActivityTimestampInternal(context, entry),
    getDormantBacklogScore: (entry) => getDormantBacklogScoreInternal(context, entry),
    getRewatchMemoryScore: (entry) => getRewatchMemoryScoreInternal(context, entry),
    estimateUnwatchedEpisodesLeft: (entry) => estimateUnwatchedEpisodesLeftInternal(context, entry),
  };
}

const sortMetricsRuntime: SortMetricsModule = {
  createSortMetrics,
};

export function createSortMetricsRuntime(): SortMetricsModule {
  return sortMetricsRuntime;
}
