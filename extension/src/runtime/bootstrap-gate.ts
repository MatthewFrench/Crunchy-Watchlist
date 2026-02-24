;(() => {
  type BrowserRuntimeSource = {
    runtime?: {
      getManifest?: () => {
        version?: string
      }
    }
  }

  type BootstrapGateOptions = {
    windowRef?: unknown
    browserRef?: unknown
    chromeRef?: unknown
  }

  type BootstrapGateRuntime = {
    shouldRun: (options: BootstrapGateOptions) => boolean
    isWatchlistPath: (pathname: unknown) => boolean
    getWatchlistRoot: (documentRef: unknown) => Element | null
    getWatchlistHeader: (documentRef: unknown) => Element | null
  }

  type WindowWithRegistry = Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: Record<string, unknown>
      __CW_WATCHLIST_CURATOR_LOADED__?: {
        version?: string
      }
    }

  const root = (typeof window !== 'undefined' ? window : globalThis) as WindowWithRegistry
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function resolveWindowRef(value: unknown): WindowWithRegistry {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing bootstrap gate windowRef')
    }
    return value as WindowWithRegistry
  }

  function resolveRuntimeSource(value: unknown): BrowserRuntimeSource | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as BrowserRuntimeSource
  }

  function getExtensionVersion(options: BootstrapGateOptions): string {
    const runtimeSources = [resolveRuntimeSource(options.browserRef), resolveRuntimeSource(options.chromeRef)]

    for (const source of runtimeSources) {
      const getManifest = source?.runtime?.getManifest
      if (typeof getManifest !== 'function') {
        continue
      }

      try {
        const manifest = getManifest()
        const version = manifest?.version
        if (typeof version === 'string' && version.trim()) {
          return version
        }
      } catch {
        // no-op
      }
    }

    return '0'
  }

  function shouldRunInternal(options: BootstrapGateOptions): boolean {
    const windowRef = resolveWindowRef(options.windowRef)
    if (windowRef.top !== windowRef) {
      return false
    }

    const extensionVersion = getExtensionVersion(options)
    const previousLoad = windowRef.__CW_WATCHLIST_CURATOR_LOADED__
    if (previousLoad && typeof previousLoad === 'object' && previousLoad.version === extensionVersion) {
      return false
    }

    windowRef.__CW_WATCHLIST_CURATOR_LOADED__ = {
      version: extensionVersion,
    }
    return true
  }

  function isWatchlistPath(pathname: unknown): boolean {
    if (typeof pathname !== 'string') {
      return false
    }
    return pathname.split('/').filter(Boolean).slice(-1)[0] === 'watchlist'
  }

  function queryFirst(selectors: string[], documentRef: Document): Element | null {
    for (const selector of selectors) {
      const element = documentRef.querySelector(selector)
      if (element) {
        return element
      }
    }
    return null
  }

  function getWatchlistRoot(documentRef: unknown): Element | null {
    if (!documentRef || typeof documentRef !== 'object') {
      return null
    }

    const normalizedDocumentRef = documentRef as Document
    return queryFirst(['.erc-watchlist', '[data-t="watchlist-page"]'], normalizedDocumentRef)
  }

  function getWatchlistHeader(documentRef: unknown): Element | null {
    if (!documentRef || typeof documentRef !== 'object') {
      return null
    }

    const normalizedDocumentRef = documentRef as Document
    return queryFirst(
      [
        '.erc-watchlist .watchlist-header',
        '.erc-watchlist [class*="watchlist-header"]',
        '.erc-watchlist .erc-watchlist-controls',
        '.erc-watchlist [class*="watchlist-controls"]',
      ],
      normalizedDocumentRef,
    )
  }

  const runtime: BootstrapGateRuntime = {
    shouldRun: (options: BootstrapGateOptions) => shouldRunInternal(options),
    isWatchlistPath: (pathname: unknown) => isWatchlistPath(pathname),
    getWatchlistRoot: (documentRef: unknown) => getWatchlistRoot(documentRef),
    getWatchlistHeader: (documentRef: unknown) => getWatchlistHeader(documentRef),
  }

  moduleRegistry.runtimeBootstrapGate = runtime
})()
