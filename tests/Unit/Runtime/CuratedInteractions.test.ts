import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeEvent = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

type FakeListener = (event?: FakeEvent) => void | Promise<void>;

type FakeElement = {
  className: string;
  textContent: string;
  type: string;
  title: string;
  disabled: boolean;
  checked: boolean;
  value: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
  children: FakeElement[];
  listeners: Record<string, FakeListener[]>;
  appendChild: (child: FakeElement) => FakeElement;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (eventName: string, listener: FakeListener) => void;
  dispatch: (eventName: string, event?: FakeEvent) => Promise<void>;
};

type CuratedInteractionsRuntime = {
  createCuratedCardActions: (entry: unknown) => FakeElement;
  bindCuratedInterfaceControls: (context: unknown) => void;
  dispose: () => void;
};

type CuratedInteractionsModule = {
  createCuratedInteractionsRuntime: (options: Record<string, unknown>) => CuratedInteractionsRuntime;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const curatedInteractionsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedInteractions.ts'),
).href;
let curatedInteractionsModule: CuratedInteractionsModule | null = null;

function createFakeElement(): FakeElement {
  return {
    className: '',
    textContent: '',
    type: '',
    title: '',
    disabled: false,
    checked: false,
    value: '',
    dataset: {},
    style: {},
    children: [],
    listeners: {},
    appendChild(child: FakeElement) {
      this.children.push(child);
      return child;
    },
    setAttribute(name: string, value: string) {
      this.dataset[`attr:${name}`] = value;
    },
    getAttribute(name: string) {
      return this.dataset[`attr:${name}`] || null;
    },
    addEventListener(eventName: string, listener: FakeListener) {
      const existing = this.listeners[eventName] || [];
      existing.push(listener);
      this.listeners[eventName] = existing;
    },
    async dispatch(eventName: string, event: FakeEvent = {}) {
      const listeners = this.listeners[eventName] || [];
      for (const listener of listeners) {
        await listener(event);
      }
    },
  };
}

function createDeferred<T>(): Deferred<T> {
  let resolveRef: ((value: T | PromiseLike<T>) => void) | null = null;
  let rejectRef: ((reason?: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;
  });
  if (!resolveRef || !rejectRef) {
    throw new Error('Failed to initialize deferred promise');
  }
  return {
    promise,
    resolve: resolveRef,
    reject: rejectRef,
  };
}

async function flushMicrotasks(iterations = 6): Promise<void> {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

function getCuratedInteractionsModule() {
  if (!curatedInteractionsModule) {
    throw new Error('Curated interactions module was not initialized for test');
  }
  return curatedInteractionsModule;
}

describe('curated-interactions runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const curatedInteractionsRuntimeModule = (await import(curatedInteractionsModuleUrl)) as {
      createRuntimeCuratedInteractionsRuntime: () => object;
    };
    curatedInteractionsModule =
      curatedInteractionsRuntimeModule.createRuntimeCuratedInteractionsRuntime() as CuratedInteractionsModule;
  });

  afterEach(() => {
    curatedInteractionsModule = null;
  });

  it('creates card action controls and forwards favorite/remove interactions', async () => {
    const triggerNativeCardAction = vi.fn(async () => true);
    const toggleCuratedFavorite = vi.fn();
    const removeCuratedSeries = vi.fn();
    const renderCuratedPanel = vi.fn();

    const runtime = getCuratedInteractionsModule().createCuratedInteractionsRuntime({
      documentRef: {
        createElement: () => createFakeElement(),
      },
      alertRef: vi.fn(),
      confirmRef: vi.fn(() => true),
      triggerNativeCardAction,
      toggleCuratedFavorite,
      removeCuratedSeries,
      renderCuratedPanel,
      state: {
        mounted: true,
        settings: {},
      },
      locationRef: {
        pathname: '/watchlist',
      },
      persistSettings: vi.fn(async () => null),
      normalizeAudioLocale: vi.fn(() => null),
      preloadRatingsForSelectedAudioLocale: vi.fn(async () => null),
      preloadWatchHistoryForSelectedAudioLocale: vi.fn(async () => null),
      isWatchlistPath: vi.fn(() => true),
      resetCuratedCachesForRefresh: vi.fn(async () => null),
      ensureCuratedDataLoad: vi.fn(async () => null),
      debounceProcess: vi.fn(),
    });

    const actions = runtime.createCuratedCardActions({
      seriesId: 'series-1',
      title: 'Action Show',
      isFavorite: false,
    });

    const favoriteButton = actions.children[0];
    const removeButton = actions.children[1];

    expect(favoriteButton).toBeDefined();
    expect(removeButton).toBeDefined();
    if (!favoriteButton || !removeButton) {
      throw new Error('Missing curated action buttons');
    }
    expect(favoriteButton.getAttribute('data-cw-action')).toBeNull();
    expect(removeButton.getAttribute('data-cw-action')).toBeNull();

    await favoriteButton.dispatch('click');
    await removeButton.dispatch('click');
    await flushMicrotasks();

    expect(triggerNativeCardAction).toHaveBeenCalledWith('series-1', 'favorite', true);
    expect(triggerNativeCardAction).toHaveBeenCalledWith('series-1', 'remove');
    expect(toggleCuratedFavorite).toHaveBeenCalledWith('series-1');
    expect(removeCuratedSeries).toHaveBeenCalledWith('series-1');
    expect(renderCuratedPanel).toHaveBeenCalledTimes(2);
  });

  it('derives next favorite state from controller-owned favorite state', async () => {
    const triggerNativeCardAction = vi.fn(async () => true);
    const runtime = getCuratedInteractionsModule().createCuratedInteractionsRuntime({
      documentRef: {
        createElement: () => createFakeElement(),
      },
      alertRef: vi.fn(),
      confirmRef: vi.fn(() => true),
      triggerNativeCardAction,
      toggleCuratedFavorite: vi.fn(),
      removeCuratedSeries: vi.fn(),
      renderCuratedPanel: vi.fn(),
      state: {
        mounted: true,
        settings: {},
      },
      locationRef: {
        pathname: '/watchlist',
      },
      persistSettings: vi.fn(async () => null),
      normalizeAudioLocale: vi.fn(() => null),
      preloadRatingsForSelectedAudioLocale: vi.fn(async () => null),
      preloadWatchHistoryForSelectedAudioLocale: vi.fn(async () => null),
      isWatchlistPath: vi.fn(() => true),
      resetCuratedCachesForRefresh: vi.fn(async () => null),
      ensureCuratedDataLoad: vi.fn(async () => null),
      debounceProcess: vi.fn(),
    });

    const actions = runtime.createCuratedCardActions({
      seriesId: 'series-2',
      title: 'Already Favorite Show',
      isFavorite: true,
    });
    const favoriteButton = actions.children[0];
    if (!favoriteButton) {
      throw new Error('Missing favorite button');
    }

    await favoriteButton.dispatch('click');
    await flushMicrotasks();

    expect(triggerNativeCardAction).toHaveBeenCalledWith('series-2', 'favorite', false);
  });

  it('binds control listeners and updates runtime settings/refresh flow', async () => {
    const state = {
      mounted: true,
      settings: {
        watchReadyFilterMode: 'hide',
        cardLayout: 'portrait',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        sortMode: 'consensus_quality_desc',
        secondarySortMode: 'none',
      },
    };

    const persistSettings = vi.fn(async () => null);
    const renderCuratedPanel = vi.fn();
    const preloadRatingsForSelectedAudioLocale = vi.fn(async () => null);
    const preloadWatchHistoryForSelectedAudioLocale = vi.fn(async () => null);
    const resetCuratedCachesForRefresh = vi.fn(async () => null);
    const ensureCuratedDataLoad = vi.fn(async () => null);
    const debounceProcess = vi.fn();

    const runtime = getCuratedInteractionsModule().createCuratedInteractionsRuntime({
      documentRef: {
        createElement: () => createFakeElement(),
      },
      alertRef: vi.fn(),
      confirmRef: vi.fn(() => true),
      triggerNativeCardAction: vi.fn(async () => true),
      toggleCuratedFavorite: vi.fn(),
      removeCuratedSeries: vi.fn(),
      renderCuratedPanel,
      state,
      locationRef: {
        pathname: '/watchlist',
      },
      persistSettings,
      normalizeAudioLocale: vi.fn((value: unknown) => (value === 'any' ? null : String(value || ''))),
      preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale,
      isWatchlistPath: vi.fn(() => true),
      resetCuratedCachesForRefresh,
      ensureCuratedDataLoad,
      debounceProcess,
    });

    const watchReadySelect = createFakeElement();
    watchReadySelect.value = 'dim';
    const cardLayoutInput = createFakeElement();
    cardLayoutInput.checked = true;
    const audioSelect = createFakeElement();
    audioSelect.value = ' ja-JP ';
    const genreSelect = createFakeElement();
    genreSelect.value = 'action';
    const sortSelect = createFakeElement();
    sortSelect.value = 'rating_desc';
    const secondarySortSelect = createFakeElement();
    secondarySortSelect.value = 'votes_desc';
    const refreshButton = createFakeElement();

    runtime.bindCuratedInterfaceControls({
      watchReadyFilterControl: { select: watchReadySelect },
      cardLayoutControl: { input: cardLayoutInput },
      audioFilterControl: { select: audioSelect },
      genreFilterControl: { select: genreSelect },
      sortControl: { select: sortSelect },
      secondarySortControl: { select: secondarySortSelect },
      refreshButton,
    });

    await watchReadySelect.dispatch('change');
    await cardLayoutInput.dispatch('change');
    await audioSelect.dispatch('change');
    await Promise.resolve();
    await Promise.resolve();
    await genreSelect.dispatch('change');
    await sortSelect.dispatch('change');
    await secondarySortSelect.dispatch('change');
    await refreshButton.dispatch('click');
    await flushMicrotasks();

    expect(state.settings.watchReadyFilterMode).toBe('dim');
    expect(state.settings.cardLayout).toBe('landscape');
    expect(state.settings.audioLocaleFilter).toBe('ja-JP');
    expect(state.settings.genreFilter).toBe('action');
    expect(state.settings.sortMode).toBe('rating_desc');
    expect(state.settings.secondarySortMode).toBe('votes_desc');
    expect(persistSettings).toHaveBeenCalledTimes(6);
    expect(preloadRatingsForSelectedAudioLocale).not.toHaveBeenCalled();
    expect(preloadWatchHistoryForSelectedAudioLocale).not.toHaveBeenCalled();
    expect(resetCuratedCachesForRefresh).toHaveBeenCalledTimes(1);
    expect(ensureCuratedDataLoad).toHaveBeenCalledWith(true);
    expect(debounceProcess).toHaveBeenCalledTimes(1);
    expect(renderCuratedPanel).toHaveBeenCalled();
  });

  it('skips persist/render work when controls resolve to unchanged values', async () => {
    const state = {
      mounted: true,
      settings: {
        watchReadyFilterMode: 'hide',
        cardLayout: 'portrait',
        audioLocaleFilter: 'any',
        genreFilter: 'any',
        sortMode: 'consensus_quality_desc',
        secondarySortMode: 'none',
      },
    };

    const persistSettings = vi.fn(async () => null);
    const renderCuratedPanel = vi.fn();
    const preloadRatingsForSelectedAudioLocale = vi.fn(async () => null);
    const preloadWatchHistoryForSelectedAudioLocale = vi.fn(async () => null);

    const runtime = getCuratedInteractionsModule().createCuratedInteractionsRuntime({
      documentRef: {
        createElement: () => createFakeElement(),
      },
      alertRef: vi.fn(),
      confirmRef: vi.fn(() => true),
      triggerNativeCardAction: vi.fn(async () => true),
      toggleCuratedFavorite: vi.fn(),
      removeCuratedSeries: vi.fn(),
      renderCuratedPanel,
      state,
      locationRef: {
        pathname: '/watchlist',
      },
      persistSettings,
      normalizeAudioLocale: vi.fn((value: unknown) => (value === 'any' ? null : String(value || ''))),
      preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale,
      isWatchlistPath: vi.fn(() => true),
      resetCuratedCachesForRefresh: vi.fn(async () => null),
      ensureCuratedDataLoad: vi.fn(async () => null),
      debounceProcess: vi.fn(),
    });

    const watchReadySelect = createFakeElement();
    watchReadySelect.value = 'hide';
    const cardLayoutInput = createFakeElement();
    cardLayoutInput.checked = false;
    const audioSelect = createFakeElement();
    audioSelect.value = 'any';
    const genreSelect = createFakeElement();
    genreSelect.value = 'any';
    const sortSelect = createFakeElement();
    sortSelect.value = 'consensus_quality_desc';
    const secondarySortSelect = createFakeElement();
    secondarySortSelect.value = 'none';

    runtime.bindCuratedInterfaceControls({
      watchReadyFilterControl: { select: watchReadySelect },
      cardLayoutControl: { input: cardLayoutInput },
      audioFilterControl: { select: audioSelect },
      genreFilterControl: { select: genreSelect },
      sortControl: { select: sortSelect },
      secondarySortControl: { select: secondarySortSelect },
    });

    await watchReadySelect.dispatch('change');
    await cardLayoutInput.dispatch('change');
    await audioSelect.dispatch('change');
    await genreSelect.dispatch('change');
    await sortSelect.dispatch('change');
    await secondarySortSelect.dispatch('change');
    await flushMicrotasks();

    expect(persistSettings).not.toHaveBeenCalled();
    expect(renderCuratedPanel).not.toHaveBeenCalled();
    expect(preloadRatingsForSelectedAudioLocale).not.toHaveBeenCalled();
    expect(preloadWatchHistoryForSelectedAudioLocale).not.toHaveBeenCalled();
  });

  it('does not trigger selected-locale metadata preload when audio filter changes to any', async () => {
    const state = {
      mounted: true,
      settings: {
        watchReadyFilterMode: 'hide',
        cardLayout: 'portrait',
        audioLocaleFilter: 'ja-JP',
        genreFilter: 'any',
        sortMode: 'consensus_quality_desc',
        secondarySortMode: 'none',
      },
    };

    const persistSettings = vi.fn(async () => null);
    const renderCuratedPanel = vi.fn();
    const preloadRatingsForSelectedAudioLocale = vi.fn(async () => null);
    const preloadWatchHistoryForSelectedAudioLocale = vi.fn(async () => null);

    const runtime = getCuratedInteractionsModule().createCuratedInteractionsRuntime({
      documentRef: {
        createElement: () => createFakeElement(),
      },
      alertRef: vi.fn(),
      confirmRef: vi.fn(() => true),
      triggerNativeCardAction: vi.fn(async () => true),
      toggleCuratedFavorite: vi.fn(),
      removeCuratedSeries: vi.fn(),
      renderCuratedPanel,
      state,
      locationRef: {
        pathname: '/watchlist',
      },
      persistSettings,
      normalizeAudioLocale: vi.fn((value: unknown) => String(value || '').trim() || null),
      preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale,
      isWatchlistPath: vi.fn(() => true),
      resetCuratedCachesForRefresh: vi.fn(async () => null),
      ensureCuratedDataLoad: vi.fn(async () => null),
      debounceProcess: vi.fn(),
    });

    const audioSelect = createFakeElement();
    audioSelect.value = 'any';
    runtime.bindCuratedInterfaceControls({
      audioFilterControl: { select: audioSelect },
    });

    await audioSelect.dispatch('change');
    await flushMicrotasks();

    expect(state.settings.audioLocaleFilter).toBe('any');
    expect(persistSettings).toHaveBeenCalledTimes(1);
    expect(renderCuratedPanel).toHaveBeenCalledTimes(1);
    expect(preloadRatingsForSelectedAudioLocale).not.toHaveBeenCalled();
    expect(preloadWatchHistoryForSelectedAudioLocale).not.toHaveBeenCalled();
  });

  it('renders immediately for genre changes before settings persistence resolves', async () => {
    const state = {
      mounted: true,
      settings: {
        genreFilter: 'any',
      },
    };

    const persistDeferred = createDeferred<unknown>();
    const persistSettings = vi.fn(() => persistDeferred.promise);
    const renderCuratedPanel = vi.fn();

    const runtime = getCuratedInteractionsModule().createCuratedInteractionsRuntime({
      documentRef: {
        createElement: () => createFakeElement(),
      },
      alertRef: vi.fn(),
      confirmRef: vi.fn(() => true),
      triggerNativeCardAction: vi.fn(async () => true),
      toggleCuratedFavorite: vi.fn(),
      removeCuratedSeries: vi.fn(),
      renderCuratedPanel,
      state,
      locationRef: {
        pathname: '/watchlist',
      },
      persistSettings,
      normalizeAudioLocale: vi.fn((value: unknown) => String(value || '').trim() || null),
      preloadRatingsForSelectedAudioLocale: vi.fn(async () => null),
      preloadWatchHistoryForSelectedAudioLocale: vi.fn(async () => null),
      isWatchlistPath: vi.fn(() => true),
      resetCuratedCachesForRefresh: vi.fn(async () => null),
      ensureCuratedDataLoad: vi.fn(async () => null),
      debounceProcess: vi.fn(),
    });

    const genreSelect = createFakeElement();
    genreSelect.value = 'action';
    runtime.bindCuratedInterfaceControls({
      genreFilterControl: { select: genreSelect },
    });

    await genreSelect.dispatch('change');
    await flushMicrotasks();

    expect(state.settings.genreFilter).toBe('action');
    expect(persistSettings).toHaveBeenCalledTimes(1);
    expect(renderCuratedPanel).toHaveBeenCalledTimes(1);

    persistDeferred.resolve(null);
    await flushMicrotasks();
  });

  it('still persists updated settings when render throws during control changes', async () => {
    const state = {
      mounted: true,
      settings: {
        genreFilter: 'any',
      },
    };

    const persistSettings = vi.fn(async () => null);
    const renderCuratedPanel = vi.fn(() => {
      throw new Error('render failed');
    });

    const runtime = getCuratedInteractionsModule().createCuratedInteractionsRuntime({
      documentRef: {
        createElement: () => createFakeElement(),
      },
      alertRef: vi.fn(),
      confirmRef: vi.fn(() => true),
      triggerNativeCardAction: vi.fn(async () => true),
      toggleCuratedFavorite: vi.fn(),
      removeCuratedSeries: vi.fn(),
      renderCuratedPanel,
      state,
      locationRef: {
        pathname: '/watchlist',
      },
      persistSettings,
      normalizeAudioLocale: vi.fn((value: unknown) => String(value || '').trim() || null),
      preloadRatingsForSelectedAudioLocale: vi.fn(async () => null),
      preloadWatchHistoryForSelectedAudioLocale: vi.fn(async () => null),
      isWatchlistPath: vi.fn(() => true),
      resetCuratedCachesForRefresh: vi.fn(async () => null),
      ensureCuratedDataLoad: vi.fn(async () => null),
      debounceProcess: vi.fn(),
    });

    const genreSelect = createFakeElement();
    genreSelect.value = 'action';
    runtime.bindCuratedInterfaceControls({
      genreFilterControl: { select: genreSelect },
    });

    await genreSelect.dispatch('change');
    await flushMicrotasks();

    expect(state.settings.genreFilter).toBe('action');
    expect(renderCuratedPanel).toHaveBeenCalledTimes(1);
    expect(persistSettings).toHaveBeenCalledTimes(1);
  });

  it('prevents overlapping manual refresh actions while a refresh is in flight', async () => {
    const state = {
      mounted: true,
      settings: {},
    };

    const refreshDeferred = createDeferred<unknown>();
    const resetCuratedCachesForRefresh = vi.fn(async () => null);
    const ensureCuratedDataLoad = vi.fn(() => refreshDeferred.promise);
    const renderCuratedPanel = vi.fn();
    const debounceProcess = vi.fn();

    const runtime = getCuratedInteractionsModule().createCuratedInteractionsRuntime({
      documentRef: {
        createElement: () => createFakeElement(),
      },
      alertRef: vi.fn(),
      confirmRef: vi.fn(() => true),
      triggerNativeCardAction: vi.fn(async () => true),
      toggleCuratedFavorite: vi.fn(),
      removeCuratedSeries: vi.fn(),
      renderCuratedPanel,
      state,
      locationRef: {
        pathname: '/watchlist',
      },
      persistSettings: vi.fn(async () => null),
      normalizeAudioLocale: vi.fn(() => null),
      preloadRatingsForSelectedAudioLocale: vi.fn(async () => null),
      preloadWatchHistoryForSelectedAudioLocale: vi.fn(async () => null),
      isWatchlistPath: vi.fn(() => true),
      resetCuratedCachesForRefresh,
      ensureCuratedDataLoad,
      debounceProcess,
    });

    const refreshButton = createFakeElement();
    runtime.bindCuratedInterfaceControls({
      refreshButton,
    });

    const firstClickPromise = refreshButton.dispatch('click');
    await flushMicrotasks();

    expect(refreshButton.disabled).toBe(true);
    expect(refreshButton.getAttribute('aria-busy')).toBe('true');

    const secondClickPromise = refreshButton.dispatch('click');
    await flushMicrotasks();

    expect(resetCuratedCachesForRefresh).toHaveBeenCalledTimes(1);
    expect(ensureCuratedDataLoad).toHaveBeenCalledTimes(1);
    expect(renderCuratedPanel).toHaveBeenCalledTimes(1);
    expect(debounceProcess).toHaveBeenCalledTimes(1);

    refreshDeferred.resolve(null);
    await firstClickPromise;
    await secondClickPromise;

    expect(refreshButton.disabled).toBe(false);
    expect(refreshButton.getAttribute('aria-busy')).toBe('false');
  });

  it('stops binding and action creation once disposed', () => {
    const runtime = getCuratedInteractionsModule().createCuratedInteractionsRuntime({
      documentRef: {
        createElement: () => createFakeElement(),
      },
      alertRef: vi.fn(),
      confirmRef: vi.fn(() => true),
      triggerNativeCardAction: vi.fn(async () => true),
      toggleCuratedFavorite: vi.fn(),
      removeCuratedSeries: vi.fn(),
      renderCuratedPanel: vi.fn(),
      state: {
        mounted: true,
        settings: {},
      },
      persistSettings: vi.fn(async () => null),
      resetCuratedCachesForRefresh: vi.fn(async () => null),
      ensureCuratedDataLoad: vi.fn(async () => null),
      debounceProcess: vi.fn(),
    });

    runtime.dispose();
    runtime.dispose();
    runtime.bindCuratedInterfaceControls({
      refreshButton: createFakeElement(),
    });

    const actions = runtime.createCuratedCardActions({ seriesId: 'series-1', title: 'Series 1' });
    expect(actions.children).toHaveLength(0);
  });
});
