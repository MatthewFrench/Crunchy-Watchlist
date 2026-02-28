import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type CuratedPanelGridTransitionsRuntime = {
  reorderCuratedGridChildren: (
    gridElement: Element,
    nextCards: Element[],
    options?: { onCardRemoved?: ((card: Element) => void) | null },
  ) => void;
};

type CuratedPanelGridTransitionsModule = {
  runtimeCuratedPanelGridTransitions: {
    createCuratedPanelGridTransitionsRuntime: () => CuratedPanelGridTransitionsRuntime;
  };
};

type FakeElement = {
  className: string;
  dataset: Record<string, string>;
  children: FakeElement[];
  parentNode: FakeElement | null;
  appendChild: (child: FakeElement) => FakeElement;
  insertBefore: (child: FakeElement, reference: FakeElement | null) => FakeElement;
  removeChild: (child: FakeElement) => FakeElement;
  getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  animate?: () => { addEventListener: (eventName: string, listener: () => void, options?: unknown) => void };
};

const curatedPanelGridTransitionsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridTransitions.ts'),
).href;

function getCuratedPanelGridTransitionsModule() {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as CuratedPanelGridTransitionsModule;
  return registry.runtimeCuratedPanelGridTransitions;
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
    await loadRuntimeModules([curatedPanelGridTransitionsModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
  });

  it('reorders cards and removes overflow cards when animation prerequisites are unavailable', () => {
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

    expect(grid.children).toEqual([cardB, cardA]);
    expect(cardC.parentNode).toBeNull();
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

  it('falls back to direct reordering when list size exceeds animation threshold', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime();
    const grid = createFakeElement('cw-curated-grid');
    const rectReads = { value: 0 };
    const cards = Array.from({ length: 121 }, () => createMeasurableCard('cw-curated-card', rectReads));
    cards.forEach((card, index) => {
      card.dataset.cwSeriesId = `series-${index + 1}`;
    });
    cards.forEach((card) => {
      grid.appendChild(card);
    });

    runtime.reorderCuratedGridChildren(
      grid as unknown as Element,
      [...cards].reverse().map((card) => card as unknown as Element),
    );

    expect(grid.children[0]).toBe(cards[120]);
    expect(grid.children[120]).toBe(cards[0]);
    expect(rectReads.value).toBe(0);
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
