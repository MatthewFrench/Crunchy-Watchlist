import { type AudioLocaleFilter, normalizeAudioLocaleFilter } from './AudioLocaleFilter.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryPromise = Promise<BoundaryValue>;
type ControlEventListener = (event?: EventLike) => void | Promise<void>;

type EventLike = {
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

type EventTargetLike = {
  addEventListener: (eventName: string, listener: ControlEventListener) => void;
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
    settings: BoundaryRecord;
  };
  persistSettings: () => BoundaryPromise;
  resetCuratedCachesForRefresh: () => BoundaryPromise;
  ensureCuratedDataLoad: (force?: boolean) => BoundaryPromise;
  debounceProcess: () => void;
  renderCuratedPanel: () => void;
};

type CuratedInteractionsControlsRuntime = {
  bindCuratedInterfaceControls: (context: CuratedInteractionsControlsContext, controlsContext: BoundaryValue) => void;
};

function toRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as BoundaryRecord;
}

function toSelect(value: BoundaryValue): SelectLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Partial<SelectLike>;
  if (typeof candidate.addEventListener !== 'function') {
    return null;
  }
  return candidate as SelectLike;
}

function toCheckbox(value: BoundaryValue): CheckboxLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const candidate = value as Partial<CheckboxLike>;
  if (typeof candidate.addEventListener !== 'function') {
    return null;
  }
  return candidate as CheckboxLike;
}

function toButton(value: BoundaryValue): ButtonLike | null {
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

function persistSettingsInBackground(context: CuratedInteractionsControlsContext): void {
  void context.persistSettings().catch(() => {
    // no-op
  });
}

function bindWatchReadyFilterInternal(
  context: CuratedInteractionsControlsContext,
  watchReadyFilterControl: BoundaryRecord,
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
      context.renderCuratedPanel();
      persistSettingsInBackground(context);
    });
  });
}

function bindCardLayoutFilterInternal(
  context: CuratedInteractionsControlsContext,
  cardLayoutControl: BoundaryRecord,
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
      context.renderCuratedPanel();
      persistSettingsInBackground(context);
    });
  });
}

function bindAudioFilterInternal(
  context: CuratedInteractionsControlsContext,
  audioFilterControl: BoundaryRecord,
): void {
  const select = toSelect(audioFilterControl.select);
  if (!select) {
    return;
  }

  select.addEventListener('change', () => {
    runHandledAsync(async () => {
      const previousAudioFilterRaw = context.state.settings.audioLocaleFilter;
      const previousAudioFilter: AudioLocaleFilter = normalizeAudioLocaleFilter(
        typeof previousAudioFilterRaw === 'string' ? previousAudioFilterRaw : undefined,
      );
      const nextAudioFilter: AudioLocaleFilter = normalizeAudioLocaleFilter(select.value);
      if (previousAudioFilter === nextAudioFilter) {
        return;
      }

      context.state.settings.audioLocaleFilter = nextAudioFilter;
      context.renderCuratedPanel();
      persistSettingsInBackground(context);
    });
  });
}

function bindGenreFilterInternal(
  context: CuratedInteractionsControlsContext,
  genreFilterControl: BoundaryRecord,
): void {
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
      context.renderCuratedPanel();
      persistSettingsInBackground(context);
    });
  });
}

function bindSortFilterInternal(context: CuratedInteractionsControlsContext, sortControl: BoundaryRecord): void {
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
      context.renderCuratedPanel();
      persistSettingsInBackground(context);
    });
  });
}

function bindSecondarySortFilterInternal(
  context: CuratedInteractionsControlsContext,
  secondarySortControl: BoundaryRecord,
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
      context.renderCuratedPanel();
      persistSettingsInBackground(context);
    });
  });
}

function bindRefreshButtonInternal(context: CuratedInteractionsControlsContext, refreshButton: BoundaryValue): void {
  const button = toButton(refreshButton) as MutableButtonLike | null;
  if (!button) {
    return;
  }

  let refreshInFlight: BoundaryPromise | null = null;

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
  controlsContext: BoundaryValue,
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

function createCuratedInteractionsControlsRuntimeInternal(): CuratedInteractionsControlsRuntime {
  return {
    bindCuratedInterfaceControls: (context, controlsContext) =>
      bindCuratedInterfaceControlsInternal(context, controlsContext),
  };
}

export function createCuratedInteractionsControlsRuntime(): CuratedInteractionsControlsRuntime {
  return createCuratedInteractionsControlsRuntimeInternal();
}
