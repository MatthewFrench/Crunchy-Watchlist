import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SeriesCandidate = {
  seriesId: string;
  title: string;
};

type DebugApiDump = {
  query: string;
  generatedAt?: string;
  matchedSeries?: SeriesCandidate;
  apis?: Record<string, unknown[]>;
  availableSeries?: SeriesCandidate[];
  error?: string;
};

type DebugApiRuntime = {
  listSeries: () => SeriesCandidate[];
  getCuratedDomStats: () => Record<string, unknown>;
  dumpSeriesApiData: (query: unknown) => DebugApiDump;
  printSeriesApiData: (query: unknown) => DebugApiDump;
};

type DebugApiModule = {
  createDebugApiRuntime: (options: Record<string, unknown>) => DebugApiRuntime;
};

const debugApiModuleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Runtime', 'DebugApi.ts')).href;
let debugApiModule: DebugApiModule | null = null;

function getDebugApiModule() {
  if (!debugApiModule) {
    throw new Error('Debug API runtime module was not initialized for test');
  }
  return debugApiModule;
}

function makeWatchlistRow(seriesId: string, seriesTitle: string): Record<string, unknown> {
  return {
    panel: {
      episode_metadata: {
        series_id: seriesId,
        series_title: seriesTitle,
      },
    },
  };
}

function makeWatchHistoryRow(seriesId: string, seriesTitle: string): Record<string, unknown> {
  return {
    panel: {
      episode_metadata: {
        series_id: seriesId,
        series_title: seriesTitle,
      },
    },
  };
}

function createHarness(overrides: Record<string, unknown> = {}) {
  const logs: string[] = [];
  const state = {
    curatedEntries: [
      {
        seriesId: 'GLOW123',
        title: 'Low Rated Show',
      },
    ],
    watchlistCache: {
      rows: [makeWatchlistRow('GHIGH456', 'High Rated Show')],
    },
    apiTrace: {
      watchlist: [
        {
          data: [makeWatchlistRow('GNONE789', 'No Rating Show'), makeWatchlistRow('GHIGH456', 'High Rated Show')],
          request: { page: 1 },
          response: { status: 200 },
        },
      ],
      watchHistory: [
        {
          data: [makeWatchHistoryRow('GWATCH999', 'Watch Again Show')],
          request: { page: 1 },
          response: { status: 200 },
        },
      ],
      cmsObjects: [
        {
          data: [{ id: 'GHIGH456' }],
          request: { ids: 'GHIGH456' },
          response: { status: 200 },
        },
      ],
      legacyRating: [
        {
          request: { seriesId: 'GHIGH456' },
          response: { rating: 4.9 },
        },
      ],
      preview: [
        {
          request: { seriesId: 'GHIGH456' },
          response: { previewUrl: 'https://example.invalid/preview.mp4' },
        },
      ],
    },
    curatedDomLifecycleCounters: {
      created: 12,
      patched: 48,
      parked: 4,
      unparked: 3,
      disposed: 1,
      renderPasses: 30,
    },
    watchHistoryPreloadAttemptDiagnostics: {
      totalAttempts: 3,
      byLocale: {
        'en-us': 1,
        'ja-jp': 2,
      },
      byLocaleRevision: {
        'en-us@1710000000000': 1,
        'ja-jp@1710000000000': 1,
        'ja-jp@1710000000001': 1,
      },
      lastAttempt: {
        locale: 'ja-jp',
        curatedDataRevision: 1_710_000_000_001,
        localeAttemptCount: 2,
        localeRevisionAttemptCount: 1,
      },
    },
  };

  const runtime = getDebugApiModule().createDebugApiRuntime({
    state,
    getWatchlistSeriesId: (entry: unknown) => {
      const row = entry as { panel?: { episode_metadata?: { series_id?: string } } };
      return row.panel?.episode_metadata?.series_id || null;
    },
    getWatchHistorySeriesId: (entry: unknown) => {
      const row = entry as { panel?: { episode_metadata?: { series_id?: string } } };
      return row.panel?.episode_metadata?.series_id || null;
    },
    getWatchlistSeriesTitle: (entry: unknown) => {
      const row = entry as { panel?: { episode_metadata?: { series_title?: string } } };
      return row.panel?.episode_metadata?.series_title || '';
    },
    getWatchHistorySeriesTitle: (entry: unknown) => {
      const row = entry as { panel?: { episode_metadata?: { series_title?: string } } };
      return row.panel?.episode_metadata?.series_title || '';
    },
    logRef: (message: string) => {
      logs.push(message);
    },
    ...overrides,
  });

  return {
    runtime,
    state,
    logs,
  };
}

describe('debug-api runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(debugApiModuleUrl)) as {
      createRuntimeDebugRuntime: () => object;
    };
    debugApiModule = module.createRuntimeDebugRuntime() as DebugApiModule;
  });

  afterEach(() => {
    debugApiModule = null;
  });

  it('lists known series by merged cache/trace/runtime candidates', () => {
    const harness = createHarness();
    const candidates = harness.runtime.listSeries();

    expect(candidates.map((candidate) => candidate.seriesId)).toEqual(['GHIGH456', 'GLOW123', 'GNONE789', 'GWATCH999']);
    expect(candidates[0]?.title).toBe('High Rated Show');
  });

  it('builds a per-series API dump across tracked endpoint buckets', () => {
    const harness = createHarness();
    const dump = harness.runtime.dumpSeriesApiData('high rated');

    expect(dump.error).toBeUndefined();
    expect(dump.matchedSeries?.seriesId).toBe('GHIGH456');
    expect(dump.apis).toBeDefined();
    expect(Object.keys(dump.apis || {})).toEqual(
      expect.arrayContaining([
        '/content/v2/discover/{account_id}/watchlist',
        '/content/v2/cms/objects/{series_ids}',
        '/content-reviews/v3/rating/series/{series_id}',
        '/content/v2/cms/videos/{video_id}/streams',
      ]),
    );
  });

  it('returns normalized curated dom lifecycle stats with identity churn rate', () => {
    const harness = createHarness();
    const stats = harness.runtime.getCuratedDomStats();

    expect(stats).toEqual({
      counters: {
        created: 12,
        patched: 48,
        parked: 4,
        unparked: 3,
        disposed: 1,
        renderPasses: 30,
      },
      totalLifecycleMutations: 68,
      identityChurnRate: 0.2,
      activeSeriesIds: [],
      watchHistoryPreloadAttempts: {
        totalAttempts: 3,
        byLocale: {
          'en-us': 1,
          'ja-jp': 2,
        },
        byLocaleRevision: {
          'en-us@1710000000000': 1,
          'ja-jp@1710000000000': 1,
          'ja-jp@1710000000001': 1,
        },
        lastAttempt: {
          locale: 'ja-jp',
          curatedDataRevision: 1_710_000_000_001,
          localeAttemptCount: 2,
          localeRevisionAttemptCount: 1,
        },
      },
      perfDiagnostics: {
        routeObserverBatchesProcessed: 0,
        routeObserverBatchesIgnored: 0,
        routeStructureChecks: 0,
        routeStructureSyncs: 0,
        gridLayoutCacheHits: 0,
        gridLayoutCacheMisses: 0,
        retainedCardHideScheduled: 0,
        retainedCardHideCompleted: 0,
        localizedPreloadRenderRequestsQueued: 0,
        localizedPreloadRenderRequestsDeduped: 0,
      },
    });
  });

  it('prints dump payloads through injected logger and returns the dump', () => {
    const harness = createHarness({
      state: {
        curatedEntries: [],
        watchlistCache: {
          rows: [],
        },
        apiTrace: {
          watchlist: [],
        },
      },
    });

    const dump = harness.runtime.printSeriesApiData('missing-series');

    expect(dump.error).toContain('Series not found');
    expect(harness.logs).toHaveLength(1);
    expect(harness.logs[0]).toContain('"availableSeries"');
  });
});
