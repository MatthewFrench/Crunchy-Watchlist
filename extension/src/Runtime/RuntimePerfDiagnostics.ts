export type RuntimePerfDiagnostics = {
  routeObserverBatchesProcessed: number;
  routeObserverBatchesIgnored: number;
  routeStructureChecks: number;
  routeStructureSyncs: number;
  gridLayoutCacheHits: number;
  gridLayoutCacheMisses: number;
  retainedCardHideScheduled: number;
  retainedCardHideCompleted: number;
  localizedPreloadRenderRequestsQueued: number;
  localizedPreloadRenderRequestsDeduped: number;
};

function createRuntimePerfDiagnostics(): RuntimePerfDiagnostics {
  return {
    routeObserverBatchesProcessed: 0,
    routeObserverBatchesIgnored: 0,
    routeStructureChecks: 0,
    routeStructureSyncs: 0,
    gridLayoutCacheHits: 0,
    gridLayoutCacheMisses: 0,
    retainedCardHideScheduled: 0,
    retainedCardHideCompleted: 0,
    localizedPreloadRenderRequestsQueued: 0,
    localizedPreloadRenderRequestsDeduped: 0,
  };
}

const runtimePerfDiagnostics = createRuntimePerfDiagnostics();

function isRuntimePerfDiagnosticsEnabled(): boolean {
  const root = globalThis as typeof globalThis & {
    __CW_WATCHLIST_CURATOR_DEBUG_FLAGS__?: {
      perf?: unknown;
    };
  };
  return root.__CW_WATCHLIST_CURATOR_DEBUG_FLAGS__?.perf === true;
}

export function resetRuntimePerfDiagnostics(): void {
  const nextDiagnostics = createRuntimePerfDiagnostics();
  (Object.keys(nextDiagnostics) as Array<keyof RuntimePerfDiagnostics>).forEach((key) => {
    runtimePerfDiagnostics[key] = nextDiagnostics[key];
  });
}

export function incrementRuntimePerfDiagnostic(key: keyof RuntimePerfDiagnostics, amount = 1): void {
  if (!isRuntimePerfDiagnosticsEnabled()) {
    return;
  }
  const normalizedAmount = Number.isFinite(amount) ? Math.max(1, Math.round(amount)) : 1;
  runtimePerfDiagnostics[key] += normalizedAmount;
}

export function getRuntimePerfDiagnostics(): RuntimePerfDiagnostics {
  return { ...runtimePerfDiagnostics };
}
