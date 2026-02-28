type RuntimeModuleRegistry = Record<string, unknown>;

type RuntimeGlobal = typeof globalThis & {
  __CW_WATCHLIST_CURATOR_MODULES__?: RuntimeModuleRegistry;
};

export type CuratedCardProgressRefs = {
  progress: HTMLElement;
  fill: HTMLElement;
};

export type CuratedCardProgressComponent = {
  root: HTMLElement;
  refs: CuratedCardProgressRefs;
  patch: (ratio: number) => void;
};

export type CuratedCardProgressComponentOptions = {
  documentRef?: Document;
  ratio?: number | null;
};

function requireDocumentRef(value: Document | undefined): Document {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing card progress component dependency: documentRef');
  }
  if (typeof value.createElement !== 'function') {
    throw new Error('[CW] Missing card progress component dependency: documentRef.createElement');
  }
  return value;
}

export function sanitizeEpisodeProgressRatio(value: unknown): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0 || normalized >= 1) {
    return null;
  }

  return normalized;
}

function setElementAttributeIfChanged(element: Element, attributeName: string, nextValue: string): void {
  if (typeof element.setAttribute !== 'function') {
    return;
  }

  const currentValue = typeof element.getAttribute === 'function' ? element.getAttribute(attributeName) || '' : '';
  if (currentValue === nextValue) {
    return;
  }
  element.setAttribute(attributeName, nextValue);
}

class CuratedCardProgressController {
  readonly refs: CuratedCardProgressRefs;

  constructor(
    private readonly documentRef: Document,
    ratio: number | null | undefined,
  ) {
    const progressTrack = this.documentRef.createElement('div');
    progressTrack.className = 'cw-curated-card__thumb-progress';

    const progressFill = this.documentRef.createElement('span');
    progressFill.className = 'cw-curated-card__thumb-progress-fill';
    progressTrack.appendChild(progressFill);

    this.refs = {
      progress: progressTrack,
      fill: progressFill,
    };

    this.patchProgressRatio(Number(ratio || 0));
  }

  patchProgressRatio(nextRatio: number): void {
    const normalizedRatio = sanitizeEpisodeProgressRatio(nextRatio);
    const safeRatio = normalizedRatio == null ? 0 : normalizedRatio;
    const percent = Math.round(safeRatio * 100);

    setElementAttributeIfChanged(this.refs.progress, 'role', 'progressbar');
    setElementAttributeIfChanged(this.refs.progress, 'aria-valuemin', '0');
    setElementAttributeIfChanged(this.refs.progress, 'aria-valuemax', '100');
    setElementAttributeIfChanged(this.refs.progress, 'aria-valuenow', String(percent));
    setElementAttributeIfChanged(this.refs.progress, 'aria-label', `${percent}% of current episode watched`);

    const width = `${Math.max(1, Math.round(safeRatio * 1000) / 10)}%`;
    if (this.refs.fill.style.width !== width) {
      this.refs.fill.style.width = width;
    }
  }
}

export function createCuratedCardProgressComponent(
  options: CuratedCardProgressComponentOptions = {},
): CuratedCardProgressComponent {
  const documentRef = requireDocumentRef(options.documentRef);
  const controller = new CuratedCardProgressController(documentRef, options.ratio);

  return {
    root: controller.refs.progress,
    refs: controller.refs,
    patch: (ratio: number) => {
      controller.patchProgressRatio(ratio);
    },
  };
}

function registerCardProgressComponentRuntime(): void {
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

  (uiRegistry as Record<string, unknown>).cardProgressComponent = {
    createCuratedCardProgressComponent,
    sanitizeEpisodeProgressRatio,
  };
}

registerCardProgressComponentRuntime();
