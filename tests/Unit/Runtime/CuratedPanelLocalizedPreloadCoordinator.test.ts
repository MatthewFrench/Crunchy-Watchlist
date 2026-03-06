import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedPanelLocalizedPreloadCoordinatorRuntime = {
  queue: (selectedAudioFilter: string, onRenderRequested: () => void) => void;
};

type CuratedPanelLocalizedPreloadCoordinatorModule = {
  CuratedPanelLocalizedPreloadCoordinator: new (options: {
    state: {
      mounted: boolean;
      curatedEntries: Array<Record<string, unknown>>;
      ratingCacheRevision?: number;
      watchHistoryCache?: Record<string, unknown>;
    };
    locationRef: Location;
    isWatchlistPath: (pathname: string) => boolean;
    isLocalizedRatingDataMissingForEntries: (entries: unknown[], audioLocale: unknown) => boolean;
    isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown[], audioLocale: unknown) => boolean;
    preloadRatingsForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>;
    preloadWatchHistoryForSelectedAudioLocale: (audioLocale: string) => Promise<unknown>;
  }) => CuratedPanelLocalizedPreloadCoordinatorRuntime;
};

const coordinatorModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelLocalizedPreloadCoordinator.ts'),
).href;
let coordinatorModule: CuratedPanelLocalizedPreloadCoordinatorModule | null = null;

function createDeferredPromise<T>() {
  let resolvePromise: ((value: T | PromiseLike<T>) => void) | null = null;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: (value: T) => {
      resolvePromise?.(value);
    },
  };
}

function getCoordinatorModule(): CuratedPanelLocalizedPreloadCoordinatorModule {
  if (!coordinatorModule) {
    throw new Error('CuratedPanelLocalizedPreloadCoordinator module was not initialized for test');
  }
  return coordinatorModule;
}

describe('CuratedPanelLocalizedPreloadCoordinator', () => {
  beforeEach(async () => {
    vi.resetModules();
    coordinatorModule = (await import(coordinatorModuleUrl)) as CuratedPanelLocalizedPreloadCoordinatorModule;
  });

  it('deduplicates queued completion rerenders for the same locale and revision window', async () => {
    const ratingsDeferred = createDeferredPromise<null>();
    const historyDeferred = createDeferredPromise<null>();
    const preloadRatingsForSelectedAudioLocale = vi.fn(() => ratingsDeferred.promise);
    const preloadWatchHistoryForSelectedAudioLocale = vi.fn(() => historyDeferred.promise);
    const onRenderRequested = vi.fn();
    const state = {
      mounted: true,
      curatedEntries: [{ seriesId: 'series-1' }],
      ratingCacheRevision: 1,
      watchHistoryCache: {
        updatedAt: 10,
      },
    };

    const coordinator = new (getCoordinatorModule().CuratedPanelLocalizedPreloadCoordinator)({
      state,
      locationRef: {
        pathname: '/watchlist',
      } as Location,
      isWatchlistPath: (pathname: string) => pathname.endsWith('/watchlist'),
      isLocalizedRatingDataMissingForEntries: () => true,
      isLocalizedWatchHistoryDataMissingForEntries: () => true,
      preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale,
    });

    coordinator.queue('ja-JP', onRenderRequested);
    coordinator.queue('ja-JP', onRenderRequested);

    expect(preloadRatingsForSelectedAudioLocale).toHaveBeenCalledTimes(1);
    expect(preloadWatchHistoryForSelectedAudioLocale).toHaveBeenCalledTimes(1);

    state.ratingCacheRevision = 2;
    ratingsDeferred.resolve(null);
    historyDeferred.resolve(null);
    await Promise.resolve();
    await Promise.resolve();

    expect(onRenderRequested).toHaveBeenCalledTimes(1);
  });
});
