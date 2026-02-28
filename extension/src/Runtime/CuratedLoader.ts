(() => {
  type AnyFn = (...args: unknown[]) => unknown;

  type RuntimeState = {
    mounted: boolean;
    curatedError: unknown;
    curatedEntries: unknown[];
    curatedInflight: Promise<unknown[]> | null;
    curatedDeferredMetadataInFlight?: boolean;
    curatedPendingRequests: string[];
    curatedPendingRequestStartedCount: number;
    curatedPendingRequestCompletedCount: number;
    curatedSource: string;
    curatedLastRevalidateAt: number;
    curatedObservedPromise: Promise<unknown[]> | null;
    curatedInitialLoadDone?: boolean;
    settings: Record<string, unknown>;
  };

  type PendingRequestProgress = {
    started: number;
    completed: number;
  };

  type TokenEntry = {
    accessToken?: unknown;
    accountId?: unknown;
    profileId?: unknown;
  };

  type CuratedLoaderContext = {
    state: RuntimeState;
    windowRef: Window;
    documentRef: Document | null;
    locationRef: Location;
    runtimeEvent: (event: string, data?: unknown) => void;
    getAccessToken: (forceRefresh: boolean) => Promise<TokenEntry | null>;
    resetWatchlistCacheOnAccountMismatch: (accountId: string, profileId: string) => unknown;
    fetchAllWatchlistRows: (tokenEntry: TokenEntry) => Promise<unknown[]>;
    normalizeEntriesFromApiRows: (rows: unknown[]) => unknown[];
    preloadRatingsForEntries: (
      entries: unknown[],
      tokenEntry: TokenEntry,
      preferredAudioLanguage?: string,
    ) => Promise<unknown>;
    preloadWatchHistoryForEntries: (
      entries: unknown[],
      tokenEntry: TokenEntry,
      force?: boolean,
      preferredAudioLanguage?: string,
    ) => Promise<unknown>;
    normalizeAudioLocale: (locale: unknown) => string | null;
    getPreferredAudioLanguage: () => string;
    setWatchlistCacheRows: (accountId: string, profileId: string, rows: unknown[], updatedAt?: number) => unknown;
    isWatchlistPath: (pathname: string) => boolean;
    renderCuratedPanel: () => void;
    refreshCuratedLoadingIndicator: () => void;
    watchlistRevalidateCooldownMs: number;
    watchlistCacheSourceRevalidateCooldownMs: number;
    metadataPriorityEntryCount: number;
    metadataDeferredChunkSize: number;
    metadataDeferredIdleTimeoutMs: number;
    metadataDeferredHiddenDelayMs: number;
    metadataViewportPriorityCount: number;
    deferredMetadataRunId: number;
  };

  type CuratedLoaderOptions = {
    state?: unknown;
    windowRef?: unknown;
    documentRef?: unknown;
    locationRef?: unknown;
    runtimeEvent?: unknown;
    getAccessToken?: unknown;
    resetWatchlistCacheOnAccountMismatch?: unknown;
    fetchAllWatchlistRows?: unknown;
    normalizeEntriesFromApiRows?: unknown;
    preloadRatingsForEntries?: unknown;
    preloadWatchHistoryForEntries?: unknown;
    normalizeAudioLocale?: unknown;
    getPreferredAudioLanguage?: unknown;
    setWatchlistCacheRows?: unknown;
    isWatchlistPath?: unknown;
    renderCuratedPanel?: unknown;
    refreshCuratedLoadingIndicator?: unknown;
    watchlistRevalidateCooldownMs?: unknown;
    watchlistCacheSourceRevalidateCooldownMs?: unknown;
    metadataPriorityEntryCount?: unknown;
    metadataDeferredChunkSize?: unknown;
    metadataDeferredIdleTimeoutMs?: unknown;
    metadataDeferredHiddenDelayMs?: unknown;
    metadataViewportPriorityCount?: unknown;
  };

  type CuratedLoaderRuntime = {
    loadCuratedEntries: (force?: boolean) => Promise<unknown[]>;
    ensureCuratedDataLoad: (force?: boolean) => Promise<unknown[]>;
  };

  type CuratedLoaderDeferredMetadataRuntime = {
    splitMetadataPreloadEntries: (
      context: CuratedLoaderContext,
      entries: unknown[],
    ) => { priorityEntries: unknown[]; deferredEntries: unknown[] };
    queueDeferredMetadataPreload: (options: {
      context: CuratedLoaderContext;
      deferredEntries: unknown[];
      tokenEntry: TokenEntry;
      preloadMetadataForEntries: (entries: unknown[], tokenEntry: TokenEntry) => Promise<void>;
    }) => void;
  };

  type CuratedLoaderPendingRequestsRuntime = {
    syncPendingRequestDiagnostics: (
      context: Pick<
        CuratedLoaderContext,
        'state' | 'locationRef' | 'isWatchlistPath' | 'refreshCuratedLoadingIndicator'
      >,
      activeRequests: string[],
      progress: PendingRequestProgress,
    ) => void;
    withTrackedPendingRequest: <T>(
      context: Pick<
        CuratedLoaderContext,
        'state' | 'locationRef' | 'isWatchlistPath' | 'refreshCuratedLoadingIndicator'
      >,
      activeRequests: string[],
      progress: PendingRequestProgress,
      label: string,
      work: () => Promise<T>,
    ) => Promise<T>;
  };

  type CuratedLoaderLoadCycleRuntime = {
    runCuratedLoadCycle: (options: {
      context: CuratedLoaderContext;
      deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime;
      pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime;
      activeRequests: string[];
      pendingProgress: PendingRequestProgress;
      force: boolean;
    }) => Promise<unknown[]>;
    handleCuratedLoadFailure: (context: CuratedLoaderContext, error: unknown) => unknown[];
  };

  type CuratedLoaderResolvedDependencies = Omit<
    CuratedLoaderContext,
    'state' | 'windowRef' | 'documentRef' | 'locationRef'
  >;

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated loader dependency: ${name}`);
    }

    return value as T;
  }

  function normalizePositiveNumber(value: unknown, fallback: number): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      return fallback;
    }
    return Math.round(number);
  }

  function resolveCuratedLoaderState(value: unknown): RuntimeState {
    const state = value && typeof value === 'object' ? (value as RuntimeState) : null;
    if (!state) {
      throw new Error('[CW] Missing curated loader state');
    }
    return state;
  }

  function resolveCuratedLoaderLocationRef(value: unknown): Location {
    const locationRef = value && typeof value === 'object' ? (value as Location) : null;
    if (!locationRef) {
      throw new Error('[CW] Missing curated loader locationRef');
    }
    return locationRef;
  }

  function resolveCuratedLoaderWindowRef(value: unknown): Window {
    return value && typeof value === 'object' ? (value as Window) : (root as Window);
  }

  function resolveCuratedLoaderDocumentRef(value: unknown): Document | null {
    return value && typeof value === 'object' ? (value as Document) : null;
  }

  function resolveCuratedLoaderRenderers(
    options: CuratedLoaderOptions,
  ): Pick<CuratedLoaderContext, 'renderCuratedPanel' | 'refreshCuratedLoadingIndicator'> {
    const renderCuratedPanel = requireFunction(
      'renderCuratedPanel',
      options.renderCuratedPanel,
    ) as CuratedLoaderContext['renderCuratedPanel'];
    const refreshCuratedLoadingIndicator =
      typeof options.refreshCuratedLoadingIndicator === 'function'
        ? (options.refreshCuratedLoadingIndicator as CuratedLoaderContext['refreshCuratedLoadingIndicator'])
        : () => renderCuratedPanel();

    return {
      renderCuratedPanel,
      refreshCuratedLoadingIndicator,
    };
  }

  function resolveCuratedLoaderDependencies(
    options: CuratedLoaderOptions,
    renderers: Pick<CuratedLoaderContext, 'renderCuratedPanel' | 'refreshCuratedLoadingIndicator'>,
  ): CuratedLoaderResolvedDependencies {
    return {
      runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as CuratedLoaderContext['runtimeEvent'],
      getAccessToken: requireFunction(
        'getAccessToken',
        options.getAccessToken,
      ) as CuratedLoaderContext['getAccessToken'],
      resetWatchlistCacheOnAccountMismatch: requireFunction(
        'resetWatchlistCacheOnAccountMismatch',
        options.resetWatchlistCacheOnAccountMismatch,
      ) as CuratedLoaderContext['resetWatchlistCacheOnAccountMismatch'],
      fetchAllWatchlistRows: requireFunction(
        'fetchAllWatchlistRows',
        options.fetchAllWatchlistRows,
      ) as CuratedLoaderContext['fetchAllWatchlistRows'],
      normalizeEntriesFromApiRows: requireFunction(
        'normalizeEntriesFromApiRows',
        options.normalizeEntriesFromApiRows,
      ) as CuratedLoaderContext['normalizeEntriesFromApiRows'],
      preloadRatingsForEntries: requireFunction(
        'preloadRatingsForEntries',
        options.preloadRatingsForEntries,
      ) as CuratedLoaderContext['preloadRatingsForEntries'],
      preloadWatchHistoryForEntries: requireFunction(
        'preloadWatchHistoryForEntries',
        options.preloadWatchHistoryForEntries,
      ) as CuratedLoaderContext['preloadWatchHistoryForEntries'],
      normalizeAudioLocale: requireFunction(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ) as CuratedLoaderContext['normalizeAudioLocale'],
      getPreferredAudioLanguage: requireFunction(
        'getPreferredAudioLanguage',
        options.getPreferredAudioLanguage,
      ) as CuratedLoaderContext['getPreferredAudioLanguage'],
      setWatchlistCacheRows: requireFunction(
        'setWatchlistCacheRows',
        options.setWatchlistCacheRows,
      ) as CuratedLoaderContext['setWatchlistCacheRows'],
      isWatchlistPath: requireFunction(
        'isWatchlistPath',
        options.isWatchlistPath,
      ) as CuratedLoaderContext['isWatchlistPath'],
      ...renderers,
      watchlistRevalidateCooldownMs: normalizePositiveNumber(options.watchlistRevalidateCooldownMs, 600_000),
      watchlistCacheSourceRevalidateCooldownMs: normalizePositiveNumber(
        options.watchlistCacheSourceRevalidateCooldownMs,
        45_000,
      ),
      metadataPriorityEntryCount: Math.max(1, normalizePositiveNumber(options.metadataPriorityEntryCount, 36)),
      metadataDeferredChunkSize: Math.max(1, normalizePositiveNumber(options.metadataDeferredChunkSize, 24)),
      metadataDeferredIdleTimeoutMs: Math.max(1, normalizePositiveNumber(options.metadataDeferredIdleTimeoutMs, 180)),
      metadataDeferredHiddenDelayMs: Math.max(1, normalizePositiveNumber(options.metadataDeferredHiddenDelayMs, 900)),
      metadataViewportPriorityCount: Math.max(1, normalizePositiveNumber(options.metadataViewportPriorityCount, 24)),
      deferredMetadataRunId: 0,
    };
  }

  function createCuratedLoaderContext(options: CuratedLoaderOptions = {}): CuratedLoaderContext {
    const state = resolveCuratedLoaderState(options.state);
    const locationRef = resolveCuratedLoaderLocationRef(options.locationRef);
    const windowRef = resolveCuratedLoaderWindowRef(options.windowRef);
    const documentRef = resolveCuratedLoaderDocumentRef(options.documentRef);
    const renderers = resolveCuratedLoaderRenderers(options);
    return {
      state,
      windowRef,
      documentRef,
      locationRef,
      ...resolveCuratedLoaderDependencies(options, renderers),
    };
  }

  function createCuratedLoaderDeferredMetadataRuntime(): CuratedLoaderDeferredMetadataRuntime {
    const deferredMetadataModule = (moduleRegistry.runtimeCuratedLoaderDeferredMetadata || {}) as Record<
      string,
      unknown
    >;
    return requireFunction<AnyFn>(
      'createCuratedLoaderDeferredMetadataRuntime',
      deferredMetadataModule.createCuratedLoaderDeferredMetadataRuntime,
    )() as CuratedLoaderDeferredMetadataRuntime;
  }

  function createCuratedLoaderPendingRequestsRuntime(): CuratedLoaderPendingRequestsRuntime {
    const pendingRequestsModule = (moduleRegistry.runtimeCuratedLoaderPendingRequests || {}) as Record<string, unknown>;
    return requireFunction<AnyFn>(
      'createCuratedLoaderPendingRequestsRuntime',
      pendingRequestsModule.createCuratedLoaderPendingRequestsRuntime,
    )() as CuratedLoaderPendingRequestsRuntime;
  }

  function createCuratedLoaderLoadCycleRuntime(): CuratedLoaderLoadCycleRuntime {
    const loadCycleModule = (moduleRegistry.runtimeCuratedLoaderLoadCycle || {}) as Record<string, unknown>;
    return requireFunction<AnyFn>(
      'createCuratedLoaderLoadCycleRuntime',
      loadCycleModule.createCuratedLoaderLoadCycleRuntime,
    )() as CuratedLoaderLoadCycleRuntime;
  }

  function hasPromiseFinally(value: unknown): value is Promise<unknown> {
    return Boolean(value) && typeof (value as Promise<unknown>).finally === 'function';
  }

  function clearPendingRequestDiagnosticsInternal(
    context: CuratedLoaderContext,
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
    activeRequests: string[],
    pendingProgress: PendingRequestProgress,
  ): void {
    activeRequests.length = 0;
    pendingRequestsRuntime.syncPendingRequestDiagnostics(context, activeRequests, pendingProgress);
  }

  function shouldMarkCuratedInitialLoadDone(context: CuratedLoaderContext): boolean {
    const hasCuratedEntries = Array.isArray(context.state.curatedEntries) && context.state.curatedEntries.length > 0;
    const hasApiSource = context.state.curatedSource === 'api';
    const hasLoadError = Boolean(context.state.curatedError);
    return hasApiSource || hasCuratedEntries || !hasLoadError;
  }

  function finalizeCuratedLoadInflightInternal(
    context: CuratedLoaderContext,
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
    activeRequests: string[],
    pendingProgress: PendingRequestProgress,
  ): void {
    context.state.curatedInflight = null;
    clearPendingRequestDiagnosticsInternal(context, pendingRequestsRuntime, activeRequests, pendingProgress);
    if (context.state.curatedInitialLoadDone !== true && shouldMarkCuratedInitialLoadDone(context)) {
      context.state.curatedInitialLoadDone = true;
    }
  }

  function ensureCuratedPromiseLoadedStateInternal(
    context: CuratedLoaderContext,
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
    inflight: Promise<unknown[]>,
    activeRequests: string[],
    pendingProgress: PendingRequestProgress,
  ): Promise<unknown[]> {
    return inflight.finally(() => {
      finalizeCuratedLoadInflightInternal(context, pendingRequestsRuntime, activeRequests, pendingProgress);
    });
  }

  function loadCuratedEntriesInternal(
    context: CuratedLoaderContext,
    deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime,
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
    loadCycleRuntime: CuratedLoaderLoadCycleRuntime,
    force = false,
  ): Promise<unknown[]> {
    if (context.state.curatedInflight) {
      return context.state.curatedInflight;
    }

    const activeRequests: string[] = [];
    const pendingProgress: PendingRequestProgress = {
      started: 0,
      completed: 0,
    };
    const inflight = loadCycleRuntime
      .runCuratedLoadCycle({
        context,
        deferredMetadataRuntime,
        pendingRequestsRuntime,
        activeRequests,
        pendingProgress,
        force,
      })
      .catch((error: unknown) => loadCycleRuntime.handleCuratedLoadFailure(context, error));
    const trackedInflight = ensureCuratedPromiseLoadedStateInternal(
      context,
      pendingRequestsRuntime,
      inflight,
      activeRequests,
      pendingProgress,
    );

    context.state.curatedInflight = trackedInflight;
    return trackedInflight;
  }

  function shouldBackgroundRevalidateCuratedInternal(context: CuratedLoaderContext): boolean {
    if (context.state.curatedInflight || !context.state.curatedEntries.length) {
      return false;
    }

    const now = Date.now();
    if (context.state.curatedSource === 'cache') {
      return now - context.state.curatedLastRevalidateAt > context.watchlistCacheSourceRevalidateCooldownMs;
    }

    return now - context.state.curatedLastRevalidateAt > context.watchlistRevalidateCooldownMs;
  }

  function observeCuratedLoadPromiseInternal(context: CuratedLoaderContext, promise: unknown): void {
    if (!hasPromiseFinally(promise)) {
      return;
    }

    if (context.state.curatedObservedPromise === promise) {
      return;
    }

    context.state.curatedObservedPromise = promise as Promise<unknown[]>;
    promise.finally(() => {
      if (context.state.curatedObservedPromise === promise) {
        context.state.curatedObservedPromise = null;
      }

      if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
        return;
      }
      context.renderCuratedPanel();
    });
  }

  function ensureCuratedDataLoadInternal(
    context: CuratedLoaderContext,
    deferredMetadataRuntime: CuratedLoaderDeferredMetadataRuntime,
    pendingRequestsRuntime: CuratedLoaderPendingRequestsRuntime,
    loadCycleRuntime: CuratedLoaderLoadCycleRuntime,
    force = false,
  ): Promise<unknown[]> {
    if (!force && context.state.curatedEntries.length) {
      if (shouldBackgroundRevalidateCuratedInternal(context)) {
        const backgroundPromise = loadCuratedEntriesInternal(
          context,
          deferredMetadataRuntime,
          pendingRequestsRuntime,
          loadCycleRuntime,
          false,
        );
        observeCuratedLoadPromiseInternal(context, backgroundPromise);
      }
      return Promise.resolve(context.state.curatedEntries);
    }

    const promise = loadCuratedEntriesInternal(
      context,
      deferredMetadataRuntime,
      pendingRequestsRuntime,
      loadCycleRuntime,
      force,
    );
    observeCuratedLoadPromiseInternal(context, promise);
    return promise;
  }

  function createCuratedLoaderRuntime(options: CuratedLoaderOptions = {}): CuratedLoaderRuntime {
    const context = createCuratedLoaderContext(options);
    const deferredMetadataRuntime = createCuratedLoaderDeferredMetadataRuntime();
    const pendingRequestsRuntime = createCuratedLoaderPendingRequestsRuntime();
    const loadCycleRuntime = createCuratedLoaderLoadCycleRuntime();
    return {
      loadCuratedEntries: (force = false) =>
        loadCuratedEntriesInternal(context, deferredMetadataRuntime, pendingRequestsRuntime, loadCycleRuntime, force),
      ensureCuratedDataLoad: (force = false) =>
        ensureCuratedDataLoadInternal(
          context,
          deferredMetadataRuntime,
          pendingRequestsRuntime,
          loadCycleRuntime,
          force,
        ),
    };
  }

  moduleRegistry.runtimeCuratedLoader = {
    createCuratedLoaderRuntime,
  };
})();
