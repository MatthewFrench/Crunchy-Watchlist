import { createCuratedRenderableListProcessingRuntime as createCuratedRenderableListProcessingRuntimeFactory } from './CuratedRenderableListProcessing.js';
import { createCuratedRenderableMergeSupportRuntime as createCuratedRenderableMergeSupportRuntimeFactory } from './CuratedRenderableMergeSupport.js';

type RuntimeBoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, RuntimeBoundaryValue>;
type NormalizeAudioLocaleFn = (value: RuntimeBoundaryValue) => string | null;
type GetPreferredAudioLanguageFn = () => string;
type CacheLookupFn = (
  seriesId: RuntimeBoundaryValue,
  audioLocale?: RuntimeBoundaryValue,
  allowSeriesFallback?: RuntimeBoundaryValue,
) => RuntimeBoundaryValue;
type NormalizeAudioLocalesFn = (locales: RuntimeBoundaryValue[]) => string[];
type HasEnUsAudioFn = (locales: RuntimeBoundaryValue[]) => boolean;
type NormalizeTagListFn = (values: RuntimeBoundaryValue[]) => string[];
type NormalizeImageUrlCandidateFn = (value: RuntimeBoundaryValue) => string | null;
type GetAudioLocaleCountFromMapFn = (map: RuntimeBoundaryValue, audioLocale: RuntimeBoundaryValue) => number | null;
type GetLocalizedSeriesCountFn = (
  ratingEntry: RuntimeBoundaryValue,
  audioLocale: RuntimeBoundaryValue,
  countType: RuntimeBoundaryValue,
) => number | null;
type SanitizePositiveIntFn = (value: RuntimeBoundaryValue) => number | null;
type PickFirstDateMsFn = (values: RuntimeBoundaryValue[]) => number | null;
type DeriveDisplayStatusBaseFn = (entry: RuntimeBoundaryValue, watchHistoryEntry: RuntimeBoundaryValue) => string;
type IsEntryWatchReadyFn = (entry: RuntimeBoundaryValue) => boolean;
type CompareRenderableEntriesFn = (
  left: RuntimeBoundaryValue,
  right: RuntimeBoundaryValue,
  sortMode?: RuntimeBoundaryValue,
) => number;

type CuratedRenderableOptions = {
  normalizeAudioLocale?: RuntimeBoundaryValue;
  getPreferredAudioLanguage?: RuntimeBoundaryValue;
  getCachedRating?: RuntimeBoundaryValue;
  getCachedWatchHistory?: RuntimeBoundaryValue;
  getCachedWatchHistoryProgress?: RuntimeBoundaryValue;
  normalizeAudioLocales?: RuntimeBoundaryValue;
  hasEnUsAudio?: RuntimeBoundaryValue;
  normalizeTagList?: RuntimeBoundaryValue;
  normalizeImageUrlCandidate?: RuntimeBoundaryValue;
  getAudioLocaleCountFromMap?: RuntimeBoundaryValue;
  getLocalizedSeriesCount?: RuntimeBoundaryValue;
  sanitizePositiveInt?: RuntimeBoundaryValue;
  pickFirstDateMs?: RuntimeBoundaryValue;
  deriveDisplayStatusBase?: RuntimeBoundaryValue;
  isEntryWatchReady?: RuntimeBoundaryValue;
  compareRenderableEntries?: RuntimeBoundaryValue;
};

type FilterContext = {
  effectiveAudioFilter: string;
  effectiveGenreFilter: string;
  selectedAudioLocale: string | null;
  selectedAudioIsDefaultPreferred: boolean;
  localizedAudioForCounts: string | null;
};

type BuildRenderableEntriesResult = {
  mode: 'none' | 'dim' | 'hide' | 'hide_not_started';
  total: number;
  visible: LooseRecord[];
  retainedHidden: LooseRecord[];
  audioOptions: Array<{ optionValue: string; title: string }>;
  genreOptions: Array<{ optionValue: string; title: string }>;
  selectedAudioFilter: string;
  selectedGenreFilter: string;
};

type BuildRenderableEntriesCacheState = {
  mergedEntriesRef: RuntimeBoundaryValue[] | null;
  mergedSignature: string;
  mergedEntries: LooseRecord[];
  audioValues: string[];
  genreValues: string[];
  filteredSourceEntries: LooseRecord[] | null;
  filteredSignature: string;
  filteredEntries: LooseRecord[];
};

type CuratedRenderableRuntime = {
  resolveRenderableFilterContext: (settings: RuntimeBoundaryValue) => FilterContext;
  mergeRenderableEntry: (entry: RuntimeBoundaryValue, filterContext: FilterContext) => LooseRecord;
  collectRenderableAttributeValues: (entries: RuntimeBoundaryValue[], key: string) => string[];
  applyRenderableEntryFilters: (
    mergedEntries: LooseRecord[],
    filterContext: FilterContext,
    watchReadyFilterMode: string,
  ) => LooseRecord[];
  buildRenderableEntries: (
    entries: RuntimeBoundaryValue[],
    settings: RuntimeBoundaryValue,
  ) => BuildRenderableEntriesResult;
};

type CuratedRenderableDependencies = {
  normalizeAudioLocale: NormalizeAudioLocaleFn;
  getPreferredAudioLanguage: GetPreferredAudioLanguageFn;
  getCachedRating: CacheLookupFn;
  getCachedWatchHistory: CacheLookupFn;
  getCachedWatchHistoryProgress: CacheLookupFn;
  normalizeAudioLocales: NormalizeAudioLocalesFn;
  hasEnUsAudio: HasEnUsAudioFn;
  normalizeTagList: NormalizeTagListFn;
  normalizeImageUrlCandidate: NormalizeImageUrlCandidateFn;
  getAudioLocaleCountFromMap: GetAudioLocaleCountFromMapFn;
  getLocalizedSeriesCount: GetLocalizedSeriesCountFn;
  sanitizePositiveInt: SanitizePositiveIntFn;
  pickFirstDateMs: PickFirstDateMsFn;
  deriveDisplayStatusBase: DeriveDisplayStatusBaseFn;
  isEntryWatchReady: IsEntryWatchReadyFn;
  compareRenderableEntries: CompareRenderableEntriesFn;
};

type CuratedRenderableListProcessingRuntime = {
  collectRenderableAttributeValues: (entries: RuntimeBoundaryValue[], key: string) => string[];
  applyRenderableEntryFilters: (options: {
    mergedEntries: LooseRecord[];
    filterContext: FilterContext;
    watchReadyFilterMode: string;
    favoritesGenreFilterValue: string;
  }) => LooseRecord[];
  sortDecoratedEntries: (options: {
    decorated: LooseRecord[];
    settingsRecord: LooseRecord;
    compareRenderableEntries: CompareRenderableEntriesFn;
  }) => void;
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

const FAVORITES_GENRE_FILTER_VALUE = '__favorites__';

function requireFunction<T>(name: string, value: RuntimeBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing curated renderable dependency: ${name}`);
  }
  return value as T;
}

function asRecord(value: RuntimeBoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function getInternalSettingsString(settingsRecord: LooseRecord, key: string): string {
  const value = settingsRecord[key];
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  return String(value);
}

function getInternalSettingsNumber(settingsRecord: LooseRecord, key: string): number {
  const value = Number(settingsRecord[key]);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function resolveCuratedRenderableDependencies(options: CuratedRenderableOptions = {}): CuratedRenderableDependencies {
  return {
    normalizeAudioLocale: requireFunction<NormalizeAudioLocaleFn>('normalizeAudioLocale', options.normalizeAudioLocale),
    getPreferredAudioLanguage: requireFunction<GetPreferredAudioLanguageFn>(
      'getPreferredAudioLanguage',
      options.getPreferredAudioLanguage,
    ),
    getCachedRating: requireFunction<CacheLookupFn>('getCachedRating', options.getCachedRating),
    getCachedWatchHistory: requireFunction<CacheLookupFn>('getCachedWatchHistory', options.getCachedWatchHistory),
    getCachedWatchHistoryProgress: requireFunction<CacheLookupFn>(
      'getCachedWatchHistoryProgress',
      options.getCachedWatchHistoryProgress,
    ),
    normalizeAudioLocales: requireFunction<NormalizeAudioLocalesFn>(
      'normalizeAudioLocales',
      options.normalizeAudioLocales,
    ),
    hasEnUsAudio: requireFunction<HasEnUsAudioFn>('hasEnUsAudio', options.hasEnUsAudio),
    normalizeTagList: requireFunction<NormalizeTagListFn>('normalizeTagList', options.normalizeTagList),
    normalizeImageUrlCandidate: requireFunction<NormalizeImageUrlCandidateFn>(
      'normalizeImageUrlCandidate',
      options.normalizeImageUrlCandidate,
    ),
    getAudioLocaleCountFromMap: requireFunction<GetAudioLocaleCountFromMapFn>(
      'getAudioLocaleCountFromMap',
      options.getAudioLocaleCountFromMap,
    ),
    getLocalizedSeriesCount: requireFunction<GetLocalizedSeriesCountFn>(
      'getLocalizedSeriesCount',
      options.getLocalizedSeriesCount,
    ),
    sanitizePositiveInt: requireFunction<SanitizePositiveIntFn>('sanitizePositiveInt', options.sanitizePositiveInt),
    pickFirstDateMs: requireFunction<PickFirstDateMsFn>('pickFirstDateMs', options.pickFirstDateMs),
    deriveDisplayStatusBase: requireFunction<DeriveDisplayStatusBaseFn>(
      'deriveDisplayStatusBase',
      options.deriveDisplayStatusBase,
    ),
    isEntryWatchReady: requireFunction<IsEntryWatchReadyFn>('isEntryWatchReady', options.isEntryWatchReady),
    compareRenderableEntries: requireFunction<CompareRenderableEntriesFn>(
      'compareRenderableEntries',
      options.compareRenderableEntries,
    ),
  };
}

function createCuratedRenderableListProcessingRuntime(): CuratedRenderableListProcessingRuntime {
  const runtime = createCuratedRenderableListProcessingRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated renderable dependency: runtimeCuratedRenderableListProcessing.runtime');
  }

  return {
    collectRenderableAttributeValues: requireFunction(
      'runtimeCuratedRenderableListProcessing.collectRenderableAttributeValues',
      (runtime as LooseRecord).collectRenderableAttributeValues,
    ),
    applyRenderableEntryFilters: requireFunction(
      'runtimeCuratedRenderableListProcessing.applyRenderableEntryFilters',
      (runtime as LooseRecord).applyRenderableEntryFilters,
    ),
    sortDecoratedEntries: requireFunction(
      'runtimeCuratedRenderableListProcessing.sortDecoratedEntries',
      (runtime as LooseRecord).sortDecoratedEntries,
    ),
  };
}

function createCuratedRenderableMergeSupportRuntime(): CuratedRenderableMergeSupportRuntime {
  const runtime = createCuratedRenderableMergeSupportRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated renderable dependency: runtimeCuratedRenderableMergeSupport.runtime');
  }

  return {
    resolveWatchReadyFilterMode: requireFunction(
      'runtimeCuratedRenderableMergeSupport.resolveWatchReadyFilterMode',
      (runtime as LooseRecord).resolveWatchReadyFilterMode,
    ),
    resolveRenderableFilterContext: requireFunction(
      'runtimeCuratedRenderableMergeSupport.resolveRenderableFilterContext',
      (runtime as LooseRecord).resolveRenderableFilterContext,
    ),
    mergeRenderableEntry: requireFunction(
      'runtimeCuratedRenderableMergeSupport.mergeRenderableEntry',
      (runtime as LooseRecord).mergeRenderableEntry,
    ),
    buildCuratedFilterOptions: requireFunction(
      'runtimeCuratedRenderableMergeSupport.buildCuratedFilterOptions',
      (runtime as LooseRecord).buildCuratedFilterOptions,
    ),
    buildGenreFilterOptions: requireFunction(
      'runtimeCuratedRenderableMergeSupport.buildGenreFilterOptions',
      (runtime as LooseRecord).buildGenreFilterOptions,
    ),
  };
}

function createDecoratedRenderableEntries(
  filtered: LooseRecord[],
  watchReadyFilterMode: BuildRenderableEntriesResult['mode'],
  settingsRecord: LooseRecord,
  dependencies: CuratedRenderableDependencies,
  listProcessingRuntime: CuratedRenderableListProcessingRuntime,
): LooseRecord[] {
  const decorated = filtered.map((entry) => ({
    ...entry,
    dimNotWatchReady: watchReadyFilterMode === 'dim' && !entry.watchReady,
  }));
  listProcessingRuntime.sortDecoratedEntries({
    decorated,
    settingsRecord,
    compareRenderableEntries: dependencies.compareRenderableEntries,
  });
  return decorated;
}

function buildRenderableEntriesInternal(
  entries: RuntimeBoundaryValue[],
  settings: RuntimeBoundaryValue,
  dependencies: CuratedRenderableDependencies,
  listProcessingRuntime: CuratedRenderableListProcessingRuntime,
  mergeSupportRuntime: CuratedRenderableMergeSupportRuntime,
  cacheState: BuildRenderableEntriesCacheState,
): BuildRenderableEntriesResult {
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const filterContext = mergeSupportRuntime.resolveRenderableFilterContext(settings, dependencies);
  const { effectiveAudioFilter, effectiveGenreFilter } = filterContext;
  const settingsRecord = asRecord(settings);
  const mergeSignature = [
    `audio:${effectiveAudioFilter}`,
    `locale:${filterContext.selectedAudioLocale || ''}`,
    `preferred:${getInternalSettingsString(settingsRecord, '__cwPreferredAudioLanguage')}`,
    `rating:${getInternalSettingsNumber(settingsRecord, '__cwRatingCacheRevision')}`,
    `history:${getInternalSettingsNumber(settingsRecord, '__cwWatchHistoryCacheUpdatedAt')}`,
  ].join('|');

  const canReuseMergedEntries =
    cacheState.mergedEntriesRef === normalizedEntries && cacheState.mergedSignature === mergeSignature;

  const merged = canReuseMergedEntries
    ? cacheState.mergedEntries
    : normalizedEntries.map((entry) => mergeSupportRuntime.mergeRenderableEntry(entry, filterContext, dependencies));

  const audioValues = canReuseMergedEntries
    ? cacheState.audioValues
    : listProcessingRuntime.collectRenderableAttributeValues(merged, 'audioLocales');
  const genreValues = canReuseMergedEntries
    ? cacheState.genreValues
    : listProcessingRuntime.collectRenderableAttributeValues(merged, 'genreTags');

  if (!canReuseMergedEntries) {
    cacheState.mergedEntriesRef = normalizedEntries;
    cacheState.mergedSignature = mergeSignature;
    cacheState.mergedEntries = merged;
    cacheState.audioValues = audioValues;
    cacheState.genreValues = genreValues;
  }

  const watchReadyFilterMode = mergeSupportRuntime.resolveWatchReadyFilterMode(settingsRecord.watchReadyFilterMode);
  const filteredSignature = `${effectiveAudioFilter}|${effectiveGenreFilter}|${watchReadyFilterMode}`;
  const canReuseFilteredEntries =
    cacheState.filteredSourceEntries === merged && cacheState.filteredSignature === filteredSignature;
  const filtered = canReuseFilteredEntries
    ? cacheState.filteredEntries
    : listProcessingRuntime.applyRenderableEntryFilters({
        mergedEntries: merged,
        filterContext,
        watchReadyFilterMode,
        favoritesGenreFilterValue: FAVORITES_GENRE_FILTER_VALUE,
      });

  if (!canReuseFilteredEntries) {
    cacheState.filteredSourceEntries = merged;
    cacheState.filteredSignature = filteredSignature;
    cacheState.filteredEntries = filtered;
  }

  const decorated = createDecoratedRenderableEntries(
    filtered,
    watchReadyFilterMode,
    settingsRecord,
    dependencies,
    listProcessingRuntime,
  );
  const filteredEntrySet = new Set(filtered);
  const retainedHidden = merged
    .filter((entry) => !filteredEntrySet.has(entry))
    .map((entry) => ({
      ...entry,
      dimNotWatchReady: watchReadyFilterMode === 'dim' && !entry.watchReady,
    }));

  return {
    mode: watchReadyFilterMode,
    total: merged.length,
    visible: decorated,
    retainedHidden,
    audioOptions: mergeSupportRuntime.buildCuratedFilterOptions('Any language', effectiveAudioFilter, audioValues),
    genreOptions: mergeSupportRuntime.buildGenreFilterOptions(
      effectiveGenreFilter,
      genreValues,
      FAVORITES_GENRE_FILTER_VALUE,
    ),
    selectedAudioFilter: effectiveAudioFilter,
    selectedGenreFilter: effectiveGenreFilter,
  };
}

function createCuratedRenderable(options: CuratedRenderableOptions = {}): CuratedRenderableRuntime {
  const dependencies = resolveCuratedRenderableDependencies(options);
  const listProcessingRuntime = createCuratedRenderableListProcessingRuntime();
  const mergeSupportRuntime = createCuratedRenderableMergeSupportRuntime();
  const cacheState: BuildRenderableEntriesCacheState = {
    mergedEntriesRef: null,
    mergedSignature: '',
    mergedEntries: [],
    audioValues: [],
    genreValues: [],
    filteredSourceEntries: null,
    filteredSignature: '',
    filteredEntries: [],
  };
  return {
    resolveRenderableFilterContext: (settings) =>
      mergeSupportRuntime.resolveRenderableFilterContext(settings, dependencies),
    mergeRenderableEntry: (entry, filterContext) =>
      mergeSupportRuntime.mergeRenderableEntry(entry, filterContext, dependencies),
    collectRenderableAttributeValues: (entries, key) =>
      listProcessingRuntime.collectRenderableAttributeValues(entries, key),
    applyRenderableEntryFilters: (mergedEntries, filterContext, watchReadyFilterMode) =>
      listProcessingRuntime.applyRenderableEntryFilters({
        mergedEntries,
        filterContext,
        watchReadyFilterMode,
        favoritesGenreFilterValue: FAVORITES_GENRE_FILTER_VALUE,
      }),
    buildRenderableEntries: (entries, settings) =>
      buildRenderableEntriesInternal(
        entries,
        settings,
        dependencies,
        listProcessingRuntime,
        mergeSupportRuntime,
        cacheState,
      ),
  };
}

const runtimeRenderableModule = {
  createCuratedRenderable,
};

export function createRuntimeRenderableRuntime(): object {
  return runtimeRenderableModule;
}
