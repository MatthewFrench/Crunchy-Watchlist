type RuntimeModuleRegistry = Record<string, unknown>;

type RuntimeGlobal = typeof globalThis & {
  __CW_WATCHLIST_CURATOR_MODULES__?: RuntimeModuleRegistry;
};

type NativeActionType = 'favorite' | 'remove';

export type NativeCardSelectorAdapterRuntime = {
  findNativeCards: (documentRef: unknown) => HTMLElement[];
  findSeriesLinks: (card: unknown) => HTMLAnchorElement[];
  findNativeActionButton: (card: unknown, actionType: unknown) => HTMLElement | null;
  findPreviewNodes: (card: unknown) => HTMLElement[];
};

export type NativeCardSelectorAdapterOptions = {
  watchlistCardSelector?: unknown;
  seriesLinkSelector?: unknown;
  previewNodeSelectors?: unknown;
  favoriteActionSelectors?: unknown;
  removeActionSelectors?: unknown;
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

function getStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  if (!normalized.length) {
    return [...fallback];
  }

  return normalized;
}

function getString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return normalized || fallback;
}

function queryAll(rootNode: unknown, selector: string): Element[] {
  if (!rootNode || typeof rootNode !== 'object') {
    return [];
  }

  const querySelectorAll = (rootNode as { querySelectorAll?: unknown }).querySelectorAll;
  if (typeof querySelectorAll !== 'function') {
    return [];
  }

  try {
    return Array.from((querySelectorAll as (selectorValue: string) => unknown[]).call(rootNode, selector)).filter(
      (candidate): candidate is Element => Boolean(candidate && typeof candidate === 'object'),
    );
  } catch {
    return [];
  }
}

function queryFirst(rootNode: unknown, selector: string): Element | null {
  if (!rootNode || typeof rootNode !== 'object') {
    return null;
  }

  const querySelector = (rootNode as { querySelector?: unknown }).querySelector;
  if (typeof querySelector !== 'function') {
    return null;
  }

  try {
    const candidate = (querySelector as (selectorValue: string) => unknown).call(rootNode, selector);
    return candidate && typeof candidate === 'object' ? (candidate as Element) : null;
  } catch {
    return null;
  }
}

function toElementArray<T extends Element>(candidates: Element[]): T[] {
  return candidates.filter((candidate): candidate is T => Boolean(candidate && typeof candidate === 'object'));
}

function toActionType(value: unknown): NativeActionType {
  return value === 'favorite' ? 'favorite' : 'remove';
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
    findNativeCards: (documentRef: unknown) =>
      toElementArray<HTMLElement>(queryAll(documentRef, watchlistCardSelector)),
    findSeriesLinks: (card: unknown) => toElementArray<HTMLAnchorElement>(queryAll(card, seriesLinkSelector)),
    findNativeActionButton: (card: unknown, actionTypeValue: unknown) => {
      const actionType = toActionType(actionTypeValue);
      const selectors = actionType === 'favorite' ? favoriteActionSelectors : removeActionSelectors;

      for (const selector of selectors) {
        const match = queryFirst(card, selector);
        if (match) {
          return match as HTMLElement;
        }
      }

      return null;
    },
    findPreviewNodes: (card: unknown) => {
      const selector = previewNodeSelectors.join(', ');
      return toElementArray<HTMLElement>(queryAll(card, selector));
    },
  };
}

function registerNativeCardSelectorAdapterRuntime(): void {
  const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeGlobal;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }

  root.__CW_WATCHLIST_CURATOR_MODULES__.runtimeNativeCardSelectorAdapter = {
    createNativeCardSelectorAdapterRuntime,
  };
}

registerNativeCardSelectorAdapterRuntime();
