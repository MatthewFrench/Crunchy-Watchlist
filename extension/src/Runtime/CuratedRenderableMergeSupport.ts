type RuntimeBoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, RuntimeBoundaryValue>;

type FilterContext = {
  effectiveAudioFilter: string;
  effectiveGenreFilter: string;
  selectedAudioLocale: string | null;
  selectedAudioIsDefaultPreferred: boolean;
  localizedAudioForCounts: string | null;
};

type CuratedRenderableDependencies = {
  normalizeAudioLocale: (value: RuntimeBoundaryValue) => string | null;
  getPreferredAudioLanguage: () => string;
  getCachedRating: (
    seriesId: RuntimeBoundaryValue,
    audioLocale?: RuntimeBoundaryValue,
    allowSeriesFallback?: RuntimeBoundaryValue,
  ) => RuntimeBoundaryValue;
  getCachedWatchHistory: (
    seriesId: RuntimeBoundaryValue,
    audioLocale?: RuntimeBoundaryValue,
    allowSeriesFallback?: RuntimeBoundaryValue,
  ) => RuntimeBoundaryValue;
  getCachedWatchHistoryProgress: (
    seriesId: RuntimeBoundaryValue,
    audioLocale?: RuntimeBoundaryValue,
    allowSeriesFallback?: RuntimeBoundaryValue,
  ) => RuntimeBoundaryValue;
  normalizeAudioLocales: (locales: RuntimeBoundaryValue[]) => string[];
  hasEnUsAudio: (locales: RuntimeBoundaryValue[]) => boolean;
  normalizeTagList: (values: RuntimeBoundaryValue[]) => string[];
  normalizeImageUrlCandidate: (value: RuntimeBoundaryValue) => string | null;
  getAudioLocaleCountFromMap: (map: RuntimeBoundaryValue, audioLocale: RuntimeBoundaryValue) => number | null;
  getLocalizedSeriesCount: (
    ratingEntry: RuntimeBoundaryValue,
    audioLocale: RuntimeBoundaryValue,
    countType: RuntimeBoundaryValue,
  ) => number | null;
  sanitizePositiveInt: (value: RuntimeBoundaryValue) => number | null;
  pickFirstDateMs: (values: RuntimeBoundaryValue[]) => number | null;
  deriveDisplayStatusBase: (entry: RuntimeBoundaryValue, watchHistoryEntry: RuntimeBoundaryValue) => string;
  isEntryWatchReady: (entry: RuntimeBoundaryValue) => boolean;
};

type CuratedRenderableMergeSupportRuntime = {
  resolveWatchReadyFilterMode: (value: RuntimeBoundaryValue) => 'none' | 'dim' | 'hide' | 'hide_not_started';
  resolveRenderableFilterContext: (
    settings: RuntimeBoundaryValue,
    dependencies: CuratedRenderableDependencies,
  ) => FilterContext;
  mergeRenderableEntry: (
    entry: RuntimeBoundaryValue,
    filterContext: FilterContext,
    dependencies: CuratedRenderableDependencies,
  ) => LooseRecord;
  buildCuratedFilterOptions: (
    anyTitle: string,
    selectedFilter: string,
    values: string[],
  ) => Array<{ optionValue: string; title: string }>;
  buildGenreFilterOptions: (
    selectedFilter: string,
    values: string[],
    favoritesGenreFilterValue: string,
  ) => Array<{ optionValue: string; title: string }>;
};

type MergeWatchHistorySelection = {
  watchHistoryEntry: RuntimeBoundaryValue;
  localeWatchHistoryEntry: RuntimeBoundaryValue;
  watchHistoryProgressEntry: RuntimeBoundaryValue;
};

type MergeRenderableEntryResult = {
  mergedEntry: LooseRecord;
  completionState: {
    fullyWatched: boolean;
    neverWatched: boolean;
    watchedRatio: number | null;
  };
};

const VALID_WATCH_READY_FILTER_MODES = new Set(['none', 'dim', 'hide', 'hide_not_started']);
const plausibleAbsoluteEpisodeFloorForLaterSeasons = 25;

function asRecord(value: RuntimeBoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function asArray(value: RuntimeBoundaryValue): RuntimeBoundaryValue[] {
  return Array.isArray(value) ? value : [];
}

function sanitizePositiveNumber(value: RuntimeBoundaryValue): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

function pickFirstPositiveNumber(values: RuntimeBoundaryValue[]): number | null {
  for (const value of values) {
    const parsed = sanitizePositiveNumber(value);
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
}

function resolveEpisodeIndexValue(dependencies: CuratedRenderableDependencies, entry: LooseRecord): number | null {
  const absoluteEpisodeIndex = dependencies.sanitizePositiveInt(entry.absoluteEpisodeNumber);
  if (absoluteEpisodeIndex != null) {
    return absoluteEpisodeIndex;
  }

  const seasonIndex = dependencies.sanitizePositiveInt(entry.seasonNumber);
  const seasonEpisodeIndex = dependencies.sanitizePositiveInt(entry.episodeNumber);
  if (seasonEpisodeIndex == null) {
    return null;
  }

  if (seasonIndex != null && seasonIndex > 1 && seasonEpisodeIndex < plausibleAbsoluteEpisodeFloorForLaterSeasons) {
    return null;
  }

  return seasonEpisodeIndex;
}

function shouldPreferSeriesProgressForCrossLocaleCompletion(
  seriesProgressRecord: LooseRecord,
  localeProgressRecord: LooseRecord,
): boolean {
  return Boolean(seriesProgressRecord.fullyWatched) && !localeProgressRecord.fullyWatched;
}

function resolveProgressRatioFromPlayhead(playhead: number | null, durationMs: number | null): number | null {
  if (playhead == null || durationMs == null || durationMs <= 0) {
    return null;
  }

  const ratioFromMilliseconds = playhead / durationMs;
  const ratioFromSeconds = (playhead * 1000) / durationMs;
  const boundedCandidates = [ratioFromMilliseconds, ratioFromSeconds].filter(
    (candidate) => Number.isFinite(candidate) && candidate > 0 && candidate <= 1.05,
  );

  if (!boundedCandidates.length) {
    return null;
  }

  return Math.min(1, Math.max(...boundedCandidates));
}

function resolveEpisodeProgressRatio(entryRecord: LooseRecord, progressRecord: LooseRecord): number | null {
  if (Boolean(entryRecord.fullyWatched) || Boolean(progressRecord.fullyWatched)) {
    return null;
  }

  const playhead = pickFirstPositiveNumber([
    progressRecord.playhead,
    progressRecord.playheadMs,
    progressRecord.progressMs,
    entryRecord.playheadMs,
    entryRecord.playhead,
  ]);
  const durationMs = pickFirstPositiveNumber([
    progressRecord.episodeDurationMs,
    progressRecord.durationMs,
    progressRecord.duration_ms,
    entryRecord.episodeDurationMs,
    entryRecord.durationMs,
    entryRecord.duration_ms,
  ]);
  const ratio = resolveProgressRatioFromPlayhead(playhead, durationMs);

  if (ratio == null || ratio <= 0 || ratio >= 1) {
    return null;
  }

  return ratio;
}

function estimateWatchedEpisodeCount(
  totalEpisodes: number | null,
  episodeIndex: number | null,
  episodeCompleted: boolean,
): number | null {
  if (totalEpisodes == null || episodeIndex == null) {
    return null;
  }

  const watchedEpisodes = episodeCompleted ? episodeIndex : Math.max(0, episodeIndex - 1);
  return Math.max(0, Math.min(totalEpisodes, watchedEpisodes));
}

function deriveEffectiveCompletionState(
  dependencies: CuratedRenderableDependencies,
  entryRecord: LooseRecord,
  progressRecord: LooseRecord,
  totalEpisodes: number | null,
): {
  fullyWatched: boolean;
  neverWatched: boolean;
  watchedRatio: number | null;
} {
  const entryEpisodeIndex = resolveEpisodeIndexValue(dependencies, entryRecord);
  const progressEpisodeIndex = resolveEpisodeIndexValue(dependencies, progressRecord);
  const resolvedEpisodeIndex = progressEpisodeIndex ?? entryEpisodeIndex;
  const entryCompleted = Boolean(entryRecord.fullyWatched);
  const progressCompleted = Boolean(progressRecord.fullyWatched);
  const watchedEpisodeCount = estimateWatchedEpisodeCount(
    totalEpisodes,
    resolvedEpisodeIndex,
    progressCompleted || entryCompleted,
  );
  const watchedRatio =
    watchedEpisodeCount != null && totalEpisodes != null && totalEpisodes > 0
      ? watchedEpisodeCount / totalEpisodes
      : null;
  const hasProgressSignal =
    progressEpisodeIndex != null ||
    entryEpisodeIndex != null ||
    sanitizePositiveNumber(progressRecord.playhead) != null ||
    sanitizePositiveNumber(progressRecord.playheadMs) != null ||
    sanitizePositiveNumber(progressRecord.progressMs) != null ||
    sanitizePositiveNumber(entryRecord.playheadMs) != null;
  const reachedSeriesEnd =
    progressCompleted && progressEpisodeIndex != null && totalEpisodes != null && progressEpisodeIndex >= totalEpisodes;
  const effectivelyComplete = entryCompleted || (reachedSeriesEnd && watchedRatio != null && watchedRatio >= 0.6);

  return {
    fullyWatched: effectivelyComplete,
    neverWatched: Boolean(entryRecord.neverWatched) && !hasProgressSignal && !effectivelyComplete,
    watchedRatio,
  };
}

function resolveMergeWatchHistorySelection(
  dependencies: CuratedRenderableDependencies,
  seriesId: RuntimeBoundaryValue,
  selectedAudioLocale: string | null,
  selectedAudioIsDefaultPreferred: boolean,
): MergeWatchHistorySelection {
  const watchHistoryEntry = dependencies.getCachedWatchHistory(seriesId);
  const localeWatchHistoryEntry = selectedAudioLocale
    ? dependencies.getCachedWatchHistory(seriesId, selectedAudioLocale, false)
    : null;
  const watchHistoryProgressFallback = dependencies.getCachedWatchHistoryProgress(seriesId);
  const localeWatchHistoryProgressEntry = selectedAudioLocale
    ? dependencies.getCachedWatchHistoryProgress(seriesId, selectedAudioLocale, false)
    : null;
  const seriesProgressRecord = asRecord(watchHistoryProgressFallback);
  const localeProgressRecord = asRecord(localeWatchHistoryProgressEntry);
  const useSeriesProgressFallback = !selectedAudioLocale || selectedAudioIsDefaultPreferred;
  const useSeriesHistoryFallback = !selectedAudioLocale || selectedAudioIsDefaultPreferred;
  const preferSeriesProgressForCrossLocaleCompletion =
    Boolean(selectedAudioLocale) &&
    shouldPreferSeriesProgressForCrossLocaleCompletion(seriesProgressRecord, localeProgressRecord);
  const primaryProgressEntry = preferSeriesProgressForCrossLocaleCompletion
    ? watchHistoryProgressFallback
    : localeWatchHistoryProgressEntry;
  const watchHistoryProgressEntry =
    primaryProgressEntry ||
    (useSeriesProgressFallback ? watchHistoryProgressFallback : null) ||
    localeWatchHistoryEntry ||
    (useSeriesHistoryFallback ? watchHistoryEntry : null);

  return {
    watchHistoryEntry,
    localeWatchHistoryEntry,
    watchHistoryProgressEntry,
  };
}

function resolveLocalizedEpisodeAndSeasonCounts(
  dependencies: CuratedRenderableDependencies,
  entryRecord: LooseRecord,
  ratingEntry: LooseRecord,
  localizedAudioForCounts: string | null,
): { episodeCount: number | null; seasonCount: number | null } {
  const knownEpisodeCountForSelectedAudio = localizedAudioForCounts
    ? dependencies.getAudioLocaleCountFromMap(entryRecord.knownEpisodeMaxByAudioLocale, localizedAudioForCounts)
    : null;
  const localizedEpisodeCountFromRatings = dependencies.getLocalizedSeriesCount(
    ratingEntry,
    localizedAudioForCounts,
    'episode',
  );
  const baseEpisodeCount = dependencies.sanitizePositiveInt(entryRecord.episodeCount);

  return {
    episodeCount: localizedEpisodeCountFromRatings ?? knownEpisodeCountForSelectedAudio ?? baseEpisodeCount,
    seasonCount:
      dependencies.getLocalizedSeriesCount(ratingEntry, localizedAudioForCounts, 'season') ??
      dependencies.sanitizePositiveInt(entryRecord.seasonCount),
  };
}

function resolveRenderableImageVariants(
  dependencies: CuratedRenderableDependencies,
  entryRecord: LooseRecord,
  ratingEntry: LooseRecord,
): { portraitImageUrl: string | null; landscapeImageUrl: string | null; hoverPreviewImageUrl: string | null } {
  const portraitImageUrl =
    dependencies.normalizeImageUrlCandidate(ratingEntry.portraitImageUrl) ||
    dependencies.normalizeImageUrlCandidate(entryRecord.portraitImageUrl) ||
    dependencies.normalizeImageUrlCandidate(entryRecord.imageUrl);
  const landscapeImageUrl =
    dependencies.normalizeImageUrlCandidate(ratingEntry.landscapeImageUrl) ||
    dependencies.normalizeImageUrlCandidate(entryRecord.landscapeImageUrl) ||
    portraitImageUrl;

  return {
    portraitImageUrl,
    landscapeImageUrl,
    hoverPreviewImageUrl: dependencies.normalizeImageUrlCandidate(entryRecord.hoverPreviewImageUrl),
  };
}

function buildMergedRenderableEntry(
  dependencies: CuratedRenderableDependencies,
  entryRecord: LooseRecord,
  ratingEntry: LooseRecord,
  watchHistoryEntry: RuntimeBoundaryValue,
  watchHistoryProgressEntry: RuntimeBoundaryValue,
  localizedAudioForCounts: string | null,
): MergeRenderableEntryResult {
  const rating = ratingEntry.rating ?? null;
  const votes = ratingEntry.votes ?? null;
  const distribution = ratingEntry.distribution ?? null;
  const audioLocales = dependencies.normalizeAudioLocales(
    (Array.isArray(ratingEntry.audioLocales) && ratingEntry.audioLocales.length
      ? ratingEntry.audioLocales
      : asArray(entryRecord.audioLocales)) || [],
  );
  const description =
    (typeof ratingEntry.description === 'string' && ratingEntry.description.trim()
      ? ratingEntry.description.trim()
      : '') ||
    entryRecord.description ||
    '';
  const genreTags = dependencies.normalizeTagList(
    (Array.isArray(ratingEntry.genreTags) && ratingEntry.genreTags.length
      ? ratingEntry.genreTags
      : asArray(entryRecord.genreTags)) || [],
  );
  const { episodeCount, seasonCount } = resolveLocalizedEpisodeAndSeasonCounts(
    dependencies,
    entryRecord,
    ratingEntry,
    localizedAudioForCounts,
  );
  const { portraitImageUrl, landscapeImageUrl, hoverPreviewImageUrl } = resolveRenderableImageVariants(
    dependencies,
    entryRecord,
    ratingEntry,
  );
  const lastWatchedMs = dependencies.pickFirstDateMs([
    asRecord(watchHistoryEntry).datePlayedMs,
    entryRecord.lastWatchedMs,
  ]);
  const progressRecord = asRecord(watchHistoryProgressEntry);
  const completionState = deriveEffectiveCompletionState(dependencies, entryRecord, progressRecord, episodeCount);

  return {
    mergedEntry: {
      ...entryRecord,
      description,
      distribution,
      audioLocales,
      hasEnglishAudio: dependencies.hasEnUsAudio(audioLocales),
      episodeCount,
      seasonCount,
      genreTags,
      portraitImageUrl,
      landscapeImageUrl,
      hoverPreviewImageUrl,
      lastWatchedMs,
      fullyWatched: completionState.fullyWatched,
      neverWatched: completionState.neverWatched,
      watchedRatio: completionState.watchedRatio,
      episodeWatchProgressRatio: resolveEpisodeProgressRatio(entryRecord, progressRecord),
      watchHistoryProgressEntry,
      imageUrl: portraitImageUrl || landscapeImageUrl || dependencies.normalizeImageUrlCandidate(entryRecord.imageUrl),
      rating,
      votes,
    },
    completionState,
  };
}

function resolveWatchReadyFilterMode(value: RuntimeBoundaryValue): 'none' | 'dim' | 'hide' | 'hide_not_started' {
  if (typeof value === 'string' && VALID_WATCH_READY_FILTER_MODES.has(value)) {
    return value as 'none' | 'dim' | 'hide' | 'hide_not_started';
  }
  return 'hide';
}

function resolveRenderableFilterContext(
  settings: RuntimeBoundaryValue,
  dependencies: CuratedRenderableDependencies,
): FilterContext {
  const settingsRecord = asRecord(settings);
  const normalizedAudioFilter = String(settingsRecord.audioLocaleFilter || 'any');
  const normalizedGenreFilter = String(settingsRecord.genreFilter || 'any');
  const effectiveAudioFilter = normalizedAudioFilter.trim() || 'any';
  const effectiveGenreFilter = normalizedGenreFilter.trim() || 'any';
  const selectedAudioLocale =
    effectiveAudioFilter !== 'any' ? dependencies.normalizeAudioLocale(effectiveAudioFilter) : null;
  const defaultPreferredAudioLanguage = dependencies.getPreferredAudioLanguage();
  const selectedAudioIsDefaultPreferred = selectedAudioLocale
    ? selectedAudioLocale.toLowerCase() === defaultPreferredAudioLanguage.toLowerCase()
    : false;

  return {
    effectiveAudioFilter,
    effectiveGenreFilter,
    selectedAudioLocale,
    selectedAudioIsDefaultPreferred,
    localizedAudioForCounts: effectiveAudioFilter !== 'any' ? effectiveAudioFilter : null,
  };
}

function mergeRenderableEntry(
  entry: RuntimeBoundaryValue,
  filterContext: FilterContext,
  dependencies: CuratedRenderableDependencies,
): LooseRecord {
  const entryRecord = asRecord(entry);
  const seriesId = entryRecord.seriesId;
  const { selectedAudioLocale, selectedAudioIsDefaultPreferred, localizedAudioForCounts } = filterContext;
  const ratingEntry = asRecord(dependencies.getCachedRating(seriesId));
  const { watchHistoryEntry, localeWatchHistoryEntry, watchHistoryProgressEntry } = resolveMergeWatchHistorySelection(
    dependencies,
    seriesId,
    selectedAudioLocale,
    selectedAudioIsDefaultPreferred,
  );
  const { mergedEntry, completionState } = buildMergedRenderableEntry(
    dependencies,
    entryRecord,
    ratingEntry,
    watchHistoryEntry,
    watchHistoryProgressEntry,
    localizedAudioForCounts,
  );
  const statusBase = dependencies.deriveDisplayStatusBase(mergedEntry, localeWatchHistoryEntry || watchHistoryEntry);
  const mergedEntryWithStatus = {
    ...mergedEntry,
    statusBase,
  };
  const watchReady = completionState.fullyWatched ? false : dependencies.isEntryWatchReady(mergedEntryWithStatus);

  return {
    ...mergedEntryWithStatus,
    watchReady,
  };
}

function buildCuratedFilterOptions(anyTitle: string, selectedFilter: string, values: string[]) {
  return [
    { optionValue: 'any', title: anyTitle },
    ...(selectedFilter !== 'any' && !values.includes(selectedFilter)
      ? [{ optionValue: selectedFilter, title: `${selectedFilter} (no matches)` }]
      : []),
    ...values.map((value) => ({ optionValue: value, title: value })),
  ];
}

function buildGenreFilterOptions(selectedFilter: string, values: string[], favoritesGenreFilterValue: string) {
  const options = [{ optionValue: 'any', title: 'Any genre' }];
  if (selectedFilter !== 'any' && selectedFilter !== favoritesGenreFilterValue && !values.includes(selectedFilter)) {
    options.push({
      optionValue: selectedFilter,
      title: `${selectedFilter} (no matches)`,
    });
  }

  options.push({
    optionValue: favoritesGenreFilterValue,
    title: 'Favorites',
  });

  values.forEach((value) => {
    if (value === favoritesGenreFilterValue) {
      return;
    }
    options.push({
      optionValue: value,
      title: value,
    });
  });

  return options;
}

export function createCuratedRenderableMergeSupportRuntime(): CuratedRenderableMergeSupportRuntime {
  return {
    resolveWatchReadyFilterMode: (value) => resolveWatchReadyFilterMode(value),
    resolveRenderableFilterContext: (settings, dependencies) => resolveRenderableFilterContext(settings, dependencies),
    mergeRenderableEntry: (entry, filterContext, dependencies) =>
      mergeRenderableEntry(entry, filterContext, dependencies),
    buildCuratedFilterOptions: (anyTitle, selectedFilter, values) =>
      buildCuratedFilterOptions(anyTitle, selectedFilter, values),
    buildGenreFilterOptions: (selectedFilter, values, favoritesGenreFilterValue) =>
      buildGenreFilterOptions(selectedFilter, values, favoritesGenreFilterValue),
  };
}
