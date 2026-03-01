type RuntimeState = {
  curatedPendingRequests: string[];
  curatedPendingRequestStartedCount: number;
  curatedPendingRequestCompletedCount: number;
  mounted: boolean;
};

type PendingRequestProgress = {
  started: number;
  completed: number;
};

type CuratedLoaderPendingRequestContext = {
  state: RuntimeState;
  locationRef: Location;
  isWatchlistPath: (pathname: string) => boolean;
  refreshCuratedLoadingIndicator: () => void;
};

type CuratedLoaderPendingRequestsRuntime = {
  createPendingRequestProgress: (state: RuntimeState) => PendingRequestProgress;
  syncPendingRequestDiagnostics: (
    context: CuratedLoaderPendingRequestContext,
    activeRequests: string[],
    progress: PendingRequestProgress,
  ) => void;
  withTrackedPendingRequest: <T>(
    context: CuratedLoaderPendingRequestContext,
    activeRequests: string[],
    progress: PendingRequestProgress,
    label: string,
    work: () => Promise<T>,
  ) => Promise<T>;
};

function getString(value: CwBoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePendingRequestLabels(activeRequests: string[]): string[] {
  return activeRequests.map((label) => getString(label)).filter((label) => Boolean(label));
}

function getPendingRequestProgress(state: RuntimeState): PendingRequestProgress {
  const started = Number(state.curatedPendingRequestStartedCount);
  const completed = Number(state.curatedPendingRequestCompletedCount);
  return {
    started: Number.isFinite(started) && started >= 0 ? Math.round(started) : 0,
    completed: Number.isFinite(completed) && completed >= 0 ? Math.round(completed) : 0,
  };
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function syncPendingRequestDiagnosticsInternal(
  context: CuratedLoaderPendingRequestContext,
  activeRequests: string[],
  progress: PendingRequestProgress,
): void {
  const nextPendingRequests = normalizePendingRequestLabels(activeRequests);
  const currentPendingRequests = Array.isArray(context.state.curatedPendingRequests)
    ? context.state.curatedPendingRequests
    : [];
  const currentProgress = getPendingRequestProgress(context.state);

  if (
    areStringArraysEqual(currentPendingRequests, nextPendingRequests) &&
    currentProgress.started === progress.started &&
    currentProgress.completed === progress.completed
  ) {
    return;
  }

  context.state.curatedPendingRequests = nextPendingRequests;
  context.state.curatedPendingRequestStartedCount = progress.started;
  context.state.curatedPendingRequestCompletedCount = progress.completed;

  if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
    return;
  }

  context.refreshCuratedLoadingIndicator();
}

function removePendingRequestLabel(activeRequests: string[], label: string): void {
  const index = activeRequests.indexOf(label);
  if (index >= 0) {
    activeRequests.splice(index, 1);
  }
}

/**
 * Tracks duplicate request labels independently so overlapping requests of the same class
 * still render accurate in-flight diagnostics and completed/started counters.
 */
async function withTrackedPendingRequestInternal<T>(
  context: CuratedLoaderPendingRequestContext,
  activeRequests: string[],
  progress: PendingRequestProgress,
  label: string,
  work: () => Promise<T>,
): Promise<T> {
  activeRequests.push(label);
  progress.started += 1;
  syncPendingRequestDiagnosticsInternal(context, activeRequests, progress);

  try {
    return await work();
  } finally {
    removePendingRequestLabel(activeRequests, label);
    progress.completed += 1;
    syncPendingRequestDiagnosticsInternal(context, activeRequests, progress);
  }
}

export function createCuratedLoaderPendingRequestsRuntime(): CuratedLoaderPendingRequestsRuntime {
  return {
    createPendingRequestProgress: (state: RuntimeState) => getPendingRequestProgress(state),
    syncPendingRequestDiagnostics: (context, activeRequests, progress) =>
      syncPendingRequestDiagnosticsInternal(context, activeRequests, progress),
    withTrackedPendingRequest: (context, activeRequests, progress, label, work) =>
      withTrackedPendingRequestInternal(context, activeRequests, progress, label, work),
  };
}
