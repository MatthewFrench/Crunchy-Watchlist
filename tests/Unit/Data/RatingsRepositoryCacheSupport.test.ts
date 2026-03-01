import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

type RatingsRepositoryCacheSupportContext = {
  state: {
    ratingCache: Record<string, RatingCacheEntry | Record<string, unknown>>;
    ratingCacheRevision?: number;
  };
  normalizeAudioLocale: (value: unknown) => string;
  normalizeAudioLocales: (values: unknown[]) => string[];
  sanitizePositiveInt: (value: unknown) => number | null;
  normalizeTagList: (values: unknown[]) => string[];
  normalizeImageUrlCandidate: (value: unknown) => string;
  getAudioLocaleCountFromMap: (value: unknown, audioLocale: string) => number | null;
  mergeAudioLocaleCountMap: (source: unknown, audioLocale: string, count: number | null) => Record<string, number>;
  ratingCacheTtlMs: number;
};

type RatingsRepositoryCacheSupportRuntime = {
  createEmptyRatingResult: (preferredAudioLocale?: string) => Record<string, unknown>;
  toRecord: (value: unknown) => Record<string, unknown>;
  isCacheValid: (context: RatingsRepositoryCacheSupportContext, entry: unknown) => entry is RatingCacheEntry;
  normalizeRatingUpdate: (
    context: RatingsRepositoryCacheSupportContext,
    rawValue: unknown,
    preferredAudioLocale?: unknown,
  ) => Record<string, unknown>;
  mergeCachedSeriesData: (
    context: RatingsRepositoryCacheSupportContext,
    seriesId: string,
    nextData: Record<string, unknown>,
  ) => RatingCacheEntry;
  hasEpisodeCountForAudioLocale: (
    context: RatingsRepositoryCacheSupportContext,
    entry: RatingCacheEntry | null,
    audioLocale: string,
  ) => boolean;
};

type RatingsRepositoryCacheSupportModule = {
  createRatingsRepositoryCacheSupportRuntime: () => RatingsRepositoryCacheSupportRuntime;
};

const ratingsRepositoryCacheSupportModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'RatingsRepositoryCacheSupport.ts'),
).href;
let createCacheSupportRuntimeFactory:
  | RatingsRepositoryCacheSupportModule['createRatingsRepositoryCacheSupportRuntime']
  | null = null;

function createContext(): RatingsRepositoryCacheSupportContext {
  const normalizeAudioLocale = (value: unknown): string =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';
  const sanitizePositiveInt = (value: unknown): number | null => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    const rounded = Math.round(parsed);
    return rounded > 0 ? rounded : null;
  };

  return {
    state: {
      ratingCache: {},
      ratingCacheRevision: 0,
    },
    normalizeAudioLocale,
    normalizeAudioLocales: (values: unknown[]) => {
      return Array.from(new Set(values.map((value) => normalizeAudioLocale(value)).filter(Boolean)));
    },
    sanitizePositiveInt,
    normalizeTagList: (values: unknown[]) => {
      return values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    },
    normalizeImageUrlCandidate: (value: unknown) => {
      if (typeof value !== 'string') {
        return '';
      }
      const trimmed = value.trim();
      return /^https?:\/\//i.test(trimmed) ? trimmed : '';
    },
    getAudioLocaleCountFromMap: (value: unknown, audioLocale: string) => {
      if (!value || typeof value !== 'object') {
        return null;
      }
      return sanitizePositiveInt((value as Record<string, unknown>)[audioLocale]);
    },
    mergeAudioLocaleCountMap: (source: unknown, audioLocale: string, count: number | null) => {
      const map = source && typeof source === 'object' ? { ...(source as Record<string, number>) } : {};
      if (audioLocale && count != null) {
        map[audioLocale] = count;
      }
      return map;
    },
    ratingCacheTtlMs: 1_000,
  };
}

describe('ratings-repository-cache-support module', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(ratingsRepositoryCacheSupportModuleUrl)) as RatingsRepositoryCacheSupportModule;
    createCacheSupportRuntimeFactory = module.createRatingsRepositoryCacheSupportRuntime;
  });

  afterEach(() => {
    createCacheSupportRuntimeFactory = null;
    vi.restoreAllMocks();
  });

  it('merges normalized rating data and updates cache revision', () => {
    if (typeof createCacheSupportRuntimeFactory !== 'function') {
      throw new Error('Ratings repository cache support runtime was not initialized for test');
    }
    const runtime = createCacheSupportRuntimeFactory();
    const context = createContext();

    const normalized = runtime.normalizeRatingUpdate(context, {
      rating: '4.8',
      votes: '500',
      distribution: { '5': 300, '4': 200 },
      description: '  High rated  ',
      audioLocales: ['EN-US', 'ja-JP'],
      episodeCount: '24',
      seasonCount: 2,
      genreTags: ['Action', ' Comedy '],
      portraitImageUrl: 'https://images.example.test/portrait.jpg',
      landscapeImageUrl: 'https://images.example.test/landscape.jpg',
      preferredAudioLocale: 'en-US',
    });
    const merged = runtime.mergeCachedSeriesData(context, 'SERIES_1', normalized);

    expect(merged.rating).toBe(4.8);
    expect(merged.votes).toBe(500);
    expect(merged.audioLocales).toEqual(['en-us', 'ja-jp']);
    expect(merged.description).toBe('High rated');
    expect(merged.episodeCount).toBe(24);
    expect(merged.seasonCount).toBe(2);
    expect(merged.episodeCountByAudioLocale['en-us']).toBe(24);
    expect(merged.seasonCountByAudioLocale['en-us']).toBe(2);
    expect(context.state.ratingCacheRevision).toBe(1);
  });

  it('validates cache TTL and locale-specific episode count availability', () => {
    if (typeof createCacheSupportRuntimeFactory !== 'function') {
      throw new Error('Ratings repository cache support runtime was not initialized for test');
    }
    const runtime = createCacheSupportRuntimeFactory();
    const context = createContext();

    const freshEntry: RatingCacheEntry = {
      rating: 4.1,
      votes: 120,
      distribution: {},
      audioLocales: ['en-us'],
      description: '',
      episodeCount: 12,
      seasonCount: 1,
      episodeCountByAudioLocale: { 'en-us': 12 },
      seasonCountByAudioLocale: { 'en-us': 1 },
      genreTags: [],
      portraitImageUrl: null,
      landscapeImageUrl: null,
      updatedAt: Date.now(),
    };
    const staleEntry: RatingCacheEntry = {
      ...freshEntry,
      updatedAt: Date.now() - 5_000,
    };

    expect(runtime.isCacheValid(context, freshEntry)).toBe(true);
    expect(runtime.isCacheValid(context, staleEntry)).toBe(false);
    expect(runtime.hasEpisodeCountForAudioLocale(context, freshEntry, 'en-us')).toBe(true);
    expect(runtime.hasEpisodeCountForAudioLocale(context, freshEntry, 'ja-jp')).toBe(false);
  });

  it('normalizes malformed rating updates into safe cache payloads', () => {
    if (typeof createCacheSupportRuntimeFactory !== 'function') {
      throw new Error('Ratings repository cache support runtime was not initialized for test');
    }
    const runtime = createCacheSupportRuntimeFactory();
    const context = createContext();

    const normalized = runtime.normalizeRatingUpdate(
      context,
      {
        rating: '4.2',
        votes: 'bad-value',
        description: 42,
        audioLocales: [1, 'en-US'],
        episodeCount: '3',
        seasonCount: 1,
        genreTags: ['Action'],
        portraitImageUrl: 'invalid',
      },
      'ja-JP',
    );

    expect(normalized.rating).toBe(4.2);
    expect(normalized.votes).toBeNull();
    expect(normalized.description).toBe('');
    expect(normalized.audioLocales).toEqual(['en-US']);
    expect(normalized.preferredAudioLocale).toBe('ja-jp');
    expect(normalized.portraitImageUrl).toBeNull();
  });
});
