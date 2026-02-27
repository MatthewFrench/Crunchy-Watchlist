;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type TokenEntry = {
    accountId?: string
    accessToken?: string
  }

  type WatchlistRow = Record<string, unknown>

  type FetchWithResilience = (
    url: string,
    requestInit: RequestInit,
    options: {
      label: string
      bearerToken?: string
      refreshBearerToken?: unknown
    },
  ) => Promise<Response>

  type WatchlistContext = {
    fetchWithResilience: FetchWithResilience
    createAuthRefreshHandler: (tokenEntry: TokenEntry | undefined) => unknown
    resolveApiHref: (pathWithQuery: string) => string
    requirePayloadDataArray: (endpoint: string, payload: unknown) => WatchlistRow[]
    auditWatchlistRowsContract: (rows: WatchlistRow[]) => void
    getPreferredAudioLanguage: () => string
    getLocale: () => string
    getWatchlistSeriesId: (row: WatchlistRow) => string | null
    pushApiTrace: (endpoint: string, record: unknown) => void
    runtimeEvent: (event: string, payload?: unknown) => void
    watchlistPageSize: number
    watchlistMaxPages: number
    watchlistParallelRequests: number
  }

  type WatchlistClientOptions = {
    fetchWithResilience?: unknown
    createAuthRefreshHandler?: unknown
    resolveApiHref?: unknown
    requirePayloadDataArray?: unknown
    auditWatchlistRowsContract?: unknown
    getPreferredAudioLanguage?: unknown
    getLocale?: unknown
    getWatchlistSeriesId?: unknown
    pushApiTrace?: unknown
    runtimeEvent?: unknown
    watchlistPageSize?: unknown
    watchlistMaxPages?: unknown
    watchlistParallelRequests?: unknown
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing watchlist dependency: ${name}`)
    }
    return value as T
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as Record<string, unknown>
  }

  function createWatchlistContext(options: WatchlistClientOptions = {}): WatchlistContext {
    return {
      fetchWithResilience: requireFunction('fetchWithResilience', options.fetchWithResilience) as FetchWithResilience,
      createAuthRefreshHandler: requireFunction(
        'createAuthRefreshHandler',
        options.createAuthRefreshHandler,
      ) as WatchlistContext['createAuthRefreshHandler'],
      resolveApiHref: requireFunction('resolveApiHref', options.resolveApiHref) as WatchlistContext['resolveApiHref'],
      requirePayloadDataArray: requireFunction(
        'requirePayloadDataArray',
        options.requirePayloadDataArray,
      ) as WatchlistContext['requirePayloadDataArray'],
      auditWatchlistRowsContract: requireFunction(
        'auditWatchlistRowsContract',
        options.auditWatchlistRowsContract,
      ) as WatchlistContext['auditWatchlistRowsContract'],
      getPreferredAudioLanguage: requireFunction(
        'getPreferredAudioLanguage',
        options.getPreferredAudioLanguage,
      ) as WatchlistContext['getPreferredAudioLanguage'],
      getLocale: requireFunction('getLocale', options.getLocale) as WatchlistContext['getLocale'],
      getWatchlistSeriesId: requireFunction(
        'getWatchlistSeriesId',
        options.getWatchlistSeriesId,
      ) as WatchlistContext['getWatchlistSeriesId'],
      pushApiTrace:
        typeof options.pushApiTrace === 'function'
          ? (options.pushApiTrace as WatchlistContext['pushApiTrace'])
          : () => {},
      runtimeEvent:
        typeof options.runtimeEvent === 'function'
          ? (options.runtimeEvent as WatchlistContext['runtimeEvent'])
          : () => {},
      watchlistPageSize: Math.max(1, Number(options.watchlistPageSize) || 1),
      watchlistMaxPages: Math.max(1, Number(options.watchlistMaxPages) || 1),
      watchlistParallelRequests: Math.max(1, Math.round(Number(options.watchlistParallelRequests) || 1)),
    }
  }

  function getPayloadTotal(
    context: WatchlistContext,
    payload: unknown,
    fallback: number,
    start: number,
    requestUrl: string,
  ): number {
    if (!payload || typeof payload !== 'object') {
      context.runtimeEvent('watchlist-contract-warning', {
        reason: 'invalid-total-root',
        fallbackTotal: fallback,
        start,
        requestUrl,
      })
      return fallback
    }

    const totalValue = toRecord(payload).total
    const parsedTotal = Number(totalValue)
    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      context.runtimeEvent('watchlist-contract-warning', {
        reason: 'invalid-total-value',
        totalValue,
        fallbackTotal: fallback,
        start,
        requestUrl,
      })
      return fallback
    }

    return Math.round(parsedTotal)
  }

  function getPanelId(row: WatchlistRow): string {
    const panel = row.panel
    if (!panel || typeof panel !== 'object') {
      return ''
    }

    const panelId = (panel as Record<string, unknown>).id
    return typeof panelId === 'string' ? panelId : ''
  }

  function createWatchlistQueryParams(context: WatchlistContext, start: number): URLSearchParams {
    const params = new root.URLSearchParams({
      order: 'desc',
      n: String(context.watchlistPageSize),
      preferred_audio_language: context.getPreferredAudioLanguage(),
      locale: context.getLocale(),
    })

    if (start > 0) {
      params.set('start', String(start))
    }

    return params
  }

  function createWatchlistRequestOptions(
    context: WatchlistContext,
    tokenEntry: TokenEntry | undefined,
  ): { label: string; bearerToken?: string; refreshBearerToken?: unknown } {
    const requestOptions: {
      label: string
      bearerToken?: string
      refreshBearerToken?: unknown
    } = {
      label: 'watchlist page request',
      refreshBearerToken: context.createAuthRefreshHandler(tokenEntry),
    }

    if (typeof tokenEntry?.accessToken === 'string') {
      requestOptions.bearerToken = tokenEntry.accessToken
    }

    return requestOptions
  }

  async function fetchWatchlistPageInternal(
    context: WatchlistContext,
    tokenEntry: TokenEntry | undefined,
    start: number,
  ): Promise<{ rows: WatchlistRow[]; total: number }> {
    const accountId = tokenEntry?.accountId
    if (typeof accountId !== 'string' || !accountId.trim()) {
      context.runtimeEvent('watchlist-contract-warning', {
        reason: 'missing-account-id',
        start,
      })
      throw new Error('watchlist request missing account id')
    }

    const params = createWatchlistQueryParams(context, start)
    const url = context.resolveApiHref(
      `/content/v2/discover/${encodeURIComponent(String(accountId))}/watchlist?${params.toString()}`,
    )
    const requestOptions = createWatchlistRequestOptions(context, tokenEntry)

    const response = await context.fetchWithResilience(
      url,
      {
        credentials: 'include',
      },
      requestOptions,
    )

    if (!response.ok) {
      throw new Error(`watchlist page request failed: ${response.status}`)
    }

    let payload: unknown
    try {
      payload = (await response.json()) as unknown
    } catch (_) {
      context.runtimeEvent('watchlist-contract-warning', {
        reason: 'invalid-json-payload',
        start,
        requestUrl: url,
      })
      throw new Error('watchlist page payload parse failed')
    }

    const rows = context.requirePayloadDataArray('watchlist', payload)
    context.auditWatchlistRowsContract(rows)
    const total = getPayloadTotal(context, payload, rows.length, start, url)

    context.pushApiTrace('watchlist', {
      at: Date.now(),
      request: {
        url,
        start: Math.max(0, Number(start) || 0),
        n: context.watchlistPageSize,
        preferred_audio_language: params.get('preferred_audio_language'),
        locale: params.get('locale'),
      },
      response: {
        total,
        rowCount: rows.length,
      },
      data: rows,
    })

    return {
      rows,
      total,
    }
  }

  async function fetchAllWatchlistRowsInternal(
    context: WatchlistContext,
    tokenEntry: TokenEntry | undefined,
  ): Promise<WatchlistRow[]> {
    const firstPage = await fetchWatchlistPageInternal(context, tokenEntry, 0)
    const pageStarts = createRemainingWatchlistPageStartsInternal(context, firstPage)
    const remainingPages =
      pageStarts.length > 0 ? await fetchWatchlistPagesByStartInternal(context, tokenEntry, pageStarts) : []

    const orderedPages = [firstPage, ...remainingPages]
    const allRows: WatchlistRow[] = []
    const seenRowKeys = new Set<string>()

    orderedPages.forEach((page) => {
      page.rows.forEach((row) => {
        const seriesId = context.getWatchlistSeriesId(row) || ''
        const panelId = getPanelId(row)
        const rowKey = `${seriesId}|${panelId}`
        if (rowKey !== '|' && seenRowKeys.has(rowKey)) {
          return
        }
        if (rowKey !== '|') {
          seenRowKeys.add(rowKey)
        }
        allRows.push(row)
      })
    })

    return allRows
  }

  /**
   * We always fetch page 1 first so we can trust server-reported totals before fanning out.
   * This keeps request count bounded and avoids issuing speculative deep-page calls.
   */
  function createRemainingWatchlistPageStartsInternal(
    context: WatchlistContext,
    firstPage: { rows: WatchlistRow[]; total: number },
  ): number[] {
    if (firstPage.rows.length < context.watchlistPageSize) {
      return []
    }

    const knownTotal = Number.isFinite(firstPage.total) ? Math.max(0, Math.round(firstPage.total)) : 0
    if (knownTotal <= firstPage.rows.length) {
      return []
    }

    const starts: number[] = []
    let nextStart = context.watchlistPageSize
    while (starts.length + 1 < context.watchlistMaxPages && nextStart < knownTotal) {
      starts.push(nextStart)
      nextStart += context.watchlistPageSize
    }
    return starts
  }

  async function fetchWatchlistPagesByStartInternal(
    context: WatchlistContext,
    tokenEntry: TokenEntry | undefined,
    starts: number[],
  ): Promise<Array<{ rows: WatchlistRow[]; total: number }>> {
    if (!starts.length) {
      return []
    }

    const pagesByStart = new Map<number, { rows: WatchlistRow[]; total: number }>()
    let index = 0
    while (index < starts.length) {
      const batchStarts = starts.slice(index, index + context.watchlistParallelRequests)
      const batchResults = await Promise.all(
        batchStarts.map(async (start) => {
          const page = await fetchWatchlistPageInternal(context, tokenEntry, start)
          return { start, page }
        }),
      )
      batchResults.forEach(({ start, page }) => {
        pagesByStart.set(start, page)
      })
      index += batchStarts.length
    }

    return starts.map((start) => {
      const page = pagesByStart.get(start)
      if (!page) {
        throw new Error(`watchlist page request missing result for start=${start}`)
      }
      return page
    })
  }

  function createWatchlistClient(options: WatchlistClientOptions = {}) {
    const context = createWatchlistContext(options)
    return {
      fetchAllWatchlistRows: (tokenEntry: TokenEntry | undefined) => fetchAllWatchlistRowsInternal(context, tokenEntry),
    }
  }

  moduleRegistry.watchlistClient = {
    createWatchlistClient,
  }
})()
