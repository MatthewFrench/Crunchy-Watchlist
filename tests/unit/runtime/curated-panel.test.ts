import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../helpers/module-registry'

type FakeElement = {
  className: string
  textContent: string | null
  style: Record<string, string>
  children: FakeElement[]
  appendChild: (child: FakeElement) => FakeElement
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
  path.join(process.cwd(), 'extension', 'src', 'runtime', 'curated-panel.ts'),
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
})
