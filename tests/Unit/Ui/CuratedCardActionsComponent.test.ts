import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeButton = {
  className: string;
  title: string;
  textContent: string;
  attributes: Record<string, string>;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
};

type CuratedCardActionsComponent = {
  patch: (entry: { isFavorite?: boolean | null }) => void;
};

type CuratedActionsRoot = {
  children?: unknown[];
};

type CuratedCardActionRefs = {
  favoriteButton: HTMLButtonElement;
  removeButton: HTMLButtonElement;
};

type CuratedCardActionsModule = {
  createCuratedCardActionsComponent: (options: {
    actionsRoot: CuratedActionsRoot;
    actionRefs?: CuratedCardActionRefs | null;
    entry?: { isFavorite?: boolean | null };
  }) => CuratedCardActionsComponent;
};

const cardActionsComponentModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Ui', 'CuratedCardActionsComponent.ts'),
).href;
let createCuratedCardActionsComponentFactory: CuratedCardActionsModule['createCuratedCardActionsComponent'] | null =
  null;

function createFakeButton(): FakeButton {
  return {
    className: 'cw-curated-card__action',
    title: '',
    textContent: '',
    attributes: {},
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    },
  };
}

describe('curated-card-actions component', () => {
  beforeEach(async () => {
    vi.resetModules();
    const actionsModule = (await import(cardActionsComponentModuleUrl)) as CuratedCardActionsModule;
    createCuratedCardActionsComponentFactory = actionsModule.createCuratedCardActionsComponent;
  });

  afterEach(() => {
    createCuratedCardActionsComponentFactory = null;
  });

  it('patches favorite button state from owned action children', () => {
    if (typeof createCuratedCardActionsComponentFactory !== 'function') {
      throw new Error('Card actions component factory was not initialized for test');
    }
    const favoriteButton = createFakeButton();
    const removeButton = createFakeButton();
    const actionsRoot = {
      children: [favoriteButton, removeButton],
    } as CuratedActionsRoot;

    const component = createCuratedCardActionsComponentFactory({
      actionsRoot,
      entry: {
        isFavorite: false,
      },
    });

    component.patch({
      isFavorite: true,
    });

    expect(favoriteButton.className).toContain('is-active');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Unfavorite');
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
    expect(favoriteButton.title).toBe('Unfavorite');
    expect(favoriteButton.textContent).toBe('♥');
  });

  it('supports explicit action refs without child lookups', () => {
    if (typeof createCuratedCardActionsComponentFactory !== 'function') {
      throw new Error('Card actions component factory was not initialized for test');
    }
    const favoriteButton = createFakeButton();
    const removeButton = createFakeButton();
    const actionsRoot = {
      children: [],
    } as CuratedActionsRoot;

    const component = createCuratedCardActionsComponentFactory({
      actionsRoot,
      actionRefs: {
        favoriteButton: favoriteButton as unknown as HTMLButtonElement,
        removeButton: removeButton as unknown as HTMLButtonElement,
      },
    });

    component.patch({
      isFavorite: false,
    });

    expect(favoriteButton.className).not.toContain('is-active');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Favorite');
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
    expect(favoriteButton.title).toBe('Favorite');
    expect(favoriteButton.textContent).toBe('♡');
  });
});
