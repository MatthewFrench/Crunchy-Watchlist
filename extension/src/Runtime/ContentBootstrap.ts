import { createBootstrapDiagnosticsRuntime } from './BootstrapDiagnostics.js';
import { createBootstrapFinalizeRuntimeModule } from './BootstrapFinalize.js';
import { createBootstrapGateRuntime } from './BootstrapGate.js';
import { createBootstrapModulesRuntime } from './BootstrapModules.js';

type RuntimeFn = (...args: unknown[]) => unknown;
type LooseRecord = Record<string, unknown>;

type DiagnosticsRuntime = {
  updateDiagnostics: (payload: unknown) => void;
  setBootstrapIssue: (reason: string, payload?: unknown) => void;
};

type BootstrapGateContracts = {
  isWatchlistPath: (pathname: string) => boolean;
  getWatchlistRoot: (documentRef: Document) => Element | null;
  getWatchlistHeader: (documentRef: Document) => Element | null;
};

type ContentBootstrapPrelude = {
  ok: boolean;
  updateDiagnostics?: DiagnosticsRuntime['updateDiagnostics'];
  setBootstrapIssue?: DiagnosticsRuntime['setBootstrapIssue'];
  isWatchlistPath?: BootstrapGateContracts['isWatchlistPath'];
  getWatchlistRoot?: BootstrapGateContracts['getWatchlistRoot'];
  getWatchlistHeader?: BootstrapGateContracts['getWatchlistHeader'];
  assertRuntimeMethods?: RuntimeFn;
  bootstrapModulesRuntime?: LooseRecord;
};

type ContentBootstrapOptions = {
  windowRef?: Window & typeof globalThis;
  consoleRef?: Console;
  browserRef?: unknown;
  chromeRef?: unknown;
  runtimeBootstrapDiagnosticsModule?: object;
  runtimeBootstrapGateModule?: object;
  runtimeBootstrapModulesModule?: object;
  runtimeBootstrapFinalizeModule?: object;
};

type BootstrapRuntimeModules = {
  assertRuntimeMethods: RuntimeFn;
  bootstrapModulesRuntime: LooseRecord;
};

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
  root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
}
const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as LooseRecord;
}

function hasMethods(value: unknown, methodNames: string[]): boolean {
  const record = toRecord(value);
  return methodNames.every((methodName) => typeof record[methodName] === 'function');
}

function toDiagnosticsRuntime(value: unknown): DiagnosticsRuntime | null {
  const runtime = toRecord(value);
  if (typeof runtime.updateDiagnostics !== 'function' || typeof runtime.setBootstrapIssue !== 'function') {
    return null;
  }
  return runtime as DiagnosticsRuntime;
}

function resolveDiagnosticsRuntime(
  options: ContentBootstrapOptions,
  windowRef: Window & typeof globalThis,
  consoleRef: Console,
): DiagnosticsRuntime | null {
  const diagnosticsModule = toRecord(options.runtimeBootstrapDiagnosticsModule);
  if (hasMethods(diagnosticsModule, ['createBootstrapDiagnostics'])) {
    const diagnosticsRuntime = toDiagnosticsRuntime(
      (diagnosticsModule.createBootstrapDiagnostics as RuntimeFn)({
        windowRef,
        consoleRef,
      }),
    );
    if (!diagnosticsRuntime) {
      // eslint-disable-next-line no-console
      consoleRef.error('[CW] invalid-bootstrap-diagnostics-runtime');
      return null;
    }

    return diagnosticsRuntime;
  }

  try {
    const fallbackRuntimeOrModule = createBootstrapDiagnosticsRuntime({
      windowRef,
      consoleRef,
    });
    const fallbackRuntime = toDiagnosticsRuntime(fallbackRuntimeOrModule);
    if (fallbackRuntime) {
      return fallbackRuntime;
    }

    const fallbackModule = toRecord(fallbackRuntimeOrModule);
    if (hasMethods(fallbackModule, ['createBootstrapDiagnostics'])) {
      const moduleRuntime = toDiagnosticsRuntime(
        (fallbackModule.createBootstrapDiagnostics as RuntimeFn)({
          windowRef,
          consoleRef,
        }),
      );
      if (moduleRuntime) {
        return moduleRuntime;
      }
      // eslint-disable-next-line no-console
      consoleRef.error('[CW] invalid-bootstrap-diagnostics-runtime');
      return null;
    }
  } catch {
    // no-op
  }

  // eslint-disable-next-line no-console
  consoleRef.error('[CW] missing-bootstrap-diagnostics-module');
  return null;
}

function resolveGateModule(
  options: ContentBootstrapOptions,
  diagnosticsRuntime: DiagnosticsRuntime,
  windowRef: Window & typeof globalThis,
): BootstrapGateContracts | null {
  let runtimeBootstrapGateModule = toRecord(options.runtimeBootstrapGateModule);
  if (
    !hasMethods(runtimeBootstrapGateModule, ['shouldRun', 'isWatchlistPath', 'getWatchlistRoot', 'getWatchlistHeader'])
  ) {
    try {
      runtimeBootstrapGateModule = toRecord(createBootstrapGateRuntime());
    } catch {
      runtimeBootstrapGateModule = {};
    }
  }
  if (
    !hasMethods(runtimeBootstrapGateModule, ['shouldRun', 'isWatchlistPath', 'getWatchlistRoot', 'getWatchlistHeader'])
  ) {
    diagnosticsRuntime.setBootstrapIssue('missing-bootstrap-gate-module');
    return null;
  }

  const shouldRun = (runtimeBootstrapGateModule.shouldRun as RuntimeFn)({
    windowRef,
    browserRef: options.browserRef,
    chromeRef: options.chromeRef,
  });
  if (!shouldRun) {
    diagnosticsRuntime.updateDiagnostics({
      ok: false,
      stage: 'bootstrap-gated',
      pathname: windowRef.location?.pathname || '',
      inTopFrame: windowRef.top === windowRef,
    });
    return null;
  }

  return {
    isWatchlistPath: runtimeBootstrapGateModule.isWatchlistPath as BootstrapGateContracts['isWatchlistPath'],
    getWatchlistRoot: runtimeBootstrapGateModule.getWatchlistRoot as BootstrapGateContracts['getWatchlistRoot'],
    getWatchlistHeader: runtimeBootstrapGateModule.getWatchlistHeader as BootstrapGateContracts['getWatchlistHeader'],
  };
}

function resolveBootstrapRuntimeModules(
  options: ContentBootstrapOptions,
  windowRef: Window & typeof globalThis,
  setBootstrapIssue: DiagnosticsRuntime['setBootstrapIssue'],
): BootstrapRuntimeModules | null {
  let runtimeBootstrapModulesModule = toRecord(options.runtimeBootstrapModulesModule);
  if (!hasMethods(runtimeBootstrapModulesModule, ['createBootstrapModules', 'assertRuntimeMethods'])) {
    try {
      runtimeBootstrapModulesModule = toRecord(createBootstrapModulesRuntime());
    } catch {
      runtimeBootstrapModulesModule = {};
    }
  }
  if (!hasMethods(runtimeBootstrapModulesModule, ['createBootstrapModules', 'assertRuntimeMethods'])) {
    setBootstrapIssue('missing-bootstrap-modules-module');
    return null;
  }

  let runtimeBootstrapFinalizeModule = toRecord(options.runtimeBootstrapFinalizeModule);
  if (
    !hasMethods(runtimeBootstrapFinalizeModule, [
      'createBootstrapFinalizeRuntime',
      'createStorageAccessors',
      'safeJsonParse',
    ])
  ) {
    try {
      runtimeBootstrapFinalizeModule = toRecord(createBootstrapFinalizeRuntimeModule());
    } catch {
      runtimeBootstrapFinalizeModule = {};
    }
  }
  if (
    !hasMethods(runtimeBootstrapFinalizeModule, [
      'createBootstrapFinalizeRuntime',
      'createStorageAccessors',
      'safeJsonParse',
    ])
  ) {
    setBootstrapIssue('missing-bootstrap-finalize-module');
    return null;
  }

  const bootstrapModulesRuntime = toRecord(
    (runtimeBootstrapModulesModule.createBootstrapModules as RuntimeFn)({
      windowRef,
    }),
  );
  if (Object.keys(bootstrapModulesRuntime).length === 0) {
    setBootstrapIssue('invalid-bootstrap-modules-runtime');
    return null;
  }

  return {
    assertRuntimeMethods: runtimeBootstrapModulesModule.assertRuntimeMethods as RuntimeFn,
    bootstrapModulesRuntime,
  };
}

export function createContentBootstrapPrelude(options: ContentBootstrapOptions = {}): ContentBootstrapPrelude {
  const windowRef = options.windowRef || root;
  const consoleRef = options.consoleRef || console;
  const diagnosticsRuntime = resolveDiagnosticsRuntime(options, windowRef, consoleRef);
  if (!diagnosticsRuntime) {
    return { ok: false };
  }
  diagnosticsRuntime.updateDiagnostics({
    ok: false,
    stage: 'content-script-loaded',
    pathname: windowRef.location?.pathname || '',
  });

  const bootstrapGateContracts = resolveGateModule(options, diagnosticsRuntime, windowRef);
  if (!bootstrapGateContracts) {
    return { ok: false };
  }
  diagnosticsRuntime.updateDiagnostics({ ok: false, stage: 'bootstrap-started' });

  const runtimeModules = resolveBootstrapRuntimeModules(options, windowRef, diagnosticsRuntime.setBootstrapIssue);
  if (!runtimeModules) {
    return { ok: false };
  }

  return {
    ok: true,
    updateDiagnostics: diagnosticsRuntime.updateDiagnostics,
    setBootstrapIssue: diagnosticsRuntime.setBootstrapIssue,
    isWatchlistPath: bootstrapGateContracts.isWatchlistPath,
    getWatchlistRoot: bootstrapGateContracts.getWatchlistRoot,
    getWatchlistHeader: bootstrapGateContracts.getWatchlistHeader,
    assertRuntimeMethods: runtimeModules.assertRuntimeMethods,
    bootstrapModulesRuntime: runtimeModules.bootstrapModulesRuntime,
  };
}

function registerContentBootstrapPrelude(): void {
  let runtimeRegistry = moduleRegistry.runtimeContentBootstrap;
  if (!runtimeRegistry || typeof runtimeRegistry !== 'object') {
    runtimeRegistry = {};
    moduleRegistry.runtimeContentBootstrap = runtimeRegistry;
  }

  (runtimeRegistry as LooseRecord).createContentBootstrapPrelude = createContentBootstrapPrelude;
}

registerContentBootstrapPrelude();
