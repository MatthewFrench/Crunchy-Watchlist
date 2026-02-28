import {
  getCachedWatchHistory,
  getCachedWatchHistoryProgress,
  type HistoryRepositoryCacheContext,
  isWatchHistoryCacheValid,
  type LooseRecord,
  normalizeStoredWatchHistoryBySeriesAudioLocale,
  normalizeStoredWatchHistoryCache,
  normalizeWatchHistoryEntry,
  shouldReplaceWatchHistoryProgress,
  type WatchHistoryCache,
  type WatchHistoryEntry,
  type WatchHistoryLocaleMap,
  type WatchHistoryState,
} from './HistoryRepositoryCacheNormalization.js';

(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type HistoryRepositoryCacheOptions = {
    state?: unknown;
    normalizeAudioLocale?: unknown;
    sanitizePositiveInt?: unknown;
    parseDateMs?: unknown;
    pickFirstPositiveInt?: unknown;
    deriveCanonicalEpisodeKeyFromEpisodeMetadata?: unknown;
    createEmptyWatchHistoryCache?: unknown;
    watchHistoryCacheVersion?: unknown;
    watchHistoryCacheTtlMs?: unknown;
  };

  type HistoryRepositoryCache = {
    normalizeStoredWatchHistoryCache: (raw: unknown) => WatchHistoryCache;
    normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: unknown) => Record<string, WatchHistoryLocaleMap>;
    normalizeWatchHistoryEntry: (value: unknown) => WatchHistoryEntry | null;
    isWatchHistoryCacheValid: (cache: unknown, accountId?: unknown) => boolean;
    shouldReplaceWatchHistoryProgress: (
      previous: LooseRecord | null | undefined,
      next: LooseRecord | null | undefined,
    ) => boolean;
    getCachedWatchHistory: (
      seriesId: unknown,
      audioLocale?: unknown,
      allowSeriesFallback?: boolean,
    ) => WatchHistoryEntry | null;
    getCachedWatchHistoryProgress: (
      seriesId: unknown,
      audioLocale?: unknown,
      allowSeriesFallback?: boolean,
    ) => WatchHistoryEntry | null;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing history cache dependency: ${name}`);
    }
    return value as T;
  }

  function toWatchHistoryState(value: unknown): WatchHistoryState | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as WatchHistoryState;
  }

  function createHistoryRepositoryCacheContext(
    options: HistoryRepositoryCacheOptions = {},
  ): HistoryRepositoryCacheContext {
    const state = toWatchHistoryState(options.state);
    if (!state) {
      throw new Error('[CW] Missing history repository state');
    }

    return {
      state,
      normalizeAudioLocale: requireFunction(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ) as HistoryRepositoryCacheContext['normalizeAudioLocale'],
      sanitizePositiveInt: requireFunction(
        'sanitizePositiveInt',
        options.sanitizePositiveInt,
      ) as HistoryRepositoryCacheContext['sanitizePositiveInt'],
      parseDateMs: requireFunction('parseDateMs', options.parseDateMs) as HistoryRepositoryCacheContext['parseDateMs'],
      pickFirstPositiveInt: requireFunction(
        'pickFirstPositiveInt',
        options.pickFirstPositiveInt,
      ) as HistoryRepositoryCacheContext['pickFirstPositiveInt'],
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: requireFunction(
        'deriveCanonicalEpisodeKeyFromEpisodeMetadata',
        options.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      ) as HistoryRepositoryCacheContext['deriveCanonicalEpisodeKeyFromEpisodeMetadata'],
      createEmptyWatchHistoryCache: requireFunction(
        'createEmptyWatchHistoryCache',
        options.createEmptyWatchHistoryCache,
      ) as HistoryRepositoryCacheContext['createEmptyWatchHistoryCache'],
      watchHistoryCacheVersion: Number(options.watchHistoryCacheVersion) || 0,
      watchHistoryCacheTtlMs: Math.max(1, Number(options.watchHistoryCacheTtlMs) || 1),
    };
  }

  function createHistoryRepositoryCache(options: HistoryRepositoryCacheOptions = {}): HistoryRepositoryCache {
    const context = createHistoryRepositoryCacheContext(options);

    return {
      normalizeStoredWatchHistoryCache: (raw: unknown) => normalizeStoredWatchHistoryCache(context, raw),
      normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: unknown) =>
        normalizeStoredWatchHistoryBySeriesAudioLocale(context, raw),
      normalizeWatchHistoryEntry: (value: unknown) => normalizeWatchHistoryEntry(context, value as LooseRecord),
      isWatchHistoryCacheValid: (cache: unknown, accountId?: unknown) =>
        isWatchHistoryCacheValid(context, cache, accountId),
      shouldReplaceWatchHistoryProgress: (
        previous: LooseRecord | null | undefined,
        next: LooseRecord | null | undefined,
      ) => shouldReplaceWatchHistoryProgress(context, previous, next),
      getCachedWatchHistory: (seriesId: unknown, audioLocale?: unknown, allowSeriesFallback = true) =>
        getCachedWatchHistory(context, seriesId, audioLocale, allowSeriesFallback),
      getCachedWatchHistoryProgress: (seriesId: unknown, audioLocale?: unknown, allowSeriesFallback = true) =>
        getCachedWatchHistoryProgress(context, seriesId, audioLocale, allowSeriesFallback),
    };
  }

  moduleRegistry.historyRepositoryCache = {
    createHistoryRepositoryCache,
  };
})();
