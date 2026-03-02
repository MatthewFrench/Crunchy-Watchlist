type BoundaryValue = CwBoundaryValue;
type LooseRecord = Record<string, BoundaryValue>;

type RuntimeStateLike = {
  framedRootEl: Element | null;
  nativeHiddenNodes: Element[];
  hostEl: Element | null;
  tabCrunchyrollEl: Element | null;
  tabCuratedEl: Element | null;
  curatedPanelEl: Element | null;
  controlsEl: Element | null;
  loadingBoxEl: Element | null;
  loadingIndicatorEl: Element | null;
  controlsLoadingIndicatorEl: Element | null;
  audioFilterSelectEl: Element | null;
  genreFilterSelectEl: Element | null;
  statsEl: Element | null;
  gridEl: Element | null;
  curatedGridRenderSignature: string;
};

type InterfaceShellHostLifecycleContextLike = {
  state: RuntimeStateLike;
  windowRef: Window;
  getWatchlistRoot: () => Element | null;
};

export type InterfaceShellHostLifecycleRuntime = {
  isConnectedElement: (value: BoundaryValue) => value is Element;
  clearInterfaceReferences: (context: InterfaceShellHostLifecycleContextLike) => void;
  resetInterfaceShell: (context: InterfaceShellHostLifecycleContextLike, removeHost: boolean) => void;
  isInterfaceShellIntact: (context: InterfaceShellHostLifecycleContextLike) => boolean;
  ensureRootFrame: (context: InterfaceShellHostLifecycleContextLike, rootElement: Element | null) => void;
  clearRootFrame: (context: InterfaceShellHostLifecycleContextLike) => void;
  setNativeVisibility: (context: InterfaceShellHostLifecycleContextLike, showNative: boolean) => void;
  restoreActiveCuratedHostVisibility: (context: InterfaceShellHostLifecycleContextLike) => void;
  removeOrphanCuratedHosts: (context: InterfaceShellHostLifecycleContextLike, rootElement: Element) => void;
};

function asRecord(value: BoundaryValue): LooseRecord {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as LooseRecord;
}

function isElementWithDisplayState(value: BoundaryValue): value is HTMLElement {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as LooseRecord;
  return (
    typeof record.style === 'object' &&
    record.style != null &&
    typeof record.dataset === 'object' &&
    record.dataset != null &&
    typeof record.classList === 'object'
  );
}

function isCuratedHostElement(value: BoundaryValue): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const element = value as Element;
  return Boolean(
    element.classList && typeof element.classList.contains === 'function' && element.classList.contains('cw-host'),
  );
}

function clearPreviousDisplayMarker(node: Element): void {
  if (!isElementWithDisplayState(node)) {
    return;
  }
  if (!Object.hasOwn(node.dataset, 'cwPrevDisplay')) {
    return;
  }
  node.style.display = node.dataset.cwPrevDisplay != null ? node.dataset.cwPrevDisplay : '';
  delete node.dataset.cwPrevDisplay;
}

function isConnectedHostDescendant(
  host: Element,
  candidate: BoundaryValue,
  isConnectedElement: (value: BoundaryValue) => value is Element,
): boolean {
  if (!isConnectedElement(candidate)) {
    return false;
  }
  if (typeof host.contains !== 'function') {
    return true;
  }
  return host.contains(candidate);
}

class InterfaceShellHostLifecycleController implements InterfaceShellHostLifecycleRuntime {
  isConnectedElement(value: BoundaryValue): value is Element {
    return Boolean(value && typeof value === 'object' && asRecord(value).isConnected === true);
  }

  clearInterfaceReferences(context: InterfaceShellHostLifecycleContextLike): void {
    context.state.hostEl = null;
    context.state.tabCrunchyrollEl = null;
    context.state.tabCuratedEl = null;
    context.state.curatedPanelEl = null;
    context.state.controlsEl = null;
    context.state.loadingBoxEl = null;
    context.state.loadingIndicatorEl = null;
    context.state.controlsLoadingIndicatorEl = null;
    context.state.audioFilterSelectEl = null;
    context.state.genreFilterSelectEl = null;
    context.state.statsEl = null;
    context.state.gridEl = null;
    context.state.curatedGridRenderSignature = '';
  }

  resetInterfaceShell(context: InterfaceShellHostLifecycleContextLike, removeHost: boolean): void {
    if (removeHost && this.isConnectedElement(context.state.hostEl)) {
      context.state.hostEl.remove();
    }
    this.clearInterfaceReferences(context);
  }

  isInterfaceShellIntact(context: InterfaceShellHostLifecycleContextLike): boolean {
    const hostElement = context.state.hostEl;
    if (!this.isConnectedElement(hostElement)) {
      return false;
    }

    return (
      isConnectedHostDescendant(hostElement, context.state.tabCrunchyrollEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.tabCuratedEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.curatedPanelEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.controlsEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.loadingBoxEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.loadingIndicatorEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.controlsLoadingIndicatorEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.audioFilterSelectEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.genreFilterSelectEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.statsEl, this.isConnectedElement) &&
      isConnectedHostDescendant(hostElement, context.state.gridEl, this.isConnectedElement)
    );
  }

  ensureRootFrame(context: InterfaceShellHostLifecycleContextLike, rootElement: Element | null): void {
    if (!rootElement || !isElementWithDisplayState(rootElement)) {
      return;
    }

    if (
      context.state.framedRootEl &&
      context.state.framedRootEl !== rootElement &&
      asRecord(context.state.framedRootEl).isConnected
    ) {
      context.state.framedRootEl.classList.remove('cw-watchlist-frame');
    }

    rootElement.classList.add('cw-watchlist-frame');
    context.state.framedRootEl = rootElement;
  }

  clearRootFrame(context: InterfaceShellHostLifecycleContextLike): void {
    if (context.state.framedRootEl && asRecord(context.state.framedRootEl).isConnected) {
      context.state.framedRootEl.classList.remove('cw-watchlist-frame');
    }
    context.state.framedRootEl = null;
  }

  restoreActiveCuratedHostVisibility(context: InterfaceShellHostLifecycleContextLike): void {
    const hostElement = context.state.hostEl;
    if (!isElementWithDisplayState(hostElement)) {
      return;
    }

    clearPreviousDisplayMarker(hostElement);
    if (hostElement.style.display === 'none') {
      hostElement.style.display = '';
    }
  }

  removeOrphanCuratedHosts(context: InterfaceShellHostLifecycleContextLike, rootElement: Element): void {
    const children = Array.from(rootElement.children);
    children.forEach((child) => {
      if (!isCuratedHostElement(child)) {
        return;
      }
      if (child === context.state.hostEl) {
        return;
      }
      child.remove();
    });
  }

  setNativeVisibility(context: InterfaceShellHostLifecycleContextLike, showNative: boolean): void {
    const rootElement = context.getWatchlistRoot();
    if (!rootElement) {
      return;
    }

    if (showNative) {
      this.restoreNativeVisibility(context, rootElement);
      return;
    }

    this.hideNativeVisibility(context, rootElement);
  }

  private restoreNativeVisibility(context: InterfaceShellHostLifecycleContextLike, rootElement: Element): void {
    const flaggedNodes = Array.from(rootElement.querySelectorAll('[data-cw-prev-display]'));
    const restoreCandidates = new Set([...context.state.nativeHiddenNodes, ...flaggedNodes]);

    restoreCandidates.forEach((node) => {
      if (!isElementWithDisplayState(node)) {
        return;
      }
      if (asRecord(node).isConnected === false) {
        return;
      }

      const previousDisplay = node.dataset.cwPrevDisplay;
      node.style.display = previousDisplay != null ? previousDisplay : '';
      delete node.dataset.cwPrevDisplay;
    });

    context.state.nativeHiddenNodes = [];

    context.windowRef.requestAnimationFrame(() => {
      try {
        context.windowRef.dispatchEvent(new Event('resize'));
        context.windowRef.dispatchEvent(new Event('scroll'));
      } catch {
        // no-op
      }
    });
  }

  private hideNativeVisibility(context: InterfaceShellHostLifecycleContextLike, rootElement: Element): void {
    const children = Array.from(rootElement.children).filter((child) => child !== context.state.hostEl);
    context.state.nativeHiddenNodes = [];

    children.forEach((node) => {
      if (isCuratedHostElement(node)) {
        clearPreviousDisplayMarker(node);
        if (isElementWithDisplayState(node) && node.style.display === 'none') {
          node.style.display = '';
        }
        return;
      }
      if (!isElementWithDisplayState(node)) {
        return;
      }
      if (!Object.hasOwn(node.dataset, 'cwPrevDisplay')) {
        node.dataset.cwPrevDisplay = node.style.display || '';
      }
      node.style.display = 'none';
      context.state.nativeHiddenNodes.push(node);
    });
  }
}

export function createInterfaceShellHostLifecycleRuntime(): InterfaceShellHostLifecycleRuntime {
  return new InterfaceShellHostLifecycleController();
}
