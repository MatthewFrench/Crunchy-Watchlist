import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeElement = {
  tagName: string;
  className: string;
  textContent: string | null;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  style: Record<string, string>;
  children: FakeElement[];
  parentNode: FakeElement | null;
  clientWidth?: number;
  value?: string;
  title?: string;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  appendChild: (child: FakeElement) => FakeElement;
  insertBefore: (child: FakeElement, reference: FakeElement | null) => FakeElement;
  removeChild: (child: FakeElement) => FakeElement;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  querySelector: (selector: string) => FakeElement | null;
};

type FakeSelectOption = FakeElement & { value: string };

type FakeSelectElement = FakeElement & {
  options: FakeSelectOption[];
  value: string;
};

type CuratedPanelRuntime = {
  renderCuratedPanel: () => void;
  requestCuratedPanelRender?: () => void;
  dispose: () => void;
};

type CuratedPanelModule = {
  createCuratedPanelRuntime: (options: Record<string, unknown>) => CuratedPanelRuntime;
};

const curatedPanelModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanel.ts'),
).href;
let curatedPanelModule: CuratedPanelModule | null = null;

function createFakeElement(): FakeElement {
  const toDatasetKey = (attributeName: string): string =>
    attributeName.replace(/^data-/, '').replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase());

  const detachFromParent = (child: FakeElement): void => {
    if (!child.parentNode) {
      return;
    }
    const parent = child.parentNode;
    const index = parent.children.indexOf(child);
    if (index >= 0) {
      parent.children.splice(index, 1);
    }
    child.parentNode = null;
  };

  let textContentValue: string | null = '';
  const element: FakeElement = {
    tagName: 'div',
    className: '',
    textContent: '',
    dataset: {},
    attributes: {},
    style: {},
    children: [],
    parentNode: null,
    appendChild(child: FakeElement) {
      detachFromParent(child);
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    insertBefore(child: FakeElement, reference: FakeElement | null) {
      detachFromParent(child);
      if (!reference) {
        this.children.push(child);
        child.parentNode = this;
        return child;
      }
      const index = this.children.indexOf(reference);
      if (index < 0) {
        this.children.push(child);
      } else {
        this.children.splice(index, 0, child);
      }
      child.parentNode = this;
      return child;
    },
    removeChild(child: FakeElement) {
      const index = this.children.indexOf(child);
      if (index >= 0) {
        this.children.splice(index, 1);
        child.parentNode = null;
      }
      return child;
    },
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
      if (name === 'class') {
        this.className = value;
      }
      if (name.startsWith('data-')) {
        this.dataset[toDatasetKey(name)] = value;
      }
    },
    getAttribute(name: string) {
      if (name === 'class') {
        return this.className || null;
      }
      if (name.startsWith('data-')) {
        const dataValue = this.dataset[toDatasetKey(name)];
        if (typeof dataValue === 'string') {
          return dataValue;
        }
      }
      return this.attributes[name] ?? null;
    },
    querySelector(selector: string) {
      const matchesSelector = (candidate: FakeElement): boolean => {
        if (selector === 'button[data-cw-action="favorite"]') {
          return candidate.tagName === 'button' && candidate.dataset.cwAction === 'favorite';
        }
        return false;
      };

      const visit = (candidate: FakeElement): FakeElement | null => {
        for (const child of candidate.children) {
          if (matchesSelector(child)) {
            return child;
          }
          const nested = visit(child);
          if (nested) {
            return nested;
          }
        }
        return null;
      };

      return visit(this);
    },
  };
  Object.defineProperty(element, 'textContent', {
    get() {
      return textContentValue;
    },
    set(value: string | null) {
      textContentValue = value;
      if (typeof value === 'string') {
        element.children = [];
        if (Array.isArray((element as FakeSelectElement).options)) {
          (element as FakeSelectElement).options = [];
        }
      }
    },
    enumerable: true,
    configurable: true,
  });
  return element;
}

function createFakeSelectElement(): FakeSelectElement {
  const element = createFakeElement() as FakeSelectElement;
  element.tagName = 'select';
  element.options = [];
  element.value = '';
  const appendChild = element.appendChild.bind(element);
  element.appendChild = function appendOption(child: FakeElement) {
    appendChild(child);
    const option = child as FakeSelectOption;
    if (typeof option.value === 'string') {
      this.options.push(option);
    }
    return child;
  };
  return element;
}

function getCuratedPanelModule() {
  if (!curatedPanelModule) {
    throw new Error('Curated panel module was not initialized for test');
  }
  return curatedPanelModule;
}

function createFakeDocumentRef() {
  return {
    createElement: (tagName = 'div') => {
      const element = createFakeElement();
      element.tagName = String(tagName).toLowerCase();
      if (element.tagName === 'option') {
        element.value = '';
      }
      return element;
    },
    createDocumentFragment: () => {
      const fragment = createFakeElement();
      fragment.tagName = '#document-fragment';
      return fragment;
    },
  };
}

function hasClassName(element: FakeElement, className: string): boolean {
  return element.className.split(' ').filter(Boolean).includes(className);
}

function findElementByClassName(element: FakeElement, className: string): FakeElement | null {
  if (hasClassName(element, className)) {
    return element;
  }

  for (const child of element.children) {
    const found = findElementByClassName(child, className);
    if (found) {
      return found;
    }
  }

  return null;
}

describe('curated-panel runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const curatedPanelRuntimeModule = (await import(curatedPanelModuleUrl)) as {
      createRuntimeCuratedPanelRuntime: () => object;
    };
    curatedPanelModule = curatedPanelRuntimeModule.createRuntimeCuratedPanelRuntime() as CuratedPanelModule;
  });

  afterEach(() => {
    curatedPanelModule = null;
    vi.unstubAllGlobals();
  });

  it('renders visible curated entries and updates panel status fields', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const controlsLoadingIndicatorEl = createFakeElement();
    const audioFilterSelectEl = createFakeSelectElement();
    const genreFilterSelectEl = createFakeSelectElement();

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedPendingRequests: [] as string[],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      controlsLoadingIndicatorEl,
      audioFilterSelectEl,
      genreFilterSelectEl,
      settings: {
        cardLayout: 'portrait',
      },
    };

    let applyCardLayoutCalls = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => {
        const card = createFakeElement();
        card.className = 'card';
        return card;
      },
      applyCardLayoutUi: () => {
        applyCardLayoutCalls += 1;
      },
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 2,
        visible: [{ seriesId: 'series-1', watchReady: true }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();

    expect(applyCardLayoutCalls).toBe(1);
    expect(audioFilterSelectEl.options).toHaveLength(1);
    expect(audioFilterSelectEl.options[0]?.value).toBe('any');
    expect(audioFilterSelectEl.value).toBe('any');
    expect(genreFilterSelectEl.options).toHaveLength(1);
    expect(genreFilterSelectEl.options[0]?.value).toBe('any');
    expect(genreFilterSelectEl.value).toBe('any');
    expect(state.curatedGridRenderSignature).not.toBe('');
    expect(statsEl.textContent).toBe('Showing 1 of 2');
    expect(loadingIndicatorEl.style.display).toBe('none');
    expect(controlsLoadingIndicatorEl.style.display).toBe('none');
    expect(gridEl.children).toHaveLength(1);
  });

  it('prewarms filtered hidden cards without mounting them as active visible cards', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const controlsLoadingIndicatorEl = createFakeElement();

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedPendingRequests: [] as string[],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      controlsLoadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => {
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 2,
        visible: [{ seriesId: 'series-visible', watchReady: true }],
        retainedHidden: [{ seriesId: 'series-hidden', watchReady: false }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();

    expect(gridEl.children).toHaveLength(2);
    const hiddenCard = gridEl.children.find((child) => hasClassName(child, 'cw-curated-card--parked')) || null;
    const visibleCard = gridEl.children.find((child) => hasClassName(child, 'cw-curated-card')) || null;
    expect(hiddenCard).not.toBeNull();
    expect(hiddenCard?.style.display).toBe('none');
    expect(visibleCard).not.toBeNull();
    expect(visibleCard?.style.display || '').toBe('');
  });

  it('uses compact visible revision signatures instead of serializing full visible payloads', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const uniqueDescription = 'signature-should-not-inline-full-visible-description';

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedPendingRequests: [] as string[],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => {
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [
          {
            seriesId: 'series-1',
            title: 'Series 1',
            description: uniqueDescription,
            distribution: { 5: 10 },
            watchHistoryProgressEntry: { fullyWatched: false, playhead: 200 },
          },
        ],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();

    expect(state.curatedGridRenderSignature).toContain('visible:count:1');
    expect(state.curatedGridRenderSignature).toContain('hash:');
    expect(state.curatedGridRenderSignature.includes(uniqueDescription)).toBe(false);
  });

  it('includes parent width in the render signature and updates it when width changes', () => {
    const gridContainerEl = createFakeElement();
    const gridEl = createFakeElement();
    gridContainerEl.appendChild(gridEl);
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    let containerWidth = 960;
    gridContainerEl.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: containerWidth,
      height: 0,
    });

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => {
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [{ seriesId: 'series-1', title: 'Series 1' }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const firstSignature = state.curatedGridRenderSignature;
    expect(firstSignature).toContain('grid:960');

    containerWidth = 640;
    runtime.renderCuratedPanel();

    expect(state.curatedGridRenderSignature).toContain('grid:640');
    expect(state.curatedGridRenderSignature).not.toBe(firstSignature);
  });

  it('requests a new render when observed parent width changes', async () => {
    const gridContainerEl = createFakeElement();
    const gridEl = createFakeElement();
    gridContainerEl.appendChild(gridEl);
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    let containerWidth = 920;
    gridContainerEl.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: containerWidth,
      height: 0,
    });

    const resizeObserverCallbacks: Array<(...args: unknown[]) => void> = [];
    const observedTargets: Element[] = [];
    let disconnectCalls = 0;
    class FakeResizeObserver {
      constructor(callback: (...args: unknown[]) => void) {
        resizeObserverCallbacks.push(callback);
      }

      observe(target: Element): void {
        observedTargets.push(target);
      }

      unobserve(): void {}

      disconnect(): void {
        disconnectCalls += 1;
      }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    let buildRenderableCalls = 0;
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => {
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        buildRenderableCalls += 1;
        return {
          mode: 'hide',
          total: 1,
          visible: [{ seriesId: 'series-1', title: 'Series 1' }],
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const initialSignature = state.curatedGridRenderSignature;
    expect(observedTargets[observedTargets.length - 1]).toBe(gridContainerEl as unknown as Element);

    containerWidth = 700;
    resizeObserverCallbacks[0]?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(buildRenderableCalls).toBe(2);
    expect(state.curatedGridRenderSignature).toContain('grid:700');
    expect(state.curatedGridRenderSignature).not.toBe(initialSignature);

    runtime.dispose();
    expect(disconnectCalls).toBe(1);
  });

  it('shows in-flight request labels in the shared panel loading indicator during empty first-load state', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const controlsLoadingIndicatorEl = createFakeElement();

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: [
        'Authorizing Crunchyroll API token (/auth/v1/token)',
        'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
        'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
      ],
      curatedPendingRequestStartedCount: 4,
      curatedPendingRequestCompletedCount: 1,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      controlsLoadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 0,
        visible: [],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();

    const requestsList = findElementByClassName(loadingIndicatorEl, 'cw-loading__requests');
    const progressLine = findElementByClassName(loadingIndicatorEl, 'cw-loading__progress');
    const progressTitle = findElementByClassName(loadingIndicatorEl, 'cw-loading__details-title');
    const nestedGridLoading = findElementByClassName(gridEl, 'cw-loading');
    expect(requestsList).not.toBeNull();
    expect(requestsList?.children.map((child) => child.textContent)).toEqual(state.curatedPendingRequests);
    expect(progressTitle?.textContent).toBe('Loading progress');
    expect(progressLine?.textContent).toBe('Completed 1 of 4 • In progress 3');
    expect(nestedGridLoading).toBeNull();
    expect(loadingIndicatorEl.style.display).toBe('flex');
    expect(controlsLoadingIndicatorEl.style.display).toBe('inline-flex');
    expect(statsEl.textContent).toBe('');
  });

  it('mentions deferred metadata as blocking work while the first-load panel remains open', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    loadingIndicatorEl.className = 'cw-loading cw-loading-indicator';

    const loadingBox = createFakeElement();
    loadingBox.className = 'cw-loading-box';
    loadingBox.appendChild(loadingIndicatorEl);

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [{ seriesId: 'series-1', title: 'Series 1' }],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedDeferredMetadataInFlight: false,
      curatedInitialLoadDone: false,
      curatedPendingRequests: ['Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)'],
      curatedPendingRequestStartedCount: 1,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingBoxEl: loadingBox,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [{ seriesId: 'series-1', title: 'Series 1' }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();

    state.curatedInflight = null;
    state.curatedDeferredMetadataInFlight = true;
    state.curatedInitialLoadDone = true;
    state.curatedPendingRequests = [];
    state.curatedPendingRequestStartedCount = 4;
    state.curatedPendingRequestCompletedCount = 4;
    runtime.renderCuratedPanel();

    const requestsList = findElementByClassName(loadingIndicatorEl, 'cw-loading__requests');
    const progressLine = findElementByClassName(loadingIndicatorEl, 'cw-loading__progress');
    expect(loadingBox.style.display).toBe('block');
    expect(progressLine?.textContent).toBe('Completed 4 of 5 • In progress 1');
    expect(requestsList?.children.map((child) => child.textContent)).toEqual(['Finishing remaining card details']);
  });

  it('updates the existing shared loading indicator in place without nesting another loading widget', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    loadingIndicatorEl.className = 'cw-loading cw-loading-indicator';
    const heading = createFakeElement();
    heading.className = 'cw-loading__heading';
    const spinner = createFakeElement();
    spinner.className = 'cw-spinner';
    const label = createFakeElement();
    label.className = 'cw-loading__label';
    label.textContent = 'Loading';
    heading.appendChild(spinner);
    heading.appendChild(label);
    loadingIndicatorEl.appendChild(heading);

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: [
        'Authorizing Crunchyroll API token (/auth/v1/token)',
        'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
      ],
      curatedPendingRequestStartedCount: 4,
      curatedPendingRequestCompletedCount: 1,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [{ seriesId: 'series-1', title: 'Series 1' }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();

    const nestedLoadingChild = loadingIndicatorEl.children.find((child) => child.className === 'cw-loading');
    const progressLine = findElementByClassName(loadingIndicatorEl, 'cw-loading__progress');
    const requestsList = findElementByClassName(loadingIndicatorEl, 'cw-loading__requests');
    expect(nestedLoadingChild).toBeUndefined();
    expect(progressLine?.textContent).toBe('Completed 1 of 4 • In progress 2');
    expect(requestsList?.children.map((child) => child.textContent)).toEqual(state.curatedPendingRequests);
  });

  it('hides the first-load loading box after initial load has completed even if a refresh is inflight', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    loadingIndicatorEl.className = 'cw-loading cw-loading-indicator';

    const loadingBox = createFakeElement();
    loadingBox.className = 'cw-empty cw-loading-box';
    loadingBox.appendChild(loadingIndicatorEl);

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [{ seriesId: 'series-1', title: 'Series 1' }],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedInitialLoadDone: true,
      curatedPendingRequests: ['Fetching ratings (/content-reviews/v3/rating/series/{series_id})'],
      curatedPendingRequestStartedCount: 2,
      curatedPendingRequestCompletedCount: 1,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [{ seriesId: 'series-1', title: 'Series 1' }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();

    expect(loadingIndicatorEl.style.display).toBe('none');
    expect(loadingBox.style.display).toBe('none');
  });

  it('keeps the loading box visible for empty-list refreshes after initial load', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    loadingIndicatorEl.className = 'cw-loading cw-loading-indicator';

    const loadingBox = createFakeElement();
    loadingBox.className = 'cw-empty cw-loading-box';
    loadingBox.appendChild(loadingIndicatorEl);

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedInitialLoadDone: true,
      curatedPendingRequests: ['Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)'],
      curatedPendingRequestStartedCount: 1,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 0,
        visible: [],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();

    expect(loadingIndicatorEl.style.display).toBe('flex');
    expect(loadingBox.style.display).toBe('block');
  });

  it('keeps the first-load loading box visible until deferred metadata settles', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    loadingIndicatorEl.className = 'cw-loading cw-loading-indicator';

    const loadingBox = createFakeElement();
    loadingBox.className = 'cw-loading-box';
    loadingBox.appendChild(loadingIndicatorEl);

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [{ seriesId: 'series-1', title: 'Series 1' }],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedDeferredMetadataInFlight: false,
      curatedInitialLoadDone: false,
      curatedPendingRequests: ['Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)'],
      curatedPendingRequestStartedCount: 1,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingBoxEl: loadingBox,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [{ seriesId: 'series-1', title: 'Series 1' }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    expect(loadingBox.style.display).toBe('block');

    state.curatedInflight = null;
    state.curatedInitialLoadDone = true;
    state.curatedDeferredMetadataInFlight = true;
    state.curatedPendingRequests = ['Fetching ratings (/content-reviews/v3/rating/series/{series_id})'];
    state.curatedPendingRequestStartedCount = 2;
    state.curatedPendingRequestCompletedCount = 1;
    runtime.renderCuratedPanel();
    expect(loadingBox.style.display).toBe('block');

    state.curatedDeferredMetadataInFlight = false;
    state.curatedPendingRequests = [];
    state.curatedPendingRequestCompletedCount = 2;
    runtime.renderCuratedPanel();
    expect(loadingBox.style.display).toBe('none');
  });

  it('keeps the curated grid visible once shown even if first-load loading state reappears', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    loadingIndicatorEl.className = 'cw-loading cw-loading-indicator';
    const loadingBox = createFakeElement();
    loadingBox.className = 'cw-empty cw-loading-box';
    loadingBox.appendChild(loadingIndicatorEl);

    let renderVisibleEntries = true;
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [{ seriesId: 'series-1', title: 'Series 1' }],
      curatedInflight: null as Promise<unknown[]> | null,
      curatedInitialLoadDone: true,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () =>
        renderVisibleEntries
          ? {
              mode: 'hide',
              total: 1,
              visible: [{ seriesId: 'series-1', title: 'Series 1' }],
              audioOptions: [{ optionValue: 'any', title: 'Any language' }],
              genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
              selectedAudioFilter: 'any',
              selectedGenreFilter: 'any',
            }
          : {
              mode: 'hide',
              total: 0,
              visible: [],
              audioOptions: [{ optionValue: 'any', title: 'Any language' }],
              genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
              selectedAudioFilter: 'any',
              selectedGenreFilter: 'any',
            },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    expect(gridEl.className).toContain('cw-curated-grid--visible');

    renderVisibleEntries = false;
    state.curatedEntries = [];
    state.curatedInflight = Promise.resolve([]) as Promise<unknown[]> | null;
    state.curatedInitialLoadDone = false;

    runtime.renderCuratedPanel();
    expect(gridEl.className).toContain('cw-curated-grid--visible');
  });

  it('shows filtered-count stats for hide_not_started mode', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide_not_started',
        total: 5,
        visible: [{ seriesId: 'series-1' }, { seriesId: 'series-2' }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();

    expect(statsEl.textContent).toBe('Showing 2 of 5');
  });

  it('reuses existing card nodes and updates dom order when render order changes', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const renderables = [
      [
        { seriesId: 'series-1', title: 'Series 1' },
        { seriesId: 'series-2', title: 'Series 2' },
        { seriesId: 'series-3', title: 'Series 3' },
      ],
      [
        { seriesId: 'series-3', title: 'Series 3' },
        { seriesId: 'series-1', title: 'Series 1' },
        { seriesId: 'series-2', title: 'Series 2' },
      ],
    ];
    let renderIndex = 0;
    let createdCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedGridRenderSignature: '',
        gridEl,
        statsEl,
        loadingIndicatorEl,
        audioFilterSelectEl: createFakeSelectElement(),
        genreFilterSelectEl: createFakeSelectElement(),
        settings: {
          cardLayout: 'portrait',
        },
      },
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.tagName = 'article';
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const firstRenderCards = [...gridEl.children];

    renderIndex = 1;
    runtime.renderCuratedPanel();

    expect(createdCards).toBe(3);
    expect(gridEl.children).toEqual([firstRenderCards[2], firstRenderCards[0], firstRenderCards[1]]);
  });

  it('parks filtered cards and reuses the same nodes when they re-enter visibility', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const renderables = [
      [
        { seriesId: 'series-1', title: 'Series 1' },
        { seriesId: 'series-2', title: 'Series 2' },
      ],
      [{ seriesId: 'series-1', title: 'Series 1' }],
      [
        { seriesId: 'series-1', title: 'Series 1' },
        { seriesId: 'series-2', title: 'Series 2' },
      ],
    ];
    let renderIndex = 0;
    let createdCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedGridRenderSignature: '',
        gridEl,
        statsEl,
        loadingIndicatorEl,
        audioFilterSelectEl: createFakeSelectElement(),
        genreFilterSelectEl: createFakeSelectElement(),
        settings: {
          cardLayout: 'portrait',
        },
      },
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const firstCard = gridEl.children[0];
    const secondCard = gridEl.children[1];
    expect(createdCards).toBe(2);

    renderIndex = 1;
    runtime.renderCuratedPanel();

    expect(gridEl.children).toEqual([firstCard]);
    expect(secondCard?.className.includes('cw-curated-card--parked')).toBe(true);

    renderIndex = 2;
    runtime.renderCuratedPanel();

    expect(createdCards).toBe(2);
    expect(gridEl.children).toEqual([firstCard, secondCard]);
    expect(secondCard?.className.includes('cw-curated-card--parked')).toBe(false);
  });

  it('tracks dom lifecycle counters while reordering/filtering without recreating stable cards', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const renderables = [
      [
        { seriesId: 'series-1', title: 'Series 1', description: 'a' },
        { seriesId: 'series-2', title: 'Series 2', description: 'a' },
      ],
      [
        { seriesId: 'series-2', title: 'Series 2', description: 'a' },
        { seriesId: 'series-1', title: 'Series 1', description: 'a' },
      ],
      [{ seriesId: 'series-1', title: 'Series 1', description: 'a' }],
      [
        { seriesId: 'series-1', title: 'Series 1', description: 'a' },
        { seriesId: 'series-2', title: 'Series 2', description: 'a' },
      ],
      [
        { seriesId: 'series-1', title: 'Series 1', description: 'updated' },
        { seriesId: 'series-2', title: 'Series 2', description: 'a' },
      ],
    ];
    let renderIndex = 0;
    let createdCards = 0;

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      curatedDomLifecycleCounters: {
        created: 0,
        patched: 0,
        parked: 0,
        unparked: 0,
        disposed: 0,
        renderPasses: 0,
      },
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      patchCuratedCard: () => undefined,
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    renderIndex = 1;
    runtime.renderCuratedPanel();
    renderIndex = 2;
    runtime.renderCuratedPanel();
    renderIndex = 3;
    runtime.renderCuratedPanel();
    renderIndex = 4;
    runtime.renderCuratedPanel();

    expect(createdCards).toBe(2);
    expect(state.curatedDomLifecycleCounters.created).toBe(2);
    expect(state.curatedDomLifecycleCounters.patched).toBeGreaterThanOrEqual(1);
    expect(state.curatedDomLifecycleCounters.parked).toBeGreaterThanOrEqual(1);
    expect(state.curatedDomLifecycleCounters.unparked).toBeGreaterThanOrEqual(1);
    expect(state.curatedDomLifecycleCounters.disposed).toBe(0);
    expect(state.curatedDomLifecycleCounters.renderPasses).toBe(5);
  });

  it('re-attaches existing card nodes when external dom churn clears the curated grid', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    let createdCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedGridRenderSignature: '',
        gridEl,
        statsEl,
        loadingIndicatorEl,
        audioFilterSelectEl: createFakeSelectElement(),
        genreFilterSelectEl: createFakeSelectElement(),
        settings: {
          cardLayout: 'portrait',
        },
      },
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [{ seriesId: 'series-1', title: 'Series 1' }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    expect(gridEl.children).toHaveLength(1);
    expect(createdCards).toBe(1);
    const firstCard = gridEl.children[0];

    // Simulate host-page DOM churn wiping extension-rendered children.
    gridEl.textContent = '';
    expect(gridEl.children).toHaveLength(0);

    runtime.renderCuratedPanel();

    expect(gridEl.children).toHaveLength(1);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(createdCards).toBe(1);
  });

  it('coalesces queued render requests into a single panel render per microtask', async () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    let applyCardLayoutCalls = 0;
    let buildRenderableCalls = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedGridRenderSignature: '',
        gridEl,
        statsEl,
        loadingIndicatorEl,
        audioFilterSelectEl: createFakeSelectElement(),
        genreFilterSelectEl: createFakeSelectElement(),
        settings: {
          cardLayout: 'portrait',
        },
      },
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      applyCardLayoutUi: () => {
        applyCardLayoutCalls += 1;
      },
      buildRenderableEntries: () => {
        buildRenderableCalls += 1;
        return {
          mode: 'hide',
          total: 1,
          visible: [{ seriesId: 'series-1', title: 'Series 1' }],
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    if (typeof runtime.requestCuratedPanelRender !== 'function') {
      throw new Error('Missing requestCuratedPanelRender runtime method');
    }

    runtime.requestCuratedPanelRender();
    runtime.requestCuratedPanelRender();
    runtime.requestCuratedPanelRender();
    expect(applyCardLayoutCalls).toBe(0);
    expect(buildRenderableCalls).toBe(0);

    await Promise.resolve();
    await Promise.resolve();

    expect(applyCardLayoutCalls).toBe(1);
    expect(buildRenderableCalls).toBe(1);
  });

  it('patches favorite button state in place without recreating the card', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const renderables = [
      [{ seriesId: 'series-1', title: 'Series 1', isFavorite: false, rating: 4.5 }],
      [{ seriesId: 'series-1', title: 'Series 1', isFavorite: true, rating: 4.5 }],
    ];
    let renderIndex = 0;
    let createdCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedGridRenderSignature: '',
        gridEl,
        statsEl,
        loadingIndicatorEl,
        audioFilterSelectEl: createFakeSelectElement(),
        genreFilterSelectEl: createFakeSelectElement(),
        settings: {
          cardLayout: 'portrait',
        },
      },
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => {
        createdCards += 1;
        const card = createFakeElement();
        card.tagName = 'article';
        card.className = 'cw-curated-card';
        const favoriteButton = createFakeElement();
        favoriteButton.tagName = 'button';
        favoriteButton.className = 'cw-card-action cw-card-action--favorite';
        favoriteButton.dataset.cwAction = 'favorite';
        favoriteButton.setAttribute('data-cw-action', 'favorite');
        favoriteButton.textContent = '♡';
        card.appendChild(favoriteButton);
        return card;
      },
      patchCuratedCard: (card: Record<string, unknown>, entry: Record<string, unknown>) => {
        const favoriteButton = (card as FakeElement).querySelector('button[data-cw-action="favorite"]');
        if (!favoriteButton) {
          return;
        }
        const isFavorite = Boolean(entry.isFavorite);
        favoriteButton.className = isFavorite
          ? 'cw-card-action cw-card-action--favorite is-active'
          : 'cw-card-action cw-card-action--favorite';
        favoriteButton.setAttribute('aria-label', isFavorite ? 'Unfavorite' : 'Favorite');
        favoriteButton.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
        favoriteButton.textContent = isFavorite ? '♥' : '♡';
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const firstCard = gridEl.children[0];
    const favoriteButton = firstCard?.querySelector('button[data-cw-action="favorite"]');
    expect(favoriteButton?.textContent).toBe('♡');
    expect(favoriteButton?.className.includes('is-active')).toBe(false);

    renderIndex = 1;
    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(favoriteButton?.textContent).toBe('♥');
    expect(favoriteButton?.className.includes('is-active')).toBe(true);
    expect(favoriteButton?.getAttribute('aria-pressed')).toBe('true');
    expect(favoriteButton?.getAttribute('aria-label')).toBe('Unfavorite');
  });

  it('marks cards with metadata-loading state while enrichment requests are inflight', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const visible = [{ seriesId: 'series-1', title: 'Series 1', rating: null, watchHistoryProgressEntry: null }];
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: ['Fetching ratings (/content-reviews/v3/rating/series/{series_id})'],
      curatedPendingRequestStartedCount: 3,
      curatedPendingRequestCompletedCount: 1,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };
    let createdCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: visible.length,
        visible,
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('true');

    state.curatedInflight = null;
    state.curatedPendingRequests = [];
    state.curatedPendingRequestStartedCount = 3;
    state.curatedPendingRequestCompletedCount = 3;

    runtime.renderCuratedPanel();
    expect(createdCards).toBe(1);
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('false');
  });

  it('keeps metadata loading enabled while curated inflight is active even if pending labels are briefly empty', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const visible = [{ seriesId: 'series-1', title: 'Series 1', rating: null, watchHistoryProgressEntry: null }];
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 4,
      curatedPendingRequestCompletedCount: 4,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: visible.length,
        visible,
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('true');
  });

  it('does not rebuild cards when content changes if patchCuratedCard is unavailable', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const renderables = [
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          rating: 4.3,
          votes: 160,
          distribution: { 5: 80 },
          neverWatched: false,
          lastWatchedMs: 1_710_000_000_000,
          watchHistoryProgressEntry: {
            playheadMs: 1200,
          },
        },
      ],
      [
        {
          seriesId: 'series-1',
          title: 'Series 1 (Updated)',
          rating: 4.8,
          votes: 420,
          distribution: { 5: 250 },
          neverWatched: false,
          lastWatchedMs: 1_710_100_000_000,
          watchHistoryProgressEntry: {
            playheadMs: 1800,
          },
        },
      ],
    ];
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null as Promise<unknown[]> | null,
      curatedPendingRequests: [] as string[],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };
    let renderIndex = 0;
    let createdCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        card.dataset.cwRenderTitle = String(entry.title || '');
        return card;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const firstCard = gridEl.children[0];
    expect(firstCard?.dataset.cwRenderTitle).toBe('Series 1');
    expect(createdCards).toBe(1);

    renderIndex = 1;
    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(gridEl.children[0]?.dataset.cwRenderTitle).toBe('Series 1');
  });

  it('defers card refresh while metadata is pending, then patches the existing card once loading completes', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const renderables = [
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Initial description',
          rating: 4.2,
          votes: 120,
          distribution: { 5: 60 },
          neverWatched: false,
          lastWatchedMs: null,
          watchHistoryProgressEntry: null,
        },
      ],
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Updated description',
          rating: 4.6,
          votes: 380,
          distribution: { 5: 78 },
          neverWatched: false,
          lastWatchedMs: null,
          watchHistoryProgressEntry: null,
        },
      ],
    ];
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: ['Fetching watch history (/watch-history/v2/{account_id}/watchlist)'],
      curatedPendingRequestStartedCount: 2,
      curatedPendingRequestCompletedCount: 1,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };
    let renderIndex = 0;
    let createdCards = 0;
    let patchedCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      patchCuratedCard: (card: Record<string, unknown>, entry: Record<string, unknown>) => {
        patchedCards += 1;
        const dataset = (card.dataset && typeof card.dataset === 'object' ? card.dataset : {}) as Record<
          string,
          string
        >;
        dataset.cwPatchedDescription = String(entry.description || '');
        card.dataset = dataset;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const firstCard = gridEl.children[0];
    expect(createdCards).toBe(1);
    expect(firstCard?.dataset.cwLoadingDetails).toBe('true');

    renderIndex = 1;
    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('true');

    state.curatedInflight = null;
    state.curatedPendingRequests = [];
    state.curatedPendingRequestStartedCount = 2;
    state.curatedPendingRequestCompletedCount = 2;

    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(patchedCards).toBe(1);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('false');
    expect(gridEl.children[0]?.dataset.cwPatchedDescription).toBe('Updated description');
  });

  it('keeps existing details visible during refresh while metadata revalidation is in flight', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const renderables = [
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Initial description',
          rating: 4.2,
          votes: 120,
          distribution: { 5: 60 },
          neverWatched: false,
          lastWatchedMs: 1_710_000_000_000,
          watchHistoryProgressEntry: {
            playheadMs: 1200,
          },
        },
      ],
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Updated description',
          rating: null,
          votes: null,
          distribution: null,
          neverWatched: false,
          lastWatchedMs: null,
          watchHistoryProgressEntry: null,
        },
      ],
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Updated description',
          rating: 4.6,
          votes: 380,
          distribution: { 5: 78 },
          neverWatched: false,
          lastWatchedMs: 1_710_100_000_000,
          watchHistoryProgressEntry: {
            playheadMs: 2200,
          },
        },
      ],
    ];
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null as Promise<unknown[]> | null,
      curatedPendingRequests: [] as string[],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };
    let renderIndex = 0;
    let createdCards = 0;
    let patchedCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        card.dataset.cwRenderedDescription = String(entry.description || '');
        return card;
      },
      patchCuratedCard: (card: Record<string, unknown>, entry: Record<string, unknown>) => {
        patchedCards += 1;
        const dataset = (card.dataset && typeof card.dataset === 'object' ? card.dataset : {}) as Record<
          string,
          string
        >;
        dataset.cwRenderedDescription = String(entry.description || '');
        card.dataset = dataset;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const firstCard = gridEl.children[0];
    expect(firstCard?.dataset.cwLoadingDetails).toBe('false');
    expect(firstCard?.dataset.cwRenderedDescription).toBe('Initial description');
    expect(patchedCards).toBe(0);

    renderIndex = 1;
    state.curatedInflight = Promise.resolve([]) as Promise<unknown[]> | null;
    state.curatedPendingRequests = ['Fetching ratings (/content-reviews/v3/rating/series/{series_id})'];
    state.curatedPendingRequestStartedCount = 1;
    state.curatedPendingRequestCompletedCount = 0;

    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(patchedCards).toBe(0);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('false');
    expect(gridEl.children[0]?.dataset.cwRenderedDescription).toBe('Initial description');

    renderIndex = 2;
    state.curatedInflight = null;
    state.curatedPendingRequests = [];
    state.curatedPendingRequestStartedCount = 1;
    state.curatedPendingRequestCompletedCount = 1;

    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(patchedCards).toBe(1);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('false');
    expect(gridEl.children[0]?.dataset.cwRenderedDescription).toBe('Updated description');
  });

  it('patches the existing card when metadata loading settles even if entry content did not change', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const renderables = [
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Stable description',
          rating: 4.2,
          votes: 120,
          distribution: { 5: 60 },
          neverWatched: false,
          lastWatchedMs: null,
          watchHistoryProgressEntry: null,
        },
      ],
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Stable description',
          rating: 4.2,
          votes: 120,
          distribution: { 5: 60 },
          neverWatched: false,
          lastWatchedMs: null,
          watchHistoryProgressEntry: null,
        },
      ],
    ];
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: ['Fetching watch history (/watch-history/v2/{account_id}/watchlist)'],
      curatedPendingRequestStartedCount: 2,
      curatedPendingRequestCompletedCount: 1,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };
    let renderIndex = 0;
    let createdCards = 0;
    let patchedCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      patchCuratedCard: (card: Record<string, unknown>) => {
        patchedCards += 1;
        const dataset = (card.dataset && typeof card.dataset === 'object' ? card.dataset : {}) as Record<
          string,
          string
        >;
        dataset.cwPatchedCount = String(patchedCards);
        card.dataset = dataset;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const firstCard = gridEl.children[0];
    expect(createdCards).toBe(1);
    expect(firstCard?.dataset.cwLoadingDetails).toBe('true');

    renderIndex = 1;
    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(patchedCards).toBe(0);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('true');

    state.curatedInflight = null;
    state.curatedPendingRequests = [];
    state.curatedPendingRequestStartedCount = 2;
    state.curatedPendingRequestCompletedCount = 2;

    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(patchedCards).toBe(1);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('false');
    expect(gridEl.children[0]?.dataset.cwPatchedCount).toBe('1');
  });

  it('defers card refresh while deferred metadata is inflight, then patches in place', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const renderables = [
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Initial description',
          rating: 4.2,
          votes: 120,
          distribution: { 5: 60 },
          neverWatched: false,
          lastWatchedMs: null,
          watchHistoryProgressEntry: null,
        },
      ],
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Deferred metadata update',
          rating: 4.6,
          votes: 380,
          distribution: { 5: 78 },
          neverWatched: false,
          lastWatchedMs: null,
          watchHistoryProgressEntry: null,
        },
      ],
    ];
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null as Promise<unknown[]> | null,
      curatedDeferredMetadataInFlight: true,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };
    let renderIndex = 0;
    let createdCards = 0;
    let patchedCards = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1;
        const card = createFakeElement();
        card.className = 'cw-curated-card';
        card.dataset.cwSeriesId = String(entry.seriesId || '');
        return card;
      },
      patchCuratedCard: (card: Record<string, unknown>, entry: Record<string, unknown>) => {
        patchedCards += 1;
        const dataset = (card.dataset && typeof card.dataset === 'object' ? card.dataset : {}) as Record<
          string,
          string
        >;
        dataset.cwPatchedDescription = String(entry.description || '');
        card.dataset = dataset;
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.renderCuratedPanel();
    const firstCard = gridEl.children[0];
    expect(createdCards).toBe(1);
    expect(firstCard?.dataset.cwLoadingDetails).toBe('true');

    renderIndex = 1;
    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('true');

    state.curatedDeferredMetadataInFlight = false;
    runtime.renderCuratedPanel();

    expect(createdCards).toBe(1);
    expect(patchedCards).toBe(1);
    expect(gridEl.children[0]).toBe(firstCard);
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('false');
    expect(gridEl.children[0]?.dataset.cwPatchedDescription).toBe('Deferred metadata update');
  });

  it('stops rendering work after dispose is called', () => {
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    let buildCalls = 0;

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedGridRenderSignature: '',
        gridEl,
        statsEl,
        loadingIndicatorEl,
        audioFilterSelectEl: createFakeSelectElement(),
        genreFilterSelectEl: createFakeSelectElement(),
        settings: {
          cardLayout: 'portrait',
        },
      },
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        buildCalls += 1;
        return {
          mode: 'hide',
          total: 0,
          visible: [],
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        };
      },
      withMutedObserver: (work: () => void) => {
        work();
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    });

    runtime.dispose();
    runtime.dispose();
    runtime.renderCuratedPanel();
    runtime.requestCuratedPanelRender?.();

    expect(buildCalls).toBe(0);
  });
});
