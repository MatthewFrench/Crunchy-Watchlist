(() => {
  const runtimeInstanceStartedAt = Date.now();
  const runtimeInstanceId = `cw-${runtimeInstanceStartedAt}-${Math.random().toString(36).slice(2, 10)}`;
  const domRuntimeLockOwnerAttribute = 'data-cw-runtime-owner';
  const domRuntimeLockTimestampAttribute = 'data-cw-runtime-owner-ts';
  const domRuntimeLockStaleMs = 15_000;
  const domRuntimeLockHeartbeatMs = 3_000;
  const domRuntimeTakeoverGraceMs = 1_500;
  const domRuntimeTakeoverPollMs = 75;
  const runtimeTakeoverRequestEventName = 'cw-runtime-takeover-request';
  const runtimeControl =
    window.__CW_WATCHLIST_CURATOR_CONTROL__ && typeof window.__CW_WATCHLIST_CURATOR_CONTROL__ === 'object'
      ? window.__CW_WATCHLIST_CURATOR_CONTROL__
      : {};
  window.__CW_WATCHLIST_CURATOR_CONTROL__ = runtimeControl;

  const setRuntimeControl = (patch) => {
    Object.assign(runtimeControl, patch);
    window.__CW_WATCHLIST_CURATOR_CONTROL__ = runtimeControl;
  };

  const markRuntimeInactive = (reason, extraPayload = {}) => {
    const activeOwnerId =
      window.__CW_WATCHLIST_CURATOR_CONTROL__ &&
      typeof window.__CW_WATCHLIST_CURATOR_CONTROL__.activeInstanceId === 'string'
        ? window.__CW_WATCHLIST_CURATOR_CONTROL__.activeInstanceId
        : null;
    const isOwnedByCurrentRuntime = activeOwnerId === runtimeInstanceId;
    if (!isOwnedByCurrentRuntime && activeOwnerId) {
      return;
    }
    setRuntimeControl({
      active: false,
      activeInstanceId: isOwnedByCurrentRuntime ? null : activeOwnerId,
      lastShutdownAt: Date.now(),
      lastShutdownPayload: {
        reason,
        ...extraPayload,
      },
    });
  };

  const isCurrentRuntimeOwner = () =>
    window.__CW_WATCHLIST_CURATOR_CONTROL__ &&
    window.__CW_WATCHLIST_CURATOR_CONTROL__.activeInstanceId === runtimeInstanceId;

  const isCurrentRuntimeActive = () =>
    window.__CW_WATCHLIST_CURATOR_CONTROL__ &&
    window.__CW_WATCHLIST_CURATOR_CONTROL__.activeInstanceId === runtimeInstanceId &&
    window.__CW_WATCHLIST_CURATOR_CONTROL__.active !== false;

  const moduleRegistry = window.__CW_WATCHLIST_CURATOR_MODULES__ || {};
  const runtimeContentRuntimeBootstrapHelpersModule = moduleRegistry.runtimeContentRuntimeBootstrapHelpers;
  if (
    !runtimeContentRuntimeBootstrapHelpersModule ||
    typeof runtimeContentRuntimeBootstrapHelpersModule.createContentRuntimeBootstrapHelpers !== 'function'
  ) {
    // eslint-disable-next-line no-console
    console.error('[CW] missing-content-runtime-bootstrap-helpers-module');
    markRuntimeInactive('missing-content-runtime-bootstrap-helpers-module');
    return;
  }

  const runtimeBootstrapHelpersRuntime =
    runtimeContentRuntimeBootstrapHelpersModule.createContentRuntimeBootstrapHelpers({
      windowRef: window,
      consoleRef: console,
      browserRef: typeof browser !== 'undefined' ? browser : undefined,
      chromeRef: typeof chrome !== 'undefined' ? chrome : undefined,
      runtimeControl,
      setRuntimeControl,
      runtimeInstanceId,
      runtimeInstanceStartedAt,
      domRuntimeLockOwnerAttribute,
      domRuntimeLockTimestampAttribute,
      domRuntimeLockStaleMs,
      domRuntimeLockHeartbeatMs,
      runtimeTakeoverRequestEventName,
      isCurrentRuntimeOwner,
      isCurrentRuntimeActive,
    });

  const setRuntimeSetupBindings = (runtimeSetupBindings) => {
    ({
      normalizeEntriesFromApiRows,
      fetchWithResilience,
      getAccessToken,
      createAuthRefreshHandler,
      fetchAllWatchlistRows,
      normalizeStoredWatchlistCache,
      isWatchlistCacheValid,
      resetWatchlistCacheOnAccountMismatch,
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
      printSeriesApiData,
      setWatchlistCacheRows,
    } = runtimeSetupBindings);
  };

  const resolveRuntimeBootstrapSession = (bootstrapContext) => {
    const runtimeBootstrapSession = runtimeBootstrapHelpersRuntime.createRuntimeBootstrapSession({
      bootstrapContext,
    });
    if (runtimeBootstrapSession) {
      return runtimeBootstrapSession;
    }

    bootstrapContext.setBootstrapIssue('runtime-bootstrap-session-not-ready');
    runtimeBootstrapHelpersRuntime.clearStaleInjectedShell('runtime-bootstrap-session-not-ready');
    return null;
  };

  const resolveRuntimeSetupResult = (runtimeBootstrapSession, bootstrapContext) => {
    const runtimeSetupResult = runtimeBootstrapHelpersRuntime.createRuntimeSetup(
      runtimeBootstrapHelpersRuntime.createRuntimeSetupOptions({
        windowRef: window,
        ...runtimeBootstrapSession,
      }),
    );
    if (!runtimeSetupResult || runtimeSetupResult.ok !== true) {
      bootstrapContext.setBootstrapIssue('runtime-module-initialization-failed', {
        message: runtimeSetupResult?.message || 'unknown',
      });
      runtimeBootstrapHelpersRuntime.clearStaleInjectedShell('runtime-module-initialization-failed');
      return null;
    }

    runtimeBootstrapHelpersRuntime.applyRuntimeSetupBindings({
      runtimeSetupResult,
      setRuntimeEvent: runtimeBootstrapSession.setRuntimeEvent,
      setRuntimeSetupBindings,
    });

    return runtimeSetupResult;
  };

  const resolveBootstrapFinalizeRuntime = (runtimeSetupResult, runtimeBootstrapSession, bootstrapContext) => {
    const bootstrapFinalizeRuntime = runtimeBootstrapHelpersRuntime.createBootstrapFinalizeRuntimeFromSetupResult({
      windowRef: window,
      runtimeSetupResult,
      runtimeBootstrapSession,
    });
    const hasValidBootstrapFinalizeRuntime = runtimeBootstrapHelpersRuntime.bindBootstrapFinalizeRuntimeMethods({
      bootstrapFinalizeRuntime,
      setProcessWatchlist: runtimeBootstrapSession.setProcessWatchlist,
      setSyncRouteRuntime: runtimeBootstrapSession.setSyncRouteRuntime,
      setDestroyRuntime: runtimeBootstrapSession.setDestroyRuntime,
      setBootstrapIssue: bootstrapContext.setBootstrapIssue,
    });

    return hasValidBootstrapFinalizeRuntime ? bootstrapFinalizeRuntime : null;
  };

  const startRuntime = () => {
    if (!runtimeBootstrapHelpersRuntime.tryAcquireDomRuntimeLock()) {
      markRuntimeInactive('dom-runtime-lock-held');
      return;
    }

    const bootstrapContext = runtimeBootstrapHelpersRuntime.resolveValidatedBootstrapContext();
    if (!bootstrapContext) {
      return;
    }
    const runtimeBootstrapSession = resolveRuntimeBootstrapSession(bootstrapContext);
    if (!runtimeBootstrapSession) {
      return;
    }

    const runtimeSetupResult = resolveRuntimeSetupResult(runtimeBootstrapSession, bootstrapContext);
    if (!runtimeSetupResult) {
      return;
    }

    const bootstrapFinalizeRuntime = resolveBootstrapFinalizeRuntime(
      runtimeSetupResult,
      runtimeBootstrapSession,
      bootstrapContext,
    );
    if (!bootstrapFinalizeRuntime) {
      return;
    }

    runtimeBootstrapHelpersRuntime.runBootstrapFinalizeInitFlow({
      bootstrapFinalizeRuntime,
      updateDiagnostics: bootstrapContext.updateDiagnostics,
      startDomRuntimeLockHeartbeat: runtimeBootstrapSession.startDomRuntimeLockHeartbeat,
      startWatchlistHealthRuntime: runtimeBootstrapSession.startWatchlistHealthRuntime,
      runtimeEvent: runtimeBootstrapSession.getRuntimeEvent(),
      setBootstrapIssue: bootstrapContext.setBootstrapIssue,
      shutdownRuntime: runtimeBootstrapSession.shutdownRuntime,
    });
  };

  let runtimeBootstrapStarted = false;

  const startRuntimeOnce = () => {
    if (runtimeBootstrapStarted) {
      return;
    }
    runtimeBootstrapStarted = true;
    startRuntime();
  };

  const beginRuntimeBootstrap = () => {
    if (runtimeBootstrapHelpersRuntime.tryAcquireDomRuntimeLock()) {
      startRuntimeOnce();
      return;
    }

    const runtimeLockNode = runtimeBootstrapHelpersRuntime.resolveRuntimeLockNode();
    const incumbentOwnerId = runtimeLockNode?.getAttribute(domRuntimeLockOwnerAttribute) || '';
    runtimeBootstrapHelpersRuntime.requestRuntimeTakeover(incumbentOwnerId);

    // Content-script worlds can overlap during extension reloads; wait briefly for incumbent shutdown.
    const takeoverDeadlineAt = Date.now() + domRuntimeTakeoverGraceMs;
    const attemptTakeoverBootstrap = () => {
      if (runtimeBootstrapStarted) {
        return;
      }

      if (runtimeBootstrapHelpersRuntime.tryAcquireDomRuntimeLock()) {
        startRuntimeOnce();
        return;
      }

      if (Date.now() >= takeoverDeadlineAt) {
        markRuntimeInactive('dom-runtime-lock-held-timeout', { incumbentOwnerId });
        return;
      }

      window.setTimeout(attemptTakeoverBootstrap, domRuntimeTakeoverPollMs);
    };

    window.setTimeout(attemptTakeoverBootstrap, domRuntimeTakeoverPollMs);
  };

  beginRuntimeBootstrap();
})();
