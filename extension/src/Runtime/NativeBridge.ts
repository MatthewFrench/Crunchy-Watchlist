;(() => {
  type AnyFn = (...args: unknown[]) => unknown

  type NativeBridgeContext = {
    documentRef: Document
    windowRef: Window
    runtimeEvent: (event: string, data?: unknown) => void
    normalizeImageUrlCandidate: (value: unknown) => string
    fetchPreviewUrlForEntry: (entry: unknown) => Promise<unknown>
    isLikelyVideoUrl: (url: unknown) => boolean
    previewHoverDelayMs: number
  }

  type NativeBridgeOptions = {
    documentRef?: unknown
    windowRef?: unknown
    runtimeEvent?: unknown
    normalizeImageUrlCandidate?: unknown
    fetchPreviewUrlForEntry?: unknown
    isLikelyVideoUrl?: unknown
    previewHoverDelayMs?: unknown
  }

  type PreviewContext = {
    thumbLink: HTMLAnchorElement
    thumbImage: HTMLImageElement | null
    previewImage: HTMLImageElement | null
    previewVideo: HTMLVideoElement | null
    previewTimer: number | null
    previewPollTimer: number | null
    previewSession: number
    activeNativeCard: HTMLElement | null
  }

  type NativeBridgeRuntime = {
    triggerNativeCardAction: (seriesId: unknown, actionType: unknown) => boolean
    installCuratedCardPreview: (
      thumbLink: unknown,
      entry: unknown,
      coverImageUrl: unknown,
      hoverPreviewImageUrl: unknown,
      thumbImage: unknown,
    ) => void
  }

  type EntryLike = {
    seriesId?: unknown
    streamsLink?: unknown
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function requireFunction<T extends AnyFn>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing native bridge dependency: ${name}`)
    }
    return value as T
  }

  function resolveDocumentRef(value: unknown): Document {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing native bridge documentRef')
    }
    return value as Document
  }

  function resolveWindowRef(value: unknown): Window {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing native bridge windowRef')
    }
    return value as Window
  }

  function normalizePositiveNumber(value: unknown, fallback: number): number {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) {
      return fallback
    }
    return Math.round(number)
  }

  function getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
  }

  function createNativeBridgeContext(options: NativeBridgeOptions = {}): NativeBridgeContext {
    return {
      documentRef: resolveDocumentRef(options.documentRef),
      windowRef: resolveWindowRef(options.windowRef),
      runtimeEvent: requireFunction('runtimeEvent', options.runtimeEvent) as NativeBridgeContext['runtimeEvent'],
      normalizeImageUrlCandidate: requireFunction(
        'normalizeImageUrlCandidate',
        options.normalizeImageUrlCandidate,
      ) as NativeBridgeContext['normalizeImageUrlCandidate'],
      fetchPreviewUrlForEntry: requireFunction(
        'fetchPreviewUrlForEntry',
        options.fetchPreviewUrlForEntry,
      ) as NativeBridgeContext['fetchPreviewUrlForEntry'],
      isLikelyVideoUrl: requireFunction(
        'isLikelyVideoUrl',
        options.isLikelyVideoUrl,
      ) as NativeBridgeContext['isLikelyVideoUrl'],
      previewHoverDelayMs: normalizePositiveNumber(options.previewHoverDelayMs, 220),
    }
  }

  function extractSeriesIdFromHref(href: string): string | null {
    const match = href.match(/\/series\/([^/?#]+)/i)
    if (!match || !match[1]) {
      return null
    }

    try {
      return decodeURIComponent(match[1])
    } catch {
      return match[1]
    }
  }

  function getNativeCardSeriesId(card: HTMLElement): string | null {
    const links = Array.from(card.querySelectorAll('a[href*="/series/"]'))
    for (const link of links) {
      const seriesId = extractSeriesIdFromHref(link.getAttribute('href') || '')
      if (seriesId) {
        return seriesId
      }
    }

    return null
  }

  function findNativeCardBySeriesId(documentRef: Document, seriesId: string): HTMLElement | null {
    if (!seriesId) {
      return null
    }

    const nativeCards = Array.from(documentRef.querySelectorAll('[data-t="watch-list-card"]'))
    for (const card of nativeCards) {
      if (!(card instanceof HTMLElement)) {
        continue
      }

      if (getNativeCardSeriesId(card) === seriesId) {
        return card
      }
    }

    return null
  }

  function findNativeActionButton(card: HTMLElement, actionType: string): HTMLElement | null {
    const selectors =
      actionType === 'favorite'
        ? [
            '[data-cw-native-action="favorite"]',
            'button[aria-label*="favorite" i]',
            '[role="button"][aria-label*="favorite" i]',
            '[data-t*="favorite" i]',
            'button[class*="favorite" i]',
            'button[class*="heart" i]',
          ]
        : [
            '[data-cw-native-action="remove"]',
            'button[aria-label*="remove" i]',
            '[role="button"][aria-label*="remove" i]',
            'button[aria-label*="trash" i]',
            '[role="button"][aria-label*="trash" i]',
            'button[aria-label*="delete" i]',
            '[role="button"][aria-label*="delete" i]',
            '[data-t*="remove" i]',
            'button[class*="remove" i]',
            'button[class*="trash" i]',
            'button[class*="delete" i]',
          ]

    for (const selector of selectors) {
      const button = card.querySelector(selector)
      if (button instanceof HTMLElement) {
        return button
      }
    }

    return null
  }

  function triggerNativeCardActionInternal(
    context: NativeBridgeContext,
    seriesIdValue: unknown,
    actionTypeValue: unknown,
  ): boolean {
    const seriesId = getString(seriesIdValue)
    const actionType = getString(actionTypeValue).toLowerCase()
    if (!seriesId || (actionType !== 'favorite' && actionType !== 'remove')) {
      return false
    }

    const nativeCard = findNativeCardBySeriesId(context.documentRef, seriesId)
    if (!nativeCard) {
      return false
    }

    const nativeButton = findNativeActionButton(nativeCard, actionType)
    if (!nativeButton) {
      return false
    }

    nativeButton.click()
    context.runtimeEvent('native-action-forwarded', {
      seriesId,
      actionType,
    })
    return true
  }

  function extractUrlFromCssBackground(backgroundValue: string): string {
    const match = backgroundValue.match(/url\((['"]?)(.*?)\1\)/i)
    if (!match || !match[2]) {
      return ''
    }

    return contextNormalizeUrl(match[2])
  }

  function contextNormalizeUrl(value: unknown): string {
    const normalized = getString(value)
    if (!normalized) {
      return ''
    }

    try {
      return (root.location ? new URL(normalized, root.location.origin).toString() : normalized) || normalized
    } catch {
      return normalized
    }
  }

  function getNativeCardPreviewUrl(context: NativeBridgeContext, card: HTMLElement): string {
    const mediaSelector = [
      'video',
      'img',
      'picture img',
      '[data-t*="preview"]',
      '[class*="preview"]',
      '[class*="thumbnail"]',
      '[class*="poster"]',
      '[class*="image"]',
    ].join(', ')

    const candidates = Array.from(card.querySelectorAll(mediaSelector))
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) {
        continue
      }

      if (candidate instanceof HTMLVideoElement) {
        const current = candidate.currentSrc || candidate.src
        if (current) {
          return current
        }
      }

      if (candidate instanceof HTMLImageElement) {
        const current = candidate.currentSrc || candidate.src
        if (current) {
          return current
        }
      }

      const styleValue = context.windowRef.getComputedStyle(candidate).backgroundImage
      const backgroundUrl = extractUrlFromCssBackground(styleValue)
      if (backgroundUrl) {
        return backgroundUrl
      }
    }

    return extractUrlFromCssBackground(context.windowRef.getComputedStyle(card).backgroundImage) || ''
  }

  function createCuratedPreviewContext(
    thumbLink: HTMLAnchorElement,
    thumbImage: HTMLImageElement | null,
  ): PreviewContext {
    return {
      thumbLink,
      thumbImage,
      previewImage: null,
      previewVideo: null,
      previewTimer: null,
      previewPollTimer: null,
      previewSession: 0,
      activeNativeCard: null,
    }
  }

  function stopCuratedPreview(context: NativeBridgeContext, previewContext: PreviewContext): void {
    if (previewContext.previewTimer != null) {
      context.windowRef.clearTimeout(previewContext.previewTimer)
    }
    if (previewContext.previewPollTimer != null) {
      context.windowRef.clearTimeout(previewContext.previewPollTimer)
    }
    previewContext.previewTimer = null
    previewContext.previewPollTimer = null

    if (previewContext.activeNativeCard) {
      try {
        previewContext.activeNativeCard.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true, cancelable: true }))
        previewContext.activeNativeCard.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, cancelable: true }))
      } catch {
        // no-op
      }
    }
    previewContext.activeNativeCard = null

    if (previewContext.previewVideo) {
      previewContext.previewVideo.pause()
      previewContext.previewVideo.currentTime = 0
      previewContext.previewVideo.style.display = 'none'
    }

    if (previewContext.previewImage) {
      previewContext.previewImage.style.display = 'none'
    }

    previewContext.thumbLink.classList.remove('cw-curated-card__thumb--previewing')
    if (previewContext.thumbImage) {
      previewContext.thumbImage.style.opacity = ''
    }
  }

  function showCuratedPreviewImage(previewContext: PreviewContext, url: string): void {
    if (!url) {
      return
    }

    if (!previewContext.previewImage) {
      const ownerDocument = previewContext.thumbLink.ownerDocument
      previewContext.previewImage = ownerDocument.createElement('img')
      previewContext.previewImage.className = 'cw-curated-card__preview cw-curated-card__preview-image'
      previewContext.previewImage.alt = ''
      previewContext.previewImage.setAttribute('aria-hidden', 'true')
      previewContext.thumbLink.appendChild(previewContext.previewImage)
    }

    previewContext.previewImage.src = url
    previewContext.previewImage.style.display = 'block'

    if (previewContext.previewVideo) {
      previewContext.previewVideo.pause()
      previewContext.previewVideo.style.display = 'none'
    }

    previewContext.thumbLink.classList.add('cw-curated-card__thumb--previewing')
    if (previewContext.thumbImage) {
      previewContext.thumbImage.style.opacity = '0'
    }
  }

  async function showCuratedPreviewVideo(
    context: NativeBridgeContext,
    previewContext: PreviewContext,
    url: string,
  ): Promise<void> {
    if (!url) {
      return
    }

    if (!previewContext.previewVideo) {
      const ownerDocument = previewContext.thumbLink.ownerDocument
      previewContext.previewVideo = ownerDocument.createElement('video')
      previewContext.previewVideo.className = 'cw-curated-card__preview cw-curated-card__preview-video'
      previewContext.previewVideo.muted = true
      previewContext.previewVideo.loop = true
      previewContext.previewVideo.playsInline = true
      previewContext.previewVideo.preload = 'none'
      previewContext.previewVideo.setAttribute('aria-hidden', 'true')
      previewContext.thumbLink.appendChild(previewContext.previewVideo)
    }

    if (previewContext.previewVideo.src !== url) {
      previewContext.previewVideo.src = url
    }
    previewContext.previewVideo.style.display = 'block'

    if (previewContext.previewImage) {
      previewContext.previewImage.style.display = 'none'
    }

    previewContext.thumbLink.classList.add('cw-curated-card__thumb--previewing')
    if (previewContext.thumbImage) {
      previewContext.thumbImage.style.opacity = '0'
    }

    try {
      await previewContext.previewVideo.play()
    } catch {
      stopCuratedPreview(context, previewContext)
    }
  }

  function startMirroredNativePreviewSession(
    context: NativeBridgeContext,
    previewContext: PreviewContext,
    seriesId: string,
    coverImageUrl: string,
    sessionId: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const nativeCard = findNativeCardBySeriesId(context.documentRef, seriesId)
      if (!nativeCard) {
        resolve(false)
        return
      }

      previewContext.activeNativeCard = nativeCard

      let baseline = ''
      try {
        baseline = getNativeCardPreviewUrl(context, nativeCard)
      } catch {
        resolve(false)
        return
      }
      const fallbackPoster =
        previewContext.thumbImage?.currentSrc || previewContext.thumbImage?.src || coverImageUrl || ''

      try {
        nativeCard.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }))
        nativeCard.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }))
      } catch {
        // no-op
      }

      let attempts = 0
      const poll = () => {
        try {
          if (sessionId !== previewContext.previewSession) {
            resolve(false)
            return
          }

          const current = getNativeCardPreviewUrl(context, nativeCard)
          if (current && current !== baseline && current !== fallbackPoster) {
            showCuratedPreviewImage(previewContext, current)
            resolve(true)
            return
          }

          attempts += 1
          if (attempts >= 8) {
            resolve(false)
            return
          }

          previewContext.previewPollTimer = context.windowRef.setTimeout(poll, 120)
        } catch {
          resolve(false)
        }
      }

      previewContext.previewPollTimer = context.windowRef.setTimeout(poll, 120)
    })
  }

  async function startCuratedPreviewSession(
    context: NativeBridgeContext,
    previewContext: PreviewContext,
    entry: EntryLike,
    coverImageUrl: string,
    hoverPreviewImageUrl: string,
    sessionId: number,
  ): Promise<void> {
    const seriesId = getString(entry.seriesId)
    const mirrored = await startMirroredNativePreviewSession(
      context,
      previewContext,
      seriesId,
      coverImageUrl,
      sessionId,
    )
    if (mirrored || sessionId !== previewContext.previewSession) {
      return
    }

    const fallbackPreviewUrl = hoverPreviewImageUrl || coverImageUrl || ''
    if (!getString(entry.streamsLink)) {
      if (fallbackPreviewUrl) {
        showCuratedPreviewImage(previewContext, fallbackPreviewUrl)
      }
      return
    }

    let previewUrl = ''
    try {
      previewUrl = getString(await context.fetchPreviewUrlForEntry(entry))
    } catch {
      previewUrl = ''
    }

    if (!previewUrl || sessionId !== previewContext.previewSession) {
      if (sessionId === previewContext.previewSession && fallbackPreviewUrl) {
        showCuratedPreviewImage(previewContext, fallbackPreviewUrl)
      }
      return
    }

    const normalizedPreviewUrl = context.normalizeImageUrlCandidate(previewUrl)
    if (
      normalizedPreviewUrl &&
      coverImageUrl &&
      normalizedPreviewUrl === coverImageUrl &&
      hoverPreviewImageUrl &&
      hoverPreviewImageUrl !== coverImageUrl
    ) {
      showCuratedPreviewImage(previewContext, hoverPreviewImageUrl)
      return
    }

    if (context.isLikelyVideoUrl(previewUrl)) {
      await showCuratedPreviewVideo(context, previewContext, previewUrl)
    } else {
      showCuratedPreviewImage(previewContext, previewUrl)
    }
  }

  function queueCuratedPreviewSession(
    context: NativeBridgeContext,
    previewContext: PreviewContext,
    onStartPreview: (sessionId: number) => Promise<void>,
  ): void {
    previewContext.previewSession += 1
    const currentSession = previewContext.previewSession
    if (previewContext.previewTimer != null) {
      context.windowRef.clearTimeout(previewContext.previewTimer)
    }
    previewContext.previewTimer = context.windowRef.setTimeout(() => {
      onStartPreview(currentSession).catch(() => {
        // no-op
      })
    }, context.previewHoverDelayMs)
  }

  function installCuratedCardPreviewInternal(
    context: NativeBridgeContext,
    thumbLinkValue: unknown,
    entryValue: unknown,
    coverImageUrlValue: unknown,
    hoverPreviewImageUrlValue: unknown,
    thumbImageValue: unknown,
  ): void {
    const thumbLink = thumbLinkValue instanceof HTMLAnchorElement ? thumbLinkValue : null
    if (!thumbLink) {
      return
    }

    const entry = (entryValue && typeof entryValue === 'object' ? entryValue : {}) as EntryLike
    const coverImageUrl = context.normalizeImageUrlCandidate(coverImageUrlValue)
    const hoverPreviewImageUrl = context.normalizeImageUrlCandidate(hoverPreviewImageUrlValue)
    const thumbImage = thumbImageValue instanceof HTMLImageElement ? thumbImageValue : null
    const previewContext = createCuratedPreviewContext(thumbLink, thumbImage)

    const startPreview = (sessionId: number) =>
      startCuratedPreviewSession(context, previewContext, entry, coverImageUrl, hoverPreviewImageUrl, sessionId)
    const stopPreview = () => {
      previewContext.previewSession += 1
      stopCuratedPreview(context, previewContext)
    }

    thumbLink.addEventListener('mouseenter', () => {
      queueCuratedPreviewSession(context, previewContext, startPreview)
    })
    thumbLink.addEventListener('mouseleave', () => {
      stopPreview()
    })
    thumbLink.addEventListener('blur', () => {
      stopPreview()
    })
  }

  function createNativeBridgeRuntime(options: NativeBridgeOptions = {}): NativeBridgeRuntime {
    const context = createNativeBridgeContext(options)

    return {
      triggerNativeCardAction: (seriesId, actionType) => triggerNativeCardActionInternal(context, seriesId, actionType),
      installCuratedCardPreview: (thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage) => {
        installCuratedCardPreviewInternal(context, thumbLink, entry, coverImageUrl, hoverPreviewImageUrl, thumbImage)
      },
    }
  }

  moduleRegistry.runtimeNativeBridge = {
    createNativeBridgeRuntime,
  }
})()
