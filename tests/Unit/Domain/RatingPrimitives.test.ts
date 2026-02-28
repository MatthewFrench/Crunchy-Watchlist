import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type RatingPrimitivesRuntime = {
  parseRatingPayload: (payload: Record<string, unknown> | null | undefined) => {
    rating: number | null;
    votes: number | null;
  };
  parseCmsObjectRecord: (record: unknown) => Record<string, unknown>;
};

type RatingPrimitivesModule = {
  createRatingPrimitives: (deps: Record<string, unknown>) => RatingPrimitivesRuntime;
};

const ratingPrimitivesModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Domain', 'RatingPrimitives.ts'),
).href;

function getRatingPrimitivesModule(): RatingPrimitivesModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    domain?: Record<string, unknown>;
  };
  const domainRegistry = registry.domain ?? {};
  return domainRegistry.ratingPrimitives as RatingPrimitivesModule;
}

function createRatingPrimitivesRuntime(): RatingPrimitivesRuntime {
  return getRatingPrimitivesModule().createRatingPrimitives({
    sanitizeRating: (value: unknown) => {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0 || number > 5) {
        return null;
      }
      return Math.round(number * 10) / 10;
    },
    sanitizeVotes: (value: unknown) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
    },
    sanitizePositiveInt: (value: unknown) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
    },
    sanitizePercentage: (value: unknown) => {
      const normalized = typeof value === 'string' ? value.replace('%', '').trim() : value;
      const number = Number(normalized);
      return Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number) : null;
    },
    normalizeAudioLocales: (locales: unknown) => {
      if (!Array.isArray(locales)) {
        return [];
      }
      const dedup = new Set<string>();
      const normalized: string[] = [];
      for (const locale of locales) {
        const value = String(locale || '').trim();
        if (!value) {
          continue;
        }
        const key = value.toLowerCase();
        if (dedup.has(key)) {
          continue;
        }
        dedup.add(key);
        normalized.push(value);
      }
      return normalized;
    },
    normalizeTagList: (values: unknown) => {
      if (!Array.isArray(values)) {
        return [];
      }
      const dedup = new Set<string>();
      const normalized: string[] = [];
      for (const value of values) {
        const text = String(value || '').trim();
        if (!text) {
          continue;
        }
        const key = text.toLowerCase();
        if (dedup.has(key)) {
          continue;
        }
        dedup.add(key);
        normalized.push(text);
      }
      return normalized;
    },
    extractCoverImagesFromApiImages: (images: unknown) => {
      const record = images && typeof images === 'object' ? (images as Record<string, unknown>) : {};
      return {
        portrait: typeof record.portrait === 'string' ? record.portrait : '',
        landscape: typeof record.landscape === 'string' ? record.landscape : '',
        fallback: '',
      };
    },
  });
}

describe('rating-primitives domain module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([ratingPrimitivesModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
  });

  it('parses fallback serialized rating and vote values', () => {
    const runtime = createRatingPrimitivesRuntime();

    const parsed = runtime.parseRatingPayload({
      payload: '{"aggregateRating":{"ratingValue":"4.8","ratingCount":"928"}}',
    });

    expect(parsed.rating).toBe(4.8);
    expect(parsed.votes).toBe(928);
  });

  it('normalizes cms record metadata and rating distribution', () => {
    const runtime = createRatingPrimitivesRuntime();
    const parsed = runtime.parseCmsObjectRecord({
      id: 'GSERIES123',
      description: '  Example series  ',
      rating: {
        '1s': { percentage: '2%' },
        '2s': { percentage: '3%' },
        '3s': { percentage: '10%' },
        '4s': { percentage: '30%' },
        '5s': { percentage: '55%' },
      },
      average: 4.7,
      count: 4000,
      series_metadata: {
        audio_locales: ['en-US', 'EN-us', 'ja-JP'],
        episode_count: 24,
        season_count: 2,
        genres: ['Action'],
        tenant_categories: ['Adventure', 'Action'],
      },
      images: {
        portrait: 'portrait.jpg',
        landscape: 'landscape.jpg',
      },
    });

    expect(parsed.seriesId).toBe('GSERIES123');
    expect(parsed.rating).toBe(4.7);
    expect(parsed.votes).toBe(4000);
    expect(parsed.audioLocales).toEqual(['en-US', 'ja-JP']);
    expect(parsed.genreTags).toEqual(['Action', 'Adventure']);
    expect(parsed.portraitImageUrl).toBe('portrait.jpg');
    expect(parsed.landscapeImageUrl).toBe('landscape.jpg');
    expect(parsed.distribution).toEqual({
      '1': 2,
      '2': 3,
      '3': 10,
      '4': 30,
      '5': 55,
    });
  });
});
