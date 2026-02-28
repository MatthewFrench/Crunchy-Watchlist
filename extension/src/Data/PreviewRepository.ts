(() => {
  type TokenEntry = {
    accessToken?: string;
  } & Record<string, unknown>;

  type PreviewEntry = {
    seriesId?: unknown;
    streamsLink?: unknown;
    panelId?: unknown;
    canonicalEpisodeKey?: unknown;
  } & Record<string, unknown>;

  type PreviewState = {
    previewCache: Record<string, string | null>;
    previewInflight: Map<string, Promise<string | null>>;
  };

  type PreviewContext = {
    state: PreviewState;
    resolveApiHref: (value: unknown) => string;
    getAccessToken: (forceRefresh?: boolean) => Promise<TokenEntry | null>;
    fetchWithResilience: (
      url: string,
      requestInit: RequestInit,
      options: {
        label: string;
        bearerToken?: string;
        refreshBearerToken?: unknown;
      },
    ) => Promise<Response>;
    createAuthRefreshHandler: (tokenEntry: TokenEntry | null) => unknown;
    pushApiTrace: (endpoint: string, payload: unknown) => void;
    runtimeEvent: (event: string, payload?: unknown) => void;
  };

  type PreviewOptions = {
    state?: unknown;
    resolveApiHref?: unknown;
    getAccessToken?: unknown;
    fetchWithResilience?: unknown;
    createAuthRefreshHandler?: unknown;
    pushApiTrace?: unknown;
    runtimeEvent?: unknown;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing preview dependency: ${name}`);
    }
    return value as T;
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  function toTokenEntry(value: unknown): TokenEntry | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return value as TokenEntry;
  }

  function createPreviewContext(options: PreviewOptions = {}): PreviewContext {
    const state = options.state && typeof options.state === 'object' ? (options.state as PreviewState) : null;
    if (!state) {
      throw new Error('[CW] Missing preview state');
    }

    if (!state.previewCache || typeof state.previewCache !== 'object') {
      state.previewCache = {};
    }
    if (!(state.previewInflight instanceof Map)) {
      state.previewInflight = new Map();
    }

    return {
      state,
      resolveApiHref: requireFunction('resolveApiHref', options.resolveApiHref) as PreviewContext['resolveApiHref'],
      getAccessToken: requireFunction('getAccessToken', options.getAccessToken) as PreviewContext['getAccessToken'],
      fetchWithResilience: requireFunction(
        'fetchWithResilience',
        options.fetchWithResilience,
      ) as PreviewContext['fetchWithResilience'],
      createAuthRefreshHandler: requireFunction(
        'createAuthRefreshHandler',
        options.createAuthRefreshHandler,
      ) as PreviewContext['createAuthRefreshHandler'],
      pushApiTrace:
        typeof options.pushApiTrace === 'function'
          ? (options.pushApiTrace as PreviewContext['pushApiTrace'])
          : () => {},
      runtimeEvent:
        typeof options.runtimeEvent === 'function'
          ? (options.runtimeEvent as PreviewContext['runtimeEvent'])
          : () => {},
    };
  }

  function findFirstMediaUrlInternal(
    context: PreviewContext,
    value: unknown,
    visited: Set<object> = new Set(),
  ): string | null {
    if (typeof value === 'string') {
      const text = value.trim();
      if (!text) {
        return null;
      }

      if (!/^https?:\/\//i.test(text) && !text.startsWith('/')) {
        return null;
      }

      const looksLikeMedia =
        /\.(m3u8|mp4|webm|m4v|mpd|jpg|jpeg|png|webp|avif)(\?|$)/i.test(text) ||
        /(?:playlist|manifest|stream|preview|video|thumbnail|poster|image)/i.test(text);

      if (!looksLikeMedia) {
        return null;
      }

      return context.resolveApiHref(text) || text;
    }

    if (!value || typeof value !== 'object') {
      return null;
    }

    if (visited.has(value)) {
      return null;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findFirstMediaUrlInternal(context, item, visited);
        if (found) {
          return found;
        }
      }
      return null;
    }

    for (const key of Object.keys(value)) {
      const found = findFirstMediaUrlInternal(context, toRecord(value)[key], visited);
      if (found) {
        return found;
      }
    }

    return null;
  }

  function parsePreviewUrlFromPayloadInternal(context: PreviewContext, payload: unknown): string | null {
    const payloadRecord = toRecord(payload);
    const previewRecord = toRecord(payloadRecord.preview);
    const streamsRecord = toRecord(payloadRecord.streams);
    const adaptiveHlsRecord = toRecord(streamsRecord.adaptive_hls);
    const hlsRecord = toRecord(streamsRecord.hls);

    const directCandidates: unknown[] = [
      payloadRecord.preview_url,
      payloadRecord.previewUrl,
      payloadRecord.preview_image,
      payloadRecord.previewImage,
      previewRecord.url,
      previewRecord.image,
      payloadRecord.url,
      adaptiveHlsRecord.url,
      adaptiveHlsRecord[''],
      hlsRecord.url,
      hlsRecord[''],
    ];

    for (const candidate of directCandidates) {
      const resolved = context.resolveApiHref(candidate);
      if (resolved) {
        return resolved;
      }
    }

    const nestedCandidates = [adaptiveHlsRecord, hlsRecord, streamsRecord];

    for (const candidate of nestedCandidates) {
      const found = findFirstMediaUrlInternal(context, candidate);
      if (found) {
        return found;
      }
    }

    return null;
  }

  function getPreviewCacheKeyInternal(context: PreviewContext, inputEntry: unknown): string {
    const entry = toRecord(inputEntry) as PreviewEntry;

    const streamsUrl = context.resolveApiHref(entry.streamsLink);
    if (streamsUrl) {
      return `streams:${streamsUrl}`;
    }

    const panelId = typeof entry.panelId === 'string' ? entry.panelId.trim() : '';
    if (panelId) {
      return `episode:${panelId}`;
    }

    const canonicalEpisodeKey = typeof entry.canonicalEpisodeKey === 'string' ? entry.canonicalEpisodeKey.trim() : '';
    if (canonicalEpisodeKey) {
      return `canonical:${canonicalEpisodeKey}`;
    }

    const seriesId = typeof entry.seriesId === 'string' ? entry.seriesId.trim() : '';
    if (seriesId) {
      return `series:${seriesId}`;
    }

    return '';
  }

  function createPreviewRequestOptionsInternal(
    context: PreviewContext,
    tokenEntry: TokenEntry | null,
  ): {
    label: string;
    bearerToken?: string;
    refreshBearerToken?: unknown;
  } {
    const requestOptions: {
      label: string;
      bearerToken?: string;
      refreshBearerToken?: unknown;
    } = {
      label: 'preview request',
      refreshBearerToken: context.createAuthRefreshHandler(tokenEntry),
    };

    if (typeof tokenEntry?.accessToken === 'string') {
      requestOptions.bearerToken = tokenEntry.accessToken;
    }

    return requestOptions;
  }

  async function parsePreviewPayloadFromResponseInternal(
    context: PreviewContext,
    response: Response,
    streamsUrl: string,
    seriesId: string,
    previewCacheKey: string,
  ): Promise<unknown> {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch (_) {
      context.runtimeEvent('preview-contract-warning', {
        reason: 'invalid-json-payload',
        seriesId,
        cacheKey: previewCacheKey,
      });
    }

    context.pushApiTrace('preview', {
      at: Date.now(),
      request: {
        url: streamsUrl,
        seriesId,
        cacheKey: previewCacheKey,
      },
      response: payload,
    });

    if (payload && (typeof payload !== 'object' || Array.isArray(payload))) {
      context.runtimeEvent('preview-contract-warning', {
        reason: 'invalid-payload-root',
        seriesId,
        cacheKey: previewCacheKey,
      });
    }

    return payload;
  }

  async function fetchPreviewFromStreamsInternal(
    context: PreviewContext,
    streamsUrl: string,
    seriesId: string,
    previewCacheKey: string,
  ): Promise<string | null> {
    const tokenEntry = toTokenEntry(await context.getAccessToken(false));
    const requestOptions = createPreviewRequestOptionsInternal(context, tokenEntry);
    const response = await context.fetchWithResilience(
      streamsUrl,
      {
        credentials: 'include',
      },
      requestOptions,
    );

    if (!response.ok) {
      return null;
    }

    const payload = await parsePreviewPayloadFromResponseInternal(
      context,
      response,
      streamsUrl,
      seriesId,
      previewCacheKey,
    );
    return parsePreviewUrlFromPayloadInternal(context, payload);
  }

  async function fetchPreviewUrlForEntryInternal(context: PreviewContext, inputEntry: unknown): Promise<string | null> {
    const entry = toRecord(inputEntry) as PreviewEntry;
    const seriesId = typeof entry.seriesId === 'string' ? entry.seriesId : '';
    if (!seriesId) {
      return null;
    }

    const previewCacheKey = getPreviewCacheKeyInternal(context, entry);
    if (!previewCacheKey) {
      return null;
    }

    if (Object.hasOwn(context.state.previewCache, previewCacheKey)) {
      return context.state.previewCache[previewCacheKey] || null;
    }

    const inflightEntry = context.state.previewInflight.get(previewCacheKey);
    if (inflightEntry) {
      return inflightEntry;
    }

    const streamsUrl = context.resolveApiHref(entry.streamsLink);
    if (!streamsUrl) {
      context.state.previewCache[previewCacheKey] = null;
      return null;
    }

    const inflight = fetchPreviewFromStreamsInternal(context, streamsUrl, seriesId, previewCacheKey)
      .catch(() => null)
      .then((previewUrl) => {
        context.state.previewCache[previewCacheKey] = previewUrl || null;
        return previewUrl || null;
      })
      .finally(() => {
        context.state.previewInflight.delete(previewCacheKey);
      });

    context.state.previewInflight.set(previewCacheKey, inflight);
    return inflight;
  }

  function createPreviewRepository(options: PreviewOptions = {}) {
    const context = createPreviewContext(options);
    return {
      fetchPreviewUrlForEntry: (entry: unknown) => fetchPreviewUrlForEntryInternal(context, entry),
    };
  }

  moduleRegistry.previewRepository = {
    createPreviewRepository,
  };
})();
