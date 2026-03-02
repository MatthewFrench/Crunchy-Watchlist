import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type NativeCardSelectorAdapterRuntime = {
  findNativeCards: (documentRef: unknown) => FakeElement[];
  findSeriesLinks: (card: unknown) => FakeAnchorElement[];
  findNativeCardMatches: (documentRef: unknown) => Array<{
    card: FakeElement;
    seriesId: string;
    seriesLinks: FakeAnchorElement[];
  }>;
  findNativeActionButton: (card: unknown, actionType: unknown) => FakeElement | null;
  findPreviewNodes: (card: unknown) => FakeElement[];
};

type NativeCardSelectorAdapterModule = {
  createNativeCardSelectorAdapterRuntime: (options?: Record<string, unknown>) => NativeCardSelectorAdapterRuntime;
};

const nativeCardSelectorAdapterModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'NativeCardSelectorAdapter.ts'),
).href;
let nativeCardSelectorAdapterModule: NativeCardSelectorAdapterModule | null = null;

class FakeElement {
  private readonly selectorAllMap = new Map<string, FakeElement[]>();
  private readonly selectorMap = new Map<string, FakeElement | null>();
  private readonly attributes = new Map<string, string>();

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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}

class FakeAnchorElement extends FakeElement {}

function getNativeCardSelectorAdapterModule() {
  if (!nativeCardSelectorAdapterModule) {
    throw new Error('Native card selector adapter module was not initialized for test');
  }
  return nativeCardSelectorAdapterModule;
}

describe('native-card-selector-adapter runtime', () => {
  const runtimeGlobal = globalThis as Record<string, unknown>;
  let originalHTMLElement: unknown;
  let originalHTMLAnchorElement: unknown;

  beforeEach(async () => {
    vi.resetModules();
    originalHTMLElement = runtimeGlobal.HTMLElement;
    originalHTMLAnchorElement = runtimeGlobal.HTMLAnchorElement;
    runtimeGlobal.HTMLElement = FakeElement;
    runtimeGlobal.HTMLAnchorElement = FakeAnchorElement;
    nativeCardSelectorAdapterModule = (await import(
      nativeCardSelectorAdapterModuleUrl
    )) as NativeCardSelectorAdapterModule;
  });

  afterEach(() => {
    runtimeGlobal.HTMLElement = originalHTMLElement;
    runtimeGlobal.HTMLAnchorElement = originalHTMLAnchorElement;
    nativeCardSelectorAdapterModule = null;
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

  it('builds native card matches with extracted series ids at the adapter boundary', () => {
    const runtime = getNativeCardSelectorAdapterModule().createNativeCardSelectorAdapterRuntime();
    const card = new FakeElement();
    const primarySeriesLink = new FakeAnchorElement();
    primarySeriesLink.setAttribute('href', '/series/series-42');
    const secondarySeriesLink = new FakeAnchorElement();
    secondarySeriesLink.setAttribute('href', '/series/series-ignored');
    card.setQuerySelectorAll('a[href*="/series/"]', [primarySeriesLink, secondarySeriesLink]);

    const encodedCard = new FakeElement();
    const encodedSeriesLink = new FakeAnchorElement();
    encodedSeriesLink.setAttribute('href', '/series/series%2Dencoded');
    encodedCard.setQuerySelectorAll('a[href*="/series/"]', [encodedSeriesLink]);

    const noSeriesCard = new FakeElement();
    const missingSeriesLink = new FakeAnchorElement();
    missingSeriesLink.setAttribute('href', '/watch/GRAB123');
    noSeriesCard.setQuerySelectorAll('a[href*="/series/"]', [missingSeriesLink]);

    const documentRef = new FakeElement();
    documentRef.setQuerySelectorAll('[data-t="watch-list-card"]', [card, encodedCard, noSeriesCard]);

    const matches = runtime.findNativeCardMatches(documentRef);
    expect(matches).toEqual([
      {
        card,
        seriesId: 'series-42',
        seriesLinks: [primarySeriesLink, secondarySeriesLink],
      },
      {
        card: encodedCard,
        seriesId: 'series-encoded',
        seriesLinks: [encodedSeriesLink],
      },
    ]);
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
