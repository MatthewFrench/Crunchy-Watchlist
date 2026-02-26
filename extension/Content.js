;(() => {
  const runtimeInstanceStartedAt = Date.now()
  const runtimeInstanceId = `cw-${runtimeInstanceStartedAt}-${Math.random().toString(36).slice(2, 10)}`
  const domRuntimeLockOwnerAttribute = 'data-cw-runtime-owner'
  const domRuntimeLockTimestampAttribute = 'data-cw-runtime-owner-ts'
  const domRuntimeLockStaleMs = 15_000
  const domRuntimeLockHeartbeatMs = 3_000
  const domRuntimeTakeoverGraceMs = 1_500
  const domRuntimeTakeoverPollMs = 75
  const runtimeTakeoverRequestEventName = 'cw-runtime-takeover-request'
  const runtimeControl =
    window.__CW_WATCHLIST_CURATOR_CONTROL__ && typeof window.__CW_WATCHLIST_CURATOR_CONTROL__ === 'object'
      ? window.__CW_WATCHLIST_CURATOR_CONTROL__
      : {}
  window.__CW_WATCHLIST_CURATOR_CONTROL__ = runtimeControl

  const setRuntimeControl = (patch) => {
    Object.assign(runtimeControl, patch)
    window.__CW_WATCHLIST_CURATOR_CONTROL__ = runtimeControl
  }

  const isCurrentRuntimeOwner = () =>
    window.__CW_WATCHLIST_CURATOR_CONTROL__ &&
    window.__CW_WATCHLIST_CURATOR_CONTROL__.activeInstanceId === runtimeInstanceId

  const isCurrentRuntimeActive = () =>
    window.__CW_WATCHLIST_CURATOR_CONTROL__ &&
    window.__CW_WATCHLIST_CURATOR_CONTROL__.activeInstanceId === runtimeInstanceId &&
    window.__CW_WATCHLIST_CURATOR_CONTROL__.active !== false

  const isWatchlistPathWithoutRuntime = (pathname) =>
    typeof pathname === 'string' && pathname.split('/').filter(Boolean).slice(-1)[0] === 'watchlist'

  const resolveRuntimeLockNode = () => window.document.documentElement || window.document.body

  const readRuntimeLockTimestamp = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  const tryAcquireDomRuntimeLock = () => {
    if (!isWatchlistPathWithoutRuntime(window.location.pathname)) {
      return true
    }
    const runtimeLockNode = resolveRuntimeLockNode()
    if (!runtimeLockNode) {
      return true
    }

    const ownerId = runtimeLockNode.getAttribute(domRuntimeLockOwnerAttribute) || ''
    const ownerTimestamp = readRuntimeLockTimestamp(runtimeLockNode.getAttribute(domRuntimeLockTimestampAttribute))
    const hasFreshForeignOwner =
      ownerId && ownerId !== runtimeInstanceId && Date.now() - ownerTimestamp < domRuntimeLockStaleMs
    if (hasFreshForeignOwner) {
      return false
    }

    const now = Date.now()
    runtimeLockNode.setAttribute(domRuntimeLockOwnerAttribute, runtimeInstanceId)
    runtimeLockNode.setAttribute(domRuntimeLockTimestampAttribute, String(now))
    return runtimeLockNode.getAttribute(domRuntimeLockOwnerAttribute) === runtimeInstanceId
  }

  const releaseDomRuntimeLock = () => {
    const runtimeLockNode = resolveRuntimeLockNode()
    if (!runtimeLockNode) {
      return
    }
    if (runtimeLockNode.getAttribute(domRuntimeLockOwnerAttribute) !== runtimeInstanceId) {
      return
    }
    runtimeLockNode.removeAttribute(domRuntimeLockOwnerAttribute)
    runtimeLockNode.removeAttribute(domRuntimeLockTimestampAttribute)
  }

  const parseRuntimeInstanceStartedAt = (instanceId) => {
    if (typeof instanceId !== 'string') {
      return 0
    }

    const match = /^cw-(\d+)-/.exec(instanceId)
    if (!match) {
      return 0
    }

    const parsed = Number(match[1])
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  const dispatchRuntimeTakeoverRequest = (targetInstanceId = '') => {
    try {
      window.document.dispatchEvent(
        new CustomEvent(runtimeTakeoverRequestEventName, {
          detail: {
            requestInstanceId: runtimeInstanceId,
            requestInstanceStartedAt: runtimeInstanceStartedAt,
            targetInstanceId,
          },
        }),
      )
    } catch {
      // no-op
    }
  }

  const requestRuntimeTakeover = (targetInstanceId = '') => {
    try {
      const runtimeControlRef = window.__CW_WATCHLIST_CURATOR_CONTROL__
      const shutdown =
        runtimeControlRef && typeof runtimeControlRef.shutdown === 'function' ? runtimeControlRef.shutdown : null
      const activeInstanceId =
        runtimeControlRef && typeof runtimeControlRef.activeInstanceId === 'string'
          ? runtimeControlRef.activeInstanceId
          : ''
      if (shutdown && activeInstanceId && activeInstanceId !== runtimeInstanceId) {
        shutdown({
          reason: 'dom-runtime-takeover-requested',
          requesterId: runtimeInstanceId,
          requesterStartedAt: runtimeInstanceStartedAt,
          targetInstanceId,
        })
      }
    } catch {
      // no-op
    }

    dispatchRuntimeTakeoverRequest(targetInstanceId)
  }

  const clearStaleInjectedShell = (reason) => {
    if (runtimeControl.active === true && !isCurrentRuntimeOwner()) {
      return
    }

    const hosts = Array.from(window.document.querySelectorAll('.cw-host'))
    hosts.forEach((host) => {
      try {
        host.remove()
      } catch {
        // no-op
      }
    })

    const framedRoots = Array.from(window.document.querySelectorAll('.cw-watchlist-frame'))
    framedRoots.forEach((rootEl) => {
      try {
        rootEl.classList.remove('cw-watchlist-frame')
      } catch {
        // no-op
      }
    })

    const hiddenNativeNodes = Array.from(window.document.querySelectorAll('[data-cw-prev-display]'))
    hiddenNativeNodes.forEach((node) => {
      try {
        node.style.display = node.dataset.cwPrevDisplay != null ? node.dataset.cwPrevDisplay : ''
        delete node.dataset.cwPrevDisplay
      } catch {
        // no-op
      }
    })

    window.__CW_WATCHLIST_CURATOR_LOADED__ = undefined
    releaseDomRuntimeLock()
    setRuntimeControl({
      active: false,
      activeInstanceId: isCurrentRuntimeOwner() ? null : runtimeControl.activeInstanceId || null,
      lastShutdownAt: Date.now(),
      lastShutdownPayload: {
        reason,
        cleanupOnly: true,
      },
    })
  }

  const startRuntime = () => {
    const moduleRegistry = window.__CW_WATCHLIST_CURATOR_MODULES__ || {}
    if (!tryAcquireDomRuntimeLock()) {
      setRuntimeControl({
        active: false,
        activeInstanceId: null,
        lastShutdownAt: Date.now(),
        lastShutdownPayload: {
          reason: 'dom-runtime-lock-held',
        },
      })
      return
    }

    const runtimeContentBootstrapModule = moduleRegistry.runtimeContentBootstrap
    const runtimeContentCompositionModule = moduleRegistry.runtimeContentComposition
    if (
      !runtimeContentBootstrapModule ||
      typeof runtimeContentBootstrapModule.createContentBootstrapPrelude !== 'function'
    ) {
      // eslint-disable-next-line no-console
      console.error('[CW] missing-content-bootstrap-module')
      clearStaleInjectedShell('missing-content-bootstrap-module')
      return
    }

    const bootstrapPrelude = runtimeContentBootstrapModule.createContentBootstrapPrelude({
      windowRef: window,
      consoleRef: console,
      browserRef: typeof browser !== 'undefined' ? browser : undefined,
      chromeRef: typeof chrome !== 'undefined' ? chrome : undefined,
    })
    if (!bootstrapPrelude || bootstrapPrelude.ok !== true) {
      clearStaleInjectedShell('bootstrap-prelude-not-ready')
      return
    }
    const {
      updateDiagnostics,
      setBootstrapIssue,
      runtimeBootstrapGateModule,
      runtimeBootstrapModulesModule,
      runtimeBootstrapFinalizeModule,
      bootstrapModulesRuntime,
    } = bootstrapPrelude
    if (
      !runtimeContentCompositionModule ||
      typeof runtimeContentCompositionModule.createContentComposition !== 'function'
    ) {
      setBootstrapIssue('missing-content-composition-module')
      clearStaleInjectedShell('missing-content-composition-module')
      return
    }

    const {
      runtimeStoreModule,
      runtimeTraceModule,
      runtimeStateLoaderModule,
      runtimeLifecycleModule,
      runtimePreferredAudioModule,
      runtimeRenderableModule,
      runtimeCuratedPanelModule,
      runtimeCuratedLoaderModule,
      runtimeNativeBridgeModule,
      runtimeCuratedInteractionsModule,
      runtimeInterfaceShellModule,
      runtimeDebugModule,
      runtimeBootstrapHelpersModule,
      storageModule,
      apiContractsModule,
      authClientModule,
      watchlistClientModule,
      watchlistRepositoryModule,
      historyRepositoryModule,
      ratingsClientModule,
      ratingsRepositoryModule,
      previewRepositoryModule,
      corePrimitivesModule,
      imageVariantsModule,
      entryNormalizerModule,
      sortMetricsModule,
      entrySortingModule,
      cardMetadataModule,
      controlsViewModule,
      cardViewModule,
      cardShellModule,
      defaultSortMode: DEFAULT_SORT_MODE,
      validSortModes: VALID_SORT_MODES,
      sortModeControlOptions: SORT_MODE_CONTROL_OPTIONS,
      defaultSettings: DEFAULT_SETTINGS,
      runtimeConstants,
    } = bootstrapModulesRuntime
    const assertRuntimeMethods = runtimeBootstrapModulesModule.assertRuntimeMethods

    const createEmptyWatchHistoryCache = () =>
      runtimeStoreModule.createEmptyWatchHistoryCache(runtimeConstants.watchHistoryCacheVersion)
    const createWatchlistCacheSnapshot = (...args) => runtimeStoreModule.createWatchlistCacheSnapshot(...args)
    const state = runtimeStoreModule.createRuntimeState({
      defaultSettings: DEFAULT_SETTINGS,
      watchHistoryCacheVersion: runtimeConstants.watchHistoryCacheVersion,
    })

    const storageLocalArea =
      (typeof browser !== 'undefined' && browser.storage && browser.storage.local) ||
      (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) ||
      null

    const isWatchlistPath = (pathname) => runtimeBootstrapGateModule.isWatchlistPath(pathname)

    let processWatchlist = async () => {}
    let runtimeEvent = () => {}
    let pushApiTrace = () => {}
    let destroyRuntime = () => {}
    let syncRouteRuntime = () => {}
    let blankShellRecoveryTimer = null
    let domRuntimeLockHeartbeatTimer = null
    let runtimeTakeoverRequestListener = null
    let watchlistHealthIssueDetectedAt = 0
    let watchlistHealthIssueType = ''
    const blankShellReloadStorageKey = 'cw_blank_watchlist_reload_at_v1'
    const blankShellReloadCountStorageKey = 'cw_blank_watchlist_reload_count_v1'
    const blankShellReloadCooldownMs = 60_000
    const blankShellReloadMaxPerSession = 1
    const blankShellRecoveryStabilizeMs = 4_000
    const blankShellCheckIntervalMs = 5_000

    const clearBlankShellRecoveryTimer = () => {
      if (blankShellRecoveryTimer != null) {
        clearInterval(blankShellRecoveryTimer)
        blankShellRecoveryTimer = null
      }
    }

    const clearDomRuntimeLockHeartbeatTimer = () => {
      if (domRuntimeLockHeartbeatTimer != null) {
        clearInterval(domRuntimeLockHeartbeatTimer)
        domRuntimeLockHeartbeatTimer = null
      }
    }

    const clearRuntimeTakeoverRequestListener = () => {
      if (!runtimeTakeoverRequestListener) {
        return
      }

      window.document.removeEventListener(runtimeTakeoverRequestEventName, runtimeTakeoverRequestListener)
      runtimeTakeoverRequestListener = null
    }

    const startDomRuntimeLockHeartbeat = () => {
      clearDomRuntimeLockHeartbeatTimer()
      domRuntimeLockHeartbeatTimer = window.setInterval(() => {
        if (!isCurrentRuntimeActive()) {
          return
        }
        const acquired = tryAcquireDomRuntimeLock()
        if (acquired) {
          return
        }
        runtimeEvent('runtime-lock-lost', {
          reason: 'dom-runtime-lock-held-by-another-instance',
        })
        shutdownRuntime({
          reason: 'dom-runtime-lock-lost',
        })
      }, domRuntimeLockHeartbeatMs)
    }

    const startRuntimeTakeoverRequestListener = () => {
      clearRuntimeTakeoverRequestListener()
      runtimeTakeoverRequestListener = (event) => {
        const detail = event?.detail && typeof event.detail === 'object' ? event.detail : null
        if (!detail || !isCurrentRuntimeActive()) {
          return
        }

        const requesterId = typeof detail.requestInstanceId === 'string' ? detail.requestInstanceId : ''
        if (!requesterId || requesterId === runtimeInstanceId) {
          return
        }

        const targetInstanceId = typeof detail.targetInstanceId === 'string' ? detail.targetInstanceId : ''
        if (targetInstanceId && targetInstanceId !== runtimeInstanceId) {
          return
        }

        const requesterStartedAtNumber = Number(detail.requestInstanceStartedAt)
        const requesterStartedAt =
          Number.isFinite(requesterStartedAtNumber) && requesterStartedAtNumber > 0
            ? requesterStartedAtNumber
            : parseRuntimeInstanceStartedAt(requesterId)
        const shouldYield =
          requesterStartedAt > runtimeInstanceStartedAt ||
          (requesterStartedAt === runtimeInstanceStartedAt && requesterId > runtimeInstanceId)
        if (!shouldYield) {
          return
        }

        runtimeEvent('runtime-takeover-yield', {
          requesterId,
          requesterStartedAt,
        })
        shutdownRuntime({
          reason: 'runtime-takeover-yield',
          requesterId,
          requesterStartedAt,
        })
      }
      window.document.addEventListener(runtimeTakeoverRequestEventName, runtimeTakeoverRequestListener)
    }

    const readLastBlankShellReloadAt = () => {
      try {
        const raw = window.sessionStorage.getItem(blankShellReloadStorageKey)
        const parsed = Number(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
      } catch {
        return 0
      }
    }

    const writeLastBlankShellReloadAt = (value) => {
      try {
        window.sessionStorage.setItem(blankShellReloadStorageKey, String(value))
      } catch {
        // no-op
      }
    }

    const readBlankShellReloadCount = () => {
      try {
        const raw = window.sessionStorage.getItem(blankShellReloadCountStorageKey)
        const parsed = Number(raw)
        return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0
      } catch {
        return 0
      }
    }

    const writeBlankShellReloadCount = (value) => {
      try {
        window.sessionStorage.setItem(blankShellReloadCountStorageKey, String(Math.max(0, Math.round(value))))
      } catch {
        // no-op
      }
    }

    const isCuratedHostElement = (value) =>
      Boolean(value?.classList && typeof value.classList.contains === 'function' && value.classList.contains('cw-host'))

    const isHiddenElement = (value) =>
      Boolean(
        value?.style &&
          typeof value.style === 'object' &&
          typeof value.style.display === 'string' &&
          value.style.display === 'none',
      )

    const isCuratedTabActive = () => {
      if (!state.settings || typeof state.settings !== 'object') {
        return false
      }
      return state.settings.activeTab === 'curated'
    }

    const getWatchlistHealthIssue = () => {
      if (!state.mounted) {
        return ''
      }
      if (!isWatchlistPath(window.location.pathname)) {
        return ''
      }
      if (!isCuratedTabActive()) {
        return ''
      }

      const watchlistRoot = runtimeBootstrapGateModule.getWatchlistRoot(window.document)
      if (!watchlistRoot) {
        return ''
      }

      const curatedHosts = Array.from(watchlistRoot.children || []).filter((child) => isCuratedHostElement(child))
      if (curatedHosts.length > 1) {
        return 'duplicate-host'
      }
      if (isHiddenElement(state.hostEl)) {
        return 'hidden-host'
      }

      const rootHasFrame = Boolean(
        watchlistRoot.classList &&
          typeof watchlistRoot.classList.contains === 'function' &&
          watchlistRoot.classList.contains('cw-watchlist-frame'),
      )
      const hostConnected =
        Boolean(state.hostEl?.isConnected && typeof watchlistRoot.contains === 'function') &&
        watchlistRoot.contains(state.hostEl)
      const gridConnected = Boolean(state.gridEl?.isConnected && state.hostEl?.contains(state.gridEl))

      if (rootHasFrame && (!hostConnected || !gridConnected)) {
        return 'missing-shell'
      }

      if (!hostConnected || !gridConnected) {
        return ''
      }

      const hasRenderedGridChildren = state.gridEl.children.length > 0
      if (hasRenderedGridChildren) {
        return ''
      }

      const loadingUi = state.hostEl.querySelector('.cw-empty .cw-loading')
      if (loadingUi || state.curatedInflight || state.curatedPendingRequests.length > 0) {
        return ''
      }

      if (state.curatedError) {
        return ''
      }

      const hasCuratedShellScaffold = Boolean(
        state.hostEl.querySelector('.cw-tabs') && state.hostEl.querySelector('.cw-panel'),
      )
      if (!hasCuratedShellScaffold) {
        return 'missing-shell'
      }

      return 'blank-shell'
    }

    const runBlankShellRecoveryCheck = () => {
      const healthIssue = getWatchlistHealthIssue()
      if (!healthIssue) {
        watchlistHealthIssueDetectedAt = 0
        watchlistHealthIssueType = ''
        return
      }

      const now = Date.now()
      if (!watchlistHealthIssueDetectedAt || watchlistHealthIssueType !== healthIssue) {
        watchlistHealthIssueDetectedAt = now
        watchlistHealthIssueType = healthIssue
        runtimeEvent('watchlist-health-issue-detected', {
          issue: healthIssue,
          action: 'soft-recover',
        })
      }
      syncRouteRuntime()
      processWatchlist().catch(() => {
        // no-op
      })

      if (now - watchlistHealthIssueDetectedAt < blankShellRecoveryStabilizeMs) {
        return
      }

      if (healthIssue !== 'blank-shell') {
        return
      }

      const reloadCount = readBlankShellReloadCount()
      if (reloadCount >= blankShellReloadMaxPerSession) {
        runtimeEvent('watchlist-health-reload-suppressed', {
          issue: healthIssue,
          reason: 'reload-budget-exhausted',
          reloadCount,
        })
        return
      }

      const lastReloadAt = readLastBlankShellReloadAt()
      if (now - lastReloadAt < blankShellReloadCooldownMs) {
        runtimeEvent('watchlist-health-reload-suppressed', {
          issue: healthIssue,
          sinceLastReloadMs: now - lastReloadAt,
        })
        return
      }

      writeLastBlankShellReloadAt(now)
      writeBlankShellReloadCount(reloadCount + 1)
      runtimeEvent('watchlist-health-reload', {
        issue: healthIssue,
        sinceDetectedMs: now - watchlistHealthIssueDetectedAt,
        reloadCount: reloadCount + 1,
      })
      window.location.reload()
    }

    const startBlankShellRecoveryWatcher = () => {
      clearBlankShellRecoveryTimer()
      blankShellRecoveryTimer = window.setInterval(() => {
        runBlankShellRecoveryCheck()
      }, blankShellCheckIntervalMs)
    }

    const shutdownRuntime = (payload = {}) => {
      clearRuntimeTakeoverRequestListener()
      clearBlankShellRecoveryTimer()
      clearDomRuntimeLockHeartbeatTimer()
      if (state.processTimer != null) {
        clearTimeout(state.processTimer)
        state.processTimer = null
      }
      try {
        destroyRuntime()
      } catch {
        // no-op
      }
      releaseDomRuntimeLock()
      if (isCurrentRuntimeOwner()) {
        setRuntimeControl({
          active: false,
          activeInstanceId: null,
          lastShutdownAt: Date.now(),
          lastShutdownPayload: payload,
        })
      }
    }

    setRuntimeControl({
      version: window.__CW_WATCHLIST_CURATOR_LOADED__?.version || '0',
      active: true,
      activeInstanceId: runtimeInstanceId,
      activeInstanceClaimedAt: runtimeInstanceStartedAt,
      shutdown: (payload) => {
        runtimeEvent('shutdown-requested', payload || null)
        shutdownRuntime(payload || {})
      },
    })
    startRuntimeTakeoverRequestListener()

    function debounceProcess() {
      clearTimeout(state.processTimer)
      state.processTimer = window.setTimeout(() => {
        processWatchlist().catch(() => {
          // no-op
        })
      }, runtimeConstants.processDebounceMs)
    }

    const safeJsonParse = (value, fallback) => runtimeBootstrapFinalizeModule.safeJsonParse(value, fallback)
    const storageAdapter = storageModule.createStorageAdapter({
      storageArea: storageLocalArea,
      parseJson: safeJsonParse,
      localStorageRef: window.localStorage,
      timeoutMs: 1500,
    })
    const storageAccessors = runtimeBootstrapFinalizeModule.createStorageAccessors({
      storageAdapter,
    })
    const storageGet = (key, fallback) => storageAccessors.storageGet(key, fallback)
    const storageSet = (key, value) => storageAccessors.storageSet(key, value)

    let normalizeEntriesFromApiRows,
      fetchWithResilience,
      getAccessToken,
      createAuthRefreshHandler,
      fetchAllWatchlistRows,
      normalizeStoredWatchlistCache,
      isWatchlistCacheValid,
      resetWatchlistCacheOnAccountMismatch,
      fetchRatingsBatch,
      fetchRating,
      preloadRatingsForEntries,
      fetchPreviewUrlForEntry,
      normalizeStoredWatchHistoryCache,
      isWatchHistoryCacheValid,
      getCachedWatchHistory,
      getCachedWatchHistoryProgress,
      preloadWatchHistoryForEntries,
      isLocalizedWatchHistoryDataMissingForEntries,
      getCachedRating,
      isLocalizedRatingDataMissingForEntries,
      detectPreferredAudioLanguage,
      ensureCuratedDataLoad,
      renderCuratedPanel,
      clearRootFrame,
      setNativeVisibility,
      applyTabUi,
      ensureInterface,
      listKnownSeries,
      dumpSeriesApiData,
      resolveApiHref,
      normalizeImageUrlCandidate,
      extractCoverImagesFromApiImages,
      extractThumbnailImageFromApiImages,
      scheduleSaveRatings,
      scheduleSaveWatchHistory,
      scheduleSaveWatchlistCache,
      getPreferredAudioLanguage,
      preloadRatingsForSelectedAudioLocale,
      preloadWatchHistoryForSelectedAudioLocale,
      toggleCuratedFavorite,
      removeCuratedSeries,
      isLikelyVideoUrl,
      isEntryWatchReady,
      withMutedObserver,
      applyCardLayoutUi,
      persistSettings,
      printSeriesApiData
    let setWatchlistCacheRows = (accountId = '', rows = [], updatedAt = Date.now()) => {
      state.watchlistCache = createWatchlistCacheSnapshot(accountId, updatedAt, rows)
      return state.watchlistCache
    }

    try {
      const runtimeTrace = runtimeTraceModule.createRuntimeTrace({
        windowRef: window,
        state,
        apiTraceLimitPerEndpoint: runtimeConstants.apiTraceLimitPerEndpoint,
      })
      assertRuntimeMethods('runtime trace', runtimeTrace, ['runtimeEvent', 'pushApiTrace'])
      runtimeEvent = runtimeTrace.runtimeEvent
      pushApiTrace = runtimeTrace.pushApiTrace

      const corePrimitives = corePrimitivesModule.createCorePrimitives({
        extractCoverImagesFromApiImages: (images) => extractCoverImagesFromApiImages(images),
      })
      assertRuntimeMethods('core primitives', corePrimitives, [
        'sanitizeRating',
        'parseCmsObjectRecord',
        'deriveDisplayStatusBase',
      ])

      const apiContracts = apiContractsModule.createApiContracts({
        windowRef: window,
        navigatorRef: window.navigator,
        runtimeEvent,
        parseDateMs: (value) => corePrimitives.parseDateMs(value),
        getWatchlistSeriesId: (entry) => corePrimitives.getWatchlistSeriesId(entry),
        getWatchHistorySeriesId: (entry) => corePrimitives.getWatchHistorySeriesId(entry),
        fetchBackoffBaseMs: runtimeConstants.fetchBackoffBaseMs,
        fetchBackoffJitterMs: runtimeConstants.fetchBackoffJitterMs,
      })
      assertRuntimeMethods('api contracts', apiContracts, [
        'shouldRetryStatus',
        'requirePayloadDataArray',
        'resolveApiHref',
      ])

      resolveApiHref = apiContracts.resolveApiHref

      const preferredAudioDetector = runtimePreferredAudioModule.createPreferredAudioDetector({
        normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
        parseJson: safeJsonParse,
        localStorageRef: window.localStorage,
        navigatorRef: window.navigator,
        documentRef: window.document,
        storageScanLimit: runtimeConstants.preferredAudioStorageScanLimit,
        valueScanLimit: runtimeConstants.preferredAudioValueScanLimit,
      })
      assertRuntimeMethods('preferred audio detector', preferredAudioDetector, ['detectPreferredAudioLanguage'])
      detectPreferredAudioLanguage = () => preferredAudioDetector.detectPreferredAudioLanguage()

      const bootstrapHelpersRuntime = runtimeBootstrapHelpersModule.createBootstrapHelpersRuntime({
        state,
        windowRef: window,
        runtimeEvent,
        storageSet: (key, value) => storageSet(key, value),
        settingsKey: runtimeConstants.settingsKey,
        ratingCacheKey: runtimeConstants.ratingCacheKey,
        watchHistoryCacheKey: runtimeConstants.watchHistoryCacheKey,
        watchlistCacheKey: runtimeConstants.watchlistCacheKey,
        preferredAudioCacheTtlMs: runtimeConstants.preferredAudioCacheTtlMs,
        normalizeAudioLocale: (value) => corePrimitives.normalizeAudioLocale(value),
        detectPreferredAudioLanguage: () => detectPreferredAudioLanguage(),
        isLocalizedRatingDataMissingForEntries: (entries, audioLocale) =>
          isLocalizedRatingDataMissingForEntries(entries, audioLocale),
        isLocalizedWatchHistoryDataMissingForEntries: (entries, audioLocale) =>
          isLocalizedWatchHistoryDataMissingForEntries(entries, audioLocale),
        getAccessToken: (forceRefresh = false) => getAccessToken(forceRefresh),
        preloadRatingsForEntries: (entries, tokenEntry, preferredAudioLanguage) =>
          preloadRatingsForEntries(entries, tokenEntry, preferredAudioLanguage),
        preloadWatchHistoryForEntries: (entries, tokenEntry, force, preferredAudioLanguage) =>
          preloadWatchHistoryForEntries(entries, tokenEntry, force, preferredAudioLanguage),
      })
      assertRuntimeMethods('bootstrap helpers runtime', bootstrapHelpersRuntime, [
        'scheduleSaveRatings',
        'scheduleSaveWatchHistory',
        'scheduleSaveWatchlistCache',
        'getPreferredAudioLanguage',
        'preloadRatingsForSelectedAudioLocale',
        'preloadWatchHistoryForSelectedAudioLocale',
        'toggleCuratedFavorite',
        'removeCuratedSeries',
        'isLikelyVideoUrl',
        'isEntryWatchReady',
        'withMutedObserver',
        'applyCardLayoutUi',
        'persistSettings',
      ])
      scheduleSaveRatings = bootstrapHelpersRuntime.scheduleSaveRatings
      scheduleSaveWatchHistory = bootstrapHelpersRuntime.scheduleSaveWatchHistory
      scheduleSaveWatchlistCache = bootstrapHelpersRuntime.scheduleSaveWatchlistCache
      getPreferredAudioLanguage = bootstrapHelpersRuntime.getPreferredAudioLanguage
      preloadRatingsForSelectedAudioLocale = bootstrapHelpersRuntime.preloadRatingsForSelectedAudioLocale
      preloadWatchHistoryForSelectedAudioLocale = bootstrapHelpersRuntime.preloadWatchHistoryForSelectedAudioLocale
      toggleCuratedFavorite = bootstrapHelpersRuntime.toggleCuratedFavorite
      removeCuratedSeries = bootstrapHelpersRuntime.removeCuratedSeries
      isLikelyVideoUrl = bootstrapHelpersRuntime.isLikelyVideoUrl
      isEntryWatchReady = bootstrapHelpersRuntime.isEntryWatchReady
      withMutedObserver = bootstrapHelpersRuntime.withMutedObserver
      applyCardLayoutUi = bootstrapHelpersRuntime.applyCardLayoutUi
      persistSettings = bootstrapHelpersRuntime.persistSettings

      const authClient = authClientModule.createAuthClient({
        state,
        runtimeEvent,
        pushApiTrace,
        resolveApiHref,
        sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
        shouldRetryStatus: apiContracts.shouldRetryStatus,
        computeFetchRetryDelayMs: apiContracts.computeFetchRetryDelayMs,
        sleep: apiContracts.sleep,
        fetchTimeoutMs: runtimeConstants.fetchTimeoutMs,
        fetchMaxAttempts: runtimeConstants.fetchMaxAttempts,
        authTokenSkewMs: runtimeConstants.authTokenSkewMs,
        authClientBasic: runtimeConstants.authClientBasic,
        authDeviceKey: runtimeConstants.authDeviceKey,
        localStorageRef: window.localStorage,
        navigatorRef: window.navigator,
        cryptoRef: window.crypto,
        fetchImpl: window.fetch.bind(window),
      })
      assertRuntimeMethods('auth client', authClient, [
        'fetchWithResilience',
        'getAccessToken',
        'createAuthRefreshHandler',
      ])
      fetchWithResilience = authClient.fetchWithResilience
      getAccessToken = authClient.getAccessToken
      createAuthRefreshHandler = authClient.createAuthRefreshHandler

      const imageVariants = imageVariantsModule.createImageVariants({
        sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
        resolveApiHref,
      })
      assertRuntimeMethods('image variants', imageVariants, [
        'normalizeImageUrlCandidate',
        'extractCoverImagesFromApiImages',
        'extractThumbnailImageFromApiImages',
      ])
      normalizeImageUrlCandidate = imageVariants.normalizeImageUrlCandidate
      extractCoverImagesFromApiImages = imageVariants.extractCoverImagesFromApiImages
      extractThumbnailImageFromApiImages = imageVariants.extractThumbnailImageFromApiImages

      const ratingsClient = ratingsClientModule.createRatingsClient({
        fetchWithResilience,
        getAccessToken,
        createAuthRefreshHandler,
        resolveApiHref,
        normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
        getPreferredAudioLanguage,
        getLocale: apiContracts.getLocale,
        requirePayloadDataArray: apiContracts.requirePayloadDataArray,
        auditCmsObjectContract: apiContracts.auditCmsObjectContract,
        parseCmsObjectRecord: corePrimitives.parseCmsObjectRecord,
        parseRatingPayload: corePrimitives.parseRatingPayload,
        sanitizeRating: corePrimitives.sanitizeRating,
        sanitizeVotes: corePrimitives.sanitizeVotes,
        pushApiTrace,
      })
      assertRuntimeMethods('ratings client', ratingsClient, ['fetchRatingsBatch', 'fetchRating'])
      fetchRatingsBatch = ratingsClient.fetchRatingsBatch
      fetchRating = ratingsClient.fetchRating

      const ratingsRepository = ratingsRepositoryModule.createRatingsRepository({
        state,
        normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
        normalizeAudioLocales: corePrimitives.normalizeAudioLocales,
        sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
        normalizeTagList: corePrimitives.normalizeTagList,
        normalizeImageUrlCandidate,
        getAudioLocaleCountFromMap: corePrimitives.getAudioLocaleCountFromMap,
        mergeAudioLocaleCountMap: corePrimitives.mergeAudioLocaleCountMap,
        getPreferredAudioLanguage,
        chunkArray: corePrimitives.chunkArray,
        fetchRatingsBatch,
        fetchRating,
        scheduleSaveRatings,
        runtimeEvent,
        ratingBatchSize: runtimeConstants.ratingBatchSize,
        ratingCacheTtlMs: runtimeConstants.ratingCacheTtlMs,
      })
      assertRuntimeMethods('ratings repository', ratingsRepository, [
        'getSeriesRating',
        'preloadRatingsForEntries',
        'getCachedRating',
        'isLocalizedRatingDataMissingForEntries',
      ])
      preloadRatingsForEntries = ratingsRepository.preloadRatingsForEntries
      getCachedRating = ratingsRepository.getCachedRating
      isLocalizedRatingDataMissingForEntries = ratingsRepository.isLocalizedRatingDataMissingForEntries

      const watchlistClient = watchlistClientModule.createWatchlistClient({
        fetchWithResilience,
        createAuthRefreshHandler,
        resolveApiHref,
        requirePayloadDataArray: apiContracts.requirePayloadDataArray,
        auditWatchlistRowsContract: apiContracts.auditWatchlistRowsContract,
        getPreferredAudioLanguage,
        getLocale: apiContracts.getLocale,
        getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId,
        pushApiTrace,
        runtimeEvent,
        watchlistPageSize: runtimeConstants.watchlistPageSize,
        watchlistMaxPages: runtimeConstants.watchlistMaxPages,
      })
      assertRuntimeMethods('watchlist client', watchlistClient, ['fetchAllWatchlistRows'])
      fetchAllWatchlistRows = watchlistClient.fetchAllWatchlistRows

      const watchlistRepository = watchlistRepositoryModule.createWatchlistRepository({
        state,
        createWatchlistCacheSnapshot,
        scheduleSaveWatchlistCache,
        watchlistCacheTtlMs: runtimeConstants.watchlistCacheTtlMs,
      })
      assertRuntimeMethods('watchlist repository', watchlistRepository, [
        'normalizeStoredWatchlistCache',
        'isWatchlistCacheValid',
        'resetWatchlistCacheOnAccountMismatch',
        'setWatchlistCacheRows',
      ])
      normalizeStoredWatchlistCache = watchlistRepository.normalizeStoredWatchlistCache
      isWatchlistCacheValid = watchlistRepository.isWatchlistCacheValid
      resetWatchlistCacheOnAccountMismatch = watchlistRepository.resetWatchlistCacheOnAccountMismatch
      setWatchlistCacheRows = watchlistRepository.setWatchlistCacheRows

      const historyRepository = historyRepositoryModule.createHistoryRepository({
        state,
        normalizeAudioLocale: corePrimitives.normalizeAudioLocale,
        sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
        parseDateMs: corePrimitives.parseDateMs,
        pickFirstPositiveInt: corePrimitives.pickFirstPositiveInt,
        deriveCanonicalEpisodeKeyFromEpisodeMetadata: corePrimitives.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
        getAbsoluteEpisodeNumberFromEpisodeMetadata: corePrimitives.getAbsoluteEpisodeNumberFromEpisodeMetadata,
        getPreferredAudioLanguage,
        getLocale: apiContracts.getLocale,
        resolveApiHref,
        fetchWithResilience,
        createAuthRefreshHandler,
        requirePayloadDataArray: apiContracts.requirePayloadDataArray,
        auditWatchHistoryRowsContract: apiContracts.auditWatchHistoryRowsContract,
        createEmptyWatchHistoryCache,
        scheduleSaveWatchHistory,
        pushApiTrace,
        runtimeEvent,
        watchHistoryCacheVersion: runtimeConstants.watchHistoryCacheVersion,
        watchHistoryCacheTtlMs: runtimeConstants.watchHistoryCacheTtlMs,
        watchHistoryPageSize: runtimeConstants.watchHistoryPageSize,
        watchHistoryMaxPages: runtimeConstants.watchHistoryMaxPages,
        watchHistoryNoMatchPageLimit: runtimeConstants.watchHistoryNoMatchPageLimit,
      })
      assertRuntimeMethods('history repository', historyRepository, [
        'normalizeStoredWatchHistoryCache',
        'isWatchHistoryCacheValid',
        'getCachedWatchHistory',
        'getCachedWatchHistoryProgress',
        'preloadWatchHistoryForEntries',
        'isLocalizedWatchHistoryDataMissingForEntries',
      ])
      normalizeStoredWatchHistoryCache = historyRepository.normalizeStoredWatchHistoryCache
      isWatchHistoryCacheValid = historyRepository.isWatchHistoryCacheValid
      getCachedWatchHistory = historyRepository.getCachedWatchHistory
      getCachedWatchHistoryProgress = historyRepository.getCachedWatchHistoryProgress
      preloadWatchHistoryForEntries = historyRepository.preloadWatchHistoryForEntries
      isLocalizedWatchHistoryDataMissingForEntries = historyRepository.isLocalizedWatchHistoryDataMissingForEntries

      const previewRepository = previewRepositoryModule.createPreviewRepository({
        state,
        resolveApiHref,
        getAccessToken,
        fetchWithResilience,
        createAuthRefreshHandler,
        pushApiTrace,
        runtimeEvent,
      })
      assertRuntimeMethods('preview repository', previewRepository, ['fetchPreviewUrlForEntry'])
      fetchPreviewUrlForEntry = previewRepository.fetchPreviewUrlForEntry

      const contentCompositionRuntime = runtimeContentCompositionModule.createContentComposition({
        windowRef: window,
        state,
        runtimeConstants,
        sortModeControlOptions: SORT_MODE_CONTROL_OPTIONS,
        assertRuntimeMethods,
        corePrimitives,
        modules: {
          entryNormalizerModule,
          sortMetricsModule,
          entrySortingModule,
          cardMetadataModule,
          controlsViewModule,
          cardViewModule,
          cardShellModule,
          runtimeRenderableModule,
          runtimeCuratedPanelModule,
          runtimeCuratedLoaderModule,
          runtimeNativeBridgeModule,
          runtimeCuratedInteractionsModule,
          runtimeInterfaceShellModule,
          runtimeDebugModule,
        },
        dependencies: {
          extractCoverImagesFromApiImages,
          extractThumbnailImageFromApiImages,
          normalizeImageUrlCandidate,
          getPreferredAudioLanguage,
          getCachedRating,
          getCachedWatchHistory,
          getCachedWatchHistoryProgress,
          isEntryWatchReady,
          isLocalizedRatingDataMissingForEntries,
          isLocalizedWatchHistoryDataMissingForEntries,
          preloadRatingsForSelectedAudioLocale,
          preloadWatchHistoryForSelectedAudioLocale,
          getAccessToken,
          fetchWithResilience,
          createAuthRefreshHandler,
          resetWatchlistCacheOnAccountMismatch,
          fetchAllWatchlistRows,
          preloadRatingsForEntries,
          preloadWatchHistoryForEntries,
          setWatchlistCacheRows,
          fetchPreviewUrlForEntry,
          isLikelyVideoUrl,
          toggleCuratedFavorite,
          removeCuratedSeries,
          persistSettings,
          debounceProcess,
          isWatchlistPath,
          withMutedObserver,
          applyCardLayoutUi,
          createEmptyWatchHistoryCache: () => createEmptyWatchHistoryCache(),
          getWatchlistRoot: (documentRef) => runtimeBootstrapGateModule.getWatchlistRoot(documentRef),
          getWatchlistHeader: (documentRef) => runtimeBootstrapGateModule.getWatchlistHeader(documentRef),
          storageSet: (key, value) => storageSet(key, value),
          runtimeEvent,
          resolveApiHref,
        },
      })
      assertRuntimeMethods('content composition runtime', contentCompositionRuntime, [
        'normalizeEntriesFromApiRows',
        'ensureInterface',
        'listKnownSeries',
      ])
      ;({
        normalizeEntriesFromApiRows,
        ensureCuratedDataLoad,
        renderCuratedPanel,
        clearRootFrame,
        setNativeVisibility,
        applyTabUi,
        ensureInterface,
        listKnownSeries,
        dumpSeriesApiData,
        printSeriesApiData,
      } = contentCompositionRuntime)
    } catch (error) {
      setBootstrapIssue('runtime-module-initialization-failed', {
        message: error?.message || 'unknown',
      })
      clearStaleInjectedShell('runtime-module-initialization-failed')
      return
    }
    const bootstrapFinalizeRuntime = runtimeBootstrapFinalizeModule.createBootstrapFinalizeRuntime({
      windowRef: window,
      runtimeEvent,
      runtimeLifecycleModule,
      runtimeLifecycleOptions: {
        state,
        runtimeEvent,
        isRuntimeActive: () => isCurrentRuntimeActive(),
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
        runtimeEvent,
        normalizeStoredWatchHistoryCache,
        isWatchHistoryCacheValid,
        normalizeStoredWatchlistCache,
        isWatchlistCacheValid,
        normalizeEntriesFromApiRows,
        defaultSettings: DEFAULT_SETTINGS,
        validSortModes: VALID_SORT_MODES,
        defaultSortMode: DEFAULT_SORT_MODE,
        settingsKey: runtimeConstants.settingsKey,
        ratingCacheKey: runtimeConstants.ratingCacheKey,
        watchHistoryCacheKey: runtimeConstants.watchHistoryCacheKey,
        watchlistCacheKey: runtimeConstants.watchlistCacheKey,
      },
      listKnownSeries,
      dumpSeriesApiData,
      printSeriesApiData,
    })
    if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.processWatchlist === 'function') {
      processWatchlist = bootstrapFinalizeRuntime.processWatchlist
    }
    if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.syncRoute === 'function') {
      syncRouteRuntime = () => bootstrapFinalizeRuntime.syncRoute()
    }
    if (bootstrapFinalizeRuntime && typeof bootstrapFinalizeRuntime.destroy === 'function') {
      destroyRuntime = () => bootstrapFinalizeRuntime.destroy()
    }
    if (!bootstrapFinalizeRuntime || typeof bootstrapFinalizeRuntime.init !== 'function') {
      setBootstrapIssue('missing-bootstrap-finalize-runtime')
      clearStaleInjectedShell('missing-bootstrap-finalize-runtime')
      return
    }

    updateDiagnostics({
      ok: false,
      stage: 'init-started',
    })

    bootstrapFinalizeRuntime
      .init()
      .then(() => {
        updateDiagnostics({
          ok: true,
          stage: 'init-complete',
        })
        startDomRuntimeLockHeartbeat()
        startBlankShellRecoveryWatcher()
      })
      .catch((error) => {
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

  let runtimeBootstrapStarted = false

  const startRuntimeOnce = () => {
    if (runtimeBootstrapStarted) {
      return
    }
    runtimeBootstrapStarted = true
    startRuntime()
  }

  const beginRuntimeBootstrap = () => {
    if (tryAcquireDomRuntimeLock()) {
      startRuntimeOnce()
      return
    }

    const runtimeLockNode = resolveRuntimeLockNode()
    const incumbentOwnerId = runtimeLockNode?.getAttribute(domRuntimeLockOwnerAttribute) || ''
    requestRuntimeTakeover(incumbentOwnerId)

    // Content-script worlds can overlap during extension reloads; wait briefly for incumbent shutdown.
    const takeoverDeadlineAt = Date.now() + domRuntimeTakeoverGraceMs
    const attemptTakeoverBootstrap = () => {
      if (runtimeBootstrapStarted) {
        return
      }

      if (tryAcquireDomRuntimeLock()) {
        startRuntimeOnce()
        return
      }

      if (Date.now() >= takeoverDeadlineAt) {
        setRuntimeControl({
          active: false,
          activeInstanceId: null,
          lastShutdownAt: Date.now(),
          lastShutdownPayload: {
            reason: 'dom-runtime-lock-held-timeout',
            incumbentOwnerId,
          },
        })
        return
      }

      window.setTimeout(attemptTakeoverBootstrap, domRuntimeTakeoverPollMs)
    }

    window.setTimeout(attemptTakeoverBootstrap, domRuntimeTakeoverPollMs)
  }

  beginRuntimeBootstrap()
})()
