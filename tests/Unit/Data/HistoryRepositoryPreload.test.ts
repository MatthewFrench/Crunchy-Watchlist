import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type WatchHistoryEntry = {
  seriesId: string;
  datePlayedMs: number;
  datePlayed: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteEpisodeNumber: number | null;
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
  watchHistoryStatus: string;
  watchHistoryInflight: Promise<unknown> | null;
};

type HistoryRepositoryCache = {
  normalizeStoredWatchHistoryCache: (raw: unknown) => WatchHistoryCache;
  normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: unknown) => Record<string, WatchHistoryLocaleMap>;
  normalizeWatchHistoryEntry: (raw: unknown) => WatchHistoryEntry | null;
  isWatchHistoryCacheValid: (cache: unknown, accountId?: unknown) => boolean;
  shouldReplaceWatchHistoryProgress: (previous: unknown, next: unknown) => boolean;
  getCachedWatchHistory: (
    seriesId: unknown,
    audioLocale?: unknown,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null;
};

type HistoryRepositoryPreload = {
  preloadWatchHistoryForEntries: (
    entries: unknown,
    tokenEntry: unknown,
    force?: boolean,
    preferredAudioLanguage?: unknown,
  ) => Promise<unknown>;
  isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown, audioLocale: unknown) => boolean;
};

type HistoryRepositoryCacheModule = {
  createHistoryRepositoryCache: (options: Record<string, unknown>) => HistoryRepositoryCache;
};

type HistoryRepositoryPreloadModule = {
  createHistoryRepositoryPreload: (options: Record<string, unknown>) => HistoryRepositoryPreload;
};

const cacheModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'HistoryRepositoryCache.ts'),
).href;
const planningModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'HistoryRepositoryPreloadPlanning.ts'),
).href;
const collectorModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'HistoryRepositoryPreloadCollector.ts'),
).href;
const preloadModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'HistoryRepositoryPreload.ts'),
).href;

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

function getAbsoluteEpisodeNumberFromEpisodeMetadata(metadata: Record<string, unknown>): number | null {
  return pickFirstPositiveInt([
    sanitizePositiveInt(metadata.sequence_number),
    sanitizePositiveInt(metadata.episode_sequence_number),
    sanitizePositiveInt(metadata.global_episode_number),
  ]);
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

function createWatchHistoryState(version = 1): WatchHistoryState {
  return {
    watchHistoryCache: createEmptyWatchHistoryCache(version),
    watchHistoryStatus: 'idle',
    watchHistoryInflight: null,
  };
}

function createRepositories(
  state: WatchHistoryState,
  overrides: {
    fetchWithResilience?: (url: string, init: RequestInit, options: Record<string, unknown>) => Promise<Response>;
    scheduleSaveWatchHistory?: () => void;
    runtimeEvent?: (event: string, payload?: unknown) => void;
    getPreferredAudioLanguage?: () => string;
  } = {},
): { cacheRepository: HistoryRepositoryCache; preloadRepository: HistoryRepositoryPreload } {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;
  const cacheModule = registry.historyRepositoryCache as HistoryRepositoryCacheModule;
  const preloadModule = registry.historyRepositoryPreload as HistoryRepositoryPreloadModule;

  const cacheRepository = cacheModule.createHistoryRepositoryCache({
    state,
    normalizeAudioLocale,
    sanitizePositiveInt,
    parseDateMs,
    pickFirstPositiveInt,
    deriveCanonicalEpisodeKeyFromEpisodeMetadata,
    createEmptyWatchHistoryCache,
    watchHistoryCacheVersion: 1,
    watchHistoryCacheTtlMs: 60_000,
  });

  const preloadRepository = preloadModule.createHistoryRepositoryPreload({
    state,
    normalizeAudioLocale,
    sanitizePositiveInt,
    parseDateMs,
    deriveCanonicalEpisodeKeyFromEpisodeMetadata,
    getAbsoluteEpisodeNumberFromEpisodeMetadata,
    getPreferredAudioLanguage: overrides.getPreferredAudioLanguage ?? (() => 'en-us'),
    getLocale: () => 'en-US',
    resolveApiHref: (value: string) => `https://api.example.test${value}`,
    fetchWithResilience:
      overrides.fetchWithResilience ??
      (async () => new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 })),
    createAuthRefreshHandler: () => () => undefined,
    requirePayloadDataArray: (name: string, payload: unknown) => {
      const payloadRecord = payload as { data?: unknown };
      if (!Array.isArray(payloadRecord?.data)) {
        throw new Error(`invalid payload for ${name}`);
      }
      return payloadRecord.data as Record<string, unknown>[];
    },
    auditWatchHistoryRowsContract: () => {},
    normalizeStoredWatchHistoryCache: cacheRepository.normalizeStoredWatchHistoryCache,
    normalizeStoredWatchHistoryBySeriesAudioLocale: cacheRepository.normalizeStoredWatchHistoryBySeriesAudioLocale,
    normalizeWatchHistoryEntry: cacheRepository.normalizeWatchHistoryEntry,
    isWatchHistoryCacheValid: cacheRepository.isWatchHistoryCacheValid,
    shouldReplaceWatchHistoryProgress: cacheRepository.shouldReplaceWatchHistoryProgress,
    getCachedWatchHistory: cacheRepository.getCachedWatchHistory,
    scheduleSaveWatchHistory: overrides.scheduleSaveWatchHistory ?? (() => {}),
    pushApiTrace: () => {},
    runtimeEvent: overrides.runtimeEvent ?? (() => {}),
    watchHistoryCacheVersion: 1,
    watchHistoryPageSize: 100,
    watchHistoryMaxPages: 10,
    watchHistoryNoMatchPageLimit: 2,
  });

  return {
    cacheRepository,
    preloadRepository,
  };
}

describe('HistoryRepositoryPreload', () => {
  beforeEach(async () => {
    await loadRuntimeModules([cacheModuleUrl, planningModuleUrl, collectorModuleUrl, preloadModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
  });

  it('marks history as unavailable when token data is missing', async () => {
    const state = createWatchHistoryState();
    const fetchWithResilience = vi.fn(
      async () => new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }),
    );

    const { preloadRepository } = createRepositories(state, {
      fetchWithResilience,
    });

    await preloadRepository.preloadWatchHistoryForEntries([{ seriesId: 'series-a', playheadMs: 1200 }], {}, false);

    expect(state.watchHistoryStatus).toBe('unavailable');
    expect(fetchWithResilience).not.toHaveBeenCalled();
  });

  it('skips fetch when cache is already valid for the active account', async () => {
    const state = createWatchHistoryState();
    state.watchHistoryCache.accountId = 'acct-1';
    state.watchHistoryCache.updatedAt = Date.now();

    const fetchWithResilience = vi.fn(
      async () => new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }),
    );

    const { preloadRepository } = createRepositories(state, {
      fetchWithResilience,
    });

    await preloadRepository.preloadWatchHistoryForEntries(
      [{ seriesId: 'series-a', playheadMs: 3000 }],
      { accessToken: 'token-1', accountId: 'acct-1' },
      false,
    );

    expect(state.watchHistoryStatus).toBe('ready');
    expect(fetchWithResilience).not.toHaveBeenCalled();
  });

  it('fetches history pages and merges cache buckets into state', async () => {
    const state = createWatchHistoryState();
    const scheduleSaveWatchHistory = vi.fn();
    const runtimeEvents: Array<{ event: string; payload: unknown }> = [];

    const rowDate = '2024-01-03T00:00:00.000Z';
    const fetchWithResilience = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            total: 1,
            data: [
              {
                id: 'episode-3',
                date_played: rowDate,
                playhead: 240,
                fully_watched: false,
                panel: {
                  id: 'episode-3',
                  title: 'Episode 3',
                  episode_metadata: {
                    series_id: 'series-a',
                    season_number: 1,
                    episode_number: 3,
                    sequence_number: 3,
                    identifier: 's1-e3',
                    audio_locale: 'en-US',
                  },
                },
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json; charset=utf-8',
            },
          },
        ),
    );

    const { preloadRepository } = createRepositories(state, {
      fetchWithResilience,
      scheduleSaveWatchHistory,
      runtimeEvent: (event: string, payload?: unknown) => {
        runtimeEvents.push({ event, payload });
      },
    });

    await preloadRepository.preloadWatchHistoryForEntries(
      [{ seriesId: 'series-a', playheadMs: 240 }],
      { accessToken: 'token-1', accountId: 'acct-1' },
      true,
      'en-US',
    );

    expect(fetchWithResilience).toHaveBeenCalledTimes(1);
    expect(scheduleSaveWatchHistory).toHaveBeenCalledTimes(1);
    expect(state.watchHistoryStatus).toBe('ready');
    expect(state.watchHistoryCache.accountId).toBe('acct-1');
    expect(state.watchHistoryCache.bySeriesId['series-a']?.episodeId).toBe('episode-3');
    expect(state.watchHistoryCache.bySeriesIdAudioLocale['series-a']?.['en-us']?.episodeId).toBe('episode-3');
    expect(runtimeEvents.some((eventItem) => eventItem.event === 'watch-history-preload')).toBe(true);
  });

  it('emits contract warning and falls back to row count when payload total is invalid', async () => {
    const state = createWatchHistoryState();
    const runtimeEvents: Array<{ event: string; payload: unknown }> = [];

    const fetchWithResilience = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            total: 'invalid',
            data: [
              {
                id: 'episode-3',
                date_played: '2024-01-03T00:00:00.000Z',
                playhead: 240,
                fully_watched: false,
                panel: {
                  id: 'episode-3',
                  title: 'Episode 3',
                  episode_metadata: {
                    series_id: 'series-a',
                    season_number: 1,
                    episode_number: 3,
                    sequence_number: 3,
                    identifier: 's1-e3',
                    audio_locale: 'en-US',
                  },
                },
              },
            ],
          }),
          { status: 200 },
        ),
    );

    const { preloadRepository } = createRepositories(state, {
      fetchWithResilience,
      runtimeEvent: (event: string, payload?: unknown) => {
        runtimeEvents.push({ event, payload });
      },
    });

    await preloadRepository.preloadWatchHistoryForEntries(
      [{ seriesId: 'series-a', playheadMs: 240 }],
      { accessToken: 'token-1', accountId: 'acct-1' },
      true,
      'en-US',
    );

    expect(runtimeEvents).toContainEqual(
      expect.objectContaining({
        event: 'watch-history-contract-warning',
      }),
    );
    expect(state.watchHistoryStatus).toBe('ready');
  });

  it('detects missing localized entries for non-default audio locale', () => {
    const state = createWatchHistoryState();

    const fallbackEntry: WatchHistoryEntry = {
      seriesId: 'series-a',
      datePlayedMs: Date.parse('2024-01-01T00:00:00.000Z'),
      datePlayed: '2024-01-01T00:00:00.000Z',
      seasonNumber: 1,
      episodeNumber: 1,
      absoluteEpisodeNumber: 1,
      episodeId: 'episode-1',
      identifier: 's1-e1',
      canonicalEpisodeKey: 'series-a|s1-e1|1',
      episodeTitle: 'Episode 1',
      playhead: 1,
      fullyWatched: false,
      audioLocale: '',
      audioLocaleInferred: false,
    };

    state.watchHistoryCache.bySeriesId['series-a'] = fallbackEntry;
    state.watchHistoryCache.bySeriesIdAudioLocale['series-a'] = {
      'en-us': {
        ...fallbackEntry,
        audioLocale: 'en-us',
      },
    };

    const { preloadRepository } = createRepositories(state, {
      getPreferredAudioLanguage: () => 'en-us',
    });

    const entries = [{ seriesId: 'series-a', neverWatched: false, playheadMs: 100 }];

    expect(preloadRepository.isLocalizedWatchHistoryDataMissingForEntries(entries, 'en-us')).toBe(false);
    expect(preloadRepository.isLocalizedWatchHistoryDataMissingForEntries(entries, 'ja-jp')).toBe(true);
    expect(
      preloadRepository.isLocalizedWatchHistoryDataMissingForEntries(
        [{ seriesId: 'series-a', neverWatched: true, playheadMs: 0 }],
        'ja-jp',
      ),
    ).toBe(false);
  });
});
