type RuntimeBootstrapHelpers = {
  createBootstrapHelpersRuntime: (options?: BoundaryValue) => object;
};

type BoundaryValue = LooseRecord[string];
type BoundaryArray = BoundaryValue[];
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryPromise = Promise<BoundaryValue>;
type BoundaryFn = (...args: BoundaryValue[]) => BoundaryValue;

type RuntimeState = {
  curatedEntries: BoundaryArray;
  curatedLastRevalidateAt: number;
  ratingLocalePreloadInflight: Map<string, BoundaryPromise>;
  watchHistoryLocalePreloadInflight: Map<string, BoundaryPromise>;
  preferredAudioLanguage: string;
  preferredAudioLanguageUpdatedAt: number;
  settings: BoundaryRecord;
  hostEl: Element | null;
  mutationMuted: boolean;
  ratingCache: BoundaryValue;
  watchHistoryCache: BoundaryValue;
  watchlistCache: BoundaryValue;
  saveRatingsTimer?: number;
  saveWatchHistoryTimer?: number;
  saveWatchlistCacheTimer?: number;
};

type TokenEntry = {
  accessToken?: BoundaryValue;
  accountId?: BoundaryValue;
};

type BootstrapHelpersContext = {
  state: RuntimeState;
  windowRef: Window;
  runtimeEvent: (event: string, data?: BoundaryValue) => void;
  storageSet: (key: string, value: BoundaryValue) => BoundaryPromise;
  settingsKey: string;
  ratingCacheKey: string;
  watchHistoryCacheKey: string;
  watchlistCacheKey: string;
  preferredAudioCacheTtlMs: number;
  normalizeAudioLocale: (value: BoundaryValue) => string;
  detectPreferredAudioLanguage: () => string;
  isLocalizedRatingDataMissingForEntries: (entries: BoundaryArray, audioLocale: BoundaryValue) => boolean;
  isLocalizedWatchHistoryDataMissingForEntries: (entries: BoundaryArray, audioLocale: BoundaryValue) => boolean;
  getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null | undefined>;
  preloadRatingsForEntries: (
    entries: BoundaryArray,
    tokenEntry: TokenEntry,
    preferredAudioLanguage?: BoundaryValue,
  ) => BoundaryPromise;
  preloadWatchHistoryForEntries: (
    entries: BoundaryArray,
    tokenEntry: TokenEntry,
    force?: boolean,
    preferredAudioLanguage?: BoundaryValue,
  ) => BoundaryPromise;
};

type BootstrapHelpersOptions = {
  state?: BoundaryValue;
  windowRef?: BoundaryValue;
  runtimeEvent?: BoundaryValue;
  storageSet?: BoundaryValue;
  settingsKey?: BoundaryValue;
  ratingCacheKey?: BoundaryValue;
  watchHistoryCacheKey?: BoundaryValue;
  watchlistCacheKey?: BoundaryValue;
  preferredAudioCacheTtlMs?: BoundaryValue;
  normalizeAudioLocale?: BoundaryValue;
  detectPreferredAudioLanguage?: BoundaryValue;
  isLocalizedRatingDataMissingForEntries?: BoundaryValue;
  isLocalizedWatchHistoryDataMissingForEntries?: BoundaryValue;
  getAccessToken?: BoundaryValue;
  preloadRatingsForEntries?: BoundaryValue;
  preloadWatchHistoryForEntries?: BoundaryValue;
};

type BootstrapHelpersRuntime = {
  scheduleSaveRatings: () => void;
  scheduleSaveWatchHistory: () => void;
  scheduleSaveWatchlistCache: () => void;
  getPreferredAudioLanguage: () => string;
  preloadRatingsForSelectedAudioLocale: (audioLocale: BoundaryValue) => BoundaryPromise;
  preloadWatchHistoryForSelectedAudioLocale: (audioLocale: BoundaryValue) => BoundaryPromise;
  toggleCuratedFavorite: (seriesId: BoundaryValue) => void;
  removeCuratedSeries: (seriesId: BoundaryValue) => void;
  isLikelyVideoUrl: (url: BoundaryValue) => boolean;
  isEntryWatchReady: (entry: BoundaryValue) => boolean;
  withMutedObserver: (work: () => void) => void;
  applyCardLayoutUi: () => void;
  persistSettings: () => BoundaryPromise;
};

type MutableRecord = BoundaryRecord;

const ratingLocalePreloadRevisionByState = new WeakMap<RuntimeState, Map<string, number>>();
const watchHistoryLocalePreloadRevisionByState = new WeakMap<RuntimeState, Map<string, number>>();

function requireFunction<T extends BoundaryFn>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing bootstrap helpers dependency: ${name}`);
  }
  return value as T;
}

function requireString(name: string, value: BoundaryValue): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`[CW] Missing bootstrap helpers dependency: ${name}`);
  }
  return value;
}

function normalizePositiveNumber(value: BoundaryValue, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.round(number);
}

function toBootstrapHelpersOptions(value: BoundaryValue): BootstrapHelpersOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as BootstrapHelpersOptions;
}

function asRuntimeState(value: BoundaryValue): RuntimeState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as RuntimeState;
}

function resolveWindowRef(value: BoundaryValue): Window | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as MutableRecord;
  if (typeof record.setTimeout !== 'function' || typeof record.clearTimeout !== 'function') {
    return null;
  }
  return value as Window;
}

function getString(value: BoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getEntriesArray(value: BoundaryValue): BoundaryArray {
  return Array.isArray(value) ? value : [];
}

function getOrCreateLocalePreloadRevisionMap(
  cache: WeakMap<RuntimeState, Map<string, number>>,
  state: RuntimeState,
): Map<string, number> {
  const existing = cache.get(state);
  if (existing) {
    return existing;
  }

  const created = new Map<string, number>();
  cache.set(state, created);
  return created;
}

function getCuratedDataRevision(state: RuntimeState): number {
  const revision = Number(state.curatedLastRevalidateAt);
  return Number.isFinite(revision) && revision > 0 ? Math.round(revision) : 0;
}

function createBootstrapHelpersContext(options: BootstrapHelpersOptions = {}): BootstrapHelpersContext {
  const state = asRuntimeState(options.state);
  if (!state) {
    throw new Error('[CW] Missing bootstrap helpers state');
  }

  const windowRef = resolveWindowRef(options.windowRef);
  if (!windowRef) {
    throw new Error('[CW] Missing bootstrap helpers windowRef');
  }

  return {
    state,
    windowRef,
    runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as BootstrapHelpersContext['runtimeEvent'],
    storageSet: requireFunction('storageSet', options.storageSet) as BootstrapHelpersContext['storageSet'],
    settingsKey: requireString('settingsKey', options.settingsKey),
    ratingCacheKey: requireString('ratingCacheKey', options.ratingCacheKey),
    watchHistoryCacheKey: requireString('watchHistoryCacheKey', options.watchHistoryCacheKey),
    watchlistCacheKey: requireString('watchlistCacheKey', options.watchlistCacheKey),
    preferredAudioCacheTtlMs: normalizePositiveNumber(options.preferredAudioCacheTtlMs, 120_000),
    normalizeAudioLocale: requireFunction(
      'normalizeAudioLocale',
      options.normalizeAudioLocale,
    ) as BootstrapHelpersContext['normalizeAudioLocale'],
    detectPreferredAudioLanguage: requireFunction(
      'detectPreferredAudioLanguage',
      options.detectPreferredAudioLanguage,
    ) as BootstrapHelpersContext['detectPreferredAudioLanguage'],
    isLocalizedRatingDataMissingForEntries: requireFunction(
      'isLocalizedRatingDataMissingForEntries',
      options.isLocalizedRatingDataMissingForEntries,
    ) as BootstrapHelpersContext['isLocalizedRatingDataMissingForEntries'],
    isLocalizedWatchHistoryDataMissingForEntries: requireFunction(
      'isLocalizedWatchHistoryDataMissingForEntries',
      options.isLocalizedWatchHistoryDataMissingForEntries,
    ) as BootstrapHelpersContext['isLocalizedWatchHistoryDataMissingForEntries'],
    getAccessToken: requireFunction(
      'getAccessToken',
      options.getAccessToken,
    ) as BootstrapHelpersContext['getAccessToken'],
    preloadRatingsForEntries: requireFunction(
      'preloadRatingsForEntries',
      options.preloadRatingsForEntries,
    ) as BootstrapHelpersContext['preloadRatingsForEntries'],
    preloadWatchHistoryForEntries: requireFunction(
      'preloadWatchHistoryForEntries',
      options.preloadWatchHistoryForEntries,
    ) as BootstrapHelpersContext['preloadWatchHistoryForEntries'],
  };
}

function scheduleStateSaveInternal(
  context: BootstrapHelpersContext,
  timerKey: 'saveRatingsTimer' | 'saveWatchHistoryTimer' | 'saveWatchlistCacheTimer',
  storageKey: string,
  getValue: () => BoundaryValue,
): void {
  context.windowRef.clearTimeout(context.state[timerKey]);
  context.state[timerKey] = context.windowRef.setTimeout(() => {
    context.storageSet(storageKey, getValue()).catch(() => {
      // no-op
    });
  }, 250);
}

function getPreferredAudioLanguageInternal(context: BootstrapHelpersContext): string {
  const now = Date.now();
  if (
    context.state.preferredAudioLanguage &&
    now - Number(context.state.preferredAudioLanguageUpdatedAt || 0) < context.preferredAudioCacheTtlMs
  ) {
    return context.state.preferredAudioLanguage;
  }

  const detectedPreferredAudioLanguage = context.detectPreferredAudioLanguage() || 'en-US';
  const normalizedPreferredAudioLanguage = context.normalizeAudioLocale(detectedPreferredAudioLanguage) || 'en-US';
  const previousPreferredAudioLanguage = context.state.preferredAudioLanguage;

  context.state.preferredAudioLanguage = normalizedPreferredAudioLanguage;
  context.state.preferredAudioLanguageUpdatedAt = now;

  if (previousPreferredAudioLanguage !== normalizedPreferredAudioLanguage) {
    context.runtimeEvent('preferred-audio-language-detected', {
      locale: normalizedPreferredAudioLanguage,
    });
  }

  return normalizedPreferredAudioLanguage;
}

async function preloadRatingsForSelectedAudioLocaleInternal(
  context: BootstrapHelpersContext,
  audioLocale: BoundaryValue,
): BoundaryPromise {
  const selectedAudioLocale = context.normalizeAudioLocale(audioLocale);
  const entries = getEntriesArray(context.state.curatedEntries);
  if (!selectedAudioLocale || !entries.length) {
    return;
  }

  if (!context.isLocalizedRatingDataMissingForEntries(entries, selectedAudioLocale)) {
    return;
  }

  const localeKey = selectedAudioLocale.toLowerCase();
  const localeRevisionMap = getOrCreateLocalePreloadRevisionMap(ratingLocalePreloadRevisionByState, context.state);
  const curatedDataRevision = getCuratedDataRevision(context.state);
  const previousRevision = localeRevisionMap.get(localeKey);
  if (previousRevision != null && previousRevision === curatedDataRevision) {
    return;
  }

  if (context.state.ratingLocalePreloadInflight.has(localeKey)) {
    return context.state.ratingLocalePreloadInflight.get(localeKey);
  }

  const inflight = (async () => {
    const tokenEntry = await context.getAccessToken(false);
    if (!tokenEntry?.accessToken) {
      return;
    }

    await context.preloadRatingsForEntries(entries, tokenEntry, selectedAudioLocale);
    localeRevisionMap.set(localeKey, curatedDataRevision);
  })().finally(() => {
    if (context.state.ratingLocalePreloadInflight.get(localeKey) === inflight) {
      context.state.ratingLocalePreloadInflight.delete(localeKey);
    }
  });

  context.state.ratingLocalePreloadInflight.set(localeKey, inflight);
  return inflight;
}

async function preloadWatchHistoryForSelectedAudioLocaleInternal(
  context: BootstrapHelpersContext,
  audioLocale: BoundaryValue,
): BoundaryPromise {
  const selectedAudioLocale = context.normalizeAudioLocale(audioLocale);
  const entries = getEntriesArray(context.state.curatedEntries);
  if (!selectedAudioLocale || !entries.length) {
    return;
  }

  if (!context.isLocalizedWatchHistoryDataMissingForEntries(entries, selectedAudioLocale)) {
    return;
  }

  const localeKey = selectedAudioLocale.toLowerCase();
  const localeRevisionMap = getOrCreateLocalePreloadRevisionMap(
    watchHistoryLocalePreloadRevisionByState,
    context.state,
  );
  const curatedDataRevision = getCuratedDataRevision(context.state);
  const previousRevision = localeRevisionMap.get(localeKey);
  if (previousRevision != null && previousRevision === curatedDataRevision) {
    return;
  }

  if (context.state.watchHistoryLocalePreloadInflight.has(localeKey)) {
    return context.state.watchHistoryLocalePreloadInflight.get(localeKey);
  }

  const inflight = (async () => {
    const tokenEntry = await context.getAccessToken(false);
    if (!tokenEntry?.accessToken || !tokenEntry?.accountId) {
      return;
    }

    await context.preloadWatchHistoryForEntries(entries, tokenEntry, true, selectedAudioLocale);
    localeRevisionMap.set(localeKey, curatedDataRevision);
  })().finally(() => {
    if (context.state.watchHistoryLocalePreloadInflight.get(localeKey) === inflight) {
      context.state.watchHistoryLocalePreloadInflight.delete(localeKey);
    }
  });

  context.state.watchHistoryLocalePreloadInflight.set(localeKey, inflight);
  return inflight;
}

function toggleCuratedFavoriteInternal(context: BootstrapHelpersContext, seriesIdValue: BoundaryValue): void {
  const seriesId = getString(seriesIdValue);
  if (!seriesId) {
    return;
  }

  let changed = false;
  const nextEntries = getEntriesArray(context.state.curatedEntries).map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }
    const record = entry as MutableRecord;
    if (record.seriesId !== seriesId) {
      return entry;
    }
    changed = true;
    return {
      ...record,
      isFavorite: !record.isFavorite,
    };
  });
  if (!changed) {
    return;
  }
  context.state.curatedEntries = nextEntries;
}

function removeCuratedSeriesInternal(context: BootstrapHelpersContext, seriesIdValue: BoundaryValue): void {
  const seriesId = getString(seriesIdValue);
  if (!seriesId) {
    return;
  }

  let changed = false;
  const nextEntries = getEntriesArray(context.state.curatedEntries).filter((entry) => {
    if (!entry || typeof entry !== 'object') {
      return true;
    }
    const shouldKeep = (entry as MutableRecord).seriesId !== seriesId;
    if (!shouldKeep) {
      changed = true;
    }
    return shouldKeep;
  });
  if (!changed) {
    return;
  }
  context.state.curatedEntries = nextEntries;
}

function withMutedObserverInternal(context: BootstrapHelpersContext, work: () => void): void {
  context.state.mutationMuted = true;
  try {
    work();
  } finally {
    context.windowRef.setTimeout(() => {
      context.state.mutationMuted = false;
    }, 0);
  }
}

function applyCardLayoutUiInternal(context: BootstrapHelpersContext): void {
  if (!context.state.hostEl || typeof context.state.hostEl !== 'object') {
    return;
  }
  const hostElement = context.state.hostEl as Element & { dataset?: DOMStringMap };
  if (!hostElement.dataset || typeof hostElement.dataset !== 'object') {
    return;
  }

  const layout = context.state.settings.cardLayout === 'landscape' ? 'landscape' : 'portrait';
  const dataset = hostElement.dataset;
  if (dataset.cwCardLayout === layout) {
    return;
  }
  dataset.cwCardLayout = layout;
}

async function persistSettingsInternal(context: BootstrapHelpersContext): BoundaryPromise {
  return context.storageSet(context.settingsKey, context.state.settings);
}

function isLikelyVideoUrlInternal(url: BoundaryValue): boolean {
  return typeof url === 'string' && /\.(m3u8|mp4|webm|m4v|mpd)(\?|$)/i.test(url);
}

function isEntryWatchReadyInternal(entry: BoundaryValue): boolean {
  return Boolean((entry as MutableRecord | null | undefined)?.watchReadyBase);
}

function createBootstrapHelpersRuntime(options: BootstrapHelpersOptions = {}): BootstrapHelpersRuntime {
  const context = createBootstrapHelpersContext(options);

  return {
    scheduleSaveRatings: () =>
      scheduleStateSaveInternal(context, 'saveRatingsTimer', context.ratingCacheKey, () => context.state.ratingCache),
    scheduleSaveWatchHistory: () =>
      scheduleStateSaveInternal(
        context,
        'saveWatchHistoryTimer',
        context.watchHistoryCacheKey,
        () => context.state.watchHistoryCache,
      ),
    scheduleSaveWatchlistCache: () =>
      scheduleStateSaveInternal(
        context,
        'saveWatchlistCacheTimer',
        context.watchlistCacheKey,
        () => context.state.watchlistCache,
      ),
    getPreferredAudioLanguage: () => getPreferredAudioLanguageInternal(context),
    preloadRatingsForSelectedAudioLocale: (audioLocale) =>
      preloadRatingsForSelectedAudioLocaleInternal(context, audioLocale),
    preloadWatchHistoryForSelectedAudioLocale: (audioLocale) =>
      preloadWatchHistoryForSelectedAudioLocaleInternal(context, audioLocale),
    toggleCuratedFavorite: (seriesId) => toggleCuratedFavoriteInternal(context, seriesId),
    removeCuratedSeries: (seriesId) => removeCuratedSeriesInternal(context, seriesId),
    isLikelyVideoUrl: (url) => isLikelyVideoUrlInternal(url),
    isEntryWatchReady: (entry) => isEntryWatchReadyInternal(entry),
    withMutedObserver: (work) => withMutedObserverInternal(context, work),
    applyCardLayoutUi: () => applyCardLayoutUiInternal(context),
    persistSettings: () => persistSettingsInternal(context),
  };
}

const runtimeBootstrapHelpers: RuntimeBootstrapHelpers = {
  createBootstrapHelpersRuntime: (options = {}) => createBootstrapHelpersRuntime(toBootstrapHelpersOptions(options)),
};

export function createRuntimeBootstrapHelpersRuntime(): RuntimeBootstrapHelpers {
  return runtimeBootstrapHelpers;
}
