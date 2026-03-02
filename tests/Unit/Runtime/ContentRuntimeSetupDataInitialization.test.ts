import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type TraceContractsRuntime = {
  corePrimitives: Record<string, unknown>;
  apiContracts: Record<string, unknown>;
};

type StorageRuntime = {
  storageSet: (key: string, value: unknown) => unknown;
};

type DataInitializationRuntime = {
  initializeTraceAndContracts: (
    context: Record<string, unknown>,
    bindings: Record<string, unknown>,
  ) => TraceContractsRuntime;
  initializePreferredAudioAndStorage: (
    context: Record<string, unknown>,
    bindings: Record<string, unknown>,
    traceContractsRuntime: TraceContractsRuntime,
  ) => StorageRuntime;
  initializeAuthImageAndRatings: (
    context: Record<string, unknown>,
    bindings: Record<string, unknown>,
    traceContractsRuntime: TraceContractsRuntime,
  ) => void;
  initializeWatchlistHistoryAndPreview: (
    context: Record<string, unknown>,
    bindings: Record<string, unknown>,
    traceContractsRuntime: TraceContractsRuntime,
  ) => void;
};

type DataInitializationModule = {
  createContentRuntimeSetupDataInitializationRuntime: (options?: unknown) => DataInitializationRuntime;
};

const dataInitializationModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentRuntimeSetupDataInitialization.ts'),
).href;

async function getDataInitializationRuntime(options: Record<string, unknown> = {}): Promise<DataInitializationRuntime> {
  const module = (await import(dataInitializationModuleUrl)) as DataInitializationModule;
  return module.createContentRuntimeSetupDataInitializationRuntime(options);
}

describe('content-runtime-setup-data-initialization runtime', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes trace/contracts and preferred-audio/storage owners and binds bootstrap helpers', async () => {
    const storageSet = vi.fn();
    const runtimeEvent = vi.fn();
    const pushApiTrace = vi.fn();
    const detectPreferredAudioLanguage = vi.fn(() => 'en-US');
    const createRuntimeTrace = vi.fn(() => ({
      runtimeEvent,
      pushApiTrace,
    }));
    const createCorePrimitives = vi.fn(() => ({
      parseDateMs: vi.fn(),
      getWatchlistSeriesId: vi.fn(),
      getWatchHistorySeriesId: vi.fn(),
      normalizeAudioLocale: vi.fn((value: unknown) => value),
    }));
    const createApiContracts = vi.fn(() => ({
      shouldRetryStatus: vi.fn(),
      requirePayloadDataArray: vi.fn(),
      parsePayloadDataEnvelope: vi.fn((endpoint: unknown, payload: unknown) => ({
        endpoint,
        rows: Array.isArray((payload as Record<string, unknown>)?.data)
          ? ((payload as Record<string, unknown>).data as unknown[])
          : [],
        total: null,
      })),
      resolveApiHref: vi.fn((pathWithQuery: string) => `https://api.crunchyroll.test${pathWithQuery}`),
    }));
    const createPreferredAudioDetector = vi.fn(() => ({
      detectPreferredAudioLanguage,
    }));
    const createStorageAdapter = vi.fn(() => ({}));
    const createStorageAccessors = vi.fn(() => ({
      storageSet,
    }));
    const createBootstrapHelpersRuntime = vi.fn(() => ({
      scheduleSaveRatings: vi.fn(),
      scheduleSaveWatchHistory: vi.fn(),
      scheduleSaveWatchlistCache: vi.fn(),
      getPreferredAudioLanguage: vi.fn(() => 'en-US'),
      preloadRatingsForSelectedAudioLocale: vi.fn(async () => null),
      preloadWatchHistoryForSelectedAudioLocale: vi.fn(async () => null),
      toggleCuratedFavorite: vi.fn(async () => true),
      removeCuratedSeries: vi.fn(async () => true),
      isLikelyVideoUrl: vi.fn(() => true),
      isEntryWatchReady: vi.fn(() => true),
      withMutedObserver: vi.fn((callback: () => unknown) => callback()),
      applyCardLayoutUi: vi.fn(),
      persistSettings: vi.fn(),
    }));
    const runtimeBootstrapFinalizeModule = {
      safeJsonParse: vi.fn((value: unknown, fallback: unknown) => {
        if (typeof value !== 'string') {
          return fallback;
        }
        try {
          return JSON.parse(value);
        } catch {
          return fallback;
        }
      }),
      createStorageAccessors,
    };
    const runtime = await getDataInitializationRuntime({
      runtimeBootstrapFinalizeModule,
      runtimeBootstrapHelpersModule: {
        createBootstrapHelpersRuntime,
      },
    });

    const context = {
      windowRef: {
        navigator: {},
        document: {},
        localStorage: {},
      },
      state: {},
      storageLocalArea: {},
      runtimeConstants: {
        apiTraceLimitPerEndpoint: 40,
        fetchBackoffBaseMs: 10,
        fetchBackoffJitterMs: 5,
        preferredAudioStorageScanLimit: 80,
        preferredAudioValueScanLimit: 120,
        settingsKey: 'settings',
        ratingCacheKey: 'ratings',
        watchHistoryCacheKey: 'history',
        watchlistCacheKey: 'watchlist',
        preferredAudioCacheTtlMs: 60_000,
      },
      assertRuntimeMethods: vi.fn(),
      runtimeTraceModule: {
        createRuntimeTrace,
      },
      corePrimitivesModule: {
        createCorePrimitives,
      },
      apiContractsModule: {
        createApiContracts,
      },
      runtimePreferredAudioModule: {
        createPreferredAudioDetector,
      },
      storageModule: {
        createStorageAdapter,
      },
    };
    const bindings: Record<string, unknown> = {
      extractCoverImagesFromApiImages: vi.fn(),
      isLocalizedRatingDataMissingForEntries: vi.fn(() => false),
      isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => false),
      getAccessToken: vi.fn(async () => ({ accessToken: 'token' })),
      preloadRatingsForEntries: vi.fn(async () => null),
      preloadWatchHistoryForEntries: vi.fn(async () => null),
    };

    const traceContractsRuntime = runtime.initializeTraceAndContracts(context, bindings);
    const storageRuntime = runtime.initializePreferredAudioAndStorage(context, bindings, traceContractsRuntime);
    storageRuntime.storageSet('settings', { cardLayout: 'portrait' });

    expect(createRuntimeTrace).toHaveBeenCalledTimes(1);
    expect(createCorePrimitives).toHaveBeenCalledTimes(1);
    expect(createApiContracts).toHaveBeenCalledTimes(1);
    expect(bindings.runtimeEvent).toBe(runtimeEvent);
    expect(bindings.pushApiTrace).toBe(pushApiTrace);
    expect(bindings.resolveApiHref).toBeTypeOf('function');
    expect(createPreferredAudioDetector).toHaveBeenCalledTimes(1);
    expect(createStorageAdapter).toHaveBeenCalledTimes(1);
    expect(createStorageAccessors).toHaveBeenCalledTimes(1);
    expect(createBootstrapHelpersRuntime).toHaveBeenCalledTimes(1);
    expect(storageSet).toHaveBeenCalledWith('settings', { cardLayout: 'portrait' });
    expect(bindings.getPreferredAudioLanguage).toBeTypeOf('function');
    expect(bindings.scheduleSaveWatchlistCache).toBeTypeOf('function');
    expect((bindings.detectPreferredAudioLanguage as () => string)()).toBe('en-US');
  });

  it('initializes auth/image/ratings and watchlist/history/preview owners', async () => {
    const runtime = await getDataInitializationRuntime();
    const createAuthClient = vi.fn(() => ({
      fetchWithResilience: vi.fn(),
      getAccessToken: vi.fn(async () => ({ accountId: 'account-1', accessToken: 'token' })),
      createAuthRefreshHandler: vi.fn(() => 'refresh-handler'),
    }));
    const createImageVariants = vi.fn(() => ({
      normalizeImageUrlCandidate: vi.fn((value: unknown) => String(value ?? '')),
      extractCoverImagesFromApiImages: vi.fn(() => []),
      extractThumbnailImageFromApiImages: vi.fn(() => null),
    }));
    const createRatingsClient = vi.fn(() => ({
      fetchRatingsBatch: vi.fn(async () => []),
      fetchRating: vi.fn(async () => null),
    }));
    const createRatingsRepository = vi.fn(() => ({
      getSeriesRating: vi.fn(() => null),
      preloadRatingsForEntries: vi.fn(async () => null),
      getCachedRating: vi.fn(() => null),
      isLocalizedRatingDataMissingForEntries: vi.fn(() => false),
    }));
    const createWatchlistClient = vi.fn(() => ({
      fetchAllWatchlistRows: vi.fn(async () => []),
    }));
    const createWatchlistRepository = vi.fn(() => ({
      normalizeStoredWatchlistCache: vi.fn((value: unknown) => value),
      isWatchlistCacheValid: vi.fn(() => true),
      resetWatchlistCacheOnAccountMismatch: vi.fn(),
      setWatchlistCacheRows: vi.fn(),
    }));
    const createHistoryRepository = vi.fn(() => ({
      normalizeStoredWatchHistoryCache: vi.fn((value: unknown) => value),
      isWatchHistoryCacheValid: vi.fn(() => true),
      getCachedWatchHistory: vi.fn(() => null),
      getCachedWatchHistoryProgress: vi.fn(() => null),
      preloadWatchHistoryForEntries: vi.fn(async () => null),
      isLocalizedWatchHistoryDataMissingForEntries: vi.fn(() => false),
    }));
    const createPreviewRepository = vi.fn(() => ({
      fetchPreviewUrlForEntry: vi.fn(async () => null),
    }));

    const context = {
      windowRef: {
        navigator: {},
        document: {},
        localStorage: {},
        crypto: {},
        fetch: vi.fn(async () => new Response(null, { status: 200 })),
      },
      state: {},
      createWatchlistCacheSnapshot: vi.fn(() => ({})),
      createEmptyWatchHistoryCache: vi.fn(() => ({})),
      runtimeConstants: {
        fetchTimeoutMs: 2_500,
        fetchMaxAttempts: 3,
        authTokenSkewMs: 20_000,
        authClientBasic: 'client-basic',
        authDeviceKey: 'device-key',
        ratingBatchSize: 20,
        ratingBatchParallelChunks: 2,
        ratingCacheTtlMs: 60_000,
        watchlistPageSize: 30,
        watchlistMaxPages: 20,
        watchlistParallelRequests: 2,
        watchlistCacheTtlMs: 90_000,
        watchHistoryCacheVersion: 2,
        watchHistoryCacheTtlMs: 120_000,
        watchHistoryPageSize: 50,
        watchHistoryMaxPages: 40,
        watchHistoryNoMatchPageLimit: 5,
      },
      assertRuntimeMethods: vi.fn(),
      authClientModule: {
        createAuthClient,
      },
      imageVariantsModule: {
        createImageVariants,
      },
      ratingsClientModule: {
        createRatingsClient,
      },
      ratingsRepositoryModule: {
        createRatingsRepository,
      },
      watchlistClientModule: {
        createWatchlistClient,
      },
      watchlistRepositoryModule: {
        createWatchlistRepository,
      },
      historyRepositoryModule: {
        createHistoryRepository,
      },
      previewRepositoryModule: {
        createPreviewRepository,
      },
    };
    const bindings: Record<string, unknown> = {
      runtimeEvent: vi.fn(),
      pushApiTrace: vi.fn(),
      resolveApiHref: vi.fn((pathWithQuery: string) => `https://api.crunchyroll.test${pathWithQuery}`),
      getPreferredAudioLanguage: vi.fn(() => 'en-US'),
      scheduleSaveRatings: vi.fn(),
      scheduleSaveWatchlistCache: vi.fn(),
      scheduleSaveWatchHistory: vi.fn(),
      fetchWithResilience: vi.fn(),
      getAccessToken: vi.fn(),
      createAuthRefreshHandler: vi.fn(() => 'refresh-handler'),
      normalizeImageUrlCandidate: vi.fn((value: unknown) => String(value ?? '')),
    };
    const traceContractsRuntime: TraceContractsRuntime = {
      corePrimitives: {
        sanitizePositiveInt: vi.fn((value: unknown) => Number(value) || 0),
        normalizeAudioLocale: vi.fn((value: unknown) => (typeof value === 'string' ? value : null)),
        normalizeAudioLocales: vi.fn((value: unknown) => (Array.isArray(value) ? value : [])),
        normalizeTagList: vi.fn((value: unknown) => (Array.isArray(value) ? value : [])),
        getAudioLocaleCountFromMap: vi.fn(() => 0),
        mergeAudioLocaleCountMap: vi.fn(),
        chunkArray: vi.fn((values: unknown[]) => [values]),
        parseCmsObjectRecord: vi.fn((value: unknown) => value),
        parseRatingPayload: vi.fn((value: unknown) => value),
        sanitizeRating: vi.fn((value: unknown) => value),
        sanitizeVotes: vi.fn((value: unknown) => value),
        getWatchlistSeriesId: vi.fn((value: unknown) => value),
        parseDateMs: vi.fn((value: unknown) => value),
        pickFirstPositiveInt: vi.fn(() => 1),
        deriveCanonicalEpisodeKeyFromEpisodeMetadata: vi.fn(() => 'episode-key'),
        getAbsoluteEpisodeNumberFromEpisodeMetadata: vi.fn(() => 1),
      },
      apiContracts: {
        shouldRetryStatus: vi.fn(() => false),
        computeFetchRetryDelayMs: vi.fn(() => 0),
        sleep: vi.fn(async () => null),
        getLocale: vi.fn(() => 'en-US'),
        requirePayloadDataArray: vi.fn((value: unknown) => value),
        parsePayloadDataEnvelope: vi.fn((_endpoint: unknown, payload: unknown) => ({
          rows: Array.isArray((payload as Record<string, unknown>)?.data)
            ? ((payload as Record<string, unknown>).data as unknown[])
            : [],
          total: null,
        })),
        auditCmsObjectContract: vi.fn(),
        auditWatchlistRowsContract: vi.fn(),
        auditWatchHistoryRowsContract: vi.fn(),
      },
    };

    runtime.initializeAuthImageAndRatings(context, bindings, traceContractsRuntime);
    runtime.initializeWatchlistHistoryAndPreview(context, bindings, traceContractsRuntime);

    expect(createAuthClient).toHaveBeenCalledTimes(1);
    expect(createImageVariants).toHaveBeenCalledTimes(1);
    expect(createRatingsClient).toHaveBeenCalledTimes(1);
    expect(createRatingsRepository).toHaveBeenCalledTimes(1);
    expect(bindings.getAccessToken).toBeTypeOf('function');
    expect(bindings.fetchRatingsBatch).toBeTypeOf('function');
    expect(bindings.preloadRatingsForEntries).toBeTypeOf('function');
    expect(createWatchlistClient).toHaveBeenCalledTimes(1);
    expect(createWatchlistRepository).toHaveBeenCalledTimes(1);
    expect(createHistoryRepository).toHaveBeenCalledTimes(1);
    expect(createPreviewRepository).toHaveBeenCalledTimes(1);
    expect(bindings.fetchAllWatchlistRows).toBeTypeOf('function');
    expect(bindings.preloadWatchHistoryForEntries).toBeTypeOf('function');
    expect(bindings.fetchPreviewUrlForEntry).toBeTypeOf('function');
  });
});
