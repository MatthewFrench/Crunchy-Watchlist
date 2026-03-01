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

type BoundaryValue = CwBoundaryValue;
type BoundaryFunction = (...args: BoundaryValue[]) => BoundaryValue;

type HistoryRepositoryCacheDependencyContract = Omit<
  HistoryRepositoryCacheContext,
  'state' | 'watchHistoryCacheVersion' | 'watchHistoryCacheTtlMs'
>;

type HistoryRepositoryCacheOptions = {
  state?: BoundaryValue;
  watchHistoryCacheVersion?: BoundaryValue;
  watchHistoryCacheTtlMs?: BoundaryValue;
} & {
  [K in keyof HistoryRepositoryCacheDependencyContract]?: BoundaryValue;
};

type HistoryRepositoryCache = {
  normalizeStoredWatchHistoryCache: (raw: BoundaryValue) => WatchHistoryCache;
  normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: BoundaryValue) => Record<string, WatchHistoryLocaleMap>;
  normalizeWatchHistoryEntry: (value: BoundaryValue) => WatchHistoryEntry | null;
  isWatchHistoryCacheValid: (cache: BoundaryValue, accountId?: BoundaryValue) => boolean;
  shouldReplaceWatchHistoryProgress: (
    previous: LooseRecord | null | undefined,
    next: LooseRecord | null | undefined,
  ) => boolean;
  getCachedWatchHistory: (
    seriesId: BoundaryValue,
    audioLocale?: BoundaryValue,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null;
  getCachedWatchHistoryProgress: (
    seriesId: BoundaryValue,
    audioLocale?: BoundaryValue,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null;
};

function requireFunction<T extends BoundaryFunction>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing history cache dependency: ${name}`);
  }
  return value as T;
}

function toWatchHistoryState(value: BoundaryValue): WatchHistoryState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as WatchHistoryState;
}

function requireContextFunction<K extends keyof HistoryRepositoryCacheDependencyContract>(
  options: HistoryRepositoryCacheOptions,
  name: K,
): HistoryRepositoryCacheDependencyContract[K] {
  return requireFunction(String(name), options[name]) as HistoryRepositoryCacheDependencyContract[K];
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
    normalizeAudioLocale: requireContextFunction(options, 'normalizeAudioLocale'),
    sanitizePositiveInt: requireContextFunction(options, 'sanitizePositiveInt'),
    parseDateMs: requireContextFunction(options, 'parseDateMs'),
    pickFirstPositiveInt: requireContextFunction(options, 'pickFirstPositiveInt'),
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: requireContextFunction(
      options,
      'deriveCanonicalEpisodeKeyFromEpisodeMetadata',
    ),
    createEmptyWatchHistoryCache: requireContextFunction(options, 'createEmptyWatchHistoryCache'),
    watchHistoryCacheVersion: Number(options.watchHistoryCacheVersion) || 0,
    watchHistoryCacheTtlMs: Math.max(1, Number(options.watchHistoryCacheTtlMs) || 1),
  };
}

function createHistoryRepositoryCacheInternal(options: HistoryRepositoryCacheOptions = {}): HistoryRepositoryCache {
  const context = createHistoryRepositoryCacheContext(options);

  return {
    normalizeStoredWatchHistoryCache: (raw: BoundaryValue) => normalizeStoredWatchHistoryCache(context, raw),
    normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: BoundaryValue) =>
      normalizeStoredWatchHistoryBySeriesAudioLocale(context, raw),
    normalizeWatchHistoryEntry: (value: BoundaryValue) => normalizeWatchHistoryEntry(context, value as LooseRecord),
    isWatchHistoryCacheValid: (cache: BoundaryValue, accountId?: BoundaryValue) =>
      isWatchHistoryCacheValid(context, cache, accountId),
    shouldReplaceWatchHistoryProgress: (
      previous: LooseRecord | null | undefined,
      next: LooseRecord | null | undefined,
    ) => shouldReplaceWatchHistoryProgress(context, previous, next),
    getCachedWatchHistory: (seriesId: BoundaryValue, audioLocale?: BoundaryValue, allowSeriesFallback = true) =>
      getCachedWatchHistory(context, seriesId, audioLocale, allowSeriesFallback),
    getCachedWatchHistoryProgress: (seriesId: BoundaryValue, audioLocale?: BoundaryValue, allowSeriesFallback = true) =>
      getCachedWatchHistoryProgress(context, seriesId, audioLocale, allowSeriesFallback),
  };
}

export function createHistoryRepositoryCache(options: BoundaryValue = {}): HistoryRepositoryCache {
  return createHistoryRepositoryCacheInternal(options as HistoryRepositoryCacheOptions);
}
