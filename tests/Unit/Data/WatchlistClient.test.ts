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
})
