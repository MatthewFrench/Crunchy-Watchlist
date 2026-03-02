type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type HistoryPreloadEntry = {
  seriesId?: BoundaryValue;
  neverWatched?: BoundaryValue;
  playheadMs?: BoundaryValue;
};

type ResolveHistoryPreloadPlanOptions = {
  entries: HistoryPreloadEntry[];
  preferredAudioLanguage: BoundaryValue;
  getPreferredAudioLanguage: () => string;
  normalizeAudioLocale: (value: BoundaryValue) => string;
};

type ResolveHistoryPreloadPlanResult = {
  effectivePreferredAudioLanguage: string;
  isDefaultPreferredAudio: boolean;
  candidateSeriesIds: string[];
};

type GetHistoryPayloadTotalOptions = {
  payload: BoundaryValue;
  fallback: number;
  pageNumber: number;
  requestUrl: string;
  runtimeEvent: (event: string, payload?: BoundaryValue) => void;
};

function toRecord(value: BoundaryValue): BoundaryRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as BoundaryRecord;
}

function resolveHistoryPreloadPlanInternal(options: ResolveHistoryPreloadPlanOptions): ResolveHistoryPreloadPlanResult {
  const defaultPreferredAudioLanguage = options.getPreferredAudioLanguage();
  const effectivePreferredAudioLanguage =
    options.normalizeAudioLocale(options.preferredAudioLanguage) || defaultPreferredAudioLanguage;
  const isDefaultPreferredAudio =
    effectivePreferredAudioLanguage.toLowerCase() === defaultPreferredAudioLanguage.toLowerCase();
  const candidateSeriesIds = Array.from(
    new Set(
      options.entries
        .filter((entry) => entry?.seriesId)
        .filter((entry) => !entry.neverWatched || Number(entry.playheadMs || 0) > 0)
        .map((entry) => (typeof entry.seriesId === 'string' ? entry.seriesId : ''))
        .filter((seriesId): seriesId is string => !!seriesId),
    ),
  );

  return {
    effectivePreferredAudioLanguage,
    isDefaultPreferredAudio,
    candidateSeriesIds,
  };
}

function getHistoryPayloadTotalInternal(options: GetHistoryPayloadTotalOptions): number {
  const totalValue = toRecord(options.payload).total;
  const parsedTotal = Number(totalValue);
  if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
    options.runtimeEvent('watch-history-contract-warning', {
      reason: 'invalid-total-value',
      totalValue,
      fallbackTotal: options.fallback,
      page: Math.max(1, Number(options.pageNumber) || 1),
      requestUrl: options.requestUrl,
    });
    return options.fallback;
  }

  return Math.round(parsedTotal);
}

function toResolveHistoryPreloadPlanOptions(value: BoundaryValue): ResolveHistoryPreloadPlanOptions {
  return value as ResolveHistoryPreloadPlanOptions;
}

function toGetHistoryPayloadTotalOptions(value: BoundaryValue): GetHistoryPayloadTotalOptions {
  return value as GetHistoryPayloadTotalOptions;
}

export function resolveHistoryPreloadPlan(options: BoundaryValue): ResolveHistoryPreloadPlanResult {
  return resolveHistoryPreloadPlanInternal(toResolveHistoryPreloadPlanOptions(options));
}

export function getHistoryPayloadTotal(options: BoundaryValue): number {
  return getHistoryPayloadTotalInternal(toGetHistoryPayloadTotalOptions(options));
}
