import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type CardMetadataRuntime = {
  formatVotes: (votes: unknown) => string;
  getLastWatchedPresentation: (entry: unknown) => { state: string; text: string };
  getSeriesScopePairs: (entry: unknown) => Array<{ label: string; value: number }>;
  getGenreValue: (entry: unknown) => string;
  makeRatingBadge: (
    rating: unknown,
    votes: unknown,
  ) => {
    textContent: string | null;
    title?: string;
    dataset?: Record<string, unknown>;
  };
};

type CardMetadataModule = {
  createCardMetadata: (deps: Record<string, unknown>) => CardMetadataRuntime;
};

const cardMetadataModuleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Ui', 'CardMetadata.ts')).href;

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
  const number = Number(typeof value === 'string' ? value.replace('%', '') : value);
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
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function createCardMetadataRuntime(getWatchHistoryStatus: () => string): CardMetadataRuntime {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;
  const uiRegistry = registry.ui as Record<string, unknown>;
  const cardMetadataModule = uiRegistry.cardMetadata as CardMetadataModule;

  const createElement = () => ({
    className: '',
    textContent: '',
    title: '',
    dataset: {} as Record<string, unknown>,
    style: {},
    appendChild: () => {},
    ownerDocument: {
      createElement,
      createTextNode: () => ({}),
    },
  });

  return cardMetadataModule.createCardMetadata({
    getPlausiblePastTimestamp: (value: unknown) => parseDateMs(value),
    estimateUnwatchedEpisodesLeft: (entry: unknown) =>
      sanitizePositiveInt((entry as Record<string, unknown>)?.unwatchedLeft),
    sanitizePositiveInt,
    normalizeTagList: (values: unknown[]) =>
      Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean))),
    sanitizePercentage,
    getStarCountFromDistribution: () => null,
    getWatchHistoryStatus,
    documentRef: {
      createElement,
    },
  });
}

describe('card-metadata ui module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([cardMetadataModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
    vi.useRealTimers();
  });

  it('formats vote counts using locale formatting', () => {
    const runtime = createCardMetadataRuntime(() => 'idle');
    expect(runtime.formatVotes(12345)).toBe(Number(12345).toLocaleString());
  });

  it('derives last-watched presentation states', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-10T00:00:00.000Z'));

    const runtimeReady = createCardMetadataRuntime(() => 'ready');
    const runtimeFailed = createCardMetadataRuntime(() => 'failed');

    expect(runtimeReady.getLastWatchedPresentation({ neverWatched: true })).toEqual({
      state: 'never',
      text: 'never',
    });

    const dated = runtimeReady.getLastWatchedPresentation({
      lastWatchedMs: '2026-02-09T00:00:00.000Z',
    });
    expect(dated.state).toBe('dated');
    expect(dated.text).toContain('(1 day ago)');

    expect(runtimeReady.getLastWatchedPresentation({})).toEqual({
      state: 'retained-miss',
      text: 'not in retained history',
    });
    expect(runtimeFailed.getLastWatchedPresentation({})).toEqual({
      state: 'history-unavailable',
      text: 'history unavailable',
    });
  });

  it('builds scope pairs and limits visible genre tags', () => {
    const runtime = createCardMetadataRuntime(() => 'idle');
    expect(
      runtime.getSeriesScopePairs({
        seasonCount: 2,
        episodeCount: 24,
        unwatchedLeft: 7,
      }),
    ).toEqual([
      { label: 'Seasons', value: 2 },
      { label: 'Episodes', value: 24 },
      { label: 'Unwatched left', value: 7 },
    ]);

    expect(runtime.getGenreValue({ genreTags: ['Action', 'Drama', 'Fantasy', 'Comedy'] })).toBe(
      'Action, Drama, Fantasy',
    );
  });

  it('builds rating badges with titles for rated and unrated entries', () => {
    const runtime = createCardMetadataRuntime(() => 'idle');

    const rated = runtime.makeRatingBadge(4.38, 1200);
    expect(rated.textContent).toBe('★ 4.4');
    expect(rated.title).toBe(`4.4 (${Number(1200).toLocaleString()} ratings)`);
    expect(rated.dataset?.cwRatingState).toBe('ok');

    const unrated = runtime.makeRatingBadge(null, null);
    expect(unrated.textContent).toBe('NR');
    expect(unrated.title).toBe('No rating found');
    expect(unrated.dataset?.cwRatingState).toBe('missing');
  });
});
