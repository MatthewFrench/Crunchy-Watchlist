import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type RuntimeBootstrapFinalizeFlowRuntime = {
  createBootstrapFinalizeRuntimeOptions: (
    context: { isCurrentRuntimeActive: () => boolean },
    options: Record<string, unknown>,
  ) => Record<string, unknown>
  bindBootstrapFinalizeRuntimeMethods: (options: {
    bootstrapFinalizeRuntime: Record<string, unknown>
    setProcessWatchlist: (nextProcessWatchlist: (...args: unknown[]) => unknown) => void
    setSyncRouteRuntime: (nextSyncRouteRuntime: (...args: unknown[]) => unknown) => void
    setDestroyRuntime: (nextDestroyRuntime: (...args: unknown[]) => unknown) => void
    setBootstrapIssue: (reason: string, payload?: Record<string, unknown>) => void
    clearStaleInjectedShell: (reason: string) => void
  }) => boolean
  runBootstrapFinalizeInitFlow: (options: {
    bootstrapFinalizeRuntime: Record<string, unknown>
    updateDiagnostics: (payload: Record<string, unknown>) => void
    startDomRuntimeLockHeartbeat: () => void
    startWatchlistHealthRuntime: () => void
    runtimeEvent: (event: string, payload?: Record<string, unknown>) => void
    setBootstrapIssue: (reason: string, payload?: Record<string, unknown>) => void
    shutdownRuntime: (payload?: Record<string, unknown>) => void
    clearStaleInjectedShell: (reason: string) => void
  }) => void
}

type RuntimeBootstrapFinalizeFlowModule = {
  runtimeContentRuntimeBootstrapFinalizeFlow: {
    createContentRuntimeBootstrapFinalizeFlowRuntime: () => RuntimeBootstrapFinalizeFlowRuntime
  }
}

const contentRuntimeBootstrapFinalizeFlowModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentRuntimeBootstrapFinalizeFlow.ts'),
).href

async function flushMicrotasks(iterations = 4): Promise<void> {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve()
  }
}

function getRuntimeBootstrapFinalizeFlowModule() {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as RuntimeBootstrapFinalizeFlowModule
  return registry.runtimeContentRuntimeBootstrapFinalizeFlow
}

describe('content-runtime-bootstrap-finalize-flow runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([contentRuntimeBootstrapFinalizeFlowModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('builds runtime lifecycle + state-loader options with runtime constants', () => {
    const runtime = getRuntimeBootstrapFinalizeFlowModule().createContentRuntimeBootstrapFinalizeFlowRuntime()

    const options = runtime.createBootstrapFinalizeRuntimeOptions(
      {
        isCurrentRuntimeActive: () => true,
      },
      {
        state: {},
        runtimeEvent: vi.fn(),
        runtimeLifecycleModule: {
          marker: 'lifecycle',
        },
        runtimeStateLoaderModule: {
          marker: 'state-loader',
        },
        isWatchlistPath: vi.fn(),
        ensureInterface: vi.fn(),
        applyTabUi: vi.fn(),
        ensureCuratedDataLoad: vi.fn(),
        renderCuratedPanel: vi.fn(),
        setNativeVisibility: vi.fn(),
        clearRootFrame: vi.fn(),
        debounceProcess: vi.fn(),
        storageGet: vi.fn(),
        getAccessToken: vi.fn(),
        normalizeStoredWatchHistoryCache: vi.fn(),
        isWatchHistoryCacheValid: vi.fn(),
        normalizeStoredWatchlistCache: vi.fn(),
        isWatchlistCacheValid: vi.fn(),
        normalizeEntriesFromApiRows: vi.fn(),
        defaultSettings: {},
        validSortModes: ['recentActivity'],
        defaultSortMode: 'recentActivity',
        runtimeConstants: {
          settingsKey: 'settings',
          ratingCacheKey: 'rating-cache',
          watchHistoryCacheKey: 'watch-history-cache',
          watchlistCacheKey: 'watchlist-cache',
        },
        listKnownSeries: vi.fn(),
        dumpSeriesApiData: vi.fn(),
        printSeriesApiData: vi.fn(),
      },
    )

    expect(options.runtimeLifecycleOptions).toEqual(
      expect.objectContaining({
        isRuntimeActive: expect.any(Function),
        ensureInterface: expect.any(Function),
      }),
    )
    expect((options.runtimeLifecycleOptions as { isRuntimeActive: () => boolean }).isRuntimeActive()).toBe(true)
    expect(options.runtimeStateLoaderOptions).toEqual(
      expect.objectContaining({
        settingsKey: 'settings',
        ratingCacheKey: 'rating-cache',
        watchHistoryCacheKey: 'watch-history-cache',
        watchlistCacheKey: 'watchlist-cache',
      }),
    )
  })

  it('returns false and marks bootstrap issue when init method is missing', () => {
    const runtime = getRuntimeBootstrapFinalizeFlowModule().createContentRuntimeBootstrapFinalizeFlowRuntime()
    const setBootstrapIssue = vi.fn()
    const clearStaleInjectedShell = vi.fn()

    const result = runtime.bindBootstrapFinalizeRuntimeMethods({
      bootstrapFinalizeRuntime: {
        processWatchlist: vi.fn(),
      },
      setProcessWatchlist: vi.fn(),
      setSyncRouteRuntime: vi.fn(),
      setDestroyRuntime: vi.fn(),
      setBootstrapIssue,
      clearStaleInjectedShell,
    })

    expect(result).toBe(false)
    expect(setBootstrapIssue).toHaveBeenCalledWith('missing-bootstrap-finalize-runtime')
    expect(clearStaleInjectedShell).toHaveBeenCalledWith('missing-bootstrap-finalize-runtime')
  })

  it('handles init failure by emitting runtime diagnostics and shutdown payload', async () => {
    const runtime = getRuntimeBootstrapFinalizeFlowModule().createContentRuntimeBootstrapFinalizeFlowRuntime()
    const updateDiagnostics = vi.fn()
    const runtimeEvent = vi.fn()
    const setBootstrapIssue = vi.fn()
    const shutdownRuntime = vi.fn()
    const clearStaleInjectedShell = vi.fn()

    runtime.runBootstrapFinalizeInitFlow({
      bootstrapFinalizeRuntime: {
        init: vi.fn(async () => {
          throw new Error('init failed')
        }),
      },
      updateDiagnostics,
      startDomRuntimeLockHeartbeat: vi.fn(),
      startWatchlistHealthRuntime: vi.fn(),
      runtimeEvent,
      setBootstrapIssue,
      shutdownRuntime,
      clearStaleInjectedShell,
    })

    await flushMicrotasks()

    expect(updateDiagnostics).toHaveBeenCalledWith({
      ok: false,
      stage: 'init-started',
    })
    expect(runtimeEvent).toHaveBeenCalledWith('init-error', {
      message: 'init failed',
    })
    expect(setBootstrapIssue).toHaveBeenCalledWith('init-error', {
      message: 'init failed',
    })
    expect(shutdownRuntime).toHaveBeenCalledWith({
      reason: 'init-error',
      message: 'init failed',
    })
    expect(clearStaleInjectedShell).toHaveBeenCalledWith('init-error')
  })
})
