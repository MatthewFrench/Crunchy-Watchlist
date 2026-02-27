;(() => {
  type AnyFn = (...args: unknown[]) => unknown
  type LooseRecord = Record<string, unknown>

  type RuntimeControl = LooseRecord & {
    active?: boolean
    activeInstanceId?: string | null
  }

  type RuntimeWindow = Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_CONTROL__?: RuntimeControl
      __CW_WATCHLIST_CURATOR_LOADED__?: {
        version?: string
      }
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord
    }

  type RuntimeBootstrapHelpersContext = {
    windowRef: RuntimeWindow
    browserRef: unknown
    chromeRef: unknown
    setRuntimeControl: (patch: LooseRecord) => void
    runtimeInstanceId: string
    runtimeInstanceStartedAt: number
    isCurrentRuntimeActive: () => boolean
  }

  type RuntimeLockLifecycleOptions = {
    state: LooseRecord
    getRuntimeEvent: () => AnyFn
    getDestroyRuntime: () => AnyFn
    getWatchlistHealthRuntime: () => LooseRecord
  }

  type RuntimeLockLifecycleControl = {
    startDomRuntimeLockHeartbeat: () => void
    startRuntimeTakeoverRequestListener: () => void
    shutdownRuntime: (payload?: LooseRecord) => void
  }

  type BootstrapSessionCoreModules = {
    runtimeBootstrapGateModule: LooseRecord
    runtimeBootstrapModulesModule: LooseRecord
    runtimeBootstrapFinalizeModule: LooseRecord
    bootstrapModulesRuntime: LooseRecord
    runtimeContentCompositionModule: LooseRecord
    runtimeContentRuntimeSetupModule: LooseRecord
    runtimeWatchlistHealthModule: LooseRecord
  }

  type BootstrapSessionDependencies = {
    runtimeStateLoaderModule: LooseRecord
    runtimeLifecycleModule: LooseRecord
    runtimeBootstrapHelpersModule: LooseRecord
    storageModule: LooseRecord
    assertRuntimeMethods: AnyFn
    defaultSortMode: unknown
    validSortModes: unknown
    sortModeControlOptions: unknown[]
    defaultSettings: LooseRecord
    runtimeConstants: LooseRecord
    state: LooseRecord
    createEmptyWatchHistoryCache: AnyFn
    createWatchlistCacheSnapshot: AnyFn
  }

  type RuntimeBootstrapMutableAccessors = {
    setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void
    setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void
    setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void
    setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void
    setWatchlistHealthRuntime: (nextWatchlistHealthRuntime: LooseRecord) => void
    getRuntimeEvent: () => AnyFn
    getProcessWatchlist: () => AnyFn
    getDestroyRuntime: () => AnyFn
    getSyncRouteRuntime: () => AnyFn
    getWatchlistHealthRuntime: () => LooseRecord
  }

  type BootstrapRuntimeSession = {
    runtimeBootstrapGateModule: LooseRecord
    runtimeBootstrapFinalizeModule: LooseRecord
    runtimeContentCompositionModule: LooseRecord
    runtimeContentRuntimeSetupModule: LooseRecord
    runtimeStateLoaderModule: LooseRecord
    runtimeLifecycleModule: LooseRecord
    runtimeBootstrapHelpersModule: LooseRecord
    storageModule: LooseRecord
    assertRuntimeMethods: AnyFn
    defaultSortMode: unknown
    validSortModes: unknown
    sortModeControlOptions: unknown[]
    defaultSettings: LooseRecord
    runtimeConstants: LooseRecord
    state: LooseRecord
    storageLocalArea: unknown
    isWatchlistPath: (pathname: string) => boolean
    debounceProcess: () => void
    createEmptyWatchHistoryCache: AnyFn
    createWatchlistCacheSnapshot: AnyFn
    bootstrapModulesRuntime: LooseRecord
    setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void
    setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void
    setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void
    setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void
    getRuntimeEvent: () => AnyFn
    startDomRuntimeLockHeartbeat: () => void
    shutdownRuntime: (payload?: LooseRecord) => void
    startWatchlistHealthRuntime: () => void
  }

  type RuntimeBootstrapSessionRuntime = {
    createRuntimeSetupOptions: (options: LooseRecord) => LooseRecord
    applyRuntimeSetupBindings: (options: {
      runtimeSetupResult: LooseRecord
      setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void
      setRuntimeSetupBindings: (runtimeSetupBindings: LooseRecord) => void
    }) => void
    createRuntimeBootstrapSession: ({
      bootstrapContext,
    }: {
      bootstrapContext: LooseRecord
    }) => BootstrapRuntimeSession | null
    createBootstrapFinalizeRuntimeOptions: (options: LooseRecord) => LooseRecord
    createBootstrapFinalizeRuntimeFromSetupResult: (options: {
      windowRef: RuntimeWindow
      runtimeSetupResult: LooseRecord
      runtimeBootstrapSession: BootstrapRuntimeSession
    }) => unknown
    bindBootstrapFinalizeRuntimeMethods: (options: {
      bootstrapFinalizeRuntime: LooseRecord
      setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void
      setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void
      setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void
      setBootstrapIssue: (reason: string, payload?: LooseRecord) => void
    }) => boolean
    runBootstrapFinalizeInitFlow: (options: {
      bootstrapFinalizeRuntime: LooseRecord
      updateDiagnostics: (payload: LooseRecord) => void
      startDomRuntimeLockHeartbeat: () => void
      startWatchlistHealthRuntime: () => void
      runtimeEvent: (event: string, payload?: LooseRecord) => void
      setBootstrapIssue: (reason: string, payload?: LooseRecord) => void
      shutdownRuntime: (payload?: LooseRecord) => void
    }) => void
  }

  type RuntimeSetupBindingsRuntime = {
    createRuntimeSetupOptions: (options: LooseRecord) => LooseRecord
    applyRuntimeSetupBindings: (options: {
      runtimeSetupResult: LooseRecord
      setRuntimeEvent: (nextRuntimeEvent: AnyFn) => void
      setRuntimeSetupBindings: (runtimeSetupBindings: LooseRecord) => void
    }) => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as RuntimeWindow
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function toRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as LooseRecord
  }

  function createRuntimeSetupBindingsRuntime(): RuntimeSetupBindingsRuntime {
    const setupBindingsModule = toRecord(moduleRegistry.runtimeContentRuntimeBootstrapSetupBindings)
    if (typeof setupBindingsModule.createContentRuntimeBootstrapSetupBindingsRuntime === 'function') {
      return (
        setupBindingsModule.createContentRuntimeBootstrapSetupBindingsRuntime as AnyFn
      )() as RuntimeSetupBindingsRuntime
    }

    return {
      createRuntimeSetupOptions: (options: LooseRecord) => toRecord(options),
      applyRuntimeSetupBindings: ({ runtimeSetupResult, setRuntimeEvent, setRuntimeSetupBindings }) => {
        setRuntimeEvent(runtimeSetupResult.runtimeEvent as AnyFn)
        setRuntimeSetupBindings(toRecord(runtimeSetupResult))
      },
    }
  }

  function resolveBootstrapSessionCoreModules(bootstrapContext: LooseRecord): BootstrapSessionCoreModules {
    return {
      runtimeBootstrapGateModule: toRecord(bootstrapContext.runtimeBootstrapGateModule),
      runtimeBootstrapModulesModule: toRecord(bootstrapContext.runtimeBootstrapModulesModule),
      runtimeBootstrapFinalizeModule: toRecord(bootstrapContext.runtimeBootstrapFinalizeModule),
      bootstrapModulesRuntime: toRecord(bootstrapContext.bootstrapModulesRuntime),
      runtimeContentCompositionModule: toRecord(bootstrapContext.runtimeContentCompositionModule),
      runtimeContentRuntimeSetupModule: toRecord(bootstrapContext.runtimeContentRuntimeSetupModule),
      runtimeWatchlistHealthModule: toRecord(bootstrapContext.runtimeWatchlistHealthModule),
    }
  }

  function resolveBootstrapSessionDependencies(coreModules: BootstrapSessionCoreModules): BootstrapSessionDependencies {
    const runtimeStoreModule = toRecord(coreModules.bootstrapModulesRuntime.runtimeStoreModule)
    const runtimeConstants = toRecord(coreModules.bootstrapModulesRuntime.runtimeConstants)
    const defaultSettings = toRecord(coreModules.bootstrapModulesRuntime.defaultSettings)

    return {
      runtimeStateLoaderModule: toRecord(coreModules.bootstrapModulesRuntime.runtimeStateLoaderModule),
      runtimeLifecycleModule: toRecord(coreModules.bootstrapModulesRuntime.runtimeLifecycleModule),
      runtimeBootstrapHelpersModule: toRecord(coreModules.bootstrapModulesRuntime.runtimeBootstrapHelpersModule),
      storageModule: toRecord(coreModules.bootstrapModulesRuntime.storageModule),
      assertRuntimeMethods: coreModules.runtimeBootstrapModulesModule.assertRuntimeMethods as AnyFn,
      defaultSortMode: coreModules.bootstrapModulesRuntime.defaultSortMode,
      validSortModes: coreModules.bootstrapModulesRuntime.validSortModes,
      sortModeControlOptions: Array.isArray(coreModules.bootstrapModulesRuntime.sortModeControlOptions)
        ? coreModules.bootstrapModulesRuntime.sortModeControlOptions
        : [],
      defaultSettings,
      runtimeConstants,
      state: (runtimeStoreModule.createRuntimeState as AnyFn)({
        defaultSettings,
        watchHistoryCacheVersion: runtimeConstants.watchHistoryCacheVersion,
      }) as LooseRecord,
      createEmptyWatchHistoryCache: () =>
        (runtimeStoreModule.createEmptyWatchHistoryCache as AnyFn)(runtimeConstants.watchHistoryCacheVersion),
      createWatchlistCacheSnapshot: (...args: unknown[]) =>
        (runtimeStoreModule.createWatchlistCacheSnapshot as AnyFn)(...args),
    }
  }

  function createRuntimeBootstrapMutableAccessors(): RuntimeBootstrapMutableAccessors {
    let processWatchlist: AnyFn = async () => {}
    let runtimeEvent: AnyFn = () => {}
    let destroyRuntime: AnyFn = () => {}
    let syncRouteRuntime: AnyFn = () => {}
    let watchlistHealthRuntime: LooseRecord = {
      start: () => {},
      stop: () => {},
      runCheck: () => {},
    }

    return {
      setRuntimeEvent: (nextRuntimeEvent: AnyFn) => {
        runtimeEvent = typeof nextRuntimeEvent === 'function' ? nextRuntimeEvent : () => {}
      },
      setProcessWatchlist: (nextProcessWatchlist: AnyFn) => {
        processWatchlist = typeof nextProcessWatchlist === 'function' ? nextProcessWatchlist : async () => {}
      },
      setDestroyRuntime: (nextDestroyRuntime: AnyFn) => {
        destroyRuntime = typeof nextDestroyRuntime === 'function' ? nextDestroyRuntime : () => {}
      },
      setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => {
        syncRouteRuntime = typeof nextSyncRouteRuntime === 'function' ? nextSyncRouteRuntime : () => {}
      },
      setWatchlistHealthRuntime: (nextWatchlistHealthRuntime: LooseRecord) => {
        watchlistHealthRuntime = toRecord(nextWatchlistHealthRuntime)
      },
      getRuntimeEvent: () => runtimeEvent,
      getProcessWatchlist: () => processWatchlist,
      getDestroyRuntime: () => destroyRuntime,
      getSyncRouteRuntime: () => syncRouteRuntime,
      getWatchlistHealthRuntime: () => watchlistHealthRuntime,
    }
  }

  function resolveStorageLocalAreaForContext(context: RuntimeBootstrapHelpersContext): unknown {
    return (
      toRecord(toRecord(context.browserRef).storage).local ||
      toRecord(toRecord(context.chromeRef).storage).local ||
      null
    )
  }

  function createIsWatchlistPath(runtimeBootstrapGateModule: LooseRecord): (pathname: string) => boolean {
    return (pathname: string) => (runtimeBootstrapGateModule.isWatchlistPath as AnyFn)(pathname) as boolean
  }

  function createDebounceProcess(
    context: RuntimeBootstrapHelpersContext,
    state: LooseRecord,
    runtimeConstants: LooseRecord,
    getProcessWatchlist: () => AnyFn,
  ): () => void {
    return () => {
      context.windowRef.clearTimeout(state.processTimer as number)
      state.processTimer = context.windowRef.setTimeout(() => {
        ;(getProcessWatchlist()() as Promise<unknown>).catch(() => {
          // no-op
        })
      }, runtimeConstants.processDebounceMs as number)
    }
  }

  function activateRuntimeControlForSession(
    context: RuntimeBootstrapHelpersContext,
    getRuntimeEvent: () => AnyFn,
    shutdownRuntime: (payload?: LooseRecord) => void,
  ): void {
    context.setRuntimeControl({
      version: context.windowRef.__CW_WATCHLIST_CURATOR_LOADED__?.version || '0',
      active: true,
      activeInstanceId: context.runtimeInstanceId,
      activeInstanceClaimedAt: context.runtimeInstanceStartedAt,
      shutdown: (payload: unknown) => {
        getRuntimeEvent()('shutdown-requested', payload || null)
        shutdownRuntime((payload || {}) as LooseRecord)
      },
    })
  }

  function createWatchlistHealthRuntimeForSession({
    context,
    coreModules,
    state,
    isWatchlistPath,
    getRuntimeEvent,
    getProcessWatchlist,
    getSyncRouteRuntime,
  }: {
    context: RuntimeBootstrapHelpersContext
    coreModules: BootstrapSessionCoreModules
    state: LooseRecord
    isWatchlistPath: (pathname: string) => boolean
    getRuntimeEvent: () => AnyFn
    getProcessWatchlist: () => AnyFn
    getSyncRouteRuntime: () => AnyFn
  }): LooseRecord {
    return (coreModules.runtimeWatchlistHealthModule.createWatchlistHealthRuntime as AnyFn)({
      state,
      windowRef: context.windowRef,
      runtimeEvent: (event: string, data: unknown) => getRuntimeEvent()(event, data),
      isRuntimeActive: () => context.isCurrentRuntimeActive(),
      isWatchlistPath: (pathname: string) => isWatchlistPath(pathname),
      getWatchlistRoot: (documentRef: Document) =>
        (coreModules.runtimeBootstrapGateModule.getWatchlistRoot as AnyFn)(documentRef),
      processWatchlist: () => getProcessWatchlist()(),
      syncRouteRuntime: () => getSyncRouteRuntime()(),
    }) as LooseRecord
  }

  function startWatchlistHealthRuntime(accessors: RuntimeBootstrapMutableAccessors): void {
    const watchlistHealthRuntime = accessors.getWatchlistHealthRuntime()
    if (typeof watchlistHealthRuntime.start === 'function') {
      watchlistHealthRuntime.start()
    }
  }

  function createRuntimeBootstrapSessionForContext(
    context: RuntimeBootstrapHelpersContext,
    {
      bootstrapContext,
      createRuntimeLockLifecycleControl,
    }: {
      bootstrapContext: LooseRecord
      createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) => RuntimeLockLifecycleControl
    },
  ): BootstrapRuntimeSession | null {
    const coreModules = resolveBootstrapSessionCoreModules(bootstrapContext)
    const sessionDependencies = resolveBootstrapSessionDependencies(coreModules)
    const accessors = createRuntimeBootstrapMutableAccessors()

    const runtimeLockLifecycleControl = createRuntimeLockLifecycleControl({
      state: sessionDependencies.state,
      getRuntimeEvent: accessors.getRuntimeEvent,
      getDestroyRuntime: accessors.getDestroyRuntime,
      getWatchlistHealthRuntime: accessors.getWatchlistHealthRuntime,
    })

    const isWatchlistPath = createIsWatchlistPath(coreModules.runtimeBootstrapGateModule)
    activateRuntimeControlForSession(context, accessors.getRuntimeEvent, runtimeLockLifecycleControl.shutdownRuntime)
    runtimeLockLifecycleControl.startRuntimeTakeoverRequestListener()

    const watchlistHealthRuntime = createWatchlistHealthRuntimeForSession({
      context,
      coreModules,
      state: sessionDependencies.state,
      isWatchlistPath,
      getRuntimeEvent: accessors.getRuntimeEvent,
      getProcessWatchlist: accessors.getProcessWatchlist,
      getSyncRouteRuntime: accessors.getSyncRouteRuntime,
    })
    sessionDependencies.assertRuntimeMethods('watchlist health runtime', watchlistHealthRuntime, [
      'runCheck',
      'start',
      'stop',
    ])
    accessors.setWatchlistHealthRuntime(watchlistHealthRuntime)

    return {
      runtimeBootstrapGateModule: coreModules.runtimeBootstrapGateModule,
      runtimeBootstrapFinalizeModule: coreModules.runtimeBootstrapFinalizeModule,
      runtimeContentCompositionModule: coreModules.runtimeContentCompositionModule,
      runtimeContentRuntimeSetupModule: coreModules.runtimeContentRuntimeSetupModule,
      runtimeStateLoaderModule: sessionDependencies.runtimeStateLoaderModule,
      runtimeLifecycleModule: sessionDependencies.runtimeLifecycleModule,
      runtimeBootstrapHelpersModule: sessionDependencies.runtimeBootstrapHelpersModule,
      storageModule: sessionDependencies.storageModule,
      assertRuntimeMethods: sessionDependencies.assertRuntimeMethods,
      defaultSortMode: sessionDependencies.defaultSortMode,
      validSortModes: sessionDependencies.validSortModes,
      sortModeControlOptions: sessionDependencies.sortModeControlOptions,
      defaultSettings: sessionDependencies.defaultSettings,
      runtimeConstants: sessionDependencies.runtimeConstants,
      state: sessionDependencies.state,
      storageLocalArea: resolveStorageLocalAreaForContext(context),
      isWatchlistPath,
      debounceProcess: createDebounceProcess(
        context,
        sessionDependencies.state,
        sessionDependencies.runtimeConstants,
        accessors.getProcessWatchlist,
      ),
      createEmptyWatchHistoryCache: sessionDependencies.createEmptyWatchHistoryCache,
      createWatchlistCacheSnapshot: sessionDependencies.createWatchlistCacheSnapshot,
      bootstrapModulesRuntime: coreModules.bootstrapModulesRuntime,
      setRuntimeEvent: accessors.setRuntimeEvent,
      setProcessWatchlist: accessors.setProcessWatchlist,
      setDestroyRuntime: accessors.setDestroyRuntime,
      setSyncRouteRuntime: accessors.setSyncRouteRuntime,
      getRuntimeEvent: accessors.getRuntimeEvent,
      startDomRuntimeLockHeartbeat: runtimeLockLifecycleControl.startDomRuntimeLockHeartbeat,
      shutdownRuntime: runtimeLockLifecycleControl.shutdownRuntime,
      startWatchlistHealthRuntime: () => {
        startWatchlistHealthRuntime(accessors)
      },
    }
  }

  function createBootstrapFinalizeRuntimeOptionsForContext(
    context: RuntimeBootstrapHelpersContext,
    {
      windowRef,
      runtimeEvent,
      runtimeLifecycleModule,
      runtimeStateLoaderModule,
      state,
      isWatchlistPath,
      ensureInterface,
      applyTabUi,
      ensureCuratedDataLoad,
      renderCuratedPanel,
      setNativeVisibility,
      clearRootFrame,
      debounceProcess,
      storageGet,
      getAccessToken,
      normalizeStoredWatchHistoryCache,
      isWatchHistoryCacheValid,
      normalizeStoredWatchlistCache,
      isWatchlistCacheValid,
      normalizeEntriesFromApiRows,
      defaultSettings,
      validSortModes,
      defaultSortMode,
      runtimeConstants,
      listKnownSeries,
      dumpSeriesApiData,
      printSeriesApiData,
    }: LooseRecord,
  ): LooseRecord {
    return {
      windowRef,
      runtimeEvent,
      runtimeLifecycleModule,
      runtimeLifecycleOptions: {
        state,
        runtimeEvent,
        isRuntimeActive: () => context.isCurrentRuntimeActive(),
        isWatchlistPath,
        ensureInterface,
        applyTabUi,
        ensureCuratedDataLoad,
        renderCuratedPanel,
        setNativeVisibility,
        clearRootFrame,
        debounceProcess,
      },
      runtimeStateLoaderModule,
      runtimeStateLoaderOptions: {
        state,
        storageGet,
        getAccessToken,
        runtimeEvent,
        normalizeStoredWatchHistoryCache,
        isWatchHistoryCacheValid,
        normalizeStoredWatchlistCache,
        isWatchlistCacheValid,
        normalizeEntriesFromApiRows,
        defaultSettings,
        validSortModes,
        defaultSortMode,
        settingsKey: toRecord(runtimeConstants).settingsKey,
        ratingCacheKey: toRecord(runtimeConstants).ratingCacheKey,
        watchHistoryCacheKey: toRecord(runtimeConstants).watchHistoryCacheKey,
        watchlistCacheKey: toRecord(runtimeConstants).watchlistCacheKey,
      },
      listKnownSeries,
      dumpSeriesApiData,
      printSeriesApiData,
    }
  }

  function createBootstrapFinalizeRuntimeFromSetupResultForContext({
    context,
    windowRef,
    runtimeSetupResult,
    runtimeBootstrapSession,
  }: {
    context: RuntimeBootstrapHelpersContext
    windowRef: RuntimeWindow
    runtimeSetupResult: LooseRecord
    runtimeBootstrapSession: BootstrapRuntimeSession
  }): unknown {
    const runtimeBootstrapFinalizeModule = runtimeBootstrapSession.runtimeBootstrapFinalizeModule
    const storageModule = runtimeBootstrapSession.storageModule
    const safeJsonParse = (value: unknown, fallback: unknown) =>
      (runtimeBootstrapFinalizeModule.safeJsonParse as AnyFn)(value, fallback)
    const storageAdapter = (storageModule.createStorageAdapter as AnyFn)({
      storageArea: runtimeBootstrapSession.storageLocalArea,
      parseJson: safeJsonParse,
      localStorageRef: windowRef.localStorage,
      timeoutMs: 1500,
    })
    const storageAccessors = (runtimeBootstrapFinalizeModule.createStorageAccessors as AnyFn)({
      storageAdapter,
    }) as LooseRecord
    const storageGet = (key: string, fallback: unknown) => (storageAccessors.storageGet as AnyFn)(key, fallback)

    return (runtimeBootstrapFinalizeModule.createBootstrapFinalizeRuntime as AnyFn)(
      createBootstrapFinalizeRuntimeOptionsForContext(context, {
        windowRef,
        runtimeEvent: runtimeSetupResult.runtimeEvent,
        runtimeLifecycleModule: runtimeBootstrapSession.runtimeLifecycleModule,
        runtimeStateLoaderModule: runtimeBootstrapSession.runtimeStateLoaderModule,
        state: runtimeBootstrapSession.state,
        isWatchlistPath: runtimeBootstrapSession.isWatchlistPath,
        ensureInterface: runtimeSetupResult.ensureInterface,
        applyTabUi: runtimeSetupResult.applyTabUi,
        ensureCuratedDataLoad: runtimeSetupResult.ensureCuratedDataLoad,
        renderCuratedPanel: runtimeSetupResult.renderCuratedPanel,
        setNativeVisibility: runtimeSetupResult.setNativeVisibility,
        clearRootFrame: runtimeSetupResult.clearRootFrame,
        debounceProcess: runtimeBootstrapSession.debounceProcess,
        storageGet,
        getAccessToken: runtimeSetupResult.getAccessToken,
        normalizeStoredWatchHistoryCache: runtimeSetupResult.normalizeStoredWatchHistoryCache,
        isWatchHistoryCacheValid: runtimeSetupResult.isWatchHistoryCacheValid,
        normalizeStoredWatchlistCache: runtimeSetupResult.normalizeStoredWatchlistCache,
        isWatchlistCacheValid: runtimeSetupResult.isWatchlistCacheValid,
        normalizeEntriesFromApiRows: runtimeSetupResult.normalizeEntriesFromApiRows,
        defaultSettings: runtimeBootstrapSession.defaultSettings,
        validSortModes: runtimeBootstrapSession.validSortModes,
        defaultSortMode: runtimeBootstrapSession.defaultSortMode,
        runtimeConstants: runtimeBootstrapSession.runtimeConstants,
        listKnownSeries: runtimeSetupResult.listKnownSeries,
        dumpSeriesApiData: runtimeSetupResult.dumpSeriesApiData,
        printSeriesApiData: runtimeSetupResult.printSeriesApiData,
      }),
    )
  }

  function bindBootstrapFinalizeRuntimeMethodsForContext({
    bootstrapFinalizeRuntime,
    setProcessWatchlist,
    setSyncRouteRuntime,
    setDestroyRuntime,
    setBootstrapIssue,
    clearStaleInjectedShell,
  }: {
    bootstrapFinalizeRuntime: LooseRecord
    setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void
    setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void
    setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void
    setBootstrapIssue: (reason: string, payload?: LooseRecord) => void
    clearStaleInjectedShell: (reason: string) => void
  }): boolean {
    if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.processWatchlist === 'function') {
      setProcessWatchlist(bootstrapFinalizeRuntime.processWatchlist as AnyFn)
    }
    if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.syncRoute === 'function') {
      setSyncRouteRuntime(() => (bootstrapFinalizeRuntime.syncRoute as AnyFn)())
    }
    if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.destroy === 'function') {
      setDestroyRuntime(() => (bootstrapFinalizeRuntime.destroy as AnyFn)())
    }
    if (!bootstrapFinalizeRuntime || typeof bootstrapFinalizeRuntime.init !== 'function') {
      setBootstrapIssue('missing-bootstrap-finalize-runtime')
      clearStaleInjectedShell('missing-bootstrap-finalize-runtime')
      return false
    }
    return true
  }

  function runBootstrapFinalizeInitFlowForContext({
    bootstrapFinalizeRuntime,
    updateDiagnostics,
    startDomRuntimeLockHeartbeat,
    startWatchlistHealthRuntime,
    runtimeEvent,
    setBootstrapIssue,
    shutdownRuntime,
    clearStaleInjectedShell,
  }: {
    bootstrapFinalizeRuntime: LooseRecord
    updateDiagnostics: (payload: LooseRecord) => void
    startDomRuntimeLockHeartbeat: () => void
    startWatchlistHealthRuntime: () => void
    runtimeEvent: (event: string, payload?: LooseRecord) => void
    setBootstrapIssue: (reason: string, payload?: LooseRecord) => void
    shutdownRuntime: (payload?: LooseRecord) => void
    clearStaleInjectedShell: (reason: string) => void
  }): void {
    updateDiagnostics({
      ok: false,
      stage: 'init-started',
    })

    ;((bootstrapFinalizeRuntime.init as AnyFn)() as Promise<unknown>)
      .then(() => {
        updateDiagnostics({
          ok: true,
          stage: 'init-complete',
        })
        startDomRuntimeLockHeartbeat()
        startWatchlistHealthRuntime()
      })
      .catch((error: { message?: string }) => {
        runtimeEvent('init-error', {
          message: error?.message || 'unknown',
        })
        setBootstrapIssue('init-error', {
          message: error?.message || 'unknown',
        })
        shutdownRuntime({
          reason: 'init-error',
          message: error?.message || 'unknown',
        })
        clearStaleInjectedShell('init-error')
      })
  }

  function createContentRuntimeBootstrapSessionRuntime({
    context,
    clearStaleInjectedShell,
    createRuntimeLockLifecycleControl,
  }: {
    context: RuntimeBootstrapHelpersContext
    clearStaleInjectedShell: (reason: string) => void
    createRuntimeLockLifecycleControl: (options: RuntimeLockLifecycleOptions) => RuntimeLockLifecycleControl
  }): RuntimeBootstrapSessionRuntime {
    const runtimeSetupBindingsRuntime = createRuntimeSetupBindingsRuntime()

    return {
      createRuntimeSetupOptions: runtimeSetupBindingsRuntime.createRuntimeSetupOptions,
      applyRuntimeSetupBindings: runtimeSetupBindingsRuntime.applyRuntimeSetupBindings,
      createRuntimeBootstrapSession: ({ bootstrapContext }: { bootstrapContext: LooseRecord }) =>
        createRuntimeBootstrapSessionForContext(context, {
          bootstrapContext,
          createRuntimeLockLifecycleControl,
        }),
      createBootstrapFinalizeRuntimeOptions: (options: LooseRecord) =>
        createBootstrapFinalizeRuntimeOptionsForContext(context, options),
      createBootstrapFinalizeRuntimeFromSetupResult: ({
        windowRef,
        runtimeSetupResult,
        runtimeBootstrapSession,
      }: {
        windowRef: RuntimeWindow
        runtimeSetupResult: LooseRecord
        runtimeBootstrapSession: BootstrapRuntimeSession
      }) =>
        createBootstrapFinalizeRuntimeFromSetupResultForContext({
          context,
          windowRef,
          runtimeSetupResult,
          runtimeBootstrapSession,
        }),
      bindBootstrapFinalizeRuntimeMethods: (options: {
        bootstrapFinalizeRuntime: LooseRecord
        setProcessWatchlist: (nextProcessWatchlist: AnyFn) => void
        setSyncRouteRuntime: (nextSyncRouteRuntime: AnyFn) => void
        setDestroyRuntime: (nextDestroyRuntime: AnyFn) => void
        setBootstrapIssue: (reason: string, payload?: LooseRecord) => void
      }) =>
        bindBootstrapFinalizeRuntimeMethodsForContext({
          ...options,
          clearStaleInjectedShell,
        }),
      runBootstrapFinalizeInitFlow: (options: {
        bootstrapFinalizeRuntime: LooseRecord
        updateDiagnostics: (payload: LooseRecord) => void
        startDomRuntimeLockHeartbeat: () => void
        startWatchlistHealthRuntime: () => void
        runtimeEvent: (event: string, payload?: LooseRecord) => void
        setBootstrapIssue: (reason: string, payload?: LooseRecord) => void
        shutdownRuntime: (payload?: LooseRecord) => void
      }) =>
        runBootstrapFinalizeInitFlowForContext({
          ...options,
          clearStaleInjectedShell,
        }),
    }
  }

  let runtimeRegistry = moduleRegistry.runtimeContentRuntimeBootstrapSession
  if (!runtimeRegistry || typeof runtimeRegistry !== 'object') {
    runtimeRegistry = {}
    moduleRegistry.runtimeContentRuntimeBootstrapSession = runtimeRegistry
  }

  ;(runtimeRegistry as LooseRecord).createContentRuntimeBootstrapSessionRuntime =
    createContentRuntimeBootstrapSessionRuntime
})()
