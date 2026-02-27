import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type ContentCompositionBindingsRuntime = {
  createEntryNormalizerBinding: (options: Record<string, unknown>) => (rows: unknown[]) => unknown[]
  createDebugRuntime: (options: Record<string, unknown>) => Record<string, unknown>
}

type ContentCompositionBindingsModule = {
  runtimeContentCompositionBindings: {
    createContentCompositionBindingsRuntime: () => ContentCompositionBindingsRuntime
  }
}

const contentCompositionBindingsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentCompositionBindings.ts'),
).href

function getContentCompositionBindingsRuntime(): ContentCompositionBindingsRuntime {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    runtimeContentCompositionBindings?: ContentCompositionBindingsModule['runtimeContentCompositionBindings']
  }
  return registry.runtimeContentCompositionBindings?.createContentCompositionBindingsRuntime() as ContentCompositionBindingsRuntime
}

function createCorePrimitivesRuntime(): Record<string, unknown> {
  return {
    sanitizePositiveInt: vi.fn((value: unknown) => Number(value) || 0),
    getAbsoluteEpisodeNumberFromEpisodeMetadata: vi.fn(() => 1),
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: vi.fn(() => 'key'),
    formatEpisodeIdentifier: vi.fn(() => 'S1 E1'),
    hasEnUsAudio: vi.fn(() => true),
    pickFirstDateMs: vi.fn(() => 0),
    getWatchlistSeriesId: vi.fn(() => 'series-id'),
    getEpisodeAvailabilityByAudioLocale: vi.fn(() => ({})),
    mergeEpisodeAvailabilityByAudioLocale: vi.fn(() => ({})),
    normalizeAudioLocales: vi.fn(() => []),
    getWatchHistorySeriesId: vi.fn(() => 'history-series-id'),
    getWatchlistSeriesTitle: vi.fn(() => 'Watchlist Title'),
    getWatchHistorySeriesTitle: vi.fn(() => 'History Title'),
  }
}

describe('content-composition bindings runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([contentCompositionBindingsModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
    vi.restoreAllMocks()
  })

  it('creates a normalizeEntriesFromApiRows binding from entry normalizer runtime', () => {
    const runtime = getContentCompositionBindingsRuntime()
    const normalizeEntriesFromApiRows = vi.fn((rows: unknown[]) =>
      rows.map((row) => ({ ...((row as Record<string, unknown>) || {}), normalized: true })),
    )
    const createEntryNormalizer = vi.fn(() => ({
      normalizeEntriesFromApiRows,
    }))

    const normalizeEntries = runtime.createEntryNormalizerBinding({
      corePrimitives: createCorePrimitivesRuntime(),
      modules: {
        entryNormalizerModule: {
          createEntryNormalizer,
        },
      },
      dependencies: {
        extractCoverImagesFromApiImages: vi.fn(() => []),
        extractThumbnailImageFromApiImages: vi.fn(() => ''),
      },
      state: {},
    })

    const normalizedRows = normalizeEntries([{ id: 'row-1' }])
    expect(createEntryNormalizer).toHaveBeenCalledTimes(1)
    expect(normalizeEntriesFromApiRows).toHaveBeenCalledWith([{ id: 'row-1' }])
    expect(normalizedRows).toEqual([{ id: 'row-1', normalized: true }])
  })

  it('creates debug runtime bindings and validates runtime methods', () => {
    const runtime = getContentCompositionBindingsRuntime()
    const listSeries = vi.fn(() => ['series-1'])
    const dumpSeriesApiData = vi.fn(() => ({ ok: true }))
    const printSeriesApiData = vi.fn(() => ({ printed: true }))
    const createDebugApiRuntime = vi.fn(() => ({
      listSeries,
      dumpSeriesApiData,
      printSeriesApiData,
    }))
    const assertRuntimeMethods = vi.fn()
    const consoleRef = {
      log: vi.fn(),
    } as unknown as Console

    const debugRuntime = runtime.createDebugRuntime({
      state: {},
      corePrimitives: createCorePrimitivesRuntime(),
      modules: {
        runtimeDebugModule: {
          createDebugApiRuntime,
        },
      },
      assertRuntimeMethods,
      consoleRef,
    })

    expect((debugRuntime.listKnownSeries as () => unknown)()).toEqual(['series-1'])
    expect((debugRuntime.dumpSeriesApiData as (query: unknown) => unknown)('series-1')).toEqual({ ok: true })
    expect((debugRuntime.printSeriesApiData as (query: unknown) => unknown)('series-1')).toEqual({ printed: true })
    expect(assertRuntimeMethods).toHaveBeenCalledWith('debug runtime', expect.any(Object), [
      'listSeries',
      'dumpSeriesApiData',
      'printSeriesApiData',
    ])
  })
})
