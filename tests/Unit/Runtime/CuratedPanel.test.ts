import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type FakeElement = {
  tagName: string
  className: string
  textContent: string | null
  dataset: Record<string, string>
  attributes: Record<string, string>
  style: Record<string, string>
  children: FakeElement[]
  parentNode: FakeElement | null
  value?: string
  title?: string
  appendChild: (child: FakeElement) => FakeElement
  insertBefore: (child: FakeElement, reference: FakeElement | null) => FakeElement
  removeChild: (child: FakeElement) => FakeElement
  setAttribute: (name: string, value: string) => void
  getAttribute: (name: string) => string | null
  querySelector: (selector: string) => FakeElement | null
}

type FakeSelectOption = FakeElement & { value: string }

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
const curatedPanelGridModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGrid.ts'),
).href
const curatedPanelGridTransitionsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridTransitions.ts'),
).href
const curatedPanelLoadingIndicatorModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelLoadingIndicator.ts'),
).href

function createFakeElement(): FakeElement {
  const toDatasetKey = (attributeName: string): string =>
    attributeName.replace(/^data-/, '').replace(/-([a-z])/g, (_match, character: string) => character.toUpperCase())

  const detachFromParent = (child: FakeElement): void => {
    if (!child.parentNode) {
      return
    }
    const parent = child.parentNode
    const index = parent.children.indexOf(child)
    if (index >= 0) {
      parent.children.splice(index, 1)
    }
    child.parentNode = null
  }

  let textContentValue: string | null = ''
  const element: FakeElement = {
    tagName: 'div',
    className: '',
    textContent: '',
    dataset: {},
    attributes: {},
    style: {},
    children: [],
    parentNode: null,
    appendChild(child: FakeElement) {
      detachFromParent(child)
      this.children.push(child)
      child.parentNode = this
      return child
    },
    insertBefore(child: FakeElement, reference: FakeElement | null) {
      detachFromParent(child)
      if (!reference) {
        this.children.push(child)
        child.parentNode = this
        return child
      }
      const index = this.children.indexOf(reference)
      if (index < 0) {
        this.children.push(child)
      } else {
        this.children.splice(index, 0, child)
      }
      child.parentNode = this
      return child
    },
    removeChild(child: FakeElement) {
      const index = this.children.indexOf(child)
      if (index >= 0) {
        this.children.splice(index, 1)
        child.parentNode = null
      }
      return child
    },
    setAttribute(name: string, value: string) {
      this.attributes[name] = value
      if (name === 'class') {
        this.className = value
      }
      if (name.startsWith('data-')) {
        this.dataset[toDatasetKey(name)] = value
      }
    },
    getAttribute(name: string) {
      if (name === 'class') {
        return this.className || null
      }
      if (name.startsWith('data-')) {
        const dataValue = this.dataset[toDatasetKey(name)]
        if (typeof dataValue === 'string') {
          return dataValue
        }
      }
      return this.attributes[name] ?? null
    },
    querySelector(selector: string) {
      const matchesSelector = (candidate: FakeElement): boolean => {
        if (selector === 'button[data-cw-action="favorite"]') {
          return candidate.tagName === 'button' && candidate.dataset.cwAction === 'favorite'
        }
        return false
      }

      const visit = (candidate: FakeElement): FakeElement | null => {
        for (const child of candidate.children) {
          if (matchesSelector(child)) {
            return child
          }
          const nested = visit(child)
          if (nested) {
            return nested
          }
        }
        return null
      }

      return visit(this)
    },
  }
  Object.defineProperty(element, 'textContent', {
    get() {
      return textContentValue
    },
    set(value: string | null) {
      textContentValue = value
      if (typeof value === 'string') {
        element.children = []
        if (Array.isArray((element as FakeSelectElement).options)) {
          ;(element as FakeSelectElement).options = []
        }
      }
    },
    enumerable: true,
    configurable: true,
  })
  return element
}

function createFakeSelectElement(): FakeSelectElement {
  const element = createFakeElement() as FakeSelectElement
  element.tagName = 'select'
  element.options = []
  element.value = ''
  const appendChild = element.appendChild.bind(element)
  element.appendChild = function appendOption(child: FakeElement) {
    appendChild(child)
    const option = child as FakeSelectOption
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

function createFakeDocumentRef() {
  return {
    createElement: (tagName = 'div') => {
      const element = createFakeElement()
      element.tagName = String(tagName).toLowerCase()
      if (element.tagName === 'option') {
        element.value = ''
      }
      return element
    },
    createDocumentFragment: () => {
      const fragment = createFakeElement()
      fragment.tagName = '#document-fragment'
      return fragment
    },
  }
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
    await loadRuntimeModules([
      curatedPanelGridTransitionsModuleUrl,
      curatedPanelGridModuleUrl,
      curatedPanelLoadingIndicatorModuleUrl,
      curatedPanelModuleUrl,
    ])
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
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
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
      documentRef: createFakeDocumentRef(),
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

  it('shows in-flight request labels in the shared panel loading indicator during empty first-load state', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: [
        'Authorizing Crunchyroll API token (/auth/v1/token)',
        'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
        'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
      ],
      curatedPendingRequestStartedCount: 4,
      curatedPendingRequestCompletedCount: 1,
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
      documentRef: createFakeDocumentRef(),
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

    const requestsList = findElementByClassName(loadingIndicatorEl, 'cw-loading__requests')
    const progressLine = findElementByClassName(loadingIndicatorEl, 'cw-loading__progress')
    const nestedGridLoading = findElementByClassName(gridEl, 'cw-loading')
    expect(requestsList).not.toBeNull()
    expect(requestsList?.children.map((child) => child.textContent)).toEqual(state.curatedPendingRequests)
    expect(progressLine?.textContent).toBe('Completed 1 of 4 • In progress 3')
    expect(nestedGridLoading).toBeNull()
    expect(loadingIndicatorEl.style.display).toBe('flex')
    expect(statsEl.textContent).toBe('')
  })

  it('updates the existing shared loading indicator in place without nesting another loading widget', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()
    loadingIndicatorEl.className = 'cw-loading cw-loading-indicator'
    const heading = createFakeElement()
    heading.className = 'cw-loading__heading'
    const spinner = createFakeElement()
    spinner.className = 'cw-spinner'
    const label = createFakeElement()
    label.className = 'cw-loading__label'
    label.textContent = 'Loading'
    heading.appendChild(spinner)
    heading.appendChild(label)
    loadingIndicatorEl.appendChild(heading)

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: [
        'Authorizing Crunchyroll API token (/auth/v1/token)',
        'Fetching watchlist pages (/content/v2/discover/{account_id}/watchlist)',
      ],
      curatedPendingRequestStartedCount: 4,
      curatedPendingRequestCompletedCount: 1,
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
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [{ seriesId: 'series-1', title: 'Series 1' }],
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

    const nestedLoadingChild = loadingIndicatorEl.children.find((child) => child.className === 'cw-loading')
    const progressLine = findElementByClassName(loadingIndicatorEl, 'cw-loading__progress')
    const requestsList = findElementByClassName(loadingIndicatorEl, 'cw-loading__requests')
    expect(nestedLoadingChild).toBeUndefined()
    expect(progressLine?.textContent).toBe('Completed 1 of 4 • In progress 2')
    expect(requestsList?.children.map((child) => child.textContent)).toEqual(state.curatedPendingRequests)
  })

  it('hides the first-load loading box after initial load has completed even if a refresh is inflight', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()
    loadingIndicatorEl.className = 'cw-loading cw-loading-indicator'

    const loadingBox = createFakeElement()
    loadingBox.className = 'cw-empty cw-loading-box'
    loadingBox.appendChild(loadingIndicatorEl)

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [{ seriesId: 'series-1', title: 'Series 1' }],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedInitialLoadDone: true,
      curatedPendingRequests: ['Fetching ratings (/content-reviews/v3/rating/series/{series_id})'],
      curatedPendingRequestStartedCount: 2,
      curatedPendingRequestCompletedCount: 1,
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
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [{ seriesId: 'series-1', title: 'Series 1' }],
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

    expect(loadingIndicatorEl.style.display).toBe('none')
    expect(loadingBox.style.display).toBe('none')
  })

  it('shows filtered-count stats for hide_not_started mode', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()

    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: null,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 0,
      curatedPendingRequestCompletedCount: 0,
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
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => createFakeElement(),
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide_not_started',
        total: 5,
        visible: [{ seriesId: 'series-1' }, { seriesId: 'series-2' }],
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

    expect(statsEl.textContent).toBe('Showing 2 of 5')
  })

  it('reuses existing card nodes and reorders them when render order changes', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()
    const renderables = [
      [
        { seriesId: 'series-1', title: 'Series 1' },
        { seriesId: 'series-2', title: 'Series 2' },
        { seriesId: 'series-3', title: 'Series 3' },
      ],
      [
        { seriesId: 'series-3', title: 'Series 3' },
        { seriesId: 'series-1', title: 'Series 1' },
        { seriesId: 'series-2', title: 'Series 2' },
      ],
    ]
    let renderIndex = 0
    let createdCards = 0

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedGridRenderSignature: '',
        gridEl,
        statsEl,
        loadingIndicatorEl,
        audioFilterSelectEl: createFakeSelectElement(),
        genreFilterSelectEl: createFakeSelectElement(),
        settings: {
          cardLayout: 'portrait',
        },
      },
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1
        const card = createFakeElement()
        card.tagName = 'article'
        card.className = 'cw-curated-card'
        card.dataset.cwSeriesId = String(entry.seriesId || '')
        return card
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || []
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        }
      },
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
    const firstRenderCards = [...gridEl.children]

    renderIndex = 1
    runtime.renderCuratedPanel()

    expect(createdCards).toBe(3)
    expect(gridEl.children).toEqual([firstRenderCards[2], firstRenderCards[0], firstRenderCards[1]])
  })

  it('re-renders visible cards when external dom churn clears the curated grid', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()
    let createdCards = 0

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedGridRenderSignature: '',
        gridEl,
        statsEl,
        loadingIndicatorEl,
        audioFilterSelectEl: createFakeSelectElement(),
        genreFilterSelectEl: createFakeSelectElement(),
        settings: {
          cardLayout: 'portrait',
        },
      },
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1
        const card = createFakeElement()
        card.className = 'cw-curated-card'
        card.dataset.cwSeriesId = String(entry.seriesId || '')
        return card
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: 1,
        visible: [{ seriesId: 'series-1', title: 'Series 1' }],
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
    expect(gridEl.children).toHaveLength(1)
    expect(createdCards).toBe(1)

    // Simulate host-page DOM churn wiping extension-rendered children.
    gridEl.textContent = ''
    expect(gridEl.children).toHaveLength(0)

    runtime.renderCuratedPanel()

    expect(gridEl.children).toHaveLength(1)
    expect(createdCards).toBe(2)
  })

  it('patches favorite button state in place without recreating the card', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()
    const renderables = [
      [{ seriesId: 'series-1', title: 'Series 1', isFavorite: false, rating: 4.5 }],
      [{ seriesId: 'series-1', title: 'Series 1', isFavorite: true, rating: 4.5 }],
    ]
    let renderIndex = 0
    let createdCards = 0

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state: {
        mounted: true,
        curatedError: null,
        curatedEntries: [],
        curatedInflight: null,
        curatedPendingRequests: [],
        curatedPendingRequestStartedCount: 0,
        curatedPendingRequestCompletedCount: 0,
        curatedGridRenderSignature: '',
        gridEl,
        statsEl,
        loadingIndicatorEl,
        audioFilterSelectEl: createFakeSelectElement(),
        genreFilterSelectEl: createFakeSelectElement(),
        settings: {
          cardLayout: 'portrait',
        },
      },
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: () => {
        createdCards += 1
        const card = createFakeElement()
        card.tagName = 'article'
        card.className = 'cw-curated-card'
        const favoriteButton = createFakeElement()
        favoriteButton.tagName = 'button'
        favoriteButton.className = 'cw-card-action cw-card-action--favorite'
        favoriteButton.dataset.cwAction = 'favorite'
        favoriteButton.setAttribute('data-cw-action', 'favorite')
        favoriteButton.textContent = '♡'
        card.appendChild(favoriteButton)
        return card
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || []
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        }
      },
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
    const firstCard = gridEl.children[0]
    const favoriteButton = firstCard?.querySelector('button[data-cw-action="favorite"]')
    expect(favoriteButton?.textContent).toBe('♡')
    expect(favoriteButton?.className.includes('is-active')).toBe(false)

    renderIndex = 1
    runtime.renderCuratedPanel()

    expect(createdCards).toBe(1)
    expect(gridEl.children[0]).toBe(firstCard)
    expect(favoriteButton?.textContent).toBe('♥')
    expect(favoriteButton?.className.includes('is-active')).toBe(true)
    expect(favoriteButton?.getAttribute('aria-pressed')).toBe('true')
    expect(favoriteButton?.getAttribute('aria-label')).toBe('Unfavorite')
  })

  it('marks cards with metadata-loading state while enrichment requests are inflight', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()
    const visible = [{ seriesId: 'series-1', title: 'Series 1', rating: null, watchHistoryProgressEntry: null }]
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: ['Fetching ratings (/content-reviews/v3/rating/series/{series_id})'],
      curatedPendingRequestStartedCount: 3,
      curatedPendingRequestCompletedCount: 1,
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
    let createdCards = 0

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1
        const card = createFakeElement()
        card.className = 'cw-curated-card'
        card.dataset.cwSeriesId = String(entry.seriesId || '')
        return card
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: visible.length,
        visible,
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
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('true')

    state.curatedInflight = null
    state.curatedPendingRequests = []
    state.curatedPendingRequestStartedCount = 3
    state.curatedPendingRequestCompletedCount = 3

    runtime.renderCuratedPanel()
    expect(createdCards).toBe(1)
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('false')
  })

  it('keeps metadata loading enabled while curated inflight is active even if pending labels are briefly empty', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()
    const visible = [{ seriesId: 'series-1', title: 'Series 1', rating: null, watchHistoryProgressEntry: null }]
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: [],
      curatedPendingRequestStartedCount: 4,
      curatedPendingRequestCompletedCount: 4,
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
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        const card = createFakeElement()
        card.className = 'cw-curated-card'
        card.dataset.cwSeriesId = String(entry.seriesId || '')
        return card
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => ({
        mode: 'hide',
        total: visible.length,
        visible,
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
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('true')
  })

  it('defers card re-creation while metadata is still pending, then refreshes once loading completes', () => {
    const gridEl = createFakeElement()
    const statsEl = createFakeElement()
    const loadingIndicatorEl = createFakeElement()
    const renderables = [
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Initial description',
          rating: 4.2,
          votes: 120,
          distribution: { 5: 60 },
          neverWatched: false,
          lastWatchedMs: null,
          watchHistoryProgressEntry: null,
        },
      ],
      [
        {
          seriesId: 'series-1',
          title: 'Series 1',
          description: 'Updated description',
          rating: 4.6,
          votes: 380,
          distribution: { 5: 78 },
          neverWatched: false,
          lastWatchedMs: null,
          watchHistoryProgressEntry: null,
        },
      ],
    ]
    const state = {
      mounted: true,
      curatedError: null,
      curatedEntries: [],
      curatedInflight: Promise.resolve([]) as Promise<unknown[]> | null,
      curatedPendingRequests: ['Fetching watch history (/watch-history/v2/{account_id}/watchlist)'],
      curatedPendingRequestStartedCount: 2,
      curatedPendingRequestCompletedCount: 1,
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
    let renderIndex = 0
    let createdCards = 0

    const runtime = getCuratedPanelModule().createCuratedPanelRuntime({
      state,
      documentRef: createFakeDocumentRef(),
      locationRef: {
        pathname: '/watchlist',
      },
      createCuratedCard: (entry: Record<string, unknown>) => {
        createdCards += 1
        const card = createFakeElement()
        card.className = 'cw-curated-card'
        card.dataset.cwSeriesId = String(entry.seriesId || '')
        return card
      },
      applyCardLayoutUi: () => {},
      buildRenderableEntries: () => {
        const visible = renderables[renderIndex] || []
        return {
          mode: 'hide',
          total: visible.length,
          visible,
          audioOptions: [{ optionValue: 'any', title: 'Any language' }],
          genreOptions: [{ optionValue: 'any', title: 'Any genre' }],
          selectedAudioFilter: 'any',
          selectedGenreFilter: 'any',
        }
      },
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
    const firstCard = gridEl.children[0]
    expect(createdCards).toBe(1)
    expect(firstCard?.dataset.cwLoadingDetails).toBe('true')

    renderIndex = 1
    runtime.renderCuratedPanel()

    expect(createdCards).toBe(1)
    expect(gridEl.children[0]).toBe(firstCard)
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('true')

    state.curatedInflight = null
    state.curatedPendingRequests = []
    state.curatedPendingRequestStartedCount = 2
    state.curatedPendingRequestCompletedCount = 2

    runtime.renderCuratedPanel()

    expect(createdCards).toBe(2)
    expect(gridEl.children[0]).not.toBe(firstCard)
    expect(gridEl.children[0]?.dataset.cwLoadingDetails).toBe('false')
  })
})
