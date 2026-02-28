import { createContentRuntimeBootstrapDomLockRuntime } from './ContentRuntimeBootstrapDomLock.js';
import { createContentRuntimeBootstrapSessionRuntime } from './ContentRuntimeBootstrapSession.js';

type AnyFn = (...args: unknown[]) => unknown;
type LooseRecord = Record<string, unknown>;

type RuntimeControl = LooseRecord & {
  active?: boolean;
  activeInstanceId?: string | null;
  shutdown?: (payload?: unknown) => void;
};

type RuntimeWindow = Window &
  typeof globalThis & {
    __CW_WATCHLIST_CURATOR_CONTROL__?: RuntimeControl;
    __CW_WATCHLIST_CURATOR_LOADED__?: {
      version?: string;
    };
    __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord;
  };

type RuntimeLockLifecycleControl = {
  startDomRuntimeLockHeartbeat: () => void;
  startRuntimeTakeoverRequestListener: () => void;
  shutdownRuntime: (payload?: LooseRecord) => void;
};

type BootstrapRuntimeSession = {
  runtimeBootstrapGateModule: LooseRecord;
  runtimeBootstrapFinalizeModule: LooseRecord;
  runtimeStateLoaderModule: LooseRecord;
  runtimeLifecycleModule: LooseRecord;
  runtimeBootstrapHelpersModule: LooseRecord;
  storageModule: LooseRecord;
  assertRuntimeMethods: AnyFn;
  defaultSortMode: unknown;
  validSortModes: unknown;
  sortModeControlOptions: unknown[];
  defaultSettings: LooseRecord;
  runtimeConstants: LooseRecord;
  state: LooseRecord;
  storageLocalArea: unknown;
  isWatchlistPath: (pathname: string) => boolean;
  debounceProcess: () => void;
  createEmptyWatchHistoryCache: AnyFn;
  createWatchlistCacheSnapshot: AnyFn;
  bootstrapModulesRuntime: LooseRecord;
  setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void;
  setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void;
  setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void;
  setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void;
  getRuntimeEvent: () => AnyFn;
  startDomRuntimeLockHeartbeat: () => void;
  shutdownRuntime: (payload?: LooseRecord) => void;
  startWatchlistHealthRuntime: () => void;
};

export type ContentRuntimeBootstrapHelpersOptions = {
  windowRef?: unknown;
  consoleRef?: unknown;
  browserRef?: unknown;
  chromeRef?: unknown;
  runtimeControl?: unknown;
  setRuntimeControl?: unknown;
  runtimeInstanceId?: unknown;
  runtimeInstanceStartedAt?: unknown;
  domRuntimeLockOwnerAttribute?: unknown;
  domRuntimeLockTimestampAttribute?: unknown;
  domRuntimeLockStaleMs?: unknown;
  domRuntimeLockHeartbeatMs?: unknown;
  runtimeTakeoverRequestEventName?: unknown;
  isCurrentRuntimeOwner?: unknown;
  isCurrentRuntimeActive?: unknown;
};

type RuntimeBootstrapHelpersContext = {
  windowRef: RuntimeWindow;
  consoleRef: Console;
  browserRef: unknown;
  chromeRef: unknown;
  runtimeControl: RuntimeControl;
  setRuntimeControl: (patch: LooseRecord) => void;
  runtimeInstanceId: string;
  runtimeInstanceStartedAt: number;
  domRuntimeLockOwnerAttribute: string;
  domRuntimeLockTimestampAttribute: string;
  domRuntimeLockStaleMs: number;
  domRuntimeLockHeartbeatMs: number;
  runtimeTakeoverRequestEventName: string;
  isCurrentRuntimeOwner: () => boolean;
  isCurrentRuntimeActive: () => boolean;
};

type RuntimeLockLifecycleOptions = {
  state: LooseRecord;
  getRuntimeEvent: () => AnyFn;
  getDestroyRuntime: () => AnyFn;
  getWatchlistHealthRuntime: () => LooseRecord;
};

type RuntimeBootstrapDomLockRuntime = {
  resolveRuntimeLockNode: () => HTMLElement | null;
  tryAcquireDomRuntimeLock: () => boolean;
  releaseDomRuntimeLock: () => void;
  requestRuntimeTakeover: (targetInstanceId?: string) => void;
  clearStaleInjectedShell: (reason: string) => void;
  resolveValidatedBootstrapContext: () => LooseRecord | null;
  createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) => RuntimeLockLifecycleControl;
};

type RuntimeBootstrapSessionRuntime = {
  createRuntimeSetup: (options: LooseRecord) => LooseRecord;
  createRuntimeSetupOptions: (options: LooseRecord) => LooseRecord;
  applyRuntimeSetupBindings: (options: {
    runtimeSetupResult: LooseRecord;
    setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void;
    setRuntimeSetupBindings: (runtimeSetupBindings: LooseRecord) => void;
  }) => void;
  createRuntimeBootstrapSession: ({
    bootstrapContext,
  }: {
    bootstrapContext: LooseRecord;
  }) => BootstrapRuntimeSession | null;
  createBootstrapFinalizeRuntimeOptions: (options: LooseRecord) => LooseRecord;
  createBootstrapFinalizeRuntimeFromSetupResult: (options: {
    windowRef: RuntimeWindow;
    runtimeSetupResult: LooseRecord;
    runtimeBootstrapSession: BootstrapRuntimeSession;
  }) => unknown;
  bindBootstrapFinalizeRuntimeMethods: (options: {
    bootstrapFinalizeRuntime: LooseRecord;
    setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void;
    setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void;
    setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void;
    setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
  }) => boolean;
  runBootstrapFinalizeInitFlow: (options: {
    bootstrapFinalizeRuntime: LooseRecord;
    updateDiagnostics: (payload: LooseRecord) => void;
    startDomRuntimeLockHeartbeat: () => void;
    startWatchlistHealthRuntime: () => void;
    runtimeEvent: (event: string, payload?: LooseRecord) => void;
    setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
    shutdownRuntime: (payload?: LooseRecord) => void;
  }) => void;
};

const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeWindow;

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function toRuntimeWindow(value: unknown): RuntimeWindow {
  if (value && typeof value === 'object') {
    return value as RuntimeWindow;
  }
  return root;
}

function toConsole(value: unknown): Console {
  if (value && typeof value === 'object') {
    return value as Console;
  }
  return console;
}

function toFunction<T>(value: unknown, fallback: T): T {
  return typeof value === 'function' ? (value as T) : fallback;
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function resolveRuntimeControl(value: unknown, windowRef: RuntimeWindow): RuntimeControl {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as RuntimeControl;
  }

  if (
    windowRef.__CW_WATCHLIST_CURATOR_CONTROL__ &&
    typeof windowRef.__CW_WATCHLIST_CURATOR_CONTROL__ === 'object' &&
    !Array.isArray(windowRef.__CW_WATCHLIST_CURATOR_CONTROL__)
  ) {
    return windowRef.__CW_WATCHLIST_CURATOR_CONTROL__;
  }

  const runtimeControl: RuntimeControl = {};
  windowRef.__CW_WATCHLIST_CURATOR_CONTROL__ = runtimeControl;
  return runtimeControl;
}

function createRuntimeBootstrapHelpersContext(
  options: ContentRuntimeBootstrapHelpersOptions,
): RuntimeBootstrapHelpersContext {
  const windowRef = toRuntimeWindow(options.windowRef);
  const runtimeControl = resolveRuntimeControl(options.runtimeControl, windowRef);
  const runtimeInstanceId = toStringValue(options.runtimeInstanceId);
  const runtimeInstanceStartedAt = toPositiveNumber(options.runtimeInstanceStartedAt, 0);

  const setRuntimeControl = toFunction<(patch: LooseRecord) => void>(options.setRuntimeControl, (patch) => {
    Object.assign(runtimeControl, patch);
    windowRef.__CW_WATCHLIST_CURATOR_CONTROL__ = runtimeControl;
  });

  return {
    windowRef,
    consoleRef: toConsole(options.consoleRef),
    browserRef: options.browserRef,
    chromeRef: options.chromeRef,
    runtimeControl,
    setRuntimeControl,
    runtimeInstanceId,
    runtimeInstanceStartedAt,
    domRuntimeLockOwnerAttribute: toStringValue(options.domRuntimeLockOwnerAttribute, 'data-cw-runtime-owner'),
    domRuntimeLockTimestampAttribute: toStringValue(
      options.domRuntimeLockTimestampAttribute,
      'data-cw-runtime-owner-ts',
    ),
    domRuntimeLockStaleMs: toPositiveNumber(options.domRuntimeLockStaleMs, 15_000),
    domRuntimeLockHeartbeatMs: toPositiveNumber(options.domRuntimeLockHeartbeatMs, 3_000),
    runtimeTakeoverRequestEventName: toStringValue(
      options.runtimeTakeoverRequestEventName,
      'cw-runtime-takeover-request',
    ),
    isCurrentRuntimeOwner: toFunction<() => boolean>(
      options.isCurrentRuntimeOwner,
      () =>
        Boolean(windowRef.__CW_WATCHLIST_CURATOR_CONTROL__) &&
        windowRef.__CW_WATCHLIST_CURATOR_CONTROL__?.activeInstanceId === runtimeInstanceId,
    ),
    isCurrentRuntimeActive: toFunction<() => boolean>(
      options.isCurrentRuntimeActive,
      () =>
        Boolean(windowRef.__CW_WATCHLIST_CURATOR_CONTROL__) &&
        windowRef.__CW_WATCHLIST_CURATOR_CONTROL__?.activeInstanceId === runtimeInstanceId &&
        windowRef.__CW_WATCHLIST_CURATOR_CONTROL__?.active !== false,
    ),
  };
}

function markRuntimeUnavailable(context: RuntimeBootstrapHelpersContext, reason: string): void {
  context.setRuntimeControl({
    active: false,
    activeInstanceId: null,
    lastShutdownAt: Date.now(),
    lastShutdownPayload: {
      reason,
    },
  });
}

function createDomLockRuntimeForContext(
  context: RuntimeBootstrapHelpersContext,
): RuntimeBootstrapDomLockRuntime | null {
  try {
    return createContentRuntimeBootstrapDomLockRuntime({
      context,
    }) as RuntimeBootstrapDomLockRuntime;
  } catch {
    context.consoleRef.error('[CW] missing-content-runtime-bootstrap-dom-lock-module');
    markRuntimeUnavailable(context, 'missing-content-runtime-bootstrap-dom-lock-module');
    return null;
  }
}

function createSessionRuntimeForContext(
  context: RuntimeBootstrapHelpersContext,
  domLockRuntime: RuntimeBootstrapDomLockRuntime,
): RuntimeBootstrapSessionRuntime | null {
  try {
    return createContentRuntimeBootstrapSessionRuntime({
      context,
      clearStaleInjectedShell: domLockRuntime.clearStaleInjectedShell,
      createRuntimeLockLifecycleControl: domLockRuntime.createRuntimeLockLifecycleControl,
    }) as RuntimeBootstrapSessionRuntime;
  } catch {
    context.consoleRef.error('[CW] missing-content-runtime-bootstrap-session-module');
    markRuntimeUnavailable(context, 'missing-content-runtime-bootstrap-session-module');
    return null;
  }
}

function createFallbackRuntimeLockLifecycleControl(): RuntimeLockLifecycleControl {
  return {
    startDomRuntimeLockHeartbeat: () => {},
    startRuntimeTakeoverRequestListener: () => {},
    shutdownRuntime: () => {},
  };
}

function createFallbackRuntimeBootstrapHelpers(
  context: RuntimeBootstrapHelpersContext,
  domLockRuntime: RuntimeBootstrapDomLockRuntime | null,
): LooseRecord {
  return {
    isCurrentRuntimeOwner: context.isCurrentRuntimeOwner,
    isCurrentRuntimeActive: context.isCurrentRuntimeActive,
    resolveRuntimeLockNode: () => domLockRuntime?.resolveRuntimeLockNode() || null,
    tryAcquireDomRuntimeLock: () => (domLockRuntime ? domLockRuntime.tryAcquireDomRuntimeLock() : false),
    releaseDomRuntimeLock: () => {
      domLockRuntime?.releaseDomRuntimeLock();
    },
    requestRuntimeTakeover: (targetInstanceId = '') => {
      domLockRuntime?.requestRuntimeTakeover(targetInstanceId);
    },
    clearStaleInjectedShell: (reason: string) => {
      domLockRuntime?.clearStaleInjectedShell(reason);
    },
    resolveValidatedBootstrapContext: () => domLockRuntime?.resolveValidatedBootstrapContext() || null,
    createRuntimeSetup: () => ({
      ok: false,
      message: 'runtime setup unavailable',
    }),
    createRuntimeSetupOptions: (options: LooseRecord) => toRecord(options),
    applyRuntimeSetupBindings: () => {},
    createRuntimeLockLifecycleControl: () => createFallbackRuntimeLockLifecycleControl(),
    createRuntimeBootstrapSession: () => null,
    createBootstrapFinalizeRuntimeOptions: (options: LooseRecord) => toRecord(options),
    createBootstrapFinalizeRuntimeFromSetupResult: () => null,
    bindBootstrapFinalizeRuntimeMethods: () => false,
    runBootstrapFinalizeInitFlow: () => {},
  };
}

function createBoundContentRuntimeBootstrapHelpers(context: RuntimeBootstrapHelpersContext): LooseRecord {
  const domLockRuntime = createDomLockRuntimeForContext(context);
  if (!domLockRuntime) {
    return createFallbackRuntimeBootstrapHelpers(context, null);
  }

  const sessionRuntime = createSessionRuntimeForContext(context, domLockRuntime);
  if (!sessionRuntime) {
    return createFallbackRuntimeBootstrapHelpers(context, domLockRuntime);
  }

  return {
    isCurrentRuntimeOwner: context.isCurrentRuntimeOwner,
    isCurrentRuntimeActive: context.isCurrentRuntimeActive,
    resolveRuntimeLockNode: () => domLockRuntime.resolveRuntimeLockNode(),
    tryAcquireDomRuntimeLock: () => domLockRuntime.tryAcquireDomRuntimeLock(),
    releaseDomRuntimeLock: () => domLockRuntime.releaseDomRuntimeLock(),
    requestRuntimeTakeover: (targetInstanceId = '') => domLockRuntime.requestRuntimeTakeover(targetInstanceId),
    clearStaleInjectedShell: (reason: string) => domLockRuntime.clearStaleInjectedShell(reason),
    resolveValidatedBootstrapContext: () => domLockRuntime.resolveValidatedBootstrapContext(),
    createRuntimeSetup: sessionRuntime.createRuntimeSetup,
    createRuntimeSetupOptions: sessionRuntime.createRuntimeSetupOptions,
    applyRuntimeSetupBindings: sessionRuntime.applyRuntimeSetupBindings,
    createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) =>
      domLockRuntime.createRuntimeLockLifecycleControl(options),
    createRuntimeBootstrapSession: ({ bootstrapContext }: { bootstrapContext: LooseRecord }) =>
      sessionRuntime.createRuntimeBootstrapSession({ bootstrapContext }),
    createBootstrapFinalizeRuntimeOptions: (options: LooseRecord) =>
      sessionRuntime.createBootstrapFinalizeRuntimeOptions(options),
    createBootstrapFinalizeRuntimeFromSetupResult: ({
      windowRef,
      runtimeSetupResult,
      runtimeBootstrapSession,
    }: {
      windowRef: RuntimeWindow;
      runtimeSetupResult: LooseRecord;
      runtimeBootstrapSession: BootstrapRuntimeSession;
    }) =>
      sessionRuntime.createBootstrapFinalizeRuntimeFromSetupResult({
        windowRef,
        runtimeSetupResult,
        runtimeBootstrapSession,
      }),
    bindBootstrapFinalizeRuntimeMethods: (options: {
      bootstrapFinalizeRuntime: LooseRecord;
      setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void;
      setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void;
      setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void;
      setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
    }) => sessionRuntime.bindBootstrapFinalizeRuntimeMethods(options),
    runBootstrapFinalizeInitFlow: (options: {
      bootstrapFinalizeRuntime: LooseRecord;
      updateDiagnostics: (payload: LooseRecord) => void;
      startDomRuntimeLockHeartbeat: () => void;
      startWatchlistHealthRuntime: () => void;
      runtimeEvent: (event: string, payload?: LooseRecord) => void;
      setBootstrapIssue: (reason: string, payload?: LooseRecord) => void;
      shutdownRuntime: (payload?: LooseRecord) => void;
    }) => sessionRuntime.runBootstrapFinalizeInitFlow(options),
  };
}

export function createContentRuntimeBootstrapHelpers(options: ContentRuntimeBootstrapHelpersOptions = {}): LooseRecord {
  const context = createRuntimeBootstrapHelpersContext(options);
  return createBoundContentRuntimeBootstrapHelpers(context);
}

function registerContentRuntimeBootstrapHelpers(): void {
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }

  root.__CW_WATCHLIST_CURATOR_MODULES__.runtimeContentRuntimeBootstrapHelpers = {
    createContentRuntimeBootstrapHelpers,
  };
}

registerContentRuntimeBootstrapHelpers();
