(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type RuntimeState = {
    curatedEntries: unknown[];
    ratingLocalePreloadInflight: Map<string, Promise<unknown>>;
    watchHistoryLocalePreloadInflight: Map<string, Promise<unknown>>;
    preferredAudioLanguage: string;
    preferredAudioLanguageUpdatedAt: number;
    settings: Record<string, unknown>;
    hostEl: Element | null;
    mutationMuted: boolean;
    ratingCache: unknown;
    watchHistoryCache: unknown;
    watchlistCache: unknown;
    saveRatingsTimer?: number;
    saveWatchHistoryTimer?: number;
    saveWatchlistCacheTimer?: number;
  };

  type TokenEntry = {
    accessToken?: unknown;
    accountId?: unknown;
  };

  type BootstrapHelpersContext = {
    state: RuntimeState;
    windowRef: Window;
    runtimeEvent: (event: string, data?: unknown) => void;
    storageSet: (key: string, value: unknown) => Promise<unknown>;
    settingsKey: string;
    ratingCacheKey: string;
    watchHistoryCacheKey: string;
    watchlistCacheKey: string;
    preferredAudioCacheTtlMs: number;
    normalizeAudioLocale: (value: unknown) => string;
    detectPreferredAudioLanguage: () => string;
    isLocalizedRatingDataMissingForEntries: (entries: unknown[], audioLocale: unknown) => boolean;
    isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown[], audioLocale: unknown) => boolean;
    getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null | undefined>;
    preloadRatingsForEntries: (
      entries: unknown[],
      tokenEntry: TokenEntry,
      preferredAudioLanguage?: unknown,
    ) => Promise<unknown>;
    preloadWatchHistoryForEntries: (
      entries: unknown[],
      tokenEntry: TokenEntry,
      force?: boolean,
      preferredAudioLanguage?: unknown,
    ) => Promise<unknown>;
  };

  type BootstrapHelpersOptions = {
    state?: unknown;
    windowRef?: unknown;
    runtimeEvent?: unknown;
    storageSet?: unknown;
    settingsKey?: unknown;
    ratingCacheKey?: unknown;
    watchHistoryCacheKey?: unknown;
    watchlistCacheKey?: unknown;
    preferredAudioCacheTtlMs?: unknown;
    normalizeAudioLocale?: unknown;
    detectPreferredAudioLanguage?: unknown;
    isLocalizedRatingDataMissingForEntries?: unknown;
    isLocalizedWatchHistoryDataMissingForEntries?: unknown;
    getAccessToken?: unknown;
    preloadRatingsForEntries?: unknown;
    preloadWatchHistoryForEntries?: unknown;
  };

  type BootstrapHelpersRuntime = {
    scheduleSaveRatings: () => void;
    scheduleSaveWatchHistory: () => void;
    scheduleSaveWatchlistCache: () => void;
    getPreferredAudioLanguage: () => string;
    preloadRatingsForSelectedAudioLocale: (audioLocale: unknown) => Promise<unknown>;
    preloadWatchHistoryForSelectedAudioLocale: (audioLocale: unknown) => Promise<unknown>;
    toggleCuratedFavorite: (seriesId: unknown) => void;
    removeCuratedSeries: (seriesId: unknown) => void;
    isLikelyVideoUrl: (url: unknown) => boolean;
    isEntryWatchReady: (entry: unknown) => boolean;
    withMutedObserver: (work: () => void) => void;
    applyCardLayoutUi: () => void;
    persistSettings: () => Promise<unknown>;
  };

  type MutableRecord = Record<string, unknown>;

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing bootstrap helpers dependency: ${name}`);
    }
    return value as T;
  }

  function requireString(name: string, value: unknown): string {
    if (typeof value !== 'string' || !value) {
      throw new Error(`[CW] Missing bootstrap helpers dependency: ${name}`);
    }
    return value;
  }

  function normalizePositiveNumber(value: unknown, fallback: number): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
      return fallback;
    }
    return Math.round(number);
  }

  function asRuntimeState(value: unknown): RuntimeState | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as RuntimeState;
  }

  function resolveWindowRef(value: unknown): Window | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const record = value as MutableRecord;
    if (typeof record.setTimeout !== 'function' || typeof record.clearTimeout !== 'function') {
      return null;
    }
    return value as Window;
  }

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  function getEntriesArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
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
    getValue: () => unknown,
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
    audioLocale: unknown,
  ): Promise<unknown> {
    const selectedAudioLocale = context.normalizeAudioLocale(audioLocale);
    const entries = getEntriesArray(context.state.curatedEntries);
    if (!selectedAudioLocale || !entries.length) {
      return;
    }

    if (!context.isLocalizedRatingDataMissingForEntries(entries, selectedAudioLocale)) {
      return;
    }

    const localeKey = selectedAudioLocale.toLowerCase();
    if (context.state.ratingLocalePreloadInflight.has(localeKey)) {
      return context.state.ratingLocalePreloadInflight.get(localeKey);
    }

    const inflight = (async () => {
      const tokenEntry = await context.getAccessToken(false);
      if (!tokenEntry?.accessToken) {
        return;
      }

      await context.preloadRatingsForEntries(entries, tokenEntry, selectedAudioLocale);
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
    audioLocale: unknown,
  ): Promise<unknown> {
    const selectedAudioLocale = context.normalizeAudioLocale(audioLocale);
    const entries = getEntriesArray(context.state.curatedEntries);
    if (!selectedAudioLocale || !entries.length) {
      return;
    }

    if (!context.isLocalizedWatchHistoryDataMissingForEntries(entries, selectedAudioLocale)) {
      return;
    }

    const localeKey = selectedAudioLocale.toLowerCase();
    if (context.state.watchHistoryLocalePreloadInflight.has(localeKey)) {
      return context.state.watchHistoryLocalePreloadInflight.get(localeKey);
    }

    const inflight = (async () => {
      const tokenEntry = await context.getAccessToken(false);
      if (!tokenEntry?.accessToken || !tokenEntry?.accountId) {
        return;
      }

      await context.preloadWatchHistoryForEntries(entries, tokenEntry, true, selectedAudioLocale);
    })().finally(() => {
      if (context.state.watchHistoryLocalePreloadInflight.get(localeKey) === inflight) {
        context.state.watchHistoryLocalePreloadInflight.delete(localeKey);
      }
    });

    context.state.watchHistoryLocalePreloadInflight.set(localeKey, inflight);
    return inflight;
  }

  function toggleCuratedFavoriteInternal(context: BootstrapHelpersContext, seriesIdValue: unknown): void {
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

  function removeCuratedSeriesInternal(context: BootstrapHelpersContext, seriesIdValue: unknown): void {
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
    const hostRecord = context.state.hostEl as unknown as MutableRecord;
    if (!hostRecord.dataset || typeof hostRecord.dataset !== 'object') {
      return;
    }

    const layout = context.state.settings.cardLayout === 'landscape' ? 'landscape' : 'portrait';
    const dataset = hostRecord.dataset as MutableRecord;
    if (dataset.cwCardLayout === layout) {
      return;
    }
    dataset.cwCardLayout = layout;
  }

  async function persistSettingsInternal(context: BootstrapHelpersContext): Promise<unknown> {
    return context.storageSet(context.settingsKey, context.state.settings);
  }

  function isLikelyVideoUrlInternal(url: unknown): boolean {
    return typeof url === 'string' && /\.(m3u8|mp4|webm|m4v|mpd)(\?|$)/i.test(url);
  }

  function isEntryWatchReadyInternal(entry: unknown): boolean {
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

  moduleRegistry.runtimeBootstrapHelpers = {
    createBootstrapHelpersRuntime,
  };
})();
