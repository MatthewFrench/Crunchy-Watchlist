import {
  createNativeCardSelectorAdapterRuntime,
  type NativeCardSelectorAdapterRuntime,
} from './NativeCardSelectorAdapter.js';

type NativeBridgePreviewBoundaryValue = CwBoundaryValue;
type NativeBridgePreviewBoundaryRecord = Record<string, NativeBridgePreviewBoundaryValue>;

type NativeActionBridgeRuntime = {
  findNativeCardBySeriesId: (seriesId: NativeBridgePreviewBoundaryValue) => HTMLElement | null;
};

type NativePreviewSelectorAdapterRuntime = Pick<NativeCardSelectorAdapterRuntime, 'findPreviewNodes'>;

type EntryLike = {
  seriesId?: NativeBridgePreviewBoundaryValue;
  streamsLink?: NativeBridgePreviewBoundaryValue;
};

type PreviewContext = {
  thumbLink: HTMLAnchorElement;
  thumbImage: HTMLImageElement | null;
  entry: EntryLike;
  coverImageUrl: string;
  hoverPreviewImageUrl: string;
  previewImage: HTMLImageElement | null;
  previewVideo: HTMLVideoElement | null;
  previewTimer: number | null;
  previewPollTimer: number | null;
  previewSession: number;
  activeNativeCard: HTMLElement | null;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onBlur?: () => void;
};

type NativeBridgePreviewContext = {
  windowRef: Window;
  nativeActionBridgeRuntime: NativeActionBridgeRuntime;
  selectorAdapterRuntime: NativePreviewSelectorAdapterRuntime;
  normalizeImageUrlCandidate: (value: NativeBridgePreviewBoundaryValue) => string;
  fetchPreviewUrlForEntry: (entry: NativeBridgePreviewBoundaryValue) => Promise<NativeBridgePreviewBoundaryValue>;
  isLikelyVideoUrl: (url: NativeBridgePreviewBoundaryValue) => boolean;
  previewHoverDelayMs: number;
  previewContextsByThumbLink: WeakMap<HTMLAnchorElement, PreviewContext>;
  previewContexts: Set<PreviewContext>;
};

export type NativeBridgePreviewOptions = {
  windowRef?: NativeBridgePreviewBoundaryValue;
  nativeActionBridgeRuntime?: NativeBridgePreviewBoundaryValue;
  selectorAdapterRuntime?: NativeBridgePreviewBoundaryValue;
  normalizeImageUrlCandidate?: NativeBridgePreviewBoundaryValue;
  fetchPreviewUrlForEntry?: NativeBridgePreviewBoundaryValue;
  isLikelyVideoUrl?: NativeBridgePreviewBoundaryValue;
  previewHoverDelayMs?: NativeBridgePreviewBoundaryValue;
};

export type NativeBridgePreviewRuntime = {
  installCuratedCardPreview: (
    thumbLink: NativeBridgePreviewBoundaryValue,
    entry: NativeBridgePreviewBoundaryValue,
    coverImageUrl: NativeBridgePreviewBoundaryValue,
    hoverPreviewImageUrl: NativeBridgePreviewBoundaryValue,
    thumbImage: NativeBridgePreviewBoundaryValue,
  ) => void;
  dispose: () => void;
};

function requireFunction<T>(name: string, value: NativeBridgePreviewBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing native bridge preview dependency: ${name}`);
  }
  return value as T;
}

function resolveWindowRef(value: NativeBridgePreviewBoundaryValue): Window {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing native bridge preview windowRef');
  }
  return value as Window;
}

function normalizePositiveNumber(value: NativeBridgePreviewBoundaryValue, fallback: number): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return fallback;
  }
  return Math.round(normalized);
}

function getString(value: NativeBridgePreviewBoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: NativeBridgePreviewBoundaryValue): NativeBridgePreviewBoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as NativeBridgePreviewBoundaryRecord;
}

function resolveSelectorAdapterRuntime(
  runtimeValue: NativeBridgePreviewBoundaryValue,
  sourceLabel: string,
): NativePreviewSelectorAdapterRuntime {
  const runtimeRecord = asRecord(runtimeValue);
  return {
    findPreviewNodes: requireFunction<NativePreviewSelectorAdapterRuntime['findPreviewNodes']>(
      `${sourceLabel}.findPreviewNodes`,
      runtimeRecord.findPreviewNodes,
    ),
  };
}

function createNativeBridgePreviewContext(options: NativeBridgePreviewOptions = {}): NativeBridgePreviewContext {
  const nativeActionBridgeRuntimeRecord = asRecord(options.nativeActionBridgeRuntime);

  return {
    windowRef: resolveWindowRef(options.windowRef),
    nativeActionBridgeRuntime: {
      findNativeCardBySeriesId: requireFunction<NativeActionBridgeRuntime['findNativeCardBySeriesId']>(
        'nativeActionBridgeRuntime.findNativeCardBySeriesId',
        nativeActionBridgeRuntimeRecord.findNativeCardBySeriesId,
      ),
    },
    selectorAdapterRuntime: options.selectorAdapterRuntime
      ? resolveSelectorAdapterRuntime(options.selectorAdapterRuntime, 'selectorAdapterRuntime')
      : createNativeCardSelectorAdapterRuntime({}),
    normalizeImageUrlCandidate: requireFunction<NativeBridgePreviewContext['normalizeImageUrlCandidate']>(
      'normalizeImageUrlCandidate',
      options.normalizeImageUrlCandidate,
    ),
    fetchPreviewUrlForEntry: requireFunction<NativeBridgePreviewContext['fetchPreviewUrlForEntry']>(
      'fetchPreviewUrlForEntry',
      options.fetchPreviewUrlForEntry,
    ),
    isLikelyVideoUrl: requireFunction<NativeBridgePreviewContext['isLikelyVideoUrl']>(
      'isLikelyVideoUrl',
      options.isLikelyVideoUrl,
    ),
    previewHoverDelayMs: normalizePositiveNumber(options.previewHoverDelayMs, 220),
    previewContextsByThumbLink: new WeakMap<HTMLAnchorElement, PreviewContext>(),
    previewContexts: new Set<PreviewContext>(),
  };
}

function contextNormalizeUrl(value: NativeBridgePreviewBoundaryValue): string {
  const normalized = getString(value);
  if (!normalized) {
    return '';
  }

  const origin =
    typeof window !== 'undefined' && window.location && typeof window.location.origin === 'string'
      ? window.location.origin
      : '';

  try {
    return (new URL(normalized, origin || undefined).toString() || normalized) as string;
  } catch {
    return normalized;
  }
}

function extractUrlFromCssBackground(backgroundValue: string): string {
  const match = backgroundValue.match(/url\((['"]?)(.*?)\1\)/i);
  if (!match || !match[2]) {
    return '';
  }

  return contextNormalizeUrl(match[2]);
}

function getNativeCardPreviewUrl(context: NativeBridgePreviewContext, card: HTMLElement): string {
  const candidates = context.selectorAdapterRuntime.findPreviewNodes(card);
  for (const candidate of candidates) {
    if (candidate instanceof HTMLVideoElement) {
      const current = candidate.currentSrc || candidate.src;
      if (current) {
        return current;
      }
    }

    if (candidate instanceof HTMLImageElement) {
      const current = candidate.currentSrc || candidate.src;
      if (current) {
        return current;
      }
    }

    const styleValue = context.windowRef.getComputedStyle(candidate).backgroundImage;
    const backgroundUrl = extractUrlFromCssBackground(styleValue);
    if (backgroundUrl) {
      return backgroundUrl;
    }
  }

  return extractUrlFromCssBackground(context.windowRef.getComputedStyle(card).backgroundImage) || '';
}

function createCuratedPreviewContext(
  thumbLink: HTMLAnchorElement,
  thumbImage: HTMLImageElement | null,
  entry: EntryLike,
  coverImageUrl: string,
  hoverPreviewImageUrl: string,
): PreviewContext {
  return {
    thumbLink,
    thumbImage,
    entry,
    coverImageUrl,
    hoverPreviewImageUrl,
    previewImage: null,
    previewVideo: null,
    previewTimer: null,
    previewPollTimer: null,
    previewSession: 0,
    activeNativeCard: null,
  };
}

function stopCuratedPreview(context: NativeBridgePreviewContext, previewContext: PreviewContext): void {
  if (previewContext.previewTimer != null) {
    context.windowRef.clearTimeout(previewContext.previewTimer);
  }
  if (previewContext.previewPollTimer != null) {
    context.windowRef.clearTimeout(previewContext.previewPollTimer);
  }
  previewContext.previewTimer = null;
  previewContext.previewPollTimer = null;

  if (previewContext.activeNativeCard) {
    try {
      previewContext.activeNativeCard.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }));
      previewContext.activeNativeCard.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true }));
    } catch {
      // no-op
    }
  }
  previewContext.activeNativeCard = null;

  if (previewContext.previewVideo) {
    previewContext.previewVideo.pause();
    previewContext.previewVideo.currentTime = 0;
    previewContext.previewVideo.style.display = 'none';
  }

  if (previewContext.previewImage) {
    previewContext.previewImage.style.display = 'none';
  }

  previewContext.thumbLink.classList.remove('cw-curated-card__thumb--previewing');
  if (previewContext.thumbImage) {
    previewContext.thumbImage.style.opacity = '';
  }
}

function showCuratedPreviewImage(previewContext: PreviewContext, url: string): void {
  if (!url) {
    return;
  }

  if (!previewContext.previewImage) {
    const ownerDocument = previewContext.thumbLink.ownerDocument;
    previewContext.previewImage = ownerDocument.createElement('img');
    previewContext.previewImage.className = 'cw-curated-card__preview cw-curated-card__preview-image';
    previewContext.previewImage.alt = '';
    previewContext.previewImage.setAttribute('aria-hidden', 'true');
    previewContext.thumbLink.appendChild(previewContext.previewImage);
  }

  previewContext.previewImage.src = url;
  previewContext.previewImage.style.display = 'block';

  if (previewContext.previewVideo) {
    previewContext.previewVideo.pause();
    previewContext.previewVideo.style.display = 'none';
  }

  previewContext.thumbLink.classList.add('cw-curated-card__thumb--previewing');
  if (previewContext.thumbImage) {
    previewContext.thumbImage.style.opacity = '0';
  }
}

async function showCuratedPreviewVideo(
  context: NativeBridgePreviewContext,
  previewContext: PreviewContext,
  url: string,
): Promise<void> {
  if (!url) {
    return;
  }

  if (!previewContext.previewVideo) {
    const ownerDocument = previewContext.thumbLink.ownerDocument;
    previewContext.previewVideo = ownerDocument.createElement('video');
    previewContext.previewVideo.className = 'cw-curated-card__preview cw-curated-card__preview-video';
    previewContext.previewVideo.muted = true;
    previewContext.previewVideo.loop = true;
    previewContext.previewVideo.playsInline = true;
    previewContext.previewVideo.preload = 'none';
    previewContext.previewVideo.setAttribute('aria-hidden', 'true');
    previewContext.thumbLink.appendChild(previewContext.previewVideo);
  }

  if (previewContext.previewVideo.src !== url) {
    previewContext.previewVideo.src = url;
  }
  previewContext.previewVideo.style.display = 'block';

  if (previewContext.previewImage) {
    previewContext.previewImage.style.display = 'none';
  }

  previewContext.thumbLink.classList.add('cw-curated-card__thumb--previewing');
  if (previewContext.thumbImage) {
    previewContext.thumbImage.style.opacity = '0';
  }

  try {
    await previewContext.previewVideo.play();
  } catch {
    stopCuratedPreview(context, previewContext);
  }
}

function startMirroredNativePreviewSession(
  context: NativeBridgePreviewContext,
  previewContext: PreviewContext,
  seriesId: string,
  coverImageUrl: string,
  sessionId: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const nativeCard = context.nativeActionBridgeRuntime.findNativeCardBySeriesId(seriesId);
    if (!nativeCard) {
      resolve(false);
      return;
    }

    previewContext.activeNativeCard = nativeCard;

    let baseline = '';
    try {
      baseline = getNativeCardPreviewUrl(context, nativeCard);
    } catch {
      resolve(false);
      return;
    }
    const fallbackPoster =
      previewContext.thumbImage?.currentSrc || previewContext.thumbImage?.src || coverImageUrl || '';

    try {
      nativeCard.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
      nativeCard.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    } catch {
      // no-op
    }

    let attempts = 0;
    const poll = () => {
      try {
        if (sessionId !== previewContext.previewSession) {
          resolve(false);
          return;
        }

        const current = getNativeCardPreviewUrl(context, nativeCard);
        if (current && current !== baseline && current !== fallbackPoster) {
          showCuratedPreviewImage(previewContext, current);
          resolve(true);
          return;
        }

        attempts += 1;
        if (attempts >= 8) {
          resolve(false);
          return;
        }

        previewContext.previewPollTimer = context.windowRef.setTimeout(poll, 120);
      } catch {
        resolve(false);
      }
    };

    previewContext.previewPollTimer = context.windowRef.setTimeout(poll, 120);
  });
}

async function startCuratedPreviewSession(
  context: NativeBridgePreviewContext,
  previewContext: PreviewContext,
  sessionId: number,
): Promise<void> {
  const entry = previewContext.entry;
  const coverImageUrl = previewContext.coverImageUrl;
  const hoverPreviewImageUrl = previewContext.hoverPreviewImageUrl;
  const seriesId = getString(entry.seriesId);
  const mirrored = await startMirroredNativePreviewSession(context, previewContext, seriesId, coverImageUrl, sessionId);
  if (mirrored || sessionId !== previewContext.previewSession) {
    return;
  }

  const fallbackPreviewUrl = hoverPreviewImageUrl || coverImageUrl || '';
  if (!getString(entry.streamsLink)) {
    if (fallbackPreviewUrl) {
      showCuratedPreviewImage(previewContext, fallbackPreviewUrl);
    }
    return;
  }

  let previewUrl = '';
  try {
    previewUrl = getString(await context.fetchPreviewUrlForEntry(entry));
  } catch {
    previewUrl = '';
  }

  if (!previewUrl || sessionId !== previewContext.previewSession) {
    if (sessionId === previewContext.previewSession && fallbackPreviewUrl) {
      showCuratedPreviewImage(previewContext, fallbackPreviewUrl);
    }
    return;
  }

  const normalizedPreviewUrl = context.normalizeImageUrlCandidate(previewUrl);
  if (
    normalizedPreviewUrl &&
    coverImageUrl &&
    normalizedPreviewUrl === coverImageUrl &&
    hoverPreviewImageUrl &&
    hoverPreviewImageUrl !== coverImageUrl
  ) {
    showCuratedPreviewImage(previewContext, hoverPreviewImageUrl);
    return;
  }

  if (context.isLikelyVideoUrl(previewUrl)) {
    await showCuratedPreviewVideo(context, previewContext, previewUrl);
  } else {
    showCuratedPreviewImage(previewContext, previewUrl);
  }
}

function queueCuratedPreviewSession(
  context: NativeBridgePreviewContext,
  previewContext: PreviewContext,
  onStartPreview: (sessionId: number) => Promise<void>,
): void {
  previewContext.previewSession += 1;
  const currentSession = previewContext.previewSession;
  if (previewContext.previewTimer != null) {
    context.windowRef.clearTimeout(previewContext.previewTimer);
  }
  previewContext.previewTimer = context.windowRef.setTimeout(() => {
    onStartPreview(currentSession).catch(() => {
      // no-op
    });
  }, context.previewHoverDelayMs);
}

function installCuratedCardPreviewInternal(
  context: NativeBridgePreviewContext,
  thumbLinkValue: NativeBridgePreviewBoundaryValue,
  entryValue: NativeBridgePreviewBoundaryValue,
  coverImageUrlValue: NativeBridgePreviewBoundaryValue,
  hoverPreviewImageUrlValue: NativeBridgePreviewBoundaryValue,
  thumbImageValue: NativeBridgePreviewBoundaryValue,
): void {
  const thumbLink = thumbLinkValue instanceof HTMLAnchorElement ? thumbLinkValue : null;
  if (!thumbLink) {
    return;
  }

  const entry = (entryValue && typeof entryValue === 'object' ? entryValue : {}) as EntryLike;
  const coverImageUrl = context.normalizeImageUrlCandidate(coverImageUrlValue);
  const hoverPreviewImageUrl = context.normalizeImageUrlCandidate(hoverPreviewImageUrlValue);
  const thumbImage = thumbImageValue instanceof HTMLImageElement ? thumbImageValue : null;
  const existingPreviewContext = context.previewContextsByThumbLink.get(thumbLink);
  if (existingPreviewContext) {
    existingPreviewContext.thumbImage = thumbImage;
    existingPreviewContext.entry = entry;
    existingPreviewContext.coverImageUrl = coverImageUrl;
    existingPreviewContext.hoverPreviewImageUrl = hoverPreviewImageUrl;
    return;
  }

  const previewContext = createCuratedPreviewContext(thumbLink, thumbImage, entry, coverImageUrl, hoverPreviewImageUrl);
  context.previewContextsByThumbLink.set(thumbLink, previewContext);
  context.previewContexts.add(previewContext);

  const startPreview = (sessionId: number) => startCuratedPreviewSession(context, previewContext, sessionId);
  const stopPreview = () => {
    previewContext.previewSession += 1;
    stopCuratedPreview(context, previewContext);
  };

  previewContext.onMouseEnter = () => {
    queueCuratedPreviewSession(context, previewContext, startPreview);
  };
  previewContext.onMouseLeave = () => {
    stopPreview();
  };
  previewContext.onBlur = () => {
    stopPreview();
  };

  thumbLink.addEventListener('mouseenter', previewContext.onMouseEnter);
  thumbLink.addEventListener('mouseleave', previewContext.onMouseLeave);
  thumbLink.addEventListener('blur', previewContext.onBlur);
}

function disposeNativeBridgePreviewContextInternal(context: NativeBridgePreviewContext): void {
  context.previewContexts.forEach((previewContext) => {
    previewContext.previewSession += 1;
    stopCuratedPreview(context, previewContext);
    if (typeof previewContext.thumbLink.removeEventListener === 'function') {
      if (previewContext.onMouseEnter) {
        previewContext.thumbLink.removeEventListener('mouseenter', previewContext.onMouseEnter);
      }
      if (previewContext.onMouseLeave) {
        previewContext.thumbLink.removeEventListener('mouseleave', previewContext.onMouseLeave);
      }
      if (previewContext.onBlur) {
        previewContext.thumbLink.removeEventListener('blur', previewContext.onBlur);
      }
    }
    delete previewContext.onMouseEnter;
    delete previewContext.onMouseLeave;
    delete previewContext.onBlur;
  });
  context.previewContexts.clear();
  context.previewContextsByThumbLink = new WeakMap<HTMLAnchorElement, PreviewContext>();
}

class NativeBridgePreviewOwner implements NativeBridgePreviewRuntime {
  private readonly context: NativeBridgePreviewContext;
  private disposed = false;

  constructor(options: NativeBridgePreviewOptions = {}) {
    this.context = createNativeBridgePreviewContext(options);
  }

  readonly installCuratedCardPreview = (
    thumbLink: NativeBridgePreviewBoundaryValue,
    entry: NativeBridgePreviewBoundaryValue,
    coverImageUrl: NativeBridgePreviewBoundaryValue,
    hoverPreviewImageUrl: NativeBridgePreviewBoundaryValue,
    thumbImage: NativeBridgePreviewBoundaryValue,
  ): void => {
    if (this.disposed) {
      return;
    }
    installCuratedCardPreviewInternal(this.context, thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage);
  };

  readonly dispose = (): void => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    disposeNativeBridgePreviewContextInternal(this.context);
  };
}

export function createNativeBridgePreviewRuntime(options: NativeBridgePreviewOptions = {}): NativeBridgePreviewRuntime {
  return new NativeBridgePreviewOwner(options);
}
