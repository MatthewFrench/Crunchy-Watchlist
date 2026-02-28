import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type AuthClientFetchResilienceRuntime = {
  fetchWithResilienceInternal: (
    context: Record<string, unknown>,
    url: string,
    init?: RequestInit,
    options?: Record<string, unknown>,
  ) => Promise<Response>;
};

type AuthClientFetchResilienceModule = {
  authClientFetchResilience: {
    createAuthClientFetchResilienceRuntime: () => AuthClientFetchResilienceRuntime;
  };
};

const authClientFetchResilienceModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'AuthClientFetchResilience.ts'),
).href;

function getFetchResilienceRuntime() {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as AuthClientFetchResilienceModule;
  return registry.authClientFetchResilience.createAuthClientFetchResilienceRuntime();
}

function createContext(overrides: Record<string, unknown> = {}) {
  return {
    fetchImpl: vi.fn(async () => new Response(null, { status: 200 })),
    runtimeEvent: vi.fn(),
    sanitizePositiveInt: (value: unknown) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
    },
    shouldRetryStatus: () => false,
    computeFetchRetryDelayMs: () => 0,
    sleep: vi.fn(async () => undefined),
    fetchTimeoutMs: 5000,
    fetchMaxAttempts: 2,
    ...overrides,
  };
}

describe('auth client fetch resilience runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([authClientFetchResilienceModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
    vi.restoreAllMocks();
  });

  it('retries configured HTTP status responses before succeeding', async () => {
    const fetchImpl = vi
      .fn<(url: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const context = createContext({
      fetchImpl,
      shouldRetryStatus: (status: number) => status >= 500,
      computeFetchRetryDelayMs: () => 5,
    });
    const runtime = getFetchResilienceRuntime();

    const response = await runtime.fetchWithResilienceInternal(
      context,
      'https://example.invalid/watchlist',
      {},
      { label: 'watchlist request', maxAttempts: 2 },
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((context.runtimeEvent as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([
        [
          'fetch-retry',
          expect.objectContaining({
            label: 'watchlist request',
            status: 503,
          }),
        ],
      ]),
    );
  });

  it('refreshes bearer token once after a 401 and retries with refreshed authorization', async () => {
    const capturedAuthorization: string[] = [];
    let requestCount = 0;
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers as HeadersInit);
      capturedAuthorization.push(headers.get('authorization') ?? '');
      requestCount += 1;
      return requestCount === 1 ? new Response(null, { status: 401 }) : new Response(null, { status: 200 });
    });
    const refreshBearerToken = vi.fn(async () => 'fresh-token');
    const context = createContext({
      fetchImpl,
      shouldRetryStatus: () => false,
    });
    const runtime = getFetchResilienceRuntime();

    const response = await runtime.fetchWithResilienceInternal(
      context,
      'https://example.invalid/ratings',
      {},
      {
        label: 'ratings request',
        bearerToken: 'stale-token',
        refreshBearerToken,
        maxAttempts: 2,
      },
    );

    expect(response.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(refreshBearerToken).toHaveBeenCalledTimes(1);
    expect(capturedAuthorization).toEqual(['Bearer stale-token', 'Bearer fresh-token']);
    expect((context.runtimeEvent as ReturnType<typeof vi.fn>).mock.calls).toEqual(
      expect.arrayContaining([
        [
          'fetch-auth-refresh',
          expect.objectContaining({
            label: 'ratings request',
            attempt: 1,
          }),
        ],
      ]),
    );
  });
});
