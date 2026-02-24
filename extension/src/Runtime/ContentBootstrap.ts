;(() => {
  type AnyFn = (...args: unknown[]) => unknown
  type LooseRecord = Record<string, unknown>

  type DiagnosticsRuntime = {
    updateDiagnostics: (payload: unknown) => void
    setBootstrapIssue: (reason: string, payload?: unknown) => void
  }

  type ContentBootstrapPrelude = {
    ok: boolean
    updateDiagnostics?: DiagnosticsRuntime['updateDiagnostics']
    setBootstrapIssue?: DiagnosticsRuntime['setBootstrapIssue']
    runtimeBootstrapGateModule?: LooseRecord
    runtimeBootstrapModulesModule?: LooseRecord
    runtimeBootstrapFinalizeModule?: LooseRecord
    bootstrapModulesRuntime?: LooseRecord
  }

  type ContentBootstrapOptions = {
    windowRef?: Window & typeof globalThis
    consoleRef?: Console
    browserRef?: unknown
    chromeRef?: unknown
  }

  type BootstrapRuntimeModules = {
    runtimeBootstrapModulesModule: LooseRecord
    runtimeBootstrapFinalizeModule: LooseRecord
    bootstrapModulesRuntime: LooseRecord
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function toRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object') {
      return {}
    }
    return value as LooseRecord
  }

  function hasMethods(value: unknown, methodNames: string[]): boolean {
    const record = toRecord(value)
    return methodNames.every((methodName) => typeof record[methodName] === 'function')
  }

  function toDiagnosticsRuntime(value: unknown): DiagnosticsRuntime | null {
    const runtime = toRecord(value)
    if (typeof runtime.updateDiagnostics !== 'function' || typeof runtime.setBootstrapIssue !== 'function') {
      return null
    }
    return runtime as DiagnosticsRuntime
  }

  function resolveDiagnosticsRuntime(
    windowRef: Window & typeof globalThis,
    consoleRef: Console,
  ): DiagnosticsRuntime | null {
    const runtimeBootstrapDiagnosticsModule = toRecord(moduleRegistry.runtimeBootstrapDiagnostics)
    if (!hasMethods(runtimeBootstrapDiagnosticsModule, ['createBootstrapDiagnostics'])) {
      // eslint-disable-next-line no-console
      consoleRef.error('[CW] missing-bootstrap-diagnostics-module')
      return null
    }

    const diagnosticsRuntime = toDiagnosticsRuntime(
      (runtimeBootstrapDiagnosticsModule.createBootstrapDiagnostics as AnyFn)({
        windowRef,
        consoleRef,
      }),
    )
    if (!diagnosticsRuntime) {
      // eslint-disable-next-line no-console
      consoleRef.error('[CW] invalid-bootstrap-diagnostics-runtime')
      return null
    }
    return diagnosticsRuntime
  }

  function resolveGateModule(
    options: ContentBootstrapOptions,
    diagnosticsRuntime: DiagnosticsRuntime,
    windowRef: Window & typeof globalThis,
  ): LooseRecord | null {
    const runtimeBootstrapGateModule = toRecord(moduleRegistry.runtimeBootstrapGate)
    if (
      !hasMethods(runtimeBootstrapGateModule, [
        'shouldRun',
        'isWatchlistPath',
        'getWatchlistRoot',
        'getWatchlistHeader',
      ])
    ) {
      diagnosticsRuntime.setBootstrapIssue('missing-bootstrap-gate-module')
      return null
    }

    const shouldRun = (runtimeBootstrapGateModule.shouldRun as AnyFn)({
      windowRef,
      browserRef: options.browserRef,
      chromeRef: options.chromeRef,
    })
    if (!shouldRun) {
      diagnosticsRuntime.updateDiagnostics({
        ok: false,
        stage: 'bootstrap-gated',
        pathname: windowRef.location?.pathname || '',
        inTopFrame: windowRef.top === windowRef,
      })
      return null
    }

    return runtimeBootstrapGateModule
  }

  function resolveBootstrapRuntimeModules(
    windowRef: Window & typeof globalThis,
    setBootstrapIssue: DiagnosticsRuntime['setBootstrapIssue'],
  ): BootstrapRuntimeModules | null {
    const runtimeBootstrapModulesModule = toRecord(moduleRegistry.runtimeBootstrapModules)
    if (!hasMethods(runtimeBootstrapModulesModule, ['createBootstrapModules', 'assertRuntimeMethods'])) {
      setBootstrapIssue('missing-bootstrap-modules-module')
      return null
    }

    const runtimeBootstrapFinalizeModule = toRecord(moduleRegistry.runtimeBootstrapFinalize)
    if (
      !hasMethods(runtimeBootstrapFinalizeModule, [
        'createBootstrapFinalizeRuntime',
        'createStorageAccessors',
        'safeJsonParse',
      ])
    ) {
      setBootstrapIssue('missing-bootstrap-finalize-module')
      return null
    }

    const bootstrapModulesRuntime = toRecord(
      (runtimeBootstrapModulesModule.createBootstrapModules as AnyFn)({
        windowRef,
      }),
    )
    if (Object.keys(bootstrapModulesRuntime).length === 0) {
      setBootstrapIssue('invalid-bootstrap-modules-runtime')
      return null
    }

    return {
      runtimeBootstrapModulesModule,
      runtimeBootstrapFinalizeModule,
      bootstrapModulesRuntime,
    }
  }

  function createContentBootstrapPrelude(options: ContentBootstrapOptions = {}): ContentBootstrapPrelude {
    const windowRef = options.windowRef || root
    const consoleRef = options.consoleRef || console
    const diagnosticsRuntime = resolveDiagnosticsRuntime(windowRef, consoleRef)
    if (!diagnosticsRuntime) {
      return { ok: false }
    }
    diagnosticsRuntime.updateDiagnostics({
      ok: false,
      stage: 'content-script-loaded',
      pathname: windowRef.location?.pathname || '',
    })

    const runtimeBootstrapGateModule = resolveGateModule(options, diagnosticsRuntime, windowRef)
    if (!runtimeBootstrapGateModule) {
      return { ok: false }
    }
    diagnosticsRuntime.updateDiagnostics({ ok: false, stage: 'bootstrap-started' })

    const runtimeModules = resolveBootstrapRuntimeModules(windowRef, diagnosticsRuntime.setBootstrapIssue)
    if (!runtimeModules) {
      return { ok: false }
    }

    return {
      ok: true,
      updateDiagnostics: diagnosticsRuntime.updateDiagnostics,
      setBootstrapIssue: diagnosticsRuntime.setBootstrapIssue,
      runtimeBootstrapGateModule,
      runtimeBootstrapModulesModule: runtimeModules.runtimeBootstrapModulesModule,
      runtimeBootstrapFinalizeModule: runtimeModules.runtimeBootstrapFinalizeModule,
      bootstrapModulesRuntime: runtimeModules.bootstrapModulesRuntime,
    }
  }

  let runtimeRegistry = moduleRegistry.runtimeContentBootstrap
  if (!runtimeRegistry || typeof runtimeRegistry !== 'object') {
    runtimeRegistry = {}
    moduleRegistry.runtimeContentBootstrap = runtimeRegistry
  }

  ;(runtimeRegistry as LooseRecord).createContentBootstrapPrelude = createContentBootstrapPrelude
})()
