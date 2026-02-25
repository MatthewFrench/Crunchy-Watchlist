;(() => {
  type LooseRecord = {
    [key: string]: unknown
    panel?: LooseRecord
    episode_metadata?: LooseRecord
    series_metadata?: LooseRecord
  }

  type TokenEntry = {
    accessToken?: unknown
    accountId?: unknown
  } & LooseRecord

  type WatchHistoryEntry = {
    seriesId: string
    datePlayedMs: number
    datePlayed: string
    seasonNumber: number | null
    episodeNumber: number | null
    absoluteEpisodeNumber: number | null
    episodeDurationMs: number | null
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

  type CollectWatchHistoryUpdateBuckets = (options: {
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

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function createWatchHistoryUpdateBuckets(candidateSeriesIds: string[]): HistoryUpdateBuckets {
    return {
      remainingSeriesIds: new Set<string>(candidateSeriesIds),
      seriesUpdates: {},
      seriesProgressUpdates: {},
      localeUpdates: {},
      localeProgressUpdates: {},
      pages: 0,
      totalRows: null,
      fetchedRows: 0,
      noMatchPageStreak: 0,
      seenRowKeys: new Set<string>(),
    }
  }

  function parseWatchHistoryRow(
    options: Parameters<CollectWatchHistoryUpdateBuckets>[0],
    entry: LooseRecord | null | undefined,
    fallbackAudioLocale: unknown = null,
  ): WatchHistoryEntry | null {
    const resolvedSeriesId = entry?.panel?.episode_metadata?.series_id || entry?.panel?.series_metadata?.series_id
    if (typeof resolvedSeriesId !== 'string' || !resolvedSeriesId) {
      return null
    }
    const seriesId = resolvedSeriesId

    const datePlayedMs = options.parseDateMs(entry?.date_played)
    if (datePlayedMs == null) {
      return null
    }

    const meta = entry?.panel?.episode_metadata || {}
    const seasonNumber = options.sanitizePositiveInt(meta?.season_number)
    const episodeNumber = options.sanitizePositiveInt(meta?.episode_number)
    const absoluteEpisodeNumber = options.getAbsoluteEpisodeNumberFromEpisodeMetadata(meta)
    const episodeDurationMs = options.sanitizePositiveInt(meta?.duration_ms ?? meta?.durationMs)
    const explicitAudioLocale = options.normalizeAudioLocale(
      meta?.audio_locale || entry?.panel?.audio_locale || entry?.audio_locale || entry?.audioLocale,
    )
    const audioLocale = explicitAudioLocale || options.normalizeAudioLocale(fallbackAudioLocale)
    const identifier = typeof meta?.identifier === 'string' ? meta.identifier : ''
    const canonicalEpisodeKey = options.deriveCanonicalEpisodeKeyFromEpisodeMetadata(meta, seriesId)
    const episodeId =
      typeof entry?.id === 'string' ? entry.id : typeof entry?.panel?.id === 'string' ? entry.panel.id : null

    return {
      seriesId,
      datePlayedMs,
      datePlayed: new Date(datePlayedMs).toISOString(),
      seasonNumber,
      episodeNumber,
      absoluteEpisodeNumber,
      episodeDurationMs,
      episodeId,
      identifier,
      canonicalEpisodeKey,
      episodeTitle: typeof entry?.panel?.title === 'string' ? entry.panel.title : '',
      playhead: Number(entry?.playhead || 0),
      fullyWatched: Boolean(entry?.fully_watched),
      audioLocale,
      audioLocaleInferred: !explicitAudioLocale && Boolean(audioLocale),
    }
  }

  function mergeWatchHistoryParsedEntry(
    options: Parameters<CollectWatchHistoryUpdateBuckets>[0],
    parsed: WatchHistoryEntry,
    buckets: HistoryUpdateBuckets,
  ): boolean {
    let matchedCandidate = false

    if (options.isDefaultPreferredAudio) {
      const previous = buckets.seriesUpdates[parsed.seriesId]
      if (!previous || parsed.datePlayedMs > previous.datePlayedMs) {
        buckets.seriesUpdates[parsed.seriesId] = parsed
      }

      const previousProgress = buckets.seriesProgressUpdates[parsed.seriesId]
      if (options.shouldReplaceWatchHistoryProgress(previousProgress, parsed)) {
        buckets.seriesProgressUpdates[parsed.seriesId] = parsed
      }
    }

    const locale = options.normalizeAudioLocale(parsed.audioLocale)
    if (locale) {
      const localeStorageKey = locale.toLowerCase()
      const perSeriesLocaleMap: WatchHistoryLocaleMap = buckets.localeUpdates[parsed.seriesId] || {}
      const previousByLocale = perSeriesLocaleMap[localeStorageKey]
      if (!previousByLocale || parsed.datePlayedMs > previousByLocale.datePlayedMs) {
        perSeriesLocaleMap[localeStorageKey] = {
          ...parsed,
          audioLocale: locale,
        }
      }
      buckets.localeUpdates[parsed.seriesId] = perSeriesLocaleMap

      const perSeriesLocaleProgressMap: WatchHistoryLocaleMap = buckets.localeProgressUpdates[parsed.seriesId] || {}
      const previousProgressByLocale = perSeriesLocaleProgressMap[localeStorageKey]
      if (options.shouldReplaceWatchHistoryProgress(previousProgressByLocale, parsed)) {
        perSeriesLocaleProgressMap[localeStorageKey] = {
          ...parsed,
          audioLocale: locale,
        }
      }
      buckets.localeProgressUpdates[parsed.seriesId] = perSeriesLocaleProgressMap
    }

    if (buckets.remainingSeriesIds.has(parsed.seriesId)) {
      buckets.remainingSeriesIds.delete(parsed.seriesId)
      matchedCandidate = true
    }

    return matchedCandidate
  }

  const collectWatchHistoryUpdateBuckets: CollectWatchHistoryUpdateBuckets = async (options) => {
    const buckets = createWatchHistoryUpdateBuckets(options.candidateSeriesIds)

    while (buckets.pages < options.watchHistoryMaxPages) {
      buckets.pages += 1
      const page = await options.fetchWatchHistoryPage(
        options.tokenEntry,
        buckets.pages,
        options.effectivePreferredAudioLanguage,
      )
      let matchedOnPage = 0

      if (buckets.totalRows == null) {
        buckets.totalRows = page.total
      }

      buckets.fetchedRows += page.rows.length

      page.rows.forEach((row) => {
        const parsed = parseWatchHistoryRow(options, row, options.effectivePreferredAudioLanguage)
        if (!parsed || !parsed.seriesId || parsed.datePlayedMs == null) {
          return
        }

        const rowKey =
          parsed.canonicalEpisodeKey ||
          parsed.episodeId ||
          `${parsed.seriesId}|${parsed.absoluteEpisodeNumber || ''}|${parsed.datePlayedMs}`
        if (buckets.seenRowKeys.has(rowKey)) {
          return
        }
        buckets.seenRowKeys.add(rowKey)

        if (mergeWatchHistoryParsedEntry(options, parsed, buckets)) {
          matchedOnPage += 1
        }
      })

      if (matchedOnPage === 0 && buckets.remainingSeriesIds.size > 0) {
        buckets.noMatchPageStreak += 1
      } else {
        buckets.noMatchPageStreak = 0
      }

      if (!page.rows.length || page.rows.length < options.watchHistoryPageSize) {
        break
      }

      if (buckets.totalRows != null && buckets.fetchedRows >= buckets.totalRows) {
        break
      }

      if (!buckets.remainingSeriesIds.size) {
        break
      }

      if (buckets.remainingSeriesIds.size && buckets.noMatchPageStreak >= options.watchHistoryNoMatchPageLimit) {
        break
      }
    }

    return buckets
  }

  moduleRegistry.historyRepositoryPreloadCollector = {
    collectWatchHistoryUpdateBuckets,
  }
})()
