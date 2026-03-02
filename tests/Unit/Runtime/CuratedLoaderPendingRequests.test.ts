import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedLoaderPendingRequestsRuntime = {
  createPendingRequestProgress: (state: {
    curatedPendingRequestStartedCount: number;
    curatedPendingRequestCompletedCount: number;
  }) => { started: number; completed: number };
  syncPendingRequestDiagnostics: (
    context: {
      state: {
        curatedPendingRequests: string[];
        curatedPendingRequestStartedCount: number;
        curatedPendingRequestCompletedCount: number;
        mounted: boolean;
      };
      locationRef: { pathname: string };
      isWatchlistPath: (pathname: string) => boolean;
      refreshCuratedLoadingIndicator: () => void;
    },
    activeRequests: string[],
    progress: { started: number; completed: number },
  ) => void;
  withTrackedPendingRequest: <T>(
    context: {
      state: {
        curatedPendingRequests: string[];
        curatedPendingRequestStartedCount: number;
        curatedPendingRequestCompletedCount: number;
        mounted: boolean;
      };
      locationRef: { pathname: string };
      isWatchlistPath: (pathname: string) => boolean;
      refreshCuratedLoadingIndicator: () => void;
    },
    activeRequests: string[],
    progress: { started: number; completed: number },
    label: string,
    work: () => Promise<T>,
  ) => Promise<T>;
};

type CuratedLoaderPendingRequestsModule = {
  createCuratedLoaderPendingRequestsRuntime: () => CuratedLoaderPendingRequestsRuntime;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const curatedLoaderPendingRequestsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedLoaderPendingRequests.ts'),
).href;
let curatedLoaderPendingRequestsModule: CuratedLoaderPendingRequestsModule | null = null;

function createDeferred<T>(): Deferred<T> {
  let resolveRef: ((value: T | PromiseLike<T>) => void) | null = null;
  let rejectRef: ((reason?: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolveRef = resolve;
    rejectRef = reject;
  });

  if (!resolveRef || !rejectRef) {
    throw new Error('Failed to initialize deferred promise');
  }

  return {
    promise,
    resolve: resolveRef,
    reject: rejectRef,
  };
}

function getCuratedLoaderPendingRequestsModule() {
  if (!curatedLoaderPendingRequestsModule) {
    throw new Error('Curated loader pending requests runtime module was not initialized for test');
  }
  return curatedLoaderPendingRequestsModule;
}

describe('curated-loader-pending-requests runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    curatedLoaderPendingRequestsModule = (await import(
      curatedLoaderPendingRequestsModuleUrl
    )) as CuratedLoaderPendingRequestsModule;
  });

  afterEach(() => {
    curatedLoaderPendingRequestsModule = null;
  });

  it('normalizes malformed pending request counters when creating progress state', () => {
    const runtime = getCuratedLoaderPendingRequestsModule().createCuratedLoaderPendingRequestsRuntime();

    const progress = runtime.createPendingRequestProgress({
      curatedPendingRequestStartedCount: Number.NaN,
      curatedPendingRequestCompletedCount: -10,
    });

    expect(progress).toEqual({
      started: 0,
      completed: 0,
    });
  });

  it('tracks duplicate request labels independently until each request resolves', async () => {
    const runtime = getCuratedLoaderPendingRequestsModule().createCuratedLoaderPendingRequestsRuntime();
    const refreshCuratedLoadingIndicator = vi.fn();
    const context = {
      state: {
        curatedPendingRequests: [] as string[],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        mounted: true,
      },
      locationRef: {
        pathname: '/watchlist',
      },
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      refreshCuratedLoadingIndicator,
    };
    const activeRequests: string[] = [];
    const progress = runtime.createPendingRequestProgress(context.state);
    const deferred = createDeferred<void>();

    const firstRequestPromise = runtime.withTrackedPendingRequest(
      context,
      activeRequests,
      progress,
      'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
      () => deferred.promise,
    );
    await Promise.resolve();

    expect(context.state.curatedPendingRequests).toEqual([
      'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
    ]);
    expect(context.state.curatedPendingRequestStartedCount).toBe(1);
    expect(context.state.curatedPendingRequestCompletedCount).toBe(0);

    await runtime.withTrackedPendingRequest(
      context,
      activeRequests,
      progress,
      'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
      async () => null,
    );

    expect(context.state.curatedPendingRequests).toEqual([
      'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
    ]);
    expect(context.state.curatedPendingRequestStartedCount).toBe(2);
    expect(context.state.curatedPendingRequestCompletedCount).toBe(1);

    deferred.resolve();
    await firstRequestPromise;

    expect(context.state.curatedPendingRequests).toEqual([]);
    expect(context.state.curatedPendingRequestStartedCount).toBe(2);
    expect(context.state.curatedPendingRequestCompletedCount).toBe(2);
    expect(refreshCuratedLoadingIndicator).toHaveBeenCalled();
  });

  it('increments completed counters and clears pending state when tracked work fails', async () => {
    const runtime = getCuratedLoaderPendingRequestsModule().createCuratedLoaderPendingRequestsRuntime();
    const context = {
      state: {
        curatedPendingRequests: [] as string[],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        mounted: true,
      },
      locationRef: {
        pathname: '/watchlist',
      },
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      refreshCuratedLoadingIndicator: vi.fn(),
    };
    const activeRequests: string[] = [];
    const progress = runtime.createPendingRequestProgress(context.state);

    await expect(
      runtime.withTrackedPendingRequest(context, activeRequests, progress, 'Failed request', async () => {
        throw new Error('request failed');
      }),
    ).rejects.toThrow('request failed');

    expect(context.state.curatedPendingRequests).toEqual([]);
    expect(context.state.curatedPendingRequestStartedCount).toBe(1);
    expect(context.state.curatedPendingRequestCompletedCount).toBe(1);
  });
});
