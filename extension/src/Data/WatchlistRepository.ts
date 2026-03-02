type BoundaryValue = LooseRecord[string];
type BoundaryRecord = Record<string, BoundaryValue>;
type WatchlistRow = BoundaryRecord;

type WatchlistCacheSnapshot = {
  accountId: string;
  profileId: string;
  updatedAt: number;
  rows: WatchlistRow[];
};

type WatchlistRepositoryState = {
  watchlistCache: WatchlistCacheSnapshot;
};
type WatchlistCacheLike = Partial<WatchlistCacheSnapshot>;
type WatchlistCacheScope = {
  accountId: string;
  profileId: string;
};
type SetWatchlistCacheRowsInput = {
  accountId: string;
  profileId: string;
  updatedAt: BoundaryValue;
  rows: BoundaryValue;
};

type WatchlistRepositoryContext = {
  state: WatchlistRepositoryState;
  createWatchlistCacheSnapshot: (
    accountId?: BoundaryValue,
    profileIdOrUpdatedAt?: BoundaryValue,
    updatedAtOrRows?: BoundaryValue,
    rowsMaybe?: BoundaryValue,
  ) => WatchlistCacheSnapshot;
  scheduleSaveWatchlistCache: () => void;
  watchlistCacheTtlMs: number;
};

type WatchlistRepositoryOptions = {
  state?: BoundaryValue;
  createWatchlistCacheSnapshot?: BoundaryValue;
  scheduleSaveWatchlistCache?: BoundaryValue;
  watchlistCacheTtlMs?: BoundaryValue;
};

function requireFunction<T>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing watchlist repository dependency: ${name}`);
  }

  return value as T;
}

function toOptionalString(value: BoundaryValue): string {
  return typeof value === 'string' ? value : '';
}

function toWatchlistRows(value: BoundaryValue): WatchlistRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((row): row is WatchlistRow => !!row && typeof row === 'object' && !Array.isArray(row));
}

function toWatchlistCacheLike(value: BoundaryValue): WatchlistCacheLike | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as WatchlistCacheLike;
}

function resolveWatchlistCacheScope(accountId?: BoundaryValue, profileId?: BoundaryValue): WatchlistCacheScope {
  return {
    accountId: toOptionalString(accountId),
    profileId: toOptionalString(profileId),
  };
}

function normalizeSetWatchlistCacheRowsInput(
  accountId: BoundaryValue = '',
  profileIdOrRows: BoundaryValue = '',
  updatedAtOrRows: BoundaryValue = Date.now(),
  rowsMaybe?: BoundaryValue,
): SetWatchlistCacheRowsInput {
  const hasExplicitProfileId =
    typeof profileIdOrRows === 'string' || (rowsMaybe !== undefined && Array.isArray(rowsMaybe));

  return {
    accountId: toOptionalString(accountId),
    profileId: hasExplicitProfileId ? toOptionalString(profileIdOrRows) : '',
    rows: hasExplicitProfileId ? toWatchlistRows(updatedAtOrRows) : toWatchlistRows(profileIdOrRows),
    updatedAt: hasExplicitProfileId ? rowsMaybe : updatedAtOrRows,
  };
}

function createWatchlistRepositoryContext(options: WatchlistRepositoryOptions = {}): WatchlistRepositoryContext {
  const state = options.state && typeof options.state === 'object' ? (options.state as WatchlistRepositoryState) : null;
  if (!state) {
    throw new Error('[CW] Missing watchlist repository state');
  }

  return {
    state,
    createWatchlistCacheSnapshot: requireFunction(
      'createWatchlistCacheSnapshot',
      options.createWatchlistCacheSnapshot,
    ) as WatchlistRepositoryContext['createWatchlistCacheSnapshot'],
    scheduleSaveWatchlistCache: requireFunction(
      'scheduleSaveWatchlistCache',
      options.scheduleSaveWatchlistCache,
    ) as WatchlistRepositoryContext['scheduleSaveWatchlistCache'],
    watchlistCacheTtlMs: Math.max(1, Number(options.watchlistCacheTtlMs) || 1),
  };
}

function normalizeStoredWatchlistCacheInternal(
  context: WatchlistRepositoryContext,
  raw: WatchlistCacheLike | null,
): WatchlistCacheSnapshot {
  if (!raw) {
    return context.createWatchlistCacheSnapshot();
  }

  const source = raw;
  const rows = toWatchlistRows(source.rows);

  return context.createWatchlistCacheSnapshot(source.accountId, source.profileId, source.updatedAt, rows);
}

function isWatchlistCacheValidInternal(
  context: WatchlistRepositoryContext,
  cache: WatchlistCacheLike | null = context.state.watchlistCache,
  scope: WatchlistCacheScope = resolveWatchlistCacheScope(),
): boolean {
  if (!cache) {
    return false;
  }

  const snapshot = cache;
  if (!Array.isArray(snapshot.rows)) {
    return false;
  }

  if (typeof snapshot.updatedAt !== 'number') {
    return false;
  }

  const snapshotAccountId = toOptionalString(snapshot.accountId);
  if (scope.accountId) {
    if (!snapshotAccountId) {
      return false;
    }
    if (snapshotAccountId !== scope.accountId) {
      return false;
    }
  }

  const snapshotProfileId = toOptionalString(snapshot.profileId);
  if (scope.profileId) {
    // Scope-aware loads must not hydrate legacy cache rows that predate profile scoping.
    if (!snapshotProfileId) {
      return false;
    }
    if (snapshotProfileId !== scope.profileId) {
      return false;
    }
  }

  if (!snapshot.rows.length) {
    return false;
  }

  return Date.now() - snapshot.updatedAt < context.watchlistCacheTtlMs;
}

function resetWatchlistCacheOnAccountMismatchInternal(
  context: WatchlistRepositoryContext,
  scope: WatchlistCacheScope,
): boolean {
  const existingAccountId = toOptionalString(context.state.watchlistCache?.accountId);
  const existingProfileId = toOptionalString(context.state.watchlistCache?.profileId);
  const existingRows = Array.isArray(context.state.watchlistCache?.rows) ? context.state.watchlistCache.rows : [];
  const accountMismatch = !!scope.accountId && !!existingAccountId && scope.accountId !== existingAccountId;
  const profileMismatch = !!scope.profileId && !!existingProfileId && scope.profileId !== existingProfileId;
  const legacyProfileScopeDetected = !!scope.profileId && !existingProfileId && existingRows.length > 0;

  if (!accountMismatch && !profileMismatch && !legacyProfileScopeDetected) {
    return false;
  }

  context.state.watchlistCache = context.createWatchlistCacheSnapshot();
  context.scheduleSaveWatchlistCache();
  return true;
}

function setWatchlistCacheRowsInternal(
  context: WatchlistRepositoryContext,
  input: SetWatchlistCacheRowsInput,
): WatchlistCacheSnapshot {
  context.state.watchlistCache = context.createWatchlistCacheSnapshot(
    input.accountId,
    input.profileId,
    input.updatedAt,
    input.rows,
  );
  context.scheduleSaveWatchlistCache();
  return context.state.watchlistCache;
}

function createWatchlistRepository(options: WatchlistRepositoryOptions = {}) {
  const context = createWatchlistRepositoryContext(options);
  return {
    normalizeStoredWatchlistCache: (raw: BoundaryValue) =>
      normalizeStoredWatchlistCacheInternal(context, toWatchlistCacheLike(raw)),
    isWatchlistCacheValid: (
      cache: BoundaryValue = context.state.watchlistCache,
      accountId?: BoundaryValue,
      profileId?: BoundaryValue,
    ) =>
      isWatchlistCacheValidInternal(
        context,
        toWatchlistCacheLike(cache),
        resolveWatchlistCacheScope(accountId, profileId),
      ),
    resetWatchlistCacheOnAccountMismatch: (accountId: BoundaryValue, profileId?: BoundaryValue) =>
      resetWatchlistCacheOnAccountMismatchInternal(context, resolveWatchlistCacheScope(accountId, profileId)),
    setWatchlistCacheRows: (
      accountId: BoundaryValue,
      profileIdOrRows: BoundaryValue,
      updatedAtOrRows: BoundaryValue,
      rowsMaybe?: BoundaryValue,
    ) =>
      setWatchlistCacheRowsInternal(
        context,
        normalizeSetWatchlistCacheRowsInput(accountId, profileIdOrRows, updatedAtOrRows, rowsMaybe),
      ),
  };
}

const watchlistRepositoryRuntime = {
  createWatchlistRepository,
};

export function createWatchlistRepositoryRuntime(): object {
  return watchlistRepositoryRuntime;
}
