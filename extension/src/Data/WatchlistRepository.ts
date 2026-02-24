;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type WatchlistRow = Record<string, unknown>

  type WatchlistCacheSnapshot = {
    accountId: string
    updatedAt: number
    rows: WatchlistRow[]
  }

  type WatchlistRepositoryState = {
    watchlistCache: WatchlistCacheSnapshot
  }

  type WatchlistRepositoryContext = {
    state: WatchlistRepositoryState
    createWatchlistCacheSnapshot: (accountId?: unknown, updatedAt?: unknown, rows?: unknown[]) => WatchlistCacheSnapshot
    scheduleSaveWatchlistCache: () => void
    watchlistCacheTtlMs: number
  }

  type WatchlistRepositoryOptions = {
    state?: unknown
    createWatchlistCacheSnapshot?: unknown
    scheduleSaveWatchlistCache?: unknown
    watchlistCacheTtlMs?: unknown
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing watchlist repository dependency: ${name}`)
    }

    return value as T
  }

  function createWatchlistRepositoryContext(options: WatchlistRepositoryOptions = {}): WatchlistRepositoryContext {
    const state =
      options.state && typeof options.state === 'object' ? (options.state as WatchlistRepositoryState) : null
    if (!state) {
      throw new Error('[CW] Missing watchlist repository state')
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
    }
  }

  function normalizeStoredWatchlistCacheInternal(
    context: WatchlistRepositoryContext,
    raw: unknown,
  ): WatchlistCacheSnapshot {
    if (!raw || typeof raw !== 'object') {
      return context.createWatchlistCacheSnapshot()
    }

    const source = raw as Record<string, unknown>
    const rows = Array.isArray(source.rows)
      ? source.rows.filter((row): row is WatchlistRow => !!row && typeof row === 'object')
      : []

    return context.createWatchlistCacheSnapshot(source.accountId, source.updatedAt, rows)
  }

  function isWatchlistCacheValidInternal(
    context: WatchlistRepositoryContext,
    cache: unknown = context.state.watchlistCache,
    accountId?: unknown,
  ): boolean {
    if (!cache || typeof cache !== 'object') {
      return false
    }

    const snapshot = cache as Partial<WatchlistCacheSnapshot>
    if (!Array.isArray(snapshot.rows)) {
      return false
    }

    if (typeof snapshot.updatedAt !== 'number') {
      return false
    }

    if (
      typeof accountId === 'string' &&
      accountId &&
      typeof snapshot.accountId === 'string' &&
      snapshot.accountId &&
      snapshot.accountId !== accountId
    ) {
      return false
    }

    if (!snapshot.rows.length) {
      return false
    }

    return Date.now() - snapshot.updatedAt < context.watchlistCacheTtlMs
  }

  function resetWatchlistCacheOnAccountMismatchInternal(
    context: WatchlistRepositoryContext,
    accountId: unknown,
  ): boolean {
    const normalizedAccountId = typeof accountId === 'string' ? accountId : ''
    const existingAccountId =
      typeof context.state.watchlistCache?.accountId === 'string' ? context.state.watchlistCache.accountId : ''
    if (!normalizedAccountId || !existingAccountId || normalizedAccountId === existingAccountId) {
      return false
    }

    context.state.watchlistCache = context.createWatchlistCacheSnapshot()
    context.scheduleSaveWatchlistCache()
    return true
  }

  function setWatchlistCacheRowsInternal(
    context: WatchlistRepositoryContext,
    accountId: unknown = '',
    rows: unknown[] = [],
    updatedAt: unknown = Date.now(),
  ): WatchlistCacheSnapshot {
    context.state.watchlistCache = context.createWatchlistCacheSnapshot(accountId, updatedAt, rows)
    context.scheduleSaveWatchlistCache()
    return context.state.watchlistCache
  }

  function createWatchlistRepository(options: WatchlistRepositoryOptions = {}) {
    const context = createWatchlistRepositoryContext(options)
    return {
      normalizeStoredWatchlistCache: (raw: unknown) => normalizeStoredWatchlistCacheInternal(context, raw),
      isWatchlistCacheValid: (cache: unknown, accountId: unknown) =>
        isWatchlistCacheValidInternal(context, cache, accountId),
      resetWatchlistCacheOnAccountMismatch: (accountId: unknown) =>
        resetWatchlistCacheOnAccountMismatchInternal(context, accountId),
      setWatchlistCacheRows: (accountId: unknown, rows: unknown[], updatedAt: unknown) =>
        setWatchlistCacheRowsInternal(context, accountId, rows, updatedAt),
    }
  }

  moduleRegistry.watchlistRepository = {
    createWatchlistRepository,
  }
})()
