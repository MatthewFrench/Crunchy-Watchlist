import { createContentBootstrapPrelude } from './ContentBootstrap.js';

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

type RuntimeLockLifecycleState = {
  domRuntimeLockHeartbeatTimer: number | null;
  runtimeTakeoverRequestListener: EventListener | null;
};

type RuntimeLockLifecycleControl = {
  startDomRuntimeLockHeartbeat: () => void;
  startRuntimeTakeoverRequestListener: () => void;
  shutdownRuntime: (payload?: LooseRecord) => void;
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

const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeWindow;
if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
  root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
}
const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

function toRecord(value: unknown): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as LooseRecord;
}

function isWatchlistPathWithoutRuntime(pathname: unknown): boolean {
  return typeof pathname === 'string' && pathname.split('/').filter(Boolean).slice(-1)[0] === 'watchlist';
}

function resolveRuntimeLockNodeForContext(context: RuntimeBootstrapHelpersContext): HTMLElement | null {
  return context.windowRef.document.documentElement || context.windowRef.document.body;
}

function readRuntimeLockTimestamp(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function tryAcquireDomRuntimeLockForContext(context: RuntimeBootstrapHelpersContext): boolean {
  if (!isWatchlistPathWithoutRuntime(context.windowRef.location.pathname)) {
    return true;
  }

  const runtimeLockNode = resolveRuntimeLockNodeForContext(context);
  if (!runtimeLockNode) {
    return true;
  }

  const ownerId = runtimeLockNode.getAttribute(context.domRuntimeLockOwnerAttribute) || '';
  const ownerTimestamp = readRuntimeLockTimestamp(
    runtimeLockNode.getAttribute(context.domRuntimeLockTimestampAttribute),
  );
  const hasFreshForeignOwner =
    ownerId && ownerId !== context.runtimeInstanceId && Date.now() - ownerTimestamp < context.domRuntimeLockStaleMs;
  if (hasFreshForeignOwner) {
    return false;
  }

  const now = Date.now();
  runtimeLockNode.setAttribute(context.domRuntimeLockOwnerAttribute, context.runtimeInstanceId);
  runtimeLockNode.setAttribute(context.domRuntimeLockTimestampAttribute, String(now));
  return runtimeLockNode.getAttribute(context.domRuntimeLockOwnerAttribute) === context.runtimeInstanceId;
}

function releaseDomRuntimeLockForContext(context: RuntimeBootstrapHelpersContext): void {
  const runtimeLockNode = resolveRuntimeLockNodeForContext(context);
  if (!runtimeLockNode) {
    return;
  }

  if (runtimeLockNode.getAttribute(context.domRuntimeLockOwnerAttribute) !== context.runtimeInstanceId) {
    return;
  }

  runtimeLockNode.removeAttribute(context.domRuntimeLockOwnerAttribute);
  runtimeLockNode.removeAttribute(context.domRuntimeLockTimestampAttribute);
}

function parseRuntimeInstanceStartedAt(instanceId: unknown): number {
  if (typeof instanceId !== 'string') {
    return 0;
  }

  const match = /^cw-(\d+)-/.exec(instanceId);
  if (!match) {
    return 0;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function dispatchRuntimeTakeoverRequestForContext(
  context: RuntimeBootstrapHelpersContext,
  targetInstanceId = '',
): void {
  try {
    context.windowRef.document.dispatchEvent(
      new CustomEvent(context.runtimeTakeoverRequestEventName, {
        detail: {
          requestInstanceId: context.runtimeInstanceId,
          requestInstanceStartedAt: context.runtimeInstanceStartedAt,
          targetInstanceId,
        },
      }),
    );
  } catch {
    // no-op
  }
}

function requestRuntimeTakeoverForContext(context: RuntimeBootstrapHelpersContext, targetInstanceId = ''): void {
  try {
    const runtimeControlRef = context.windowRef.__CW_WATCHLIST_CURATOR_CONTROL__;
    const shutdown =
      runtimeControlRef && typeof runtimeControlRef.shutdown === 'function' ? runtimeControlRef.shutdown : null;
    const activeInstanceId =
      runtimeControlRef && typeof runtimeControlRef.activeInstanceId === 'string'
        ? runtimeControlRef.activeInstanceId
        : '';
    if (shutdown && activeInstanceId && activeInstanceId !== context.runtimeInstanceId) {
      shutdown({
        reason: 'dom-runtime-takeover-requested',
        requesterId: context.runtimeInstanceId,
        requesterStartedAt: context.runtimeInstanceStartedAt,
        targetInstanceId,
      });
    }
  } catch {
    // no-op
  }

  dispatchRuntimeTakeoverRequestForContext(context, targetInstanceId);
}

function removeHosts(windowRef: RuntimeWindow): void {
  const hosts = Array.from(windowRef.document.querySelectorAll('.cw-host'));
  hosts.forEach((host) => {
    try {
      host.remove();
    } catch {
      // no-op
    }
  });
}

function clearWatchlistFrameClasses(windowRef: RuntimeWindow): void {
  const framedRoots = Array.from(windowRef.document.querySelectorAll('.cw-watchlist-frame'));
  framedRoots.forEach((rootEl) => {
    try {
      rootEl.classList.remove('cw-watchlist-frame');
    } catch {
      // no-op
    }
  });
}

function restoreHiddenNativeNodes(windowRef: RuntimeWindow): void {
  const hiddenNativeNodes = Array.from(windowRef.document.querySelectorAll('[data-cw-prev-display]'));
  hiddenNativeNodes.forEach((node) => {
    try {
      const nativeNode = node as HTMLElement;
      nativeNode.style.display = nativeNode.dataset.cwPrevDisplay != null ? nativeNode.dataset.cwPrevDisplay : '';
      delete nativeNode.dataset.cwPrevDisplay;
    } catch {
      // no-op
    }
  });
}

function clearStaleInjectedShellForContext(context: RuntimeBootstrapHelpersContext, reason: string): void {
  if (context.runtimeControl.active === true && !context.isCurrentRuntimeOwner()) {
    return;
  }

  removeHosts(context.windowRef);
  clearWatchlistFrameClasses(context.windowRef);
  restoreHiddenNativeNodes(context.windowRef);

  delete context.windowRef.__CW_WATCHLIST_CURATOR_LOADED__;
  releaseDomRuntimeLockForContext(context);
  context.setRuntimeControl({
    active: false,
    activeInstanceId: context.isCurrentRuntimeOwner() ? null : context.runtimeControl.activeInstanceId || null,
    lastShutdownAt: Date.now(),
    lastShutdownPayload: {
      reason,
      cleanupOnly: true,
    },
  });
}

function resolveValidatedBootstrapContextForContext(context: RuntimeBootstrapHelpersContext): LooseRecord | null {
  const bootstrapPrelude = createContentBootstrapPrelude({
    windowRef: context.windowRef,
    consoleRef: context.consoleRef,
    browserRef: context.browserRef,
    chromeRef: context.chromeRef,
  }) as LooseRecord;
  if (!bootstrapPrelude || bootstrapPrelude.ok !== true) {
    clearStaleInjectedShellForContext(context, 'bootstrap-prelude-not-ready');
    return null;
  }

  const setBootstrapIssue = bootstrapPrelude.setBootstrapIssue as AnyFn;
  if (typeof bootstrapPrelude.assertRuntimeMethods !== 'function') {
    setBootstrapIssue('missing-bootstrap-assert-runtime-methods');
    clearStaleInjectedShellForContext(context, 'missing-bootstrap-assert-runtime-methods');
    return null;
  }

  return {
    updateDiagnostics: bootstrapPrelude.updateDiagnostics as AnyFn,
    setBootstrapIssue,
    runtimeBootstrapGateModule: toRecord(bootstrapPrelude.runtimeBootstrapGateModule),
    assertRuntimeMethods: bootstrapPrelude.assertRuntimeMethods as AnyFn,
    runtimeBootstrapFinalizeModule: toRecord(bootstrapPrelude.runtimeBootstrapFinalizeModule),
    bootstrapModulesRuntime: toRecord(bootstrapPrelude.bootstrapModulesRuntime),
  };
}

function clearDomRuntimeLockHeartbeatTimer(
  context: RuntimeBootstrapHelpersContext,
  lifecycleState: RuntimeLockLifecycleState,
): void {
  if (lifecycleState.domRuntimeLockHeartbeatTimer == null) {
    return;
  }

  context.windowRef.clearInterval(lifecycleState.domRuntimeLockHeartbeatTimer);
  lifecycleState.domRuntimeLockHeartbeatTimer = null;
}

function clearRuntimeTakeoverRequestListener(
  context: RuntimeBootstrapHelpersContext,
  lifecycleState: RuntimeLockLifecycleState,
): void {
  if (!lifecycleState.runtimeTakeoverRequestListener) {
    return;
  }

  context.windowRef.document.removeEventListener(
    context.runtimeTakeoverRequestEventName,
    lifecycleState.runtimeTakeoverRequestListener,
  );
  lifecycleState.runtimeTakeoverRequestListener = null;
}

function shutdownRuntimeForContext(
  context: RuntimeBootstrapHelpersContext,
  lifecycleState: RuntimeLockLifecycleState,
  options: RuntimeLockLifecycleOptions,
  payload: LooseRecord = {},
): void {
  clearRuntimeTakeoverRequestListener(context, lifecycleState);

  const watchlistHealthRuntime = options.getWatchlistHealthRuntime();
  if (typeof watchlistHealthRuntime.stop === 'function') {
    watchlistHealthRuntime.stop();
  }

  clearDomRuntimeLockHeartbeatTimer(context, lifecycleState);
  if (options.state.processTimer != null) {
    context.windowRef.clearTimeout(options.state.processTimer as number);
    options.state.processTimer = null;
  }

  try {
    options.getDestroyRuntime()();
  } catch {
    // no-op
  }

  releaseDomRuntimeLockForContext(context);
  if (!context.isCurrentRuntimeOwner()) {
    return;
  }

  context.setRuntimeControl({
    active: false,
    activeInstanceId: null,
    lastShutdownAt: Date.now(),
    lastShutdownPayload: payload,
  });
}

function startDomRuntimeLockHeartbeatForContext(
  context: RuntimeBootstrapHelpersContext,
  lifecycleState: RuntimeLockLifecycleState,
  options: RuntimeLockLifecycleOptions,
  shutdownRuntime: (payload?: LooseRecord) => void,
): void {
  clearDomRuntimeLockHeartbeatTimer(context, lifecycleState);
  lifecycleState.domRuntimeLockHeartbeatTimer = context.windowRef.setInterval(() => {
    if (!context.isCurrentRuntimeActive()) {
      return;
    }

    if (tryAcquireDomRuntimeLockForContext(context)) {
      return;
    }

    options.getRuntimeEvent()('runtime-lock-lost', {
      reason: 'dom-runtime-lock-held-by-another-instance',
    });
    shutdownRuntime({
      reason: 'dom-runtime-lock-lost',
    });
  }, context.domRuntimeLockHeartbeatMs);
}

function createRuntimeTakeoverRequestListener(
  context: RuntimeBootstrapHelpersContext,
  shutdownRuntime: (payload?: LooseRecord) => void,
  getRuntimeEvent: () => AnyFn,
): EventListener {
  return (event) => {
    const detail = toRecord((event as CustomEvent)?.detail);
    if (!Object.keys(detail).length || !context.isCurrentRuntimeActive()) {
      return;
    }

    const requesterId = typeof detail.requestInstanceId === 'string' ? detail.requestInstanceId : '';
    if (!requesterId || requesterId === context.runtimeInstanceId) {
      return;
    }

    const targetInstanceId = typeof detail.targetInstanceId === 'string' ? detail.targetInstanceId : '';
    if (targetInstanceId && targetInstanceId !== context.runtimeInstanceId) {
      return;
    }

    const requesterStartedAtNumber = Number(detail.requestInstanceStartedAt);
    const requesterStartedAt =
      Number.isFinite(requesterStartedAtNumber) && requesterStartedAtNumber > 0
        ? requesterStartedAtNumber
        : parseRuntimeInstanceStartedAt(requesterId);
    const shouldYield =
      requesterStartedAt > context.runtimeInstanceStartedAt ||
      (requesterStartedAt === context.runtimeInstanceStartedAt && requesterId > context.runtimeInstanceId);
    if (!shouldYield) {
      return;
    }

    getRuntimeEvent()('runtime-takeover-yield', {
      requesterId,
      requesterStartedAt,
    });
    shutdownRuntime({
      reason: 'runtime-takeover-yield',
      requesterId,
      requesterStartedAt,
    });
  };
}

function startRuntimeTakeoverRequestListenerForContext(
  context: RuntimeBootstrapHelpersContext,
  lifecycleState: RuntimeLockLifecycleState,
  listener: EventListener,
): void {
  clearRuntimeTakeoverRequestListener(context, lifecycleState);
  lifecycleState.runtimeTakeoverRequestListener = listener;
  context.windowRef.document.addEventListener(context.runtimeTakeoverRequestEventName, listener);
}

function createRuntimeLockLifecycleControlForContext(
  context: RuntimeBootstrapHelpersContext,
  options: RuntimeLockLifecycleOptions,
): RuntimeLockLifecycleControl {
  const lifecycleState: RuntimeLockLifecycleState = {
    domRuntimeLockHeartbeatTimer: null,
    runtimeTakeoverRequestListener: null,
  };

  const shutdownRuntime = (payload: LooseRecord = {}) => {
    shutdownRuntimeForContext(context, lifecycleState, options, payload);
  };

  const startDomRuntimeLockHeartbeat = () => {
    startDomRuntimeLockHeartbeatForContext(context, lifecycleState, options, shutdownRuntime);
  };

  const startRuntimeTakeoverRequestListener = () => {
    const listener = createRuntimeTakeoverRequestListener(context, shutdownRuntime, options.getRuntimeEvent);
    startRuntimeTakeoverRequestListenerForContext(context, lifecycleState, listener);
  };

  return {
    startDomRuntimeLockHeartbeat,
    startRuntimeTakeoverRequestListener,
    shutdownRuntime,
  };
}

export function createContentRuntimeBootstrapDomLockRuntime({
  context,
}: {
  context: RuntimeBootstrapHelpersContext;
}): RuntimeBootstrapDomLockRuntime {
  return {
    resolveRuntimeLockNode: () => resolveRuntimeLockNodeForContext(context),
    tryAcquireDomRuntimeLock: () => tryAcquireDomRuntimeLockForContext(context),
    releaseDomRuntimeLock: () => releaseDomRuntimeLockForContext(context),
    requestRuntimeTakeover: (targetInstanceId = '') => requestRuntimeTakeoverForContext(context, targetInstanceId),
    clearStaleInjectedShell: (reason: string) => clearStaleInjectedShellForContext(context, reason),
    resolveValidatedBootstrapContext: () => resolveValidatedBootstrapContextForContext(context),
    createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) =>
      createRuntimeLockLifecycleControlForContext(context, options),
  };
}

function registerContentRuntimeBootstrapDomLockRuntime(): void {
  let runtimeRegistry = moduleRegistry.runtimeContentRuntimeBootstrapDomLock;
  if (!runtimeRegistry || typeof runtimeRegistry !== 'object') {
    runtimeRegistry = {};
    moduleRegistry.runtimeContentRuntimeBootstrapDomLock = runtimeRegistry;
  }

  (runtimeRegistry as LooseRecord).createContentRuntimeBootstrapDomLockRuntime =
    createContentRuntimeBootstrapDomLockRuntime;
}

registerContentRuntimeBootstrapDomLockRuntime();
