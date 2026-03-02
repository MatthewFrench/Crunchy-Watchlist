import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SortMetricsRuntime = {
  getStarCountFromDistribution: (votes: unknown, distribution: unknown, starLevel: unknown) => number | null;
  getStarPercentageFromDistribution: (distribution: unknown, starLevel: unknown) => number | null;
  getTotalStarPoints: (votes: unknown, distribution: unknown) => number | null;
  getConsensusQualityScore: (distribution: unknown) => number | null;
  getControversyScore: (distribution: unknown) => number | null;
  getQualityFloorScore: (distribution: unknown) => number | null;
  getQuickWinScore: (entry: unknown) => number | null;
  getWatchedEpisodeEstimate: (entry: unknown) => number | null;
  getPlausiblePastTimestamp: (value: unknown) => number | null;
  getRewatchActivityTimestamp: (entry: unknown) => number | null;
  getMostRecentActivityTimestamp: (entry: unknown) => number | null;
  getDormantBacklogScore: (entry: unknown) => number | null;
  getRewatchMemoryScore: (entry: unknown) => number | null;
  estimateUnwatchedEpisodesLeft: (entry: unknown) => number | null;
};

type SortMetricsModule = {
  createSortMetrics: (deps: Record<string, unknown>) => SortMetricsRuntime;
};

const sortMetricsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Domain', 'SortMetrics.ts'),
).href;

let createSortMetrics: SortMetricsModule['createSortMetrics'] | null = null;

function sanitizeVotes(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return null;
  }
  return Math.round(number);
}

function sanitizePositiveInt(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number);
}

function sanitizePercentage(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const normalized = typeof value === 'string' ? value.replace('%', '').trim() : value;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    return null;
  }
  return Math.round(number);
}

function parseDateMs(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) {
      return Math.round(value);
    }
    if (value > 1e9) {
      return Math.round(value * 1000);
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return parseDateMs(numeric);
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickFirstPositiveInt(values: unknown[]): number | null {
  for (const value of values) {
    const parsed = sanitizePositiveInt(value);
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
}

function createSortMetricsRuntime(): SortMetricsRuntime {
  if (typeof createSortMetrics !== 'function') {
    throw new Error('Sort metrics runtime was not initialized for test');
  }

  return createSortMetrics({
    sanitizePercentage,
    sanitizeVotes,
    sanitizePositiveInt,
    parseDateMs,
    pickFirstPositiveInt,
  });
}

describe('sort-metrics domain module', () => {
  beforeEach(async () => {
    vi.resetModules();
    const sortMetricsModule = (await import(sortMetricsModuleUrl)) as {
      createSortMetricsRuntime: () => object;
    };
    createSortMetrics = (sortMetricsModule.createSortMetricsRuntime() as SortMetricsModule).createSortMetrics;
  });

  afterEach(() => {
    createSortMetrics = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('computes star counts, percentages, and weighted total points from distribution data', () => {
    const runtime = createSortMetricsRuntime();
    const distribution = {
      '5': '40',
      '4': 30,
      '1': 10,
    };

    expect(runtime.getStarCountFromDistribution(200, distribution, 5)).toBe(80);
    expect(runtime.getStarPercentageFromDistribution(distribution, 4)).toBe(30);
    expect(runtime.getTotalStarPoints(200, distribution)).toBe(660);
  });

  it('computes consensus, controversy, and quality-floor scores', () => {
    const runtime = createSortMetricsRuntime();
    const distribution = {
      '5': 40,
      '4': 20,
      '3': 10,
      '2': 20,
      '1': 10,
    };

    expect(runtime.getConsensusQualityScore(distribution)).toBe(30);
    expect(runtime.getControversyScore(distribution)).toBeCloseTo(2.04, 2);
    expect(runtime.getQualityFloorScore(distribution)).toBe(40);
  });

  it('estimates unwatched episodes with progress overrides and state flags', () => {
    const runtime = createSortMetricsRuntime();

    expect(runtime.estimateUnwatchedEpisodesLeft({ episodeCount: 24, neverWatched: true })).toBe(24);
    expect(runtime.estimateUnwatchedEpisodesLeft({ episodeCount: 24, fullyWatched: true })).toBe(0);
    expect(
      runtime.estimateUnwatchedEpisodesLeft({
        episodeCount: 24,
        neverWatched: true,
        absoluteEpisodeNumber: 6,
      }),
    ).toBe(19);
    expect(
      runtime.estimateUnwatchedEpisodesLeft({
        episodeCount: 12,
        absoluteEpisodeNumber: 3,
        watchHistoryProgressEntry: {
          absoluteEpisodeNumber: 5,
          fullyWatched: true,
        },
      }),
    ).toBe(7);
    expect(
      runtime.estimateUnwatchedEpisodesLeft({
        episodeCount: 12,
        neverWatched: true,
        watchHistoryProgressEntry: {
          absoluteEpisodeNumber: 12,
          fullyWatched: true,
        },
      }),
    ).toBe(0);
    expect(
      runtime.estimateUnwatchedEpisodesLeft({
        episodeCount: 55,
        absoluteEpisodeNumber: 50,
        watchHistoryProgressEntry: {
          absoluteEpisodeNumber: 24,
          fullyWatched: false,
        },
      }),
    ).toBe(6);
  });

  it('applies watch-ready penalties and watched-episode estimates for quick wins', () => {
    const runtime = createSortMetricsRuntime();
    const watchReadyEntry = {
      watchReady: true,
      episodeCount: 24,
      absoluteEpisodeNumber: 23,
    };
    const notWatchReadyEntry = {
      ...watchReadyEntry,
      watchReady: false,
    };

    expect(runtime.getWatchedEpisodeEstimate(watchReadyEntry)).toBe(22);
    expect(runtime.getQuickWinScore(watchReadyEntry)).toBe(2);
    expect(runtime.getQuickWinScore(notWatchReadyEntry)).toBe(100002);
  });

  it('normalizes plausible past timestamps and rejects far-future sentinels', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
    const runtime = createSortMetricsRuntime();

    const oneDayAhead = Date.parse('2026-02-02T00:00:00.000Z');
    const threeDaysAhead = Date.parse('2026-02-04T00:00:00.000Z');

    expect(runtime.getPlausiblePastTimestamp('2026-01-31T12:00:00.000Z')).toBe(Date.parse('2026-01-31T12:00:00.000Z'));
    expect(runtime.getPlausiblePastTimestamp(oneDayAhead)).toBe(oneDayAhead);
    expect(runtime.getPlausiblePastTimestamp(threeDaysAhead)).toBeNull();
  });

  it('derives rewatch activity from last watched, then falls back to update dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
    const runtime = createSortMetricsRuntime();

    expect(
      runtime.getRewatchActivityTimestamp({
        lastWatchedMs: '2026-01-05T00:00:00.000Z',
        episodeCount: 12,
        absoluteEpisodeNumber: 6,
      }),
    ).toBe(Date.parse('2026-01-05T00:00:00.000Z'));

    expect(
      runtime.getRewatchActivityTimestamp({
        episodeCount: 12,
        absoluteEpisodeNumber: 6,
        dateUpdatedMs: '2026-01-10T00:00:00.000Z',
      }),
    ).toBe(Date.parse('2026-01-10T00:00:00.000Z'));

    expect(
      runtime.getRewatchActivityTimestamp({
        episodeCount: 12,
        absoluteEpisodeNumber: 1,
      }),
    ).toBeNull();
  });

  it('derives most-recent activity from any known activity timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
    const runtime = createSortMetricsRuntime();

    expect(
      runtime.getMostRecentActivityTimestamp({
        lastWatchedMs: '2026-01-10T00:00:00.000Z',
        dateUpdatedMs: '2026-01-20T00:00:00.000Z',
        dateAddedMs: '2025-12-05T00:00:00.000Z',
      }),
    ).toBe(Date.parse('2026-01-20T00:00:00.000Z'));

    expect(
      runtime.getMostRecentActivityTimestamp({
        dateAddedMs: '2025-12-05T00:00:00.000Z',
      }),
    ).toBe(Date.parse('2025-12-05T00:00:00.000Z'));

    expect(runtime.getMostRecentActivityTimestamp({})).toBeNull();
  });

  it('scores rewatch-memory candidates only when progress and dormancy thresholds are met', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
    const runtime = createSortMetricsRuntime();

    expect(
      runtime.getRewatchMemoryScore({
        episodeCount: 24,
        absoluteEpisodeNumber: 13,
        dateUpdatedMs: '2025-12-10T00:00:00.000Z',
      }),
    ).toBeGreaterThan(0);

    expect(
      runtime.getRewatchMemoryScore({
        episodeCount: 100,
        absoluteEpisodeNumber: 2,
        dateUpdatedMs: '2025-12-10T00:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('adds dormant-backlog watch-ready penalties on top of activity timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'));
    const runtime = createSortMetricsRuntime();

    const watchReady = runtime.getDormantBacklogScore({
      watchReady: true,
      episodeCount: 12,
      absoluteEpisodeNumber: 7,
      dateUpdatedMs: '2026-01-01T00:00:00.000Z',
    });
    const notWatchReady = runtime.getDormantBacklogScore({
      watchReady: false,
      episodeCount: 12,
      absoluteEpisodeNumber: 7,
      dateUpdatedMs: '2026-01-01T00:00:00.000Z',
    });

    expect(watchReady).not.toBeNull();
    expect(notWatchReady).toBe((watchReady ?? 0) + 10000000000000);
  });
});
