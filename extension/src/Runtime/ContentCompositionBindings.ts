type RuntimeBoundaryValue = CwBoundaryValue;
type RuntimeCallback = (...args: RuntimeBoundaryValue[]) => RuntimeBoundaryValue;
type LooseRecord = Record<string, RuntimeBoundaryValue>;
type RuntimeCallbackRecord = Record<string, RuntimeCallback>;
type RuntimeMethodAsserter = (owner: string, runtime: RuntimeCallbackRecord, methods: string[]) => void;

type ContentCompositionOptions = {
  state: LooseRecord;
  modules: LooseRecord;
  corePrimitives: LooseRecord;
  dependencies: LooseRecord;
};

type DebugRuntime = {
  listKnownSeries: (options?: RuntimeBoundaryValue) => RuntimeBoundaryValue;
  getCuratedDomStats: (options?: RuntimeBoundaryValue) => RuntimeBoundaryValue;
  dumpSeriesApiData: (seriesId: RuntimeBoundaryValue, options?: RuntimeBoundaryValue) => RuntimeBoundaryValue;
  printSeriesApiData: (seriesId: RuntimeBoundaryValue, options?: RuntimeBoundaryValue) => RuntimeBoundaryValue;
};

type EntryNormalizerRuntime = {
  normalizeEntriesFromApiRows: (rows: RuntimeBoundaryValue[]) => RuntimeBoundaryValue[];
};

type ContentCompositionBindingsRuntime = {
  createEntryNormalizerBinding: (
    options: ContentCompositionOptions,
  ) => (rows: RuntimeBoundaryValue[]) => RuntimeBoundaryValue[];
  createDebugRuntime: (options: {
    state: LooseRecord;
    corePrimitives: LooseRecord;
    modules: LooseRecord;
    assertRuntimeMethods: RuntimeMethodAsserter;
    consoleRef: Console;
  }) => DebugRuntime;
};

function requireFunction<T>(name: string, value: RuntimeBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing content composition binding dependency: ${name}`);
  }
  return value as T;
}

function toRecord(value: RuntimeBoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as LooseRecord;
}

function createEntryNormalizerBinding(
  options: ContentCompositionOptions,
): (rows: RuntimeBoundaryValue[]) => RuntimeBoundaryValue[] {
  const corePrimitives = options.corePrimitives;
  const entryNormalizerModule = toRecord(options.modules.entryNormalizerModule);
  const createEntryNormalizer = requireFunction<(options: LooseRecord) => EntryNormalizerRuntime>(
    'createEntryNormalizer',
    entryNormalizerModule.createEntryNormalizer,
  );
  const entryNormalizer = createEntryNormalizer({
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
  });

  const normalizeEntriesFromApiRows = requireFunction<EntryNormalizerRuntime['normalizeEntriesFromApiRows']>(
    'normalizeEntriesFromApiRows',
    entryNormalizer.normalizeEntriesFromApiRows,
  );
  return (rows) => normalizeEntriesFromApiRows(rows);
}

function createDebugRuntime({
  state,
  corePrimitives,
  modules,
  assertRuntimeMethods,
  consoleRef,
}: {
  state: LooseRecord;
  corePrimitives: LooseRecord;
  modules: LooseRecord;
  assertRuntimeMethods: RuntimeMethodAsserter;
  consoleRef: Console;
}): DebugRuntime {
  const runtimeDebugModule = toRecord(modules.runtimeDebugModule);
  const createDebugApiRuntime = requireFunction<(options: LooseRecord) => RuntimeCallbackRecord>(
    'createDebugApiRuntime',
    runtimeDebugModule.createDebugApiRuntime,
  );
  const runtime = createDebugApiRuntime({
    state,
    getWatchlistSeriesId: corePrimitives.getWatchlistSeriesId,
    getWatchHistorySeriesId: corePrimitives.getWatchHistorySeriesId,
    getWatchlistSeriesTitle: corePrimitives.getWatchlistSeriesTitle,
    getWatchHistorySeriesTitle: corePrimitives.getWatchHistorySeriesTitle,
    logRef: (message: RuntimeBoundaryValue) => {
      // eslint-disable-next-line no-console
      consoleRef.log(message);
    },
  });
  assertRuntimeMethods('debug runtime', runtime, [
    'listSeries',
    'getCuratedDomStats',
    'dumpSeriesApiData',
    'printSeriesApiData',
  ]);

  return {
    listKnownSeries: requireFunction<DebugRuntime['listKnownSeries']>('listKnownSeries', runtime.listSeries),
    getCuratedDomStats: requireFunction<DebugRuntime['getCuratedDomStats']>(
      'getCuratedDomStats',
      runtime.getCuratedDomStats,
    ),
    dumpSeriesApiData: requireFunction<DebugRuntime['dumpSeriesApiData']>(
      'dumpSeriesApiData',
      runtime.dumpSeriesApiData,
    ),
    printSeriesApiData: requireFunction<DebugRuntime['printSeriesApiData']>(
      'printSeriesApiData',
      runtime.printSeriesApiData,
    ),
  };
}

export function createContentCompositionBindingsRuntime(): ContentCompositionBindingsRuntime {
  return {
    createEntryNormalizerBinding,
    createDebugRuntime,
  };
}
