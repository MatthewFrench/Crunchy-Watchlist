type BoundaryValue = CwBoundaryValue;

function requireFunction<T>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing watch history preload collector dependency: ${name}`);
  }

  return value as T;
}

function toPositiveInt(value: BoundaryValue, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : fallback;
}

type LooseRecord = {
  [key: string]: BoundaryValue;
  panel?: LooseRecord;
  episode_metadata?: LooseRecord;
  series_metadata?: LooseRecord;
};

type TokenEntry = {
  accessToken?: BoundaryValue;
  accountId?: BoundaryValue;
} & LooseRecord;

type WatchHistoryPageResult = {
  rows: LooseRecord[];
  totalRows: number | null;
};

type WatchHistoryEntry = {
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

type WatchHistoryLocaleMap = Record<string, WatchHistoryEntry>;

type HistoryUpdateBuckets = {
  remainingSeriesIds: Set<string>;
  seriesUpdates: Record<string, WatchHistoryEntry>;
  seriesProgressUpdates: Record<string, WatchHistoryEntry>;
  localeUpdates: Record<string, WatchHistoryLocaleMap>;
  localeProgressUpdates: Record<string, WatchHistoryLocaleMap>;
  pages: number;
  totalRows: number | null;
  fetchedRows: number;
  noMatchPageStreak: number;
  seenRowKeys: Set<string>;
};

type CollectWatchHistoryUpdateBucketsOptions = {
  tokenEntry: TokenEntry;
  effectivePreferredAudioLanguage: string;
  candidateSeriesIds: string[];
  isDefaultPreferredAudio: boolean;
  watchHistoryMaxPages: number;
  watchHistoryPageSize: number;
  watchHistoryNoMatchPageLimit: number;
  fetchWatchHistoryPage: (
    tokenEntry: TokenEntry,
    pageNumber: number,
    preferredAudioLanguage?: BoundaryValue,
  ) => Promise<WatchHistoryPageResult>;
  normalizeAudioLocale: (value: BoundaryValue) => string;
  sanitizePositiveInt: (value: BoundaryValue) => number | null;
  parseDateMs: (value: BoundaryValue) => number | null;
  deriveCanonicalEpisodeKeyFromEpisodeMetadata: (metadata: LooseRecord, seriesId?: BoundaryValue) => string;
  getAbsoluteEpisodeNumberFromEpisodeMetadata: (metadata: LooseRecord) => number | null;
  shouldReplaceWatchHistoryProgress: (
    previous: LooseRecord | null | undefined,
    next: LooseRecord | null | undefined,
  ) => boolean;
};

type CollectWatchHistoryUpdateBuckets = (
  options: CollectWatchHistoryUpdateBucketsOptions,
) => Promise<HistoryUpdateBuckets>;

function toRecord(value: BoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as LooseRecord;
}

function toTokenEntry(value: BoundaryValue): TokenEntry {
  return toRecord(value);
}

function toSeriesIds(values: BoundaryValue): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const deduped = new Set<string>();
  values.forEach((value) => {
    if (typeof value !== 'string') {
      return;
    }

    const trimmed = value.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  });

  return Array.from(deduped);
}

function toPageRows(value: BoundaryValue): LooseRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is LooseRecord => !!entry && typeof entry === 'object' && !Array.isArray(entry));
}

function toPageTotalRows(value: BoundaryValue): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

function toWatchHistoryPageResult(value: BoundaryValue): WatchHistoryPageResult {
  const record = toRecord(value);
  return {
    rows: toPageRows(record.rows),
    totalRows: toPageTotalRows(record.totalRows ?? record.total),
  };
}

function toCollectWatchHistoryUpdateBucketsOptions(value: BoundaryValue): CollectWatchHistoryUpdateBucketsOptions {
  const options = toRecord(value);
  const fetchWatchHistoryPageDependency = requireFunction<
    (tokenEntry: TokenEntry, pageNumber: number, preferredAudioLanguage?: BoundaryValue) => Promise<BoundaryValue>
  >('fetchWatchHistoryPage', options.fetchWatchHistoryPage);

  return {
    tokenEntry: toTokenEntry(options.tokenEntry),
    effectivePreferredAudioLanguage:
      typeof options.effectivePreferredAudioLanguage === 'string' ? options.effectivePreferredAudioLanguage : '',
    candidateSeriesIds: toSeriesIds(options.candidateSeriesIds),
    isDefaultPreferredAudio: Boolean(options.isDefaultPreferredAudio),
    watchHistoryMaxPages: toPositiveInt(options.watchHistoryMaxPages, 1),
    watchHistoryPageSize: toPositiveInt(options.watchHistoryPageSize, 1),
    watchHistoryNoMatchPageLimit: toPositiveInt(options.watchHistoryNoMatchPageLimit, 1),
    fetchWatchHistoryPage: async (
      tokenEntry: TokenEntry,
      pageNumber: number,
      preferredAudioLanguage?: BoundaryValue,
    ): Promise<WatchHistoryPageResult> =>
      toWatchHistoryPageResult(await fetchWatchHistoryPageDependency(tokenEntry, pageNumber, preferredAudioLanguage)),
    normalizeAudioLocale: requireFunction('normalizeAudioLocale', options.normalizeAudioLocale),
    sanitizePositiveInt: requireFunction('sanitizePositiveInt', options.sanitizePositiveInt),
    parseDateMs: requireFunction('parseDateMs', options.parseDateMs),
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: requireFunction(
      'deriveCanonicalEpisodeKeyFromEpisodeMetadata',
      options.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
    ),
    getAbsoluteEpisodeNumberFromEpisodeMetadata: requireFunction(
      'getAbsoluteEpisodeNumberFromEpisodeMetadata',
      options.getAbsoluteEpisodeNumberFromEpisodeMetadata,
    ),
    shouldReplaceWatchHistoryProgress: requireFunction(
      'shouldReplaceWatchHistoryProgress',
      options.shouldReplaceWatchHistoryProgress,
    ),
  };
}

function createWatchHistoryUpdateBuckets(candidateSeriesIds: string[]): HistoryUpdateBuckets {
  return {
    remainingSeriesIds: new Set<string>(candidateSeriesIds),
    seriesUpdates: {},
    seriesProgressUpdates: {},
    localeUpdates: {},
    localeProgressUpdates: {},
    pages: 0,
    totalRows: null,
    fetchedRows: 0,
    noMatchPageStreak: 0,
    seenRowKeys: new Set<string>(),
  };
}

function parseWatchHistoryRow(
  options: CollectWatchHistoryUpdateBucketsOptions,
  entry: LooseRecord | null | undefined,
  fallbackAudioLocale: BoundaryValue = null,
): WatchHistoryEntry | null {
  const panel = toRecord(entry?.panel);
  const episodeMetadata = toRecord(panel.episode_metadata);
  const seriesMetadata = toRecord(panel.series_metadata);
  const resolvedSeriesId = episodeMetadata.series_id || seriesMetadata.series_id;
  if (typeof resolvedSeriesId !== 'string' || !resolvedSeriesId) {
    return null;
  }
  const seriesId = resolvedSeriesId;

  const datePlayedMs = options.parseDateMs(entry?.date_played);
  if (datePlayedMs == null) {
    return null;
  }

  const seasonNumber = options.sanitizePositiveInt(episodeMetadata.season_number);
  const episodeNumber = options.sanitizePositiveInt(episodeMetadata.episode_number);
  const absoluteEpisodeNumber = options.getAbsoluteEpisodeNumberFromEpisodeMetadata(episodeMetadata);
  const episodeDurationMs = options.sanitizePositiveInt(episodeMetadata.duration_ms ?? episodeMetadata.durationMs);
  const explicitAudioLocale = options.normalizeAudioLocale(
    episodeMetadata.audio_locale || panel.audio_locale || entry?.audio_locale || entry?.audioLocale,
  );
  const audioLocale = explicitAudioLocale || options.normalizeAudioLocale(fallbackAudioLocale);
  const identifier = typeof episodeMetadata.identifier === 'string' ? episodeMetadata.identifier : '';
  const canonicalEpisodeKey = options.deriveCanonicalEpisodeKeyFromEpisodeMetadata(episodeMetadata, seriesId);
  const episodeId = typeof entry?.id === 'string' ? entry.id : typeof panel.id === 'string' ? panel.id : null;

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
    episodeTitle: typeof panel.title === 'string' ? panel.title : '',
    playhead: Number(entry?.playhead || 0),
    fullyWatched: Boolean(entry?.fully_watched),
    audioLocale,
    audioLocaleInferred: !explicitAudioLocale && Boolean(audioLocale),
  };
}

function mergeWatchHistoryParsedEntry(
  options: CollectWatchHistoryUpdateBucketsOptions,
  parsed: WatchHistoryEntry,
  buckets: HistoryUpdateBuckets,
): boolean {
  let matchedCandidate = false;

  if (options.isDefaultPreferredAudio) {
    const previous = buckets.seriesUpdates[parsed.seriesId];
    if (!previous || parsed.datePlayedMs > previous.datePlayedMs) {
      buckets.seriesUpdates[parsed.seriesId] = parsed;
    }

    const previousProgress = buckets.seriesProgressUpdates[parsed.seriesId];
    if (options.shouldReplaceWatchHistoryProgress(previousProgress, parsed)) {
      buckets.seriesProgressUpdates[parsed.seriesId] = parsed;
    }
  }

  const locale = options.normalizeAudioLocale(parsed.audioLocale);
  if (locale) {
    const localeStorageKey = locale.toLowerCase();
    const perSeriesLocaleMap: WatchHistoryLocaleMap = buckets.localeUpdates[parsed.seriesId] || {};
    const previousByLocale = perSeriesLocaleMap[localeStorageKey];
    if (!previousByLocale || parsed.datePlayedMs > previousByLocale.datePlayedMs) {
      perSeriesLocaleMap[localeStorageKey] = {
        ...parsed,
        audioLocale: locale,
      };
    }
    buckets.localeUpdates[parsed.seriesId] = perSeriesLocaleMap;

    const perSeriesLocaleProgressMap: WatchHistoryLocaleMap = buckets.localeProgressUpdates[parsed.seriesId] || {};
    const previousProgressByLocale = perSeriesLocaleProgressMap[localeStorageKey];
    if (options.shouldReplaceWatchHistoryProgress(previousProgressByLocale, parsed)) {
      perSeriesLocaleProgressMap[localeStorageKey] = {
        ...parsed,
        audioLocale: locale,
      };
    }
    buckets.localeProgressUpdates[parsed.seriesId] = perSeriesLocaleProgressMap;
  }

  if (buckets.remainingSeriesIds.has(parsed.seriesId)) {
    buckets.remainingSeriesIds.delete(parsed.seriesId);
    matchedCandidate = true;
  }

  return matchedCandidate;
}

const collectWatchHistoryUpdateBucketsInternal: CollectWatchHistoryUpdateBuckets = async (options) => {
  const buckets = createWatchHistoryUpdateBuckets(options.candidateSeriesIds);

  while (buckets.pages < options.watchHistoryMaxPages) {
    buckets.pages += 1;
    const page = await options.fetchWatchHistoryPage(
      options.tokenEntry,
      buckets.pages,
      options.effectivePreferredAudioLanguage,
    );
    let matchedOnPage = 0;

    if (buckets.totalRows == null) {
      buckets.totalRows = page.totalRows;
    }

    buckets.fetchedRows += page.rows.length;

    page.rows.forEach((row) => {
      const parsed = parseWatchHistoryRow(options, row, options.effectivePreferredAudioLanguage);
      if (!parsed || !parsed.seriesId || parsed.datePlayedMs == null) {
        return;
      }

      const rowKey =
        parsed.canonicalEpisodeKey ||
        parsed.episodeId ||
        `${parsed.seriesId}|${parsed.absoluteEpisodeNumber || ''}|${parsed.datePlayedMs}`;
      if (buckets.seenRowKeys.has(rowKey)) {
        return;
      }
      buckets.seenRowKeys.add(rowKey);

      if (mergeWatchHistoryParsedEntry(options, parsed, buckets)) {
        matchedOnPage += 1;
      }
    });

    if (matchedOnPage === 0 && buckets.remainingSeriesIds.size > 0) {
      buckets.noMatchPageStreak += 1;
    } else {
      buckets.noMatchPageStreak = 0;
    }

    if (!page.rows.length || page.rows.length < options.watchHistoryPageSize) {
      break;
    }

    if (buckets.totalRows != null && buckets.fetchedRows >= buckets.totalRows) {
      break;
    }

    if (!buckets.remainingSeriesIds.size) {
      break;
    }

    if (buckets.remainingSeriesIds.size && buckets.noMatchPageStreak >= options.watchHistoryNoMatchPageLimit) {
      break;
    }
  }

  return buckets;
};

export async function collectWatchHistoryUpdateBuckets(options: BoundaryValue): Promise<HistoryUpdateBuckets> {
  return collectWatchHistoryUpdateBucketsInternal(toCollectWatchHistoryUpdateBucketsOptions(options));
}
