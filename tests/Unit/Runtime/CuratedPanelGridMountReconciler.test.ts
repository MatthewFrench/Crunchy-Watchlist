import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type FakeElement = {
  tagName: string;
  textContent: string | null;
  children: FakeElement[];
  parentNode: FakeElement | null;
  appendChild: (child: FakeElement) => FakeElement;
  removeChild: (child: FakeElement) => FakeElement;
};

type CuratedPanelGridMountReconcilerOwner = {
  renderEmptyState: (options: {
    documentRef: { createElement: (tagName: string) => FakeElement };
    gridEl: FakeElement;
    total: number;
    loading: boolean;
    parkGridCardsForReuse: (gridElement: FakeElement) => void;
    parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>) => void;
    createCuratedGridEmptyElement: (
      documentRef: { createElement: (tagName: string) => FakeElement },
      total: number,
    ) => FakeElement;
    trimParkedCardsForReuse: () => void;
  }) => void;
  renderVisibleState: (options: {
    gridEl: FakeElement;
    nextCards: FakeElement[];
    visibleSeriesIds: Set<string>;
    reorderCuratedGridChildren: (
      gridElement: FakeElement,
      nextCards: FakeElement[],
      options?: { onCardRemoved?: ((card: FakeElement) => void) | null },
    ) => void;
    parkCardForReuse: (card: FakeElement) => void;
    parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>) => void;
    trimParkedCardsForReuse: () => void;
  }) => void;
};

type MountReconcilerModule = {
  CuratedPanelGridMountReconcilerOwner: new () => CuratedPanelGridMountReconcilerOwner;
};

const moduleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridMountReconciler.ts'),
).href;

let OwnerCtor: MountReconcilerModule['CuratedPanelGridMountReconcilerOwner'] | null = null;

function createFakeElement(tagName = 'div'): FakeElement {
  let textContentValue: string | null = '';
  const element: FakeElement = {
    tagName,
    textContent: '',
    children: [],
    parentNode: null,
    appendChild(child) {
      if (child.parentNode) {
        child.parentNode.removeChild(child);
      }
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index >= 0) {
        this.children.splice(index, 1);
      }
      child.parentNode = null;
      return child;
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
      }
    },
    enumerable: true,
    configurable: true,
  });
  return element;
}

function getOwnerCtor(): MountReconcilerModule['CuratedPanelGridMountReconcilerOwner'] {
  if (!OwnerCtor) {
    throw new Error('CuratedPanelGridMountReconcilerOwner module was not initialized for test');
  }
  return OwnerCtor;
}

describe('curated-panel-grid mount reconciler owner', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(moduleUrl)) as MountReconcilerModule;
    OwnerCtor = module.CuratedPanelGridMountReconcilerOwner;
  });

  it('renders empty state by parking current cards and appending empty element', () => {
    const reconciler = new (getOwnerCtor())();
    const grid = createFakeElement('div');
    grid.appendChild(createFakeElement('article'));

    const parkGridCardsForReuse = vi.fn();
    const parkUnusedControllersForReuse = vi.fn();
    const trimParkedCardsForReuse = vi.fn();

    reconciler.renderEmptyState({
      documentRef: {
        createElement: (tagName: string) => createFakeElement(tagName),
      },
      gridEl: grid,
      total: 2,
      loading: false,
      parkGridCardsForReuse,
      parkUnusedControllersForReuse,
      createCuratedGridEmptyElement: (_documentRef, total) => {
        const empty = createFakeElement('div');
        empty.textContent = `empty:${total}`;
        return empty;
      },
      trimParkedCardsForReuse,
    });

    expect(parkGridCardsForReuse).toHaveBeenCalledWith(grid);
    expect(parkUnusedControllersForReuse).toHaveBeenCalledWith(expect.any(Set));
    expect(grid.children).toHaveLength(1);
    expect(grid.children[0]?.textContent).toBe('empty:2');
    expect(trimParkedCardsForReuse).toHaveBeenCalledTimes(1);
  });

  it('reconciles visible state through reorder and post-reorder parking passes', () => {
    const reconciler = new (getOwnerCtor())();
    const grid = createFakeElement('div');
    const removed = createFakeElement('article');
    const cardA = createFakeElement('article');
    const cardB = createFakeElement('article');
    const parkCardForReuse = vi.fn();
    const parkUnusedControllersForReuse = vi.fn();
    const trimParkedCardsForReuse = vi.fn();

    reconciler.renderVisibleState({
      gridEl: grid,
      nextCards: [cardA, cardB],
      visibleSeriesIds: new Set<string>(['SERIES-A', 'SERIES-B']),
      reorderCuratedGridChildren: (gridElement, nextCardsValue, options) => {
        expect(gridElement).toBe(grid);
        expect(nextCardsValue).toEqual([cardA, cardB]);
        options?.onCardRemoved?.(removed);
      },
      parkCardForReuse,
      parkUnusedControllersForReuse,
      trimParkedCardsForReuse,
    });

    expect(parkCardForReuse).toHaveBeenCalledWith(removed);
    expect(parkUnusedControllersForReuse).toHaveBeenCalledWith(new Set<string>(['SERIES-A', 'SERIES-B']));
    expect(trimParkedCardsForReuse).toHaveBeenCalledTimes(1);
  });
});
