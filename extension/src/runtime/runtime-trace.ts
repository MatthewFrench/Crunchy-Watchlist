;(() => {
  type RuntimeEventRecord = {
    at: number
    event: string
    data: unknown
  }

  type RuntimeObject = {
    phase: string
    events: RuntimeEventRecord[]
  }

  type RuntimeState = {
    apiTrace?: Record<string, unknown>
  }

  type RuntimeTraceContext = {
    windowRef: Window & typeof globalThis
    state: RuntimeState
    apiTraceLimitPerEndpoint: number
  }

  type RuntimeTraceOptions = {
    windowRef?: unknown
    state?: unknown
    apiTraceLimitPerEndpoint?: unknown
  }

  type RuntimeTraceRuntime = {
    runtime: RuntimeObject
    runtimeEvent: (event: string, data?: unknown) => void
    pushApiTrace: (endpoint: unknown, record: unknown) => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function normalizePositiveInteger(value: unknown, fallback: number): number {
    const normalizedValue = Number(value)
    if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
      return fallback
    }

    return Math.round(normalizedValue)
  }

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
  }

  function resolveWindowRef(value: unknown): Window & typeof globalThis {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing runtime trace windowRef')
    }

    return value as Window & typeof globalThis
  }

  function resolveState(value: unknown): RuntimeState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('[CW] Missing runtime trace state')
    }

    return value as RuntimeState
  }

  function createRuntimeObject(windowRef: Window & typeof globalThis): RuntimeObject {
    const existing = windowRef.__CW_WATCHLIST_CURATOR_RUNTIME__
    if (existing && typeof existing === 'object') {
      if (typeof existing.phase !== 'string') {
        existing.phase = ''
      }
      if (!Array.isArray(existing.events)) {
        existing.events = []
      }
      return existing as RuntimeObject
    }

    const created: RuntimeObject = {
      phase: 'boot',
      events: [],
    }
    windowRef.__CW_WATCHLIST_CURATOR_RUNTIME__ = created
    return created
  }

  function cloneJsonValue(value: unknown): unknown {
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      return null
    }
  }

  function createRuntimeTraceContext(options: RuntimeTraceOptions = {}): RuntimeTraceContext {
    return {
      windowRef: resolveWindowRef(options.windowRef),
      state: resolveState(options.state),
      apiTraceLimitPerEndpoint: normalizePositiveInteger(options.apiTraceLimitPerEndpoint, 30),
    }
  }

  function runtimeEventInternal(runtime: RuntimeObject, event: string, data?: unknown): void {
    runtime.phase = event
    runtime.events.push({
      at: Date.now(),
      event,
      data: data ?? null,
    })

    if (runtime.events.length > 100) {
      runtime.events.splice(0, runtime.events.length - 100)
    }
  }

  function pushApiTraceInternal(context: RuntimeTraceContext, endpoint: unknown, record: unknown): void {
    const normalizedEndpoint = getString(endpoint)
    if (!normalizedEndpoint || !context.state.apiTrace || typeof context.state.apiTrace !== 'object') {
      return
    }

    const apiTrace = context.state.apiTrace as Record<string, unknown>
    const bucket = apiTrace[normalizedEndpoint]
    if (!Array.isArray(bucket)) {
      return
    }

    const normalizedRecord = cloneJsonValue(record)
    if (normalizedRecord == null) {
      return
    }

    bucket.push(normalizedRecord)
    if (bucket.length > context.apiTraceLimitPerEndpoint) {
      bucket.splice(0, bucket.length - context.apiTraceLimitPerEndpoint)
    }
  }

  function createRuntimeTrace(options: RuntimeTraceOptions = {}): RuntimeTraceRuntime {
    const context = createRuntimeTraceContext(options)
    const runtime = createRuntimeObject(context.windowRef)

    return {
      runtime,
      runtimeEvent: (event: string, data?: unknown) => runtimeEventInternal(runtime, event, data),
      pushApiTrace: (endpoint: unknown, record: unknown) => pushApiTraceInternal(context, endpoint, record),
    }
  }

  moduleRegistry.runtimeTrace = {
    createRuntimeTrace,
  }
})()
