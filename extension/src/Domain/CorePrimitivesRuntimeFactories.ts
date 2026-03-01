import { createEpisodePrimitives } from './EpisodePrimitives.js';
import { createRatingPrimitives } from './RatingPrimitives.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryValues = BoundaryValue[];

export type CoverImageResult = {
  portrait: string;
  landscape: string;
  fallback: string;
};

export type RatingPrimitivesDeps = {
  sanitizeRating: (value: BoundaryValue) => number | null;
  sanitizeVotes: (value: BoundaryValue) => number | null;
  sanitizePositiveInt: (value: BoundaryValue) => number | null;
  sanitizePercentage: (value: BoundaryValue) => number | null;
  normalizeAudioLocales: (locales: BoundaryValue) => string[];
  normalizeTagList: (values: BoundaryValue) => string[];
  extractCoverImagesFromApiImages: (images: BoundaryValue) => CoverImageResult;
};

export type RatingPrimitivesRuntime = {
  parseRatingPayload: (payload: BoundaryRecord | null | undefined) => {
    rating: number | null;
    votes: number | null;
  };
  parseRatingDistribution: (ratingBlock: BoundaryValue) => Record<string, number | null> | null;
  parseCmsObjectRecord: (record: BoundaryValue) => BoundaryRecord;
};

export type EpisodePrimitivesDeps = {
  sanitizePositiveInt: (value: BoundaryValue) => number | null;
  pickFirstPositiveInt: (values: BoundaryValues) => number | null;
  normalizeAudioLocale: (locale: BoundaryValue) => string | null;
  normalizeAudioLocaleCountMap: (value: BoundaryValue) => Record<string, number>;
};

export type EpisodePrimitivesRuntime = {
  extractSeasonCoreFromSeasonId: (value: BoundaryValue) => number | null;
  parseCanonicalEpisodeIdentifier: (
    value: BoundaryValue,
  ) => { seriesId: string; seasonCore: number; episodeNumber: number; canonicalEpisodeKey: string } | null;
  buildCanonicalEpisodeKey: (
    seriesId: BoundaryValue,
    seasonCore: BoundaryValue,
    episodeNumber: BoundaryValue,
  ) => string | null;
  deriveCanonicalEpisodeKeyFromEpisodeMetadata: (
    meta: BoundaryValue,
    fallbackSeriesId?: BoundaryValue,
  ) => string | null;
  getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: BoundaryValue) => number | null;
  getEpisodeAvailabilityByAudioLocale: (meta: BoundaryValue) => Record<string, number>;
  mergeEpisodeAvailabilityByAudioLocale: (previousMap: BoundaryValue, nextMap: BoundaryValue) => Record<string, number>;
};

export function createRatingPrimitivesRuntime(deps: RatingPrimitivesDeps): RatingPrimitivesRuntime {
  const runtime = createRatingPrimitives(deps) as Partial<RatingPrimitivesRuntime>;
  const requiredMethods = ['parseRatingPayload', 'parseRatingDistribution', 'parseCmsObjectRecord'] as const;
  for (const methodName of requiredMethods) {
    if (typeof runtime?.[methodName] !== 'function') {
      throw new Error(`[CW] Missing rating primitive method: ${methodName}`);
    }
  }

  return runtime as RatingPrimitivesRuntime;
}

export function createEpisodePrimitivesRuntime(deps: EpisodePrimitivesDeps): EpisodePrimitivesRuntime {
  const runtime = createEpisodePrimitives(deps) as Partial<EpisodePrimitivesRuntime>;
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
