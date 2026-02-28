(() => {
  type RatingResult = {
    rating: number | null;
    votes: number | null;
    distribution: unknown;
    description: string;
    audioLocales: string[];
    episodeCount: number | null;
    seasonCount: number | null;
    genreTags: string[];
    portraitImageUrl?: string | null;
    landscapeImageUrl?: string | null;
    preferredAudioLocale?: string;
  };

  type RatingCacheEntry = {
    rating: number | null;
    votes: number | null;
    distribution: unknown;
    audioLocales: string[];
    description: string;
    episodeCount: number | null;
    seasonCount: number | null;
    episodeCountByAudioLocale: Record<string, number>;
    seasonCountByAudioLocale: Record<string, number>;
    genreTags: string[];
    portraitImageUrl?: string | null;
    landscapeImageUrl?: string | null;
    updatedAt: number;
  };

  type RatingsRepositoryState = {
    ratingCache: Record<string, RatingCacheEntry | Record<string, unknown>>;
    ratingCacheRevision?: number;
    ratingInflight: Map<string, Promise<RatingCacheEntry>>;
  };

  type RatingsRepositoryContext = {
    state: RatingsRepositoryState;
    normalizeAudioLocale: (value: unknown) => string;
    normalizeAudioLocales: (values: unknown[]) => string[];
    sanitizePositiveInt: (value: unknown) => number | null;
    normalizeTagList: (values: unknown[]) => string[];
    normalizeImageUrlCandidate: (value: unknown) => string;
    getAudioLocaleCountFromMap: (value: unknown, audioLocale: string) => number | null;
    mergeAudioLocaleCountMap: (source: unknown, audioLocale: string, count: number | null) => Record<string, number>;
    getPreferredAudioLanguage: () => string;
    chunkArray: <T>(values: T[], chunkSize: number) => T[][];
    fetchRatingsBatch: (
      tokenEntry: unknown,
      seriesIds: string[],
      preferredAudioLanguage: string,
    ) => Promise<Array<Record<string, unknown>>>;
    fetchRating: (seriesId: string, seriesHref: string) => Promise<unknown>;
    scheduleSaveRatings: () => void;
    runtimeEvent: (event: string, payload?: unknown) => void;
    ratingBatchSize: number;
    ratingBatchParallelChunks: number;
    ratingCacheTtlMs: number;
  };

  type RatingsRepositoryCacheSupportRuntime = {
    createEmptyRatingResult: (preferredAudioLocale?: string) => RatingResult;
    toRecord: (value: unknown) => Record<string, unknown>;
    isCacheValid: (context: RatingsRepositoryContext, entry: unknown) => entry is RatingCacheEntry;
    normalizeRatingUpdate: (
      context: RatingsRepositoryContext,
      rawValue: unknown,
      preferredAudioLocale?: unknown,
    ) => Partial<RatingResult> & Record<string, unknown>;
    mergeCachedSeriesData: (
      context: RatingsRepositoryContext,
      seriesId: string,
      nextData: Partial<RatingResult> & Record<string, unknown>,
    ) => RatingCacheEntry;
    hasEpisodeCountForAudioLocale: (
      context: RatingsRepositoryContext,
      entry: RatingCacheEntry | null,
      audioLocale: string,
    ) => boolean;
  };

  type RatingsRepositoryOptions = {
    state?: unknown;
    normalizeAudioLocale?: unknown;
    normalizeAudioLocales?: unknown;
    sanitizePositiveInt?: unknown;
    normalizeTagList?: unknown;
    normalizeImageUrlCandidate?: unknown;
    getAudioLocaleCountFromMap?: unknown;
    mergeAudioLocaleCountMap?: unknown;
    getPreferredAudioLanguage?: unknown;
    chunkArray?: unknown;
    fetchRatingsBatch?: unknown;
    fetchRating?: unknown;
    scheduleSaveRatings?: unknown;
    runtimeEvent?: unknown;
    ratingBatchSize?: unknown;
    ratingBatchParallelChunks?: unknown;
    ratingCacheTtlMs?: unknown;
  };

  type SeriesEntry = {
    seriesId?: unknown;
    seriesHref?: unknown;
  } & Record<string, unknown>;

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing ratings repository dependency: ${name}`);
    }
    return value as T;
  }

  function requireRuntimeFactory<T>(moduleName: string, factoryName: string): () => T {
    const moduleValue = moduleRegistry[moduleName];
    if (!moduleValue || typeof moduleValue !== 'object') {
      throw new Error(`[CW] Missing ratings repository dependency: ${moduleName}`);
    }

    const factory = (moduleValue as Record<string, unknown>)[factoryName];
    if (typeof factory !== 'function') {
      throw new Error(`[CW] Missing ratings repository dependency: ${moduleName}.${factoryName}`);
    }

    return factory as () => T;
  }

  function resolveRatingsRepositoryCacheSupportRuntime(): RatingsRepositoryCacheSupportRuntime {
    const createRuntime = requireRuntimeFactory<unknown>(
      'ratingsRepositoryCacheSupport',
      'createRatingsRepositoryCacheSupportRuntime',
    );
    const runtime = createRuntime();
    if (!runtime || typeof runtime !== 'object') {
      throw new Error('[CW] Missing ratings repository dependency: ratingsRepositoryCacheSupport.runtime');
    }

    return {
      createEmptyRatingResult: requireFunction(
        'ratingsRepositoryCacheSupport.createEmptyRatingResult',
        (runtime as Record<string, unknown>).createEmptyRatingResult,
      ),
      toRecord: requireFunction(
        'ratingsRepositoryCacheSupport.toRecord',
        (runtime as Record<string, unknown>).toRecord,
      ),
      isCacheValid: requireFunction(
        'ratingsRepositoryCacheSupport.isCacheValid',
        (runtime as Record<string, unknown>).isCacheValid,
      ),
      normalizeRatingUpdate: requireFunction(
        'ratingsRepositoryCacheSupport.normalizeRatingUpdate',
        (runtime as Record<string, unknown>).normalizeRatingUpdate,
      ),
      mergeCachedSeriesData: requireFunction(
        'ratingsRepositoryCacheSupport.mergeCachedSeriesData',
        (runtime as Record<string, unknown>).mergeCachedSeriesData,
      ),
      hasEpisodeCountForAudioLocale: requireFunction(
        'ratingsRepositoryCacheSupport.hasEpisodeCountForAudioLocale',
        (runtime as Record<string, unknown>).hasEpisodeCountForAudioLocale,
      ),
    };
  }

  function toRatingsRepositoryState(value: unknown): RatingsRepositoryState | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const state = value as Partial<RatingsRepositoryState>;

    if (!state.ratingCache || typeof state.ratingCache !== 'object') {
      state.ratingCache = {};
    }

    if (!(state.ratingInflight instanceof Map)) {
      state.ratingInflight = new Map<string, Promise<RatingCacheEntry>>();
    }

    const ratingCacheRevision = Number(state.ratingCacheRevision);
    state.ratingCacheRevision =
      Number.isFinite(ratingCacheRevision) && ratingCacheRevision >= 0 ? ratingCacheRevision : 0;

    return state as RatingsRepositoryState;
  }

  function toSeriesEntries(entries: unknown): SeriesEntry[] {
    if (!Array.isArray(entries)) {
      return [];
    }

    return entries.filter((entry): entry is SeriesEntry => !!entry && typeof entry === 'object');
  }

  function createRatingsRepositoryContext(options: RatingsRepositoryOptions = {}): RatingsRepositoryContext {
    const state = toRatingsRepositoryState(options.state);
    if (!state) {
      throw new Error('[CW] Missing ratings repository state');
    }

    return {
      state,
      normalizeAudioLocale: requireFunction(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ) as RatingsRepositoryContext['normalizeAudioLocale'],
      normalizeAudioLocales: requireFunction(
        'normalizeAudioLocales',
        options.normalizeAudioLocales,
      ) as RatingsRepositoryContext['normalizeAudioLocales'],
      sanitizePositiveInt: requireFunction(
        'sanitizePositiveInt',
        options.sanitizePositiveInt,
      ) as RatingsRepositoryContext['sanitizePositiveInt'],
      normalizeTagList: requireFunction(
        'normalizeTagList',
        options.normalizeTagList,
      ) as RatingsRepositoryContext['normalizeTagList'],
      normalizeImageUrlCandidate: requireFunction(
        'normalizeImageUrlCandidate',
        options.normalizeImageUrlCandidate,
      ) as RatingsRepositoryContext['normalizeImageUrlCandidate'],
      getAudioLocaleCountFromMap: requireFunction(
        'getAudioLocaleCountFromMap',
        options.getAudioLocaleCountFromMap,
      ) as RatingsRepositoryContext['getAudioLocaleCountFromMap'],
      mergeAudioLocaleCountMap: requireFunction(
        'mergeAudioLocaleCountMap',
        options.mergeAudioLocaleCountMap,
      ) as RatingsRepositoryContext['mergeAudioLocaleCountMap'],
      getPreferredAudioLanguage: requireFunction(
        'getPreferredAudioLanguage',
        options.getPreferredAudioLanguage,
      ) as RatingsRepositoryContext['getPreferredAudioLanguage'],
      chunkArray: requireFunction('chunkArray', options.chunkArray) as RatingsRepositoryContext['chunkArray'],
      fetchRatingsBatch: requireFunction(
        'fetchRatingsBatch',
        options.fetchRatingsBatch,
      ) as RatingsRepositoryContext['fetchRatingsBatch'],
      fetchRating: requireFunction('fetchRating', options.fetchRating) as RatingsRepositoryContext['fetchRating'],
      scheduleSaveRatings: requireFunction(
        'scheduleSaveRatings',
        options.scheduleSaveRatings,
      ) as RatingsRepositoryContext['scheduleSaveRatings'],
      runtimeEvent:
        typeof options.runtimeEvent === 'function'
          ? (options.runtimeEvent as RatingsRepositoryContext['runtimeEvent'])
          : () => {},
      ratingBatchSize: Math.max(1, Number(options.ratingBatchSize) || 1),
      ratingBatchParallelChunks: Math.max(1, Number(options.ratingBatchParallelChunks) || 1),
      ratingCacheTtlMs: Math.max(1, Number(options.ratingCacheTtlMs) || 1),
    };
  }

  async function getSeriesRatingInternal(
    context: RatingsRepositoryContext,
    cacheSupportRuntime: RatingsRepositoryCacheSupportRuntime,
    seriesId: string,
    seriesHref: string,
  ): Promise<RatingCacheEntry> {
    const cached = context.state.ratingCache[seriesId];
    if (cacheSupportRuntime.isCacheValid(context, cached)) {
      return cached;
    }

    const inflightCached = context.state.ratingInflight.get(seriesId);
    if (inflightCached) {
      return inflightCached;
    }

    const inflight = (async () => {
      const fetched = await context.fetchRating(seriesId, seriesHref);
      if (!fetched || typeof fetched !== 'object' || Array.isArray(fetched)) {
        context.runtimeEvent('ratings-contract-warning', {
          scope: 'getSeriesRating',
          reason: 'invalid-rating-payload-root',
          seriesId,
        });
      }

      const entry = cacheSupportRuntime.mergeCachedSeriesData(
        context,
        seriesId,
        cacheSupportRuntime.normalizeRatingUpdate(context, fetched),
      );
      context.scheduleSaveRatings();
      return entry;
    })()
      .catch(() =>
        cacheSupportRuntime.mergeCachedSeriesData(context, seriesId, cacheSupportRuntime.createEmptyRatingResult()),
      )
      .finally(() => {
        context.state.ratingInflight.delete(seriesId);
      });

    context.state.ratingInflight.set(seriesId, inflight);
    return inflight;
  }

  async function fetchRatingsBatchChunksInternal(
    context: RatingsRepositoryContext,
    tokenEntry: unknown,
    chunks: string[][],
    preferredAudioLanguage: string,
  ): Promise<Array<Array<Record<string, unknown>>>> {
    const chunkResults: Array<Array<Record<string, unknown>>> = chunks.map(() => []);
    let nextChunkIndex = 0;

    const workerCount = Math.min(chunks.length, context.ratingBatchParallelChunks);
    if (workerCount <= 0) {
      return chunkResults;
    }

    const workers = Array.from({ length: workerCount }, () =>
      (async () => {
        while (nextChunkIndex < chunks.length) {
          const currentChunkIndex = nextChunkIndex;
          nextChunkIndex += 1;
          const chunk = chunks[currentChunkIndex];
          if (!chunk || !chunk.length) {
            continue;
          }

          try {
            const records = await context.fetchRatingsBatch(tokenEntry, chunk, preferredAudioLanguage);
            chunkResults[currentChunkIndex] = Array.isArray(records)
              ? records.filter((record): record is Record<string, unknown> => !!record && typeof record === 'object')
              : [];
          } catch {
            chunkResults[currentChunkIndex] = [];
          }
        }
      })(),
    );

    await Promise.all(workers);
    return chunkResults;
  }

  async function preloadRatingsForEntriesInternal(
    context: RatingsRepositoryContext,
    cacheSupportRuntime: RatingsRepositoryCacheSupportRuntime,
    entries: unknown,
    tokenEntry: unknown,
    preferredAudioLanguage: unknown = context.getPreferredAudioLanguage(),
  ): Promise<void> {
    const effectivePreferredAudioLanguage =
      context.normalizeAudioLocale(preferredAudioLanguage) || context.getPreferredAudioLanguage();
    const allSeriesIds = Array.from(
      new Set(
        toSeriesEntries(entries)
          .map((entry) => (typeof entry.seriesId === 'string' ? entry.seriesId : ''))
          .filter(Boolean),
      ),
    );
    const staleSeriesIds = allSeriesIds.filter((seriesId) => {
      const cachedEntry = context.state.ratingCache[seriesId];
      if (!cacheSupportRuntime.isCacheValid(context, cachedEntry)) {
        return true;
      }

      return !cacheSupportRuntime.hasEpisodeCountForAudioLocale(context, cachedEntry, effectivePreferredAudioLanguage);
    });

    if (!staleSeriesIds.length) {
      return;
    }

    let updated = 0;
    let invalidRecords = 0;

    const tokenEntryRecord = cacheSupportRuntime.toRecord(tokenEntry);
    if (typeof tokenEntryRecord.accessToken === 'string' && tokenEntryRecord.accessToken) {
      const chunks = context.chunkArray(staleSeriesIds, context.ratingBatchSize);
      const chunkResults = await fetchRatingsBatchChunksInternal(
        context,
        tokenEntry,
        chunks,
        effectivePreferredAudioLanguage,
      );
      chunkResults.forEach((records) => {
        records.forEach((record) => {
          const recordData = cacheSupportRuntime.toRecord(record);
          const seriesId = typeof recordData.seriesId === 'string' ? recordData.seriesId : '';
          if (!seriesId) {
            invalidRecords += 1;
            return;
          }

          cacheSupportRuntime.mergeCachedSeriesData(
            context,
            seriesId,
            cacheSupportRuntime.normalizeRatingUpdate(context, recordData, effectivePreferredAudioLanguage),
          );
          updated += 1;
        });
      });
    }

    if (updated > 0) {
      context.scheduleSaveRatings();
    }

    if (invalidRecords > 0) {
      context.runtimeEvent('ratings-contract-warning', {
        scope: 'preloadRatingsForEntries',
        reason: 'invalid-batch-record',
        preferredAudioLanguage: effectivePreferredAudioLanguage,
        invalidRecords,
      });
    }

    context.runtimeEvent('ratings-preload', {
      preferredAudioLanguage: effectivePreferredAudioLanguage,
      stale: staleSeriesIds.length,
      updated,
      invalidRecords,
    });
  }

  function getCachedRatingInternal(
    context: RatingsRepositoryContext,
    cacheSupportRuntime: RatingsRepositoryCacheSupportRuntime,
    seriesId: string,
  ): RatingCacheEntry | null {
    const cached = context.state.ratingCache[seriesId];
    return cacheSupportRuntime.isCacheValid(context, cached) ? cached : null;
  }

  function isLocalizedRatingDataMissingForEntriesInternal(
    context: RatingsRepositoryContext,
    cacheSupportRuntime: RatingsRepositoryCacheSupportRuntime,
    entries: unknown,
    audioLocale: unknown,
  ): boolean {
    const selectedAudioLocale = context.normalizeAudioLocale(audioLocale);
    if (!selectedAudioLocale) {
      return false;
    }

    const inputEntries = toSeriesEntries(entries);
    if (!inputEntries.length) {
      return false;
    }

    return inputEntries.some((entry) => {
      const seriesId = typeof entry.seriesId === 'string' ? entry.seriesId : '';
      if (!seriesId) {
        return false;
      }

      const cached = context.state.ratingCache[seriesId];
      if (!cacheSupportRuntime.isCacheValid(context, cached)) {
        return true;
      }

      return !cacheSupportRuntime.hasEpisodeCountForAudioLocale(context, cached, selectedAudioLocale);
    });
  }

  function createRatingsRepository(options: RatingsRepositoryOptions = {}) {
    const context = createRatingsRepositoryContext(options);
    const cacheSupportRuntime = resolveRatingsRepositoryCacheSupportRuntime();
    return {
      getSeriesRating: (seriesId: unknown, seriesHref: unknown) =>
        getSeriesRatingInternal(
          context,
          cacheSupportRuntime,
          typeof seriesId === 'string' ? seriesId : '',
          typeof seriesHref === 'string' ? seriesHref : '',
        ),
      preloadRatingsForEntries: (entries: unknown, tokenEntry: unknown, preferredAudioLanguage: unknown) =>
        preloadRatingsForEntriesInternal(context, cacheSupportRuntime, entries, tokenEntry, preferredAudioLanguage),
      getCachedRating: (seriesId: unknown) =>
        getCachedRatingInternal(context, cacheSupportRuntime, typeof seriesId === 'string' ? seriesId : ''),
      isLocalizedRatingDataMissingForEntries: (entries: unknown, audioLocale: unknown) =>
        isLocalizedRatingDataMissingForEntriesInternal(context, cacheSupportRuntime, entries, audioLocale),
    };
  }

  moduleRegistry.ratingsRepository = {
    createRatingsRepository,
  };
})();
