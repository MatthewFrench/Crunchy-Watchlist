;(() => {
  type RatingResult = {
    rating: number | null
    votes: number | null
    distribution: unknown
    description: string
    audioLocales: string[]
    episodeCount: number | null
    seasonCount: number | null
    genreTags: string[]
    portraitImageUrl?: string | null
    landscapeImageUrl?: string | null
    preferredAudioLocale?: string
  }

  type RatingCacheEntry = {
    rating: number | null
    votes: number | null
    distribution: unknown
    audioLocales: string[]
    description: string
    episodeCount: number | null
    seasonCount: number | null
    episodeCountByAudioLocale: Record<string, number>
    seasonCountByAudioLocale: Record<string, number>
    genreTags: string[]
    portraitImageUrl?: string | null
    landscapeImageUrl?: string | null
    updatedAt: number
  }

  type RatingsRepositoryCacheSupportContext = {
    state: {
      ratingCache: Record<string, RatingCacheEntry | Record<string, unknown>>
      ratingCacheRevision?: number
    }
    normalizeAudioLocale: (value: unknown) => string
    normalizeAudioLocales: (values: unknown[]) => string[]
    sanitizePositiveInt: (value: unknown) => number | null
    normalizeTagList: (values: unknown[]) => string[]
    normalizeImageUrlCandidate: (value: unknown) => string
    getAudioLocaleCountFromMap: (value: unknown, audioLocale: string) => number | null
    mergeAudioLocaleCountMap: (source: unknown, audioLocale: string, count: number | null) => Record<string, number>
    ratingCacheTtlMs: number
  }

  type RatingsRepositoryCacheSupportRuntime = {
    createEmptyRatingResult: (preferredAudioLocale?: string) => RatingResult
    toRecord: (value: unknown) => Record<string, unknown>
    isCacheValid: (context: RatingsRepositoryCacheSupportContext, entry: unknown) => entry is RatingCacheEntry
    normalizeRatingUpdate: (
      context: RatingsRepositoryCacheSupportContext,
      rawValue: unknown,
      preferredAudioLocale?: unknown,
    ) => Partial<RatingResult> & Record<string, unknown>
    mergeCachedSeriesData: (
      context: RatingsRepositoryCacheSupportContext,
      seriesId: string,
      nextData: Partial<RatingResult> & Record<string, unknown>,
    ) => RatingCacheEntry
    hasEpisodeCountForAudioLocale: (
      context: RatingsRepositoryCacheSupportContext,
      entry: RatingCacheEntry | null,
      audioLocale: string,
    ) => boolean
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function createEmptyRatingResult(preferredAudioLocale = ''): RatingResult {
    const result: RatingResult = {
      rating: null,
      votes: null,
      distribution: null,
      description: '',
      audioLocales: [],
      episodeCount: null,
      seasonCount: null,
      genreTags: [],
    }

    if (preferredAudioLocale) {
      result.preferredAudioLocale = preferredAudioLocale
    }

    return result
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }

    return value as Record<string, unknown>
  }

  function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null
    }

    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    return null
  }

  function toStringArray(values: unknown): string[] {
    if (!Array.isArray(values)) {
      return []
    }

    return values.filter((value): value is string => typeof value === 'string' && !!value)
  }

  function toRatingCacheEntry(value: unknown): Partial<RatingCacheEntry> {
    if (!value || typeof value !== 'object') {
      return {}
    }

    return value as Partial<RatingCacheEntry>
  }

  function isCacheValid(context: RatingsRepositoryCacheSupportContext, entry: unknown): entry is RatingCacheEntry {
    if (!entry || typeof entry !== 'object') {
      return false
    }

    if (!Object.hasOwn(entry, 'distribution')) {
      return false
    }

    if (!Array.isArray((entry as Record<string, unknown>).audioLocales)) {
      return false
    }

    if (typeof (entry as Record<string, unknown>).description !== 'string') {
      return false
    }

    if (!Object.hasOwn(entry, 'episodeCount')) {
      return false
    }

    if (!Object.hasOwn(entry, 'seasonCount')) {
      return false
    }

    if (!Array.isArray((entry as Record<string, unknown>).genreTags)) {
      return false
    }

    if (!Object.hasOwn(entry, 'portraitImageUrl')) {
      return false
    }

    if (!Object.hasOwn(entry, 'landscapeImageUrl')) {
      return false
    }

    if (typeof (entry as Record<string, unknown>).updatedAt !== 'number') {
      return false
    }

    return Date.now() - ((entry as RatingCacheEntry).updatedAt || 0) < context.ratingCacheTtlMs
  }

  function mergeCachedSeriesData(
    context: RatingsRepositoryCacheSupportContext,
    seriesId: string,
    nextData: Partial<RatingResult> & Record<string, unknown>,
  ): RatingCacheEntry {
    const previous = toRatingCacheEntry(context.state.ratingCache[seriesId])
    const preferredAudioLocale = context.normalizeAudioLocale(nextData.preferredAudioLocale)
    const normalizedEpisodeCount = context.sanitizePositiveInt(nextData.episodeCount)
    const normalizedSeasonCount = context.sanitizePositiveInt(nextData.seasonCount)
    const episodeCountByAudioLocale = context.mergeAudioLocaleCountMap(
      previous.episodeCountByAudioLocale,
      preferredAudioLocale,
      normalizedEpisodeCount,
    )
    const seasonCountByAudioLocale = context.mergeAudioLocaleCountMap(
      previous.seasonCountByAudioLocale,
      preferredAudioLocale,
      normalizedSeasonCount,
    )

    const merged: RatingCacheEntry = {
      rating: nextData.rating ?? previous.rating ?? null,
      votes: nextData.votes ?? previous.votes ?? null,
      distribution: nextData.distribution ?? previous.distribution ?? null,
      audioLocales:
        Array.isArray(nextData.audioLocales) && nextData.audioLocales.length
          ? context.normalizeAudioLocales(nextData.audioLocales)
          : context.normalizeAudioLocales(toStringArray(previous.audioLocales)),
      description:
        typeof nextData.description === 'string' && nextData.description.trim()
          ? nextData.description.trim()
          : typeof previous.description === 'string'
            ? previous.description
            : '',
      episodeCount: normalizedEpisodeCount ?? context.sanitizePositiveInt(previous.episodeCount),
      seasonCount: normalizedSeasonCount ?? context.sanitizePositiveInt(previous.seasonCount),
      episodeCountByAudioLocale,
      seasonCountByAudioLocale,
      genreTags:
        Array.isArray(nextData.genreTags) && nextData.genreTags.length
          ? context.normalizeTagList(nextData.genreTags)
          : context.normalizeTagList(toStringArray(previous.genreTags)),
      portraitImageUrl:
        context.normalizeImageUrlCandidate(nextData.portraitImageUrl) ||
        context.normalizeImageUrlCandidate(previous.portraitImageUrl),
      landscapeImageUrl:
        context.normalizeImageUrlCandidate(nextData.landscapeImageUrl) ||
        context.normalizeImageUrlCandidate(previous.landscapeImageUrl),
      updatedAt: Date.now(),
    }

    context.state.ratingCache[seriesId] = merged
    context.state.ratingCacheRevision = (context.state.ratingCacheRevision || 0) + 1
    return merged
  }

  function normalizeRatingUpdate(
    context: RatingsRepositoryCacheSupportContext,
    rawValue: unknown,
    preferredAudioLocale: unknown = '',
  ): Partial<RatingResult> & Record<string, unknown> {
    const value = toRecord(rawValue)
    const preferredAudioLanguage = context.normalizeAudioLocale(preferredAudioLocale)
    const normalizedPreferredAudioLocale =
      context.normalizeAudioLocale(value.preferredAudioLocale) || preferredAudioLanguage

    return {
      ...(normalizedPreferredAudioLocale ? { preferredAudioLocale: normalizedPreferredAudioLocale } : {}),
      rating: toFiniteNumber(value.rating),
      votes: context.sanitizePositiveInt(value.votes),
      distribution: value.distribution ?? null,
      description: typeof value.description === 'string' ? value.description : '',
      audioLocales: toStringArray(value.audioLocales),
      episodeCount: context.sanitizePositiveInt(value.episodeCount),
      seasonCount: context.sanitizePositiveInt(value.seasonCount),
      genreTags: toStringArray(value.genreTags),
      portraitImageUrl: context.normalizeImageUrlCandidate(value.portraitImageUrl) || null,
      landscapeImageUrl: context.normalizeImageUrlCandidate(value.landscapeImageUrl) || null,
    }
  }

  function hasEpisodeCountForAudioLocale(
    context: RatingsRepositoryCacheSupportContext,
    entry: RatingCacheEntry | null,
    audioLocale: string,
  ): boolean {
    if (!entry) {
      return false
    }

    return context.getAudioLocaleCountFromMap(entry.episodeCountByAudioLocale, audioLocale) != null
  }

  function createRatingsRepositoryCacheSupportRuntime(): RatingsRepositoryCacheSupportRuntime {
    return {
      createEmptyRatingResult,
      toRecord,
      isCacheValid,
      normalizeRatingUpdate,
      mergeCachedSeriesData,
      hasEpisodeCountForAudioLocale,
    }
  }

  moduleRegistry.ratingsRepositoryCacheSupport = {
    createRatingsRepositoryCacheSupportRuntime,
  }
})()
