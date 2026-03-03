import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeElement = {
  className: string;
  textContent: string | null;
  style: Record<string, string>;
  children: FakeElement[];
  parentNode: FakeElement | null;
  appendChild: (child: FakeElement) => FakeElement;
  getAttribute: (name: string) => string | null;
  setAttribute: (name: string, value: string) => void;
  scrollHeight?: number;
  offsetTop?: number;
  offsetHeight?: number;
};

type CuratedPanelLoadingIndicatorRuntime = {
  syncLoadingIndicator: (options: {
    documentRef: Document;
    loadingIndicatorEl: Element;
    loadingBoxEl?: Element | null;
    gridEl?: Element | null;
    loading: boolean;
    firstLoadInFlight: boolean;
    pendingRequests: string[];
    requestProgress: { started: number; completed: number; inProgress: number };
  }) => void;
};

type CuratedPanelLoadingIndicatorModule = {
  createCuratedPanelLoadingIndicatorRuntime: () => CuratedPanelLoadingIndicatorRuntime;
};

const moduleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelLoadingIndicator.ts'),
).href;

let moduleFactory: CuratedPanelLoadingIndicatorModule | null = null;

function createFakeElement(className = ''): FakeElement {
  const attributes: Record<string, string> = {};
  const element: FakeElement = {
    className,
    textContent: '',
    style: {},
    children: [],
    parentNode: null,
    appendChild(child: FakeElement) {
      if (child.parentNode) {
        const siblingIndex = child.parentNode.children.indexOf(child);
        if (siblingIndex >= 0) {
          child.parentNode.children.splice(siblingIndex, 1);
        }
      }
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    getAttribute(name: string): string | null {
      if (name === 'class') {
        return this.className || null;
      }
      return attributes[name] ?? null;
    },
    setAttribute(name: string, value: string): void {
      attributes[name] = value;
      if (name === 'class') {
        this.className = value;
      }
    },
  };
  return element;
}

function createFakeDocumentRef() {
  const defaultView = {
    requestAnimationFrame: (callback: () => void) => {
      callback();
      return 1;
    },
    cancelAnimationFrame: (_id: number) => {},
    setTimeout: (callback: () => void, _delay?: number) => {
      callback();
      return 1;
    },
    clearTimeout: (_id: number) => {},
  };

  return {
    defaultView,
    createElement: () => createFakeElement(),
  } as unknown as Document;
}

function hasClassNameToken(element: FakeElement, token: string): boolean {
  return element.className
    .split(' ')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(token);
}

describe('CuratedPanelLoadingIndicator', () => {
  beforeEach(async () => {
    vi.resetModules();
    moduleFactory = (await import(moduleUrl)) as CuratedPanelLoadingIndicatorModule;
  });

  afterEach(() => {
    moduleFactory = null;
  });

  it('clears animated container height and keeps card-container flow height after first-load transition', () => {
    if (!moduleFactory) {
      throw new Error('Missing loading-indicator runtime factory');
    }

    const runtime = moduleFactory.createCuratedPanelLoadingIndicatorRuntime();
    const documentRef = createFakeDocumentRef();
    const loadingBox = createFakeElement('cw-loading-box');
    const loadingIndicator = createFakeElement('cw-loading cw-loading-indicator');
    loadingBox.appendChild(loadingIndicator);
    const grid = createFakeElement('cw-curated-card-container cw-curated-grid');
    grid.style.height = '1px';
    grid.style['--cw-curated-card-container-height'] = '360px';
    grid.scrollHeight = 0;

    runtime.syncLoadingIndicator({
      documentRef,
      loadingIndicatorEl: loadingIndicator as unknown as Element,
      loadingBoxEl: loadingBox as unknown as Element,
      gridEl: grid as unknown as Element,
      loading: true,
      firstLoadInFlight: true,
      pendingRequests: ['loading'],
      requestProgress: { started: 1, completed: 0, inProgress: 1 },
    });
    expect(grid.style.height).toBe('0px');

    runtime.syncLoadingIndicator({
      documentRef,
      loadingIndicatorEl: loadingIndicator as unknown as Element,
      loadingBoxEl: loadingBox as unknown as Element,
      gridEl: grid as unknown as Element,
      loading: false,
      firstLoadInFlight: false,
      pendingRequests: [],
      requestProgress: { started: 1, completed: 1, inProgress: 0 },
    });

    expect(hasClassNameToken(grid, 'cw-curated-card-container--visible')).toBe(true);
    expect(hasClassNameToken(grid, 'cw-curated-grid--visible')).toBe(true);
    expect(grid.style.height).toBe('');
    expect(grid.style['--cw-curated-card-container-height']).toBe('360px');
  });
});
