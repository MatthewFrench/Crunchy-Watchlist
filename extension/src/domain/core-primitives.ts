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

  type CorePrimitivesContext = {
    extractCoverImagesFromApiImages: (images: unknown) => CoverImageResult
  }

  type CountType = 'season' | 'episode'

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

  function createCorePrimitivesContext(deps: CorePrimitivesDeps = {}): CorePrimitivesContext {
    return {
      extractCoverImagesFromApiImages: requireFunction(
        'extractCoverImagesFromApiImages',
        deps.extractCoverImagesFromApiImages,
      ) as CorePrimitivesContext['extractCoverImagesFromApiImages'],
    }
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

  function parseRatingPayload(payload: Record<string, unknown> | null | undefined): {
    rating: number | null
    votes: number | null
  } {
    const candidateRating = [
      payload?.rating && typeof payload.rating === 'object'
        ? (payload.rating as Record<string, unknown>).average
        : null,
      payload?.rating && typeof payload.rating === 'object' ? (payload.rating as Record<string, unknown>).value : null,
      payload?.average,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>).average : null,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>).rating : null,
      Array.isArray(payload?.data) &&
      payload?.data[0] &&
      typeof payload.data[0] === 'object' &&
      (payload.data[0] as Record<string, unknown>).rating &&
      typeof (payload.data[0] as Record<string, unknown>).rating === 'object'
        ? ((payload.data[0] as Record<string, unknown>).rating as Record<string, unknown>).average
        : null,
      Array.isArray(payload?.data) &&
      payload?.data[0] &&
      typeof payload.data[0] === 'object' &&
      (payload.data[0] as Record<string, unknown>).rating &&
      typeof (payload.data[0] as Record<string, unknown>).rating === 'object'
        ? ((payload.data[0] as Record<string, unknown>).rating as Record<string, unknown>).value
        : null,
      payload?.result && typeof payload.result === 'object'
        ? (payload.result as Record<string, unknown>).average
        : null,
      payload?.aggregateRating && typeof payload.aggregateRating === 'object'
        ? (payload.aggregateRating as Record<string, unknown>).ratingValue
        : null,
      payload?.aggregateRating && typeof payload.aggregateRating === 'object'
        ? (payload.aggregateRating as Record<string, unknown>).rating
        : null,
    ]
      .map(sanitizeRating)
      .find((value) => value != null)

    const candidateVotes = [
      payload?.rating && typeof payload.rating === 'object' ? (payload.rating as Record<string, unknown>).count : null,
      payload?.rating && typeof payload.rating === 'object' ? (payload.rating as Record<string, unknown>).total : null,
      payload?.count,
      payload?.total,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>).count : null,
      payload?.data && typeof payload.data === 'object' ? (payload.data as Record<string, unknown>).total : null,
      Array.isArray(payload?.data) &&
      payload?.data[0] &&
      typeof payload.data[0] === 'object' &&
      (payload.data[0] as Record<string, unknown>).rating &&
      typeof (payload.data[0] as Record<string, unknown>).rating === 'object'
        ? ((payload.data[0] as Record<string, unknown>).rating as Record<string, unknown>).count
        : null,
      Array.isArray(payload?.data) &&
      payload?.data[0] &&
      typeof payload.data[0] === 'object' &&
      (payload.data[0] as Record<string, unknown>).rating &&
      typeof (payload.data[0] as Record<string, unknown>).rating === 'object'
        ? ((payload.data[0] as Record<string, unknown>).rating as Record<string, unknown>).total
        : null,
      payload?.aggregateRating && typeof payload.aggregateRating === 'object'
        ? (payload.aggregateRating as Record<string, unknown>).ratingCount
        : null,
    ]
      .map(sanitizeVotes)
      .find((value) => value != null)

    let rating = candidateRating ?? null
    let votes = candidateVotes ?? null

    if (rating == null || votes == null) {
      const serialized = JSON.stringify(payload || {})

      if (rating == null) {
        const ratingMatch = serialized.match(/"(?:average|ratingValue|rating)"\s*:\s*"?([0-5](?:\\.\d+)?)"?/i)
        if (ratingMatch) {
          rating = sanitizeRating(ratingMatch[1])
        }
      }

      if (votes == null) {
        const votesMatch = serialized.match(/"(?:ratingCount|votes|total|count)"\s*:\s*"?(\d{1,10})"?/i)
        if (votesMatch) {
          votes = sanitizeVotes(votesMatch[1])
        }
      }
    }

    return { rating, votes }
  }

  function parseRatingDistribution(ratingBlock: unknown): Record<string, number | null> | null {
    if (!ratingBlock || typeof ratingBlock !== 'object') {
      return null
    }

    const distribution: Record<string, number | null> = {}
    let hasAny = false

    for (let star = 1; star <= 5; star += 1) {
      const bucket = (ratingBlock as Record<string, unknown>)[`${star}s`]
      const bucketRecord = bucket && typeof bucket === 'object' ? (bucket as Record<string, unknown>) : null
      const percentage = sanitizePercentage(bucketRecord?.percentage ?? bucketRecord?.displayed)
      distribution[String(star)] = percentage
      if (percentage != null) {
        hasAny = true
      }
    }

    return hasAny ? distribution : null
  }

  function parseCmsObjectRecord(context: CorePrimitivesContext, record: unknown): Record<string, unknown> {
    const objectRecord = record && typeof record === 'object' ? (record as Record<string, unknown>) : {}
    const seriesId = typeof objectRecord.id === 'string' ? objectRecord.id : null
    const parsedRating = parseRatingPayload(objectRecord)
    const seriesMetadata =
      objectRecord.series_metadata && typeof objectRecord.series_metadata === 'object'
        ? (objectRecord.series_metadata as Record<string, unknown>)
        : {}
    const audioLocales = normalizeAudioLocales(seriesMetadata.audio_locales)
    const description = typeof objectRecord.description === 'string' ? objectRecord.description.trim() : ''
    const episodeCount = sanitizePositiveInt(seriesMetadata.episode_count)
    const seasonCount = sanitizePositiveInt(seriesMetadata.season_count)
    const genreTags = normalizeTagList([
      ...(Array.isArray(seriesMetadata.genres) ? seriesMetadata.genres : []),
      ...(Array.isArray(seriesMetadata.tenant_categories) ? seriesMetadata.tenant_categories : []),
    ])
    const coverImages = context.extractCoverImagesFromApiImages(objectRecord.images)
    const ratingRecord = objectRecord.rating && typeof objectRecord.rating === 'object' ? objectRecord.rating : null

    return {
      seriesId,
      rating: parsedRating.rating,
      votes: parsedRating.votes,
      distribution: parseRatingDistribution(ratingRecord),
      audioLocales,
      description,
      episodeCount,
      seasonCount,
      genreTags,
      portraitImageUrl: coverImages.portrait,
      landscapeImageUrl: coverImages.landscape,
    }
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

  function extractSeasonCoreFromSeasonId(value: unknown): number | null {
    if (value == null) {
      return null
    }

    const text = String(value).trim()
    if (!text) {
      return null
    }

    const seasonIdMatch = text.match(/^GS(\d+)(?:[A-Z]{4})?$/i)
    if (seasonIdMatch?.[1]) {
      return sanitizePositiveInt(seasonIdMatch[1])
    }

    const compactMatch = text.match(/^S(\d+)$/i)
    if (compactMatch?.[1]) {
      return sanitizePositiveInt(compactMatch[1])
    }

    return null
  }

  function parseCanonicalEpisodeIdentifier(
    value: unknown,
  ): { seriesId: string; seasonCore: number; episodeNumber: number; canonicalEpisodeKey: string } | null {
    if (value == null) {
      return null
    }

    const text = String(value).trim()
    if (!text) {
      return null
    }

    const match = text.match(/^([^|]+)\|S(\d+)\|E(\d+)$/i)
    if (!match) {
      return null
    }

    const seriesId = String(match[1] || '').trim()
    const seasonCore = sanitizePositiveInt(match[2])
    const episodeNumber = sanitizePositiveInt(match[3])

    if (!seriesId || seasonCore == null || episodeNumber == null) {
      return null
    }

    return {
      seriesId,
      seasonCore,
      episodeNumber,
      canonicalEpisodeKey: `${seriesId}|S${seasonCore}|E${episodeNumber}`,
    }
  }

  function buildCanonicalEpisodeKey(seriesId: unknown, seasonCore: unknown, episodeNumber: unknown): string | null {
    const normalizedSeriesId = typeof seriesId === 'string' ? seriesId.trim() : ''
    const normalizedSeasonCore = sanitizePositiveInt(seasonCore)
    const normalizedEpisodeNumber = sanitizePositiveInt(episodeNumber)

    if (!normalizedSeriesId || normalizedSeasonCore == null || normalizedEpisodeNumber == null) {
      return null
    }

    return `${normalizedSeriesId}|S${normalizedSeasonCore}|E${normalizedEpisodeNumber}`
  }

  function deriveCanonicalEpisodeKeyFromEpisodeMetadata(
    meta: unknown,
    fallbackSeriesId: unknown = null,
  ): string | null {
    const metadata = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
    const parsedIdentifier = parseCanonicalEpisodeIdentifier(metadata.identifier)
    if (parsedIdentifier) {
      if (!fallbackSeriesId || parsedIdentifier.seriesId === fallbackSeriesId) {
        return parsedIdentifier.canonicalEpisodeKey
      }
    }

    const seriesId =
      typeof fallbackSeriesId === 'string' && fallbackSeriesId
        ? fallbackSeriesId
        : typeof metadata.series_id === 'string'
          ? metadata.series_id
          : ''
    const seasonCore = pickFirstPositiveInt([
      extractSeasonCoreFromSeasonId(metadata.season_id),
      sanitizePositiveInt(metadata.season_number),
    ])
    const episodeNumber = sanitizePositiveInt(metadata.episode_number)

    return buildCanonicalEpisodeKey(seriesId, seasonCore, episodeNumber)
  }

  function getAbsoluteEpisodeNumberFromEpisodeMetadata(meta: unknown): number | null {
    const metadata = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
    const seasonNumber = sanitizePositiveInt(metadata.season_number)
    const episodeNumber = sanitizePositiveInt(metadata.episode_number)
    return pickFirstPositiveInt([
      sanitizePositiveInt(metadata.sequence_number),
      sanitizePositiveInt(metadata.episode_sequence_number),
      sanitizePositiveInt(metadata.global_episode_number),
      sanitizePositiveInt(metadata.global_episode_num),
      seasonNumber === 1 ? episodeNumber : null,
    ])
  }

  function getEpisodeAvailabilityByAudioLocale(meta: unknown): Record<string, number> {
    const metadata = meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
    const absoluteEpisodeNumber = getAbsoluteEpisodeNumberFromEpisodeMetadata(metadata)
    if (absoluteEpisodeNumber == null) {
      return {}
    }

    const byAudioLocale: Record<string, number> = {}
    const panelAudioLocale = normalizeAudioLocale(metadata.audio_locale)
    if (panelAudioLocale) {
      byAudioLocale[panelAudioLocale.toLowerCase()] = absoluteEpisodeNumber
    }

    if (Array.isArray(metadata.versions)) {
      for (const version of metadata.versions) {
        const record = version && typeof version === 'object' ? (version as Record<string, unknown>) : {}
        const locale = normalizeAudioLocale(record.audio_locale)
        if (!locale) {
          continue
        }

        const localeKey = locale.toLowerCase()
        const previous = sanitizePositiveInt(byAudioLocale[localeKey]) ?? 0
        byAudioLocale[localeKey] = Math.max(previous, absoluteEpisodeNumber)
      }
    }

    return byAudioLocale
  }

  function mergeEpisodeAvailabilityByAudioLocale(previousMap: unknown, nextMap: unknown): Record<string, number> {
    const merged = { ...normalizeAudioLocaleCountMap(previousMap) }
    if (!nextMap || typeof nextMap !== 'object' || Array.isArray(nextMap)) {
      return merged
    }

    const entries = Object.entries(nextMap as Record<string, unknown>)
    for (const [localeKey, value] of entries) {
      const locale = normalizeAudioLocale(localeKey)
      const absoluteEpisodeNumber = sanitizePositiveInt(value)
      if (!locale || absoluteEpisodeNumber == null) {
        continue
      }

      const storageKey = locale.toLowerCase()
      const previous = sanitizePositiveInt(merged[storageKey]) ?? 0
      merged[storageKey] = Math.max(previous, absoluteEpisodeNumber)
    }

    return merged
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
    const context = createCorePrimitivesContext(deps)
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
      parseRatingPayload,
      parseRatingDistribution,
      parseCmsObjectRecord: (record: unknown) => parseCmsObjectRecord(context, record),
      normalizeAudioLocaleCountMap,
      mergeAudioLocaleCountMap,
      getAudioLocaleCountFromMap,
      extractSeasonCoreFromSeasonId,
      parseCanonicalEpisodeIdentifier,
      buildCanonicalEpisodeKey,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      getAbsoluteEpisodeNumberFromEpisodeMetadata,
      getEpisodeAvailabilityByAudioLocale,
      mergeEpisodeAvailabilityByAudioLocale,
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
