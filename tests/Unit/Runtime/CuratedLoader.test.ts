import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type CuratedLoaderRuntime = {
  loadCuratedEntries: (force?: boolean) => Promise<unknown[]>
  ensureCuratedDataLoad: (force?: boolean) => Promise<unknown[]>
}

type CuratedLoaderModule = {
  runtimeCuratedLoader: {
    createCuratedLoaderRuntime: (options: Record<string, unknown>) => CuratedLoaderRuntime
  }
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

const curatedLoaderModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedLoader.ts'),
).href

function createDeferred<T>(): Deferred<T> {
  let resolveRef: ((value: T | PromiseLike<T>) => void) | null = null
  let rejectRef: ((reason?: unknown) => void) | null = null
  const promise = new Promise<T>((resolve, reject) => {
    resolveRef = resolve
    rejectRef = reject
  })

  if (!resolveRef || !rejectRef) {
    throw new Error('Failed to initialize deferred promise')
  }

  return {
    promise,
    resolve: resolveRef,
    reject: rejectRef,
  }
}

function getCuratedLoaderModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as CuratedLoaderModule
  return registry.runtimeCuratedLoader
}

function createCuratedLoaderHarness(overrides: Record<string, unknown> = {}) {
  const runtimeEvents: Array<{ event: string; data?: unknown }> = []

  const state = {
    mounted: true,
    curatedError: null as unknown,
    curatedEntries: [] as unknown[],
    curatedInflight: null as Promise<unknown[]> | null,
    curatedSource: 'none',
    curatedLastRevalidateAt: 0,
    curatedObservedPromise: null as Promise<unknown[]> | null,
    settings: {
      audioLocaleFilter: 'any',
    },
  }

  const dependencies = {
    state,
    locationRef: {
      pathname: '/watchlist',
    },
    runtimeEvent: (event: string, data?: unknown) => {
      runtimeEvents.push({ event, data })
    },
    getAccessToken: vi.fn(async () => ({
      accessToken: 'access-token',
      accountId: 'account-1',
    })),
    resetWatchlistCacheOnAccountMismatch: vi.fn(),
    fetchAllWatchlistRows: vi.fn(async () => [{ id: 'row-1' }]),
    normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) =>
      rows.map((row) => ({
        ...((row as Record<string, unknown>) || {}),
        seriesId: 'series-1',
      })),
    ),
    preloadRatingsForEntries: vi.fn(async () => null),
    preloadWatchHistoryForEntries: vi.fn(async () => null),
    normalizeAudioLocale: vi.fn((value: unknown) => {
      if (typeof value !== 'string') {
        return null
      }
      const trimmed = value.trim()
      if (!trimmed || trimmed.toLowerCase() === 'any') {
        return null
      }
      return trimmed
    }),
    getPreferredAudioLanguage: vi.fn(() => 'en-US'),
    setWatchlistCacheRows: vi.fn(),
    isWatchlistPath: vi.fn((pathname: string) => pathname.endsWith('/watchlist')),
    renderCuratedPanel: vi.fn(),
    watchlistRevalidateCooldownMs: 90_000,
    ...overrides,
  }

  const runtime = getCuratedLoaderModule().createCuratedLoaderRuntime(dependencies)

  return {
    runtime,
    state: dependencies.state,
    runtimeEvents,
    dependencies,
  }
}

describe('curated-loader runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([curatedLoaderModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('loads curated entries from API and updates cache + preload state', async () => {
    const harness = createCuratedLoaderHarness({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedSource: 'none',
        curatedLastRevalidateAt: 0,
        curatedObservedPromise: null,
        settings: {
          audioLocaleFilter: 'ja-JP',
        },
      },
    })

    const entries = await harness.runtime.loadCuratedEntries(false)

    expect(entries).toHaveLength(1)
    expect(harness.state.curatedEntries).toHaveLength(1)
    expect(harness.state.curatedSource).toBe('api')
    expect(harness.dependencies.setWatchlistCacheRows).toHaveBeenCalledTimes(1)
    expect(harness.dependencies.preloadRatingsForEntries).toHaveBeenCalledTimes(2)
    expect(harness.dependencies.preloadWatchHistoryForEntries).toHaveBeenCalledTimes(2)
    expect(harness.runtimeEvents.map((entry) => entry.event)).toEqual(
      expect.arrayContaining(['curated-load-start', 'curated-load-done']),
    )
  })

  it('returns existing entries and performs background revalidate when stale', async () => {
    const fetchRowsDeferred = createDeferred<unknown[]>()
    const cachedEntries = [{ seriesId: 'cached-series' }]

    const harness = createCuratedLoaderHarness({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: cachedEntries,
        curatedInflight: null,
        curatedSource: 'api',
        curatedLastRevalidateAt: Date.now() - 200_000,
        curatedObservedPromise: null,
        settings: {
          audioLocaleFilter: 'any',
        },
      },
      fetchAllWatchlistRows: vi.fn(() => fetchRowsDeferred.promise),
      normalizeEntriesFromApiRows: vi.fn((rows: unknown[]) => rows),
    })

    const result = await harness.runtime.ensureCuratedDataLoad(false)
    expect(result).toBe(cachedEntries)
    expect(harness.dependencies.fetchAllWatchlistRows).toHaveBeenCalledTimes(1)
    expect(harness.state.curatedInflight).not.toBeNull()

    const backgroundPromise = harness.state.curatedInflight as Promise<unknown[]>

    fetchRowsDeferred.resolve([{ seriesId: 'fresh-series' }])
    await backgroundPromise
    await Promise.resolve()

    expect(harness.dependencies.renderCuratedPanel).toHaveBeenCalledTimes(1)
    expect(harness.state.curatedObservedPromise).toBeNull()
  })

  it('records an error when API load fails without cached entries', async () => {
    const harness = createCuratedLoaderHarness({
      fetchAllWatchlistRows: vi.fn(async () => {
        throw new Error('simulated load failure')
      }),
    })

    const result = await harness.runtime.loadCuratedEntries(false)

    expect(result).toEqual([])
    expect(harness.state.curatedEntries).toEqual([])
    expect(harness.state.curatedSource).toBe('none')
    expect(String(harness.state.curatedError)).toContain('simulated load failure')
    expect(harness.runtimeEvents.map((entry) => entry.event)).toContain('curated-load-failed')
  })
})
