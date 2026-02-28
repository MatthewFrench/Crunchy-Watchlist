export type CoverImageResult = {
  portrait: string;
  landscape: string;
  fallback: string;
};

export type RatingPrimitivesDeps = {
  sanitizeRating: (value: unknown) => number | null;
  sanitizeVotes: (value: unknown) => number | null;
  sanitizePositiveInt: (value: unknown) => number | null;
  sanitizePercentage: (value: unknown) => number | null;
  normalizeAudioLocales: (locales: unknown) => string[];
  normalizeTagList: (values: unknown) => string[];
  extractCoverImagesFromApiImages: (images: unknown) => CoverImageResult;
};

export type RatingPrimitivesRuntime = {
  parseRatingPayload: (payload: Record<string, unknown> | null | undefined) => {
    rating: number | null;
    votes: number | null;
  };
  parseRatingDistribution: (ratingBlock: unknown) => Record<string, number | null> | null;
  parseCmsObjectRecord: (record: unknown) => Record<string, unknown>;
};

export type EpisodePrimitivesDeps = {
  sanitizePositiveInt: (value: unknown) => number | null;
  pickFirstPositiveInt: (values: unknown[]) => number | null;
  normalizeAudioLocale: (locale: unknown) => string | null;
  normalizeAudioLocaleCountMap: (value: unknown) => Record<string, number>;
};

export type EpisodePrimitivesRuntime = {
  extractSeasonCoreFromSeasonId: (value: unknown) => number | null;
  parseCanonicalEpisodeIdentifier: (
    value: unknown,
  ) => { seriesId: string; seasonCore: number; episodeNumber: number; canonicalEpisodeKey: string } | null;
  buildCanonicalEpisodeKey: (seriesId: unknown, seasonCore: unknown, episodeNumber: unknown) => string | null;
  deriveCanonicalEpisodeKeyFromEpisodeMetadata: (meta: unknown, fallbackSeriesId?: unknown) => string | null;
  getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: unknown) => number | null;
  getEpisodeAvailabilityByAudioLocale: (meta: unknown) => Record<string, number>;
  mergeEpisodeAvailabilityByAudioLocale: (previousMap: unknown, nextMap: unknown) => Record<string, number>;
};

function resolveDomainRegistry(moduleRegistry: Record<string, unknown>): Record<string, unknown> {
  return moduleRegistry.domain && typeof moduleRegistry.domain === 'object'
    ? (moduleRegistry.domain as Record<string, unknown>)
    : {};
}

export function createRatingPrimitivesRuntime(
  moduleRegistry: Record<string, unknown>,
  deps: RatingPrimitivesDeps,
): RatingPrimitivesRuntime {
  const domainRegistry = resolveDomainRegistry(moduleRegistry);
  const ratingPrimitivesModule =
    domainRegistry.ratingPrimitives && typeof domainRegistry.ratingPrimitives === 'object'
      ? (domainRegistry.ratingPrimitives as Record<string, unknown>)
      : {};
  const createRatingPrimitives = ratingPrimitivesModule.createRatingPrimitives;
  if (typeof createRatingPrimitives !== 'function') {
    throw new Error('[CW] Missing primitive dependency: createRatingPrimitives');
  }

  const runtime = (createRatingPrimitives as (deps: RatingPrimitivesDeps) => unknown)(
    deps,
  ) as Partial<RatingPrimitivesRuntime>;
  const requiredMethods = ['parseRatingPayload', 'parseRatingDistribution', 'parseCmsObjectRecord'] as const;
  for (const methodName of requiredMethods) {
    if (typeof runtime?.[methodName] !== 'function') {
      throw new Error(`[CW] Missing rating primitive method: ${methodName}`);
    }
  }

  return runtime as RatingPrimitivesRuntime;
}

export function createEpisodePrimitivesRuntime(
  moduleRegistry: Record<string, unknown>,
  deps: EpisodePrimitivesDeps,
): EpisodePrimitivesRuntime {
  const domainRegistry = resolveDomainRegistry(moduleRegistry);
  const episodePrimitivesModule =
    domainRegistry.episodePrimitives && typeof domainRegistry.episodePrimitives === 'object'
      ? (domainRegistry.episodePrimitives as Record<string, unknown>)
      : {};
  const createEpisodePrimitives = episodePrimitivesModule.createEpisodePrimitives;
  if (typeof createEpisodePrimitives !== 'function') {
    throw new Error('[CW] Missing primitive dependency: createEpisodePrimitives');
  }

  const runtime = (createEpisodePrimitives as (deps: EpisodePrimitivesDeps) => unknown)(
    deps,
  ) as Partial<EpisodePrimitivesRuntime>;
  const requiredMethods = [
    'extractSeasonCoreFromSeasonId',
    'parseCanonicalEpisodeIdentifier',
    'buildCanonicalEpisodeKey',
    'deriveCanonicalEpisodeKeyFromEpisodeMetadata',
    'getAbsoluteEpisodeNumberFromEpisodeMetadata',
    'getEpisodeAvailabilityByAudioLocale',
    'mergeEpisodeAvailabilityByAudioLocale',
  ] as const;
  for (const methodName of requiredMethods) {
    if (typeof runtime?.[methodName] !== 'function') {
      throw new Error(`[CW] Missing episode primitive method: ${methodName}`);
    }
  }

  return runtime as EpisodePrimitivesRuntime;
}
