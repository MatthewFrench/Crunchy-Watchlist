import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type BootstrapGateRuntime = {
  shouldRun: (options: Record<string, unknown>) => boolean
  isWatchlistPath: (pathname: unknown) => boolean
  getWatchlistRoot: (documentRef: unknown) => Element | null
  getWatchlistHeader: (documentRef: unknown) => Element | null
}

type BootstrapGateModule = {
  runtimeBootstrapGate: BootstrapGateRuntime
}

const bootstrapGateModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapGate.ts'),
).href

function getBootstrapGateRuntime() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as BootstrapGateModule
  return registry.runtimeBootstrapGate
}

describe('bootstrap-gate runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([bootstrapGateModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('blocks iframe execution and duplicate same-version bootstrap runs', () => {
    const runtime = getBootstrapGateRuntime()

    const iframeWindow = {
      top: {},
      __CW_WATCHLIST_CURATOR_MODULES__: {},
    }
    expect(
      runtime.shouldRun({
        windowRef: iframeWindow,
        browserRef: {
          runtime: {
            getManifest: () => ({ version: '1.2.3' }),
          },
        },
      }),
    ).toBe(false)

    const topWindow = {
      top: null as unknown,
      __CW_WATCHLIST_CURATOR_MODULES__: {},
      __CW_WATCHLIST_CURATOR_LOADED__: undefined as unknown,
    }
    topWindow.top = topWindow

    const firstRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    })
    const secondRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    })

    expect(firstRun).toBe(true)
    expect(secondRun).toBe(false)
  })

  it('detects watchlist paths only for trailing watchlist segment', () => {
    const runtime = getBootstrapGateRuntime()

    expect(runtime.isWatchlistPath('/watchlist')).toBe(true)
    expect(runtime.isWatchlistPath('/en-us/watchlist')).toBe(true)
    expect(runtime.isWatchlistPath('/browse')).toBe(false)
    expect(runtime.isWatchlistPath('/watchlist/extra')).toBe(false)
  })

  it('finds watchlist root and header selectors', () => {
    const runtime = getBootstrapGateRuntime()
    const watchlistRoot = { className: 'erc-watchlist' }
    const watchlistHeader = { className: 'watchlist-header' }
    const fakeDocument = {
      querySelector: (selector: string) => {
        if (selector === '.erc-watchlist' || selector === '[data-t="watchlist-page"]') {
          return watchlistRoot
        }
        if (
          selector === '.erc-watchlist .watchlist-header' ||
          selector === '.erc-watchlist [class*="watchlist-header"]'
        ) {
          return watchlistHeader
        }
        return null
      },
    }

    expect(runtime.getWatchlistRoot(fakeDocument)?.className).toContain('erc-watchlist')
    expect(runtime.getWatchlistHeader(fakeDocument)?.className).toContain('watchlist-header')
  })
})
