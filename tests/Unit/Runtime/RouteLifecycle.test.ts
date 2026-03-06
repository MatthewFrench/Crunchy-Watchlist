import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RouteLifecycleRuntime = {
  processWatchlist: () => Promise<void>;
  syncRoute: () => void;
  startRouteWatcher: () => void;
  stopRouteWatcher: () => void;
};

type RouteLifecycleModule = {
  createRouteLifecycle: (options: Record<string, unknown>) => RouteLifecycleRuntime;
};

type RouteLifecycleState = {
  mounted: boolean;
  observer: MutationObserver | null;
  routeWatcherStarted: boolean;
  routeSyncTimer: number | null;
  processTimer: number | null;
  mutationMuted: boolean;
  framedRootEl: Element | null;
  hostEl: Element | null;
  tabCrunchyrollEl: object | null;
  tabCuratedEl: object | null;
  curatedPanelEl: object | null;
  controlsEl: object | null;
  loadingBoxEl: object | null;
  loadingIndicatorEl: object | null;
  controlsLoadingIndicatorEl: object | null;
  audioFilterSelectEl: object | null;
  genreFilterSelectEl: object | null;
  statsEl: object | null;
  gridEl: object | null;
  settings: {
    activeTab: string;
  };
  curatedObservedPromise: Promise<void> | null;
};

const routeLifecycleModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'RouteLifecycle.ts'),
).href;
let routeLifecycleModule: RouteLifecycleModule | null = null;

function getRouteLifecycleModule() {
  if (!routeLifecycleModule) {
    throw new Error('Route lifecycle runtime module was not initialized for test');
  }
  return routeLifecycleModule;
}

function setPathname(pathname: string) {
  Object.defineProperty(globalThis, 'location', {
    configurable: true,
    writable: true,
    value: { pathname },
  });
}

function createBaseState(): RouteLifecycleState {
  return {
    mounted: true,
    observer: null,
    routeWatcherStarted: false,
    routeSyncTimer: null,
    processTimer: null,
    mutationMuted: false,
    framedRootEl: null,
    hostEl: null,
    tabCrunchyrollEl: {},
    tabCuratedEl: {},
    curatedPanelEl: {},
    controlsEl: {},
    loadingBoxEl: {},
    loadingIndicatorEl: {},
    controlsLoadingIndicatorEl: {},
    audioFilterSelectEl: {},
    genreFilterSelectEl: {},
    statsEl: {},
    gridEl: {},
    settings: {
      activeTab: 'curated',
    },
    curatedObservedPromise: Promise.resolve(),
  };
}

describe('runtime route-lifecycle', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(routeLifecycleModuleUrl)) as {
      createRuntimeLifecycleRuntime: () => object;
    };
    routeLifecycleModule = module.createRuntimeLifecycleRuntime() as RouteLifecycleModule;
  });

  afterEach(() => {
    routeLifecycleModule = null;
    delete (globalThis as Record<string, unknown>).location;
    delete (globalThis as Record<string, unknown>).document;
    delete (globalThis as Record<string, unknown>).history;
    delete (globalThis as Record<string, unknown>).MutationObserver;
    delete (globalThis as Record<string, unknown>).addEventListener;
    delete (globalThis as Record<string, unknown>).removeEventListener;
    vi.useRealTimers();
  });

  it('runs processWatchlist orchestration when mounted on watchlist route', async () => {
    setPathname('/watchlist');
    const state = createBaseState();
    const ensureInterface = vi.fn();
    const applyTabUi = vi.fn();
    const renderCuratedPanel = vi.fn();
    const ensureCuratedDataLoad = vi.fn(async () => undefined);

    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface,
      applyTabUi,
      ensureCuratedDataLoad,
      renderCuratedPanel,
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess: vi.fn(),
    });

    await runtime.processWatchlist();

    expect(ensureInterface).toHaveBeenCalledTimes(1);
    expect(applyTabUi).toHaveBeenCalledTimes(1);
    expect(ensureCuratedDataLoad).toHaveBeenCalledWith(false);
    expect(renderCuratedPanel).toHaveBeenCalledTimes(2);
  });

  it('absorbs background curated preload rejections when curated tab is inactive', async () => {
    setPathname('/watchlist');
    const state = createBaseState();
    state.settings.activeTab = 'crunchyroll';
    const ensureInterface = vi.fn();
    const applyTabUi = vi.fn();
    const renderCuratedPanel = vi.fn();

    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface,
      applyTabUi,
      ensureCuratedDataLoad: vi.fn(async () => {
        throw new Error('load failed');
      }),
      renderCuratedPanel,
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess: vi.fn(),
    });

    await expect(runtime.processWatchlist()).resolves.toBeUndefined();
    expect(ensureInterface).toHaveBeenCalledTimes(1);
    expect(applyTabUi).toHaveBeenCalledTimes(1);
    expect(renderCuratedPanel).toHaveBeenCalledTimes(1);
  });

  it('unmounts and clears interface state when syncing non-watchlist routes', () => {
    setPathname('/browse');
    const state = createBaseState();
    state.mounted = true;
    (state as Record<string, unknown>).hostEl = {
      isConnected: true,
      remove: vi.fn(),
    };
    const setNativeVisibility = vi.fn();
    const clearRootFrame = vi.fn();

    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility,
      clearRootFrame,
      debounceProcess: vi.fn(),
    });

    runtime.syncRoute();

    expect(setNativeVisibility).toHaveBeenCalledWith(true);
    expect(clearRootFrame).toHaveBeenCalledTimes(1);
    expect(state.mounted).toBe(false);
    expect(state.hostEl).toBeNull();
    expect(state.tabCrunchyrollEl).toBeNull();
    expect(state.curatedObservedPromise).toBeNull();
  });

  it('syncs routes when pathname changes during DOM churn even if patched history is bypassed', () => {
    vi.useFakeTimers();
    setPathname('/watch/GSERIES1');

    const observerCallbacks: MutationCallback[] = [];
    class FakeMutationObserver {
      callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        observerCallbacks.push(callback);
      }

      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        body: {},
        documentElement: {},
      },
    });
    Object.defineProperty(globalThis, 'history', {
      configurable: true,
      writable: true,
      value: {
        pushState: () => {},
        replaceState: () => {},
      },
    });
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      writable: true,
      value: () => {},
    });

    const state = createBaseState();
    state.mounted = false;

    const debounceProcess = vi.fn();
    const runtimeEvents: string[] = [];

    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: (event: string) => {
        runtimeEvents.push(event);
      },
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess,
    });

    runtime.startRouteWatcher();
    setPathname('/watchlist');
    observerCallbacks[0]?.([{ target: {} } as MutationRecord], {} as MutationObserver);

    vi.runAllTimers();

    expect(state.mounted).toBe(true);
    expect(debounceProcess).toHaveBeenCalled();
    expect(runtimeEvents).toContain('route-structure-observer-started');
    expect(runtimeEvents).toContain('mounted');
  });

  it('debounces processing when watchlist-root dom churn occurs outside muted extension writes', () => {
    setPathname('/watchlist');

    const observerCallbacks: MutationCallback[] = [];
    class FakeMutationObserver {
      callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        observerCallbacks.push(callback);
      }

      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        body: {},
        documentElement: {},
      },
    });

    const state = createBaseState();
    state.mounted = false;
    const watchlistRootMutationTarget = {};
    state.framedRootEl = {
      contains: (candidate: unknown) => candidate === watchlistRootMutationTarget,
    } as unknown as Element;

    const debounceProcess = vi.fn();
    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess,
    });

    runtime.syncRoute();
    debounceProcess.mockClear();

    observerCallbacks[0]?.([{ target: watchlistRootMutationTarget } as MutationRecord], {} as MutationObserver);

    expect(debounceProcess).toHaveBeenCalledTimes(1);
  });

  it('ignores observer churn outside the framed watchlist root', () => {
    setPathname('/watchlist');

    const observerCallbacks: MutationCallback[] = [];
    class FakeMutationObserver {
      callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        observerCallbacks.push(callback);
      }

      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        body: {},
        documentElement: {},
      },
    });

    const state = createBaseState();
    state.mounted = false;
    state.framedRootEl = {
      contains: () => false,
    } as unknown as Element;

    const debounceProcess = vi.fn();
    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess,
    });

    runtime.syncRoute();
    debounceProcess.mockClear();

    observerCallbacks[0]?.([{ target: {} } as MutationRecord], {} as MutationObserver);

    expect(debounceProcess).not.toHaveBeenCalled();
  });

  it('debounces processing when the framed watchlist root is removed by spa churn', () => {
    setPathname('/watchlist');

    const observerCallbacks: MutationCallback[] = [];
    class FakeMutationObserver {
      callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        observerCallbacks.push(callback);
      }

      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        body: {},
        documentElement: {},
      },
    });

    const framedRootEl = {} as Element;
    const state = createBaseState();
    state.mounted = false;
    state.framedRootEl = framedRootEl;

    const debounceProcess = vi.fn();
    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess,
    });

    runtime.syncRoute();
    debounceProcess.mockClear();

    observerCallbacks[0]?.(
      [
        {
          target: {},
          removedNodes: [framedRootEl],
        } as unknown as MutationRecord,
      ],
      {} as MutationObserver,
    );

    expect(debounceProcess).toHaveBeenCalledTimes(1);
  });

  it('ignores observer churn when mutation targets are owned by the curated host', () => {
    setPathname('/watchlist');

    const observerCallbacks: MutationCallback[] = [];
    class FakeMutationObserver {
      callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        observerCallbacks.push(callback);
      }

      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        body: {},
        documentElement: {},
      },
    });

    const hostMutationTarget = {};
    const state = createBaseState();
    state.mounted = false;
    (state as { hostEl: Element | null }).hostEl = {
      contains: (candidate: unknown) => candidate === hostMutationTarget,
    } as unknown as Element;

    const debounceProcess = vi.fn();
    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess,
    });

    runtime.syncRoute();
    debounceProcess.mockClear();

    observerCallbacks[0]?.([{ target: hostMutationTarget } as MutationRecord], {} as MutationObserver);

    expect(debounceProcess).not.toHaveBeenCalled();
  });

  it('stops route watcher listeners and prevents route sync after teardown', () => {
    vi.useFakeTimers();
    setPathname('/watch/GSERIES1');

    const observerCallbacks: MutationCallback[] = [];
    class FakeMutationObserver {
      callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        observerCallbacks.push(callback);
      }

      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    const eventHandlers = new Map<string, (() => void)[]>();
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        body: {},
        documentElement: {},
      },
    });
    Object.defineProperty(globalThis, 'history', {
      configurable: true,
      writable: true,
      value: {
        pushState: () => {},
        replaceState: () => {},
      },
    });
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      writable: true,
      value: (eventName: string, handler: () => void) => {
        const existing = eventHandlers.get(eventName) || [];
        existing.push(handler);
        eventHandlers.set(eventName, existing);
      },
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      writable: true,
      value: (eventName: string, handler: () => void) => {
        const existing = eventHandlers.get(eventName) || [];
        eventHandlers.set(
          eventName,
          existing.filter((candidate) => candidate !== handler),
        );
      },
    });

    const state = createBaseState();
    state.mounted = false;

    const debounceProcess = vi.fn();
    const runtimeEvents: string[] = [];

    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: (event: string) => {
        runtimeEvents.push(event);
      },
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess,
    });

    runtime.startRouteWatcher();
    runtime.stopRouteWatcher();
    expect(state.routeWatcherStarted).toBe(false);
    expect(runtimeEvents).toContain('route-watcher-stopped');

    setPathname('/watchlist');
    const popstateHandlers = eventHandlers.get('popstate') || [];
    popstateHandlers.forEach((handler) => {
      handler();
    });
    observerCallbacks.forEach((callback) => {
      callback([{ target: {} } as MutationRecord], {} as MutationObserver);
    });
    vi.runAllTimers();

    expect(state.mounted).toBe(false);
    expect(debounceProcess).not.toHaveBeenCalled();
  });

  it('treats repeated route watcher start/stop calls as idempotent without listener leaks', () => {
    vi.useFakeTimers();
    setPathname('/watch/GSERIES1');

    const observerCallbacks: MutationCallback[] = [];
    let structureObserverDisconnectCount = 0;
    class FakeMutationObserver {
      callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        observerCallbacks.push(callback);
      }

      observe(): void {}
      disconnect(): void {
        structureObserverDisconnectCount += 1;
      }
      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    const eventHandlers = new Map<string, (() => void)[]>();
    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        body: {},
        documentElement: {},
      },
    });
    Object.defineProperty(globalThis, 'history', {
      configurable: true,
      writable: true,
      value: {
        pushState: () => {},
        replaceState: () => {},
      },
    });
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      writable: true,
      value: (eventName: string, handler: () => void) => {
        const existing = eventHandlers.get(eventName) || [];
        existing.push(handler);
        eventHandlers.set(eventName, existing);
      },
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      writable: true,
      value: (eventName: string, handler: () => void) => {
        const existing = eventHandlers.get(eventName) || [];
        eventHandlers.set(
          eventName,
          existing.filter((candidate) => candidate !== handler),
        );
      },
    });

    const state = createBaseState();
    state.mounted = false;
    const debounceProcess = vi.fn();
    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess,
    });

    runtime.startRouteWatcher();
    runtime.startRouteWatcher();
    expect(state.routeWatcherStarted).toBe(true);
    expect(eventHandlers.get('popstate')).toHaveLength(1);
    expect(eventHandlers.get('hashchange')).toHaveLength(1);
    expect(eventHandlers.get('pageshow')).toHaveLength(1);

    runtime.stopRouteWatcher();
    runtime.stopRouteWatcher();
    expect(state.routeWatcherStarted).toBe(false);
    expect(eventHandlers.get('popstate')).toHaveLength(0);
    expect(eventHandlers.get('hashchange')).toHaveLength(0);
    expect(eventHandlers.get('pageshow')).toHaveLength(0);
    expect(structureObserverDisconnectCount).toBe(1);

    setPathname('/watchlist');
    observerCallbacks.forEach((callback) => {
      callback([{ target: {} } as MutationRecord], {} as MutationObserver);
    });
    vi.runAllTimers();

    expect(state.mounted).toBe(false);
    expect(debounceProcess).not.toHaveBeenCalled();
  });

  it('ignores observer churn when runtime ownership is no longer active', () => {
    setPathname('/watchlist');

    const observerCallbacks: MutationCallback[] = [];
    class FakeMutationObserver {
      callback: MutationCallback;

      constructor(callback: MutationCallback) {
        this.callback = callback;
        observerCallbacks.push(callback);
      }

      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        body: {},
        documentElement: {},
      },
    });

    const state = createBaseState();
    state.mounted = false;
    let active = true;
    const debounceProcess = vi.fn();
    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isRuntimeActive: () => active,
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess,
    });

    runtime.syncRoute();
    debounceProcess.mockClear();
    active = false;
    observerCallbacks[0]?.([{ target: {} } as MutationRecord], {} as MutationObserver);

    expect(debounceProcess).not.toHaveBeenCalled();
  });

  it('restores original history methods when route watcher stops', () => {
    setPathname('/watchlist');

    class FakeMutationObserver {
      observe(): void {}
      disconnect(): void {}
      takeRecords(): MutationRecord[] {
        return [];
      }
    }

    const originalPushState = vi.fn();
    const originalReplaceState = vi.fn();

    Object.defineProperty(globalThis, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: FakeMutationObserver,
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: {
        body: {},
        documentElement: {},
      },
    });
    Object.defineProperty(globalThis, 'history', {
      configurable: true,
      writable: true,
      value: {
        pushState: originalPushState,
        replaceState: originalReplaceState,
      },
    });
    Object.defineProperty(globalThis, 'addEventListener', {
      configurable: true,
      writable: true,
      value: () => {},
    });
    Object.defineProperty(globalThis, 'removeEventListener', {
      configurable: true,
      writable: true,
      value: () => {},
    });

    const state = createBaseState();
    const runtime = getRouteLifecycleModule().createRouteLifecycle({
      state,
      runtimeEvent: vi.fn(),
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      ensureInterface: vi.fn(),
      applyTabUi: vi.fn(),
      ensureCuratedDataLoad: vi.fn(async () => undefined),
      renderCuratedPanel: vi.fn(),
      setNativeVisibility: vi.fn(),
      clearRootFrame: vi.fn(),
      debounceProcess: vi.fn(),
    });

    runtime.startRouteWatcher();
    expect(globalThis.history.pushState).not.toBe(originalPushState);
    expect(globalThis.history.replaceState).not.toBe(originalReplaceState);

    runtime.stopRouteWatcher();
    expect(globalThis.history.pushState).toBe(originalPushState);
    expect(globalThis.history.replaceState).toBe(originalReplaceState);
  });
});
