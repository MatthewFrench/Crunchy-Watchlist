type RefreshTokenFn = () => Promise<string>;

type FetchWithResilienceOptions = {
  label?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  retryNetworkErrors?: boolean;
  bearerToken?: string;
  refreshBearerToken?: RefreshTokenFn;
};

type AuthContext = {
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  runtimeEvent: (event: string, data?: Record<string, string | number | boolean | null | undefined>) => void;
  sanitizePositiveInt: (value: number | null | undefined) => number | null;
  shouldRetryStatus: (status: number) => boolean;
  computeFetchRetryDelayMs: (attempt: number, response: Response | null) => number;
  sleep: (delayMs: number) => Promise<void>;
  fetchTimeoutMs: number;
  fetchMaxAttempts: number;
};

type FetchAttemptController = {
  controller: AbortController | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

type AuthClientFetchResilienceRuntime = {
  fetchWithResilienceInternal: (
    context: AuthContext,
    url: string,
    init?: RequestInit,
    options?: FetchWithResilienceOptions,
  ) => Promise<Response>;
};
type ErrorRecord = {
  name?: string;
  message?: string;
};
type ErrorLike = ErrorRecord | Error | DOMException | null | undefined;

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;

function createFetchAttemptController(timeoutMs: number): FetchAttemptController {
  const controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
  const timeoutId = controller
    ? root.setTimeout(() => {
        try {
          controller.abort();
        } catch (_) {
          // no-op
        }
      }, timeoutMs)
    : null;

  return {
    controller,
    timeoutId,
  };
}

function clearFetchAttemptTimeout(timeoutId: ReturnType<typeof setTimeout> | null): void {
  if (timeoutId != null) {
    root.clearTimeout(timeoutId);
  }
}

function createFetchHeaders(inputHeaders: HeadersInit | null | undefined, bearerToken: string): Headers {
  const HeadersRef = typeof root.Headers === 'function' ? root.Headers : Headers;
  const headers = new HeadersRef((inputHeaders || {}) as HeadersInit);
  if (bearerToken) {
    headers.set('authorization', `Bearer ${bearerToken}`);
  }
  return headers;
}

function toRefreshTokenFn(value: FetchWithResilienceOptions['refreshBearerToken']): RefreshTokenFn | null {
  return typeof value === 'function' ? value : null;
}

async function tryRefreshFetchBearerToken(
  context: AuthContext,
  responseStatus: number,
  hasTriedRefresh: boolean,
  refreshBearerToken: FetchWithResilienceOptions['refreshBearerToken'],
  label: string,
  attempt: number,
): Promise<{ hasTriedRefresh: boolean; bearerToken: string }> {
  const refreshToken = toRefreshTokenFn(refreshBearerToken);
  if (responseStatus !== 401 || hasTriedRefresh || !refreshToken) {
    return {
      hasTriedRefresh,
      bearerToken: '',
    };
  }

  try {
    const refreshed = await refreshToken();
    if (typeof refreshed === 'string' && refreshed) {
      context.runtimeEvent('fetch-auth-refresh', { label, attempt });
      return {
        hasTriedRefresh: true,
        bearerToken: refreshed,
      };
    }
  } catch (_) {
    // no-op
  }

  return {
    hasTriedRefresh: true,
    bearerToken: '',
  };
}

async function queueFetchRetry(
  context: AuthContext,
  label: string,
  attempt: number,
  delayMs: number,
  extra: Record<string, string | number | boolean | null | undefined> = {},
): Promise<void> {
  context.runtimeEvent('fetch-retry', {
    label,
    attempt,
    delayMs,
    ...extra,
  });
  await context.sleep(delayMs);
}

function shouldRetryFetchNetworkError(message: string): boolean {
  return !/failed:\s*\d{3}\b/.test(message);
}

function toErrorRecord(error: ErrorLike): ErrorRecord | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  return error as ErrorRecord;
}

function getErrorName(error: ErrorLike): string {
  const record = toErrorRecord(error);
  if (!record || typeof record.name !== 'string') {
    return '';
  }

  return record.name;
}

function getErrorMessage(error: ErrorLike): string {
  const record = toErrorRecord(error);
  if (!record || typeof record.message !== 'string' || !record.message) {
    return 'network failure';
  }

  return record.message;
}

function resolveRequestLabel(labelValue: string | undefined): string {
  return typeof labelValue === 'string' && labelValue.trim() ? labelValue.trim() : 'request';
}

async function fetchWithResilienceInternal(
  context: AuthContext,
  url: string,
  init: RequestInit = {},
  options: FetchWithResilienceOptions = {},
): Promise<Response> {
  const label = resolveRequestLabel(options.label);
  const timeoutMs = context.sanitizePositiveInt(options.timeoutMs) ?? context.fetchTimeoutMs;
  const maxAttempts = Math.max(1, context.sanitizePositiveInt(options.maxAttempts) ?? context.fetchMaxAttempts);
  const retryNetworkErrors = options.retryNetworkErrors !== false;

  let attempt = 0;
  let lastErrorMessage = '';
  let hasTriedRefresh = false;
  let bearerToken = options.bearerToken || '';

  while (attempt < maxAttempts) {
    attempt += 1;
    const attemptController = createFetchAttemptController(timeoutMs);

    try {
      const headers = createFetchHeaders(init.headers, bearerToken);
      const requestInit: RequestInit = {
        ...init,
        headers,
      };
      if (attemptController.controller) {
        requestInit.signal = attemptController.controller.signal;
      } else if (init.signal !== undefined) {
        requestInit.signal = init.signal;
      }

      const response = await context.fetchImpl(url, requestInit);

      clearFetchAttemptTimeout(attemptController.timeoutId);

      const refreshResult = await tryRefreshFetchBearerToken(
        context,
        response.status,
        hasTriedRefresh,
        options.refreshBearerToken,
        label,
        attempt,
      );
      hasTriedRefresh = refreshResult.hasTriedRefresh;
      if (refreshResult.bearerToken) {
        bearerToken = refreshResult.bearerToken;
        continue;
      }

      if (response.ok) {
        return response;
      }

      if (attempt < maxAttempts && context.shouldRetryStatus(response.status)) {
        const delayMs = context.computeFetchRetryDelayMs(attempt, response);
        await queueFetchRetry(context, label, attempt, delayMs, { status: response.status });
        continue;
      }

      throw new Error(`${label} failed: ${response.status}`);
    } catch (error) {
      clearFetchAttemptTimeout(attemptController.timeoutId);

      const errorLike = error as ErrorLike;
      const aborted = getErrorName(errorLike) === 'AbortError';
      const message = aborted ? 'timeout' : getErrorMessage(errorLike);
      lastErrorMessage = message;

      if (attempt < maxAttempts && retryNetworkErrors && shouldRetryFetchNetworkError(message)) {
        const delayMs = context.computeFetchRetryDelayMs(attempt, null);
        await queueFetchRetry(context, label, attempt, delayMs, { reason: message });
        continue;
      }

      throw new Error(`${label} failed: ${message}`);
    }
  }

  throw new Error(`${label} failed: ${lastErrorMessage || 'exhausted retries'}`);
}

function createAuthClientFetchResilienceRuntimeInternal(): AuthClientFetchResilienceRuntime {
  return {
    fetchWithResilienceInternal: (context, url, init = {}, options = {}) =>
      fetchWithResilienceInternal(context, url, init, options),
  };
}
const authClientFetchResilienceRuntime = createAuthClientFetchResilienceRuntimeInternal();

export function createAuthClientFetchResilienceRuntime(): object {
  return authClientFetchResilienceRuntime;
}
