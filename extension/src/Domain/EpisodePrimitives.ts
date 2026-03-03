type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryValues = BoundaryValue[];

type CanonicalEpisodeIdentifier = {
  seriesId: string;
  seasonCore: number;
  episodeNumber: number;
  canonicalEpisodeKey: string;
};

type SanitizePositiveInt = (value: BoundaryValue) => number | null;
type PickFirstPositiveInt = (values: BoundaryValues) => number | null;
type NormalizeAudioLocale = (locale: BoundaryValue) => string | null;
type NormalizeAudioLocaleCountMap = (value: BoundaryValue) => Record<string, number>;

type EpisodePrimitivesDeps = Partial<{
  sanitizePositiveInt: SanitizePositiveInt;
  pickFirstPositiveInt: PickFirstPositiveInt;
  normalizeAudioLocale: NormalizeAudioLocale;
  normalizeAudioLocaleCountMap: NormalizeAudioLocaleCountMap;
}>;

type EpisodePrimitivesContext = {
  sanitizePositiveInt: SanitizePositiveInt;
  pickFirstPositiveInt: PickFirstPositiveInt;
  normalizeAudioLocale: NormalizeAudioLocale;
  normalizeAudioLocaleCountMap: NormalizeAudioLocaleCountMap;
};

function requireFunction<T>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing episode primitive dependency: ${name}`);
  }
  return value as T;
}

function toRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as BoundaryRecord;
}

function toEpisodePrimitivesDeps(value: BoundaryValue): EpisodePrimitivesDeps {
  const record = toRecord(value);
  const deps: EpisodePrimitivesDeps = {};
  if (typeof record.sanitizePositiveInt === 'function') {
    deps.sanitizePositiveInt = record.sanitizePositiveInt as SanitizePositiveInt;
  }
  if (typeof record.pickFirstPositiveInt === 'function') {
    deps.pickFirstPositiveInt = record.pickFirstPositiveInt as PickFirstPositiveInt;
  }
  if (typeof record.normalizeAudioLocale === 'function') {
    deps.normalizeAudioLocale = record.normalizeAudioLocale as NormalizeAudioLocale;
  }
  if (typeof record.normalizeAudioLocaleCountMap === 'function') {
    deps.normalizeAudioLocaleCountMap = record.normalizeAudioLocaleCountMap as NormalizeAudioLocaleCountMap;
  }
  return deps;
}

function toNonEmptyString(value: BoundaryValue): string {
  return typeof value === 'string' && value ? value : '';
}

function createEpisodePrimitivesContext(deps: EpisodePrimitivesDeps = {}): EpisodePrimitivesContext {
  return {
    sanitizePositiveInt: requireFunction<SanitizePositiveInt>('sanitizePositiveInt', deps.sanitizePositiveInt),
    pickFirstPositiveInt: requireFunction<PickFirstPositiveInt>('pickFirstPositiveInt', deps.pickFirstPositiveInt),
    normalizeAudioLocale: requireFunction<NormalizeAudioLocale>('normalizeAudioLocale', deps.normalizeAudioLocale),
    normalizeAudioLocaleCountMap: requireFunction<NormalizeAudioLocaleCountMap>(
      'normalizeAudioLocaleCountMap',
      deps.normalizeAudioLocaleCountMap,
    ),
  };
}

function extractSeasonCoreFromSeasonId(context: EpisodePrimitivesContext, value: BoundaryValue): number | null {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const seasonIdMatch = text.match(/^GS(\d+)(?:[A-Z]{4})?$/i);
  if (seasonIdMatch?.[1]) {
    return context.sanitizePositiveInt(seasonIdMatch[1]);
  }

  const compactMatch = text.match(/^S(\d+)$/i);
  if (compactMatch?.[1]) {
    return context.sanitizePositiveInt(compactMatch[1]);
  }

  return null;
}

function parseCanonicalEpisodeIdentifier(
  context: EpisodePrimitivesContext,
  value: BoundaryValue,
): CanonicalEpisodeIdentifier | null {
  if (value == null) {
    return null;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const match = text.match(/^([^|]+)\|S(\d+)\|E(\d+)$/i);
  if (!match) {
    return null;
  }

  const seriesId = String(match[1] || '').trim();
  const seasonCore = context.sanitizePositiveInt(match[2]);
  const episodeNumber = context.sanitizePositiveInt(match[3]);

  if (!seriesId || seasonCore == null || episodeNumber == null) {
    return null;
  }

  return {
    seriesId,
    seasonCore,
    episodeNumber,
    canonicalEpisodeKey: `${seriesId}|S${seasonCore}|E${episodeNumber}`,
  };
}

function buildCanonicalEpisodeKey(
  context: EpisodePrimitivesContext,
  seriesId: BoundaryValue,
  seasonCore: BoundaryValue,
  episodeNumber: BoundaryValue,
): string | null {
  const normalizedSeriesId = typeof seriesId === 'string' ? seriesId.trim() : '';
  const normalizedSeasonCore = context.sanitizePositiveInt(seasonCore);
  const normalizedEpisodeNumber = context.sanitizePositiveInt(episodeNumber);

  if (!normalizedSeriesId || normalizedSeasonCore == null || normalizedEpisodeNumber == null) {
    return null;
  }

  return `${normalizedSeriesId}|S${normalizedSeasonCore}|E${normalizedEpisodeNumber}`;
}

function deriveCanonicalEpisodeKeyFromEpisodeMetadata(
  context: EpisodePrimitivesContext,
  metadata: BoundaryRecord,
  fallbackSeriesIdText: string,
): string | null {
  // Prefer explicit canonical identifiers from the API payload, then fall back
  // to reconstructing a stable key from series/season/episode metadata fields.
  const parsedIdentifier = parseCanonicalEpisodeIdentifier(context, metadata.identifier);
  if (parsedIdentifier) {
    if (!fallbackSeriesIdText || parsedIdentifier.seriesId === fallbackSeriesIdText) {
      return parsedIdentifier.canonicalEpisodeKey;
    }
  }

  const seriesId = fallbackSeriesIdText
    ? fallbackSeriesIdText
    : typeof metadata.series_id === 'string'
      ? metadata.series_id
      : '';
  const seasonCore = context.pickFirstPositiveInt([
    extractSeasonCoreFromSeasonId(context, metadata.season_id),
    context.sanitizePositiveInt(metadata.season_number),
  ]);
  const episodeNumber = context.sanitizePositiveInt(metadata.episode_number);

  return buildCanonicalEpisodeKey(context, seriesId, seasonCore, episodeNumber);
}

function getAbsoluteEpisodeNumberFromEpisodeMetadata(
  context: EpisodePrimitivesContext,
  metadata: BoundaryRecord,
): number | null {
  // API payloads vary across endpoints/locales. Prefer explicit global fields
  // and avoid promoting season-local episode numbers to absolute indices.
  const seasonNumber = context.sanitizePositiveInt(metadata.season_number);
  const globalEpisodeNumber = context.pickFirstPositiveInt([
    context.sanitizePositiveInt(metadata.global_episode_number),
    context.sanitizePositiveInt(metadata.global_episode_num),
  ]);
  if (globalEpisodeNumber != null) {
    return globalEpisodeNumber;
  }

  const episodeNumber = context.sanitizePositiveInt(metadata.episode_number);
  const sequenceNumber = context.pickFirstPositiveInt([
    context.sanitizePositiveInt(metadata.sequence_number),
    context.sanitizePositiveInt(metadata.episode_sequence_number),
  ]);

  if (seasonNumber === 1) {
    return episodeNumber ?? sequenceNumber;
  }

  if (episodeNumber != null && sequenceNumber != null) {
    return sequenceNumber > episodeNumber ? sequenceNumber : null;
  }

  return episodeNumber == null ? sequenceNumber : null;
}

function getEpisodeAvailabilityByAudioLocale(
  context: EpisodePrimitivesContext,
  metadata: BoundaryRecord,
): Record<string, number> {
  const absoluteEpisodeNumber = getAbsoluteEpisodeNumberFromEpisodeMetadata(context, metadata);
  if (absoluteEpisodeNumber == null) {
    return {};
  }

  const byAudioLocale: Record<string, number> = {};
  const panelAudioLocale = context.normalizeAudioLocale(metadata.audio_locale);
  if (panelAudioLocale) {
    byAudioLocale[panelAudioLocale.toLowerCase()] = absoluteEpisodeNumber;
  }

  if (Array.isArray(metadata.versions)) {
    for (const version of metadata.versions) {
      const record = toRecord(version);
      const locale = context.normalizeAudioLocale(record.audio_locale);
      if (!locale) {
        continue;
      }

      const localeKey = locale.toLowerCase();
      const previous = context.sanitizePositiveInt(byAudioLocale[localeKey]) ?? 0;
      byAudioLocale[localeKey] = Math.max(previous, absoluteEpisodeNumber);
    }
  }

  return byAudioLocale;
}

function mergeEpisodeAvailabilityByAudioLocale(
  context: EpisodePrimitivesContext,
  previousMap: BoundaryValue,
  nextMap: BoundaryValue,
): Record<string, number> {
  const merged = { ...context.normalizeAudioLocaleCountMap(previousMap) };
  if (Array.isArray(nextMap)) {
    return merged;
  }
  const normalizedNextMap = toRecord(nextMap);
  if (!Object.keys(normalizedNextMap).length) {
    return merged;
  }

  const entries = Object.entries(normalizedNextMap);
  for (const [localeKey, value] of entries) {
    const locale = context.normalizeAudioLocale(localeKey);
    const absoluteEpisodeNumber = context.sanitizePositiveInt(value);
    if (!locale || absoluteEpisodeNumber == null) {
      continue;
    }

    const storageKey = locale.toLowerCase();
    const previous = context.sanitizePositiveInt(merged[storageKey]) ?? 0;
    merged[storageKey] = Math.max(previous, absoluteEpisodeNumber);
  }

  return merged;
}

type EpisodePrimitivesRuntime = {
  extractSeasonCoreFromSeasonId: (value: BoundaryValue) => number | null;
  parseCanonicalEpisodeIdentifier: (value: BoundaryValue) => CanonicalEpisodeIdentifier | null;
  buildCanonicalEpisodeKey: (
    seriesId: BoundaryValue,
    seasonCore: BoundaryValue,
    episodeNumber: BoundaryValue,
  ) => string | null;
  deriveCanonicalEpisodeKeyFromEpisodeMetadata: (
    meta: BoundaryValue,
    fallbackSeriesId?: BoundaryValue,
  ) => string | null;
  getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: BoundaryValue) => number | null;
  getEpisodeAvailabilityByAudioLocale: (meta: BoundaryValue) => Record<string, number>;
  mergeEpisodeAvailabilityByAudioLocale: (previousMap: BoundaryValue, nextMap: BoundaryValue) => Record<string, number>;
};

export function createEpisodePrimitives(deps: BoundaryValue = {}): EpisodePrimitivesRuntime {
  const context = createEpisodePrimitivesContext(toEpisodePrimitivesDeps(deps));
  return {
    extractSeasonCoreFromSeasonId: (value: BoundaryValue) => extractSeasonCoreFromSeasonId(context, value),
    parseCanonicalEpisodeIdentifier: (value: BoundaryValue) => parseCanonicalEpisodeIdentifier(context, value),
    buildCanonicalEpisodeKey: (seriesId: BoundaryValue, seasonCore: BoundaryValue, episodeNumber: BoundaryValue) =>
      buildCanonicalEpisodeKey(context, seriesId, seasonCore, episodeNumber),
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: (meta: BoundaryValue, fallbackSeriesId: BoundaryValue = null) =>
      deriveCanonicalEpisodeKeyFromEpisodeMetadata(context, toRecord(meta), toNonEmptyString(fallbackSeriesId)),
    getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: BoundaryValue) =>
      getAbsoluteEpisodeNumberFromEpisodeMetadata(context, toRecord(meta)),
    getEpisodeAvailabilityByAudioLocale: (meta: BoundaryValue) =>
      getEpisodeAvailabilityByAudioLocale(context, toRecord(meta)),
    mergeEpisodeAvailabilityByAudioLocale: (previousMap: BoundaryValue, nextMap: BoundaryValue) =>
      mergeEpisodeAvailabilityByAudioLocale(context, previousMap, nextMap),
  };
}

export function createEpisodePrimitivesRuntime(): {
  createEpisodePrimitives: (deps?: BoundaryValue) => EpisodePrimitivesRuntime;
} {
  return {
    createEpisodePrimitives,
  };
}
