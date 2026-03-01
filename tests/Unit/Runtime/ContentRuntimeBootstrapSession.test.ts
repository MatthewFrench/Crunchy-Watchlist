import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RuntimeBootstrapSessionRuntime = {
  createRuntimeBootstrapSession: (options: {
    bootstrapContext: Record<string, unknown>;
  }) => Record<string, unknown> | null;
  createBootstrapFinalizeRuntimeOptions: (options: Record<string, unknown>) => Record<string, unknown>;
};

type RuntimeBootstrapSessionModule = {
  createContentRuntimeBootstrapSessionRuntime: (options: {
    context: Record<string, unknown>;
    clearStaleInjectedShell: (reason: string) => void;
    createRuntimeLockLifecycleControl: (options: Record<string, unknown>) => {
      startDomRuntimeLockHeartbeat: () => void;
      startRuntimeTakeoverRequestListener: () => void;
      shutdownRuntime: (payload?: Record<string, unknown>) => void;
    };
  }) => RuntimeBootstrapSessionRuntime;
};

const contentRuntimeBootstrapSessionModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentRuntimeBootstrapSession.ts'),
).href;
let bootstrapSessionModule: RuntimeBootstrapSessionModule | null = null;

function getBootstrapSessionModule() {
  if (!bootstrapSessionModule) {
    throw new Error('Bootstrap session module was not initialized for test');
  }
  return bootstrapSessionModule;
}

describe('content-runtime-bootstrap-session runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    bootstrapSessionModule = (await import(contentRuntimeBootstrapSessionModuleUrl)) as RuntimeBootstrapSessionModule;
  });

  afterEach(() => {
    bootstrapSessionModule = null;
    vi.restoreAllMocks();
  });

  it('builds bootstrap-finalize runtime options with lifecycle and state-load callback ownership', async () => {
    const createRuntimeLockLifecycleControl = vi.fn(() => ({
      startDomRuntimeLockHeartbeat: vi.fn(),
      startRuntimeTakeoverRequestListener: vi.fn(),
      shutdownRuntime: vi.fn(),
    }));
    const runtime = getBootstrapSessionModule().createContentRuntimeBootstrapSessionRuntime({
      context: {
        windowRef: {
          clearTimeout: vi.fn(),
          setTimeout: vi.fn(),
        },
        browserRef: {},
        chromeRef: {},
        setRuntimeControl: vi.fn(),
        runtimeInstanceId: 'runtime-1',
        runtimeInstanceStartedAt: 1,
        isCurrentRuntimeActive: vi.fn(() => true),
      },
      clearStaleInjectedShell: vi.fn(),
      createRuntimeLockLifecycleControl,
    });
    const runtimeEvent = vi.fn();
    const storageGet = vi.fn(async (_key: string, fallback: unknown) => fallback);

    const runtimeOptions = runtime.createBootstrapFinalizeRuntimeOptions({
      windowRef: {},
      runtimeEvent,
      runtimeLifecycleModule: {
        marker: 'runtime-lifecycle',
      },
      state: {
        settings: {},
        ratingCache: {},
        watchHistoryCache: null,
        watchHistoryStatus: 'idle',
        watchlistCache: null,
        authToken: null,
        curatedEntries: [],
        curatedSource: 'network',
        curatedLastRevalidateAt: 0,
      },
      isWatchlistPath: vi.fn((pathname: string) => pathname.endsWith('/watchlist')),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => []),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess: vi.fn(),
      storageGet,
      getAccessToken: vi.fn(),
      normalizeStoredWatchHistoryCache: vi.fn(),
      isWatchHistoryCacheValid: vi.fn(),
      normalizeStoredWatchlistCache: vi.fn(),
      isWatchlistCacheValid: vi.fn(),
      normalizeEntriesFromApiRows: vi.fn(),
      defaultSettings: {
        cardLayout: 'portrait',
      },
      validSortModes: ['recentActivity'],
      defaultSortMode: 'recentActivity',
      runtimeConstants: {
        settingsKey: 'settings',
        ratingCacheKey: 'ratings',
        watchHistoryCacheKey: 'history',
        watchlistCacheKey: 'watchlist',
      },
      listKnownSeries: vi.fn(() => []),
      getCuratedDomStats: vi.fn(() => ({ identityChurnRate: 0 })),
      dumpSeriesApiData: vi.fn(),
      printSeriesApiData: vi.fn(),
    });

    expect(runtimeOptions.runtimeLifecycleModule).toEqual({
      marker: 'runtime-lifecycle',
    });
    expect(runtimeOptions.runtimeLifecycleOptions).toEqual(
      expect.objectContaining({
        ensureInterface: expect.any(Function),
        renderCuratedPanel: expect.any(Function),
      }),
    );
    expect(runtimeOptions.loadInitialState).toBeTypeOf('function');

    await (runtimeOptions.loadInitialState as () => Promise<void>)();
    expect(storageGet).toHaveBeenNthCalledWith(1, 'settings', {
      cardLayout: 'portrait',
    });
    expect(storageGet).toHaveBeenNthCalledWith(2, 'ratings', {});
    expect(storageGet).toHaveBeenNthCalledWith(3, 'history', null);
    expect(storageGet).toHaveBeenNthCalledWith(4, 'watchlist', null);
    expect(runtimeEvent).toHaveBeenCalledWith('state-load-done', {
      tab: undefined,
      cachedCurated: 0,
    });
  });

  it('creates runtime bootstrap session and attaches control/watchlist-health runtime ownership', () => {
    const startDomRuntimeLockHeartbeat = vi.fn();
    const startRuntimeTakeoverRequestListener = vi.fn();
    const shutdownRuntime = vi.fn();
    const createRuntimeLockLifecycleControl = vi.fn(() => ({
      startDomRuntimeLockHeartbeat,
      startRuntimeTakeoverRequestListener,
      shutdownRuntime,
    }));
    const setRuntimeControl = vi.fn();
    const assertRuntimeMethods = vi.fn();
    const createRuntimeState = vi.fn(() => ({
      processTimer: null,
    }));
    const createEmptyWatchHistoryCache = vi.fn(() => ({}));
    const createWatchlistCacheSnapshot = vi.fn(() => ({}));

    const runtime = getBootstrapSessionModule().createContentRuntimeBootstrapSessionRuntime({
      context: {
        windowRef: {
          __CW_WATCHLIST_CURATOR_LOADED__: {
            version: '1.0.0',
          },
          clearTimeout: vi.fn(),
          setTimeout: vi.fn((callback: () => void) => {
            callback();
            return 1;
          }),
        },
        browserRef: {
          storage: {
            local: {
              marker: 'browser-local',
            },
          },
        },
        chromeRef: {},
        setRuntimeControl,
        runtimeInstanceId: 'runtime-1',
        runtimeInstanceStartedAt: 10,
        isCurrentRuntimeActive: vi.fn(() => true),
      },
      clearStaleInjectedShell: vi.fn(),
      createRuntimeLockLifecycleControl,
    });

    const runtimeSession = runtime.createRuntimeBootstrapSession({
      bootstrapContext: {
        isWatchlistPath: vi.fn((pathname: string) => pathname.endsWith('/watchlist')),
        getWatchlistRoot: vi.fn(() => null),
        getWatchlistHeader: vi.fn(() => null),
        assertRuntimeMethods,
        bootstrapModulesRuntime: {
          runtimeStoreModule: {
            createRuntimeState,
            createEmptyWatchHistoryCache,
            createWatchlistCacheSnapshot,
          },
          runtimeLifecycleModule: {
            marker: 'lifecycle',
          },
          storageModule: {
            marker: 'storage',
          },
          runtimeConstants: {
            watchHistoryCacheVersion: 1,
            processDebounceMs: 25,
          },
          defaultSortMode: 'recentActivity',
          validSortModes: ['recentActivity'],
          sortModeControlOptions: [],
          defaultSettings: {
            cardLayout: 'portrait',
          },
        },
      },
    });

    expect(runtimeSession).not.toBeNull();
    expect(createRuntimeState).toHaveBeenCalledWith({
      defaultSettings: {
        cardLayout: 'portrait',
      },
      watchHistoryCacheVersion: 1,
    });
    expect(createRuntimeLockLifecycleControl).toHaveBeenCalledTimes(1);
    expect(startRuntimeTakeoverRequestListener).toHaveBeenCalledTimes(1);
    expect(assertRuntimeMethods).toHaveBeenCalledWith(
      'watchlist health runtime',
      expect.objectContaining({
        runCheck: expect.any(Function),
        start: expect.any(Function),
        stop: expect.any(Function),
      }),
      ['runCheck', 'start', 'stop'],
    );
    expect(setRuntimeControl).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.0.0',
        active: true,
        activeInstanceId: 'runtime-1',
      }),
    );
    expect(runtimeSession?.storageLocalArea).toEqual({
      marker: 'browser-local',
    });
    expect(runtimeSession?.isWatchlistPath).toBeTypeOf('function');
    expect((runtimeSession?.isWatchlistPath as (pathname: string) => boolean)('/watchlist')).toBe(true);
    expect(runtimeSession?.getWatchlistRoot).toBeTypeOf('function');
    expect(runtimeSession?.getWatchlistHeader).toBeTypeOf('function');
    expect(runtimeSession?.startDomRuntimeLockHeartbeat).toBe(startDomRuntimeLockHeartbeat);
    expect(createEmptyWatchHistoryCache).not.toHaveBeenCalled();
    expect(createWatchlistCacheSnapshot).not.toHaveBeenCalled();
  });
});
