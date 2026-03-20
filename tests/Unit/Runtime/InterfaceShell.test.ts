import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type InterfaceShellRuntime = {
  ensureInterface: () => void;
  applyTabUi: () => void;
  setNativeVisibility: (showNative: boolean) => void;
  resetCuratedCachesForRefresh: () => Promise<void>;
  dispose: () => void;
};

type InterfaceShellModule = {
  createInterfaceShellRuntime: (options: Record<string, unknown>) => InterfaceShellRuntime;
};

const interfaceShellModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'InterfaceShell.ts'),
).href;
let interfaceShellModule: InterfaceShellModule | null = null;

type InterfaceShellTestState = {
  framedRootEl: unknown | null;
  nativeHiddenNodes: unknown[];
  hostEl: unknown | null;
  tabCrunchyrollEl: unknown | null;
  tabCuratedEl: unknown | null;
  curatedPanelEl: unknown | null;
  controlsEl: unknown | null;
  loadingBoxEl: unknown | null;
  loadingIndicatorEl: unknown | null;
  controlsLoadingIndicatorEl: unknown | null;
  audioFilterSelectEl: unknown | null;
  genreFilterSelectEl: unknown | null;
  statsEl: unknown | null;
  gridEl: unknown | null;
  curatedGridRenderSignature: string;
  settings: Record<string, unknown>;
  ratingCache: Record<string, unknown>;
  ratingInflight: Map<string, Promise<null>>;
  ratingLocalePreloadInflight: Map<string, Promise<null>>;
  watchHistoryLocalePreloadInflight: Map<string, Promise<null>>;
  watchHistoryCache: Record<string, unknown>;
  watchHistoryStatus: string;
  watchHistoryInflight: Promise<null> | null;
  curatedEntries: unknown[];
  curatedError: string | null;
  curatedPendingRequests: string[];
  curatedPendingRequestStartedCount: number;
  curatedPendingRequestCompletedCount: number;
};

function createBaseState(): InterfaceShellTestState {
  return {
    framedRootEl: null,
    nativeHiddenNodes: [],
    hostEl: null,
    tabCrunchyrollEl: null,
    tabCuratedEl: null,
    curatedPanelEl: null,
    controlsEl: null,
    loadingBoxEl: null,
    loadingIndicatorEl: null,
    controlsLoadingIndicatorEl: null,
    audioFilterSelectEl: null,
    genreFilterSelectEl: null,
    statsEl: null,
    gridEl: null,
    curatedGridRenderSignature: '',
    settings: {
      activeTab: 'curated',
    },
    ratingCache: { seriesId: { rating: 4.5 } },
    ratingInflight: new Map([['series-1', Promise.resolve(null)]]),
    ratingLocalePreloadInflight: new Map([['en-us', Promise.resolve(null)]]),
    watchHistoryLocalePreloadInflight: new Map([['en-us', Promise.resolve(null)]]),
    watchHistoryCache: { version: 3, bySeriesId: { 'series-1': {} } },
    watchHistoryStatus: 'ready',
    watchHistoryInflight: Promise.resolve(null),
    curatedEntries: [{ seriesId: 'series-1' }],
    curatedError: 'old-error',
    curatedPendingRequests: ['Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)'],
    curatedPendingRequestStartedCount: 3,
    curatedPendingRequestCompletedCount: 1,
  };
}

function getInterfaceShellModule() {
  if (!interfaceShellModule) {
    throw new Error('Interface shell module was not initialized for test');
  }
  return interfaceShellModule;
}

class FakeClassList {
  private readonly tokens = new Set<string>();
  private readonly owner: FakeElement;

  constructor(owner: FakeElement) {
    this.owner = owner;
  }

  private syncClassName(): void {
    this.owner.className = Array.from(this.tokens).join(' ');
  }

  add(...tokens: string[]): void {
    tokens
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => {
        this.tokens.add(token);
      });
    this.syncClassName();
  }

  remove(...tokens: string[]): void {
    tokens
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => {
        this.tokens.delete(token);
      });
    this.syncClassName();
  }

  toggle(token: string, force?: boolean): boolean {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      return false;
    }

    if (force === true) {
      this.tokens.add(normalizedToken);
      this.syncClassName();
      return true;
    }
    if (force === false) {
      this.tokens.delete(normalizedToken);
      this.syncClassName();
      return false;
    }
    if (this.tokens.has(normalizedToken)) {
      this.tokens.delete(normalizedToken);
      this.syncClassName();
      return false;
    }
    this.tokens.add(normalizedToken);
    this.syncClassName();
    return true;
  }

  contains(token: string): boolean {
    return this.tokens.has(token.trim());
  }
}

class FakeElement {
  readonly tagName: string;
  className = '';
  readonly classList: FakeClassList;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly children: FakeElement[] = [];
  parentNode: FakeElement | null = null;
  textContent: string | null = '';
  private connected = false;
  private readonly attributes: Record<string, string> = {};

  constructor(tagName: string) {
    this.tagName = tagName.toLowerCase();
    this.classList = new FakeClassList(this);
  }

  get isConnected(): boolean {
    return this.connected;
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    this.children.forEach((child) => {
      child.setConnected(connected);
    });
  }

  private detachFromParent(): void {
    if (!this.parentNode) {
      return;
    }
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) {
      this.parentNode.children.splice(index, 1);
    }
    this.parentNode = null;
    this.setConnected(false);
  }

  appendChild(child: FakeElement): FakeElement {
    child.detachFromParent();
    this.children.push(child);
    child.parentNode = this;
    child.setConnected(this.connected);
    return child;
  }

  insertAdjacentElement(position: string, element: FakeElement): FakeElement | null {
    if (position !== 'beforebegin' || !this.parentNode) {
      return null;
    }

    element.detachFromParent();
    const insertionIndex = this.parentNode.children.indexOf(this);
    if (insertionIndex < 0) {
      this.parentNode.children.push(element);
    } else {
      this.parentNode.children.splice(insertionIndex, 0, element);
    }
    element.parentNode = this.parentNode;
    element.setConnected(this.parentNode.connected);
    return element;
  }

  remove(): void {
    this.detachFromParent();
  }

  contains(candidate: unknown): boolean {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }
    if (candidate === this) {
      return true;
    }
    return this.children.some((child) => child.contains(candidate));
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
    if (name === 'class') {
      this.className = value;
      this.className
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean)
        .forEach((token) => {
          this.classList.add(token);
        });
      return;
    }
    if (name.startsWith('data-')) {
      const datasetKey = name
        .slice('data-'.length)
        .replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase());
      this.dataset[datasetKey] = value;
    }
  }

  getAttribute(name: string): string | null {
    if (name === 'class') {
      return this.className;
    }
    if (name.startsWith('data-')) {
      const datasetKey = name
        .slice('data-'.length)
        .replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase());
      return this.dataset[datasetKey] ?? null;
    }
    return this.attributes[name] ?? null;
  }

  querySelectorAll(_selector: string): FakeElement[] {
    return [];
  }

  addEventListener(): void {}
}

function createFakeDocumentRef() {
  return {
    createElement: (tagName = 'div') => new FakeElement(tagName),
  };
}

describe('interface-shell runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const interfaceShellRuntimeModule = (await import(interfaceShellModuleUrl)) as {
      createRuntimeInterfaceShellRuntime: () => object;
    };
    interfaceShellModule = interfaceShellRuntimeModule.createRuntimeInterfaceShellRuntime() as InterfaceShellModule;
  });

  afterEach(() => {
    interfaceShellModule = null;
  });

  it('emits ui-missing-watchlist-structure when root/header are unavailable', () => {
    const runtimeEvents: string[] = [];
    const runtime = getInterfaceShellModule().createInterfaceShellRuntime({
      state: createBaseState(),
      documentRef: {
        createElement: () => ({}),
      },
      windowRef: {
        requestAnimationFrame: () => 0,
        dispatchEvent: () => true,
      },
      getWatchlistRoot: () => null,
      getWatchlistHeader: () => null,
      runtimeEvent: (event: string) => {
        runtimeEvents.push(event);
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      persistSettings: async () => null,
      applyCardLayoutUi: () => {},
      createCuratedInterfaceControls: () => ({
        controls: {},
        loadingIndicator: {},
        topLoadingIndicator: {},
        audioFilterControl: { select: {} },
        genreFilterControl: { select: {} },
        stats: {},
      }),
      bindCuratedInterfaceControls: () => {},
      ensureCuratedDataLoad: async () => null,
      renderCuratedPanel: () => {},
      debounceProcess: () => {},
      createEmptyWatchHistoryCache: () => ({}),
      storageSet: async () => null,
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    });

    runtime.ensureInterface();

    expect(runtimeEvents).toEqual(['ui-missing-watchlist-structure']);
  });

  it('keeps cached curated data during refresh while resetting transient request diagnostics', async () => {
    const state = createBaseState();
    const storageSetCalls: Array<{ key: string; value: unknown }> = [];
    const previousRatingCache = state.ratingCache;
    const previousWatchHistoryCache = state.watchHistoryCache;
    const previousCuratedEntries = state.curatedEntries;
    const runtime = getInterfaceShellModule().createInterfaceShellRuntime({
      state,
      documentRef: {
        createElement: () => ({}),
      },
      windowRef: {
        requestAnimationFrame: () => 0,
        dispatchEvent: () => true,
      },
      getWatchlistRoot: () => null,
      getWatchlistHeader: () => null,
      runtimeEvent: () => {},
      withMutedObserver: (work: () => void) => {
        work();
      },
      persistSettings: async () => null,
      applyCardLayoutUi: () => {},
      createCuratedInterfaceControls: () => ({
        controls: {},
        loadingIndicator: {},
        topLoadingIndicator: {},
        audioFilterControl: { select: {} },
        genreFilterControl: { select: {} },
        stats: {},
      }),
      bindCuratedInterfaceControls: () => {},
      ensureCuratedDataLoad: async () => null,
      renderCuratedPanel: () => {},
      debounceProcess: () => {},
      createEmptyWatchHistoryCache: () => ({}),
      storageSet: async (key: string, value: unknown) => {
        storageSetCalls.push({ key, value });
      },
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    });

    await runtime.resetCuratedCachesForRefresh();

    expect(state.ratingCache).toBe(previousRatingCache);
    expect(state.watchHistoryCache).toBe(previousWatchHistoryCache);
    expect(state.curatedEntries).toBe(previousCuratedEntries);
    expect(state.curatedError).toBeNull();
    expect(state.curatedPendingRequests).toEqual([]);
    expect(state.curatedPendingRequestStartedCount).toBe(0);
    expect(state.curatedPendingRequestCompletedCount).toBe(0);
    expect(storageSetCalls).toEqual([]);
  });

  it('mounts the shared loading indicator inside a dedicated loading box above the curated grid', () => {
    const state = createBaseState();
    const rootElement = new FakeElement('section');
    rootElement.setConnected(true);
    const headerElement = new FakeElement('header');
    rootElement.appendChild(headerElement);

    const controls = new FakeElement('div');
    const loadingIndicator = new FakeElement('span');
    loadingIndicator.classList.add('cw-loading', 'cw-loading-indicator');

    const runtime = getInterfaceShellModule().createInterfaceShellRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      windowRef: {
        requestAnimationFrame: () => 0,
        dispatchEvent: () => true,
      },
      getWatchlistRoot: () => rootElement,
      getWatchlistHeader: () => headerElement,
      runtimeEvent: () => {},
      withMutedObserver: (work: () => void) => {
        work();
      },
      persistSettings: async () => null,
      applyCardLayoutUi: () => {},
      createCuratedInterfaceControls: () => ({
        controls,
        loadingIndicator,
        topLoadingIndicator: new FakeElement('span'),
        audioFilterControl: { select: new FakeElement('select') },
        genreFilterControl: { select: new FakeElement('select') },
        stats: new FakeElement('span'),
      }),
      bindCuratedInterfaceControls: () => {},
      ensureCuratedDataLoad: async () => null,
      renderCuratedPanel: () => {},
      debounceProcess: () => {},
      createEmptyWatchHistoryCache: () => ({}),
      storageSet: async () => null,
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    });

    runtime.ensureInterface();

    const panel = state.curatedPanelEl as FakeElement;
    const loadingBox = panel.children[1] as FakeElement;
    const loadingBoxInner = loadingBox.children[0] as FakeElement;
    expect(panel.children[0]).toBe(controls);
    expect(loadingBox.className).toContain('cw-loading-box');
    expect(loadingBoxInner.className).toContain('cw-loading-box__inner');
    expect(loadingBoxInner.children[1]).toBe(loadingIndicator);
    expect(panel.children[2]).toBe(state.gridEl);
    expect(controls.contains(loadingIndicator)).toBe(false);
  });

  it('repairs stale connected shell nodes and recreates a valid curated host', () => {
    const state = createBaseState();
    const runtimeEvents: string[] = [];

    const rootElement = new FakeElement('section');
    rootElement.setConnected(true);
    const staleHost = new FakeElement('section');
    staleHost.classList.add('cw-host');
    const headerElement = new FakeElement('header');
    rootElement.appendChild(staleHost);
    rootElement.appendChild(headerElement);

    const disconnectedGrid = new FakeElement('div');
    state.hostEl = staleHost;
    state.tabCrunchyrollEl = new FakeElement('button');
    state.tabCuratedEl = new FakeElement('button');
    state.curatedPanelEl = new FakeElement('div');
    state.controlsEl = new FakeElement('div');
    state.loadingIndicatorEl = new FakeElement('span');
    state.audioFilterSelectEl = new FakeElement('select');
    state.genreFilterSelectEl = new FakeElement('select');
    state.statsEl = new FakeElement('span');
    state.gridEl = disconnectedGrid;

    const runtime = getInterfaceShellModule().createInterfaceShellRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      windowRef: {
        requestAnimationFrame: () => 0,
        dispatchEvent: () => true,
      },
      getWatchlistRoot: () => rootElement,
      getWatchlistHeader: () => headerElement,
      runtimeEvent: (event: string) => {
        runtimeEvents.push(event);
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      persistSettings: async () => null,
      applyCardLayoutUi: () => {},
      createCuratedInterfaceControls: () => ({
        controls: new FakeElement('div'),
        loadingIndicator: new FakeElement('span'),
        topLoadingIndicator: new FakeElement('span'),
        audioFilterControl: { select: new FakeElement('select') },
        genreFilterControl: { select: new FakeElement('select') },
        stats: new FakeElement('span'),
      }),
      bindCuratedInterfaceControls: () => {},
      ensureCuratedDataLoad: async () => null,
      renderCuratedPanel: () => {},
      debounceProcess: () => {},
      createEmptyWatchHistoryCache: () => ({}),
      storageSet: async () => null,
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    });

    runtime.ensureInterface();

    expect(runtimeEvents).toContain('ui-shell-repair');
    expect(runtimeEvents).toContain('ui-mounted');
    expect(staleHost.isConnected).toBe(false);
    expect(state.hostEl).not.toBe(staleHost);
    expect(state.hostEl).not.toBeNull();
    expect((state.hostEl as { isConnected: boolean }).isConnected).toBe(true);
    expect((state.gridEl as { isConnected: boolean } | null)?.isConnected).toBe(true);
    expect(rootElement.classList.contains('cw-watchlist-frame')).toBe(true);
  });

  it('does not hide curated hosts when hiding native watchlist content', () => {
    const state = createBaseState();
    const rootElement = new FakeElement('section');
    rootElement.setConnected(true);

    const primaryHost = new FakeElement('section');
    primaryHost.classList.add('cw-host');
    const secondaryHost = new FakeElement('section');
    secondaryHost.classList.add('cw-host');
    const nativeBody = new FakeElement('div');
    const headerElement = new FakeElement('header');

    const tabCrunchyroll = new FakeElement('button');
    const tabCurated = new FakeElement('button');
    const panel = new FakeElement('div');
    primaryHost.appendChild(tabCrunchyroll);
    primaryHost.appendChild(tabCurated);
    primaryHost.appendChild(panel);

    rootElement.appendChild(primaryHost);
    rootElement.appendChild(secondaryHost);
    rootElement.appendChild(headerElement);
    rootElement.appendChild(nativeBody);

    state.hostEl = primaryHost;
    state.tabCrunchyrollEl = tabCrunchyroll;
    state.tabCuratedEl = tabCurated;
    state.curatedPanelEl = panel;
    state.settings.activeTab = 'curated';

    const runtime = getInterfaceShellModule().createInterfaceShellRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      windowRef: {
        requestAnimationFrame: () => 0,
        dispatchEvent: () => true,
      },
      getWatchlistRoot: () => rootElement,
      getWatchlistHeader: () => headerElement,
      runtimeEvent: () => {},
      withMutedObserver: (work: () => void) => {
        work();
      },
      persistSettings: async () => null,
      applyCardLayoutUi: () => {},
      createCuratedInterfaceControls: () => ({
        controls: new FakeElement('div'),
        loadingIndicator: new FakeElement('span'),
        topLoadingIndicator: new FakeElement('span'),
        audioFilterControl: { select: new FakeElement('select') },
        genreFilterControl: { select: new FakeElement('select') },
        stats: new FakeElement('span'),
      }),
      bindCuratedInterfaceControls: () => {},
      ensureCuratedDataLoad: async () => null,
      renderCuratedPanel: () => {},
      debounceProcess: () => {},
      createEmptyWatchHistoryCache: () => ({}),
      storageSet: async () => null,
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    });

    runtime.applyTabUi();

    expect(primaryHost.style.display).not.toBe('none');
    expect(secondaryHost.style.display).not.toBe('none');
    expect(nativeBody.style.display).toBe('none');
    expect(state.nativeHiddenNodes).toEqual([
      {
        node: nativeBody,
        previousDisplay: '',
      },
    ]);
  });

  it('removes orphan curated hosts when rebuilding the interface shell', () => {
    const state = createBaseState();
    const rootElement = new FakeElement('section');
    rootElement.setConnected(true);

    const orphanHost = new FakeElement('section');
    orphanHost.classList.add('cw-host');
    const headerElement = new FakeElement('header');
    rootElement.appendChild(orphanHost);
    rootElement.appendChild(headerElement);

    const runtime = getInterfaceShellModule().createInterfaceShellRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      windowRef: {
        requestAnimationFrame: () => 0,
        dispatchEvent: () => true,
      },
      getWatchlistRoot: () => rootElement,
      getWatchlistHeader: () => headerElement,
      runtimeEvent: () => {},
      withMutedObserver: (work: () => void) => {
        work();
      },
      persistSettings: async () => null,
      applyCardLayoutUi: () => {},
      createCuratedInterfaceControls: () => ({
        controls: new FakeElement('div'),
        loadingIndicator: new FakeElement('span'),
        topLoadingIndicator: new FakeElement('span'),
        audioFilterControl: { select: new FakeElement('select') },
        genreFilterControl: { select: new FakeElement('select') },
        stats: new FakeElement('span'),
      }),
      bindCuratedInterfaceControls: () => {},
      ensureCuratedDataLoad: async () => null,
      renderCuratedPanel: () => {},
      debounceProcess: () => {},
      createEmptyWatchHistoryCache: () => ({}),
      storageSet: async () => null,
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    });

    runtime.ensureInterface();

    const curatedHostChildren = rootElement.children.filter((child) => child.className.split(' ').includes('cw-host'));
    expect(curatedHostChildren).toHaveLength(1);
    expect(curatedHostChildren[0]).toBe(state.hostEl);
    expect(orphanHost.isConnected).toBe(false);
  });

  it('disposes interface shell idempotently and restores native visibility', () => {
    const state = createBaseState();
    const rootElement = new FakeElement('section');
    rootElement.setConnected(true);
    const headerElement = new FakeElement('header');
    rootElement.appendChild(headerElement);
    const runtime = getInterfaceShellModule().createInterfaceShellRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      windowRef: {
        requestAnimationFrame: () => 0,
        dispatchEvent: () => true,
      },
      getWatchlistRoot: () => rootElement,
      getWatchlistHeader: () => headerElement,
      runtimeEvent: () => {},
      withMutedObserver: (work: () => void) => {
        work();
      },
      persistSettings: async () => null,
      applyCardLayoutUi: () => {},
      createCuratedInterfaceControls: () => ({
        controls: new FakeElement('div'),
        loadingIndicator: new FakeElement('span'),
        topLoadingIndicator: new FakeElement('span'),
        audioFilterControl: { select: new FakeElement('select') },
        genreFilterControl: { select: new FakeElement('select') },
        stats: new FakeElement('span'),
      }),
      bindCuratedInterfaceControls: () => {},
      ensureCuratedDataLoad: async () => null,
      renderCuratedPanel: () => {},
      debounceProcess: () => {},
      createEmptyWatchHistoryCache: () => ({}),
      storageSet: async () => null,
      ratingCacheKey: 'cw_rating_cache_v2',
      watchHistoryCacheKey: 'cw_watch_history_cache_v1',
    });

    runtime.ensureInterface();
    expect(state.hostEl).not.toBeNull();

    runtime.dispose();
    runtime.dispose();

    expect(state.hostEl).toBeNull();
    expect(state.gridEl).toBeNull();
  });
});
