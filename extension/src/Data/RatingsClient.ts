(() => {
  type ApiObjectRecord = Record<string, unknown>;

  type TokenEntry = {
    accessToken?: string;
  } & ApiObjectRecord;

  type ParsedRatingRecord = {
    seriesId?: string;
    rating?: number | null;
    votes?: number | null;
    distribution?: unknown;
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
    distribution: unknown;
    description: string;
    audioLocales: string[];
    episodeCount: number | null;
    seasonCount: number | null;
    genreTags: string[];
    preferredAudioLocale?: string;
  };

  type RatingsContext = {
    fetchWithResilience: (
      url: string,
      requestInit: RequestInit,
      options: {
        label: string;
        bearerToken?: string;
        refreshBearerToken?: unknown;
        maxAttempts?: number;
      },
    ) => Promise<Response>;
    getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null>;
    createAuthRefreshHandler: (tokenEntry: TokenEntry | null) => unknown;
    resolveApiHref: (pathWithQuery: string) => string;
    normalizeAudioLocale: (value: unknown) => string;
    getPreferredAudioLanguage: () => string;
    getLocale: () => string;
    requirePayloadDataArray: (endpoint: string, payload: unknown) => ApiObjectRecord[];
    auditCmsObjectContract: (rows: ApiObjectRecord[]) => void;
    parseCmsObjectRecord: (row: ApiObjectRecord) => ParsedRatingRecord | null;
    parseRatingPayload: (payload: unknown) => { rating: number | null; votes: number | null };
    sanitizeRating: (value: unknown) => number | null;
    sanitizeVotes: (value: unknown) => number | null;
    pushApiTrace: (endpoint: string, payload: unknown) => void;
  };

  type RatingsOptions = {
    fetchWithResilience?: unknown;
    getAccessToken?: unknown;
    createAuthRefreshHandler?: unknown;
    resolveApiHref?: unknown;
    normalizeAudioLocale?: unknown;
    getPreferredAudioLanguage?: unknown;
    getLocale?: unknown;
    requirePayloadDataArray?: unknown;
    auditCmsObjectContract?: unknown;
    parseCmsObjectRecord?: unknown;
    parseRatingPayload?: unknown;
    sanitizeRating?: unknown;
    sanitizeVotes?: unknown;
    pushApiTrace?: unknown;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T>(name: string, value: unknown): T {
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
    return {
      fetchWithResilience: requireFunction(
        'fetchWithResilience',
        options.fetchWithResilience,
      ) as RatingsContext['fetchWithResilience'],
      getAccessToken: requireFunction('getAccessToken', options.getAccessToken) as RatingsContext['getAccessToken'],
      createAuthRefreshHandler: requireFunction(
        'createAuthRefreshHandler',
        options.createAuthRefreshHandler,
      ) as RatingsContext['createAuthRefreshHandler'],
      resolveApiHref: requireFunction('resolveApiHref', options.resolveApiHref) as RatingsContext['resolveApiHref'],
      normalizeAudioLocale: requireFunction(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ) as RatingsContext['normalizeAudioLocale'],
      getPreferredAudioLanguage: requireFunction(
        'getPreferredAudioLanguage',
        options.getPreferredAudioLanguage,
      ) as RatingsContext['getPreferredAudioLanguage'],
      getLocale: requireFunction('getLocale', options.getLocale) as RatingsContext['getLocale'],
      requirePayloadDataArray: requireFunction(
        'requirePayloadDataArray',
        options.requirePayloadDataArray,
      ) as RatingsContext['requirePayloadDataArray'],
      auditCmsObjectContract: requireFunction(
        'auditCmsObjectContract',
        options.auditCmsObjectContract,
      ) as RatingsContext['auditCmsObjectContract'],
      parseCmsObjectRecord: requireFunction(
        'parseCmsObjectRecord',
        options.parseCmsObjectRecord,
      ) as RatingsContext['parseCmsObjectRecord'],
      parseRatingPayload: requireFunction(
        'parseRatingPayload',
        options.parseRatingPayload,
      ) as RatingsContext['parseRatingPayload'],
      sanitizeRating: requireFunction('sanitizeRating', options.sanitizeRating) as RatingsContext['sanitizeRating'],
      sanitizeVotes: requireFunction('sanitizeVotes', options.sanitizeVotes) as RatingsContext['sanitizeVotes'],
      pushApiTrace:
        typeof options.pushApiTrace === 'function'
          ? (options.pushApiTrace as RatingsContext['pushApiTrace'])
          : () => {},
    };
  }

  function resolvePreferredAudioLanguage(context: RatingsContext, preferredAudioLanguage: unknown): string {
    const explicit = context.normalizeAudioLocale(preferredAudioLanguage);
    return explicit || context.getPreferredAudioLanguage();
  }

  function toPayloadTotal(payload: unknown, fallback: number): number {
    if (!payload || typeof payload !== 'object') {
      return fallback;
    }

    return Number((payload as Record<string, unknown>).total || fallback);
  }

  function traceCmsResponse(
    context: RatingsContext,
    cmsUrl: string,
    mode: string,
    preferredAudioLanguage: string,
    seriesIds: string[],
    payload: unknown,
    records: ApiObjectRecord[],
  ): void {
    context.pushApiTrace('cmsObjects', {
      at: Date.now(),
      request: {
        url: cmsUrl,
        mode,
        preferred_audio_language: preferredAudioLanguage,
        seriesIds: Array.isArray(seriesIds) ? seriesIds.slice() : [],
      },
      response: {
        total: toPayloadTotal(payload, records.length),
        rowCount: records.length,
      },
      data: records,
    });
  }

  async function requestCmsRatings(
    context: RatingsContext,
    cmsUrl: string,
    tokenEntry: TokenEntry | null,
    label: string,
  ): Promise<{ payload: unknown; records: ApiObjectRecord[] }> {
    const requestOptions: {
      label: string;
      bearerToken?: string;
      refreshBearerToken?: unknown;
    } = {
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
    const records = context.requirePayloadDataArray('cms-objects', payload);
    context.auditCmsObjectContract(records);
    return {
      payload,
      records,
    };
  }

  async function fetchRatingsBatchInternal(
    context: RatingsContext,
    tokenEntry: TokenEntry | null,
    seriesIds: unknown,
    preferredAudioLanguage: unknown = context.getPreferredAudioLanguage(),
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

    const { payload, records } = await requestCmsRatings(context, cmsUrl, tokenEntry, 'rating batch request');
    traceCmsResponse(context, cmsUrl, 'batch', effectivePreferredAudioLanguage, normalizedSeriesIds, payload, records);

    return records
      .map((record) => context.parseCmsObjectRecord(record))
      .filter((record): record is ParsedRatingRecord => Boolean(record?.seriesId));
  }

  function parseCmsSingleRatingPayload(
    context: RatingsContext,
    seriesId: string,
    payload: unknown,
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
    preferredAudioLanguage: unknown = context.getPreferredAudioLanguage(),
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
      const { payload, records } = await requestCmsRatings(context, cmsUrl, tokenEntry, 'cms ratings request');
      traceCmsResponse(context, cmsUrl, 'single', effectivePreferredAudioLanguage, [seriesId], payload, records);
      return parseCmsSingleRatingPayload(context, seriesId, payload, records, effectivePreferredAudioLanguage);
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
    seriesId: unknown,
    seriesHref: unknown,
    preferredAudioLanguage: unknown = context.getPreferredAudioLanguage(),
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
      fetchRating: (seriesId: unknown, seriesHref: unknown, preferredAudioLanguage: unknown) =>
        fetchRatingInternal(context, seriesId, seriesHref, preferredAudioLanguage),
      fetchRatingsBatch: (tokenEntry: TokenEntry | null, seriesIds: unknown, preferredAudioLanguage: unknown) =>
        fetchRatingsBatchInternal(context, tokenEntry, seriesIds, preferredAudioLanguage),
    };
  }

  moduleRegistry.ratingsClient = {
    createRatingsClient,
  };
})();
