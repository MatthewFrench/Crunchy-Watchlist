import { createCuratedInteractionsControlsRuntime as createCuratedInteractionsControlsRuntimeFactory } from './CuratedInteractionsControls.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryPromise = Promise<BoundaryValue>;
type BoundaryFn = (...args: BoundaryValue[]) => BoundaryValue;

type EventLike = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

type RuntimeState = {
  mounted: boolean;
  settings: BoundaryRecord;
};

type CuratedInteractionsContext = {
  documentRef: Document;
  alertRef: (message: string) => void;
  confirmRef: (message: string) => boolean;
  triggerNativeCardAction: (seriesId: string, actionType: string, favoriteValue?: BoundaryValue) => Promise<boolean>;
  toggleCuratedFavorite: (seriesId: string) => void;
  removeCuratedSeries: (seriesId: string) => void;
  renderCuratedPanel: () => void;
  state: RuntimeState;
  persistSettings: () => BoundaryPromise;
  resetCuratedCachesForRefresh: () => BoundaryPromise;
  ensureCuratedDataLoad: (force?: boolean) => BoundaryPromise;
  debounceProcess: () => void;
};

type CuratedInteractionsOptions = {
  documentRef?: BoundaryValue;
  alertRef?: BoundaryValue;
  confirmRef?: BoundaryValue;
  triggerNativeCardAction?: BoundaryValue;
  toggleCuratedFavorite?: BoundaryValue;
  removeCuratedSeries?: BoundaryValue;
  renderCuratedPanel?: BoundaryValue;
  state?: BoundaryValue;
  persistSettings?: BoundaryValue;
  resetCuratedCachesForRefresh?: BoundaryValue;
  ensureCuratedDataLoad?: BoundaryValue;
  debounceProcess?: BoundaryValue;
};

type CuratedInteractionsRuntime = {
  createCuratedCardActions: (entry: BoundaryValue) => HTMLElement;
  bindCuratedInterfaceControls: (controlsContext: BoundaryValue) => void;
  dispose: () => void;
};

type CuratedInteractionsControlsRuntime = {
  bindCuratedInterfaceControls: (context: CuratedInteractionsContext, controlsContext: BoundaryValue) => void;
};

function requireFunction<T extends BoundaryFn>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing curated interactions dependency: ${name}`);
  }

  return value as T;
}

function toRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as BoundaryRecord;
}

function getString(value: BoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveState(value: BoundaryValue): RuntimeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('[CW] Missing curated interactions state');
  }

  const stateRecord = value as BoundaryRecord;
  if (!stateRecord.settings || typeof stateRecord.settings !== 'object' || Array.isArray(stateRecord.settings)) {
    stateRecord.settings = {};
  }

  return stateRecord as RuntimeState;
}

function resolveDocumentRef(value: BoundaryValue): Document {
  if (!value || typeof value !== 'object') {
    throw new Error('[CW] Missing curated interactions documentRef');
  }

  return value as Document;
}

function createCuratedInteractionsContext(options: CuratedInteractionsOptions = {}): CuratedInteractionsContext {
  return {
    documentRef: resolveDocumentRef(options.documentRef),
    alertRef: requireFunction('alertRef', options.alertRef) as CuratedInteractionsContext['alertRef'],
    confirmRef: requireFunction('confirmRef', options.confirmRef) as CuratedInteractionsContext['confirmRef'],
    triggerNativeCardAction: requireFunction(
      'triggerNativeCardAction',
      options.triggerNativeCardAction,
    ) as CuratedInteractionsContext['triggerNativeCardAction'],
    toggleCuratedFavorite: requireFunction(
      'toggleCuratedFavorite',
      options.toggleCuratedFavorite,
    ) as CuratedInteractionsContext['toggleCuratedFavorite'],
    removeCuratedSeries: requireFunction(
      'removeCuratedSeries',
      options.removeCuratedSeries,
    ) as CuratedInteractionsContext['removeCuratedSeries'],
    renderCuratedPanel: requireFunction(
      'renderCuratedPanel',
      options.renderCuratedPanel,
    ) as CuratedInteractionsContext['renderCuratedPanel'],
    state: resolveState(options.state),
    persistSettings: requireFunction(
      'persistSettings',
      options.persistSettings,
    ) as CuratedInteractionsContext['persistSettings'],
    resetCuratedCachesForRefresh: requireFunction(
      'resetCuratedCachesForRefresh',
      options.resetCuratedCachesForRefresh,
    ) as CuratedInteractionsContext['resetCuratedCachesForRefresh'],
    ensureCuratedDataLoad: requireFunction(
      'ensureCuratedDataLoad',
      options.ensureCuratedDataLoad,
    ) as CuratedInteractionsContext['ensureCuratedDataLoad'],
    debounceProcess: requireFunction(
      'debounceProcess',
      options.debounceProcess,
    ) as CuratedInteractionsContext['debounceProcess'],
  };
}

function createCuratedInteractionsControlsRuntime(): CuratedInteractionsControlsRuntime {
  const controlsRuntime = createCuratedInteractionsControlsRuntimeFactory();
  const controlsRuntimeRecord = toRecord(controlsRuntime);

  return {
    bindCuratedInterfaceControls: requireFunction(
      'bindCuratedInterfaceControls',
      controlsRuntimeRecord.bindCuratedInterfaceControls,
    ),
  };
}

function stopCardActionEvent(event: EventLike | undefined): void {
  if (typeof event?.preventDefault === 'function') {
    event.preventDefault();
  }
  if (typeof event?.stopPropagation === 'function') {
    event.stopPropagation();
  }
}

function createFavoriteCardActionButton(
  context: CuratedInteractionsContext,
  initialFavorite: boolean,
): HTMLButtonElement {
  const favoriteButton = context.documentRef.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = `cw-card-action cw-card-action--favorite${initialFavorite ? ' is-active' : ''}`;
  favoriteButton.dataset.cwAction = 'favorite';
  favoriteButton.setAttribute('aria-label', initialFavorite ? 'Unfavorite' : 'Favorite');
  favoriteButton.setAttribute('aria-pressed', initialFavorite ? 'true' : 'false');
  favoriteButton.title = initialFavorite ? 'Unfavorite' : 'Favorite';
  favoriteButton.textContent = initialFavorite ? '♥' : '♡';
  return favoriteButton;
}

function createRemoveCardActionButton(context: CuratedInteractionsContext): HTMLButtonElement {
  const removeButton = context.documentRef.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'cw-card-action cw-card-action--remove';
  removeButton.dataset.cwAction = 'remove';
  removeButton.setAttribute('aria-label', 'Remove from watchlist');
  removeButton.title = 'Remove from watchlist';
  removeButton.textContent = '🗑';
  return removeButton;
}

async function withActionButtonsDisabled(
  favoriteButton: HTMLButtonElement,
  removeButton: HTMLButtonElement,
  run: () => Promise<void>,
): Promise<void> {
  const wasFavoriteButtonDisabled = favoriteButton.disabled;
  const wasRemoveButtonDisabled = removeButton.disabled;
  favoriteButton.disabled = true;
  removeButton.disabled = true;

  try {
    await run();
  } finally {
    favoriteButton.disabled = wasFavoriteButtonDisabled;
    removeButton.disabled = wasRemoveButtonDisabled;
  }
}

function bindFavoriteCardAction(
  context: CuratedInteractionsContext,
  favoriteButton: HTMLButtonElement,
  removeButton: HTMLButtonElement,
  seriesId: string,
  failedActionMessage: string,
): void {
  favoriteButton.addEventListener('click', (event) => {
    void (async () => {
      stopCardActionEvent(event);
      if (!seriesId) {
        return;
      }

      await withActionButtonsDisabled(favoriteButton, removeButton, async () => {
        const nextFavorite = favoriteButton.getAttribute('aria-pressed') !== 'true';
        const applied = await context.triggerNativeCardAction(seriesId, 'favorite', nextFavorite);
        if (!applied) {
          context.alertRef(failedActionMessage);
          return;
        }

        context.toggleCuratedFavorite(seriesId);
        context.renderCuratedPanel();
      });
    })().catch(() => {
      context.alertRef(failedActionMessage);
    });
  });
}

function bindRemoveCardAction(
  context: CuratedInteractionsContext,
  favoriteButton: HTMLButtonElement,
  removeButton: HTMLButtonElement,
  seriesId: string,
  title: string,
  failedActionMessage: string,
): void {
  removeButton.addEventListener('click', (event) => {
    void (async () => {
      stopCardActionEvent(event);
      if (!seriesId) {
        return;
      }

      const confirmed = context.confirmRef(`Remove "${title}" from your Crunchyroll watchlist?`);
      if (!confirmed) {
        return;
      }

      await withActionButtonsDisabled(favoriteButton, removeButton, async () => {
        const applied = await context.triggerNativeCardAction(seriesId, 'remove');
        if (!applied) {
          context.alertRef(failedActionMessage);
          return;
        }

        context.removeCuratedSeries(seriesId);
        context.renderCuratedPanel();
      });
    })().catch(() => {
      context.alertRef(failedActionMessage);
    });
  });
}

function createCuratedCardActionsInternal(context: CuratedInteractionsContext, entry: BoundaryValue): HTMLElement {
  const entryRecord = toRecord(entry);
  const seriesId = getString(entryRecord.seriesId);
  const initialFavorite = Boolean(entryRecord.isFavorite);
  const title = getString(entryRecord.title);

  const actions = context.documentRef.createElement('div');
  actions.className = 'cw-curated-card__actions';

  const favoriteButton = createFavoriteCardActionButton(context, initialFavorite);
  const removeButton = createRemoveCardActionButton(context);

  if (!seriesId) {
    favoriteButton.disabled = true;
    removeButton.disabled = true;
  }

  const failedActionMessage = 'Crunchyroll watchlist update failed. Please refresh and try again.';
  bindFavoriteCardAction(context, favoriteButton, removeButton, seriesId, failedActionMessage);
  bindRemoveCardAction(context, favoriteButton, removeButton, seriesId, title, failedActionMessage);

  actions.appendChild(favoriteButton);
  actions.appendChild(removeButton);
  return actions;
}

class CuratedInteractionsOwner implements CuratedInteractionsRuntime {
  private readonly context: CuratedInteractionsContext;
  private readonly controlsRuntime: CuratedInteractionsControlsRuntime;
  private disposed = false;

  constructor(options: CuratedInteractionsOptions = {}) {
    this.context = createCuratedInteractionsContext(options);
    this.controlsRuntime = createCuratedInteractionsControlsRuntime();
  }

  readonly createCuratedCardActions = (entry: BoundaryValue): HTMLElement =>
    this.disposed
      ? this.context.documentRef.createElement('div')
      : createCuratedCardActionsInternal(this.context, entry);

  readonly bindCuratedInterfaceControls = (controlsContext: BoundaryValue): void => {
    if (this.disposed) {
      return;
    }
    this.controlsRuntime.bindCuratedInterfaceControls(this.context, controlsContext);
  };

  readonly dispose = (): void => {
    this.disposed = true;
  };
}

function createCuratedInteractionsRuntime(options: CuratedInteractionsOptions = {}): CuratedInteractionsRuntime {
  return new CuratedInteractionsOwner(options);
}

const runtimeCuratedInteractionsModule = {
  createCuratedInteractionsRuntime,
};

export function createRuntimeCuratedInteractionsRuntime(): object {
  return runtimeCuratedInteractionsModule;
}
