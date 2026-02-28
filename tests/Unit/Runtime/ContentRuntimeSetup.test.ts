import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type ContentRuntimeSetupResult = {
  ok: boolean;
  [key: string]: unknown;
};

type ContentRuntimeSetupModule = {
  runtimeContentRuntimeSetup: {
    createContentRuntimeSetup: (options?: Record<string, unknown>) => ContentRuntimeSetupResult;
  };
};

const contentRuntimeSetupModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentRuntimeSetup.ts'),
).href;

function getContentRuntimeSetupModule() {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as ContentRuntimeSetupModule;
  return registry.runtimeContentRuntimeSetup;
}

describe('content-runtime-setup runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([contentRuntimeSetupModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
    vi.restoreAllMocks();
  });

  it('uses extracted data-initialization runtime and setup-composition runtime in the expected sequence', () => {
    const executionOrder: string[] = [];
    const storageSet = vi.fn();
    const initializeCompositionBinding = vi.fn(() => {
      executionOrder.push('setup-composition-initialize-binding');
    });
    const buildContentRuntimeSetupSuccess = vi.fn(() => {
      executionOrder.push('setup-composition-build-success');
      return {
        ok: true,
        marker: 'setup-success',
      };
    });
    const initializeTraceAndContracts = vi.fn(() => {
      executionOrder.push('data-initialize-trace-and-contracts');
      return {
        corePrimitives: {
          parseDateMs: vi.fn(),
        },
        apiContracts: {},
      };
    });
    const initializePreferredAudioAndStorage = vi.fn(() => {
      executionOrder.push('data-initialize-preferred-audio-storage');
      return {
        storageSet,
      };
    });
    const initializeAuthImageAndRatings = vi.fn(() => {
      executionOrder.push('data-initialize-auth-image-ratings');
    });
    const initializeWatchlistHistoryAndPreview = vi.fn(() => {
      executionOrder.push('data-initialize-watchlist-history-preview');
    });
    const createContentRuntimeSetupCompositionRuntime = vi.fn(() => ({
      initializeCompositionBinding,
      buildContentRuntimeSetupSuccess,
    }));
    const createContentRuntimeSetupDataInitializationRuntime = vi.fn(() => ({
      initializeTraceAndContracts,
      initializePreferredAudioAndStorage,
      initializeAuthImageAndRatings,
      initializeWatchlistHistoryAndPreview,
    }));

    const result = getContentRuntimeSetupModule().createContentRuntimeSetup({
      windowRef: {
        document: {},
      },
      state: {},
      runtimeConstants: {},
      assertRuntimeMethods: vi.fn(),
      createContentRuntimeSetupCompositionRuntime,
      createContentRuntimeSetupDataInitializationRuntime,
      isWatchlistPath: vi.fn(),
      debounceProcess: vi.fn(),
      createEmptyWatchHistoryCache: vi.fn(() => ({})),
      createWatchlistCacheSnapshot: vi.fn(() => ({})),
      defaultSettings: {},
      defaultSortMode: 'recentActivity',
      validSortModes: ['recentActivity'],
      sortModeControlOptions: [],
    });

    expect(result).toEqual({
      ok: true,
      marker: 'setup-success',
    });
    expect(createContentRuntimeSetupCompositionRuntime).toHaveBeenCalledTimes(1);
    expect(createContentRuntimeSetupDataInitializationRuntime).toHaveBeenCalledTimes(1);
    expect(initializeCompositionBinding).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        parseDateMs: expect.any(Function),
      }),
      storageSet,
    );
    expect(initializeTraceAndContracts).toHaveBeenCalledTimes(1);
    expect(initializePreferredAudioAndStorage).toHaveBeenCalledTimes(1);
    expect(initializeAuthImageAndRatings).toHaveBeenCalledTimes(1);
    expect(initializeWatchlistHistoryAndPreview).toHaveBeenCalledTimes(1);
    expect(executionOrder).toEqual([
      'data-initialize-trace-and-contracts',
      'data-initialize-preferred-audio-storage',
      'data-initialize-auth-image-ratings',
      'data-initialize-watchlist-history-preview',
      'setup-composition-initialize-binding',
      'setup-composition-build-success',
    ]);
  });

  it('fails fast when setup composition module dependency is missing', () => {
    const result = getContentRuntimeSetupModule().createContentRuntimeSetup({
      windowRef: {
        document: {},
      },
      state: {},
      runtimeConstants: {},
      assertRuntimeMethods: vi.fn(),
      createContentRuntimeSetupCompositionRuntime: 'invalid-factory',
      isWatchlistPath: vi.fn(),
      debounceProcess: vi.fn(),
      createEmptyWatchHistoryCache: vi.fn(() => ({})),
      createWatchlistCacheSnapshot: vi.fn(() => ({})),
      defaultSettings: {},
      defaultSortMode: 'recentActivity',
      validSortModes: ['recentActivity'],
      sortModeControlOptions: [],
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain(
      'Missing content runtime setup dependency: createContentRuntimeSetupCompositionRuntime',
    );
  });

  it('fails fast when data initialization module dependency is missing', () => {
    const result = getContentRuntimeSetupModule().createContentRuntimeSetup({
      windowRef: {
        document: {},
      },
      state: {},
      runtimeConstants: {},
      assertRuntimeMethods: vi.fn(),
      createContentRuntimeSetupDataInitializationRuntime: 'invalid-factory',
      isWatchlistPath: vi.fn(),
      debounceProcess: vi.fn(),
      createEmptyWatchHistoryCache: vi.fn(() => ({})),
      createWatchlistCacheSnapshot: vi.fn(() => ({})),
      defaultSettings: {},
      defaultSortMode: 'recentActivity',
      validSortModes: ['recentActivity'],
      sortModeControlOptions: [],
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain(
      'Missing content runtime setup dependency: createContentRuntimeSetupDataInitializationRuntime',
    );
  });
});
