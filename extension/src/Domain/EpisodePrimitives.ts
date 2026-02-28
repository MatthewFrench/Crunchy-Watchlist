(() => {
  type EpisodePrimitivesDeps = {
    sanitizePositiveInt?: unknown;
    pickFirstPositiveInt?: unknown;
    normalizeAudioLocale?: unknown;
    normalizeAudioLocaleCountMap?: unknown;
  };

  type EpisodePrimitivesContext = {
    sanitizePositiveInt: (value: unknown) => number | null;
    pickFirstPositiveInt: (values: unknown[]) => number | null;
    normalizeAudioLocale: (locale: unknown) => string | null;
    normalizeAudioLocaleCountMap: (value: unknown) => Record<string, number>;
  };

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing episode primitive dependency: ${name}`);
    }
    return value as T;
  }

  function createEpisodePrimitivesContext(deps: EpisodePrimitivesDeps = {}): EpisodePrimitivesContext {
    return {
      sanitizePositiveInt: requireFunction<(value: unknown) => number | null>(
        'sanitizePositiveInt',
        deps.sanitizePositiveInt,
      ),
      pickFirstPositiveInt: requireFunction<(values: unknown[]) => number | null>(
        'pickFirstPositiveInt',
        deps.pickFirstPositiveInt,
      ),
      normalizeAudioLocale: requireFunction<(locale: unknown) => string | null>(
        'normalizeAudioLocale',
        deps.normalizeAudioLocale,
      ),
      normalizeAudioLocaleCountMap: requireFunction<(value: unknown) => Record<string, number>>(
        'normalizeAudioLocaleCountMap',
        deps.normalizeAudioLocaleCountMap,
      ),
    };
  }

  function extractSeasonCoreFromSeasonId(context: EpisodePrimitivesContext, value: unknown): number | null {
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
    value: unknown,
  ): { seriesId: string; seasonCore: number; episodeNumber: number; canonicalEpisodeKey: string } | null {
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
    seriesId: unknown,
    seasonCore: unknown,
    episodeNumber: unknown,
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
    meta: unknown,
    fallbackSeriesId: unknown = null,
  ): string | null {
    // Prefer explicit canonical identifiers from the API payload, then fall back
    // to reconstructing a stable key from series/season/episode metadata fields.
    const metadata = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    const parsedIdentifier = parseCanonicalEpisodeIdentifier(context, metadata.identifier);
    if (parsedIdentifier) {
      if (!fallbackSeriesId || parsedIdentifier.seriesId === fallbackSeriesId) {
        return parsedIdentifier.canonicalEpisodeKey;
      }
    }

    const seriesId =
      typeof fallbackSeriesId === 'string' && fallbackSeriesId
        ? fallbackSeriesId
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
    meta: unknown,
  ): number | null {
    // API payloads vary across endpoints/locales; keep an ordered fallback chain
    // so progress and watch-ready calculations remain stable across contracts.
    const metadata = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
    const seasonNumber = context.sanitizePositiveInt(metadata.season_number);
    const episodeNumber = context.sanitizePositiveInt(metadata.episode_number);
    return context.pickFirstPositiveInt([
      context.sanitizePositiveInt(metadata.sequence_number),
      context.sanitizePositiveInt(metadata.episode_sequence_number),
      context.sanitizePositiveInt(metadata.global_episode_number),
      context.sanitizePositiveInt(metadata.global_episode_num),
      seasonNumber === 1 ? episodeNumber : null,
    ]);
  }

  function getEpisodeAvailabilityByAudioLocale(
    context: EpisodePrimitivesContext,
    meta: unknown,
  ): Record<string, number> {
    const metadata = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
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
        const record = version && typeof version === 'object' ? (version as Record<string, unknown>) : {};
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
    previousMap: unknown,
    nextMap: unknown,
  ): Record<string, number> {
    const merged = { ...context.normalizeAudioLocaleCountMap(previousMap) };
    if (!nextMap || typeof nextMap !== 'object' || Array.isArray(nextMap)) {
      return merged;
    }

    const entries = Object.entries(nextMap as Record<string, unknown>);
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

  function createEpisodePrimitives(deps: EpisodePrimitivesDeps = {}) {
    const context = createEpisodePrimitivesContext(deps);
    return {
      extractSeasonCoreFromSeasonId: (value: unknown) => extractSeasonCoreFromSeasonId(context, value),
      parseCanonicalEpisodeIdentifier: (value: unknown) => parseCanonicalEpisodeIdentifier(context, value),
      buildCanonicalEpisodeKey: (seriesId: unknown, seasonCore: unknown, episodeNumber: unknown) =>
        buildCanonicalEpisodeKey(context, seriesId, seasonCore, episodeNumber),
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: (meta: unknown, fallbackSeriesId: unknown = null) =>
        deriveCanonicalEpisodeKeyFromEpisodeMetadata(context, meta, fallbackSeriesId),
      getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: unknown) =>
        getAbsoluteEpisodeNumberFromEpisodeMetadata(context, meta),
      getEpisodeAvailabilityByAudioLocale: (meta: unknown) => getEpisodeAvailabilityByAudioLocale(context, meta),
      mergeEpisodeAvailabilityByAudioLocale: (previousMap: unknown, nextMap: unknown) =>
        mergeEpisodeAvailabilityByAudioLocale(context, previousMap, nextMap),
    };
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  let domainRegistry = moduleRegistry.domain;
  if (!domainRegistry || typeof domainRegistry !== 'object') {
    domainRegistry = {};
    moduleRegistry.domain = domainRegistry;
  }

  (domainRegistry as Record<string, unknown>).episodePrimitives = {
    createEpisodePrimitives,
  };
})();
