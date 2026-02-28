import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type BootstrapHelpersRuntime = {
  getPreferredAudioLanguage: () => string;
  preloadRatingsForSelectedAudioLocale: (audioLocale: unknown) => Promise<unknown>;
  scheduleSaveRatings: () => void;
  toggleCuratedFavorite: (seriesId: unknown) => void;
  removeCuratedSeries: (seriesId: unknown) => void;
};

type BootstrapHelpersModule = {
  runtimeBootstrapHelpers: {
    createBootstrapHelpersRuntime: (options: Record<string, unknown>) => BootstrapHelpersRuntime;
  };
};

const bootstrapHelpersModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapHelpers.ts'),
).href;

function getBootstrapHelpersModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as BootstrapHelpersModule;
  return registry.runtimeBootstrapHelpers;
}

function createBaseState() {
  return {
    curatedEntries: [{ seriesId: 'series-1', isFavorite: false }],
    ratingLocalePreloadInflight: new Map<string, Promise<unknown>>(),
    watchHistoryLocalePreloadInflight: new Map<string, Promise<unknown>>(),
    preferredAudioLanguage: '',
    preferredAudioLanguageUpdatedAt: 0,
    settings: {
      cardLayout: 'portrait',
    },
    hostEl: {
      dataset: {},
    },
    mutationMuted: false,
    ratingCache: {
      'series-1': { rating: 4.5 },
    },
    watchHistoryCache: {
      bySeriesId: {},
    },
    watchlistCache: {
      rows: [],
    },
  };
}

function createRuntime(overrides: Record<string, unknown> = {}) {
  const state = createBaseState();
  const runtimeEventCalls: Array<{ event: string; data?: unknown }> = [];
  const storageSet = vi.fn(async () => undefined);

  const runtime = getBootstrapHelpersModule().createBootstrapHelpersRuntime({
    state,
    windowRef: globalThis,
    runtimeEvent: (event: string, data?: unknown) => {
      runtimeEventCalls.push({ event, data });
    },
    storageSet,
    settingsKey: 'cw_settings_v1',
    ratingCacheKey: 'cw_rating_cache_v2',
    watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    watchlistCacheKey: 'cw_watchlist_cache_v1',
    preferredAudioCacheTtlMs: 120_000,
    normalizeAudioLocale: (value: unknown) => (typeof value === 'string' ? value : ''),
    detectPreferredAudioLanguage: () => 'en-US',
    isLocalizedRatingDataMissingForEntries: () => true,
    isLocalizedWatchHistoryDataMissingForEntries: () => true,
    getAccessToken: async () => ({ accessToken: 'token', accountId: 'account' }),
    preloadRatingsForEntries: async () => undefined,
    preloadWatchHistoryForEntries: async () => undefined,
    ...overrides,
  });

  return {
    runtime,
    state,
    runtimeEventCalls,
    storageSet,
  };
}

describe('bootstrap-helpers runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([bootstrapHelpersModuleUrl]);
  });

  afterEach(() => {
    vi.useRealTimers();
    clearRuntimeModulesRegistry();
  });

  it('caches preferred audio locale and emits change event once per refresh window', () => {
    const detectPreferredAudioLanguage = vi
      .fn<() => string>()
      .mockReturnValueOnce('ja-JP')
      .mockReturnValueOnce('en-US');
    const { runtime, runtimeEventCalls } = createRuntime({
      detectPreferredAudioLanguage,
    });

    expect(runtime.getPreferredAudioLanguage()).toBe('ja-JP');
    expect(runtime.getPreferredAudioLanguage()).toBe('ja-JP');
    expect(detectPreferredAudioLanguage).toHaveBeenCalledTimes(1);
    expect(runtimeEventCalls).toEqual([
      {
        event: 'preferred-audio-language-detected',
        data: { locale: 'ja-JP' },
      },
    ]);
  });

  it('deduplicates localized ratings preload requests while inflight', async () => {
    const preloadRatingsForEntries = vi.fn(async () => undefined);
    const { runtime, state } = createRuntime({
      preloadRatingsForEntries,
    });

    const firstPromise = runtime.preloadRatingsForSelectedAudioLocale('en-US');
    const secondPromise = runtime.preloadRatingsForSelectedAudioLocale('en-US');

    expect(secondPromise).toBeInstanceOf(Promise);
    expect(state.ratingLocalePreloadInflight.size).toBe(1);

    await Promise.all([firstPromise, secondPromise]);
    expect(preloadRatingsForEntries).toHaveBeenCalledTimes(1);
    expect(state.ratingLocalePreloadInflight.size).toBe(0);
  });

  it('schedules ratings cache persistence through storageSet', async () => {
    vi.useFakeTimers();
    const { runtime, storageSet, state } = createRuntime();

    runtime.scheduleSaveRatings();
    await vi.runAllTimersAsync();

    expect(storageSet).toHaveBeenCalledTimes(1);
    expect(storageSet).toHaveBeenCalledWith('cw_rating_cache_v2', state.ratingCache);
  });

  it('mutates curated entry favorites and removes entries by series id', () => {
    const { runtime, state } = createRuntime();

    runtime.toggleCuratedFavorite('series-1');
    expect(state.curatedEntries).toEqual([{ seriesId: 'series-1', isFavorite: true }]);

    runtime.removeCuratedSeries('series-1');
    expect(state.curatedEntries).toEqual([]);
  });

  it('skips curated entry writes when target series ids are not present', () => {
    const { runtime, state } = createRuntime();
    const initialEntriesRef = state.curatedEntries;

    runtime.toggleCuratedFavorite('missing-series');
    expect(state.curatedEntries).toBe(initialEntriesRef);

    runtime.removeCuratedSeries('missing-series');
    expect(state.curatedEntries).toBe(initialEntriesRef);
  });
});
