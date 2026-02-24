import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type InterfaceShellRuntime = {
  ensureInterface: () => void
  resetCuratedCachesForRefresh: () => Promise<void>
}

type InterfaceShellModule = {
  runtimeInterfaceShell: {
    createInterfaceShellRuntime: (options: Record<string, unknown>) => InterfaceShellRuntime
  }
}

const interfaceShellModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'InterfaceShell.ts'),
).href

function createBaseState() {
  return {
    framedRootEl: null,
    nativeHiddenNodes: [],
    hostEl: null,
    tabCrunchyrollEl: null,
    tabCuratedEl: null,
    curatedPanelEl: null,
    controlsEl: null,
    loadingIndicatorEl: null,
    audioFilterSelectEl: null,
    genreFilterSelectEl: null,
    statsEl: null,
    gridEl: null,
    curatedGridRenderSignature: '',
    settings: {
      activeTab: 'curated',
    },
    ratingCache: { seriesId: { rating: 4.5 } },
    ratingInflight: new Map([['series-1', Promise.resolve(null)]]),
    ratingLocalePreloadInflight: new Map([['en-us', Promise.resolve(null)]]),
    watchHistoryLocalePreloadInflight: new Map([['en-us', Promise.resolve(null)]]),
    watchHistoryCache: { version: 3, bySeriesId: { 'series-1': {} } },
    watchHistoryStatus: 'ready',
    watchHistoryInflight: Promise.resolve(null),
    curatedEntries: [{ seriesId: 'series-1' }],
    curatedError: 'old-error',
    curatedPendingRequests: ['Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)'],
  }
}

function getInterfaceShellModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as InterfaceShellModule
  return registry.runtimeInterfaceShell
}

describe('interface-shell runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([interfaceShellModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('emits ui-missing-watchlist-structure when root/header are unavailable', () => {
    const runtimeEvents: string[] = []
    const runtime = getInterfaceShellModule().createInterfaceShellRuntime({
      state: createBaseState(),
      documentRef: {
        createElement: () => ({}),
      },
      windowRef: {
        requestAnimationFrame: () => 0,
        dispatchEvent: () => true,
      },
      getWatchlistRoot: () => null,
      getWatchlistHeader: () => null,
      runtimeEvent: (event: string) => {
        runtimeEvents.push(event)
      },
      withMutedObserver: (work: () => void) => {
        work()
      },
      persistSettings: async () => null,
      applyCardLayoutUi: () => {},
      createCuratedInterfaceControls: () => ({
        controls: {},
        loadingIndicator: {},
        audioFilterControl: { select: {} },
        genreFilterControl: { select: {} },
        stats: {},
      }),
      bindCuratedInterfaceControls: () => {},
      ensureCuratedDataLoad: async () => null,
      renderCuratedPanel: () => {},
      debounceProcess: () => {},
      createEmptyWatchHistoryCache: () => ({}),
      storageSet: async () => null,
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    })

    runtime.ensureInterface()

    expect(runtimeEvents).toEqual(['ui-missing-watchlist-structure'])
  })

  it('resets curated caches and persists rating/watch-history caches', async () => {
    const state = createBaseState()
    const storageSetCalls: Array<{ key: string; value: unknown }> = []
    const nextWatchHistoryCache = { version: 3, bySeriesId: {} }
    const runtime = getInterfaceShellModule().createInterfaceShellRuntime({
      state,
      documentRef: {
        createElement: () => ({}),
      },
      windowRef: {
        requestAnimationFrame: () => 0,
        dispatchEvent: () => true,
      },
      getWatchlistRoot: () => null,
      getWatchlistHeader: () => null,
      runtimeEvent: () => {},
      withMutedObserver: (work: () => void) => {
        work()
      },
      persistSettings: async () => null,
      applyCardLayoutUi: () => {},
      createCuratedInterfaceControls: () => ({
        controls: {},
        loadingIndicator: {},
        audioFilterControl: { select: {} },
        genreFilterControl: { select: {} },
        stats: {},
      }),
      bindCuratedInterfaceControls: () => {},
      ensureCuratedDataLoad: async () => null,
      renderCuratedPanel: () => {},
      debounceProcess: () => {},
      createEmptyWatchHistoryCache: () => nextWatchHistoryCache,
      storageSet: async (key: string, value: unknown) => {
        storageSetCalls.push({ key, value })
      },
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    })

    await runtime.resetCuratedCachesForRefresh()

    expect(state.ratingCache).toEqual({})
    expect(state.ratingInflight.size).toBe(0)
    expect(state.ratingLocalePreloadInflight.size).toBe(0)
    expect(state.watchHistoryLocalePreloadInflight.size).toBe(0)
    expect(state.watchHistoryCache).toBe(nextWatchHistoryCache)
    expect(state.watchHistoryStatus).toBe('idle')
    expect(state.watchHistoryInflight).toBeNull()
    expect(state.curatedEntries).toEqual([])
    expect(state.curatedError).toBeNull()
    expect(state.curatedPendingRequests).toEqual([])
    expect(storageSetCalls).toEqual([
      { key: 'cw_rating_cache_v2', value: {} },
      { key: 'cw_watch_history_cache_v1', value: nextWatchHistoryCache },
    ])
  })
})
