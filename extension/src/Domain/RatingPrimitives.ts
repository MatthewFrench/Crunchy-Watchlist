type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type CoverImageResult = {
  portrait: string;
  landscape: string;
  fallback: string;
};

type SanitizeNumberFn = (value: BoundaryValue) => number | null;
type NormalizeListFn = (values: BoundaryValue) => string[];
type ExtractCoverImagesFn = (images: BoundaryValue) => CoverImageResult;

type RatingPrimitivesDeps = {
  sanitizeRating?: SanitizeNumberFn;
  sanitizeVotes?: SanitizeNumberFn;
  sanitizePositiveInt?: SanitizeNumberFn;
  sanitizePercentage?: SanitizeNumberFn;
  normalizeAudioLocales?: NormalizeListFn;
  normalizeTagList?: NormalizeListFn;
  extractCoverImagesFromApiImages?: ExtractCoverImagesFn;
};

type RatingPrimitivesRuntime = {
  parseRatingPayload: (payload: BoundaryRecord | null | undefined) => {
    rating: number | null;
    votes: number | null;
  };
  parseRatingDistribution: (ratingBlock: BoundaryValue) => Record<string, number | null> | null;
  parseCmsObjectRecord: (record: BoundaryValue) => BoundaryRecord;
};

type RatingPrimitivesContext = {
  sanitizeRating: SanitizeNumberFn;
  sanitizeVotes: SanitizeNumberFn;
  sanitizePositiveInt: SanitizeNumberFn;
  sanitizePercentage: SanitizeNumberFn;
  normalizeAudioLocales: NormalizeListFn;
  normalizeTagList: NormalizeListFn;
  extractCoverImagesFromApiImages: ExtractCoverImagesFn;
};

type RatingPrimitivesModule = {
  createRatingPrimitives: (deps?: RatingPrimitivesDeps) => RatingPrimitivesRuntime;
};

function requireFunction<T>(name: string, value: T | undefined): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing rating primitive dependency: ${name}`);
  }
  return value;
}

function createRatingPrimitivesContext(deps: RatingPrimitivesDeps = {}): RatingPrimitivesContext {
  return {
    sanitizeRating: requireFunction<SanitizeNumberFn>('sanitizeRating', deps.sanitizeRating),
    sanitizeVotes: requireFunction<SanitizeNumberFn>('sanitizeVotes', deps.sanitizeVotes),
    sanitizePositiveInt: requireFunction<SanitizeNumberFn>('sanitizePositiveInt', deps.sanitizePositiveInt),
    sanitizePercentage: requireFunction<SanitizeNumberFn>('sanitizePercentage', deps.sanitizePercentage),
    normalizeAudioLocales: requireFunction<NormalizeListFn>('normalizeAudioLocales', deps.normalizeAudioLocales),
    normalizeTagList: requireFunction<NormalizeListFn>('normalizeTagList', deps.normalizeTagList),
    extractCoverImagesFromApiImages: requireFunction<ExtractCoverImagesFn>(
      'extractCoverImagesFromApiImages',
      deps.extractCoverImagesFromApiImages,
    ),
  };
}

function asRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as BoundaryRecord;
}

function parseRatingPayload(
  context: RatingPrimitivesContext,
  payload: BoundaryRecord | null | undefined,
): {
  rating: number | null;
  votes: number | null;
} {
  const candidateRating = [
    payload?.rating && typeof payload.rating === 'object' ? (payload.rating as BoundaryRecord).average : null,
    payload?.rating && typeof payload.rating === 'object' ? (payload.rating as BoundaryRecord).value : null,
    payload?.average,
    payload?.data && typeof payload.data === 'object' ? (payload.data as BoundaryRecord).average : null,
    payload?.data && typeof payload.data === 'object' ? (payload.data as BoundaryRecord).rating : null,
    Array.isArray(payload?.data) &&
    payload?.data[0] &&
    typeof payload.data[0] === 'object' &&
    (payload.data[0] as BoundaryRecord).rating &&
    typeof (payload.data[0] as BoundaryRecord).rating === 'object'
      ? ((payload.data[0] as BoundaryRecord).rating as BoundaryRecord).average
      : null,
    Array.isArray(payload?.data) &&
    payload?.data[0] &&
    typeof payload.data[0] === 'object' &&
    (payload.data[0] as BoundaryRecord).rating &&
    typeof (payload.data[0] as BoundaryRecord).rating === 'object'
      ? ((payload.data[0] as BoundaryRecord).rating as BoundaryRecord).value
      : null,
    payload?.result && typeof payload.result === 'object' ? (payload.result as BoundaryRecord).average : null,
    payload?.aggregateRating && typeof payload.aggregateRating === 'object'
      ? (payload.aggregateRating as BoundaryRecord).ratingValue
      : null,
    payload?.aggregateRating && typeof payload.aggregateRating === 'object'
      ? (payload.aggregateRating as BoundaryRecord).rating
      : null,
  ]
    .filter((value) => value != null)
    .map(context.sanitizeRating)
    .find((value) => value != null);

  const candidateVotes = [
    payload?.rating && typeof payload.rating === 'object' ? (payload.rating as BoundaryRecord).count : null,
    payload?.rating && typeof payload.rating === 'object' ? (payload.rating as BoundaryRecord).total : null,
    payload?.count,
    payload?.total,
    payload?.data && typeof payload.data === 'object' ? (payload.data as BoundaryRecord).count : null,
    payload?.data && typeof payload.data === 'object' ? (payload.data as BoundaryRecord).total : null,
    Array.isArray(payload?.data) &&
    payload?.data[0] &&
    typeof payload.data[0] === 'object' &&
    (payload.data[0] as BoundaryRecord).rating &&
    typeof (payload.data[0] as BoundaryRecord).rating === 'object'
      ? ((payload.data[0] as BoundaryRecord).rating as BoundaryRecord).count
      : null,
    Array.isArray(payload?.data) &&
    payload?.data[0] &&
    typeof payload.data[0] === 'object' &&
    (payload.data[0] as BoundaryRecord).rating &&
    typeof (payload.data[0] as BoundaryRecord).rating === 'object'
      ? ((payload.data[0] as BoundaryRecord).rating as BoundaryRecord).total
      : null,
    payload?.aggregateRating && typeof payload.aggregateRating === 'object'
      ? (payload.aggregateRating as BoundaryRecord).ratingCount
      : null,
  ]
    .filter((value) => value != null)
    .map(context.sanitizeVotes)
    .find((value) => value != null);

  let rating = candidateRating ?? null;
  let votes = candidateVotes ?? null;

  if (rating == null || votes == null) {
    const serialized = JSON.stringify(payload || {});
    const normalizedSerialized = serialized.replace(/\\"/g, '"');
    const serializedCandidates = [serialized, normalizedSerialized];

    if (rating == null) {
      for (const candidate of serializedCandidates) {
        const ratingMatch = candidate.match(/"(?:average|ratingValue|rating)"\s*:\s*"?([0-5](?:\.\d+)?)"?/i);
        if (!ratingMatch) {
          continue;
        }
        rating = context.sanitizeRating(ratingMatch[1]);
        if (rating != null) {
          break;
        }
      }
    }

    if (votes == null) {
      for (const candidate of serializedCandidates) {
        const votesMatch = candidate.match(/"(?:ratingCount|votes|total|count)"\s*:\s*"?(\d{1,10})"?/i);
        if (!votesMatch) {
          continue;
        }
        votes = context.sanitizeVotes(votesMatch[1]);
        if (votes != null) {
          break;
        }
      }
    }
  }

  return { rating, votes };
}

function parseRatingDistribution(
  context: RatingPrimitivesContext,
  ratingBlock: BoundaryValue,
): Record<string, number | null> | null {
  if (!ratingBlock || typeof ratingBlock !== 'object') {
    return null;
  }

  const distribution: Record<string, number | null> = {};
  let hasAny = false;

  for (let star = 1; star <= 5; star += 1) {
    const bucket = (ratingBlock as BoundaryRecord)[`${star}s`];
    const bucketRecord = bucket && typeof bucket === 'object' ? (bucket as BoundaryRecord) : null;
    const percentage = context.sanitizePercentage(bucketRecord?.percentage ?? bucketRecord?.displayed);
    distribution[String(star)] = percentage;
    if (percentage != null) {
      hasAny = true;
    }
  }

  return hasAny ? distribution : null;
}

function parseCmsObjectRecord(context: RatingPrimitivesContext, record: BoundaryValue): BoundaryRecord {
  const objectRecord = asRecord(record);
  const seriesId = typeof objectRecord.id === 'string' ? objectRecord.id : null;
  const parsedRating = parseRatingPayload(context, objectRecord);
  const seriesMetadata = asRecord(objectRecord.series_metadata);
  const audioLocales = context.normalizeAudioLocales(seriesMetadata.audio_locales);
  const description = typeof objectRecord.description === 'string' ? objectRecord.description.trim() : '';
  const episodeCount = context.sanitizePositiveInt(seriesMetadata.episode_count);
  const seasonCount = context.sanitizePositiveInt(seriesMetadata.season_count);
  const genreTags = context.normalizeTagList([
    ...(Array.isArray(seriesMetadata.genres) ? seriesMetadata.genres : []),
    ...(Array.isArray(seriesMetadata.tenant_categories) ? seriesMetadata.tenant_categories : []),
  ]);
  const coverImages = context.extractCoverImagesFromApiImages(objectRecord.images);
  const ratingRecord = objectRecord.rating && typeof objectRecord.rating === 'object' ? objectRecord.rating : null;

  return {
    seriesId,
    rating: parsedRating.rating,
    votes: parsedRating.votes,
    distribution: parseRatingDistribution(context, ratingRecord),
    audioLocales,
    description,
    episodeCount,
    seasonCount,
    genreTags,
    portraitImageUrl: coverImages.portrait,
    landscapeImageUrl: coverImages.landscape,
  };
}

function createRatingPrimitivesInternal(deps: RatingPrimitivesDeps = {}): RatingPrimitivesRuntime {
  const context = createRatingPrimitivesContext(deps);
  return {
    parseRatingPayload: (payload) => parseRatingPayload(context, payload),
    parseRatingDistribution: (ratingBlock) => parseRatingDistribution(context, ratingBlock),
    parseCmsObjectRecord: (record) => parseCmsObjectRecord(context, record),
  };
}
const ratingPrimitivesRuntime: RatingPrimitivesModule = {
  createRatingPrimitives,
};

export function createRatingPrimitives(deps: RatingPrimitivesDeps = {}): RatingPrimitivesRuntime {
  return createRatingPrimitivesInternal(deps);
}

export function createRatingPrimitivesRuntime(): RatingPrimitivesModule {
  return ratingPrimitivesRuntime;
}
