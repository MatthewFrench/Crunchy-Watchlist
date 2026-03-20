import { resetRuntimePerfDiagnostics } from './RuntimePerfDiagnostics.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryArray = BoundaryValue[];
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryPromise = Promise<BoundaryValue>;

type WatchHistoryCache = {
  version: number;
  accountId: string;
  updatedAt: number;
  bySeriesId: BoundaryRecord;
  bySeriesIdAudioLocale: BoundaryRecord;
  bySeriesIdProgress: BoundaryRecord;
  bySeriesIdAudioLocaleProgress: BoundaryRecord;
};

type WatchlistCacheSnapshot = {
  accountId: string;
  profileId: string;
  updatedAt: number;
  rows: BoundaryArray;
};

type CuratedDomLifecycleCounters = {
  created: number;
  patched: number;
  parked: number;
  unparked: number;
  disposed: number;
  renderPasses: number;
};

type WatchHistoryPreloadAttemptDiagnostics = {
  totalAttempts: number;
  byLocale: BoundaryRecord;
  byLocaleRevision: BoundaryRecord;
  lastAttempt: BoundaryRecord | null;
};

type ApiTraceBuckets = {
  authToken: BoundaryArray;
  watchlist: BoundaryArray;
  watchHistory: BoundaryArray;
  cmsObjects: BoundaryArray;
  legacyRating: BoundaryArray;
  preview: BoundaryArray;
};

type RuntimeStateOptions = {
  defaultSettings?: BoundaryRecord;
  watchHistoryCacheVersion?: BoundaryValue;
};

type NativeVisibilityRecord = {
  node: Element;
  previousDisplay: string;
};

type RuntimeState = {
  mounted: boolean;
  observer: MutationObserver | null;
  routeWatcherStarted: boolean;
  routeSyncTimer: number | null;
  processTimer: number | null;
  saveRatingsTimer: number | null;
  saveWatchHistoryTimer: number | null;
  saveWatchlistCacheTimer: number | null;
  settings: BoundaryRecord;
  ratingCache: BoundaryRecord;
  ratingCacheRevision: number;
  ratingInflight: Map<string, BoundaryPromise>;
  ratingLocalePreloadInflight: Map<string, BoundaryPromise>;
  watchHistoryLocalePreloadInflight: Map<string, BoundaryPromise>;
  watchHistoryCache: WatchHistoryCache;
  watchHistoryStatus: string;
  watchlistCache: WatchlistCacheSnapshot;
  watchHistoryInflight: BoundaryPromise | null;
  watchHistoryPreloadAttemptDiagnostics: WatchHistoryPreloadAttemptDiagnostics;
  preferredAudioLanguage: string | null;
  preferredAudioLanguageUpdatedAt: number;
  apiTrace: ApiTraceBuckets;
  previewCache: BoundaryRecord;
  previewInflight: Map<string, BoundaryPromise>;
  authToken: BoundaryValue;
  authTokenInflight: BoundaryPromise | null;
  curatedEntries: BoundaryArray;
  curatedError: BoundaryValue;
  curatedSource: string;
  curatedInflight: BoundaryPromise | null;
  curatedDeferredMetadataInFlight: boolean;
  curatedInitialLoadDone: boolean;
  curatedPendingRequests: string[];
  curatedPendingRequestStartedCount: number;
  curatedPendingRequestCompletedCount: number;
  curatedObservedPromise: BoundaryPromise | null;
  curatedLastRevalidateAt: number;
  curatedDomLifecycleCounters: CuratedDomLifecycleCounters;
  mutationMuted: boolean;
  hostEl: Element | null;
  tabCrunchyrollEl: Element | null;
  tabCuratedEl: Element | null;
  curatedPanelEl: Element | null;
  controlsEl: Element | null;
  loadingBoxEl: Element | null;
  loadingIndicatorEl: Element | null;
  controlsLoadingIndicatorEl: Element | null;
  audioFilterSelectEl: Element | null;
  genreFilterSelectEl: Element | null;
  statsEl: Element | null;
  gridEl: Element | null;
  curatedGridRenderSignature: string;
  framedRootEl: Element | null;
  nativeHiddenNodes: NativeVisibilityRecord[];
};

function createEmptyWatchHistoryCache(watchHistoryCacheVersion: BoundaryValue): WatchHistoryCache {
  return {
    version: Number.isFinite(Number(watchHistoryCacheVersion)) ? Number(watchHistoryCacheVersion) : 0,
    accountId: '',
    updatedAt: 0,
    bySeriesId: {},
    bySeriesIdAudioLocale: {},
    bySeriesIdProgress: {},
    bySeriesIdAudioLocaleProgress: {},
  };
}

type WatchlistCacheSnapshotArgs = {
  profileId: string;
  updatedAt: number;
  rows: BoundaryArray;
};

// Keep compatibility with legacy call-sites that still pass:
// (accountId, updatedAt, rows). New call-sites pass:
// (accountId, profileId, updatedAt, rows).
function resolveWatchlistCacheSnapshotArgs(
  profileIdOrUpdatedAt: BoundaryValue,
  updatedAtOrRows: BoundaryValue,
  rowsMaybe: BoundaryValue,
): WatchlistCacheSnapshotArgs {
  if ((rowsMaybe !== undefined && Array.isArray(rowsMaybe)) || typeof profileIdOrUpdatedAt === 'string') {
    return {
      profileId: typeof profileIdOrUpdatedAt === 'string' ? profileIdOrUpdatedAt : '',
      updatedAt: typeof updatedAtOrRows === 'number' ? updatedAtOrRows : 0,
      rows: Array.isArray(rowsMaybe) ? rowsMaybe : [],
    };
  }

  return {
    profileId: '',
    updatedAt: typeof profileIdOrUpdatedAt === 'number' ? profileIdOrUpdatedAt : 0,
    rows: Array.isArray(updatedAtOrRows) ? updatedAtOrRows : [],
  };
}

function createWatchlistCacheSnapshot(
  accountId: BoundaryValue = '',
  profileIdOrUpdatedAt: BoundaryValue = '',
  updatedAtOrRows: BoundaryValue = 0,
  rowsMaybe?: BoundaryValue,
): WatchlistCacheSnapshot {
  const normalizedArgs = resolveWatchlistCacheSnapshotArgs(profileIdOrUpdatedAt, updatedAtOrRows, rowsMaybe);
  return {
    accountId: typeof accountId === 'string' ? accountId : '',
    profileId: normalizedArgs.profileId,
    updatedAt: normalizedArgs.updatedAt,
    rows: normalizedArgs.rows,
  };
}

function createApiTraceBuckets(): ApiTraceBuckets {
  return {
    authToken: [],
    watchlist: [],
    watchHistory: [],
    cmsObjects: [],
    legacyRating: [],
    preview: [],
  };
}

function createCuratedDomLifecycleCounters(): CuratedDomLifecycleCounters {
  return {
    created: 0,
    patched: 0,
    parked: 0,
    unparked: 0,
    disposed: 0,
    renderPasses: 0,
  };
}

function createWatchHistoryPreloadAttemptDiagnostics(): WatchHistoryPreloadAttemptDiagnostics {
  return {
    totalAttempts: 0,
    byLocale: {},
    byLocaleRevision: {},
    lastAttempt: null,
  };
}

function createRuntimeState(options: RuntimeStateOptions = {}): RuntimeState {
  resetRuntimePerfDiagnostics();
  const defaultSettings =
    options.defaultSettings && typeof options.defaultSettings === 'object' ? options.defaultSettings : {};
  const watchHistoryCacheVersion = options.watchHistoryCacheVersion;

  return {
    mounted: false,
    observer: null,
    routeWatcherStarted: false,
    routeSyncTimer: null,
    processTimer: null,
    saveRatingsTimer: null,
    saveWatchHistoryTimer: null,
    saveWatchlistCacheTimer: null,
    settings: { ...defaultSettings },
    ratingCache: {},
    ratingCacheRevision: 0,
    ratingInflight: new Map(),
    ratingLocalePreloadInflight: new Map(),
    watchHistoryLocalePreloadInflight: new Map(),
    watchHistoryCache: createEmptyWatchHistoryCache(watchHistoryCacheVersion),
    watchHistoryStatus: 'idle',
    watchHistoryPreloadAttemptDiagnostics: createWatchHistoryPreloadAttemptDiagnostics(),
    watchlistCache: createWatchlistCacheSnapshot(),
    watchHistoryInflight: null,
    preferredAudioLanguage: null,
    preferredAudioLanguageUpdatedAt: 0,
    apiTrace: createApiTraceBuckets(),
    previewCache: {},
    previewInflight: new Map(),
    authToken: null,
    authTokenInflight: null,
    curatedEntries: [],
    curatedError: null,
    curatedSource: 'none',
    curatedInflight: null,
    curatedDeferredMetadataInFlight: false,
    curatedInitialLoadDone: false,
    curatedPendingRequests: [],
    curatedPendingRequestStartedCount: 0,
    curatedPendingRequestCompletedCount: 0,
    curatedObservedPromise: null,
    curatedLastRevalidateAt: 0,
    curatedDomLifecycleCounters: createCuratedDomLifecycleCounters(),
    mutationMuted: false,
    hostEl: null,
    tabCrunchyrollEl: null,
    tabCuratedEl: null,
    curatedPanelEl: null,
    controlsEl: null,
    loadingBoxEl: null,
    loadingIndicatorEl: null,
    controlsLoadingIndicatorEl: null,
    audioFilterSelectEl: null,
    genreFilterSelectEl: null,
    statsEl: null,
    gridEl: null,
    curatedGridRenderSignature: '',
    framedRootEl: null,
    nativeHiddenNodes: [],
  };
}

export function createRuntimeStoreRuntime() {
  return {
    createEmptyWatchHistoryCache,
    createWatchlistCacheSnapshot,
    createApiTraceBuckets,
    createCuratedDomLifecycleCounters,
    createRuntimeState,
  };
}
