import {
  type CoverImageResult,
  createEpisodePrimitivesRuntime,
  createRatingPrimitivesRuntime,
} from './CorePrimitivesRuntimeFactories.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;
type ExtractCoverImagesFn = (images: BoundaryValue) => CoverImageResult;

type CorePrimitivesDeps = {
  extractCoverImagesFromApiImages?: ExtractCoverImagesFn;
};

type CountType = 'season' | 'episode';

function requireFunction<T>(name: string, value: T | undefined): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing primitive dependency: ${name}`);
  }
  return value;
}

function asRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as BoundaryRecord;
}

function sanitizeRating(value: BoundaryValue): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 5) {
    return null;
  }
  return Math.round(number * 10) / 10;
}

function sanitizeVotes(value: BoundaryValue): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return null;
  }
  return Math.round(number);
}

function sanitizePositiveInt(value: BoundaryValue): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number);
}

function parseDateMs(value: BoundaryValue): number | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) {
      return Math.round(value);
    }
    if (value > 1e9) {
      return Math.round(value * 1000);
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return parseDateMs(numeric);
    }

    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function pickFirstDateMs(values: BoundaryValue[]): number | null {
  for (const value of values) {
    const parsed = parseDateMs(value);
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
}

function pickFirstPositiveInt(values: BoundaryValue[]): number | null {
  for (const value of values) {
    const parsed = sanitizePositiveInt(value);
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
}

function sanitizePercentage(value: BoundaryValue): number | null {
  if (value == null) {
    return null;
  }

  const normalized = typeof value === 'string' ? value.replace('%', '').trim() : value;
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    return null;
  }

  return Math.round(number);
}

function normalizeAudioLocales(locales: BoundaryValue): string[] {
  if (!Array.isArray(locales)) {
    return [];
  }

  const dedup = new Set<string>();
  const normalized: string[] = [];

  for (const locale of locales) {
    const value = String(locale || '').trim();
    if (!value) {
      continue;
    }

    const key = value.toLowerCase();
    if (dedup.has(key)) {
      continue;
    }

    dedup.add(key);
    normalized.push(value);
  }

  return normalized;
}

function normalizeAudioLocale(locale: BoundaryValue): string | null {
  const normalized = normalizeAudioLocales([locale]);
  return normalized.length ? (normalized[0] ?? null) : null;
}

function normalizeTagList(values: BoundaryValue): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const text = String(value || '').trim();
    if (!text) {
      continue;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(text);
  }

  return normalized;
}

function hasEnUsAudio(locales: BoundaryValue): boolean {
  return normalizeAudioLocales(locales).some((locale) => locale.toLowerCase() === 'en-us');
}

function formatEpisodeIdentifier(seasonNumber: BoundaryValue, episodeNumber: BoundaryValue): string | null {
  const season = sanitizePositiveInt(seasonNumber);
  const episode = sanitizePositiveInt(episodeNumber);

  if (season != null && episode != null) {
    return `S${season} E${episode}`;
  }

  if (episode != null) {
    return `E${episode}`;
  }

  return null;
}

function normalizeAudioLocaleCountMap(value: BoundaryValue): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalizedMap: Record<string, number> = {};
  const entries = Object.entries(value as BoundaryRecord);
  for (const [localeKey, countValue] of entries) {
    const locale = normalizeAudioLocale(localeKey);
    const count = sanitizePositiveInt(countValue);
    if (!locale || count == null) {
      continue;
    }

    normalizedMap[locale.toLowerCase()] = count;
  }

  return normalizedMap;
}

function mergeAudioLocaleCountMap(
  previousMap: BoundaryValue,
  audioLocale: BoundaryValue,
  count: BoundaryValue,
): Record<string, number> {
  const merged = { ...normalizeAudioLocaleCountMap(previousMap) };
  const locale = normalizeAudioLocale(audioLocale);
  const normalizedCount = sanitizePositiveInt(count);

  if (locale && normalizedCount != null) {
    merged[locale.toLowerCase()] = normalizedCount;
  }

  return merged;
}

function getAudioLocaleCountFromMap(map: BoundaryValue, audioLocale: BoundaryValue): number | null {
  const locale = normalizeAudioLocale(audioLocale);
  if (!locale) {
    return null;
  }

  const normalizedMap = normalizeAudioLocaleCountMap(map);
  return sanitizePositiveInt(normalizedMap[locale.toLowerCase()]);
}

function chunkArray(values: BoundaryValue, chunkSize: BoundaryValue): BoundaryValue[][] {
  if (!Array.isArray(values) || !values.length || Number(chunkSize) <= 0) {
    return [];
  }

  const normalizedSize = Math.max(1, Math.round(Number(chunkSize)));
  const chunks: BoundaryValue[][] = [];
  for (let index = 0; index < values.length; index += normalizedSize) {
    chunks.push(values.slice(index, index + normalizedSize));
  }
  return chunks;
}

function getWatchlistSeriesId(entry: BoundaryValue): string | null {
  const row = asRecord(entry);
  const panel = asRecord(row.panel);
  const episodeMetadata = asRecord(panel.episode_metadata);
  const seriesMetadata = asRecord(panel.series_metadata);
  const seriesId = episodeMetadata.series_id ?? seriesMetadata.series_id;
  return typeof seriesId === 'string' && seriesId ? seriesId : null;
}

function getWatchHistorySeriesId(entry: BoundaryValue): string | null {
  return getWatchlistSeriesId(entry);
}

function getWatchlistSeriesTitle(entry: BoundaryValue): string {
  const row = asRecord(entry);
  const panel = asRecord(row.panel);
  const episodeMetadata = asRecord(panel.episode_metadata);
  const seriesMetadata = asRecord(panel.series_metadata);
  const title = episodeMetadata.series_title ?? seriesMetadata.title ?? panel.title;
  return typeof title === 'string' ? title : '';
}

function getWatchHistorySeriesTitle(entry: BoundaryValue): string {
  return getWatchlistSeriesTitle(entry);
}

function createEmptyRatingResult(preferredAudioLocale: BoundaryValue = ''): BoundaryRecord {
  const result: BoundaryRecord = {
    rating: null,
    votes: null,
    distribution: null,
    description: '',
    audioLocales: [],
    episodeCount: null,
    seasonCount: null,
    genreTags: [],
  };

  if (typeof preferredAudioLocale === 'string' && preferredAudioLocale) {
    result.preferredAudioLocale = preferredAudioLocale;
  }

  return result;
}

function hasInProgressPlayback(entry: BoundaryValue, watchHistoryEntry: BoundaryValue): boolean {
  const seriesEntry = asRecord(entry);
  const historyEntry = asRecord(watchHistoryEntry);

  const hasEntryProgress = Number(seriesEntry.playheadMs || 0) > 0 && !seriesEntry.fullyWatched;
  if (hasEntryProgress) {
    return true;
  }

  return Number(historyEntry.playhead || 0) > 0 && !historyEntry.fullyWatched;
}

function deriveDisplayStatusBase(entry: BoundaryValue, watchHistoryEntry: BoundaryValue): string {
  const seriesEntry = asRecord(entry);
  const statusBase = typeof seriesEntry.statusBase === 'string' ? seriesEntry.statusBase.trim() : '';
  const fallbackStatus = statusBase || 'Up Next';
  const normalizedFallback = fallbackStatus.toLowerCase();

  if (normalizedFallback.includes('unavailable') || normalizedFallback.includes('coming soon')) {
    return fallbackStatus;
  }

  if (
    Boolean(seriesEntry.fullyWatched) ||
    normalizedFallback.includes('watch again') ||
    normalizedFallback.includes('rewatch')
  ) {
    return 'Watch Again';
  }

  if (hasInProgressPlayback(seriesEntry, watchHistoryEntry)) {
    return 'Continue';
  }

  if (Boolean(seriesEntry.neverWatched) || normalizedFallback.includes('start watching')) {
    return 'Start Watching';
  }

  return normalizedFallback.includes('up next') ? 'Up Next' : fallbackStatus;
}

function getLocalizedSeriesCount(
  ratingEntry: BoundaryValue,
  audioLocale: BoundaryValue,
  countType: CountType,
): number | null {
  const fallbackFieldName = countType === 'season' ? 'seasonCount' : 'episodeCount';
  const mapFieldName = countType === 'season' ? 'seasonCountByAudioLocale' : 'episodeCountByAudioLocale';
  const entry = asRecord(ratingEntry);
  const localizedCount = getAudioLocaleCountFromMap(entry[mapFieldName], audioLocale);
  if (localizedCount != null) {
    return localizedCount;
  }

  return sanitizePositiveInt(entry[fallbackFieldName]);
}

function createCorePrimitives(deps: CorePrimitivesDeps = {}) {
  const extractCoverImagesFromApiImages = requireFunction<ExtractCoverImagesFn>(
    'extractCoverImagesFromApiImages',
    deps.extractCoverImagesFromApiImages,
  );
  const episodePrimitives = createEpisodePrimitivesRuntime({
    sanitizePositiveInt,
    pickFirstPositiveInt,
    normalizeAudioLocale,
    normalizeAudioLocaleCountMap,
  });
  const ratingPrimitives = createRatingPrimitivesRuntime({
    sanitizeRating,
    sanitizeVotes,
    sanitizePositiveInt,
    sanitizePercentage,
    normalizeAudioLocales,
    normalizeTagList,
    extractCoverImagesFromApiImages,
  });
  return {
    sanitizeRating,
    sanitizeVotes,
    sanitizePositiveInt,
    parseDateMs,
    pickFirstDateMs,
    pickFirstPositiveInt,
    sanitizePercentage,
    normalizeAudioLocales,
    normalizeAudioLocale,
    normalizeTagList,
    hasEnUsAudio,
    formatEpisodeIdentifier,
    parseRatingPayload: (payload: BoundaryRecord | null | undefined) => ratingPrimitives.parseRatingPayload(payload),
    parseRatingDistribution: (ratingBlock: BoundaryValue) => ratingPrimitives.parseRatingDistribution(ratingBlock),
    parseCmsObjectRecord: (record: BoundaryValue) => ratingPrimitives.parseCmsObjectRecord(record),
    normalizeAudioLocaleCountMap,
    mergeAudioLocaleCountMap,
    getAudioLocaleCountFromMap,
    extractSeasonCoreFromSeasonId: (value: BoundaryValue) => episodePrimitives.extractSeasonCoreFromSeasonId(value),
    parseCanonicalEpisodeIdentifier: (value: BoundaryValue) => episodePrimitives.parseCanonicalEpisodeIdentifier(value),
    buildCanonicalEpisodeKey: (seriesId: BoundaryValue, seasonCore: BoundaryValue, episodeNumber: BoundaryValue) =>
      episodePrimitives.buildCanonicalEpisodeKey(seriesId, seasonCore, episodeNumber),
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: (meta: BoundaryValue, fallbackSeriesId: BoundaryValue = null) =>
      episodePrimitives.deriveCanonicalEpisodeKeyFromEpisodeMetadata(meta, fallbackSeriesId),
    getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: BoundaryValue) =>
      episodePrimitives.getAbsoluteEpisodeNumberFromEpisodeMetadata(meta),
    getEpisodeAvailabilityByAudioLocale: (meta: BoundaryValue) =>
      episodePrimitives.getEpisodeAvailabilityByAudioLocale(meta),
    mergeEpisodeAvailabilityByAudioLocale: (previousMap: BoundaryValue, nextMap: BoundaryValue) =>
      episodePrimitives.mergeEpisodeAvailabilityByAudioLocale(previousMap, nextMap),
    chunkArray,
    getWatchlistSeriesId,
    getWatchHistorySeriesId,
    getWatchlistSeriesTitle,
    getWatchHistorySeriesTitle,
    createEmptyRatingResult,
    hasInProgressPlayback,
    deriveDisplayStatusBase,
    getLocalizedSeriesCount,
  };
}

type CorePrimitivesRuntime = ReturnType<typeof createCorePrimitives>;
type CorePrimitivesModule = {
  createCorePrimitives: (deps?: CorePrimitivesDeps) => CorePrimitivesRuntime;
};

const corePrimitivesRuntime: CorePrimitivesModule = {
  createCorePrimitives,
};

export function createCorePrimitivesRuntime(): CorePrimitivesModule {
  return corePrimitivesRuntime;
}
