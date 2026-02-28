(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type CoverImageResult = {
    portrait: string;
    landscape: string;
    fallback: string;
  };

  type RatingPrimitivesDeps = {
    sanitizeRating?: unknown;
    sanitizeVotes?: unknown;
    sanitizePositiveInt?: unknown;
    sanitizePercentage?: unknown;
    normalizeAudioLocales?: unknown;
    normalizeTagList?: unknown;
    extractCoverImagesFromApiImages?: unknown;
  };

  type RatingPrimitivesRuntime = {
    parseRatingPayload: (payload: Record<string, unknown> | null | undefined) => {
      rating: number | null;
      votes: number | null;
    };
    parseRatingDistribution: (ratingBlock: unknown) => Record<string, number | null> | null;
    parseCmsObjectRecord: (record: unknown) => Record<string, unknown>;
  };

  type RatingPrimitivesContext = {
    sanitizeRating: (value: unknown) => number | null;
    sanitizeVotes: (value: unknown) => number | null;
    sanitizePositiveInt: (value: unknown) => number | null;
    sanitizePercentage: (value: unknown) => number | null;
    normalizeAudioLocales: (locales: unknown) => string[];
    normalizeTagList: (values: unknown) => string[];
    extractCoverImagesFromApiImages: (images: unknown) => CoverImageResult;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing rating primitive dependency: ${name}`);
    }
    return value as T;
  }

  function createRatingPrimitivesContext(deps: RatingPrimitivesDeps = {}): RatingPrimitivesContext {
    return {
      sanitizeRating: requireFunction('sanitizeRating', deps.sanitizeRating),
      sanitizeVotes: requireFunction('sanitizeVotes', deps.sanitizeVotes),
      sanitizePositiveInt: requireFunction('sanitizePositiveInt', deps.sanitizePositiveInt),
      sanitizePercentage: requireFunction('sanitizePercentage', deps.sanitizePercentage),
      normalizeAudioLocales: requireFunction('normalizeAudioLocales', deps.normalizeAudioLocales),
      normalizeTagList: requireFunction('normalizeTagList', deps.normalizeTagList),
      extractCoverImagesFromApiImages: requireFunction(
        'extractCoverImagesFromApiImages',
        deps.extractCoverImagesFromApiImages,
      ),
    };
  }

  function parseRatingPayload(
    context: RatingPrimitivesContext,
    payload: Record<string, unknown> | null | undefined,
  ): {
    rating: number | null;
    votes: number | null;
  } {
    const candidateRating = [
      payload?.rating && typeof payload.rating === 'object'
        ? (payload.rating as Record<string, unknown>).average
        : null,
      payload?.rating && typeof payload.rating === 'object' ? (payload.rating as Record<string, unknown>).value : null,
      payload?.average,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>).average : null,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>).rating : null,
      Array.isArray(payload?.data) &&
      payload?.data[0] &&
      typeof payload.data[0] === 'object' &&
      (payload.data[0] as Record<string, unknown>).rating &&
      typeof (payload.data[0] as Record<string, unknown>).rating === 'object'
        ? ((payload.data[0] as Record<string, unknown>).rating as Record<string, unknown>).average
        : null,
      Array.isArray(payload?.data) &&
      payload?.data[0] &&
      typeof payload.data[0] === 'object' &&
      (payload.data[0] as Record<string, unknown>).rating &&
      typeof (payload.data[0] as Record<string, unknown>).rating === 'object'
        ? ((payload.data[0] as Record<string, unknown>).rating as Record<string, unknown>).value
        : null,
      payload?.result && typeof payload.result === 'object'
        ? (payload.result as Record<string, unknown>).average
        : null,
      payload?.aggregateRating && typeof payload.aggregateRating === 'object'
        ? (payload.aggregateRating as Record<string, unknown>).ratingValue
        : null,
      payload?.aggregateRating && typeof payload.aggregateRating === 'object'
        ? (payload.aggregateRating as Record<string, unknown>).rating
        : null,
    ]
      .filter((value) => value != null)
      .map(context.sanitizeRating)
      .find((value) => value != null);

    const candidateVotes = [
      payload?.rating && typeof payload.rating === 'object' ? (payload.rating as Record<string, unknown>).count : null,
      payload?.rating && typeof payload.rating === 'object' ? (payload.rating as Record<string, unknown>).total : null,
      payload?.count,
      payload?.total,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>).count : null,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>).total : null,
      Array.isArray(payload?.data) &&
      payload?.data[0] &&
      typeof payload.data[0] === 'object' &&
      (payload.data[0] as Record<string, unknown>).rating &&
      typeof (payload.data[0] as Record<string, unknown>).rating === 'object'
        ? ((payload.data[0] as Record<string, unknown>).rating as Record<string, unknown>).count
        : null,
      Array.isArray(payload?.data) &&
      payload?.data[0] &&
      typeof payload.data[0] === 'object' &&
      (payload.data[0] as Record<string, unknown>).rating &&
      typeof (payload.data[0] as Record<string, unknown>).rating === 'object'
        ? ((payload.data[0] as Record<string, unknown>).rating as Record<string, unknown>).total
        : null,
      payload?.aggregateRating && typeof payload.aggregateRating === 'object'
        ? (payload.aggregateRating as Record<string, unknown>).ratingCount
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
    ratingBlock: unknown,
  ): Record<string, number | null> | null {
    if (!ratingBlock || typeof ratingBlock !== 'object') {
      return null;
    }

    const distribution: Record<string, number | null> = {};
    let hasAny = false;

    for (let star = 1; star <= 5; star += 1) {
      const bucket = (ratingBlock as Record<string, unknown>)[`${star}s`];
      const bucketRecord = bucket && typeof bucket === 'object' ? (bucket as Record<string, unknown>) : null;
      const percentage = context.sanitizePercentage(bucketRecord?.percentage ?? bucketRecord?.displayed);
      distribution[String(star)] = percentage;
      if (percentage != null) {
        hasAny = true;
      }
    }

    return hasAny ? distribution : null;
  }

  function parseCmsObjectRecord(context: RatingPrimitivesContext, record: unknown): Record<string, unknown> {
    const objectRecord = record && typeof record === 'object' ? (record as Record<string, unknown>) : {};
    const seriesId = typeof objectRecord.id === 'string' ? objectRecord.id : null;
    const parsedRating = parseRatingPayload(context, objectRecord);
    const seriesMetadata =
      objectRecord.series_metadata && typeof objectRecord.series_metadata === 'object'
        ? (objectRecord.series_metadata as Record<string, unknown>)
        : {};
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

  function createRatingPrimitives(deps: RatingPrimitivesDeps = {}): RatingPrimitivesRuntime {
    const context = createRatingPrimitivesContext(deps);
    return {
      parseRatingPayload: (payload) => parseRatingPayload(context, payload),
      parseRatingDistribution: (ratingBlock) => parseRatingDistribution(context, ratingBlock),
      parseCmsObjectRecord: (record) => parseCmsObjectRecord(context, record),
    };
  }

  let domainRegistry = moduleRegistry.domain;
  if (!domainRegistry || typeof domainRegistry !== 'object') {
    domainRegistry = {};
    moduleRegistry.domain = domainRegistry;
  }

  (domainRegistry as Record<string, unknown>).ratingPrimitives = {
    createRatingPrimitives,
  };
})();
