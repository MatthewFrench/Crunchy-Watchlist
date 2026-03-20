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

export function sanitizeEpisodeProgressRatio(value: CwBoundaryValue): number | null {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0 || normalized >= 1) {
    return null;
  }

  return normalized;
}

type CuratedCardProgressProjectionState = {
  role: string;
  ariaValueMin: string;
  ariaValueMax: string;
  ariaValueNow: string;
  ariaLabel: string;
  width: string;
};

class CuratedCardProgressController {
  readonly refs: CuratedCardProgressRefs;
  private readonly projectionState: CuratedCardProgressProjectionState = {
    role: '',
    ariaValueMin: '',
    ariaValueMax: '',
    ariaValueNow: '',
    ariaLabel: '',
    width: '',
  };

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

    if (this.projectionState.role !== 'progressbar') {
      this.refs.progress.setAttribute('role', 'progressbar');
      this.projectionState.role = 'progressbar';
    }
    if (this.projectionState.ariaValueMin !== '0') {
      this.refs.progress.setAttribute('aria-valuemin', '0');
      this.projectionState.ariaValueMin = '0';
    }
    if (this.projectionState.ariaValueMax !== '100') {
      this.refs.progress.setAttribute('aria-valuemax', '100');
      this.projectionState.ariaValueMax = '100';
    }
    const nextAriaValueNow = String(percent);
    if (this.projectionState.ariaValueNow !== nextAriaValueNow) {
      this.refs.progress.setAttribute('aria-valuenow', nextAriaValueNow);
      this.projectionState.ariaValueNow = nextAriaValueNow;
    }
    const nextAriaLabel = `${percent}% of current episode watched`;
    if (this.projectionState.ariaLabel !== nextAriaLabel) {
      this.refs.progress.setAttribute('aria-label', nextAriaLabel);
      this.projectionState.ariaLabel = nextAriaLabel;
    }

    const width = `${Math.max(1, Math.round(safeRatio * 1000) / 10)}%`;
    if (this.projectionState.width !== width) {
      this.refs.fill.style.width = width;
      this.projectionState.width = width;
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
