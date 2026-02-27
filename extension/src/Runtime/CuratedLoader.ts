;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type RuntimeState = {
    mounted: boolean
    curatedError: unknown
    curatedEntries: unknown[]
    curatedInflight: Promise<unknown[]> | null
    curatedPendingRequests: string[]
    curatedPendingRequestStartedCount: number
    curatedPendingRequestCompletedCount: number
    curatedSource: string
    curatedLastRevalidateAt: number
    curatedObservedPromise: Promise<unknown[]> | null
    curatedInitialLoadDone?: boolean
    settings: Record<string, unknown>
  }

  type PendingRequestProgress = {
    started: number
    completed: number
  }

  type TokenEntry = {
    accessToken?: unknown
    accountId?: unknown
    profileId?: unknown
  }

  type CuratedLoaderContext = {
    state: RuntimeState
    windowRef: Window
    documentRef: Document | null
    locationRef: Location
    runtimeEvent: (event: string, data?: unknown) => void
    getAccessToken: (forceRefresh: boolean) => Promise<TokenEntry | null>
    resetWatchlistCacheOnAccountMismatch: (accountId: string, profileId: string) => unknown
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
    setWatchlistCacheRows: (accountId: string, profileId: string, rows: unknown[], updatedAt?: number) => unknown
    isWatchlistPath: (pathname: string) => boolean
    renderCuratedPanel: () => void
    refreshCuratedLoadingIndicator: () => void
    watchlistRevalidateCooldownMs: number
    watchlistCacheSourceRevalidateCooldownMs: number
    metadataPriorityEntryCount: number
    metadataDeferredChunkSize: number
    metadataDeferredIdleTimeoutMs: number
    metadataDeferredHiddenDelayMs: number
    metadataViewportPriorityCount: number
    deferredMetadataRunId: number
  }

  type CuratedLoaderOptions = {
    state?: unknown
    windowRef?: unknown
    documentRef?: unknown
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
    refreshCuratedLoadingIndicator?: unknown
    watchlistRevalidateCooldownMs?: unknown
    watchlistCacheSourceRevalidateCooldownMs?: unknown
    metadataPriorityEntryCount?: unknown
    metadataDeferredChunkSize?: unknown
    metadataDeferredIdleTimeoutMs?: unknown
    metadataDeferredHiddenDelayMs?: unknown
    metadataViewportPriorityCount?: unknown
  }

  type CuratedLoaderRuntime = {
    loadCuratedEntries: (force?: boolean) => Promise<unknown[]>
    ensureCuratedDataLoad: (force?: boolean) => Promise<unknown[]>
  }

  type CuratedLoaderDeferredMetadataRuntime = {
    splitMetadataPreloadEntries: (
      context: CuratedLoaderContext,
      entries: unknown[],
    ) => { priorityEntries: unknown[]; deferredEntries: unknown[] }
    queueDeferredMetadataPreload: (options: {
      context: CuratedLoaderContext
      deferredEntries: unknown[]
      tokenEntry: TokenEntry
      preloadMetadataForEntries: (entries: unknown[], tokenEntry: TokenEntry) => Promise<void>
    }) => void
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

  function normalizePendingRequestLabels(activeRequests: string[]): string[] {
    return activeRequests.map((label) => getString(label)).filter((label) => Boolean(label))
  }

  function getPendingRequestProgress(state: RuntimeState): PendingRequestProgress {
    const started = Number(state.curatedPendingRequestStartedCount)
    const completed = Number(state.curatedPendingRequestCompletedCount)
    return {
      started: Number.isFinite(started) && started >= 0 ? Math.round(started) : 0,
      completed: Number.isFinite(completed) && completed >= 0 ? Math.round(completed) : 0,
    }
  }

  function areStringArraysEqual(left: string[], right: string[]): boolean {
    if (left.length !== right.length) {
      return false
    }

    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false
      }
    }

    return true
  }

  function syncPendingRequestDiagnostics(
    context: CuratedLoaderContext,
    activeRequests: string[],
    progress: PendingRequestProgress,
  ): void {
    const nextPendingRequests = normalizePendingRequestLabels(activeRequests)
    const currentPendingRequests = Array.isArray(context.state.curatedPendingRequests)
      ? context.state.curatedPendingRequests
      : []
    const currentProgress = getPendingRequestProgress(context.state)

    if (
      areStringArraysEqual(currentPendingRequests, nextPendingRequests) &&
      currentProgress.started === progress.started &&
      currentProgress.completed === progress.completed
    ) {
      return
    }

    context.state.curatedPendingRequests = nextPendingRequests
    context.state.curatedPendingRequestStartedCount = progress.started
    context.state.curatedPendingRequestCompletedCount = progress.completed

    if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
      return
    }

    context.refreshCuratedLoadingIndicator()
  }

  function removePendingRequestLabel(activeRequests: string[], label: string): void {
    const index = activeRequests.indexOf(label)
    if (index >= 0) {
      activeRequests.splice(index, 1)
    }
  }

  async function withTrackedPendingRequest<T>(
    context: CuratedLoaderContext,
    activeRequests: string[],
    progress: PendingRequestProgress,
    label: string,
    work: () => Promise<T>,
  ): Promise<T> {
    // Preserve duplicate labels because multiple requests of the same type may overlap.
    activeRequests.push(label)
    progress.started += 1
    syncPendingRequestDiagnostics(context, activeRequests, progress)

    try {
      return await work()
    } finally {
      removePendingRequestLabel(activeRequests, label)
      progress.completed += 1
      syncPendingRequestDiagnostics(context, activeRequests, progress)
    }
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

    const windowRef =
      options.windowRef && typeof options.windowRef === 'object' ? (options.windowRef as Window) : (root as Window)
    const documentRef =
      options.documentRef && typeof options.documentRef === 'object' ? (options.documentRef as Document) : null

    const renderCuratedPanel = requireFunction(
      'renderCuratedPanel',
      options.renderCuratedPanel,
    ) as CuratedLoaderContext['renderCuratedPanel']
    const refreshCuratedLoadingIndicator =
      typeof options.refreshCuratedLoadingIndicator === 'function'
        ? (options.refreshCuratedLoadingIndicator as CuratedLoaderContext['refreshCuratedLoadingIndicator'])
        : () => renderCuratedPanel()

    return {
      state,
      windowRef,
      documentRef,
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
      renderCuratedPanel,
      refreshCuratedLoadingIndicator,
      watchlistRevalidateCooldownMs: normalizePositiveNumber(options.watchlistRevalidateCooldownMs, 600_000),
      watchlistCacheSourceRevalidateCooldownMs: normalizePositiveNumber(
        options.watchlistCacheSourceRevalidateCooldownMs,
        45_000,
      ),
      metadataPriorityEntryCount: Math.max(1, normalizePositiveNumber(options.metadataPriorityEntryCount, 36)),
      metadataDeferredChunkSize: Math.max(1, normalizePositiveNumber(options.metadataDeferredChunkSize, 24)),
      metadataDeferredIdleTimeoutMs: Math.max(1, normalizePositiveNumber(options.metadataDeferredIdleTimeoutMs, 180)),
      metadataDeferredHiddenDelayMs: Math.max(1, normalizePositiveNumber(options.metadataDeferredHiddenDelayMs, 900)),
      metadataViewportPriorityCount: Math.max(1, normalizePositiveNumber(options.metadataViewportPriorityCount, 24)),
      deferredMetadataRunId: 0,
    }
  }

  function createCuratedLoaderDeferredMetadataRuntime(): CuratedLoaderDeferredMetadataRuntime {
    const deferredMetadataModule = (moduleRegistry.runtimeCuratedLoaderDeferredMetadata || {}) as Record<
      string,
      unknown
    >
    return requireFunction<AnyFn>(
      'createCuratedLoaderDeferredMetadataRuntime',
      deferredMetadataModule.createCuratedLoaderDeferredMetadataRuntime,
    )() as CuratedLoaderDeferredMetadataRuntime
  }

  function hasPromiseFinally(value: unknown): value is Promise<unknown> {
    return Boolean(value) && typeof (value as Promise<unknown>).finally === 'function'
  }

  async function loadAuthorizedTokenInternal(
    context: CuratedLoaderContext,
    activeRequests: string[],
    progress: PendingRequestProgress,
    forceRefresh: boolean,
  ): Promise<{ tokenEntry: TokenEntry; accountId: string; profileId: string }> {
    const shouldForceRefresh = forceRefresh || context.state.curatedSource === 'cache'
    let tokenEntry = await withTrackedPendingRequest(
      context,
      activeRequests,
      progress,
      'Authorizing Crunchyroll API token (/auth/v1/token)',
      () => context.getAccessToken(shouldForceRefresh),
    )

    let accessToken = getString(tokenEntry?.accessToken)
    let accountId = getString(tokenEntry?.accountId)
    let profileId = getString(tokenEntry?.profileId)

    if (!shouldForceRefresh && (!accessToken || !accountId || !profileId)) {
      tokenEntry = await withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
        'Refreshing Crunchyroll API token (/auth/v1/token)',
        () => context.getAccessToken(true),
      )
      accessToken = getString(tokenEntry?.accessToken)
      accountId = getString(tokenEntry?.accountId)
      profileId = getString(tokenEntry?.profileId)
    }

    if (!accessToken || !accountId || !profileId) {
      throw new Error('Unable to load curated watchlist: Crunchyroll API auth is unavailable.')
    }

    return {
      tokenEntry: tokenEntry as TokenEntry,
      accountId,
      profileId,
    }
  }

  async function loadRowsAndEntriesInternal(
    context: CuratedLoaderContext,
    activeRequests: string[],
    progress: PendingRequestProgress,
    tokenEntry: TokenEntry,
  ): Promise<{ rows: unknown[]; entries: unknown[] }> {
    const rows = await withTrackedPendingRequest(
      context,
      activeRequests,
      progress,
      'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
      () => context.fetchAllWatchlistRows(tokenEntry),
    )

    return {
      rows,
      entries: context.normalizeEntriesFromApiRows(rows),
    }
  }

  async function preloadPrimaryLocaleDataInternal(
    context: CuratedLoaderContext,
    activeRequests: string[],
    progress: PendingRequestProgress,
    entries: unknown[],
    tokenEntry: TokenEntry,
    force: boolean,
  ): Promise<void> {
    await Promise.all([
      withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
        'Fetching ratings (/content-reviews/v3/rating/series/{series_id})',
        () => context.preloadRatingsForEntries(entries, tokenEntry),
      ),
      withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
        'Fetching watch history (/content/v2/{account_id}/watch-history)',
        () => context.preloadWatchHistoryForEntries(entries, tokenEntry, force),
      ),
    ])
  }

  function resolveSelectedAudioLocaleForPreloadInternal(context: CuratedLoaderContext): string | null {
    const selectedAudioLocale = context.normalizeAudioLocale(context.state.settings.audioLocaleFilter)
    if (!selectedAudioLocale) {
      return null
    }

    if (selectedAudioLocale.toLowerCase() === context.getPreferredAudioLanguage().toLowerCase()) {
      return null
    }

    return selectedAudioLocale
  }

  async function preloadSelectedAudioLocaleDataInternal(
    context: CuratedLoaderContext,
    activeRequests: string[],
    progress: PendingRequestProgress,
    entries: unknown[],
    tokenEntry: TokenEntry,
  ): Promise<void> {
    const selectedAudioLocale = resolveSelectedAudioLocaleForPreloadInternal(context)
    if (!selectedAudioLocale) {
      return
    }

    await Promise.all([
      withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
        `Fetching ${selectedAudioLocale} ratings (/content-reviews/v3/rating/series/{series_id})`,
        () => context.preloadRatingsForEntries(entries, tokenEntry, selectedAudioLocale),
      ),
      withTrackedPendingRequest(
        context,
        activeRequests,
        progress,
        `Fetching ${selectedAudioLocale} watch history (/content/v2/{account_id}/watch-history)`,
        () => context.preloadWatchHistoryForEntries(entries, tokenEntry, true, selectedAudioLocale),
      ),
    ])
  }

  async function preloadMetadataForEntriesInternal(
    context: CuratedLoaderContext,
    entries: unknown[],
    tokenEntry: TokenEntry,
    force: boolean,
  ): Promise<void> {
    if (!entries.length) {
      return
    }

    await Promise.all([
      context.preloadRatingsForEntries(entries, tokenEntry),
      context.preloadWatchHistoryForEntries(entries, tokenEntry, force),
    ])

    const selectedAudioLocale = resolveSelectedAudioLocaleForPreloadInternal(context)
    if (!selectedAudioLocale) {
      return
    }

    await Promise.all([
      context.preloadRatingsForEntries(entries, tokenEntry, selectedAudioLocale),
      context.preloadWatchHistoryForEntries(entries, tokenEntry, true, selectedAudioLocale),
    ])
  }

  function commitCuratedEntriesFromApiInternal(
    context: CuratedLoaderContext,
    accountId: string,
    profileId: string,
    rows: unknown[],
    entries: unknown[],
    phase: 'partial' | 'final',
  ): unknown[] {
    const committedAt = Date.now()
    context.setWatchlistCacheRows(accountId, profileId, rows, committedAt)
    context.state.curatedEntries = entries
    context.state.curatedSource = 'api'
    context.state.curatedError = null
    context.state.curatedLastRevalidateAt = committedAt

    context.runtimeEvent(phase === 'partial' ? 'curated-load-partial' : 'curated-load-done', {
      source: 'api',
      total: entries.length,
    })
    if (context.state.mounted && context.isWatchlistPath(context.locationRef.pathname)) {
      context.renderCuratedPanel()
    }

    return entries
  }

  function handleCuratedLoadFailureInternal(context: CuratedLoaderContext, error: unknown): unknown[] {
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
  }

  async function runCuratedLoadCycleInternal(
    context: CuratedLoaderContext,
    deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime,
    activeRequests: string[],
    pendingProgress: PendingRequestProgress,
    force: boolean,
  ): Promise<unknown[]> {
    const startedAt = Date.now()
    context.deferredMetadataRunId += 1
    context.runtimeEvent('curated-load-start')
    context.state.curatedError = null
    syncPendingRequestDiagnostics(context, activeRequests, pendingProgress)

    const tokenStartedAt = Date.now()
    const { tokenEntry, accountId, profileId } = await loadAuthorizedTokenInternal(
      context,
      activeRequests,
      pendingProgress,
      force,
    )
    const tokenDurationMs = Date.now() - tokenStartedAt
    context.resetWatchlistCacheOnAccountMismatch(accountId, profileId)
    const rowsStartedAt = Date.now()
    const { rows, entries } = await loadRowsAndEntriesInternal(context, activeRequests, pendingProgress, tokenEntry)
    const rowsDurationMs = Date.now() - rowsStartedAt
    commitCuratedEntriesFromApiInternal(context, accountId, profileId, rows, entries, 'partial')

    const { priorityEntries, deferredEntries } = deferredMetadataRuntime.splitMetadataPreloadEntries(context, entries)
    const priorityMetadataStartedAt = Date.now()
    await preloadPrimaryLocaleDataInternal(context, activeRequests, pendingProgress, priorityEntries, tokenEntry, force)
    await preloadSelectedAudioLocaleDataInternal(context, activeRequests, pendingProgress, priorityEntries, tokenEntry)
    const priorityMetadataDurationMs = Date.now() - priorityMetadataStartedAt
    const committedEntries = commitCuratedEntriesFromApiInternal(context, accountId, profileId, rows, entries, 'final')

    context.runtimeEvent('curated-load-timing', {
      force,
      totalEntries: entries.length,
      priorityEntryCount: priorityEntries.length,
      deferredEntryCount: deferredEntries.length,
      tokenDurationMs,
      rowsDurationMs,
      priorityMetadataDurationMs,
      totalDurationMs: Date.now() - startedAt,
    })

    deferredMetadataRuntime.queueDeferredMetadataPreload({
      context,
      deferredEntries,
      tokenEntry,
      preloadMetadataForEntries: (metadataEntries, metadataTokenEntry) =>
        preloadMetadataForEntriesInternal(context, metadataEntries, metadataTokenEntry, false),
    })
    return committedEntries
  }

  function clearPendingRequestDiagnosticsInternal(
    context: CuratedLoaderContext,
    activeRequests: string[],
    pendingProgress: PendingRequestProgress,
  ): void {
    activeRequests.length = 0
    syncPendingRequestDiagnostics(context, activeRequests, pendingProgress)
  }

  function finalizeCuratedLoadInflightInternal(
    context: CuratedLoaderContext,
    activeRequests: string[],
    pendingProgress: PendingRequestProgress,
  ): void {
    context.state.curatedInflight = null
    clearPendingRequestDiagnosticsInternal(context, activeRequests, pendingProgress)
    if (context.state.curatedInitialLoadDone !== true) {
      context.state.curatedInitialLoadDone = true
    }
  }

  function ensureCuratedPromiseLoadedStateInternal(
    context: CuratedLoaderContext,
    inflight: Promise<unknown[]>,
    activeRequests: string[],
    pendingProgress: PendingRequestProgress,
  ): Promise<unknown[]> {
    return inflight.finally(() => {
      finalizeCuratedLoadInflightInternal(context, activeRequests, pendingProgress)
    })
  }

  function loadCuratedEntriesInternal(
    context: CuratedLoaderContext,
    deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime,
    force = false,
  ): Promise<unknown[]> {
    if (context.state.curatedInflight) {
      return context.state.curatedInflight
    }

    const activeRequests: string[] = []
    const pendingProgress: PendingRequestProgress = {
      started: 0,
      completed: 0,
    }
    const inflight = runCuratedLoadCycleInternal(
      context,
      deferredMetadataRuntime,
      activeRequests,
      pendingProgress,
      force,
    ).catch((error: unknown) => handleCuratedLoadFailureInternal(context, error))
    const trackedInflight = ensureCuratedPromiseLoadedStateInternal(context, inflight, activeRequests, pendingProgress)

    context.state.curatedInflight = trackedInflight
    return trackedInflight
  }

  function shouldBackgroundRevalidateCuratedInternal(context: CuratedLoaderContext): boolean {
    if (context.state.curatedInflight || !context.state.curatedEntries.length) {
      return false
    }

    const now = Date.now()
    if (context.state.curatedSource === 'cache') {
      return now - context.state.curatedLastRevalidateAt > context.watchlistCacheSourceRevalidateCooldownMs
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

  function ensureCuratedDataLoadInternal(
    context: CuratedLoaderContext,
    deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime,
    force = false,
  ): Promise<unknown[]> {
    if (!force && context.state.curatedEntries.length) {
      if (shouldBackgroundRevalidateCuratedInternal(context)) {
        const backgroundPromise = loadCuratedEntriesInternal(context, deferredMetadataRuntime, false)
        observeCuratedLoadPromiseInternal(context, backgroundPromise)
      }
      return Promise.resolve(context.state.curatedEntries)
    }

    const promise = loadCuratedEntriesInternal(context, deferredMetadataRuntime, force)
    observeCuratedLoadPromiseInternal(context, promise)
    return promise
  }

  function createCuratedLoaderRuntime(options: CuratedLoaderOptions = {}): CuratedLoaderRuntime {
    const context = createCuratedLoaderContext(options)
    const deferredMetadataRuntime = createCuratedLoaderDeferredMetadataRuntime()
    return {
      loadCuratedEntries: (force = false) => loadCuratedEntriesInternal(context, deferredMetadataRuntime, force),
      ensureCuratedDataLoad: (force = false) => ensureCuratedDataLoadInternal(context, deferredMetadataRuntime, force),
    }
  }

  moduleRegistry.runtimeCuratedLoader = {
    createCuratedLoaderRuntime,
  }
})()
