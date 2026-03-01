import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ApiContractsRuntime = {
  parsePayloadDataEnvelope: (
    endpointName: string,
    payload: unknown,
  ) => { rows: Record<string, unknown>[]; total: number | null };
  auditWatchlistRowsContract: (rows: Array<Record<string, unknown>>) => void;
  auditWatchHistoryRowsContract: (rows: Array<Record<string, unknown>>) => void;
  auditCmsObjectContract: (rows: Array<Record<string, unknown>>) => void;
};

type ApiContractsModule = {
  createApiContracts: (deps: Record<string, unknown>) => ApiContractsRuntime;
};

const moduleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Data', 'ApiContracts.ts')).href;

let createApiContracts: ApiContractsModule['createApiContracts'] | null = null;

function createRuntime(runtimeEvent: ReturnType<typeof vi.fn>): ApiContractsRuntime {
  if (!createApiContracts) {
    throw new Error('API contracts runtime was not initialized for test');
  }

  return createApiContracts({
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
    getWatchlistSeriesId: (row: unknown) => {
      const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      return typeof record.seriesId === 'string' && record.seriesId ? record.seriesId : null;
    },
    getWatchHistorySeriesId: (row: unknown) => {
      const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      return typeof record.seriesId === 'string' && record.seriesId ? record.seriesId : null;
    },
    fetchBackoffBaseMs: 400,
    fetchBackoffJitterMs: 220,
  });
}

describe('api envelope contract drift coverage', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(moduleUrl)) as {
      createApiContractsRuntime: () => object;
    };
    createApiContracts = (module.createApiContractsRuntime() as ApiContractsModule).createApiContracts;
  });

  afterEach(() => {
    createApiContracts = null;
    vi.restoreAllMocks();
  });

  it('accepts standard production envelope shape across watchlist/watch-history/cms endpoints', () => {
    const runtimeEvent = vi.fn();
    const runtime = createRuntime(runtimeEvent);

    const watchlistEnvelope = runtime.parsePayloadDataEnvelope('watchlist', {
      total: 3,
      data: [{ id: 'w-1' }, { id: 'w-2' }, { id: 'w-3' }],
    });
    const watchHistoryEnvelope = runtime.parsePayloadDataEnvelope('watch-history', {
      total: 2,
      data: [{ id: 'h-1' }, { id: 'h-2' }],
    });
    const cmsEnvelope = runtime.parsePayloadDataEnvelope('cms-objects', {
      total: 1,
      data: [{ id: 'cms-1' }],
    });

    expect(watchlistEnvelope).toEqual({
      rows: [{ id: 'w-1' }, { id: 'w-2' }, { id: 'w-3' }],
      total: 3,
    });
    expect(watchHistoryEnvelope).toEqual({
      rows: [{ id: 'h-1' }, { id: 'h-2' }],
      total: 2,
    });
    expect(cmsEnvelope).toEqual({
      rows: [{ id: 'cms-1' }],
      total: 1,
    });
  });

  it('handles total drift variants without dropping rows', () => {
    const runtimeEvent = vi.fn();
    const runtime = createRuntime(runtimeEvent);

    const missingTotal = runtime.parsePayloadDataEnvelope('watchlist', {
      data: [{ id: 'row-1' }],
    });
    const numericStringTotal = runtime.parsePayloadDataEnvelope('watch-history', {
      total: '5',
      data: [{ id: 'row-2' }],
    });
    const invalidTotal = runtime.parsePayloadDataEnvelope('cms-objects', {
      total: 'not-a-number',
      data: [{ id: 'row-3' }],
    });
    const negativeTotal = runtime.parsePayloadDataEnvelope('watchlist', {
      total: -9,
      data: [{ id: 'row-4' }],
    });

    expect(missingTotal).toEqual({ rows: [{ id: 'row-1' }], total: null });
    expect(numericStringTotal).toEqual({ rows: [{ id: 'row-2' }], total: 5 });
    expect(invalidTotal).toEqual({ rows: [{ id: 'row-3' }], total: null });
    expect(negativeTotal).toEqual({ rows: [{ id: 'row-4' }], total: null });
  });

  it('throws for endpoint envelope drift when data is not an array', () => {
    const runtimeEvent = vi.fn();
    const runtime = createRuntime(runtimeEvent);

    expect(() => runtime.parsePayloadDataEnvelope('watchlist', { data: {} })).toThrow(
      'Crunchyroll API contract changed for watchlist',
    );
    expect(() => runtime.parsePayloadDataEnvelope('watch-history', { data: null })).toThrow(
      'Crunchyroll API contract changed for watch-history',
    );
    expect(() => runtime.parsePayloadDataEnvelope('cms-objects', { data: 'not-an-array' })).toThrow(
      'Crunchyroll API contract changed for cms-objects',
    );
  });

  it('emits endpoint-specific contract warnings for row-level drift audits', () => {
    const runtimeEvent = vi.fn();
    const runtime = createRuntime(runtimeEvent);

    runtime.auditWatchlistRowsContract([{ id: 'w-1' }, { panel: {} }]);
    runtime.auditWatchHistoryRowsContract([{ id: 'h-1', date_played: 'invalid' }, { date_played: '2026-01-01' }]);
    runtime.auditCmsObjectContract([
      { id: '', rating: {} },
      { id: 'cms-2', series_metadata: {} },
    ]);

    expect(runtimeEvent).toHaveBeenCalledWith(
      'api-contract-warning',
      expect.objectContaining({ endpoint: 'watchlist' }),
    );
    expect(runtimeEvent).toHaveBeenCalledWith(
      'api-contract-warning',
      expect.objectContaining({ endpoint: 'watch-history' }),
    );
    expect(runtimeEvent).toHaveBeenCalledWith(
      'api-contract-warning',
      expect.objectContaining({ endpoint: 'cms-objects' }),
    );
  });
});
