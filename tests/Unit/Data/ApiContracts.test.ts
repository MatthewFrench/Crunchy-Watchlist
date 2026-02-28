import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type ApiContractsRuntime = {
  computeFetchRetryDelayMs: (attemptNumber: unknown, response: unknown) => number;
  requirePayloadDataArray: (endpointName: string, payload: unknown) => Record<string, unknown>[];
  auditWatchlistRowsContract: (rows: unknown[]) => void;
  resolveApiHref: (href: unknown) => string;
  getLocale: () => string;
};

type ApiContractsModule = {
  createApiContracts: (deps: Record<string, unknown>) => ApiContractsRuntime;
};

const moduleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Data', 'ApiContracts.ts')).href;

function getApiContractsModule(): ApiContractsModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;
  return registry.apiContracts as ApiContractsModule;
}

function createApiContractsRuntime(runtimeEvent: ReturnType<typeof vi.fn>) {
  return getApiContractsModule().createApiContracts({
    windowRef: {
      setTimeout: (callback: () => void) => {
        callback();
        return 0;
      },
      location: {
        origin: 'https://www.crunchyroll.com',
      },
    },
    navigatorRef: {
      language: 'en-US',
    },
    runtimeEvent,
    parseDateMs: (value: unknown) => {
      if (typeof value !== 'string') {
        return null;
      }
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    },
    getWatchlistSeriesId: (entry: unknown) => {
      const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      return typeof record.seriesId === 'string' && record.seriesId ? record.seriesId : null;
    },
    getWatchHistorySeriesId: (entry: unknown) => {
      const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      return typeof record.seriesId === 'string' && record.seriesId ? record.seriesId : null;
    },
    fetchBackoffBaseMs: 400,
    fetchBackoffJitterMs: 220,
  });
}

describe('api-contracts data module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([moduleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
  });

  it('parses retry-after headers and resolves API hrefs/locales', () => {
    const runtimeEvent = vi.fn();
    const runtime = createApiContractsRuntime(runtimeEvent);

    const delay = runtime.computeFetchRetryDelayMs(1, {
      headers: {
        get: (name: string) => (name === 'retry-after' ? '2' : null),
      },
    });

    expect(delay).toBe(2000);
    expect(runtime.resolveApiHref('/watchlist')).toBe('https://www.crunchyroll.com/watchlist');
    expect(runtime.getLocale()).toBe('en-US');
  });

  it('raises contract errors for invalid payload shape', () => {
    const runtimeEvent = vi.fn();
    const runtime = createApiContractsRuntime(runtimeEvent);

    expect(() => runtime.requirePayloadDataArray('watchlist', { rows: [] })).toThrow(
      'Crunchyroll API contract changed for watchlist',
    );

    expect(runtimeEvent).toHaveBeenCalledWith(
      'api-contract-error',
      expect.objectContaining({
        endpoint: 'watchlist',
      }),
    );
  });

  it('normalizes non-object rows in payload data[] and emits a warning', () => {
    const runtimeEvent = vi.fn();
    const runtime = createApiContractsRuntime(runtimeEvent);

    const rows = runtime.requirePayloadDataArray('watchlist', {
      data: [{ id: 'row-1' }, null, 42, []],
    });

    expect(rows).toEqual([{ id: 'row-1' }, {}, {}, {}]);
    expect(runtimeEvent).toHaveBeenCalledWith(
      'api-contract-warning',
      expect.objectContaining({
        endpoint: 'watchlist',
        message: 'payload data[] contained non-object rows',
        nonObjectCount: 3,
      }),
    );
  });

  it('emits warnings when watchlist rows are missing required fields', () => {
    const runtimeEvent = vi.fn();
    const runtime = createApiContractsRuntime(runtimeEvent);

    runtime.auditWatchlistRowsContract([{ id: 'row-1' }, { panel: {} }, { panel: { episode_metadata: {} } }]);

    expect(runtimeEvent).toHaveBeenCalledWith(
      'api-contract-warning',
      expect.objectContaining({
        endpoint: 'watchlist',
      }),
    );
  });
});
