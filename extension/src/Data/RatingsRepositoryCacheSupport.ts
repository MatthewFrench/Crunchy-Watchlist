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

type RatingsRepositoryCacheSupportDependencyContract = {
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
};

type RatingsRepositoryCacheSupportContext = RatingsRepositoryCacheSupportDependencyContract & {
  state: {
    ratingCache: Record<string, RatingCacheEntry | BoundaryRecord>;
    ratingCacheRevision?: number;
  };
  ratingCacheTtlMs: number;
};

type NormalizedRatingUpdate = Partial<RatingResult> & BoundaryRecord;
type RawRatingUpdate = {
  preferredAudioLocale?: BoundaryValue;
  rating?: BoundaryValue;
  votes?: BoundaryValue;
  distribution?: BoundaryValue;
  description?: BoundaryValue;
  audioLocales?: BoundaryValue;
  episodeCount?: BoundaryValue;
  seasonCount?: BoundaryValue;
  genreTags?: BoundaryValue;
  portraitImageUrl?: BoundaryValue;
  landscapeImageUrl?: BoundaryValue;
};

type RatingsRepositoryCacheSupportRuntime = {
  createEmptyRatingResult: (preferredAudioLocale?: string) => RatingResult;
  toRecord: (value: BoundaryValue) => BoundaryRecord;
  isCacheValid: (context: RatingsRepositoryCacheSupportContext, entry: BoundaryValue) => entry is RatingCacheEntry;
  normalizeRatingUpdate: (
    context: RatingsRepositoryCacheSupportContext,
    rawValue: BoundaryValue,
    preferredAudioLocale?: BoundaryValue,
  ) => NormalizedRatingUpdate;
  mergeCachedSeriesData: (
    context: RatingsRepositoryCacheSupportContext,
    seriesId: string,
    nextData: NormalizedRatingUpdate,
  ) => RatingCacheEntry;
  hasEpisodeCountForAudioLocale: (
    context: RatingsRepositoryCacheSupportContext,
    entry: RatingCacheEntry | null,
    audioLocale: string,
  ) => boolean;
};

function createEmptyRatingResult(preferredAudioLocale = ''): RatingResult {
  const result: RatingResult = {
    rating: null,
    votes: null,
    distribution: null,
    description: '',
    audioLocales: [],
    episodeCount: null,
    seasonCount: null,
    genreTags: [],
  };

  if (preferredAudioLocale) {
    result.preferredAudioLocale = preferredAudioLocale;
  }

  return result;
}

function toRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as BoundaryRecord;
}

function toFiniteNumber(value: BoundaryValue): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toStringArray(values: BoundaryValue): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter((value): value is string => typeof value === 'string' && !!value);
}

function toRawRatingUpdate(value: BoundaryValue): RawRatingUpdate {
  return toRecord(value);
}

function toRatingCacheEntry(value: BoundaryValue): Partial<RatingCacheEntry> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as Partial<RatingCacheEntry>;
}

function isCacheValid(context: RatingsRepositoryCacheSupportContext, entry: BoundaryValue): entry is RatingCacheEntry {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  const entryRecord = entry as BoundaryRecord;
  if (!Object.hasOwn(entry, 'distribution')) {
    return false;
  }

  if (!Array.isArray(entryRecord.audioLocales)) {
    return false;
  }

  if (typeof entryRecord.description !== 'string') {
    return false;
  }

  if (!Object.hasOwn(entry, 'episodeCount')) {
    return false;
  }

  if (!Object.hasOwn(entry, 'seasonCount')) {
    return false;
  }

  if (!Array.isArray(entryRecord.genreTags)) {
    return false;
  }

  if (!Object.hasOwn(entry, 'portraitImageUrl')) {
    return false;
  }

  if (!Object.hasOwn(entry, 'landscapeImageUrl')) {
    return false;
  }

  if (typeof entryRecord.updatedAt !== 'number') {
    return false;
  }

  return Date.now() - ((entry as RatingCacheEntry).updatedAt || 0) < context.ratingCacheTtlMs;
}

function mergeCachedSeriesData(
  context: RatingsRepositoryCacheSupportContext,
  seriesId: string,
  nextData: NormalizedRatingUpdate,
): RatingCacheEntry {
  const previous = toRatingCacheEntry(context.state.ratingCache[seriesId]);
  const preferredAudioLocale = context.normalizeAudioLocale(nextData.preferredAudioLocale);
  const normalizedEpisodeCount = context.sanitizePositiveInt(nextData.episodeCount);
  const normalizedSeasonCount = context.sanitizePositiveInt(nextData.seasonCount);
  const previousEpisodeCount = context.sanitizePositiveInt(previous.episodeCount);
  const previousSeasonCount = context.sanitizePositiveInt(previous.seasonCount);
  const episodeCountByAudioLocale = context.mergeAudioLocaleCountMap(
    previous.episodeCountByAudioLocale,
    preferredAudioLocale,
    normalizedEpisodeCount,
  );
  const seasonCountByAudioLocale = context.mergeAudioLocaleCountMap(
    previous.seasonCountByAudioLocale,
    preferredAudioLocale,
    normalizedSeasonCount,
  );

  const merged: RatingCacheEntry = {
    rating: nextData.rating ?? previous.rating ?? null,
    votes: nextData.votes ?? previous.votes ?? null,
    distribution: nextData.distribution ?? previous.distribution ?? null,
    audioLocales:
      Array.isArray(nextData.audioLocales) && nextData.audioLocales.length
        ? context.normalizeAudioLocales(nextData.audioLocales)
        : context.normalizeAudioLocales(toStringArray(previous.audioLocales)),
    description:
      typeof nextData.description === 'string' && nextData.description.trim()
        ? nextData.description.trim()
        : typeof previous.description === 'string'
          ? previous.description
          : '',
    episodeCount:
      normalizedEpisodeCount == null
        ? previousEpisodeCount
        : previousEpisodeCount == null
          ? normalizedEpisodeCount
          : Math.max(previousEpisodeCount, normalizedEpisodeCount),
    seasonCount:
      normalizedSeasonCount == null
        ? previousSeasonCount
        : previousSeasonCount == null
          ? normalizedSeasonCount
          : Math.max(previousSeasonCount, normalizedSeasonCount),
    episodeCountByAudioLocale,
    seasonCountByAudioLocale,
    genreTags:
      Array.isArray(nextData.genreTags) && nextData.genreTags.length
        ? context.normalizeTagList(nextData.genreTags)
        : context.normalizeTagList(toStringArray(previous.genreTags)),
    portraitImageUrl:
      context.normalizeImageUrlCandidate(nextData.portraitImageUrl) ||
      context.normalizeImageUrlCandidate(previous.portraitImageUrl),
    landscapeImageUrl:
      context.normalizeImageUrlCandidate(nextData.landscapeImageUrl) ||
      context.normalizeImageUrlCandidate(previous.landscapeImageUrl),
    updatedAt: Date.now(),
  };

  context.state.ratingCache[seriesId] = merged;
  context.state.ratingCacheRevision = (context.state.ratingCacheRevision || 0) + 1;
  return merged;
}

function normalizeRatingUpdate(
  context: RatingsRepositoryCacheSupportContext,
  rawValue: BoundaryValue,
  preferredAudioLocale: BoundaryValue = '',
): NormalizedRatingUpdate {
  const value = toRawRatingUpdate(rawValue);
  const preferredAudioLanguage = context.normalizeAudioLocale(preferredAudioLocale);
  const normalizedPreferredAudioLocale =
    context.normalizeAudioLocale(value.preferredAudioLocale) || preferredAudioLanguage;

  return {
    ...(normalizedPreferredAudioLocale ? { preferredAudioLocale: normalizedPreferredAudioLocale } : {}),
    rating: toFiniteNumber(value.rating),
    votes: context.sanitizePositiveInt(value.votes),
    distribution: value.distribution ?? null,
    description: typeof value.description === 'string' ? value.description : '',
    audioLocales: toStringArray(value.audioLocales),
    episodeCount: context.sanitizePositiveInt(value.episodeCount),
    seasonCount: context.sanitizePositiveInt(value.seasonCount),
    genreTags: toStringArray(value.genreTags),
    portraitImageUrl: context.normalizeImageUrlCandidate(value.portraitImageUrl) || null,
    landscapeImageUrl: context.normalizeImageUrlCandidate(value.landscapeImageUrl) || null,
  };
}

function hasEpisodeCountForAudioLocale(
  context: RatingsRepositoryCacheSupportContext,
  entry: RatingCacheEntry | null,
  audioLocale: string,
): boolean {
  if (!entry) {
    return false;
  }

  return context.getAudioLocaleCountFromMap(entry.episodeCountByAudioLocale, audioLocale) != null;
}

function createRatingsRepositoryCacheSupportRuntimeInternal(): RatingsRepositoryCacheSupportRuntime {
  return {
    createEmptyRatingResult,
    toRecord,
    isCacheValid,
    normalizeRatingUpdate,
    mergeCachedSeriesData,
    hasEpisodeCountForAudioLocale,
  };
}

const ratingsRepositoryCacheSupportRuntime = createRatingsRepositoryCacheSupportRuntimeInternal();

export function createRatingsRepositoryCacheSupportRuntime(): object {
  return ratingsRepositoryCacheSupportRuntime;
}
