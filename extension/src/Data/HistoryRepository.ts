import { createHistoryRepositoryCache } from './HistoryRepositoryCache.js';
import { createHistoryRepositoryPreload } from './HistoryRepositoryPreload.js';

type BoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, BoundaryValue>;

type WatchHistoryEntry = {
  seriesId: string;
  datePlayedMs: number;
  datePlayed: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteEpisodeNumber: number | null;
  episodeDurationMs: number | null;
  episodeId: string | null;
  identifier: string;
  canonicalEpisodeKey: string;
  episodeTitle: string;
  playhead: number;
  fullyWatched: boolean;
  audioLocale: string;
  audioLocaleInferred: boolean;
};

type WatchHistoryLocaleMap = Record<string, WatchHistoryEntry>;

type WatchHistoryCache = {
  version: number;
  accountId: string;
  updatedAt: number;
  bySeriesId: Record<string, WatchHistoryEntry>;
  bySeriesIdAudioLocale: Record<string, WatchHistoryLocaleMap>;
  bySeriesIdProgress: Record<string, WatchHistoryEntry>;
  bySeriesIdAudioLocaleProgress: Record<string, WatchHistoryLocaleMap>;
};

type WatchHistoryTokenEntry = {
  accessToken?: string;
  accountId?: string | null;
} & LooseRecord;

type HistoryRepositoryOptions = {
  state?: BoundaryValue;
  normalizeAudioLocale?: BoundaryValue;
  sanitizePositiveInt?: BoundaryValue;
  parseDateMs?: BoundaryValue;
  pickFirstPositiveInt?: BoundaryValue;
  deriveCanonicalEpisodeKeyFromEpisodeMetadata?: BoundaryValue;
  getAbsoluteEpisodeNumberFromEpisodeMetadata?: BoundaryValue;
  getPreferredAudioLanguage?: BoundaryValue;
  getLocale?: BoundaryValue;
  resolveApiHref?: BoundaryValue;
  fetchWithResilience?: BoundaryValue;
  createAuthRefreshHandler?: BoundaryValue;
  parsePayloadDataEnvelope?: BoundaryValue;
  auditWatchHistoryRowsContract?: BoundaryValue;
  createEmptyWatchHistoryCache?: BoundaryValue;
  scheduleSaveWatchHistory?: BoundaryValue;
  pushApiTrace?: BoundaryValue;
  runtimeEvent?: BoundaryValue;
  watchHistoryCacheVersion?: BoundaryValue;
  watchHistoryCacheTtlMs?: BoundaryValue;
  watchHistoryPageSize?: BoundaryValue;
  watchHistoryMaxPages?: BoundaryValue;
  watchHistoryNoMatchPageLimit?: BoundaryValue;
};

type HistoryRepository = {
  normalizeStoredWatchHistoryCache: (raw: BoundaryValue) => WatchHistoryCache;
  isWatchHistoryCacheValid: (cache: WatchHistoryCache | LooseRecord | null | undefined, accountId?: string) => boolean;
  getCachedWatchHistory: (
    seriesId: string,
    audioLocale?: string,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null;
  getCachedWatchHistoryProgress: (
    seriesId: string,
    audioLocale?: string,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null;
  preloadWatchHistoryForEntries: (
    entries: LooseRecord[],
    tokenEntry: WatchHistoryTokenEntry | null,
    force?: boolean,
    preferredAudioLanguage?: string,
  ) => Promise<BoundaryValue>;
  isLocalizedWatchHistoryDataMissingForEntries: (entries: LooseRecord[], audioLocale: string) => boolean;
};

type HistoryRepositoryCache = {
  normalizeStoredWatchHistoryCache: (raw: BoundaryValue) => WatchHistoryCache;
  normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: BoundaryValue) => Record<string, WatchHistoryLocaleMap>;
  normalizeWatchHistoryEntry: (value: BoundaryValue) => WatchHistoryEntry | null;
  isWatchHistoryCacheValid: (cache: WatchHistoryCache | LooseRecord | null | undefined, accountId?: string) => boolean;
  shouldReplaceWatchHistoryProgress: (
    previous: LooseRecord | WatchHistoryEntry | null | undefined,
    next: LooseRecord | WatchHistoryEntry | null | undefined,
  ) => boolean;
  getCachedWatchHistory: (
    seriesId: string,
    audioLocale?: string,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null;
  getCachedWatchHistoryProgress: (
    seriesId: string,
    audioLocale?: string,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null;
};

type HistoryRepositoryPreload = {
  preloadWatchHistoryForEntries: (
    entries: LooseRecord[],
    tokenEntry: WatchHistoryTokenEntry | null,
    force?: boolean,
    preferredAudioLanguage?: string,
  ) => Promise<BoundaryValue>;
  isLocalizedWatchHistoryDataMissingForEntries: (entries: LooseRecord[], audioLocale: string) => boolean;
};

function toRecord(value: BoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as LooseRecord;
}

function assertCacheRepository(value: BoundaryValue): asserts value is HistoryRepositoryCache {
  const cacheRepository = toRecord(value);
  const requiredMethods = [
    'normalizeStoredWatchHistoryCache',
    'normalizeStoredWatchHistoryBySeriesAudioLocale',
    'normalizeWatchHistoryEntry',
    'isWatchHistoryCacheValid',
    'shouldReplaceWatchHistoryProgress',
    'getCachedWatchHistory',
    'getCachedWatchHistoryProgress',
  ];

  requiredMethods.forEach((methodName) => {
    if (typeof cacheRepository[methodName] !== 'function') {
      throw new Error(`[CW] Missing history cache repository method: ${methodName}`);
    }
  });
}

function assertPreloadRepository(value: BoundaryValue): asserts value is HistoryRepositoryPreload {
  const preloadRepository = toRecord(value);
  const requiredMethods = ['preloadWatchHistoryForEntries', 'isLocalizedWatchHistoryDataMissingForEntries'];

  requiredMethods.forEach((methodName) => {
    if (typeof preloadRepository[methodName] !== 'function') {
      throw new Error(`[CW] Missing history preload repository method: ${methodName}`);
    }
  });
}

function createHistoryRepository(options: HistoryRepositoryOptions = {}): HistoryRepository {
  let cacheRepositoryCandidate: object;
  try {
    cacheRepositoryCandidate = createHistoryRepositoryCache(options) as object;
  } catch {
    throw new Error('[CW] Missing history repository dependency: createHistoryRepositoryCache');
  }
  assertCacheRepository(cacheRepositoryCandidate);
  const cacheRepository = cacheRepositoryCandidate;

  let preloadRepositoryCandidate: object;
  try {
    preloadRepositoryCandidate = createHistoryRepositoryPreload({
      ...options,
      normalizeStoredWatchHistoryCache: cacheRepository.normalizeStoredWatchHistoryCache,
      normalizeStoredWatchHistoryBySeriesAudioLocale: cacheRepository.normalizeStoredWatchHistoryBySeriesAudioLocale,
      normalizeWatchHistoryEntry: cacheRepository.normalizeWatchHistoryEntry,
      isWatchHistoryCacheValid: cacheRepository.isWatchHistoryCacheValid,
      shouldReplaceWatchHistoryProgress: cacheRepository.shouldReplaceWatchHistoryProgress,
      getCachedWatchHistory: cacheRepository.getCachedWatchHistory,
    }) as object;
  } catch {
    throw new Error('[CW] Missing history repository dependency: createHistoryRepositoryPreload');
  }
  assertPreloadRepository(preloadRepositoryCandidate);
  const preloadRepository = preloadRepositoryCandidate;

  return {
    normalizeStoredWatchHistoryCache: cacheRepository.normalizeStoredWatchHistoryCache,
    isWatchHistoryCacheValid: cacheRepository.isWatchHistoryCacheValid,
    getCachedWatchHistory: cacheRepository.getCachedWatchHistory,
    getCachedWatchHistoryProgress: cacheRepository.getCachedWatchHistoryProgress,
    preloadWatchHistoryForEntries: preloadRepository.preloadWatchHistoryForEntries,
    isLocalizedWatchHistoryDataMissingForEntries: preloadRepository.isLocalizedWatchHistoryDataMissingForEntries,
  };
}

const historyRepositoryRuntime = {
  createHistoryRepository,
};

export function createHistoryRepositoryRuntime(): object {
  return historyRepositoryRuntime;
}
