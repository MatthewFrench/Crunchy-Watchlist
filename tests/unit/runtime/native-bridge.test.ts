import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../helpers/module-registry'

type NativeBridgeRuntime = {
  triggerNativeCardAction: (seriesId: unknown, actionType: unknown) => boolean
}

type NativeBridgeModule = {
  runtimeNativeBridge: {
    createNativeBridgeRuntime: (options: Record<string, unknown>) => NativeBridgeRuntime
  }
}

type RuntimeEventRecord = {
  event: string
  data?: unknown
}

const nativeBridgeModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'runtime', 'native-bridge.ts'),
).href

class FakeElement {
  private readonly selectorAllMap = new Map<string, FakeElement[]>()
  private readonly selectorMap = new Map<string, FakeElement | null>()
  private readonly attributes = new Map<string, string>()
  clickCount = 0

  setQuerySelectorAll(selector: string, results: FakeElement[]): void {
    this.selectorAllMap.set(selector, results)
  }

  setQuerySelector(selector: string, result: FakeElement | null): void {
    this.selectorMap.set(selector, result)
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value)
  }

  querySelectorAll(selector: string): FakeElement[] {
    return this.selectorAllMap.get(selector) ?? []
  }

  querySelector(selector: string): FakeElement | null {
    return this.selectorMap.get(selector) ?? null
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null
  }

  click(): void {
    this.clickCount += 1
  }
}

function getNativeBridgeModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as NativeBridgeModule
  return registry.runtimeNativeBridge
}

function createNativeBridgeRuntime(cards: FakeElement[]) {
  const runtimeEvents: RuntimeEventRecord[] = []
  const runtime = getNativeBridgeModule().createNativeBridgeRuntime({
    documentRef: {
      querySelectorAll: (selector: string) => (selector === '[data-t="watch-list-card"]' ? cards : []),
    },
    windowRef: {
      location: { origin: 'https://www.crunchyroll.com' },
      getComputedStyle: () => ({ backgroundImage: '' }),
      setTimeout: () => 0,
      clearTimeout: () => {},
    },
    runtimeEvent: (event: string, data?: unknown) => runtimeEvents.push({ event, data }),
    normalizeImageUrlCandidate: (value: unknown) => (typeof value === 'string' ? value.trim() : ''),
    fetchPreviewUrlForEntry: async () => '',
    isLikelyVideoUrl: () => false,
    previewHoverDelayMs: 220,
  })

  return {
    runtime,
    runtimeEvents,
  }
}

describe('native-bridge runtime', () => {
  const runtimeGlobal = globalThis as Record<string, unknown>
  let originalHTMLElement: unknown

  beforeEach(async () => {
    await loadRuntimeModules([nativeBridgeModuleUrl])
    originalHTMLElement = runtimeGlobal.HTMLElement
    runtimeGlobal.HTMLElement = FakeElement
  })

  afterEach(() => {
    runtimeGlobal.HTMLElement = originalHTMLElement
    clearRuntimeModulesRegistry()
  })

  it('returns false for unsupported or missing native action requests', () => {
    const { runtime } = createNativeBridgeRuntime([])

    expect(runtime.triggerNativeCardAction('', 'favorite')).toBe(false)
    expect(runtime.triggerNativeCardAction('series-1', 'unknown')).toBe(false)
  })

  it('forwards favorite actions to the matching native card control', () => {
    const nativeCard = new FakeElement()
    const seriesLink = new FakeElement()
    seriesLink.setAttribute('href', '/series/series-42')
    nativeCard.setQuerySelectorAll('a[href*="/series/"]', [seriesLink])

    const favoriteButton = new FakeElement()
    nativeCard.setQuerySelector('[data-cw-native-action="favorite"]', favoriteButton)

    const { runtime, runtimeEvents } = createNativeBridgeRuntime([nativeCard])
    const didForward = runtime.triggerNativeCardAction('series-42', 'favorite')

    expect(didForward).toBe(true)
    expect(favoriteButton.clickCount).toBe(1)
    expect(runtimeEvents).toEqual([
      {
        event: 'native-action-forwarded',
        data: {
          seriesId: 'series-42',
          actionType: 'favorite',
        },
      },
    ])
  })

  it('returns false when no matching native action button exists', () => {
    const nativeCard = new FakeElement()
    const seriesLink = new FakeElement()
    seriesLink.setAttribute('href', '/series/series-404')
    nativeCard.setQuerySelectorAll('a[href*="/series/"]', [seriesLink])

    const { runtime, runtimeEvents } = createNativeBridgeRuntime([nativeCard])
    const didForward = runtime.triggerNativeCardAction('series-404', 'remove')

    expect(didForward).toBe(false)
    expect(runtimeEvents).toEqual([])
  })
})
