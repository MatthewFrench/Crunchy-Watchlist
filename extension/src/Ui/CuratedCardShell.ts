;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type CuratedEntry = {
    seriesId?: unknown
    fixtureTitle?: unknown
    title?: unknown
    href?: unknown
    episodeHref?: unknown
    rating?: unknown
    votes?: unknown
    dimNotWatchReady?: unknown
    portraitImageUrl?: unknown
    landscapeImageUrl?: unknown
    imageUrl?: unknown
    hoverPreviewImageUrl?: unknown
  } & Record<string, unknown>

  type CuratedCardThumb = {
    thumbLink: HTMLAnchorElement
    coverImageUrl: string
    hoverPreviewImageUrl: string
    thumbImage: HTMLImageElement | null
    progressBar: HTMLElement | null
  }

  type CardShellContext = {
    documentRef: Document
    windowRef: Window & typeof globalThis
    getCardLayout: () => unknown
    normalizeImageUrlCandidate: (value: unknown) => string
    resolveApiHref: (href: unknown) => string
    makeRatingBadge: (rating: unknown, votes: unknown) => HTMLElement
    createCuratedCardActions: (entry: CuratedEntry) => HTMLElement
    createCuratedCardBody: (entry: CuratedEntry, actions: HTMLElement) => HTMLElement
    installCuratedCardPreview: (
      thumbLink: HTMLAnchorElement,
      entry: CuratedEntry,
      coverImageUrl: string,
      hoverPreviewImageUrl: string,
      thumbImage: HTMLImageElement | null,
    ) => void
  }

  type CardShellDeps = {
    documentRef?: unknown
    windowRef?: unknown
    getCardLayout?: unknown
    normalizeImageUrlCandidate?: unknown
    resolveApiHref?: unknown
    makeRatingBadge?: unknown
    createCuratedCardActions?: unknown
    createCuratedCardBody?: unknown
    installCuratedCardPreview?: unknown
  }

  type MinimalEventTarget = {
    closest?: (selector: string) => Element | null
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing card shell dependency: ${name}`)
    }
    return value as T
  }

  function requireDocumentRef(value: unknown): Document {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing card shell dependency: documentRef')
    }
    const candidate = value as { createElement?: unknown }
    if (typeof candidate.createElement !== 'function') {
      throw new Error('[CW] Missing card shell dependency: documentRef.createElement')
    }
    return value as Document
  }

  function requireWindowRef(value: unknown): Window & typeof globalThis {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing card shell dependency: windowRef')
    }
    const candidate = value as { location?: { assign?: unknown } }
    if (!candidate.location || typeof candidate.location.assign !== 'function') {
      throw new Error('[CW] Missing card shell dependency: windowRef.location.assign')
    }
    return value as Window & typeof globalThis
  }

  function toEntry(value: unknown): CuratedEntry {
    if (!value || typeof value !== 'object') {
      return {}
    }
    return value as CuratedEntry
  }

  function getEntryString(entry: CuratedEntry, key: keyof CuratedEntry): string {
    const value = entry[key]
    if (typeof value === 'string') {
      return value
    }
    if (value == null) {
      return ''
    }
    return String(value)
  }

  function normalizeCardLayout(value: unknown): 'portrait' | 'landscape' {
    return value === 'landscape' ? 'landscape' : 'portrait'
  }

  function sanitizeEpisodeProgressRatio(value: unknown): number | null {
    const normalized = Number(value)
    if (!Number.isFinite(normalized) || normalized <= 0 || normalized >= 1) {
      return null
    }
    return normalized
  }

  function toggleClassToken(className: string, token: string, enabled: boolean): string {
    const tokens = className
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
    const hasToken = tokens.includes(token)
    if (enabled && !hasToken) {
      tokens.push(token)
    }
    if (!enabled && hasToken) {
      return tokens.filter((item) => item !== token).join(' ')
    }
    return tokens.join(' ')
  }

  function setClassToken(element: { className?: string }, token: string, enabled: boolean): void {
    element.className = toggleClassToken(element.className || '', token, enabled)
  }

  function resolveCardThumbHref(context: CardShellContext, entry: CuratedEntry): string {
    const directEpisodeHref = context.resolveApiHref(getEntryString(entry, 'episodeHref') || '')
    if (directEpisodeHref) {
      return directEpisodeHref
    }

    const cardHref = context.resolveApiHref(getEntryString(entry, 'href') || '')
    return cardHref || '#'
  }

  function createCardShellContext(deps: CardShellDeps = {}): CardShellContext {
    return {
      documentRef: requireDocumentRef(deps.documentRef),
      windowRef: requireWindowRef(deps.windowRef),
      getCardLayout: requireFunction('getCardLayout', deps.getCardLayout),
      normalizeImageUrlCandidate: requireFunction(
        'normalizeImageUrlCandidate',
        deps.normalizeImageUrlCandidate,
      ) as CardShellContext['normalizeImageUrlCandidate'],
      resolveApiHref: requireFunction('resolveApiHref', deps.resolveApiHref) as CardShellContext['resolveApiHref'],
      makeRatingBadge: requireFunction('makeRatingBadge', deps.makeRatingBadge) as CardShellContext['makeRatingBadge'],
      createCuratedCardActions: requireFunction(
        'createCuratedCardActions',
        deps.createCuratedCardActions,
      ) as CardShellContext['createCuratedCardActions'],
      createCuratedCardBody: requireFunction(
        'createCuratedCardBody',
        deps.createCuratedCardBody,
      ) as CardShellContext['createCuratedCardBody'],
      installCuratedCardPreview: requireFunction(
        'installCuratedCardPreview',
        deps.installCuratedCardPreview,
      ) as CardShellContext['installCuratedCardPreview'],
    }
  }

  function getCardCoverImageInternal(
    context: CardShellContext,
    entry: CuratedEntry,
    layout = normalizeCardLayout(context.getCardLayout()),
  ): string {
    const portrait = context.normalizeImageUrlCandidate(entry.portraitImageUrl)
    const landscape = context.normalizeImageUrlCandidate(entry.landscapeImageUrl)
    const fallback = context.normalizeImageUrlCandidate(entry.imageUrl)

    if (layout === 'landscape') {
      return landscape || portrait || fallback
    }

    return portrait || landscape || fallback
  }

  function attachCuratedCardNavigationInternal(context: CardShellContext, item: HTMLElement, cardHref: string): void {
    if (!cardHref) {
      return
    }

    item.classList.add('cw-curated-card--clickable')
    item.addEventListener('click', (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target as MinimalEventTarget | null
      if (!target || typeof target.closest !== 'function') {
        return
      }
      if (target?.closest?.("a, button, input, select, textarea, label, [role='button']")) {
        return
      }

      const selection = context.windowRef.getSelection?.()
      if (selection?.type === 'Range') {
        return
      }

      context.windowRef.location.assign(cardHref)
    })
  }

  function createCuratedCardHeaderInternal(context: CardShellContext, entry: CuratedEntry): HTMLElement {
    const title = getEntryString(entry, 'title')
    const titleLink = context.documentRef.createElement('a')
    titleLink.className = 'cw-curated-card__title'
    titleLink.href = getEntryString(entry, 'href') || '#'
    titleLink.textContent = title

    const ratingBadge = context.makeRatingBadge(entry.rating, entry.votes)
    ratingBadge.classList.add('cw-rating-badge--headline')

    const header = context.documentRef.createElement('div')
    header.className = 'cw-curated-card__header'
    header.appendChild(titleLink)
    header.appendChild(ratingBadge)

    return header
  }

  function createCuratedCardThumbImageInternal(
    context: CardShellContext,
    thumbLink: HTMLAnchorElement,
    coverImageUrl: string,
  ): HTMLImageElement {
    const loadingIndicator = context.documentRef.createElement('span')
    loadingIndicator.className = 'cw-curated-card__thumb-loading'
    thumbLink.appendChild(loadingIndicator)

    const image = context.documentRef.createElement('img')
    image.loading = 'lazy'
    image.decoding = 'async'
    image.src = coverImageUrl
    image.alt = ''

    // Keep thumbnail dimensions stable and show a spinner until decoding finishes.
    setClassToken(thumbLink, 'cw-curated-card__thumb--loading', true)
    const markThumbImageReady = () => {
      setClassToken(thumbLink, 'cw-curated-card__thumb--loading', false)
      setClassToken(thumbLink, 'cw-curated-card__thumb--failed', false)
      setClassToken(thumbLink, 'cw-curated-card__thumb--loaded', true)
    }
    const markThumbImageFailed = () => {
      setClassToken(thumbLink, 'cw-curated-card__thumb--loading', false)
      setClassToken(thumbLink, 'cw-curated-card__thumb--loaded', false)
      setClassToken(thumbLink, 'cw-curated-card__thumb--failed', true)
    }

    image.addEventListener('load', markThumbImageReady)
    image.addEventListener('error', markThumbImageFailed)
    thumbLink.appendChild(image)

    if (image.complete) {
      if (image.naturalWidth > 0 || image.naturalHeight > 0) {
        markThumbImageReady()
      } else {
        markThumbImageFailed()
      }
    }

    return image
  }

  function createCuratedCardThumbProgressBarInternal(
    context: CardShellContext,
    episodeWatchProgressRatio: number | null,
  ): HTMLElement | null {
    if (episodeWatchProgressRatio == null) {
      return null
    }

    const progressTrack = context.documentRef.createElement('div')
    progressTrack.className = 'cw-curated-card__thumb-progress'
    progressTrack.setAttribute('role', 'progressbar')
    progressTrack.setAttribute('aria-valuemin', '0')
    progressTrack.setAttribute('aria-valuemax', '100')
    progressTrack.setAttribute('aria-valuenow', String(Math.round(episodeWatchProgressRatio * 100)))
    progressTrack.setAttribute(
      'aria-label',
      `${Math.round(episodeWatchProgressRatio * 100)}% of current episode watched`,
    )

    const progressFill = context.documentRef.createElement('span')
    progressFill.className = 'cw-curated-card__thumb-progress-fill'
    progressFill.style.width = `${Math.max(1, Math.round(episodeWatchProgressRatio * 1000) / 10)}%`
    progressTrack.appendChild(progressFill)
    return progressTrack
  }

  function createCuratedCardThumbInternal(context: CardShellContext, entry: CuratedEntry): CuratedCardThumb {
    const title = getEntryString(entry, 'title')
    const thumbLink = context.documentRef.createElement('a')
    thumbLink.className = 'cw-curated-card__thumb'
    thumbLink.href = resolveCardThumbHref(context, entry)
    thumbLink.setAttribute('aria-label', title)
    thumbLink.dataset.cwSeriesId = getEntryString(entry, 'seriesId')

    const coverImageUrl = getCardCoverImageInternal(context, entry)
    const hoverPreviewImageUrl = context.normalizeImageUrlCandidate(entry.hoverPreviewImageUrl)

    let thumbImage: HTMLImageElement | null = null
    if (coverImageUrl) {
      thumbImage = createCuratedCardThumbImageInternal(context, thumbLink, coverImageUrl)
    } else {
      const placeholder = context.documentRef.createElement('span')
      placeholder.className = 'cw-curated-card__placeholder'
      placeholder.textContent = 'No Image'
      thumbLink.appendChild(placeholder)
    }

    const episodeWatchProgressRatio = sanitizeEpisodeProgressRatio(entry.episodeWatchProgressRatio)
    const progressBar = createCuratedCardThumbProgressBarInternal(context, episodeWatchProgressRatio)

    return {
      thumbLink,
      coverImageUrl,
      hoverPreviewImageUrl,
      thumbImage,
      progressBar,
    }
  }

  function moveDescriptionIntoMediaInternal(media: HTMLElement, body: HTMLElement): void {
    const searchableBody = body as HTMLElement & {
      querySelector?: (selectors: string) => Element | null
    }
    if (typeof searchableBody.querySelector !== 'function') {
      return
    }

    const description = searchableBody.querySelector('.cw-curated-card__description')
    if (!description) {
      return
    }

    media.appendChild(description as HTMLElement)
  }

  function createCuratedCardInternal(context: CardShellContext, inputEntry: unknown): HTMLElement {
    const entry = toEntry(inputEntry)

    const item = context.documentRef.createElement('article')
    item.className = 'cw-curated-card'
    item.dataset.cwSeriesId = getEntryString(entry, 'seriesId')
    item.dataset.cwCuratedTitle = getEntryString(entry, 'fixtureTitle') || getEntryString(entry, 'title')

    if (entry.dimNotWatchReady) {
      item.classList.add('cw-curated-card--not-watch-ready')
    }

    const cardHref = context.resolveApiHref(getEntryString(entry, 'href') || '')
    attachCuratedCardNavigationInternal(context, item, cardHref)

    const header = createCuratedCardHeaderInternal(context, entry)
    const media = context.documentRef.createElement('div')
    media.className = 'cw-curated-card__media'

    const { thumbLink, coverImageUrl, hoverPreviewImageUrl, thumbImage, progressBar } = createCuratedCardThumbInternal(
      context,
      entry,
    )
    context.installCuratedCardPreview(thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage)

    const actions = context.createCuratedCardActions(entry)
    const body = context.createCuratedCardBody(entry, actions)

    media.appendChild(thumbLink)
    if (progressBar) {
      media.appendChild(progressBar)
    }
    moveDescriptionIntoMediaInternal(media, body)
    item.appendChild(header)
    item.appendChild(media)
    item.appendChild(body)

    return item
  }

  function createCardShell(deps: CardShellDeps = {}) {
    const context = createCardShellContext(deps)
    return {
      getCardCoverImage: (entry: unknown, layout: unknown = context.getCardLayout()) =>
        getCardCoverImageInternal(context, toEntry(entry), normalizeCardLayout(layout)),
      attachCuratedCardNavigation: (item: HTMLElement, cardHref: string) =>
        attachCuratedCardNavigationInternal(context, item, cardHref),
      createCuratedCardHeader: (entry: unknown) => createCuratedCardHeaderInternal(context, toEntry(entry)),
      createCuratedCardThumb: (entry: unknown) => createCuratedCardThumbInternal(context, toEntry(entry)),
      createCuratedCard: (entry: unknown) => createCuratedCardInternal(context, entry),
    }
  }

  let uiRegistry = moduleRegistry.ui
  if (!uiRegistry || typeof uiRegistry !== 'object') {
    uiRegistry = {}
    moduleRegistry.ui = uiRegistry
  }

  ;(uiRegistry as Record<string, unknown>).cardShell = {
    createCardShell,
  }
})()
