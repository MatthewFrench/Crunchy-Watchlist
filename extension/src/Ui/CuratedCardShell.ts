import {
  type CuratedCardActionEntry,
  type CuratedCardActionsComponent,
  createCuratedCardActionsComponent,
} from './CuratedCardActionsComponent.js';
import { type CuratedCardHeaderComponent, createCuratedCardHeaderComponent } from './CuratedCardHeaderComponent.js';
import { type CuratedCardMediaComponent, createCuratedCardMediaComponent } from './CuratedCardMediaComponent.js';
import {
  type CuratedCardMetadataComponent,
  createCuratedCardMetadataComponent,
} from './CuratedCardMetadataComponent.js';
import { createCuratedCardProgressComponent } from './CuratedCardProgressComponent.js';

type RuntimeModuleRegistry = Record<string, unknown>;

type RuntimeGlobal = typeof globalThis & {
  __CW_WATCHLIST_CURATOR_MODULES__?: RuntimeModuleRegistry;
};

type AnyFn = (...args: never[]) => unknown;

type CardBodyRefs = CwCuratedCardBodyRefs;

export type CuratedCardLayout = 'portrait' | 'landscape';

export type CuratedCardEntry = {
  seriesId?: string | number | null;
  fixtureTitle?: string | null;
  title?: string | null;
  href?: string | null;
  episodeHref?: string | null;
  dimNotWatchReady?: boolean | null;
  portraitImageUrl?: string | null;
  landscapeImageUrl?: string | null;
  imageUrl?: string | null;
  hoverPreviewImageUrl?: string | null;
  isFavorite?: boolean | null;
  rating?: number | null;
  votes?: number | null;
} & Record<string, unknown>;

export type CuratedCardThumbResult = {
  thumbLink: HTMLAnchorElement;
  coverImageUrl: string;
  hoverPreviewImageUrl: string;
  thumbImage: HTMLImageElement | null;
  placeholder: HTMLElement | null;
  progressRefs: {
    progress: HTMLElement;
    fill: HTMLElement;
  } | null;
  progressBar: HTMLElement | null;
};

export type CuratedCardShellRuntime = {
  getCardCoverImage: (entry: CuratedCardEntry, layout?: unknown) => string;
  attachCuratedCardNavigation: (item: HTMLElement, cardHref: string) => void;
  createCuratedCardHeader: (entry: CuratedCardEntry) => HTMLElement;
  createCuratedCardThumb: (entry: CuratedCardEntry) => CuratedCardThumbResult;
  createCuratedCard: (entry: CuratedCardEntry) => HTMLElement;
  patchCuratedCard: (card: unknown, entry: CuratedCardEntry) => void;
};

export type CardShellDeps = {
  documentRef?: Document;
  windowRef?: Window & typeof globalThis;
  getCardLayout?: () => CuratedCardLayout | unknown;
  normalizeImageUrlCandidate?: (value: unknown) => string;
  resolveApiHref?: (href: unknown) => string;
  makeRatingBadge?: (rating: unknown, votes: unknown) => HTMLElement;
  createCuratedCardActions?: (entry: CuratedCardEntry) => CwCuratedActionsElement;
  createCuratedCardBody?: (entry: CuratedCardEntry, actions: CwCuratedActionsElement) => HTMLElement;
  getCuratedCardBodyRefs?: (value: unknown) => CardBodyRefs | null;
  patchCuratedCardBody?: (card: Element, entry: CuratedCardEntry) => void;
  installCuratedCardPreview?: (
    thumbLink: HTMLAnchorElement,
    entry: CuratedCardEntry,
    coverImageUrl: string,
    hoverPreviewImageUrl: string,
    thumbImage: HTMLImageElement | null,
  ) => void;
};

type CuratedCardShellRefs = CwCuratedCardShellRefs;

type CardShellController = {
  refs: CuratedCardShellRefs;
  headerComponent: CuratedCardHeaderComponent;
  mediaComponent: CuratedCardMediaComponent;
  actionsComponent: CuratedCardActionsComponent;
  metadataComponent: CuratedCardMetadataComponent;
};

type CardShellContext = {
  documentRef: Document;
  windowRef: Window & typeof globalThis;
  getCardLayout: () => unknown;
  normalizeImageUrlCandidate: (value: unknown) => string;
  resolveApiHref: (href: unknown) => string;
  makeRatingBadge: (rating: unknown, votes: unknown) => HTMLElement;
  createCuratedCardActions: (entry: CuratedCardEntry) => CwCuratedActionsElement;
  createCuratedCardBody: (entry: CuratedCardEntry, actions: CwCuratedActionsElement) => HTMLElement;
  getCuratedCardBodyRefs: (value: unknown) => CardBodyRefs | null;
  patchCuratedCardBody: (card: Element, entry: CuratedCardEntry) => void;
  installCuratedCardPreview: (
    thumbLink: HTMLAnchorElement,
    entry: CuratedCardEntry,
    coverImageUrl: string,
    hoverPreviewImageUrl: string,
    thumbImage: HTMLImageElement | null,
  ) => void;
};

type MinimalEventTarget = {
  closest?: (selector: string) => Element | null;
};

const cardShellControllersByElement = new WeakMap<Element, CardShellController>();

function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing card shell dependency: ${name}`);
  }

  return value as T;
}

function requireDocumentRef(value: Document | undefined): Document {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing card shell dependency: documentRef');
  }

  if (typeof value.createElement !== 'function') {
    throw new Error('[CW] Missing card shell dependency: documentRef.createElement');
  }

  return value;
}

function requireWindowRef(value: (Window & typeof globalThis) | undefined): Window & typeof globalThis {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing card shell dependency: windowRef');
  }

  if (!value.location || typeof value.location.assign !== 'function') {
    throw new Error('[CW] Missing card shell dependency: windowRef.location.assign');
  }

  return value;
}

function toEntry(value: CuratedCardEntry | unknown): CuratedCardEntry {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as CuratedCardEntry;
}

function getEntryString(entry: CuratedCardEntry, key: keyof CuratedCardEntry): string {
  const value = entry[key];
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }

  return String(value);
}

function normalizeCardLayout(value: unknown): CuratedCardLayout {
  return value === 'landscape' ? 'landscape' : 'portrait';
}

function toggleClassToken(className: string, token: string, enabled: boolean): string {
  const tokens = className
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);
  const hasToken = tokens.includes(token);
  if (enabled && !hasToken) {
    tokens.push(token);
  }
  if (!enabled && hasToken) {
    return tokens.filter((item) => item !== token).join(' ');
  }

  return tokens.join(' ');
}

function setClassToken(element: { className?: string }, token: string, enabled: boolean): void {
  element.className = toggleClassToken(element.className || '', token, enabled);
}

function setElementDatasetValue(element: Element, datasetKey: string, nextValue: string): void {
  const target = element as Element & {
    dataset?: Record<string, string>;
    setAttribute?: (name: string, value: string) => void;
  };

  if (target.dataset && typeof target.dataset === 'object') {
    if (target.dataset[datasetKey] !== nextValue) {
      target.dataset[datasetKey] = nextValue;
    }
    return;
  }

  if (typeof target.setAttribute === 'function') {
    const dashedKey = datasetKey.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
    target.setAttribute(`data-${dashedKey}`, nextValue);
  }
}

function removeElementDatasetValue(element: Element, datasetKey: string): void {
  const target = element as Element & {
    dataset?: Record<string, string>;
    removeAttribute?: (name: string) => void;
  };

  if (target.dataset && typeof target.dataset === 'object' && Object.hasOwn(target.dataset, datasetKey)) {
    delete target.dataset[datasetKey];
    return;
  }

  if (typeof target.removeAttribute === 'function') {
    const dashedKey = datasetKey.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
    target.removeAttribute(`data-${dashedKey}`);
  }
}

function getCardCoverImageInternal(
  context: CardShellContext,
  entry: CuratedCardEntry,
  layout = normalizeCardLayout(context.getCardLayout()),
): string {
  const portrait = context.normalizeImageUrlCandidate(entry.portraitImageUrl);
  const landscape = context.normalizeImageUrlCandidate(entry.landscapeImageUrl);
  const fallback = context.normalizeImageUrlCandidate(entry.imageUrl);

  if (layout === 'landscape') {
    return landscape || portrait || fallback;
  }

  return portrait || landscape || fallback;
}

function resolveCardThumbHref(context: CardShellContext, entry: CuratedCardEntry): string {
  const directEpisodeHref = context.resolveApiHref(getEntryString(entry, 'episodeHref') || '');
  if (directEpisodeHref) {
    return directEpisodeHref;
  }

  const cardHref = context.resolveApiHref(getEntryString(entry, 'href') || '');
  return cardHref || '#';
}

function attachCuratedCardNavigationInternal(context: CardShellContext, item: HTMLElement, cardHref: string): void {
  if (!cardHref) {
    return;
  }

  item.classList.add('cw-curated-card--clickable');
  item.dataset.cwCardHref = cardHref;
  if (item.dataset.cwCardNavigationBound === 'true') {
    return;
  }
  item.dataset.cwCardNavigationBound = 'true';
  item.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target as MinimalEventTarget | null;
    if (!target || typeof target.closest !== 'function') {
      return;
    }
    if (target.closest("a, button, input, select, textarea, label, [role='button']")) {
      return;
    }

    const selection = context.windowRef.getSelection?.();
    if (selection?.type === 'Range') {
      return;
    }

    const nextHref = item.dataset.cwCardHref || cardHref;
    if (!nextHref) {
      return;
    }
    context.windowRef.location.assign(nextHref);
  });
}

function syncShellRefs(controller: CardShellController): void {
  const refs = controller.refs;
  refs.header = controller.headerComponent.refs.header;
  refs.titleLink = controller.headerComponent.refs.titleLink;
  refs.ratingBadge = controller.headerComponent.refs.ratingBadge;

  refs.media = controller.mediaComponent.refs.media;
  refs.thumbLink = controller.mediaComponent.refs.thumbLink;
  refs.thumbImage = controller.mediaComponent.refs.thumbImage;
  refs.thumbPlaceholder = controller.mediaComponent.refs.thumbPlaceholder;
  refs.thumbProgress = controller.mediaComponent.refs.thumbProgress;
  refs.thumbProgressFill = controller.mediaComponent.refs.thumbProgressFill;

  refs.body = controller.metadataComponent.refs.body;
  refs.bodyRefs = controller.metadataComponent.refs.bodyRefs;

  refs.actions = controller.actionsComponent.refs.actions;
  refs.actionRefs = controller.actionsComponent.refs.actionRefs;
}

function createCardShellContext(deps: CardShellDeps = {}): CardShellContext {
  return {
    documentRef: requireDocumentRef(deps.documentRef),
    windowRef: requireWindowRef(deps.windowRef),
    getCardLayout: requireFunction('getCardLayout', deps.getCardLayout),
    normalizeImageUrlCandidate: requireFunction('normalizeImageUrlCandidate', deps.normalizeImageUrlCandidate),
    resolveApiHref: requireFunction('resolveApiHref', deps.resolveApiHref),
    makeRatingBadge: requireFunction('makeRatingBadge', deps.makeRatingBadge),
    createCuratedCardActions: requireFunction('createCuratedCardActions', deps.createCuratedCardActions),
    createCuratedCardBody: requireFunction('createCuratedCardBody', deps.createCuratedCardBody),
    getCuratedCardBodyRefs: requireFunction('getCuratedCardBodyRefs', deps.getCuratedCardBodyRefs),
    patchCuratedCardBody: requireFunction('patchCuratedCardBody', deps.patchCuratedCardBody),
    installCuratedCardPreview: requireFunction('installCuratedCardPreview', deps.installCuratedCardPreview),
  };
}

function createCuratedCardInternal(context: CardShellContext, inputEntry: CuratedCardEntry | unknown): HTMLElement {
  const entry = toEntry(inputEntry);

  const card = context.documentRef.createElement('article');
  card.className = 'cw-curated-card';
  card.dataset.cwSeriesId = getEntryString(entry, 'seriesId');
  card.dataset.cwCuratedTitle = getEntryString(entry, 'fixtureTitle') || getEntryString(entry, 'title');

  if (entry.dimNotWatchReady) {
    card.classList.add('cw-curated-card--not-watch-ready');
  }

  const cardHref = context.resolveApiHref(getEntryString(entry, 'href') || '');
  attachCuratedCardNavigationInternal(context, card, cardHref);

  const actionsRoot = context.createCuratedCardActions(entry);
  const actionsComponent = createCuratedCardActionsComponent({
    actionsRoot,
    entry: entry as CuratedCardActionEntry,
  });
  const metadataComponent = createCuratedCardMetadataComponent({
    entry,
    actionsRoot,
    createCuratedCardBody: context.createCuratedCardBody,
    getCuratedCardBodyRefs: context.getCuratedCardBodyRefs,
    patchCuratedCardBody: context.patchCuratedCardBody,
  });
  const headerComponent = createCuratedCardHeaderComponent({
    documentRef: context.documentRef,
    makeRatingBadge: context.makeRatingBadge,
    entry,
  });
  const mediaComponent = createCuratedCardMediaComponent({
    documentRef: context.documentRef,
    entry,
    resolveCardThumbHref: (entryValue: CuratedCardEntry) => resolveCardThumbHref(context, toEntry(entryValue)),
    getCardCoverImage: (entryValue: CuratedCardEntry) => getCardCoverImageInternal(context, toEntry(entryValue)),
    normalizeImageUrlCandidate: context.normalizeImageUrlCandidate,
    installCuratedCardPreview: context.installCuratedCardPreview,
    createCuratedCardProgressComponent,
  });

  metadataComponent.moveDescriptionInto(mediaComponent.root);

  card.appendChild(headerComponent.root);
  card.appendChild(mediaComponent.root);
  card.appendChild(metadataComponent.root);

  const refs: CuratedCardShellRefs = {
    card,
    header: headerComponent.refs.header,
    titleLink: headerComponent.refs.titleLink,
    ratingBadge: headerComponent.refs.ratingBadge,
    media: mediaComponent.refs.media,
    thumbLink: mediaComponent.refs.thumbLink,
    thumbImage: mediaComponent.refs.thumbImage,
    thumbPlaceholder: mediaComponent.refs.thumbPlaceholder,
    thumbProgress: mediaComponent.refs.thumbProgress,
    thumbProgressFill: mediaComponent.refs.thumbProgressFill,
    body: metadataComponent.refs.body,
    bodyRefs: metadataComponent.refs.bodyRefs,
    actions: actionsComponent.refs.actions,
    actionRefs: actionsComponent.refs.actionRefs,
  };

  const controller: CardShellController = {
    refs,
    headerComponent,
    mediaComponent,
    actionsComponent,
    metadataComponent,
  };
  cardShellControllersByElement.set(card, controller);
  syncShellRefs(controller);

  return card;
}

function patchCuratedCardInternal(context: CardShellContext, cardValue: unknown, entryValue: CuratedCardEntry): void {
  const card = cardValue && typeof cardValue === 'object' ? (cardValue as Element) : null;
  if (!card) {
    return;
  }

  const controller = cardShellControllersByElement.get(card);
  if (!controller) {
    return;
  }

  const entry = toEntry(entryValue);
  const seriesId = getEntryString(entry, 'seriesId');
  const curatedTitle = getEntryString(entry, 'fixtureTitle') || getEntryString(entry, 'title');
  setElementDatasetValue(card, 'cwSeriesId', seriesId);
  setElementDatasetValue(card, 'cwCuratedTitle', curatedTitle);

  const cardHref = context.resolveApiHref(getEntryString(entry, 'href') || '');
  if (cardHref) {
    setElementDatasetValue(card, 'cwCardHref', cardHref);
  } else {
    removeElementDatasetValue(card, 'cwCardHref');
  }
  setClassToken(card as Element & { className?: string }, 'cw-curated-card--clickable', Boolean(cardHref));
  setClassToken(
    card as Element & { className?: string },
    'cw-curated-card--not-watch-ready',
    Boolean(entry.dimNotWatchReady),
  );

  controller.headerComponent.patch(entry);
  controller.mediaComponent.patch(entry);
  controller.metadataComponent.patch(entry);
  controller.actionsComponent.patch(entry as CuratedCardActionEntry);
  syncShellRefs(controller);
}

export function createCardShell(deps: CardShellDeps = {}): CuratedCardShellRuntime {
  const context = createCardShellContext(deps);
  return {
    getCardCoverImage: (entry: CuratedCardEntry, layout: unknown = context.getCardLayout()) =>
      getCardCoverImageInternal(context, toEntry(entry), normalizeCardLayout(layout)),
    attachCuratedCardNavigation: (item: HTMLElement, cardHref: string) =>
      attachCuratedCardNavigationInternal(context, item, cardHref),
    createCuratedCardHeader: (entry: CuratedCardEntry) =>
      createCuratedCardHeaderComponent({
        documentRef: context.documentRef,
        makeRatingBadge: context.makeRatingBadge,
        entry,
      }).root,
    createCuratedCardThumb: (entry: CuratedCardEntry) => {
      const nextEntry = toEntry(entry);
      const mediaComponent = createCuratedCardMediaComponent({
        documentRef: context.documentRef,
        entry: nextEntry,
        resolveCardThumbHref: (entryValue: CuratedCardEntry) => resolveCardThumbHref(context, toEntry(entryValue)),
        getCardCoverImage: (entryValue: CuratedCardEntry) => getCardCoverImageInternal(context, toEntry(entryValue)),
        normalizeImageUrlCandidate: context.normalizeImageUrlCandidate,
        installCuratedCardPreview: context.installCuratedCardPreview,
        createCuratedCardProgressComponent,
      });
      const coverImageUrl = getCardCoverImageInternal(context, nextEntry);
      const hoverPreviewImageUrl = context.normalizeImageUrlCandidate(nextEntry.hoverPreviewImageUrl);

      return {
        thumbLink: mediaComponent.refs.thumbLink,
        coverImageUrl,
        hoverPreviewImageUrl,
        thumbImage: mediaComponent.refs.thumbImage,
        placeholder: mediaComponent.refs.thumbPlaceholder,
        progressRefs:
          mediaComponent.refs.thumbProgress && mediaComponent.refs.thumbProgressFill
            ? {
                progress: mediaComponent.refs.thumbProgress,
                fill: mediaComponent.refs.thumbProgressFill,
              }
            : null,
        progressBar: mediaComponent.refs.thumbProgress,
      };
    },
    createCuratedCard: (entry: CuratedCardEntry) => createCuratedCardInternal(context, entry),
    patchCuratedCard: (card: unknown, entry: CuratedCardEntry) => patchCuratedCardInternal(context, card, entry),
  };
}

function registerCardShellRuntime(): void {
  const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeGlobal;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }

  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__;
  let uiRegistry = moduleRegistry.ui;
  if (!uiRegistry || typeof uiRegistry !== 'object') {
    uiRegistry = {};
    moduleRegistry.ui = uiRegistry;
  }

  (uiRegistry as Record<string, unknown>).cardShell = {
    createCardShell,
  };
}

registerCardShellRuntime();
