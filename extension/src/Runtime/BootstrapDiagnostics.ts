;(() => {
  type BootstrapDiagnosticsOptions = {
    windowRef?: unknown
    consoleRef?: unknown
  }

  type BootstrapDiagnosticsRuntime = {
    updateDiagnostics: (patch?: unknown) => void
    setBootstrapIssue: (stage: unknown, details?: unknown) => void
  }

  type WindowWithDiagnostics = Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_DIAGNOSTICS__?: Record<string, unknown>
    }

  const root = (typeof window !== 'undefined' ? window : globalThis) as WindowWithDiagnostics
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as Record<string, unknown>
  }

  function getHref(windowRef: WindowWithDiagnostics): string {
    return typeof windowRef.location?.href === 'string' ? windowRef.location.href : ''
  }

  function getConsoleError(consoleRef: unknown): ((message?: unknown, ...optionalParams: unknown[]) => void) | null {
    if (!consoleRef || typeof consoleRef !== 'object') {
      return null
    }
    const errorMethod = (consoleRef as { error?: unknown }).error
    return typeof errorMethod === 'function'
      ? (errorMethod as (message?: unknown, ...optionalParams: unknown[]) => void)
      : null
  }

  function createBootstrapDiagnostics(options: BootstrapDiagnosticsOptions = {}): BootstrapDiagnosticsRuntime {
    const windowRef =
      options.windowRef && typeof options.windowRef === 'object' ? (options.windowRef as WindowWithDiagnostics) : root
    const consoleError = getConsoleError(options.consoleRef)

    const updateDiagnostics = (patch: unknown = {}): void => {
      try {
        const existing = toRecord(windowRef.__CW_WATCHLIST_CURATOR_DIAGNOSTICS__)
        windowRef.__CW_WATCHLIST_CURATOR_DIAGNOSTICS__ = {
          ...existing,
          ...toRecord(patch),
          updatedAt: new Date().toISOString(),
          href: getHref(windowRef),
        }
      } catch {
        // no-op
      }
    }

    const setBootstrapIssue = (stage: unknown, details: unknown = {}): void => {
      updateDiagnostics({
        ok: false,
        stage,
        ...toRecord(details),
      })
      try {
        consoleError?.(`[CW] ${String(stage || '')}`, details)
      } catch {
        // no-op
      }
    }

    return {
      updateDiagnostics,
      setBootstrapIssue,
    }
  }

  moduleRegistry.runtimeBootstrapDiagnostics = {
    createBootstrapDiagnostics,
  }
})()
