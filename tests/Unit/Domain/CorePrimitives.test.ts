import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type CorePrimitivesRuntime = {
  sanitizeRating: (value: unknown) => number | null
  parseDateMs: (value: unknown) => number | null
  normalizeAudioLocales: (value: unknown) => string[]
  parseCmsObjectRecord: (record: unknown) => Record<string, unknown>
  deriveDisplayStatusBase: (entry: unknown, watchHistoryEntry: unknown) => string
}

type CorePrimitivesModule = {
  createCorePrimitives: (deps: Record<string, unknown>) => CorePrimitivesRuntime
}

const moduleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Domain', 'CorePrimitives.ts')).href

function getCorePrimitivesModule(): CorePrimitivesModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    domain?: Record<string, unknown>
  }
  const domainRegistry = registry.domain ?? {}
  return domainRegistry.corePrimitives as CorePrimitivesModule
}

function createCorePrimitivesRuntime(): CorePrimitivesRuntime {
  return getCorePrimitivesModule().createCorePrimitives({
    extractCoverImagesFromApiImages: (images: unknown) => {
      const record = images && typeof images === 'object' ? (images as Record<string, unknown>) : {}
      return {
        portrait: typeof record.portrait === 'string' ? record.portrait : '',
        landscape: typeof record.landscape === 'string' ? record.landscape : '',
        fallback: typeof record.fallback === 'string' ? record.fallback : '',
      }
    },
  })
}

describe('core-primitives domain module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([moduleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('normalizes ratings, dates, and audio locales', () => {
    const runtime = createCorePrimitivesRuntime()

    expect(runtime.sanitizeRating('4.26')).toBe(4.3)
    expect(runtime.sanitizeRating('9')).toBeNull()
    expect(runtime.parseDateMs('2026-02-01T00:00:00.000Z')).toBe(Date.parse('2026-02-01T00:00:00.000Z'))
    expect(runtime.normalizeAudioLocales(['ja-JP', 'JA-jp', 'en-US', ''])).toEqual(['ja-JP', 'en-US'])
  })

  it('parses CMS object records with normalized metadata', () => {
    const runtime = createCorePrimitivesRuntime()
    const parsed = runtime.parseCmsObjectRecord({
      id: 'series-1',
      description: '  Example description  ',
      rating: {
        '1s': { percentage: '2%' },
        '2s': { percentage: '3%' },
        '3s': { percentage: '10%' },
        '4s': { percentage: '30%' },
        '5s': { percentage: '55%' },
      },
      average: 4.5,
      count: 3200,
      series_metadata: {
        audio_locales: ['ja-JP', 'en-US'],
        episode_count: 24,
        season_count: 2,
        genres: ['Action'],
        tenant_categories: ['Adventure', 'Action'],
      },
      images: {
        portrait: 'portrait.jpg',
        landscape: 'landscape.jpg',
      },
    })

    expect(parsed.seriesId).toBe('series-1')
    expect(parsed.rating).toBe(4.5)
    expect(parsed.votes).toBe(3200)
    expect(parsed.audioLocales).toEqual(['ja-JP', 'en-US'])
    expect(parsed.genreTags).toEqual(['Action', 'Adventure'])
    expect(parsed.portraitImageUrl).toBe('portrait.jpg')
    expect(parsed.landscapeImageUrl).toBe('landscape.jpg')
  })

  it('derives status with playback priority rules', () => {
    const runtime = createCorePrimitivesRuntime()

    expect(runtime.deriveDisplayStatusBase({ fullyWatched: true, statusBase: 'Up Next' }, {})).toBe('Watch Again')
    expect(runtime.deriveDisplayStatusBase({ playheadMs: 1200, statusBase: 'Up Next' }, {})).toBe('Continue')
    expect(runtime.deriveDisplayStatusBase({ neverWatched: true, statusBase: 'Up Next' }, {})).toBe('Start Watching')
  })
})
