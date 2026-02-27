import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type ContentCompositionModule = {
  createContentComposition: (options: Record<string, unknown>) => Record<string, unknown>
}

const contentCompositionModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentComposition.ts'),
).href
const contentCompositionBindingsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentCompositionBindings.ts'),
).href

function getContentCompositionModule(): ContentCompositionModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    runtimeContentComposition?: ContentCompositionModule
  }
  return registry.runtimeContentComposition as ContentCompositionModule
}

function createSortMetricsRuntime(): Record<string, unknown> {
  const numericMethod = () => 0
  return {
    getStarCountFromDistribution: numericMethod,
    getStarPercentageFromDistribution: numericMethod,
    getTotalStarPoints: numericMethod,
    getConsensusQualityScore: numericMethod,
    getControversyScore: numericMethod,
    getQualityFloorScore: numericMethod,
    getQuickWinScore: numericMethod,
    getWatchedEpisodeEstimate: numericMethod,
    getPlausiblePastTimestamp: numericMethod,
    getRewatchActivityTimestamp: numericMethod,
    getMostRecentActivityTimestamp: numericMethod,
    getDormantBacklogScore: numericMethod,
    getRewatchMemoryScore: numericMethod,
    estimateUnwatchedEpisodesLeft: numericMethod,
  }
}

function createCorePrimitivesRuntime(): Record<string, unknown> {
  return {
    sanitizePositiveInt: (value: unknown) => Number(value) || 0,
    getAbsoluteEpisodeNumberFromEpisodeMetadata: () => 1,
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: () => 'key',
    formatEpisodeIdentifier: () => 'S1 E1',
    hasEnUsAudio: () => true,
    pickFirstDateMs: () => 0,
    getWatchlistSeriesId: () => 'series-id',
    getEpisodeAvailabilityByAudioLocale: () => ({}),
    mergeEpisodeAvailabilityByAudioLocale: () => ({}),
    normalizeAudioLocales: () => [],
    sanitizePercentage: () => 0,
    sanitizeVotes: () => 0,
    parseDateMs: () => 0,
    pickFirstPositiveInt: () => 1,
    normalizeTagList: () => [],
    normalizeAudioLocale: () => 'en-US',
    getAudioLocaleCountFromMap: () => 0,
    getLocalizedSeriesCount: () => 0,
    deriveDisplayStatusBase: () => ({}),
    getWatchHistorySeriesId: () => 'history-series-id',
    getWatchlistSeriesTitle: () => 'Watchlist Title',
    getWatchHistorySeriesTitle: () => 'History Title',
  }
}

describe('content composition runtime module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([contentCompositionBindingsModuleUrl, contentCompositionModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('wires deferred runtime callbacks for card actions and preview installation', () => {
    const createCuratedCardActions = vi.fn(() => ['favorite'])
    const installCuratedCardPreview = vi.fn(() => 'preview-installed')
    let cardShellOptions: Record<string, unknown> | null = null

    const runtime = getContentCompositionModule().createContentComposition({
      windowRef: {
        document: {},
        location: { pathname: '/watchlist' },
        alert: () => {},
        confirm: () => true,
      },
      state: {
        settings: { sortMode: 'recent' },
        curatedEntries: [],
      },
      runtimeConstants: {
        watchlistRevalidateCooldownMs: 90_000,
        previewHoverDelayMs: 200,
        ratingCacheKey: 'ratings',
        watchHistoryCacheKey: 'history',
      },
      sortModeControlOptions: [],
      assertRuntimeMethods: () => {},
      corePrimitives: createCorePrimitivesRuntime(),
      modules: {
        entryNormalizerModule: {
          createEntryNormalizer: () => ({
            normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
          }),
        },
        sortMetricsModule: {
          createSortMetrics: () => createSortMetricsRuntime(),
        },
        entrySortingModule: {
          createEntrySorting: () => ({
            compareRenderableEntries: () => 0,
          }),
        },
        cardMetadataModule: {
          createCardMetadata: () => ({
            formatVotes: () => '',
            getLastWatchedPresentation: () => '',
            appendLabeledValue: () => undefined,
            setLabeledValue: () => undefined,
            setLabeledValuePairs: () => undefined,
            getSeriesScopePairs: () => [],
            getGenreValue: () => '',
            makeRatingHistogram: () => ({}),
            makeRatingBadge: () => ({}),
          }),
        },
        controlsViewModule: {
          createControlsView: () => ({
            createCuratedInterfaceControls: () => ({ id: 'controls' }),
          }),
        },
        cardViewModule: {
          createCardView: () => ({
            createCuratedCardBody: (entry: unknown) => ({ entry }),
          }),
        },
        cardShellModule: {
          createCardShell: (options: Record<string, unknown>) => {
            cardShellOptions = options
            return {
              createCuratedCard: (entry: unknown) => ({
                entry,
                actions: (options.createCuratedCardActions as (value: unknown) => unknown)(entry),
                preview: (options.installCuratedCardPreview as (...args: unknown[]) => unknown)(
                  null,
                  entry,
                  null,
                  null,
                  null,
                ),
              }),
            }
          },
        },
        runtimeRenderableModule: {
          createCuratedRenderable: () => ({
            buildRenderableEntries: () => [],
          }),
        },
        runtimeCuratedPanelModule: {
          createCuratedPanelRuntime: () => ({
            renderCuratedPanel: () => undefined,
            refreshCuratedLoadingIndicator: () => undefined,
          }),
        },
        runtimeCuratedLoaderModule: {
          createCuratedLoaderRuntime: () => ({
            loadCuratedEntries: async () => [],
            ensureCuratedDataLoad: async () => [],
          }),
        },
        runtimeNativeBridgeModule: {
          createNativeBridgeRuntime: () => ({
            triggerNativeCardAction: async () => true,
            installCuratedCardPreview,
          }),
        },
        runtimeCuratedInteractionsModule: {
          createCuratedInteractionsRuntime: () => ({
            createCuratedCardActions,
            bindCuratedInterfaceControls: () => undefined,
          }),
        },
        runtimeInterfaceShellModule: {
          createInterfaceShellRuntime: () => ({
            clearRootFrame: () => undefined,
            setNativeVisibility: () => undefined,
            applyTabUi: () => undefined,
            resetCuratedCachesForRefresh: () => undefined,
            ensureInterface: () => undefined,
          }),
        },
        runtimeDebugModule: {
          createDebugApiRuntime: () => ({
            listSeries: () => ['series-id'],
            dumpSeriesApiData: () => ({ ok: true }),
            printSeriesApiData: () => ({ printed: true }),
          }),
        },
      },
      dependencies: {
        extractCoverImagesFromApiImages: () => [],
        extractThumbnailImageFromApiImages: () => '',
        normalizeImageUrlCandidate: () => '',
        getPreferredAudioLanguage: () => 'en-US',
        getCachedRating: () => null,
        getCachedWatchHistory: () => null,
        getCachedWatchHistoryProgress: () => null,
        isEntryWatchReady: () => true,
        isLocalizedRatingDataMissingForEntries: () => false,
        isLocalizedWatchHistoryDataMissingForEntries: () => false,
        preloadRatingsForSelectedAudioLocale: async () => undefined,
        preloadWatchHistoryForSelectedAudioLocale: async () => undefined,
        getAccessToken: async () => null,
        fetchWithResilience: async () => new Response(null, { status: 200 }),
        createAuthRefreshHandler: () => undefined,
        resetWatchlistCacheOnAccountMismatch: () => undefined,
        fetchAllWatchlistRows: async () => [],
        preloadRatingsForEntries: async () => undefined,
        preloadWatchHistoryForEntries: async () => undefined,
        setWatchlistCacheRows: () => undefined,
        fetchPreviewUrlForEntry: async () => null,
        isLikelyVideoUrl: () => true,
        toggleCuratedFavorite: async () => undefined,
        removeCuratedSeries: async () => undefined,
        persistSettings: async () => undefined,
        debounceProcess: () => undefined,
        isWatchlistPath: () => true,
        withMutedObserver: (work: () => unknown) => work(),
        applyCardLayoutUi: () => undefined,
        createEmptyWatchHistoryCache: () => ({}),
        getWatchlistRoot: () => null,
        getWatchlistHeader: () => null,
        storageSet: async () => undefined,
        runtimeEvent: () => undefined,
        resolveApiHref: (value: unknown) => String(value),
      },
    })

    const createCuratedCard = runtime.createCuratedCard as (entry: unknown) => Record<string, unknown>
    const card = createCuratedCard({ id: 'series-1' })

    expect(card.actions).toEqual(['favorite'])
    expect(card.preview).toBe('preview-installed')
    expect(createCuratedCardActions).toHaveBeenCalledTimes(1)
    expect(installCuratedCardPreview).toHaveBeenCalledTimes(1)
    expect(cardShellOptions).toBeTruthy()
  })
})
