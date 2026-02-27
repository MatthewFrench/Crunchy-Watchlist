import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type FakeElement = {
  tagName: string
  className: string
  textContent: string
  children: FakeElement[]
  dataset: Record<string, string>
  attributes: Record<string, string>
  ownerDocument: {
    createElement: (tagName: string) => FakeElement
    createTextNode: (text: string) => { textContent: string }
  }
  appendChild: (child: FakeElement | { textContent: string }) => FakeElement | { textContent: string }
  setAttribute: (name: string, value: string) => void
}

type CardViewRuntime = {
  createCuratedCardBody: (entry: unknown, actions: FakeElement) => FakeElement
}

type CardViewModule = {
  createCardView: (deps: Record<string, unknown>) => CardViewRuntime
}

const cardViewModuleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Ui', 'CuratedCardView.ts')).href

function createFakeDocument() {
  const createElement = (tagName: string): FakeElement => {
    const element: FakeElement = {
      tagName,
      className: '',
      textContent: '',
      children: [],
      dataset: {},
      attributes: {},
      ownerDocument: {
        createElement,
        createTextNode: (text: string) => ({ textContent: text }),
      },
      appendChild(child: FakeElement | { textContent: string }) {
        if ('tagName' in child) {
          this.children.push(child)
        } else {
          this.textContent += child.textContent
        }
        return child
      },
      setAttribute(name: string, value: string) {
        this.attributes[name] = value
      },
    }
    return element
  }

  return {
    createElement,
    createTextNode: (text: string) => ({ textContent: text }),
  }
}

function getCardViewModule(): CardViewModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    ui?: Record<string, unknown>
  }
  return registry.ui?.cardView as CardViewModule
}

function findByClassName(root: FakeElement, className: string): FakeElement | null {
  if (root.className === className) {
    return root
  }

  for (const child of root.children) {
    const found = findByClassName(child, className)
    if (found) {
      return found
    }
  }

  return null
}

describe('curated-card-view ui module', () => {
  const originalDocument = (globalThis as Record<string, unknown>).document

  beforeEach(async () => {
    ;(globalThis as Record<string, unknown>).document = createFakeDocument()
    await loadRuntimeModules([cardViewModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
    ;(globalThis as Record<string, unknown>).document = originalDocument
  })

  it('merges next episode into the status line and removes next-unwatched row', () => {
    const setLabeledValue = vi.fn((element: FakeElement, label: string, value: string) => {
      element.textContent = `${label}: ${value}`
    })

    const runtime = getCardViewModule().createCardView({
      getLastWatchedPresentation: () => ({ state: 'dated', text: '2026-02-24' }),
      setLabeledValue,
      getSeriesScopePairs: () => [],
      setLabeledValuePairs: vi.fn(),
      appendLabeledValue: vi.fn(),
      getGenreValue: () => '',
      makeRatingHistogram: () => (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
      formatVotes: () => '0',
    })

    const body = runtime.createCuratedCardBody(
      {
        statusBase: 'Up Next',
        nextEpisodeLabel: 'S1 E3',
        description: 'Show description',
      },
      (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
    )

    const status = findByClassName(body, 'cw-curated-card__status')
    expect(status?.textContent).toBe('Up Next: S1 E3')
    expect(findByClassName(body, 'cw-curated-card__next')).toBeNull()
    expect(setLabeledValue).not.toHaveBeenCalledWith(expect.anything(), 'Next unwatched', expect.anything())
  })

  it('keeps plain status text when next episode is unavailable', () => {
    const runtime = getCardViewModule().createCardView({
      getLastWatchedPresentation: () => ({ state: 'unknown', text: 'unknown' }),
      setLabeledValue: (element: FakeElement, label: string, value: string) => {
        element.textContent = `${label}: ${value}`
      },
      getSeriesScopePairs: () => [],
      setLabeledValuePairs: vi.fn(),
      appendLabeledValue: vi.fn(),
      getGenreValue: () => '',
      makeRatingHistogram: () => (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
      formatVotes: () => '0',
    })

    const body = runtime.createCuratedCardBody(
      {
        statusBase: 'Continue',
        nextEpisodeLabel: '',
      },
      (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
    )

    const status = findByClassName(body, 'cw-curated-card__status')
    expect(status?.textContent).toBe('Continue')
    expect(findByClassName(body, 'cw-curated-card__next')).toBeNull()
  })

  it('merges continue status with the next episode label', () => {
    const runtime = getCardViewModule().createCardView({
      getLastWatchedPresentation: () => ({ state: 'dated', text: '2026-02-24' }),
      setLabeledValue: (element: FakeElement, label: string, value: string) => {
        element.textContent = `${label}: ${value}`
      },
      getSeriesScopePairs: () => [],
      setLabeledValuePairs: vi.fn(),
      appendLabeledValue: vi.fn(),
      getGenreValue: () => '',
      makeRatingHistogram: () => (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
      formatVotes: () => '0',
    })

    const body = runtime.createCuratedCardBody(
      {
        statusBase: 'Continue',
        nextEpisodeLabel: 'S1 E4',
      },
      (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
    )

    const status = findByClassName(body, 'cw-curated-card__status')
    expect(status?.textContent).toBe('Continue: S1 E4')
    expect(findByClassName(body, 'cw-curated-card__next')).toBeNull()
  })

  it('renders a hidden empty-genre row and a dedicated details skeleton container', () => {
    const runtime = getCardViewModule().createCardView({
      getLastWatchedPresentation: () => ({ state: 'unknown', text: 'unknown' }),
      setLabeledValue: (element: FakeElement, label: string, value: string) => {
        element.textContent = `${label}: ${value}`
      },
      getSeriesScopePairs: () => [],
      setLabeledValuePairs: vi.fn(),
      appendLabeledValue: vi.fn(),
      getGenreValue: () => '',
      makeRatingHistogram: () => (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
      formatVotes: () => '0',
    })

    const body = runtime.createCuratedCardBody(
      {
        statusBase: 'Continue',
        nextEpisodeLabel: '',
      },
      (globalThis.document as ReturnType<typeof createFakeDocument>).createElement('div'),
    )

    const genres = findByClassName(body, 'cw-curated-card__genres')
    expect(genres?.dataset.cwEmpty).toBe('true')
    const detailsSkeleton = findByClassName(body, 'cw-curated-card__details-skeleton')
    expect(detailsSkeleton).not.toBeNull()
    const starSkeletonRows = detailsSkeleton?.children.filter((child) =>
      child.className.includes('cw-curated-card__details-skeleton-line--star-row'),
    )
    expect(starSkeletonRows).toHaveLength(5)
  })
})
