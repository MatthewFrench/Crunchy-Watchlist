import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type WatchlistHealthRuntime = {
  runCheck: () => void
  start: () => void
  stop: () => void
}

type WatchlistHealthModule = {
  runtimeWatchlistHealth: {
    createWatchlistHealthRuntime: (options: Record<string, unknown>) => WatchlistHealthRuntime
  }
}

type FakeClassList = {
  contains: (token: string) => boolean
}

type FakeElement = {
  children: FakeElement[]
  classList: FakeClassList
  contains: (candidate: unknown) => boolean
  querySelector: (selector: string) => unknown
  style?: { display?: string }
  isConnected?: boolean
}

const watchlistHealthModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'WatchlistHealth.ts'),
).href

function getWatchlistHealthModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as WatchlistHealthModule
  return registry.runtimeWatchlistHealth
}

function createSessionStorageRef() {
  const storage = new Map<string, string>()
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
  }
}

function createFakeElement(
  options: {
    classNames?: string[]
    children?: FakeElement[]
    contains?: (candidate: unknown) => boolean
    querySelector?: (selector: string) => unknown
    style?: { display?: string }
    isConnected?: boolean
  } = {},
): FakeElement {
  const classNames = new Set(options.classNames ?? [])
  const element: FakeElement = {
    children: options.children ?? [],
    classList: {
      contains: (token: string) => classNames.has(token),
    },
    contains: options.contains ?? (() => false),
    querySelector: options.querySelector ?? (() => null),
  }
  if (options.style !== undefined) {
    element.style = options.style
  }
  if (options.isConnected !== undefined) {
    element.isConnected = options.isConnected
  }
  return element
}

function createWatchlistHealthHarness(overrides: Record<string, unknown> = {}) {
  const runtimeEvents: Array<{ event: string; data?: unknown }> = []
  const reloadSpy = vi.fn()
  const syncRouteRuntime = vi.fn()
  const processWatchlist = vi.fn(async () => undefined)
  const setIntervalSpy = vi.fn(() => 42)
  const clearIntervalSpy = vi.fn()
  const sessionStorageRef = createSessionStorageRef()

  const gridEl = createFakeElement({
    isConnected: true,
    children: [],
  })
  const hostEl = createFakeElement({
    isConnected: true,
    contains: (candidate: unknown) => candidate === gridEl,
    querySelector: (selector: string) => {
      if (selector === '.cw-loading-indicator') {
        return null
      }
      if (selector === '.cw-tabs' || selector === '.cw-panel') {
        return createFakeElement()
      }
      return null
    },
    style: {
      display: '',
    },
  })
  const watchlistRoot = createFakeElement({
    classNames: ['cw-watchlist-frame'],
    children: [hostEl],
    contains: (candidate: unknown) => candidate === hostEl,
  })

  const runtime = getWatchlistHealthModule().createWatchlistHealthRuntime({
    state: {
      mounted: true,
      settings: {
        activeTab: 'curated',
      },
      hostEl,
      gridEl,
      curatedInflight: null,
      curatedPendingRequests: [],
      curatedError: null,
    },
    windowRef: {
      location: {
        pathname: '/watchlist',
        reload: reloadSpy,
      },
      document: {},
      sessionStorage: sessionStorageRef,
      setInterval: setIntervalSpy,
      clearInterval: clearIntervalSpy,
    },
    runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
    isRuntimeActive: () => true,
    isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
    getWatchlistRoot: () => watchlistRoot,
    processWatchlist,
    syncRouteRuntime,
    blankShellRecoveryStabilizeMs: 4_000,
    blankShellReloadMaxPerSession: 1,
    blankShellReloadCooldownMs: 60_000,
    ...overrides,
  })

  return {
    runtime,
    runtimeEvents,
    reloadSpy,
    syncRouteRuntime,
    processWatchlist,
    setIntervalSpy,
    clearIntervalSpy,
  }
}

describe('watchlist-health runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([watchlistHealthModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
    vi.restoreAllMocks()
  })

  it('starts and stops interval watcher', () => {
    const harness = createWatchlistHealthHarness()

    harness.runtime.start()
    harness.runtime.stop()

    expect(harness.setIntervalSpy).toHaveBeenCalledTimes(1)
    expect(harness.clearIntervalSpy).toHaveBeenCalledWith(42)
  })

  it('runs soft recovery then performs one bounded reload for stable blank-shell state', () => {
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(5_500).mockReturnValue(5_500)

    const harness = createWatchlistHealthHarness()

    harness.runtime.runCheck()
    expect(harness.syncRouteRuntime).toHaveBeenCalledTimes(1)
    expect(harness.processWatchlist).toHaveBeenCalledTimes(1)
    expect(harness.reloadSpy).not.toHaveBeenCalled()

    harness.runtime.runCheck()
    expect(harness.syncRouteRuntime).toHaveBeenCalledTimes(2)
    expect(harness.processWatchlist).toHaveBeenCalledTimes(2)
    expect(harness.reloadSpy).toHaveBeenCalledTimes(1)
    expect(harness.runtimeEvents.map((entry) => entry.event)).toEqual(
      expect.arrayContaining(['watchlist-health-issue-detected', 'watchlist-health-reload']),
    )

    harness.runtime.runCheck()
    expect(harness.reloadSpy).toHaveBeenCalledTimes(1)
    expect(harness.runtimeEvents.map((entry) => entry.event)).toContain('watchlist-health-reload-suppressed')
  })
})
