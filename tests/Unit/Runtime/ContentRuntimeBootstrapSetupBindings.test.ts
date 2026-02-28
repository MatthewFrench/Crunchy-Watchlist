import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type RuntimeSetupBindingsRuntime = {
  createRuntimeSetupOptions: (options: Record<string, unknown>) => Record<string, unknown>;
  applyRuntimeSetupBindings: (options: {
    runtimeSetupResult: Record<string, unknown>;
    setRuntimeEvent: (nextRuntimeEvent: (...args: unknown[]) => unknown) => void;
    setRuntimeSetupBindings: (runtimeSetupBindings: Record<string, unknown>) => void;
  }) => void;
};

type RuntimeSetupBindingsModule = {
  runtimeContentRuntimeBootstrapSetupBindings: {
    createContentRuntimeBootstrapSetupBindingsRuntime: () => RuntimeSetupBindingsRuntime;
  };
};

const setupBindingsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentRuntimeBootstrapSetupBindings.ts'),
).href;

function getRuntimeSetupBindingsRuntime(): RuntimeSetupBindingsRuntime {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as RuntimeSetupBindingsModule;
  return registry.runtimeContentRuntimeBootstrapSetupBindings.createContentRuntimeBootstrapSetupBindingsRuntime();
}

describe('content-runtime-bootstrap-setup-bindings runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([setupBindingsModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
    vi.restoreAllMocks();
  });

  it('builds runtime setup options with module bindings and runtime dependencies', () => {
    const runtime = getRuntimeSetupBindingsRuntime();
    const runtimeSetupOptions = runtime.createRuntimeSetupOptions({
      windowRef: { document: {} },
      state: { mounted: false },
      runtimeConstants: { settingsKey: 'settings' },
      assertRuntimeMethods: vi.fn(),
      runtimeBootstrapHelpersModule: { marker: 'helpers' },
      defaultSettings: { cardLayout: 'portrait' },
      defaultSortMode: 'recentActivity',
      validSortModes: ['recentActivity'],
      sortModeControlOptions: [{ label: 'Recent Activity', value: 'recentActivity' }],
      storageLocalArea: { get: vi.fn() },
      isWatchlistPath: vi.fn(),
      getWatchlistRoot: vi.fn(() => null),
      getWatchlistHeader: vi.fn(() => null),
      debounceProcess: vi.fn(),
      createEmptyWatchHistoryCache: vi.fn(),
      createWatchlistCacheSnapshot: vi.fn(),
      bootstrapModulesRuntime: {
        runtimeTraceModule: { marker: 'trace' },
        runtimePreferredAudioModule: { marker: 'preferred-audio' },
        storageModule: { marker: 'storage' },
        runtimeCuratedLoaderModule: { marker: 'loader' },
        runtimeDebugModule: { marker: 'debug' },
      },
    });

    expect(runtimeSetupOptions.runtimeTraceModule).toEqual({ marker: 'trace' });
    expect(runtimeSetupOptions.runtimePreferredAudioModule).toEqual({ marker: 'preferred-audio' });
    expect(runtimeSetupOptions.storageModule).toEqual({ marker: 'storage' });
    expect(runtimeSetupOptions.runtimeCuratedLoaderModule).toEqual({ marker: 'loader' });
    expect(runtimeSetupOptions.runtimeDebugModule).toEqual({ marker: 'debug' });
    expect(runtimeSetupOptions.defaultSortMode).toBe('recentActivity');
    expect(runtimeSetupOptions.defaultSettings).toEqual({ cardLayout: 'portrait' });
    expect(runtimeSetupOptions.getWatchlistRoot).toBeTypeOf('function');
    expect(runtimeSetupOptions.getWatchlistHeader).toBeTypeOf('function');
    expect(runtimeSetupOptions.createWatchlistCacheSnapshot).toBeTypeOf('function');
  });

  it('applies runtime setup bindings using known keys and ignores unexpected fields', () => {
    const runtime = getRuntimeSetupBindingsRuntime();
    const runtimeEvent = vi.fn();
    const setRuntimeEvent = vi.fn();
    const setRuntimeSetupBindings = vi.fn();

    runtime.applyRuntimeSetupBindings({
      runtimeSetupResult: {
        runtimeEvent,
        getAccessToken: vi.fn(),
        ensureCuratedDataLoad: vi.fn(),
        setWatchlistCacheRows: vi.fn(),
        extraField: 'ignored',
      },
      setRuntimeEvent,
      setRuntimeSetupBindings,
    });

    expect(setRuntimeEvent).toHaveBeenCalledWith(runtimeEvent);
    expect(setRuntimeSetupBindings).toHaveBeenCalledTimes(1);

    const runtimeSetupBindings = setRuntimeSetupBindings.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(runtimeSetupBindings.runtimeEvent).toBe(runtimeEvent);
    expect(runtimeSetupBindings.getAccessToken).toBeTypeOf('function');
    expect(runtimeSetupBindings.ensureCuratedDataLoad).toBeTypeOf('function');
    expect(runtimeSetupBindings.setWatchlistCacheRows).toBeTypeOf('function');
    expect(runtimeSetupBindings.extraField).toBeUndefined();
  });
});
