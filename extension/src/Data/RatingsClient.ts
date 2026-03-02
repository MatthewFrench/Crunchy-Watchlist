type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;
type ApiObjectRecord = BoundaryRecord;
type ApiPayloadDataEnvelope = {
  rows: ApiObjectRecord[];
  total: number | null;
};

type TokenEntry = {
  accessToken?: string;
} & ApiObjectRecord;

type ParsedRatingRecord = {
  seriesId?: string;
  rating?: number | null;
  votes?: number | null;
  distribution?: BoundaryValue;
  description?: string;
  audioLocales?: string[];
  episodeCount?: number | null;
  seasonCount?: number | null;
  genreTags?: string[];
  portraitImageUrl?: string;
  landscapeImageUrl?: string;
};

type RatingResult = {
  rating: number | null;
  votes: number | null;
  distribution: BoundaryValue;
  description: string;
  audioLocales: string[];
  episodeCount: number | null;
  seasonCount: number | null;
  genreTags: string[];
  preferredAudioLocale?: string;
};

type FetchWithResilienceOptions = {
  label: string;
  bearerToken?: string;
  refreshBearerToken?: BoundaryValue;
  maxAttempts?: number;
};

type RatingsClientDependencyContract = {
  fetchWithResilience: (
    url: string,
    requestInit: RequestInit,
    options: FetchWithResilienceOptions,
  ) => Promise<Response>;
  getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null>;
  createAuthRefreshHandler: (tokenEntry: TokenEntry | null) => BoundaryValue;
  resolveApiHref: (pathWithQuery: string) => string;
  normalizeAudioLocale: (value: BoundaryValue) => string;
  getPreferredAudioLanguage: () => string;
  getLocale: () => string;
  parsePayloadDataEnvelope: (endpoint: string, payload: BoundaryValue) => ApiPayloadDataEnvelope;
  auditCmsObjectContract: (rows: ApiObjectRecord[]) => void;
  parseCmsObjectRecord: (row: ApiObjectRecord) => ParsedRatingRecord | null;
  parseRatingPayload: (payload: BoundaryValue) => { rating: number | null; votes: number | null };
  sanitizeRating: (value: BoundaryValue) => number | null;
  sanitizeVotes: (value: BoundaryValue) => number | null;
  pushApiTrace: (endpoint: string, payload: BoundaryValue) => void;
};

type RatingsContext = RatingsClientDependencyContract;

type RatingsOptions = {
  [K in keyof RatingsClientDependencyContract]?: BoundaryValue;
};

function requireFunction<T>(name: string, value: BoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing ratings dependency: ${name}`);
  }
  return value as T;
}

function createEmptyRatingResult(preferredAudioLocale = ''): RatingResult {
  const result: RatingResult = {
    rating: null,
    votes: null,
    distribution: null,
    description: '',
    audioLocales: [],
    episodeCount: null,
    seasonCount: null,
    genreTags: [],
  };

  if (preferredAudioLocale) {
    result.preferredAudioLocale = preferredAudioLocale;
  }

  return result;
}

function createRatingResultFromCmsRecord(
  parsedRecord: ParsedRatingRecord | null,
  preferredAudioLocale: string,
): RatingResult {
  return {
    ...createEmptyRatingResult(preferredAudioLocale),
    rating: parsedRecord?.rating ?? null,
    votes: parsedRecord?.votes ?? null,
    distribution: parsedRecord?.distribution ?? null,
    description: parsedRecord?.description || '',
    audioLocales: Array.isArray(parsedRecord?.audioLocales) ? parsedRecord.audioLocales : [],
    episodeCount: parsedRecord?.episodeCount ?? null,
    seasonCount: parsedRecord?.seasonCount ?? null,
    genreTags: Array.isArray(parsedRecord?.genreTags) ? parsedRecord.genreTags : [],
  };
}

function findCmsRecordForSeries(records: ApiObjectRecord[], seriesId: string): ApiObjectRecord | null {
  if (!Array.isArray(records) || !records.length) {
    return null;
  }

  return (
    records.find((row) => {
      const recordId = row.id;
      return recordId === seriesId;
    }) ||
    records[0] ||
    null
  );
}

function createRatingsContext(options: RatingsOptions = {}): RatingsContext {
  const dependencies: RatingsClientDependencyContract = {
    fetchWithResilience: requireFunction<RatingsClientDependencyContract['fetchWithResilience']>(
      'fetchWithResilience',
      options.fetchWithResilience,
    ),
    getAccessToken: requireFunction<RatingsClientDependencyContract['getAccessToken']>(
      'getAccessToken',
      options.getAccessToken,
    ),
    createAuthRefreshHandler: requireFunction<RatingsClientDependencyContract['createAuthRefreshHandler']>(
      'createAuthRefreshHandler',
      options.createAuthRefreshHandler,
    ),
    resolveApiHref: requireFunction<RatingsClientDependencyContract['resolveApiHref']>(
      'resolveApiHref',
      options.resolveApiHref,
    ),
    normalizeAudioLocale: requireFunction<RatingsClientDependencyContract['normalizeAudioLocale']>(
      'normalizeAudioLocale',
      options.normalizeAudioLocale,
    ),
    getPreferredAudioLanguage: requireFunction<RatingsClientDependencyContract['getPreferredAudioLanguage']>(
      'getPreferredAudioLanguage',
      options.getPreferredAudioLanguage,
    ),
    getLocale: requireFunction<RatingsClientDependencyContract['getLocale']>('getLocale', options.getLocale),
    parsePayloadDataEnvelope: requireFunction<RatingsClientDependencyContract['parsePayloadDataEnvelope']>(
      'parsePayloadDataEnvelope',
      options.parsePayloadDataEnvelope,
    ),
    auditCmsObjectContract: requireFunction<RatingsClientDependencyContract['auditCmsObjectContract']>(
      'auditCmsObjectContract',
      options.auditCmsObjectContract,
    ),
    parseCmsObjectRecord: requireFunction<RatingsClientDependencyContract['parseCmsObjectRecord']>(
      'parseCmsObjectRecord',
      options.parseCmsObjectRecord,
    ),
    parseRatingPayload: requireFunction<RatingsClientDependencyContract['parseRatingPayload']>(
      'parseRatingPayload',
      options.parseRatingPayload,
    ),
    sanitizeRating: requireFunction<RatingsClientDependencyContract['sanitizeRating']>(
      'sanitizeRating',
      options.sanitizeRating,
    ),
    sanitizeVotes: requireFunction<RatingsClientDependencyContract['sanitizeVotes']>(
      'sanitizeVotes',
      options.sanitizeVotes,
    ),
    pushApiTrace:
      typeof options.pushApiTrace === 'function'
        ? (options.pushApiTrace as RatingsClientDependencyContract['pushApiTrace'])
        : () => {},
  };

  return dependencies;
}

function resolvePreferredAudioLanguage(context: RatingsContext, preferredAudioLanguage: BoundaryValue): string {
  const explicit = context.normalizeAudioLocale(preferredAudioLanguage);
  return explicit || context.getPreferredAudioLanguage();
}

function traceCmsResponse(
  context: RatingsContext,
  cmsUrl: string,
  mode: string,
  preferredAudioLanguage: string,
  seriesIds: string[],
  payloadEnvelope: ApiPayloadDataEnvelope,
): void {
  const total = payloadEnvelope.total ?? payloadEnvelope.rows.length;
  context.pushApiTrace('cmsObjects', {
    at: Date.now(),
    request: {
      url: cmsUrl,
      mode,
      preferred_audio_language: preferredAudioLanguage,
      seriesIds: Array.isArray(seriesIds) ? seriesIds.slice() : [],
    },
    response: {
      total,
      rowCount: payloadEnvelope.rows.length,
    },
    data: payloadEnvelope.rows,
  });
}

async function requestCmsRatings(
  context: RatingsContext,
  cmsUrl: string,
  tokenEntry: TokenEntry | null,
  label: string,
): Promise<{ payload: BoundaryValue; payloadEnvelope: ApiPayloadDataEnvelope }> {
  const requestOptions: FetchWithResilienceOptions = {
    label,
    refreshBearerToken: context.createAuthRefreshHandler(tokenEntry),
  };

  if (typeof tokenEntry?.accessToken === 'string') {
    requestOptions.bearerToken = tokenEntry.accessToken;
  }

  const response = await context.fetchWithResilience(
    cmsUrl,
    {
      credentials: 'include',
    },
    requestOptions,
  );

  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status}`);
  }

  const payload = await response.json();
  const payloadEnvelope = context.parsePayloadDataEnvelope('cms-objects', payload);
  context.auditCmsObjectContract(payloadEnvelope.rows);
  return {
    payload,
    payloadEnvelope,
  };
}

async function fetchRatingsBatchInternal(
  context: RatingsContext,
  tokenEntry: TokenEntry | null,
  seriesIds: BoundaryValue,
  preferredAudioLanguage: BoundaryValue = context.getPreferredAudioLanguage(),
): Promise<ParsedRatingRecord[]> {
  if (!Array.isArray(seriesIds) || !seriesIds.length) {
    return [];
  }

  const normalizedSeriesIds = seriesIds.filter(
    (seriesId): seriesId is string => typeof seriesId === 'string' && !!seriesId,
  );
  if (!normalizedSeriesIds.length) {
    return [];
  }

  const effectivePreferredAudioLanguage = resolvePreferredAudioLanguage(context, preferredAudioLanguage);
  const cmsUrl = context.resolveApiHref(
    `/content/v2/cms/objects/${normalizedSeriesIds.map((id) => encodeURIComponent(id)).join(',')}` +
      `?ratings=true&preferred_audio_language=${encodeURIComponent(effectivePreferredAudioLanguage)}` +
      `&locale=${encodeURIComponent(context.getLocale())}`,
  );

  const { payloadEnvelope } = await requestCmsRatings(context, cmsUrl, tokenEntry, 'rating batch request');
  traceCmsResponse(context, cmsUrl, 'batch', effectivePreferredAudioLanguage, normalizedSeriesIds, payloadEnvelope);

  return payloadEnvelope.rows
    .map((record) => context.parseCmsObjectRecord(record))
    .filter((record): record is ParsedRatingRecord => Boolean(record?.seriesId));
}

function parseCmsSingleRatingPayload(
  context: RatingsContext,
  seriesId: string,
  payload: BoundaryValue,
  records: ApiObjectRecord[],
  preferredAudioLocale: string,
): RatingResult {
  const record = findCmsRecordForSeries(records, seriesId);
  if (record) {
    const parsedRecord = context.parseCmsObjectRecord(record);
    if (parsedRecord) {
      return createRatingResultFromCmsRecord(parsedRecord, preferredAudioLocale);
    }
  }

  const fallback = context.parseRatingPayload(payload);
  return {
    ...createEmptyRatingResult(preferredAudioLocale),
    rating: fallback.rating,
    votes: fallback.votes,
  };
}

async function fetchRatingFromCmsObjectsInternal(
  context: RatingsContext,
  seriesId: string,
  preferredAudioLanguage: BoundaryValue = context.getPreferredAudioLanguage(),
): Promise<RatingResult> {
  const effectivePreferredAudioLanguage = resolvePreferredAudioLanguage(context, preferredAudioLanguage);
  const cmsUrl = context.resolveApiHref(
    `/content/v2/cms/objects/${encodeURIComponent(seriesId)}` +
      `?ratings=true&preferred_audio_language=${encodeURIComponent(effectivePreferredAudioLanguage)}` +
      `&locale=${encodeURIComponent(context.getLocale())}`,
  );

  const tokenEntry = await context.getAccessToken(false);
  if (!tokenEntry?.accessToken) {
    return createEmptyRatingResult(effectivePreferredAudioLanguage);
  }

  try {
    const { payload, payloadEnvelope } = await requestCmsRatings(context, cmsUrl, tokenEntry, 'cms ratings request');
    traceCmsResponse(context, cmsUrl, 'single', effectivePreferredAudioLanguage, [seriesId], payloadEnvelope);
    return parseCmsSingleRatingPayload(
      context,
      seriesId,
      payload,
      payloadEnvelope.rows,
      effectivePreferredAudioLanguage,
    );
  } catch (_) {
    return createEmptyRatingResult(effectivePreferredAudioLanguage);
  }
}

// Series pages can surface rating numerics in multiple serialization styles
// (plain decimal `4.8` or escaped decimal `4\.8` inside embedded script blobs).
// Normalize both forms so fallback rating parsing does not silently truncate.
function parseSeriesPageRatingPayload(
  context: RatingsContext,
  html: string,
): { rating: number | null; votes: number | null } {
  const ratingMatch =
    html.match(/"ratingValue"\s*:\s*"?([0-5](?:\\?\.\d+)?)"?/i) ||
    html.match(/"averageRating"\s*:\s*([0-5](?:\\?\.\d+)?)/i) ||
    html.match(/"average"\s*:\s*([0-5](?:\\?\.\d+)?)/i);

  const votesMatch =
    html.match(/"ratingCount"\s*:\s*"?(\d{1,10})"?/i) ||
    html.match(/"votes"\s*:\s*(\d{1,10})/i) ||
    html.match(/"count"\s*:\s*(\d{1,10})/i);

  const ratingValue = ratingMatch?.[1]?.replace('\\.', '.') || null;

  return {
    rating: ratingValue ? context.sanitizeRating(ratingValue) : null,
    votes: votesMatch ? context.sanitizeVotes(votesMatch[1]) : null,
  };
}

async function fetchRatingFromSeriesPageInternal(context: RatingsContext, seriesHref: string): Promise<RatingResult> {
  const seriesUrl = context.resolveApiHref(seriesHref);
  if (!seriesUrl) {
    throw new Error('series page url missing');
  }

  const response = await context.fetchWithResilience(
    seriesUrl,
    { credentials: 'include' },
    { label: 'series page fetch', maxAttempts: 2 },
  );
  if (!response.ok) {
    throw new Error(`series page fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const parsed = parseSeriesPageRatingPayload(context, html);

  return {
    ...createEmptyRatingResult(),
    rating: parsed.rating,
    votes: parsed.votes,
  };
}

async function fetchLegacyRatingInternal(context: RatingsContext, seriesId: string): Promise<RatingResult | null> {
  const ratingUrl = context.resolveApiHref(`/content-reviews/v3/rating/series/${encodeURIComponent(seriesId)}`);

  try {
    const response = await context.fetchWithResilience(
      ratingUrl,
      { credentials: 'include' },
      { label: 'legacy rating request', maxAttempts: 2 },
    );
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    context.pushApiTrace('legacyRating', {
      at: Date.now(),
      request: {
        url: ratingUrl,
        seriesId,
      },
      response: payload,
    });
    const parsed = context.parseRatingPayload(payload);
    if (parsed.rating == null) {
      return null;
    }

    return {
      ...createEmptyRatingResult(),
      rating: parsed.rating,
      votes: parsed.votes,
    };
  } catch (_) {
    return null;
  }
}

async function fetchRatingInternal(
  context: RatingsContext,
  seriesId: BoundaryValue,
  seriesHref: BoundaryValue,
  preferredAudioLanguage: BoundaryValue = context.getPreferredAudioLanguage(),
): Promise<RatingResult> {
  const normalizedSeriesId = typeof seriesId === 'string' ? seriesId : '';
  if (normalizedSeriesId) {
    try {
      const cmsRating = await fetchRatingFromCmsObjectsInternal(context, normalizedSeriesId, preferredAudioLanguage);
      if (cmsRating.rating != null) {
        return cmsRating;
      }
    } catch (_) {
      // no-op
    }

    const legacyRating = await fetchLegacyRatingInternal(context, normalizedSeriesId);
    if (legacyRating) {
      return legacyRating;
    }
  }

  if (typeof seriesHref !== 'string' || !seriesHref) {
    return createEmptyRatingResult();
  }

  try {
    return await fetchRatingFromSeriesPageInternal(context, seriesHref);
  } catch (_) {
    return createEmptyRatingResult();
  }
}

function createRatingsClient(options: RatingsOptions = {}) {
  const context = createRatingsContext(options);

  return {
    createEmptyRatingResult,
    fetchRating: (seriesId: BoundaryValue, seriesHref: BoundaryValue, preferredAudioLanguage: BoundaryValue) =>
      fetchRatingInternal(context, seriesId, seriesHref, preferredAudioLanguage),
    fetchRatingsBatch: (
      tokenEntry: TokenEntry | null,
      seriesIds: BoundaryValue,
      preferredAudioLanguage: BoundaryValue,
    ) => fetchRatingsBatchInternal(context, tokenEntry, seriesIds, preferredAudioLanguage),
  };
}

const ratingsClientRuntime = {
  createRatingsClient,
};

export function createRatingsClientRuntime(): object {
  return ratingsClientRuntime;
}
