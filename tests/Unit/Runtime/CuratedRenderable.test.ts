import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FilterContext = {
  effectiveAudioFilter: string;
  effectiveGenreFilter: string;
  selectedAudioLocale: string | null;
  selectedAudioIsDefaultPreferred: boolean;
  localizedAudioForCounts: string | null;
};

type CuratedRenderableRuntime = {
  resolveRenderableFilterContext: (settings: Record<string, unknown>) => FilterContext;
  mergeRenderableEntry: (entry: Record<string, unknown>, filterContext: FilterContext) => Record<string, unknown>;
  buildRenderableEntries: (
    entries: Record<string, unknown>[],
    settings: Record<string, unknown>,
  ) => {
    mode: string;
    total: number;
    visible: Array<Record<string, unknown>>;
    audioOptions: Array<{ optionValue: string; title: string }>;
    genreOptions: Array<{ optionValue: string; title: string }>;
    selectedAudioFilter: string;
    selectedGenreFilter: string;
  };
};

type CuratedRenderableModule = {
  createCuratedRenderable: (options: Record<string, unknown>) => CuratedRenderableRuntime;
};

const curatedRenderableModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedRenderable.ts'),
).href;
let curatedRenderableModule: CuratedRenderableModule | null = null;

function getCuratedRenderableModule() {
  if (!curatedRenderableModule) {
    throw new Error('Curated renderable module was not initialized for test');
  }
  return curatedRenderableModule;
}

function normalizeAudioLocales(locales: unknown[]): string[] {
  if (!Array.isArray(locales)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const locale of locales) {
    const value = typeof locale === 'string' ? locale.trim() : '';
    if (!value) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
}

function normalizeTagList(values: unknown[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(
      (value, index, source) =>
        Boolean(value) && source.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index,
    );
}

function createCuratedRenderableRuntime(
  options: {
    ratingsBySeriesId?: Record<string, Record<string, unknown>>;
    historyBySeriesId?: Record<string, Record<string, unknown>>;
    historyBySeriesIdAudio?: Record<string, Record<string, unknown>>;
    progressBySeriesId?: Record<string, Record<string, unknown>>;
    progressBySeriesIdAudio?: Record<string, Record<string, unknown>>;
    preferredAudioLanguage?: string;
    getLocalizedSeriesCount?: (ratingEntry: unknown, audioLocale: unknown, countType: unknown) => number | null;
    deriveDisplayStatusBase?: (entry: unknown, watchHistoryEntry: unknown) => string;
    isEntryWatchReady?: (entry: unknown) => boolean;
    compareRenderableEntries?: (left: unknown, right: unknown, sortMode?: unknown) => number;
  } = {},
): CuratedRenderableRuntime {
  const {
    ratingsBySeriesId = {},
    historyBySeriesId = {},
    historyBySeriesIdAudio = {},
    progressBySeriesId = {},
    progressBySeriesIdAudio = {},
    preferredAudioLanguage = 'en-us',
    getLocalizedSeriesCount = () => null,
    deriveDisplayStatusBase = (_entry: unknown, watchHistoryEntry: unknown) => (watchHistoryEntry ? 'continue' : 'new'),
    isEntryWatchReady = (entry: unknown) => Boolean((entry as Record<string, unknown>).watchReadyHint),
    compareRenderableEntries = (left: unknown, right: unknown) =>
      Number((left as Record<string, unknown>).sortOrder || 0) -
      Number((right as Record<string, unknown>).sortOrder || 0),
  } = options;

  return getCuratedRenderableModule().createCuratedRenderable({
    normalizeAudioLocale: (value: unknown) => {
      if (typeof value !== 'string') {
        return null;
      }
      const normalized = value.trim().toLowerCase();
      return normalized || null;
    },
    getPreferredAudioLanguage: () => preferredAudioLanguage,
    getCachedRating: (seriesId: unknown) => ratingsBySeriesId[String(seriesId || '')] ?? null,
    getCachedWatchHistory: (seriesId: unknown, audioLocale?: unknown) => {
      const normalizedSeriesId = String(seriesId || '');
      const normalizedAudio = typeof audioLocale === 'string' ? audioLocale.trim().toLowerCase() : '';
      if (normalizedAudio) {
        return historyBySeriesIdAudio[`${normalizedSeriesId}|${normalizedAudio}`] ?? null;
      }
      return historyBySeriesId[normalizedSeriesId] ?? null;
    },
    getCachedWatchHistoryProgress: (seriesId: unknown, audioLocale?: unknown) => {
      const normalizedSeriesId = String(seriesId || '');
      const normalizedAudio = typeof audioLocale === 'string' ? audioLocale.trim().toLowerCase() : '';
      if (normalizedAudio) {
        return progressBySeriesIdAudio[`${normalizedSeriesId}|${normalizedAudio}`] ?? null;
      }
      return progressBySeriesId[normalizedSeriesId] ?? null;
    },
    normalizeAudioLocales,
    hasEnUsAudio: (locales: unknown[]) =>
      normalizeAudioLocales(locales).some((locale) => locale.toLowerCase() === 'en-us'),
    normalizeTagList,
    normalizeImageUrlCandidate: (value: unknown) => {
      if (typeof value !== 'string') {
        return null;
      }
      const normalized = value.trim();
      return normalized || null;
    },
    getAudioLocaleCountFromMap: (map: unknown, audioLocale: unknown) => {
      if (!map || typeof map !== 'object' || Array.isArray(map)) {
        return null;
      }
      if (typeof audioLocale !== 'string') {
        return null;
      }
      const key = audioLocale.trim().toLowerCase();
      const value = (map as Record<string, unknown>)[key];
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
    },
    getLocalizedSeriesCount,
    sanitizePositiveInt: (value: unknown) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
    },
    pickFirstDateMs: (values: unknown[]) => {
      for (const value of values) {
        const number = Number(value);
        if (Number.isFinite(number) && number > 0) {
          return Math.round(number);
        }
      }
      return null;
    },
    deriveDisplayStatusBase,
    isEntryWatchReady,
    compareRenderableEntries: (left: unknown, right: unknown, sortMode?: unknown) =>
      compareRenderableEntries(left, right, sortMode),
  });
}

describe('curated-renderable runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const curatedRenderableRuntimeModule = (await import(curatedRenderableModuleUrl)) as {
      createRuntimeRenderableRuntime: () => object;
    };
    curatedRenderableModule =
      curatedRenderableRuntimeModule.createRuntimeRenderableRuntime() as CuratedRenderableModule;
  });

  afterEach(() => {
    curatedRenderableModule = null;
  });

  it('builds renderable entries with merged cache fields and dim filter mode', () => {
    const runtime = createCuratedRenderableRuntime({
      ratingsBySeriesId: {
        'series-1': {
          rating: 4.6,
          votes: 1234,
          audioLocales: ['en-US', 'ja-JP'],
          genreTags: ['Action', 'Drama'],
          description: 'Rating override description',
        },
      },
      historyBySeriesId: {
        'series-1': { datePlayedMs: 1700000000000 },
      },
    });

    const entries = [
      {
        seriesId: 'series-1',
        title: 'First Show',
        audioLocales: ['en-US'],
        genreTags: ['Action'],
        episodeCount: 24,
        seasonCount: 2,
        watchReadyHint: true,
        sortOrder: 2,
      },
      {
        seriesId: 'series-2',
        title: 'Second Show',
        audioLocales: ['en-US'],
        genreTags: ['Action'],
        episodeCount: 12,
        seasonCount: 1,
        watchReadyHint: false,
        sortOrder: 1,
      },
    ];

    const result = runtime.buildRenderableEntries(entries, {
      audioLocaleFilter: 'en-US',
      genreFilter: 'Action',
      watchReadyFilterMode: 'dim',
    });

    expect(result.mode).toBe('dim');
    expect(result.total).toBe(2);
    expect(result.visible).toHaveLength(2);
    expect(result.visible[0]?.seriesId).toBe('series-2');
    expect(result.visible[0]?.dimNotWatchReady).toBe(true);
    expect(result.visible[1]?.rating).toBe(4.6);
    expect(result.visible[1]?.votes).toBe(1234);
    expect(result.visible[1]?.statusBase).toBe('continue');
    expect(result.visible[1]?.description).toBe('Rating override description');
    expect(result.selectedAudioFilter).toBe('en-US');
    expect(result.selectedGenreFilter).toBe('Action');
    expect(result.audioOptions.map((option) => option.optionValue)).toContain('en-US');
    expect(result.genreOptions.map((option) => option.optionValue)).toContain('Action');
  });

  it('falls back to hide mode when watch-ready mode is invalid', () => {
    const runtime = createCuratedRenderableRuntime();

    const result = runtime.buildRenderableEntries(
      [
        { seriesId: 'series-1', audioLocales: ['en-US'], genreTags: ['Action'], watchReadyHint: true },
        { seriesId: 'series-2', audioLocales: ['en-US'], genreTags: ['Action'], watchReadyHint: false },
      ],
      {
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        watchReadyFilterMode: 'invalid-mode',
      },
    );

    expect(result.mode).toBe('hide');
    expect(result.total).toBe(2);
    expect(result.visible).toHaveLength(1);
    expect(result.visible[0]?.seriesId).toBe('series-1');
  });

  it('hides not-watch-ready and cold-start entries when watch-ready mode is hide_not_started', () => {
    const runtime = createCuratedRenderableRuntime({
      deriveDisplayStatusBase: (entry: unknown) => String((entry as Record<string, unknown>).statusBase || 'Up Next'),
      isEntryWatchReady: (entry: unknown) => Boolean((entry as Record<string, unknown>).watchReadyHint),
    });

    const result = runtime.buildRenderableEntries(
      [
        {
          seriesId: 'series-started',
          statusBase: 'Continue',
          neverWatched: false,
          playheadMs: 1200,
          audioLocales: ['en-US'],
          genreTags: ['Action'],
          sortOrder: 1,
          watchReadyHint: true,
        },
        {
          seriesId: 'series-cold-start-status',
          statusBase: 'Start Watching',
          neverWatched: false,
          audioLocales: ['en-US'],
          genreTags: ['Action'],
          sortOrder: 2,
          watchReadyHint: true,
        },
        {
          seriesId: 'series-cold-start-flags',
          statusBase: 'Up Next',
          neverWatched: true,
          playheadMs: 0,
          lastWatchedMs: 0,
          watchHistoryProgressEntry: { playhead: 0, progressMs: 0 },
          audioLocales: ['en-US'],
          genreTags: ['Action'],
          sortOrder: 3,
          watchReadyHint: false,
        },
        {
          seriesId: 'series-never-watched-but-progress',
          statusBase: 'Up Next',
          neverWatched: true,
          playheadMs: 2200,
          audioLocales: ['en-US'],
          genreTags: ['Action'],
          sortOrder: 4,
          watchReadyHint: false,
        },
      ],
      {
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        watchReadyFilterMode: 'hide_not_started',
      },
    );

    expect(result.mode).toBe('hide_not_started');
    expect(result.total).toBe(4);
    expect(result.visible.map((entry) => entry.seriesId)).toEqual(['series-started']);
  });

  it('filters to hearted entries when genre filter is favorites', () => {
    const runtime = createCuratedRenderableRuntime();

    const result = runtime.buildRenderableEntries(
      [
        {
          seriesId: 'series-favorite',
          isFavorite: true,
          audioLocales: ['en-US'],
          genreTags: ['Action'],
          watchReadyHint: true,
          sortOrder: 1,
        },
        {
          seriesId: 'series-regular',
          isFavorite: false,
          audioLocales: ['en-US'],
          genreTags: ['Action'],
          watchReadyHint: true,
          sortOrder: 2,
        },
      ],
      {
        audioLocaleFilter: 'any',
        genreFilter: '__favorites__',
        watchReadyFilterMode: 'none',
      },
    );

    expect(result.total).toBe(2);
    expect(result.selectedGenreFilter).toBe('__favorites__');
    expect(result.genreOptions.map((option) => option.optionValue)).toContain('__favorites__');
    expect(result.visible.map((entry) => entry.seriesId)).toEqual(['series-favorite']);
  });

  it('uses default preferred-audio fallback for progress when localized progress is missing', () => {
    const fallbackProgress = { progressMs: 3000 };
    const runtime = createCuratedRenderableRuntime({
      progressBySeriesId: {
        'series-1': fallbackProgress,
      },
      preferredAudioLanguage: 'en-us',
    });

    const filterContext = runtime.resolveRenderableFilterContext({
      audioLocaleFilter: 'en-US',
      genreFilter: 'any',
    });
    const merged = runtime.mergeRenderableEntry(
      {
        seriesId: 'series-1',
        title: 'First Show',
        audioLocales: ['en-US'],
        genreTags: ['Action'],
        watchReadyHint: true,
      },
      filterContext,
    );

    expect(filterContext.selectedAudioIsDefaultPreferred).toBe(true);
    expect(merged.watchHistoryProgressEntry).toBe(fallbackProgress);
  });

  it('uses series progress fallback when no audio locale filter is selected', () => {
    const fallbackProgress = { progressMs: 3000 };
    const runtime = createCuratedRenderableRuntime({
      progressBySeriesId: {
        'series-1': fallbackProgress,
      },
      preferredAudioLanguage: 'en-us',
    });

    const filterContext = runtime.resolveRenderableFilterContext({
      audioLocaleFilter: 'any',
      genreFilter: 'any',
    });
    const merged = runtime.mergeRenderableEntry(
      {
        seriesId: 'series-1',
        title: 'First Show',
        audioLocales: ['en-US'],
        genreTags: ['Action'],
      },
      filterContext,
    );

    expect(filterContext.selectedAudioLocale).toBeNull();
    expect(merged.watchHistoryProgressEntry).toBe(fallbackProgress);
  });

  it('marks entries as complete when last known episode is watched past the completion threshold', () => {
    const runtime = createCuratedRenderableRuntime({
      progressBySeriesId: {
        'series-finished': {
          absoluteEpisodeNumber: 10,
          fullyWatched: true,
        },
      },
      deriveDisplayStatusBase: (entry: unknown) =>
        (entry as Record<string, unknown>).fullyWatched ? 'Watch Again' : 'Continue',
      isEntryWatchReady: () => true,
    });

    const filterContext = runtime.resolveRenderableFilterContext({
      audioLocaleFilter: 'any',
      genreFilter: 'any',
    });
    const merged = runtime.mergeRenderableEntry(
      {
        seriesId: 'series-finished',
        episodeCount: 10,
        neverWatched: true,
        audioLocales: ['en-US'],
        genreTags: ['Action'],
      },
      filterContext,
    );

    expect(merged.fullyWatched).toBe(true);
    expect(merged.neverWatched).toBe(false);
    expect(merged.statusBase).toBe('Watch Again');
    expect(merged.watchReady).toBe(false);
  });

  it('derives thumbnail progress ratios from playhead and episode duration', () => {
    const runtime = createCuratedRenderableRuntime({
      progressBySeriesId: {
        'series-progress': {
          playhead: 700,
          episodeDurationMs: 1_400_000,
          fullyWatched: false,
        },
      },
      deriveDisplayStatusBase: () => 'Continue',
      isEntryWatchReady: () => true,
    });

    const filterContext = runtime.resolveRenderableFilterContext({
      audioLocaleFilter: 'any',
      genreFilter: 'any',
    });
    const merged = runtime.mergeRenderableEntry(
      {
        seriesId: 'series-progress',
        episodeCount: 12,
        audioLocales: ['en-US'],
        genreTags: ['Action'],
      },
      filterContext,
    );

    expect(merged.episodeWatchProgressRatio).toBeCloseTo(0.5, 2);
  });

  it('keeps ratings locale episode totals primary with known maxima as fallback', () => {
    const runtime = createCuratedRenderableRuntime({
      getLocalizedSeriesCount: (_ratingEntry, _audioLocale, countType) => (countType === 'episode' ? 12 : null),
    });

    const filterContext = runtime.resolveRenderableFilterContext({
      audioLocaleFilter: 'en-US',
      genreFilter: 'any',
    });
    const merged = runtime.mergeRenderableEntry(
      {
        seriesId: 'series-locale-max',
        episodeCount: 20,
        knownEpisodeMaxByAudioLocale: {
          'en-us': 10,
        },
        audioLocales: ['en-US'],
        genreTags: ['Action'],
      },
      filterContext,
    );

    expect(merged.episodeCount).toBe(12);
  });

  it('evaluates watch-ready state against the merged status base', () => {
    const runtime = createCuratedRenderableRuntime({
      deriveDisplayStatusBase: () => 'Continue',
      isEntryWatchReady: (entry: unknown) =>
        String((entry as Record<string, unknown>).statusBase || '').toLowerCase() === 'continue',
    });

    const filterContext = runtime.resolveRenderableFilterContext({
      audioLocaleFilter: 'any',
      genreFilter: 'any',
    });
    const merged = runtime.mergeRenderableEntry(
      {
        seriesId: 'series-watch-ready',
        statusBase: 'Up Next',
        audioLocales: ['en-US'],
        genreTags: ['Action'],
      },
      filterContext,
    );

    expect(merged.statusBase).toBe('Continue');
    expect(merged.watchReady).toBe(true);
  });

  it('blends primary and secondary sort modes using average rank', () => {
    const runtime = createCuratedRenderableRuntime({
      compareRenderableEntries: (left: unknown, right: unknown, sortMode?: unknown) => {
        const leftRecord = left as Record<string, unknown>;
        const rightRecord = right as Record<string, unknown>;
        if (sortMode === 'rating_desc') {
          return Number(rightRecord.primaryScore || 0) - Number(leftRecord.primaryScore || 0);
        }
        if (sortMode === 'votes_desc') {
          return Number(rightRecord.secondaryScore || 0) - Number(leftRecord.secondaryScore || 0);
        }
        return Number(leftRecord.sortOrder || 0) - Number(rightRecord.sortOrder || 0);
      },
    });

    const result = runtime.buildRenderableEntries(
      [
        { seriesId: 'series-a', primaryScore: 100, secondaryScore: 0, watchReadyHint: true, sortOrder: 1 },
        { seriesId: 'series-b', primaryScore: 90, secondaryScore: 80, watchReadyHint: true, sortOrder: 2 },
        { seriesId: 'series-c', primaryScore: 80, secondaryScore: 100, watchReadyHint: true, sortOrder: 3 },
        { seriesId: 'series-d', primaryScore: 70, secondaryScore: 90, watchReadyHint: true, sortOrder: 4 },
      ],
      {
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        watchReadyFilterMode: 'none',
        sortMode: 'rating_desc',
        secondarySortMode: 'votes_desc',
      },
    );

    expect(result.visible.map((entry) => entry.seriesId)).toEqual(['series-c', 'series-a', 'series-b', 'series-d']);
  });
});
