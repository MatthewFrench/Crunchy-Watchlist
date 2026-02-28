(() => {
  type AnyFn = (...args: unknown[]) => unknown;
  type LooseRecord = Record<string, unknown>;

  type EventLike = {
    preventDefault?: AnyFn;
    stopPropagation?: AnyFn;
  };

  type EventTargetLike = {
    addEventListener: (eventName: string, listener: (event?: EventLike) => void | Promise<void>) => void;
  };

  type SelectLike = EventTargetLike & {
    value: string;
  };

  type CheckboxLike = EventTargetLike & {
    checked: boolean;
  };

  type ButtonLike = EventTargetLike;
  type MutableButtonLike = ButtonLike & {
    disabled?: boolean;
    setAttribute?: (name: string, value: string) => void;
  };

  type CuratedInteractionsControlsContext = {
    state: {
      mounted: boolean;
      settings: LooseRecord;
    };
    locationRef: Location;
    persistSettings: () => Promise<unknown>;
    normalizeAudioLocale: (locale: unknown) => string | null;
    preloadRatingsForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>;
    preloadWatchHistoryForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>;
    isWatchlistPath: (pathname: string) => boolean;
    resetCuratedCachesForRefresh: () => Promise<unknown>;
    ensureCuratedDataLoad: (force?: boolean) => Promise<unknown>;
    debounceProcess: () => void;
    renderCuratedPanel: () => void;
  };

  type CuratedInteractionsControlsRuntime = {
    bindCuratedInterfaceControls: (context: CuratedInteractionsControlsContext, controlsContext: unknown) => void;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord;
    };
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

  function toRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as LooseRecord;
  }

  function toSelect(value: unknown): SelectLike | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as Partial<SelectLike>;
    if (typeof candidate.addEventListener !== 'function') {
      return null;
    }
    return candidate as SelectLike;
  }

  function toCheckbox(value: unknown): CheckboxLike | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as Partial<CheckboxLike>;
    if (typeof candidate.addEventListener !== 'function') {
      return null;
    }
    return candidate as CheckboxLike;
  }

  function toButton(value: unknown): ButtonLike | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const candidate = value as Partial<ButtonLike>;
    if (typeof candidate.addEventListener !== 'function') {
      return null;
    }
    return candidate as ButtonLike;
  }

  function runHandledAsync(work: () => Promise<void>): void {
    void work().catch(() => {
      // no-op
    });
  }

  function bindWatchReadyFilterInternal(
    context: CuratedInteractionsControlsContext,
    watchReadyFilterControl: LooseRecord,
  ): void {
    const select = toSelect(watchReadyFilterControl.select);
    if (!select) {
      return;
    }

    select.addEventListener('change', () => {
      runHandledAsync(async () => {
        const nextWatchReadyMode = select.value;
        if (context.state.settings.watchReadyFilterMode === nextWatchReadyMode) {
          return;
        }
        context.state.settings.watchReadyFilterMode = nextWatchReadyMode;
        await context.persistSettings();
        context.renderCuratedPanel();
      });
    });
  }

  function bindCardLayoutFilterInternal(
    context: CuratedInteractionsControlsContext,
    cardLayoutControl: LooseRecord,
  ): void {
    const input = toCheckbox(cardLayoutControl.input);
    if (!input) {
      return;
    }

    input.addEventListener('change', () => {
      runHandledAsync(async () => {
        const nextCardLayout = input.checked ? 'landscape' : 'portrait';
        if (context.state.settings.cardLayout === nextCardLayout) {
          return;
        }
        context.state.settings.cardLayout = nextCardLayout;
        await context.persistSettings();
        context.renderCuratedPanel();
      });
    });
  }

  function bindAudioFilterInternal(context: CuratedInteractionsControlsContext, audioFilterControl: LooseRecord): void {
    const select = toSelect(audioFilterControl.select);
    if (!select) {
      return;
    }

    select.addEventListener('change', () => {
      runHandledAsync(async () => {
        const nextAudioFilter = select.value || 'any';
        if (context.state.settings.audioLocaleFilter === nextAudioFilter) {
          return;
        }
        context.state.settings.audioLocaleFilter = nextAudioFilter;
        await context.persistSettings();
        context.renderCuratedPanel();

        const selectedAudioLocale = context.normalizeAudioLocale(context.state.settings.audioLocaleFilter);
        if (!selectedAudioLocale) {
          return;
        }

        Promise.allSettled([
          context.preloadRatingsForSelectedAudioLocale(selectedAudioLocale),
          context.preloadWatchHistoryForSelectedAudioLocale(selectedAudioLocale),
        ]).then(() => {
          if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
            return;
          }
          context.renderCuratedPanel();
        });
      });
    });
  }

  function bindGenreFilterInternal(context: CuratedInteractionsControlsContext, genreFilterControl: LooseRecord): void {
    const select = toSelect(genreFilterControl.select);
    if (!select) {
      return;
    }

    select.addEventListener('change', () => {
      runHandledAsync(async () => {
        const nextGenreFilter = select.value || 'any';
        if (context.state.settings.genreFilter === nextGenreFilter) {
          return;
        }
        context.state.settings.genreFilter = nextGenreFilter;
        await context.persistSettings();
        context.renderCuratedPanel();
      });
    });
  }

  function bindSortFilterInternal(context: CuratedInteractionsControlsContext, sortControl: LooseRecord): void {
    const select = toSelect(sortControl.select);
    if (!select) {
      return;
    }

    select.addEventListener('change', () => {
      runHandledAsync(async () => {
        const nextSortMode = select.value;
        if (context.state.settings.sortMode === nextSortMode) {
          return;
        }
        context.state.settings.sortMode = nextSortMode;
        await context.persistSettings();
        context.renderCuratedPanel();
      });
    });
  }

  function bindSecondarySortFilterInternal(
    context: CuratedInteractionsControlsContext,
    secondarySortControl: LooseRecord,
  ): void {
    const select = toSelect(secondarySortControl.select);
    if (!select) {
      return;
    }

    select.addEventListener('change', () => {
      runHandledAsync(async () => {
        const nextSecondarySortMode = select.value || 'none';
        if (context.state.settings.secondarySortMode === nextSecondarySortMode) {
          return;
        }
        context.state.settings.secondarySortMode = nextSecondarySortMode;
        await context.persistSettings();
        context.renderCuratedPanel();
      });
    });
  }

  function bindRefreshButtonInternal(context: CuratedInteractionsControlsContext, refreshButton: unknown): void {
    const button = toButton(refreshButton) as MutableButtonLike | null;
    if (!button) {
      return;
    }

    let refreshInFlight: Promise<unknown> | null = null;

    button.addEventListener('click', () => {
      runHandledAsync(async () => {
        if (refreshInFlight) {
          return;
        }

        const wasDisabled = Boolean(button.disabled);
        button.disabled = true;
        button.setAttribute?.('aria-busy', 'true');

        refreshInFlight = (async () => {
          await context.resetCuratedCachesForRefresh();
          const refreshPromise = context.ensureCuratedDataLoad(true);
          context.renderCuratedPanel();
          context.debounceProcess();
          await refreshPromise;
        })();

        try {
          await refreshInFlight;
        } finally {
          refreshInFlight = null;
          button.setAttribute?.('aria-busy', 'false');
          button.disabled = wasDisabled;
        }
      });
    });
  }

  /**
   * Binds controls in one owner so settings persistence and refresh orchestration stay
   * consistent across watch-ready/layout/audio/genre/sort/update interactions.
   */
  function bindCuratedInterfaceControlsInternal(
    context: CuratedInteractionsControlsContext,
    controlsContext: unknown,
  ): void {
    const controls = toRecord(controlsContext);
    bindWatchReadyFilterInternal(context, toRecord(controls.watchReadyFilterControl));
    bindCardLayoutFilterInternal(context, toRecord(controls.cardLayoutControl));
    bindAudioFilterInternal(context, toRecord(controls.audioFilterControl));
    bindGenreFilterInternal(context, toRecord(controls.genreFilterControl));
    bindSortFilterInternal(context, toRecord(controls.sortControl));
    bindSecondarySortFilterInternal(context, toRecord(controls.secondarySortControl));
    bindRefreshButtonInternal(context, controls.refreshButton);
  }

  function createCuratedInteractionsControlsRuntime(): CuratedInteractionsControlsRuntime {
    return {
      bindCuratedInterfaceControls: (context, controlsContext) =>
        bindCuratedInterfaceControlsInternal(context, controlsContext),
    };
  }

  moduleRegistry.runtimeCuratedInteractionsControls = {
    createCuratedInteractionsControlsRuntime,
  };
})();
