import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type WatchHistoryEntry = {
  seriesId: string;
  datePlayedMs: number;
  datePlayed: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteEpisodeNumber: number | null;
  episodeDurationMs?: number | null;
  episodeId: string | null;
  identifier: string;
  canonicalEpisodeKey: string;
  episodeTitle: string;
  playhead: number;
  fullyWatched: boolean;
  audioLocale: string;
  audioLocaleInferred: boolean;
};

type WatchHistoryLocaleMap = Record<string, WatchHistoryEntry>;

type WatchHistoryCache = {
  version: number;
  accountId: string;
  updatedAt: number;
  bySeriesId: Record<string, WatchHistoryEntry>;
  bySeriesIdAudioLocale: Record<string, WatchHistoryLocaleMap>;
  bySeriesIdProgress: Record<string, WatchHistoryEntry>;
  bySeriesIdAudioLocaleProgress: Record<string, WatchHistoryLocaleMap>;
};

type WatchHistoryState = {
  watchHistoryCache: WatchHistoryCache;
};

type HistoryRepositoryCache = {
  normalizeStoredWatchHistoryCache: (raw: unknown) => WatchHistoryCache;
  isWatchHistoryCacheValid: (cache: unknown, accountId?: unknown) => boolean;
  getCachedWatchHistory: (
    seriesId: unknown,
    audioLocale?: unknown,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null;
  shouldReplaceWatchHistoryProgress: (
    previous: Record<string, unknown> | null | undefined,
    next: Record<string, unknown> | null | undefined,
  ) => boolean;
};

type HistoryRepositoryCacheModule = {
  createHistoryRepositoryCache: (options: Record<string, unknown>) => HistoryRepositoryCache;
};

const cacheModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'HistoryRepositoryCache.ts'),
).href;
let createHistoryRepositoryCacheRuntimeFactory: HistoryRepositoryCacheModule['createHistoryRepositoryCache'] | null =
  null;

function normalizeAudioLocale(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function sanitizePositiveInt(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function parseDateMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Date.parse(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  return null;
}

function pickFirstPositiveInt(values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (value != null && value > 0) {
      return value;
    }
  }
  return null;
}

function deriveCanonicalEpisodeKeyFromEpisodeMetadata(metadata: Record<string, unknown>, seriesId?: unknown): string {
  const identifier = typeof metadata.identifier === 'string' ? metadata.identifier : '';
  const sequenceNumber = sanitizePositiveInt(metadata.sequence_number);
  const resolvedSeriesId = typeof seriesId === 'string' ? seriesId : '';
  return `${resolvedSeriesId}|${identifier}|${String(sequenceNumber ?? '')}`;
}

function createEmptyWatchHistoryCache(version = 1): WatchHistoryCache {
  return {
    version,
    accountId: '',
    updatedAt: 0,
    bySeriesId: {},
    bySeriesIdAudioLocale: {},
    bySeriesIdProgress: {},
    bySeriesIdAudioLocaleProgress: {},
  };
}

function createHistoryRepositoryCache(
  state: WatchHistoryState,
  watchHistoryCacheVersion = 1,
  watchHistoryCacheTtlMs = 10_000,
): HistoryRepositoryCache {
  if (typeof createHistoryRepositoryCacheRuntimeFactory !== 'function') {
    throw new Error('History repository cache runtime was not initialized for test');
  }

  return createHistoryRepositoryCacheRuntimeFactory({
    state,
    normalizeAudioLocale,
    sanitizePositiveInt,
    parseDateMs,
    pickFirstPositiveInt,
    deriveCanonicalEpisodeKeyFromEpisodeMetadata,
    createEmptyWatchHistoryCache,
    watchHistoryCacheVersion,
    watchHistoryCacheTtlMs,
  });
}

describe('HistoryRepositoryCache', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(cacheModuleUrl)) as HistoryRepositoryCacheModule;
    createHistoryRepositoryCacheRuntimeFactory = module.createHistoryRepositoryCache;
  });

  afterEach(() => {
    createHistoryRepositoryCacheRuntimeFactory = null;
    vi.restoreAllMocks();
  });

  it('validates cache version, account, and ttl boundaries', () => {
    const state: WatchHistoryState = {
      watchHistoryCache: {
        ...createEmptyWatchHistoryCache(1),
        accountId: 'acct-1',
        updatedAt: Date.now(),
      },
    };

    const repository = createHistoryRepositoryCache(state, 1, 30_000);

    expect(repository.isWatchHistoryCacheValid(state.watchHistoryCache, 'acct-1')).toBe(true);
    expect(repository.isWatchHistoryCacheValid(state.watchHistoryCache, 'acct-2')).toBe(false);

    const staleCache = {
      ...state.watchHistoryCache,
      updatedAt: Date.now() - 60_000,
    };
    expect(repository.isWatchHistoryCacheValid(staleCache, 'acct-1')).toBe(false);

    const wrongVersionCache = {
      ...state.watchHistoryCache,
      version: 2,
    };
    expect(repository.isWatchHistoryCacheValid(wrongVersionCache, 'acct-1')).toBe(false);
  });

  it('normalizes locale maps and keeps the latest localized entry', () => {
    const state: WatchHistoryState = {
      watchHistoryCache: createEmptyWatchHistoryCache(1),
    };

    const repository = createHistoryRepositoryCache(state);

    const olderPlayed = new Date('2024-01-01T00:00:00.000Z').toISOString();
    const newerPlayed = new Date('2024-01-02T00:00:00.000Z').toISOString();

    const rawCache = {
      version: 1,
      accountId: 'acct-1',
      updatedAt: Date.now(),
      bySeriesId: {
        'series-a': {
          seriesId: 'series-a',
          datePlayed: newerPlayed,
          panel: {
            id: 'episode-2',
            title: 'Episode 2',
            episode_metadata: {
              series_id: 'series-a',
              season_number: 1,
              episode_number: 2,
              sequence_number: 2,
              duration_ms: 1_420_087,
              identifier: 's1-e2',
              audio_locale: 'en-US',
            },
          },
        },
      },
      bySeriesIdAudioLocale: {
        'series-a': {
          older: {
            seriesId: 'series-a',
            datePlayed: olderPlayed,
            panel: {
              id: 'episode-1',
              title: 'Episode 1',
              episode_metadata: {
                series_id: 'series-a',
                season_number: 1,
                episode_number: 1,
                sequence_number: 1,
                duration_ms: 1_410_000,
                identifier: 's1-e1',
                audio_locale: 'en-US',
              },
            },
          },
          newer: {
            seriesId: 'series-a',
            datePlayed: newerPlayed,
            panel: {
              id: 'episode-2',
              title: 'Episode 2',
              episode_metadata: {
                series_id: 'series-a',
                season_number: 1,
                episode_number: 2,
                sequence_number: 2,
                duration_ms: 1_420_087,
                identifier: 's1-e2',
                audio_locale: 'en-US',
              },
            },
          },
        },
      },
      bySeriesIdProgress: {},
      bySeriesIdAudioLocaleProgress: {},
    };

    const normalized = repository.normalizeStoredWatchHistoryCache(rawCache);

    const localized = normalized.bySeriesIdAudioLocale['series-a']?.['en-us'];
    expect(localized).not.toBeUndefined();
    expect(localized?.episodeId).toBe('episode-2');
    expect(localized?.datePlayedMs).toBe(Date.parse(newerPlayed));
    expect(localized?.episodeDurationMs).toBe(1_420_087);
  });

  it('normalizes absolute episode numbers using the highest known episode index candidate', () => {
    const state: WatchHistoryState = {
      watchHistoryCache: createEmptyWatchHistoryCache(1),
    };
    const repository = createHistoryRepositoryCache(state);

    const rawCache = {
      version: 1,
      accountId: 'acct-1',
      updatedAt: Date.now(),
      bySeriesId: {
        'series-progress': {
          seriesId: 'series-progress',
          datePlayed: '2026-01-24T20:06:06.000Z',
          seasonNumber: 3,
          episodeNumber: 49,
          absoluteEpisodeNumber: 2,
          panel: {
            episode_metadata: {
              season_number: 3,
              episode_number: 49,
              sequence_number: 2,
            },
          },
        },
      },
      bySeriesIdAudioLocale: {},
      bySeriesIdProgress: {},
      bySeriesIdAudioLocaleProgress: {},
    };

    const normalized = repository.normalizeStoredWatchHistoryCache(rawCache);
    expect(normalized.bySeriesId['series-progress']?.absoluteEpisodeNumber).toBe(49);
  });

  it('prefers locale-specific history and falls back to series history when allowed', () => {
    const baseEntry: WatchHistoryEntry = {
      seriesId: 'series-a',
      datePlayedMs: Date.parse('2024-01-03T00:00:00.000Z'),
      datePlayed: '2024-01-03T00:00:00.000Z',
      seasonNumber: 1,
      episodeNumber: 3,
      absoluteEpisodeNumber: 3,
      episodeId: 'episode-3',
      identifier: 's1-e3',
      canonicalEpisodeKey: 'series-a|s1-e3|3',
      episodeTitle: 'Episode 3',
      playhead: 300,
      fullyWatched: false,
      audioLocale: 'en-us',
      audioLocaleInferred: false,
    };

    const fallbackEntry: WatchHistoryEntry = {
      ...baseEntry,
      episodeId: 'episode-fallback',
      audioLocale: '',
    };

    const state: WatchHistoryState = {
      watchHistoryCache: {
        ...createEmptyWatchHistoryCache(1),
        bySeriesId: {
          'series-a': fallbackEntry,
        },
        bySeriesIdAudioLocale: {
          'series-a': {
            'en-us': baseEntry,
          },
        },
      },
    };

    const repository = createHistoryRepositoryCache(state);

    const localized = repository.getCachedWatchHistory('series-a', 'EN-US', false);
    expect(localized?.episodeId).toBe('episode-3');

    const missingLocalizedNoFallback = repository.getCachedWatchHistory('series-a', 'ja-JP', false);
    expect(missingLocalizedNoFallback).toBeNull();

    const missingLocalizedWithFallback = repository.getCachedWatchHistory('series-a', 'ja-JP', true);
    expect(missingLocalizedWithFallback?.episodeId).toBe('episode-fallback');
  });

  it('prefers non-inferred audio entries when replacing progress rows', () => {
    const state: WatchHistoryState = {
      watchHistoryCache: createEmptyWatchHistoryCache(1),
    };
    const repository = createHistoryRepositoryCache(state);

    const shouldReplace = repository.shouldReplaceWatchHistoryProgress(
      {
        audioLocaleInferred: true,
        datePlayedMs: Date.parse('2024-01-03T00:00:00.000Z'),
      },
      {
        audioLocaleInferred: false,
        datePlayedMs: Date.parse('2024-01-01T00:00:00.000Z'),
      },
    );

    expect(shouldReplace).toBe(true);
  });

  it('replaces progress when a newer row has a higher effective episode index despite stale absolute values', () => {
    const state: WatchHistoryState = {
      watchHistoryCache: createEmptyWatchHistoryCache(1),
    };
    const repository = createHistoryRepositoryCache(state);

    const shouldReplace = repository.shouldReplaceWatchHistoryProgress(
      {
        seasonNumber: 1,
        episodeNumber: 24,
        absoluteEpisodeNumber: 24,
        datePlayedMs: Date.parse('2024-05-07T02:02:56.000Z'),
      },
      {
        seasonNumber: 3,
        episodeNumber: 49,
        sequence_number: 2,
        absoluteEpisodeNumber: 2,
        datePlayedMs: Date.parse('2026-01-24T20:06:06.000Z'),
      },
    );

    expect(shouldReplace).toBe(true);
  });
});
