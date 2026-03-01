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

type HistoryRepository = {
  getCachedWatchHistory: (
    seriesId: unknown,
    audioLocale?: unknown,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null;
  preloadWatchHistoryForEntries: (
    entries: unknown,
    tokenEntry: unknown,
    force?: boolean,
    preferredAudioLanguage?: unknown,
  ) => Promise<unknown>;
};

type HistoryRepositoryModule = {
  createHistoryRepository: (options: Record<string, unknown>) => HistoryRepository;
};

const repositoryModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'HistoryRepository.ts'),
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

function createHistoryState(): WatchHistoryState {
  return {
    watchHistoryCache: createEmptyWatchHistoryCache(1),
    watchHistoryStatus: 'idle',
    watchHistoryInflight: null,
  };
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function loadHistoryRepositoryModule(): Promise<HistoryRepositoryModule> {
  const repositoryModule = (await import(repositoryModuleUrl)) as {
    createHistoryRepositoryRuntime: () => object;
  };
  return repositoryModule.createHistoryRepositoryRuntime() as HistoryRepositoryModule;
}

describe('history-repository composition root', () => {
  it('fails with a clear dependency error when required dependencies are missing', async () => {
    const historyRepositoryModule = await loadHistoryRepositoryModule();

    expect(() => historyRepositoryModule.createHistoryRepository({ state: createHistoryState() })).toThrow(
      /Missing history repository dependency: createHistoryRepositoryCache/,
    );
  });

  it('wires cache and preload owners through the composition root', async () => {
    const historyRepositoryModule = await loadHistoryRepositoryModule();

    const state = createHistoryState();
    state.watchHistoryCache.bySeriesId['series-a'] = {
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
      playhead: 100,
      fullyWatched: false,
      audioLocale: '',
      audioLocaleInferred: false,
    };

    const repository = historyRepositoryModule.createHistoryRepository({
      state,
      normalizeAudioLocale,
      sanitizePositiveInt,
      parseDateMs,
      pickFirstPositiveInt,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      getAbsoluteEpisodeNumberFromEpisodeMetadata,
      getPreferredAudioLanguage: () => 'en-us',
      getLocale: () => 'en-US',
      resolveApiHref: (value: string) => `https://api.example.test${value}`,
      fetchWithResilience: async () => new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }),
      createAuthRefreshHandler: () => () => undefined,
      parsePayloadDataEnvelope: (_name: string, payload: unknown) => {
        const payloadRecord = payload as { data?: unknown };
        const rows = Array.isArray(payloadRecord.data) ? (payloadRecord.data as Record<string, unknown>[]) : [];
        const totalValue = Number((payload as { total?: unknown }).total);
        return {
          rows,
          total: Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : null,
        };
      },
      auditWatchHistoryRowsContract: () => {},
      createEmptyWatchHistoryCache,
      scheduleSaveWatchHistory: () => {},
      pushApiTrace: () => {},
      runtimeEvent: () => {},
      watchHistoryCacheVersion: 1,
      watchHistoryCacheTtlMs: 60_000,
      watchHistoryPageSize: 100,
      watchHistoryMaxPages: 10,
      watchHistoryNoMatchPageLimit: 2,
    });

    expect(repository.getCachedWatchHistory('series-a')?.episodeId).toBe('episode-1');

    await repository.preloadWatchHistoryForEntries(
      [{ seriesId: 'series-a', playheadMs: 100 }],
      { accessToken: '', accountId: '' },
      false,
    );

    expect(state.watchHistoryStatus).toBe('unavailable');
  });
});
