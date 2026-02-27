;(() => {
  type LooseRecord = Record<string, unknown>

  type FilterContextLike = {
    effectiveAudioFilter: string
    effectiveGenreFilter: string
  }

  type CuratedRenderableListProcessingRuntime = {
    collectRenderableAttributeValues: (entries: unknown[], key: string) => string[]
    applyRenderableEntryFilters: (options: {
      mergedEntries: LooseRecord[]
      filterContext: FilterContextLike
      watchReadyFilterMode: string
      favoritesGenreFilterValue: string
    }) => LooseRecord[]
    sortDecoratedEntries: (options: {
      decorated: LooseRecord[]
      settingsRecord: LooseRecord
      compareRenderableEntries: (left: unknown, right: unknown, sortMode?: unknown) => number
    }) => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord
    }
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function asRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as LooseRecord
  }

  function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
  }

  function resolveSortMode(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : 'none'
  }

  function hasPlaybackProgress(value: unknown): boolean {
    const number = Number(value)
    return Number.isFinite(number) && number > 0
  }

  function isFavoritesGenreFilter(value: string, favoritesGenreFilterValue: string): boolean {
    return value.trim().toLowerCase() === favoritesGenreFilterValue.trim().toLowerCase()
  }

  // "Hide not watched / not started" removes cold-start cards that have no playhead, progress, or watch-history activity.
  function isEntryNotWatchedAndNotStartedInternal(entry: LooseRecord): boolean {
    const statusBase = String(entry.statusBase || '')
      .trim()
      .toLowerCase()
    if (statusBase === 'start watching') {
      return true
    }
    if (!entry.neverWatched) {
      return false
    }
    if (hasPlaybackProgress(entry.playheadMs) || hasPlaybackProgress(entry.lastWatchedMs)) {
      return false
    }

    const watchHistoryProgressEntry = asRecord(entry.watchHistoryProgressEntry)
    if (watchHistoryProgressEntry.fullyWatched) {
      return false
    }

    return !(
      hasPlaybackProgress(watchHistoryProgressEntry.playhead) ||
      hasPlaybackProgress(watchHistoryProgressEntry.playheadMs) ||
      hasPlaybackProgress(watchHistoryProgressEntry.progressMs)
    )
  }

  function collectRenderableAttributeValuesInternal(entries: unknown[], key: string): string[] {
    return Array.from(
      new Set(
        entries
          .flatMap((entry) => asArray(asRecord(entry)[key]))
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right))
  }

  function applyRenderableEntryFiltersInternal({
    mergedEntries,
    filterContext,
    watchReadyFilterMode,
    favoritesGenreFilterValue,
  }: {
    mergedEntries: LooseRecord[]
    filterContext: FilterContextLike
    watchReadyFilterMode: string
    favoritesGenreFilterValue: string
  }): LooseRecord[] {
    const { effectiveAudioFilter, effectiveGenreFilter } = filterContext
    let filtered = mergedEntries.slice()

    if (effectiveAudioFilter !== 'any') {
      filtered = filtered.filter((entry) =>
        asArray(entry.audioLocales).some(
          (locale) => String(locale).toLowerCase() === effectiveAudioFilter.toLowerCase(),
        ),
      )
    }

    if (effectiveGenreFilter !== 'any') {
      if (isFavoritesGenreFilter(effectiveGenreFilter, favoritesGenreFilterValue)) {
        filtered = filtered.filter((entry) => Boolean(entry.isFavorite))
      } else {
        filtered = filtered.filter((entry) =>
          asArray(entry.genreTags).some((tag) => String(tag).toLowerCase() === effectiveGenreFilter.toLowerCase()),
        )
      }
    }

    if (watchReadyFilterMode === 'hide') {
      filtered = filtered.filter((entry) => Boolean(entry.watchReady))
    }
    if (watchReadyFilterMode === 'hide_not_started') {
      filtered = filtered.filter((entry) => !isEntryNotWatchedAndNotStartedInternal(entry))
    }

    return filtered
  }

  function buildRankMap(
    entries: LooseRecord[],
    compareEntries: (left: LooseRecord, right: LooseRecord) => number,
  ): Map<LooseRecord, number> {
    const sorted = entries.slice().sort((left, right) => compareEntries(left, right))
    const rankMap = new Map<LooseRecord, number>()
    sorted.forEach((entry, index) => {
      rankMap.set(entry, index)
    })
    return rankMap
  }

  /**
   * Blends primary and secondary sort modes by averaging each entry's rank position from both
   * deterministic comparators; ties fall back to primary comparator ordering.
   */
  function sortDecoratedEntriesInternal({
    decorated,
    settingsRecord,
    compareRenderableEntries,
  }: {
    decorated: LooseRecord[]
    settingsRecord: LooseRecord
    compareRenderableEntries: (left: unknown, right: unknown, sortMode?: unknown) => number
  }): void {
    const primarySortMode = resolveSortMode(settingsRecord.sortMode)
    const requestedSecondarySortMode = resolveSortMode(settingsRecord.secondarySortMode)
    const secondarySortMode = requestedSecondarySortMode === primarySortMode ? 'none' : requestedSecondarySortMode
    const comparePrimary = (left: LooseRecord, right: LooseRecord) =>
      compareRenderableEntries(left, right, primarySortMode)

    if (secondarySortMode === 'none') {
      decorated.sort((left, right) => comparePrimary(left, right))
      return
    }

    const compareSecondary = (left: LooseRecord, right: LooseRecord) =>
      compareRenderableEntries(left, right, secondarySortMode)
    const primaryRanks = buildRankMap(decorated, comparePrimary)
    const secondaryRanks = buildRankMap(decorated, compareSecondary)

    decorated.sort((left, right) => {
      const leftPrimaryRank = primaryRanks.get(left) ?? Number.POSITIVE_INFINITY
      const rightPrimaryRank = primaryRanks.get(right) ?? Number.POSITIVE_INFINITY
      const leftSecondaryRank = secondaryRanks.get(left) ?? Number.POSITIVE_INFINITY
      const rightSecondaryRank = secondaryRanks.get(right) ?? Number.POSITIVE_INFINITY

      const leftAverageRank = (leftPrimaryRank + leftSecondaryRank) / 2
      const rightAverageRank = (rightPrimaryRank + rightSecondaryRank) / 2
      if (leftAverageRank !== rightAverageRank) {
        return leftAverageRank - rightAverageRank
      }
      if (leftPrimaryRank !== rightPrimaryRank) {
        return leftPrimaryRank - rightPrimaryRank
      }
      if (leftSecondaryRank !== rightSecondaryRank) {
        return leftSecondaryRank - rightSecondaryRank
      }
      return comparePrimary(left, right)
    })
  }

  function createCuratedRenderableListProcessingRuntime(): CuratedRenderableListProcessingRuntime {
    return {
      collectRenderableAttributeValues: (entries, key) => collectRenderableAttributeValuesInternal(entries, key),
      applyRenderableEntryFilters: (options) => applyRenderableEntryFiltersInternal(options),
      sortDecoratedEntries: (options) => sortDecoratedEntriesInternal(options),
    }
  }

  moduleRegistry.runtimeCuratedRenderableListProcessing = {
    createCuratedRenderableListProcessingRuntime,
  }
})()
