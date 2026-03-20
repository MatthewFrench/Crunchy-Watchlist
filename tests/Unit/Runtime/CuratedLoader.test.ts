import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedLoaderRuntime = {
  loadCuratedEntries: (force?: boolean) => Promise<unknown[]>;
  ensureCuratedDataLoad: (force?: boolean) => Promise<unknown[]>;
};

type CuratedLoaderModule = {
  createCuratedLoaderRuntime: (options: Record<string, unknown>) => CuratedLoaderRuntime;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const curatedLoaderModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedLoader.ts'),
).href;
const curatedPanelGridDomStateModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridDomState.ts'),
).href;
let curatedLoaderModule: CuratedLoaderModule | null = null;
let curatedPanelGridDomStateModule: {
  writeProjectedCuratedGridChildren: (
    gridElement: Element,
    activeCards: Element[],
    projectedSeriesIds?: string[],
  ) => void;
} | null = null;

function createDeferred<T>(): Deferred<T> {
  let resolveRef: ((value: T | PromiseLike<T>) => void) | null = null;
  let rejectRef: ((reason?: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;
  });

  if (!resolveRef || !rejectRef) {
    throw new Error('Failed to initialize deferred promise');
  }

  return {
    promise,
    resolve: resolveRef,
    reject: rejectRef,
  };
}

async function flushMicrotasks(iterations = 5): Promise<void> {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

async function waitForCondition(condition: () => boolean, iterations = 24): Promise<boolean> {
  for (let index = 0; index < iterations; index += 1) {
    if (condition()) {
      return true;
    }
    await flushMicrotasks();
  }
  return false;
}

function getCuratedLoaderModule() {
  if (!curatedLoaderModule) {
    throw new Error('Curated loader module was not initialized for test');
  }
  return curatedLoaderModule;
}

function createCuratedLoaderHarness(overrides: Record<string, unknown> = {}) {
  const runtimeEvents: Array<{ event: string; data?: unknown }> = [];

  const state = {
    mounted: true,
    curatedError: null as unknown,
    curatedEntries: [] as unknown[],
    curatedInflight: null as Promise<unknown[]> | null,
    curatedPendingRequests: [] as string[],
    curatedPendingRequestStartedCount: 0,
    curatedPendingRequestCompletedCount: 0,
    curatedSource: 'none',
    curatedLastRevalidateAt: 0,
    curatedObservedPromise: null as Promise<unknown[]> | null,
    curatedInitialLoadDone: false,
    gridEl: null as unknown,
    settings: {
      audioLocaleFilter: 'any',
    },
  };

  const dependencies = {
    state,
    windowRef: {
      innerHeight: 900,
      setTimeout: (callback: () => void) => {
        callback();
        return 1;
      },
      requestIdleCallback: (callback: () => void) => {
        callback();
        return 1;
      },
    },
    documentRef: {
      visibilityState: 'visible',
      querySelectorAll: () => [] as unknown as NodeListOf<Element>,
    },
    locationRef: {
      pathname: '/watchlist',
    },
    runtimeEvent: (event: string, data?: unknown) => {
      runtimeEvents.push({ event, data });
    },
    getAccessToken: vi.fn(async () => ({
      accessToken: 'access-token',
      accountId: 'account-1',
      profileId: 'profile-1',
    })),
    resetWatchlistCacheOnAccountMismatch: vi.fn(),
    fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-1' }]),
    normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) =>
      rows.map((row) => ({
        ...((row as Record<string, unknown>) || {}),
        seriesId: 'series-1',
      })),
    ),
    preloadRatingsForEntries: vi.fn(async () => null),
    preloadWatchHistoryForEntries: vi.fn(async () => null),
    isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => true),
    normalizeAudioLocale: vi.fn((value: unknown) => {
      if (typeof value !== 'string') {
        return null;
      }
      const trimmed = value.trim();
      if (!trimmed || trimmed.toLowerCase() === 'any') {
        return null;
      }
      return trimmed;
    }),
    getPreferredAudioLanguage: vi.fn(() => 'en-US'),
    setWatchlistCacheRows: vi.fn(),
    isWatchlistPath: vi.fn((pathname: string) => pathname.endsWith('/watchlist')),
    renderCuratedPanel: vi.fn(),
    refreshCuratedLoadingIndicator: vi.fn(),
    watchlistRevalidateCooldownMs: 90_000,
    watchlistCacheSourceRevalidateCooldownMs: 45_000,
    metadataPriorityEntryCount: 36,
    metadataDeferredChunkSize: 24,
    metadataDeferredIdleTimeoutMs: 180,
    metadataDeferredHiddenDelayMs: 900,
    metadataViewportPriorityCount: 24,
    ...overrides,
  };

  const runtime = getCuratedLoaderModule().createCuratedLoaderRuntime(dependencies);

  return {
    runtime,
    state: dependencies.state,
    runtimeEvents,
    dependencies,
  };
}

describe('curated-loader runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const curatedLoaderRuntimeModule = (await import(curatedLoaderModuleUrl)) as {
      createRuntimeCuratedLoaderRuntime: () => object;
    };
    curatedPanelGridDomStateModule = (await import(curatedPanelGridDomStateModuleUrl)) as {
      writeProjectedCuratedGridChildren: (
        gridElement: Element,
        activeCards: Element[],
        projectedSeriesIds?: string[],
      ) => void;
    };
    curatedLoaderModule = curatedLoaderRuntimeModule.createRuntimeCuratedLoaderRuntime() as CuratedLoaderModule;
  });

  afterEach(() => {
    curatedLoaderModule = null;
    curatedPanelGridDomStateModule = null;
  });

  it('loads curated entries from API and updates cache + preload state', async () => {
    const harness = createCuratedLoaderHarness({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedSource: 'none',
        curatedLastRevalidateAt: 0,
        curatedObservedPromise: null,
        settings: {
          audioLocaleFilter: 'ja-JP',
        },
      },
    });

    const entries = await harness.runtime.loadCuratedEntries(false);

    expect(entries).toHaveLength(1);
    expect(harness.state.curatedEntries).toHaveLength(1);
    expect(harness.state.curatedSource).toBe('api');
    expect(harness.dependencies.getAccessToken).toHaveBeenCalledWith(false);
    expect(harness.dependencies.resetWatchlistCacheOnAccountMismatch).toHaveBeenCalledWith('account-1', 'profile-1');
    expect(harness.dependencies.setWatchlistCacheRows).toHaveBeenCalledWith(
      'account-1',
      'profile-1',
      [{ id: 'row-1' }],
      expect.any(Number),
    );
    expect(harness.dependencies.setWatchlistCacheRows).toHaveBeenCalledTimes(2);
    expect(harness.dependencies.preloadRatingsForEntries).toHaveBeenCalledTimes(2);
    expect(harness.dependencies.preloadWatchHistoryForEntries).toHaveBeenCalledTimes(2);
    expect(harness.state.curatedPendingRequests).toEqual([]);
    expect(harness.state.curatedPendingRequestStartedCount).toBe(6);
    expect(harness.state.curatedPendingRequestCompletedCount).toBe(6);
    expect(harness.runtimeEvents.map((entry) => entry.event)).toEqual(
      expect.arrayContaining(['curated-load-start', 'curated-load-partial', 'curated-load-done']),
    );
  });

  it('tracks in-flight request labels while first load is pending', async () => {
    const fetchRowsDeferred = createDeferred<unknown[]>();
    const harness = createCuratedLoaderHarness({
      fetchAllWatchlistRows: vi.fn(() => fetchRowsDeferred.promise),
    });

    const loadPromise = harness.runtime.loadCuratedEntries(false);
    await flushMicrotasks();

    expect(harness.state.curatedPendingRequests).toContain(
      'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
    );
    expect(harness.state.curatedPendingRequestStartedCount).toBe(2);
    expect(harness.state.curatedPendingRequestCompletedCount).toBe(1);
    expect(harness.dependencies.refreshCuratedLoadingIndicator).toHaveBeenCalled();
    expect(harness.dependencies.renderCuratedPanel).not.toHaveBeenCalled();

    fetchRowsDeferred.resolve([{ id: 'row-1' }]);
    await loadPromise;

    expect(harness.state.curatedPendingRequests).toEqual([]);
    expect(harness.state.curatedPendingRequestStartedCount).toBe(4);
    expect(harness.state.curatedPendingRequestCompletedCount).toBe(4);
  });

  it('commits watchlist rows before metadata preload requests complete', async () => {
    const preloadRatingsDeferred = createDeferred<unknown>();
    const preloadWatchHistoryDeferred = createDeferred<unknown>();
    const harness = createCuratedLoaderHarness({
      preloadRatingsForEntries: vi.fn(() => preloadRatingsDeferred.promise),
      preloadWatchHistoryForEntries: vi.fn(() => preloadWatchHistoryDeferred.promise),
    });

    const loadPromise = harness.runtime.loadCuratedEntries(false);
    await vi.waitFor(() => {
      expect(harness.state.curatedEntries).toHaveLength(1);
      expect(harness.state.curatedSource).toBe('api');
      expect(harness.state.curatedInflight).not.toBeNull();
      expect(harness.dependencies.setWatchlistCacheRows).toHaveBeenCalledTimes(1);
      expect(harness.dependencies.renderCuratedPanel).toHaveBeenCalled();
      expect(harness.runtimeEvents.map((entry) => entry.event)).toContain('curated-load-partial');
    });
    expect(harness.runtimeEvents.map((entry) => entry.event)).not.toContain('curated-load-done');

    preloadRatingsDeferred.resolve(null);
    preloadWatchHistoryDeferred.resolve(null);
    await loadPromise;

    expect(harness.runtimeEvents.map((entry) => entry.event)).toContain('curated-load-done');
    expect(harness.dependencies.setWatchlistCacheRows).toHaveBeenCalledTimes(2);
  });

  it('replaces prior curated rows with the latest profile-specific watchlist payload', async () => {
    const harness = createCuratedLoaderHarness({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [{ seriesId: 'legacy-series' }],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedSource: 'cache',
        curatedLastRevalidateAt: Date.now() - 60_000,
        curatedObservedPromise: null,
        settings: {
          audioLocaleFilter: 'any',
        },
      },
      fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-new' }]),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) =>
        rows.map((row) => ({
          ...((row as Record<string, unknown>) || {}),
          seriesId: 'new-series',
        })),
      ),
    });

    await harness.runtime.loadCuratedEntries(false);

    expect(harness.state.curatedEntries).toEqual([{ id: 'row-new', seriesId: 'new-series' }]);
    expect(harness.state.curatedEntries).not.toContainEqual({ seriesId: 'legacy-series' });
    expect(harness.dependencies.resetWatchlistCacheOnAccountMismatch).toHaveBeenCalledWith('account-1', 'profile-1');
    expect(harness.dependencies.setWatchlistCacheRows).toHaveBeenCalledWith(
      'account-1',
      'profile-1',
      [{ id: 'row-new' }],
      expect.any(Number),
    );
  });

  it('returns existing entries and performs background revalidate when stale', async () => {
    const fetchRowsDeferred = createDeferred<unknown[]>();
    const cachedEntries = [{ seriesId: 'cached-series' }];

    const harness = createCuratedLoaderHarness({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: cachedEntries,
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedSource: 'api',
        curatedLastRevalidateAt: Date.now() - 200_000,
        curatedObservedPromise: null,
        settings: {
          audioLocaleFilter: 'any',
        },
      },
      fetchAllWatchlistRows: vi.fn(() => fetchRowsDeferred.promise),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) => rows),
    });

    const result = await harness.runtime.ensureCuratedDataLoad(false);
    expect(result).toBe(cachedEntries);
    await flushMicrotasks();
    expect(harness.dependencies.fetchAllWatchlistRows).toHaveBeenCalledTimes(1);
    expect(harness.state.curatedInflight).not.toBeNull();

    const backgroundPromise = harness.state.curatedInflight as Promise<unknown[]>;

    fetchRowsDeferred.resolve([{ seriesId: 'fresh-series' }]);
    await backgroundPromise;
    await Promise.resolve();

    expect(harness.dependencies.renderCuratedPanel).toHaveBeenCalled();
    expect(harness.state.curatedObservedPromise).toBeNull();
  });

  it('records an error when API load fails without cached entries', async () => {
    const harness = createCuratedLoaderHarness({
      fetchAllWatchlistRows: vi.fn(async () => {
        throw new Error('simulated load failure');
      }),
    });

    const result = await harness.runtime.loadCuratedEntries(false);

    expect(result).toEqual([]);
    expect(harness.state.curatedEntries).toEqual([]);
    expect(harness.state.curatedSource).toBe('none');
    expect(harness.state.curatedInitialLoadDone).not.toBe(true);
    expect(String(harness.state.curatedError)).toContain('simulated load failure');
    expect(harness.runtimeEvents.map((entry) => entry.event)).toContain('curated-load-failed');
  });

  it('falls back to forced token refresh when fast-path token is missing profile scope', async () => {
    const getAccessToken = vi
      .fn()
      .mockResolvedValueOnce({
        accessToken: 'access-token',
        accountId: 'account-1',
      })
      .mockResolvedValueOnce({
        accessToken: 'access-token-refresh',
        accountId: 'account-1',
        profileId: 'profile-1',
      });
    const harness = createCuratedLoaderHarness({
      getAccessToken,
    });

    await harness.runtime.loadCuratedEntries(false);

    expect(getAccessToken).toHaveBeenNthCalledWith(1, false);
    expect(getAccessToken).toHaveBeenNthCalledWith(2, true);
  });

  it('loads watchlist data when token refresh still omits profile scope', async () => {
    const getAccessToken = vi
      .fn()
      .mockResolvedValueOnce({
        accessToken: 'access-token',
        accountId: 'account-1',
      })
      .mockResolvedValueOnce({
        accessToken: 'access-token-refresh',
        accountId: 'account-1',
      });
    const harness = createCuratedLoaderHarness({
      getAccessToken,
    });

    const entries = await harness.runtime.loadCuratedEntries(false);

    expect(entries).toHaveLength(1);
    expect(harness.state.curatedSource).toBe('api');
    expect(getAccessToken).toHaveBeenNthCalledWith(1, false);
    expect(getAccessToken).toHaveBeenNthCalledWith(2, true);
    expect(harness.dependencies.resetWatchlistCacheOnAccountMismatch).toHaveBeenCalledWith('account-1', '');
    expect(harness.dependencies.setWatchlistCacheRows).toHaveBeenCalledWith(
      'account-1',
      '',
      [{ id: 'row-1' }],
      expect.any(Number),
    );
  });

  it('uses forced token refresh immediately when caller requests force reload', async () => {
    const getAccessToken = vi.fn(async () => ({
      accessToken: 'access-token',
      accountId: 'account-1',
      profileId: 'profile-1',
    }));
    const harness = createCuratedLoaderHarness({
      getAccessToken,
    });

    await harness.runtime.loadCuratedEntries(true);

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(getAccessToken).toHaveBeenCalledWith(true);
  });

  it('resolves first load after priority metadata and continues deferred metadata in background', async () => {
    const deferredRatings = createDeferred<unknown>();
    const deferredHistory = createDeferred<unknown>();
    const preloadRatingsForEntries = vi.fn(async (entries: unknown[]) => {
      if ((Array.isArray(entries) ? entries.length : 0) > 1) {
        return deferredRatings.promise;
      }
      return null;
    });
    const preloadWatchHistoryForEntries = vi.fn(async (entries: unknown[]) => {
      if ((Array.isArray(entries) ? entries.length : 0) > 1) {
        return deferredHistory.promise;
      }
      return null;
    });
    const harness = createCuratedLoaderHarness({
      metadataPriorityEntryCount: 1,
      fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-1' }, { id: 'row-2' }, { id: 'row-3' }]),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) =>
        rows.map((row, index) => ({
          ...((row as Record<string, unknown>) || {}),
          seriesId: `series-${index + 1}`,
        })),
      ),
      preloadRatingsForEntries,
      preloadWatchHistoryForEntries,
    });

    const loaded = await harness.runtime.loadCuratedEntries(false);

    expect(loaded).toHaveLength(3);
    expect(harness.state.curatedInflight).toBeNull();
    expect(harness.runtimeEvents.map((entry) => entry.event)).toContain('curated-load-background-metadata-start');
    expect(harness.runtimeEvents.map((entry) => entry.event)).not.toContain('curated-load-background-metadata-done');

    deferredRatings.resolve(null);
    deferredHistory.resolve(null);
    await flushMicrotasks();

    expect(harness.runtimeEvents.map((entry) => entry.event)).toContain('curated-load-background-metadata-done');
  });

  it('prioritizes deferred metadata chunks for cards currently visible in the viewport', async () => {
    const preloadRatingsForEntries = vi.fn(async () => null);
    const preloadWatchHistoryForEntries = vi.fn(async () => null);
    const harness = createCuratedLoaderHarness({
      metadataPriorityEntryCount: 1,
      metadataDeferredChunkSize: 1,
      fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-1' }, { id: 'row-2' }, { id: 'row-3' }, { id: 'row-4' }]),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) =>
        rows.map((row, index) => ({
          ...((row as Record<string, unknown>) || {}),
          seriesId: `series-${index + 1}`,
        })),
      ),
      preloadRatingsForEntries,
      preloadWatchHistoryForEntries,
    });
    harness.state.gridEl = {
      children: [
        {
          dataset: { cwSeriesId: 'series-4' },
          getBoundingClientRect: () => ({ top: 80, bottom: 340 }),
          parentNode: null,
        },
        {
          dataset: { cwSeriesId: 'series-3' },
          getBoundingClientRect: () => ({ top: 360, bottom: 620 }),
          parentNode: null,
        },
      ],
    } as unknown as Element;
    for (const child of (harness.state.gridEl as { children: Array<{ parentNode: Element | null }> }).children) {
      child.parentNode = harness.state.gridEl as Element;
    }
    curatedPanelGridDomStateModule?.writeProjectedCuratedGridChildren(
      harness.state.gridEl as Element,
      (harness.state.gridEl as { children: Element[] }).children,
      ['series-4', 'series-3'],
    );

    await harness.runtime.loadCuratedEntries(false);
    await flushMicrotasks();

    const ratingsSeriesBatches = (preloadRatingsForEntries.mock.calls as unknown[][])
      .map((call) => (Array.isArray(call[0]) ? call[0] : []))
      .map((entries) => entries.map((entry) => (entry as Record<string, unknown>).seriesId));
    expect(ratingsSeriesBatches[0]).toEqual(['series-1']);
    expect(ratingsSeriesBatches[1]).toEqual(['series-4']);
  });

  it('continues deferred metadata chunks after a chunk failure', async () => {
    const preloadRatingsForEntries = vi.fn(async (entries: unknown[]) => {
      const firstSeriesId = Array.isArray(entries)
        ? String((entries[0] as Record<string, unknown> | undefined)?.seriesId ?? '')
        : '';
      if (firstSeriesId === 'series-2') {
        throw new Error('simulated deferred chunk failure');
      }
      return null;
    });
    const preloadWatchHistoryForEntries = vi.fn(async () => null);
    const harness = createCuratedLoaderHarness({
      metadataPriorityEntryCount: 1,
      metadataDeferredChunkSize: 1,
      fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-1' }, { id: 'row-2' }, { id: 'row-3' }, { id: 'row-4' }]),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) =>
        rows.map((row, index) => ({
          ...((row as Record<string, unknown>) || {}),
          seriesId: `series-${index + 1}`,
        })),
      ),
      preloadRatingsForEntries,
      preloadWatchHistoryForEntries,
    });

    await harness.runtime.loadCuratedEntries(false);
    const didFinishDeferredChunks = await waitForCondition(() =>
      harness.runtimeEvents.some((entry) => entry.event === 'curated-load-background-metadata-done'),
    );

    const ratingsSeriesBatches = (preloadRatingsForEntries.mock.calls as unknown[][])
      .map((call) => (Array.isArray(call[0]) ? call[0] : []))
      .map((entries) => entries.map((entry) => String((entry as Record<string, unknown>).seriesId ?? '')));
    expect(ratingsSeriesBatches).toEqual(expect.arrayContaining([['series-2'], ['series-3'], ['series-4']]));
    expect(didFinishDeferredChunks).toBe(true);
    expect(harness.runtimeEvents.map((entry) => entry.event)).toContain('curated-load-background-metadata-failed');
    const doneEvent = harness.runtimeEvents.find((entry) => entry.event === 'curated-load-background-metadata-done');
    expect(doneEvent?.data).toEqual(
      expect.objectContaining({
        completedChunks: 3,
      }),
    );
  });
});
