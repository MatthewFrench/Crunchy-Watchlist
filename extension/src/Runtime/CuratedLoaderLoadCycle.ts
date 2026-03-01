type BoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, BoundaryValue>;
type ErrorLike = { message?: BoundaryValue };
type CuratedRow = LooseRecord;
type CuratedEntry = CuratedRow & {
  seriesId?: BoundaryValue;
};
type CuratedRowList = CuratedRow[];
type CuratedEntryList = CuratedEntry[];

type RuntimeState = {
  mounted: boolean;
  curatedError: BoundaryValue;
  curatedEntries: CuratedEntryList;
  curatedSource: string;
  curatedLastRevalidateAt: number;
  deferredMetadataRunId?: number;
  curatedDeferredMetadataInFlight?: boolean;
  settings: LooseRecord;
};

type PendingRequestProgress = {
  started: number;
  completed: number;
};

type CuratedLoadRequestCounters = {
  authToken: number;
  watchlist: number;
  ratings: number;
  watchHistory: number;
  other: number;
};

type CuratedLoadCycleFetchedData = {
  tokenEntry: TokenEntry;
  accountId: string;
  profileId: string;
  rows: CuratedRowList;
  entries: CuratedEntryList;
  tokenDurationMs: number;
  rowsDurationMs: number;
};

type CuratedLoadCyclePriorityMetadata = {
  priorityEntries: CuratedEntryList;
  deferredEntries: CuratedEntryList;
  priorityMetadataDurationMs: number;
};

type TokenEntry = {
  accessToken?: BoundaryValue;
  accountId?: BoundaryValue;
  profileId?: BoundaryValue;
};

type CuratedLoaderContextLike = {
  state: RuntimeState;
  locationRef: Location;
  runtimeEvent: (event: string, data?: BoundaryValue) => void;
  getAccessToken: (forceRefresh: boolean) => Promise<TokenEntry | null>;
  resetWatchlistCacheOnAccountMismatch: (accountId: string, profileId: string) => BoundaryValue;
  fetchAllWatchlistRows: (tokenEntry: TokenEntry) => Promise<CuratedRowList>;
  normalizeEntriesFromApiRows: (rows: CuratedRowList) => CuratedEntryList;
  preloadRatingsForEntries: (
    entries: CuratedEntryList,
    tokenEntry: TokenEntry,
    preferredAudioLanguage?: string,
  ) => Promise<BoundaryValue>;
  preloadWatchHistoryForEntries: (
    entries: CuratedEntryList,
    tokenEntry: TokenEntry,
    force?: boolean,
    preferredAudioLanguage?: string,
  ) => Promise<BoundaryValue>;
  isLocalizedWatchHistoryDataMissingForEntries: (entries: CuratedEntryList, audioLocale: BoundaryValue) => boolean;
  normalizeAudioLocale: (locale: BoundaryValue) => string | null;
  getPreferredAudioLanguage: () => string;
  setWatchlistCacheRows: (
    accountId: string,
    profileId: string,
    rows: CuratedRowList,
    updatedAt?: number,
  ) => BoundaryValue;
  isWatchlistPath: (pathname: string) => boolean;
  renderCuratedPanel: () => void;
  refreshCuratedLoadingIndicator: () => void;
  deferredMetadataRunId: number;
};

type CuratedLoaderDeferredMetadataRuntime = {
  splitMetadataPreloadEntries: (
    context: CuratedLoaderContextLike,
    entries: CuratedEntryList,
  ) => { priorityEntries: CuratedEntryList; deferredEntries: CuratedEntryList };
  queueDeferredMetadataPreload: (options: {
    context: CuratedLoaderContextLike;
    deferredEntries: CuratedEntryList;
    tokenEntry: TokenEntry;
    preloadMetadataForEntries: (entries: CuratedEntryList, tokenEntry: TokenEntry) => Promise<void>;
  }) => void;
};

type CuratedLoaderPendingRequestsRuntime = {
  syncPendingRequestDiagnostics: (
    context: Pick<
      CuratedLoaderContextLike,
      'state' | 'locationRef' | 'isWatchlistPath' | 'refreshCuratedLoadingIndicator'
    >,
    activeRequests: string[],
    progress: PendingRequestProgress,
  ) => void;
  withTrackedPendingRequest: <T>(
    context: Pick<
      CuratedLoaderContextLike,
      'state' | 'locationRef' | 'isWatchlistPath' | 'refreshCuratedLoadingIndicator'
    >,
    activeRequests: string[],
    progress: PendingRequestProgress,
    label: string,
    work: () => Promise<T>,
  ) => Promise<T>;
};

type CuratedLoaderLoadCycleRuntime = {
  runCuratedLoadCycle: (options: {
    context: CuratedLoaderContextLike;
    deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime;
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime;
    activeRequests: string[];
    pendingProgress: PendingRequestProgress;
    force: boolean;
  }) => Promise<CuratedEntryList>;
  handleCuratedLoadFailure: (context: CuratedLoaderContextLike, error: BoundaryValue) => CuratedEntryList;
};

function getString(value: BoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toCuratedRowList(value: BoundaryValue): CuratedRowList {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((row): row is CuratedRow => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
}

function toCuratedEntryList(value: BoundaryValue): CuratedEntryList {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is CuratedEntry => Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
  );
}

function createCuratedLoadRequestCounters(): CuratedLoadRequestCounters {
  return {
    authToken: 0,
    watchlist: 0,
    ratings: 0,
    watchHistory: 0,
    other: 0,
  };
}

function classifyCuratedRequestLabel(label: string): keyof CuratedLoadRequestCounters {
  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel.includes('/auth/v1/token')) {
    return 'authToken';
  }
  if (normalizedLabel.includes('/discover/{account_id}/watchlist')) {
    return 'watchlist';
  }
  if (normalizedLabel.includes('rating')) {
    return 'ratings';
  }
  if (normalizedLabel.includes('watch history')) {
    return 'watchHistory';
  }
  return 'other';
}

function getCuratedLoadRequestCountTotal(requestCounters: CuratedLoadRequestCounters): number {
  return (
    requestCounters.authToken +
    requestCounters.watchlist +
    requestCounters.ratings +
    requestCounters.watchHistory +
    requestCounters.other
  );
}

async function withTrackedPendingRequestWithMetrics<T>(
  context: CuratedLoaderContextLike,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  progress: PendingRequestProgress,
  requestCounters: CuratedLoadRequestCounters,
  label: string,
  work: () => Promise<T>,
): Promise<T> {
  const requestClass = classifyCuratedRequestLabel(label);
  requestCounters[requestClass] += 1;
  return pendingRequestsRuntime.withTrackedPendingRequest(context, activeRequests, progress, label, work);
}

async function loadAuthorizedTokenInternal(
  context: CuratedLoaderContextLike,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  progress: PendingRequestProgress,
  requestCounters: CuratedLoadRequestCounters,
  forceRefresh: boolean,
): Promise<{ tokenEntry: TokenEntry; accountId: string; profileId: string }> {
  // Cache-backed refreshes should still reuse warm/inflight auth when available.
  // We only force-refresh when the caller explicitly requests it or fallback recovery requires it.
  const shouldForceRefresh = forceRefresh;
  let tokenEntry = await withTrackedPendingRequestWithMetrics(
    context,
    pendingRequestsRuntime,
    activeRequests,
    progress,
    requestCounters,
    'Authorizing Crunchyroll API token (/auth/v1/token)',
    () => context.getAccessToken(shouldForceRefresh),
  );

  let accessToken = getString(tokenEntry?.accessToken);
  let accountId = getString(tokenEntry?.accountId);
  let profileId = getString(tokenEntry?.profileId);

  if (!shouldForceRefresh && (!accessToken || !accountId || !profileId)) {
    const refreshedTokenEntry = await withTrackedPendingRequestWithMetrics(
      context,
      pendingRequestsRuntime,
      activeRequests,
      progress,
      requestCounters,
      'Refreshing Crunchyroll API token (/auth/v1/token)',
      () => context.getAccessToken(true),
    );
    const refreshedAccessToken = getString(refreshedTokenEntry?.accessToken);
    const refreshedAccountId = getString(refreshedTokenEntry?.accountId);
    const refreshedProfileId = getString(refreshedTokenEntry?.profileId);

    if (refreshedAccessToken && refreshedAccountId) {
      tokenEntry = refreshedTokenEntry;
      accessToken = refreshedAccessToken;
      accountId = refreshedAccountId;
      profileId = refreshedProfileId;
    }
  }

  if (!accessToken || !accountId) {
    throw new Error('Unable to load curated watchlist: Crunchyroll API auth is unavailable.');
  }

  return {
    tokenEntry: tokenEntry as TokenEntry,
    accountId,
    profileId,
  };
}

async function loadRowsAndEntriesInternal(
  context: CuratedLoaderContextLike,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  progress: PendingRequestProgress,
  requestCounters: CuratedLoadRequestCounters,
  tokenEntry: TokenEntry,
): Promise<{ rows: CuratedRowList; entries: CuratedEntryList }> {
  const rawRows = await withTrackedPendingRequestWithMetrics(
    context,
    pendingRequestsRuntime,
    activeRequests,
    progress,
    requestCounters,
    'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
    () => context.fetchAllWatchlistRows(tokenEntry),
  );
  const rows = toCuratedRowList(rawRows);
  const normalizedEntries = context.normalizeEntriesFromApiRows(rows);

  return {
    rows,
    entries: toCuratedEntryList(normalizedEntries),
  };
}

async function preloadPrimaryLocaleDataInternal(
  context: CuratedLoaderContextLike,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  progress: PendingRequestProgress,
  requestCounters: CuratedLoadRequestCounters,
  entries: CuratedEntryList,
  tokenEntry: TokenEntry,
  force: boolean,
): Promise<void> {
  await Promise.all([
    withTrackedPendingRequestWithMetrics(
      context,
      pendingRequestsRuntime,
      activeRequests,
      progress,
      requestCounters,
      'Fetching ratings (/content-reviews/v3/rating/series/{series_id})',
      () => context.preloadRatingsForEntries(entries, tokenEntry),
    ),
    withTrackedPendingRequestWithMetrics(
      context,
      pendingRequestsRuntime,
      activeRequests,
      progress,
      requestCounters,
      'Fetching watch history (/content/v2/{account_id}/watch-history)',
      () => context.preloadWatchHistoryForEntries(entries, tokenEntry, force),
    ),
  ]);
}

function resolveSelectedAudioLocaleForPreloadInternal(context: CuratedLoaderContextLike): string | null {
  const selectedAudioLocale = context.normalizeAudioLocale(context.state.settings.audioLocaleFilter);
  if (!selectedAudioLocale) {
    return null;
  }

  if (selectedAudioLocale.toLowerCase() === 'any') {
    return null;
  }

  if (selectedAudioLocale.toLowerCase() === context.getPreferredAudioLanguage().toLowerCase()) {
    return null;
  }

  return selectedAudioLocale;
}

function shouldPreloadSelectedAudioLocaleWatchHistoryInternal(
  context: CuratedLoaderContextLike,
  entries: CuratedEntryList,
  selectedAudioLocale: string,
): boolean {
  return entries.length > 0 && context.isLocalizedWatchHistoryDataMissingForEntries(entries, selectedAudioLocale);
}

async function preloadSelectedAudioLocaleDataInternal(
  context: CuratedLoaderContextLike,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  progress: PendingRequestProgress,
  requestCounters: CuratedLoadRequestCounters,
  entries: CuratedEntryList,
  tokenEntry: TokenEntry,
): Promise<void> {
  const selectedAudioLocale = resolveSelectedAudioLocaleForPreloadInternal(context);
  if (!selectedAudioLocale) {
    return;
  }

  const preloadTasks: Array<Promise<BoundaryValue>> = [
    withTrackedPendingRequestWithMetrics(
      context,
      pendingRequestsRuntime,
      activeRequests,
      progress,
      requestCounters,
      `Fetching ${selectedAudioLocale} ratings (/content-reviews/v3/rating/series/{series_id})`,
      () => context.preloadRatingsForEntries(entries, tokenEntry, selectedAudioLocale),
    ),
  ];

  if (shouldPreloadSelectedAudioLocaleWatchHistoryInternal(context, entries, selectedAudioLocale)) {
    preloadTasks.push(
      withTrackedPendingRequestWithMetrics(
        context,
        pendingRequestsRuntime,
        activeRequests,
        progress,
        requestCounters,
        `Fetching ${selectedAudioLocale} watch history (/content/v2/{account_id}/watch-history)`,
        () => context.preloadWatchHistoryForEntries(entries, tokenEntry, true, selectedAudioLocale),
      ),
    );
  }

  await Promise.all(preloadTasks);
}

async function preloadMetadataForEntriesInternal(
  context: CuratedLoaderContextLike,
  entries: CuratedEntryList,
  tokenEntry: TokenEntry,
  force: boolean,
  preloadSelectedAudioLocaleWatchHistory: boolean,
): Promise<void> {
  if (!entries.length) {
    return;
  }

  await Promise.all([
    context.preloadRatingsForEntries(entries, tokenEntry),
    context.preloadWatchHistoryForEntries(entries, tokenEntry, force),
  ]);

  const selectedAudioLocale = resolveSelectedAudioLocaleForPreloadInternal(context);
  if (!selectedAudioLocale) {
    return;
  }

  const preloadTasks: Array<Promise<BoundaryValue>> = [
    context.preloadRatingsForEntries(entries, tokenEntry, selectedAudioLocale),
  ];

  if (
    preloadSelectedAudioLocaleWatchHistory &&
    shouldPreloadSelectedAudioLocaleWatchHistoryInternal(context, entries, selectedAudioLocale)
  ) {
    preloadTasks.push(context.preloadWatchHistoryForEntries(entries, tokenEntry, true, selectedAudioLocale));
  }

  await Promise.all(preloadTasks);
}

function commitCuratedEntriesFromApiInternal(
  context: CuratedLoaderContextLike,
  accountId: string,
  profileId: string,
  rows: CuratedRowList,
  entries: CuratedEntryList,
  phase: 'partial' | 'final',
): CuratedEntryList {
  const committedAt = Date.now();
  context.setWatchlistCacheRows(accountId, profileId, rows, committedAt);
  context.state.curatedEntries = entries;
  context.state.curatedSource = 'api';
  context.state.curatedError = null;
  context.state.curatedLastRevalidateAt = committedAt;

  context.runtimeEvent(phase === 'partial' ? 'curated-load-partial' : 'curated-load-done', {
    source: 'api',
    total: entries.length,
  });
  if (context.state.mounted && context.isWatchlistPath(context.locationRef.pathname)) {
    context.renderCuratedPanel();
  }

  return entries;
}

function handleCuratedLoadFailureInternal(context: CuratedLoaderContextLike, error: BoundaryValue): CuratedEntryList {
  context.state.curatedDeferredMetadataInFlight = false;
  const hadCachedOrExistingEntries = context.state.curatedEntries.length > 0;
  if (!hadCachedOrExistingEntries) {
    context.state.curatedEntries = [];
    context.state.curatedSource = 'none';
  }

  context.state.curatedError = hadCachedOrExistingEntries
    ? 'Showing cached data; latest refresh failed.'
    : (error as ErrorLike)?.message || 'Unable to load curated watchlist from Crunchyroll API.';

  context.runtimeEvent('curated-load-failed', {
    message: (error as ErrorLike)?.message || context.state.curatedError,
  });
  return context.state.curatedEntries;
}

function startCuratedLoadCycle(
  context: CuratedLoaderContextLike,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  pendingProgress: PendingRequestProgress,
): number {
  context.deferredMetadataRunId += 1;
  context.runtimeEvent('curated-load-start');
  context.state.curatedError = null;
  context.state.curatedDeferredMetadataInFlight = false;
  pendingRequestsRuntime.syncPendingRequestDiagnostics(context, activeRequests, pendingProgress);
  return Date.now();
}

function emitCuratedLoadTimingEvent(
  context: CuratedLoaderContextLike,
  options: {
    force: boolean;
    totalEntries: number;
    priorityEntryCount: number;
    deferredEntryCount: number;
    tokenDurationMs: number;
    rowsDurationMs: number;
    priorityMetadataDurationMs: number;
    startedAt: number;
    requestCounters: CuratedLoadRequestCounters;
  },
): void {
  const requestCounters = options.requestCounters;
  context.runtimeEvent('curated-load-timing', {
    force: options.force,
    totalEntries: options.totalEntries,
    priorityEntryCount: options.priorityEntryCount,
    deferredEntryCount: options.deferredEntryCount,
    tokenDurationMs: options.tokenDurationMs,
    rowsDurationMs: options.rowsDurationMs,
    priorityMetadataDurationMs: options.priorityMetadataDurationMs,
    totalDurationMs: Date.now() - options.startedAt,
    requestCountTotal: getCuratedLoadRequestCountTotal(requestCounters),
    requestCounts: {
      authToken: requestCounters.authToken,
      watchlist: requestCounters.watchlist,
      ratings: requestCounters.ratings,
      watchHistory: requestCounters.watchHistory,
      other: requestCounters.other,
    },
  });
}

async function fetchAndCommitPartialEntriesInternal(
  context: CuratedLoaderContextLike,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  pendingProgress: PendingRequestProgress,
  requestCounters: CuratedLoadRequestCounters,
  force: boolean,
): Promise<CuratedLoadCycleFetchedData> {
  const tokenStartedAt = Date.now();
  const { tokenEntry, accountId, profileId } = await loadAuthorizedTokenInternal(
    context,
    pendingRequestsRuntime,
    activeRequests,
    pendingProgress,
    requestCounters,
    force,
  );
  const tokenDurationMs = Date.now() - tokenStartedAt;
  context.resetWatchlistCacheOnAccountMismatch(accountId, profileId);

  const rowsStartedAt = Date.now();
  const { rows, entries } = await loadRowsAndEntriesInternal(
    context,
    pendingRequestsRuntime,
    activeRequests,
    pendingProgress,
    requestCounters,
    tokenEntry,
  );
  const rowsDurationMs = Date.now() - rowsStartedAt;
  commitCuratedEntriesFromApiInternal(context, accountId, profileId, rows, entries, 'partial');

  return {
    tokenEntry,
    accountId,
    profileId,
    rows,
    entries,
    tokenDurationMs,
    rowsDurationMs,
  };
}

async function preloadPriorityMetadataInternal(
  context: CuratedLoaderContextLike,
  deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime,
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
  activeRequests: string[],
  pendingProgress: PendingRequestProgress,
  requestCounters: CuratedLoadRequestCounters,
  entries: CuratedEntryList,
  tokenEntry: TokenEntry,
  force: boolean,
): Promise<CuratedLoadCyclePriorityMetadata> {
  const { priorityEntries, deferredEntries } = deferredMetadataRuntime.splitMetadataPreloadEntries(context, entries);
  const priorityMetadataStartedAt = Date.now();
  await preloadPrimaryLocaleDataInternal(
    context,
    pendingRequestsRuntime,
    activeRequests,
    pendingProgress,
    requestCounters,
    priorityEntries,
    tokenEntry,
    force,
  );
  await preloadSelectedAudioLocaleDataInternal(
    context,
    pendingRequestsRuntime,
    activeRequests,
    pendingProgress,
    requestCounters,
    priorityEntries,
    tokenEntry,
  );
  const priorityMetadataDurationMs = Date.now() - priorityMetadataStartedAt;

  return {
    priorityEntries,
    deferredEntries,
    priorityMetadataDurationMs,
  };
}

async function runCuratedLoadCycleInternal({
  context,
  deferredMetadataRuntime,
  pendingRequestsRuntime,
  activeRequests,
  pendingProgress,
  force,
}: {
  context: CuratedLoaderContextLike;
  deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime;
  pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime;
  activeRequests: string[];
  pendingProgress: PendingRequestProgress;
  force: boolean;
}): Promise<CuratedEntryList> {
  const startedAt = startCuratedLoadCycle(context, pendingRequestsRuntime, activeRequests, pendingProgress);
  const requestCounters = createCuratedLoadRequestCounters();

  const { tokenEntry, accountId, profileId, rows, entries, tokenDurationMs, rowsDurationMs } =
    await fetchAndCommitPartialEntriesInternal(
      context,
      pendingRequestsRuntime,
      activeRequests,
      pendingProgress,
      requestCounters,
      force,
    );

  const { priorityEntries, deferredEntries, priorityMetadataDurationMs } = await preloadPriorityMetadataInternal(
    context,
    deferredMetadataRuntime,
    pendingRequestsRuntime,
    activeRequests,
    pendingProgress,
    requestCounters,
    entries,
    tokenEntry,
    force,
  );
  const committedEntries = commitCuratedEntriesFromApiInternal(context, accountId, profileId, rows, entries, 'final');

  emitCuratedLoadTimingEvent(context, {
    force,
    totalEntries: entries.length,
    priorityEntryCount: priorityEntries.length,
    deferredEntryCount: deferredEntries.length,
    tokenDurationMs,
    rowsDurationMs,
    priorityMetadataDurationMs,
    startedAt,
    requestCounters,
  });

  deferredMetadataRuntime.queueDeferredMetadataPreload({
    context,
    deferredEntries,
    tokenEntry,
    preloadMetadataForEntries: (metadataEntries, metadataTokenEntry) =>
      preloadMetadataForEntriesInternal(context, metadataEntries, metadataTokenEntry, false, false),
  });
  return committedEntries;
}

export function createCuratedLoaderLoadCycleRuntime(): CuratedLoaderLoadCycleRuntime {
  return {
    runCuratedLoadCycle: (options) => runCuratedLoadCycleInternal(options),
    handleCuratedLoadFailure: (context, error) => handleCuratedLoadFailureInternal(context, error),
  };
}
