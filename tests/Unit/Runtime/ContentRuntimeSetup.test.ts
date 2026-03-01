import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ContentRuntimeSetupResult = {
  ok: boolean;
  [key: string]: unknown;
};

type ContentRuntimeSetupModule = {
  createContentRuntimeSetup: (options?: Record<string, unknown>) => ContentRuntimeSetupResult;
};

const contentRuntimeSetupModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentRuntimeSetup.ts'),
).href;

async function getContentRuntimeSetupModule(): Promise<ContentRuntimeSetupModule> {
  return (await import(contentRuntimeSetupModuleUrl)) as ContentRuntimeSetupModule;
}

describe('content-runtime-setup runtime', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses extracted data-initialization runtime and setup-composition runtime in the expected sequence', async () => {
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

    const runtimeSetupModule = await getContentRuntimeSetupModule();
    const result = runtimeSetupModule.createContentRuntimeSetup({
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
      getWatchlistRoot: vi.fn(() => null),
      getWatchlistHeader: vi.fn(() => null),
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

  it('fails fast when setup composition module dependency is missing', async () => {
    const runtimeSetupModule = await getContentRuntimeSetupModule();
    const result = runtimeSetupModule.createContentRuntimeSetup({
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
      getWatchlistRoot: vi.fn(() => null),
      getWatchlistHeader: vi.fn(() => null),
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain(
      'Missing content runtime setup dependency: createContentRuntimeSetupCompositionRuntime',
    );
  });

  it('fails fast when data initialization module dependency is missing', async () => {
    const runtimeSetupModule = await getContentRuntimeSetupModule();
    const result = runtimeSetupModule.createContentRuntimeSetup({
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
      getWatchlistRoot: vi.fn(() => null),
      getWatchlistHeader: vi.fn(() => null),
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain(
      'Missing content runtime setup dependency: createContentRuntimeSetupDataInitializationRuntime',
    );
  });
});
