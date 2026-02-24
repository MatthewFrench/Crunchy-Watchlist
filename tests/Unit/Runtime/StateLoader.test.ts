import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type StateLoaderRuntime = {
  loadInitialState: () => Promise<void>
}

type StateLoaderModule = {
  runtimeStateLoader: {
    createStateLoader: (options: Record<string, unknown>) => StateLoaderRuntime
  }
}

const stateLoaderModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'StateLoader.ts'),
).href

function getStateLoaderModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as StateLoaderModule
  return registry.runtimeStateLoader
}

function createBaseState() {
  return {
    settings: {},
    ratingCache: {},
    watchHistoryCache: {},
    watchHistoryStatus: 'idle',
    watchlistCache: {},
    curatedEntries: [] as unknown[],
    curatedSource: 'none',
    curatedLastRevalidateAt: 0,
  }
}

function createStorageGet(values: Record<string, unknown>) {
  return async (key: string, fallback: unknown) => (Object.hasOwn(values, key) ? values[key] : fallback)
}

describe('runtime state-loader', () => {
  beforeEach(async () => {
    await loadRuntimeModules([stateLoaderModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('migrates legacy settings and enforces sort/layout guards', async () => {
    const state = createBaseState()
    const runtimeEvents: Array<{ event: string; data?: unknown }> = []
    const defaultSettings = {
      activeTab: 'curated',
      cardLayout: 'portrait',
      watchReadyFilterMode: 'hide',
      sortMode: 'consensus_quality_desc',
    }

    const storageValues = {
      cw_settings_v1: {
        requireEnglishAudio: true,
        actionabilityMode: 'dim',
        cardLayout: 'unknown-layout',
        sortMode: 'invalid-sort',
      },
      cw_rating_cache_v2: {
        seriesA: { rating: 4.4 },
      },
      cw_watch_history_cache_v1: {
        persisted: true,
      },
      cw_watchlist_cache_v1: null,
    }

    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet(storageValues),
      runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => false,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => false,
      normalizeEntriesFromApiRows: (rows: unknown[]) => rows,
      defaultSettings,
      validSortModes: new Set(['none', 'consensus_quality_desc']),
      defaultSortMode: 'consensus_quality_desc',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    })

    await stateLoader.loadInitialState()

    const settings = state.settings as Record<string, unknown>
    expect(settings.audioLocaleFilter).toBe('en-US')
    expect(settings.watchReadyFilterMode).toBe('dim')
    expect(settings.cardLayout).toBe('portrait')
    expect(settings.sortMode).toBe('consensus_quality_desc')
    expect(state.ratingCache).toEqual({
      seriesA: { rating: 4.4 },
    })
    expect(state.watchHistoryStatus).toBe('idle')
    expect(runtimeEvents.at(-1)).toEqual({
      event: 'state-load-done',
      data: {
        tab: 'curated',
        cachedCurated: 0,
      },
    })
  })

  it('hydrates curated entries from valid watchlist cache and emits hydration event', async () => {
    const state = createBaseState()
    const runtimeEvents: Array<{ event: string; data?: unknown }> = []
    const watchlistRows = [{ series_id: 'series-1' }, { series_id: 'series-2' }]

    const stateLoader = getStateLoaderModule().createStateLoader({
      state,
      storageGet: createStorageGet({
        cw_settings_v1: {},
        cw_rating_cache_v2: {},
        cw_watch_history_cache_v1: {},
        cw_watchlist_cache_v1: {
          rows: watchlistRows,
          updatedAt: 12345,
        },
      }),
      runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
      normalizeStoredWatchHistoryCache: (raw: unknown) => raw,
      isWatchHistoryCacheValid: () => true,
      normalizeStoredWatchlistCache: (raw: unknown) => raw,
      isWatchlistCacheValid: () => true,
      normalizeEntriesFromApiRows: (rows: unknown[]) =>
        rows.map((row) => ({ ...((row as object) || {}), normalized: true })),
      defaultSettings: {
        activeTab: 'curated',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        cardLayout: 'portrait',
        watchReadyFilterMode: 'hide',
        sortMode: 'none',
      },
      validSortModes: new Set(['none']),
      defaultSortMode: 'none',
      settingsKey: 'cw_settings_v1',
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
      watchlistCacheKey: 'cw_watchlist_cache_v1',
    })

    await stateLoader.loadInitialState()

    expect(state.curatedSource).toBe('cache')
    expect(state.curatedLastRevalidateAt).toBe(12345)
    expect(state.curatedEntries).toEqual([
      { series_id: 'series-1', normalized: true },
      { series_id: 'series-2', normalized: true },
    ])
    expect(runtimeEvents).toContainEqual({
      event: 'curated-cache-hydrated',
      data: {
        total: 2,
        updatedAt: 12345,
      },
    })
  })
})
