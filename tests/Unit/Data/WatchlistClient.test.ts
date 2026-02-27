import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type WatchlistClientRuntime = {
  fetchAllWatchlistRows: (tokenEntry: unknown) => Promise<Record<string, unknown>[]>
}

type WatchlistClientModule = {
  watchlistClient: {
    createWatchlistClient: (options: Record<string, unknown>) => WatchlistClientRuntime
  }
}

const watchlistClientModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'WatchlistClient.ts'),
).href

function getWatchlistClientModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as WatchlistClientModule
  return registry.watchlistClient
}

function createWatchlistRow(seriesId: string): Record<string, unknown> {
  return {
    panel: {
      id: `${seriesId}-episode-1`,
      episode_metadata: {
        series_id: seriesId,
      },
    },
  }
}

function createRuntime(overrides: Partial<Record<string, unknown>> = {}) {
  const fetchWithResilience =
    vi.fn<
      (
        url: string,
        requestInit: RequestInit,
        options: {
          label: string
          bearerToken?: string
          refreshBearerToken?: unknown
        },
      ) => Promise<Response>
    >()
  const createAuthRefreshHandler = vi.fn(() => undefined)
  const auditWatchlistRowsContract = vi.fn()
  const pushApiTrace = vi.fn()
  const runtimeEvent = vi.fn()

  const runtime = getWatchlistClientModule().createWatchlistClient({
    fetchWithResilience,
    createAuthRefreshHandler,
    resolveApiHref: (pathWithQuery: string) => `https://api.example.test${pathWithQuery}`,
    requirePayloadDataArray: (_endpoint: string, payload: unknown) => {
      const record = payload as Record<string, unknown>
      if (!Array.isArray(record.data)) {
        throw new Error('invalid payload data')
      }
      return record.data as Record<string, unknown>[]
    },
    auditWatchlistRowsContract,
    getPreferredAudioLanguage: () => 'en-us',
    getLocale: () => 'en-US',
    getWatchlistSeriesId: (row: Record<string, unknown>) => {
      const panel = row.panel as Record<string, unknown> | undefined
      const episodeMetadata = panel?.episode_metadata as Record<string, unknown> | undefined
      return typeof episodeMetadata?.series_id === 'string' ? episodeMetadata.series_id : null
    },
    pushApiTrace,
    runtimeEvent,
    watchlistPageSize: 100,
    watchlistMaxPages: 30,
    watchlistParallelRequests: 4,
    ...overrides,
  })

  return {
    runtime,
    fetchWithResilience,
    createAuthRefreshHandler,
    auditWatchlistRowsContract,
    pushApiTrace,
    runtimeEvent,
  }
}

describe('watchlist-client module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([watchlistClientModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('emits contract warning and falls back to row count when payload total is invalid', async () => {
    const { runtime, fetchWithResilience, runtimeEvent } = createRuntime()
    fetchWithResilience.mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 'invalid',
          data: [createWatchlistRow('SERIES_A')],
        }),
        { status: 200 },
      ),
    )

    const rows = await runtime.fetchAllWatchlistRows({
      accountId: 'fixture-account',
      accessToken: 'fixture-token',
    })

    expect(rows).toHaveLength(1)
    expect(runtimeEvent).toHaveBeenCalledWith(
      'watchlist-contract-warning',
      expect.objectContaining({
        reason: 'invalid-total-value',
      }),
    )
  })

  it('fails early with contract warning when account id is missing', async () => {
    const { runtime, fetchWithResilience, runtimeEvent } = createRuntime()

    await expect(
      runtime.fetchAllWatchlistRows({
        accessToken: 'fixture-token',
      }),
    ).rejects.toThrow(/missing account id/)

    expect(fetchWithResilience).not.toHaveBeenCalled()
    expect(runtimeEvent).toHaveBeenCalledWith(
      'watchlist-contract-warning',
      expect.objectContaining({
        reason: 'missing-account-id',
      }),
    )
  })

  it('emits contract warning when response json payload is invalid', async () => {
    const { runtime, fetchWithResilience, runtimeEvent } = createRuntime()
    fetchWithResilience.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid json')
      },
    } as unknown as Response)

    await expect(
      runtime.fetchAllWatchlistRows({
        accountId: 'fixture-account',
        accessToken: 'fixture-token',
      }),
    ).rejects.toThrow(/payload parse failed/)

    expect(runtimeEvent).toHaveBeenCalledWith(
      'watchlist-contract-warning',
      expect.objectContaining({
        reason: 'invalid-json-payload',
      }),
    )
  })

  it('fetches remaining pages in bounded parallel batches after first page', async () => {
    const { runtime, fetchWithResilience } = createRuntime({
      watchlistPageSize: 2,
      watchlistMaxPages: 10,
      watchlistParallelRequests: 2,
    })

    const payloadByStart = new Map<number, { total: number; data: Record<string, unknown>[] }>([
      [0, { total: 6, data: [createWatchlistRow('SERIES_A'), createWatchlistRow('SERIES_B')] }],
      [2, { total: 6, data: [createWatchlistRow('SERIES_C'), createWatchlistRow('SERIES_D')] }],
      [4, { total: 6, data: [createWatchlistRow('SERIES_E'), createWatchlistRow('SERIES_F')] }],
    ])

    fetchWithResilience.mockImplementation(async (url) => {
      const parsed = new URL(url)
      const start = Number(parsed.searchParams.get('start') || '0')
      const payload = payloadByStart.get(start)
      if (!payload) {
        return new Response(JSON.stringify({ total: 0, data: [] }), { status: 200 })
      }
      return new Response(JSON.stringify(payload), { status: 200 })
    })

    const rows = await runtime.fetchAllWatchlistRows({
      accountId: 'fixture-account',
      accessToken: 'fixture-token',
    })

    expect(rows).toHaveLength(6)
    expect(fetchWithResilience).toHaveBeenCalledTimes(3)
    const requestUrls = fetchWithResilience.mock.calls.map((call) => String(call[0]))
    expect(requestUrls[0]).toContain('/watchlist?')
    expect(requestUrls[0]).not.toContain('start=')
    expect(requestUrls.some((url) => url.includes('start=2'))).toBe(true)
    expect(requestUrls.some((url) => url.includes('start=4'))).toBe(true)
  })
})
