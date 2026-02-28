(() => {
  type LooseRecord = Record<string, unknown>;

  type RuntimeState = {
    mounted: boolean;
    curatedError: unknown;
    curatedEntries: unknown[];
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

  type TokenEntry = {
    accessToken?: unknown;
    accountId?: unknown;
    profileId?: unknown;
  };

  type CuratedLoaderContextLike = {
    state: RuntimeState;
    locationRef: Location;
    runtimeEvent: (event: string, data?: unknown) => void;
    getAccessToken: (forceRefresh: boolean) => Promise<TokenEntry | null>;
    resetWatchlistCacheOnAccountMismatch: (accountId: string, profileId: string) => unknown;
    fetchAllWatchlistRows: (tokenEntry: TokenEntry) => Promise<unknown[]>;
    normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[];
    preloadRatingsForEntries: (
      entries: unknown[],
      tokenEntry: TokenEntry,
      preferredAudioLanguage?: string,
    ) => Promise<unknown>;
    preloadWatchHistoryForEntries: (
      entries: unknown[],
      tokenEntry: TokenEntry,
      force?: boolean,
      preferredAudioLanguage?: string,
    ) => Promise<unknown>;
    normalizeAudioLocale: (locale: unknown) => string | null;
    getPreferredAudioLanguage: () => string;
    setWatchlistCacheRows: (accountId: string, profileId: string, rows: unknown[], updatedAt?: number) => unknown;
    isWatchlistPath: (pathname: string) => boolean;
    renderCuratedPanel: () => void;
    refreshCuratedLoadingIndicator: () => void;
    deferredMetadataRunId: number;
  };

  type CuratedLoaderDeferredMetadataRuntime = {
    splitMetadataPreloadEntries: (
      context: CuratedLoaderContextLike,
      entries: unknown[],
    ) => { priorityEntries: unknown[]; deferredEntries: unknown[] };
    queueDeferredMetadataPreload: (options: {
      context: CuratedLoaderContextLike;
      deferredEntries: unknown[];
      tokenEntry: TokenEntry;
      preloadMetadataForEntries: (entries: unknown[], tokenEntry: TokenEntry) => Promise<void>;
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
    }) => Promise<unknown[]>;
    handleCuratedLoadFailure: (context: CuratedLoaderContextLike, error: unknown) => unknown[];
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord;
    };
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  async function loadAuthorizedTokenInternal(
    context: CuratedLoaderContextLike,
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
    activeRequests: string[],
    progress: PendingRequestProgress,
    forceRefresh: boolean,
  ): Promise<{ tokenEntry: TokenEntry; accountId: string; profileId: string }> {
    // Cache-backed refreshes should still reuse warm/inflight auth when available.
    // We only force-refresh when the caller explicitly requests it or fallback recovery requires it.
    const shouldForceRefresh = forceRefresh;
    let tokenEntry = await pendingRequestsRuntime.withTrackedPendingRequest(
      context,
      activeRequests,
      progress,
      'Authorizing Crunchyroll API token (/auth/v1/token)',
      () => context.getAccessToken(shouldForceRefresh),
    );

    let accessToken = getString(tokenEntry?.accessToken);
    let accountId = getString(tokenEntry?.accountId);
    let profileId = getString(tokenEntry?.profileId);

    if (!shouldForceRefresh && (!accessToken || !accountId || !profileId)) {
      tokenEntry = await pendingRequestsRuntime.withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
        'Refreshing Crunchyroll API token (/auth/v1/token)',
        () => context.getAccessToken(true),
      );
      accessToken = getString(tokenEntry?.accessToken);
      accountId = getString(tokenEntry?.accountId);
      profileId = getString(tokenEntry?.profileId);
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
    tokenEntry: TokenEntry,
  ): Promise<{ rows: unknown[]; entries: unknown[] }> {
    const rows = await pendingRequestsRuntime.withTrackedPendingRequest(
      context,
      activeRequests,
      progress,
      'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
      () => context.fetchAllWatchlistRows(tokenEntry),
    );

    return {
      rows,
      entries: context.normalizeEntriesFromApiRows(rows),
    };
  }

  async function preloadPrimaryLocaleDataInternal(
    context: CuratedLoaderContextLike,
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
    activeRequests: string[],
    progress: PendingRequestProgress,
    entries: unknown[],
    tokenEntry: TokenEntry,
    force: boolean,
  ): Promise<void> {
    await Promise.all([
      pendingRequestsRuntime.withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
        'Fetching ratings (/content-reviews/v3/rating/series/{series_id})',
        () => context.preloadRatingsForEntries(entries, tokenEntry),
      ),
      pendingRequestsRuntime.withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
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

    if (selectedAudioLocale.toLowerCase() === context.getPreferredAudioLanguage().toLowerCase()) {
      return null;
    }

    return selectedAudioLocale;
  }

  async function preloadSelectedAudioLocaleDataInternal(
    context: CuratedLoaderContextLike,
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
    activeRequests: string[],
    progress: PendingRequestProgress,
    entries: unknown[],
    tokenEntry: TokenEntry,
  ): Promise<void> {
    const selectedAudioLocale = resolveSelectedAudioLocaleForPreloadInternal(context);
    if (!selectedAudioLocale) {
      return;
    }

    await Promise.all([
      pendingRequestsRuntime.withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
        `Fetching ${selectedAudioLocale} ratings (/content-reviews/v3/rating/series/{series_id})`,
        () => context.preloadRatingsForEntries(entries, tokenEntry, selectedAudioLocale),
      ),
      pendingRequestsRuntime.withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
        `Fetching ${selectedAudioLocale} watch history (/content/v2/{account_id}/watch-history)`,
        () => context.preloadWatchHistoryForEntries(entries, tokenEntry, true, selectedAudioLocale),
      ),
    ]);
  }

  async function preloadMetadataForEntriesInternal(
    context: CuratedLoaderContextLike,
    entries: unknown[],
    tokenEntry: TokenEntry,
    force: boolean,
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

    await Promise.all([
      context.preloadRatingsForEntries(entries, tokenEntry, selectedAudioLocale),
      context.preloadWatchHistoryForEntries(entries, tokenEntry, true, selectedAudioLocale),
    ]);
  }

  function commitCuratedEntriesFromApiInternal(
    context: CuratedLoaderContextLike,
    accountId: string,
    profileId: string,
    rows: unknown[],
    entries: unknown[],
    phase: 'partial' | 'final',
  ): unknown[] {
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

  function handleCuratedLoadFailureInternal(context: CuratedLoaderContextLike, error: unknown): unknown[] {
    context.state.curatedDeferredMetadataInFlight = false;
    const hadCachedOrExistingEntries = context.state.curatedEntries.length > 0;
    if (!hadCachedOrExistingEntries) {
      context.state.curatedEntries = [];
      context.state.curatedSource = 'none';
    }

    context.state.curatedError = hadCachedOrExistingEntries
      ? 'Showing cached data; latest refresh failed.'
      : (error as { message?: unknown })?.message || 'Unable to load curated watchlist from Crunchyroll API.';

    context.runtimeEvent('curated-load-failed', {
      message: (error as { message?: unknown })?.message || context.state.curatedError,
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
    },
  ): void {
    context.runtimeEvent('curated-load-timing', {
      force: options.force,
      totalEntries: options.totalEntries,
      priorityEntryCount: options.priorityEntryCount,
      deferredEntryCount: options.deferredEntryCount,
      tokenDurationMs: options.tokenDurationMs,
      rowsDurationMs: options.rowsDurationMs,
      priorityMetadataDurationMs: options.priorityMetadataDurationMs,
      totalDurationMs: Date.now() - options.startedAt,
    });
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
  }): Promise<unknown[]> {
    const startedAt = startCuratedLoadCycle(context, pendingRequestsRuntime, activeRequests, pendingProgress);

    const tokenStartedAt = Date.now();
    const { tokenEntry, accountId, profileId } = await loadAuthorizedTokenInternal(
      context,
      pendingRequestsRuntime,
      activeRequests,
      pendingProgress,
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
      tokenEntry,
    );
    const rowsDurationMs = Date.now() - rowsStartedAt;
    commitCuratedEntriesFromApiInternal(context, accountId, profileId, rows, entries, 'partial');

    const { priorityEntries, deferredEntries } = deferredMetadataRuntime.splitMetadataPreloadEntries(context, entries);
    const priorityMetadataStartedAt = Date.now();
    await preloadPrimaryLocaleDataInternal(
      context,
      pendingRequestsRuntime,
      activeRequests,
      pendingProgress,
      priorityEntries,
      tokenEntry,
      force,
    );
    await preloadSelectedAudioLocaleDataInternal(
      context,
      pendingRequestsRuntime,
      activeRequests,
      pendingProgress,
      priorityEntries,
      tokenEntry,
    );
    const priorityMetadataDurationMs = Date.now() - priorityMetadataStartedAt;
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
    });

    deferredMetadataRuntime.queueDeferredMetadataPreload({
      context,
      deferredEntries,
      tokenEntry,
      preloadMetadataForEntries: (metadataEntries, metadataTokenEntry) =>
        preloadMetadataForEntriesInternal(context, metadataEntries, metadataTokenEntry, false),
    });
    return committedEntries;
  }

  function createCuratedLoaderLoadCycleRuntime(): CuratedLoaderLoadCycleRuntime {
    return {
      runCuratedLoadCycle: (options) => runCuratedLoadCycleInternal(options),
      handleCuratedLoadFailure: (context, error) => handleCuratedLoadFailureInternal(context, error),
    };
  }

  moduleRegistry.runtimeCuratedLoaderLoadCycle = {
    createCuratedLoaderLoadCycleRuntime,
  };
})();
