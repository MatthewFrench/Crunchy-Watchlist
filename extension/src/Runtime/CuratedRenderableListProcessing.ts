type RuntimeBoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, RuntimeBoundaryValue>;

type FilterContextLike = {
  effectiveAudioFilter: string;
  effectiveGenreFilter: string;
};

type CuratedRenderableListProcessingRuntime = {
  collectRenderableAttributeValues: (entries: RuntimeBoundaryValue[], key: string) => string[];
  applyRenderableEntryFilters: (options: {
    mergedEntries: LooseRecord[];
    filterContext: FilterContextLike;
    watchReadyFilterMode: string;
    favoritesGenreFilterValue: string;
  }) => LooseRecord[];
  sortDecoratedEntries: (options: {
    decorated: LooseRecord[];
    settingsRecord: LooseRecord;
    compareRenderableEntries: (
      left: RuntimeBoundaryValue,
      right: RuntimeBoundaryValue,
      sortMode?: RuntimeBoundaryValue,
    ) => number;
  }) => void;
};

function asRecord(value: RuntimeBoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function asArray(value: RuntimeBoundaryValue): RuntimeBoundaryValue[] {
  return Array.isArray(value) ? value : [];
}

function resolveSortMode(value: RuntimeBoundaryValue): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'none';
}

function hasPlaybackProgress(value: RuntimeBoundaryValue): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function isFavoritesGenreFilter(value: string, favoritesGenreFilterValue: string): boolean {
  return value.trim().toLowerCase() === favoritesGenreFilterValue.trim().toLowerCase();
}

// "Hide not watch-ready / not started" treats hide_not_started as:
// - hide any not-watch-ready entry, and
// - hide additional cold-start cards with no watch-history/progress footprint.
function isEntryNotWatchedAndNotStartedInternal(entry: LooseRecord): boolean {
  const statusBase = String(entry.statusBase || '')
    .trim()
    .toLowerCase();
  if (statusBase === 'start watching') {
    return true;
  }
  if (!entry.neverWatched) {
    return false;
  }
  if (hasPlaybackProgress(entry.playheadMs) || hasPlaybackProgress(entry.lastWatchedMs)) {
    return false;
  }

  const watchHistoryProgressEntry = asRecord(entry.watchHistoryProgressEntry);
  if (watchHistoryProgressEntry.fullyWatched) {
    return false;
  }

  return !(
    hasPlaybackProgress(watchHistoryProgressEntry.playhead) ||
    hasPlaybackProgress(watchHistoryProgressEntry.playheadMs) ||
    hasPlaybackProgress(watchHistoryProgressEntry.progressMs)
  );
}

function collectRenderableAttributeValuesInternal(entries: RuntimeBoundaryValue[], key: string): string[] {
  return Array.from(
    new Set(
      entries
        .flatMap((entry) => asArray(asRecord(entry)[key]))
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function applyRenderableEntryFiltersInternal({
  mergedEntries,
  filterContext,
  watchReadyFilterMode,
  favoritesGenreFilterValue,
}: {
  mergedEntries: LooseRecord[];
  filterContext: FilterContextLike;
  watchReadyFilterMode: string;
  favoritesGenreFilterValue: string;
}): LooseRecord[] {
  const normalizedAudioFilter = filterContext.effectiveAudioFilter.toLowerCase();
  const normalizedGenreFilter = filterContext.effectiveGenreFilter.toLowerCase();
  const filterByAudio = normalizedAudioFilter !== 'any';
  const filterByGenre = normalizedGenreFilter !== 'any';
  const filterByFavorites = filterByGenre && isFavoritesGenreFilter(normalizedGenreFilter, favoritesGenreFilterValue);
  const hideNotReady = watchReadyFilterMode === 'hide' || watchReadyFilterMode === 'hide_not_started';
  const hideNotStarted = watchReadyFilterMode === 'hide_not_started';
  const filtered: LooseRecord[] = [];

  for (const entry of mergedEntries) {
    if (filterByAudio) {
      let audioMatch = false;
      for (const locale of asArray(entry.audioLocales)) {
        if (String(locale).toLowerCase() === normalizedAudioFilter) {
          audioMatch = true;
          break;
        }
      }
      if (!audioMatch) {
        continue;
      }
    }

    if (filterByGenre) {
      if (filterByFavorites) {
        if (!entry.isFavorite) {
          continue;
        }
      } else {
        let genreMatch = false;
        for (const tag of asArray(entry.genreTags)) {
          if (String(tag).toLowerCase() === normalizedGenreFilter) {
            genreMatch = true;
            break;
          }
        }
        if (!genreMatch) {
          continue;
        }
      }
    }

    if (hideNotReady && !entry.watchReady) {
      continue;
    }

    if (hideNotStarted && isEntryNotWatchedAndNotStartedInternal(entry)) {
      continue;
    }

    filtered.push(entry);
  }

  return filtered;
}

function buildRankMap(
  entries: LooseRecord[],
  compareEntries: (left: LooseRecord, right: LooseRecord) => number,
): Map<LooseRecord, number> {
  const sorted = entries.slice().sort((left, right) => compareEntries(left, right));
  const rankMap = new Map<LooseRecord, number>();
  sorted.forEach((entry, index) => {
    rankMap.set(entry, index);
  });
  return rankMap;
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
  decorated: LooseRecord[];
  settingsRecord: LooseRecord;
  compareRenderableEntries: (
    left: RuntimeBoundaryValue,
    right: RuntimeBoundaryValue,
    sortMode?: RuntimeBoundaryValue,
  ) => number;
}): void {
  const primarySortMode = resolveSortMode(settingsRecord.sortMode);
  const requestedSecondarySortMode = resolveSortMode(settingsRecord.secondarySortMode);
  const secondarySortMode = requestedSecondarySortMode === primarySortMode ? 'none' : requestedSecondarySortMode;
  const comparePrimary = (left: LooseRecord, right: LooseRecord) =>
    compareRenderableEntries(left, right, primarySortMode);

  if (secondarySortMode === 'none') {
    decorated.sort((left, right) => comparePrimary(left, right));
    return;
  }

  const compareSecondary = (left: LooseRecord, right: LooseRecord) =>
    compareRenderableEntries(left, right, secondarySortMode);
  const primaryRanks = buildRankMap(decorated, comparePrimary);
  const secondaryRanks = buildRankMap(decorated, compareSecondary);

  decorated.sort((left, right) => {
    const leftPrimaryRank = primaryRanks.get(left) ?? Number.POSITIVE_INFINITY;
    const rightPrimaryRank = primaryRanks.get(right) ?? Number.POSITIVE_INFINITY;
    const leftSecondaryRank = secondaryRanks.get(left) ?? Number.POSITIVE_INFINITY;
    const rightSecondaryRank = secondaryRanks.get(right) ?? Number.POSITIVE_INFINITY;

    const leftAverageRank = (leftPrimaryRank + leftSecondaryRank) / 2;
    const rightAverageRank = (rightPrimaryRank + rightSecondaryRank) / 2;
    if (leftAverageRank !== rightAverageRank) {
      return leftAverageRank - rightAverageRank;
    }
    if (leftPrimaryRank !== rightPrimaryRank) {
      return leftPrimaryRank - rightPrimaryRank;
    }
    if (leftSecondaryRank !== rightSecondaryRank) {
      return leftSecondaryRank - rightSecondaryRank;
    }
    return comparePrimary(left, right);
  });
}

export function createCuratedRenderableListProcessingRuntime(): CuratedRenderableListProcessingRuntime {
  return {
    collectRenderableAttributeValues: (entries, key) => collectRenderableAttributeValuesInternal(entries, key),
    applyRenderableEntryFilters: (options) => applyRenderableEntryFiltersInternal(options),
    sortDecoratedEntries: (options) => sortDecoratedEntriesInternal(options),
  };
}
