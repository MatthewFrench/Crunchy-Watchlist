import { readProjectedCuratedGridChildren } from './CuratedPanelGridDomState.js';

type BoundaryValue = LooseRecord[string];
type BoundaryList = BoundaryValue[];
type BoundaryChunks = BoundaryList[];
type DeferredMetadataRecord = Record<string, BoundaryValue>;
type ErrorLike = { message?: BoundaryValue };

type CuratedLoaderDeferredMetadataContext = {
  state: {
    mounted: boolean;
    settings: DeferredMetadataRecord;
    deferredMetadataRunId: number;
    curatedDeferredMetadataInFlight?: boolean;
  } & DeferredMetadataRecord;
  windowRef: Window;
  documentRef: Document | null;
  locationRef: Location;
  runtimeEvent: (event: string, data?: BoundaryValue) => void;
  isWatchlistPath: (pathname: string) => boolean;
  renderCuratedPanel: () => void;
  metadataPriorityEntryCount: number;
  metadataDeferredChunkSize: number;
  metadataDeferredIdleTimeoutMs: number;
  metadataDeferredHiddenDelayMs: number;
  metadataViewportPriorityCount: number;
  deferredMetadataRunId: number;
};

type QueueDeferredMetadataPreloadOptions = {
  context: CuratedLoaderDeferredMetadataContext;
  deferredEntries: BoundaryList;
  tokenEntry: BoundaryValue;
  preloadMetadataForEntries: (entries: BoundaryList, tokenEntry: BoundaryValue) => Promise<void>;
};

type CuratedLoaderDeferredMetadataRuntime = {
  splitMetadataPreloadEntries: (
    context: CuratedLoaderDeferredMetadataContext,
    entries: BoundaryList,
  ) => { priorityEntries: BoundaryList; deferredEntries: BoundaryList };
  queueDeferredMetadataPreload: (options: QueueDeferredMetadataPreloadOptions) => void;
};

type DeferredMetadataProgressRenderer = (force?: boolean) => void;

type DeferredMetadataChunkProgress = {
  completedChunks: number;
};

type RunDeferredMetadataChunkOptions = {
  context: CuratedLoaderDeferredMetadataContext;
  runId: number;
  chunks: BoundaryChunks;
  chunkIndex: number;
  tokenEntry: BoundaryValue;
  preloadMetadataForEntries: (entries: BoundaryList, tokenEntry: BoundaryValue) => Promise<void>;
  deferredEntryCount: number;
  startedAt: number;
  progress: DeferredMetadataChunkProgress;
  renderProgress: DeferredMetadataProgressRenderer;
};

function getString(value: BoundaryValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolvePriorityEntryCountInternal(
  context: CuratedLoaderDeferredMetadataContext,
  totalEntryCount: number,
): number {
  const configuredPriorityCount = Math.max(1, Number(context.metadataPriorityEntryCount) || 1);
  if (totalEntryCount <= configuredPriorityCount) {
    return totalEntryCount;
  }

  // Keep first-load metadata work bounded for very large lists so curated-load-done
  // is not dominated by enrichment of dozens of offscreen cards.
  if (totalEntryCount >= 240) {
    return Math.min(configuredPriorityCount, 12);
  }
  if (totalEntryCount >= 120) {
    return Math.min(configuredPriorityCount, 18);
  }

  return configuredPriorityCount;
}

/**
 * Prioritize a bounded subset for first-paint metadata so the panel can stabilize quickly.
 * Remaining entries continue loading in the background and progressively enrich card details.
 */
function splitMetadataPreloadEntriesInternal(
  context: CuratedLoaderDeferredMetadataContext,
  entries: BoundaryList,
): { priorityEntries: BoundaryList; deferredEntries: BoundaryList } {
  const priorityEntryCount = resolvePriorityEntryCountInternal(context, entries.length);
  if (entries.length <= priorityEntryCount) {
    return {
      priorityEntries: entries,
      deferredEntries: [],
    };
  }

  return {
    priorityEntries: entries.slice(0, priorityEntryCount),
    deferredEntries: entries.slice(priorityEntryCount),
  };
}

function getSeriesIdFromEntryInternal(entry: BoundaryValue): string {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  return getString((entry as DeferredMetadataRecord).seriesId);
}

function reorderDeferredEntriesByViewportInternal(
  context: CuratedLoaderDeferredMetadataContext,
  deferredEntries: BoundaryList,
): BoundaryList {
  if (!deferredEntries.length) {
    return deferredEntries;
  }

  const gridElement = context.state.gridEl as Element | null;
  if (!gridElement) {
    return deferredEntries;
  }

  const cards = readProjectedCuratedGridChildren(gridElement);
  if (!cards.length) {
    return deferredEntries;
  }

  const viewportHeight = Math.max(0, Number(context.windowRef.innerHeight) || 0);
  const viewportSeriesIds: string[] = [];
  for (const card of cards) {
    const cardElement = card as Element & {
      dataset?: Record<string, string>;
      getAttribute?: (name: string) => string | null;
      getBoundingClientRect?: () => { top?: number; bottom?: number };
    };
    const seriesId = getString(cardElement.dataset?.cwSeriesId || cardElement.getAttribute?.('data-cw-series-id'));
    if (!seriesId) {
      continue;
    }

    const cardRect =
      typeof cardElement.getBoundingClientRect === 'function' ? cardElement.getBoundingClientRect() : null;
    const isLikelyVisible =
      !cardRect ||
      viewportHeight <= 0 ||
      ((Number(cardRect.bottom) || 0) > -120 && (Number(cardRect.top) || 0) < viewportHeight + 240);
    if (!isLikelyVisible) {
      continue;
    }
    if (viewportSeriesIds.includes(seriesId)) {
      continue;
    }
    viewportSeriesIds.push(seriesId);
    if (viewportSeriesIds.length >= context.metadataViewportPriorityCount) {
      break;
    }
  }

  if (!viewportSeriesIds.length) {
    return deferredEntries;
  }

  const seriesIdRank = new Map<string, number>();
  viewportSeriesIds.forEach((seriesId, index) => {
    seriesIdRank.set(seriesId, index);
  });

  const prioritized: BoundaryList = [];
  const remainder: BoundaryList = [];
  deferredEntries.forEach((entry) => {
    const seriesId = getSeriesIdFromEntryInternal(entry);
    if (seriesId && seriesIdRank.has(seriesId)) {
      prioritized.push(entry);
      return;
    }
    remainder.push(entry);
  });

  prioritized.sort((left, right) => {
    const leftRank = seriesIdRank.get(getSeriesIdFromEntryInternal(left)) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = seriesIdRank.get(getSeriesIdFromEntryInternal(right)) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });

  return [...prioritized, ...remainder];
}

function splitDeferredMetadataChunksInternal(
  context: CuratedLoaderDeferredMetadataContext,
  deferredEntries: BoundaryList,
): BoundaryChunks {
  const chunks: BoundaryChunks = [];
  for (let index = 0; index < deferredEntries.length; index += context.metadataDeferredChunkSize) {
    chunks.push(deferredEntries.slice(index, index + context.metadataDeferredChunkSize));
  }
  return chunks;
}

function scheduleDeferredMetadataStepInternal(
  context: CuratedLoaderDeferredMetadataContext,
  step: () => void,
  isFirstStep: boolean,
): void {
  const runStep = () => {
    step();
  };

  const documentVisibilityState =
    context.documentRef &&
    typeof (context.documentRef as Document & { visibilityState?: string }).visibilityState === 'string'
      ? (context.documentRef as Document & { visibilityState?: string }).visibilityState
      : 'visible';
  if (documentVisibilityState === 'hidden') {
    context.windowRef.setTimeout(runStep, context.metadataDeferredHiddenDelayMs);
    return;
  }

  if (isFirstStep) {
    runStep();
    return;
  }

  const idleWindow = context.windowRef as Window & {
    requestIdleCallback?: (
      callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
      options?: { timeout?: number },
    ) => number;
  };
  if (typeof idleWindow.requestIdleCallback === 'function') {
    idleWindow.requestIdleCallback(
      () => {
        runStep();
      },
      {
        timeout: context.metadataDeferredIdleTimeoutMs,
      },
    );
    return;
  }

  context.windowRef.setTimeout(runStep, 0);
}

function createDeferredMetadataProgressRendererInternal(
  context: CuratedLoaderDeferredMetadataContext,
): DeferredMetadataProgressRenderer {
  let lastProgressRenderAt = 0;
  return (force = false) => {
    if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
      return;
    }

    const now = Date.now();
    if (!force && now - lastProgressRenderAt < 180) {
      return;
    }
    lastProgressRenderAt = now;
    context.renderCuratedPanel();
  };
}

function setDeferredMetadataInFlightInternal(context: CuratedLoaderDeferredMetadataContext, inFlight: boolean): void {
  context.state.curatedDeferredMetadataInFlight = inFlight;
}

function shouldSkipDeferredMetadataChunkInternal(
  context: CuratedLoaderDeferredMetadataContext,
  runId: number,
  chunk: BoundaryList | undefined,
): boolean {
  if (runId !== context.deferredMetadataRunId) {
    return true;
  }
  if (!chunk || !chunk.length) {
    return true;
  }
  return !context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname);
}

function emitDeferredMetadataFailureEventInternal(
  context: CuratedLoaderDeferredMetadataContext,
  error: BoundaryValue,
  deferredEntryCount: number,
  chunkIndex: number,
  chunkCount: number,
  startedAt: number,
): void {
  context.runtimeEvent('curated-load-background-metadata-failed', {
    deferredEntryCount,
    chunkIndex: chunkIndex + 1,
    chunkCount,
    durationMs: Date.now() - startedAt,
    message: (error as ErrorLike)?.message || 'unavailable',
  });
}

function emitDeferredMetadataDoneEventInternal(
  context: CuratedLoaderDeferredMetadataContext,
  deferredEntryCount: number,
  chunkCount: number,
  completedChunks: number,
  startedAt: number,
): void {
  context.runtimeEvent('curated-load-background-metadata-done', {
    deferredEntryCount,
    chunkCount,
    completedChunks,
    durationMs: Date.now() - startedAt,
  });
}

function stopDeferredMetadataRunIfCurrent(context: CuratedLoaderDeferredMetadataContext, runId: number): void {
  if (runId === context.deferredMetadataRunId) {
    setDeferredMetadataInFlightInternal(context, false);
  }
}

function scheduleNextDeferredMetadataChunk(options: RunDeferredMetadataChunkOptions): void {
  const {
    context,
    runId,
    chunks,
    chunkIndex,
    tokenEntry,
    preloadMetadataForEntries,
    deferredEntryCount,
    startedAt,
    progress,
    renderProgress,
  } = options;
  scheduleDeferredMetadataStepInternal(
    context,
    () =>
      runDeferredMetadataChunkInternal({
        context,
        runId,
        chunks,
        chunkIndex: chunkIndex + 1,
        tokenEntry,
        preloadMetadataForEntries,
        deferredEntryCount,
        startedAt,
        progress,
        renderProgress,
      }),
    false,
  );
}

function finalizeDeferredMetadataChunk(options: RunDeferredMetadataChunkOptions): void {
  const { context, runId, chunks, chunkIndex, deferredEntryCount, startedAt, progress, renderProgress } = options;
  if (runId !== context.deferredMetadataRunId) {
    return;
  }

  progress.completedChunks += 1;
  if (chunkIndex + 1 < chunks.length) {
    scheduleNextDeferredMetadataChunk(options);
    return;
  }

  setDeferredMetadataInFlightInternal(context, false);
  renderProgress(true);
  emitDeferredMetadataDoneEventInternal(
    context,
    deferredEntryCount,
    chunks.length,
    progress.completedChunks,
    startedAt,
  );
}

function runDeferredMetadataChunkInternal(options: RunDeferredMetadataChunkOptions): void {
  const {
    context,
    runId,
    chunks,
    chunkIndex,
    tokenEntry,
    preloadMetadataForEntries,
    deferredEntryCount,
    startedAt,
    renderProgress,
  } = options;
  const chunk = chunks[chunkIndex];
  if (shouldSkipDeferredMetadataChunkInternal(context, runId, chunk)) {
    stopDeferredMetadataRunIfCurrent(context, runId);
    return;
  }
  if (!chunk || !chunk.length) {
    stopDeferredMetadataRunIfCurrent(context, runId);
    return;
  }

  void preloadMetadataForEntries(chunk, tokenEntry)
    .then(() => {
      if (chunkIndex + 1 < chunks.length) {
        renderProgress();
      }
    })
    .catch((error: BoundaryValue) => {
      emitDeferredMetadataFailureEventInternal(
        context,
        error,
        deferredEntryCount,
        chunkIndex,
        chunks.length,
        startedAt,
      );
    })
    .finally(() => {
      finalizeDeferredMetadataChunk(options);
    });
}

function queueDeferredMetadataPreloadInternal({
  context,
  deferredEntries,
  tokenEntry,
  preloadMetadataForEntries,
}: QueueDeferredMetadataPreloadOptions): void {
  if (!deferredEntries.length) {
    setDeferredMetadataInFlightInternal(context, false);
    return;
  }

  const runId = context.deferredMetadataRunId;
  const startedAt = Date.now();
  const orderedEntries = reorderDeferredEntriesByViewportInternal(context, deferredEntries);
  const chunks = splitDeferredMetadataChunksInternal(context, orderedEntries);
  const progress: DeferredMetadataChunkProgress = {
    completedChunks: 0,
  };
  const renderProgress = createDeferredMetadataProgressRendererInternal(context);
  setDeferredMetadataInFlightInternal(context, true);
  context.runtimeEvent('curated-load-background-metadata-start', {
    deferredEntryCount: deferredEntries.length,
    chunkCount: chunks.length,
  });

  scheduleDeferredMetadataStepInternal(
    context,
    () =>
      runDeferredMetadataChunkInternal({
        context,
        runId,
        chunks,
        chunkIndex: 0,
        tokenEntry,
        preloadMetadataForEntries,
        deferredEntryCount: deferredEntries.length,
        startedAt,
        progress,
        renderProgress,
      }),
    true,
  );
}

export function createCuratedLoaderDeferredMetadataRuntime(): CuratedLoaderDeferredMetadataRuntime {
  return {
    splitMetadataPreloadEntries: splitMetadataPreloadEntriesInternal,
    queueDeferredMetadataPreload: queueDeferredMetadataPreloadInternal,
  };
}
