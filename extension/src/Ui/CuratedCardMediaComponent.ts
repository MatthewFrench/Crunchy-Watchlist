import {
  type CuratedCardProgressComponent,
  createCuratedCardProgressComponent,
} from './CuratedCardProgressComponent.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

export type CuratedCardMediaEntry = {
  seriesId?: string | number | null;
  title?: string | null;
  hoverPreviewImageUrl?: string | null;
  episodeWatchProgressRatio?: number | null;
} & BoundaryRecord;

export type CuratedCardMediaComponentRefs = {
  media: HTMLElement;
  thumbLink: HTMLAnchorElement;
  thumbImage: HTMLImageElement | null;
  thumbPlaceholder: HTMLElement | null;
  thumbProgress: HTMLElement | null;
  thumbProgressFill: HTMLElement | null;
};

type IntersectionObserverLike = {
  observe: (target: Element) => void;
  disconnect: () => void;
};

type CuratedCardMediaProjectionState = {
  thumbAriaLabel: string;
};

export type CuratedCardMediaComponent = {
  root: HTMLElement;
  refs: CuratedCardMediaComponentRefs;
  patch: (entry: CuratedCardMediaEntry) => void;
};

export type CuratedCardMediaComponentOptions = {
  documentRef?: Document;
  entry?: CuratedCardMediaEntry;
  resolveCardThumbHref?: (entry: CuratedCardMediaEntry) => string;
  getCardCoverImage?: (entry: CuratedCardMediaEntry) => string;
  normalizeImageUrlCandidate?: (value: BoundaryValue) => string;
  installCuratedCardPreview?: (
    thumbLink: HTMLAnchorElement,
    entry: CuratedCardMediaEntry,
    coverImageUrl: string,
    hoverPreviewImageUrl: string,
    thumbImage: HTMLImageElement | null,
  ) => void;
  createCuratedCardProgressComponent?: (options: {
    documentRef: Document;
    ratio: number;
  }) => CuratedCardProgressComponent;
};

type CuratedCardMediaDependencies = {
  resolveCardThumbHref: (entry: CuratedCardMediaEntry) => string;
  getCardCoverImage: (entry: CuratedCardMediaEntry) => string;
  normalizeImageUrlCandidate: (value: BoundaryValue) => string;
  installCuratedCardPreview: (
    thumbLink: HTMLAnchorElement,
    entry: CuratedCardMediaEntry,
    coverImageUrl: string,
    hoverPreviewImageUrl: string,
    thumbImage: HTMLImageElement | null,
  ) => void;
  createCuratedCardProgressComponent: (options: {
    documentRef: Document;
    ratio: number;
  }) => CuratedCardProgressComponent;
};

function requireFunction<T>(name: string, value: T | undefined): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing card media component dependency: ${name}`);
  }

  return value;
}

function requireDocumentRef(value: Document | undefined): Document {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing card media component dependency: documentRef');
  }
  if (typeof value.createElement !== 'function') {
    throw new Error('[CW] Missing card media component dependency: documentRef.createElement');
  }

  return value;
}

function toEntry(value: CuratedCardMediaEntry | BoundaryValue): CuratedCardMediaEntry {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as CuratedCardMediaEntry;
}

function getEntryString(entry: CuratedCardMediaEntry, key: keyof CuratedCardMediaEntry): string {
  const value = entry[key];
  if (typeof value === 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }

  return String(value);
}

function sanitizeEpisodeProgressRatio(value: BoundaryValue): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0 || normalized >= 1) {
    return null;
  }

  return normalized;
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

function setElementTextContent(element: Element, nextValue: string): void {
  if (element.textContent === nextValue) {
    return;
  }
  element.textContent = nextValue;
}

function removeElementFromParentNode(element: Element | null): void {
  if (!element || !element.parentNode) {
    return;
  }
  element.parentNode.removeChild(element);
}

function createThumbImage(
  documentRef: Document,
  thumbLink: HTMLAnchorElement,
  initialImageUrl = '',
): HTMLImageElement {
  const loadingIndicator = documentRef.createElement('span');
  loadingIndicator.className = 'cw-curated-card__thumb-loading';
  thumbLink.appendChild(loadingIndicator);

  const image = documentRef.createElement('img');
  image.loading = 'lazy';
  image.decoding = 'async';
  if (initialImageUrl) {
    image.src = initialImageUrl;
  }
  image.alt = '';

  setClassToken(thumbLink, 'cw-curated-card__thumb--loading', true);
  const markThumbImageReady = () => {
    setClassToken(thumbLink, 'cw-curated-card__thumb--loading', false);
    setClassToken(thumbLink, 'cw-curated-card__thumb--failed', false);
    setClassToken(thumbLink, 'cw-curated-card__thumb--loaded', true);
  };
  const markThumbImageFailed = () => {
    setClassToken(thumbLink, 'cw-curated-card__thumb--loading', false);
    setClassToken(thumbLink, 'cw-curated-card__thumb--loaded', false);
    setClassToken(thumbLink, 'cw-curated-card__thumb--failed', true);
  };

  image.addEventListener('load', markThumbImageReady);
  image.addEventListener('error', markThumbImageFailed);
  thumbLink.appendChild(image);

  if (initialImageUrl && image.complete) {
    if (image.naturalWidth > 0 || image.naturalHeight > 0) {
      markThumbImageReady();
    } else {
      markThumbImageFailed();
    }
  }

  return image;
}

function ensureThumbPlaceholder(documentRef: Document, refs: CuratedCardMediaComponentRefs): HTMLElement {
  if (refs.thumbPlaceholder) {
    setElementTextContent(refs.thumbPlaceholder, 'No Image');
    return refs.thumbPlaceholder;
  }

  const placeholder = documentRef.createElement('span');
  placeholder.className = 'cw-curated-card__placeholder';
  placeholder.textContent = 'No Image';
  refs.thumbLink.appendChild(placeholder);
  refs.thumbPlaceholder = placeholder;
  return placeholder;
}

function patchCardThumbMediaInternal(
  documentRef: Document,
  dependencies: CuratedCardMediaDependencies,
  refs: CuratedCardMediaComponentRefs,
  projectionState: CuratedCardMediaProjectionState,
  entry: CuratedCardMediaEntry,
): { coverImageUrl: string; hoverPreviewImageUrl: string } {
  const title = getEntryString(entry, 'title');
  const thumbHref = String(dependencies.resolveCardThumbHref(entry) || '#');
  if (refs.thumbLink.href !== thumbHref) {
    refs.thumbLink.href = thumbHref;
  }
  if (projectionState.thumbAriaLabel !== title) {
    refs.thumbLink.setAttribute('aria-label', title);
    projectionState.thumbAriaLabel = title;
  }

  const coverImageUrl = String(dependencies.getCardCoverImage(entry) || '');
  const hoverPreviewImageUrl = String(dependencies.normalizeImageUrlCandidate(entry.hoverPreviewImageUrl) || '');

  if (coverImageUrl) {
    removeElementFromParentNode(refs.thumbPlaceholder);
    refs.thumbPlaceholder = null;

    if (refs.thumbImage) {
      if (refs.thumbImage.src && refs.thumbImage.src !== coverImageUrl) {
        refs.thumbImage.src = coverImageUrl;
        setClassToken(refs.thumbLink, 'cw-curated-card__thumb--loading', true);
        setClassToken(refs.thumbLink, 'cw-curated-card__thumb--failed', false);
        setClassToken(refs.thumbLink, 'cw-curated-card__thumb--loaded', false);
      }
    } else {
      refs.thumbImage = createThumbImage(documentRef, refs.thumbLink);
    }
  } else {
    removeElementFromParentNode(refs.thumbImage);
    refs.thumbImage = null;
    setClassToken(refs.thumbLink, 'cw-curated-card__thumb--loading', false);
    setClassToken(refs.thumbLink, 'cw-curated-card__thumb--failed', false);
    setClassToken(refs.thumbLink, 'cw-curated-card__thumb--loaded', false);
    ensureThumbPlaceholder(documentRef, refs);
  }

  return {
    coverImageUrl,
    hoverPreviewImageUrl,
  };
}

function patchCardThumbProgressInternal(
  documentRef: Document,
  dependencies: CuratedCardMediaDependencies,
  media: HTMLElement,
  refs: CuratedCardMediaComponentRefs,
  progressComponent: CuratedCardProgressComponent | null,
  entry: CuratedCardMediaEntry,
): CuratedCardProgressComponent | null {
  const progressRatio = sanitizeEpisodeProgressRatio(entry.episodeWatchProgressRatio);
  if (progressRatio == null) {
    if (progressComponent) {
      removeElementFromParentNode(progressComponent.root);
    }
    refs.thumbProgress = null;
    refs.thumbProgressFill = null;
    return null;
  }

  let nextProgressComponent = progressComponent;
  if (!nextProgressComponent) {
    nextProgressComponent = dependencies.createCuratedCardProgressComponent({
      documentRef,
      ratio: progressRatio,
    });
    const thumbNextSibling = refs.thumbLink.nextSibling;
    if (thumbNextSibling) {
      media.insertBefore(nextProgressComponent.root, thumbNextSibling);
    } else {
      media.appendChild(nextProgressComponent.root);
    }
  }
  nextProgressComponent.patch(progressRatio);
  refs.thumbProgress = nextProgressComponent.refs.progress;
  refs.thumbProgressFill = nextProgressComponent.refs.fill;
  return nextProgressComponent;
}

function resolveDependencies(options: CuratedCardMediaComponentOptions): CuratedCardMediaDependencies {
  const resolveCardThumbHref = requireFunction('resolveCardThumbHref', options.resolveCardThumbHref);
  const getCardCoverImage = requireFunction('getCardCoverImage', options.getCardCoverImage);
  const normalizeImageUrlCandidate = requireFunction('normalizeImageUrlCandidate', options.normalizeImageUrlCandidate);
  const installCuratedCardPreview = requireFunction('installCuratedCardPreview', options.installCuratedCardPreview);
  const createProgressComponent = options.createCuratedCardProgressComponent || createCuratedCardProgressComponent;

  return {
    resolveCardThumbHref: (entry) => String(resolveCardThumbHref(entry) || '#'),
    getCardCoverImage: (entry) => String(getCardCoverImage(entry) || ''),
    normalizeImageUrlCandidate: (value) => String(normalizeImageUrlCandidate(value) || ''),
    installCuratedCardPreview,
    createCuratedCardProgressComponent: createProgressComponent,
  };
}

class CuratedCardMediaController {
  readonly refs: CuratedCardMediaComponentRefs;

  private progressComponent: CuratedCardProgressComponent | null = null;
  private readonly projectionState: CuratedCardMediaProjectionState = {
    thumbAriaLabel: '',
  };
  private readonly thumbIntersectionObserver: IntersectionObserverLike | null;
  private pendingThumbImageUrl = '';
  private thumbImageRequested = false;
  private thumbVisible = false;

  constructor(
    private readonly documentRef: Document,
    private readonly dependencies: CuratedCardMediaDependencies,
    initialEntry: CuratedCardMediaEntry | BoundaryValue,
  ) {
    const media = this.documentRef.createElement('div');
    media.className = 'cw-curated-card__media';

    const thumbLink = this.documentRef.createElement('a');
    thumbLink.className = 'cw-curated-card__thumb';
    media.appendChild(thumbLink);

    this.refs = {
      media,
      thumbLink,
      thumbImage: null,
      thumbPlaceholder: null,
      thumbProgress: null,
      thumbProgressFill: null,
    };

    const IntersectionObserverCtor = this.documentRef.defaultView?.IntersectionObserver ?? null;
    this.thumbIntersectionObserver =
      typeof IntersectionObserverCtor === 'function'
        ? new IntersectionObserverCtor(
            (entries) => {
              if (!entries.some((entry) => entry.isIntersecting)) {
                return;
              }
              this.thumbVisible = true;
              this.syncThumbImageSource();
              this.thumbIntersectionObserver?.disconnect();
            },
            {
              root: null,
              rootMargin: '300px 0px',
              threshold: 0.01,
            },
          )
        : null;

    this.patchEntry(initialEntry);
  }

  private readonly syncThumbImageSource = (): void => {
    if (!this.refs.thumbImage || !this.pendingThumbImageUrl || this.thumbImageRequested) {
      return;
    }
    if (this.thumbIntersectionObserver && !this.thumbVisible) {
      return;
    }
    this.refs.thumbImage.src = this.pendingThumbImageUrl;
    this.thumbImageRequested = true;
  };

  patchEntry(entryValue: CuratedCardMediaEntry | BoundaryValue): void {
    const entry = toEntry(entryValue);
    const { coverImageUrl, hoverPreviewImageUrl } = patchCardThumbMediaInternal(
      this.documentRef,
      this.dependencies,
      this.refs,
      this.projectionState,
      entry,
    );
    this.progressComponent = patchCardThumbProgressInternal(
      this.documentRef,
      this.dependencies,
      this.refs.media,
      this.refs,
      this.progressComponent,
      entry,
    );

    if (coverImageUrl) {
      this.pendingThumbImageUrl = coverImageUrl;
      if (this.refs.thumbImage && this.thumbIntersectionObserver) {
        this.thumbImageRequested = Boolean(this.refs.thumbImage.src);
        this.thumbIntersectionObserver.observe(this.refs.thumbLink);
      } else {
        this.thumbVisible = true;
        this.syncThumbImageSource();
      }
    } else {
      this.pendingThumbImageUrl = '';
      this.thumbImageRequested = false;
      this.thumbVisible = false;
      this.thumbIntersectionObserver?.disconnect();
    }

    this.dependencies.installCuratedCardPreview(
      this.refs.thumbLink,
      entry,
      coverImageUrl,
      hoverPreviewImageUrl,
      this.refs.thumbImage,
    );
  }
}

export function createCuratedCardMediaComponent(
  options: CuratedCardMediaComponentOptions = {},
): CuratedCardMediaComponent {
  const documentRef = requireDocumentRef(options.documentRef);
  const dependencies = resolveDependencies(options);
  const controller = new CuratedCardMediaController(documentRef, dependencies, options.entry);

  return {
    root: controller.refs.media,
    refs: controller.refs,
    patch: (entry: CuratedCardMediaEntry) => {
      controller.patchEntry(entry);
    },
  };
}
