(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type EventLike = {
    preventDefault?: AnyFn;
    stopPropagation?: AnyFn;
  };

  type RuntimeState = {
    mounted: boolean;
    settings: Record<string, unknown>;
  };

  type CuratedInteractionsContext = {
    documentRef: Document;
    alertRef: (message: string) => void;
    confirmRef: (message: string) => boolean;
    triggerNativeCardAction: (seriesId: string, actionType: string, favoriteValue?: unknown) => Promise<boolean>;
    toggleCuratedFavorite: (seriesId: string) => void;
    removeCuratedSeries: (seriesId: string) => void;
    renderCuratedPanel: () => void;
    state: RuntimeState;
    locationRef: Location;
    persistSettings: () => Promise<unknown>;
    normalizeAudioLocale: (locale: unknown) => string | null;
    preloadRatingsForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>;
    preloadWatchHistoryForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>;
    isWatchlistPath: (pathname: string) => boolean;
    resetCuratedCachesForRefresh: () => Promise<unknown>;
    ensureCuratedDataLoad: (force?: boolean) => Promise<unknown>;
    debounceProcess: () => void;
  };

  type CuratedInteractionsOptions = {
    documentRef?: unknown;
    alertRef?: unknown;
    confirmRef?: unknown;
    triggerNativeCardAction?: unknown;
    toggleCuratedFavorite?: unknown;
    removeCuratedSeries?: unknown;
    renderCuratedPanel?: unknown;
    state?: unknown;
    locationRef?: unknown;
    persistSettings?: unknown;
    normalizeAudioLocale?: unknown;
    preloadRatingsForSelectedAudioLocale?: unknown;
    preloadWatchHistoryForSelectedAudioLocale?: unknown;
    isWatchlistPath?: unknown;
    resetCuratedCachesForRefresh?: unknown;
    ensureCuratedDataLoad?: unknown;
    debounceProcess?: unknown;
  };

  type CuratedInteractionsRuntime = {
    createCuratedCardActions: (entry: unknown) => HTMLElement;
    bindCuratedInterfaceControls: (controlsContext: unknown) => void;
  };

  type CuratedInteractionsControlsRuntime = {
    bindCuratedInterfaceControls: (context: CuratedInteractionsContext, controlsContext: unknown) => void;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated interactions dependency: ${name}`);
    }

    return value as T;
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  function resolveState(value: unknown): RuntimeState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('[CW] Missing curated interactions state');
    }

    const stateRecord = value as Record<string, unknown>;
    if (!stateRecord.settings || typeof stateRecord.settings !== 'object' || Array.isArray(stateRecord.settings)) {
      stateRecord.settings = {};
    }

    return stateRecord as unknown as RuntimeState;
  }

  function resolveLocationRef(value: unknown): Location {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing curated interactions locationRef');
    }

    return value as Location;
  }

  function resolveDocumentRef(value: unknown): Document {
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
      locationRef: resolveLocationRef(options.locationRef),
      persistSettings: requireFunction(
        'persistSettings',
        options.persistSettings,
      ) as CuratedInteractionsContext['persistSettings'],
      normalizeAudioLocale: requireFunction(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ) as CuratedInteractionsContext['normalizeAudioLocale'],
      preloadRatingsForSelectedAudioLocale: requireFunction(
        'preloadRatingsForSelectedAudioLocale',
        options.preloadRatingsForSelectedAudioLocale,
      ) as CuratedInteractionsContext['preloadRatingsForSelectedAudioLocale'],
      preloadWatchHistoryForSelectedAudioLocale: requireFunction(
        'preloadWatchHistoryForSelectedAudioLocale',
        options.preloadWatchHistoryForSelectedAudioLocale,
      ) as CuratedInteractionsContext['preloadWatchHistoryForSelectedAudioLocale'],
      isWatchlistPath: requireFunction(
        'isWatchlistPath',
        options.isWatchlistPath,
      ) as CuratedInteractionsContext['isWatchlistPath'],
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
    const controlsModule = toRecord(moduleRegistry.runtimeCuratedInteractionsControls);
    return requireFunction<() => CuratedInteractionsControlsRuntime>(
      'createCuratedInteractionsControlsRuntime',
      controlsModule.createCuratedInteractionsControlsRuntime,
    )();
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

  function createCuratedCardActionsInternal(context: CuratedInteractionsContext, entry: unknown): HTMLElement {
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

  function createCuratedInteractionsRuntime(options: CuratedInteractionsOptions = {}): CuratedInteractionsRuntime {
    const context = createCuratedInteractionsContext(options);
    const controlsRuntime = createCuratedInteractionsControlsRuntime();
    return {
      createCuratedCardActions: (entry: unknown) => createCuratedCardActionsInternal(context, entry),
      bindCuratedInterfaceControls: (controlsContext: unknown) =>
        controlsRuntime.bindCuratedInterfaceControls(context, controlsContext),
    };
  }

  moduleRegistry.runtimeCuratedInteractions = {
    createCuratedInteractionsRuntime,
  };
})();
