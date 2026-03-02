import { createRatingsRepositoryCacheSupportRuntime as createRatingsRepositoryCacheSupportRuntimeFactory } from './RatingsRepositoryCacheSupport.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type RatingResult = {
  rating: number | null;
  votes: number | null;
  distribution: BoundaryValue;
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
  distribution: BoundaryValue;
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

type NormalizedRatingUpdate = Partial<RatingResult> & BoundaryRecord;
type BatchRatingRecord = BoundaryRecord;
type ParsedBatchRatingRecord = {
  seriesId: string;
  update: NormalizedRatingUpdate;
};

type RatingsRepositoryState = {
  ratingCache: Record<string, RatingCacheEntry | BoundaryRecord>;
  ratingCacheRevision?: number;
  ratingInflight: Map<string, Promise<RatingCacheEntry>>;
};

type RatingsRepositoryDependencyContract = {
  normalizeAudioLocale: (value: BoundaryValue) => string;
  normalizeAudioLocales: (values: BoundaryValue[]) => string[];
  sanitizePositiveInt: (value: BoundaryValue) => number | null;
  normalizeTagList: (values: BoundaryValue[]) => string[];
  normalizeImageUrlCandidate: (value: BoundaryValue) => string;
  getAudioLocaleCountFromMap: (value: BoundaryValue, audioLocale: string) => number | null;
  mergeAudioLocaleCountMap: (
    source: BoundaryValue,
    audioLocale: string,
    count: number | null,
  ) => Record<string, number>;
  getPreferredAudioLanguage: () => string;
  chunkArray: <T>(values: T[], chunkSize: number) => T[][];
  fetchRatingsBatch: (
    tokenEntry: BoundaryValue,
    seriesIds: string[],
    preferredAudioLanguage: string,
  ) => Promise<BatchRatingRecord[]>;
  fetchRating: (seriesId: string, seriesHref: string) => Promise<BoundaryValue>;
  scheduleSaveRatings: () => void;
  runtimeEvent: (event: string, payload?: BoundaryValue) => void;
};

type RatingsRepositoryContext = RatingsRepositoryDependencyContract & {
  state: RatingsRepositoryState;
  ratingBatchSize: number;
  ratingBatchParallelChunks: number;
  ratingCacheTtlMs: number;
};

type RatingsRepositoryCacheSupportRuntime = {
  createEmptyRatingResult: (preferredAudioLocale?: string) => RatingResult;
  toRecord: (value: BoundaryValue) => BoundaryRecord;
  isCacheValid: (context: RatingsRepositoryContext, entry: BoundaryValue) => entry is RatingCacheEntry;
  normalizeRatingUpdate: (
    context: RatingsRepositoryContext,
    rawValue: BoundaryValue,
    preferredAudioLocale?: BoundaryValue,
  ) => NormalizedRatingUpdate;
  mergeCachedSeriesData: (
    context: RatingsRepositoryContext,
    seriesId: string,
    nextData: NormalizedRatingUpdate,
  ) => RatingCacheEntry;
  hasEpisodeCountForAudioLocale: (
    context: RatingsRepositoryContext,
    entry: RatingCacheEntry | null,
    audioLocale: string,
  ) => boolean;
};

type RatingsRepositoryDependencyOptions = {
  [K in keyof RatingsRepositoryDependencyContract]?: BoundaryValue;
};

type RatingsRepositoryOptions = RatingsRepositoryDependencyOptions & {
  state?: BoundaryValue;
  ratingBatchSize?: BoundaryValue;
  ratingBatchParallelChunks?: BoundaryValue;
  ratingCacheTtlMs?: BoundaryValue;
};

type SeriesEntry = {
  seriesId?: BoundaryValue;
  seriesHref?: BoundaryValue;
} & BoundaryRecord;

function requireFunction<T>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing ratings repository dependency: ${name}`);
  }
  return value as T;
}

function resolveRatingsRepositoryCacheSupportRuntime(): RatingsRepositoryCacheSupportRuntime {
  const runtime = createRatingsRepositoryCacheSupportRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing ratings repository dependency: ratingsRepositoryCacheSupport.runtime');
  }

  const runtimeRecord = runtime as BoundaryRecord;
  return {
    createEmptyRatingResult: requireFunction(
      'ratingsRepositoryCacheSupport.createEmptyRatingResult',
      runtimeRecord.createEmptyRatingResult,
    ),
    toRecord: requireFunction('ratingsRepositoryCacheSupport.toRecord', runtimeRecord.toRecord),
    isCacheValid: requireFunction('ratingsRepositoryCacheSupport.isCacheValid', runtimeRecord.isCacheValid),
    normalizeRatingUpdate: requireFunction(
      'ratingsRepositoryCacheSupport.normalizeRatingUpdate',
      runtimeRecord.normalizeRatingUpdate,
    ),
    mergeCachedSeriesData: requireFunction(
      'ratingsRepositoryCacheSupport.mergeCachedSeriesData',
      runtimeRecord.mergeCachedSeriesData,
    ),
    hasEpisodeCountForAudioLocale: requireFunction(
      'ratingsRepositoryCacheSupport.hasEpisodeCountForAudioLocale',
      runtimeRecord.hasEpisodeCountForAudioLocale,
    ),
  };
}

function toRatingsRepositoryState(value: BoundaryValue): RatingsRepositoryState | null {
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

function toSeriesEntries(entries: BoundaryValue): SeriesEntry[] {
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

  const dependencies: RatingsRepositoryDependencyContract = {
    normalizeAudioLocale: requireFunction<RatingsRepositoryDependencyContract['normalizeAudioLocale']>(
      'normalizeAudioLocale',
      options.normalizeAudioLocale,
    ),
    normalizeAudioLocales: requireFunction<RatingsRepositoryDependencyContract['normalizeAudioLocales']>(
      'normalizeAudioLocales',
      options.normalizeAudioLocales,
    ),
    sanitizePositiveInt: requireFunction<RatingsRepositoryDependencyContract['sanitizePositiveInt']>(
      'sanitizePositiveInt',
      options.sanitizePositiveInt,
    ),
    normalizeTagList: requireFunction<RatingsRepositoryDependencyContract['normalizeTagList']>(
      'normalizeTagList',
      options.normalizeTagList,
    ),
    normalizeImageUrlCandidate: requireFunction<RatingsRepositoryDependencyContract['normalizeImageUrlCandidate']>(
      'normalizeImageUrlCandidate',
      options.normalizeImageUrlCandidate,
    ),
    getAudioLocaleCountFromMap: requireFunction<RatingsRepositoryDependencyContract['getAudioLocaleCountFromMap']>(
      'getAudioLocaleCountFromMap',
      options.getAudioLocaleCountFromMap,
    ),
    mergeAudioLocaleCountMap: requireFunction<RatingsRepositoryDependencyContract['mergeAudioLocaleCountMap']>(
      'mergeAudioLocaleCountMap',
      options.mergeAudioLocaleCountMap,
    ),
    getPreferredAudioLanguage: requireFunction<RatingsRepositoryDependencyContract['getPreferredAudioLanguage']>(
      'getPreferredAudioLanguage',
      options.getPreferredAudioLanguage,
    ),
    chunkArray: requireFunction<RatingsRepositoryDependencyContract['chunkArray']>('chunkArray', options.chunkArray),
    fetchRatingsBatch: requireFunction<RatingsRepositoryDependencyContract['fetchRatingsBatch']>(
      'fetchRatingsBatch',
      options.fetchRatingsBatch,
    ),
    fetchRating: requireFunction<RatingsRepositoryDependencyContract['fetchRating']>(
      'fetchRating',
      options.fetchRating,
    ),
    scheduleSaveRatings: requireFunction<RatingsRepositoryDependencyContract['scheduleSaveRatings']>(
      'scheduleSaveRatings',
      options.scheduleSaveRatings,
    ),
    runtimeEvent:
      typeof options.runtimeEvent === 'function'
        ? (options.runtimeEvent as RatingsRepositoryDependencyContract['runtimeEvent'])
        : () => {},
  };

  return {
    state,
    ...dependencies,
    ratingBatchSize: Math.max(1, Number(options.ratingBatchSize) || 1),
    ratingBatchParallelChunks: Math.max(1, Number(options.ratingBatchParallelChunks) || 1),
    ratingCacheTtlMs: Math.max(1, Number(options.ratingCacheTtlMs) || 1),
  };
}

function normalizeFetchedSeriesRatingPayload(
  context: RatingsRepositoryContext,
  cacheSupportRuntime: RatingsRepositoryCacheSupportRuntime,
  seriesId: string,
  fetched: BoundaryValue,
): NormalizedRatingUpdate {
  if (!fetched || typeof fetched !== 'object' || Array.isArray(fetched)) {
    context.runtimeEvent('ratings-contract-warning', {
      scope: 'getSeriesRating',
      reason: 'invalid-rating-payload-root',
      seriesId,
    });
  }

  return cacheSupportRuntime.normalizeRatingUpdate(context, fetched);
}

function parseBatchRatingRecord(
  context: RatingsRepositoryContext,
  cacheSupportRuntime: RatingsRepositoryCacheSupportRuntime,
  record: BatchRatingRecord,
  preferredAudioLanguage: string,
): ParsedBatchRatingRecord | null {
  const recordData = cacheSupportRuntime.toRecord(record);
  const seriesId = typeof recordData.seriesId === 'string' ? recordData.seriesId : '';
  if (!seriesId) {
    return null;
  }

  return {
    seriesId,
    update: cacheSupportRuntime.normalizeRatingUpdate(context, recordData, preferredAudioLanguage),
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
    const entry = cacheSupportRuntime.mergeCachedSeriesData(
      context,
      seriesId,
      normalizeFetchedSeriesRatingPayload(context, cacheSupportRuntime, seriesId, fetched),
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
  tokenEntry: BoundaryValue,
  chunks: string[][],
  preferredAudioLanguage: string,
): Promise<BatchRatingRecord[][]> {
  const chunkResults: BatchRatingRecord[][] = chunks.map(() => []);
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
            ? records.filter((record): record is BatchRatingRecord => !!record && typeof record === 'object')
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
  entries: BoundaryValue,
  tokenEntry: BoundaryValue,
  preferredAudioLanguage: BoundaryValue = context.getPreferredAudioLanguage(),
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
        const parsed = parseBatchRatingRecord(context, cacheSupportRuntime, record, effectivePreferredAudioLanguage);
        if (!parsed) {
          invalidRecords += 1;
          return;
        }

        cacheSupportRuntime.mergeCachedSeriesData(context, parsed.seriesId, parsed.update);
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
  entries: BoundaryValue,
  audioLocale: BoundaryValue,
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
    getSeriesRating: (seriesId: BoundaryValue, seriesHref: BoundaryValue) =>
      getSeriesRatingInternal(
        context,
        cacheSupportRuntime,
        typeof seriesId === 'string' ? seriesId : '',
        typeof seriesHref === 'string' ? seriesHref : '',
      ),
    preloadRatingsForEntries: (
      entries: BoundaryValue,
      tokenEntry: BoundaryValue,
      preferredAudioLanguage: BoundaryValue,
    ) => preloadRatingsForEntriesInternal(context, cacheSupportRuntime, entries, tokenEntry, preferredAudioLanguage),
    getCachedRating: (seriesId: BoundaryValue) =>
      getCachedRatingInternal(context, cacheSupportRuntime, typeof seriesId === 'string' ? seriesId : ''),
    isLocalizedRatingDataMissingForEntries: (entries: BoundaryValue, audioLocale: BoundaryValue) =>
      isLocalizedRatingDataMissingForEntriesInternal(context, cacheSupportRuntime, entries, audioLocale),
  };
}

const ratingsRepositoryRuntime = {
  createRatingsRepository,
};

export function createRatingsRepositoryRuntime(): object {
  return ratingsRepositoryRuntime;
}
