;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type AuthTokenEntry = {
    accessToken: string
    accountId: string | null
    profileId: string | null
    expiresAt: number
  }

  type MutableAuthTokenEntry = {
    accessToken?: string
    accountId?: string | null
    profileId?: string | null
    expiresAt?: number
  } & Record<string, unknown>

  type AuthState = {
    authToken: AuthTokenEntry | null
    authTokenInflight: Promise<AuthTokenEntry | null> | null
  }

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

  type AuthClientFetchResilienceRuntime = {
    fetchWithResilienceInternal: (
      context: AuthContext,
      url: string,
      init?: RequestInit,
      options?: FetchWithResilienceOptions,
    ) => Promise<Response>
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

  function createAuthClientFetchResilienceRuntime(): AuthClientFetchResilienceRuntime {
    const fetchResilienceModule = moduleRegistry.authClientFetchResilience as Record<string, unknown>
    if (typeof fetchResilienceModule?.createAuthClientFetchResilienceRuntime !== 'function') {
      throw new Error('[CW] Missing auth dependency: createAuthClientFetchResilienceRuntime')
    }
    return (fetchResilienceModule.createAuthClientFetchResilienceRuntime as AnyFn)() as AuthClientFetchResilienceRuntime
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

  async function requestAccessTokenInternal(
    context: AuthContext,
    fetchResilienceRuntime: AuthClientFetchResilienceRuntime,
  ): Promise<AuthTokenEntry> {
    const body = new root.URLSearchParams({
      device_id: getOrCreateDeviceId(context),
      device_type: getAuthDeviceType(context),
      grant_type: 'etp_rt_cookie',
    })

    const tokenUrl = context.resolveApiHref('/auth/v1/token')
    const response = await fetchResilienceRuntime.fetchWithResilienceInternal(
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
        profile_id: typeof payload.profile_id === 'string' ? payload.profile_id : null,
        expires_in: Number(payload.expires_in || 0) || null,
        token_type: typeof payload.token_type === 'string' ? payload.token_type : null,
        country: typeof payload.country === 'string' ? payload.country : null,
      },
    })

    const accessToken = typeof payload.access_token === 'string' ? payload.access_token : ''
    const expiresInSeconds = Number(payload.expires_in || 0)
    const accountId = typeof payload.account_id === 'string' ? payload.account_id : null
    const profileId = typeof payload.profile_id === 'string' ? payload.profile_id : null

    if (!accessToken) {
      throw new Error('auth token missing access_token')
    }

    const expiresAt =
      Date.now() +
      (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds * 1000 : 15 * 60 * 1000)

    return {
      accessToken,
      accountId,
      profileId,
      expiresAt,
    }
  }

  async function getAccessTokenInternal(
    context: AuthContext,
    fetchResilienceRuntime: AuthClientFetchResilienceRuntime,
    forceRefresh = false,
  ): Promise<AuthTokenEntry | null> {
    if (!forceRefresh && isAuthTokenValid(context, context.state.authToken)) {
      return context.state.authToken
    }

    if (!forceRefresh && context.state.authTokenInflight) {
      return context.state.authTokenInflight
    }

    let inflight: Promise<AuthTokenEntry | null> | null = null

    inflight = (async () => {
      try {
        const tokenEntry = await requestAccessTokenInternal(context, fetchResilienceRuntime)
        context.state.authToken = tokenEntry
        context.runtimeEvent('auth-token-ready', {
          hasAccountId: !!tokenEntry.accountId,
          hasProfileId: !!tokenEntry.profileId,
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

  function createAuthRefreshHandlerInternal(
    context: AuthContext,
    fetchResilienceRuntime: AuthClientFetchResilienceRuntime,
    tokenEntry: unknown,
  ) {
    return async () => {
      const refreshed = await getAccessTokenInternal(context, fetchResilienceRuntime, true)
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
        if (typeof refreshed.profileId === 'string' && refreshed.profileId) {
          mutableTokenEntry.profileId = refreshed.profileId
        }
      }

      return refreshed.accessToken
    }
  }

  function createAuthClient(options: AuthOptions = {}) {
    const context = createAuthContext(options)
    const fetchResilienceRuntime = createAuthClientFetchResilienceRuntime()
    return {
      fetchWithResilience: (url: string, init: RequestInit = {}, requestOptions: FetchWithResilienceOptions = {}) =>
        fetchResilienceRuntime.fetchWithResilienceInternal(context, url, init, requestOptions),
      getAccessToken: (forceRefresh = false) => getAccessTokenInternal(context, fetchResilienceRuntime, forceRefresh),
      createAuthRefreshHandler: (tokenEntry: unknown) =>
        createAuthRefreshHandlerInternal(context, fetchResilienceRuntime, tokenEntry),
    }
  }

  moduleRegistry.authClient = {
    createAuthClient,
  }
})()
