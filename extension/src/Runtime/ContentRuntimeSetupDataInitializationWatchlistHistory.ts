import type {
  LooseRecord,
  RequireFunction,
  TraceContractsRuntime,
  UnknownFn,
} from './ContentRuntimeSetupDataInitializationPhases.js';

function toRecord(value: CwBoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as LooseRecord;
}

function initializeWatchlistRuntime(
  context: LooseRecord,
  bindings: LooseRecord,
  traceContractsRuntime: TraceContractsRuntime,
  requireFn: RequireFunction,
): void {
  const corePrimitives = traceContractsRuntime.corePrimitives;
  const apiContracts = traceContractsRuntime.apiContracts;
  const watchlistClientModule = toRecord(context.watchlistClientModule);
  const watchlistRepositoryModule = toRecord(context.watchlistRepositoryModule);
  const runtimeConstants = toRecord(context.runtimeConstants);

  const watchlistClient = requireFn<UnknownFn>(
    'createWatchlistClient',
    watchlistClientModule.createWatchlistClient,
  )({
    fetchWithResilience: bindings.fetchWithResilience,
    createAuthRefreshHandler: bindings.createAuthRefreshHandler,
    resolveApiHref: bindings.resolveApiHref,
    parsePayloadDataEnvelope: apiContracts.parsePayloadDataEnvelope as UnknownFn,
    auditWatchlistRowsContract: apiContracts.auditWatchlistRowsContract as UnknownFn,
    getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
    getLocale: apiContracts.getLocale as UnknownFn,
    getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId as UnknownFn,
    pushApiTrace: bindings.pushApiTrace,
    runtimeEvent: bindings.runtimeEvent,
    watchlistPageSize: runtimeConstants.watchlistPageSize,
    watchlistMaxPages: runtimeConstants.watchlistMaxPages,
    watchlistParallelRequests: runtimeConstants.watchlistParallelRequests,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('watchlist client', watchlistClient, ['fetchAllWatchlistRows']);
  bindings.fetchAllWatchlistRows = watchlistClient.fetchAllWatchlistRows;

  const watchlistRepository = requireFn<UnknownFn>(
    'createWatchlistRepository',
    watchlistRepositoryModule.createWatchlistRepository,
  )({
    state: context.state,
    createWatchlistCacheSnapshot: context.createWatchlistCacheSnapshot,
    scheduleSaveWatchlistCache: bindings.scheduleSaveWatchlistCache,
    watchlistCacheTtlMs: runtimeConstants.watchlistCacheTtlMs,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('watchlist repository', watchlistRepository, [
    'normalizeStoredWatchlistCache',
    'isWatchlistCacheValid',
    'resetWatchlistCacheOnAccountMismatch',
    'setWatchlistCacheRows',
  ]);
  bindings.normalizeStoredWatchlistCache = watchlistRepository.normalizeStoredWatchlistCache;
  bindings.isWatchlistCacheValid = watchlistRepository.isWatchlistCacheValid;
  bindings.resetWatchlistCacheOnAccountMismatch = watchlistRepository.resetWatchlistCacheOnAccountMismatch;
  bindings.setWatchlistCacheRows = watchlistRepository.setWatchlistCacheRows;
}

function initializeHistoryAndPreviewRuntime(
  context: LooseRecord,
  bindings: LooseRecord,
  traceContractsRuntime: TraceContractsRuntime,
  requireFn: RequireFunction,
): void {
  const corePrimitives = traceContractsRuntime.corePrimitives;
  const apiContracts = traceContractsRuntime.apiContracts;
  const runtimeConstants = toRecord(context.runtimeConstants);
  const historyRepositoryModule = toRecord(context.historyRepositoryModule);
  const previewRepositoryModule = toRecord(context.previewRepositoryModule);

  const historyRepository = requireFn<UnknownFn>(
    'createHistoryRepository',
    historyRepositoryModule.createHistoryRepository,
  )({
    state: context.state,
    normalizeAudioLocale: corePrimitives.normalizeAudioLocale as UnknownFn,
    sanitizePositiveInt: corePrimitives.sanitizePositiveInt as UnknownFn,
    parseDateMs: corePrimitives.parseDateMs as UnknownFn,
    pickFirstPositiveInt: corePrimitives.pickFirstPositiveInt as UnknownFn,
    deriveCanonicalEpisodeKeyFromEpisodeMetadata:
      corePrimitives.deriveCanonicalEpisodeKeyFromEpisodeMetadata as UnknownFn,
    getAbsoluteEpisodeNumberFromEpisodeMetadata:
      corePrimitives.getAbsoluteEpisodeNumberFromEpisodeMetadata as UnknownFn,
    getPreferredAudioLanguage: bindings.getPreferredAudioLanguage,
    getLocale: apiContracts.getLocale as UnknownFn,
    resolveApiHref: bindings.resolveApiHref,
    fetchWithResilience: bindings.fetchWithResilience,
    createAuthRefreshHandler: bindings.createAuthRefreshHandler,
    parsePayloadDataEnvelope: apiContracts.parsePayloadDataEnvelope as UnknownFn,
    auditWatchHistoryRowsContract: apiContracts.auditWatchHistoryRowsContract as UnknownFn,
    createEmptyWatchHistoryCache: context.createEmptyWatchHistoryCache,
    scheduleSaveWatchHistory: bindings.scheduleSaveWatchHistory,
    pushApiTrace: bindings.pushApiTrace,
    runtimeEvent: bindings.runtimeEvent,
    watchHistoryCacheVersion: runtimeConstants.watchHistoryCacheVersion,
    watchHistoryCacheTtlMs: runtimeConstants.watchHistoryCacheTtlMs,
    watchHistoryPageSize: runtimeConstants.watchHistoryPageSize,
    watchHistoryMaxPages: runtimeConstants.watchHistoryMaxPages,
    watchHistoryNoMatchPageLimit: runtimeConstants.watchHistoryNoMatchPageLimit,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('history repository', historyRepository, [
    'normalizeStoredWatchHistoryCache',
    'isWatchHistoryCacheValid',
    'getCachedWatchHistory',
    'getCachedWatchHistoryProgress',
    'preloadWatchHistoryForEntries',
    'isLocalizedWatchHistoryDataMissingForEntries',
  ]);
  bindings.normalizeStoredWatchHistoryCache = historyRepository.normalizeStoredWatchHistoryCache;
  bindings.isWatchHistoryCacheValid = historyRepository.isWatchHistoryCacheValid;
  bindings.getCachedWatchHistory = historyRepository.getCachedWatchHistory;
  bindings.getCachedWatchHistoryProgress = historyRepository.getCachedWatchHistoryProgress;
  bindings.preloadWatchHistoryForEntries = historyRepository.preloadWatchHistoryForEntries;
  bindings.isLocalizedWatchHistoryDataMissingForEntries =
    historyRepository.isLocalizedWatchHistoryDataMissingForEntries;

  const previewRepository = requireFn<UnknownFn>(
    'createPreviewRepository',
    previewRepositoryModule.createPreviewRepository,
  )({
    state: context.state,
    resolveApiHref: bindings.resolveApiHref,
    getAccessToken: bindings.getAccessToken,
    fetchWithResilience: bindings.fetchWithResilience,
    createAuthRefreshHandler: bindings.createAuthRefreshHandler,
    pushApiTrace: bindings.pushApiTrace,
    runtimeEvent: bindings.runtimeEvent,
  }) as LooseRecord;
  (context.assertRuntimeMethods as UnknownFn)('preview repository', previewRepository, ['fetchPreviewUrlForEntry']);
  bindings.fetchPreviewUrlForEntry = previewRepository.fetchPreviewUrlForEntry;
}

export function initializeWatchlistHistoryAndPreviewRuntime(
  context: LooseRecord,
  bindings: LooseRecord,
  traceContractsRuntime: TraceContractsRuntime,
  requireFn: RequireFunction,
): void {
  initializeWatchlistRuntime(context, bindings, traceContractsRuntime, requireFn);
  initializeHistoryAndPreviewRuntime(context, bindings, traceContractsRuntime, requireFn);
}
