;(() => {
  type NormalizeAudioLocaleFn = (value: unknown) => string | null
  type GetPreferredAudioLanguageFn = () => string
  type CacheLookupFn = (seriesId: unknown, audioLocale?: unknown, allowSeriesFallback?: unknown) => unknown
  type NormalizeAudioLocalesFn = (locales: unknown[]) => string[]
  type HasEnUsAudioFn = (locales: unknown[]) => boolean
  type NormalizeTagListFn = (values: unknown[]) => string[]
  type NormalizeImageUrlCandidateFn = (value: unknown) => string | null
  type GetAudioLocaleCountFromMapFn = (map: unknown, audioLocale: unknown) => number | null
  type GetLocalizedSeriesCountFn = (ratingEntry: unknown, audioLocale: unknown, countType: unknown) => number | null
  type SanitizePositiveIntFn = (value: unknown) => number | null
  type PickFirstDateMsFn = (values: unknown[]) => number | null
  type DeriveDisplayStatusBaseFn = (entry: unknown, watchHistoryEntry: unknown) => string
  type IsEntryWatchReadyFn = (entry: unknown) => boolean
  type CompareRenderableEntriesFn = (left: unknown, right: unknown, sortMode?: unknown) => number

  type CuratedRenderableOptions = {
    normalizeAudioLocale?: unknown
    getPreferredAudioLanguage?: unknown
    getCachedRating?: unknown
    getCachedWatchHistory?: unknown
    getCachedWatchHistoryProgress?: unknown
    normalizeAudioLocales?: unknown
    hasEnUsAudio?: unknown
    normalizeTagList?: unknown
    normalizeImageUrlCandidate?: unknown
    getAudioLocaleCountFromMap?: unknown
    getLocalizedSeriesCount?: unknown
    sanitizePositiveInt?: unknown
    pickFirstDateMs?: unknown
    deriveDisplayStatusBase?: unknown
    isEntryWatchReady?: unknown
    compareRenderableEntries?: unknown
  }

  type FilterContext = {
    effectiveAudioFilter: string
    effectiveGenreFilter: string
    selectedAudioLocale: string | null
    selectedAudioIsDefaultPreferred: boolean
    localizedAudioForCounts: string | null
  }

  type BuildRenderableEntriesResult = {
    mode: 'none' | 'dim' | 'hide' | 'hide_not_started'
    total: number
    visible: Record<string, unknown>[]
    audioOptions: Array<{ optionValue: string; title: string }>
    genreOptions: Array<{ optionValue: string; title: string }>
    selectedAudioFilter: string
    selectedGenreFilter: string
  }

  type CuratedRenderableRuntime = {
    resolveRenderableFilterContext: (settings: unknown) => FilterContext
    mergeRenderableEntry: (entry: unknown, filterContext: FilterContext) => Record<string, unknown>
    collectRenderableAttributeValues: (entries: unknown[], key: string) => string[]
    applyRenderableEntryFilters: (
      mergedEntries: Record<string, unknown>[],
      filterContext: FilterContext,
      watchReadyFilterMode: string,
    ) => Record<string, unknown>[]
    buildRenderableEntries: (entries: unknown[], settings: unknown) => BuildRenderableEntriesResult
  }

  type CuratedRenderableDependencies = {
    normalizeAudioLocale: NormalizeAudioLocaleFn
    getPreferredAudioLanguage: GetPreferredAudioLanguageFn
    getCachedRating: CacheLookupFn
    getCachedWatchHistory: CacheLookupFn
    getCachedWatchHistoryProgress: CacheLookupFn
    normalizeAudioLocales: NormalizeAudioLocalesFn
    hasEnUsAudio: HasEnUsAudioFn
    normalizeTagList: NormalizeTagListFn
    normalizeImageUrlCandidate: NormalizeImageUrlCandidateFn
    getAudioLocaleCountFromMap: GetAudioLocaleCountFromMapFn
    getLocalizedSeriesCount: GetLocalizedSeriesCountFn
    sanitizePositiveInt: SanitizePositiveIntFn
    pickFirstDateMs: PickFirstDateMsFn
    deriveDisplayStatusBase: DeriveDisplayStatusBaseFn
    isEntryWatchReady: IsEntryWatchReadyFn
    compareRenderableEntries: CompareRenderableEntriesFn
  }

  const VALID_WATCH_READY_FILTER_MODES = new Set(['none', 'dim', 'hide', 'hide_not_started'])
  const FAVORITES_GENRE_FILTER_VALUE = '__favorites__'

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated renderable dependency: ${name}`)
    }
    return value as T
  }

  function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as Record<string, unknown>
  }

  function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : []
  }

  function buildCuratedFilterOptions(anyTitle: string, selectedFilter: string, values: string[]) {
    return [
      { optionValue: 'any', title: anyTitle },
      ...(selectedFilter !== 'any' && !values.includes(selectedFilter)
        ? [{ optionValue: selectedFilter, title: `${selectedFilter} (no matches)` }]
        : []),
      ...values.map((value) => ({ optionValue: value, title: value })),
    ]
  }

  function buildGenreFilterOptions(selectedFilter: string, values: string[]) {
    const options = [{ optionValue: 'any', title: 'Any genre' }]
    if (
      selectedFilter !== 'any' &&
      selectedFilter !== FAVORITES_GENRE_FILTER_VALUE &&
      !values.includes(selectedFilter)
    ) {
      options.push({
        optionValue: selectedFilter,
        title: `${selectedFilter} (no matches)`,
      })
    }

    options.push({
      optionValue: FAVORITES_GENRE_FILTER_VALUE,
      title: 'Favorites',
    })

    values.forEach((value) => {
      if (value === FAVORITES_GENRE_FILTER_VALUE) {
        return
      }
      options.push({
        optionValue: value,
        title: value,
      })
    })

    return options
  }

  function isFavoritesGenreFilter(value: string): boolean {
    return value.trim().toLowerCase() === FAVORITES_GENRE_FILTER_VALUE
  }

  function resolveWatchReadyFilterMode(value: unknown): 'none' | 'dim' | 'hide' | 'hide_not_started' {
    if (typeof value === 'string' && VALID_WATCH_READY_FILTER_MODES.has(value)) {
      return value as 'none' | 'dim' | 'hide' | 'hide_not_started'
    }
    return 'hide'
  }

  function resolveSortMode(value: unknown): string {
    return typeof value === 'string' && value.trim() ? value.trim() : 'none'
  }

  function resolveCuratedRenderableDependencies(options: CuratedRenderableOptions = {}): CuratedRenderableDependencies {
    return {
      normalizeAudioLocale: requireFunction<NormalizeAudioLocaleFn>(
        'normalizeAudioLocale',
        options.normalizeAudioLocale,
      ),
      getPreferredAudioLanguage: requireFunction<GetPreferredAudioLanguageFn>(
        'getPreferredAudioLanguage',
        options.getPreferredAudioLanguage,
      ),
      getCachedRating: requireFunction<CacheLookupFn>('getCachedRating', options.getCachedRating),
      getCachedWatchHistory: requireFunction<CacheLookupFn>('getCachedWatchHistory', options.getCachedWatchHistory),
      getCachedWatchHistoryProgress: requireFunction<CacheLookupFn>(
        'getCachedWatchHistoryProgress',
        options.getCachedWatchHistoryProgress,
      ),
      normalizeAudioLocales: requireFunction<NormalizeAudioLocalesFn>(
        'normalizeAudioLocales',
        options.normalizeAudioLocales,
      ),
      hasEnUsAudio: requireFunction<HasEnUsAudioFn>('hasEnUsAudio', options.hasEnUsAudio),
      normalizeTagList: requireFunction<NormalizeTagListFn>('normalizeTagList', options.normalizeTagList),
      normalizeImageUrlCandidate: requireFunction<NormalizeImageUrlCandidateFn>(
        'normalizeImageUrlCandidate',
        options.normalizeImageUrlCandidate,
      ),
      getAudioLocaleCountFromMap: requireFunction<GetAudioLocaleCountFromMapFn>(
        'getAudioLocaleCountFromMap',
        options.getAudioLocaleCountFromMap,
      ),
      getLocalizedSeriesCount: requireFunction<GetLocalizedSeriesCountFn>(
        'getLocalizedSeriesCount',
        options.getLocalizedSeriesCount,
      ),
      sanitizePositiveInt: requireFunction<SanitizePositiveIntFn>('sanitizePositiveInt', options.sanitizePositiveInt),
      pickFirstDateMs: requireFunction<PickFirstDateMsFn>('pickFirstDateMs', options.pickFirstDateMs),
      deriveDisplayStatusBase: requireFunction<DeriveDisplayStatusBaseFn>(
        'deriveDisplayStatusBase',
        options.deriveDisplayStatusBase,
      ),
      isEntryWatchReady: requireFunction<IsEntryWatchReadyFn>('isEntryWatchReady', options.isEntryWatchReady),
      compareRenderableEntries: requireFunction<CompareRenderableEntriesFn>(
        'compareRenderableEntries',
        options.compareRenderableEntries,
      ),
    }
  }

  function resolveRenderableFilterContextInternal(
    settings: unknown,
    dependencies: CuratedRenderableDependencies,
  ): FilterContext {
    const settingsRecord = asRecord(settings)
    const normalizedAudioFilter = String(settingsRecord.audioLocaleFilter || 'any')
    const normalizedGenreFilter = String(settingsRecord.genreFilter || 'any')
    const effectiveAudioFilter = normalizedAudioFilter.trim() || 'any'
    const effectiveGenreFilter = normalizedGenreFilter.trim() || 'any'
    const selectedAudioLocale =
      effectiveAudioFilter !== 'any' ? dependencies.normalizeAudioLocale(effectiveAudioFilter) : null
    const defaultPreferredAudioLanguage = dependencies.getPreferredAudioLanguage()
    const selectedAudioIsDefaultPreferred = selectedAudioLocale
      ? selectedAudioLocale.toLowerCase() === defaultPreferredAudioLanguage.toLowerCase()
      : false

    return {
      effectiveAudioFilter,
      effectiveGenreFilter,
      selectedAudioLocale,
      selectedAudioIsDefaultPreferred,
      localizedAudioForCounts: effectiveAudioFilter !== 'any' ? effectiveAudioFilter : null,
    }
  }

  function mergeRenderableEntryInternal(
    entry: unknown,
    filterContext: FilterContext,
    dependencies: CuratedRenderableDependencies,
  ): Record<string, unknown> {
    const entryRecord = asRecord(entry)
    const seriesId = entryRecord.seriesId
    const { selectedAudioLocale, selectedAudioIsDefaultPreferred, localizedAudioForCounts } = filterContext
    const ratingEntry = asRecord(dependencies.getCachedRating(seriesId))
    const watchHistoryEntry = dependencies.getCachedWatchHistory(seriesId)
    const localeWatchHistoryEntry = selectedAudioLocale
      ? dependencies.getCachedWatchHistory(seriesId, selectedAudioLocale, false)
      : null
    const watchHistoryProgressFallback = dependencies.getCachedWatchHistoryProgress(seriesId)
    const localeWatchHistoryProgressEntry = selectedAudioLocale
      ? dependencies.getCachedWatchHistoryProgress(seriesId, selectedAudioLocale, false)
      : null
    const watchHistoryProgressEntry =
      localeWatchHistoryProgressEntry ||
      (selectedAudioIsDefaultPreferred ? watchHistoryProgressFallback : null) ||
      localeWatchHistoryEntry ||
      (selectedAudioIsDefaultPreferred ? watchHistoryEntry : null)
    const rating = ratingEntry.rating ?? null
    const votes = ratingEntry.votes ?? null
    const distribution = ratingEntry.distribution ?? null
    const audioLocales = dependencies.normalizeAudioLocales(
      (Array.isArray(ratingEntry.audioLocales) && ratingEntry.audioLocales.length
        ? ratingEntry.audioLocales
        : asArray(entryRecord.audioLocales)) || [],
    )
    const hasEnglishAudio = dependencies.hasEnUsAudio(audioLocales)
    const description =
      (typeof ratingEntry.description === 'string' && ratingEntry.description.trim()
        ? ratingEntry.description.trim()
        : '') ||
      entryRecord.description ||
      ''
    const knownEpisodeCountForSelectedAudio = localizedAudioForCounts
      ? dependencies.getAudioLocaleCountFromMap(entryRecord.knownEpisodeMaxByAudioLocale, localizedAudioForCounts)
      : null
    const episodeCount =
      dependencies.getLocalizedSeriesCount(ratingEntry, localizedAudioForCounts, 'episode') ??
      knownEpisodeCountForSelectedAudio ??
      dependencies.sanitizePositiveInt(entryRecord.episodeCount)
    const seasonCount =
      dependencies.getLocalizedSeriesCount(ratingEntry, localizedAudioForCounts, 'season') ??
      dependencies.sanitizePositiveInt(entryRecord.seasonCount)
    const genreTags = dependencies.normalizeTagList(
      (Array.isArray(ratingEntry.genreTags) && ratingEntry.genreTags.length
        ? ratingEntry.genreTags
        : asArray(entryRecord.genreTags)) || [],
    )
    const portraitImageUrl =
      dependencies.normalizeImageUrlCandidate(ratingEntry.portraitImageUrl) ||
      dependencies.normalizeImageUrlCandidate(entryRecord.portraitImageUrl) ||
      dependencies.normalizeImageUrlCandidate(entryRecord.imageUrl)
    const landscapeImageUrl =
      dependencies.normalizeImageUrlCandidate(ratingEntry.landscapeImageUrl) ||
      dependencies.normalizeImageUrlCandidate(entryRecord.landscapeImageUrl) ||
      portraitImageUrl
    const hoverPreviewImageUrl = dependencies.normalizeImageUrlCandidate(entryRecord.hoverPreviewImageUrl)
    const lastWatchedMs = dependencies.pickFirstDateMs([
      asRecord(watchHistoryEntry).datePlayedMs,
      entryRecord.lastWatchedMs,
    ])
    const mergedEntry = {
      ...entryRecord,
      description,
      distribution,
      audioLocales,
      hasEnglishAudio,
      episodeCount,
      seasonCount,
      genreTags,
      portraitImageUrl,
      landscapeImageUrl,
      hoverPreviewImageUrl,
      lastWatchedMs,
      watchHistoryProgressEntry,
      imageUrl: portraitImageUrl || landscapeImageUrl || dependencies.normalizeImageUrlCandidate(entryRecord.imageUrl),
      rating,
      votes,
    }
    const statusBase = dependencies.deriveDisplayStatusBase(mergedEntry, localeWatchHistoryEntry || watchHistoryEntry)
    const mergedEntryWithStatus = {
      ...mergedEntry,
      statusBase,
    }
    const watchReady = dependencies.isEntryWatchReady(mergedEntryWithStatus)

    return {
      ...mergedEntryWithStatus,
      watchReady,
    }
  }

  function collectRenderableAttributeValues(entries: unknown[], key: string): string[] {
    return Array.from(
      new Set(
        entries
          .flatMap((entry) => asArray(asRecord(entry)[key]))
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right))
  }

  function hasPlaybackProgress(value: unknown): boolean {
    const number = Number(value)
    return Number.isFinite(number) && number > 0
  }

  // "Hide not watched / not started" focuses the list on series with activity by removing
  // items still in a cold-start state (never watched, no playhead, no watch-history progress).
  function isEntryNotWatchedAndNotStartedInternal(entry: Record<string, unknown>): boolean {
    const statusBase = String(entry.statusBase || '')
      .trim()
      .toLowerCase()
    if (statusBase === 'start watching') {
      return true
    }

    if (!entry.neverWatched) {
      return false
    }

    if (hasPlaybackProgress(entry.playheadMs) || hasPlaybackProgress(entry.lastWatchedMs)) {
      return false
    }

    const watchHistoryProgressEntry = asRecord(entry.watchHistoryProgressEntry)
    if (watchHistoryProgressEntry.fullyWatched) {
      return false
    }

    return !(
      hasPlaybackProgress(watchHistoryProgressEntry.playhead) ||
      hasPlaybackProgress(watchHistoryProgressEntry.playheadMs) ||
      hasPlaybackProgress(watchHistoryProgressEntry.progressMs)
    )
  }

  function applyRenderableEntryFiltersInternal(
    mergedEntries: Record<string, unknown>[],
    filterContext: FilterContext,
    watchReadyFilterMode: string,
  ): Record<string, unknown>[] {
    const { effectiveAudioFilter, effectiveGenreFilter } = filterContext
    let filtered = mergedEntries.slice()

    if (effectiveAudioFilter !== 'any') {
      filtered = filtered.filter((entry) =>
        asArray(entry.audioLocales).some(
          (locale) => String(locale).toLowerCase() === effectiveAudioFilter.toLowerCase(),
        ),
      )
    }

    if (effectiveGenreFilter !== 'any') {
      if (isFavoritesGenreFilter(effectiveGenreFilter)) {
        filtered = filtered.filter((entry) => Boolean(entry.isFavorite))
      } else {
        filtered = filtered.filter((entry) =>
          asArray(entry.genreTags).some((tag) => String(tag).toLowerCase() === effectiveGenreFilter.toLowerCase()),
        )
      }
    }

    if (watchReadyFilterMode === 'hide') {
      filtered = filtered.filter((entry) => Boolean(entry.watchReady))
    }
    if (watchReadyFilterMode === 'hide_not_started') {
      filtered = filtered.filter((entry) => !isEntryNotWatchedAndNotStartedInternal(entry))
    }

    return filtered
  }

  function buildRankMap(
    entries: Record<string, unknown>[],
    compareEntries: (left: Record<string, unknown>, right: Record<string, unknown>) => number,
  ): Map<Record<string, unknown>, number> {
    const sorted = entries.slice().sort((left, right) => compareEntries(left, right))
    const rankMap = new Map<Record<string, unknown>, number>()
    sorted.forEach((entry, index) => {
      rankMap.set(entry, index)
    })
    return rankMap
  }

  function sortDecoratedEntriesInternal(
    decorated: Record<string, unknown>[],
    settingsRecord: Record<string, unknown>,
    dependencies: CuratedRenderableDependencies,
  ): void {
    const primarySortMode = resolveSortMode(settingsRecord.sortMode)
    const requestedSecondarySortMode = resolveSortMode(settingsRecord.secondarySortMode)
    const secondarySortMode = requestedSecondarySortMode === primarySortMode ? 'none' : requestedSecondarySortMode
    const comparePrimary = (left: Record<string, unknown>, right: Record<string, unknown>) =>
      dependencies.compareRenderableEntries(left, right, primarySortMode)

    if (secondarySortMode === 'none') {
      decorated.sort((left, right) => comparePrimary(left, right))
      return
    }

    const compareSecondary = (left: Record<string, unknown>, right: Record<string, unknown>) =>
      dependencies.compareRenderableEntries(left, right, secondarySortMode)
    const primaryRanks = buildRankMap(decorated, comparePrimary)
    const secondaryRanks = buildRankMap(decorated, compareSecondary)

    // Entry-sorting comparators are total-order (original-index tiebreak), so deterministic
    // rank positions are safe to average for blended ordering.
    decorated.sort((left, right) => {
      const leftPrimaryRank = primaryRanks.get(left) ?? Number.POSITIVE_INFINITY
      const rightPrimaryRank = primaryRanks.get(right) ?? Number.POSITIVE_INFINITY
      const leftSecondaryRank = secondaryRanks.get(left) ?? Number.POSITIVE_INFINITY
      const rightSecondaryRank = secondaryRanks.get(right) ?? Number.POSITIVE_INFINITY

      const leftAverageRank = (leftPrimaryRank + leftSecondaryRank) / 2
      const rightAverageRank = (rightPrimaryRank + rightSecondaryRank) / 2
      if (leftAverageRank !== rightAverageRank) {
        return leftAverageRank - rightAverageRank
      }
      if (leftPrimaryRank !== rightPrimaryRank) {
        return leftPrimaryRank - rightPrimaryRank
      }
      if (leftSecondaryRank !== rightSecondaryRank) {
        return leftSecondaryRank - rightSecondaryRank
      }
      return comparePrimary(left, right)
    })
  }

  function buildRenderableEntriesInternal(
    entries: unknown[],
    settings: unknown,
    dependencies: CuratedRenderableDependencies,
  ): BuildRenderableEntriesResult {
    const normalizedEntries = Array.isArray(entries) ? entries : []
    const filterContext = resolveRenderableFilterContextInternal(settings, dependencies)
    const { effectiveAudioFilter, effectiveGenreFilter } = filterContext
    const settingsRecord = asRecord(settings)
    const merged = normalizedEntries.map((entry) => mergeRenderableEntryInternal(entry, filterContext, dependencies))
    const watchReadyFilterMode = resolveWatchReadyFilterMode(settingsRecord.watchReadyFilterMode)
    const audioValues = collectRenderableAttributeValues(merged, 'audioLocales')
    const genreValues = collectRenderableAttributeValues(merged, 'genreTags')
    const filtered = applyRenderableEntryFiltersInternal(merged, filterContext, watchReadyFilterMode)
    const decorated = filtered.map((entry) => ({
      ...entry,
      dimNotWatchReady: watchReadyFilterMode === 'dim' && !entry.watchReady,
    }))

    sortDecoratedEntriesInternal(decorated, settingsRecord, dependencies)

    return {
      mode: watchReadyFilterMode,
      total: merged.length,
      visible: decorated,
      audioOptions: buildCuratedFilterOptions('Any language', effectiveAudioFilter, audioValues),
      genreOptions: buildGenreFilterOptions(effectiveGenreFilter, genreValues),
      selectedAudioFilter: effectiveAudioFilter,
      selectedGenreFilter: effectiveGenreFilter,
    }
  }

  function createCuratedRenderable(options: CuratedRenderableOptions = {}): CuratedRenderableRuntime {
    const dependencies = resolveCuratedRenderableDependencies(options)
    return {
      resolveRenderableFilterContext: (settings) => resolveRenderableFilterContextInternal(settings, dependencies),
      mergeRenderableEntry: (entry, filterContext) => mergeRenderableEntryInternal(entry, filterContext, dependencies),
      collectRenderableAttributeValues,
      applyRenderableEntryFilters: (mergedEntries, filterContext, watchReadyFilterMode) =>
        applyRenderableEntryFiltersInternal(mergedEntries, filterContext, watchReadyFilterMode),
      buildRenderableEntries: (entries, settings) => buildRenderableEntriesInternal(entries, settings, dependencies),
    }
  }

  moduleRegistry.runtimeRenderable = {
    createCuratedRenderable,
  }
})()
