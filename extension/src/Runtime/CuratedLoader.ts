;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type RuntimeState = {
    mounted: boolean
    curatedError: unknown
    curatedEntries: unknown[]
    curatedInflight: Promise<unknown[]> | null
    curatedSource: string
    curatedLastRevalidateAt: number
    curatedObservedPromise: Promise<unknown[]> | null
    settings: Record<string, unknown>
  }

  type TokenEntry = {
    accessToken?: unknown
    accountId?: unknown
  }

  type CuratedLoaderContext = {
    state: RuntimeState
    locationRef: Location
    runtimeEvent: (event: string, data?: unknown) => void
    getAccessToken: (forceRefresh: boolean) => Promise<TokenEntry | null>
    resetWatchlistCacheOnAccountMismatch: (accountId: string) => unknown
    fetchAllWatchlistRows: (tokenEntry: TokenEntry) => Promise<unknown[]>
    normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[]
    preloadRatingsForEntries: (
      entries: unknown[],
      tokenEntry: TokenEntry,
      preferredAudioLanguage?: string,
    ) => Promise<unknown>
    preloadWatchHistoryForEntries: (
      entries: unknown[],
      tokenEntry: TokenEntry,
      force?: boolean,
      preferredAudioLanguage?: string,
    ) => Promise<unknown>
    normalizeAudioLocale: (locale: unknown) => string | null
    getPreferredAudioLanguage: () => string
    setWatchlistCacheRows: (accountId: string, rows: unknown[], updatedAt?: number) => unknown
    isWatchlistPath: (pathname: string) => boolean
    renderCuratedPanel: () => void
    watchlistRevalidateCooldownMs: number
  }

  type CuratedLoaderOptions = {
    state?: unknown
    locationRef?: unknown
    runtimeEvent?: unknown
    getAccessToken?: unknown
    resetWatchlistCacheOnAccountMismatch?: unknown
    fetchAllWatchlistRows?: unknown
    normalizeEntriesFromApiRows?: unknown
    preloadRatingsForEntries?: unknown
    preloadWatchHistoryForEntries?: unknown
    normalizeAudioLocale?: unknown
    getPreferredAudioLanguage?: unknown
    setWatchlistCacheRows?: unknown
    isWatchlistPath?: unknown
    renderCuratedPanel?: unknown
    watchlistRevalidateCooldownMs?: unknown
  }

  type CuratedLoaderRuntime = {
    loadCuratedEntries: (force?: boolean) => Promise<unknown[]>
    ensureCuratedDataLoad: (force?: boolean) => Promise<unknown[]>
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated loader dependency: ${name}`)
    }

    return value as T
  }

  function normalizePositiveNumber(value: unknown, fallback: number): number {
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0) {
      return fallback
    }
    return Math.round(number)
  }

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
  }

  function createCuratedLoaderContext(options: CuratedLoaderOptions = {}): CuratedLoaderContext {
    const state = options.state && typeof options.state === 'object' ? (options.state as RuntimeState) : null
    if (!state) {
      throw new Error('[CW] Missing curated loader state')
    }

    const locationRef =
      options.locationRef && typeof options.locationRef === 'object' ? (options.locationRef as Location) : null
    if (!locationRef) {
      throw new Error('[CW] Missing curated loader locationRef')
    }

    return {
      state,
      locationRef,
      runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as CuratedLoaderContext['runtimeEvent'],
      getAccessToken: requireFunction(
        'getAccessToken',
        options.getAccessToken,
      ) as CuratedLoaderContext['getAccessToken'],
      resetWatchlistCacheOnAccountMismatch: requireFunction(
        'resetWatchlistCacheOnAccountMismatch',
        options.resetWatchlistCacheOnAccountMismatch,
      ) as CuratedLoaderContext['resetWatchlistCacheOnAccountMismatch'],
      fetchAllWatchlistRows: requireFunction(
        'fetchAllWatchlistRows',
        options.fetchAllWatchlistRows,
      ) as CuratedLoaderContext['fetchAllWatchlistRows'],
      normalizeEntriesFromApiRows: requireFunction(
        'normalizeEntriesFromApiRows',
        options.normalizeEntriesFromApiRows,
      ) as CuratedLoaderContext['normalizeEntriesFromApiRows'],
      preloadRatingsForEntries: requireFunction(
        'preloadRatingsForEntries',
        options.preloadRatingsForEntries,
      ) as CuratedLoaderContext['preloadRatingsForEntries'],
      preloadWatchHistoryForEntries: requireFunction(
        'preloadWatchHistoryForEntries',
        options.preloadWatchHistoryForEntries,
      ) as CuratedLoaderContext['preloadWatchHistoryForEntries'],
      normalizeAudioLocale: requireFunction(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ) as CuratedLoaderContext['normalizeAudioLocale'],
      getPreferredAudioLanguage: requireFunction(
        'getPreferredAudioLanguage',
        options.getPreferredAudioLanguage,
      ) as CuratedLoaderContext['getPreferredAudioLanguage'],
      setWatchlistCacheRows: requireFunction(
        'setWatchlistCacheRows',
        options.setWatchlistCacheRows,
      ) as CuratedLoaderContext['setWatchlistCacheRows'],
      isWatchlistPath: requireFunction(
        'isWatchlistPath',
        options.isWatchlistPath,
      ) as CuratedLoaderContext['isWatchlistPath'],
      renderCuratedPanel: requireFunction(
        'renderCuratedPanel',
        options.renderCuratedPanel,
      ) as CuratedLoaderContext['renderCuratedPanel'],
      watchlistRevalidateCooldownMs: normalizePositiveNumber(options.watchlistRevalidateCooldownMs, 90_000),
    }
  }

  function hasPromiseFinally(value: unknown): value is Promise<unknown> {
    return Boolean(value) && typeof (value as Promise<unknown>).finally === 'function'
  }

  async function loadCuratedEntriesInternal(context: CuratedLoaderContext, force = false): Promise<unknown[]> {
    if (context.state.curatedInflight) {
      return context.state.curatedInflight
    }

    const inflight = (async () => {
      context.runtimeEvent('curated-load-start')
      context.state.curatedError = null
      const tokenEntry = await context.getAccessToken(false)
      const accessToken = getString(tokenEntry?.accessToken)
      const accountId = getString(tokenEntry?.accountId)

      if (!accessToken || !accountId) {
        throw new Error('Unable to load curated watchlist: Crunchyroll API auth is unavailable.')
      }

      context.resetWatchlistCacheOnAccountMismatch(accountId)

      const rows = await context.fetchAllWatchlistRows(tokenEntry as TokenEntry)
      const entries = context.normalizeEntriesFromApiRows(rows)

      await Promise.all([
        context.preloadRatingsForEntries(entries, tokenEntry as TokenEntry),
        context.preloadWatchHistoryForEntries(entries, tokenEntry as TokenEntry, force),
      ])

      const selectedAudioLocale = context.normalizeAudioLocale(context.state.settings.audioLocaleFilter)
      if (
        selectedAudioLocale &&
        selectedAudioLocale.toLowerCase() !== context.getPreferredAudioLanguage().toLowerCase()
      ) {
        await Promise.all([
          context.preloadRatingsForEntries(entries, tokenEntry as TokenEntry, selectedAudioLocale),
          context.preloadWatchHistoryForEntries(entries, tokenEntry as TokenEntry, true, selectedAudioLocale),
        ])
      }

      context.setWatchlistCacheRows(accountId, rows, Date.now())

      context.state.curatedEntries = entries
      context.state.curatedSource = 'api'
      context.state.curatedError = null
      context.state.curatedLastRevalidateAt = Date.now()

      context.runtimeEvent('curated-load-done', {
        source: 'api',
        total: entries.length,
      })

      return entries
    })()
      .catch((error: unknown) => {
        const hadCachedOrExistingEntries = context.state.curatedEntries.length > 0
        if (!hadCachedOrExistingEntries) {
          context.state.curatedEntries = []
          context.state.curatedSource = 'none'
        }
        context.state.curatedError = hadCachedOrExistingEntries
          ? 'Showing cached data; latest refresh failed.'
          : (error as { message?: unknown })?.message || 'Unable to load curated watchlist from Crunchyroll API.'
        context.runtimeEvent('curated-load-failed', {
          message: (error as { message?: unknown })?.message || context.state.curatedError,
        })
        return context.state.curatedEntries
      })
      .finally(() => {
        context.state.curatedInflight = null
      })

    context.state.curatedInflight = inflight
    return inflight
  }

  function shouldBackgroundRevalidateCuratedInternal(context: CuratedLoaderContext): boolean {
    if (context.state.curatedInflight || !context.state.curatedEntries.length) {
      return false
    }

    const now = Date.now()
    if (context.state.curatedSource === 'cache') {
      return now - context.state.curatedLastRevalidateAt > 1000
    }

    return now - context.state.curatedLastRevalidateAt > context.watchlistRevalidateCooldownMs
  }

  function observeCuratedLoadPromiseInternal(context: CuratedLoaderContext, promise: unknown): void {
    if (!hasPromiseFinally(promise)) {
      return
    }

    if (context.state.curatedObservedPromise === promise) {
      return
    }

    context.state.curatedObservedPromise = promise as Promise<unknown[]>
    promise.finally(() => {
      if (context.state.curatedObservedPromise === promise) {
        context.state.curatedObservedPromise = null
      }

      if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
        return
      }

      context.renderCuratedPanel()
    })
  }

  function ensureCuratedDataLoadInternal(context: CuratedLoaderContext, force = false): Promise<unknown[]> {
    if (!force && context.state.curatedEntries.length) {
      if (shouldBackgroundRevalidateCuratedInternal(context)) {
        const backgroundPromise = loadCuratedEntriesInternal(context, false)
        observeCuratedLoadPromiseInternal(context, backgroundPromise)
      }
      return Promise.resolve(context.state.curatedEntries)
    }

    const promise = loadCuratedEntriesInternal(context, force)
    observeCuratedLoadPromiseInternal(context, promise)
    return promise
  }

  function createCuratedLoaderRuntime(options: CuratedLoaderOptions = {}): CuratedLoaderRuntime {
    const context = createCuratedLoaderContext(options)
    return {
      loadCuratedEntries: (force = false) => loadCuratedEntriesInternal(context, force),
      ensureCuratedDataLoad: (force = false) => ensureCuratedDataLoadInternal(context, force),
    }
  }

  moduleRegistry.runtimeCuratedLoader = {
    createCuratedLoaderRuntime,
  }
})()
