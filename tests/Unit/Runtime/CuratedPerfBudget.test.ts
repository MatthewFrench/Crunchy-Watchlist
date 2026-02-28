import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type CuratedRenderableRuntime = {
  buildRenderableEntries: (
    entries: Record<string, unknown>[],
    settings: Record<string, unknown>,
  ) => {
    mode: string;
    total: number;
    visible: Array<Record<string, unknown>>;
    audioOptions: Array<{ optionValue: string; title: string }>;
    genreOptions: Array<{ optionValue: string; title: string }>;
    selectedAudioFilter: string;
    selectedGenreFilter: string;
  };
};

type CuratedPanelRuntime = {
  renderCuratedPanel: () => void;
};

type CuratedPanelRuntimeFactory = (options: Record<string, unknown>) => CuratedPanelRuntime;

type FakeElement = {
  tagName: string;
  className: string;
  textContent: string | null;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  style: Record<string, string>;
  children: FakeElement[];
  parentNode: FakeElement | null;
  value?: string;
  appendChild: (child: FakeElement) => FakeElement;
  insertBefore: (child: FakeElement, reference: FakeElement | null) => FakeElement;
  removeChild: (child: FakeElement) => FakeElement;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
};

type FakeSelectOption = FakeElement & { value: string };

type FakeSelectElement = FakeElement & {
  options: FakeSelectOption[];
  value: string;
};

const curatedRenderableModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedRenderable.ts'),
).href;
const curatedRenderableListProcessingModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedRenderableListProcessing.ts'),
).href;
const curatedRenderableMergeSupportModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedRenderableMergeSupport.ts'),
).href;
const curatedPanelModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanel.ts'),
).href;
const curatedPanelGridModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGrid.ts'),
).href;
const curatedPanelGridTransitionsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridTransitions.ts'),
).href;
const curatedPanelLoadingIndicatorModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelLoadingIndicator.ts'),
).href;

function getCuratedRenderableRuntime(): CuratedRenderableRuntime {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    runtimeRenderable: {
      createCuratedRenderable: (options: Record<string, unknown>) => CuratedRenderableRuntime;
    };
  };

  const getCachedRating = vi.fn((seriesId: unknown) => ({
    rating: Number(String(seriesId || '').replace('series-', '')) % 5,
    votes: 1_000,
    audioLocales: ['en-US', 'ja-JP'],
    genreTags: ['Action', 'Adventure'],
  }));
  const getCachedWatchHistory = vi.fn(() => null);
  const getCachedWatchHistoryProgress = vi.fn(() => null);
  const compareRenderableEntries = (left: unknown, right: unknown, sortMode?: unknown) => {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    if (sortMode === 'title_asc') {
      return String(leftRecord.title || '').localeCompare(String(rightRecord.title || ''));
    }
    if (sortMode === 'title_desc') {
      return String(rightRecord.title || '').localeCompare(String(leftRecord.title || ''));
    }
    if (sortMode === 'rating_desc') {
      return Number(rightRecord.rating || 0) - Number(leftRecord.rating || 0);
    }
    if (sortMode === 'votes_desc') {
      return Number(rightRecord.votes || 0) - Number(leftRecord.votes || 0);
    }
    return Number(leftRecord.sortOrder || 0) - Number(rightRecord.sortOrder || 0);
  };

  const runtime = registry.runtimeRenderable.createCuratedRenderable({
    normalizeAudioLocale: (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : null),
    getPreferredAudioLanguage: () => 'en-us',
    getCachedRating,
    getCachedWatchHistory,
    getCachedWatchHistoryProgress,
    normalizeAudioLocales: (locales: unknown[]) =>
      Array.isArray(locales)
        ? locales.map((locale) => (typeof locale === 'string' ? locale.trim() : '')).filter(Boolean)
        : [],
    hasEnUsAudio: (locales: unknown[]) =>
      Array.isArray(locales) ? locales.some((locale) => String(locale || '').toLowerCase() === 'en-us') : false,
    normalizeTagList: (values: unknown[]) =>
      Array.isArray(values)
        ? values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
        : [],
    normalizeImageUrlCandidate: (value: unknown) => (typeof value === 'string' ? value : null),
    getAudioLocaleCountFromMap: () => null,
    getLocalizedSeriesCount: () => null,
    sanitizePositiveInt: (value: unknown) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
    },
    pickFirstDateMs: () => null,
    deriveDisplayStatusBase: () => 'Continue',
    isEntryWatchReady: () => true,
    compareRenderableEntries,
  });

  return {
    ...runtime,
    __lookups: {
      getCachedRating,
      getCachedWatchHistory,
      getCachedWatchHistoryProgress,
    },
  } as unknown as CuratedRenderableRuntime & {
    __lookups: {
      getCachedRating: ReturnType<typeof vi.fn>;
      getCachedWatchHistory: ReturnType<typeof vi.fn>;
      getCachedWatchHistoryProgress: ReturnType<typeof vi.fn>;
    };
  };
}

function getCuratedPanelRuntimeFactory(): CuratedPanelRuntimeFactory {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    runtimeCuratedPanel: {
      createCuratedPanelRuntime: CuratedPanelRuntimeFactory;
    };
  };
  return registry.runtimeCuratedPanel.createCuratedPanelRuntime;
}

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

function findCardBySeriesId(cards: FakeElement[], seriesId: string): FakeElement | null {
  const found = cards.find((card) => card.dataset.cwSeriesId === seriesId);
  return found || null;
}

function findCardThumbImage(card: FakeElement | null): FakeElement | null {
  if (!card) {
    return null;
  }
  const thumbLink = card.children[0] || null;
  if (!thumbLink) {
    return null;
  }
  const thumbImage = thumbLink.children[0] || null;
  return thumbImage || null;
}

function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1] ?? sorted[mid] ?? 0;
    const right = sorted[mid] ?? left;
    return (left + right) / 2;
  }
  return sorted[mid] ?? 0;
}

describe('curated perf budgets', () => {
  beforeEach(async () => {
    await loadRuntimeModules([
      curatedRenderableListProcessingModuleUrl,
      curatedRenderableMergeSupportModuleUrl,
      curatedRenderableModuleUrl,
      curatedPanelGridTransitionsModuleUrl,
      curatedPanelGridModuleUrl,
      curatedPanelLoadingIndicatorModuleUrl,
      curatedPanelModuleUrl,
    ]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
    vi.restoreAllMocks();
  });

  it('keeps sort/filter renders on cached merged entries within merge-churn and latency budgets', () => {
    const runtime = getCuratedRenderableRuntime() as CuratedRenderableRuntime & {
      __lookups: {
        getCachedRating: ReturnType<typeof vi.fn>;
        getCachedWatchHistory: ReturnType<typeof vi.fn>;
        getCachedWatchHistoryProgress: ReturnType<typeof vi.fn>;
      };
    };
    const entries = Array.from({ length: 320 }, (_value, index) => ({
      seriesId: `series-${index + 1}`,
      title: `Series ${String(index + 1).padStart(3, '0')}`,
      sortOrder: index,
      audioLocales: ['en-US', 'ja-JP'],
      genreTags: index % 2 === 0 ? ['Action'] : ['Drama'],
      watchReadyHint: true,
    }));

    const baseSettings = {
      audioLocaleFilter: 'any',
      genreFilter: 'any',
      watchReadyFilterMode: 'none',
      sortMode: 'title_asc',
      secondarySortMode: 'none',
      __cwPreferredAudioLanguage: 'en-us',
      __cwRatingCacheRevision: 1,
      __cwWatchHistoryCacheUpdatedAt: 100,
    };

    runtime.buildRenderableEntries(entries, baseSettings);
    const baselineLookupCount =
      runtime.__lookups.getCachedRating.mock.calls.length +
      runtime.__lookups.getCachedWatchHistory.mock.calls.length +
      runtime.__lookups.getCachedWatchHistoryProgress.mock.calls.length;

    const sortDurationsMs: number[] = [];
    [
      { sortMode: 'title_desc', secondarySortMode: 'none' },
      { sortMode: 'rating_desc', secondarySortMode: 'none' },
      { sortMode: 'title_asc', secondarySortMode: 'votes_desc' },
      { sortMode: 'title_desc', secondarySortMode: 'votes_desc' },
      { sortMode: 'rating_desc', secondarySortMode: 'title_asc' },
      { sortMode: 'title_asc', secondarySortMode: 'none' },
    ].forEach((sortConfig) => {
      const start = performance.now();
      runtime.buildRenderableEntries(entries, {
        ...baseSettings,
        ...sortConfig,
      });
      sortDurationsMs.push(performance.now() - start);
    });

    const sortOnlyLookupCount =
      runtime.__lookups.getCachedRating.mock.calls.length +
      runtime.__lookups.getCachedWatchHistory.mock.calls.length +
      runtime.__lookups.getCachedWatchHistoryProgress.mock.calls.length;

    expect(sortOnlyLookupCount).toBe(baselineLookupCount);
    expect(median(sortDurationsMs)).toBeLessThan(80);

    runtime.buildRenderableEntries(entries, {
      ...baseSettings,
      __cwRatingCacheRevision: 2,
    });

    const invalidatedLookupCount =
      runtime.__lookups.getCachedRating.mock.calls.length +
      runtime.__lookups.getCachedWatchHistory.mock.calls.length +
      runtime.__lookups.getCachedWatchHistoryProgress.mock.calls.length;
    expect(invalidatedLookupCount).toBeGreaterThan(baselineLookupCount);
  });

  it('keeps 320-card control churn within dom-lifecycle and render-latency budgets', () => {
    const createCuratedPanelRuntime = getCuratedPanelRuntimeFactory();
    const gridEl = createFakeElement();
    const statsEl = createFakeElement();
    const loadingIndicatorEl = createFakeElement();
    const visibleBase = Array.from({ length: 320 }, (_value, index) => ({
      seriesId: `series-${index + 1}`,
      title: `Series ${index + 1}`,
      description: 'stable',
      rating: 4.5,
      votes: 800,
      distribution: { 5: 60, 4: 20, 3: 10, 2: 5, 1: 5 },
      watchHistoryProgressEntry: { playhead: 10, episodeDurationMs: 100 },
      sortOrder: index,
    }));
    const visibleSorted = [...visibleBase].reverse();
    const visibleFiltered = visibleBase.filter((_entry, index) => index % 2 === 0);
    const renderables = [visibleBase, visibleSorted, visibleFiltered, visibleBase];
    let renderIndex = 0;
    let createdCards = 0;
    const trackedSeriesIds = ['series-1', 'series-2', 'series-161', 'series-320'];
    const initialThumbImagesBySeriesId = new Map<string, FakeElement>();

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedDeferredMetadataInFlight: false,
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
      loadingBoxEl: null,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    };

    const runtime = createCuratedPanelRuntime({
      state,
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

        const thumbLink = createFakeElement();
        thumbLink.tagName = 'a';
        thumbLink.className = 'cw-curated-card__thumb';
        card.appendChild(thumbLink);

        const thumbImage = createFakeElement();
        thumbImage.tagName = 'img';
        thumbImage.className = 'cw-curated-card__thumb-image';
        thumbImage.dataset.cwSeriesId = String(entry.seriesId || '');
        thumbLink.appendChild(thumbImage);

        return card;
      },
      patchCuratedCard: () => undefined,
      applyCardLayoutUi: () => undefined,
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || [];
        return {
          mode: 'hide',
          total: visibleBase.length,
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

    const renderDurationsMs: number[] = [];
    let firstRenderSecondCard: FakeElement | undefined;
    for (let index = 0; index < renderables.length; index += 1) {
      renderIndex = index;
      const start = performance.now();
      runtime.renderCuratedPanel();
      if (index === 0) {
        firstRenderSecondCard = gridEl.children[1];
        trackedSeriesIds.forEach((seriesId) => {
          const card = findCardBySeriesId(gridEl.children, seriesId);
          const thumbImage = findCardThumbImage(card);
          if (thumbImage) {
            initialThumbImagesBySeriesId.set(seriesId, thumbImage);
          }
        });
      }
      renderDurationsMs.push(performance.now() - start);
    }

    const firstCard = gridEl.children[0];
    const recreatedSecondCard = gridEl.children.find(
      (card) => card.dataset.cwSeriesId === firstRenderSecondCard?.dataset.cwSeriesId,
    );

    expect(createdCards).toBe(320);
    expect(state.curatedDomLifecycleCounters.created).toBe(320);
    expect(state.curatedDomLifecycleCounters.disposed).toBe(0);
    expect(state.curatedDomLifecycleCounters.renderPasses).toBe(4);
    expect(state.curatedDomLifecycleCounters.parked).toBeGreaterThanOrEqual(160);
    expect(state.curatedDomLifecycleCounters.unparked).toBeGreaterThanOrEqual(160);
    expect(gridEl.children).toHaveLength(320);
    expect(firstCard?.dataset.cwSeriesId).toBe('series-1');
    expect(recreatedSecondCard).toBe(firstRenderSecondCard);
    trackedSeriesIds.forEach((seriesId) => {
      const finalCard = findCardBySeriesId(gridEl.children, seriesId);
      const finalThumbImage = findCardThumbImage(finalCard);
      expect(finalThumbImage).toBe(initialThumbImagesBySeriesId.get(seriesId));
    });
    expect(renderDurationsMs[1]).toBeLessThan(180);
    expect(renderDurationsMs[2]).toBeLessThan(180);
    expect(renderDurationsMs[3]).toBeLessThan(180);
  });
});
