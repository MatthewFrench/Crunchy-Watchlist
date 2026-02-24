import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../helpers/module-registry'

type TokenEntry = {
  accessToken?: string
}

type RatingResult = {
  rating: number | null
  votes: number | null
  distribution: unknown
  description: string
  audioLocales: string[]
  episodeCount: number | null
  seasonCount: number | null
  genreTags: string[]
  preferredAudioLocale?: string
}

type ParsedRatingRecord = {
  seriesId?: string
  rating?: number | null
  votes?: number | null
}

type RatingsClientRuntime = {
  fetchRatingsBatch: (
    tokenEntry: TokenEntry | null,
    seriesIds: unknown,
    preferredAudioLanguage: unknown,
  ) => Promise<ParsedRatingRecord[]>
  fetchRating: (seriesId: unknown, seriesHref: unknown, preferredAudioLanguage: unknown) => Promise<RatingResult>
}

type RatingsClientModule = {
  ratingsClient: {
    createRatingsClient: (options: Record<string, unknown>) => RatingsClientRuntime
  }
}

type ResponseLike = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

const ratingsClientModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'data', 'ratings-client.ts'),
).href

function getRatingsClientModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as RatingsClientModule
  return registry.ratingsClient
}

function createJsonResponse(payload: unknown, status = 200): ResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }
}

function createTextResponse(body: string, status = 200): ResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
    text: async () => body,
  }
}

function createRatingsClientRuntime(overrides: Partial<Record<string, unknown>> = {}) {
  const fetchWithResilience =
    vi.fn<
      (
        url: string,
        requestInit: RequestInit,
        options: {
          label: string
          bearerToken?: string
          refreshBearerToken?: unknown
          maxAttempts?: number
        },
      ) => Promise<ResponseLike>
    >()
  const getAccessToken = vi.fn(async () => ({ accessToken: 'token-123' }))
  const createAuthRefreshHandler = vi.fn(() => undefined)
  const parseRatingPayload = vi.fn((payload: unknown) => {
    const record = payload as Record<string, unknown>
    return {
      rating: typeof record.rating === 'number' ? record.rating : null,
      votes: typeof record.votes === 'number' ? record.votes : null,
    }
  })
  const parseCmsObjectRecord = vi.fn((record: unknown) => {
    const row = record as Record<string, unknown>
    if (typeof row.id !== 'string') {
      return null
    }

    return {
      seriesId: row.id,
      rating: typeof row.rating === 'number' ? row.rating : null,
      votes: typeof row.votes === 'number' ? row.votes : null,
      distribution: null,
      description: '',
      audioLocales: [],
      episodeCount: null,
      seasonCount: null,
      genreTags: [],
    }
  })

  const runtime = getRatingsClientModule().createRatingsClient({
    fetchWithResilience,
    getAccessToken,
    createAuthRefreshHandler,
    resolveApiHref: (pathWithQuery: string) => `https://api.example.test${pathWithQuery}`,
    normalizeAudioLocale: (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : ''),
    getPreferredAudioLanguage: () => 'en-us',
    getLocale: () => 'en-US',
    requirePayloadDataArray: (_endpoint: string, payload: unknown) => {
      const record = payload as Record<string, unknown>
      return Array.isArray(record.data) ? record.data : []
    },
    auditCmsObjectContract: () => {},
    parseCmsObjectRecord,
    parseRatingPayload,
    sanitizeRating: (value: unknown) => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null
      }
      if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
      }
      return null
    },
    sanitizeVotes: (value: unknown) => {
      if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.round(value) : null
      }
      if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? Math.round(parsed) : null
      }
      return null
    },
    pushApiTrace: () => {},
    ...overrides,
  })

  return {
    runtime,
    fetchWithResilience,
    getAccessToken,
    createAuthRefreshHandler,
    parseCmsObjectRecord,
    parseRatingPayload,
  }
}

describe('ratings-client module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([ratingsClientModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('fetchRatingsBatch returns normalized cms records with series ids', async () => {
    const { runtime, fetchWithResilience, createAuthRefreshHandler } = createRatingsClientRuntime()

    fetchWithResilience.mockResolvedValue(
      createJsonResponse({
        data: [
          { id: 'SERIES_A', rating: 4.8, votes: 4200 },
          { id: null, rating: 4.2, votes: 1200 },
        ],
      }),
    )

    const records = await runtime.fetchRatingsBatch({ accessToken: 'token-abc' }, ['SERIES_A', '', null], 'EN-US')

    expect(records).toEqual([
      {
        seriesId: 'SERIES_A',
        rating: 4.8,
        votes: 4200,
        distribution: null,
        description: '',
        audioLocales: [],
        episodeCount: null,
        seasonCount: null,
        genreTags: [],
      },
    ])
    expect(fetchWithResilience).toHaveBeenCalledTimes(1)
    expect(fetchWithResilience.mock.calls[0]?.[0]).toContain('/content/v2/cms/objects/SERIES_A')
    expect(fetchWithResilience.mock.calls[0]?.[0]).toContain('preferred_audio_language=en-us')
    expect(fetchWithResilience.mock.calls[0]?.[2]).toMatchObject({
      label: 'rating batch request',
      bearerToken: 'token-abc',
    })
    expect(createAuthRefreshHandler).toHaveBeenCalledWith({ accessToken: 'token-abc' })
  })

  it('fetchRating falls back to legacy ratings when cms rating is unavailable', async () => {
    const { runtime, fetchWithResilience, parseCmsObjectRecord } = createRatingsClientRuntime()
    parseCmsObjectRecord.mockReturnValue({
      seriesId: 'SERIES_1',
      rating: null,
      votes: null,
      distribution: null,
      description: '',
      audioLocales: [],
      episodeCount: null,
      seasonCount: null,
      genreTags: [],
    })

    fetchWithResilience.mockImplementation(async (_url, _requestInit, options) => {
      if (options.label === 'cms ratings request') {
        return createJsonResponse({
          data: [{ id: 'SERIES_1' }],
        })
      }
      if (options.label === 'legacy rating request') {
        return createJsonResponse({
          rating: 4.2,
          votes: 250,
        })
      }

      throw new Error(`Unexpected label: ${options.label}`)
    })

    const rating = await runtime.fetchRating('SERIES_1', '/series/series-1', 'en-US')

    expect(rating.rating).toBe(4.2)
    expect(rating.votes).toBe(250)
    expect(fetchWithResilience.mock.calls.map((call) => call[2].label)).toEqual([
      'cms ratings request',
      'legacy rating request',
    ])
  })

  it('fetchRating parses series-page html when series id paths are unavailable', async () => {
    const { runtime, fetchWithResilience } = createRatingsClientRuntime({
      getAccessToken: async () => null,
    })
    fetchWithResilience.mockResolvedValue(
      createTextResponse('<script>{"ratingValue":"4.9","ratingCount":"1234"}</script>'),
    )

    const rating = await runtime.fetchRating('', '/series/fallback-series', 'en-US')

    expect(rating.rating).toBe(4.9)
    expect(rating.votes).toBe(1234)
    expect(fetchWithResilience).toHaveBeenCalledTimes(1)
    expect(fetchWithResilience.mock.calls[0]?.[2].label).toBe('series page fetch')
  })
})
