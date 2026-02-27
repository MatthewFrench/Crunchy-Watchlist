import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type NativeBridgePreviewRuntime = {
  installCuratedCardPreview: (
    thumbLink: unknown,
    entry: unknown,
    coverImageUrl: unknown,
    hoverPreviewImageUrl: unknown,
    thumbImage: unknown,
  ) => void
}

type NativeBridgePreviewModule = {
  runtimeNativeBridgePreview: {
    createNativeBridgePreviewRuntime: (options: Record<string, unknown>) => NativeBridgePreviewRuntime
  }
}

const nativeBridgePreviewModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'NativeBridgePreview.ts'),
).href

async function flushMicrotasks(iterations = 6): Promise<void> {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve()
  }
}

class FakeClassList {
  private readonly classes = new Set<string>()

  add(value: string): void {
    this.classes.add(value)
  }

  remove(value: string): void {
    this.classes.delete(value)
  }

  has(value: string): boolean {
    return this.classes.has(value)
  }
}

class FakeDocument {
  createElement(tagName: string): FakeElement {
    const lowered = tagName.toLowerCase()
    if (lowered === 'img') {
      return new FakeImage(this)
    }
    if (lowered === 'video') {
      return new FakeVideo(this)
    }
    return new FakeElement(this)
  }
}

type FakeEvent = {
  type: string
}

class FakeElement {
  readonly classList = new FakeClassList()
  readonly style: Record<string, string> = {}
  readonly children: FakeElement[] = []
  readonly ownerDocument: FakeDocument
  className = ''
  backgroundImage = ''

  private readonly attributes = new Map<string, string>()
  private readonly selectorAllMap = new Map<string, FakeElement[]>()
  private readonly listeners = new Map<string, Array<(event: FakeEvent) => void>>()

  constructor(ownerDocument: FakeDocument) {
    this.ownerDocument = ownerDocument
  }

  setQuerySelectorAll(selector: string, results: FakeElement[]): void {
    this.selectorAllMap.set(selector, results)
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorAllMap.get(selector) ?? []
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child)
    return child
  }

  addEventListener(eventType: string, listener: (event: FakeEvent) => void): void {
    const existing = this.listeners.get(eventType) ?? []
    existing.push(listener)
    this.listeners.set(eventType, existing)
  }

  dispatchEvent(event: FakeEvent): boolean {
    const listeners = this.listeners.get(event.type) ?? []
    for (const listener of listeners) {
      listener(event)
    }
    return true
  }
}

class FakeAnchor extends FakeElement {}

class FakeImage extends FakeElement {
  alt = ''
  currentSrc = ''
  src = ''
}

class FakeVideo extends FakeElement {
  muted = false
  loop = false
  playsInline = false
  preload = ''
  src = ''
  currentSrc = ''
  currentTime = 0
  playCount = 0
  pauseCount = 0

  async play(): Promise<void> {
    this.playCount += 1
  }

  pause(): void {
    this.pauseCount += 1
  }
}

class FakeMouseEvent {
  readonly type: string

  constructor(type: string) {
    this.type = type
  }
}

class FakeWindow {
  readonly location = { origin: 'https://www.crunchyroll.com' }
  private nextTimerId = 1
  private readonly timers = new Map<number, () => void>()

  getComputedStyle(element: unknown): { backgroundImage: string } {
    const backgroundImage = (element as { backgroundImage?: unknown })?.backgroundImage
    return {
      backgroundImage: typeof backgroundImage === 'string' ? backgroundImage : '',
    }
  }

  setTimeout(callback: () => void): number {
    const timerId = this.nextTimerId
    this.nextTimerId += 1
    this.timers.set(timerId, callback)
    return timerId
  }

  clearTimeout(timerId: number): void {
    this.timers.delete(timerId)
  }

  runNextTimeout(): boolean {
    const nextEntry = this.timers.entries().next()
    if (nextEntry.done) {
      return false
    }

    const [timerId, callback] = nextEntry.value
    this.timers.delete(timerId)
    callback()
    return true
  }

  pendingTimeoutCount(): number {
    return this.timers.size
  }
}

function getNativeBridgePreviewModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as NativeBridgePreviewModule
  return registry.runtimeNativeBridgePreview
}

function createNativeBridgePreviewRuntime(overrides: Record<string, unknown> = {}) {
  const windowRef = new FakeWindow()
  const options = {
    windowRef,
    nativeActionBridgeRuntime: {
      findNativeCardBySeriesId: vi.fn(() => null),
    },
    normalizeImageUrlCandidate: (value: unknown) => (typeof value === 'string' ? value.trim() : ''),
    fetchPreviewUrlForEntry: vi.fn(async () => ''),
    isLikelyVideoUrl: vi.fn(() => false),
    previewHoverDelayMs: 220,
    ...overrides,
  }
  const runtime = getNativeBridgePreviewModule().createNativeBridgePreviewRuntime(options)

  return {
    runtime,
    windowRef,
    fetchPreviewUrlForEntry: options.fetchPreviewUrlForEntry as ReturnType<typeof vi.fn>,
    findNativeCardBySeriesId: (
      options.nativeActionBridgeRuntime as { findNativeCardBySeriesId: ReturnType<typeof vi.fn> }
    ).findNativeCardBySeriesId,
    isLikelyVideoUrl: options.isLikelyVideoUrl as ReturnType<typeof vi.fn>,
  }
}

describe('native-bridge-preview runtime', () => {
  const runtimeGlobal = globalThis as Record<string, unknown>
  let originalHTMLElement: unknown
  let originalHTMLAnchorElement: unknown
  let originalHTMLImageElement: unknown
  let originalHTMLVideoElement: unknown
  let originalMouseEvent: unknown

  beforeEach(async () => {
    await loadRuntimeModules([nativeBridgePreviewModuleUrl])
    originalHTMLElement = runtimeGlobal.HTMLElement
    originalHTMLAnchorElement = runtimeGlobal.HTMLAnchorElement
    originalHTMLImageElement = runtimeGlobal.HTMLImageElement
    originalHTMLVideoElement = runtimeGlobal.HTMLVideoElement
    originalMouseEvent = runtimeGlobal.MouseEvent
    runtimeGlobal.HTMLElement = FakeElement
    runtimeGlobal.HTMLAnchorElement = FakeAnchor
    runtimeGlobal.HTMLImageElement = FakeImage
    runtimeGlobal.HTMLVideoElement = FakeVideo
    runtimeGlobal.MouseEvent = FakeMouseEvent
  })

  afterEach(() => {
    runtimeGlobal.HTMLElement = originalHTMLElement
    runtimeGlobal.HTMLAnchorElement = originalHTMLAnchorElement
    runtimeGlobal.HTMLImageElement = originalHTMLImageElement
    runtimeGlobal.HTMLVideoElement = originalHTMLVideoElement
    runtimeGlobal.MouseEvent = originalMouseEvent
    clearRuntimeModulesRegistry()
  })

  it('ignores preview installation for non-anchor links', () => {
    const { runtime, windowRef, fetchPreviewUrlForEntry } = createNativeBridgePreviewRuntime()
    runtime.installCuratedCardPreview({}, { seriesId: 'series-1' }, 'cover.jpg', 'hover.jpg', null)

    expect(windowRef.pendingTimeoutCount()).toBe(0)
    expect(fetchPreviewUrlForEntry).not.toHaveBeenCalled()
  })

  it('shows fallback hover image for entries without streams links and restores styles on leave', async () => {
    const { runtime, windowRef, fetchPreviewUrlForEntry } = createNativeBridgePreviewRuntime()
    const ownerDocument = new FakeDocument()
    const thumbLink = new FakeAnchor(ownerDocument)
    const thumbImage = new FakeImage(ownerDocument)

    runtime.installCuratedCardPreview(
      thumbLink,
      { seriesId: 'series-1', streamsLink: '' },
      'cover.jpg',
      'hover.jpg',
      thumbImage,
    )

    thumbLink.dispatchEvent(new FakeMouseEvent('mouseenter'))
    expect(windowRef.pendingTimeoutCount()).toBe(1)
    expect(windowRef.runNextTimeout()).toBe(true)
    await flushMicrotasks()

    expect(thumbLink.children).toHaveLength(1)
    const previewImage = thumbLink.children[0] as FakeImage
    expect(previewImage).toBeInstanceOf(FakeImage)
    expect(previewImage.src).toBe('hover.jpg')
    expect(previewImage.style.display).toBe('block')
    expect(thumbImage.style.opacity).toBe('0')
    expect(thumbLink.classList.has('cw-curated-card__thumb--previewing')).toBe(true)
    expect(fetchPreviewUrlForEntry).not.toHaveBeenCalled()

    thumbLink.dispatchEvent(new FakeMouseEvent('mouseleave'))
    expect(previewImage.style.display).toBe('none')
    expect(thumbImage.style.opacity).toBe('')
    expect(thumbLink.classList.has('cw-curated-card__thumb--previewing')).toBe(false)
  })

  it('renders video preview when preview repository returns a likely video url', async () => {
    const fetchPreviewUrlForEntry = vi.fn(async () => 'https://cdn.example.test/preview.mp4')
    const { runtime, windowRef, isLikelyVideoUrl } = createNativeBridgePreviewRuntime({
      fetchPreviewUrlForEntry,
      isLikelyVideoUrl: vi.fn(() => true),
    })
    const ownerDocument = new FakeDocument()
    const thumbLink = new FakeAnchor(ownerDocument)
    const thumbImage = new FakeImage(ownerDocument)

    runtime.installCuratedCardPreview(
      thumbLink,
      { seriesId: 'series-2', streamsLink: '/content/v2/cms/streams/series-2' },
      'cover.jpg',
      'hover.jpg',
      thumbImage,
    )

    thumbLink.dispatchEvent(new FakeMouseEvent('mouseenter'))
    expect(windowRef.runNextTimeout()).toBe(true)
    await flushMicrotasks()

    expect(fetchPreviewUrlForEntry).toHaveBeenCalledTimes(1)
    expect(isLikelyVideoUrl).toHaveBeenCalledWith('https://cdn.example.test/preview.mp4')
    expect(thumbLink.children).toHaveLength(1)
    const previewVideo = thumbLink.children[0] as FakeVideo
    expect(previewVideo).toBeInstanceOf(FakeVideo)
    expect(previewVideo.src).toBe('https://cdn.example.test/preview.mp4')
    expect(previewVideo.style.display).toBe('block')
    expect(previewVideo.playCount).toBe(1)
    expect(thumbImage.style.opacity).toBe('0')
    expect(thumbLink.classList.has('cw-curated-card__thumb--previewing')).toBe(true)

    thumbLink.dispatchEvent(new FakeMouseEvent('mouseleave'))
    expect(previewVideo.pauseCount).toBe(1)
    expect(previewVideo.currentTime).toBe(0)
    expect(previewVideo.style.display).toBe('none')
    expect(thumbImage.style.opacity).toBe('')
  })
})
