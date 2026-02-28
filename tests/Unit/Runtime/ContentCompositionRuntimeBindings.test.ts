import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type ContentCompositionRuntimeBindingsModule = {
  runtimeContentCompositionRuntimeBindings: {
    createContentCompositionRuntimeBindingsRuntime: () => {
      createCuratedRuntime: (
        options: Record<string, unknown>,
        sortRuntime: Record<string, unknown>,
        cardRuntime: Record<string, unknown>,
        normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[],
      ) => {
        buildRenderableEntries: () => unknown;
      };
    };
  };
};

const contentCompositionRuntimeBindingsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentCompositionRuntimeBindings.ts'),
).href;

function getRuntimeBindingsModule() {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as ContentCompositionRuntimeBindingsModule;
  return registry.runtimeContentCompositionRuntimeBindings;
}

function createRuntimeOptions(buildRenderableEntries: (entries: unknown[], settings: unknown) => unknown) {
  const noOp = () => undefined;
  const noOpAsync = async () => undefined;
  const state = {
    settings: {
      audioLocaleFilter: 'any',
      genreFilter: 'any',
      watchReadyFilterMode: 'hide',
      sortMode: 'recent_activity_desc',
      secondarySortMode: 'none',
    },
    curatedEntries: [{ seriesId: 'series-1' }],
    preferredAudioLanguage: 'en-US',
    ratingCacheRevision: 7,
    watchHistoryCache: {
      updatedAt: 42,
    },
  };

  return {
    state,
    runtimeConstants: {
      defaultSortMode: 'recent_activity_desc',
      watchlistRevalidateCooldownMs: 10_000,
      watchlistCacheSourceRevalidateCooldownMs: 10_000,
      metadataPriorityEntryCount: 10,
      metadataDeferredChunkSize: 10,
      metadataDeferredIdleTimeoutMs: 100,
      metadataDeferredHiddenDelayMs: 100,
      metadataViewportPriorityCount: 4,
      previewHoverDelayMs: 300,
    },
    windowRef: {
      document: {},
      location: {},
    },
    assertRuntimeMethods: () => undefined,
    corePrimitives: {
      normalizeAudioLocale: (value: unknown) => String(value || ''),
      normalizeAudioLocales: () => [],
      hasEnUsAudio: () => false,
      normalizeTagList: () => [],
      getAudioLocaleCountFromMap: () => 0,
      getLocalizedSeriesCount: () => 0,
      sanitizePositiveInt: (value: unknown) => Number(value) || 0,
      pickFirstDateMs: () => 0,
      deriveDisplayStatusBase: () => ({}),
    },
    dependencies: {
      getPreferredAudioLanguage: () => 'en-US',
      getCachedRating: () => null,
      getCachedWatchHistory: () => null,
      getCachedWatchHistoryProgress: () => null,
      normalizeImageUrlCandidate: () => '',
      isEntryWatchReady: () => true,
      applyCardLayoutUi: noOp,
      withMutedObserver: (work: () => unknown) => work(),
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: noOpAsync,
      preloadWatchHistoryForSelectedAudioLocale: noOpAsync,
      isWatchlistPath: () => true,
      runtimeEvent: noOp,
      getAccessToken: noOpAsync,
      resetWatchlistCacheOnAccountMismatch: noOp,
      fetchAllWatchlistRows: async () => [],
      preloadRatingsForEntries: noOpAsync,
      preloadWatchHistoryForEntries: noOpAsync,
      setWatchlistCacheRows: noOp,
      fetchWithResilience: async () => ({ ok: true }),
      createAuthRefreshHandler: noOp,
      resolveApiHref: (value: unknown) => String(value || ''),
      fetchPreviewUrlForEntry: async () => null,
      isLikelyVideoUrl: () => false,
    },
    modules: {
      runtimeRenderableModule: {
        createCuratedRenderable: () => ({
          buildRenderableEntries,
        }),
      },
      runtimeCuratedPanelModule: {
        createCuratedPanelRuntime: () => ({
          renderCuratedPanel: noOp,
          refreshCuratedLoadingIndicator: noOp,
        }),
      },
      runtimeCuratedLoaderModule: {
        createCuratedLoaderRuntime: () => ({
          loadCuratedEntries: noOpAsync,
          ensureCuratedDataLoad: noOpAsync,
        }),
      },
      runtimeNativeBridgeModule: {
        createNativeBridgeRuntime: () => ({
          triggerNativeCardAction: noOpAsync,
          installCuratedCardPreview: noOp,
        }),
      },
    },
  };
}

describe('content-composition-runtime-bindings runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([contentCompositionRuntimeBindingsModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
  });

  it('memoizes buildRenderableEntries without JSON stringification and recomputes on signature changes', () => {
    const buildRenderableEntries = vi.fn(() => ({ visible: [], total: 0 }));
    const options = createRuntimeOptions(buildRenderableEntries);
    const runtime = getRuntimeBindingsModule().createContentCompositionRuntimeBindingsRuntime();
    const curatedRuntime = runtime.createCuratedRuntime(
      options as unknown as Record<string, unknown>,
      {
        compareRenderableEntries: () => 0,
      },
      {
        createCuratedCard: () => ({}),
        patchCuratedCard: () => undefined,
      },
      (rows: unknown[]) => rows,
    );

    const first = curatedRuntime.buildRenderableEntries();
    const second = curatedRuntime.buildRenderableEntries();

    expect(second).toBe(first);
    expect(buildRenderableEntries).toHaveBeenCalledTimes(1);

    const settings = options.state.settings as Record<string, unknown>;
    settings.sortMode = 'title_asc';
    curatedRuntime.buildRenderableEntries();

    expect(buildRenderableEntries).toHaveBeenCalledTimes(2);
  });
});
