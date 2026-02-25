import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type FakeMouseEvent = {
  defaultPrevented: boolean
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  target: {
    closest: (selector: string) => unknown
  } | null
}

type FakeElement = {
  tagName: string
  className: string
  classList: {
    add: (...tokens: string[]) => void
  }
  textContent: string
  href: string
  loading: string
  src: string
  alt: string
  dataset: Record<string, string>
  attributes: Record<string, string>
  style: Record<string, string>
  children: FakeElement[]
  listeners: Record<string, Array<(event: FakeMouseEvent) => void>>
  appendChild: (child: FakeElement) => FakeElement
  setAttribute: (name: string, value: string) => void
  addEventListener: (eventName: string, listener: (event: FakeMouseEvent) => void) => void
  dispatch: (eventName: string, event?: Partial<FakeMouseEvent>) => void
  querySelector?: (selector: string) => FakeElement | null
}

type FakeDocument = {
  createElement: (tagName: string) => FakeElement
}

type CardShellRuntime = {
  getCardCoverImage: (entry: unknown, layout?: unknown) => string
  attachCuratedCardNavigation: (item: FakeElement, cardHref: string) => void
  createCuratedCard: (entry: unknown) => FakeElement
}

type CardShellModule = {
  createCardShell: (deps: Record<string, unknown>) => CardShellRuntime
}

const cardShellModuleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Ui', 'CuratedCardShell.ts')).href

function createFakeDocument(): FakeDocument {
  const createElement = (tagName: string): FakeElement => {
    const classNames = new Set<string>()
    const element: FakeElement = {
      tagName,
      className: '',
      classList: {
        add(...tokens: string[]) {
          for (const token of tokens) {
            if (!token) {
              continue
            }
            classNames.add(token)
          }
          element.className = Array.from(classNames).join(' ')
        },
      },
      textContent: '',
      href: '',
      loading: '',
      src: '',
      alt: '',
      dataset: {},
      attributes: {},
      style: {},
      children: [],
      listeners: {},
      appendChild(child: FakeElement) {
        this.children.push(child)
        return child
      },
      setAttribute(name: string, value: string) {
        this.attributes[name] = value
      },
      addEventListener(eventName: string, listener: (event: FakeMouseEvent) => void) {
        const listeners = this.listeners[eventName] || []
        listeners.push(listener)
        this.listeners[eventName] = listeners
      },
      dispatch(eventName: string, event: Partial<FakeMouseEvent> = {}) {
        const listeners = this.listeners[eventName] || []
        const normalizedEvent: FakeMouseEvent = {
          defaultPrevented: event.defaultPrevented ?? false,
          button: event.button ?? 0,
          metaKey: event.metaKey ?? false,
          ctrlKey: event.ctrlKey ?? false,
          shiftKey: event.shiftKey ?? false,
          altKey: event.altKey ?? false,
          target: event.target ?? {
            closest: () => null,
          },
        }
        for (const listener of listeners) {
          listener(normalizedEvent)
        }
      },
    }
    return element
  }

  return {
    createElement,
  }
}

function getCardShellModule(): CardShellModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    ui?: Record<string, unknown>
  }
  const uiRegistry = registry.ui ?? {}
  return uiRegistry.cardShell as CardShellModule
}

function createCardShellRuntime(options: Partial<Record<string, unknown>> = {}) {
  const documentRef = createFakeDocument()
  const locationAssign = vi.fn()
  const getSelection = vi.fn(() => ({ type: 'None' }))

  const createCuratedCardActions = vi.fn(() => documentRef.createElement('div'))
  const createCuratedCardBody = vi.fn((_entry: unknown, _actions: unknown) => documentRef.createElement('section'))
  const installCuratedCardPreview = vi.fn()

  const runtime = getCardShellModule().createCardShell({
    documentRef,
    windowRef: {
      location: {
        assign: locationAssign,
      },
      getSelection,
    },
    getCardLayout: () => 'portrait',
    normalizeImageUrlCandidate: (value: unknown) => (typeof value === 'string' ? value.trim() : ''),
    resolveApiHref: (href: unknown) => (typeof href === 'string' ? href : ''),
    makeRatingBadge: () => documentRef.createElement('span'),
    createCuratedCardActions,
    createCuratedCardBody,
    installCuratedCardPreview,
    ...options,
  })

  return {
    runtime,
    locationAssign,
    getSelection,
    createCuratedCardActions,
    createCuratedCardBody,
    installCuratedCardPreview,
    documentRef,
  }
}

describe('curated-card-shell ui module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([cardShellModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('selects cover images based on card layout with fallback', () => {
    const { runtime } = createCardShellRuntime()

    expect(
      runtime.getCardCoverImage({
        portraitImageUrl: 'portrait.jpg',
        landscapeImageUrl: 'landscape.jpg',
        imageUrl: 'fallback.jpg',
      }),
    ).toBe('portrait.jpg')

    expect(
      runtime.getCardCoverImage(
        {
          portraitImageUrl: 'portrait.jpg',
          landscapeImageUrl: 'landscape.jpg',
          imageUrl: 'fallback.jpg',
        },
        'landscape',
      ),
    ).toBe('landscape.jpg')

    expect(
      runtime.getCardCoverImage({
        portraitImageUrl: '',
        landscapeImageUrl: '',
        imageUrl: 'fallback.jpg',
      }),
    ).toBe('fallback.jpg')
  })

  it('builds curated cards and forwards preview/action/body wiring', () => {
    const { runtime, createCuratedCardActions, createCuratedCardBody, installCuratedCardPreview } =
      createCardShellRuntime()

    const card = runtime.createCuratedCard({
      seriesId: 'series-1',
      fixtureTitle: 'Fixture title',
      title: 'Series title',
      href: '/series/series-1',
      rating: 4.2,
      votes: 150,
      portraitImageUrl: 'portrait.jpg',
      hoverPreviewImageUrl: 'hover.jpg',
      dimNotWatchReady: true,
    })

    expect(card.className).toContain('cw-curated-card')
    expect(card.className).toContain('cw-curated-card--not-watch-ready')
    expect(card.dataset.cwSeriesId).toBe('series-1')
    expect(card.dataset.cwCuratedTitle).toBe('Fixture title')
    expect(card.children).toHaveLength(3)
    expect(card.children[1]?.className).toBe('cw-curated-card__media')
    expect(createCuratedCardActions).toHaveBeenCalledTimes(1)
    expect(createCuratedCardBody).toHaveBeenCalledTimes(1)
    expect(installCuratedCardPreview).toHaveBeenCalledTimes(1)
    expect(installCuratedCardPreview.mock.calls[0]?.[2]).toBe('portrait.jpg')
    expect(installCuratedCardPreview.mock.calls[0]?.[3]).toBe('hover.jpg')
  })

  it('moves description under the card thumbnail when available', () => {
    const { runtime, documentRef } = createCardShellRuntime({
      createCuratedCardBody: () => {
        const body = documentRef.createElement('section')
        const description = documentRef.createElement('div')
        description.className = 'cw-curated-card__description'
        body.appendChild(description)
        body.querySelector = (selector: string) =>
          selector === '.cw-curated-card__description' ? description : null
        return body
      },
    })

    const card = runtime.createCuratedCard({
      seriesId: 'series-1',
      title: 'Series title',
      href: '/series/series-1',
      portraitImageUrl: 'portrait.jpg',
    })

    const media = card.children[1]
    expect(media?.className).toBe('cw-curated-card__media')
    expect(media?.children[0]?.className).toBe('cw-curated-card__thumb')
    expect(media?.children[1]?.className).toBe('cw-curated-card__description')
  })

  it('navigates only for safe card click events', () => {
    const { runtime, locationAssign, getSelection, documentRef } = createCardShellRuntime()
    const card = documentRef.createElement('article')

    runtime.attachCuratedCardNavigation(card, '/series/series-1')
    card.dispatch('click')
    expect(locationAssign).toHaveBeenCalledWith('/series/series-1')

    locationAssign.mockClear()
    card.dispatch('click', {
      target: {
        closest: () => ({}),
      },
    })
    expect(locationAssign).not.toHaveBeenCalled()

    locationAssign.mockClear()
    getSelection.mockReturnValue({ type: 'Range' })
    card.dispatch('click')
    expect(locationAssign).not.toHaveBeenCalled()
  })
})
