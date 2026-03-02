export type NativeActionType = 'favorite' | 'remove';

export type NativeCardMatch = {
  card: HTMLElement;
  seriesId: string;
  seriesLinks: HTMLAnchorElement[];
};

type BoundaryValue = CwBoundaryValue;
type BoundaryObject = Record<string, BoundaryValue>;
type SelectorQueryAllResult = Iterable<BoundaryValue> | ArrayLike<BoundaryValue>;
type SelectorRootBoundary = {
  querySelectorAll?: BoundaryValue;
  querySelector?: BoundaryValue;
};
type LinkBoundary = {
  href?: BoundaryValue;
};

type SelectorRootBase = {
  owner: object;
  querySelectorAll: (this: object, selector: string) => SelectorQueryAllResult;
};

type SelectorRootWithQuerySelector = SelectorRootBase & {
  querySelector: (this: object, selector: string) => BoundaryValue;
};

type SelectorRoot = SelectorRootBase | SelectorRootWithQuerySelector;

export type NativeCardSelectorAdapterRuntime = {
  findNativeCards: (documentRef: Document) => HTMLElement[];
  findSeriesLinks: (card: HTMLElement) => HTMLAnchorElement[];
  findNativeCardMatches: (documentRef: Document) => NativeCardMatch[];
  findNativeActionButton: (card: HTMLElement, actionType: NativeActionType) => HTMLElement | null;
  findPreviewNodes: (card: HTMLElement) => HTMLElement[];
};

export type NativeCardSelectorAdapterOptions = {
  watchlistCardSelector?: BoundaryValue;
  seriesLinkSelector?: BoundaryValue;
  previewNodeSelectors?: BoundaryValue;
  favoriteActionSelectors?: BoundaryValue;
  removeActionSelectors?: BoundaryValue;
};

const defaultWatchlistCardSelector = '[data-t="watch-list-card"]';
const defaultSeriesLinkSelector = 'a[href*="/series/"]';
const defaultFavoriteActionSelectors = [
  '[data-cw-native-action="favorite"]',
  'button[aria-label*="favorite" i]',
  '[role="button"][aria-label*="favorite" i]',
  '[data-t*="favorite" i]',
  'button[class*="favorite" i]',
  'button[class*="heart" i]',
];
const defaultRemoveActionSelectors = [
  '[data-cw-native-action="remove"]',
  'button[aria-label*="remove" i]',
  '[role="button"][aria-label*="remove" i]',
  'button[aria-label*="trash" i]',
  '[role="button"][aria-label*="trash" i]',
  'button[aria-label*="delete" i]',
  '[role="button"][aria-label*="delete" i]',
  '[data-t*="remove" i]',
  'button[class*="remove" i]',
  'button[class*="trash" i]',
  'button[class*="delete" i]',
];
const defaultPreviewNodeSelectors = [
  'video',
  'img',
  'picture img',
  '[data-t*="preview"]',
  '[class*="preview"]',
  '[class*="thumbnail"]',
  '[class*="poster"]',
  '[class*="image"]',
];

function getStringArray(value: BoundaryValue, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  if (!normalized.length) {
    return [...fallback];
  }

  return normalized;
}

function getString(value: BoundaryValue, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function asBoundaryObject(value: BoundaryValue): BoundaryObject | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as BoundaryObject;
}

function asSelectorRoot(value: BoundaryValue): SelectorRoot | null {
  const boundaryObject = asBoundaryObject(value);
  if (!boundaryObject) {
    return null;
  }

  const querySelectorAll = (boundaryObject as SelectorRootBoundary).querySelectorAll;
  if (typeof querySelectorAll !== 'function') {
    return null;
  }

  const querySelector = (boundaryObject as SelectorRootBoundary).querySelector;
  return typeof querySelector === 'function'
    ? {
        owner: boundaryObject,
        querySelectorAll: querySelectorAll as SelectorRootBase['querySelectorAll'],
        querySelector: querySelector as SelectorRootWithQuerySelector['querySelector'],
      }
    : {
        owner: boundaryObject,
        querySelectorAll: querySelectorAll as SelectorRootBase['querySelectorAll'],
      };
}

function isElementBoundaryCandidate(candidate: BoundaryValue): candidate is Element {
  return Boolean(candidate && typeof candidate === 'object');
}

function queryAll(rootNode: SelectorRoot | null, selector: string): Element[] {
  if (!rootNode) {
    return [];
  }

  try {
    const queryResult = rootNode.querySelectorAll.call(rootNode.owner, selector);
    return Array.from(queryResult).filter(isElementBoundaryCandidate);
  } catch {
    return [];
  }
}

function queryFirst(rootNode: SelectorRoot | null, selector: string): Element | null {
  if (!rootNode || !('querySelector' in rootNode) || typeof rootNode.querySelector !== 'function') {
    return null;
  }

  try {
    const candidate = rootNode.querySelector.call(rootNode.owner, selector);
    return isElementBoundaryCandidate(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function toElementArray<T extends Element>(candidates: Element[]): T[] {
  return candidates.filter((candidate): candidate is T => isElementBoundaryCandidate(candidate));
}

function readLinkHref(link: HTMLAnchorElement): string {
  const hrefAttribute = typeof link.getAttribute === 'function' ? link.getAttribute('href') : '';
  if (typeof hrefAttribute === 'string' && hrefAttribute.trim()) {
    return hrefAttribute;
  }

  const hrefProperty = (link as LinkBoundary).href;
  return typeof hrefProperty === 'string' ? hrefProperty : '';
}

function extractSeriesIdFromHref(href: string): string | null {
  const match = href.match(/\/series\/([^/?#]+)/i);
  if (!match || !match[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function findSeriesLinksForCard(card: HTMLElement, seriesLinkSelector: string): HTMLAnchorElement[] {
  return toElementArray<HTMLAnchorElement>(queryAll(asSelectorRoot(card), seriesLinkSelector));
}

function findNativeCardsForDocument(documentRef: Document, watchlistCardSelector: string): HTMLElement[] {
  return toElementArray<HTMLElement>(queryAll(asSelectorRoot(documentRef), watchlistCardSelector));
}

function findNativeCardMatchesForDocument(
  documentRef: Document,
  watchlistCardSelector: string,
  seriesLinkSelector: string,
): NativeCardMatch[] {
  const cards = findNativeCardsForDocument(documentRef, watchlistCardSelector);
  const matches: NativeCardMatch[] = [];
  for (const card of cards) {
    const seriesLinks = findSeriesLinksForCard(card, seriesLinkSelector);
    for (const seriesLink of seriesLinks) {
      const seriesId = extractSeriesIdFromHref(readLinkHref(seriesLink));
      if (seriesId) {
        matches.push({
          card,
          seriesId,
          seriesLinks,
        });
        break;
      }
    }
  }

  return matches;
}

export function createNativeCardSelectorAdapterRuntime(
  options: NativeCardSelectorAdapterOptions = {},
): NativeCardSelectorAdapterRuntime {
  const watchlistCardSelector = getString(options.watchlistCardSelector, defaultWatchlistCardSelector);
  const seriesLinkSelector = getString(options.seriesLinkSelector, defaultSeriesLinkSelector);
  const favoriteActionSelectors = getStringArray(options.favoriteActionSelectors, defaultFavoriteActionSelectors);
  const removeActionSelectors = getStringArray(options.removeActionSelectors, defaultRemoveActionSelectors);
  const previewNodeSelectors = getStringArray(options.previewNodeSelectors, defaultPreviewNodeSelectors);

  return {
    findNativeCards: (documentRef: Document) => findNativeCardsForDocument(documentRef, watchlistCardSelector),
    findSeriesLinks: (card: HTMLElement) => findSeriesLinksForCard(card, seriesLinkSelector),
    findNativeCardMatches: (documentRef: Document) =>
      findNativeCardMatchesForDocument(documentRef, watchlistCardSelector, seriesLinkSelector),
    findNativeActionButton: (card: HTMLElement, actionType: NativeActionType) => {
      const selectors = actionType === 'favorite' ? favoriteActionSelectors : removeActionSelectors;

      for (const selector of selectors) {
        const match = queryFirst(asSelectorRoot(card), selector);
        if (match) {
          return match as HTMLElement;
        }
      }

      return null;
    },
    findPreviewNodes: (card: HTMLElement) => {
      const selector = previewNodeSelectors.join(', ');
      return toElementArray<HTMLElement>(queryAll(asSelectorRoot(card), selector));
    },
  };
}
