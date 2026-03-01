import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StateLoaderRuntime = {
  loadInitialState: () => Promise<void>;
};

type RuntimeStateLoaderModule = {
  createStateLoader: (options: Record<string, unknown>) => StateLoaderRuntime;
};

const stateLoaderModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'StateLoader.ts'),
).href;
let runtimeStateLoaderModule: RuntimeStateLoaderModule | null = null;

function getStateLoaderModule() {
  if (!runtimeStateLoaderModule) {
    throw new Error('Runtime state-loader module was not initialized for test');
  }

  return runtimeStateLoaderModule;
}

function createBaseState() {
  return {
    settings: {},
    ratingCache: {},
    watchHistoryCache: {},
    watchHistoryStatus: 'idle',
    watchlistCache: {},
    authToken: null as unknown,
    curatedEntries: [] as unknown[],
    curatedSource: 'none',
    curatedLastRevalidateAt: 0,
  };
}

function createStorageGet(values: Record<string, unknown>) {
  return async (key: string, fallback: unknown) => (Object.hasOwn(values, key) ? values[key] : fallback);
}

function createTokenEntry(profileId = 'profile-1') {
  return {
    accessToken: 'token-1',
    accountId: 'account-1',
    profileId,
  };
}

describe('runtime state-loader', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(stateLoaderModuleUrl)) as {
      createRuntimeStateLoaderRuntime: () => RuntimeStateLoaderModule;
    };
    runtimeStateLoaderModule = module.createRuntimeStateLoaderRuntime();
  });

  afterEach(() => {
    runtimeStateLoaderModule = null;
  });

  it('migrates legacy settings and enforces sort/layout guards', async () => {
    const state = createBaseState();
    const runtimeEvents: Array<{ event: string; data?: unknown }> = [];
    const defaultSettings = {
      activeTab: 'curated',
      cardLayout: 'portrait',
      watchReadyFilterMode: 'hide',
      sortMode: 'consensus_quality_desc',
      secondarySortMode: 'none',
    };

    const storageValues = {
      cw_settings_v1: {
        requireEnglishAudio: true,
        actionabilityMode: 'dim',
        cardLayout: 'unknown-layout',
        sortMode: 'invalid-sort',
        secondarySortMode: 'also-invalid',
      },
      cw_rating_cache_v2: {
        seriesA: { rating: 4.4 },
      },
      cw_watch_history_cache_v1: {
        persisted: true,
      },
      cw_watchlist_cache_v1: null,
    };

    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet(storageValues),
      getAccessToken: async () => createTokenEntry(),
      runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => false,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => false,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings,
      validSortModes: new Set(['none', 'consensus_quality_desc']),
      defaultSortMode: 'consensus_quality_desc',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoader.loadInitialState();

    const settings = state.settings as Record<string, unknown>;
    expect(settings.audioLocaleFilter).toBe('en-US');
    expect(settings.watchReadyFilterMode).toBe('dim');
    expect(settings.cardLayout).toBe('portrait');
    expect(settings.sortMode).toBe('consensus_quality_desc');
    expect(settings.secondarySortMode).toBe('none');
    expect(state.ratingCache).toEqual({
      seriesA: { rating: 4.4 },
    });
    expect(state.watchHistoryStatus).toBe('idle');
    expect(runtimeEvents.at(-1)).toEqual({
      event: 'state-load-done',
      data: {
        tab: 'curated',
        cachedCurated: 0,
      },
    });
  });

  it('disables secondary sort when it matches the primary sort mode', async () => {
    const state = createBaseState();
    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {
          sortMode: 'rating_desc',
          secondarySortMode: 'rating_desc',
        },
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: null,
      }),
      getAccessToken: async () => createTokenEntry(),
      runtimeEvent: () => {},
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => false,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => false,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings: {
        activeTab: 'curated',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        cardLayout: 'portrait',
        watchReadyFilterMode: 'hide',
        sortMode: 'consensus_quality_desc',
        secondarySortMode: 'none',
      },
      validSortModes: new Set(['none', 'rating_desc', 'consensus_quality_desc']),
      defaultSortMode: 'consensus_quality_desc',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoader.loadInitialState();

    expect((state.settings as Record<string, unknown>).sortMode).toBe('rating_desc');
    expect((state.settings as Record<string, unknown>).secondarySortMode).toBe('none');
  });

  it('normalizes audio locale filter at state boundary for sentinel and locale values', async () => {
    const state = createBaseState();
    const defaultSettings = {
      activeTab: 'curated',
      audioLocaleFilter: 'any',
      genreFilter: 'any',
      cardLayout: 'portrait',
      watchReadyFilterMode: 'hide',
      sortMode: 'none',
      secondarySortMode: 'none',
    };

    const stateLoaderSentinel = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {
          audioLocaleFilter: ' Any ',
        },
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: null,
      }),
      getAccessToken: async () => createTokenEntry(),
      runtimeEvent: () => {},
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => false,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => false,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings,
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoaderSentinel.loadInitialState();
    expect((state.settings as Record<string, unknown>).audioLocaleFilter).toBe('any');

    const stateWithLocale = createBaseState();
    const stateLoaderLocale = getStateLoaderModule().createStateLoader({
      state: stateWithLocale,
      storageGet: createStorageGet({
        cw_settings_v1: {
          audioLocaleFilter: ' ja-JP ',
        },
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: null,
      }),
      getAccessToken: async () => createTokenEntry(),
      runtimeEvent: () => {},
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => false,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => false,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings,
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoaderLocale.loadInitialState();
    expect((stateWithLocale.settings as Record<string, unknown>).audioLocaleFilter).toBe('ja-JP');
  });

  it('hydrates curated entries from valid watchlist cache and emits hydration event', async () => {
    const state = createBaseState();
    state.authToken = createTokenEntry();
    const runtimeEvents: Array<{ event: string; data?: unknown }> = [];
    const watchlistRows = [{ series_id: 'series-1' }, { series_id: 'series-2' }];
    const isWatchlistCacheValid = (cache: unknown, accountId?: unknown, profileId?: unknown) =>
      accountId === 'account-1' && profileId === 'profile-1' && Boolean(cache);

    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {},
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: {
          accountId: 'account-1',
          profileId: 'profile-1',
          rows: watchlistRows,
          updatedAt: 12345,
        },
      }),
      getAccessToken: async () => createTokenEntry(),
      runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => true,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid,
      normalizeEntriesFromApiRows: (rows: unknown[]) =>
        rows.map((row) => ({ ...((row as object) || {}), normalized: true })),
      defaultSettings: {
        activeTab: 'curated',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        cardLayout: 'portrait',
        watchReadyFilterMode: 'hide',
        sortMode: 'none',
        secondarySortMode: 'none',
      },
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoader.loadInitialState();

    expect(state.curatedSource).toBe('cache');
    expect(state.curatedLastRevalidateAt).toBe(12345);
    expect(state.curatedEntries).toEqual([
      { series_id: 'series-1', normalized: true },
      { series_id: 'series-2', normalized: true },
    ]);
    expect(runtimeEvents).toContainEqual({
      event: 'curated-cache-hydrated',
      data: {
        total: 2,
        updatedAt: 12345,
        accountId: 'account-1',
        profileId: 'profile-1',
      },
    });
  });

  it('hydrates account-scoped watchlist cache when token has no profile_id', async () => {
    const state = createBaseState();
    const runtimeEvents: Array<{ event: string; data?: unknown }> = [];
    const isWatchlistCacheValid = vi.fn(() => true);
    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {},
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: {
          accountId: 'account-1',
          profileId: '',
          rows: [{ series_id: 'series-1' }],
          updatedAt: 12345,
        },
      }),
      getAccessToken: async () => ({
        accessToken: 'token-1',
        accountId: 'account-1',
      }),
      runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => true,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings: {
        activeTab: 'curated',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        cardLayout: 'portrait',
        watchReadyFilterMode: 'hide',
        sortMode: 'none',
        secondarySortMode: 'none',
      },
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoader.loadInitialState();

    expect(isWatchlistCacheValid).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: 'account-1', profileId: '' }),
      'account-1',
      '',
    );
    expect(state.curatedSource).toBe('cache');
    expect(state.curatedEntries).toEqual([{ series_id: 'series-1' }]);
    expect(runtimeEvents).toContainEqual({
      event: 'curated-cache-hydrated',
      data: {
        total: 1,
        updatedAt: 12345,
        accountId: 'account-1',
        profileId: null,
      },
    });
  });

  it('hydrates account-scoped cached watchlist rows without forcing access-token refresh on initial state load', async () => {
    const state = createBaseState();
    const runtimeEvents: Array<{ event: string; data?: unknown }> = [];
    const getAccessToken = vi.fn(async () => null);
    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {},
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: {
          accountId: 'account-1',
          profileId: '',
          rows: [{ series_id: 'series-1' }],
          updatedAt: 12345,
        },
      }),
      getAccessToken,
      runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => true,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => true,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings: {
        activeTab: 'curated',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        cardLayout: 'portrait',
        watchReadyFilterMode: 'hide',
        sortMode: 'none',
        secondarySortMode: 'none',
      },
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoader.loadInitialState();

    expect(getAccessToken).not.toHaveBeenCalled();
    expect(state.curatedEntries).toEqual([{ series_id: 'series-1' }]);
    expect(state.curatedSource).toBe('cache');
    expect(runtimeEvents).toContainEqual({
      event: 'curated-cache-hydrated',
      data: {
        total: 1,
        updatedAt: 12345,
        accountId: 'account-1',
        profileId: null,
      },
    });
  });

  it('does not hydrate profile-scoped cache when profile scope is unverified at bootstrap', async () => {
    const state = createBaseState();
    const runtimeEvents: Array<{ event: string; data?: unknown }> = [];
    const getAccessToken = vi.fn(async () => null);
    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {},
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: {
          accountId: 'account-1',
          profileId: 'profile-1',
          rows: [{ series_id: 'series-1' }],
          updatedAt: 12345,
        },
      }),
      getAccessToken,
      runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => true,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => true,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings: {
        activeTab: 'curated',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        cardLayout: 'portrait',
        watchReadyFilterMode: 'hide',
        sortMode: 'none',
        secondarySortMode: 'none',
      },
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoader.loadInitialState();

    expect(getAccessToken).not.toHaveBeenCalled();
    expect(state.curatedEntries).toEqual([]);
    expect(state.curatedSource).toBe('none');
    expect(runtimeEvents).toContainEqual({
      event: 'curated-cache-scope-unavailable',
      data: {
        hasAccountId: false,
        hasProfileId: false,
        requiresProfileScope: true,
      },
    });
    expect(runtimeEvents.map((entry) => entry.event)).not.toContain('curated-cache-hydrated');
  });

  it('does not hydrate cached watchlist rows when the active profile scope differs', async () => {
    const state = createBaseState();
    state.authToken = createTokenEntry('profile-2');
    const runtimeEvents: Array<{ event: string; data?: unknown }> = [];
    const isWatchlistCacheValid = (cache: unknown, accountId?: unknown, profileId?: unknown) => {
      if (accountId !== 'account-1' || profileId !== 'profile-2') {
        return false;
      }

      const cacheRecord = cache as { accountId?: unknown; profileId?: unknown } | null | undefined;
      return cacheRecord?.accountId === accountId && cacheRecord?.profileId === profileId;
    };

    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {},
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: {
          accountId: 'account-1',
          profileId: 'profile-1',
          rows: [{ series_id: 'series-1' }],
          updatedAt: 12345,
        },
      }),
      getAccessToken: vi.fn(async () => createTokenEntry('profile-2')),
      runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => true,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings: {
        activeTab: 'curated',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        cardLayout: 'portrait',
        watchReadyFilterMode: 'hide',
        sortMode: 'none',
        secondarySortMode: 'none',
      },
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoader.loadInitialState();

    expect(state.curatedEntries).toEqual([]);
    expect(state.curatedSource).toBe('none');
    expect(runtimeEvents.map((entry) => entry.event)).not.toContain('curated-cache-hydrated');
  });

  it('skips profile-scoped cache hydration when in-memory token profile scope is unavailable', async () => {
    const state = createBaseState();
    state.authToken = {
      accessToken: 'token-1',
      accountId: 'account-1',
    };
    const runtimeEvents: Array<{ event: string; data?: unknown }> = [];
    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {},
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: {
          accountId: 'account-1',
          profileId: 'profile-1',
          rows: [{ series_id: 'series-1' }],
          updatedAt: 12345,
        },
      }),
      getAccessToken: vi.fn(async () => null),
      runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => true,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => true,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings: {
        activeTab: 'curated',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        cardLayout: 'portrait',
        watchReadyFilterMode: 'hide',
        sortMode: 'none',
        secondarySortMode: 'none',
      },
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoader.loadInitialState();

    expect(state.curatedSource).toBe('none');
    expect(state.curatedEntries).toEqual([]);
    expect(runtimeEvents).toContainEqual({
      event: 'curated-cache-scope-unavailable',
      data: {
        hasAccountId: true,
        hasProfileId: false,
        requiresProfileScope: true,
      },
    });
    expect(runtimeEvents.map((entry) => entry.event)).not.toContain('curated-cache-hydrated');
  });

  it('preserves hide_not_started watch-ready mode when stored in settings', async () => {
    const state = createBaseState();
    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {
          watchReadyFilterMode: 'hide_not_started',
        },
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: null,
      }),
      getAccessToken: async () => createTokenEntry(),
      runtimeEvent: () => {},
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => false,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => false,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings: {
        activeTab: 'curated',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        cardLayout: 'portrait',
        watchReadyFilterMode: 'hide',
        sortMode: 'none',
        secondarySortMode: 'none',
      },
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    });

    await stateLoader.loadInitialState();

    expect((state.settings as Record<string, unknown>).watchReadyFilterMode).toBe('hide_not_started');
  });
});
