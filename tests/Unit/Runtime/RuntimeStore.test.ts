import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type WatchHistoryCache = {
  version: number;
  accountId: string;
  updatedAt: number;
  bySeriesId: Record<string, unknown>;
  bySeriesIdAudioLocale: Record<string, unknown>;
  bySeriesIdProgress: Record<string, unknown>;
  bySeriesIdAudioLocaleProgress: Record<string, unknown>;
};

type WatchlistCacheSnapshot = {
  accountId: string;
  profileId: string;
  updatedAt: number;
  rows: unknown[];
};

type ApiTraceBuckets = {
  authToken: unknown[];
  watchlist: unknown[];
  watchHistory: unknown[];
  cmsObjects: unknown[];
  legacyRating: unknown[];
  preview: unknown[];
};

type RuntimeStore = {
  createEmptyWatchHistoryCache: (version: unknown) => WatchHistoryCache;
  createWatchlistCacheSnapshot: (
    accountId?: unknown,
    profileIdOrUpdatedAt?: unknown,
    updatedAtOrRows?: unknown,
    rowsMaybe?: unknown,
  ) => WatchlistCacheSnapshot;
  createApiTraceBuckets: () => ApiTraceBuckets;
  createRuntimeState: (options?: {
    defaultSettings?: Record<string, unknown>;
    watchHistoryCacheVersion?: unknown;
  }) => Record<string, unknown>;
};

const runtimeStoreModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'RuntimeStore.ts'),
).href;
let runtimeStore: RuntimeStore | null = null;

function getRuntimeStore(): RuntimeStore {
  if (!runtimeStore) {
    throw new Error('Runtime store runtime was not initialized for test');
  }

  return runtimeStore;
}

describe('RuntimeStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(runtimeStoreModuleUrl)) as {
      createRuntimeStoreRuntime: () => RuntimeStore;
    };
    runtimeStore = module.createRuntimeStoreRuntime();
  });

  afterEach(() => {
    runtimeStore = null;
    vi.restoreAllMocks();
  });

  it('normalizes watch-history cache version values', () => {
    const runtimeStore = getRuntimeStore();

    const finiteFromString = runtimeStore.createEmptyWatchHistoryCache('3');
    const invalidVersion = runtimeStore.createEmptyWatchHistoryCache('not-a-number');

    expect(finiteFromString.version).toBe(3);
    expect(invalidVersion.version).toBe(0);
    expect(finiteFromString.accountId).toBe('');
    expect(Object.keys(finiteFromString.bySeriesId)).toHaveLength(0);
  });

  it('sanitizes watchlist cache snapshots', () => {
    const runtimeStore = getRuntimeStore();

    const normalized = runtimeStore.createWatchlistCacheSnapshot('acct-1', 'profile-1', Date.now(), [{ id: 'row-1' }]);
    const legacyCallSignature = runtimeStore.createWatchlistCacheSnapshot('acct-1', Date.now(), [{ id: 'row-1' }]);
    const fallback = runtimeStore.createWatchlistCacheSnapshot(1, {} as unknown, {} as unknown[]);

    expect(normalized.accountId).toBe('acct-1');
    expect(normalized.profileId).toBe('profile-1');
    expect(Array.isArray(normalized.rows)).toBe(true);
    expect(normalized.rows).toHaveLength(1);

    expect(legacyCallSignature.accountId).toBe('acct-1');
    expect(legacyCallSignature.profileId).toBe('');
    expect(legacyCallSignature.rows).toHaveLength(1);

    expect(fallback.accountId).toBe('');
    expect(fallback.profileId).toBe('');
    expect(fallback.updatedAt).toBe(0);
    expect(fallback.rows).toEqual([]);
  });

  it('creates runtime state with cloned settings and initialized owner maps', () => {
    const runtimeStore = getRuntimeStore();
    const defaultSettings = { activeTab: 'curated', sortMode: 'consensus_quality_desc' };

    const state = runtimeStore.createRuntimeState({
      defaultSettings,
      watchHistoryCacheVersion: 2,
    });

    const typedState = state as Record<string, unknown>;

    expect(typedState.settings).toEqual(defaultSettings);
    expect(typedState.settings).not.toBe(defaultSettings);
    expect((typedState.watchHistoryCache as WatchHistoryCache).version).toBe(2);
    expect(typedState.ratingCacheRevision).toBe(0);
    expect((typedState.ratingInflight as unknown) instanceof Map).toBe(true);
    expect((typedState.previewInflight as unknown) instanceof Map).toBe(true);
    expect(typedState.watchHistoryStatus).toBe('idle');
    expect(typedState.watchHistoryPreloadAttemptDiagnostics).toEqual({
      totalAttempts: 0,
      byLocale: {},
      byLocaleRevision: {},
      lastAttempt: null,
    });
    expect(typedState.curatedPendingRequests).toEqual([]);
    expect(typedState.curatedPendingRequestStartedCount).toBe(0);
    expect(typedState.curatedPendingRequestCompletedCount).toBe(0);
    expect(typedState.mounted).toBe(false);
  });

  it('creates fresh api-trace buckets per call', () => {
    const runtimeStore = getRuntimeStore();

    const first = runtimeStore.createApiTraceBuckets();
    const second = runtimeStore.createApiTraceBuckets();

    first.authToken.push({ id: 'first' });

    expect(first.authToken).toHaveLength(1);
    expect(second.authToken).toHaveLength(0);
    expect(Object.keys(first).sort()).toEqual([
      'authToken',
      'cmsObjects',
      'legacyRating',
      'preview',
      'watchHistory',
      'watchlist',
    ]);
  });
});
