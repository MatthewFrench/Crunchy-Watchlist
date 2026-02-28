let createBootstrapGateRuntimeFactory: (() => object) | null = null;

(() => {
  type BrowserRuntimeSource = {
    runtime?: {
      getManifest?: () => {
        version?: string;
      };
    };
  };

  type BootstrapGateOptions = {
    windowRef?: unknown;
    browserRef?: unknown;
    chromeRef?: unknown;
  };

  type BootstrapGateRuntime = {
    shouldRun: (options: BootstrapGateOptions) => boolean;
    isWatchlistPath: (pathname: unknown) => boolean;
    getWatchlistRoot: (documentRef: unknown) => Element | null;
    getWatchlistHeader: (documentRef: unknown) => Element | null;
  };

  type RuntimeControlOwnedRefs = {
    hostEl?: unknown;
    tabCrunchyrollEl?: unknown;
    tabCuratedEl?: unknown;
    curatedPanelEl?: unknown;
    gridEl?: unknown;
    loadingIndicatorEl?: unknown;
  };

  type RuntimeControl = {
    version?: string;
    shutdown?: (payload?: unknown) => void;
    ownedRefs?: RuntimeControlOwnedRefs;
  };

  type WindowWithRegistry = Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: Record<string, unknown>;
      __CW_WATCHLIST_CURATOR_LOADED__?: {
        version?: string;
        loadedAt?: number;
      };
      __CW_WATCHLIST_CURATOR_CONTROL__?: RuntimeControl;
    };

  const root = (typeof window !== 'undefined' ? window : globalThis) as WindowWithRegistry;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;

  function resolveWindowRef(value: unknown): WindowWithRegistry {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing bootstrap gate windowRef');
    }
    return value as WindowWithRegistry;
  }

  function resolveRuntimeSource(value: unknown): BrowserRuntimeSource | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as BrowserRuntimeSource;
  }

  function getExtensionVersion(options: BootstrapGateOptions): string {
    const runtimeSources = [resolveRuntimeSource(options.browserRef), resolveRuntimeSource(options.chromeRef)];

    for (const source of runtimeSources) {
      const getManifest = source?.runtime?.getManifest;
      if (typeof getManifest !== 'function') {
        continue;
      }

      try {
        const manifest = getManifest();
        const version = manifest?.version;
        if (typeof version === 'string' && version.trim()) {
          return version;
        }
      } catch {
        // no-op
      }
    }

    return '0';
  }

  function isWatchlistPathInternal(pathname: unknown): boolean {
    if (typeof pathname !== 'string') {
      return false;
    }
    return pathname.split('/').filter(Boolean).slice(-1)[0] === 'watchlist';
  }

  function hasClassToken(element: Element | null, className: string): boolean {
    if (!element || !element.classList || typeof element.classList.contains !== 'function') {
      return false;
    }
    return element.classList.contains(className);
  }

  function containsElement(container: Element | null, candidate: Element | null): boolean {
    if (!container || !candidate || typeof container.contains !== 'function') {
      return false;
    }
    return container.contains(candidate);
  }

  function toRuntimeControl(value: unknown): RuntimeControl | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as RuntimeControl;
  }

  function toElement(value: unknown): Element | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const record = value as Record<string, unknown>;
    if (typeof record.contains !== 'function') {
      return null;
    }
    return value as Element;
  }

  function resolveOwnedRefElement(control: RuntimeControl | null, key: keyof RuntimeControlOwnedRefs): Element | null {
    if (!control || !control.ownedRefs || typeof control.ownedRefs !== 'object') {
      return null;
    }
    return toElement((control.ownedRefs as Record<string, unknown>)[key]);
  }

  function hasShellOwnershipRefs(control: RuntimeControl | null): boolean {
    return Boolean(
      resolveOwnedRefElement(control, 'hostEl') ||
        resolveOwnedRefElement(control, 'tabCrunchyrollEl') ||
        resolveOwnedRefElement(control, 'tabCuratedEl') ||
        resolveOwnedRefElement(control, 'curatedPanelEl') ||
        resolveOwnedRefElement(control, 'gridEl') ||
        resolveOwnedRefElement(control, 'loadingIndicatorEl'),
    );
  }

  function isElementVisible(element: Element | null): boolean {
    if (!element) {
      return false;
    }
    const style = (element as Element & { style?: { display?: string } }).style;
    return !style || style.display !== 'none';
  }

  function hasStaleCuratedShell(windowRef: WindowWithRegistry): boolean {
    if (!isWatchlistPathInternal(windowRef.location?.pathname)) {
      return false;
    }

    const documentRef = windowRef.document;
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
      return false;
    }

    const runtimeControl = toRuntimeControl(windowRef.__CW_WATCHLIST_CURATOR_CONTROL__);
    const watchlistRoot = getWatchlistRoot(documentRef);
    const ownedHost = resolveOwnedRefElement(runtimeControl, 'hostEl');
    const discoveredHost = toElement(documentRef.querySelector('.cw-host'));
    const host = ownedHost || discoveredHost;
    const framedRootHasWatchlistFrame = hasClassToken(watchlistRoot, 'cw-watchlist-frame');
    const hasHiddenNativeNodes = Boolean(watchlistRoot?.querySelector('[data-cw-prev-display]'));
    const hasOwnedRefs = hasShellOwnershipRefs(runtimeControl);

    // A stale frame can survive extension reload/reinjection even if host refs are gone.
    // Treat framed/hidden-native residue as stale when shell refs are unavailable or detached.
    if (framedRootHasWatchlistFrame || hasHiddenNativeNodes) {
      if (!host) {
        return true;
      }
      if (!containsElement(watchlistRoot, host)) {
        return true;
      }
      if (!hasOwnedRefs) {
        return true;
      }
    }

    if (!host) {
      return false;
    }

    if (watchlistRoot && !containsElement(watchlistRoot, host)) {
      return true;
    }

    if (!hasOwnedRefs) {
      return false;
    }

    const tabCrunchyroll = resolveOwnedRefElement(runtimeControl, 'tabCrunchyrollEl');
    const tabCurated = resolveOwnedRefElement(runtimeControl, 'tabCuratedEl');
    const panel = resolveOwnedRefElement(runtimeControl, 'curatedPanelEl');
    const grid = resolveOwnedRefElement(runtimeControl, 'gridEl');
    if (!tabCrunchyroll || !tabCurated || !panel || !grid) {
      return true;
    }
    if (
      !containsElement(host, tabCrunchyroll) ||
      !containsElement(host, tabCurated) ||
      !containsElement(host, panel) ||
      !containsElement(host, grid)
    ) {
      return true;
    }

    if (grid.children.length > 0) {
      return false;
    }

    const loadingIndicator = resolveOwnedRefElement(runtimeControl, 'loadingIndicatorEl');
    const loadingVisible = containsElement(host, loadingIndicator) && isElementVisible(loadingIndicator);
    return !loadingVisible;
  }

  function shouldRunInternal(options: BootstrapGateOptions): boolean {
    const windowRef = resolveWindowRef(options.windowRef);
    if (windowRef.top !== windowRef) {
      return false;
    }

    const extensionVersion = getExtensionVersion(options);
    const previousLoad = windowRef.__CW_WATCHLIST_CURATOR_LOADED__;
    if (previousLoad && typeof previousLoad === 'object' && previousLoad.version === extensionVersion) {
      const control = windowRef.__CW_WATCHLIST_CURATOR_CONTROL__;
      const canShutdownPrevious = Boolean(control && typeof control.shutdown === 'function');
      const staleShellDetected = hasStaleCuratedShell(windowRef);

      if (!canShutdownPrevious && !staleShellDetected) {
        return false;
      }

      try {
        control?.shutdown?.({
          reason: 'same-version-rebootstrap',
          staleShellDetected,
        });
      } catch {
        // no-op
      }
    }

    windowRef.__CW_WATCHLIST_CURATOR_LOADED__ = {
      version: extensionVersion,
      loadedAt: Date.now(),
    };
    return true;
  }

  function isWatchlistPath(pathname: unknown): boolean {
    return isWatchlistPathInternal(pathname);
  }

  function queryFirst(selectors: string[], documentRef: Document): Element | null {
    for (const selector of selectors) {
      const element = documentRef.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  function getWatchlistRoot(documentRef: unknown): Element | null {
    if (!documentRef || typeof documentRef !== 'object') {
      return null;
    }

    const normalizedDocumentRef = documentRef as Document;
    return queryFirst(['.erc-watchlist', '[data-t="watchlist-page"]'], normalizedDocumentRef);
  }

  function getWatchlistHeader(documentRef: unknown): Element | null {
    if (!documentRef || typeof documentRef !== 'object') {
      return null;
    }

    const normalizedDocumentRef = documentRef as Document;
    return queryFirst(
      [
        '.erc-watchlist .watchlist-header',
        '.erc-watchlist [class*="watchlist-header"]',
        '.erc-watchlist .erc-watchlist-controls',
        '.erc-watchlist [class*="watchlist-controls"]',
      ],
      normalizedDocumentRef,
    );
  }

  const runtime: BootstrapGateRuntime = {
    shouldRun: (options: BootstrapGateOptions) => shouldRunInternal(options),
    isWatchlistPath: (pathname: unknown) => isWatchlistPath(pathname),
    getWatchlistRoot: (documentRef: unknown) => getWatchlistRoot(documentRef),
    getWatchlistHeader: (documentRef: unknown) => getWatchlistHeader(documentRef),
  };

  createBootstrapGateRuntimeFactory = () => runtime;

  moduleRegistry.runtimeBootstrapGate = runtime;
})();

export function createBootstrapGateRuntime(): object {
  if (typeof createBootstrapGateRuntimeFactory !== 'function') {
    throw new Error('[CW] Bootstrap gate runtime factory was not initialized.');
  }
  return createBootstrapGateRuntimeFactory();
}
