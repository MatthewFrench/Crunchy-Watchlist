import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CardLayout = 'portrait' | 'landscape';

type CuratedCardController = {
  seriesId: string;
  card: FakeElement;
  contentSignature: string;
  cardLayout: CardLayout;
  parkedAt: number | null;
};

type ParkingLifecycleHandlers = {
  onParked?: (() => void) | null;
  onUnparked?: (() => void) | null;
  onDisposed?: (() => void) | null;
};

type CuratedPanelGridParkingManager = {
  getControllerForSeriesId: (seriesId: string) => CuratedCardController | null;
  setController: (controller: CuratedCardController) => void;
  markCardControllerActive: (seriesId: string, handlers?: ParkingLifecycleHandlers) => void;
  parkGridCardsForReuse: (
    documentRef: FakeDocumentRef,
    gridElement: FakeElement,
    handlers?: ParkingLifecycleHandlers,
  ) => void;
  parkUnusedControllersForReuse: (
    documentRef: FakeDocumentRef,
    visibleSeriesIds: Set<string>,
    handlers?: ParkingLifecycleHandlers,
  ) => void;
  parkCardForReuse: (documentRef: FakeDocumentRef, card: FakeElement, handlers?: ParkingLifecycleHandlers) => void;
  trimParkedCardsForReuse: (handlers?: ParkingLifecycleHandlers) => void;
  dispose: () => void;
};

type CuratedPanelGridParkingManagerCtorOptions = {
  maxParkedCardCount?: number;
  maxParkedCardAgeMs?: number;
  now?: () => number;
  isCuratedCardElement: (value: unknown) => value is FakeElement;
  getElementDataAttribute: (element: FakeElement, datasetKey: string, attributeName: string) => string;
  parseCardLayoutFromContentSignature: (signature: string) => CardLayout | null;
  setCardParkedState: (card: FakeElement, parked: boolean) => void;
};

type CuratedPanelGridParkingManagerModule = {
  CuratedPanelGridParkingManager: new (
    options: CuratedPanelGridParkingManagerCtorOptions,
  ) => CuratedPanelGridParkingManager;
};

type FakeElement = {
  tagName: string;
  className: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  style: Record<string, string>;
  children: FakeElement[];
  parentNode: FakeElement | null;
  appendChild: (child: FakeElement) => FakeElement;
  insertBefore: (child: FakeElement, reference: FakeElement | null) => FakeElement;
  removeChild: (child: FakeElement) => FakeElement;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
};

type FakeDocumentRef = {
  createElement: (tagName: string) => FakeElement;
  createDocumentFragment: () => FakeElement;
};

const moduleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridParkingManager.ts'),
).href;

let CuratedPanelGridParkingManagerCtor: CuratedPanelGridParkingManagerModule['CuratedPanelGridParkingManager'] | null =
  null;

function createFakeElement(tagName = 'div'): FakeElement {
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

  const element: FakeElement = {
    tagName: tagName.toLowerCase(),
    className: '',
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
      }
      child.parentNode = null;
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
        return this.dataset[toDatasetKey(name)] ?? null;
      }
      return this.attributes[name] ?? null;
    },
  };

  return element;
}

function createFakeDocumentRef(): FakeDocumentRef {
  return {
    createElement: (tagName: string) => createFakeElement(tagName),
    createDocumentFragment: () => createFakeElement('#document-fragment'),
  };
}

function createFakeCard(seriesId: string, contentSignature = 'layout:portrait|series:S-1'): FakeElement {
  const card = createFakeElement('article');
  card.className = 'cw-curated-card';
  card.dataset.cwSeriesId = seriesId;
  card.dataset.cwCardContentSignature = contentSignature;
  return card;
}

function createFakeController(seriesId: string, card: FakeElement): CuratedCardController {
  return {
    seriesId,
    card,
    contentSignature: card.dataset.cwCardContentSignature || 'layout:portrait|series:S-1',
    cardLayout: 'portrait',
    parkedAt: null,
  };
}

function getManagerCtor(): CuratedPanelGridParkingManagerModule['CuratedPanelGridParkingManager'] {
  if (!CuratedPanelGridParkingManagerCtor) {
    throw new Error('CuratedPanelGridParkingManager module not initialized');
  }
  return CuratedPanelGridParkingManagerCtor;
}

function createParkingManager(options?: {
  maxParkedCardCount?: number;
  maxParkedCardAgeMs?: number;
  now?: () => number;
}): CuratedPanelGridParkingManager {
  const ParkingManagerCtor = getManagerCtor();
  const ctorOptions: CuratedPanelGridParkingManagerCtorOptions = {
    isCuratedCardElement: (value: unknown): value is FakeElement => {
      if (!value || typeof value !== 'object') {
        return false;
      }
      return typeof (value as FakeElement).dataset?.cwSeriesId === 'string';
    },
    getElementDataAttribute: (element: FakeElement, datasetKey: string): string => {
      return element.dataset[datasetKey] || '';
    },
    parseCardLayoutFromContentSignature: (signature: string): CardLayout | null => {
      return signature.includes('landscape') ? 'landscape' : 'portrait';
    },
    setCardParkedState: (card: FakeElement, parked: boolean): void => {
      const classTokens = card.className.split(' ').filter(Boolean);
      const hasParkedToken = classTokens.includes('cw-curated-card--parked');
      if (parked && !hasParkedToken) {
        classTokens.push('cw-curated-card--parked');
      }
      if (!parked && hasParkedToken) {
        card.className = classTokens.filter((token) => token !== 'cw-curated-card--parked').join(' ');
        return;
      }
      card.className = classTokens.join(' ');
    },
  };

  if (typeof options?.maxParkedCardCount === 'number') {
    ctorOptions.maxParkedCardCount = options.maxParkedCardCount;
  }
  if (typeof options?.maxParkedCardAgeMs === 'number') {
    ctorOptions.maxParkedCardAgeMs = options.maxParkedCardAgeMs;
  }
  if (typeof options?.now === 'function') {
    ctorOptions.now = options.now;
  }

  return new ParkingManagerCtor(ctorOptions);
}

describe('curated-panel-grid parking manager', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(moduleUrl)) as CuratedPanelGridParkingManagerModule;
    CuratedPanelGridParkingManagerCtor = module.CuratedPanelGridParkingManager;
  });

  it('parks and unparks a card controller with lifecycle callbacks', () => {
    const documentRef = createFakeDocumentRef();
    const grid = createFakeElement('div');
    const card = createFakeCard('SERIES-1');
    grid.appendChild(card);

    let now = 100;
    const manager = createParkingManager({ now: () => now });
    const lifecycleCounts = { parked: 0, unparked: 0, disposed: 0 };
    const handlers: ParkingLifecycleHandlers = {
      onParked: () => {
        lifecycleCounts.parked += 1;
      },
      onUnparked: () => {
        lifecycleCounts.unparked += 1;
      },
      onDisposed: () => {
        lifecycleCounts.disposed += 1;
      },
    };

    manager.parkCardForReuse(documentRef, card, handlers);

    const controller = manager.getControllerForSeriesId('SERIES-1');
    expect(controller).not.toBeNull();
    expect(controller?.parkedAt).toBe(100);
    expect(lifecycleCounts.parked).toBe(1);
    expect(card.parentNode?.tagName).toBe('#document-fragment');

    now = 130;
    manager.markCardControllerActive('SERIES-1', handlers);

    expect(controller?.parkedAt).toBeNull();
    expect(lifecycleCounts.unparked).toBe(1);
    expect(lifecycleCounts.disposed).toBe(0);
  });

  it('disposes expired parked controllers during trim', () => {
    const documentRef = createFakeDocumentRef();
    const card = createFakeCard('SERIES-EXPIRING');

    let now = 10;
    const manager = createParkingManager({
      now: () => now,
      maxParkedCardAgeMs: 5,
    });

    let disposedCount = 0;
    manager.parkCardForReuse(documentRef, card);
    now = 20;
    manager.trimParkedCardsForReuse({
      onDisposed: () => {
        disposedCount += 1;
      },
    });

    expect(disposedCount).toBe(1);
    expect(manager.getControllerForSeriesId('SERIES-EXPIRING')).toBeNull();
  });

  it('evicts oldest parked controller when over parked-card count budget', () => {
    const documentRef = createFakeDocumentRef();

    let now = 1;
    const manager = createParkingManager({
      now: () => now,
      maxParkedCardCount: 1,
      maxParkedCardAgeMs: 60_000,
    });

    const cardA = createFakeCard('SERIES-A', 'layout:portrait|series:A');
    const cardB = createFakeCard('SERIES-B', 'layout:portrait|series:B');

    manager.parkCardForReuse(documentRef, cardA);
    now = 2;
    manager.parkCardForReuse(documentRef, cardB);

    let disposedCount = 0;
    manager.trimParkedCardsForReuse({
      onDisposed: () => {
        disposedCount += 1;
      },
    });

    expect(disposedCount).toBe(1);
    expect(manager.getControllerForSeriesId('SERIES-A')).toBeNull();
    expect(manager.getControllerForSeriesId('SERIES-B')).not.toBeNull();
  });

  it('parks non-visible active controllers during unused-controller pass', () => {
    const documentRef = createFakeDocumentRef();
    const manager = createParkingManager();

    const cardA = createFakeCard('SERIES-A');
    const cardB = createFakeCard('SERIES-B');
    const grid = createFakeElement('div');
    grid.appendChild(cardA);
    grid.appendChild(cardB);

    manager.setController(createFakeController('SERIES-A', cardA));
    manager.setController(createFakeController('SERIES-B', cardB));

    let parkedCount = 0;
    manager.parkUnusedControllersForReuse(documentRef, new Set<string>(['SERIES-B']), {
      onParked: () => {
        parkedCount += 1;
      },
    });

    expect(parkedCount).toBe(1);
    expect(manager.getControllerForSeriesId('SERIES-A')?.parkedAt).not.toBeNull();
    expect(manager.getControllerForSeriesId('SERIES-B')?.parkedAt).toBeNull();
  });
});
