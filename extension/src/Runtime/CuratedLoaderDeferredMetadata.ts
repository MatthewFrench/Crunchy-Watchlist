;(() => {
  type LooseRecord = Record<string, unknown>

  type CuratedLoaderDeferredMetadataContext = {
    state: {
      mounted: boolean
      settings: LooseRecord
      deferredMetadataRunId: number
    } & LooseRecord
    windowRef: Window
    documentRef: Document | null
    locationRef: Location
    runtimeEvent: (event: string, data?: unknown) => void
    isWatchlistPath: (pathname: string) => boolean
    renderCuratedPanel: () => void
    metadataPriorityEntryCount: number
    metadataDeferredChunkSize: number
    metadataDeferredIdleTimeoutMs: number
    metadataDeferredHiddenDelayMs: number
    metadataViewportPriorityCount: number
    deferredMetadataRunId: number
  }

  type QueueDeferredMetadataPreloadOptions = {
    context: CuratedLoaderDeferredMetadataContext
    deferredEntries: unknown[]
    tokenEntry: unknown
    preloadMetadataForEntries: (entries: unknown[], tokenEntry: unknown) => Promise<void>
  }

  type CuratedLoaderDeferredMetadataRuntime = {
    splitMetadataPreloadEntries: (
      context: CuratedLoaderDeferredMetadataContext,
      entries: unknown[],
    ) => { priorityEntries: unknown[]; deferredEntries: unknown[] }
    queueDeferredMetadataPreload: (options: QueueDeferredMetadataPreloadOptions) => void
  }

  type DeferredMetadataProgressRenderer = (force?: boolean) => void

  type DeferredMetadataChunkProgress = {
    completedChunks: number
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord
    }
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
  }

  /**
   * Prioritize a bounded subset for first-paint metadata so the panel can stabilize quickly.
   * Remaining entries continue loading in the background and progressively enrich card details.
   */
  function splitMetadataPreloadEntriesInternal(
    context: CuratedLoaderDeferredMetadataContext,
    entries: unknown[],
  ): { priorityEntries: unknown[]; deferredEntries: unknown[] } {
    if (entries.length <= context.metadataPriorityEntryCount) {
      return {
        priorityEntries: entries,
        deferredEntries: [],
      }
    }

    return {
      priorityEntries: entries.slice(0, context.metadataPriorityEntryCount),
      deferredEntries: entries.slice(context.metadataPriorityEntryCount),
    }
  }

  function getSeriesIdFromEntryInternal(entry: unknown): string {
    if (!entry || typeof entry !== 'object') {
      return ''
    }
    return getString((entry as LooseRecord).seriesId)
  }

  function reorderDeferredEntriesByViewportInternal(
    context: CuratedLoaderDeferredMetadataContext,
    deferredEntries: unknown[],
  ): unknown[] {
    if (!context.documentRef || !deferredEntries.length) {
      return deferredEntries
    }

    const queryHost = context.documentRef as Document & {
      querySelectorAll?: (selectors: string) => NodeListOf<Element>
      visibilityState?: string
    }
    if (typeof queryHost.querySelectorAll !== 'function') {
      return deferredEntries
    }

    const cards = Array.from(queryHost.querySelectorAll('.cw-curated-card'))
    if (!cards.length) {
      return deferredEntries
    }

    const viewportHeight = Math.max(0, Number(context.windowRef.innerHeight) || 0)
    const viewportSeriesIds: string[] = []
    for (const card of cards) {
      const cardElement = card as Element & {
        dataset?: Record<string, string>
        getBoundingClientRect?: () => { top?: number; bottom?: number }
      }
      const seriesId = getString(cardElement.dataset?.cwSeriesId)
      if (!seriesId) {
        continue
      }

      const cardRect =
        typeof cardElement.getBoundingClientRect === 'function' ? cardElement.getBoundingClientRect() : null
      const isLikelyVisible =
        !cardRect ||
        viewportHeight <= 0 ||
        ((Number(cardRect.bottom) || 0) > -120 && (Number(cardRect.top) || 0) < viewportHeight + 240)
      if (!isLikelyVisible) {
        continue
      }
      if (viewportSeriesIds.includes(seriesId)) {
        continue
      }
      viewportSeriesIds.push(seriesId)
      if (viewportSeriesIds.length >= context.metadataViewportPriorityCount) {
        break
      }
    }

    if (!viewportSeriesIds.length) {
      return deferredEntries
    }

    const seriesIdRank = new Map<string, number>()
    viewportSeriesIds.forEach((seriesId, index) => {
      seriesIdRank.set(seriesId, index)
    })

    const prioritized: unknown[] = []
    const remainder: unknown[] = []
    deferredEntries.forEach((entry) => {
      const seriesId = getSeriesIdFromEntryInternal(entry)
      if (seriesId && seriesIdRank.has(seriesId)) {
        prioritized.push(entry)
        return
      }
      remainder.push(entry)
    })

    prioritized.sort((left, right) => {
      const leftRank = seriesIdRank.get(getSeriesIdFromEntryInternal(left)) ?? Number.MAX_SAFE_INTEGER
      const rightRank = seriesIdRank.get(getSeriesIdFromEntryInternal(right)) ?? Number.MAX_SAFE_INTEGER
      return leftRank - rightRank
    })

    return [...prioritized, ...remainder]
  }

  function splitDeferredMetadataChunksInternal(
    context: CuratedLoaderDeferredMetadataContext,
    deferredEntries: unknown[],
  ): unknown[][] {
    const chunks: unknown[][] = []
    for (let index = 0; index < deferredEntries.length; index += context.metadataDeferredChunkSize) {
      chunks.push(deferredEntries.slice(index, index + context.metadataDeferredChunkSize))
    }
    return chunks
  }

  function scheduleDeferredMetadataStepInternal(
    context: CuratedLoaderDeferredMetadataContext,
    step: () => void,
    isFirstStep: boolean,
  ): void {
    const runStep = () => {
      step()
    }

    const documentVisibilityState =
      context.documentRef &&
      typeof (context.documentRef as Document & { visibilityState?: string }).visibilityState === 'string'
        ? (context.documentRef as Document & { visibilityState?: string }).visibilityState
        : 'visible'
    if (documentVisibilityState === 'hidden') {
      context.windowRef.setTimeout(runStep, context.metadataDeferredHiddenDelayMs)
      return
    }

    if (isFirstStep) {
      runStep()
      return
    }

    const idleWindow = context.windowRef as Window & {
      requestIdleCallback?: (
        callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
        options?: { timeout?: number },
      ) => number
    }
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(
        () => {
          runStep()
        },
        {
          timeout: context.metadataDeferredIdleTimeoutMs,
        },
      )
      return
    }

    context.windowRef.setTimeout(runStep, 0)
  }

  function createDeferredMetadataProgressRendererInternal(
    context: CuratedLoaderDeferredMetadataContext,
  ): DeferredMetadataProgressRenderer {
    let lastProgressRenderAt = 0
    return (force = false) => {
      if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
        return
      }

      const now = Date.now()
      if (!force && now - lastProgressRenderAt < 180) {
        return
      }
      lastProgressRenderAt = now
      context.renderCuratedPanel()
    }
  }

  function shouldSkipDeferredMetadataChunkInternal(
    context: CuratedLoaderDeferredMetadataContext,
    runId: number,
    chunk: unknown[] | undefined,
  ): boolean {
    if (runId !== context.deferredMetadataRunId) {
      return true
    }
    if (!chunk || !chunk.length) {
      return true
    }
    return !context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)
  }

  function emitDeferredMetadataFailureEventInternal(
    context: CuratedLoaderDeferredMetadataContext,
    error: unknown,
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
      message: (error as { message?: unknown })?.message || 'unknown',
    })
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
    })
  }

  function runDeferredMetadataChunkInternal({
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
  }: {
    context: CuratedLoaderDeferredMetadataContext
    runId: number
    chunks: unknown[][]
    chunkIndex: number
    tokenEntry: unknown
    preloadMetadataForEntries: (entries: unknown[], tokenEntry: unknown) => Promise<void>
    deferredEntryCount: number
    startedAt: number
    progress: DeferredMetadataChunkProgress
    renderProgress: DeferredMetadataProgressRenderer
  }): void {
    const chunk = chunks[chunkIndex]
    if (shouldSkipDeferredMetadataChunkInternal(context, runId, chunk)) {
      return
    }
    if (!chunk || !chunk.length) {
      return
    }

    void preloadMetadataForEntries(chunk, tokenEntry)
      .then(() => {
        renderProgress(chunkIndex + 1 >= chunks.length)
      })
      .catch((error: unknown) => {
        emitDeferredMetadataFailureEventInternal(
          context,
          error,
          deferredEntryCount,
          chunkIndex,
          chunks.length,
          startedAt,
        )
      })
      .finally(() => {
        if (runId !== context.deferredMetadataRunId) {
          return
        }

        progress.completedChunks += 1
        if (chunkIndex + 1 < chunks.length) {
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
          )
          return
        }

        emitDeferredMetadataDoneEventInternal(
          context,
          deferredEntryCount,
          chunks.length,
          progress.completedChunks,
          startedAt,
        )
      })
  }

  function queueDeferredMetadataPreloadInternal({
    context,
    deferredEntries,
    tokenEntry,
    preloadMetadataForEntries,
  }: QueueDeferredMetadataPreloadOptions): void {
    if (!deferredEntries.length) {
      return
    }

    const runId = context.deferredMetadataRunId
    const startedAt = Date.now()
    const orderedEntries = reorderDeferredEntriesByViewportInternal(context, deferredEntries)
    const chunks = splitDeferredMetadataChunksInternal(context, orderedEntries)
    const progress: DeferredMetadataChunkProgress = {
      completedChunks: 0,
    }
    const renderProgress = createDeferredMetadataProgressRendererInternal(context)
    context.runtimeEvent('curated-load-background-metadata-start', {
      deferredEntryCount: deferredEntries.length,
      chunkCount: chunks.length,
    })

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
    )
  }

  function createCuratedLoaderDeferredMetadataRuntime(): CuratedLoaderDeferredMetadataRuntime {
    return {
      splitMetadataPreloadEntries: splitMetadataPreloadEntriesInternal,
      queueDeferredMetadataPreload: queueDeferredMetadataPreloadInternal,
    }
  }

  moduleRegistry.runtimeCuratedLoaderDeferredMetadata = {
    createCuratedLoaderDeferredMetadataRuntime,
  }
})()
