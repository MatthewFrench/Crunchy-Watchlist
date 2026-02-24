import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type FakeClassList = {
  add: (...tokens: string[]) => void
}

type FakeElement = {
  tagName: string
  id: string
  className: string
  classList: FakeClassList
  textContent: string
  type: string
  checked: boolean
  value: string
  selected: boolean
  style: Record<string, string>
  attributes: Record<string, string>
  children: FakeElement[]
  appendChild: (child: FakeElement) => FakeElement
  setAttribute: (name: string, value: string) => void
}

type ControlsViewRuntime = {
  createCuratedInterfaceControls: (settings: unknown, sortModeControlOptions: unknown) => Record<string, unknown>
}

type ControlsViewModule = {
  createControlsView: () => ControlsViewRuntime
}

const controlsViewModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Ui', 'ControlsView.ts'),
).href

function createFakeDocument() {
  return {
    createElement(tagName: string): FakeElement {
      const classNames = new Set<string>()
      const element: FakeElement = {
        tagName,
        id: '',
        className: '',
        classList: {
          add: (...tokens: string[]) => {
            tokens.forEach((token) => {
              if (token) {
                classNames.add(token)
              }
            })
            element.className = Array.from(classNames).join(' ')
          },
        },
        textContent: '',
        type: '',
        checked: false,
        value: '',
        selected: false,
        style: {},
        attributes: {},
        children: [],
        appendChild(child: FakeElement) {
          this.children.push(child)
          return child
        },
        setAttribute(name: string, value: string) {
          this.attributes[name] = value
        },
      }
      return element
    },
  }
}

function getControlsViewModule(): ControlsViewModule {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as {
    ui?: Record<string, unknown>
  }
  return registry.ui?.controlsView as ControlsViewModule
}

describe('controls-view ui module', () => {
  const previousDocument = (globalThis as Record<string, unknown>).document

  beforeEach(async () => {
    ;(globalThis as Record<string, unknown>).document = createFakeDocument()
    await loadRuntimeModules([controlsViewModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
    ;(globalThis as Record<string, unknown>).document = previousDocument
  })

  it('creates a secondary sort control with an explicit disabled option', () => {
    const runtime = getControlsViewModule().createControlsView()
    const controls = runtime.createCuratedInterfaceControls(
      {
        sortMode: 'rating_desc',
        secondarySortMode: 'none',
      },
      [{ optionValue: 'rating_desc', title: 'Rating high to low' }],
    )

    const secondarySortControl = controls.secondarySortControl as Record<string, unknown>
    const secondarySelect = secondarySortControl.select as FakeElement
    expect(secondarySelect.id).toBe('cw-secondary-sort-mode')
    expect(secondarySelect.children.map((child) => child.value)).toEqual(['none', 'rating_desc'])
    expect(secondarySelect.children[0]?.textContent).toBe('Disabled (primary sort only)')
    expect(secondarySelect.children[0]?.selected).toBe(true)
  })
})
