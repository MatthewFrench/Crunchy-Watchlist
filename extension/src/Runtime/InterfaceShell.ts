import { createInterfaceShellHostLifecycleRuntime } from './InterfaceShellHostLifecycle.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryArray = BoundaryValue[];
type BoundaryPromise = Promise<BoundaryValue>;
type BoundaryFn = (...args: BoundaryValue[]) => BoundaryValue;

type RuntimeControlOwnedRefs = {
  hostEl?: Element | null;
  tabCrunchyrollEl?: Element | null;
  tabCuratedEl?: Element | null;
  curatedPanelEl?: Element | null;
  gridEl?: Element | null;
  loadingIndicatorEl?: Element | null;
};

type RuntimeControl = {
  ownedRefs?: RuntimeControlOwnedRefs;
} & BoundaryRecord;

type InterfaceWindow = Window &
  typeof globalThis & {
    __CW_WATCHLIST_CURATOR_CONTROL__?: RuntimeControl;
  };

type RuntimeState = {
  framedRootEl: Element | null;
  nativeHiddenNodes: Element[];
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
  curatedGridRenderSignature: string;
  settings: BoundaryRecord;
  ratingCache: BoundaryRecord;
  ratingInflight: Map<string, BoundaryPromise>;
  ratingLocalePreloadInflight: Map<string, BoundaryPromise>;
  watchHistoryLocalePreloadInflight: Map<string, BoundaryPromise>;
  watchHistoryCache: BoundaryValue;
  watchHistoryStatus: string;
  watchHistoryInflight: BoundaryPromise | null;
  curatedEntries: BoundaryArray;
  curatedError: BoundaryValue;
  curatedPendingRequests: string[];
  curatedPendingRequestStartedCount: number;
  curatedPendingRequestCompletedCount: number;
};

type SelectControl = {
  select: Element;
};

type ControlsContext = {
  controls: Element;
  loadingIndicator: Element;
  audioFilterControl: SelectControl;
  genreFilterControl: SelectControl;
  stats: Element;
};

type InterfaceShellContext = {
  state: RuntimeState;
  documentRef: Document;
  windowRef: InterfaceWindow;
  getWatchlistRoot: () => Element | null;
  getWatchlistHeader: () => Element | null;
  runtimeEvent: (event: string, data?: BoundaryValue) => void;
  withMutedObserver: (work: () => void) => void;
  persistSettings: () => BoundaryPromise;
  applyCardLayoutUi: () => void;
  createCuratedInterfaceControls: () => ControlsContext;
  bindCuratedInterfaceControls: (context: ControlsContext) => void;
  ensureCuratedDataLoad: (force: boolean) => BoundaryPromise;
  renderCuratedPanel: () => void;
  debounceProcess: () => void;
  createEmptyWatchHistoryCache: () => BoundaryValue;
  storageSet: (key: string, value: BoundaryValue) => BoundaryPromise;
  ratingCacheKey: string;
  watchHistoryCacheKey: string;
};

type InterfaceShellOptions = {
  state?: BoundaryValue;
  documentRef?: BoundaryValue;
  windowRef?: BoundaryValue;
  getWatchlistRoot?: BoundaryValue;
  getWatchlistHeader?: BoundaryValue;
  runtimeEvent?: BoundaryValue;
  withMutedObserver?: BoundaryValue;
  persistSettings?: BoundaryValue;
  applyCardLayoutUi?: BoundaryValue;
  createCuratedInterfaceControls?: BoundaryValue;
  bindCuratedInterfaceControls?: BoundaryValue;
  ensureCuratedDataLoad?: BoundaryValue;
  renderCuratedPanel?: BoundaryValue;
  debounceProcess?: BoundaryValue;
  createEmptyWatchHistoryCache?: BoundaryValue;
  storageSet?: BoundaryValue;
  ratingCacheKey?: BoundaryValue;
  watchHistoryCacheKey?: BoundaryValue;
};

type InterfaceShellRuntime = {
  clearRootFrame: () => void;
  setNativeVisibility: (showNative: boolean) => void;
  applyTabUi: () => void;
  resetCuratedCachesForRefresh: () => Promise<void>;
  ensureInterface: () => void;
  dispose: () => void;
};

type InterfaceShellCoreDependencies = Pick<
  InterfaceShellContext,
  'state' | 'documentRef' | 'windowRef' | 'ratingCacheKey' | 'watchHistoryCacheKey'
>;

type InterfaceShellFunctionDependencies = Omit<
  InterfaceShellContext,
  'state' | 'documentRef' | 'windowRef' | 'ratingCacheKey' | 'watchHistoryCacheKey'
>;

type InterfaceShellHostLifecycleRuntime = {
  isConnectedElement: (value: BoundaryValue) => value is Element;
  clearInterfaceReferences: (context: InterfaceShellContext) => void;
  resetInterfaceShell: (context: InterfaceShellContext, removeHost: boolean) => void;
  isInterfaceShellIntact: (context: InterfaceShellContext) => boolean;
  ensureRootFrame: (context: InterfaceShellContext, rootElement: Element | null) => void;
  clearRootFrame: (context: InterfaceShellContext) => void;
  setNativeVisibility: (context: InterfaceShellContext, showNative: boolean) => void;
  restoreActiveCuratedHostVisibility: (context: InterfaceShellContext) => void;
  removeOrphanCuratedHosts: (context: InterfaceShellContext, rootElement: Element) => void;
};

function requireFunction<T extends BoundaryFn>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing interface shell dependency: ${name}`);
  }
  return value as T;
}

function asRuntimeState(value: BoundaryValue): RuntimeState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as RuntimeState;
}

function resolveDocumentRef(value: BoundaryValue): Document | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (typeof (value as Document).createElement !== 'function') {
    return null;
  }
  return value as Document;
}

function resolveWindowRef(value: BoundaryValue): InterfaceWindow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as BoundaryRecord;
  if (typeof record.requestAnimationFrame !== 'function') {
    return null;
  }
  if (typeof record.dispatchEvent !== 'function') {
    return null;
  }
  return value as InterfaceWindow;
}

function requireStorageKey(options: InterfaceShellOptions, key: 'ratingCacheKey' | 'watchHistoryCacheKey'): string {
  const value = typeof options[key] === 'string' ? options[key] : '';
  if (!value) {
    throw new Error(`[CW] Missing interface shell ${key}`);
  }
  return value;
}

function resolveInterfaceShellCoreDependencies(options: InterfaceShellOptions): InterfaceShellCoreDependencies {
  const state = asRuntimeState(options.state);
  if (!state) {
    throw new Error('[CW] Missing interface shell state');
  }

  const documentRef = resolveDocumentRef(options.documentRef);
  if (!documentRef) {
    throw new Error('[CW] Missing interface shell documentRef');
  }

  const windowRef = resolveWindowRef(options.windowRef);
  if (!windowRef) {
    throw new Error('[CW] Missing interface shell windowRef');
  }

  return {
    state,
    documentRef,
    windowRef,
    ratingCacheKey: requireStorageKey(options, 'ratingCacheKey'),
    watchHistoryCacheKey: requireStorageKey(options, 'watchHistoryCacheKey'),
  };
}

function resolveInterfaceShellFunctionDependencies(options: InterfaceShellOptions): InterfaceShellFunctionDependencies {
  return {
    getWatchlistRoot: requireFunction(
      'getWatchlistRoot',
      options.getWatchlistRoot,
    ) as InterfaceShellContext['getWatchlistRoot'],
    getWatchlistHeader: requireFunction(
      'getWatchlistHeader',
      options.getWatchlistHeader,
    ) as InterfaceShellContext['getWatchlistHeader'],
    runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as InterfaceShellContext['runtimeEvent'],
    withMutedObserver: requireFunction(
      'withMutedObserver',
      options.withMutedObserver,
    ) as InterfaceShellContext['withMutedObserver'],
    persistSettings: requireFunction(
      'persistSettings',
      options.persistSettings,
    ) as InterfaceShellContext['persistSettings'],
    applyCardLayoutUi: requireFunction(
      'applyCardLayoutUi',
      options.applyCardLayoutUi,
    ) as InterfaceShellContext['applyCardLayoutUi'],
    createCuratedInterfaceControls: requireFunction(
      'createCuratedInterfaceControls',
      options.createCuratedInterfaceControls,
    ) as InterfaceShellContext['createCuratedInterfaceControls'],
    bindCuratedInterfaceControls: requireFunction(
      'bindCuratedInterfaceControls',
      options.bindCuratedInterfaceControls,
    ) as InterfaceShellContext['bindCuratedInterfaceControls'],
    ensureCuratedDataLoad: requireFunction(
      'ensureCuratedDataLoad',
      options.ensureCuratedDataLoad,
    ) as InterfaceShellContext['ensureCuratedDataLoad'],
    renderCuratedPanel: requireFunction(
      'renderCuratedPanel',
      options.renderCuratedPanel,
    ) as InterfaceShellContext['renderCuratedPanel'],
    debounceProcess: requireFunction(
      'debounceProcess',
      options.debounceProcess,
    ) as InterfaceShellContext['debounceProcess'],
    createEmptyWatchHistoryCache: requireFunction(
      'createEmptyWatchHistoryCache',
      options.createEmptyWatchHistoryCache,
    ) as InterfaceShellContext['createEmptyWatchHistoryCache'],
    storageSet: requireFunction('storageSet', options.storageSet) as InterfaceShellContext['storageSet'],
  };
}

function createInterfaceShellContext(options: InterfaceShellOptions = {}): InterfaceShellContext {
  return {
    ...resolveInterfaceShellCoreDependencies(options),
    ...resolveInterfaceShellFunctionDependencies(options),
  };
}

function isElementWithDisplayState(value: BoundaryValue): value is HTMLElement {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as BoundaryRecord;
  return (
    typeof record.style === 'object' &&
    record.style != null &&
    typeof record.dataset === 'object' &&
    record.dataset != null &&
    typeof record.classList === 'object'
  );
}

function setNativeVisibilityInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
  showNative: boolean,
): void {
  hostLifecycleRuntime.setNativeVisibility(context, showNative);
}

function syncRuntimeControlOwnedRefs(context: InterfaceShellContext): void {
  const runtimeControl = context.windowRef.__CW_WATCHLIST_CURATOR_CONTROL__;
  if (!runtimeControl || typeof runtimeControl !== 'object' || Array.isArray(runtimeControl)) {
    return;
  }

  runtimeControl.ownedRefs = {
    hostEl: context.state.hostEl,
    tabCrunchyrollEl: context.state.tabCrunchyrollEl,
    tabCuratedEl: context.state.tabCuratedEl,
    curatedPanelEl: context.state.curatedPanelEl,
    gridEl: context.state.gridEl,
    loadingIndicatorEl: context.state.loadingIndicatorEl,
  };
  context.windowRef.__CW_WATCHLIST_CURATOR_CONTROL__ = runtimeControl;
}

function clearRootFrameInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
): void {
  hostLifecycleRuntime.clearRootFrame(context);
}

function applyTabUiInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
): void {
  const tabCrunchyroll = context.state.tabCrunchyrollEl;
  const tabCurated = context.state.tabCuratedEl;
  const curatedPanel = context.state.curatedPanelEl;

  if (!tabCrunchyroll || !tabCurated || !curatedPanel) {
    return;
  }

  const curatedActive = context.state.settings.activeTab === 'curated';
  if (curatedActive) {
    hostLifecycleRuntime.restoreActiveCuratedHostVisibility(context);
  }

  context.withMutedObserver(() => {
    tabCrunchyroll.setAttribute('aria-selected', curatedActive ? 'false' : 'true');
    tabCurated.setAttribute('aria-selected', curatedActive ? 'true' : 'false');
    tabCrunchyroll.classList.toggle('cw-tab--active', !curatedActive);
    tabCurated.classList.toggle('cw-tab--active', curatedActive);
    if (isElementWithDisplayState(curatedPanel)) {
      curatedPanel.style.display = curatedActive ? 'block' : 'none';
    }
  });

  setNativeVisibilityInternal(context, hostLifecycleRuntime, !curatedActive);
}

function getErrorMessage(error: BoundaryValue): string {
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'unavailable';
}

async function setActiveTabInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
  tabValue: string,
): Promise<void> {
  if (tabValue !== 'crunchyroll' && tabValue !== 'curated') {
    return;
  }

  if (context.state.settings.activeTab === tabValue) {
    applyTabUiInternal(context, hostLifecycleRuntime);
    if (tabValue === 'curated') {
      context.renderCuratedPanel();
    }
    return;
  }

  context.state.settings.activeTab = tabValue;
  await context.persistSettings();
  applyTabUiInternal(context, hostLifecycleRuntime);

  if (tabValue === 'curated') {
    void context.ensureCuratedDataLoad(false).catch((error: BoundaryValue) => {
      context.runtimeEvent('ui-curated-prefetch-error', {
        message: getErrorMessage(error),
      });
    });
    context.renderCuratedPanel();
  }

  context.debounceProcess();
}

function setActiveTabWithErrorGuardInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
  tabValue: 'crunchyroll' | 'curated',
): void {
  void setActiveTabInternal(context, hostLifecycleRuntime, tabValue).catch((error: BoundaryValue) => {
    context.runtimeEvent('ui-tab-change-error', {
      tabValue,
      message: getErrorMessage(error),
    });
  });
}

async function resetCuratedCachesForRefreshInternal(context: InterfaceShellContext): Promise<void> {
  // Manual refresh uses stale-while-revalidate semantics:
  // keep cached cards visible and only reset transient request diagnostics.
  context.state.curatedError = null;
  context.state.curatedPendingRequests = [];
  context.state.curatedPendingRequestStartedCount = 0;
  context.state.curatedPendingRequestCompletedCount = 0;
}

function createTabButtonInternal(context: InterfaceShellContext, label: string, tabValue: string): HTMLButtonElement {
  const button = context.documentRef.createElement('button');
  button.type = 'button';
  button.className = 'cw-tab';
  button.textContent = label;
  button.dataset.cwTab = tabValue;
  return button;
}

function createCuratedInterfaceTabsInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
) {
  const tabs = context.documentRef.createElement('div');
  tabs.className = 'cw-tabs';

  const tabCrunchyroll = createTabButtonInternal(context, 'Crunchyroll', 'crunchyroll');
  const tabCurated = createTabButtonInternal(context, 'Curated', 'curated');

  tabCrunchyroll.addEventListener('click', () => {
    setActiveTabWithErrorGuardInternal(context, hostLifecycleRuntime, 'crunchyroll');
  });
  tabCurated.addEventListener('click', () => {
    setActiveTabWithErrorGuardInternal(context, hostLifecycleRuntime, 'curated');
  });

  tabs.appendChild(tabCrunchyroll);
  tabs.appendChild(tabCurated);

  return {
    tabs,
    tabCrunchyroll,
    tabCurated,
  };
}

function handleMissingWatchlistStructureInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
): void {
  // During SPA churn Crunchyroll can temporarily replace watchlist nodes; fall back to native content
  // so users do not get stuck in an empty framed shell while structure reattaches.
  setNativeVisibilityInternal(context, hostLifecycleRuntime, true);
  clearRootFrameInternal(context, hostLifecycleRuntime);
  if (!hostLifecycleRuntime.isConnectedElement(context.state.hostEl)) {
    hostLifecycleRuntime.clearInterfaceReferences(context);
  }
  syncRuntimeControlOwnedRefs(context);
  context.runtimeEvent('ui-missing-watchlist-structure');
}

function prepareWatchlistRootForShellInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
  rootElement: Element,
): void {
  hostLifecycleRuntime.ensureRootFrame(context, rootElement);
  hostLifecycleRuntime.removeOrphanCuratedHosts(context, rootElement);
}

function resetInterfaceShellForRemountInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
): void {
  if (context.state.hostEl) {
    context.runtimeEvent('ui-shell-repair', {
      reason: hostLifecycleRuntime.isConnectedElement(context.state.hostEl) ? 'invalid-structure' : 'disconnected-host',
    });
    hostLifecycleRuntime.resetInterfaceShell(context, true);
    return;
  }

  hostLifecycleRuntime.clearInterfaceReferences(context);
}

type MountedInterfaceShell = {
  host: HTMLElement;
  tabs: {
    tabCrunchyroll: HTMLButtonElement;
    tabCurated: HTMLButtonElement;
  };
  panel: HTMLElement;
  controls: ControlsContext;
  loadingBox: HTMLElement;
  grid: HTMLElement;
};

function mountInterfaceShellInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
  headerElement: Element,
): MountedInterfaceShell {
  const host = context.documentRef.createElement('section');
  host.className = 'cw-host';

  const { tabs, tabCrunchyroll, tabCurated } = createCuratedInterfaceTabsInternal(context, hostLifecycleRuntime);
  const panel = context.documentRef.createElement('div');
  panel.className = 'cw-panel';
  if (panel.style) {
    panel.style.position = 'relative';
  }
  const controls = context.createCuratedInterfaceControls();
  context.bindCuratedInterfaceControls(controls);
  const loadingBox = context.documentRef.createElement('div');
  loadingBox.className = 'cw-empty cw-loading-box';
  if (loadingBox.style) {
    loadingBox.style.display = 'none';
    loadingBox.style.margin = '0';
    loadingBox.style.position = 'absolute';
    loadingBox.style.left = '0';
    loadingBox.style.right = '0';
    loadingBox.style.top = '0';
    loadingBox.style.zIndex = '2';
    loadingBox.style.pointerEvents = 'none';
  }

  const loadingBoxTitle = context.documentRef.createElement('div');
  loadingBoxTitle.className = 'cw-loading-box__title';
  loadingBoxTitle.textContent = 'Loading watchlist results...';

  loadingBox.appendChild(loadingBoxTitle);
  loadingBox.appendChild(controls.loadingIndicator);

  const grid = context.documentRef.createElement('div');
  grid.className = 'cw-curated-grid';

  panel.appendChild(controls.controls);
  panel.appendChild(loadingBox);
  panel.appendChild(grid);
  host.appendChild(tabs);
  host.appendChild(panel);
  headerElement.insertAdjacentElement('beforebegin', host);

  return {
    host,
    tabs: {
      tabCrunchyroll,
      tabCurated,
    },
    panel,
    controls,
    loadingBox,
    grid,
  };
}

function applyMountedInterfaceShellToStateInternal(
  context: InterfaceShellContext,
  mountedShell: MountedInterfaceShell,
): void {
  context.state.hostEl = mountedShell.host;
  context.state.tabCrunchyrollEl = mountedShell.tabs.tabCrunchyroll;
  context.state.tabCuratedEl = mountedShell.tabs.tabCurated;
  context.state.curatedPanelEl = mountedShell.panel;
  context.state.controlsEl = mountedShell.controls.controls;
  context.state.loadingBoxEl = mountedShell.loadingBox;
  context.state.loadingIndicatorEl = mountedShell.controls.loadingIndicator;
  context.state.audioFilterSelectEl = mountedShell.controls.audioFilterControl.select;
  context.state.genreFilterSelectEl = mountedShell.controls.genreFilterControl.select;
  context.state.statsEl = mountedShell.controls.stats;
  context.state.gridEl = mountedShell.grid;
  context.state.curatedGridRenderSignature = '';
  syncRuntimeControlOwnedRefs(context);
}

function ensureInterfaceInternal(
  context: InterfaceShellContext,
  hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime,
): void {
  const rootElement = context.getWatchlistRoot();
  const headerElement = context.getWatchlistHeader();
  if (!rootElement || !headerElement) {
    handleMissingWatchlistStructureInternal(context, hostLifecycleRuntime);
    return;
  }

  prepareWatchlistRootForShellInternal(context, hostLifecycleRuntime, rootElement);

  if (hostLifecycleRuntime.isInterfaceShellIntact(context)) {
    syncRuntimeControlOwnedRefs(context);
    return;
  }

  resetInterfaceShellForRemountInternal(context, hostLifecycleRuntime);
  const mountedShell = mountInterfaceShellInternal(context, hostLifecycleRuntime, headerElement);
  applyMountedInterfaceShellToStateInternal(context, mountedShell);

  context.runtimeEvent('ui-mounted', {
    headerClass: String(headerElement.className || ''),
  });

  context.applyCardLayoutUi();
  applyTabUiInternal(context, hostLifecycleRuntime);
}

class InterfaceShellOwner implements InterfaceShellRuntime {
  private readonly context: InterfaceShellContext;
  private readonly hostLifecycleRuntime: InterfaceShellHostLifecycleRuntime;
  private disposed = false;

  constructor(options: InterfaceShellOptions = {}) {
    this.context = createInterfaceShellContext(options);
    this.hostLifecycleRuntime = createInterfaceShellHostLifecycleRuntime();
  }

  readonly clearRootFrame = (): void => {
    if (this.disposed) {
      return;
    }
    clearRootFrameInternal(this.context, this.hostLifecycleRuntime);
  };

  readonly setNativeVisibility = (showNative: boolean): void => {
    if (this.disposed) {
      return;
    }
    setNativeVisibilityInternal(this.context, this.hostLifecycleRuntime, showNative);
  };

  readonly applyTabUi = (): void => {
    if (this.disposed) {
      return;
    }
    applyTabUiInternal(this.context, this.hostLifecycleRuntime);
  };

  readonly resetCuratedCachesForRefresh = (): Promise<void> => {
    if (this.disposed) {
      return Promise.resolve();
    }
    return resetCuratedCachesForRefreshInternal(this.context);
  };

  readonly ensureInterface = (): void => {
    if (this.disposed) {
      return;
    }
    ensureInterfaceInternal(this.context, this.hostLifecycleRuntime);
  };

  readonly dispose = (): void => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.hostLifecycleRuntime.setNativeVisibility(this.context, true);
    this.hostLifecycleRuntime.resetInterfaceShell(this.context, true);
    clearRootFrameInternal(this.context, this.hostLifecycleRuntime);
    syncRuntimeControlOwnedRefs(this.context);
  };
}

function createInterfaceShellRuntime(options: InterfaceShellOptions = {}): InterfaceShellRuntime {
  return new InterfaceShellOwner(options);
}

const runtimeInterfaceShellModule = {
  createInterfaceShellRuntime,
};

export function createRuntimeInterfaceShellRuntime(): object {
  return runtimeInterfaceShellModule;
}
