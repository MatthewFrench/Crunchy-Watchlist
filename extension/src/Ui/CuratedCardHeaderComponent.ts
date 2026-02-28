type RuntimeModuleRegistry = Record<string, unknown>;

type RuntimeGlobal = typeof globalThis & {
  __CW_WATCHLIST_CURATOR_MODULES__?: RuntimeModuleRegistry;
};

export type CuratedCardHeaderEntry = {
  title?: string | null;
  href?: string | null;
  rating?: number | null;
  votes?: number | null;
} & Record<string, unknown>;

export type CuratedCardHeaderRefs = {
  header: HTMLElement;
  titleLink: HTMLAnchorElement;
  ratingBadge: HTMLElement;
};

export type CuratedCardHeaderComponent = {
  root: HTMLElement;
  refs: CuratedCardHeaderRefs;
  patch: (entry: CuratedCardHeaderEntry) => void;
};

export type CuratedCardHeaderComponentOptions = {
  documentRef?: Document;
  makeRatingBadge?: (rating: unknown, votes: unknown) => HTMLElement;
  entry?: CuratedCardHeaderEntry;
};

function requireFunction<T>(name: string, value: T | undefined): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing card header component dependency: ${name}`);
  }

  return value;
}

function requireDocumentRef(value: Document | undefined): Document {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing card header component dependency: documentRef');
  }
  if (typeof value.createElement !== 'function') {
    throw new Error('[CW] Missing card header component dependency: documentRef.createElement');
  }
  return value;
}

function toEntry(value: CuratedCardHeaderEntry | unknown): CuratedCardHeaderEntry {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as CuratedCardHeaderEntry;
}

function getEntryString(entry: CuratedCardHeaderEntry, key: keyof CuratedCardHeaderEntry): string {
  const value = entry[key];
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }

  return String(value);
}

function setElementTextContent(element: Element, nextValue: string): void {
  if (element.textContent === nextValue) {
    return;
  }
  element.textContent = nextValue;
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

function setClassToken(target: { className?: string }, token: string, enabled: boolean): void {
  target.className = toggleClassToken(target.className || '', token, enabled);
}

function setDatasetValue(target: HTMLElement, datasetKey: string, nextValue: string): void {
  if (target.dataset[datasetKey] !== nextValue) {
    target.dataset[datasetKey] = nextValue;
  }
}

function removeDatasetValue(target: HTMLElement, datasetKey: string): void {
  if (Object.hasOwn(target.dataset, datasetKey)) {
    delete target.dataset[datasetKey];
  }
}

class CuratedCardHeaderController {
  readonly refs: CuratedCardHeaderRefs;

  constructor(
    private readonly documentRef: Document,
    private readonly makeRatingBadge: (rating: unknown, votes: unknown) => HTMLElement,
    initialEntry: CuratedCardHeaderEntry | unknown,
  ) {
    const titleLink = this.documentRef.createElement('a');
    titleLink.className = 'cw-curated-card__title';

    const ratingBadge = this.makeRatingBadge(null, null);
    setClassToken(ratingBadge, 'cw-rating-badge--headline', true);

    const header = this.documentRef.createElement('div');
    header.className = 'cw-curated-card__header';
    header.appendChild(titleLink);
    header.appendChild(ratingBadge);

    this.refs = {
      header,
      titleLink,
      ratingBadge,
    };

    this.patchEntry(initialEntry);
  }

  patchEntry(entryValue: CuratedCardHeaderEntry | unknown): void {
    const entry = toEntry(entryValue);
    const title = getEntryString(entry, 'title');
    setElementTextContent(this.refs.titleLink, title);

    const titleHref = getEntryString(entry, 'href') || '#';
    if (this.refs.titleLink.href !== titleHref) {
      this.refs.titleLink.href = titleHref;
    }

    const nextBadge = this.makeRatingBadge(entry.rating, entry.votes);
    setClassToken(nextBadge, 'cw-rating-badge--headline', true);

    const currentBadge = this.refs.ratingBadge;
    currentBadge.className = nextBadge.className || 'cw-rating-badge cw-rating-badge--headline';
    setElementTextContent(currentBadge, nextBadge.textContent || '');

    const nextBadgeTitle = nextBadge.title || '';
    if (currentBadge.title !== nextBadgeTitle) {
      currentBadge.title = nextBadgeTitle;
    }

    const nextRatingState = nextBadge.dataset.cwRatingState;
    if (typeof nextRatingState === 'string') {
      setDatasetValue(currentBadge, 'cwRatingState', nextRatingState);
    } else {
      removeDatasetValue(currentBadge, 'cwRatingState');
    }
  }
}

export function createCuratedCardHeaderComponent(
  options: CuratedCardHeaderComponentOptions = {},
): CuratedCardHeaderComponent {
  const documentRef = requireDocumentRef(options.documentRef);
  const makeRatingBadge = requireFunction('makeRatingBadge', options.makeRatingBadge);
  const controller = new CuratedCardHeaderController(documentRef, makeRatingBadge, options.entry);

  return {
    root: controller.refs.header,
    refs: controller.refs,
    patch: (entry: CuratedCardHeaderEntry) => {
      controller.patchEntry(entry);
    },
  };
}

function registerCardHeaderComponentRuntime(): void {
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

  (uiRegistry as Record<string, unknown>).cardHeaderComponent = {
    createCuratedCardHeaderComponent,
  };
}

registerCardHeaderComponentRuntime();
