import { createAuthClientFetchResilienceRuntime as createAuthClientFetchResilienceRuntimeFactory } from './AuthClientFetchResilience.js';

type BoundaryValue = LooseRecord[string];
type BoundaryRecord = Record<string, BoundaryValue>;

type AuthTokenEntry = {
  accessToken: string;
  accountId: string | null;
  profileId: string | null;
  expiresAt: number;
};
type AuthEventPayload = BoundaryRecord;
type AuthTracePayload = BoundaryRecord;

type RefreshBearerTokenFn = () => Promise<string>;
type AuthTokenResponsePayload = {
  accessToken: string;
  expiresInSeconds: number | null;
  accountId: string | null;
  profileId: string | null;
  tokenType: string | null;
  country: string | null;
};

type MutableAuthTokenEntry = {
  accessToken?: string;
  accountId?: string | null;
  profileId?: string | null;
  expiresAt?: number;
} & BoundaryRecord;

type AuthState = {
  authToken: AuthTokenEntry | null;
  authTokenInflight: Promise<AuthTokenEntry | null> | null;
};

type FetchWithResilienceOptions = {
  label?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  retryNetworkErrors?: boolean;
  bearerToken?: string;
  refreshBearerToken?: RefreshBearerTokenFn;
};

type AuthContext = {
  state: AuthState;
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  runtimeEvent: (event: string, data?: AuthEventPayload) => void;
  pushApiTrace: (endpoint: string, payload: AuthTracePayload) => void;
  resolveApiHref: (pathWithQuery: string) => string;
  sanitizePositiveInt: (value: number | null | undefined) => number | null;
  shouldRetryStatus: (status: number) => boolean;
  computeFetchRetryDelayMs: (attempt: number, response: Response | null) => number;
  sleep: (delayMs: number) => Promise<void>;
  fetchTimeoutMs: number;
  fetchMaxAttempts: number;
  authTokenSkewMs: number;
  authClientBasic: string;
  authDeviceKey: string;
  localStorageRef: Storage;
  navigatorRef: Navigator;
  cryptoRef: Crypto;
};

type AuthOptions = {
  state?: BoundaryValue;
  fetchImpl?: BoundaryValue;
  runtimeEvent?: BoundaryValue;
  pushApiTrace?: BoundaryValue;
  resolveApiHref?: BoundaryValue;
  sanitizePositiveInt?: BoundaryValue;
  shouldRetryStatus?: BoundaryValue;
  computeFetchRetryDelayMs?: BoundaryValue;
  sleep?: BoundaryValue;
  fetchTimeoutMs?: BoundaryValue;
  fetchMaxAttempts?: BoundaryValue;
  authTokenSkewMs?: BoundaryValue;
  authClientBasic?: BoundaryValue;
  authDeviceKey?: BoundaryValue;
  localStorageRef?: BoundaryValue;
  navigatorRef?: BoundaryValue;
  cryptoRef?: BoundaryValue;
};

type AuthClientFetchResilienceRuntime = {
  fetchWithResilienceInternal: (
    context: AuthContext,
    url: string,
    init?: RequestInit,
    options?: FetchWithResilienceOptions,
  ) => Promise<Response>;
};

type AuthClientRuntime = {
  fetchWithResilience: (
    url: string,
    init?: RequestInit,
    requestOptions?: FetchWithResilienceOptions,
  ) => Promise<Response>;
  getAccessToken: (forceRefresh?: boolean) => Promise<AuthTokenEntry | null>;
  createAuthRefreshHandler: (tokenEntry: BoundaryRecord | null | undefined) => RefreshBearerTokenFn;
};

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
function requireFunction<T extends (...args: never[]) => BoundaryValue>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing auth dependency: ${name}`);
  }
  return value as T;
}

function getFiniteNumber(value: BoundaryValue, fallback: number): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
}

function toAuthState(value: BoundaryValue): AuthState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const state = value as Partial<AuthState>;

  if (!Object.hasOwn(state, 'authToken')) {
    state.authToken = null;
  }

  if (!Object.hasOwn(state, 'authTokenInflight')) {
    state.authTokenInflight = null;
  }

  return state as AuthState;
}

function toMutableAuthTokenEntry(value: BoundaryRecord | null | undefined): MutableAuthTokenEntry | null {
  if (!value) {
    return null;
  }

  return value;
}

function resolveLocalStorageRef(value: BoundaryValue): Storage {
  if (value && typeof value === 'object' && typeof (value as Storage).getItem === 'function') {
    return value as Storage;
  }

  return root.localStorage;
}

function resolveNavigatorRef(value: BoundaryValue): Navigator {
  if (value && typeof value === 'object') {
    return value as Navigator;
  }

  return root.navigator;
}

function resolveCryptoRef(value: BoundaryValue): Crypto {
  if (value && typeof value === 'object') {
    return value as Crypto;
  }

  return root.crypto;
}

function createAuthContext(options: AuthOptions = {}): AuthContext {
  const state = toAuthState(options.state);
  if (!state) {
    throw new Error('[CW] Missing auth state');
  }

  const fetchImpl = typeof options.fetchImpl === 'function' ? (options.fetchImpl as AuthContext['fetchImpl']) : null;
  if (!fetchImpl) {
    throw new Error('[CW] Missing fetch implementation');
  }

  return {
    state,
    fetchImpl,
    runtimeEvent:
      typeof options.runtimeEvent === 'function' ? (options.runtimeEvent as AuthContext['runtimeEvent']) : () => {},
    pushApiTrace:
      typeof options.pushApiTrace === 'function' ? (options.pushApiTrace as AuthContext['pushApiTrace']) : () => {},
    resolveApiHref: requireFunction('resolveApiHref', options.resolveApiHref),
    sanitizePositiveInt: requireFunction('sanitizePositiveInt', options.sanitizePositiveInt),
    shouldRetryStatus: requireFunction('shouldRetryStatus', options.shouldRetryStatus),
    computeFetchRetryDelayMs: requireFunction('computeFetchRetryDelayMs', options.computeFetchRetryDelayMs),
    sleep: requireFunction('sleep', options.sleep),
    fetchTimeoutMs: getFiniteNumber(options.fetchTimeoutMs, 12000),
    fetchMaxAttempts: getFiniteNumber(options.fetchMaxAttempts, 3),
    authTokenSkewMs: getFiniteNumber(options.authTokenSkewMs, 60 * 1000),
    authClientBasic: typeof options.authClientBasic === 'string' ? options.authClientBasic : '',
    authDeviceKey: typeof options.authDeviceKey === 'string' ? options.authDeviceKey : 'cw_auth_device_id_v1',
    localStorageRef: resolveLocalStorageRef(options.localStorageRef),
    navigatorRef: resolveNavigatorRef(options.navigatorRef),
    cryptoRef: resolveCryptoRef(options.cryptoRef),
  };
}

function createAuthClientFetchResilienceRuntime(): AuthClientFetchResilienceRuntime {
  const runtime = createAuthClientFetchResilienceRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing auth dependency: authClientFetchResilience.runtime');
  }
  const runtimeRecord = runtime as Partial<AuthClientFetchResilienceRuntime>;

  return {
    fetchWithResilienceInternal: requireFunction<AuthClientFetchResilienceRuntime['fetchWithResilienceInternal']>(
      'authClientFetchResilience.fetchWithResilienceInternal',
      runtimeRecord.fetchWithResilienceInternal,
    ),
  };
}

function generateDeviceId(context: AuthContext): string {
  try {
    if (typeof context.cryptoRef.randomUUID === 'function') {
      return context.cryptoRef.randomUUID();
    }
  } catch (_) {
    // no-op
  }

  return `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateDeviceId(context: AuthContext): string {
  try {
    const existing = context.localStorageRef.getItem(context.authDeviceKey);
    if (existing) {
      return existing;
    }

    const created = generateDeviceId(context);
    context.localStorageRef.setItem(context.authDeviceKey, created);
    return created;
  } catch (_) {
    return generateDeviceId(context);
  }
}

function getAuthDeviceType(context: AuthContext): string {
  const userAgent = typeof context.navigatorRef.userAgent === 'string' ? context.navigatorRef.userAgent : '';
  const platform =
    typeof context.navigatorRef.platform === 'string' && context.navigatorRef.platform.trim()
      ? context.navigatorRef.platform.trim()
      : 'Unknown';

  if (/\bEdg\//.test(userAgent)) {
    return `Edge on ${platform}`;
  }

  if (/\bFirefox\//.test(userAgent)) {
    return `Firefox on ${platform}`;
  }

  if (/\bChrome\//.test(userAgent) || /\bChromium\//.test(userAgent)) {
    return `Chrome on ${platform}`;
  }

  if (/\bSafari\//.test(userAgent)) {
    return `Safari on ${platform}`;
  }

  return `Browser on ${platform}`;
}

function isAuthTokenValid(context: AuthContext, tokenEntry: AuthTokenEntry | null): tokenEntry is AuthTokenEntry {
  if (!tokenEntry) {
    return false;
  }

  return (
    typeof tokenEntry.accessToken === 'string' &&
    tokenEntry.accessToken.length > 10 &&
    typeof tokenEntry.expiresAt === 'number' &&
    tokenEntry.expiresAt - Date.now() > context.authTokenSkewMs
  );
}

function toPayloadRecord(payload: BoundaryValue): AuthTracePayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  return payload as AuthTracePayload;
}

function parseAuthTokenResponsePayloadInternal(payload: BoundaryValue): AuthTokenResponsePayload {
  const payloadRecord = toPayloadRecord(payload);
  const expiresInRaw = Number(payloadRecord.expires_in || 0);
  return {
    accessToken: typeof payloadRecord.access_token === 'string' ? payloadRecord.access_token : '',
    expiresInSeconds: Number.isFinite(expiresInRaw) && expiresInRaw > 0 ? expiresInRaw : null,
    accountId: typeof payloadRecord.account_id === 'string' ? payloadRecord.account_id : null,
    profileId: typeof payloadRecord.profile_id === 'string' ? payloadRecord.profile_id : null,
    tokenType: typeof payloadRecord.token_type === 'string' ? payloadRecord.token_type : null,
    country: typeof payloadRecord.country === 'string' ? payloadRecord.country : null,
  };
}

async function requestAccessTokenInternal(
  context: AuthContext,
  fetchResilienceRuntime: AuthClientFetchResilienceRuntime,
): Promise<AuthTokenEntry> {
  const body = new root.URLSearchParams({
    device_id: getOrCreateDeviceId(context),
    device_type: getAuthDeviceType(context),
    grant_type: 'etp_rt_cookie',
  });

  const tokenUrl = context.resolveApiHref('/auth/v1/token');
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
  );

  if (!response.ok) {
    throw new Error(`auth token request failed: ${response.status}`);
  }

  const payload = parseAuthTokenResponsePayloadInternal(await response.json());
  context.pushApiTrace('authToken', {
    at: Date.now(),
    request: {
      url: tokenUrl,
      grant_type: 'etp_rt_cookie',
    },
    response: {
      account_id: payload.accountId,
      profile_id: payload.profileId,
      expires_in: payload.expiresInSeconds,
      token_type: payload.tokenType,
      country: payload.country,
    },
  });

  const accessToken = payload.accessToken;
  const accountId = payload.accountId;
  const profileId = payload.profileId;

  if (!accessToken) {
    throw new Error('auth token missing access_token');
  }

  const expiresAt = Date.now() + (payload.expiresInSeconds != null ? payload.expiresInSeconds * 1000 : 15 * 60 * 1000);

  return {
    accessToken,
    accountId,
    profileId,
    expiresAt,
  };
}

async function getAccessTokenInternal(
  context: AuthContext,
  fetchResilienceRuntime: AuthClientFetchResilienceRuntime,
  forceRefresh = false,
): Promise<AuthTokenEntry | null> {
  if (!forceRefresh && isAuthTokenValid(context, context.state.authToken)) {
    return context.state.authToken;
  }

  if (!forceRefresh && context.state.authTokenInflight) {
    return context.state.authTokenInflight;
  }

  let inflight: Promise<AuthTokenEntry | null> | null = null;

  inflight = (async () => {
    try {
      const tokenEntry = await requestAccessTokenInternal(context, fetchResilienceRuntime);
      context.state.authToken = tokenEntry;
      context.runtimeEvent('auth-token-ready', {
        hasAccountId: !!tokenEntry.accountId,
        hasProfileId: !!tokenEntry.profileId,
      });
      return tokenEntry;
    } catch (_) {
      context.runtimeEvent('auth-token-failed');
      context.state.authToken = null;
      return null;
    } finally {
      if (context.state.authTokenInflight === inflight) {
        context.state.authTokenInflight = null;
      }
    }
  })();

  context.state.authTokenInflight = inflight;
  return inflight;
}

function createAuthRefreshHandlerInternal(
  context: AuthContext,
  fetchResilienceRuntime: AuthClientFetchResilienceRuntime,
  tokenEntry: MutableAuthTokenEntry | null,
): RefreshBearerTokenFn {
  return async () => {
    const refreshed = await getAccessTokenInternal(context, fetchResilienceRuntime, true);
    if (!refreshed?.accessToken) {
      return '';
    }

    if (tokenEntry) {
      tokenEntry.accessToken = refreshed.accessToken;
      tokenEntry.expiresAt = refreshed.expiresAt;
      if (typeof refreshed.accountId === 'string' && refreshed.accountId) {
        tokenEntry.accountId = refreshed.accountId;
      }
      if (typeof refreshed.profileId === 'string' && refreshed.profileId) {
        tokenEntry.profileId = refreshed.profileId;
      }
    }

    return refreshed.accessToken;
  };
}

function createAuthClient(options: AuthOptions = {}): AuthClientRuntime {
  const context = createAuthContext(options);
  const fetchResilienceRuntime = createAuthClientFetchResilienceRuntime();
  return {
    fetchWithResilience: (url: string, init: RequestInit = {}, requestOptions: FetchWithResilienceOptions = {}) =>
      fetchResilienceRuntime.fetchWithResilienceInternal(context, url, init, requestOptions),
    getAccessToken: (forceRefresh = false) => getAccessTokenInternal(context, fetchResilienceRuntime, forceRefresh),
    createAuthRefreshHandler: (tokenEntry: BoundaryRecord | null | undefined) =>
      createAuthRefreshHandlerInternal(context, fetchResilienceRuntime, toMutableAuthTokenEntry(tokenEntry)),
  };
}

const authClientRuntime = {
  createAuthClient,
};

export function createAuthClientRuntime(): object {
  return authClientRuntime;
}
