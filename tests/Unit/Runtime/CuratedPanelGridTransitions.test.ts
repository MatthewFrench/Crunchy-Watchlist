import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedPanelGridTransitionsRuntime = {
  reorderCuratedGridChildren: (
    gridElement: Element,
    nextCards: Element[],
    options?: {
      onCardRemoved?: ((card: Element) => void) | null;
      shouldRetainCardInGrid?: ((card: Element) => boolean) | null;
    },
  ) => void;
};

type CuratedPanelGridTransitionsModule = {
  createCuratedPanelGridTransitionsRuntime: () => CuratedPanelGridTransitionsRuntime;
};

type CuratedPanelGridDomStateModule = {
  readCuratedGridActiveCards: (gridElement: Element) => Element[];
};

type FakeElement = {
  className: string;
  dataset: Record<string, string>;
  children: FakeElement[];
  parentNode: FakeElement | null;
  style?: Record<string, string>;
  scrollHeight?: number;
  clientHeight?: number;
  offsetHeight?: number;
  appendChild: (child: FakeElement) => FakeElement;
  insertBefore: (child: FakeElement, reference: FakeElement | null) => FakeElement;
  removeChild: (child: FakeElement) => FakeElement;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  animate?: () => { addEventListener: (eventName: string, listener: () => void, options?: unknown) => void };
};

const curatedPanelGridTransitionsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridTransitions.ts'),
).href;
const curatedPanelGridDomStateModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridDomState.ts'),
).href;
let curatedPanelGridTransitionsModule: CuratedPanelGridTransitionsModule | null = null;
let curatedPanelGridDomStateModule: CuratedPanelGridDomStateModule | null = null;
const cardContainerHeightCssVariable = '--cw-curated-card-container-height';

function getCuratedPanelGridTransitionsModule() {
  if (!curatedPanelGridTransitionsModule) {
    throw new Error('Curated panel grid transitions runtime module was not initialized for test');
  }
  return curatedPanelGridTransitionsModule;
}

function readActiveGridChildren(grid: FakeElement): FakeElement[] {
  if (!curatedPanelGridDomStateModule) {
    throw new Error('Curated panel grid dom state module was not initialized for test');
  }
  return curatedPanelGridDomStateModule.readCuratedGridActiveCards(grid as unknown as Element) as unknown as FakeElement[];
}

function readCardContainerHeightPx(element: FakeElement): number {
  const styleHeight = element.style?.[cardContainerHeightCssVariable] || element.style?.height || '0';
  return Number.parseFloat(String(styleHeight)) || 0;
}

function createFakeElement(className = ''): FakeElement {
  const element = {
    className,
    dataset: {},
    children: [] as FakeElement[],
    parentNode: null as FakeElement | null,
  } as FakeElement;

  const detachChild = (child: FakeElement): void => {
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

  element.appendChild = (child: FakeElement) => {
    detachChild(child);
    element.children.push(child);
    child.parentNode = element;
    return child;
  };

  element.insertBefore = (child: FakeElement, reference: FakeElement | null) => {
    detachChild(child);
    if (!reference) {
      element.children.push(child);
      child.parentNode = element;
      return child;
    }

    const referenceIndex = element.children.indexOf(reference);
    if (referenceIndex < 0) {
      element.children.push(child);
    } else {
      element.children.splice(referenceIndex, 0, child);
    }
    child.parentNode = element;
    return child;
  };

  element.removeChild = (child: FakeElement) => {
    const index = element.children.indexOf(child);
    if (index >= 0) {
      element.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  };

  return element;
}

function createMeasurableCard(className: string, rectReadCounter: { value: number }): FakeElement {
  const card = createFakeElement(className);
  card.dataset.cwSeriesId = `${rectReadCounter.value + 1}`;
  card.getBoundingClientRect = () => {
    rectReadCounter.value += 1;
    return {
      left: 0,
      top: 0,
      width: 240,
      height: 380,
    };
  };
  return card;
}

describe('curated-panel-grid-transitions runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    curatedPanelGridTransitionsModule = (await import(
      curatedPanelGridTransitionsModuleUrl
    )) as CuratedPanelGridTransitionsModule;
    curatedPanelGridDomStateModule = (await import(curatedPanelGridDomStateModuleUrl)) as CuratedPanelGridDomStateModule;
  });

  afterEach(() => {
    curatedPanelGridTransitionsModule = null;
    curatedPanelGridDomStateModule = null;
  });

  it('keeps dom order stable while removing overflow cards when absolute placement styles are unavailable', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const cardA = createFakeElement('cw-curated-card');
    const cardB = createFakeElement('cw-curated-card');
    const cardC = createFakeElement('cw-curated-card');
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';
    cardC.dataset.cwSeriesId = 'series-c';

    grid.appendChild(cardA);
    grid.appendChild(cardB);
    grid.appendChild(cardC);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardB as unknown as Element,
      cardA as unknown as Element,
    ]);

    expect(grid.children).toEqual([cardA, cardB]);
    expect(cardC.parentNode).toBeNull();
  });

  it('reorders existing mounted cards to match the next card order when styles are available', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const cardA = createFakeElement('cw-curated-card');
    const cardB = createFakeElement('cw-curated-card');
    grid.style = {};
    cardA.style = {};
    cardB.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 0,
    });
    cardA.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });
    cardB.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';

    grid.appendChild(cardA);
    grid.appendChild(cardB);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardB as unknown as Element,
      cardA as unknown as Element,
    ]);

    expect(readActiveGridChildren(grid)).toEqual([cardB, cardA]);
  });

  it('minimizes visible-card moves for near-sorted reorders', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const cards = ['a', 'b', 'c', 'd', 'e'].map((seriesId) => {
      const card = createFakeElement('cw-curated-card');
      card.dataset.cwSeriesId = seriesId;
      card.style = {};
      card.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 240,
        height: 360,
      });
      return card;
    });
    grid.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1200,
      height: 0,
    });
    cards.forEach((card) => {
      grid.appendChild(card);
    });

    let insertBeforeCalls = 0;
    const insertBefore = grid.insertBefore;
    grid.insertBefore = (child: FakeElement, reference: FakeElement | null) => {
      insertBeforeCalls += 1;
      return insertBefore(child, reference);
    };

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cards[0] as unknown as Element,
      cards[3] as unknown as Element,
      cards[1] as unknown as Element,
      cards[2] as unknown as Element,
      cards[4] as unknown as Element,
    ]);

    expect(readActiveGridChildren(grid)).toEqual([cards[0], cards[3], cards[1], cards[2], cards[4]]);
    expect(insertBeforeCalls).toBe(0);
  });

  it('clears all cards when next card list is empty', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const cardA = createFakeElement('cw-curated-card');
    const cardB = createFakeElement('cw-curated-card');
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';
    grid.appendChild(cardA);
    grid.appendChild(cardB);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, []);

    expect(grid.children).toHaveLength(0);
    expect(cardA.parentNode).toBeNull();
    expect(cardB.parentNode).toBeNull();
  });

  it('skips animation work when card order and membership are unchanged', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const rectReads = { value: 0 };
    const cardA = createMeasurableCard('cw-curated-card', rectReads);
    const cardB = createMeasurableCard('cw-curated-card', rectReads);
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';

    grid.appendChild(cardA);
    grid.appendChild(cardB);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardA as unknown as Element,
      cardB as unknown as Element,
    ]);

    expect(grid.children).toEqual([cardA, cardB]);
    expect(rectReads.value).toBe(0);
  });

  it('reuses cached absolute layout when order and card signatures are unchanged', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const rectReads = { value: 0 };
    const cardA = createMeasurableCard('cw-curated-card', rectReads);
    const cardB = createMeasurableCard('cw-curated-card', rectReads);
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';
    cardA.dataset.cwCardContentSignature = 'sig-a-1';
    cardB.dataset.cwCardContentSignature = 'sig-b-1';
    grid.style = {};
    cardA.style = {};
    cardB.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 0,
    });
    cardA.getBoundingClientRect = () => {
      rectReads.value += 1;
      return {
        left: 0,
        top: 0,
        width: 240,
        height: 360,
      };
    };
    cardB.getBoundingClientRect = () => {
      rectReads.value += 1;
      return {
        left: 0,
        top: 0,
        width: 240,
        height: 420,
      };
    };

    grid.appendChild(cardA);
    grid.appendChild(cardB);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardA as unknown as Element,
      cardB as unknown as Element,
    ]);
    const firstPassRectReads = rectReads.value;

    expect(grid.children).toEqual([cardA, cardB]);
    expect(cardA.style?.position).toBe('absolute');
    expect(cardB.style?.position).toBe('absolute');
    expect(cardA.style?.height).toBe('360px');
    expect(cardB.style?.height).toBe('360px');
    expect(readCardContainerHeightPx(grid)).toBe(360);
    expect(Number.parseFloat(String(cardB.style?.left || '0'))).toBeGreaterThan(0);
    expect(firstPassRectReads).toBeGreaterThan(0);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardA as unknown as Element,
      cardB as unknown as Element,
    ]);

    expect(rectReads.value).toBe(firstPassRectReads);

    cardB.dataset.cwCardContentSignature = 'sig-b-2';
    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardA as unknown as Element,
      cardB as unknown as Element,
    ]);

    expect(rectReads.value).toBeGreaterThan(firstPassRectReads);
  });

  it('reuses cached card heights during reorder when width and content are unchanged', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const rectReads = { value: 0 };
    const cards = Array.from({ length: 60 }, (_value, index) => {
      const card = createMeasurableCard('cw-curated-card', rectReads);
      card.dataset.cwSeriesId = `series-${index + 1}`;
      card.dataset.cwCardContentSignature = `sig-${index + 1}`;
      card.style = {};
      return card;
    });
    grid.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1200,
      height: 0,
    });

    cards.forEach((card) => {
      grid.appendChild(card);
    });

    runtime.reorderCuratedGridChildren(
      grid as unknown as Element,
      cards.map((card) => card as unknown as Element),
    );

    const initialRectReads = rectReads.value;
    rectReads.value = 0;

    runtime.reorderCuratedGridChildren(
      grid as unknown as Element,
      [...cards].reverse().map((card) => card as unknown as Element),
    );

    expect(initialRectReads).toBeGreaterThan(cards.length);
    expect(rectReads.value).toBeLessThanOrEqual(6);
    expect(readActiveGridChildren(grid)[0]).toBe(cards[cards.length - 1]);
  });

  it('restores grid height from prior card heights when cards are temporarily unmeasurable', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const cardA = createFakeElement('cw-curated-card');
    const cardB = createFakeElement('cw-curated-card');
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';
    grid.style = {};
    cardA.style = {};
    cardB.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 0,
    });
    cardA.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });
    cardB.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 420,
    });
    grid.appendChild(cardA);
    grid.appendChild(cardB);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardA as unknown as Element,
      cardB as unknown as Element,
    ]);
    expect(readCardContainerHeightPx(grid)).toBe(360);

    grid.style.height = '1px';
    cardA.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 0,
    });
    cardB.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 0,
    });

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardA as unknown as Element,
      cardB as unknown as Element,
    ]);

    expect(cardA.style?.height).toBe('360px');
    expect(cardB.style?.height).toBe('360px');
    expect(readCardContainerHeightPx(grid)).toBe(360);
  });

  it('keeps compact uniform height even when content is taller than the card box', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const cardA = createFakeElement('cw-curated-card');
    const cardB = createFakeElement('cw-curated-card');
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';
    grid.style = {};
    cardA.style = {};
    cardB.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 0,
    });
    cardA.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });
    cardB.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 420,
    });

    Object.defineProperties(cardA, {
      scrollHeight: {
        configurable: true,
        get: () => 360,
      },
      clientHeight: {
        configurable: true,
        get: () => Number.parseFloat(String(cardA.style?.height || '0')) || 0,
      },
    });
    Object.defineProperties(cardB, {
      scrollHeight: {
        configurable: true,
        get: () => 420,
      },
      clientHeight: {
        configurable: true,
        get: () => Number.parseFloat(String(cardB.style?.height || '0')) || 0,
      },
    });

    grid.appendChild(cardA);
    grid.appendChild(cardB);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardA as unknown as Element,
      cardB as unknown as Element,
    ]);

    expect(cardA.style?.height).toBe('360px');
    expect(cardB.style?.height).toBe('360px');
    expect(readCardContainerHeightPx(grid)).toBe(360);
  });

  it('uses a 65th percentile compact height target for two-column grids', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    grid.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 760,
      height: 0,
    });

    const cards = Array.from({ length: 12 }, (_value, index) => {
      const card = createFakeElement('cw-curated-card');
      card.dataset.cwSeriesId = `series-${index + 1}`;
      card.style = {};
      const measuredHeight = 300 + index * 10;
      card.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 240,
        height: measuredHeight,
      });
      grid.appendChild(card);
      return card;
    });

    runtime.reorderCuratedGridChildren(
      grid as unknown as Element,
      cards.map((card) => card as unknown as Element),
    );

    const firstCard = cards[0];
    const lastCard = cards[cards.length - 1];
    expect(firstCard).toBeDefined();
    expect(lastCard).toBeDefined();
    expect(firstCard?.style?.height).toBe('370px');
    expect(lastCard?.style?.height).toBe('370px');
    expect(readCardContainerHeightPx(grid)).toBe(2280);
  });

  it('uses parent container width to size cards during absolute placement', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const gridParent = createFakeElement('cw-curated-grid-shell');
    const grid = createFakeElement('cw-curated-grid');
    const card = createFakeElement('cw-curated-card');
    card.dataset.cwSeriesId = 'series-a';
    grid.style = {};
    card.style = {};
    gridParent.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 860,
      height: 0,
    });
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 300,
      height: 0,
    });
    card.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });

    gridParent.appendChild(grid);
    grid.appendChild(card);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [card as unknown as Element]);

    expect(Number.parseFloat(String(card.style?.width || '0'))).toBeGreaterThan(300);
    expect(readCardContainerHeightPx(grid)).toBeGreaterThan(0);
  });

  it('tracks visual order through runtime-owned active state when absolute placement is active', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const cardA = createFakeElement('cw-curated-card');
    const cardB = createFakeElement('cw-curated-card');
    const cardC = createFakeElement('cw-curated-card');
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';
    cardC.dataset.cwSeriesId = 'series-c';
    grid.style = {};
    cardA.style = {};
    cardB.style = {};
    cardC.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1200,
      height: 0,
    });
    cardA.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });
    cardB.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });
    cardC.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });
    grid.appendChild(cardA);
    grid.appendChild(cardB);
    grid.appendChild(cardC);

    let insertBeforeCalls = 0;
    const insertBefore = grid.insertBefore;
    grid.insertBefore = (child: FakeElement, reference: FakeElement | null) => {
      insertBeforeCalls += 1;
      return insertBefore(child, reference);
    };

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardC as unknown as Element,
      cardA as unknown as Element,
      cardB as unknown as Element,
    ]);

    expect(insertBeforeCalls).toBe(0);
    expect(readActiveGridChildren(grid)).toEqual([cardC, cardA, cardB]);

    const cardALeft = Number.parseFloat(String(cardA.style?.left || '0'));
    const cardBLeft = Number.parseFloat(String(cardB.style?.left || '0'));
    const cardCLeft = Number.parseFloat(String(cardC.style?.left || '0'));
    expect(cardCLeft).toBeLessThan(cardALeft);
    expect(cardALeft).toBeLessThan(cardBLeft);
  });

  it('retains filtered cards in-grid and parks them after fade-out when requested', () => {
    vi.useFakeTimers();
    try {
      const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
      const grid = createFakeElement('cw-curated-grid');
      const cardA = createFakeElement('cw-curated-card');
      const cardB = createFakeElement('cw-curated-card');
      cardA.dataset.cwSeriesId = 'series-a';
      cardB.dataset.cwSeriesId = 'series-b';
      grid.style = {};
      cardA.style = {};
      cardB.style = {};
      grid.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 1000,
        height: 0,
      });
      cardA.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 240,
        height: 360,
      });
      cardB.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 240,
        height: 360,
      });
      grid.appendChild(cardA);
      grid.appendChild(cardB);

      const removedCards: FakeElement[] = [];
      runtime.reorderCuratedGridChildren(grid as unknown as Element, [cardA as unknown as Element], {
        onCardRemoved: (card) => {
          removedCards.push(card as unknown as FakeElement);
        },
        shouldRetainCardInGrid: (card) => {
          return (card as unknown as FakeElement).dataset.cwSeriesId === 'series-b';
        },
      });

      expect(removedCards).toEqual([]);
      expect(cardB.parentNode).toBe(grid);
      expect(cardB.className.includes('cw-curated-card--leaving')).toBe(true);
      expect(cardB.className.includes('cw-curated-card--parked')).toBe(false);

      vi.runAllTimers();

      expect(cardB.parentNode).toBe(grid);
      expect(cardB.className.includes('cw-curated-card--leaving')).toBe(false);
      expect(cardB.className.includes('cw-curated-card--parked')).toBe(true);
      expect(cardB.style?.display).toBe('none');
      expect(removedCards).toEqual([cardB]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('parks offscreen retained cards immediately instead of animating them in-grid', () => {
    vi.stubGlobal('innerHeight', 800);
    try {
      const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
      const grid = createFakeElement('cw-curated-grid');
      const cardA = createFakeElement('cw-curated-card');
      const cardB = createFakeElement('cw-curated-card');
      cardA.dataset.cwSeriesId = 'series-a';
      cardB.dataset.cwSeriesId = 'series-b';
      grid.style = {};
      cardA.style = {
        top: '0px',
        height: '360px',
      };
      cardB.style = {
        top: '4000px',
        height: '360px',
      };
      grid.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 1000,
        height: 0,
      });
      grid.appendChild(cardA);
      grid.appendChild(cardB);

      const removedCards: FakeElement[] = [];
      runtime.reorderCuratedGridChildren(grid as unknown as Element, [cardA as unknown as Element], {
        onCardRemoved: (card) => {
          removedCards.push(card as unknown as FakeElement);
        },
        shouldRetainCardInGrid: (card) => {
          return (card as unknown as FakeElement).dataset.cwSeriesId === 'series-b';
        },
      });

      expect(removedCards).toEqual([cardB]);
      expect(cardB.parentNode).toBe(grid);
      expect(cardB.className.includes('cw-curated-card--leaving')).toBe(false);
      expect(cardB.className.includes('cw-curated-card--parked')).toBe(true);
      expect(cardB.style?.display).toBe('none');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('updates absolute positions for medium-sized reorders while keeping active order aligned', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const rectReads = { value: 0 };
    const cards = Array.from({ length: 121 }, () => createMeasurableCard('cw-curated-card', rectReads));
    grid.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1200,
      height: 0,
    });
    cards.forEach((card, index) => {
      card.dataset.cwSeriesId = `series-${index + 1}`;
      card.style = {};
    });
    cards.forEach((card) => {
      grid.appendChild(card);
    });

    runtime.reorderCuratedGridChildren(
      grid as unknown as Element,
      [...cards].reverse().map((card) => card as unknown as Element),
    );

    const firstCard = cards[0];
    const lastCard = cards[120];
    if (!firstCard || !lastCard) {
      throw new Error('Expected test cards to exist for medium-sized reorder assertions');
    }

    expect(readActiveGridChildren(grid)[0]).toBe(cards[120]);
    expect(readActiveGridChildren(grid)[120]).toBe(cards[0]);
    expect(Number.parseFloat(String(firstCard.style?.top || '0'))).toBeGreaterThan(0);
    expect(Number.parseFloat(String(lastCard.style?.top || '0'))).toBe(0);
    expect(rectReads.value).toBeGreaterThan(0);
  });

  it('updates absolute positions for large reorders while keeping active order aligned', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const rectReads = { value: 0 };
    const cards = Array.from({ length: 321 }, () => createMeasurableCard('cw-curated-card', rectReads));
    grid.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1200,
      height: 0,
    });
    cards.forEach((card, index) => {
      card.dataset.cwSeriesId = `series-${index + 1}`;
      card.style = {};
    });
    cards.forEach((card) => {
      grid.appendChild(card);
    });

    runtime.reorderCuratedGridChildren(
      grid as unknown as Element,
      [...cards].reverse().map((card) => card as unknown as Element),
    );

    const firstCard = cards[0];
    const lastCard = cards[320];
    if (!firstCard || !lastCard) {
      throw new Error('Expected test cards to exist for large reorder assertions');
    }

    expect(readActiveGridChildren(grid)[0]).toBe(cards[320]);
    expect(readActiveGridChildren(grid)[320]).toBe(cards[0]);
    expect(Number.parseFloat(String(firstCard.style?.top || '0'))).toBeGreaterThan(0);
    expect(Number.parseFloat(String(lastCard.style?.top || '0'))).toBe(0);
    expect(rectReads.value).toBeGreaterThan(0);
  });

  it('handles large overflow removals while preserving final order', () => {
    vi.useFakeTimers();
    try {
      const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
      const grid = createFakeElement('cw-curated-grid');
      const rectReads = { value: 0 };
      const cards = Array.from({ length: 60 }, () => createMeasurableCard('cw-curated-card', rectReads));
      grid.style = {};
      grid.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 1200,
        height: 0,
      });
      cards.forEach((card, index) => {
        card.dataset.cwSeriesId = `series-${index + 1}`;
        card.style = {};
        grid.appendChild(card);
      });

      const removedCards: FakeElement[] = [];
      const nextCards = cards.slice(0, 30);
      runtime.reorderCuratedGridChildren(
        grid as unknown as Element,
        nextCards.map((card) => card as unknown as Element),
        {
          onCardRemoved: (card) => {
            removedCards.push(card as unknown as FakeElement);
          },
        },
      );

      expect(removedCards).toHaveLength(0);
      expect(nextCards.every((card) => card.parentNode === grid)).toBe(true);
      expect(rectReads.value).toBeGreaterThan(0);

      vi.runAllTimers();

      expect(grid.children).toEqual(nextCards);
      expect(removedCards).toHaveLength(30);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps element identity stable under repeated reorder churn while tracking the latest logical order', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const cardA = createFakeElement('cw-curated-card');
    const cardB = createFakeElement('cw-curated-card');
    const cardC = createFakeElement('cw-curated-card');
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';
    cardC.dataset.cwSeriesId = 'series-c';
    grid.style = {};
    cardA.style = {};
    cardB.style = {};
    cardC.style = {};
    grid.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1200,
      height: 0,
    });
    cardA.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });
    cardB.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });
    cardC.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 240,
      height: 360,
    });

    grid.appendChild(cardA);
    grid.appendChild(cardB);
    grid.appendChild(cardC);

    for (let cycle = 0; cycle < 25; cycle += 1) {
      const nextOrder = cycle % 2 === 0 ? [cardC, cardA, cardB] : [cardA, cardB, cardC];
      runtime.reorderCuratedGridChildren(
        grid as unknown as Element,
        nextOrder.map((card) => card as unknown as Element),
      );
    }

    expect(readActiveGridChildren(grid)).toEqual([cardC, cardA, cardB]);
    const cardALeft = Number.parseFloat(String(cardA.style?.left || '0'));
    const cardBLeft = Number.parseFloat(String(cardB.style?.left || '0'));
    const cardCLeft = Number.parseFloat(String(cardC.style?.left || '0'));
    expect(cardCLeft).toBeLessThan(cardALeft);
    expect(cardALeft).toBeLessThan(cardBLeft);
  });

  it('reports removed cards through onCardRemoved while ignoring non-card overflow nodes', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const removedCards: FakeElement[] = [];
    const cardA = createFakeElement('cw-curated-card');
    const cardB = createFakeElement('cw-curated-card');
    const emptyState = createFakeElement('cw-empty');
    cardA.dataset.cwSeriesId = 'series-a';
    cardB.dataset.cwSeriesId = 'series-b';

    grid.appendChild(cardA);
    grid.appendChild(emptyState);
    grid.appendChild(cardB);

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [cardB as unknown as Element], {
      onCardRemoved: (card) => {
        removedCards.push(card as unknown as FakeElement);
      },
    });

    expect(grid.children).toEqual([cardB]);
    expect(removedCards).toEqual([cardA]);
  });
});
