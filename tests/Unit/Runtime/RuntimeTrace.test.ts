import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type RuntimeEventRecord = {
  at: number
  event: string
  data: unknown
}

type RuntimeTraceRuntime = {
  runtime: {
    phase: string
    events: RuntimeEventRecord[]
  }
  runtimeEvent: (event: string, data?: unknown) => void
  pushApiTrace: (endpoint: unknown, record: unknown) => void
}

type RuntimeTraceModule = {
  runtimeTrace: {
    createRuntimeTrace: (options: Record<string, unknown>) => RuntimeTraceRuntime
  }
}

const runtimeTraceModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'RuntimeTrace.ts'),
).href

function getRuntimeTraceModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as RuntimeTraceModule
  return registry.runtimeTrace
}

function createState() {
  return {
    apiTrace: {
      watchlist: [] as unknown[],
      watchHistory: [] as unknown[],
    },
  }
}

describe('runtime-trace module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([runtimeTraceModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
    delete (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_RUNTIME__
  })

  it('creates runtime global state and caps event history at 100', () => {
    const state = createState()
    const runtimeTrace = getRuntimeTraceModule().createRuntimeTrace({
      windowRef: globalThis,
      state,
      apiTraceLimitPerEndpoint: 5,
    })

    for (let index = 0; index < 105; index += 1) {
      runtimeTrace.runtimeEvent(`event-${index}`)
    }

    const runtimeGlobal = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_RUNTIME__ as {
      phase: string
      events: RuntimeEventRecord[]
    }
    expect(runtimeGlobal.phase).toBe('event-104')
    expect(runtimeGlobal.events).toHaveLength(100)
    expect(runtimeGlobal.events[0]?.event).toBe('event-5')
    expect(runtimeTrace.runtime.events).toHaveLength(100)
  })

  it('pushes cloned API trace records and enforces endpoint cap', () => {
    const state = createState()
    const runtimeTrace = getRuntimeTraceModule().createRuntimeTrace({
      windowRef: globalThis,
      state,
      apiTraceLimitPerEndpoint: 2,
    })

    const originalRecord = {
      request: { id: 'first' },
      data: [{ seriesId: 'series-1' }],
    }
    runtimeTrace.pushApiTrace('watchlist', originalRecord)
    originalRecord.request.id = 'mutated'
    const firstDataRow = originalRecord.data[0]
    if (!firstDataRow) {
      throw new Error('Missing fixture data row')
    }
    firstDataRow.seriesId = 'mutated-series'

    runtimeTrace.pushApiTrace('watchlist', { request: { id: 'second' } })
    runtimeTrace.pushApiTrace('watchlist', { request: { id: 'third' } })

    expect(state.apiTrace.watchlist).toHaveLength(2)
    expect(state.apiTrace.watchlist[0]).toEqual({ request: { id: 'second' } })
    expect(state.apiTrace.watchlist[1]).toEqual({ request: { id: 'third' } })
  })

  it('ignores unknown apiTrace buckets', () => {
    const state = createState()
    const runtimeTrace = getRuntimeTraceModule().createRuntimeTrace({
      windowRef: globalThis,
      state,
      apiTraceLimitPerEndpoint: 2,
    })

    runtimeTrace.pushApiTrace('preview', { request: { id: 'ignored' } })
    expect(state.apiTrace.watchlist).toEqual([])
    expect(Object.hasOwn(state.apiTrace, 'preview')).toBe(false)
  })

  it('reuses existing runtime object instead of replacing it', () => {
    const existing = {
      phase: 'existing-phase',
      events: [{ at: 1, event: 'existing', data: null }],
    }
    ;(globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_RUNTIME__ = existing

    const runtimeTrace = getRuntimeTraceModule().createRuntimeTrace({
      windowRef: globalThis,
      state: createState(),
      apiTraceLimitPerEndpoint: 2,
    })
    runtimeTrace.runtimeEvent('next-phase')

    const runtimeGlobal = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_RUNTIME__
    expect(runtimeGlobal).toBe(existing)
    expect(existing.phase).toBe('next-phase')
    expect(existing.events).toHaveLength(2)
  })
})
