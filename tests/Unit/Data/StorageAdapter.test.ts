import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type StorageAdapter = {
  get: <T>(key: string, fallback: T) => Promise<T | unknown>;
  set: (key: string, value: unknown) => Promise<void>;
};

type StorageRuntimeModule = {
  createStorageAdapter: (options?: Record<string, unknown>) => StorageAdapter;
};

type LocalStorageStub = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const storageAdapterModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'StorageAdapter.ts'),
).href;
let createStorageAdapterRuntimeFactory: StorageRuntimeModule['createStorageAdapter'] | null = null;

function createLocalStorageStub(seed: Record<string, string> = {}): {
  storage: LocalStorageStub;
  readRaw: (key: string) => string | null;
} {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    storage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value);
      },
    },
    readRaw: (key) => store.get(key) ?? null,
  };
}

function createStorageAdapter(options: Record<string, unknown>): StorageAdapter {
  if (typeof createStorageAdapterRuntimeFactory !== 'function') {
    throw new Error('Storage adapter runtime was not initialized for test');
  }
  return createStorageAdapterRuntimeFactory(options);
}

describe('StorageAdapter', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(storageAdapterModuleUrl)) as {
      createStorageRuntime: () => object;
    };
    createStorageAdapterRuntimeFactory = (module.createStorageRuntime() as StorageRuntimeModule).createStorageAdapter;
  });

  afterEach(() => {
    createStorageAdapterRuntimeFactory = null;
    vi.restoreAllMocks();
  });

  it('falls back to localStorage when storageArea methods are missing', async () => {
    const local = createLocalStorageStub();
    const adapter = createStorageAdapter({
      storageArea: {},
      localStorageRef: local.storage,
    });

    await adapter.set('cw_settings_v1', { sortMode: 'rating_desc' });
    const loaded = await adapter.get('cw_settings_v1', { sortMode: 'none' });

    expect(local.readRaw('cw_settings_v1')).toBe(JSON.stringify({ sortMode: 'rating_desc' }));
    expect(loaded).toEqual({ sortMode: 'rating_desc' });
  });

  it('falls back to localStorage when storageArea access throws', async () => {
    const local = createLocalStorageStub();
    const adapter = createStorageAdapter({
      storageArea: {
        get: async () => {
          throw new Error('denied');
        },
        set: async () => {
          throw new Error('denied');
        },
      },
      localStorageRef: local.storage,
    });

    await adapter.set('cw_settings_v1', { audioLocaleFilter: 'en-US' });
    const loaded = await adapter.get('cw_settings_v1', { audioLocaleFilter: 'any' });

    expect(local.readRaw('cw_settings_v1')).toBe(JSON.stringify({ audioLocaleFilter: 'en-US' }));
    expect(loaded).toEqual({ audioLocaleFilter: 'en-US' });
  });

  it('prefers extension storage for writes when storageArea succeeds', async () => {
    const local = createLocalStorageStub();
    const storageAreaStore = new Map<string, unknown>();
    const adapter = createStorageAdapter({
      storageArea: {
        get: async (key: string) => (storageAreaStore.has(key) ? { [key]: storageAreaStore.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          Object.entries(items).forEach(([key, value]) => {
            storageAreaStore.set(key, value);
          });
        },
      },
      localStorageRef: local.storage,
    });

    await adapter.set('cw_settings_v1', { watchReadyFilterMode: 'dim' });

    const loaded = await adapter.get('cw_settings_v1', { watchReadyFilterMode: 'hide' });

    expect(local.readRaw('cw_settings_v1')).toBe(null);
    expect(storageAreaStore.get('cw_settings_v1')).toEqual({ watchReadyFilterMode: 'dim' });
    expect(loaded).toEqual({ watchReadyFilterMode: 'dim' });
  });

  it('reads localStorage values when extension key is missing without auto-migrating writes', async () => {
    const local = createLocalStorageStub({
      cw_settings_v1: JSON.stringify({ sortMode: 'date_updated_desc' }),
    });
    const storageAreaStore = new Map<string, unknown>();
    const setCalls: Array<Record<string, unknown>> = [];
    const adapter = createStorageAdapter({
      storageArea: {
        get: async (key: string) => (storageAreaStore.has(key) ? { [key]: storageAreaStore.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          setCalls.push(items);
          Object.entries(items).forEach(([key, value]) => {
            storageAreaStore.set(key, value);
          });
        },
      },
      localStorageRef: local.storage,
    });

    const loaded = await adapter.get('cw_settings_v1', { sortMode: 'none' });
    expect(loaded).toEqual({ sortMode: 'date_updated_desc' });
    expect(storageAreaStore.get('cw_settings_v1')).toBeUndefined();
    expect(setCalls).toHaveLength(0);
  });

  it('does not enqueue background extension writes for localStorage fallback reads', async () => {
    const local = createLocalStorageStub({ cw_settings_v1: JSON.stringify({ sortMode: 'date_updated_desc' }) });
    const storageAreaStore = new Map<string, unknown>();
    const setCalls: Array<Record<string, unknown>> = [];

    const adapter = createStorageAdapter({
      storageArea: {
        get: async (key: string) => (storageAreaStore.has(key) ? { [key]: storageAreaStore.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          setCalls.push(items);
          Object.entries(items).forEach(([key, value]) => {
            storageAreaStore.set(key, value);
          });
        },
      },
      localStorageRef: local.storage,
    });

    const loaded = await adapter.get('cw_settings_v1', { sortMode: 'none' });
    expect(loaded).toEqual({ sortMode: 'date_updated_desc' });
    await Promise.resolve();
    await Promise.resolve();

    expect(setCalls).toHaveLength(0);
    expect(storageAreaStore.get('cw_settings_v1')).toBeUndefined();
  });

  it('writes to extension storage when user explicitly sets a value after localStorage fallback read', async () => {
    const local = createLocalStorageStub({ cw_settings_v1: JSON.stringify({ sortMode: 'date_updated_desc' }) });
    const storageAreaStore = new Map<string, unknown>();
    const adapter = createStorageAdapter({
      storageArea: {
        get: async (key: string) => (storageAreaStore.has(key) ? { [key]: storageAreaStore.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          Object.entries(items).forEach(([key, value]) => {
            storageAreaStore.set(key, value);
          });
        },
      },
      localStorageRef: local.storage,
    });

    const loaded = await adapter.get('cw_settings_v1', { sortMode: 'none' });
    expect(loaded).toEqual({ sortMode: 'date_updated_desc' });

    await adapter.set('cw_settings_v1', { sortMode: 'rating_desc' });
    expect(storageAreaStore.get('cw_settings_v1')).toEqual({ sortMode: 'rating_desc' });
  });
});
