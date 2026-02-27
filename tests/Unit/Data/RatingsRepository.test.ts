import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type RatingCacheEntry = {
  rating: number | null
  votes: number | null
  distribution: unknown
  audioLocales: string[]
  description: string
  episodeCount: number | null
  seasonCount: number | null
  genreTags: string[]
  portraitImageUrl?: string | null
  landscapeImageUrl?: string | null
  episodeCountByAudioLocale: Record<string, number>
  seasonCountByAudioLocale: Record<string, number>
  updatedAt: number
}

type RatingsRepositoryRuntime = {
  getSeriesRating: (seriesId: unknown, seriesHref: unknown) => Promise<RatingCacheEntry>
  preloadRatingsForEntries: (entries: unknown, tokenEntry: unknown, preferredAudioLanguage: unknown) => Promise<void>
  getCachedRating: (seriesId: unknown) => RatingCacheEntry | null
  isLocalizedRatingDataMissingForEntries: (entries: unknown, audioLocale: unknown) => boolean
}

type RatingsRepositoryModule = {
  ratingsRepository: {
    createRatingsRepository: (options: Record<string, unknown>) => RatingsRepositoryRuntime
  }
}

type RatingsRepositoryState = {
  ratingCache: Record<string, RatingCacheEntry>
  ratingCacheRevision?: number
  ratingInflight: Map<string, Promise<RatingCacheEntry>>
}

const ratingsRepositoryModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'RatingsRepository.ts'),
).href
const ratingsRepositoryCacheSupportModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'RatingsRepositoryCacheSupport.ts'),
).href

function getRatingsRepositoryModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as RatingsRepositoryModule
  return registry.ratingsRepository
}

function normalizeAudioLocale(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function sanitizePositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const rounded = Math.round(parsed)
  return rounded > 0 ? rounded : null
}

function normalizeImageUrlCandidate(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return ''
}

function createRuntime(overrides: Partial<Record<string, unknown>> = {}) {
  const state: RatingsRepositoryState = {
    ratingCache: {},
    ratingCacheRevision: 0,
    ratingInflight: new Map(),
  }
  const fetchRatingsBatch = vi.fn<
    (
      tokenEntry: unknown,
      seriesIds: string[],
      preferredAudioLanguage: string,
    ) => Promise<Array<Record<string, unknown>>>
  >(async () => [])
  const fetchRating = vi.fn<(seriesId: string, seriesHref: string) => Promise<unknown>>(async () => ({
    rating: 4.3,
    votes: 250,
    distribution: null,
    description: '',
    audioLocales: ['en-us'],
    episodeCount: 12,
    seasonCount: 1,
    genreTags: [],
  }))
  const scheduleSaveRatings = vi.fn()
  const runtimeEvent = vi.fn()

  const runtime = getRatingsRepositoryModule().createRatingsRepository({
    state,
    normalizeAudioLocale,
    normalizeAudioLocales: (values: unknown[]) =>
      Array.from(new Set(values.map((value) => normalizeAudioLocale(value)).filter(Boolean))),
    sanitizePositiveInt,
    normalizeTagList: (values: unknown[]) =>
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    normalizeImageUrlCandidate,
    getAudioLocaleCountFromMap: (value: unknown, audioLocale: string) => {
      if (!value || typeof value !== 'object') {
        return null
      }
      const record = value as Record<string, unknown>
      return sanitizePositiveInt(record[audioLocale])
    },
    mergeAudioLocaleCountMap: (value: unknown, audioLocale: string, count: number | null) => {
      const record = value && typeof value === 'object' ? { ...(value as Record<string, number>) } : {}
      if (audioLocale && count != null) {
        record[audioLocale] = count
      }
      return record
    },
    getPreferredAudioLanguage: () => 'en-us',
    chunkArray: <T>(values: T[], chunkSize: number): T[][] => {
      const safeSize = Math.max(1, chunkSize)
      const chunks: T[][] = []
      for (let index = 0; index < values.length; index += safeSize) {
        chunks.push(values.slice(index, index + safeSize))
      }
      return chunks
    },
    fetchRatingsBatch,
    fetchRating,
    scheduleSaveRatings,
    runtimeEvent,
    ratingBatchSize: 50,
    ratingBatchParallelChunks: 2,
    ratingCacheTtlMs: 60_000,
    ...overrides,
  })

  return {
    runtime,
    state,
    fetchRatingsBatch,
    fetchRating,
    scheduleSaveRatings,
    runtimeEvent,
  }
}

async function flushMicrotasks(iterations = 4): Promise<void> {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve()
  }
}

describe('ratings-repository module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([ratingsRepositoryCacheSupportModuleUrl, ratingsRepositoryModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('emits contract warnings for invalid batch rows while still updating valid ratings', async () => {
    const { runtime, state, fetchRatingsBatch, runtimeEvent, scheduleSaveRatings } = createRuntime()
    fetchRatingsBatch.mockResolvedValue([
      {
        seriesId: 'SERIES_A',
        rating: 4.9,
        votes: 3000,
        distribution: { '5': 1900, '4': 700, '3': 200, '2': 100, '1': 100 },
        description: 'Great',
        audioLocales: ['en-US'],
        episodeCount: 24,
        seasonCount: 2,
        genreTags: ['Action'],
        portraitImageUrl: 'https://img.example.test/portrait.jpg',
        landscapeImageUrl: 'https://img.example.test/landscape.jpg',
      },
      {
        seriesId: null,
        rating: 4.2,
      },
    ])

    await runtime.preloadRatingsForEntries(
      [{ seriesId: 'SERIES_A' }, { seriesId: 'SERIES_B' }],
      { accessToken: 'token-123' },
      'en-US',
    )

    expect(state.ratingCache.SERIES_A?.rating).toBe(4.9)
    expect(state.ratingCache.SERIES_B).toBeUndefined()
    expect(scheduleSaveRatings).toHaveBeenCalledTimes(1)

    expect(runtimeEvent).toHaveBeenCalledWith(
      'ratings-contract-warning',
      expect.objectContaining({
        scope: 'preloadRatingsForEntries',
        reason: 'invalid-batch-record',
        invalidRecords: 1,
      }),
    )
    expect(runtimeEvent).toHaveBeenCalledWith(
      'ratings-preload',
      expect.objectContaining({
        preferredAudioLanguage: 'en-us',
        updated: 1,
        invalidRecords: 1,
      }),
    )
  })

  it('normalizes malformed single-series rating payloads and records a contract warning', async () => {
    const { runtime, fetchRating, runtimeEvent, scheduleSaveRatings } = createRuntime()
    fetchRating.mockResolvedValue('unexpected-value')

    const entry = await runtime.getSeriesRating('SERIES_X', '/series/series-x')
    const cached = runtime.getCachedRating('SERIES_X')

    expect(entry.rating).toBeNull()
    expect(entry.votes).toBeNull()
    expect(entry.audioLocales).toEqual([])
    expect(cached).toBeTruthy()
    expect(scheduleSaveRatings).toHaveBeenCalledTimes(1)

    expect(runtimeEvent).toHaveBeenCalledWith(
      'ratings-contract-warning',
      expect.objectContaining({
        scope: 'getSeriesRating',
        reason: 'invalid-rating-payload-root',
        seriesId: 'SERIES_X',
      }),
    )
  })

  it('treats numeric-string batch values as valid typed rating updates', async () => {
    const { runtime, state, fetchRatingsBatch } = createRuntime()
    fetchRatingsBatch.mockResolvedValue([
      {
        seriesId: 'SERIES_TYPED',
        rating: '4.6',
        votes: '420',
        distribution: null,
        description: 'Typed record',
        audioLocales: ['en-US'],
        episodeCount: '10',
        seasonCount: '1',
        genreTags: ['Adventure'],
      },
    ])

    await runtime.preloadRatingsForEntries([{ seriesId: 'SERIES_TYPED' }], { accessToken: 'token-abc' }, 'en-US')

    expect(state.ratingCache.SERIES_TYPED?.rating).toBe(4.6)
    expect(state.ratingCache.SERIES_TYPED?.votes).toBe(420)
    expect(state.ratingCache.SERIES_TYPED?.episodeCount).toBe(10)
    expect(state.ratingCache.SERIES_TYPED?.seasonCount).toBe(1)
    expect(state.ratingCache.SERIES_TYPED?.audioLocales).toEqual(['en-us'])
  })

  it('fetches stale rating batches with bounded parallel chunk concurrency', async () => {
    const { runtime, fetchRatingsBatch } = createRuntime({
      ratingBatchSize: 1,
      ratingBatchParallelChunks: 2,
    })

    let activeRequests = 0
    let maxActiveRequests = 0
    const unblockQueue: Array<() => void> = []

    fetchRatingsBatch.mockImplementation(async (_tokenEntry, seriesIds: string[]) => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await new Promise<void>((resolve) => {
        unblockQueue.push(resolve)
      })
      activeRequests -= 1
      return seriesIds.map((seriesId) => ({
        seriesId,
        rating: 4.0,
        votes: 100,
        distribution: null,
        description: '',
        audioLocales: ['en-US'],
        episodeCount: 10,
        seasonCount: 1,
        genreTags: [],
      }))
    })

    const preloadPromise = runtime.preloadRatingsForEntries(
      [{ seriesId: 'SERIES_A' }, { seriesId: 'SERIES_B' }, { seriesId: 'SERIES_C' }],
      { accessToken: 'token-123' },
      'en-US',
    )

    await flushMicrotasks()
    expect(maxActiveRequests).toBe(2)

    while (unblockQueue.length) {
      const unblock = unblockQueue.shift()
      unblock?.()
      await flushMicrotasks(1)
    }

    await preloadPromise
    expect(fetchRatingsBatch).toHaveBeenCalledTimes(3)
  })
})
