import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type BootstrapFinalizeRuntime = {
  processWatchlist: () => Promise<void>
  startRouteWatcher: () => void
  syncRoute: () => void
  loadInitialState: () => Promise<void>
  init: () => Promise<void>
}

type BootstrapFinalizeModule = {
  runtimeBootstrapFinalize: {
    safeJsonParse: (value: unknown, fallback: unknown) => unknown
    createStorageAccessors: (options?: Record<string, unknown>) => {
      storageGet: (key: string, fallback: unknown) => Promise<unknown>
      storageSet: (key: string, value: unknown) => Promise<void>
    }
    createBootstrapFinalizeRuntime: (options?: Record<string, unknown>) => BootstrapFinalizeRuntime
  }
}

const bootstrapFinalizeModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapFinalize.ts'),
).href

function getBootstrapFinalizeModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as BootstrapFinalizeModule
  return registry.runtimeBootstrapFinalize
}

describe('bootstrap-finalize runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([bootstrapFinalizeModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('parses json values with fallback behavior', () => {
    const runtime = getBootstrapFinalizeModule()

    expect(runtime.safeJsonParse('{"ok":true}', null)).toEqual({ ok: true })
    expect(runtime.safeJsonParse('{invalid', 'fallback')).toBe('fallback')
    expect(runtime.safeJsonParse(null, 'fallback')).toBe('fallback')
  })

  it('creates storage accessors that delegate to a storage adapter', async () => {
    const runtime = getBootstrapFinalizeModule()
    const get = vi.fn(async (_key: string, fallback: unknown) => fallback)
    const set = vi.fn(async () => {})
    const storage = runtime.createStorageAccessors({
      storageAdapter: {
        get,
        set,
      },
    })

    await storage.storageGet('settings', { enabled: true })
    await storage.storageSet('settings', { enabled: false })

    expect(get).toHaveBeenCalledWith('settings', { enabled: true })
    expect(set).toHaveBeenCalledWith('settings', { enabled: false })
  })

  it('wires lifecycle + state-loader delegates and exposes debug api on init', async () => {
    const runtimeModule = getBootstrapFinalizeModule()
    const processWatchlist = vi.fn(async () => {})
    const startRouteWatcher = vi.fn(() => {})
    const syncRoute = vi.fn(() => {})
    const loadInitialState = vi.fn(async () => {})
    const runtimeEvent = vi.fn()
    const windowRef: Record<string, unknown> = {}

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
      runtimeStateLoaderModule: {
        createStateLoader: () => ({
          loadInitialState,
        }),
      },
      runtimeStateLoaderOptions: {},
      listKnownSeries: () => ['SERIES_A'],
      dumpSeriesApiData: (query: unknown) => ({
        query,
      }),
      printSeriesApiData: (query: unknown) => ({
        query,
        printed: true,
      }),
    })

    await runtime.processWatchlist()
    runtime.startRouteWatcher()
    runtime.syncRoute()
    await runtime.loadInitialState()
    await runtime.init()

    expect(processWatchlist).toHaveBeenCalledTimes(1)
    expect(startRouteWatcher).toHaveBeenCalledTimes(2)
    expect(syncRoute).toHaveBeenCalledTimes(2)
    expect(loadInitialState).toHaveBeenCalledTimes(2)
    expect(runtimeEvent).toHaveBeenCalledWith('init-start')
    expect(runtimeEvent).toHaveBeenCalledWith('init-done')

    const debugApi = windowRef.__CW_WATCHLIST_CURATOR_DEBUG__ as Record<string, unknown>
    expect((debugApi.listSeries as () => unknown[])()).toEqual(['SERIES_A'])
    expect((debugApi.dumpSeriesApiData as (query: string) => unknown)('series')).toEqual({ query: 'series' })
    expect((debugApi.printSeriesApiData as (query: string) => unknown)('series')).toEqual({
      query: 'series',
      printed: true,
    })
  })
})
