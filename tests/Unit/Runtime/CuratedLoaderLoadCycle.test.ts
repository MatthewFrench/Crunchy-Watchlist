import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedLoaderLoadCycleRuntime = {
  runCuratedLoadCycle: (options: {
    context: Record<string, unknown>;
    deferredMetadataRuntime: {
      splitMetadataPreloadEntries: (
        context: Record<string, unknown>,
        entries: unknown[],
      ) => { priorityEntries: unknown[]; deferredEntries: unknown[] };
      queueDeferredMetadataPreload: (options: {
        context: Record<string, unknown>;
        deferredEntries: unknown[];
        tokenEntry: Record<string, unknown>;
        preloadMetadataForEntries: (entries: unknown[], tokenEntry: Record<string, unknown>) => Promise<void>;
      }) => void;
    };
    pendingRequestsRuntime: {
      syncPendingRequestDiagnostics: (
        context: Record<string, unknown>,
        activeRequests: string[],
        progress: { started: number; completed: number },
      ) => void;
      withTrackedPendingRequest: <T>(
        context: Record<string, unknown>,
        activeRequests: string[],
        progress: { started: number; completed: number },
        label: string,
        work: () => Promise<T>,
      ) => Promise<T>;
    };
    activeRequests: string[];
    pendingProgress: { started: number; completed: number };
    force: boolean;
  }) => Promise<unknown[]>;
  handleCuratedLoadFailure: (context: Record<string, unknown>, error: unknown) => unknown[];
};

type CuratedLoaderLoadCycleModule = {
  createCuratedLoaderLoadCycleRuntime: () => CuratedLoaderLoadCycleRuntime;
};

const curatedLoaderLoadCycleModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedLoaderLoadCycle.ts'),
).href;
let curatedLoaderLoadCycleModule: CuratedLoaderLoadCycleModule | null = null;

function getCuratedLoaderLoadCycleModule() {
  if (!curatedLoaderLoadCycleModule) {
    throw new Error('Curated loader load-cycle runtime module was not initialized for test');
  }
  return curatedLoaderLoadCycleModule;
}

describe('curated-loader-load-cycle runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    curatedLoaderLoadCycleModule = (await import(curatedLoaderLoadCycleModuleUrl)) as CuratedLoaderLoadCycleModule;
  });

  afterEach(() => {
    curatedLoaderLoadCycleModule = null;
  });

  it('runs the full load cycle and commits partial/final states with timing telemetry', async () => {
    const runtime = getCuratedLoaderLoadCycleModule().createCuratedLoaderLoadCycleRuntime();
    const runtimeEvents: Array<{ event: string; data?: unknown }> = [];
    const preloadRatingsForEntries = vi.fn(async () => null);
    const preloadWatchHistoryForEntries = vi.fn(async () => null);
    const setWatchlistCacheRows = vi.fn();
    const queueDeferredMetadataPreload = vi.fn();
    const syncPendingRequestDiagnostics = vi.fn();
    const withTrackedPendingRequest = async <T>(
      _context: Record<string, unknown>,
      _activeRequests: string[],
      _progress: { started: number; completed: number },
      _label: string,
      work: () => Promise<T>,
    ): Promise<T> => work();

    const context = {
      state: {
        mounted: true,
        curatedError: 'previous-error',
        curatedEntries: [] as unknown[],
        curatedSource: 'none',
        curatedLastRevalidateAt: 0,
        deferredMetadataRunId: 0,
        settings: {
          audioLocaleFilter: 'ja-JP',
        },
      },
      locationRef: {
        pathname: '/watchlist',
      },
      runtimeEvent: (event: string, data?: unknown) => {
        runtimeEvents.push({ event, data });
      },
      getAccessToken: vi.fn(async () => ({
        accessToken: 'token-1',
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
      preloadRatingsForEntries,
      preloadWatchHistoryForEntries,
      isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => true),
      normalizeAudioLocale: vi.fn((locale: unknown) => (typeof locale === 'string' ? locale.trim() : null)),
      getPreferredAudioLanguage: vi.fn(() => 'en-US'),
      setWatchlistCacheRows,
      isWatchlistPath: vi.fn(() => true),
      renderCuratedPanel: vi.fn(),
      refreshCuratedLoadingIndicator: vi.fn(),
      deferredMetadataRunId: 0,
    };
    const pendingRequestsRuntime = {
      syncPendingRequestDiagnostics,
      withTrackedPendingRequest,
    };
    const deferredMetadataRuntime = {
      splitMetadataPreloadEntries: vi.fn((_context: Record<string, unknown>, entries: unknown[]) => ({
        priorityEntries: entries.slice(0, 1),
        deferredEntries: entries.slice(1),
      })),
      queueDeferredMetadataPreload,
    };
    const activeRequests: string[] = [];
    const pendingProgress = { started: 0, completed: 0 };

    const entries = await runtime.runCuratedLoadCycle({
      context,
      deferredMetadataRuntime,
      pendingRequestsRuntime,
      activeRequests,
      pendingProgress,
      force: false,
    });

    expect(entries).toHaveLength(1);
    expect(context.state.curatedError).toBeNull();
    expect(context.state.curatedSource).toBe('api');
    expect(context.deferredMetadataRunId).toBe(1);
    expect(setWatchlistCacheRows).toHaveBeenCalledTimes(2);
    expect(preloadRatingsForEntries).toHaveBeenCalledTimes(2);
    expect(preloadWatchHistoryForEntries).toHaveBeenCalledTimes(2);
    expect(queueDeferredMetadataPreload).toHaveBeenCalledTimes(1);
    expect(syncPendingRequestDiagnostics).toHaveBeenCalled();
    expect(runtimeEvents.map((entry) => entry.event)).toEqual(
      expect.arrayContaining([
        'curated-load-start',
        'curated-load-partial',
        'curated-load-done',
        'curated-load-timing',
      ]),
    );
  });

  it('does not force-refresh auth for cache-backed loads when the first token is usable', async () => {
    const runtime = getCuratedLoaderLoadCycleModule().createCuratedLoaderLoadCycleRuntime();
    const withTrackedPendingRequest = async <T>(
      _context: Record<string, unknown>,
      _activeRequests: string[],
      _progress: { started: number; completed: number },
      _label: string,
      work: () => Promise<T>,
    ): Promise<T> => work();
    const getAccessToken = vi.fn(async () => ({
      accessToken: 'token-1',
      accountId: 'account-1',
      profileId: 'profile-1',
    }));
    const context = {
      state: {
        mounted: false,
        curatedError: null as unknown,
        curatedEntries: [] as unknown[],
        curatedSource: 'cache',
        curatedLastRevalidateAt: 0,
        deferredMetadataRunId: 0,
        settings: {
          audioLocaleFilter: 'any',
        },
      },
      locationRef: {
        pathname: '/watchlist',
      },
      runtimeEvent: vi.fn(),
      getAccessToken,
      resetWatchlistCacheOnAccountMismatch: vi.fn(),
      fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-1' }]),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) => rows),
      preloadRatingsForEntries: vi.fn(async () => null),
      preloadWatchHistoryForEntries: vi.fn(async () => null),
      isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => false),
      normalizeAudioLocale: vi.fn((locale: unknown) => (typeof locale === 'string' ? locale : null)),
      getPreferredAudioLanguage: vi.fn(() => 'en-US'),
      setWatchlistCacheRows: vi.fn(),
      isWatchlistPath: vi.fn(() => true),
      renderCuratedPanel: vi.fn(),
      refreshCuratedLoadingIndicator: vi.fn(),
      deferredMetadataRunId: 0,
    };

    await runtime.runCuratedLoadCycle({
      context,
      deferredMetadataRuntime: {
        splitMetadataPreloadEntries: vi.fn((_context: Record<string, unknown>, entries: unknown[]) => ({
          priorityEntries: entries,
          deferredEntries: [],
        })),
        queueDeferredMetadataPreload: vi.fn(),
      },
      pendingRequestsRuntime: {
        syncPendingRequestDiagnostics: vi.fn(),
        withTrackedPendingRequest,
      },
      activeRequests: [],
      pendingProgress: { started: 0, completed: 0 },
      force: false,
    });

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(getAccessToken).toHaveBeenCalledWith(false);
  });

  it('falls back to a forced auth refresh when the first token response is incomplete', async () => {
    const runtime = getCuratedLoaderLoadCycleModule().createCuratedLoaderLoadCycleRuntime();
    const withTrackedPendingRequest = async <T>(
      _context: Record<string, unknown>,
      _activeRequests: string[],
      _progress: { started: number; completed: number },
      _label: string,
      work: () => Promise<T>,
    ): Promise<T> => work();
    const getAccessToken = vi
      .fn()
      .mockResolvedValueOnce({
        accessToken: 'token-1',
        accountId: 'account-1',
        profileId: '',
      })
      .mockResolvedValueOnce({
        accessToken: 'token-2',
        accountId: 'account-1',
        profileId: 'profile-1',
      });
    const context = {
      state: {
        mounted: false,
        curatedError: null as unknown,
        curatedEntries: [] as unknown[],
        curatedSource: 'cache',
        curatedLastRevalidateAt: 0,
        deferredMetadataRunId: 0,
        settings: {
          audioLocaleFilter: 'any',
        },
      },
      locationRef: {
        pathname: '/watchlist',
      },
      runtimeEvent: vi.fn(),
      getAccessToken,
      resetWatchlistCacheOnAccountMismatch: vi.fn(),
      fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-1' }]),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) => rows),
      preloadRatingsForEntries: vi.fn(async () => null),
      preloadWatchHistoryForEntries: vi.fn(async () => null),
      isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => false),
      normalizeAudioLocale: vi.fn((locale: unknown) => (typeof locale === 'string' ? locale : null)),
      getPreferredAudioLanguage: vi.fn(() => 'en-US'),
      setWatchlistCacheRows: vi.fn(),
      isWatchlistPath: vi.fn(() => true),
      renderCuratedPanel: vi.fn(),
      refreshCuratedLoadingIndicator: vi.fn(),
      deferredMetadataRunId: 0,
    };

    await runtime.runCuratedLoadCycle({
      context,
      deferredMetadataRuntime: {
        splitMetadataPreloadEntries: vi.fn((_context: Record<string, unknown>, entries: unknown[]) => ({
          priorityEntries: entries,
          deferredEntries: [],
        })),
        queueDeferredMetadataPreload: vi.fn(),
      },
      pendingRequestsRuntime: {
        syncPendingRequestDiagnostics: vi.fn(),
        withTrackedPendingRequest,
      },
      activeRequests: [],
      pendingProgress: { started: 0, completed: 0 },
      force: false,
    });

    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(getAccessToken).toHaveBeenNthCalledWith(1, false);
    expect(getAccessToken).toHaveBeenNthCalledWith(2, true);
  });

  it('keeps the initial account-scoped token when profile refresh fails', async () => {
    const runtime = getCuratedLoaderLoadCycleModule().createCuratedLoaderLoadCycleRuntime();
    const withTrackedPendingRequest = async <T>(
      _context: Record<string, unknown>,
      _activeRequests: string[],
      _progress: { started: number; completed: number },
      _label: string,
      work: () => Promise<T>,
    ): Promise<T> => work();
    const getAccessToken = vi
      .fn()
      .mockResolvedValueOnce({
        accessToken: 'token-1',
        accountId: 'account-1',
        profileId: '',
      })
      .mockResolvedValueOnce(null);
    const fetchAllWatchlistRows = vi.fn(async () => [{ id: 'row-1' }]);
    const context = {
      state: {
        mounted: false,
        curatedError: null as unknown,
        curatedEntries: [] as unknown[],
        curatedSource: 'cache',
        curatedLastRevalidateAt: 0,
        deferredMetadataRunId: 0,
        settings: {
          audioLocaleFilter: 'any',
        },
      },
      locationRef: {
        pathname: '/watchlist',
      },
      runtimeEvent: vi.fn(),
      getAccessToken,
      resetWatchlistCacheOnAccountMismatch: vi.fn(),
      fetchAllWatchlistRows,
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) => rows),
      preloadRatingsForEntries: vi.fn(async () => null),
      preloadWatchHistoryForEntries: vi.fn(async () => null),
      isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => false),
      normalizeAudioLocale: vi.fn((locale: unknown) => (typeof locale === 'string' ? locale : null)),
      getPreferredAudioLanguage: vi.fn(() => 'en-US'),
      setWatchlistCacheRows: vi.fn(),
      isWatchlistPath: vi.fn(() => true),
      renderCuratedPanel: vi.fn(),
      refreshCuratedLoadingIndicator: vi.fn(),
      deferredMetadataRunId: 0,
    };

    await runtime.runCuratedLoadCycle({
      context,
      deferredMetadataRuntime: {
        splitMetadataPreloadEntries: vi.fn((_context: Record<string, unknown>, entries: unknown[]) => ({
          priorityEntries: entries,
          deferredEntries: [],
        })),
        queueDeferredMetadataPreload: vi.fn(),
      },
      pendingRequestsRuntime: {
        syncPendingRequestDiagnostics: vi.fn(),
        withTrackedPendingRequest,
      },
      activeRequests: [],
      pendingProgress: { started: 0, completed: 0 },
      force: false,
    });

    expect(getAccessToken).toHaveBeenCalledTimes(2);
    expect(getAccessToken).toHaveBeenNthCalledWith(1, false);
    expect(getAccessToken).toHaveBeenNthCalledWith(2, true);
    expect(fetchAllWatchlistRows).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'token-1',
        accountId: 'account-1',
      }),
    );
  });

  it('does not run selected-locale metadata preload when audio filter is any', async () => {
    const runtime = getCuratedLoaderLoadCycleModule().createCuratedLoaderLoadCycleRuntime();
    const withTrackedPendingRequest = async <T>(
      _context: Record<string, unknown>,
      _activeRequests: string[],
      _progress: { started: number; completed: number },
      _label: string,
      work: () => Promise<T>,
    ): Promise<T> => work();
    const preloadRatingsForEntries = vi.fn(async () => null);
    const preloadWatchHistoryForEntries = vi.fn(async () => null);
    const context = {
      state: {
        mounted: false,
        curatedError: null as unknown,
        curatedEntries: [] as unknown[],
        curatedSource: 'cache',
        curatedLastRevalidateAt: 0,
        deferredMetadataRunId: 0,
        settings: {
          audioLocaleFilter: 'any',
        },
      },
      locationRef: {
        pathname: '/watchlist',
      },
      runtimeEvent: vi.fn(),
      getAccessToken: vi.fn(async () => ({
        accessToken: 'token-1',
        accountId: 'account-1',
        profileId: 'profile-1',
      })),
      resetWatchlistCacheOnAccountMismatch: vi.fn(),
      fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-1', seriesId: 'series-1' }]),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) => rows),
      preloadRatingsForEntries,
      preloadWatchHistoryForEntries,
      isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => true),
      normalizeAudioLocale: vi.fn((locale: unknown) => (typeof locale === 'string' ? locale : null)),
      getPreferredAudioLanguage: vi.fn(() => 'en-US'),
      setWatchlistCacheRows: vi.fn(),
      isWatchlistPath: vi.fn(() => true),
      renderCuratedPanel: vi.fn(),
      refreshCuratedLoadingIndicator: vi.fn(),
      deferredMetadataRunId: 0,
    };

    await runtime.runCuratedLoadCycle({
      context,
      deferredMetadataRuntime: {
        splitMetadataPreloadEntries: vi.fn((_context: Record<string, unknown>, entries: unknown[]) => ({
          priorityEntries: entries,
          deferredEntries: [],
        })),
        queueDeferredMetadataPreload: vi.fn(),
      },
      pendingRequestsRuntime: {
        syncPendingRequestDiagnostics: vi.fn(),
        withTrackedPendingRequest,
      },
      activeRequests: [],
      pendingProgress: { started: 0, completed: 0 },
      force: false,
    });

    expect(preloadRatingsForEntries).toHaveBeenCalledTimes(1);
    expect(preloadWatchHistoryForEntries).toHaveBeenCalledTimes(1);
  });

  it('skips selected-locale watch history preload when localized cache is already complete', async () => {
    const runtime = getCuratedLoaderLoadCycleModule().createCuratedLoaderLoadCycleRuntime();
    const withTrackedPendingRequest = async <T>(
      _context: Record<string, unknown>,
      _activeRequests: string[],
      _progress: { started: number; completed: number },
      _label: string,
      work: () => Promise<T>,
    ): Promise<T> => work();
    const preloadWatchHistoryForEntries = vi.fn(async () => null);
    const context = {
      state: {
        mounted: false,
        curatedError: null as unknown,
        curatedEntries: [] as unknown[],
        curatedSource: 'cache',
        curatedLastRevalidateAt: 0,
        deferredMetadataRunId: 0,
        settings: {
          audioLocaleFilter: 'ja-JP',
        },
      },
      locationRef: {
        pathname: '/watchlist',
      },
      runtimeEvent: vi.fn(),
      getAccessToken: vi.fn(async () => ({
        accessToken: 'token-1',
        accountId: 'account-1',
        profileId: 'profile-1',
      })),
      resetWatchlistCacheOnAccountMismatch: vi.fn(),
      fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-1', seriesId: 'series-1' }]),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) => rows),
      preloadRatingsForEntries: vi.fn(async () => null),
      preloadWatchHistoryForEntries,
      isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => false),
      normalizeAudioLocale: vi.fn((locale: unknown) => (typeof locale === 'string' ? locale : null)),
      getPreferredAudioLanguage: vi.fn(() => 'en-US'),
      setWatchlistCacheRows: vi.fn(),
      isWatchlistPath: vi.fn(() => true),
      renderCuratedPanel: vi.fn(),
      refreshCuratedLoadingIndicator: vi.fn(),
      deferredMetadataRunId: 0,
    };

    await runtime.runCuratedLoadCycle({
      context,
      deferredMetadataRuntime: {
        splitMetadataPreloadEntries: vi.fn((_context: Record<string, unknown>, entries: unknown[]) => ({
          priorityEntries: entries,
          deferredEntries: [],
        })),
        queueDeferredMetadataPreload: vi.fn(),
      },
      pendingRequestsRuntime: {
        syncPendingRequestDiagnostics: vi.fn(),
        withTrackedPendingRequest,
      },
      activeRequests: [],
      pendingProgress: { started: 0, completed: 0 },
      force: false,
    });

    const watchHistoryCalls = preloadWatchHistoryForEntries.mock.calls as unknown[][];
    const selectedLocaleHistoryCalls = watchHistoryCalls.filter((call) => call[2] === true && call[3] === 'ja-JP');
    expect(preloadWatchHistoryForEntries).toHaveBeenCalledTimes(1);
    expect(selectedLocaleHistoryCalls).toHaveLength(0);
  });

  it('limits selected-locale watch history preload to the priority stage when deferred chunks run', async () => {
    const runtime = getCuratedLoaderLoadCycleModule().createCuratedLoaderLoadCycleRuntime();
    const withTrackedPendingRequest = async <T>(
      _context: Record<string, unknown>,
      _activeRequests: string[],
      _progress: { started: number; completed: number },
      _label: string,
      work: () => Promise<T>,
    ): Promise<T> => work();
    const preloadWatchHistoryForEntries = vi.fn(async () => null);
    const deferredPreloadPromises: Array<Promise<void>> = [];
    const context = {
      state: {
        mounted: false,
        curatedError: null as unknown,
        curatedEntries: [] as unknown[],
        curatedSource: 'cache',
        curatedLastRevalidateAt: 0,
        deferredMetadataRunId: 0,
        settings: {
          audioLocaleFilter: 'ja-JP',
        },
      },
      locationRef: {
        pathname: '/watchlist',
      },
      runtimeEvent: vi.fn(),
      getAccessToken: vi.fn(async () => ({
        accessToken: 'token-1',
        accountId: 'account-1',
        profileId: 'profile-1',
      })),
      resetWatchlistCacheOnAccountMismatch: vi.fn(),
      fetchAllWatchlistRows: vi.fn(async () => [
        { id: 'row-1', seriesId: 'series-1' },
        { id: 'row-2', seriesId: 'series-2' },
        { id: 'row-3', seriesId: 'series-3' },
      ]),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) => rows),
      preloadRatingsForEntries: vi.fn(async () => null),
      preloadWatchHistoryForEntries,
      isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => true),
      normalizeAudioLocale: vi.fn((locale: unknown) => (typeof locale === 'string' ? locale : null)),
      getPreferredAudioLanguage: vi.fn(() => 'en-US'),
      setWatchlistCacheRows: vi.fn(),
      isWatchlistPath: vi.fn(() => true),
      renderCuratedPanel: vi.fn(),
      refreshCuratedLoadingIndicator: vi.fn(),
      deferredMetadataRunId: 0,
    };

    await runtime.runCuratedLoadCycle({
      context,
      deferredMetadataRuntime: {
        splitMetadataPreloadEntries: vi.fn((_context: Record<string, unknown>, entries: unknown[]) => ({
          priorityEntries: entries.slice(0, 1),
          deferredEntries: entries.slice(1),
        })),
        queueDeferredMetadataPreload: vi.fn((options) => {
          const deferredEntries = Array.isArray(options.deferredEntries) ? options.deferredEntries : [];
          deferredEntries.forEach((entry: unknown) => {
            deferredPreloadPromises.push(options.preloadMetadataForEntries([entry], options.tokenEntry));
          });
        }),
      },
      pendingRequestsRuntime: {
        syncPendingRequestDiagnostics: vi.fn(),
        withTrackedPendingRequest,
      },
      activeRequests: [],
      pendingProgress: { started: 0, completed: 0 },
      force: false,
    });

    await Promise.all(deferredPreloadPromises);

    const watchHistoryCalls = preloadWatchHistoryForEntries.mock.calls as unknown[][];
    const selectedLocaleHistoryCalls = watchHistoryCalls.filter((call) => call[2] === true && call[3] === 'ja-JP');
    expect(preloadWatchHistoryForEntries).toHaveBeenCalledTimes(4);
    expect(selectedLocaleHistoryCalls).toHaveLength(1);
  });

  it('returns existing entries and exposes fallback error state when load fails', () => {
    const runtime = getCuratedLoaderLoadCycleModule().createCuratedLoaderLoadCycleRuntime();
    const runtimeEvent = vi.fn();
    const context = {
      state: {
        curatedEntries: [{ seriesId: 'cached-1' }],
        curatedSource: 'cache',
        curatedError: null as unknown,
      },
      runtimeEvent,
    };

    const result = runtime.handleCuratedLoadFailure(context, new Error('auth missing'));

    expect(result).toEqual([{ seriesId: 'cached-1' }]);
    expect(context.state.curatedSource).toBe('cache');
    expect(context.state.curatedError).toBe('Showing cached data; latest refresh failed.');
    expect(runtimeEvent).toHaveBeenCalledWith('curated-load-failed', {
      message: 'auth missing',
    });
  });
});
