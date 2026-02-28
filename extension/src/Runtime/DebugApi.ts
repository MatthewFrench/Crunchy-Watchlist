(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type SeriesCandidate = {
    seriesId: string;
    title: string;
  };

  type ApiTraceRecord = {
    request?: Record<string, unknown>;
    response?: Record<string, unknown>;
    data?: unknown[];
    [key: string]: unknown;
  };

  type RuntimeState = {
    curatedEntries: unknown[];
    curatedDomLifecycleCounters?: CuratedDomLifecycleCounters;
    watchlistCache?: {
      rows?: unknown[];
    };
    apiTrace?: {
      watchlist?: ApiTraceRecord[];
      watchHistory?: ApiTraceRecord[];
      cmsObjects?: ApiTraceRecord[];
      legacyRating?: ApiTraceRecord[];
      preview?: ApiTraceRecord[];
      [key: string]: unknown;
    };
  };

  type CuratedDomLifecycleCounters = {
    created: number;
    patched: number;
    parked: number;
    unparked: number;
    disposed: number;
    renderPasses: number;
  };

  type CuratedDomLifecycleStats = {
    counters: CuratedDomLifecycleCounters;
    totalLifecycleMutations: number;
    identityChurnRate: number;
  };

  type DebugApiContext = {
    state: RuntimeState;
    getWatchlistSeriesId: (entry: unknown) => string | null;
    getWatchHistorySeriesId: (entry: unknown) => string | null;
    getWatchlistSeriesTitle: (entry: unknown) => string;
    getWatchHistorySeriesTitle: (entry: unknown) => string;
    logRef: (message: string) => void;
  };

  type DebugApiOptions = {
    state?: unknown;
    getWatchlistSeriesId?: unknown;
    getWatchHistorySeriesId?: unknown;
    getWatchlistSeriesTitle?: unknown;
    getWatchHistorySeriesTitle?: unknown;
    logRef?: unknown;
  };

  type DebugApiDump = {
    query: string;
    generatedAt?: string;
    matchedSeries?: SeriesCandidate;
    apis?: Record<string, unknown[]>;
    availableSeries?: SeriesCandidate[];
    error?: string;
  };

  type DebugApiRuntime = {
    listSeries: () => SeriesCandidate[];
    getCuratedDomStats: () => CuratedDomLifecycleStats;
    dumpSeriesApiData: (query: unknown) => DebugApiDump;
    printSeriesApiData: (query: unknown) => DebugApiDump;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing debug API dependency: ${name}`);
    }

    return value as T;
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  function toNonNegativeInt(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.round(parsed);
  }

  function toApiTraceBucket(value: unknown): ApiTraceRecord[] {
    return Array.isArray(value) ? (value as ApiTraceRecord[]) : [];
  }

  function resolveState(value: unknown): RuntimeState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('[CW] Missing debug API state');
    }

    const stateRecord = value as Record<string, unknown>;
    if (!Array.isArray(stateRecord.curatedEntries)) {
      stateRecord.curatedEntries = [];
    }

    return stateRecord as unknown as RuntimeState;
  }

  function createDebugApiContext(options: DebugApiOptions = {}): DebugApiContext {
    return {
      state: resolveState(options.state),
      getWatchlistSeriesId: requireFunction(
        'getWatchlistSeriesId',
        options.getWatchlistSeriesId,
      ) as DebugApiContext['getWatchlistSeriesId'],
      getWatchHistorySeriesId: requireFunction(
        'getWatchHistorySeriesId',
        options.getWatchHistorySeriesId,
      ) as DebugApiContext['getWatchHistorySeriesId'],
      getWatchlistSeriesTitle: requireFunction(
        'getWatchlistSeriesTitle',
        options.getWatchlistSeriesTitle,
      ) as DebugApiContext['getWatchlistSeriesTitle'],
      getWatchHistorySeriesTitle: requireFunction(
        'getWatchHistorySeriesTitle',
        options.getWatchHistorySeriesTitle,
      ) as DebugApiContext['getWatchHistorySeriesTitle'],
      logRef: requireFunction('logRef', options.logRef ?? console.log) as DebugApiContext['logRef'],
    };
  }

  function addSeriesCandidate(target: Map<string, SeriesCandidate>, seriesId: unknown, title: unknown): void {
    const normalizedSeriesId = getString(seriesId);
    const normalizedTitle = getString(title);
    if (!normalizedSeriesId) {
      return;
    }

    const existing = target.get(normalizedSeriesId);
    if (existing) {
      if (!existing.title && normalizedTitle) {
        existing.title = normalizedTitle;
      }
      return;
    }

    target.set(normalizedSeriesId, {
      seriesId: normalizedSeriesId,
      title: normalizedTitle,
    });
  }

  function addSeriesFromRows(
    target: Map<string, SeriesCandidate>,
    rows: unknown[],
    getSeriesId: (row: unknown) => string | null,
    getSeriesTitle: (row: unknown) => string,
  ): void {
    for (const row of rows) {
      addSeriesCandidate(target, getSeriesId(row), getSeriesTitle(row));
    }
  }

  function addSeriesFromTraceBucket(
    target: Map<string, SeriesCandidate>,
    bucket: unknown,
    getSeriesId: (row: unknown) => string | null,
    getSeriesTitle: (row: unknown) => string,
  ): void {
    for (const record of toApiTraceBucket(bucket)) {
      const rows = Array.isArray(record?.data) ? record.data : [];
      addSeriesFromRows(target, rows, getSeriesId, getSeriesTitle);
    }
  }

  function listSeriesInternal(context: DebugApiContext): SeriesCandidate[] {
    const bySeriesId = new Map<string, SeriesCandidate>();

    for (const entry of context.state.curatedEntries) {
      const entryRecord = toRecord(entry);
      addSeriesCandidate(bySeriesId, entryRecord.seriesId, entryRecord.title);
    }

    const watchlistRows = Array.isArray(context.state.watchlistCache?.rows) ? context.state.watchlistCache.rows : [];
    addSeriesFromRows(bySeriesId, watchlistRows, context.getWatchlistSeriesId, context.getWatchlistSeriesTitle);
    addSeriesFromTraceBucket(
      bySeriesId,
      context.state.apiTrace?.watchlist,
      context.getWatchlistSeriesId,
      context.getWatchlistSeriesTitle,
    );
    addSeriesFromTraceBucket(
      bySeriesId,
      context.state.apiTrace?.watchHistory,
      context.getWatchHistorySeriesId,
      context.getWatchHistorySeriesTitle,
    );

    return Array.from(bySeriesId.values()).sort((left, right) => {
      const leftTitle = getString(left.title || left.seriesId).toLowerCase();
      const rightTitle = getString(right.title || right.seriesId).toLowerCase();
      return leftTitle.localeCompare(rightTitle);
    });
  }

  function getCuratedDomLifecycleStatsInternal(context: DebugApiContext): CuratedDomLifecycleStats {
    const countersRecord = toRecord(context.state.curatedDomLifecycleCounters);
    const counters: CuratedDomLifecycleCounters = {
      created: toNonNegativeInt(countersRecord.created),
      patched: toNonNegativeInt(countersRecord.patched),
      parked: toNonNegativeInt(countersRecord.parked),
      unparked: toNonNegativeInt(countersRecord.unparked),
      disposed: toNonNegativeInt(countersRecord.disposed),
      renderPasses: toNonNegativeInt(countersRecord.renderPasses),
    };
    const totalLifecycleMutations =
      counters.created + counters.patched + counters.parked + counters.unparked + counters.disposed;
    const identityChurnRate =
      counters.created + counters.patched > 0 ? counters.created / (counters.created + counters.patched) : 0;

    return {
      counters,
      totalLifecycleMutations,
      identityChurnRate,
    };
  }

  function findSeriesCandidate(candidates: SeriesCandidate[], query: string): SeriesCandidate | null {
    const normalizedQuery = getString(query).toLowerCase();
    if (!normalizedQuery) {
      return null;
    }

    const bySeriesId = candidates.find((candidate) => candidate.seriesId.toLowerCase() === normalizedQuery);
    if (bySeriesId) {
      return bySeriesId;
    }

    const byTitleExact = candidates.find((candidate) => candidate.title.toLowerCase() === normalizedQuery);
    if (byTitleExact) {
      return byTitleExact;
    }

    return candidates.find((candidate) => candidate.title.toLowerCase().includes(normalizedQuery)) || null;
  }

  function mapApiTraceRowsBySeries(
    bucket: unknown,
    seriesId: string,
    rowSeriesIdGetter: (row: unknown) => string | null,
  ): ApiTraceRecord[] {
    if (!seriesId) {
      return [];
    }

    const sourceBucket = toApiTraceBucket(bucket);
    return sourceBucket
      .map((record) => {
        const rows = Array.isArray(record?.data) ? record.data : [];
        const matchedRows = rows.filter((row) => rowSeriesIdGetter(row) === seriesId);
        if (!matchedRows.length) {
          return null;
        }

        const responseRecord = toRecord(record?.response);
        return {
          ...record,
          response: {
            ...responseRecord,
            matchedRowCount: matchedRows.length,
          },
          data: matchedRows,
        } as ApiTraceRecord;
      })
      .filter((value): value is ApiTraceRecord => value != null);
  }

  function getCmsObjectSeriesId(row: unknown): string | null {
    const id = getString(toRecord(row).id);
    return id || null;
  }

  function buildSeriesApiDataDumpInternal(context: DebugApiContext, query: unknown): DebugApiDump {
    const normalizedQuery = getString(query);
    const candidates = listSeriesInternal(context);
    const matchedSeries = findSeriesCandidate(candidates, normalizedQuery);

    if (!matchedSeries) {
      return {
        query: normalizedQuery,
        error: 'Series not found in current extension data.',
        availableSeries: candidates,
      };
    }

    const seriesId = matchedSeries.seriesId;
    const apis: Record<string, unknown[]> = {};

    const watchlistCalls = mapApiTraceRowsBySeries(
      context.state.apiTrace?.watchlist,
      seriesId,
      context.getWatchlistSeriesId,
    );
    if (watchlistCalls.length) {
      apis['/content/v2/discover/{account_id}/watchlist'] = watchlistCalls;
    }

    const watchHistoryCalls = mapApiTraceRowsBySeries(
      context.state.apiTrace?.watchHistory,
      seriesId,
      context.getWatchHistorySeriesId,
    );
    if (watchHistoryCalls.length) {
      apis['/content/v2/{account_id}/watch-history'] = watchHistoryCalls;
    }

    const cmsCalls = mapApiTraceRowsBySeries(context.state.apiTrace?.cmsObjects, seriesId, getCmsObjectSeriesId);
    if (cmsCalls.length) {
      apis['/content/v2/cms/objects/{series_ids}'] = cmsCalls;
    }

    const legacyRatingCalls = toApiTraceBucket(context.state.apiTrace?.legacyRating).filter((record) => {
      return getString(toRecord(record?.request).seriesId) === seriesId;
    });
    if (legacyRatingCalls.length) {
      apis['/content-reviews/v3/rating/series/{series_id}'] = legacyRatingCalls;
    }

    const previewCalls = toApiTraceBucket(context.state.apiTrace?.preview).filter((record) => {
      return getString(toRecord(record?.request).seriesId) === seriesId;
    });
    if (previewCalls.length) {
      apis['/content/v2/cms/videos/{video_id}/streams'] = previewCalls;
    }

    return {
      query: normalizedQuery,
      generatedAt: new Date().toISOString(),
      matchedSeries,
      apis,
    };
  }

  function createDebugApiRuntime(options: DebugApiOptions = {}): DebugApiRuntime {
    const context = createDebugApiContext(options);

    return {
      listSeries: () => listSeriesInternal(context),
      getCuratedDomStats: () => getCuratedDomLifecycleStatsInternal(context),
      dumpSeriesApiData: (query) => buildSeriesApiDataDumpInternal(context, query),
      printSeriesApiData: (query) => {
        const dump = buildSeriesApiDataDumpInternal(context, query);
        try {
          context.logRef(JSON.stringify(dump, null, 2));
        } catch {
          // no-op
        }
        return dump;
      },
    };
  }

  moduleRegistry.runtimeDebug = {
    createDebugApiRuntime,
  };
})();
