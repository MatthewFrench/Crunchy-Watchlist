type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type RuntimeEventRecord = {
  at: number;
  event: string;
  data: BoundaryValue;
};

type RuntimeObject = {
  phase: string;
  events: RuntimeEventRecord[];
};

type RuntimeState = {
  apiTrace?: BoundaryRecord;
};

type RuntimeTraceContext = {
  windowRef: Window & typeof globalThis;
  state: RuntimeState;
  apiTraceLimitPerEndpoint: number;
};

type RuntimeTraceOptions = {
  windowRef?: BoundaryValue;
  state?: BoundaryValue;
  apiTraceLimitPerEndpoint?: BoundaryValue;
};

type RuntimeTraceRuntime = {
  runtime: RuntimeObject;
  runtimeEvent: (event: string, data?: BoundaryValue) => void;
  pushApiTrace: (endpoint: BoundaryValue, record: BoundaryValue) => void;
};

function normalizePositiveInteger(value: BoundaryValue, fallback: number): number {
  const normalizedValue = Number(value);
  if (!Number.isFinite(normalizedValue) || normalizedValue <= 0) {
    return fallback;
  }

  return Math.round(normalizedValue);
}

function getString(value: BoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveWindowRef(value: BoundaryValue): Window & typeof globalThis {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing runtime trace windowRef');
  }

  return value as Window & typeof globalThis;
}

function resolveState(value: BoundaryValue): RuntimeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('[CW] Missing runtime trace state');
  }

  return value as RuntimeState;
}

function createRuntimeObject(windowRef: Window & typeof globalThis): RuntimeObject {
  const existing = windowRef.__CW_WATCHLIST_CURATOR_RUNTIME__;
  if (existing && typeof existing === 'object') {
    if (typeof existing.phase !== 'string') {
      existing.phase = '';
    }
    if (!Array.isArray(existing.events)) {
      existing.events = [];
    }
    return existing as RuntimeObject;
  }

  const created: RuntimeObject = {
    phase: 'boot',
    events: [],
  };
  windowRef.__CW_WATCHLIST_CURATOR_RUNTIME__ = created;
  return created;
}

function cloneJsonValue(value: BoundaryValue): BoundaryValue {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function createRuntimeTraceContext(options: RuntimeTraceOptions = {}): RuntimeTraceContext {
  return {
    windowRef: resolveWindowRef(options.windowRef),
    state: resolveState(options.state),
    apiTraceLimitPerEndpoint: normalizePositiveInteger(options.apiTraceLimitPerEndpoint, 30),
  };
}

function runtimeEventInternal(runtime: RuntimeObject, event: string, data?: BoundaryValue): void {
  runtime.phase = event;
  runtime.events.push({
    at: Date.now(),
    event,
    data: data ?? null,
  });

  if (runtime.events.length > 100) {
    runtime.events.splice(0, runtime.events.length - 100);
  }
}

function pushApiTraceInternal(context: RuntimeTraceContext, endpoint: BoundaryValue, record: BoundaryValue): void {
  const normalizedEndpoint = getString(endpoint);
  if (!normalizedEndpoint || !context.state.apiTrace || typeof context.state.apiTrace !== 'object') {
    return;
  }

  const apiTrace = context.state.apiTrace as BoundaryRecord;
  const bucket = apiTrace[normalizedEndpoint];
  if (!Array.isArray(bucket)) {
    return;
  }

  const normalizedRecord = cloneJsonValue(record);
  if (normalizedRecord == null) {
    return;
  }

  bucket.push(normalizedRecord);
  if (bucket.length > context.apiTraceLimitPerEndpoint) {
    bucket.splice(0, bucket.length - context.apiTraceLimitPerEndpoint);
  }
}

function createRuntimeTrace(options: RuntimeTraceOptions = {}): RuntimeTraceRuntime {
  const context = createRuntimeTraceContext(options);
  const runtime = createRuntimeObject(context.windowRef);

  return {
    runtime,
    runtimeEvent: (event: string, data?: BoundaryValue) => runtimeEventInternal(runtime, event, data),
    pushApiTrace: (endpoint: BoundaryValue, record: BoundaryValue) => pushApiTraceInternal(context, endpoint, record),
  };
}

export function createRuntimeTraceRuntime(): {
  createRuntimeTrace: (options: RuntimeTraceOptions) => RuntimeTraceRuntime;
} {
  return {
    createRuntimeTrace,
  };
}
