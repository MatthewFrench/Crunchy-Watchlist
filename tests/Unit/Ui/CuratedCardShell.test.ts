import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeMouseEvent = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: {
    closest: (selector: string) => unknown;
  } | null;
};

type FakeElement = {
  tagName: string;
  className: string;
  classList: {
    add: (...tokens: string[]) => void;
  };
  textContent: string;
  href: string;
  loading: string;
  src: string;
  alt: string;
  title: string;
  complete?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  style: Record<string, string>;
  children: FakeElement[];
  parentNode?: FakeElement | null;
  listeners: Record<string, Array<(event: FakeMouseEvent) => void>>;
  appendChild: (child: FakeElement) => FakeElement;
  removeChild: (child: FakeElement) => FakeElement;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (eventName: string, listener: (event: FakeMouseEvent) => void) => void;
  dispatch: (eventName: string, event?: Partial<FakeMouseEvent>) => void;
  querySelector?: (selector: string) => FakeElement | null;
};

type FakeDocument = {
  createElement: (tagName: string) => FakeElement;
  defaultView:
    | {
        IntersectionObserver?: new (
          callback: (entries: Array<{ isIntersecting: boolean }>) => void,
          options?: unknown,
        ) => {
          observe: (target: unknown) => void;
          disconnect: () => void;
        };
      }
    | undefined;
};

type CardShellRuntime = {
  getCardCoverImage: (entry: unknown, layout?: unknown) => string;
  attachCuratedCardNavigation: (item: FakeElement, cardHref: string) => void;
  createCuratedCard: (entry: unknown) => FakeElement;
  patchCuratedCard: (card: unknown, entry: unknown) => void;
};

type CardShellModule = {
  createCardShell: (deps: Record<string, unknown>) => CardShellRuntime;
};

const cardShellModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Ui', 'CuratedCardShell.ts'),
).href;
let createCardShell: CardShellModule['createCardShell'] | null = null;

function createFakeDocument(
  options: {
    defaultView?: FakeDocument['defaultView'];
  } = {},
): FakeDocument {
  const createElement = (tagName: string): FakeElement => {
    const classNames = new Set<string>();
    const element: FakeElement = {
      tagName,
      className: '',
      classList: {
        add(...tokens: string[]) {
          for (const token of tokens) {
            if (!token) {
              continue;
            }
            classNames.add(token);
          }
          element.className = Array.from(classNames).join(' ');
        },
      },
      textContent: '',
      href: '',
      loading: '',
      src: '',
      alt: '',
      title: '',
      complete: false,
      naturalWidth: 0,
      naturalHeight: 0,
      dataset: {},
      attributes: {},
      style: {},
      children: [],
      parentNode: null,
      listeners: {},
      appendChild(child: FakeElement) {
        if (child.parentNode) {
          child.parentNode.removeChild(child);
        }
        this.children.push(child);
        child.parentNode = this;
        return child;
      },
      removeChild(child: FakeElement) {
        const index = this.children.indexOf(child);
        if (index >= 0) {
          this.children.splice(index, 1);
          child.parentNode = null;
        }
        return child;
      },
      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      },
      addEventListener(eventName: string, listener: (event: FakeMouseEvent) => void) {
        const listeners = this.listeners[eventName] || [];
        listeners.push(listener);
        this.listeners[eventName] = listeners;
      },
      dispatch(eventName: string, event: Partial<FakeMouseEvent> = {}) {
        const listeners = this.listeners[eventName] || [];
        const normalizedEvent: FakeMouseEvent = {
          defaultPrevented: event.defaultPrevented ?? false,
          button: event.button ?? 0,
          metaKey: event.metaKey ?? false,
          ctrlKey: event.ctrlKey ?? false,
          shiftKey: event.shiftKey ?? false,
          altKey: event.altKey ?? false,
          target: event.target ?? {
            closest: () => null,
          },
        };
        for (const listener of listeners) {
          listener(normalizedEvent);
        }
      },
    };
    return element;
  };

  return {
    createElement,
    defaultView: options.defaultView,
  };
}

function createCardShellRuntime(options: Partial<Record<string, unknown>> = {}) {
  if (typeof createCardShell !== 'function') {
    throw new Error('Card shell runtime was not initialized for test');
  }

  const {
    createCuratedCardBody: createCuratedCardBodyOption,
    getCuratedCardBodyRefs: getCuratedCardBodyRefsOption,
    documentRefOptions,
    ...restOptions
  } = options;
  const documentRef = createFakeDocument(documentRefOptions as {
    defaultView?: FakeDocument['defaultView'];
  });
  const locationAssign = vi.fn();
  const getSelection = vi.fn(() => ({ type: 'None' }));
  const cardBodyRefsByElement = new WeakMap<
    object,
    {
      descriptionElement: FakeElement;
    }
  >();

  const createCuratedCardActions = vi.fn(() => documentRef.createElement('div'));
  const createCuratedCardBody = vi.fn((entry: unknown, actions: unknown) => {
    const body =
      typeof createCuratedCardBodyOption === 'function'
        ? (createCuratedCardBodyOption as (entryValue: unknown, actionsValue: unknown) => FakeElement)(entry, actions)
        : documentRef.createElement('section');
    const description = body.children.find((child) => child.className === 'cw-curated-card__description') || null;
    if (description) {
      cardBodyRefsByElement.set(body, {
        descriptionElement: description,
      });
    }
    return body;
  });
  const getCuratedCardBodyRefs = vi.fn((value: unknown) => {
    if (typeof getCuratedCardBodyRefsOption === 'function') {
      return (getCuratedCardBodyRefsOption as (value: unknown) => unknown)(value);
    }
    if (!value || typeof value !== 'object') {
      return null;
    }
    return cardBodyRefsByElement.get(value as object) || null;
  });
  const patchCuratedCardBody = vi.fn();
  const installCuratedCardPreview = vi.fn();

  const runtime = createCardShell({
    documentRef,
    windowRef: {
      location: {
        assign: locationAssign,
      },
      getSelection,
    },
    getCardLayout: () => 'portrait',
    normalizeImageUrlCandidate: (value: unknown) => (typeof value === 'string' ? value.trim() : ''),
    resolveApiHref: (href: unknown) => (typeof href === 'string' ? href : ''),
    makeRatingBadge: () => documentRef.createElement('span'),
    createCuratedCardActions,
    createCuratedCardBody,
    getCuratedCardBodyRefs,
    patchCuratedCardBody,
    installCuratedCardPreview,
    ...restOptions,
  });

  return {
    runtime,
    locationAssign,
    getSelection,
    createCuratedCardActions,
    createCuratedCardBody,
    getCuratedCardBodyRefs,
    patchCuratedCardBody,
    installCuratedCardPreview,
    documentRef,
  };
}

describe('curated-card-shell ui module', () => {
  beforeEach(async () => {
    vi.resetModules();
    const cardShellModule = (await import(cardShellModuleUrl)) as {
      createCardShellRuntime: () => object;
    };
    createCardShell = (cardShellModule.createCardShellRuntime() as CardShellModule).createCardShell;
  });

  afterEach(() => {
    createCardShell = null;
  });

  it('selects cover images based on card layout with fallback', () => {
    const { runtime } = createCardShellRuntime();

    expect(
      runtime.getCardCoverImage({
        portraitImageUrl: 'portrait.jpg',
        landscapeImageUrl: 'landscape.jpg',
        imageUrl: 'fallback.jpg',
      }),
    ).toBe('portrait.jpg');

    expect(
      runtime.getCardCoverImage(
        {
          portraitImageUrl: 'portrait.jpg',
          landscapeImageUrl: 'landscape.jpg',
          imageUrl: 'fallback.jpg',
        },
        'landscape',
      ),
    ).toBe('landscape.jpg');

    expect(
      runtime.getCardCoverImage({
        portraitImageUrl: '',
        landscapeImageUrl: '',
        imageUrl: 'fallback.jpg',
      }),
    ).toBe('fallback.jpg');
  });

  it('builds curated cards and forwards preview/action/body wiring', () => {
    const { runtime, createCuratedCardActions, createCuratedCardBody, installCuratedCardPreview } =
      createCardShellRuntime();

    const card = runtime.createCuratedCard({
      seriesId: 'series-1',
      fixtureTitle: 'Fixture title',
      title: 'Series title',
      href: '/series/series-1',
      rating: 4.2,
      votes: 150,
      portraitImageUrl: 'portrait.jpg',
      hoverPreviewImageUrl: 'hover.jpg',
      dimNotWatchReady: true,
    });

    expect(card.className).toContain('cw-curated-card');
    expect(card.className).toContain('cw-curated-card--not-watch-ready');
    expect(card.dataset.cwSeriesId).toBe('series-1');
    expect(card.dataset.cwCuratedTitle).toBe('Fixture title');
    expect(card.children).toHaveLength(3);
    expect(card.children[1]?.className).toBe('cw-curated-card__media');
    expect(createCuratedCardActions).toHaveBeenCalledTimes(1);
    expect(createCuratedCardBody).toHaveBeenCalledTimes(1);
    expect(installCuratedCardPreview).toHaveBeenCalledTimes(1);
    expect(installCuratedCardPreview.mock.calls[0]?.[2]).toBe('portrait.jpg');
    expect(installCuratedCardPreview.mock.calls[0]?.[3]).toBe('hover.jpg');
  });

  it('routes thumbnail links to direct episode hrefs while preserving series-level card navigation', () => {
    const { runtime } = createCardShellRuntime();

    const card = runtime.createCuratedCard({
      seriesId: 'series-1',
      title: 'Series title',
      href: '/series/series-1',
      episodeHref: '/watch/series-1-episode-3',
      portraitImageUrl: 'portrait.jpg',
    });

    const media = card.children[1];
    const thumbLink = media?.children[0];
    expect(thumbLink?.href).toBe('/watch/series-1-episode-3');
  });

  it('moves description under the card thumbnail when available', () => {
    const { runtime, documentRef } = createCardShellRuntime({
      createCuratedCardBody: () => {
        const body = documentRef.createElement('section');
        const description = documentRef.createElement('div');
        description.className = 'cw-curated-card__description';
        body.appendChild(description);
        return body;
      },
    });

    const card = runtime.createCuratedCard({
      seriesId: 'series-1',
      title: 'Series title',
      href: '/series/series-1',
      portraitImageUrl: 'portrait.jpg',
    });

    const media = card.children[1];
    expect(media?.className).toBe('cw-curated-card__media');
    expect(media?.children[0]?.className).toContain('cw-curated-card__thumb');
    expect(media?.children[1]?.className).toBe('cw-curated-card__description');
  });

  it('renders a thumbnail progress bar for partial episode progress', () => {
    const { runtime } = createCardShellRuntime();

    const card = runtime.createCuratedCard({
      seriesId: 'series-progress',
      title: 'Series with progress',
      href: '/series/series-progress',
      portraitImageUrl: 'portrait.jpg',
      episodeWatchProgressRatio: 0.42,
    });

    const media = card.children[1];
    expect(media?.className).toBe('cw-curated-card__media');
    expect(media?.children[0]?.className).toContain('cw-curated-card__thumb');
    expect(media?.children[1]?.className).toBe('cw-curated-card__thumb-progress');
    expect(media?.children[1]?.children[0]?.className).toBe('cw-curated-card__thumb-progress-fill');
    expect(media?.children[1]?.children[0]?.style.width).toBe('42%');
  });

  it('delegates body-field patching to card-view patch helper instead of rebuilding body templates', () => {
    const { runtime, createCuratedCardBody, patchCuratedCardBody } = createCardShellRuntime();

    const card = runtime.createCuratedCard({
      seriesId: 'series-1',
      title: 'Series title',
      href: '/series/series-1',
      portraitImageUrl: 'portrait.jpg',
    });

    runtime.patchCuratedCard(card, {
      seriesId: 'series-1',
      title: 'Updated title',
      href: '/series/series-1',
      portraitImageUrl: 'portrait.jpg',
    });

    expect(createCuratedCardBody).toHaveBeenCalledTimes(1);
    expect(patchCuratedCardBody).toHaveBeenCalledTimes(1);
    expect(patchCuratedCardBody).toHaveBeenCalledWith(
      expect.objectContaining({
        tagName: 'section',
      }),
      expect.objectContaining({
        seriesId: 'series-1',
      }),
    );
  });

  it('refreshes preview wiring with latest image metadata when patching an existing card', () => {
    const { runtime, installCuratedCardPreview } = createCardShellRuntime();
    const card = runtime.createCuratedCard({
      seriesId: 'series-1',
      title: 'Series title',
      href: '/series/series-1',
      portraitImageUrl: 'portrait-initial.jpg',
      hoverPreviewImageUrl: 'hover-initial.jpg',
    });

    runtime.patchCuratedCard(card, {
      seriesId: 'series-1',
      title: 'Series title',
      href: '/series/series-1',
      portraitImageUrl: 'portrait-updated.jpg',
      hoverPreviewImageUrl: 'hover-updated.jpg',
    });

    expect(installCuratedCardPreview).toHaveBeenCalledTimes(2);
    expect(installCuratedCardPreview.mock.calls[1]?.[2]).toBe('portrait-updated.jpg');
    expect(installCuratedCardPreview.mock.calls[1]?.[3]).toBe('hover-updated.jpg');
  });

  it('patches favorite action button state in place when favorite flag changes', () => {
    const documentRef = createFakeDocument();
    let favoriteButtonRef: FakeElement | null = null;
    const { runtime } = createCardShellRuntime({
      documentRef,
      createCuratedCardActions: () => {
        const actions = documentRef.createElement('div');
        const favoriteButton = documentRef.createElement('button');
        favoriteButton.className = 'cw-card-action cw-card-action--favorite is-active';
        favoriteButton.textContent = '♥';
        favoriteButton.setAttribute('aria-label', 'Unfavorite');
        favoriteButton.setAttribute('aria-pressed', 'true');
        favoriteButton.title = 'Unfavorite';

        const removeButton = documentRef.createElement('button');
        removeButton.className = 'cw-card-action cw-card-action--remove';
        removeButton.textContent = '🗑';
        removeButton.setAttribute('aria-label', 'Remove from watchlist');

        actions.appendChild(favoriteButton);
        actions.appendChild(removeButton);
        favoriteButtonRef = favoriteButton;
        return actions;
      },
    });

    const card = runtime.createCuratedCard({
      seriesId: 'series-1',
      title: 'Series title',
      href: '/series/series-1',
      portraitImageUrl: 'portrait.jpg',
      isFavorite: true,
    });

    runtime.patchCuratedCard(card, {
      seriesId: 'series-1',
      title: 'Series title',
      href: '/series/series-1',
      portraitImageUrl: 'portrait.jpg',
      isFavorite: false,
    });

    if (!favoriteButtonRef) {
      throw new Error('missing favorite button test ref');
    }
    const favoriteButton = favoriteButtonRef as FakeElement;
    expect(favoriteButton.attributes['aria-pressed']).toBe('false');
    expect(favoriteButton.attributes['aria-label']).toBe('Favorite');
    expect(favoriteButton.title).toBe('Favorite');
    expect(favoriteButton.textContent).toBe('♡');
    expect(favoriteButton.className).not.toContain('is-active');
  });

  it('removes thumbnail loading state once the image reports load completion', () => {
    const { runtime } = createCardShellRuntime();

    const card = runtime.createCuratedCard({
      seriesId: 'series-loading',
      title: 'Series with loading thumb',
      href: '/series/series-loading',
      portraitImageUrl: 'portrait.jpg',
    });

    const media = card.children[1];
    const thumbLink = media?.children[0];
    const image = thumbLink?.children[1];

    expect(thumbLink?.className).toContain('cw-curated-card__thumb--loading');
    image?.dispatch('load');
    expect(thumbLink?.className).toContain('cw-curated-card__thumb--loaded');
    expect(thumbLink?.className).not.toContain('cw-curated-card__thumb--loading');
  });

  it('defers thumbnail src assignment until the thumb enters the viewport when IntersectionObserver is available', () => {
    let observerCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
    const { runtime } = createCardShellRuntime({
      documentRefOptions: {
        defaultView: {
          IntersectionObserver: class {
            constructor(
              callback: (entries: Array<{ isIntersecting: boolean }>) => void,
              _options?: unknown,
            ) {
              observerCallback = callback;
            }

            observe(_target: unknown): void {}

            disconnect(): void {}
          },
        },
      },
    });

    const card = runtime.createCuratedCard({
      seriesId: 'series-lazy',
      title: 'Series with lazy thumb',
      href: '/series/series-lazy',
      portraitImageUrl: 'portrait-lazy.jpg',
    });

    const media = card.children[1];
    const thumbLink = media?.children[0];
    const image = thumbLink?.children[1];

    expect(image?.src).toBe('');
    expect(thumbLink?.className).toContain('cw-curated-card__thumb--loading');

    const triggerObserver =
      observerCallback as ((entries: Array<{ isIntersecting: boolean }>) => void) | null;
    if (triggerObserver) {
      triggerObserver([{ isIntersecting: true }]);
    }

    expect(image?.src).toBe('portrait-lazy.jpg');
  });

  it('navigates only for safe card click events', () => {
    const { runtime, locationAssign, getSelection, documentRef } = createCardShellRuntime();
    const card = documentRef.createElement('article');

    runtime.attachCuratedCardNavigation(card, '/series/series-1');
    card.dispatch('click');
    expect(locationAssign).toHaveBeenCalledWith('/series/series-1');

    locationAssign.mockClear();
    card.dispatch('click', {
      target: {
        closest: () => ({}),
      },
    });
    expect(locationAssign).not.toHaveBeenCalled();

    locationAssign.mockClear();
    getSelection.mockReturnValue({ type: 'Range' });
    card.dispatch('click');
    expect(locationAssign).not.toHaveBeenCalled();
  });
});
