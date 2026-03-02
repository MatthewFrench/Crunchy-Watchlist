import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BootstrapFinalizeRuntime = {
  processWatchlist: () => Promise<void>;
  startRouteWatcher: () => void;
  syncRoute: () => void;
  loadInitialState: () => Promise<void>;
  destroy: () => void;
  init: () => Promise<void>;
};

type RuntimeBootstrapFinalizeModule = {
  safeJsonParse: (value: unknown, fallback: unknown) => unknown;
  createStorageAccessors: (options?: Record<string, unknown>) => {
    storageGet: (key: string, fallback: unknown) => Promise<unknown>;
    storageSet: (key: string, value: unknown) => Promise<void>;
  };
  createBootstrapFinalizeRuntime: (options?: Record<string, unknown>) => BootstrapFinalizeRuntime;
};

const bootstrapFinalizeModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapFinalize.ts'),
).href;

let runtimeBootstrapFinalizeModule: RuntimeBootstrapFinalizeModule | null = null;

function getBootstrapFinalizeModule(): RuntimeBootstrapFinalizeModule {
  if (!runtimeBootstrapFinalizeModule) {
    throw new Error('Bootstrap finalize runtime module was not initialized for test');
  }

  return runtimeBootstrapFinalizeModule;
}

describe('bootstrap-finalize runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(bootstrapFinalizeModuleUrl)) as {
      createBootstrapFinalizeRuntimeModule: () => object;
    };
    runtimeBootstrapFinalizeModule = module.createBootstrapFinalizeRuntimeModule() as RuntimeBootstrapFinalizeModule;
  });

  afterEach(() => {
    runtimeBootstrapFinalizeModule = null;
    vi.restoreAllMocks();
  });

  it('parses json values with fallback behavior', () => {
    const runtime = getBootstrapFinalizeModule();

    expect(runtime.safeJsonParse('{"ok":true}', null)).toEqual({ ok: true });
    expect(runtime.safeJsonParse('{invalid', 'fallback')).toBe('fallback');
    expect(runtime.safeJsonParse(null, 'fallback')).toBe('fallback');
  });

  it('creates storage accessors that delegate to a storage adapter', async () => {
    const runtime = getBootstrapFinalizeModule();
    const get = vi.fn(async (_key: string, fallback: unknown) => fallback);
    const set = vi.fn(async () => {});
    const storage = runtime.createStorageAccessors({
      storageAdapter: {
        get,
        set,
      },
    });

    await storage.storageGet('settings', { enabled: true });
    await storage.storageSet('settings', { enabled: false });

    expect(get).toHaveBeenCalledWith('settings', { enabled: true });
    expect(set).toHaveBeenCalledWith('settings', { enabled: false });
  });

  it('wires lifecycle + state-loader delegates and exposes debug api on init', async () => {
    const runtimeModule = getBootstrapFinalizeModule();
    const processWatchlist = vi.fn(async () => {});
    const startRouteWatcher = vi.fn(() => {});
    const syncRoute = vi.fn(() => {});
    const loadInitialState = vi.fn(async () => {});
    const runtimeEvent = vi.fn();
    const windowRef: Record<string, unknown> = {};

    const runtime = runtimeModule.createBootstrapFinalizeRuntime({
      windowRef,
      runtimeEvent,
      runtimeLifecycleModule: {
        createRouteLifecycle: () => ({
          processWatchlist,
          startRouteWatcher,
          syncRoute,
        }),
      },
      runtimeLifecycleOptions: {},
      loadInitialState,
      listKnownSeries: () => ['SERIES_A'],
      getCuratedDomStats: () => ({
        identityChurnRate: 0.1,
      }),
      dumpSeriesApiData: (query: unknown) => ({
        query,
      }),
      printSeriesApiData: (query: unknown) => ({
        query,
        printed: true,
      }),
    });

    await runtime.processWatchlist();
    runtime.startRouteWatcher();
    runtime.syncRoute();
    await runtime.loadInitialState();
    runtime.destroy();
    await runtime.init();

    expect(processWatchlist).toHaveBeenCalledTimes(2);
    expect(startRouteWatcher).toHaveBeenCalledTimes(2);
    expect(syncRoute).toHaveBeenCalledTimes(2);
    expect(loadInitialState).toHaveBeenCalledTimes(2);
    expect(runtimeEvent).toHaveBeenCalledWith('init-start');
    expect(runtimeEvent).toHaveBeenCalledWith('init-done');

    const debugApi = windowRef.__CW_WATCHLIST_CURATOR_DEBUG__ as Record<string, unknown>;
    expect((debugApi.listSeries as () => unknown[])()).toEqual(['SERIES_A']);
    expect((debugApi.getCuratedDomStats as () => unknown)()).toEqual({
      identityChurnRate: 0.1,
    });
    expect((debugApi.dumpSeriesApiData as (query: string) => unknown)('series')).toEqual({ query: 'series' });
    expect((debugApi.printSeriesApiData as (query: string) => unknown)('series')).toEqual({
      query: 'series',
      printed: true,
    });
  });

  it('calls route lifecycle teardown delegates during destroy', () => {
    const runtimeModule = getBootstrapFinalizeModule();
    const stopRouteWatcher = vi.fn(() => {});
    const stopObserver = vi.fn(() => {});
    const unmount = vi.fn(() => {});

    const runtime = runtimeModule.createBootstrapFinalizeRuntime({
      runtimeLifecycleModule: {
        createRouteLifecycle: () => ({
          processWatchlist: async () => {},
          startRouteWatcher: () => {},
          stopRouteWatcher,
          syncRoute: () => {},
          stopObserver,
          unmount,
        }),
      },
      runtimeLifecycleOptions: {},
    });

    runtime.destroy();

    expect(stopRouteWatcher).toHaveBeenCalledTimes(1);
    expect(stopObserver).toHaveBeenCalledTimes(1);
    expect(unmount).toHaveBeenCalledTimes(1);
  });
});
