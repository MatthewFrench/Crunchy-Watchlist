(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type SortMetricsContext = {
    sanitizePercentage: (value: unknown) => number | null;
    sanitizeVotes: (value: unknown) => number | null;
    sanitizePositiveInt: (value: unknown) => number | null;
    parseDateMs: (value: unknown) => number | null;
    pickFirstPositiveInt: (values: unknown[]) => number | null;
  };

  type SortMetricsDeps = {
    sanitizePercentage?: unknown;
    sanitizeVotes?: unknown;
    sanitizePositiveInt?: unknown;
    parseDateMs?: unknown;
    pickFirstPositiveInt?: unknown;
  };

  type SortMetricsDomain = {
    getStarCountFromDistribution: (votes: unknown, distribution: unknown, starLevel: unknown) => number | null;
    getStarPercentageFromDistribution: (distribution: unknown, starLevel: unknown) => number | null;
    getTotalStarPoints: (votes: unknown, distribution: unknown) => number | null;
    getConsensusQualityScore: (distribution: unknown) => number | null;
    getControversyScore: (distribution: unknown) => number | null;
    getQualityFloorScore: (distribution: unknown) => number | null;
    getQuickWinScore: (entry: unknown) => number | null;
    getWatchedEpisodeEstimate: (entry: unknown) => number | null;
    getPlausiblePastTimestamp: (value: unknown) => number | null;
    getRewatchActivityTimestamp: (entry: unknown) => number | null;
    getMostRecentActivityTimestamp: (entry: unknown) => number | null;
    getDormantBacklogScore: (entry: unknown) => number | null;
    getRewatchMemoryScore: (entry: unknown) => number | null;
    estimateUnwatchedEpisodesLeft: (entry: unknown) => number | null;
  };

  type SortMetricsEntry = {
    fullyWatched?: unknown;
    neverWatched?: unknown;
    playheadMs?: unknown;
    episodeCount?: unknown;
    absoluteEpisodeNumber?: unknown;
    seasonNumber?: unknown;
    episodeNumber?: unknown;
    watchReady?: unknown;
    lastWatchedMs?: unknown;
    dateUpdatedMs?: unknown;
    dateAddedMs?: unknown;
    watchHistoryProgressEntry?: {
      absoluteEpisodeNumber?: unknown;
      seasonNumber?: unknown;
      episodeNumber?: unknown;
      fullyWatched?: unknown;
      playhead?: unknown;
      playheadMs?: unknown;
      progressMs?: unknown;
    } | null;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing sort metrics dependency: ${name}`);
    }
    return value as T;
  }

  function createSortMetricsContext(deps: SortMetricsDeps = {}): SortMetricsContext {
    return {
      sanitizePercentage: requireFunction(
        'sanitizePercentage',
        deps.sanitizePercentage,
      ) as SortMetricsContext['sanitizePercentage'],
      sanitizeVotes: requireFunction('sanitizeVotes', deps.sanitizeVotes) as SortMetricsContext['sanitizeVotes'],
      sanitizePositiveInt: requireFunction(
        'sanitizePositiveInt',
        deps.sanitizePositiveInt,
      ) as SortMetricsContext['sanitizePositiveInt'],
      parseDateMs: requireFunction('parseDateMs', deps.parseDateMs) as SortMetricsContext['parseDateMs'],
      pickFirstPositiveInt: requireFunction(
        'pickFirstPositiveInt',
        deps.pickFirstPositiveInt,
      ) as SortMetricsContext['pickFirstPositiveInt'],
    };
  }

  function asSortMetricsEntry(value: unknown): SortMetricsEntry {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return value as SortMetricsEntry;
  }

  function getStarPercentageFromDistributionInternal(
    context: SortMetricsContext,
    distribution: unknown,
    starLevel: unknown,
  ): number | null {
    if (!distribution || typeof distribution !== 'object') {
      return null;
    }
    return context.sanitizePercentage((distribution as Record<string, unknown>)[String(starLevel)]);
  }

  function getStarCountFromDistributionInternal(
    context: SortMetricsContext,
    votes: unknown,
    distribution: unknown,
    starLevel: unknown,
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
    votes: unknown,
    distribution: unknown,
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

  function getConsensusQualityScoreInternal(context: SortMetricsContext, distribution: unknown): number | null {
    const p5 = getStarPercentageFromDistributionInternal(context, distribution, 5);
    const p4 = getStarPercentageFromDistributionInternal(context, distribution, 4);
    const p2 = getStarPercentageFromDistributionInternal(context, distribution, 2);
    const p1 = getStarPercentageFromDistributionInternal(context, distribution, 1);

    if (p5 == null && p4 == null && p2 == null && p1 == null) {
      return null;
    }

    return (p5 ?? 0) + (p4 ?? 0) - (p2 ?? 0) - (p1 ?? 0);
  }

  function getControversyScoreInternal(context: SortMetricsContext, distribution: unknown): number | null {
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

  function getQualityFloorScoreInternal(context: SortMetricsContext, distribution: unknown): number | null {
    const p1 = getStarPercentageFromDistributionInternal(context, distribution, 1);
    const p2 = getStarPercentageFromDistributionInternal(context, distribution, 2);
    if (p1 == null && p2 == null) {
      return null;
    }

    return (p1 ?? 0) * 2 + (p2 ?? 0);
  }

  function estimateUnwatchedEpisodesLeftInternal(context: SortMetricsContext, entryValue: unknown): number | null {
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

    const overrideEpisodeIndex = context.pickFirstPositiveInt([
      filteredProgressEntry?.absoluteEpisodeNumber,
      filteredProgressEntry?.seasonNumber === 1 ? filteredProgressEntry?.episodeNumber : null,
    ]);
    const hasOverrideProgressSignal =
      overrideEpisodeIndex != null ||
      Number(filteredProgressEntry?.playhead || 0) > 0 ||
      Number(filteredProgressEntry?.playheadMs || 0) > 0 ||
      Number(filteredProgressEntry?.progressMs || 0) > 0;
    const hasEntryProgressSignal =
      Number(entry.playheadMs || 0) > 0 ||
      context.pickFirstPositiveInt([
        entry.absoluteEpisodeNumber,
        entry.seasonNumber === 1 ? entry.episodeNumber : null,
      ]) != null;

    if (entry.neverWatched && !hasOverrideProgressSignal && !hasEntryProgressSignal) {
      return totalEpisodes;
    }

    if (filteredProgressEntry?.fullyWatched && overrideEpisodeIndex != null && overrideEpisodeIndex >= totalEpisodes) {
      return 0;
    }

    const overrideNextEpisodeIndex =
      overrideEpisodeIndex != null ? overrideEpisodeIndex + (filteredProgressEntry?.fullyWatched ? 1 : 0) : null;

    const nextEpisodeIndex =
      overrideNextEpisodeIndex ??
      context.pickFirstPositiveInt([
        entry.absoluteEpisodeNumber,
        entry.seasonNumber === 1 ? entry.episodeNumber : null,
      ]);

    if (nextEpisodeIndex == null) {
      return null;
    }

    return Math.max(0, totalEpisodes - nextEpisodeIndex + 1);
  }

  function getWatchedEpisodeEstimateInternal(context: SortMetricsContext, entryValue: unknown): number | null {
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

  function getPlausiblePastTimestampInternal(context: SortMetricsContext, value: unknown): number | null {
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

  function getRewatchActivityTimestampInternal(context: SortMetricsContext, entryValue: unknown): number | null {
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

  function getMostRecentActivityTimestampInternal(context: SortMetricsContext, entryValue: unknown): number | null {
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

  function getQuickWinScoreInternal(context: SortMetricsContext, entryValue: unknown): number | null {
    const entry = asSortMetricsEntry(entryValue);
    const unwatchedLeft = estimateUnwatchedEpisodesLeftInternal(context, entry);
    const remaining = unwatchedLeft ?? context.sanitizePositiveInt(entry.episodeCount);
    if (remaining == null) {
      return null;
    }

    const watchReadyPenalty = entry.watchReady ? 0 : 100000;
    return watchReadyPenalty + remaining;
  }

  function getDormantBacklogScoreInternal(context: SortMetricsContext, entryValue: unknown): number | null {
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

  function getRewatchMemoryScoreInternal(context: SortMetricsContext, entryValue: unknown): number | null {
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

  let domainRegistry = moduleRegistry.domain;
  if (!domainRegistry || typeof domainRegistry !== 'object') {
    domainRegistry = {};
    moduleRegistry.domain = domainRegistry;
  }

  (domainRegistry as Record<string, unknown>).sortMetrics = {
    createSortMetrics,
  };
})();
