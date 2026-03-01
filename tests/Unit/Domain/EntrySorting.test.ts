import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EntrySortingRuntime = {
  compareRenderableEntries: (left: unknown, right: unknown, sortMode: unknown) => number;
};

type EntrySortingModule = {
  createEntrySorting: (deps: Record<string, unknown>) => EntrySortingRuntime;
};

const entrySortingModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Domain', 'EntrySorting.ts'),
).href;

let createEntrySorting: EntrySortingModule['createEntrySorting'] | null = null;

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
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as Record<string, unknown>;
}

function asNumeric(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return number;
}

function createEntrySortingRuntime(): EntrySortingRuntime {
  if (typeof createEntrySorting !== 'function') {
    throw new Error('Entry sorting runtime was not initialized for test');
  }

  return createEntrySorting({
    sanitizeVotes,
    sanitizePositiveInt,
    parseDateMs,
    getStarCountFromDistribution: (_votes: unknown, distribution: unknown, starLevel: unknown) =>
      asNumeric(asRecord(distribution)[String(starLevel)]),
    getStarPercentageFromDistribution: (distribution: unknown, starLevel: unknown) =>
      asNumeric(asRecord(distribution)[String(starLevel)]),
    getTotalStarPoints: (_votes: unknown, distribution: unknown) => asNumeric(asRecord(distribution).totalPoints),
    getConsensusQualityScore: (distribution: unknown) => asNumeric(asRecord(distribution).consensus),
    getControversyScore: (distribution: unknown) => asNumeric(asRecord(distribution).controversy),
    getQualityFloorScore: (distribution: unknown) => asNumeric(asRecord(distribution).qualityFloor),
    getQuickWinScore: (entry: unknown) => asNumeric(asRecord(entry).quickWin),
    getDormantBacklogScore: (entry: unknown) => asNumeric(asRecord(entry).dormantBacklog),
    getRewatchMemoryScore: (entry: unknown) => asNumeric(asRecord(entry).rewatchMemory),
    getWatchedEpisodeEstimate: (entry: unknown) => asNumeric(asRecord(entry).watchedEstimate),
    getRewatchActivityTimestamp: (entry: unknown) => asNumeric(asRecord(entry).rewatchActivity),
    getMostRecentActivityTimestamp: (entry: unknown) => asNumeric(asRecord(entry).mostRecentActivity),
    getPlausiblePastTimestamp: (value: unknown) => parseDateMs(value),
  });
}

describe('entry-sorting domain module', () => {
  beforeEach(async () => {
    vi.resetModules();
    const entrySortingModule = (await import(entrySortingModuleUrl)) as {
      createEntrySortingRuntime: () => object;
    };
    createEntrySorting = (entrySortingModule.createEntrySortingRuntime() as EntrySortingModule).createEntrySorting;
  });

  afterEach(() => {
    createEntrySorting = null;
    vi.restoreAllMocks();
  });

  it('compares rating sort modes with original-index tiebreaks', () => {
    const runtime = createEntrySortingRuntime();

    expect(
      runtime.compareRenderableEntries(
        { originalIndex: 2, rating: 4.6 },
        { originalIndex: 1, rating: 4.2 },
        'rating_desc',
      ),
    ).toBeLessThan(0);

    expect(
      runtime.compareRenderableEntries(
        { originalIndex: 2, rating: 4.6 },
        { originalIndex: 1, rating: 4.2 },
        'rating_asc',
      ),
    ).toBeGreaterThan(0);

    expect(
      runtime.compareRenderableEntries(
        { originalIndex: 1, rating: 4.5 },
        { originalIndex: 2, rating: 4.5 },
        'rating_desc',
      ),
    ).toBeLessThan(0);
  });

  it('uses hidden-gems tie-break by lower votes first', () => {
    const runtime = createEntrySortingRuntime();

    expect(
      runtime.compareRenderableEntries(
        { originalIndex: 2, rating: 4.9, votes: 100 },
        { originalIndex: 1, rating: 4.9, votes: 300 },
        'hidden_gems_desc',
      ),
    ).toBeLessThan(0);
  });

  it('uses numeric mode extractors for quick-wins and star-percentage sorts', () => {
    const runtime = createEntrySortingRuntime();

    expect(
      runtime.compareRenderableEntries(
        { originalIndex: 5, quickWin: 2 },
        { originalIndex: 1, quickWin: 7 },
        'quick_wins_asc',
      ),
    ).toBeLessThan(0);

    expect(
      runtime.compareRenderableEntries(
        { originalIndex: 2, distribution: { '5': 40 } },
        { originalIndex: 1, distribution: { '5': 15 } },
        'star_5_pct_desc',
      ),
    ).toBeLessThan(0);
  });

  it('sorts recent activity with newest entries first', () => {
    const runtime = createEntrySortingRuntime();

    expect(
      runtime.compareRenderableEntries(
        {
          originalIndex: 3,
          mostRecentActivity: Date.parse('2026-02-01T10:00:00.000Z'),
        },
        {
          originalIndex: 1,
          mostRecentActivity: Date.parse('2026-01-10T10:00:00.000Z'),
        },
        'recent_activity_desc',
      ),
    ).toBeLessThan(0);

    expect(
      runtime.compareRenderableEntries(
        {
          originalIndex: 1,
          mostRecentActivity: Date.parse('2026-02-01T10:00:00.000Z'),
        },
        {
          originalIndex: 2,
          mostRecentActivity: Date.parse('2026-02-01T10:00:00.000Z'),
        },
        'recent_activity_desc',
      ),
    ).toBeLessThan(0);
  });

  it('uses rewatch-memory fallback ordering when score is unavailable', () => {
    const runtime = createEntrySortingRuntime();

    expect(
      runtime.compareRenderableEntries(
        {
          originalIndex: 2,
          rewatchMemory: null,
          watchedEstimate: 12,
          episodeCount: 24,
          rewatchActivity: Date.parse('2025-01-01T00:00:00.000Z'),
        },
        {
          originalIndex: 1,
          rewatchMemory: null,
          watchedEstimate: 8,
          episodeCount: 24,
          rewatchActivity: Date.parse('2024-01-01T00:00:00.000Z'),
        },
        'rewatch_memory_desc',
      ),
    ).toBeLessThan(0);
  });

  it('falls back to original index when sort mode is unknown', () => {
    const runtime = createEntrySortingRuntime();

    expect(runtime.compareRenderableEntries({ originalIndex: 1 }, { originalIndex: 3 }, 'none')).toBeLessThan(0);
    expect(
      runtime.compareRenderableEntries({ originalIndex: 8 }, { originalIndex: 3 }, 'unknown_mode'),
    ).toBeGreaterThan(0);
  });
});
