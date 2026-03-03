type BoundaryValue = CwBoundaryValue;

export type LooseRecord = {
  [key: string]: BoundaryValue;
  panel?: LooseRecord;
  episode_metadata?: LooseRecord;
  series_metadata?: LooseRecord;
};

export type WatchHistoryEntry = {
  seriesId: string;
  datePlayedMs: number;
  datePlayed: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteEpisodeNumber: number | null;
  episodeDurationMs: number | null;
  episodeId: string | null;
  identifier: string;
  canonicalEpisodeKey: string;
  episodeTitle: string;
  playhead: number;
  fullyWatched: boolean;
  audioLocale: string;
  audioLocaleInferred: boolean;
};

export type WatchHistoryLocaleMap = Record<string, WatchHistoryEntry>;

export type WatchHistoryCache = {
  version: number;
  accountId: string;
  updatedAt: number;
  bySeriesId: Record<string, WatchHistoryEntry>;
  bySeriesIdAudioLocale: Record<string, WatchHistoryLocaleMap>;
  bySeriesIdProgress: Record<string, WatchHistoryEntry>;
  bySeriesIdAudioLocaleProgress: Record<string, WatchHistoryLocaleMap>;
};

export type WatchHistoryState = {
  watchHistoryCache: WatchHistoryCache;
} & LooseRecord;

export type HistoryRepositoryCacheContext = {
  state: WatchHistoryState;
  normalizeAudioLocale: (value: BoundaryValue) => string;
  sanitizePositiveInt: (value: BoundaryValue) => number | null;
  parseDateMs: (value: BoundaryValue) => number | null;
  pickFirstPositiveInt: (values: Array<number | null | undefined>) => number | null;
  deriveCanonicalEpisodeKeyFromEpisodeMetadata: (metadata: LooseRecord, seriesId?: BoundaryValue) => string;
  createEmptyWatchHistoryCache: () => WatchHistoryCache;
  watchHistoryCacheVersion: number;
  watchHistoryCacheTtlMs: number;
};

export function isWatchHistoryCacheValid(
  context: HistoryRepositoryCacheContext,
  cache: BoundaryValue = context.state.watchHistoryCache,
  accountId?: BoundaryValue,
): boolean {
  if (!cache || typeof cache !== 'object') {
    return false;
  }

  const cacheRecord = cache as LooseRecord;

  if (Number(cacheRecord.version) !== context.watchHistoryCacheVersion) {
    return false;
  }

  if (!cacheRecord.bySeriesId || typeof cacheRecord.bySeriesId !== 'object' || Array.isArray(cacheRecord.bySeriesId)) {
    return false;
  }

  if (typeof cacheRecord.updatedAt !== 'number') {
    return false;
  }

  if (typeof accountId === 'string' && accountId && cacheRecord.accountId !== accountId) {
    return false;
  }

  return Date.now() - cacheRecord.updatedAt < context.watchHistoryCacheTtlMs;
}

function resolveSequenceEpisodeNumber(
  context: HistoryRepositoryCacheContext,
  value: LooseRecord | null | undefined,
  episodeMetadata: LooseRecord | null | undefined,
): number | null {
  return context.pickFirstPositiveInt([
    context.sanitizePositiveInt(value?.sequenceNumber),
    context.sanitizePositiveInt(value?.sequence_number),
    context.sanitizePositiveInt(episodeMetadata?.sequence_number),
    context.sanitizePositiveInt(episodeMetadata?.episode_sequence_number),
  ]);
}

function resolveGlobalEpisodeNumber(
  context: HistoryRepositoryCacheContext,
  value: LooseRecord | null | undefined,
  episodeMetadata: LooseRecord | null | undefined,
): number | null {
  return context.pickFirstPositiveInt([
    context.sanitizePositiveInt(value?.globalEpisodeNumber),
    context.sanitizePositiveInt(value?.global_episode_number),
    context.sanitizePositiveInt(value?.global_episode_num),
    context.sanitizePositiveInt(episodeMetadata?.global_episode_number),
    context.sanitizePositiveInt(episodeMetadata?.global_episode_num),
  ]);
}

function isTrustedAbsoluteCandidate(
  candidate: number | null,
  seasonNumber: number | null,
  episodeNumber: number | null,
): boolean {
  if (candidate == null) {
    return false;
  }

  if (seasonNumber == null || seasonNumber === 1) {
    return true;
  }

  if (episodeNumber == null) {
    return true;
  }

  return candidate > episodeNumber;
}

function resolveAbsoluteEpisodeNumber(
  context: HistoryRepositoryCacheContext,
  value: LooseRecord | null | undefined,
  seasonNumber: number | null,
  episodeNumber: number | null,
): number | null {
  const episodeMetadata =
    value?.panel?.episode_metadata && typeof value.panel.episode_metadata === 'object'
      ? value.panel.episode_metadata
      : null;
  const globalEpisodeNumber = resolveGlobalEpisodeNumber(context, value, episodeMetadata);
  if (globalEpisodeNumber != null) {
    return globalEpisodeNumber;
  }

  const sequenceEpisodeNumber = resolveSequenceEpisodeNumber(context, value, episodeMetadata);
  const storedAbsoluteEpisodeNumber = context.sanitizePositiveInt(value?.absoluteEpisodeNumber);

  if (seasonNumber === 1) {
    return context.pickFirstPositiveInt([storedAbsoluteEpisodeNumber, episodeNumber, sequenceEpisodeNumber]);
  }

  if (isTrustedAbsoluteCandidate(storedAbsoluteEpisodeNumber, seasonNumber, episodeNumber)) {
    return storedAbsoluteEpisodeNumber;
  }

  if (isTrustedAbsoluteCandidate(sequenceEpisodeNumber, seasonNumber, episodeNumber)) {
    return sequenceEpisodeNumber;
  }

  return null;
}

function getWatchHistoryProgressIndex(
  context: HistoryRepositoryCacheContext,
  value: LooseRecord | null | undefined,
): number | null {
  const seasonNumber = context.sanitizePositiveInt(value?.seasonNumber);
  const episodeNumber = context.sanitizePositiveInt(value?.episodeNumber);
  const absoluteEpisodeNumber = resolveAbsoluteEpisodeNumber(context, value, seasonNumber, episodeNumber);
  if (absoluteEpisodeNumber != null) {
    return absoluteEpisodeNumber;
  }

  if (seasonNumber != null && episodeNumber != null) {
    return seasonNumber * 100000 + episodeNumber;
  }

  const sequenceEpisodeNumber = resolveSequenceEpisodeNumber(context, value, null);
  if (seasonNumber != null && sequenceEpisodeNumber != null) {
    return seasonNumber * 100000 + sequenceEpisodeNumber;
  }

  return sequenceEpisodeNumber;
}

export function shouldReplaceWatchHistoryProgress(
  context: HistoryRepositoryCacheContext,
  previous: LooseRecord | null | undefined,
  next: LooseRecord | null | undefined,
): boolean {
  if (!previous) {
    return true;
  }

  const previousAudioInferred = Boolean(previous?.audioLocaleInferred);
  const nextAudioInferred = Boolean(next?.audioLocaleInferred);
  const previousDateMs = context.parseDateMs(previous?.datePlayedMs ?? previous?.datePlayed) ?? 0;
  const nextDateMs = context.parseDateMs(next?.datePlayedMs ?? next?.datePlayed) ?? 0;

  if (previousAudioInferred !== nextAudioInferred) {
    return !nextAudioInferred;
  }

  if (previousAudioInferred && nextAudioInferred) {
    if (nextDateMs !== previousDateMs) {
      return nextDateMs > previousDateMs;
    }
  }

  const previousIndex = getWatchHistoryProgressIndex(context, previous);
  const nextIndex = getWatchHistoryProgressIndex(context, next);

  if (nextIndex != null && previousIndex != null && nextIndex !== previousIndex) {
    return nextIndex > previousIndex;
  }

  if (nextIndex != null && previousIndex == null) {
    return true;
  }

  if (nextIndex == null && previousIndex != null) {
    return false;
  }

  const previousCompleted = Boolean(previous?.fullyWatched);
  const nextCompleted = Boolean(next?.fullyWatched);
  if (nextCompleted !== previousCompleted) {
    return nextCompleted;
  }

  return nextDateMs > previousDateMs;
}

export function normalizeWatchHistoryEntry(
  context: HistoryRepositoryCacheContext,
  value: LooseRecord | null | undefined,
): WatchHistoryEntry | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const datePlayedMs = context.parseDateMs(value.datePlayedMs ?? value.datePlayed);
  if (datePlayedMs == null) {
    return null;
  }

  const seasonNumber = context.sanitizePositiveInt(value.seasonNumber ?? value?.panel?.episode_metadata?.season_number);
  const episodeNumber = context.sanitizePositiveInt(
    value.episodeNumber ?? value?.panel?.episode_metadata?.episode_number,
  );
  const absoluteEpisodeNumber = resolveAbsoluteEpisodeNumber(context, value, seasonNumber, episodeNumber);
  const audioLocale = context.normalizeAudioLocale(
    value.audioLocale ??
      value.audio_locale ??
      value?.panel?.episode_metadata?.audio_locale ??
      value?.panel?.audio_locale,
  );
  const seriesId =
    typeof value?.seriesId === 'string'
      ? value.seriesId
      : typeof value?.panel?.episode_metadata?.series_id === 'string'
        ? value.panel.episode_metadata.series_id
        : '';
  const episodeId =
    typeof value?.episodeId === 'string'
      ? value.episodeId
      : typeof value?.id === 'string'
        ? value.id
        : typeof value?.panel?.id === 'string'
          ? value.panel.id
          : null;
  const identifier =
    typeof value?.identifier === 'string'
      ? value.identifier
      : typeof value?.panel?.episode_metadata?.identifier === 'string'
        ? value.panel.episode_metadata.identifier
        : '';
  const canonicalEpisodeKey =
    typeof value?.canonicalEpisodeKey === 'string' && value.canonicalEpisodeKey
      ? value.canonicalEpisodeKey
      : context.deriveCanonicalEpisodeKeyFromEpisodeMetadata(value?.panel?.episode_metadata || {}, seriesId);
  const episodeDurationMs = context.sanitizePositiveInt(
    value?.episodeDurationMs ?? value?.durationMs ?? value?.duration_ms ?? value?.panel?.episode_metadata?.duration_ms,
  );

  return {
    seriesId,
    datePlayedMs,
    datePlayed: new Date(datePlayedMs).toISOString(),
    seasonNumber,
    episodeNumber,
    absoluteEpisodeNumber,
    episodeDurationMs,
    episodeId,
    identifier,
    canonicalEpisodeKey,
    episodeTitle:
      typeof value.episodeTitle === 'string'
        ? value.episodeTitle
        : typeof value?.panel?.title === 'string'
          ? value.panel.title
          : '',
    playhead: Number(value.playhead || 0),
    fullyWatched: Boolean(value.fullyWatched ?? value.fully_watched),
    audioLocale,
    audioLocaleInferred: Boolean(value?.audioLocaleInferred),
  };
}

export function normalizeStoredWatchHistoryBySeriesAudioLocale(
  context: HistoryRepositoryCacheContext,
  raw: BoundaryValue,
): Record<string, WatchHistoryLocaleMap> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const normalizedBySeries: Record<string, WatchHistoryLocaleMap> = {};

  Object.entries(raw as LooseRecord).forEach(([seriesId, localeMapValue]) => {
    if (!seriesId || !localeMapValue || typeof localeMapValue !== 'object' || Array.isArray(localeMapValue)) {
      return;
    }

    const normalizedLocaleMap: WatchHistoryLocaleMap = {};

    Object.entries(localeMapValue as LooseRecord).forEach(([localeKey, entryValue]) => {
      const normalizedEntry = normalizeWatchHistoryEntry(context, entryValue as LooseRecord);
      if (!normalizedEntry) {
        return;
      }

      const locale = context.normalizeAudioLocale(normalizedEntry.audioLocale || localeKey);
      if (!locale) {
        return;
      }

      const localeStorageKey = locale.toLowerCase();
      const previousEntry = normalizedLocaleMap[localeStorageKey];
      if (!previousEntry || normalizedEntry.datePlayedMs > previousEntry.datePlayedMs) {
        normalizedLocaleMap[localeStorageKey] = {
          ...normalizedEntry,
          audioLocale: locale,
        };
      }
    });

    if (Object.keys(normalizedLocaleMap).length) {
      normalizedBySeries[seriesId] = normalizedLocaleMap;
    }
  });

  return normalizedBySeries;
}

export function normalizeStoredWatchHistoryCache(
  context: HistoryRepositoryCacheContext,
  raw: BoundaryValue,
): WatchHistoryCache {
  if (!raw || typeof raw !== 'object') {
    return context.createEmptyWatchHistoryCache();
  }

  const rawRecord = raw as LooseRecord;
  const bySeriesIdRaw =
    rawRecord.bySeriesId && typeof rawRecord.bySeriesId === 'object' ? (rawRecord.bySeriesId as LooseRecord) : {};
  const bySeriesId: Record<string, WatchHistoryEntry> = {};

  Object.entries(bySeriesIdRaw).forEach(([seriesId, value]) => {
    if (!seriesId) {
      return;
    }
    const normalized = normalizeWatchHistoryEntry(context, value as LooseRecord);
    if (normalized) {
      bySeriesId[seriesId] = normalized;
    }
  });

  const bySeriesIdAudioLocale = normalizeStoredWatchHistoryBySeriesAudioLocale(
    context,
    rawRecord.bySeriesIdAudioLocale,
  );
  const bySeriesIdProgressRaw =
    rawRecord.bySeriesIdProgress && typeof rawRecord.bySeriesIdProgress === 'object'
      ? (rawRecord.bySeriesIdProgress as LooseRecord)
      : {};
  const bySeriesIdProgress: Record<string, WatchHistoryEntry> = {};

  Object.entries(bySeriesIdProgressRaw).forEach(([seriesId, value]) => {
    if (!seriesId) {
      return;
    }
    const normalized = normalizeWatchHistoryEntry(context, value as LooseRecord);
    if (normalized) {
      bySeriesIdProgress[seriesId] = normalized;
    }
  });

  const bySeriesIdAudioLocaleProgress = normalizeStoredWatchHistoryBySeriesAudioLocale(
    context,
    rawRecord.bySeriesIdAudioLocaleProgress,
  );

  return {
    version: Number(rawRecord.version) || 0,
    accountId: typeof rawRecord.accountId === 'string' ? rawRecord.accountId : '',
    updatedAt: typeof rawRecord.updatedAt === 'number' ? rawRecord.updatedAt : 0,
    bySeriesId,
    bySeriesIdAudioLocale,
    bySeriesIdProgress,
    bySeriesIdAudioLocaleProgress,
  };
}

function getCachedWatchHistoryFromBuckets(
  context: HistoryRepositoryCacheContext,
  seriesBucket: Record<string, WatchHistoryEntry>,
  seriesByLocaleBucket: Record<string, WatchHistoryLocaleMap> | null | undefined,
  seriesId: BoundaryValue,
  audioLocale: BoundaryValue = null,
  allowSeriesFallback = true,
): WatchHistoryEntry | null {
  if (typeof seriesId !== 'string' || !seriesId || !seriesBucket || typeof seriesBucket !== 'object') {
    return null;
  }

  const normalizedAudioLocale = context.normalizeAudioLocale(audioLocale);
  if (normalizedAudioLocale) {
    const perSeriesLocaleMap =
      seriesByLocaleBucket &&
      typeof seriesByLocaleBucket === 'object' &&
      !Array.isArray(seriesByLocaleBucket[seriesId]) &&
      typeof seriesByLocaleBucket[seriesId] === 'object'
        ? seriesByLocaleBucket[seriesId]
        : null;

    if (perSeriesLocaleMap) {
      const matchedByLocale = normalizeWatchHistoryEntry(
        context,
        perSeriesLocaleMap[normalizedAudioLocale.toLowerCase()],
      );
      if (matchedByLocale) {
        return {
          ...matchedByLocale,
          audioLocale: context.normalizeAudioLocale(matchedByLocale.audioLocale) || normalizedAudioLocale,
        };
      }
    }
  }

  if (!allowSeriesFallback) {
    return null;
  }

  return normalizeWatchHistoryEntry(context, seriesBucket[seriesId]);
}

export function getCachedWatchHistory(
  context: HistoryRepositoryCacheContext,
  seriesId: BoundaryValue,
  audioLocale: BoundaryValue = null,
  allowSeriesFallback = true,
): WatchHistoryEntry | null {
  if (
    typeof seriesId !== 'string' ||
    !seriesId ||
    !context.state.watchHistoryCache ||
    typeof context.state.watchHistoryCache !== 'object'
  ) {
    return null;
  }

  const bySeriesId = context.state.watchHistoryCache.bySeriesId;
  const bySeriesIdAudioLocale = context.state.watchHistoryCache.bySeriesIdAudioLocale;
  if (!bySeriesId || typeof bySeriesId !== 'object') {
    return null;
  }

  return getCachedWatchHistoryFromBuckets(
    context,
    bySeriesId,
    bySeriesIdAudioLocale,
    seriesId,
    audioLocale,
    allowSeriesFallback,
  );
}

export function getCachedWatchHistoryProgress(
  context: HistoryRepositoryCacheContext,
  seriesId: BoundaryValue,
  audioLocale: BoundaryValue = null,
  allowSeriesFallback = true,
): WatchHistoryEntry | null {
  if (
    typeof seriesId !== 'string' ||
    !seriesId ||
    !context.state.watchHistoryCache ||
    typeof context.state.watchHistoryCache !== 'object'
  ) {
    return null;
  }

  const bySeriesIdProgress = context.state.watchHistoryCache.bySeriesIdProgress;
  const bySeriesIdAudioLocaleProgress = context.state.watchHistoryCache.bySeriesIdAudioLocaleProgress;
  if (!bySeriesIdProgress || typeof bySeriesIdProgress !== 'object') {
    return null;
  }

  return getCachedWatchHistoryFromBuckets(
    context,
    bySeriesIdProgress,
    bySeriesIdAudioLocaleProgress,
    seriesId,
    audioLocale,
    allowSeriesFallback,
  );
}
