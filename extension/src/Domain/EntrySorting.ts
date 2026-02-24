;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type EntrySortingDeps = {
    sanitizeVotes?: unknown
    sanitizePositiveInt?: unknown
    parseDateMs?: unknown
    getStarCountFromDistribution?: unknown
    getStarPercentageFromDistribution?: unknown
    getTotalStarPoints?: unknown
    getConsensusQualityScore?: unknown
    getControversyScore?: unknown
    getQualityFloorScore?: unknown
    getQuickWinScore?: unknown
    getDormantBacklogScore?: unknown
    getRewatchMemoryScore?: unknown
    getWatchedEpisodeEstimate?: unknown
    getRewatchActivityTimestamp?: unknown
    getPlausiblePastTimestamp?: unknown
  }

  type EntrySortingContext = {
    sanitizeVotes: (value: unknown) => number | null
    sanitizePositiveInt: (value: unknown) => number | null
    parseDateMs: (value: unknown) => number | null
    getStarCountFromDistribution: (votes: unknown, distribution: unknown, starLevel: unknown) => number | null
    getStarPercentageFromDistribution: (distribution: unknown, starLevel: unknown) => number | null
    getTotalStarPoints: (votes: unknown, distribution: unknown) => number | null
    getConsensusQualityScore: (distribution: unknown) => number | null
    getControversyScore: (distribution: unknown) => number | null
    getQualityFloorScore: (distribution: unknown) => number | null
    getQuickWinScore: (entry: unknown) => number | null
    getDormantBacklogScore: (entry: unknown) => number | null
    getRewatchMemoryScore: (entry: unknown) => number | null
    getWatchedEpisodeEstimate: (entry: unknown) => number | null
    getRewatchActivityTimestamp: (entry: unknown) => number | null
    getPlausiblePastTimestamp: (value: unknown) => number | null
  }

  type EntrySortingRuntime = {
    compareRenderableEntries: (left: unknown, right: unknown, sortMode: unknown) => number
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing entry sorting dependency: ${name}`)
    }
    return value as T
  }

  function createEntrySortingContext(deps: EntrySortingDeps = {}): EntrySortingContext {
    return {
      sanitizeVotes: requireFunction('sanitizeVotes', deps.sanitizeVotes) as EntrySortingContext['sanitizeVotes'],
      sanitizePositiveInt: requireFunction(
        'sanitizePositiveInt',
        deps.sanitizePositiveInt,
      ) as EntrySortingContext['sanitizePositiveInt'],
      parseDateMs: requireFunction('parseDateMs', deps.parseDateMs) as EntrySortingContext['parseDateMs'],
      getStarCountFromDistribution: requireFunction(
        'getStarCountFromDistribution',
        deps.getStarCountFromDistribution,
      ) as EntrySortingContext['getStarCountFromDistribution'],
      getStarPercentageFromDistribution: requireFunction(
        'getStarPercentageFromDistribution',
        deps.getStarPercentageFromDistribution,
      ) as EntrySortingContext['getStarPercentageFromDistribution'],
      getTotalStarPoints: requireFunction(
        'getTotalStarPoints',
        deps.getTotalStarPoints,
      ) as EntrySortingContext['getTotalStarPoints'],
      getConsensusQualityScore: requireFunction(
        'getConsensusQualityScore',
        deps.getConsensusQualityScore,
      ) as EntrySortingContext['getConsensusQualityScore'],
      getControversyScore: requireFunction(
        'getControversyScore',
        deps.getControversyScore,
      ) as EntrySortingContext['getControversyScore'],
      getQualityFloorScore: requireFunction(
        'getQualityFloorScore',
        deps.getQualityFloorScore,
      ) as EntrySortingContext['getQualityFloorScore'],
      getQuickWinScore: requireFunction(
        'getQuickWinScore',
        deps.getQuickWinScore,
      ) as EntrySortingContext['getQuickWinScore'],
      getDormantBacklogScore: requireFunction(
        'getDormantBacklogScore',
        deps.getDormantBacklogScore,
      ) as EntrySortingContext['getDormantBacklogScore'],
      getRewatchMemoryScore: requireFunction(
        'getRewatchMemoryScore',
        deps.getRewatchMemoryScore,
      ) as EntrySortingContext['getRewatchMemoryScore'],
      getWatchedEpisodeEstimate: requireFunction(
        'getWatchedEpisodeEstimate',
        deps.getWatchedEpisodeEstimate,
      ) as EntrySortingContext['getWatchedEpisodeEstimate'],
      getRewatchActivityTimestamp: requireFunction(
        'getRewatchActivityTimestamp',
        deps.getRewatchActivityTimestamp,
      ) as EntrySortingContext['getRewatchActivityTimestamp'],
      getPlausiblePastTimestamp: requireFunction(
        'getPlausiblePastTimestamp',
        deps.getPlausiblePastTimestamp,
      ) as EntrySortingContext['getPlausiblePastTimestamp'],
    }
  }

  function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return {}
    }
    return value as Record<string, unknown>
  }

  function compareByOriginalIndex(left: unknown, right: unknown): number {
    const leftIndex = Number(asRecord(left).originalIndex ?? 0)
    const rightIndex = Number(asRecord(right).originalIndex ?? 0)
    return leftIndex - rightIndex
  }

  function compareOptionalNumbers(
    leftValue: number | null,
    rightValue: number | null,
    { ascending = false, missingSentinel }: { ascending?: boolean; missingSentinel?: number } = {},
  ): number {
    const sentinel = missingSentinel ?? (ascending ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY)
    const normalizedLeft = leftValue == null ? sentinel : leftValue
    const normalizedRight = rightValue == null ? sentinel : rightValue
    if (normalizedLeft === normalizedRight) {
      return 0
    }
    return ascending ? normalizedLeft - normalizedRight : normalizedRight - normalizedLeft
  }

  function compareRatingSortMode(
    left: unknown,
    right: unknown,
    leftRating: number | null,
    rightRating: number | null,
    ascending: boolean,
  ): number {
    const diff = compareOptionalNumbers(leftRating, rightRating, { ascending })
    if (diff !== 0) {
      return diff
    }
    return compareByOriginalIndex(left, right)
  }

  function compareHiddenGemsSortMode(
    context: EntrySortingContext,
    left: unknown,
    right: unknown,
    leftRating: number | null,
    rightRating: number | null,
  ): number {
    const ratingDiff = compareOptionalNumbers(leftRating, rightRating, { ascending: false })
    if (ratingDiff !== 0) {
      return ratingDiff
    }
    const leftVotes = context.sanitizeVotes(asRecord(left).votes)
    const rightVotes = context.sanitizeVotes(asRecord(right).votes)
    const votesDiff = compareOptionalNumbers(leftVotes, rightVotes, { ascending: true })
    if (votesDiff !== 0) {
      return votesDiff
    }
    return compareByOriginalIndex(left, right)
  }

  function compareRewatchMemorySortMode(context: EntrySortingContext, left: unknown, right: unknown): number {
    const scoreDiff = compareOptionalNumbers(
      context.getRewatchMemoryScore(left),
      context.getRewatchMemoryScore(right),
      {
        ascending: false,
      },
    )
    if (scoreDiff !== 0) {
      return scoreDiff
    }

    const watchedDiff = compareOptionalNumbers(
      context.getWatchedEpisodeEstimate(left),
      context.getWatchedEpisodeEstimate(right),
      { ascending: false },
    )
    if (watchedDiff !== 0) {
      return watchedDiff
    }

    const leftEpisodeCount = context.sanitizePositiveInt(asRecord(left).episodeCount)
    const rightEpisodeCount = context.sanitizePositiveInt(asRecord(right).episodeCount)
    const episodesDiff = compareOptionalNumbers(leftEpisodeCount, rightEpisodeCount, { ascending: false })
    if (episodesDiff !== 0) {
      return episodesDiff
    }

    const leftRecord = asRecord(left)
    const rightRecord = asRecord(right)
    const leftActivityMs =
      context.getRewatchActivityTimestamp(leftRecord) ??
      context.getPlausiblePastTimestamp(leftRecord.dateUpdatedMs) ??
      context.getPlausiblePastTimestamp(leftRecord.dateAddedMs)
    const rightActivityMs =
      context.getRewatchActivityTimestamp(rightRecord) ??
      context.getPlausiblePastTimestamp(rightRecord.dateUpdatedMs) ??
      context.getPlausiblePastTimestamp(rightRecord.dateAddedMs)
    const activityDiff = compareOptionalNumbers(leftActivityMs, rightActivityMs, { ascending: true })
    if (activityDiff !== 0) {
      return activityDiff
    }

    return compareByOriginalIndex(left, right)
  }

  function getNumericSortValue(context: EntrySortingContext, entry: unknown, sortMode: string): number | null {
    const record = asRecord(entry)
    switch (sortMode) {
      case 'votes_desc':
        return context.sanitizeVotes(record.votes)
      case 'star_points_desc':
        return context.getTotalStarPoints(record.votes, record.distribution)
      case 'star_5_desc':
        return context.getStarCountFromDistribution(record.votes, record.distribution, 5)
      case 'star_4_desc':
        return context.getStarCountFromDistribution(record.votes, record.distribution, 4)
      case 'star_3_desc':
        return context.getStarCountFromDistribution(record.votes, record.distribution, 3)
      case 'star_2_desc':
        return context.getStarCountFromDistribution(record.votes, record.distribution, 2)
      case 'star_1_desc':
        return context.getStarCountFromDistribution(record.votes, record.distribution, 1)
      case 'star_5_pct_desc':
        return context.getStarPercentageFromDistribution(record.distribution, 5)
      case 'star_4_pct_desc':
        return context.getStarPercentageFromDistribution(record.distribution, 4)
      case 'star_3_pct_desc':
        return context.getStarPercentageFromDistribution(record.distribution, 3)
      case 'star_2_pct_desc':
        return context.getStarPercentageFromDistribution(record.distribution, 2)
      case 'star_1_pct_desc':
        return context.getStarPercentageFromDistribution(record.distribution, 1)
      case 'consensus_quality_desc':
        return context.getConsensusQualityScore(record.distribution)
      case 'controversial_desc':
        return context.getControversyScore(record.distribution)
      case 'quality_floor_asc':
        return context.getQualityFloorScore(record.distribution)
      case 'quick_wins_asc':
        return context.getQuickWinScore(record)
      case 'dormant_backlog_asc':
        return context.getDormantBacklogScore(record)
      case 'date_added_desc':
      case 'date_added_asc':
        return context.parseDateMs(record.dateAddedMs)
      case 'date_updated_desc':
      case 'date_updated_asc':
        return context.parseDateMs(record.dateUpdatedMs)
      default:
        return null
    }
  }

  function compareNumericSortMode(
    context: EntrySortingContext,
    left: unknown,
    right: unknown,
    sortMode: string,
  ): number | null {
    const leftValue = getNumericSortValue(context, left, sortMode)
    const rightValue = getNumericSortValue(context, right, sortMode)
    if (leftValue == null && rightValue == null) {
      return null
    }
    const isAscending = sortMode.endsWith('_asc')
    const diff = compareOptionalNumbers(leftValue, rightValue, { ascending: isAscending })
    if (diff !== 0) {
      return diff
    }
    return compareByOriginalIndex(left, right)
  }

  function compareRenderableEntriesInternal(
    context: EntrySortingContext,
    left: unknown,
    right: unknown,
    sortModeValue: unknown,
  ): number {
    const sortMode = typeof sortModeValue === 'string' ? sortModeValue : 'none'
    const leftRatingRecord = asRecord(left)
    const rightRatingRecord = asRecord(right)
    const leftRating = leftRatingRecord.rating == null ? null : Number(leftRatingRecord.rating)
    const rightRating = rightRatingRecord.rating == null ? null : Number(rightRatingRecord.rating)

    if (sortMode === 'rating_desc') {
      return compareRatingSortMode(left, right, leftRating, rightRating, false)
    }
    if (sortMode === 'rating_asc') {
      return compareRatingSortMode(left, right, leftRating, rightRating, true)
    }
    if (sortMode === 'hidden_gems_desc') {
      return compareHiddenGemsSortMode(context, left, right, leftRating, rightRating)
    }
    if (sortMode === 'rewatch_memory_desc') {
      return compareRewatchMemorySortMode(context, left, right)
    }

    const numericSortResult = compareNumericSortMode(context, left, right, sortMode)
    if (numericSortResult != null) {
      return numericSortResult
    }
    return compareByOriginalIndex(left, right)
  }

  function createEntrySorting(deps: EntrySortingDeps = {}): EntrySortingRuntime {
    const context = createEntrySortingContext(deps)
    return {
      compareRenderableEntries: (left, right, sortMode) =>
        compareRenderableEntriesInternal(context, left, right, sortMode),
    }
  }

  let domainRegistry = moduleRegistry.domain
  if (!domainRegistry || typeof domainRegistry !== 'object') {
    domainRegistry = {}
    moduleRegistry.domain = domainRegistry
  }

  ;(domainRegistry as Record<string, unknown>).entrySorting = {
    createEntrySorting,
  }
})()
