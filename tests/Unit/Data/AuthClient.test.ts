import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type AuthTokenEntry = {
  accessToken: string
  accountId: string | null
  profileId: string | null
  expiresAt: number
}

type AuthClientRuntime = {
  getAccessToken: (forceRefresh?: boolean) => Promise<AuthTokenEntry | null>
  createAuthRefreshHandler: (tokenEntry: Record<string, unknown>) => () => Promise<string>
}

type AuthClientModule = {
  authClient: {
    createAuthClient: (options: Record<string, unknown>) => AuthClientRuntime
  }
}

const authClientModuleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Data', 'AuthClient.ts')).href
const authClientFetchResilienceModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'AuthClientFetchResilience.ts'),
).href

function getAuthClientModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as AuthClientModule
  return registry.authClient
}

function createLocalStorageMock() {
  const storage = new Map<string, string>()
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value)
    },
  }
}

function createAuthClient(
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
  stateOverrides: Record<string, unknown> = {},
) {
  const state = {
    authToken: null as AuthTokenEntry | null,
    authTokenInflight: null as Promise<AuthTokenEntry | null> | null,
    ...stateOverrides,
  }

  return getAuthClientModule().createAuthClient({
    state,
    fetchImpl,
    runtimeEvent: vi.fn(),
    pushApiTrace: vi.fn(),
    resolveApiHref: (path: string) => `https://www.crunchyroll.com${path}`,
    sanitizePositiveInt: (value: unknown) => {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) {
        return null
      }
      return Math.floor(number)
    },
    shouldRetryStatus: () => false,
    computeFetchRetryDelayMs: () => 0,
    sleep: async () => undefined,
    fetchTimeoutMs: 5000,
    fetchMaxAttempts: 1,
    authTokenSkewMs: 1000,
    authClientBasic: 'Basic test-value',
    authDeviceKey: 'cw_auth_device_id_v1',
    localStorageRef: createLocalStorageMock(),
    navigatorRef: { userAgent: 'node', platform: 'darwin' },
    cryptoRef: { randomUUID: () => 'uuid-1' },
  })
}

describe('auth-client runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([authClientFetchResilienceModuleUrl, authClientModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('returns valid cached token without network call', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 500 }))
    const cachedToken: AuthTokenEntry = {
      accessToken: 'cached-access-token-12345',
      accountId: 'account-1',
      profileId: 'profile-1',
      expiresAt: Date.now() + 60_000,
    }

    const authClient = createAuthClient(fetchImpl, {
      authToken: cachedToken,
    })
    const token = await authClient.getAccessToken(false)

    expect(token).toEqual(cachedToken)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('refreshes token through auth endpoint and updates mutable token entry', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            access_token: 'refreshed-access-token-12345',
            expires_in: 600,
            account_id: 'account-2',
            profile_id: 'profile-2',
            token_type: 'bearer',
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json; charset=utf-8',
            },
          },
        ),
    )

    const authClient = createAuthClient(fetchImpl)
    const token = await authClient.getAccessToken(true)
    expect(token?.accessToken).toBe('refreshed-access-token-12345')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(token?.profileId).toBe('profile-2')

    const mutableTokenEntry: Record<string, unknown> = {
      accessToken: 'old-token',
      expiresAt: 0,
      accountId: null,
      profileId: null,
    }
    const refreshHandler = authClient.createAuthRefreshHandler(mutableTokenEntry)
    const refreshedAccessToken = await refreshHandler()

    expect(refreshedAccessToken).toBe('refreshed-access-token-12345')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(mutableTokenEntry.accessToken).toBe('refreshed-access-token-12345')
    expect(typeof mutableTokenEntry.expiresAt).toBe('number')
    expect(mutableTokenEntry.accountId).toBe('account-2')
    expect(mutableTokenEntry.profileId).toBe('profile-2')
  })
})
