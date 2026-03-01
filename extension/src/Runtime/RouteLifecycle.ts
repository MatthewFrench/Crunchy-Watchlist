type BoundaryValue = CwBoundaryValue;
type BoundaryArray = BoundaryValue[];
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryPromise = Promise<BoundaryValue>;
type BoundaryFn = (...args: BoundaryArray) => BoundaryValue;
type HistoryMethod = (this: History, ...args: BoundaryArray) => BoundaryValue;

type RuntimeState = {
  mounted: boolean;
  observer: MutationObserver | null;
  routeWatcherStarted: boolean;
  routeSyncTimer: number | null;
  processTimer: number | null;
  mutationMuted: boolean;
  hostEl: Element | null;
  tabCrunchyrollEl: Element | null;
  tabCuratedEl: Element | null;
  curatedPanelEl: Element | null;
  controlsEl: Element | null;
  loadingBoxEl: Element | null;
  loadingIndicatorEl: Element | null;
  audioFilterSelectEl: Element | null;
  genreFilterSelectEl: Element | null;
  statsEl: Element | null;
  gridEl: Element | null;
  settings: BoundaryRecord;
  curatedObservedPromise: BoundaryPromise | null;
  curatedDeferredMetadataInFlight?: boolean;
};

type RouteLifecycleContext = {
  state: RuntimeState;
  runtimeEvent: (event: string, data?: BoundaryValue) => void;
  isRuntimeActive: () => boolean;
  isWatchlistPath: (pathname: string) => boolean;
  ensureInterface: () => void;
  applyTabUi: () => void;
  ensureCuratedDataLoad: (force: boolean) => BoundaryPromise;
  renderCuratedPanel: () => void;
  setNativeVisibility: (visible: boolean) => void;
  clearRootFrame: () => void;
  debounceProcess: () => void;
};

type RouteWatcherState = {
  active: boolean;
  historyPatched: boolean;
  historyOriginalPushState: HistoryMethod | null;
  historyOriginalReplaceState: HistoryMethod | null;
  lastObservedPathname: string;
  routeStructureObserver: MutationObserver | null;
  popstateHandler: (() => void) | null;
  hashchangeHandler: (() => void) | null;
  pageshowHandler: (() => void) | null;
};

type RouteLifecycleOptions = {
  state?: BoundaryValue;
  runtimeEvent?: BoundaryValue;
  isRuntimeActive?: BoundaryValue;
  isWatchlistPath?: BoundaryValue;
  ensureInterface?: BoundaryValue;
  applyTabUi?: BoundaryValue;
  ensureCuratedDataLoad?: BoundaryValue;
  renderCuratedPanel?: BoundaryValue;
  setNativeVisibility?: BoundaryValue;
  clearRootFrame?: BoundaryValue;
  debounceProcess?: BoundaryValue;
};

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;

function requireFunction<T extends BoundaryFn>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing runtime lifecycle dependency: ${name}`);
  }

  return value as T;
}

function createRouteLifecycleContext(options: RouteLifecycleOptions = {}): RouteLifecycleContext {
  const state = options.state && typeof options.state === 'object' ? (options.state as RuntimeState) : null;
  if (!state) {
    throw new Error('[CW] Missing runtime lifecycle state');
  }

  return {
    state,
    runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as RouteLifecycleContext['runtimeEvent'],
    isRuntimeActive:
      typeof options.isRuntimeActive === 'function'
        ? (options.isRuntimeActive as RouteLifecycleContext['isRuntimeActive'])
        : () => true,
    isWatchlistPath: requireFunction(
      'isWatchlistPath',
      options.isWatchlistPath,
    ) as RouteLifecycleContext['isWatchlistPath'],
    ensureInterface: requireFunction(
      'ensureInterface',
      options.ensureInterface,
    ) as RouteLifecycleContext['ensureInterface'],
    applyTabUi: requireFunction('applyTabUi', options.applyTabUi) as RouteLifecycleContext['applyTabUi'],
    ensureCuratedDataLoad: requireFunction(
      'ensureCuratedDataLoad',
      options.ensureCuratedDataLoad,
    ) as RouteLifecycleContext['ensureCuratedDataLoad'],
    renderCuratedPanel: requireFunction(
      'renderCuratedPanel',
      options.renderCuratedPanel,
    ) as RouteLifecycleContext['renderCuratedPanel'],
    setNativeVisibility: requireFunction(
      'setNativeVisibility',
      options.setNativeVisibility,
    ) as RouteLifecycleContext['setNativeVisibility'],
    clearRootFrame: requireFunction(
      'clearRootFrame',
      options.clearRootFrame,
    ) as RouteLifecycleContext['clearRootFrame'],
    debounceProcess: requireFunction(
      'debounceProcess',
      options.debounceProcess,
    ) as RouteLifecycleContext['debounceProcess'],
  };
}

function readCurrentPathname(): string {
  const locationRef = root.location as { pathname?: BoundaryValue } | undefined;
  return typeof locationRef?.pathname === 'string' ? locationRef.pathname : '';
}

function isRuntimeActiveInternal(context: RouteLifecycleContext): boolean {
  try {
    return context.isRuntimeActive() !== false;
  } catch {
    return false;
  }
}

function isMutationWithinOwnedHost(target: BoundaryValue, host: Element | null): boolean {
  if (!host || !target || typeof target !== 'object') {
    return false;
  }
  if (target === host) {
    return true;
  }
  if (typeof host.contains !== 'function') {
    return false;
  }

  try {
    return host.contains(target as Node);
  } catch {
    return false;
  }
}

function shouldIgnoreOwnedHostMutations(context: RouteLifecycleContext, records: MutationRecord[]): boolean {
  if (!records.length || !context.state.hostEl) {
    return false;
  }

  for (const record of records) {
    if (!isMutationWithinOwnedHost(record?.target, context.state.hostEl)) {
      return false;
    }
  }
  return true;
}

async function processWatchlistInternal(context: RouteLifecycleContext): Promise<void> {
  if (!isRuntimeActiveInternal(context) || !context.state.mounted || !context.isWatchlistPath(readCurrentPathname())) {
    return;
  }

  context.ensureInterface();
  context.applyTabUi();
  const loadPromise = context.ensureCuratedDataLoad(false);
  context.renderCuratedPanel();

  if (context.state.settings.activeTab !== 'curated') {
    void loadPromise.catch(() => {
      // no-op
    });
    return;
  }

  await loadPromise;
  context.renderCuratedPanel();
}

function startObserverInternal(context: RouteLifecycleContext): void {
  if (context.state.observer) {
    context.state.observer.disconnect();
    context.state.observer = null;
  }

  const target = root.document.body || root.document.documentElement;
  if (!target) {
    return;
  }

  const observer = new MutationObserver((records) => {
    if (!isRuntimeActiveInternal(context) || context.state.mutationMuted) {
      return;
    }
    if (shouldIgnoreOwnedHostMutations(context, records)) {
      return;
    }

    context.debounceProcess();
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
  });

  context.state.observer = observer;
  context.runtimeEvent('observer-started');
}

function stopObserverInternal(context: RouteLifecycleContext): void {
  if (context.state.observer) {
    context.state.observer.disconnect();
    context.state.observer = null;
  }
}

function unmountInternal(context: RouteLifecycleContext): void {
  context.state.mounted = false;
  stopObserverInternal(context);

  context.setNativeVisibility(true);
  context.clearRootFrame();

  if (context.state.hostEl?.isConnected) {
    context.state.hostEl.remove();
  }

  context.state.hostEl = null;
  context.state.tabCrunchyrollEl = null;
  context.state.tabCuratedEl = null;
  context.state.curatedPanelEl = null;
  context.state.controlsEl = null;
  context.state.loadingBoxEl = null;
  context.state.loadingIndicatorEl = null;
  context.state.audioFilterSelectEl = null;
  context.state.genreFilterSelectEl = null;
  context.state.statsEl = null;
  context.state.gridEl = null;

  if (context.state.processTimer != null) {
    root.clearTimeout(context.state.processTimer);
  }
  context.state.processTimer = null;
  context.state.curatedObservedPromise = null;
  context.state.curatedDeferredMetadataInFlight = false;
}

function mountInternal(context: RouteLifecycleContext): void {
  if (!isRuntimeActiveInternal(context)) {
    return;
  }
  if (context.state.mounted) {
    return;
  }

  context.state.mounted = true;
  context.runtimeEvent('mounted');
  startObserverInternal(context);
  context.debounceProcess();
}

function syncRouteInternal(context: RouteLifecycleContext): void {
  if (!isRuntimeActiveInternal(context)) {
    return;
  }
  if (context.isWatchlistPath(readCurrentPathname())) {
    mountInternal(context);
    context.debounceProcess();
    return;
  }

  unmountInternal(context);
}

function scheduleRouteSyncInternal(context: RouteLifecycleContext): void {
  if (!isRuntimeActiveInternal(context)) {
    return;
  }
  if (context.state.routeSyncTimer != null) {
    return;
  }

  context.state.routeSyncTimer = root.setTimeout(() => {
    context.state.routeSyncTimer = null;
    if (!isRuntimeActiveInternal(context)) {
      return;
    }
    syncRouteInternal(context);
  }, 0);
}

function notifyPathnameRouteSyncInternal(context: RouteLifecycleContext, routeWatcherState: RouteWatcherState): void {
  if (!routeWatcherState.active || !isRuntimeActiveInternal(context)) {
    return;
  }
  routeWatcherState.lastObservedPathname = readCurrentPathname();
  scheduleRouteSyncInternal(context);
}

function syncWhenPathnameChangesInternal(context: RouteLifecycleContext, routeWatcherState: RouteWatcherState): void {
  if (!routeWatcherState.active || !isRuntimeActiveInternal(context)) {
    return;
  }
  const pathname = readCurrentPathname();
  if (pathname === routeWatcherState.lastObservedPathname) {
    return;
  }

  routeWatcherState.lastObservedPathname = pathname;
  scheduleRouteSyncInternal(context);
}

function startRouteStructureObserverInternal(
  context: RouteLifecycleContext,
  routeWatcherState: RouteWatcherState,
): void {
  if (!routeWatcherState.active || routeWatcherState.routeStructureObserver || typeof MutationObserver !== 'function') {
    return;
  }

  const documentRef = root.document as Document | undefined;
  const target = documentRef?.body || documentRef?.documentElement;
  if (!target) {
    return;
  }

  // Some SPA routers call saved native history references that bypass patched history methods.
  // Detect pathname changes during DOM churn so route syncing still runs for those transitions.
  const observer = new MutationObserver((records) => {
    if (shouldIgnoreOwnedHostMutations(context, records)) {
      return;
    }
    syncWhenPathnameChangesInternal(context, routeWatcherState);
  });
  observer.observe(target, {
    childList: true,
    subtree: true,
  });
  routeWatcherState.routeStructureObserver = observer;
  context.runtimeEvent('route-structure-observer-started');
}

function stopRouteStructureObserverInternal(routeWatcherState: RouteWatcherState): void {
  if (routeWatcherState.routeStructureObserver) {
    routeWatcherState.routeStructureObserver.disconnect();
    routeWatcherState.routeStructureObserver = null;
  }
}

function patchHistoryForRouteSyncInternal(context: RouteLifecycleContext, routeWatcherState: RouteWatcherState): void {
  if (routeWatcherState.historyPatched) {
    return;
  }
  const historyRef = root.history as BoundaryValue as BoundaryRecord;
  if (!historyRef) {
    return;
  }

  ['pushState', 'replaceState'].forEach((methodName) => {
    const original = historyRef[methodName];
    if (typeof original !== 'function') {
      return;
    }

    try {
      const typedOriginal = original as HistoryMethod;
      historyRef[methodName] = function patchedHistoryState(this: BoundaryValue, ...args: BoundaryArray) {
        const result = typedOriginal.apply(this as History, args);
        if (!routeWatcherState.active) {
          return result;
        }
        notifyPathnameRouteSyncInternal(context, routeWatcherState);
        return result;
      };
      if (methodName === 'pushState') {
        routeWatcherState.historyOriginalPushState = typedOriginal;
      } else if (methodName === 'replaceState') {
        routeWatcherState.historyOriginalReplaceState = typedOriginal;
      }
    } catch (_error) {
      // Some browsers lock history methods. Popstate/hashchange still cover most navigation.
    }
  });
  routeWatcherState.historyPatched = true;
}

function restoreHistoryForRouteSyncInternal(routeWatcherState: RouteWatcherState): void {
  if (!routeWatcherState.historyPatched) {
    return;
  }

  const historyRef = root.history as BoundaryValue as BoundaryRecord;
  if (historyRef && routeWatcherState.historyOriginalPushState) {
    try {
      historyRef.pushState = routeWatcherState.historyOriginalPushState;
    } catch {
      // no-op
    }
  }
  if (historyRef && routeWatcherState.historyOriginalReplaceState) {
    try {
      historyRef.replaceState = routeWatcherState.historyOriginalReplaceState;
    } catch {
      // no-op
    }
  }

  routeWatcherState.historyOriginalPushState = null;
  routeWatcherState.historyOriginalReplaceState = null;
  routeWatcherState.historyPatched = false;
}

function startRouteWatcherInternal(context: RouteLifecycleContext, routeWatcherState: RouteWatcherState): void {
  if (context.state.routeWatcherStarted) {
    return;
  }

  context.state.routeWatcherStarted = true;
  routeWatcherState.active = true;
  routeWatcherState.lastObservedPathname = readCurrentPathname();
  patchHistoryForRouteSyncInternal(context, routeWatcherState);
  startRouteStructureObserverInternal(context, routeWatcherState);
  routeWatcherState.popstateHandler = () => {
    notifyPathnameRouteSyncInternal(context, routeWatcherState);
  };
  routeWatcherState.hashchangeHandler = () => {
    notifyPathnameRouteSyncInternal(context, routeWatcherState);
  };
  routeWatcherState.pageshowHandler = () => {
    notifyPathnameRouteSyncInternal(context, routeWatcherState);
  };
  root.addEventListener('popstate', routeWatcherState.popstateHandler);
  root.addEventListener('hashchange', routeWatcherState.hashchangeHandler);
  root.addEventListener('pageshow', routeWatcherState.pageshowHandler);
}

function stopRouteWatcherInternal(context: RouteLifecycleContext, routeWatcherState: RouteWatcherState): void {
  if (!context.state.routeWatcherStarted && !routeWatcherState.active) {
    return;
  }

  routeWatcherState.active = false;
  stopRouteStructureObserverInternal(routeWatcherState);
  restoreHistoryForRouteSyncInternal(routeWatcherState);

  if (typeof root.removeEventListener === 'function') {
    if (routeWatcherState.popstateHandler) {
      root.removeEventListener('popstate', routeWatcherState.popstateHandler);
    }
    if (routeWatcherState.hashchangeHandler) {
      root.removeEventListener('hashchange', routeWatcherState.hashchangeHandler);
    }
    if (routeWatcherState.pageshowHandler) {
      root.removeEventListener('pageshow', routeWatcherState.pageshowHandler);
    }
  }
  routeWatcherState.popstateHandler = null;
  routeWatcherState.hashchangeHandler = null;
  routeWatcherState.pageshowHandler = null;

  context.state.routeWatcherStarted = false;
  if (context.state.routeSyncTimer != null) {
    root.clearTimeout(context.state.routeSyncTimer);
    context.state.routeSyncTimer = null;
  }
  context.runtimeEvent('route-watcher-stopped');
}

function createRouteLifecycle(options: RouteLifecycleOptions = {}) {
  const context = createRouteLifecycleContext(options);
  const routeWatcherState: RouteWatcherState = {
    active: false,
    historyPatched: false,
    historyOriginalPushState: null,
    historyOriginalReplaceState: null,
    lastObservedPathname: readCurrentPathname(),
    routeStructureObserver: null,
    popstateHandler: null,
    hashchangeHandler: null,
    pageshowHandler: null,
  };

  return {
    processWatchlist: () => processWatchlistInternal(context),
    startObserver: () => startObserverInternal(context),
    stopObserver: () => stopObserverInternal(context),
    mount: () => mountInternal(context),
    unmount: () => unmountInternal(context),
    syncRoute: () => syncRouteInternal(context),
    scheduleRouteSync: () => scheduleRouteSyncInternal(context),
    startRouteWatcher: () => startRouteWatcherInternal(context, routeWatcherState),
    stopRouteWatcher: () => stopRouteWatcherInternal(context, routeWatcherState),
  };
}

const runtimeLifecycleModule = {
  createRouteLifecycle,
};

export function createRuntimeLifecycleRuntime(): object {
  return runtimeLifecycleModule;
}
