import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../helpers/module-registry'

type RouteLifecycleRuntime = {
  processWatchlist: () => Promise<void>
  syncRoute: () => void
}

type RouteLifecycleModule = {
  runtimeLifecycle: {
    createRouteLifecycle: (options: Record<string, unknown>) => RouteLifecycleRuntime
  }
}

const routeLifecycleModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'runtime', 'route-lifecycle.ts'),
).href

function getRouteLifecycleModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as RouteLifecycleModule
  return registry.runtimeLifecycle
}

function setPathname(pathname: string) {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    writable: true,
    value: { pathname },
  })
}

function createBaseState() {
  return {
    mounted: true,
    observer: null,
    routeWatcherStarted: false,
    routeSyncTimer: null,
    processTimer: null,
    mutationMuted: false,
    hostEl: null,
    tabCrunchyrollEl: {},
    tabCuratedEl: {},
    curatedPanelEl: {},
    controlsEl: {},
    loadingIndicatorEl: {},
    audioFilterSelectEl: {},
    genreFilterSelectEl: {},
    statsEl: {},
    gridEl: {},
    settings: {
      activeTab: 'curated',
    },
    curatedObservedPromise: Promise.resolve(),
  }
}

describe('runtime route-lifecycle', () => {
  beforeEach(async () => {
    await loadRuntimeModules([routeLifecycleModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
    delete (globalThis as Record<string, unknown>).location
  })

  it('runs processWatchlist orchestration when mounted on watchlist route', async () => {
    setPathname('/watchlist')
    const state = createBaseState()
    const ensureInterface = vi.fn()
    const applyTabUi = vi.fn()
    const renderCuratedPanel = vi.fn()
    const ensureCuratedDataLoad = vi.fn(async () => undefined)

    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface,
      applyTabUi,
      ensureCuratedDataLoad,
      renderCuratedPanel,
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess: vi.fn(),
    })

    await runtime.processWatchlist()

    expect(ensureInterface).toHaveBeenCalledTimes(1)
    expect(applyTabUi).toHaveBeenCalledTimes(1)
    expect(ensureCuratedDataLoad).toHaveBeenCalledWith(false)
    expect(renderCuratedPanel).toHaveBeenCalledTimes(2)
  })

  it('unmounts and clears interface state when syncing non-watchlist routes', () => {
    setPathname('/browse')
    const state = createBaseState()
    state.mounted = true
    ;(state as Record<string, unknown>).hostEl = {
      isConnected: true,
      remove: vi.fn(),
    }
    const setNativeVisibility = vi.fn()
    const clearRootFrame = vi.fn()

    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility,
      clearRootFrame,
      debounceProcess: vi.fn(),
    })

    runtime.syncRoute()

    expect(setNativeVisibility).toHaveBeenCalledWith(true)
    expect(clearRootFrame).toHaveBeenCalledTimes(1)
    expect(state.mounted).toBe(false)
    expect(state.hostEl).toBeNull()
    expect(state.tabCrunchyrollEl).toBeNull()
    expect(state.curatedObservedPromise).toBeNull()
  })
})
