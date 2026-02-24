import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type FakeElement = {
  className: string
  textContent: string | null
  style: Record<string, string>
  children: FakeElement[]
  appendChild: (child: FakeElement) => FakeElement
  setAttribute: (name: string, value: string) => void
}

type FakeSelectOption = {
  value: string
  textContent: string | null
}

type FakeSelectElement = FakeElement & {
  options: FakeSelectOption[]
  value: string
}

type CuratedPanelRuntime = {
  renderCuratedPanel: () => void
}

type CuratedPanelModule = {
  runtimeCuratedPanel: {
    createCuratedPanelRuntime: (options: Record<string, unknown>) => CuratedPanelRuntime
  }
}

const curatedPanelModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanel.ts'),
).href

function createFakeElement(): FakeElement {
  const element: FakeElement = {
    className: '',
    textContent: '',
    style: {},
    children: [],
    appendChild(child: FakeElement) {
      this.children.push(child)
      return child
    },
    setAttribute() {},
  }
  return element
}

function createFakeSelectElement(): FakeSelectElement {
  const element = createFakeElement() as FakeSelectElement
  element.options = []
  element.value = ''
  element.appendChild = function appendOption(child: FakeElement) {
    this.children.push(child)
    const option = child as unknown as FakeSelectOption
    if (typeof option.value === 'string') {
      this.options.push(option)
    }
    return child
  }
  return element
}

function getCuratedPanelModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as CuratedPanelModule
  return registry.runtimeCuratedPanel
}

function hasClassName(element: FakeElement, className: string): boolean {
  return element.className.split(' ').filter(Boolean).includes(className)
}

function findElementByClassName(element: FakeElement, className: string): FakeElement | null {
  if (hasClassName(element, className)) {
    return element
  }

  for (const child of element.children) {
    const found = findElementByClassName(child, className)
    if (found) {
      return found
    }
  }

  return null
}

describe('curated-panel runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([curatedPanelModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('renders visible curated entries and updates panel status fields', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()
    const audioFilterSelectEl = createFakeSelectElement()
    const genreFilterSelectEl = createFakeSelectElement()

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedPendingRequests: [],
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl,
      genreFilterSelectEl,
      settings: {
        cardLayout: 'portrait',
      },
    }

    let applyCardLayoutCalls = 0

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: {
        createElement: () => ({ ...createFakeElement(), value: '' }),
        createDocumentFragment: () => createFakeElement(),
      },
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => {
        const card = createFakeElement()
        card.className = 'card'
        return card
      },
      applyCardLayoutUi: () => {
        applyCardLayoutCalls += 1
      },
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 2,
        visible: [{ seriesId: 'series-1', watchReady: true }],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work()
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    })

    runtime.renderCuratedPanel()

    expect(applyCardLayoutCalls).toBe(1)
    expect(audioFilterSelectEl.options).toHaveLength(1)
    expect(audioFilterSelectEl.options[0]?.value).toBe('any')
    expect(audioFilterSelectEl.value).toBe('any')
    expect(genreFilterSelectEl.options).toHaveLength(1)
    expect(genreFilterSelectEl.options[0]?.value).toBe('any')
    expect(genreFilterSelectEl.value).toBe('any')
    expect(state.curatedGridRenderSignature).not.toBe('')
    expect(statsEl.textContent).toBe('Showing 1 of 2')
    expect(loadingIndicatorEl.style.display).toBe('none')
    expect(gridEl.children).toHaveLength(1)
  })

  it('shows in-flight request labels in empty-state loading indicator', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]),
      curatedPendingRequests: [
        'Authorizing Crunchyroll API token (/auth/v1/token)',
        'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
      ],
      curatedGridRenderSignature: '',
      gridEl,
      statsEl,
      loadingIndicatorEl,
      audioFilterSelectEl: createFakeSelectElement(),
      genreFilterSelectEl: createFakeSelectElement(),
      settings: {
        cardLayout: 'portrait',
      },
    }

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: {
        createElement: () => ({ ...createFakeElement(), value: '' }),
        createDocumentFragment: () => createFakeElement(),
      },
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 0,
        visible: [],
        audioOptions: [{ optionValue: 'any', title: 'Any language' }],
        genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
        selectedAudioFilter: 'any',
        selectedGenreFilter: 'any',
      }),
      withMutedObserver: (work: () => void) => {
        work()
      },
      isLocalizedRatingDataMissingForEntries: () => false,
      isLocalizedWatchHistoryDataMissingForEntries: () => false,
      preloadRatingsForSelectedAudioLocale: async () => null,
      preloadWatchHistoryForSelectedAudioLocale: async () => null,
      isWatchlistPath: () => true,
    })

    runtime.renderCuratedPanel()

    const requestsList = findElementByClassName(gridEl, 'cw-loading__requests')
    expect(requestsList).not.toBeNull()
    expect(requestsList?.children.map((child) => child.textContent)).toEqual(state.curatedPendingRequests)
    expect(loadingIndicatorEl.style.display).toBe('inline-flex')
    expect(statsEl.textContent).toBe('Loading...')
  })
})
