;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type CoverImageResult = {
    portrait: string
    landscape: string
    fallback: string
  }

  type CorePrimitivesDeps = {
    extractCoverImagesFromApiImages?: unknown
  }

  type CountType = 'season' | 'episode'

  type RatingPrimitivesDeps = {
    sanitizeRating: (value: unknown) => number | null
    sanitizeVotes: (value: unknown) => number | null
    sanitizePositiveInt: (value: unknown) => number | null
    sanitizePercentage: (value: unknown) => number | null
    normalizeAudioLocales: (locales: unknown) => string[]
    normalizeTagList: (values: unknown) => string[]
    extractCoverImagesFromApiImages: (images: unknown) => CoverImageResult
  }

  type RatingPrimitivesRuntime = {
    parseRatingPayload: (payload: Record<string, unknown> | null | undefined) => {
      rating: number | null
      votes: number | null
    }
    parseRatingDistribution: (ratingBlock: unknown) => Record<string, number | null> | null
    parseCmsObjectRecord: (record: unknown) => Record<string, unknown>
  }

  type EpisodePrimitivesDeps = {
    sanitizePositiveInt: (value: unknown) => number | null
    pickFirstPositiveInt: (values: unknown[]) => number | null
    normalizeAudioLocale: (locale: unknown) => string | null
    normalizeAudioLocaleCountMap: (value: unknown) => Record<string, number>
  }

  type EpisodePrimitivesRuntime = {
    extractSeasonCoreFromSeasonId: (value: unknown) => number | null
    parseCanonicalEpisodeIdentifier: (
      value: unknown,
    ) => { seriesId: string; seasonCore: number; episodeNumber: number; canonicalEpisodeKey: string } | null
    buildCanonicalEpisodeKey: (seriesId: unknown, seasonCore: unknown, episodeNumber: unknown) => string | null
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: (meta: unknown, fallbackSeriesId?: unknown) => string | null
    getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: unknown) => number | null
    getEpisodeAvailabilityByAudioLocale: (meta: unknown) => Record<string, number>
    mergeEpisodeAvailabilityByAudioLocale: (previousMap: unknown, nextMap: unknown) => Record<string, number>
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing primitive dependency: ${name}`)
    }
    return value as T
  }

  function createRatingPrimitivesRuntime(deps: RatingPrimitivesDeps): RatingPrimitivesRuntime {
    const domainRegistry =
      moduleRegistry.domain && typeof moduleRegistry.domain === 'object'
        ? (moduleRegistry.domain as Record<string, unknown>)
        : {}
    const ratingPrimitivesModule =
      domainRegistry.ratingPrimitives && typeof domainRegistry.ratingPrimitives === 'object'
        ? (domainRegistry.ratingPrimitives as Record<string, unknown>)
        : {}
    const createRatingPrimitives = ratingPrimitivesModule.createRatingPrimitives
    if (typeof createRatingPrimitives !== 'function') {
      throw new Error('[CW] Missing primitive dependency: createRatingPrimitives')
    }

    const runtime = (createRatingPrimitives as (deps: RatingPrimitivesDeps) => unknown)(
      deps,
    ) as Partial<RatingPrimitivesRuntime>
    const requiredMethods = ['parseRatingPayload', 'parseRatingDistribution', 'parseCmsObjectRecord'] as const
    for (const methodName of requiredMethods) {
      if (typeof runtime?.[methodName] !== 'function') {
        throw new Error(`[CW] Missing rating primitive method: ${methodName}`)
      }
    }

    return runtime as RatingPrimitivesRuntime
  }

  function createEpisodePrimitivesRuntime(deps: EpisodePrimitivesDeps): EpisodePrimitivesRuntime {
    const domainRegistry =
      moduleRegistry.domain && typeof moduleRegistry.domain === 'object'
        ? (moduleRegistry.domain as Record<string, unknown>)
        : {}
    const episodePrimitivesModule =
      domainRegistry.episodePrimitives && typeof domainRegistry.episodePrimitives === 'object'
        ? (domainRegistry.episodePrimitives as Record<string, unknown>)
        : {}
    const createEpisodePrimitives = episodePrimitivesModule.createEpisodePrimitives
    if (typeof createEpisodePrimitives !== 'function') {
      throw new Error('[CW] Missing primitive dependency: createEpisodePrimitives')
    }
    const runtime = (createEpisodePrimitives as (deps: EpisodePrimitivesDeps) => unknown)(
      deps,
    ) as Partial<EpisodePrimitivesRuntime>
    const requiredMethods = [
      'extractSeasonCoreFromSeasonId',
      'parseCanonicalEpisodeIdentifier',
      'buildCanonicalEpisodeKey',
      'deriveCanonicalEpisodeKeyFromEpisodeMetadata',
      'getAbsoluteEpisodeNumberFromEpisodeMetadata',
      'getEpisodeAvailabilityByAudioLocale',
      'mergeEpisodeAvailabilityByAudioLocale',
    ] as const
    for (const methodName of requiredMethods) {
      if (typeof runtime?.[methodName] !== 'function') {
        throw new Error(`[CW] Missing episode primitive method: ${methodName}`)
      }
    }

    return runtime as EpisodePrimitivesRuntime
  }

  function sanitizeRating(value: unknown): number | null {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0 || number > 5) {
      return null
    }
    return Math.round(number * 10) / 10
  }

  function sanitizeVotes(value: unknown): number | null {
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0) {
      return null
    }
    return Math.round(number)
  }

  function sanitizePositiveInt(value: unknown): number | null {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) {
      return null
    }
    return Math.round(number)
  }

  function parseDateMs(value: unknown): number | null {
    if (value == null) {
      return null
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value > 1e12) {
        return Math.round(value)
      }
      if (value > 1e9) {
        return Math.round(value * 1000)
      }
      return null
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        return null
      }

      const numeric = Number(trimmed)
      if (Number.isFinite(numeric)) {
        return parseDateMs(numeric)
      }

      const parsed = Date.parse(trimmed)
      return Number.isFinite(parsed) ? parsed : null
    }

    return null
  }

  function pickFirstDateMs(values: unknown[]): number | null {
    for (const value of values) {
      const parsed = parseDateMs(value)
      if (parsed != null) {
        return parsed
      }
    }
    return null
  }

  function pickFirstPositiveInt(values: unknown[]): number | null {
    for (const value of values) {
      const parsed = sanitizePositiveInt(value)
      if (parsed != null) {
        return parsed
      }
    }
    return null
  }

  function sanitizePercentage(value: unknown): number | null {
    if (value == null) {
      return null
    }

    const normalized = typeof value === 'string' ? value.replace('%', '').trim() : value
    const number = Number(normalized)
    if (!Number.isFinite(number) || number < 0 || number > 100) {
      return null
    }

    return Math.round(number)
  }

  function normalizeAudioLocales(locales: unknown): string[] {
    if (!Array.isArray(locales)) {
      return []
    }

    const dedup = new Set<string>()
    const normalized: string[] = []

    for (const locale of locales) {
      const value = String(locale || '').trim()
      if (!value) {
        continue
      }

      const key = value.toLowerCase()
      if (dedup.has(key)) {
        continue
      }

      dedup.add(key)
      normalized.push(value)
    }

    return normalized
  }

  function normalizeAudioLocale(locale: unknown): string | null {
    const normalized = normalizeAudioLocales([locale])
    return normalized.length ? (normalized[0] ?? null) : null
  }

  function normalizeTagList(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return []
    }

    const seen = new Set<string>()
    const normalized: string[] = []

    for (const value of values) {
      const text = String(value || '').trim()
      if (!text) {
        continue
      }

      const key = text.toLowerCase()
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      normalized.push(text)
    }

    return normalized
  }

  function hasEnUsAudio(locales: unknown): boolean {
    return normalizeAudioLocales(locales).some((locale) => locale.toLowerCase() === 'en-us')
  }

  function formatEpisodeIdentifier(seasonNumber: unknown, episodeNumber: unknown): string | null {
    const season = sanitizePositiveInt(seasonNumber)
    const episode = sanitizePositiveInt(episodeNumber)

    if (season != null && episode != null) {
      return `S${season} E${episode}`
    }

    if (episode != null) {
      return `E${episode}`
    }

    return null
  }

  function normalizeAudioLocaleCountMap(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    const normalizedMap: Record<string, number> = {}
    const entries = Object.entries(value as Record<string, unknown>)
    for (const [localeKey, countValue] of entries) {
      const locale = normalizeAudioLocale(localeKey)
      const count = sanitizePositiveInt(countValue)
      if (!locale || count == null) {
        continue
      }

      normalizedMap[locale.toLowerCase()] = count
    }

    return normalizedMap
  }

  function mergeAudioLocaleCountMap(
    previousMap: unknown,
    audioLocale: unknown,
    count: unknown,
  ): Record<string, number> {
    const merged = { ...normalizeAudioLocaleCountMap(previousMap) }
    const locale = normalizeAudioLocale(audioLocale)
    const normalizedCount = sanitizePositiveInt(count)

    if (locale && normalizedCount != null) {
      merged[locale.toLowerCase()] = normalizedCount
    }

    return merged
  }

  function getAudioLocaleCountFromMap(map: unknown, audioLocale: unknown): number | null {
    const locale = normalizeAudioLocale(audioLocale)
    if (!locale) {
      return null
    }

    const normalizedMap = normalizeAudioLocaleCountMap(map)
    return sanitizePositiveInt(normalizedMap[locale.toLowerCase()])
  }

  function chunkArray(values: unknown, chunkSize: unknown): unknown[][] {
    if (!Array.isArray(values) || !values.length || Number(chunkSize) <= 0) {
      return []
    }

    const normalizedSize = Math.max(1, Math.round(Number(chunkSize)))
    const chunks: unknown[][] = []
    for (let index = 0; index < values.length; index += normalizedSize) {
      chunks.push(values.slice(index, index + normalizedSize))
    }
    return chunks
  }

  function getWatchlistSeriesId(entry: unknown): string | null {
    const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
    const panel = row.panel && typeof row.panel === 'object' ? (row.panel as Record<string, unknown>) : {}
    const episodeMetadata =
      panel.episode_metadata && typeof panel.episode_metadata === 'object'
        ? (panel.episode_metadata as Record<string, unknown>)
        : {}
    const seriesMetadata =
      panel.series_metadata && typeof panel.series_metadata === 'object'
        ? (panel.series_metadata as Record<string, unknown>)
        : {}
    const seriesId = episodeMetadata.series_id ?? seriesMetadata.series_id
    return typeof seriesId === 'string' && seriesId ? seriesId : null
  }

  function getWatchHistorySeriesId(entry: unknown): string | null {
    return getWatchlistSeriesId(entry)
  }

  function getWatchlistSeriesTitle(entry: unknown): string {
    const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
    const panel = row.panel && typeof row.panel === 'object' ? (row.panel as Record<string, unknown>) : {}
    const episodeMetadata =
      panel.episode_metadata && typeof panel.episode_metadata === 'object'
        ? (panel.episode_metadata as Record<string, unknown>)
        : {}
    const seriesMetadata =
      panel.series_metadata && typeof panel.series_metadata === 'object'
        ? (panel.series_metadata as Record<string, unknown>)
        : {}
    const title = episodeMetadata.series_title ?? seriesMetadata.title ?? panel.title
    return typeof title === 'string' ? title : ''
  }

  function getWatchHistorySeriesTitle(entry: unknown): string {
    return getWatchlistSeriesTitle(entry)
  }

  function createEmptyRatingResult(preferredAudioLocale: unknown = ''): Record<string, unknown> {
    const result: Record<string, unknown> = {
      rating: null,
      votes: null,
      distribution: null,
      description: '',
      audioLocales: [],
      episodeCount: null,
      seasonCount: null,
      genreTags: [],
    }

    if (typeof preferredAudioLocale === 'string' && preferredAudioLocale) {
      result.preferredAudioLocale = preferredAudioLocale
    }

    return result
  }

  function hasInProgressPlayback(entry: unknown, watchHistoryEntry: unknown): boolean {
    const seriesEntry = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
    const historyEntry =
      watchHistoryEntry && typeof watchHistoryEntry === 'object' ? (watchHistoryEntry as Record<string, unknown>) : {}

    const hasEntryProgress = Number(seriesEntry.playheadMs || 0) > 0 && !seriesEntry.fullyWatched
    if (hasEntryProgress) {
      return true
    }

    return Number(historyEntry.playhead || 0) > 0 && !historyEntry.fullyWatched
  }

  function deriveDisplayStatusBase(entry: unknown, watchHistoryEntry: unknown): string {
    const seriesEntry = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {}
    const statusBase = typeof seriesEntry.statusBase === 'string' ? seriesEntry.statusBase.trim() : ''
    const fallbackStatus = statusBase || 'Up Next'
    const normalizedFallback = fallbackStatus.toLowerCase()

    if (normalizedFallback.includes('unavailable') || normalizedFallback.includes('coming soon')) {
      return fallbackStatus
    }

    if (
      Boolean(seriesEntry.fullyWatched) ||
      normalizedFallback.includes('watch again') ||
      normalizedFallback.includes('rewatch')
    ) {
      return 'Watch Again'
    }

    if (hasInProgressPlayback(seriesEntry, watchHistoryEntry)) {
      return 'Continue'
    }

    if (Boolean(seriesEntry.neverWatched) || normalizedFallback.includes('start watching')) {
      return 'Start Watching'
    }

    return normalizedFallback.includes('up next') ? 'Up Next' : fallbackStatus
  }

  function getLocalizedSeriesCount(ratingEntry: unknown, audioLocale: unknown, countType: CountType): number | null {
    const fallbackFieldName = countType === 'season' ? 'seasonCount' : 'episodeCount'
    const mapFieldName = countType === 'season' ? 'seasonCountByAudioLocale' : 'episodeCountByAudioLocale'
    const entry = ratingEntry && typeof ratingEntry === 'object' ? (ratingEntry as Record<string, unknown>) : {}
    const localizedCount = getAudioLocaleCountFromMap(entry[mapFieldName], audioLocale)
    if (localizedCount != null) {
      return localizedCount
    }

    return sanitizePositiveInt(entry[fallbackFieldName])
  }

  function createCorePrimitives(deps: CorePrimitivesDeps = {}) {
    const extractCoverImagesFromApiImages = requireFunction<(images: unknown) => CoverImageResult>(
      'extractCoverImagesFromApiImages',
      deps.extractCoverImagesFromApiImages,
    )
    const episodePrimitives = createEpisodePrimitivesRuntime({
      sanitizePositiveInt,
      pickFirstPositiveInt,
      normalizeAudioLocale,
      normalizeAudioLocaleCountMap,
    })
    const ratingPrimitives = createRatingPrimitivesRuntime({
      sanitizeRating,
      sanitizeVotes,
      sanitizePositiveInt,
      sanitizePercentage,
      normalizeAudioLocales,
      normalizeTagList,
      extractCoverImagesFromApiImages,
    })
    return {
      sanitizeRating,
      sanitizeVotes,
      sanitizePositiveInt,
      parseDateMs,
      pickFirstDateMs,
      pickFirstPositiveInt,
      sanitizePercentage,
      normalizeAudioLocales,
      normalizeAudioLocale,
      normalizeTagList,
      hasEnUsAudio,
      formatEpisodeIdentifier,
      parseRatingPayload: (payload: Record<string, unknown> | null | undefined) =>
        ratingPrimitives.parseRatingPayload(payload),
      parseRatingDistribution: (ratingBlock: unknown) => ratingPrimitives.parseRatingDistribution(ratingBlock),
      parseCmsObjectRecord: (record: unknown) => ratingPrimitives.parseCmsObjectRecord(record),
      normalizeAudioLocaleCountMap,
      mergeAudioLocaleCountMap,
      getAudioLocaleCountFromMap,
      extractSeasonCoreFromSeasonId: (value: unknown) => episodePrimitives.extractSeasonCoreFromSeasonId(value),
      parseCanonicalEpisodeIdentifier: (value: unknown) => episodePrimitives.parseCanonicalEpisodeIdentifier(value),
      buildCanonicalEpisodeKey: (seriesId: unknown, seasonCore: unknown, episodeNumber: unknown) =>
        episodePrimitives.buildCanonicalEpisodeKey(seriesId, seasonCore, episodeNumber),
      deriveCanonicalEpisodeKeyFromEpisodeMetadata: (meta: unknown, fallbackSeriesId: unknown = null) =>
        episodePrimitives.deriveCanonicalEpisodeKeyFromEpisodeMetadata(meta, fallbackSeriesId),
      getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: unknown) =>
        episodePrimitives.getAbsoluteEpisodeNumberFromEpisodeMetadata(meta),
      getEpisodeAvailabilityByAudioLocale: (meta: unknown) =>
        episodePrimitives.getEpisodeAvailabilityByAudioLocale(meta),
      mergeEpisodeAvailabilityByAudioLocale: (previousMap: unknown, nextMap: unknown) =>
        episodePrimitives.mergeEpisodeAvailabilityByAudioLocale(previousMap, nextMap),
      chunkArray,
      getWatchlistSeriesId,
      getWatchHistorySeriesId,
      getWatchlistSeriesTitle,
      getWatchHistorySeriesTitle,
      createEmptyRatingResult,
      hasInProgressPlayback,
      deriveDisplayStatusBase,
      getLocalizedSeriesCount,
    }
  }

  let domainRegistry = moduleRegistry.domain
  if (!domainRegistry || typeof domainRegistry !== 'object') {
    domainRegistry = {}
    moduleRegistry.domain = domainRegistry
  }

  ;(domainRegistry as Record<string, unknown>).corePrimitives = {
    createCorePrimitives,
  }
})()
