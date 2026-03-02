import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RuntimeBootstrapFinalizeFlowRuntime = {
  createBootstrapFinalizeRuntimeOptions: (
    context: { isCurrentRuntimeActive: () => boolean },
    options: Record<string, unknown>,
  ) => Record<string, unknown>;
  bindBootstrapFinalizeRuntimeMethods: (options: {
    bootstrapFinalizeRuntime: Record<string, unknown>;
    disposeRuntimeSetup?: (() => void) | null;
    setProcessWatchlist: (nextProcessWatchlist: (...args: unknown[]) => unknown) => void;
    setSyncRouteRuntime: (nextSyncRouteRuntime: (...args: unknown[]) => unknown) => void;
    setDestroyRuntime: (nextDestroyRuntime: (...args: unknown[]) => unknown) => void;
    setBootstrapIssue: (reason: string, payload?: Record<string, unknown>) => void;
    clearStaleInjectedShell: (reason: string) => void;
  }) => boolean;
  runBootstrapFinalizeInitFlow: (options: {
    bootstrapFinalizeRuntime: Record<string, unknown>;
    updateDiagnostics: (payload: Record<string, unknown>) => void;
    startDomRuntimeLockHeartbeat: () => void;
    startWatchlistHealthRuntime: () => void;
    runtimeEvent: (event: string, payload?: Record<string, unknown>) => void;
    setBootstrapIssue: (reason: string, payload?: Record<string, unknown>) => void;
    shutdownRuntime: (payload?: Record<string, unknown>) => void;
    clearStaleInjectedShell: (reason: string) => void;
  }) => void;
};

type RuntimeBootstrapFinalizeFlowModule = {
  createContentRuntimeBootstrapFinalizeFlowRuntime: () => RuntimeBootstrapFinalizeFlowRuntime;
};

const contentRuntimeBootstrapFinalizeFlowModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentRuntimeBootstrapFinalizeFlow.ts'),
).href;

async function flushMicrotasks(iterations = 4): Promise<void> {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

async function getRuntimeBootstrapFinalizeFlowRuntime(): Promise<RuntimeBootstrapFinalizeFlowRuntime> {
  const module = (await import(contentRuntimeBootstrapFinalizeFlowModuleUrl)) as RuntimeBootstrapFinalizeFlowModule;
  return module.createContentRuntimeBootstrapFinalizeFlowRuntime();
}

describe('content-runtime-bootstrap-finalize-flow runtime', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds runtime lifecycle options and an explicit loadInitialState callback', async () => {
    const runtime = await getRuntimeBootstrapFinalizeFlowRuntime();
    const runtimeEvent = vi.fn();
    const storageGet = vi.fn(async (_key: string, fallback: unknown) => fallback);

    const options = runtime.createBootstrapFinalizeRuntimeOptions(
      {
        isCurrentRuntimeActive: () => true,
      },
      {
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
        runtimeEvent,
        runtimeLifecycleModule: {
          marker: 'lifecycle',
        },
        isWatchlistPath: vi.fn(),
        ensureInterface: vi.fn(),
        applyTabUi: vi.fn(),
        ensureCuratedDataLoad: vi.fn(),
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
        defaultSettings: {},
        validSortModes: ['recentActivity'],
        defaultSortMode: 'recentActivity',
        runtimeConstants: {
          settingsKey: 'settings',
          ratingCacheKey: 'rating-cache',
          watchHistoryCacheKey: 'watch-history-cache',
          watchlistCacheKey: 'watchlist-cache',
        },
        listKnownSeries: vi.fn(),
        getCuratedDomStats: vi.fn(() => ({ identityChurnRate: 0 })),
        dumpSeriesApiData: vi.fn(),
        printSeriesApiData: vi.fn(),
      },
    );

    expect(options.runtimeLifecycleOptions).toEqual(
      expect.objectContaining({
        isRuntimeActive: expect.any(Function),
        ensureInterface: expect.any(Function),
      }),
    );
    expect((options.runtimeLifecycleOptions as { isRuntimeActive: () => boolean }).isRuntimeActive()).toBe(true);
    expect(options.loadInitialState).toBeTypeOf('function');

    await (options.loadInitialState as () => Promise<void>)();
    expect(storageGet).toHaveBeenNthCalledWith(1, 'settings', {});
    expect(storageGet).toHaveBeenNthCalledWith(2, 'rating-cache', {});
    expect(storageGet).toHaveBeenNthCalledWith(3, 'watch-history-cache', null);
    expect(storageGet).toHaveBeenNthCalledWith(4, 'watchlist-cache', null);
    expect(runtimeEvent).toHaveBeenCalledWith('state-load-done', {
      tab: undefined,
      cachedCurated: 0,
    });
  });

  it('returns false and marks bootstrap issue when init method is missing', async () => {
    const runtime = await getRuntimeBootstrapFinalizeFlowRuntime();
    const setBootstrapIssue = vi.fn();
    const clearStaleInjectedShell = vi.fn();

    const result = runtime.bindBootstrapFinalizeRuntimeMethods({
      bootstrapFinalizeRuntime: {
        processWatchlist: vi.fn(),
      },
      setProcessWatchlist: vi.fn(),
      setSyncRouteRuntime: vi.fn(),
      setDestroyRuntime: vi.fn(),
      setBootstrapIssue,
      clearStaleInjectedShell,
    });

    expect(result).toBe(false);
    expect(setBootstrapIssue).toHaveBeenCalledWith('missing-bootstrap-finalize-runtime');
    expect(clearStaleInjectedShell).toHaveBeenCalledWith('missing-bootstrap-finalize-runtime');
  });

  it('handles init failure by emitting runtime diagnostics and shutdown payload', async () => {
    const runtime = await getRuntimeBootstrapFinalizeFlowRuntime();
    const updateDiagnostics = vi.fn();
    const runtimeEvent = vi.fn();
    const setBootstrapIssue = vi.fn();
    const shutdownRuntime = vi.fn();
    const clearStaleInjectedShell = vi.fn();

    runtime.runBootstrapFinalizeInitFlow({
      bootstrapFinalizeRuntime: {
        init: vi.fn(async () => {
          throw new Error('init failed');
        }),
      },
      updateDiagnostics,
      startDomRuntimeLockHeartbeat: vi.fn(),
      startWatchlistHealthRuntime: vi.fn(),
      runtimeEvent,
      setBootstrapIssue,
      shutdownRuntime,
      clearStaleInjectedShell,
    });

    await flushMicrotasks();

    expect(updateDiagnostics).toHaveBeenCalledWith({
      ok: false,
      stage: 'init-started',
    });
    expect(runtimeEvent).toHaveBeenCalledWith('init-error', {
      message: 'init failed',
    });
    expect(setBootstrapIssue).toHaveBeenCalledWith('init-error', {
      message: 'init failed',
    });
    expect(shutdownRuntime).toHaveBeenCalledWith({
      reason: 'init-error',
      message: 'init failed',
    });
    expect(clearStaleInjectedShell).toHaveBeenCalledWith('init-error');
  });

  it('chains runtime setup disposal into destroy runtime wiring', async () => {
    const runtime = await getRuntimeBootstrapFinalizeFlowRuntime();
    let destroyRuntimeHandler: (() => void) | null = null;
    const destroyFinalizeRuntime = vi.fn();
    const disposeRuntimeSetup = vi.fn();

    const result = runtime.bindBootstrapFinalizeRuntimeMethods({
      bootstrapFinalizeRuntime: {
        init: vi.fn(async () => undefined),
        destroy: destroyFinalizeRuntime,
      },
      disposeRuntimeSetup,
      setProcessWatchlist: vi.fn(),
      setSyncRouteRuntime: vi.fn(),
      setDestroyRuntime: (handler) => {
        destroyRuntimeHandler = handler as () => void;
      },
      setBootstrapIssue: vi.fn(),
      clearStaleInjectedShell: vi.fn(),
    });

    expect(result).toBe(true);
    if (typeof destroyRuntimeHandler !== 'function') {
      throw new Error('Expected setDestroyRuntime to receive a destroy handler');
    }
    (destroyRuntimeHandler as () => void)();
    expect(destroyFinalizeRuntime).toHaveBeenCalledTimes(1);
    expect(disposeRuntimeSetup).toHaveBeenCalledTimes(1);
  });
});
