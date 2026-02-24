import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../helpers/module-registry'

type FilterContext = {
  effectiveAudioFilter: string
  effectiveGenreFilter: string
  selectedAudioLocale: string | null
  selectedAudioIsDefaultPreferred: boolean
  localizedAudioForCounts: string | null
}

type CuratedRenderableRuntime = {
  resolveRenderableFilterContext: (settings: Record<string, unknown>) => FilterContext
  mergeRenderableEntry: (entry: Record<string, unknown>, filterContext: FilterContext) => Record<string, unknown>
  buildRenderableEntries: (
    entries: Record<string, unknown>[],
    settings: Record<string, unknown>,
  ) => {
    mode: string
    total: number
    visible: Array<Record<string, unknown>>
    audioOptions: Array<{ optionValue: string; title: string }>
    genreOptions: Array<{ optionValue: string; title: string }>
    selectedAudioFilter: string
    selectedGenreFilter: string
  }
}

type CuratedRenderableModule = {
  runtimeRenderable: {
    createCuratedRenderable: (options: Record<string, unknown>) => CuratedRenderableRuntime
  }
}

const curatedRenderableModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'runtime', 'curated-renderable.ts'),
).href

function getCuratedRenderableModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as CuratedRenderableModule
  return registry.runtimeRenderable
}

function normalizeAudioLocales(locales: unknown[]): string[] {
  if (!Array.isArray(locales)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: string[] = []
  for (const locale of locales) {
    const value = typeof locale === 'string' ? locale.trim() : ''
    if (!value) {
      continue
    }
    const key = value.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    normalized.push(value)
  }
  return normalized
}

function normalizeTagList(values: unknown[]): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(
      (value, index, source) =>
        Boolean(value) && source.findIndex((other) => other.toLowerCase() === value.toLowerCase()) === index,
    )
}

function createCuratedRenderableRuntime(
  options: {
    ratingsBySeriesId?: Record<string, Record<string, unknown>>
    historyBySeriesId?: Record<string, Record<string, unknown>>
    historyBySeriesIdAudio?: Record<string, Record<string, unknown>>
    progressBySeriesId?: Record<string, Record<string, unknown>>
    progressBySeriesIdAudio?: Record<string, Record<string, unknown>>
    preferredAudioLanguage?: string
    deriveDisplayStatusBase?: (entry: unknown, watchHistoryEntry: unknown) => string
    isEntryWatchReady?: (entry: unknown) => boolean
    compareRenderableEntries?: (left: unknown, right: unknown) => number
  } = {},
): CuratedRenderableRuntime {
  const {
    ratingsBySeriesId = {},
    historyBySeriesId = {},
    historyBySeriesIdAudio = {},
    progressBySeriesId = {},
    progressBySeriesIdAudio = {},
    preferredAudioLanguage = 'en-us',
    deriveDisplayStatusBase = (_entry: unknown, watchHistoryEntry: unknown) => (watchHistoryEntry ? 'continue' : 'new'),
    isEntryWatchReady = (entry: unknown) => Boolean((entry as Record<string, unknown>).watchReadyHint),
    compareRenderableEntries = (left: unknown, right: unknown) =>
      Number((left as Record<string, unknown>).sortOrder || 0) -
      Number((right as Record<string, unknown>).sortOrder || 0),
  } = options

  return getCuratedRenderableModule().createCuratedRenderable({
    normalizeAudioLocale: (value: unknown) => {
      if (typeof value !== 'string') {
        return null
      }
      const normalized = value.trim().toLowerCase()
      return normalized || null
    },
    getPreferredAudioLanguage: () => preferredAudioLanguage,
    getCachedRating: (seriesId: unknown) => ratingsBySeriesId[String(seriesId || '')] ?? null,
    getCachedWatchHistory: (seriesId: unknown, audioLocale?: unknown) => {
      const normalizedSeriesId = String(seriesId || '')
      const normalizedAudio = typeof audioLocale === 'string' ? audioLocale.trim().toLowerCase() : ''
      if (normalizedAudio) {
        return historyBySeriesIdAudio[`${normalizedSeriesId}|${normalizedAudio}`] ?? null
      }
      return historyBySeriesId[normalizedSeriesId] ?? null
    },
    getCachedWatchHistoryProgress: (seriesId: unknown, audioLocale?: unknown) => {
      const normalizedSeriesId = String(seriesId || '')
      const normalizedAudio = typeof audioLocale === 'string' ? audioLocale.trim().toLowerCase() : ''
      if (normalizedAudio) {
        return progressBySeriesIdAudio[`${normalizedSeriesId}|${normalizedAudio}`] ?? null
      }
      return progressBySeriesId[normalizedSeriesId] ?? null
    },
    normalizeAudioLocales,
    hasEnUsAudio: (locales: unknown[]) =>
      normalizeAudioLocales(locales).some((locale) => locale.toLowerCase() === 'en-us'),
    normalizeTagList,
    normalizeImageUrlCandidate: (value: unknown) => {
      if (typeof value !== 'string') {
        return null
      }
      const normalized = value.trim()
      return normalized || null
    },
    getAudioLocaleCountFromMap: (map: unknown, audioLocale: unknown) => {
      if (!map || typeof map !== 'object' || Array.isArray(map)) {
        return null
      }
      if (typeof audioLocale !== 'string') {
        return null
      }
      const key = audioLocale.trim().toLowerCase()
      const value = (map as Record<string, unknown>)[key]
      const number = Number(value)
      return Number.isFinite(number) && number > 0 ? Math.round(number) : null
    },
    getLocalizedSeriesCount: () => null,
    sanitizePositiveInt: (value: unknown) => {
      const number = Number(value)
      return Number.isFinite(number) && number > 0 ? Math.round(number) : null
    },
    pickFirstDateMs: (values: unknown[]) => {
      for (const value of values) {
        const number = Number(value)
        if (Number.isFinite(number) && number > 0) {
          return Math.round(number)
        }
      }
      return null
    },
    deriveDisplayStatusBase,
    isEntryWatchReady,
    compareRenderableEntries,
  })
}

describe('curated-renderable runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([curatedRenderableModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('builds renderable entries with merged cache fields and dim filter mode', () => {
    const runtime = createCuratedRenderableRuntime({
      ratingsBySeriesId: {
        'series-1': {
          rating: 4.6,
          votes: 1234,
          audioLocales: ['en-US', 'ja-JP'],
          genreTags: ['Action', 'Drama'],
          description: 'Rating override description',
        },
      },
      historyBySeriesId: {
        'series-1': { datePlayedMs: 1700000000000 },
      },
    })

    const entries = [
      {
        seriesId: 'series-1',
        title: 'First Show',
        audioLocales: ['en-US'],
        genreTags: ['Action'],
        episodeCount: 24,
        seasonCount: 2,
        watchReadyHint: true,
        sortOrder: 2,
      },
      {
        seriesId: 'series-2',
        title: 'Second Show',
        audioLocales: ['en-US'],
        genreTags: ['Action'],
        episodeCount: 12,
        seasonCount: 1,
        watchReadyHint: false,
        sortOrder: 1,
      },
    ]

    const result = runtime.buildRenderableEntries(entries, {
      audioLocaleFilter: 'en-US',
      genreFilter: 'Action',
      watchReadyFilterMode: 'dim',
    })

    expect(result.mode).toBe('dim')
    expect(result.total).toBe(2)
    expect(result.visible).toHaveLength(2)
    expect(result.visible[0]?.seriesId).toBe('series-2')
    expect(result.visible[0]?.dimNotWatchReady).toBe(true)
    expect(result.visible[1]?.rating).toBe(4.6)
    expect(result.visible[1]?.votes).toBe(1234)
    expect(result.visible[1]?.statusBase).toBe('continue')
    expect(result.visible[1]?.description).toBe('Rating override description')
    expect(result.selectedAudioFilter).toBe('en-US')
    expect(result.selectedGenreFilter).toBe('Action')
    expect(result.audioOptions.map((option) => option.optionValue)).toContain('en-US')
    expect(result.genreOptions.map((option) => option.optionValue)).toContain('Action')
  })

  it('falls back to hide mode when watch-ready mode is invalid', () => {
    const runtime = createCuratedRenderableRuntime()

    const result = runtime.buildRenderableEntries(
      [
        { seriesId: 'series-1', audioLocales: ['en-US'], genreTags: ['Action'], watchReadyHint: true },
        { seriesId: 'series-2', audioLocales: ['en-US'], genreTags: ['Action'], watchReadyHint: false },
      ],
      {
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        watchReadyFilterMode: 'invalid-mode',
      },
    )

    expect(result.mode).toBe('hide')
    expect(result.total).toBe(2)
    expect(result.visible).toHaveLength(1)
    expect(result.visible[0]?.seriesId).toBe('series-1')
  })

  it('uses default preferred-audio fallback for progress when localized progress is missing', () => {
    const fallbackProgress = { progressMs: 3000 }
    const runtime = createCuratedRenderableRuntime({
      progressBySeriesId: {
        'series-1': fallbackProgress,
      },
      preferredAudioLanguage: 'en-us',
    })

    const filterContext = runtime.resolveRenderableFilterContext({
      audioLocaleFilter: 'en-US',
      genreFilter: 'any',
    })
    const merged = runtime.mergeRenderableEntry(
      {
        seriesId: 'series-1',
        title: 'First Show',
        audioLocales: ['en-US'],
        genreTags: ['Action'],
        watchReadyHint: true,
      },
      filterContext,
    )

    expect(filterContext.selectedAudioIsDefaultPreferred).toBe(true)
    expect(merged.watchHistoryProgressEntry).toBe(fallbackProgress)
  })

  it('evaluates watch-ready state against the merged status base', () => {
    const runtime = createCuratedRenderableRuntime({
      deriveDisplayStatusBase: () => 'Continue',
      isEntryWatchReady: (entry: unknown) =>
        String((entry as Record<string, unknown>).statusBase || '').toLowerCase() === 'continue',
    })

    const filterContext = runtime.resolveRenderableFilterContext({
      audioLocaleFilter: 'any',
      genreFilter: 'any',
    })
    const merged = runtime.mergeRenderableEntry(
      {
        seriesId: 'series-watch-ready',
        statusBase: 'Up Next',
        audioLocales: ['en-US'],
        genreTags: ['Action'],
      },
      filterContext,
    )

    expect(merged.statusBase).toBe('Continue')
    expect(merged.watchReady).toBe(true)
  })
})
