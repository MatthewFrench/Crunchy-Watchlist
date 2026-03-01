import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeClassList = {
  add: (...tokens: string[]) => void;
};

type FakeElement = {
  tagName: string;
  id: string;
  className: string;
  classList: FakeClassList;
  textContent: string;
  type: string;
  checked: boolean;
  value: string;
  selected: boolean;
  style: Record<string, string>;
  attributes: Record<string, string>;
  children: FakeElement[];
  appendChild: (child: FakeElement) => FakeElement;
  setAttribute: (name: string, value: string) => void;
};

type ControlsViewRuntime = {
  createCuratedInterfaceControls: (settings: unknown, sortModeControlOptions: unknown) => Record<string, unknown>;
};

type ControlsViewModule = {
  createControlsView: (options: Record<string, unknown>) => ControlsViewRuntime;
};

const controlsViewModuleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Ui', 'ControlsView.ts')).href;
let createControlsView: ControlsViewModule['createControlsView'] | null = null;

function createFakeDocument() {
  return {
    createElement(tagName: string): FakeElement {
      const classNames = new Set<string>();
      const element: FakeElement = {
        tagName,
        id: '',
        className: '',
        classList: {
          add: (...tokens: string[]) => {
            tokens.forEach((token) => {
              if (token) {
                classNames.add(token);
              }
            });
            element.className = Array.from(classNames).join(' ');
          },
        },
        textContent: '',
        type: '',
        checked: false,
        value: '',
        selected: false,
        style: {},
        attributes: {},
        children: [],
        appendChild(child: FakeElement) {
          this.children.push(child);
          return child;
        },
        setAttribute(name: string, value: string) {
          this.attributes[name] = value;
        },
      };
      return element;
    },
  };
}

describe('controls-view ui module', () => {
  const previousDocument = (globalThis as Record<string, unknown>).document;

  beforeEach(async () => {
    vi.resetModules();
    (globalThis as Record<string, unknown>).document = createFakeDocument();
    const controlsViewModule = (await import(controlsViewModuleUrl)) as {
      createControlsViewRuntime: () => object;
    };
    createControlsView = (controlsViewModule.createControlsViewRuntime() as ControlsViewModule).createControlsView;
  });

  afterEach(() => {
    createControlsView = null;
    (globalThis as Record<string, unknown>).document = previousDocument;
  });

  it('creates a secondary sort control with an explicit disabled option', () => {
    if (typeof createControlsView !== 'function') {
      throw new Error('Controls view runtime was not initialized for test');
    }
    const documentRef = globalThis.document as ReturnType<typeof createFakeDocument>;
    const runtime = createControlsView({
      documentRef,
    });
    const controls = runtime.createCuratedInterfaceControls(
      {
        sortMode: 'rating_desc',
        secondarySortMode: 'none',
      },
      [{ optionValue: 'rating_desc', title: 'Rating high to low' }],
    );

    const secondarySortControl = controls.secondarySortControl as Record<string, unknown>;
    const secondarySelect = secondarySortControl.select as FakeElement;
    expect(secondarySelect.id).toBe('cw-secondary-sort-mode');
    expect(secondarySelect.children.map((child) => child.value)).toEqual(['none', 'rating_desc']);
    expect(secondarySelect.children[0]?.textContent).toBe('Disabled (primary sort only)');
    expect(secondarySelect.children[0]?.selected).toBe(true);
  });

  it('includes hide-not-started mode in watch-ready filter options', () => {
    if (typeof createControlsView !== 'function') {
      throw new Error('Controls view runtime was not initialized for test');
    }
    const documentRef = globalThis.document as ReturnType<typeof createFakeDocument>;
    const runtime = createControlsView({
      documentRef,
    });
    const controls = runtime.createCuratedInterfaceControls(
      {
        watchReadyFilterMode: 'hide_not_started',
      },
      [{ optionValue: 'rating_desc', title: 'Rating high to low' }],
    );

    const watchReadyFilterControl = controls.watchReadyFilterControl as Record<string, unknown>;
    const watchReadySelect = watchReadyFilterControl.select as FakeElement;
    expect(watchReadySelect.id).toBe('cw-watch-ready-mode');
    expect(watchReadySelect.children.map((child) => child.value)).toEqual(['none', 'dim', 'hide', 'hide_not_started']);
    expect(watchReadySelect.children[3]?.textContent).toBe('Hide not watched / not started');
    expect(watchReadySelect.children[3]?.selected).toBe(true);
  });

  it('includes favorites in genre filter options', () => {
    if (typeof createControlsView !== 'function') {
      throw new Error('Controls view runtime was not initialized for test');
    }
    const documentRef = globalThis.document as ReturnType<typeof createFakeDocument>;
    const runtime = createControlsView({
      documentRef,
    });
    const controls = runtime.createCuratedInterfaceControls(
      {
        genreFilter: '__favorites__',
      },
      [{ optionValue: 'rating_desc', title: 'Rating high to low' }],
    );

    const genreFilterControl = controls.genreFilterControl as Record<string, unknown>;
    const genreSelect = genreFilterControl.select as FakeElement;
    expect(genreSelect.id).toBe('cw-genre-filter');
    expect(genreSelect.children.map((child) => child.value)).toEqual(['any', '__favorites__']);
    expect(genreSelect.children[1]?.textContent).toBe('Favorites');
    expect(genreSelect.children[1]?.selected).toBe(true);
  });
});
