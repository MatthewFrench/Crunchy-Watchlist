import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type HistoryRepositoryPreloadPlanningModule = {
  resolveHistoryPreloadPlan: (options: {
    entries: Array<{ seriesId?: unknown; neverWatched?: unknown; playheadMs?: unknown }>;
    preferredAudioLanguage: unknown;
    getPreferredAudioLanguage: () => string;
    normalizeAudioLocale: (value: unknown) => string;
  }) => {
    effectivePreferredAudioLanguage: string;
    isDefaultPreferredAudio: boolean;
    candidateSeriesIds: string[];
  };
  getHistoryPayloadTotal: (options: {
    payload: unknown;
    fallback: number;
    pageNumber: number;
    requestUrl: string;
    runtimeEvent: (event: string, payload?: unknown) => void;
  }) => number;
};

const planningModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'HistoryRepositoryPreloadPlanning.ts'),
).href;
let planningModule: HistoryRepositoryPreloadPlanningModule | null = null;

function normalizeAudioLocale(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

beforeEach(async () => {
  vi.resetModules();
  planningModule = (await import(planningModuleUrl)) as HistoryRepositoryPreloadPlanningModule;
});

afterEach(() => {
  planningModule = null;
  vi.restoreAllMocks();
});

function getPlanningModule(): HistoryRepositoryPreloadPlanningModule {
  if (!planningModule) {
    throw new Error('History preload planning module was not initialized for test');
  }

  return planningModule;
}

describe('HistoryRepositoryPreloadPlanning', () => {
  it('builds preferred audio preload plan with candidate filtering and dedupe', async () => {
    const planningModule = getPlanningModule();

    const plan = planningModule.resolveHistoryPreloadPlan({
      entries: [
        { seriesId: 'series-a', neverWatched: false, playheadMs: 100 },
        { seriesId: 'series-a', neverWatched: false, playheadMs: 400 },
        { seriesId: 'series-b', neverWatched: true, playheadMs: 0 },
        { seriesId: 'series-c', neverWatched: true, playheadMs: 1 },
      ],
      preferredAudioLanguage: 'ja-jp',
      getPreferredAudioLanguage: () => 'en-us',
      normalizeAudioLocale,
    });

    expect(plan.effectivePreferredAudioLanguage).toBe('ja-jp');
    expect(plan.isDefaultPreferredAudio).toBe(false);
    expect(plan.candidateSeriesIds).toEqual(['series-a', 'series-c']);
  });

  it('falls back to default preferred audio when selected locale is invalid', async () => {
    const planningModule = getPlanningModule();

    const plan = planningModule.resolveHistoryPreloadPlan({
      entries: [],
      preferredAudioLanguage: null,
      getPreferredAudioLanguage: () => 'en-us',
      normalizeAudioLocale,
    });

    expect(plan.effectivePreferredAudioLanguage).toBe('en-us');
    expect(plan.isDefaultPreferredAudio).toBe(true);
    expect(plan.candidateSeriesIds).toEqual([]);
  });

  it('falls back to row count and emits a contract warning for invalid total values', async () => {
    const planningModule = getPlanningModule();
    const runtimeEvent = vi.fn();

    const total = planningModule.getHistoryPayloadTotal({
      payload: { total: 'not-a-number' },
      fallback: 5,
      pageNumber: 2,
      requestUrl: 'https://api.example.test/watch-history',
      runtimeEvent,
    });

    expect(total).toBe(5);
    expect(runtimeEvent).toHaveBeenCalledWith(
      'watch-history-contract-warning',
      expect.objectContaining({
        reason: 'invalid-total-value',
        fallbackTotal: 5,
        page: 2,
      }),
    );
  });
});
