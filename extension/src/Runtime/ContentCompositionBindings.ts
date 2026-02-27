;(() => {
  type AnyFn = (...args: unknown[]) => unknown
  type LooseRecord = Record<string, unknown>
  type AnyFunctionRecord = Record<string, AnyFn>

  type ContentCompositionOptions = {
    state: LooseRecord
    modules: LooseRecord
    corePrimitives: LooseRecord
    dependencies: LooseRecord
  }

  type DebugRuntime = {
    listKnownSeries: (options?: unknown) => unknown
    dumpSeriesApiData: (seriesId: unknown, options?: unknown) => unknown
    printSeriesApiData: (seriesId: unknown, options?: unknown) => unknown
  }

  type ContentCompositionBindingsRuntime = {
    createEntryNormalizerBinding: (options: ContentCompositionOptions) => (rows: unknown[]) => unknown[]
    createDebugRuntime: (options: {
      state: LooseRecord
      corePrimitives: LooseRecord
      modules: LooseRecord
      assertRuntimeMethods: (owner: string, runtime: AnyFunctionRecord, methods: string[]) => void
      consoleRef: Console
    }) => DebugRuntime
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord
    }
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing content composition binding dependency: ${name}`)
    }
    return value as T
  }

  function toRecord(value: unknown): LooseRecord {
    if (!value || typeof value !== 'object') {
      return {}
    }
    return value as LooseRecord
  }

  function createEntryNormalizerBinding(options: ContentCompositionOptions): (rows: unknown[]) => unknown[] {
    const corePrimitives = options.corePrimitives
    const entryNormalizerModule = toRecord(options.modules.entryNormalizerModule)
    const entryNormalizer = requireFunction<AnyFn>(
      'createEntryNormalizer',
      entryNormalizerModule.createEntryNormalizer,
    )({
      sanitizePositiveInt: corePrimitives.sanitizePositiveInt,
      getAbsoluteEpisodeNumberFromEpisodeMetadata: corePrimitives.getAbsoluteEpisodeNumberFromEpisodeMetadata,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: corePrimitives.deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      formatEpisodeIdentifier: corePrimitives.formatEpisodeIdentifier,
      hasEnUsAudio: corePrimitives.hasEnUsAudio,
      extractCoverImagesFromApiImages: options.dependencies.extractCoverImagesFromApiImages,
      extractThumbnailImageFromApiImages: options.dependencies.extractThumbnailImageFromApiImages,
      pickFirstDateMs: corePrimitives.pickFirstDateMs,
      getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId,
      getEpisodeAvailabilityByAudioLocale: corePrimitives.getEpisodeAvailabilityByAudioLocale,
      mergeEpisodeAvailabilityByAudioLocale: corePrimitives.mergeEpisodeAvailabilityByAudioLocale,
      normalizeAudioLocales: corePrimitives.normalizeAudioLocales,
    }) as Record<string, unknown>

    return (rows) =>
      requireFunction<AnyFn>(
        'normalizeEntriesFromApiRows',
        (entryNormalizer as Record<string, unknown>).normalizeEntriesFromApiRows,
      )(rows) as unknown[]
  }

  function createDebugRuntime({
    state,
    corePrimitives,
    modules,
    assertRuntimeMethods,
    consoleRef,
  }: {
    state: LooseRecord
    corePrimitives: LooseRecord
    modules: LooseRecord
    assertRuntimeMethods: (owner: string, runtime: AnyFunctionRecord, methods: string[]) => void
    consoleRef: Console
  }): DebugRuntime {
    const runtimeDebugModule = toRecord(modules.runtimeDebugModule)
    const runtime = requireFunction<AnyFn>(
      'createDebugApiRuntime',
      runtimeDebugModule.createDebugApiRuntime,
    )({
      state,
      getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId,
      getWatchHistorySeriesId: corePrimitives.getWatchHistorySeriesId,
      getWatchlistSeriesTitle: corePrimitives.getWatchlistSeriesTitle,
      getWatchHistorySeriesTitle: corePrimitives.getWatchHistorySeriesTitle,
      logRef: (message: unknown) => {
        // eslint-disable-next-line no-console
        consoleRef.log(message)
      },
    }) as AnyFunctionRecord
    assertRuntimeMethods('debug runtime', runtime, ['listSeries', 'dumpSeriesApiData', 'printSeriesApiData'])

    return {
      listKnownSeries: requireFunction<AnyFn>('listKnownSeries', runtime.listSeries),
      dumpSeriesApiData: requireFunction<AnyFn>('dumpSeriesApiData', runtime.dumpSeriesApiData),
      printSeriesApiData: requireFunction<AnyFn>('printSeriesApiData', runtime.printSeriesApiData),
    }
  }

  function createContentCompositionBindingsRuntime(): ContentCompositionBindingsRuntime {
    return {
      createEntryNormalizerBinding,
      createDebugRuntime,
    }
  }

  moduleRegistry.runtimeContentCompositionBindings = {
    createContentCompositionBindingsRuntime,
  }
})()
