import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type WatchlistRow = Record<string, unknown>

type WatchlistCacheSnapshot = {
  accountId: string
  profileId: string
  updatedAt: number
  rows: WatchlistRow[]
}

type WatchlistRepositoryState = {
  watchlistCache: WatchlistCacheSnapshot
}

type WatchlistRepository = {
  normalizeStoredWatchlistCache: (raw: unknown) => WatchlistCacheSnapshot
  isWatchlistCacheValid: (cache?: unknown, accountId?: unknown, profileId?: unknown) => boolean
  resetWatchlistCacheOnAccountMismatch: (accountId: unknown, profileId?: unknown) => boolean
  setWatchlistCacheRows: (
    accountId: unknown,
    profileIdOrRows: unknown,
    updatedAtOrRows: unknown,
    rowsMaybe?: unknown,
  ) => WatchlistCacheSnapshot
}

type WatchlistRepositoryModule = {
  createWatchlistRepository: (options: Record<string, unknown>) => WatchlistRepository
}

const watchlistRepositoryModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'WatchlistRepository.ts'),
).href

function createWatchlistCacheSnapshot(
  accountId: unknown = '',
  profileId: unknown = '',
  updatedAt: unknown = 0,
  rows: unknown[] = [],
): WatchlistCacheSnapshot {
  return {
    accountId: typeof accountId === 'string' ? accountId : '',
    profileId: typeof profileId === 'string' ? profileId : '',
    updatedAt: typeof updatedAt === 'number' ? updatedAt : 0,
    rows: Array.isArray(rows) ? rows.filter((row): row is WatchlistRow => !!row && typeof row === 'object') : [],
  }
}

function getRepositoryModule(): WatchlistRepositoryModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>
  return registry.watchlistRepository as WatchlistRepositoryModule
}

function createRepository(
  state: WatchlistRepositoryState,
  overrides: {
    scheduleSaveWatchlistCache?: () => void
    watchlistCacheTtlMs?: number
  } = {},
): WatchlistRepository {
  return getRepositoryModule().createWatchlistRepository({
    state,
    createWatchlistCacheSnapshot,
    scheduleSaveWatchlistCache: overrides.scheduleSaveWatchlistCache ?? (() => {}),
    watchlistCacheTtlMs: overrides.watchlistCacheTtlMs ?? 30_000,
  })
}

describe('WatchlistRepository', () => {
  beforeEach(async () => {
    await loadRuntimeModules([watchlistRepositoryModuleUrl])
  })

  afterEach(() => {
    vi.useRealTimers()
    clearRuntimeModulesRegistry()
  })

  it('fails with explicit dependency errors when required inputs are missing', () => {
    const repositoryModule = getRepositoryModule()

    expect(() => repositoryModule.createWatchlistRepository({})).toThrow('[CW] Missing watchlist repository state')
    expect(() =>
      repositoryModule.createWatchlistRepository({
        state: { watchlistCache: createWatchlistCacheSnapshot() },
      }),
    ).toThrow('[CW] Missing watchlist repository dependency: createWatchlistCacheSnapshot')
  })

  it('normalizes stored cache payloads and filters non-object rows', () => {
    const state: WatchlistRepositoryState = {
      watchlistCache: createWatchlistCacheSnapshot(),
    }
    const repository = createRepository(state)

    const normalized = repository.normalizeStoredWatchlistCache({
      accountId: 'acct-1',
      profileId: 'profile-1',
      updatedAt: Date.now(),
      rows: [{ id: 'row-1' }, null, 'bad', { id: 'row-2' }],
    })

    expect(normalized.accountId).toBe('acct-1')
    expect(normalized.profileId).toBe('profile-1')
    expect(normalized.rows).toHaveLength(2)

    const fallback = repository.normalizeStoredWatchlistCache(null)
    expect(fallback).toEqual(createWatchlistCacheSnapshot())
  })

  it('validates cache ttl, account matching, and row availability', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))

    const state: WatchlistRepositoryState = {
      watchlistCache: createWatchlistCacheSnapshot('acct-1', 'profile-1', Date.now() - 500, [{ id: 'row-1' }]),
    }
    const repository = createRepository(state, { watchlistCacheTtlMs: 1_000 })

    expect(repository.isWatchlistCacheValid(state.watchlistCache, 'acct-1', 'profile-1')).toBe(true)
    expect(repository.isWatchlistCacheValid(state.watchlistCache, 'acct-2', 'profile-1')).toBe(false)
    expect(repository.isWatchlistCacheValid(state.watchlistCache, 'acct-1', 'profile-2')).toBe(false)

    state.watchlistCache = createWatchlistCacheSnapshot('acct-1', 'profile-1', Date.now() - 2_000, [{ id: 'row-1' }])
    expect(repository.isWatchlistCacheValid(state.watchlistCache, 'acct-1', 'profile-1')).toBe(false)

    state.watchlistCache = createWatchlistCacheSnapshot('acct-1', 'profile-1', Date.now(), [])
    expect(repository.isWatchlistCacheValid(state.watchlistCache, 'acct-1', 'profile-1')).toBe(false)

    state.watchlistCache = createWatchlistCacheSnapshot('acct-1', '', Date.now(), [{ id: 'row-1' }])
    expect(repository.isWatchlistCacheValid(state.watchlistCache, 'acct-1', 'profile-1')).toBe(false)
  })

  it('resets cache on account/profile mismatch and schedules save', () => {
    const scheduleSaveWatchlistCache = vi.fn()
    const state: WatchlistRepositoryState = {
      watchlistCache: createWatchlistCacheSnapshot('acct-1', 'profile-1', Date.now(), [{ id: 'row-1' }]),
    }
    const repository = createRepository(state, { scheduleSaveWatchlistCache })

    expect(repository.resetWatchlistCacheOnAccountMismatch('acct-2', 'profile-1')).toBe(true)
    expect(state.watchlistCache).toEqual(createWatchlistCacheSnapshot())
    expect(scheduleSaveWatchlistCache).toHaveBeenCalledTimes(1)

    state.watchlistCache = createWatchlistCacheSnapshot('acct-1', 'profile-1', Date.now(), [{ id: 'row-1' }])
    expect(repository.resetWatchlistCacheOnAccountMismatch('acct-1', 'profile-2')).toBe(true)
    expect(scheduleSaveWatchlistCache).toHaveBeenCalledTimes(2)

    expect(repository.resetWatchlistCacheOnAccountMismatch('acct-1', 'profile-2')).toBe(false)
    expect(scheduleSaveWatchlistCache).toHaveBeenCalledTimes(2)
  })

  it('resets legacy unscoped cache once profile scope is available', () => {
    const scheduleSaveWatchlistCache = vi.fn()
    const state: WatchlistRepositoryState = {
      watchlistCache: createWatchlistCacheSnapshot('acct-1', '', Date.now(), [{ id: 'row-1' }]),
    }
    const repository = createRepository(state, { scheduleSaveWatchlistCache })

    expect(repository.resetWatchlistCacheOnAccountMismatch('acct-1', 'profile-1')).toBe(true)
    expect(scheduleSaveWatchlistCache).toHaveBeenCalledTimes(1)
  })

  it('sets cache rows via owner API and schedules save', () => {
    const scheduleSaveWatchlistCache = vi.fn()
    const state: WatchlistRepositoryState = {
      watchlistCache: createWatchlistCacheSnapshot(),
    }
    const repository = createRepository(state, { scheduleSaveWatchlistCache })

    const nextCache = repository.setWatchlistCacheRows('acct-9', 'profile-9', [{ id: 'row-1' }, { id: 'row-2' }], 1234)

    expect(nextCache.accountId).toBe('acct-9')
    expect(nextCache.profileId).toBe('profile-9')
    expect(nextCache.updatedAt).toBe(1234)
    expect(nextCache.rows).toHaveLength(2)
    expect(state.watchlistCache).toEqual(nextCache)
    expect(scheduleSaveWatchlistCache).toHaveBeenCalledTimes(1)
  })

  it('supports legacy setWatchlistCacheRows(accountId, rows, updatedAt) signature', () => {
    const state: WatchlistRepositoryState = {
      watchlistCache: createWatchlistCacheSnapshot(),
    }
    const repository = createRepository(state)

    const nextCache = repository.setWatchlistCacheRows('acct-legacy', [{ id: 'row-1' }], 5678)

    expect(nextCache.accountId).toBe('acct-legacy')
    expect(nextCache.profileId).toBe('')
    expect(nextCache.updatedAt).toBe(5678)
    expect(nextCache.rows).toHaveLength(1)
  })
})
