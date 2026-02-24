import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type ResponseLike = {
  ok: boolean
  json: () => Promise<unknown>
}

type PreviewRepositoryRuntime = {
  fetchPreviewUrlForEntry: (entry: unknown) => Promise<string | null>
}

type PreviewRepositoryModule = {
  previewRepository: {
    createPreviewRepository: (options: Record<string, unknown>) => PreviewRepositoryRuntime
  }
}

type PreviewState = {
  previewCache: Record<string, string | null>
  previewInflight: Map<string, Promise<string | null>>
}

const previewRepositoryModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'PreviewRepository.ts'),
).href

function getPreviewRepositoryModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as PreviewRepositoryModule
  return registry.previewRepository
}

function createRuntime(overrides: Partial<Record<string, unknown>> = {}) {
  const state: PreviewState = {
    previewCache: {},
    previewInflight: new Map(),
  }

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
      ) => Promise<ResponseLike>
    >()
  const getAccessToken = vi.fn(async () => ({ accessToken: 'token-123' }))
  const createAuthRefreshHandler = vi.fn(() => undefined)
  const pushApiTrace = vi.fn()
  const runtimeEvent = vi.fn()

  const runtime = getPreviewRepositoryModule().createPreviewRepository({
    state,
    resolveApiHref: (value: unknown) => {
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

      if (trimmed.startsWith('/')) {
        return `https://api.example.test${trimmed}`
      }

      return ''
    },
    getAccessToken,
    fetchWithResilience,
    createAuthRefreshHandler,
    pushApiTrace,
    runtimeEvent,
    ...overrides,
  })

  return {
    runtime,
    state,
    fetchWithResilience,
    getAccessToken,
    createAuthRefreshHandler,
    pushApiTrace,
    runtimeEvent,
  }
}

describe('preview-repository module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([previewRepositoryModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('records a contract warning when preview payload root is not an object', async () => {
    const { runtime, state, fetchWithResilience, runtimeEvent } = createRuntime()
    fetchWithResilience.mockResolvedValue({
      ok: true,
      json: async () => ['invalid'],
    })

    const previewUrl = await runtime.fetchPreviewUrlForEntry({
      seriesId: 'SERIES_A',
      streamsLink: '/content/v2/cms/streams/SERIES_A',
    })

    expect(previewUrl).toBeNull()
    expect(state.previewCache['streams:https://api.example.test/content/v2/cms/streams/SERIES_A']).toBeNull()
    expect(runtimeEvent).toHaveBeenCalledWith(
      'preview-contract-warning',
      expect.objectContaining({
        reason: 'invalid-payload-root',
        seriesId: 'SERIES_A',
      }),
    )
  })

  it('records a contract warning when preview response json parsing fails', async () => {
    const { runtime, fetchWithResilience, runtimeEvent } = createRuntime()
    fetchWithResilience.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('invalid json')
      },
    })

    const previewUrl = await runtime.fetchPreviewUrlForEntry({
      seriesId: 'SERIES_B',
      streamsLink: '/content/v2/cms/streams/SERIES_B',
    })

    expect(previewUrl).toBeNull()
    expect(runtimeEvent).toHaveBeenCalledWith(
      'preview-contract-warning',
      expect.objectContaining({
        reason: 'invalid-json-payload',
        seriesId: 'SERIES_B',
      }),
    )
  })

  it('deduplicates inflight preview requests for the same entry', async () => {
    const { runtime, fetchWithResilience } = createRuntime()
    const deferred: {
      resolve: ((value: ResponseLike) => void) | null
    } = {
      resolve: null,
    }
    fetchWithResilience.mockImplementation(
      async () =>
        new Promise<ResponseLike>((resolve) => {
          deferred.resolve = (value: ResponseLike) => {
            resolve(value)
          }
        }),
    )

    const entry = {
      seriesId: 'SERIES_C',
      streamsLink: '/content/v2/cms/streams/SERIES_C',
    }

    const first = runtime.fetchPreviewUrlForEntry(entry)
    const second = runtime.fetchPreviewUrlForEntry(entry)
    await Promise.resolve()

    expect(fetchWithResilience).toHaveBeenCalledTimes(1)

    if (typeof deferred.resolve !== 'function') {
      throw new Error('Expected preview request promise resolver to be initialized')
    }

    deferred.resolve({
      ok: true,
      json: async () => ({
        streams: {
          adaptive_hls: {
            url: '/video/series-c-preview.m3u8',
          },
        },
      }),
    })

    await expect(first).resolves.toBe('https://api.example.test/video/series-c-preview.m3u8')
    await expect(second).resolves.toBe('https://api.example.test/video/series-c-preview.m3u8')
  })

  it('returns null without requesting preview data when streams link is missing', async () => {
    const { runtime, fetchWithResilience } = createRuntime()

    const previewUrl = await runtime.fetchPreviewUrlForEntry({
      seriesId: 'SERIES_D',
      panelId: 'episode-1',
    })

    expect(previewUrl).toBeNull()
    expect(fetchWithResilience).not.toHaveBeenCalled()
  })
})
