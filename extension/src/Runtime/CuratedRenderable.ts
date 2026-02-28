(() => {
  type NormalizeAudioLocaleFn = (value: unknown) => string | null;
  type GetPreferredAudioLanguageFn = () => string;
  type CacheLookupFn = (seriesId: unknown, audioLocale?: unknown, allowSeriesFallback?: unknown) => unknown;
  type NormalizeAudioLocalesFn = (locales: unknown[]) => string[];
  type HasEnUsAudioFn = (locales: unknown[]) => boolean;
  type NormalizeTagListFn = (values: unknown[]) => string[];
  type NormalizeImageUrlCandidateFn = (value: unknown) => string | null;
  type GetAudioLocaleCountFromMapFn = (map: unknown, audioLocale: unknown) => number | null;
  type GetLocalizedSeriesCountFn = (ratingEntry: unknown, audioLocale: unknown, countType: unknown) => number | null;
  type SanitizePositiveIntFn = (value: unknown) => number | null;
  type PickFirstDateMsFn = (values: unknown[]) => number | null;
  type DeriveDisplayStatusBaseFn = (entry: unknown, watchHistoryEntry: unknown) => string;
  type IsEntryWatchReadyFn = (entry: unknown) => boolean;
  type CompareRenderableEntriesFn = (left: unknown, right: unknown, sortMode?: unknown) => number;

  type CuratedRenderableOptions = {
    normalizeAudioLocale?: unknown;
    getPreferredAudioLanguage?: unknown;
    getCachedRating?: unknown;
    getCachedWatchHistory?: unknown;
    getCachedWatchHistoryProgress?: unknown;
    normalizeAudioLocales?: unknown;
    hasEnUsAudio?: unknown;
    normalizeTagList?: unknown;
    normalizeImageUrlCandidate?: unknown;
    getAudioLocaleCountFromMap?: unknown;
    getLocalizedSeriesCount?: unknown;
    sanitizePositiveInt?: unknown;
    pickFirstDateMs?: unknown;
    deriveDisplayStatusBase?: unknown;
    isEntryWatchReady?: unknown;
    compareRenderableEntries?: unknown;
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
    visible: Record<string, unknown>[];
    audioOptions: Array<{ optionValue: string; title: string }>;
    genreOptions: Array<{ optionValue: string; title: string }>;
    selectedAudioFilter: string;
    selectedGenreFilter: string;
  };

  type BuildRenderableEntriesCacheState = {
    mergedEntriesRef: unknown[] | null;
    mergedSignature: string;
    mergedEntries: Record<string, unknown>[];
    audioValues: string[];
    genreValues: string[];
    filteredSourceEntries: Record<string, unknown>[] | null;
    filteredSignature: string;
    filteredEntries: Record<string, unknown>[];
  };

  type CuratedRenderableRuntime = {
    resolveRenderableFilterContext: (settings: unknown) => FilterContext;
    mergeRenderableEntry: (entry: unknown, filterContext: FilterContext) => Record<string, unknown>;
    collectRenderableAttributeValues: (entries: unknown[], key: string) => string[];
    applyRenderableEntryFilters: (
      mergedEntries: Record<string, unknown>[],
      filterContext: FilterContext,
      watchReadyFilterMode: string,
    ) => Record<string, unknown>[];
    buildRenderableEntries: (entries: unknown[], settings: unknown) => BuildRenderableEntriesResult;
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
    collectRenderableAttributeValues: (entries: unknown[], key: string) => string[];
    applyRenderableEntryFilters: (options: {
      mergedEntries: Record<string, unknown>[];
      filterContext: FilterContext;
      watchReadyFilterMode: string;
      favoritesGenreFilterValue: string;
    }) => Record<string, unknown>[];
    sortDecoratedEntries: (options: {
      decorated: Record<string, unknown>[];
      settingsRecord: Record<string, unknown>;
      compareRenderableEntries: CompareRenderableEntriesFn;
    }) => void;
  };

  type CuratedRenderableMergeSupportRuntime = {
    resolveWatchReadyFilterMode: (value: unknown) => 'none' | 'dim' | 'hide' | 'hide_not_started';
    resolveRenderableFilterContext: (settings: unknown, dependencies: CuratedRenderableDependencies) => FilterContext;
    mergeRenderableEntry: (
      entry: unknown,
      filterContext: FilterContext,
      dependencies: CuratedRenderableDependencies,
    ) => Record<string, unknown>;
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

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated renderable dependency: ${name}`);
    }
    return value as T;
  }

  function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  function getInternalSettingsString(settingsRecord: Record<string, unknown>, key: string): string {
    const value = settingsRecord[key];
    if (typeof value === 'string') {
      return value;
    }
    if (value == null) {
      return '';
    }
    return String(value);
  }

  function getInternalSettingsNumber(settingsRecord: Record<string, unknown>, key: string): number {
    const value = Number(settingsRecord[key]);
    if (!Number.isFinite(value)) {
      return 0;
    }
    return value;
  }

  function resolveCuratedRenderableDependencies(options: CuratedRenderableOptions = {}): CuratedRenderableDependencies {
    return {
      normalizeAudioLocale: requireFunction<NormalizeAudioLocaleFn>(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ),
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
    const listProcessingModule = asRecord(moduleRegistry.runtimeCuratedRenderableListProcessing);
    return requireFunction<() => CuratedRenderableListProcessingRuntime>(
      'createCuratedRenderableListProcessingRuntime',
      listProcessingModule.createCuratedRenderableListProcessingRuntime,
    )();
  }

  function createCuratedRenderableMergeSupportRuntime(): CuratedRenderableMergeSupportRuntime {
    const mergeSupportModule = asRecord(moduleRegistry.runtimeCuratedRenderableMergeSupport);
    return requireFunction<() => CuratedRenderableMergeSupportRuntime>(
      'createCuratedRenderableMergeSupportRuntime',
      mergeSupportModule.createCuratedRenderableMergeSupportRuntime,
    )();
  }

  function buildRenderableEntriesInternal(
    entries: unknown[],
    settings: unknown,
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

    const decorated = filtered.map((entry) => ({
      ...entry,
      dimNotWatchReady: watchReadyFilterMode === 'dim' && !entry.watchReady,
    }));

    listProcessingRuntime.sortDecoratedEntries({
      decorated,
      settingsRecord,
      compareRenderableEntries: dependencies.compareRenderableEntries,
    });

    return {
      mode: watchReadyFilterMode,
      total: merged.length,
      visible: decorated,
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

  moduleRegistry.runtimeRenderable = {
    createCuratedRenderable,
  };
})();
