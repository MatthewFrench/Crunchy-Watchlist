import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type CuratedPanelGridTransitionsRuntime = {
  reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[]) => void
}

type CuratedPanelGridTransitionsModule = {
  runtimeCuratedPanelGridTransitions: {
    createCuratedPanelGridTransitionsRuntime: () => CuratedPanelGridTransitionsRuntime
  }
}

type FakeElement = {
  className: string
  children: FakeElement[]
  parentNode: FakeElement | null
  appendChild: (child: FakeElement) => FakeElement
  insertBefore: (child: FakeElement, reference: FakeElement | null) => FakeElement
  removeChild: (child: FakeElement) => FakeElement
}

const curatedPanelGridTransitionsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridTransitions.ts'),
).href

function getCuratedPanelGridTransitionsModule() {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as CuratedPanelGridTransitionsModule
  return registry.runtimeCuratedPanelGridTransitions
}

function createFakeElement(className = ''): FakeElement {
  const element = {
    className,
    children: [] as FakeElement[],
    parentNode: null as FakeElement | null,
  } as FakeElement

  const detachChild = (child: FakeElement): void => {
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

  element.appendChild = (child: FakeElement) => {
    detachChild(child)
    element.children.push(child)
    child.parentNode = element
    return child
  }

  element.insertBefore = (child: FakeElement, reference: FakeElement | null) => {
    detachChild(child)
    if (!reference) {
      element.children.push(child)
      child.parentNode = element
      return child
    }

    const referenceIndex = element.children.indexOf(reference)
    if (referenceIndex < 0) {
      element.children.push(child)
    } else {
      element.children.splice(referenceIndex, 0, child)
    }
    child.parentNode = element
    return child
  }

  element.removeChild = (child: FakeElement) => {
    const index = element.children.indexOf(child)
    if (index >= 0) {
      element.children.splice(index, 1)
      child.parentNode = null
    }
    return child
  }

  return element
}

describe('curated-panel-grid-transitions runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([curatedPanelGridTransitionsModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('reorders cards and removes overflow cards when animation prerequisites are unavailable', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime()
    const grid = createFakeElement('cw-curated-grid')
    const cardA = createFakeElement('cw-curated-card')
    const cardB = createFakeElement('cw-curated-card')
    const cardC = createFakeElement('cw-curated-card')

    grid.appendChild(cardA)
    grid.appendChild(cardB)
    grid.appendChild(cardC)

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [
      cardB as unknown as Element,
      cardA as unknown as Element,
    ])

    expect(grid.children).toEqual([cardB, cardA])
    expect(cardC.parentNode).toBeNull()
  })

  it('clears all cards when next card list is empty', () => {
    const runtime = getCuratedPanelGridTransitionsModule().createCuratedPanelGridTransitionsRuntime()
    const grid = createFakeElement('cw-curated-grid')
    const cardA = createFakeElement('cw-curated-card')
    const cardB = createFakeElement('cw-curated-card')
    grid.appendChild(cardA)
    grid.appendChild(cardB)

    runtime.reorderCuratedGridChildren(grid as unknown as Element, [])

    expect(grid.children).toHaveLength(0)
    expect(cardA.parentNode).toBeNull()
    expect(cardB.parentNode).toBeNull()
  })
})
