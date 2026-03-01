import { type AudioLocaleFilter, normalizeAudioLocaleFilter } from './AudioLocaleFilter.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryArray = BoundaryValue[];
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryPromise = Promise<BoundaryValue>;
type BoundaryFn = (...args: BoundaryArray) => BoundaryValue;

type RuntimeStateLoader = {
  createStateLoader: (options?: BoundaryValue) => {
    loadInitialState: () => Promise<void>;
  };
};

type RuntimeState = {
  settings: BoundaryRecord;
  ratingCache: BoundaryRecord;
  watchHistoryCache: BoundaryValue;
  watchHistoryStatus: string;
  watchlistCache: BoundaryValue;
  authToken?: BoundaryValue;
  curatedEntries: BoundaryArray;
  curatedSource: string;
  curatedLastRevalidateAt: number;
  curatedInitialLoadDone?: boolean;
};

type TokenEntry = {
  accountId?: BoundaryValue;
  profileId?: BoundaryValue;
};

type StateLoaderContext = {
  state: RuntimeState;
  storageGet: (key: string, fallback: BoundaryValue) => BoundaryPromise;
  getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null>;
  runtimeEvent: (event: string, data?: BoundaryValue) => void;
  normalizeStoredWatchHistoryCache: (raw: BoundaryValue) => BoundaryValue;
  isWatchHistoryCacheValid: (cache: BoundaryValue) => boolean;
  normalizeStoredWatchlistCache: (raw: BoundaryValue) => BoundaryValue;
  isWatchlistCacheValid: (cache: BoundaryValue, accountId?: BoundaryValue, profileId?: BoundaryValue) => boolean;
  normalizeEntriesFromApiRows: (rows: BoundaryArray) => BoundaryArray;
  defaultSettings: BoundaryRecord;
  validSortModes: Set<string>;
  defaultSortMode: string;
  settingsKey: string;
  ratingCacheKey: string;
  watchHistoryCacheKey: string;
  watchlistCacheKey: string;
};

type StateLoaderOptions = {
  state?: BoundaryValue;
  storageGet?: BoundaryValue;
  getAccessToken?: BoundaryValue;
  runtimeEvent?: BoundaryValue;
  normalizeStoredWatchHistoryCache?: BoundaryValue;
  isWatchHistoryCacheValid?: BoundaryValue;
  normalizeStoredWatchlistCache?: BoundaryValue;
  isWatchlistCacheValid?: BoundaryValue;
  normalizeEntriesFromApiRows?: BoundaryValue;
  defaultSettings?: BoundaryValue;
  validSortModes?: BoundaryValue;
  defaultSortMode?: BoundaryValue;
  settingsKey?: BoundaryValue;
  ratingCacheKey?: BoundaryValue;
  watchHistoryCacheKey?: BoundaryValue;
  watchlistCacheKey?: BoundaryValue;
};

function requireFunction<T extends BoundaryFn>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing runtime state-loader dependency: ${name}`);
  }

  return value as T;
}

function toRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as BoundaryRecord;
}

function toStateLoaderOptions(value: BoundaryValue): StateLoaderOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as StateLoaderOptions;
}

function getString(value: BoundaryValue, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function getNumber(value: BoundaryValue, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readInMemoryTokenScope(state: RuntimeState): { accountId: string; profileId: string } {
  const tokenEntry = state.authToken;
  if (!tokenEntry || typeof tokenEntry !== 'object') {
    return { accountId: '', profileId: '' };
  }
  const tokenRecord = tokenEntry as BoundaryRecord;
  return {
    accountId: getString(tokenRecord.accountId, ''),
    profileId: getString(tokenRecord.profileId, ''),
  };
}

function applyLegacyAudioSettingsInternal(nextSettings: BoundaryRecord, storedSettings: BoundaryRecord): void {
  if (typeof nextSettings.audioLocaleFilter === 'string') {
    return;
  }

  if (typeof storedSettings.requireEnglishAudio === 'boolean') {
    nextSettings.audioLocaleFilter = storedSettings.requireEnglishAudio ? 'en-US' : 'any';
    return;
  }

  if (typeof storedSettings.requireDubTag === 'boolean') {
    nextSettings.audioLocaleFilter = storedSettings.requireDubTag ? 'en-US' : 'any';
  }
}

function applyLegacyWatchReadySettingsInternal(nextSettings: BoundaryRecord, storedSettings: BoundaryRecord): void {
  if (typeof storedSettings.watchReadyFilterMode === 'string') {
    nextSettings.watchReadyFilterMode = storedSettings.watchReadyFilterMode;
    return;
  }

  if (typeof storedSettings.actionabilityMode === 'string') {
    nextSettings.watchReadyFilterMode = storedSettings.actionabilityMode;
    return;
  }

  if (typeof storedSettings.hideNonActionable === 'boolean') {
    nextSettings.watchReadyFilterMode = storedSettings.hideNonActionable ? 'hide' : 'none';
  }
}

function normalizeWatchReadyFilterModeInternal(value: BoundaryValue): 'none' | 'dim' | 'hide' | 'hide_not_started' {
  if (value === 'none' || value === 'dim' || value === 'hide' || value === 'hide_not_started') {
    return value;
  }
  return 'hide';
}

function normalizeSortSettingsInternal(context: StateLoaderContext, nextSettings: BoundaryRecord): void {
  const sortMode = typeof nextSettings.sortMode === 'string' ? nextSettings.sortMode : '';
  if (!context.validSortModes.has(sortMode)) {
    nextSettings.sortMode = context.defaultSortMode;
  }

  const defaultSecondarySortMode = getString(context.defaultSettings.secondarySortMode, 'none');
  const secondarySortMode = typeof nextSettings.secondarySortMode === 'string' ? nextSettings.secondarySortMode : '';
  if (!context.validSortModes.has(secondarySortMode)) {
    nextSettings.secondarySortMode = defaultSecondarySortMode;
  }

  if (nextSettings.secondarySortMode === nextSettings.sortMode) {
    nextSettings.secondarySortMode = defaultSecondarySortMode;
  }
}

function normalizeSettingsInternal(context: StateLoaderContext, storedSettingsRaw: BoundaryValue): BoundaryRecord {
  const storedSettings = toRecord(storedSettingsRaw);
  const nextSettings: BoundaryRecord = {
    ...context.defaultSettings,
    ...storedSettings,
  };

  applyLegacyAudioSettingsInternal(nextSettings, storedSettings);
  applyLegacyWatchReadySettingsInternal(nextSettings, storedSettings);

  const normalizedAudioLocaleFilter: AudioLocaleFilter = normalizeAudioLocaleFilter(
    typeof nextSettings.audioLocaleFilter === 'string' ? nextSettings.audioLocaleFilter : undefined,
  );
  nextSettings.audioLocaleFilter = normalizedAudioLocaleFilter;
  nextSettings.genreFilter = getString(nextSettings.genreFilter, 'any');

  if (nextSettings.cardLayout !== 'portrait' && nextSettings.cardLayout !== 'landscape') {
    nextSettings.cardLayout = 'portrait';
  }

  nextSettings.watchReadyFilterMode = normalizeWatchReadyFilterModeInternal(nextSettings.watchReadyFilterMode);
  normalizeSortSettingsInternal(context, nextSettings);
  return nextSettings;
}

async function hydrateRatingCacheInternal(context: StateLoaderContext): Promise<void> {
  const rawRatingCache = await context.storageGet(context.ratingCacheKey, {});
  if (rawRatingCache && typeof rawRatingCache === 'object') {
    context.state.ratingCache = rawRatingCache as BoundaryRecord;
  }
}

async function hydrateWatchHistoryCacheInternal(context: StateLoaderContext): Promise<void> {
  const rawWatchHistoryCache = await context.storageGet(context.watchHistoryCacheKey, null);
  if (rawWatchHistoryCache && typeof rawWatchHistoryCache === 'object') {
    context.state.watchHistoryCache = context.normalizeStoredWatchHistoryCache(rawWatchHistoryCache);
  }

  context.state.watchHistoryStatus = context.isWatchHistoryCacheValid(context.state.watchHistoryCache)
    ? 'ready'
    : 'idle';
}

async function hydrateWatchlistCacheInternal(context: StateLoaderContext): Promise<void> {
  const rawWatchlistCache = await context.storageGet(context.watchlistCacheKey, null);
  if (rawWatchlistCache && typeof rawWatchlistCache === 'object') {
    context.state.watchlistCache = context.normalizeStoredWatchlistCache(rawWatchlistCache);
  }

  const watchlistCacheRecord = toRecord(context.state.watchlistCache);
  const { accountId: cachedAccountId, profileId: cachedProfileId } = {
    accountId: getString(watchlistCacheRecord.accountId, ''),
    profileId: getString(watchlistCacheRecord.profileId, ''),
  };
  const inMemoryTokenScope = readInMemoryTokenScope(context.state);
  if (cachedProfileId && !inMemoryTokenScope.accountId) {
    context.runtimeEvent('curated-cache-scope-unavailable', {
      hasAccountId: false,
      hasProfileId: false,
      requiresProfileScope: true,
    });
    return;
  }

  const accountId = inMemoryTokenScope.accountId || cachedAccountId;
  const profileId = inMemoryTokenScope.accountId ? inMemoryTokenScope.profileId : '';

  if (!context.isWatchlistCacheValid(context.state.watchlistCache, accountId, profileId)) {
    return;
  }

  if (inMemoryTokenScope.accountId && !profileId && cachedProfileId) {
    context.runtimeEvent('curated-cache-scope-unavailable', {
      hasAccountId: true,
      hasProfileId: false,
      requiresProfileScope: true,
    });
    return;
  }

  const rows = Array.isArray(watchlistCacheRecord.rows) ? watchlistCacheRecord.rows : [];
  const updatedAt = getNumber(watchlistCacheRecord.updatedAt, 0);

  context.state.curatedEntries = context.normalizeEntriesFromApiRows(rows);
  context.state.curatedSource = 'cache';
  context.state.curatedLastRevalidateAt = updatedAt;
  context.state.curatedInitialLoadDone = true;

  context.runtimeEvent('curated-cache-hydrated', {
    total: context.state.curatedEntries.length,
    updatedAt,
    accountId,
    profileId: profileId || null,
  });
}

function createStateLoaderContext(options: StateLoaderOptions = {}): StateLoaderContext {
  const state = options.state && typeof options.state === 'object' ? (options.state as RuntimeState) : null;
  if (!state) {
    throw new Error('[CW] Missing runtime state-loader state');
  }

  const defaultSettings =
    options.defaultSettings && typeof options.defaultSettings === 'object'
      ? (options.defaultSettings as BoundaryRecord)
      : {};
  const validSortModes = options.validSortModes instanceof Set ? options.validSortModes : new Set<string>();
  const defaultSortMode = getString(options.defaultSortMode, 'consensus_quality_desc');

  return {
    state,
    storageGet: requireFunction('storageGet', options.storageGet) as StateLoaderContext['storageGet'],
    getAccessToken: requireFunction('getAccessToken', options.getAccessToken) as StateLoaderContext['getAccessToken'],
    runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as StateLoaderContext['runtimeEvent'],
    normalizeStoredWatchHistoryCache: requireFunction(
      'normalizeStoredWatchHistoryCache',
      options.normalizeStoredWatchHistoryCache,
    ) as StateLoaderContext['normalizeStoredWatchHistoryCache'],
    isWatchHistoryCacheValid: requireFunction(
      'isWatchHistoryCacheValid',
      options.isWatchHistoryCacheValid,
    ) as StateLoaderContext['isWatchHistoryCacheValid'],
    normalizeStoredWatchlistCache: requireFunction(
      'normalizeStoredWatchlistCache',
      options.normalizeStoredWatchlistCache,
    ) as StateLoaderContext['normalizeStoredWatchlistCache'],
    isWatchlistCacheValid: requireFunction(
      'isWatchlistCacheValid',
      options.isWatchlistCacheValid,
    ) as StateLoaderContext['isWatchlistCacheValid'],
    normalizeEntriesFromApiRows: requireFunction(
      'normalizeEntriesFromApiRows',
      options.normalizeEntriesFromApiRows,
    ) as StateLoaderContext['normalizeEntriesFromApiRows'],
    defaultSettings,
    validSortModes,
    defaultSortMode,
    settingsKey: getString(options.settingsKey, 'cw_settings_v1'),
    ratingCacheKey: getString(options.ratingCacheKey, 'cw_rating_cache_v2'),
    watchHistoryCacheKey: getString(options.watchHistoryCacheKey, 'cw_watch_history_cache_v1'),
    watchlistCacheKey: getString(options.watchlistCacheKey, 'cw_watchlist_cache_v1'),
  };
}

async function loadInitialStateInternal(context: StateLoaderContext): Promise<void> {
  const storedSettingsRaw = await context.storageGet(context.settingsKey, context.defaultSettings);
  context.state.settings = normalizeSettingsInternal(context, storedSettingsRaw);
  await hydrateRatingCacheInternal(context);
  await hydrateWatchHistoryCacheInternal(context);
  await hydrateWatchlistCacheInternal(context);

  context.runtimeEvent('state-load-done', {
    tab: context.state.settings.activeTab,
    cachedCurated: context.state.curatedEntries.length,
  });
}

function createStateLoader(options: StateLoaderOptions = {}) {
  const context = createStateLoaderContext(options);
  return {
    loadInitialState: () => loadInitialStateInternal(context),
  };
}

const runtimeStateLoader: RuntimeStateLoader = {
  createStateLoader: (options = {}) => createStateLoader(toStateLoaderOptions(options)),
};

export function createRuntimeStateLoaderRuntime(): RuntimeStateLoader {
  return runtimeStateLoader;
}
