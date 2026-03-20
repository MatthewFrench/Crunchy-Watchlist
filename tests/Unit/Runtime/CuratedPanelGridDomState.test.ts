import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedPanelGridDomStateModule = {
  readProjectedCuratedGridChildren: (gridElement: Element) => Element[];
  readProjectedCuratedGridSeriesIds: (gridElement: Element) => string[];
  writeProjectedCuratedGridChildren: (
    gridElement: Element,
    activeCards: Element[],
    projectedSeriesIds?: string[],
  ) => void;
  clearCuratedGridDomState: (gridElement: Element) => void;
};

type FakeElement = {
  className: string;
  children: FakeElement[];
  parentNode: FakeElement | null;
  appendChild: (child: FakeElement) => FakeElement;
};

const moduleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridDomState.ts'),
).href;

let domStateModule: CuratedPanelGridDomStateModule | null = null;

function createFakeElement(className = ''): FakeElement {
  const element = {
    className,
    children: [] as FakeElement[],
    parentNode: null as FakeElement | null,
  } as FakeElement;

  element.appendChild = (child: FakeElement) => {
    if (child.parentNode) {
      const previousParent = child.parentNode;
      const previousIndex = previousParent.children.indexOf(child);
      if (previousIndex >= 0) {
        previousParent.children.splice(previousIndex, 1);
      }
    }
    element.children.push(child);
    child.parentNode = element;
    return child;
  };

  return element;
}

function getDomStateModule(): CuratedPanelGridDomStateModule {
  if (!domStateModule) {
    throw new Error('CuratedPanelGridDomState module not initialized');
  }
  return domStateModule;
}

describe('CuratedPanelGridDomState', () => {
  beforeEach(async () => {
    vi.resetModules();
    domStateModule = (await import(moduleUrl)) as CuratedPanelGridDomStateModule;
  });

  it('returns no active children until the owner projects them explicitly', () => {
    const grid = createFakeElement('cw-curated-grid');
    const visibleCard = createFakeElement('cw-curated-card');
    grid.appendChild(visibleCard);

    expect(getDomStateModule().readProjectedCuratedGridChildren(grid as unknown as Element)).toEqual([]);
  });

  it('returns the projected children written by the owner', () => {
    const grid = createFakeElement('cw-curated-grid');
    const visibleCard = createFakeElement('cw-curated-card');
    grid.appendChild(visibleCard);

    getDomStateModule().writeProjectedCuratedGridChildren(grid as unknown as Element, [
      visibleCard as unknown as Element,
    ]);

    expect(getDomStateModule().readProjectedCuratedGridChildren(grid as unknown as Element)).toEqual([
      visibleCard as unknown as Element,
    ]);
  });

  it('returns the projected series ids written by the owner', () => {
    const grid = createFakeElement('cw-curated-grid');
    const visibleCard = createFakeElement('cw-curated-card');
    grid.appendChild(visibleCard);

    getDomStateModule().writeProjectedCuratedGridChildren(
      grid as unknown as Element,
      [visibleCard as unknown as Element],
      ['series-1'],
    );

    expect(getDomStateModule().readProjectedCuratedGridSeriesIds(grid as unknown as Element)).toEqual(['series-1']);
  });
});
