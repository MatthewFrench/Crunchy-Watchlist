import { incrementRuntimePerfDiagnostic } from './RuntimePerfDiagnostics.js';

type CuratedBoundaryValue = CwBoundaryValue;
type CuratedBoundaryRecord = Record<string, CuratedBoundaryValue>;
type CuratedBoundaryArray = CuratedBoundaryValue[];
type CuratedBoundaryPromise = Promise<CuratedBoundaryValue>;
type LocalizedMetadataMissingFn = (entries: CuratedBoundaryArray, audioLocale: CuratedBoundaryValue) => boolean;
type LocalizedMetadataPreloadFn = (audioLocale: string) => CuratedBoundaryPromise;

type RuntimeState = {
  mounted: boolean;
  curatedEntries: CuratedBoundaryArray;
  ratingCacheRevision?: number;
  watchHistoryCache?: CuratedBoundaryValue;
};

type CuratedPanelLocalizedPreloadCoordinatorOptions = {
  state: RuntimeState;
  locationRef: Location;
  isWatchlistPath: (pathname: string) => boolean;
  isLocalizedRatingDataMissingForEntries: LocalizedMetadataMissingFn;
  isLocalizedWatchHistoryDataMissingForEntries: LocalizedMetadataMissingFn;
  preloadRatingsForSelectedAudioLocale: LocalizedMetadataPreloadFn;
  preloadWatchHistoryForSelectedAudioLocale: LocalizedMetadataPreloadFn;
};

function getWatchHistoryCacheUpdatedAt(state: RuntimeState): number {
  const watchHistoryCache = state.watchHistoryCache;
  if (!watchHistoryCache || typeof watchHistoryCache !== 'object') {
    return 0;
  }

  const updatedAtValue = Number((watchHistoryCache as CuratedBoundaryRecord).updatedAt);
  return Number.isFinite(updatedAtValue) && updatedAtValue > 0 ? Math.round(updatedAtValue) : 0;
}

export class CuratedPanelLocalizedPreloadCoordinator {
  private readonly state: RuntimeState;
  private readonly locationRef: Location;
  private readonly isWatchlistPath: (pathname: string) => boolean;
  private readonly isLocalizedRatingDataMissingForEntries: LocalizedMetadataMissingFn;
  private readonly isLocalizedWatchHistoryDataMissingForEntries: LocalizedMetadataMissingFn;
  private readonly preloadRatingsForSelectedAudioLocale: LocalizedMetadataPreloadFn;
  private readonly preloadWatchHistoryForSelectedAudioLocale: LocalizedMetadataPreloadFn;
  private readonly queuedRenderRequests = new Set<string>();

  constructor(options: CuratedPanelLocalizedPreloadCoordinatorOptions) {
    this.state = options.state;
    this.locationRef = options.locationRef;
    this.isWatchlistPath = options.isWatchlistPath;
    this.isLocalizedRatingDataMissingForEntries = options.isLocalizedRatingDataMissingForEntries;
    this.isLocalizedWatchHistoryDataMissingForEntries = options.isLocalizedWatchHistoryDataMissingForEntries;
    this.preloadRatingsForSelectedAudioLocale = options.preloadRatingsForSelectedAudioLocale;
    this.preloadWatchHistoryForSelectedAudioLocale = options.preloadWatchHistoryForSelectedAudioLocale;
  }

  readonly queue = (selectedAudioFilter: string, onRenderRequested: () => void): void => {
    if (selectedAudioFilter === 'any') {
      return;
    }

    const shouldPreloadLocalizedRatings = this.isLocalizedRatingDataMissingForEntries(
      this.state.curatedEntries,
      selectedAudioFilter,
    );
    const shouldPreloadLocalizedWatchHistory = this.isLocalizedWatchHistoryDataMissingForEntries(
      this.state.curatedEntries,
      selectedAudioFilter,
    );

    if (!shouldPreloadLocalizedRatings && !shouldPreloadLocalizedWatchHistory) {
      return;
    }

    const initialRatingCacheRevision = Number(this.state.ratingCacheRevision) || 0;
    const initialWatchHistoryUpdatedAt = getWatchHistoryCacheUpdatedAt(this.state);
    const preloadTasks: CuratedBoundaryPromise[] = [];
    const renderRequestKey = [
      selectedAudioFilter.trim().toLowerCase(),
      shouldPreloadLocalizedRatings ? 'ratings' : '',
      shouldPreloadLocalizedWatchHistory ? 'history' : '',
      initialRatingCacheRevision,
      initialWatchHistoryUpdatedAt,
    ].join('|');

    if (this.queuedRenderRequests.has(renderRequestKey)) {
      incrementRuntimePerfDiagnostic('localizedPreloadRenderRequestsDeduped');
      return;
    }
    this.queuedRenderRequests.add(renderRequestKey);
    incrementRuntimePerfDiagnostic('localizedPreloadRenderRequestsQueued');

    if (shouldPreloadLocalizedRatings) {
      preloadTasks.push(this.preloadRatingsForSelectedAudioLocale(selectedAudioFilter));
    }
    if (shouldPreloadLocalizedWatchHistory) {
      preloadTasks.push(this.preloadWatchHistoryForSelectedAudioLocale(selectedAudioFilter));
    }

    Promise.allSettled(preloadTasks)
      .then(() => {
        if (!this.state.mounted || !this.isWatchlistPath(this.locationRef.pathname)) {
          return;
        }

        const nextRatingCacheRevision = Number(this.state.ratingCacheRevision) || 0;
        const nextWatchHistoryUpdatedAt = getWatchHistoryCacheUpdatedAt(this.state);
        if (
          nextRatingCacheRevision === initialRatingCacheRevision &&
          nextWatchHistoryUpdatedAt === initialWatchHistoryUpdatedAt
        ) {
          return;
        }

        onRenderRequested();
      })
      .finally(() => {
        this.queuedRenderRequests.delete(renderRequestKey);
      });
  };
}
