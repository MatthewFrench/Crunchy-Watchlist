;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type NativeBridgeContext = {
    documentRef: Document
    windowRef: Window
    runtimeEvent: (event: string, data?: unknown) => void
    nativeActionBridgeRuntime: NativeActionBridgeRuntime
    getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null>
    fetchWithResilience: FetchWithResilience
    createAuthRefreshHandler: (tokenEntry: TokenEntry | null) => unknown
    resolveApiHref: (pathWithQuery: string) => string
    normalizeImageUrlCandidate: (value: unknown) => string
    fetchPreviewUrlForEntry: (entry: unknown) => Promise<unknown>
    isLikelyVideoUrl: (url: unknown) => boolean
    previewHoverDelayMs: number
  }

  type NativeBridgeOptions = {
    documentRef?: unknown
    windowRef?: unknown
    runtimeEvent?: unknown
    getAccessToken?: unknown
    fetchWithResilience?: unknown
    createAuthRefreshHandler?: unknown
    resolveApiHref?: unknown
    normalizeImageUrlCandidate?: unknown
    fetchPreviewUrlForEntry?: unknown
    isLikelyVideoUrl?: unknown
    previewHoverDelayMs?: unknown
  }

  type NativeBridgeRuntime = {
    triggerNativeCardAction: (seriesId: unknown, actionType: unknown, favoriteValue?: unknown) => Promise<boolean>
    installCuratedCardPreview: (
      thumbLink: unknown,
      entry: unknown,
      coverImageUrl: unknown,
      hoverPreviewImageUrl: unknown,
      thumbImage: unknown,
    ) => void
  }

  type NativeBridgePreviewRuntime = {
    installCuratedCardPreview: (
      thumbLink: unknown,
      entry: unknown,
      coverImageUrl: unknown,
      hoverPreviewImageUrl: unknown,
      thumbImage: unknown,
    ) => void
  }

  type NativeBridgePreviewModule = {
    createNativeBridgePreviewRuntime: (options: Record<string, unknown>) => NativeBridgePreviewRuntime
  }

  type TokenEntry = {
    accountId?: unknown
    accessToken?: unknown
  } & Record<string, unknown>

  type FetchWithResilience = (
    url: string,
    requestInit: RequestInit,
    options: {
      label: string
      bearerToken?: string
      refreshBearerToken?: unknown
    },
  ) => Promise<Response>

  type NativeActionType = 'favorite' | 'remove'

  type NativeActionBridgeRuntime = {
    findNativeCardBySeriesId: (seriesId: unknown) => HTMLElement | null
  }

  type NativeActionBridgeModule = {
    createNativeActionBridgeRuntime: (options: Record<string, unknown>) => NativeActionBridgeRuntime
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing native bridge dependency: ${name}`)
    }
    return value as T
  }

  function resolveDocumentRef(value: unknown): Document {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing native bridge documentRef')
    }
    return value as Document
  }

  function resolveWindowRef(value: unknown): Window {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing native bridge windowRef')
    }
    return value as Window
  }

  function normalizePositiveNumber(value: unknown, fallback: number): number {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) {
      return fallback
    }
    return Math.round(number)
  }

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
  }

  function resolveNativeActionBridgeRuntime(
    documentRef: Document,
    runtimeEvent: NativeBridgeContext['runtimeEvent'],
  ): NativeActionBridgeRuntime {
    const nativeActionBridgeModule = moduleRegistry.runtimeNativeActionBridge
    if (!nativeActionBridgeModule || typeof nativeActionBridgeModule !== 'object') {
      throw new Error('[CW] Missing native action bridge module')
    }

    const createNativeActionBridgeRuntime = requireFunction(
      'createNativeActionBridgeRuntime',
      (nativeActionBridgeModule as NativeActionBridgeModule).createNativeActionBridgeRuntime,
    ) as NativeActionBridgeModule['createNativeActionBridgeRuntime']
    const nativeActionBridgeRuntime = createNativeActionBridgeRuntime({
      documentRef,
      runtimeEvent,
    })

    return {
      findNativeCardBySeriesId: requireFunction(
        'runtimeNativeActionBridge.findNativeCardBySeriesId',
        nativeActionBridgeRuntime.findNativeCardBySeriesId,
      ) as NativeActionBridgeRuntime['findNativeCardBySeriesId'],
    }
  }

  function resolveNativeBridgePreviewRuntime(context: NativeBridgeContext): NativeBridgePreviewRuntime {
    const nativeBridgePreviewModule = moduleRegistry.runtimeNativeBridgePreview
    if (!nativeBridgePreviewModule || typeof nativeBridgePreviewModule !== 'object') {
      throw new Error('[CW] Missing native bridge preview module')
    }

    const createNativeBridgePreviewRuntime = requireFunction(
      'createNativeBridgePreviewRuntime',
      (nativeBridgePreviewModule as NativeBridgePreviewModule).createNativeBridgePreviewRuntime,
    ) as NativeBridgePreviewModule['createNativeBridgePreviewRuntime']
    const nativeBridgePreviewRuntime = createNativeBridgePreviewRuntime({
      windowRef: context.windowRef,
      nativeActionBridgeRuntime: context.nativeActionBridgeRuntime,
      normalizeImageUrlCandidate: context.normalizeImageUrlCandidate,
      fetchPreviewUrlForEntry: context.fetchPreviewUrlForEntry,
      isLikelyVideoUrl: context.isLikelyVideoUrl,
      previewHoverDelayMs: context.previewHoverDelayMs,
    })

    return {
      installCuratedCardPreview: requireFunction(
        'runtimeNativeBridgePreview.installCuratedCardPreview',
        nativeBridgePreviewRuntime.installCuratedCardPreview,
      ) as NativeBridgePreviewRuntime['installCuratedCardPreview'],
    }
  }

  function createNativeBridgeContext(options: NativeBridgeOptions = {}): NativeBridgeContext {
    const documentRef = resolveDocumentRef(options.documentRef)
    const runtimeEvent = requireFunction('runtimeEvent', options.runtimeEvent) as NativeBridgeContext['runtimeEvent']

    return {
      documentRef,
      windowRef: resolveWindowRef(options.windowRef),
      runtimeEvent,
      nativeActionBridgeRuntime: resolveNativeActionBridgeRuntime(documentRef, runtimeEvent),
      getAccessToken: requireFunction(
        'getAccessToken',
        options.getAccessToken,
      ) as NativeBridgeContext['getAccessToken'],
      fetchWithResilience: requireFunction(
        'fetchWithResilience',
        options.fetchWithResilience,
      ) as NativeBridgeContext['fetchWithResilience'],
      createAuthRefreshHandler: requireFunction(
        'createAuthRefreshHandler',
        options.createAuthRefreshHandler,
      ) as NativeBridgeContext['createAuthRefreshHandler'],
      resolveApiHref: requireFunction(
        'resolveApiHref',
        options.resolveApiHref,
      ) as NativeBridgeContext['resolveApiHref'],
      normalizeImageUrlCandidate: requireFunction(
        'normalizeImageUrlCandidate',
        options.normalizeImageUrlCandidate,
      ) as NativeBridgeContext['normalizeImageUrlCandidate'],
      fetchPreviewUrlForEntry: requireFunction(
        'fetchPreviewUrlForEntry',
        options.fetchPreviewUrlForEntry,
      ) as NativeBridgeContext['fetchPreviewUrlForEntry'],
      isLikelyVideoUrl: requireFunction(
        'isLikelyVideoUrl',
        options.isLikelyVideoUrl,
      ) as NativeBridgeContext['isLikelyVideoUrl'],
      previewHoverDelayMs: normalizePositiveNumber(options.previewHoverDelayMs, 220),
    }
  }

  function toTokenEntry(value: unknown): TokenEntry | null {
    if (!value || typeof value !== 'object') {
      return null
    }
    return value as TokenEntry
  }

  function toActionType(value: unknown): NativeActionType | null {
    const actionType = getString(value).toLowerCase()
    if (actionType === 'favorite' || actionType === 'remove') {
      return actionType
    }
    return null
  }

  function createWatchlistActionUrl(context: NativeBridgeContext, accountId: string, seriesId: string): string {
    return context.resolveApiHref(
      `/content/v2/${encodeURIComponent(accountId)}/watchlist/${encodeURIComponent(seriesId)}`,
    )
  }

  function createWatchlistActionRequestOptions(
    context: NativeBridgeContext,
    tokenEntry: TokenEntry | null,
    actionType: NativeActionType,
  ): {
    label: string
    bearerToken?: string
    refreshBearerToken?: unknown
  } {
    const requestOptions: {
      label: string
      bearerToken?: string
      refreshBearerToken?: unknown
    } = {
      label: actionType === 'favorite' ? 'watchlist favorite request' : 'watchlist remove request',
      refreshBearerToken: context.createAuthRefreshHandler(tokenEntry),
    }

    if (typeof tokenEntry?.accessToken === 'string' && tokenEntry.accessToken) {
      requestOptions.bearerToken = tokenEntry.accessToken
    }

    return requestOptions
  }

  function createWatchlistActionRequestInit(actionType: NativeActionType, favoriteValue: unknown): RequestInit | null {
    if (actionType === 'favorite') {
      if (typeof favoriteValue !== 'boolean') {
        return null
      }

      return {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          is_favorite: favoriteValue,
        }),
      }
    }

    return {
      method: 'DELETE',
      credentials: 'include',
    }
  }

  async function triggerNativeCardActionInternal(
    context: NativeBridgeContext,
    seriesIdValue: unknown,
    actionTypeValue: unknown,
    favoriteValue: unknown,
  ): Promise<boolean> {
    const seriesId = getString(seriesIdValue)
    const actionType = toActionType(actionTypeValue)
    if (!seriesId || !actionType) {
      return false
    }

    const requestInit = createWatchlistActionRequestInit(actionType, favoriteValue)
    if (!requestInit) {
      context.runtimeEvent('watchlist-action-invalid-request', {
        seriesId,
        actionType,
      })
      return false
    }

    const tokenEntry = toTokenEntry(await context.getAccessToken(false))
    const accountId = getString(tokenEntry?.accountId)
    if (!accountId) {
      context.runtimeEvent('watchlist-action-missing-account-id', {
        seriesId,
        actionType,
      })
      return false
    }

    const requestUrl = createWatchlistActionUrl(context, accountId, seriesId)
    const requestOptions = createWatchlistActionRequestOptions(context, tokenEntry, actionType)

    try {
      const response = await context.fetchWithResilience(requestUrl, requestInit, requestOptions)
      if (!response.ok) {
        context.runtimeEvent('watchlist-action-failed', {
          seriesId,
          actionType,
          status: response.status,
        })
        return false
      }

      context.runtimeEvent('watchlist-action-complete', {
        seriesId,
        actionType,
      })
      return true
    } catch (error) {
      context.runtimeEvent('watchlist-action-failed', {
        seriesId,
        actionType,
        message: error instanceof Error ? error.message : 'unknown',
      })
      return false
    }
  }

  function createNativeBridgeRuntime(options: NativeBridgeOptions = {}): NativeBridgeRuntime {
    const context = createNativeBridgeContext(options)
    const nativeBridgePreviewRuntime = resolveNativeBridgePreviewRuntime(context)

    return {
      triggerNativeCardAction: (seriesId, actionType, favoriteValue) =>
        triggerNativeCardActionInternal(context, seriesId, actionType, favoriteValue),
      installCuratedCardPreview: (thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage) => {
        nativeBridgePreviewRuntime.installCuratedCardPreview(
          thumbLink,
          entry,
          coverImageUrl,
          hoverPreviewImageUrl,
          thumbImage,
        )
      },
    }
  }

  moduleRegistry.runtimeNativeBridge = {
    createNativeBridgeRuntime,
  }
})()
