import { collectWatchHistoryUpdateBuckets as collectWatchHistoryUpdateBucketsFactory } from './HistoryRepositoryPreloadCollector.js';
import { resolveHistoryPreloadPlan as resolveHistoryPreloadPlanFactory } from './HistoryRepositoryPreloadPlanning.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryFunction = (...args: BoundaryValue[]) => BoundaryValue;
const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
type WatchHistoryInflightPromise = Promise<BoundaryValue>;
type WatchHistoryPreloadAttemptDiagnostics = {
  localeStorageKey: string;
  curatedDataRevision: number;
  localeAttemptCount: number;
  localeRevisionAttemptCount: number;
};
type WatchHistoryPreloadAttemptSnapshot = {
  totalAttempts: number;
  byLocale: Record<string, number>;
  byLocaleRevision: Record<string, number>;
  lastAttempt: {
    locale: string;
    curatedDataRevision: number;
    localeAttemptCount: number;
    localeRevisionAttemptCount: number;
  } | null;
};

const localizedWatchHistoryInflightByState = new WeakMap<WatchHistoryState, Map<string, WatchHistoryInflightPromise>>();
const localizedWatchHistoryRevisionByState = new WeakMap<WatchHistoryState, Map<string, number>>();
const localizedWatchHistoryAttemptCountByState = new WeakMap<WatchHistoryState, Map<string, number>>();
const localizedWatchHistoryAttemptCountByLocaleRevisionByState = new WeakMap<WatchHistoryState, Map<string, number>>();

function requireFunction<T extends BoundaryFunction>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing history preload dependency: ${name}`);
  }
  return value as T;
}

function toWatchHistoryState(value: BoundaryValue): WatchHistoryState | null {
  return value && typeof value === 'object' ? (value as WatchHistoryState) : null;
}

function toTokenEntry(value: BoundaryValue): TokenEntry {
  return value && typeof value === 'object' ? (value as TokenEntry) : {};
}

function toHistoryPreloadEntries(value: BoundaryValue): HistoryPreloadEntry[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is HistoryPreloadEntry => !!entry && typeof entry === 'object')
    : [];
}

function getOrCreateStateMap<TValue>(
  cache: WeakMap<WatchHistoryState, Map<string, TValue>>,
  state: WatchHistoryState,
): Map<string, TValue> {
  const existing = cache.get(state);
  if (existing) {
    return existing;
  }

  const created = new Map<string, TValue>();
  cache.set(state, created);
  return created;
}

function getCuratedDataRevision(state: WatchHistoryState): number {
  const revision = Number((state as LooseRecord).curatedLastRevalidateAt);
  return Number.isFinite(revision) && revision > 0 ? Math.round(revision) : 0;
}

function getLocaleRevisionAttemptKey(localeStorageKey: string, curatedDataRevision: number): string {
  return `${localeStorageKey}@${curatedDataRevision}`;
}

function toAttemptCountRecord(entries: Iterable<[string, number]>): Record<string, number> {
  const record: Record<string, number> = {};
  for (const [key, value] of entries) {
    const normalizedValue = Number(value);
    if (!key || !Number.isFinite(normalizedValue) || normalizedValue <= 0) {
      continue;
    }
    record[key] = Math.round(normalizedValue);
  }
  return record;
}

function syncWatchHistoryPreloadAttemptSnapshot(
  state: WatchHistoryState,
  diagnostics: WatchHistoryPreloadAttemptDiagnostics,
  localeCounts: Map<string, number>,
  localeRevisionCounts: Map<string, number>,
): void {
  const byLocale = toAttemptCountRecord(localeCounts.entries());
  const byLocaleRevision = toAttemptCountRecord(localeRevisionCounts.entries());
  const totalAttempts = Object.values(byLocale).reduce((sum, value) => sum + value, 0);

  const snapshot: WatchHistoryPreloadAttemptSnapshot = {
    totalAttempts,
    byLocale,
    byLocaleRevision,
    lastAttempt: {
      locale: diagnostics.localeStorageKey,
      curatedDataRevision: diagnostics.curatedDataRevision,
      localeAttemptCount: diagnostics.localeAttemptCount,
      localeRevisionAttemptCount: diagnostics.localeRevisionAttemptCount,
    },
  };

  (state as LooseRecord).watchHistoryPreloadAttemptDiagnostics = snapshot as BoundaryValue;
}

function trackWatchHistoryPreloadAttempt(
  state: WatchHistoryState,
  localeStorageKey: string,
  curatedDataRevision: number,
): WatchHistoryPreloadAttemptDiagnostics {
  const perLocaleCounts = getOrCreateStateMap(localizedWatchHistoryAttemptCountByState, state);
  const localeAttemptCount = (perLocaleCounts.get(localeStorageKey) ?? 0) + 1;
  perLocaleCounts.set(localeStorageKey, localeAttemptCount);

  const perLocaleRevisionCounts = getOrCreateStateMap(localizedWatchHistoryAttemptCountByLocaleRevisionByState, state);
  const localeRevisionKey = getLocaleRevisionAttemptKey(localeStorageKey, curatedDataRevision);
  const localeRevisionAttemptCount = (perLocaleRevisionCounts.get(localeRevisionKey) ?? 0) + 1;
  perLocaleRevisionCounts.set(localeRevisionKey, localeRevisionAttemptCount);

  const diagnostics = {
    localeStorageKey,
    curatedDataRevision,
    localeAttemptCount,
    localeRevisionAttemptCount,
  };
  syncWatchHistoryPreloadAttemptSnapshot(state, diagnostics, perLocaleCounts, perLocaleRevisionCounts);
  return diagnostics;
}

function requireContextFunction<
  K extends keyof HistoryRepositoryPreloadContext & keyof HistoryRepositoryPreloadOptions,
>(options: HistoryRepositoryPreloadOptions, name: K): HistoryRepositoryPreloadContext[K] {
  return requireFunction(String(name), options[name]) as HistoryRepositoryPreloadContext[K];
}

function resolveRequiredHistoryRepositoryPreloadDependencies(
  options: HistoryRepositoryPreloadOptions,
): Omit<
  HistoryRepositoryPreloadContext,
  | 'state'
  | 'resolveHistoryPreloadPlan'
  | 'collectWatchHistoryUpdateBuckets'
  | 'pushApiTrace'
  | 'runtimeEvent'
  | 'watchHistoryCacheVersion'
  | 'watchHistoryPageSize'
  | 'watchHistoryMaxPages'
  | 'watchHistoryNoMatchPageLimit'
> {
  return {
    normalizeAudioLocale: requireContextFunction(options, 'normalizeAudioLocale'),
    sanitizePositiveInt: requireContextFunction(options, 'sanitizePositiveInt'),
    parseDateMs: requireContextFunction(options, 'parseDateMs'),
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: requireContextFunction(
      options,
      'deriveCanonicalEpisodeKeyFromEpisodeMetadata',
    ),
    getAbsoluteEpisodeNumberFromEpisodeMetadata: requireContextFunction(
      options,
      'getAbsoluteEpisodeNumberFromEpisodeMetadata',
    ),
    getPreferredAudioLanguage: requireContextFunction(options, 'getPreferredAudioLanguage'),
    getLocale: requireContextFunction(options, 'getLocale'),
    resolveApiHref: requireContextFunction(options, 'resolveApiHref'),
    fetchWithResilience: requireContextFunction(options, 'fetchWithResilience'),
    createAuthRefreshHandler: requireContextFunction(options, 'createAuthRefreshHandler'),
    parsePayloadDataEnvelope: requireContextFunction(options, 'parsePayloadDataEnvelope'),
    auditWatchHistoryRowsContract: requireContextFunction(options, 'auditWatchHistoryRowsContract'),
    normalizeStoredWatchHistoryCache: requireContextFunction(options, 'normalizeStoredWatchHistoryCache'),
    normalizeStoredWatchHistoryBySeriesAudioLocale: requireContextFunction(
      options,
      'normalizeStoredWatchHistoryBySeriesAudioLocale',
    ),
    normalizeWatchHistoryEntry: requireContextFunction(options, 'normalizeWatchHistoryEntry'),
    isWatchHistoryCacheValid: requireContextFunction(options, 'isWatchHistoryCacheValid'),
    shouldReplaceWatchHistoryProgress: requireContextFunction(options, 'shouldReplaceWatchHistoryProgress'),
    getCachedWatchHistory: requireContextFunction(options, 'getCachedWatchHistory'),
    scheduleSaveWatchHistory: requireContextFunction(options, 'scheduleSaveWatchHistory'),
  };
}

function createHistoryRepositoryPreloadContext(
  options: HistoryRepositoryPreloadOptions = {},
): HistoryRepositoryPreloadContext {
  const state = toWatchHistoryState(options.state);
  if (!state) {
    throw new Error('[CW] Missing history repository state');
  }

  return {
    state,
    ...resolveRequiredHistoryRepositoryPreloadDependencies(options),
    resolveHistoryPreloadPlan: requireFunction(
      'resolveHistoryPreloadPlan',
      resolveHistoryPreloadPlanFactory,
    ) as HistoryRepositoryPreloadContext['resolveHistoryPreloadPlan'],
    collectWatchHistoryUpdateBuckets: requireFunction(
      'collectWatchHistoryUpdateBuckets',
      collectWatchHistoryUpdateBucketsFactory,
    ) as HistoryRepositoryPreloadContext['collectWatchHistoryUpdateBuckets'],
    pushApiTrace:
      typeof options.pushApiTrace === 'function'
        ? (options.pushApiTrace as HistoryRepositoryPreloadContext['pushApiTrace'])
        : () => {},
    runtimeEvent:
      typeof options.runtimeEvent === 'function'
        ? (options.runtimeEvent as HistoryRepositoryPreloadContext['runtimeEvent'])
        : () => {},
    watchHistoryCacheVersion: Number(options.watchHistoryCacheVersion) || 0,
    watchHistoryPageSize: Math.max(1, Number(options.watchHistoryPageSize) || 1),
    watchHistoryMaxPages: Math.max(1, Number(options.watchHistoryMaxPages) || 1),
    watchHistoryNoMatchPageLimit: Math.max(1, Number(options.watchHistoryNoMatchPageLimit) || 1),
  };
}

function requireHistoryAccountId(
  context: HistoryRepositoryPreloadContext,
  tokenEntry: TokenEntry,
  pageNumber: number,
): string {
  const accountId = typeof tokenEntry?.accountId === 'string' ? tokenEntry.accountId : '';
  if (accountId) {
    return accountId;
  }

  context.runtimeEvent('watch-history-contract-warning', {
    reason: 'missing-account-id',
    page: Math.max(1, Number(pageNumber) || 1),
  });
  throw new Error('watch history request missing account id');
}

function createWatchHistoryRequestParams(
  context: HistoryRepositoryPreloadContext,
  pageNumber: number,
  preferredAudioLanguage: BoundaryValue,
): URLSearchParams {
  const effectivePreferredAudioLanguage =
    context.normalizeAudioLocale(preferredAudioLanguage) || context.getPreferredAudioLanguage();
  const params = new root.URLSearchParams({
    page_size: String(context.watchHistoryPageSize),
    preferred_audio_language: effectivePreferredAudioLanguage,
    locale: context.getLocale(),
  });
  if (pageNumber > 1) {
    params.set('page', String(pageNumber));
  }
  return params;
}

async function parseWatchHistoryPayload(
  context: HistoryRepositoryPreloadContext,
  response: Response,
  pageNumber: number,
  requestUrl: string,
): Promise<BoundaryValue> {
  try {
    return await response.json();
  } catch (_) {
    context.runtimeEvent('watch-history-contract-warning', {
      reason: 'invalid-json-payload',
      page: Math.max(1, Number(pageNumber) || 1),
      requestUrl,
    });
    throw new Error('watch history page payload parse failed');
  }
}

async function fetchWatchHistoryPageInternal(
  context: HistoryRepositoryPreloadContext,
  tokenEntry: TokenEntry,
  pageNumber: number,
  preferredAudioLanguage: BoundaryValue = context.getPreferredAudioLanguage(),
): Promise<{ rows: LooseRecord[]; totalRows: number | null }> {
  const accountId = requireHistoryAccountId(context, tokenEntry, pageNumber);
  const resolvedPageNumber = Math.max(1, Number(pageNumber) || 1);
  const params = createWatchHistoryRequestParams(context, pageNumber, preferredAudioLanguage);

  const url = context.resolveApiHref(`/content/v2/${encodeURIComponent(accountId)}/watch-history?${params.toString()}`);
  const response = await context.fetchWithResilience(
    url,
    {
      credentials: 'include',
    },
    {
      label: 'watch history page request',
      bearerToken: tokenEntry?.accessToken,
      refreshBearerToken: context.createAuthRefreshHandler(tokenEntry),
    },
  );

  if (!response.ok) {
    throw new Error(`watch history page request failed: ${response.status}`);
  }

  const payload = await parseWatchHistoryPayload(context, response, pageNumber, url);
  const payloadEnvelope = context.parsePayloadDataEnvelope('watch-history', payload);
  const rows = payloadEnvelope.rows;
  context.auditWatchHistoryRowsContract(rows);
  const totalRows = payloadEnvelope.total;
  const responseTotal = totalRows ?? rows.length;
  if (payloadEnvelope.total == null) {
    const payloadRecord = payload && typeof payload === 'object' ? (payload as LooseRecord) : {};
    context.runtimeEvent('watch-history-contract-warning', {
      reason: 'invalid-total-value',
      totalValue: payloadRecord.total,
      fallbackTotal: rows.length,
      page: resolvedPageNumber,
      requestUrl: url,
    });
  }

  context.pushApiTrace('watchHistory', {
    at: Date.now(),
    request: {
      url,
      page: resolvedPageNumber,
      page_size: context.watchHistoryPageSize,
      preferred_audio_language: params.get('preferred_audio_language'),
      locale: params.get('locale'),
    },
    response: {
      total: responseTotal,
      rowCount: rows.length,
    },
    data: rows,
  });

  return {
    rows,
    totalRows,
  };
}

function mergeWatchHistoryCacheWithBucketsInternal(
  context: HistoryRepositoryPreloadContext,
  latestCache: WatchHistoryCache,
  buckets: HistoryUpdateBuckets,
  isDefaultPreferredAudio: boolean,
): {
  bySeriesId: Record<string, WatchHistoryEntry>;
  bySeriesIdAudioLocale: Record<string, WatchHistoryLocaleMap>;
  bySeriesIdProgress: Record<string, WatchHistoryEntry>;
  bySeriesIdAudioLocaleProgress: Record<string, WatchHistoryLocaleMap>;
  mappedSeries: number;
  mappedSeriesByAudioLocale: number;
  mappedProgressSeries: number;
  mappedProgressSeriesByAudioLocale: number;
} {
  const nextBySeriesId = isDefaultPreferredAudio ? { ...latestCache.bySeriesId } : latestCache.bySeriesId;
  const nextBySeriesIdProgress = isDefaultPreferredAudio
    ? { ...latestCache.bySeriesIdProgress }
    : latestCache.bySeriesIdProgress;
  const nextBySeriesIdAudioLocale = context.normalizeStoredWatchHistoryBySeriesAudioLocale(
    latestCache.bySeriesIdAudioLocale,
  );
  const nextBySeriesIdAudioLocaleProgress = context.normalizeStoredWatchHistoryBySeriesAudioLocale(
    latestCache.bySeriesIdAudioLocaleProgress,
  );

  if (isDefaultPreferredAudio) {
    Object.entries(buckets.seriesUpdates).forEach(([seriesId, updateEntry]) => {
      const previous = context.normalizeWatchHistoryEntry(nextBySeriesId[seriesId]);
      if (!previous || updateEntry.datePlayedMs > previous.datePlayedMs) {
        nextBySeriesId[seriesId] = updateEntry;
      }
    });

    Object.entries(buckets.seriesProgressUpdates).forEach(([seriesId, updateEntry]) => {
      const previous = context.normalizeWatchHistoryEntry(nextBySeriesIdProgress[seriesId]);
      if (context.shouldReplaceWatchHistoryProgress(previous, updateEntry)) {
        nextBySeriesIdProgress[seriesId] = updateEntry;
      }
    });
  }

  Object.entries(buckets.localeUpdates).forEach(([seriesId, localeMapUpdates]) => {
    const nextLocaleMap: WatchHistoryLocaleMap = { ...(nextBySeriesIdAudioLocale[seriesId] || {}) };

    Object.entries(localeMapUpdates).forEach(([localeStorageKey, updateEntry]) => {
      const previous = context.normalizeWatchHistoryEntry(nextLocaleMap[localeStorageKey]);
      if (!previous || updateEntry.datePlayedMs > previous.datePlayedMs) {
        nextLocaleMap[localeStorageKey] = updateEntry;
      }
    });

    if (Object.keys(nextLocaleMap).length) {
      nextBySeriesIdAudioLocale[seriesId] = nextLocaleMap;
    }
  });

  Object.entries(buckets.localeProgressUpdates).forEach(([seriesId, localeMapUpdates]) => {
    const nextLocaleProgressMap: WatchHistoryLocaleMap = { ...(nextBySeriesIdAudioLocaleProgress[seriesId] || {}) };

    Object.entries(localeMapUpdates).forEach(([localeStorageKey, updateEntry]) => {
      const previous = context.normalizeWatchHistoryEntry(nextLocaleProgressMap[localeStorageKey]);
      if (context.shouldReplaceWatchHistoryProgress(previous, updateEntry)) {
        nextLocaleProgressMap[localeStorageKey] = updateEntry;
      }
    });

    if (Object.keys(nextLocaleProgressMap).length) {
      nextBySeriesIdAudioLocaleProgress[seriesId] = nextLocaleProgressMap;
    }
  });

  return {
    bySeriesId: nextBySeriesId,
    bySeriesIdAudioLocale: nextBySeriesIdAudioLocale,
    bySeriesIdProgress: nextBySeriesIdProgress,
    bySeriesIdAudioLocaleProgress: nextBySeriesIdAudioLocaleProgress,
    mappedSeries: Object.keys(nextBySeriesId).length,
    mappedSeriesByAudioLocale: Object.keys(nextBySeriesIdAudioLocale).length,
    mappedProgressSeries: Object.keys(nextBySeriesIdProgress).length,
    mappedProgressSeriesByAudioLocale: Object.keys(nextBySeriesIdAudioLocaleProgress).length,
  };
}

function applyWatchHistoryBucketsToState(
  context: HistoryRepositoryPreloadContext,
  buckets: HistoryUpdateBuckets,
  preloadPlan: WatchHistoryPreloadPlan,
  tokenAccountId: string,
  attemptDiagnostics: WatchHistoryPreloadAttemptDiagnostics,
): void {
  const latestCache = context.normalizeStoredWatchHistoryCache(context.state.watchHistoryCache);
  const mergedCache = mergeWatchHistoryCacheWithBucketsInternal(
    context,
    latestCache,
    buckets,
    preloadPlan.isDefaultPreferredAudio,
  );

  context.state.watchHistoryCache = {
    version: context.watchHistoryCacheVersion,
    accountId: tokenAccountId,
    updatedAt: Date.now(),
    bySeriesId: mergedCache.bySeriesId,
    bySeriesIdAudioLocale: mergedCache.bySeriesIdAudioLocale,
    bySeriesIdProgress: mergedCache.bySeriesIdProgress,
    bySeriesIdAudioLocaleProgress: mergedCache.bySeriesIdAudioLocaleProgress,
  };
  context.state.watchHistoryStatus = 'ready';
  context.scheduleSaveWatchHistory();

  context.runtimeEvent('watch-history-preload', {
    preferredAudioLanguage: preloadPlan.effectivePreferredAudioLanguage,
    attemptLocale: attemptDiagnostics.localeStorageKey,
    curatedDataRevision: attemptDiagnostics.curatedDataRevision,
    localeAttemptCount: attemptDiagnostics.localeAttemptCount,
    localeRevisionAttemptCount: attemptDiagnostics.localeRevisionAttemptCount,
    pages: buckets.pages,
    fetchedRows: buckets.fetchedRows,
    mappedSeries: mergedCache.mappedSeries,
    mappedSeriesByAudioLocale: mergedCache.mappedSeriesByAudioLocale,
    mappedProgressSeries: mergedCache.mappedProgressSeries,
    mappedProgressSeriesByAudioLocale: mergedCache.mappedProgressSeriesByAudioLocale,
    matchedCandidates: preloadPlan.candidateSeriesIds.length - buckets.remainingSeriesIds.size,
    candidates: preloadPlan.candidateSeriesIds.length,
    noMatchPageStreak: buckets.noMatchPageStreak,
  });
}

function handleWatchHistoryPreloadFailure(
  context: HistoryRepositoryPreloadContext,
  error: BoundaryValue,
  preloadPlan: WatchHistoryPreloadPlan,
  tokenAccountId: string,
  attemptDiagnostics: WatchHistoryPreloadAttemptDiagnostics,
): void {
  context.state.watchHistoryStatus =
    preloadPlan.isDefaultPreferredAudio ||
    !context.isWatchHistoryCacheValid(context.state.watchHistoryCache, tokenAccountId)
      ? 'failed'
      : 'ready';
  context.runtimeEvent('watch-history-preload-failed', {
    preferredAudioLanguage: preloadPlan.effectivePreferredAudioLanguage,
    attemptLocale: attemptDiagnostics.localeStorageKey,
    curatedDataRevision: attemptDiagnostics.curatedDataRevision,
    localeAttemptCount: attemptDiagnostics.localeAttemptCount,
    localeRevisionAttemptCount: attemptDiagnostics.localeRevisionAttemptCount,
    message: error instanceof Error ? error.message : 'unavailable',
  });
}

function emitWatchHistoryPreloadStart(
  context: HistoryRepositoryPreloadContext,
  preloadPlan: WatchHistoryPreloadPlan,
  attemptDiagnostics: WatchHistoryPreloadAttemptDiagnostics,
  force: boolean,
): void {
  context.runtimeEvent('watch-history-preload-start', {
    preferredAudioLanguage: preloadPlan.effectivePreferredAudioLanguage,
    attemptLocale: attemptDiagnostics.localeStorageKey,
    curatedDataRevision: attemptDiagnostics.curatedDataRevision,
    localeAttemptCount: attemptDiagnostics.localeAttemptCount,
    localeRevisionAttemptCount: attemptDiagnostics.localeRevisionAttemptCount,
    candidates: preloadPlan.candidateSeriesIds.length,
    force,
    isDefaultPreferredAudio: preloadPlan.isDefaultPreferredAudio,
  });
}

function createWatchHistoryPreloadInflight(options: {
  context: HistoryRepositoryPreloadContext;
  tokenEntry: TokenEntry;
  preloadPlan: WatchHistoryPreloadPlan;
  tokenAccountId: string;
  attemptDiagnostics: WatchHistoryPreloadAttemptDiagnostics;
  force: boolean;
  isForcedLocalizedPreload: boolean;
  localeStorageKey: string;
  localizedInflightMap: Map<string, WatchHistoryInflightPromise> | null;
}): WatchHistoryInflightPromise {
  const {
    context,
    tokenEntry,
    preloadPlan,
    tokenAccountId,
    attemptDiagnostics,
    force,
    isForcedLocalizedPreload,
    localeStorageKey,
    localizedInflightMap,
  } = options;

  const inflight = (async () => {
    context.state.watchHistoryStatus = 'loading';
    emitWatchHistoryPreloadStart(context, preloadPlan, attemptDiagnostics, force);
    const buckets = await context.collectWatchHistoryUpdateBuckets({
      tokenEntry,
      effectivePreferredAudioLanguage: preloadPlan.effectivePreferredAudioLanguage,
      candidateSeriesIds: preloadPlan.candidateSeriesIds,
      isDefaultPreferredAudio: preloadPlan.isDefaultPreferredAudio,
      watchHistoryMaxPages: context.watchHistoryMaxPages,
      watchHistoryPageSize: context.watchHistoryPageSize,
      watchHistoryNoMatchPageLimit: context.watchHistoryNoMatchPageLimit,
      fetchWatchHistoryPage: (
        tokenEntryForPage: TokenEntry,
        pageNumber: number,
        preferredAudioLanguageForPage: BoundaryValue = preloadPlan.effectivePreferredAudioLanguage,
      ) => fetchWatchHistoryPageInternal(context, tokenEntryForPage, pageNumber, preferredAudioLanguageForPage),
      normalizeAudioLocale: context.normalizeAudioLocale,
      sanitizePositiveInt: context.sanitizePositiveInt,
      parseDateMs: context.parseDateMs,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: context.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      getAbsoluteEpisodeNumberFromEpisodeMetadata: context.getAbsoluteEpisodeNumberFromEpisodeMetadata,
      shouldReplaceWatchHistoryProgress: context.shouldReplaceWatchHistoryProgress,
    });
    applyWatchHistoryBucketsToState(context, buckets, preloadPlan, tokenAccountId, attemptDiagnostics);
  })()
    .catch((error: BoundaryValue) => {
      handleWatchHistoryPreloadFailure(context, error, preloadPlan, tokenAccountId, attemptDiagnostics);
    })
    .finally(() => {
      if (!isForcedLocalizedPreload && context.state.watchHistoryInflight === inflight) {
        context.state.watchHistoryInflight = null;
      }

      if (isForcedLocalizedPreload && localizedInflightMap?.get(localeStorageKey) === inflight) {
        localizedInflightMap.delete(localeStorageKey);
      }
    });

  if (isForcedLocalizedPreload) {
    localizedInflightMap?.set(localeStorageKey, inflight);
  } else {
    context.state.watchHistoryInflight = inflight;
  }
  return inflight;
}

async function preloadWatchHistoryForEntriesInternal(
  context: HistoryRepositoryPreloadContext,
  entries: HistoryPreloadEntry[],
  tokenEntry: TokenEntry,
  force = false,
  preferredAudioLanguage: BoundaryValue = context.getPreferredAudioLanguage(),
): Promise<BoundaryValue> {
  const tokenAccountId = typeof tokenEntry?.accountId === 'string' ? tokenEntry.accountId : '';
  if (!tokenEntry?.accessToken || !tokenAccountId) {
    context.state.watchHistoryStatus = 'unavailable';
    return;
  }

  const preloadPlan = context.resolveHistoryPreloadPlan({
    entries,
    preferredAudioLanguage,
    getPreferredAudioLanguage: context.getPreferredAudioLanguage,
    normalizeAudioLocale: context.normalizeAudioLocale,
  });
  const localeStorageKey = preloadPlan.effectivePreferredAudioLanguage.toLowerCase();
  const curatedDataRevision = getCuratedDataRevision(context.state);
  const isForcedLocalizedPreload = force && !preloadPlan.isDefaultPreferredAudio;

  if (!force && context.isWatchHistoryCacheValid(context.state.watchHistoryCache, tokenAccountId)) {
    context.state.watchHistoryStatus = 'ready';
    return;
  }

  if (!force && context.state.watchHistoryInflight) {
    return context.state.watchHistoryInflight;
  }

  const localizedInflightMap = isForcedLocalizedPreload
    ? getOrCreateStateMap(localizedWatchHistoryInflightByState, context.state)
    : null;
  if (localizedInflightMap?.has(localeStorageKey)) {
    return localizedInflightMap.get(localeStorageKey);
  }

  if (isForcedLocalizedPreload) {
    const localizedRevisionMap = getOrCreateStateMap(localizedWatchHistoryRevisionByState, context.state);
    const previousRevision = localizedRevisionMap.get(localeStorageKey);
    if (previousRevision != null && previousRevision === curatedDataRevision) {
      return;
    }

    localizedRevisionMap.set(localeStorageKey, curatedDataRevision);
  }

  const attemptDiagnostics = trackWatchHistoryPreloadAttempt(context.state, localeStorageKey, curatedDataRevision);
  return createWatchHistoryPreloadInflight({
    context,
    tokenEntry,
    preloadPlan,
    tokenAccountId,
    attemptDiagnostics,
    force,
    isForcedLocalizedPreload,
    localeStorageKey,
    localizedInflightMap,
  });
}

function isLocalizedWatchHistoryDataMissingForEntriesInternal(
  context: HistoryRepositoryPreloadContext,
  entries: HistoryPreloadEntry[],
  audioLocale: BoundaryValue,
): boolean {
  const selectedAudioLocale = context.normalizeAudioLocale(audioLocale);
  if (!selectedAudioLocale || !entries.length) {
    return false;
  }

  const isDefaultPreferredAudio =
    selectedAudioLocale.toLowerCase() === context.getPreferredAudioLanguage().toLowerCase();

  return entries.some((entry) => {
    const seriesId = entry?.seriesId;
    if (!seriesId) {
      return false;
    }

    if (entry.neverWatched && Number(entry.playheadMs || 0) <= 0) {
      return false;
    }

    const localizedEntry = context.getCachedWatchHistory(seriesId, selectedAudioLocale, false);
    if (localizedEntry) {
      return false;
    }

    if (isDefaultPreferredAudio) {
      return !context.getCachedWatchHistory(seriesId);
    }

    return true;
  });
}

function createHistoryRepositoryPreloadInternal(
  options: HistoryRepositoryPreloadOptions = {},
): HistoryRepositoryPreload {
  const context = createHistoryRepositoryPreloadContext(options);

  return {
    preloadWatchHistoryForEntries: (
      entries: BoundaryValue,
      tokenEntry: BoundaryValue,
      force = false,
      preferredAudioLanguage?: BoundaryValue,
    ) =>
      preloadWatchHistoryForEntriesInternal(
        context,
        toHistoryPreloadEntries(entries),
        toTokenEntry(tokenEntry),
        force,
        preferredAudioLanguage,
      ),
    isLocalizedWatchHistoryDataMissingForEntries: (entries: BoundaryValue, audioLocale: BoundaryValue) =>
      isLocalizedWatchHistoryDataMissingForEntriesInternal(context, toHistoryPreloadEntries(entries), audioLocale),
  };
}

export function createHistoryRepositoryPreload(options: BoundaryValue = {}): HistoryRepositoryPreload {
  return createHistoryRepositoryPreloadInternal(options as HistoryRepositoryPreloadOptions);
}
