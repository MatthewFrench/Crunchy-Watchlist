;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type AuthTokenEntry = {
    accessToken: string
    accountId: string | null
    expiresAt: number
  }

  type MutableAuthTokenEntry = {
    accessToken?: string
    accountId?: string | null
    expiresAt?: number
  } & Record<string, unknown>

  type AuthState = {
    authToken: AuthTokenEntry | null
    authTokenInflight: Promise<AuthTokenEntry | null> | null
  }

  type RefreshTokenFn = () => Promise<string>

  type FetchWithResilienceOptions = {
    label?: unknown
    timeoutMs?: unknown
    maxAttempts?: unknown
    retryNetworkErrors?: unknown
    bearerToken?: unknown
    refreshBearerToken?: unknown
  }

  type AuthContext = {
    state: AuthState
    fetchImpl: (url: string, init: RequestInit) => Promise<Response>
    runtimeEvent: (event: string, data?: unknown) => void
    pushApiTrace: (endpoint: string, payload: unknown) => void
    resolveApiHref: (pathWithQuery: string) => string
    sanitizePositiveInt: (value: unknown) => number | null
    shouldRetryStatus: (status: number) => boolean
    computeFetchRetryDelayMs: (attempt: number, response: Response | null) => number
    sleep: (delayMs: number) => Promise<void>
    fetchTimeoutMs: number
    fetchMaxAttempts: number
    authTokenSkewMs: number
    authClientBasic: string
    authDeviceKey: string
    localStorageRef: Storage
    navigatorRef: Navigator
    cryptoRef: Crypto
  }

  type AuthOptions = {
    state?: unknown
    fetchImpl?: unknown
    runtimeEvent?: unknown
    pushApiTrace?: unknown
    resolveApiHref?: unknown
    sanitizePositiveInt?: unknown
    shouldRetryStatus?: unknown
    computeFetchRetryDelayMs?: unknown
    sleep?: unknown
    fetchTimeoutMs?: unknown
    fetchMaxAttempts?: unknown
    authTokenSkewMs?: unknown
    authClientBasic?: unknown
    authDeviceKey?: unknown
    localStorageRef?: unknown
    navigatorRef?: unknown
    cryptoRef?: unknown
  }

  type FetchAttemptController = {
    controller: AbortController | null
    timeoutId: ReturnType<typeof setTimeout> | null
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing auth dependency: ${name}`)
    }
    return value as T
  }

  function getFiniteNumber(value: unknown, fallback: number): number {
    const normalized = Number(value)
    return Number.isFinite(normalized) ? normalized : fallback
  }

  function toAuthState(value: unknown): AuthState | null {
    if (!value || typeof value !== 'object') {
      return null
    }

    const state = value as Partial<AuthState>

    if (!Object.hasOwn(state, 'authToken')) {
      state.authToken = null
    }

    if (!Object.hasOwn(state, 'authTokenInflight')) {
      state.authTokenInflight = null
    }

    return state as AuthState
  }

  function resolveLocalStorageRef(value: unknown): Storage {
    if (value && typeof value === 'object' && typeof (value as Storage).getItem === 'function') {
      return value as Storage
    }

    return root.localStorage
  }

  function resolveNavigatorRef(value: unknown): Navigator {
    if (value && typeof value === 'object') {
      return value as Navigator
    }

    return root.navigator
  }

  function resolveCryptoRef(value: unknown): Crypto {
    if (value && typeof value === 'object') {
      return value as Crypto
    }

    return root.crypto
  }

  function createAuthContext(options: AuthOptions = {}): AuthContext {
    const state = toAuthState(options.state)
    if (!state) {
      throw new Error('[CW] Missing auth state')
    }

    const fetchImpl = typeof options.fetchImpl === 'function' ? options.fetchImpl : null
    if (!fetchImpl) {
      throw new Error('[CW] Missing fetch implementation')
    }

    return {
      state,
      fetchImpl: fetchImpl as AuthContext['fetchImpl'],
      runtimeEvent:
        typeof options.runtimeEvent === 'function' ? (options.runtimeEvent as AuthContext['runtimeEvent']) : () => {},
      pushApiTrace:
        typeof options.pushApiTrace === 'function' ? (options.pushApiTrace as AuthContext['pushApiTrace']) : () => {},
      resolveApiHref: requireFunction('resolveApiHref', options.resolveApiHref) as AuthContext['resolveApiHref'],
      sanitizePositiveInt: requireFunction(
        'sanitizePositiveInt',
        options.sanitizePositiveInt,
      ) as AuthContext['sanitizePositiveInt'],
      shouldRetryStatus: requireFunction(
        'shouldRetryStatus',
        options.shouldRetryStatus,
      ) as AuthContext['shouldRetryStatus'],
      computeFetchRetryDelayMs: requireFunction(
        'computeFetchRetryDelayMs',
        options.computeFetchRetryDelayMs,
      ) as AuthContext['computeFetchRetryDelayMs'],
      sleep: requireFunction('sleep', options.sleep) as AuthContext['sleep'],
      fetchTimeoutMs: getFiniteNumber(options.fetchTimeoutMs, 12000),
      fetchMaxAttempts: getFiniteNumber(options.fetchMaxAttempts, 3),
      authTokenSkewMs: getFiniteNumber(options.authTokenSkewMs, 60 * 1000),
      authClientBasic: typeof options.authClientBasic === 'string' ? options.authClientBasic : '',
      authDeviceKey: typeof options.authDeviceKey === 'string' ? options.authDeviceKey : 'cw_auth_device_id_v1',
      localStorageRef: resolveLocalStorageRef(options.localStorageRef),
      navigatorRef: resolveNavigatorRef(options.navigatorRef),
      cryptoRef: resolveCryptoRef(options.cryptoRef),
    }
  }

  function createFetchAttemptController(timeoutMs: number): FetchAttemptController {
    const controller = typeof root.AbortController === 'function' ? new root.AbortController() : null
    const timeoutId = controller
      ? root.setTimeout(() => {
          try {
            controller.abort()
          } catch (_) {
            // no-op
          }
        }, timeoutMs)
      : null

    return {
      controller,
      timeoutId,
    }
  }

  function clearFetchAttemptTimeout(timeoutId: ReturnType<typeof setTimeout> | null): void {
    if (timeoutId != null) {
      root.clearTimeout(timeoutId)
    }
  }

  function createFetchHeaders(inputHeaders: unknown, bearerToken: string): Headers {
    const headers = new root.Headers((inputHeaders || {}) as HeadersInit)
    if (bearerToken) {
      headers.set('authorization', `Bearer ${bearerToken}`)
    }
    return headers
  }

  function toRefreshTokenFn(value: unknown): RefreshTokenFn | null {
    return typeof value === 'function' ? (value as RefreshTokenFn) : null
  }

  async function tryRefreshFetchBearerToken(
    context: AuthContext,
    responseStatus: number,
    hasTriedRefresh: boolean,
    refreshBearerToken: unknown,
    label: string,
    attempt: number,
  ): Promise<{ hasTriedRefresh: boolean; bearerToken: string }> {
    const refreshToken = toRefreshTokenFn(refreshBearerToken)
    if (responseStatus !== 401 || hasTriedRefresh || !refreshToken) {
      return {
        hasTriedRefresh,
        bearerToken: '',
      }
    }

    try {
      const refreshed = await refreshToken()
      if (typeof refreshed === 'string' && refreshed) {
        context.runtimeEvent('fetch-auth-refresh', { label, attempt })
        return {
          hasTriedRefresh: true,
          bearerToken: refreshed,
        }
      }
    } catch (_) {
      // no-op
    }

    return {
      hasTriedRefresh: true,
      bearerToken: '',
    }
  }

  async function queueFetchRetry(
    context: AuthContext,
    label: string,
    attempt: number,
    delayMs: number,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    context.runtimeEvent('fetch-retry', {
      label,
      attempt,
      delayMs,
      ...extra,
    })
    await context.sleep(delayMs)
  }

  function shouldRetryFetchNetworkError(message: string): boolean {
    return !/failed:\s*\d{3}\b/.test(message)
  }

  function getErrorName(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return ''
    }

    return typeof (error as Record<string, unknown>).name === 'string'
      ? ((error as Record<string, unknown>).name as string)
      : ''
  }

  function getErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return 'network failure'
    }

    const message = (error as Record<string, unknown>).message
    return typeof message === 'string' && message ? message : 'network failure'
  }

  async function fetchWithResilienceInternal(
    context: AuthContext,
    url: string,
    init: RequestInit = {},
    options: FetchWithResilienceOptions = {},
  ): Promise<Response> {
    const label = typeof options.label === 'string' && options.label.trim() ? options.label.trim() : 'request'
    const timeoutMs = context.sanitizePositiveInt(options.timeoutMs) ?? context.fetchTimeoutMs
    const maxAttempts = Math.max(1, context.sanitizePositiveInt(options.maxAttempts) ?? context.fetchMaxAttempts)
    const retryNetworkErrors = options.retryNetworkErrors !== false

    let attempt = 0
    let lastErrorMessage = ''
    let hasTriedRefresh = false
    let bearerToken = typeof options.bearerToken === 'string' ? options.bearerToken : ''

    while (attempt < maxAttempts) {
      attempt += 1
      const attemptController = createFetchAttemptController(timeoutMs)

      try {
        const headers = createFetchHeaders(init.headers, bearerToken)
        const requestInit: RequestInit = {
          ...init,
          headers,
        }
        if (attemptController.controller) {
          requestInit.signal = attemptController.controller.signal
        } else if (init.signal !== undefined) {
          requestInit.signal = init.signal
        }

        const response = await context.fetchImpl(url, requestInit)

        clearFetchAttemptTimeout(attemptController.timeoutId)

        const refreshResult = await tryRefreshFetchBearerToken(
          context,
          response.status,
          hasTriedRefresh,
          options.refreshBearerToken,
          label,
          attempt,
        )
        hasTriedRefresh = refreshResult.hasTriedRefresh
        if (refreshResult.bearerToken) {
          bearerToken = refreshResult.bearerToken
          continue
        }

        if (response.ok) {
          return response
        }

        if (attempt < maxAttempts && context.shouldRetryStatus(response.status)) {
          const delayMs = context.computeFetchRetryDelayMs(attempt, response)
          await queueFetchRetry(context, label, attempt, delayMs, { status: response.status })
          continue
        }

        throw new Error(`${label} failed: ${response.status}`)
      } catch (error) {
        clearFetchAttemptTimeout(attemptController.timeoutId)

        const aborted = getErrorName(error) === 'AbortError'
        const message = aborted ? 'timeout' : getErrorMessage(error)
        lastErrorMessage = message

        if (attempt < maxAttempts && retryNetworkErrors && shouldRetryFetchNetworkError(message)) {
          const delayMs = context.computeFetchRetryDelayMs(attempt, null)
          await queueFetchRetry(context, label, attempt, delayMs, { reason: message })
          continue
        }

        throw new Error(`${label} failed: ${message}`)
      }
    }

    throw new Error(`${label} failed: ${lastErrorMessage || 'exhausted retries'}`)
  }

  function generateDeviceId(context: AuthContext): string {
    try {
      if (typeof context.cryptoRef.randomUUID === 'function') {
        return context.cryptoRef.randomUUID()
      }
    } catch (_) {
      // no-op
    }

    return `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }

  function getOrCreateDeviceId(context: AuthContext): string {
    try {
      const existing = context.localStorageRef.getItem(context.authDeviceKey)
      if (existing) {
        return existing
      }

      const created = generateDeviceId(context)
      context.localStorageRef.setItem(context.authDeviceKey, created)
      return created
    } catch (_) {
      return generateDeviceId(context)
    }
  }

  function getAuthDeviceType(context: AuthContext): string {
    const userAgent = typeof context.navigatorRef.userAgent === 'string' ? context.navigatorRef.userAgent : ''
    const platform =
      typeof context.navigatorRef.platform === 'string' && context.navigatorRef.platform.trim()
        ? context.navigatorRef.platform.trim()
        : 'Unknown'

    if (/\bEdg\//.test(userAgent)) {
      return `Edge on ${platform}`
    }

    if (/\bFirefox\//.test(userAgent)) {
      return `Firefox on ${platform}`
    }

    if (/\bChrome\//.test(userAgent) || /\bChromium\//.test(userAgent)) {
      return `Chrome on ${platform}`
    }

    if (/\bSafari\//.test(userAgent)) {
      return `Safari on ${platform}`
    }

    return `Browser on ${platform}`
  }

  function isAuthTokenValid(context: AuthContext, tokenEntry: unknown): tokenEntry is AuthTokenEntry {
    if (!tokenEntry || typeof tokenEntry !== 'object') {
      return false
    }

    const entry = tokenEntry as Partial<AuthTokenEntry>
    return (
      typeof entry.accessToken === 'string' &&
      entry.accessToken.length > 10 &&
      typeof entry.expiresAt === 'number' &&
      entry.expiresAt - Date.now() > context.authTokenSkewMs
    )
  }

  function toPayloadRecord(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      return {}
    }

    return payload as Record<string, unknown>
  }

  async function requestAccessTokenInternal(context: AuthContext): Promise<AuthTokenEntry> {
    const body = new root.URLSearchParams({
      device_id: getOrCreateDeviceId(context),
      device_type: getAuthDeviceType(context),
      grant_type: 'etp_rt_cookie',
    })

    const tokenUrl = context.resolveApiHref('/auth/v1/token')
    const response = await fetchWithResilienceInternal(
      context,
      tokenUrl,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          authorization: context.authClientBasic,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      },
      {
        label: 'auth token request',
        maxAttempts: 2,
      },
    )

    if (!response.ok) {
      throw new Error(`auth token request failed: ${response.status}`)
    }

    const payload = toPayloadRecord(await response.json())
    context.pushApiTrace('authToken', {
      at: Date.now(),
      request: {
        url: tokenUrl,
        grant_type: 'etp_rt_cookie',
      },
      response: {
        account_id: typeof payload.account_id === 'string' ? payload.account_id : null,
        expires_in: Number(payload.expires_in || 0) || null,
        token_type: typeof payload.token_type === 'string' ? payload.token_type : null,
        country: typeof payload.country === 'string' ? payload.country : null,
      },
    })

    const accessToken = typeof payload.access_token === 'string' ? payload.access_token : ''
    const expiresInSeconds = Number(payload.expires_in || 0)
    const accountId = typeof payload.account_id === 'string' ? payload.account_id : null

    if (!accessToken) {
      throw new Error('auth token missing access_token')
    }

    const expiresAt =
      Date.now() +
      (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds * 1000 : 15 * 60 * 1000)

    return {
      accessToken,
      accountId,
      expiresAt,
    }
  }

  async function getAccessTokenInternal(context: AuthContext, forceRefresh = false): Promise<AuthTokenEntry | null> {
    if (!forceRefresh && isAuthTokenValid(context, context.state.authToken)) {
      return context.state.authToken
    }

    if (!forceRefresh && context.state.authTokenInflight) {
      return context.state.authTokenInflight
    }

    let inflight: Promise<AuthTokenEntry | null> | null = null

    inflight = (async () => {
      try {
        const tokenEntry = await requestAccessTokenInternal(context)
        context.state.authToken = tokenEntry
        context.runtimeEvent('auth-token-ready', {
          hasAccountId: !!tokenEntry.accountId,
        })
        return tokenEntry
      } catch (_) {
        context.runtimeEvent('auth-token-failed')
        context.state.authToken = null
        return null
      } finally {
        if (context.state.authTokenInflight === inflight) {
          context.state.authTokenInflight = null
        }
      }
    })()

    context.state.authTokenInflight = inflight
    return inflight
  }

  function createAuthRefreshHandlerInternal(context: AuthContext, tokenEntry: unknown) {
    return async () => {
      const refreshed = await getAccessTokenInternal(context, true)
      if (!refreshed?.accessToken) {
        return ''
      }

      if (tokenEntry && typeof tokenEntry === 'object') {
        const mutableTokenEntry = tokenEntry as MutableAuthTokenEntry
        mutableTokenEntry.accessToken = refreshed.accessToken
        mutableTokenEntry.expiresAt = refreshed.expiresAt
        if (typeof refreshed.accountId === 'string' && refreshed.accountId) {
          mutableTokenEntry.accountId = refreshed.accountId
        }
      }

      return refreshed.accessToken
    }
  }

  function createAuthClient(options: AuthOptions = {}) {
    const context = createAuthContext(options)
    return {
      fetchWithResilience: (url: string, init: RequestInit = {}, requestOptions: FetchWithResilienceOptions = {}) =>
        fetchWithResilienceInternal(context, url, init, requestOptions),
      getAccessToken: (forceRefresh = false) => getAccessTokenInternal(context, forceRefresh),
      createAuthRefreshHandler: (tokenEntry: unknown) => createAuthRefreshHandlerInternal(context, tokenEntry),
    }
  }

  moduleRegistry.authClient = {
    createAuthClient,
  }
})()
