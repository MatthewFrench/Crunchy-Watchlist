type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;
type BoundaryValues = BoundaryValue[];

type CoverImages = {
  portrait?: string;
  landscape?: string;
  fallback?: string;
};

type NormalizedEntry = {
  source: 'api';
  seriesId: string;
  panelId: string | null;
  canonicalEpisodeKey: string;
  title: string;
  href: string;
  episodeHref: string;
  imageUrl: string;
  portraitImageUrl: string;
  landscapeImageUrl: string;
  hoverPreviewImageUrl: string;
  streamsLink: string;
  description: string;
  dateAddedMs: number | null;
  lastWatchedMs: number | null;
  dateUpdatedMs: number | null;
  episodeCount: number | null;
  seasonCount: number | null;
  genreTags: string[];
  statusText: string;
  statusBase: string;
  nextEpisodeLabel: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteEpisodeNumber: number | null;
  episodeDurationMs: number | null;
  playheadMs: number;
  fullyWatched: boolean;
  neverWatched: boolean;
  isFavorite: boolean;
  audioLocales: string[];
  knownEpisodeMaxByAudioLocale: Record<string, number>;
  hasEnglishAudio: boolean;
  watchReadyBase: boolean;
  originalIndex: number;
  fixtureTitle: null;
};

type ApiRowDto = {
  row: BoundaryRecord;
  panel: BoundaryRecord;
  meta: BoundaryRecord;
  seriesId: string;
  knownEpisodeMaxByAudioLocale: Record<string, number>;
  originalIndex: number;
};

type EntryNormalizerContext = {
  sanitizePositiveInt: (value: BoundaryValue) => number | null;
  getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: BoundaryRecord) => number | null;
  deriveCanonicalEpisodeKeyFromEpisodeMetadata: (meta: BoundaryRecord, seriesId: string) => string;
  formatEpisodeIdentifier: (seasonNumber: number | null, episodeNumber: number | null) => string;
  hasEnUsAudio: (audioLocales: string[]) => boolean;
  extractCoverImagesFromApiImages: (images: BoundaryValue) => CoverImages;
  extractThumbnailImageFromApiImages: (images: BoundaryValue) => string;
  pickFirstDateMs: (candidates: BoundaryValues) => number | null;
  getWatchlistSeriesId: (row: BoundaryRecord) => string;
  getEpisodeAvailabilityByAudioLocale: (meta: BoundaryRecord) => Record<string, number>;
  mergeEpisodeAvailabilityByAudioLocale: (
    existing: Record<string, number>,
    next: Record<string, number>,
  ) => Record<string, number>;
  normalizeAudioLocales: (audioLocales: BoundaryValues) => string[];
};

type EntryNormalizerDeps = Partial<EntryNormalizerContext>;

function requireFunction<T>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing domain dependency: ${name}`);
  }
  return value as T;
}

function toRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as BoundaryRecord;
}

function toRows(rows: BoundaryValue): BoundaryRecord[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.filter((row): row is BoundaryRecord => !!row && typeof row === 'object');
}

function getPanel(row: BoundaryRecord): BoundaryRecord {
  return toRecord(row.panel);
}

function getMeta(row: BoundaryRecord): BoundaryRecord {
  return toRecord(getPanel(row).episode_metadata);
}

function toApiRowDto(context: EntryNormalizerContext, row: BoundaryRecord, index: number): ApiRowDto | null {
  const seriesId = context.getWatchlistSeriesId(row);
  if (!seriesId) {
    return null;
  }

  const panel = getPanel(row);
  const meta = toRecord(panel.episode_metadata);
  return {
    row,
    panel,
    meta,
    seriesId,
    knownEpisodeMaxByAudioLocale: context.getEpisodeAvailabilityByAudioLocale(meta),
    originalIndex: index,
  };
}

function getTrimmedString(value: BoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function createEntryNormalizerContext(deps: EntryNormalizerDeps = {}): EntryNormalizerContext {
  return {
    sanitizePositiveInt: requireFunction<EntryNormalizerContext['sanitizePositiveInt']>(
      'sanitizePositiveInt',
      deps.sanitizePositiveInt,
    ),
    getAbsoluteEpisodeNumberFromEpisodeMetadata: requireFunction<
      EntryNormalizerContext['getAbsoluteEpisodeNumberFromEpisodeMetadata']
    >('getAbsoluteEpisodeNumberFromEpisodeMetadata', deps.getAbsoluteEpisodeNumberFromEpisodeMetadata),
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: requireFunction<
      EntryNormalizerContext['deriveCanonicalEpisodeKeyFromEpisodeMetadata']
    >('deriveCanonicalEpisodeKeyFromEpisodeMetadata', deps.deriveCanonicalEpisodeKeyFromEpisodeMetadata),
    formatEpisodeIdentifier: requireFunction<EntryNormalizerContext['formatEpisodeIdentifier']>(
      'formatEpisodeIdentifier',
      deps.formatEpisodeIdentifier,
    ),
    hasEnUsAudio: requireFunction<EntryNormalizerContext['hasEnUsAudio']>('hasEnUsAudio', deps.hasEnUsAudio),
    extractCoverImagesFromApiImages: requireFunction<EntryNormalizerContext['extractCoverImagesFromApiImages']>(
      'extractCoverImagesFromApiImages',
      deps.extractCoverImagesFromApiImages,
    ),
    extractThumbnailImageFromApiImages: requireFunction<EntryNormalizerContext['extractThumbnailImageFromApiImages']>(
      'extractThumbnailImageFromApiImages',
      deps.extractThumbnailImageFromApiImages,
    ),
    pickFirstDateMs: requireFunction<EntryNormalizerContext['pickFirstDateMs']>(
      'pickFirstDateMs',
      deps.pickFirstDateMs,
    ),
    getWatchlistSeriesId: requireFunction<EntryNormalizerContext['getWatchlistSeriesId']>(
      'getWatchlistSeriesId',
      deps.getWatchlistSeriesId,
    ),
    getEpisodeAvailabilityByAudioLocale: requireFunction<EntryNormalizerContext['getEpisodeAvailabilityByAudioLocale']>(
      'getEpisodeAvailabilityByAudioLocale',
      deps.getEpisodeAvailabilityByAudioLocale,
    ),
    mergeEpisodeAvailabilityByAudioLocale: requireFunction<
      EntryNormalizerContext['mergeEpisodeAvailabilityByAudioLocale']
    >('mergeEpisodeAvailabilityByAudioLocale', deps.mergeEpisodeAvailabilityByAudioLocale),
    normalizeAudioLocales: requireFunction<EntryNormalizerContext['normalizeAudioLocales']>(
      'normalizeAudioLocales',
      deps.normalizeAudioLocales,
    ),
  };
}

function deriveStatusBaseFromApi(row: BoundaryRecord, meta: BoundaryRecord): string {
  if (meta.availability_status && meta.availability_status !== 'available') {
    return 'Unavailable';
  }

  if (row.fully_watched) {
    return 'Watch Again';
  }

  if (row.never_watched) {
    return 'Start Watching';
  }

  if (Number(row.playhead || 0) > 0) {
    return 'Continue';
  }

  if (row.new) {
    return 'Up Next';
  }

  return 'Up Next';
}

function deriveAudioLocalesFromApi(context: EntryNormalizerContext, meta: BoundaryRecord): string[] {
  const locales: BoundaryValues = [];

  if (meta.audio_locale) {
    locales.push(meta.audio_locale);
  }

  if (Array.isArray(meta.audio_locales)) {
    locales.push(...meta.audio_locales);
  }

  return context.normalizeAudioLocales(locales);
}

function parseWatchReadyBoolean(value: BoundaryValue): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '') {
      return null;
    }
    if (['true', '1', 'yes', 'on', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off', 'n'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function resolveWatchReadyFromApi(row: BoundaryRecord): boolean | null {
  const meta = getMeta(row);
  const candidates: Array<{ value: BoundaryValue; watchReadyMeaning: boolean }> = [
    { value: row.non_actionable, watchReadyMeaning: false },
    { value: row.nonActionable, watchReadyMeaning: false },
    { value: row.is_non_actionable, watchReadyMeaning: false },
    { value: row.isNonActionable, watchReadyMeaning: false },
    { value: row.watch_ready, watchReadyMeaning: true },
    { value: row.watchReady, watchReadyMeaning: true },
    { value: row.actionable, watchReadyMeaning: true },
    { value: row.is_actionable, watchReadyMeaning: true },
    { value: row.isActionable, watchReadyMeaning: true },
    { value: row.watchable, watchReadyMeaning: true },
    { value: row.is_watchable, watchReadyMeaning: true },
    { value: meta.non_actionable, watchReadyMeaning: false },
    { value: meta.nonActionable, watchReadyMeaning: false },
    { value: meta.is_non_actionable, watchReadyMeaning: false },
    { value: meta.isNonActionable, watchReadyMeaning: false },
    { value: meta.watch_ready, watchReadyMeaning: true },
    { value: meta.watchReady, watchReadyMeaning: true },
    { value: meta.actionable, watchReadyMeaning: true },
    { value: meta.is_actionable, watchReadyMeaning: true },
    { value: meta.isActionable, watchReadyMeaning: true },
    { value: meta.watchable, watchReadyMeaning: true },
    { value: meta.is_watchable, watchReadyMeaning: true },
  ];

  for (const candidate of candidates) {
    const parsed = parseWatchReadyBoolean(candidate.value);
    if (parsed === null) {
      continue;
    }
    return candidate.watchReadyMeaning ? parsed : !parsed;
  }

  return null;
}

function deriveBaseWatchReady(
  row: BoundaryRecord,
  statusBase: string,
  availabilityStatus: BoundaryValue,
  fullyWatched: boolean,
): boolean {
  const explicitWatchReady = resolveWatchReadyFromApi(row);
  if (explicitWatchReady !== null) {
    return explicitWatchReady;
  }

  if (/watch again|rewatch|coming soon|unavailable/i.test(statusBase || '')) {
    return false;
  }
  if (availabilityStatus && availabilityStatus !== 'available') {
    return false;
  }
  if (fullyWatched) {
    return false;
  }
  return true;
}

function buildWatchlistHref(meta: BoundaryRecord, seriesId: string): string {
  const slug = getTrimmedString(meta.series_slug_title);
  return slug ? `/series/${seriesId}/${slug}` : `/series/${seriesId}`;
}

function buildEpisodeHrefFromPanel(panel: BoundaryRecord, meta: BoundaryRecord): string {
  const directHrefCandidates = [
    panel.href,
    panel.link,
    panel.url,
    panel.watch_href,
    panel.watchHref,
    meta.href,
    meta.link,
    meta.url,
    meta.watch_href,
    meta.watchHref,
  ]
    .map((value) => getTrimmedString(value))
    .filter(Boolean);

  if (directHrefCandidates.length > 0) {
    return directHrefCandidates[0] || '';
  }

  const panelId = getTrimmedString(panel.id);
  if (!panelId) {
    return '';
  }

  const episodeSlug = getTrimmedString(panel.slug_title);
  return episodeSlug ? `/watch/${panelId}/${episodeSlug}` : `/watch/${panelId}`;
}

function buildImageFields(context: EntryNormalizerContext, row: BoundaryRecord) {
  const panel = getPanel(row);
  const coverImages = context.extractCoverImagesFromApiImages(panel.images);
  const portraitImageUrl = typeof coverImages.portrait === 'string' ? coverImages.portrait : '';
  const landscapeImageUrl = typeof coverImages.landscape === 'string' ? coverImages.landscape : '';
  const fallback = typeof coverImages.fallback === 'string' ? coverImages.fallback : '';

  return {
    portraitImageUrl,
    landscapeImageUrl,
    imageUrl: portraitImageUrl || landscapeImageUrl || fallback,
    hoverPreviewImageUrl: context.extractThumbnailImageFromApiImages(panel.images),
  };
}

function buildTimestampFields(
  context: EntryNormalizerContext,
  row: BoundaryRecord,
): {
  dateAddedMs: number | null;
  lastWatchedMs: number | null;
  dateUpdatedMs: number | null;
} {
  const panel = getPanel(row);
  const panelMeta = getMeta(row);

  const dateAddedMs = context.pickFirstDateMs([
    row.date_added,
    row.added_at,
    row.created_at,
    row.created,
    row.createdAt,
    panel.date_added,
    panel.created_at,
    panelMeta.availability_starts,
  ]);
  const lastWatchedMs = context.pickFirstDateMs([
    row.last_watched,
    row.last_watched_at,
    row.watch_history_updated_at,
    row.playhead_updated_at,
    row.last_played_at,
    panel.last_watched,
    panelMeta.last_watched,
  ]);

  return {
    dateAddedMs,
    lastWatchedMs,
    dateUpdatedMs: context.pickFirstDateMs([
      lastWatchedMs,
      row.date_updated,
      row.updated_at,
      row.modified_at,
      row.last_modified_at,
      row.updatedAt,
      panel.updated_at,
      panel.last_modified_at,
      dateAddedMs,
    ]),
  };
}

function mergeNormalizedEntryAvailability(
  context: EntryNormalizerContext,
  existingEntry: NormalizedEntry,
  knownEpisodeMaxByAudioLocale: Record<string, number>,
): void {
  existingEntry.knownEpisodeMaxByAudioLocale = context.mergeEpisodeAvailabilityByAudioLocale(
    existingEntry.knownEpisodeMaxByAudioLocale,
    knownEpisodeMaxByAudioLocale,
  );
}

function buildNormalizedEntryFromApiRow(context: EntryNormalizerContext, rowDto: ApiRowDto): NormalizedEntry {
  const row = rowDto.row;
  const panel = rowDto.panel;
  const meta = rowDto.meta;
  const seriesId = rowDto.seriesId;
  const statusBase = deriveStatusBaseFromApi(row, meta);
  const seasonNumber = context.sanitizePositiveInt(meta.season_number);
  const episodeNumber = context.sanitizePositiveInt(meta.episode_number);
  const absoluteEpisodeNumber = context.getAbsoluteEpisodeNumberFromEpisodeMetadata(meta);
  const episodeDurationMs = context.sanitizePositiveInt(meta.duration_ms ?? meta.durationMs);
  const canonicalEpisodeKey = context.deriveCanonicalEpisodeKeyFromEpisodeMetadata(meta, seriesId);
  const nextEpisodeLabel = context.formatEpisodeIdentifier(seasonNumber, episodeNumber);
  const statusText = nextEpisodeLabel ? `${statusBase}: ${nextEpisodeLabel}` : statusBase;
  const audioLocales = deriveAudioLocalesFromApi(context, meta);
  const fullyWatched = Boolean(row.fully_watched);
  const neverWatched = Boolean(row.never_watched);
  const playheadMs = Number(row.playhead || 0) > 0 ? Number(row.playhead) : 0;
  const watchReadyBase = deriveBaseWatchReady(row, statusBase, meta.availability_status, fullyWatched);
  const title = getTrimmedString(meta.series_title) || getTrimmedString(panel.title) || seriesId;
  const description = getTrimmedString(panel.description);
  const timestampFields = buildTimestampFields(context, row);
  const imageFields = buildImageFields(context, row);

  return {
    source: 'api',
    seriesId,
    panelId: typeof panel.id === 'string' ? panel.id : null,
    canonicalEpisodeKey,
    title,
    href: buildWatchlistHref(meta, seriesId),
    episodeHref: buildEpisodeHrefFromPanel(panel, meta),
    imageUrl: imageFields.imageUrl,
    portraitImageUrl: imageFields.portraitImageUrl,
    landscapeImageUrl: imageFields.landscapeImageUrl,
    hoverPreviewImageUrl: imageFields.hoverPreviewImageUrl,
    streamsLink:
      typeof panel.streams_link === 'string'
        ? panel.streams_link
        : typeof meta.streams_link === 'string'
          ? meta.streams_link
          : '',
    description,
    dateAddedMs: timestampFields.dateAddedMs,
    lastWatchedMs: timestampFields.lastWatchedMs,
    dateUpdatedMs: timestampFields.dateUpdatedMs,
    episodeCount: null,
    seasonCount: null,
    genreTags: [],
    statusText,
    statusBase,
    nextEpisodeLabel,
    seasonNumber,
    episodeNumber,
    absoluteEpisodeNumber,
    episodeDurationMs,
    playheadMs,
    fullyWatched,
    neverWatched,
    isFavorite: Boolean(row.is_favorite),
    audioLocales,
    knownEpisodeMaxByAudioLocale: rowDto.knownEpisodeMaxByAudioLocale,
    hasEnglishAudio: context.hasEnUsAudio(audioLocales),
    watchReadyBase,
    originalIndex: rowDto.originalIndex,
    fixtureTitle: null,
  };
}

function normalizeEntriesFromApiRowsInternal(context: EntryNormalizerContext, rows: BoundaryValue): NormalizedEntry[] {
  const dedup = new Map<string, NormalizedEntry>();
  const inputRows = toRows(rows);

  inputRows.forEach((row, index) => {
    const rowDto = toApiRowDto(context, row, index);
    if (!rowDto) {
      return;
    }

    const existing = dedup.get(rowDto.seriesId);
    if (existing) {
      mergeNormalizedEntryAvailability(context, existing, rowDto.knownEpisodeMaxByAudioLocale);
      return;
    }

    dedup.set(rowDto.seriesId, buildNormalizedEntryFromApiRow(context, rowDto));
  });

  return Array.from(dedup.values());
}

function createEntryNormalizer(deps: EntryNormalizerDeps = {}) {
  const context = createEntryNormalizerContext(deps);
  return {
    normalizeEntriesFromApiRows: (rows: BoundaryValue) => normalizeEntriesFromApiRowsInternal(context, rows),
  };
}

const entryNormalizerRuntime = {
  createEntryNormalizer,
};

export function createEntryNormalizerRuntime(): {
  createEntryNormalizer: (deps?: EntryNormalizerDeps) => {
    normalizeEntriesFromApiRows: (rows: BoundaryValue) => NormalizedEntry[];
  };
} {
  return entryNormalizerRuntime;
}
