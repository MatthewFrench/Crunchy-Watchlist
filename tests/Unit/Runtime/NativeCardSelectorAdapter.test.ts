import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type NativeCardSelectorAdapterRuntime = {
  findNativeCards: (documentRef: unknown) => FakeElement[];
  findSeriesLinks: (card: unknown) => FakeAnchorElement[];
  findNativeActionButton: (card: unknown, actionType: unknown) => FakeElement | null;
  findPreviewNodes: (card: unknown) => FakeElement[];
};

type NativeCardSelectorAdapterModule = {
  runtimeNativeCardSelectorAdapter: {
    createNativeCardSelectorAdapterRuntime: (options?: Record<string, unknown>) => NativeCardSelectorAdapterRuntime;
  };
};

const nativeCardSelectorAdapterModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'NativeCardSelectorAdapter.ts'),
).href;

class FakeElement {
  private readonly selectorAllMap = new Map<string, FakeElement[]>();
  private readonly selectorMap = new Map<string, FakeElement | null>();

  setQuerySelectorAll(selector: string, results: FakeElement[]): void {
    this.selectorAllMap.set(selector, results);
  }

  setQuerySelector(selector: string, result: FakeElement | null): void {
    this.selectorMap.set(selector, result);
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorAllMap.get(selector) ?? [];
  }

  querySelector(selector: string): FakeElement | null {
    return this.selectorMap.get(selector) ?? null;
  }
}

class FakeAnchorElement extends FakeElement {}

function getNativeCardSelectorAdapterModule() {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as NativeCardSelectorAdapterModule;
  return registry.runtimeNativeCardSelectorAdapter;
}

describe('native-card-selector-adapter runtime', () => {
  const runtimeGlobal = globalThis as Record<string, unknown>;
  let originalHTMLElement: unknown;
  let originalHTMLAnchorElement: unknown;

  beforeEach(async () => {
    originalHTMLElement = runtimeGlobal.HTMLElement;
    originalHTMLAnchorElement = runtimeGlobal.HTMLAnchorElement;
    runtimeGlobal.HTMLElement = FakeElement;
    runtimeGlobal.HTMLAnchorElement = FakeAnchorElement;
    await loadRuntimeModules([nativeCardSelectorAdapterModuleUrl]);
  });

  afterEach(() => {
    runtimeGlobal.HTMLElement = originalHTMLElement;
    runtimeGlobal.HTMLAnchorElement = originalHTMLAnchorElement;
    clearRuntimeModulesRegistry();
  });

  it('queries native watchlist cards via the canonical root selector', () => {
    const runtime = getNativeCardSelectorAdapterModule().createNativeCardSelectorAdapterRuntime();
    const cardA = new FakeElement();
    const cardB = new FakeElement();
    const documentRef = new FakeElement();
    documentRef.setQuerySelectorAll('[data-t="watch-list-card"]', [cardA, cardB]);

    const cards = runtime.findNativeCards(documentRef);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toBe(cardA);
    expect(cards[1]).toBe(cardB);
  });

  it('extracts series link anchors from native cards', () => {
    const runtime = getNativeCardSelectorAdapterModule().createNativeCardSelectorAdapterRuntime();
    const card = new FakeElement();
    const linkA = new FakeAnchorElement();
    const linkB = new FakeAnchorElement();
    card.setQuerySelectorAll('a[href*="/series/"]', [linkA, linkB]);

    const links = runtime.findSeriesLinks(card);
    expect(links).toHaveLength(2);
    expect(links[0]).toBe(linkA);
    expect(links[1]).toBe(linkB);
  });

  it('resolves first matching action button based on action type selector priority', () => {
    const runtime = getNativeCardSelectorAdapterModule().createNativeCardSelectorAdapterRuntime();
    const card = new FakeElement();
    const favoriteButton = new FakeElement();
    const removeButton = new FakeElement();
    card.setQuerySelector('[data-cw-native-action="favorite"]', favoriteButton);
    card.setQuerySelector('[data-cw-native-action="remove"]', removeButton);

    expect(runtime.findNativeActionButton(card, 'favorite')).toBe(favoriteButton);
    expect(runtime.findNativeActionButton(card, 'remove')).toBe(removeButton);
  });

  it('returns preview candidates using the adapter-owned preview selector contract', () => {
    const runtime = getNativeCardSelectorAdapterModule().createNativeCardSelectorAdapterRuntime();
    const card = new FakeElement();
    const previewA = new FakeElement();
    const previewB = new FakeElement();
    const previewSelector =
      'video, img, picture img, [data-t*="preview"], [class*="preview"], [class*="thumbnail"], [class*="poster"], [class*="image"]';
    card.setQuerySelectorAll(previewSelector, [previewA, previewB]);

    const previewNodes = runtime.findPreviewNodes(card);
    expect(previewNodes).toHaveLength(2);
    expect(previewNodes[0]).toBe(previewA);
    expect(previewNodes[1]).toBe(previewB);
  });
});
