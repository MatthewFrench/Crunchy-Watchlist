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
    let completedChunks = 0
    let lastProgressRenderAt = 0
    context.runtimeEvent('curated-load-background-metadata-start', {
      deferredEntryCount: deferredEntries.length,
      chunkCount: chunks.length,
    })

    const maybeRenderProgress = (force = false): void => {
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

    const runChunk = (chunkIndex: number): void => {
      if (runId !== context.deferredMetadataRunId) {
        return
      }
      const chunk = chunks[chunkIndex]
      if (!chunk || !chunk.length) {
        return
      }
      if (!context.state.mounted || !context.isWatchlistPath(context.locationRef.pathname)) {
        return
      }

      void preloadMetadataForEntries(chunk, tokenEntry)
        .then(() => {
          maybeRenderProgress(chunkIndex + 1 >= chunks.length)
        })
        .catch((error: unknown) => {
          context.runtimeEvent('curated-load-background-metadata-failed', {
            deferredEntryCount: deferredEntries.length,
            chunkIndex: chunkIndex + 1,
            chunkCount: chunks.length,
            durationMs: Date.now() - startedAt,
            message: (error as { message?: unknown })?.message || 'unknown',
          })
        })
        .finally(() => {
          if (runId !== context.deferredMetadataRunId) {
            return
          }
          completedChunks += 1
          if (chunkIndex + 1 < chunks.length) {
            scheduleDeferredMetadataStepInternal(context, () => runChunk(chunkIndex + 1), false)
            return
          }
          context.runtimeEvent('curated-load-background-metadata-done', {
            deferredEntryCount: deferredEntries.length,
            chunkCount: chunks.length,
            completedChunks,
            durationMs: Date.now() - startedAt,
          })
        })
    }

    scheduleDeferredMetadataStepInternal(context, () => runChunk(0), true)
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
