type BoundaryValue = CwBoundaryValue;
type DiagnosticsRecord = Record<string, BoundaryValue>;
type ConsoleErrorMethod = (message?: BoundaryValue, ...optionalParams: BoundaryValue[]) => void;
type ConsoleBoundary = {
  error?: BoundaryValue;
};

type BootstrapDiagnosticsOptions = {
  windowRef?: BoundaryValue;
  consoleRef?: BoundaryValue;
};

type BootstrapDiagnosticsRuntime = {
  updateDiagnostics: (patch?: BoundaryValue) => void;
  setBootstrapIssue: (stage: BoundaryValue, details?: BoundaryValue) => void;
};

type WindowWithDiagnostics = Window &
  typeof globalThis & {
    __CW_WATCHLIST_CURATOR_DIAGNOSTICS__?: DiagnosticsRecord;
  };

const root = (typeof window !== 'undefined' ? window : globalThis) as WindowWithDiagnostics;

function toRecord(value: BoundaryValue): DiagnosticsRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as DiagnosticsRecord;
}

function getHref(windowRef: WindowWithDiagnostics): string {
  return typeof windowRef.location?.href === 'string' ? windowRef.location.href : '';
}

function getConsoleError(consoleRef: BoundaryValue): ConsoleErrorMethod | null {
  if (!consoleRef || typeof consoleRef !== 'object') {
    return null;
  }
  const errorMethod = (consoleRef as ConsoleBoundary).error;
  return typeof errorMethod === 'function' ? (errorMethod as ConsoleErrorMethod) : null;
}

export function createBootstrapDiagnosticsRuntime(
  options: BootstrapDiagnosticsOptions = {},
): BootstrapDiagnosticsRuntime {
  const windowRef =
    options.windowRef && typeof options.windowRef === 'object' ? (options.windowRef as WindowWithDiagnostics) : root;
  const consoleError = getConsoleError(options.consoleRef);

  const updateDiagnostics = (patch: BoundaryValue = {}): void => {
    try {
      const existing = toRecord(windowRef.__CW_WATCHLIST_CURATOR_DIAGNOSTICS__);
      windowRef.__CW_WATCHLIST_CURATOR_DIAGNOSTICS__ = {
        ...existing,
        ...toRecord(patch),
        updatedAt: new Date().toISOString(),
        href: getHref(windowRef),
      };
    } catch {
      // no-op
    }
  };

  const setBootstrapIssue = (stage: BoundaryValue, details: BoundaryValue = {}): void => {
    updateDiagnostics({
      ok: false,
      stage,
      ...toRecord(details),
    });
    try {
      consoleError?.(`[CW] ${String(stage || '')}`, details);
    } catch {
      // no-op
    }
  };

  return {
    updateDiagnostics,
    setBootstrapIssue,
  };
}
