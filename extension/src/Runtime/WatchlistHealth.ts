(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type RuntimeState = {
    mounted: boolean;
    settings: Record<string, unknown>;
    hostEl: HTMLElement | null;
    tabCrunchyrollEl: HTMLElement | null;
    tabCuratedEl: HTMLElement | null;
    curatedPanelEl: HTMLElement | null;
    loadingBoxEl: HTMLElement | null;
    loadingIndicatorEl: HTMLElement | null;
    gridEl: HTMLElement | null;
    curatedInflight: Promise<unknown> | null;
    curatedPendingRequests: unknown[];
    curatedError: unknown;
    curatedDomLifecycleCounters?: CuratedDomLifecycleCounters;
  };

  type CuratedDomLifecycleCounters = {
    created: number;
    patched: number;
    parked: number;
    unparked: number;
    disposed: number;
    renderPasses: number;
  };

  type WatchlistHealthContext = {
    state: RuntimeState;
    windowRef: Window;
    runtimeEvent: (event: string, data?: unknown) => void;
    isRuntimeActive: () => boolean;
    isWatchlistPath: (pathname: string) => boolean;
    getWatchlistRoot: (documentRef: Document) => Element | null;
    processWatchlist: () => Promise<unknown>;
    syncRouteRuntime: () => void;
    blankShellReloadStorageKey: string;
    blankShellReloadCountStorageKey: string;
    blankShellReloadCooldownMs: number;
    blankShellReloadMaxPerSession: number;
    blankShellRecoveryStabilizeMs: number;
    blankShellCheckIntervalMs: number;
    identityChurnWarnCooldownMs: number;
    identityChurnMinCreatedDelta: number;
    identityChurnWarnRate: number;
    watchlistHealthIssueDetectedAt: number;
    watchlistHealthIssueType: string;
    lastIdentityChurnWarningAt: number;
    previousDomLifecycleCounters: CuratedDomLifecycleCounters;
    blankShellRecoveryTimer: number | null;
  };

  type WatchlistHealthOptions = {
    state?: unknown;
    windowRef?: unknown;
    runtimeEvent?: unknown;
    isRuntimeActive?: unknown;
    isWatchlistPath?: unknown;
    getWatchlistRoot?: unknown;
    processWatchlist?: unknown;
    syncRouteRuntime?: unknown;
    blankShellReloadStorageKey?: unknown;
    blankShellReloadCountStorageKey?: unknown;
    blankShellReloadCooldownMs?: unknown;
    blankShellReloadMaxPerSession?: unknown;
    blankShellRecoveryStabilizeMs?: unknown;
    blankShellCheckIntervalMs?: unknown;
    identityChurnWarnCooldownMs?: unknown;
    identityChurnMinCreatedDelta?: unknown;
    identityChurnWarnRate?: unknown;
  };

  type WatchlistHealthRuntime = {
    runCheck: () => void;
    start: () => void;
    stop: () => void;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing watchlist health dependency: ${name}`);
    }
    return value as T;
  }

  function normalizePositiveNumber(value: unknown, fallback: number): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return fallback;
    }
    return Math.round(number);
  }

  function normalizeRateNumber(value: unknown, fallback: number): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1) {
      return fallback;
    }
    return number;
  }

  function toNonNegativeInt(value: unknown): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      return 0;
    }
    return Math.round(number);
  }

  function getCuratedDomLifecycleCounters(state: RuntimeState): CuratedDomLifecycleCounters {
    const countersRecord =
      state.curatedDomLifecycleCounters && typeof state.curatedDomLifecycleCounters === 'object'
        ? state.curatedDomLifecycleCounters
        : null;
    return {
      created: toNonNegativeInt(countersRecord?.created),
      patched: toNonNegativeInt(countersRecord?.patched),
      parked: toNonNegativeInt(countersRecord?.parked),
      unparked: toNonNegativeInt(countersRecord?.unparked),
      disposed: toNonNegativeInt(countersRecord?.disposed),
      renderPasses: toNonNegativeInt(countersRecord?.renderPasses),
    };
  }

  function getIdentityChurnRate(counters: CuratedDomLifecycleCounters): number {
    if (counters.created + counters.patched <= 0) {
      return 0;
    }
    return counters.created / (counters.created + counters.patched);
  }

  function toRuntimeState(value: unknown): RuntimeState | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as RuntimeState;
  }

  function resolveWindowRef(value: unknown): Window {
    if (value && typeof value === 'object') {
      return value as Window;
    }
    return root;
  }

  function createWatchlistHealthContext(options: WatchlistHealthOptions = {}): WatchlistHealthContext {
    const state = toRuntimeState(options.state);
    if (!state) {
      throw new Error('[CW] Missing watchlist health state');
    }

    return {
      state,
      windowRef: resolveWindowRef(options.windowRef),
      runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as WatchlistHealthContext['runtimeEvent'],
      isRuntimeActive: requireFunction(
        'isRuntimeActive',
        options.isRuntimeActive,
      ) as WatchlistHealthContext['isRuntimeActive'],
      isWatchlistPath: requireFunction(
        'isWatchlistPath',
        options.isWatchlistPath,
      ) as WatchlistHealthContext['isWatchlistPath'],
      getWatchlistRoot: requireFunction(
        'getWatchlistRoot',
        options.getWatchlistRoot,
      ) as WatchlistHealthContext['getWatchlistRoot'],
      processWatchlist: requireFunction(
        'processWatchlist',
        options.processWatchlist,
      ) as WatchlistHealthContext['processWatchlist'],
      syncRouteRuntime: requireFunction(
        'syncRouteRuntime',
        options.syncRouteRuntime,
      ) as WatchlistHealthContext['syncRouteRuntime'],
      blankShellReloadStorageKey:
        typeof options.blankShellReloadStorageKey === 'string' && options.blankShellReloadStorageKey.trim()
          ? options.blankShellReloadStorageKey
          : 'cw_blank_watchlist_reload_at_v1',
      blankShellReloadCountStorageKey:
        typeof options.blankShellReloadCountStorageKey === 'string' && options.blankShellReloadCountStorageKey.trim()
          ? options.blankShellReloadCountStorageKey
          : 'cw_blank_watchlist_reload_count_v1',
      blankShellReloadCooldownMs: normalizePositiveNumber(options.blankShellReloadCooldownMs, 60_000),
      blankShellReloadMaxPerSession: normalizePositiveNumber(options.blankShellReloadMaxPerSession, 1),
      blankShellRecoveryStabilizeMs: normalizePositiveNumber(options.blankShellRecoveryStabilizeMs, 4_000),
      blankShellCheckIntervalMs: normalizePositiveNumber(options.blankShellCheckIntervalMs, 1_500),
      identityChurnWarnCooldownMs: normalizePositiveNumber(options.identityChurnWarnCooldownMs, 15_000),
      identityChurnMinCreatedDelta: normalizePositiveNumber(options.identityChurnMinCreatedDelta, 20),
      identityChurnWarnRate: normalizeRateNumber(options.identityChurnWarnRate, 0.6),
      watchlistHealthIssueDetectedAt: 0,
      watchlistHealthIssueType: '',
      lastIdentityChurnWarningAt: 0,
      previousDomLifecycleCounters: getCuratedDomLifecycleCounters(state),
      blankShellRecoveryTimer: null,
    };
  }

  function runIdentityChurnHealthCheckInternal(context: WatchlistHealthContext): void {
    const nextCounters = getCuratedDomLifecycleCounters(context.state);
    const previousCounters = context.previousDomLifecycleCounters;
    const createdDelta = Math.max(0, nextCounters.created - previousCounters.created);
    const patchedDelta = Math.max(0, nextCounters.patched - previousCounters.patched);
    const parkedDelta = Math.max(0, nextCounters.parked - previousCounters.parked);
    const unparkedDelta = Math.max(0, nextCounters.unparked - previousCounters.unparked);
    const disposedDelta = Math.max(0, nextCounters.disposed - previousCounters.disposed);

    context.previousDomLifecycleCounters = nextCounters;

    if (!context.isRuntimeActive()) {
      return;
    }
    if (!context.state.mounted || !isCuratedTabActive(context.state)) {
      return;
    }
    if (!context.isWatchlistPath(context.windowRef.location.pathname)) {
      return;
    }
    if (createdDelta <= 0 && patchedDelta <= 0) {
      return;
    }

    const identityChurnRate = getIdentityChurnRate({
      created: createdDelta,
      patched: patchedDelta,
      parked: parkedDelta,
      unparked: unparkedDelta,
      disposed: disposedDelta,
      renderPasses: 0,
    });
    const now = Date.now();
    if (
      createdDelta >= context.identityChurnMinCreatedDelta &&
      identityChurnRate >= context.identityChurnWarnRate &&
      now - context.lastIdentityChurnWarningAt >= context.identityChurnWarnCooldownMs
    ) {
      context.lastIdentityChurnWarningAt = now;
      context.runtimeEvent('watchlist-health-identity-churn', {
        createdDelta,
        patchedDelta,
        parkedDelta,
        unparkedDelta,
        disposedDelta,
        identityChurnRate,
      });
    }
  }

  function isCuratedHostElement(value: unknown): boolean {
    const element = value as {
      classList?: {
        contains?: (token: string) => boolean;
      };
    };
    return Boolean(
      element?.classList && typeof element.classList.contains === 'function' && element.classList.contains('cw-host'),
    );
  }

  function isHiddenElement(value: unknown): boolean {
    const element = value as {
      style?: {
        display?: string;
      };
    };
    return Boolean(element?.style && typeof element.style.display === 'string' && element.style.display === 'none');
  }

  function isCuratedTabActive(state: RuntimeState): boolean {
    if (!state.settings || typeof state.settings !== 'object') {
      return false;
    }
    return state.settings.activeTab === 'curated';
  }

  function getWatchlistHealthIssueInternal(context: WatchlistHealthContext): string {
    if (!context.isRuntimeActive()) {
      return '';
    }
    if (!context.state.mounted) {
      return '';
    }
    if (!context.isWatchlistPath(context.windowRef.location.pathname)) {
      return '';
    }
    if (!isCuratedTabActive(context.state)) {
      return '';
    }

    const watchlistRoot = context.getWatchlistRoot(context.windowRef.document);
    if (!watchlistRoot) {
      return '';
    }

    const curatedHosts = Array.from(watchlistRoot.children || []).filter((child) => isCuratedHostElement(child));
    if (curatedHosts.length > 1) {
      return 'duplicate-host';
    }
    if (isHiddenElement(context.state.hostEl)) {
      return 'hidden-host';
    }

    const rootHasFrame = Boolean(
      watchlistRoot.classList &&
        typeof watchlistRoot.classList.contains === 'function' &&
        watchlistRoot.classList.contains('cw-watchlist-frame'),
    );
    const hostEl = context.state.hostEl;
    const gridEl = context.state.gridEl;
    const hostConnected =
      Boolean(hostEl?.isConnected && typeof watchlistRoot.contains === 'function') && watchlistRoot.contains(hostEl);
    const gridConnected = Boolean(gridEl?.isConnected && hostEl?.contains(gridEl));

    if (rootHasFrame && (!hostConnected || !gridConnected)) {
      return 'missing-shell';
    }

    if (!hostConnected || !gridConnected || !hostEl || !gridEl) {
      return '';
    }

    const hasRenderedGridChildren = gridEl.children.length > 0;
    if (hasRenderedGridChildren) {
      return '';
    }

    const loadingUi = context.state.loadingIndicatorEl;
    const loadingUiDisplay = loadingUi?.style?.display;
    const loadingUiConnected =
      Boolean(loadingUi?.isConnected && typeof hostEl.contains === 'function') && hostEl.contains(loadingUi);
    const loadingUiVisible =
      loadingUiConnected && !(typeof loadingUiDisplay === 'string' && loadingUiDisplay === 'none');
    if (loadingUiVisible || context.state.curatedInflight || context.state.curatedPendingRequests.length > 0) {
      return '';
    }

    if (context.state.curatedError) {
      return '';
    }

    const hasCuratedShellScaffold = Boolean(
      context.state.tabCrunchyrollEl?.isConnected &&
        context.state.tabCuratedEl?.isConnected &&
        context.state.curatedPanelEl?.isConnected &&
        context.state.loadingBoxEl?.isConnected &&
        hostEl.contains(context.state.tabCrunchyrollEl) &&
        hostEl.contains(context.state.tabCuratedEl) &&
        hostEl.contains(context.state.curatedPanelEl) &&
        hostEl.contains(context.state.loadingBoxEl),
    );
    if (!hasCuratedShellScaffold) {
      return 'missing-shell';
    }

    return 'blank-shell';
  }

  function readSessionNumber(windowRef: Window, key: string): number | null {
    try {
      const raw = windowRef.sessionStorage.getItem(key);
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return null;
    }
  }

  function writeSessionNumber(windowRef: Window, key: string, value: number): boolean {
    try {
      windowRef.sessionStorage.setItem(key, String(Math.max(0, Math.round(value))));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * The blank-shell symptom can be transient while SPA state converges, so we first trigger
   * in-place recovery and only escalate to a single bounded reload once the condition is stable.
   */
  function runBlankShellRecoveryCheckInternal(context: WatchlistHealthContext): void {
    runIdentityChurnHealthCheckInternal(context);

    const healthIssue = getWatchlistHealthIssueInternal(context);
    if (!healthIssue) {
      context.watchlistHealthIssueDetectedAt = 0;
      context.watchlistHealthIssueType = '';
      return;
    }

    const now = Date.now();
    if (!context.watchlistHealthIssueDetectedAt || context.watchlistHealthIssueType !== healthIssue) {
      context.watchlistHealthIssueDetectedAt = now;
      context.watchlistHealthIssueType = healthIssue;
      context.runtimeEvent('watchlist-health-issue-detected', {
        issue: healthIssue,
        action: 'soft-recover',
      });
    }

    context.syncRouteRuntime();
    context.processWatchlist().catch(() => {
      // no-op
    });

    if (now - context.watchlistHealthIssueDetectedAt < context.blankShellRecoveryStabilizeMs) {
      return;
    }

    if (healthIssue !== 'blank-shell') {
      return;
    }

    const reloadCount = readSessionNumber(context.windowRef, context.blankShellReloadCountStorageKey);
    const lastReloadAt = readSessionNumber(context.windowRef, context.blankShellReloadStorageKey);
    if (reloadCount == null || lastReloadAt == null) {
      context.runtimeEvent('watchlist-health-reload-suppressed', {
        issue: healthIssue,
        reason: 'session-storage-unavailable',
      });
      return;
    }

    if (reloadCount >= context.blankShellReloadMaxPerSession) {
      context.runtimeEvent('watchlist-health-reload-suppressed', {
        issue: healthIssue,
        reason: 'reload-budget-exhausted',
        reloadCount,
      });
      return;
    }

    if (lastReloadAt > 0 && now - lastReloadAt < context.blankShellReloadCooldownMs) {
      context.runtimeEvent('watchlist-health-reload-suppressed', {
        issue: healthIssue,
        sinceLastReloadMs: now - lastReloadAt,
      });
      return;
    }

    const didWriteReloadTimestamp = writeSessionNumber(context.windowRef, context.blankShellReloadStorageKey, now);
    const didWriteReloadCount = writeSessionNumber(
      context.windowRef,
      context.blankShellReloadCountStorageKey,
      reloadCount + 1,
    );
    if (!didWriteReloadTimestamp || !didWriteReloadCount) {
      context.runtimeEvent('watchlist-health-reload-suppressed', {
        issue: healthIssue,
        reason: 'session-storage-unavailable',
      });
      return;
    }

    context.runtimeEvent('watchlist-health-reload', {
      issue: healthIssue,
      sinceDetectedMs: now - context.watchlistHealthIssueDetectedAt,
      reloadCount: reloadCount + 1,
    });
    context.windowRef.location.reload();
  }

  function stopBlankShellRecoveryWatcherInternal(context: WatchlistHealthContext): void {
    if (context.blankShellRecoveryTimer != null) {
      context.windowRef.clearInterval(context.blankShellRecoveryTimer);
      context.blankShellRecoveryTimer = null;
    }
  }

  function startBlankShellRecoveryWatcherInternal(context: WatchlistHealthContext): void {
    stopBlankShellRecoveryWatcherInternal(context);
    context.blankShellRecoveryTimer = context.windowRef.setInterval(() => {
      runBlankShellRecoveryCheckInternal(context);
    }, context.blankShellCheckIntervalMs);
  }

  function createWatchlistHealthRuntime(options: WatchlistHealthOptions = {}): WatchlistHealthRuntime {
    const context = createWatchlistHealthContext(options);
    return {
      runCheck: () => runBlankShellRecoveryCheckInternal(context),
      start: () => startBlankShellRecoveryWatcherInternal(context),
      stop: () => stopBlankShellRecoveryWatcherInternal(context),
    };
  }

  moduleRegistry.runtimeWatchlistHealth = {
    createWatchlistHealthRuntime,
  };
})();
