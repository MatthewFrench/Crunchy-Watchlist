type WatchHistoryEntry = {
  seriesId: string
  datePlayedMs: number
  datePlayed: string
  seasonNumber: number | null
  episodeNumber: number | null
  absoluteEpisodeNumber: number | null
  episodeId: string | null
  identifier: string
  canonicalEpisodeKey: string
  episodeTitle: string
  playhead: number
  fullyWatched: boolean
  audioLocale: string
  audioLocaleInferred: boolean
}

type WatchHistoryLocaleMap = Record<string, WatchHistoryEntry>

type WatchHistoryCache = {
  version: number
  accountId: string
  updatedAt: number
  bySeriesId: Record<string, WatchHistoryEntry>
  bySeriesIdAudioLocale: Record<string, WatchHistoryLocaleMap>
  bySeriesIdProgress: Record<string, WatchHistoryEntry>
  bySeriesIdAudioLocaleProgress: Record<string, WatchHistoryLocaleMap>
}

type WatchHistoryState = {
  watchHistoryCache: WatchHistoryCache
  watchHistoryStatus: string
  watchHistoryInflight: Promise<unknown> | null
} & LooseRecord

type TokenEntry = {
  accessToken?: unknown
  accountId?: unknown
} & LooseRecord

type HistoryPreloadEntry = {
  seriesId?: unknown
  neverWatched?: unknown
  playheadMs?: unknown
} & LooseRecord

type HistoryUpdateBuckets = {
  remainingSeriesIds: Set<string>
  seriesUpdates: Record<string, WatchHistoryEntry>
  seriesProgressUpdates: Record<string, WatchHistoryEntry>
  localeUpdates: Record<string, WatchHistoryLocaleMap>
  localeProgressUpdates: Record<string, WatchHistoryLocaleMap>
  pages: number
  totalRows: number | null
  fetchedRows: number
  noMatchPageStreak: number
  seenRowKeys: Set<string>
}

type WatchHistoryPreloadPlan = {
  effectivePreferredAudioLanguage: string
  isDefaultPreferredAudio: boolean
  candidateSeriesIds: string[]
}

type HistoryRepositoryPreloadContext = {
  state: WatchHistoryState
  normalizeAudioLocale: (value: unknown) => string
  sanitizePositiveInt: (value: unknown) => number | null
  parseDateMs: (value: unknown) => number | null
  deriveCanonicalEpisodeKeyFromEpisodeMetadata: (metadata: LooseRecord, seriesId?: unknown) => string
  getAbsoluteEpisodeNumberFromEpisodeMetadata: (metadata: LooseRecord) => number | null
  getPreferredAudioLanguage: () => string
  getLocale: () => string
  resolveHistoryPreloadPlan: (options: {
    entries: HistoryPreloadEntry[]
    preferredAudioLanguage: unknown
    getPreferredAudioLanguage: () => string
    normalizeAudioLocale: (value: unknown) => string
  }) => WatchHistoryPreloadPlan
  getHistoryPayloadTotal: (options: {
    payload: unknown
    fallback: number
    pageNumber: number
    requestUrl: string
    runtimeEvent: (event: string, payload?: unknown) => void
  }) => number
  collectWatchHistoryUpdateBuckets: (options: {
    tokenEntry: TokenEntry
    effectivePreferredAudioLanguage: string
    candidateSeriesIds: string[]
    isDefaultPreferredAudio: boolean
    watchHistoryMaxPages: number
    watchHistoryPageSize: number
    watchHistoryNoMatchPageLimit: number
    fetchWatchHistoryPage: (
      tokenEntry: TokenEntry,
      pageNumber: number,
      preferredAudioLanguage?: unknown,
    ) => Promise<{ rows: LooseRecord[]; total: number }>
    normalizeAudioLocale: (value: unknown) => string
    sanitizePositiveInt: (value: unknown) => number | null
    parseDateMs: (value: unknown) => number | null
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: (metadata: LooseRecord, seriesId?: unknown) => string
    getAbsoluteEpisodeNumberFromEpisodeMetadata: (metadata: LooseRecord) => number | null
    shouldReplaceWatchHistoryProgress: (
      previous: LooseRecord | null | undefined,
      next: LooseRecord | null | undefined,
    ) => boolean
  }) => Promise<HistoryUpdateBuckets>
  resolveApiHref: (value: string) => string
  fetchWithResilience: (url: string, init: RequestInit, options: LooseRecord) => Promise<Response>
  createAuthRefreshHandler: (tokenEntry: TokenEntry) => unknown
  requirePayloadDataArray: (name: string, payload: unknown) => LooseRecord[]
  auditWatchHistoryRowsContract: (rows: LooseRecord[]) => void
  normalizeStoredWatchHistoryCache: (raw: unknown) => WatchHistoryCache
  normalizeStoredWatchHistoryBySeriesAudioLocale: (raw: unknown) => Record<string, WatchHistoryLocaleMap>
  normalizeWatchHistoryEntry: (value: unknown) => WatchHistoryEntry | null
  isWatchHistoryCacheValid: (cache: unknown, accountId?: unknown) => boolean
  shouldReplaceWatchHistoryProgress: (
    previous: LooseRecord | null | undefined,
    next: LooseRecord | null | undefined,
  ) => boolean
  getCachedWatchHistory: (
    seriesId: unknown,
    audioLocale?: unknown,
    allowSeriesFallback?: boolean,
  ) => WatchHistoryEntry | null
  scheduleSaveWatchHistory: () => void
  pushApiTrace: (bucket: string, payload: unknown) => void
  runtimeEvent: (event: string, payload?: unknown) => void
  watchHistoryCacheVersion: number
  watchHistoryPageSize: number
  watchHistoryMaxPages: number
  watchHistoryNoMatchPageLimit: number
}

type HistoryRepositoryPreloadOptions = {
  state?: unknown
  normalizeAudioLocale?: unknown
  sanitizePositiveInt?: unknown
  parseDateMs?: unknown
  deriveCanonicalEpisodeKeyFromEpisodeMetadata?: unknown
  getAbsoluteEpisodeNumberFromEpisodeMetadata?: unknown
  getPreferredAudioLanguage?: unknown
  getLocale?: unknown
  resolveApiHref?: unknown
  fetchWithResilience?: unknown
  createAuthRefreshHandler?: unknown
  requirePayloadDataArray?: unknown
  auditWatchHistoryRowsContract?: unknown
  normalizeStoredWatchHistoryCache?: unknown
  normalizeStoredWatchHistoryBySeriesAudioLocale?: unknown
  normalizeWatchHistoryEntry?: unknown
  isWatchHistoryCacheValid?: unknown
  shouldReplaceWatchHistoryProgress?: unknown
  getCachedWatchHistory?: unknown
  scheduleSaveWatchHistory?: unknown
  pushApiTrace?: unknown
  runtimeEvent?: unknown
  watchHistoryCacheVersion?: unknown
  watchHistoryPageSize?: unknown
  watchHistoryMaxPages?: unknown
  watchHistoryNoMatchPageLimit?: unknown
}

type HistoryRepositoryPreload = {
  preloadWatchHistoryForEntries: (
    entries: unknown,
    tokenEntry: unknown,
    force?: boolean,
    preferredAudioLanguage?: unknown,
  ) => Promise<unknown>
  isLocalizedWatchHistoryDataMissingForEntries: (entries: unknown, audioLocale: unknown) => boolean
}
