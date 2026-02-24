import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type ContentBootstrapPrelude = {
  ok: boolean
  runtimeBootstrapGateModule?: Record<string, unknown>
  runtimeBootstrapModulesModule?: Record<string, unknown>
  runtimeBootstrapFinalizeModule?: Record<string, unknown>
  bootstrapModulesRuntime?: Record<string, unknown>
}

type ContentBootstrapModule = {
  createContentBootstrapPrelude: (options: {
    windowRef: Window & typeof globalThis
    consoleRef: Console
    browserRef?: unknown
    chromeRef?: unknown
  }) => ContentBootstrapPrelude
}

const contentBootstrapModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentBootstrap.ts'),
).href

function getContentBootstrapModule(): ContentBootstrapModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    runtimeContentBootstrap?: ContentBootstrapModule
  }
  return registry.runtimeContentBootstrap as ContentBootstrapModule
}

function createWindowRef(pathname = '/watchlist'): Window & typeof globalThis {
  const windowRef = {
    location: { pathname },
  } as unknown as Window & typeof globalThis
  ;(windowRef as unknown as { top: unknown }).top = windowRef
  return windowRef
}

describe('content-bootstrap runtime module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([contentBootstrapModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('returns not-ok when route gate denies execution and emits gated diagnostics', () => {
    const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>
    const updateDiagnostics = vi.fn()
    const setBootstrapIssue = vi.fn()

    registry.runtimeBootstrapDiagnostics = {
      createBootstrapDiagnostics: () => ({
        updateDiagnostics,
        setBootstrapIssue,
      }),
    }
    registry.runtimeBootstrapGate = {
      shouldRun: () => false,
      isWatchlistPath: () => true,
      getWatchlistRoot: () => null,
      getWatchlistHeader: () => null,
    }
    registry.runtimeBootstrapModules = {
      createBootstrapModules: () => ({}),
      assertRuntimeMethods: () => {},
    }
    registry.runtimeBootstrapFinalize = {
      createBootstrapFinalizeRuntime: () => ({}),
      createStorageAccessors: () => ({}),
      safeJsonParse: () => ({}),
    }

    const prelude = getContentBootstrapModule().createContentBootstrapPrelude({
      windowRef: createWindowRef('/browse'),
      consoleRef: console,
    })

    expect(prelude.ok).toBe(false)
    expect(setBootstrapIssue).not.toHaveBeenCalled()
    expect(updateDiagnostics).toHaveBeenCalledWith({
      ok: false,
      stage: 'bootstrap-gated',
      pathname: '/browse',
      inTopFrame: true,
    })
  })

  it('returns runtime modules when all required owners are available and route is eligible', () => {
    const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>
    const updateDiagnostics = vi.fn()
    const setBootstrapIssue = vi.fn()
    const gateModule = {
      shouldRun: () => true,
      isWatchlistPath: () => true,
      getWatchlistRoot: () => null,
      getWatchlistHeader: () => null,
    }
    const modulesModule = {
      createBootstrapModules: () => ({ runtimeStoreModule: {} }),
      assertRuntimeMethods: () => {},
    }
    const finalizeModule = {
      createBootstrapFinalizeRuntime: () => ({}),
      createStorageAccessors: () => ({}),
      safeJsonParse: () => ({}),
    }

    registry.runtimeBootstrapDiagnostics = {
      createBootstrapDiagnostics: () => ({
        updateDiagnostics,
        setBootstrapIssue,
      }),
    }
    registry.runtimeBootstrapGate = gateModule
    registry.runtimeBootstrapModules = modulesModule
    registry.runtimeBootstrapFinalize = finalizeModule

    const prelude = getContentBootstrapModule().createContentBootstrapPrelude({
      windowRef: createWindowRef('/watchlist'),
      consoleRef: console,
    })

    expect(prelude.ok).toBe(true)
    expect(prelude.runtimeBootstrapGateModule).toBe(gateModule)
    expect(prelude.runtimeBootstrapModulesModule).toBe(modulesModule)
    expect(prelude.runtimeBootstrapFinalizeModule).toBe(finalizeModule)
    expect(prelude.bootstrapModulesRuntime).toEqual({ runtimeStoreModule: {} })
    expect(setBootstrapIssue).not.toHaveBeenCalled()
  })
})
