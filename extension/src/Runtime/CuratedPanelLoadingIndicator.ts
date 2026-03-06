type RequestProgress = {
  started: number;
  completed: number;
  inProgress: number;
};

type CuratedPanelLoadingIndicatorSyncOptions = {
  documentRef: Document;
  loadingIndicatorEl: Element;
  loadingBoxEl?: Element | null;
  gridEl?: Element | null;
  loading: boolean;
  firstLoadInFlight: boolean;
  pendingRequests: string[];
  requestProgress: RequestProgress;
};

type CuratedPanelLoadingIndicatorRuntime = {
  syncLoadingIndicator: (options: CuratedPanelLoadingIndicatorSyncOptions) => void;
};

type LoadingIndicatorDetailsNodes = CwLoadingIndicatorDetailsRefs;

type LoadingIndicatorElement = CwLoadingIndicatorElement & {
  parentNode?: Element | null;
};

type PositionableElement = Element & {
  style?: {
    top?: string;
  };
};

type LoadingBoxStyle = {
  top?: string;
  display?: string;
  height?: string;
};

type TimedRoot = {
  requestAnimationFrame?: (callback: () => void) => number;
  cancelAnimationFrame?: (id: number) => void;
  setTimeout?: (callback: () => void, delay?: number) => number;
  clearTimeout?: (id: number) => void;
};

const LOADING_BOX_TRANSITION_MS = 2_000;
const GRID_CONTAINER_TRANSITION_MS = 1_000;
const cardContainerVisibleClassName = 'cw-curated-card-container--visible';
const cardContainerAnimatingClassName = 'cw-curated-card-container--animating';
const legacyGridVisibleClassName = 'cw-curated-grid--visible';
const legacyGridAnimatingClassName = 'cw-curated-grid--animating';

class CuratedPanelLoadingIndicatorController {
  private readonly loadingIndicatorDetailsByElement = new WeakMap<Element, LoadingIndicatorDetailsNodes>();
  private readonly loadingBoxVisibleByElement = new WeakMap<Element, boolean>();
  private readonly loadingBoxExitTimeoutByElement = new WeakMap<Element, number>();
  private readonly loadingBoxEnterFrameByElement = new WeakMap<Element, number>();
  private readonly gridContainerVisibleByElement = new WeakMap<Element, boolean>();
  private readonly gridContainerHasShownByElement = new WeakMap<Element, boolean>();
  private readonly gridContainerEnterFrameByElement = new WeakMap<Element, number>();
  private readonly gridContainerSettleTimeoutByElement = new WeakMap<Element, number>();

  private appendChildElement(parent: Element, child: Element): void {
    const mutableParent = parent as Element & {
      appendChild?: (child: Element) => void;
    };
    mutableParent.appendChild?.(child);
  }

  private setElementDisplayStyle(element: Element, displayValue: string): void {
    const style = (element as Element & { style?: { display?: string } }).style;
    if (!style) {
      return;
    }
    if (style.display === displayValue) {
      return;
    }
    style.display = displayValue;
  }

  private resolveLoadingBoxStyle(loadingBoxEl: Element | null): LoadingBoxStyle | null {
    if (!loadingBoxEl) {
      return null;
    }
    const style = (loadingBoxEl as Element & { style?: LoadingBoxStyle }).style;
    return style && typeof style === 'object' ? style : null;
  }

  private toggleClassNameToken(className: string, token: string, enabled: boolean): string {
    const classTokens = className
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean);
    const hasToken = classTokens.includes(token);
    if (enabled && !hasToken) {
      classTokens.push(token);
      return classTokens.join(' ');
    }
    if (!enabled && hasToken) {
      return classTokens.filter((item) => item !== token).join(' ');
    }
    return classTokens.join(' ');
  }

  private setElementClassToken(element: Element, token: string, enabled: boolean): void {
    const mutableElement = element as Element & { className?: string };
    const currentClassName = mutableElement.className || '';
    const nextClassName = this.toggleClassNameToken(currentClassName, token, enabled);
    if (nextClassName === currentClassName) {
      return;
    }
    mutableElement.className = nextClassName;
  }

  private setCardContainerClassToken(element: Element, token: string, enabled: boolean): void {
    this.setElementClassToken(element, token, enabled);
    if (token === cardContainerVisibleClassName) {
      this.setElementClassToken(element, legacyGridVisibleClassName, enabled);
      return;
    }
    if (token === cardContainerAnimatingClassName) {
      this.setElementClassToken(element, legacyGridAnimatingClassName, enabled);
    }
  }

  private hasCardContainerClassToken(element: Element, token: string): boolean {
    if (this.hasElementClassToken(element, token)) {
      return true;
    }
    if (token === cardContainerVisibleClassName) {
      return this.hasElementClassToken(element, legacyGridVisibleClassName);
    }
    if (token === cardContainerAnimatingClassName) {
      return this.hasElementClassToken(element, legacyGridAnimatingClassName);
    }
    return false;
  }

  private hasElementClassToken(element: Element, token: string): boolean {
    const className = (element as Element & { className?: string }).className || '';
    return className
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
      .includes(token);
  }

  private resolveTimedRoot(documentRef: Document): TimedRoot | null {
    const defaultView = (documentRef as Document & { defaultView?: TimedRoot | null }).defaultView;
    return defaultView && typeof defaultView === 'object' ? defaultView : null;
  }

  private requestAnimationFrame(documentRef: Document, callback: () => void): number | null {
    const root = this.resolveTimedRoot(documentRef);
    if (!root || typeof root.requestAnimationFrame !== 'function') {
      callback();
      return null;
    }
    return root.requestAnimationFrame(callback);
  }

  private cancelAnimationFrame(documentRef: Document, frameId: number): void {
    const root = this.resolveTimedRoot(documentRef);
    if (!root || typeof root.cancelAnimationFrame !== 'function') {
      return;
    }
    root.cancelAnimationFrame(frameId);
  }

  private scheduleTimeout(documentRef: Document, callback: () => void, delayMs: number): number | null {
    const root = this.resolveTimedRoot(documentRef);
    if (!root || typeof root.setTimeout !== 'function') {
      callback();
      return null;
    }
    return root.setTimeout(callback, delayMs);
  }

  private clearTimeout(documentRef: Document, timeoutId: number): void {
    const root = this.resolveTimedRoot(documentRef);
    if (!root || typeof root.clearTimeout !== 'function') {
      return;
    }
    root.clearTimeout(timeoutId);
  }

  private cancelPendingLoadingBoxEnterFrame(loadingBoxEl: Element, documentRef: Document): void {
    const pendingFrame = this.loadingBoxEnterFrameByElement.get(loadingBoxEl);
    if (typeof pendingFrame === 'number') {
      this.cancelAnimationFrame(documentRef, pendingFrame);
      this.loadingBoxEnterFrameByElement.delete(loadingBoxEl);
    }
  }

  private clearLoadingBoxExitTimeout(loadingBoxEl: Element, documentRef: Document): void {
    const timeoutId = this.loadingBoxExitTimeoutByElement.get(loadingBoxEl);
    if (typeof timeoutId === 'number') {
      this.clearTimeout(documentRef, timeoutId);
      this.loadingBoxExitTimeoutByElement.delete(loadingBoxEl);
    }
  }

  private resolveExpandedLoadingBoxHeight(loadingBoxEl: Element): number {
    const scrollHeightValue = (loadingBoxEl as Element & { scrollHeight?: number }).scrollHeight;
    if (typeof scrollHeightValue === 'number' && Number.isFinite(scrollHeightValue) && scrollHeightValue > 0) {
      return scrollHeightValue;
    }
    return 1;
  }

  private setLoadingBoxHeight(loadingBoxEl: Element | null, heightPx: number): void {
    const style = this.resolveLoadingBoxStyle(loadingBoxEl);
    if (!style) {
      return;
    }
    const nextHeight = `${Math.max(0, Math.ceil(heightPx))}px`;
    if (style.height === nextHeight) {
      return;
    }
    style.height = nextHeight;
  }

  private clearGridContainerSettleTimeout(gridEl: Element, documentRef: Document): void {
    const timeoutId = this.gridContainerSettleTimeoutByElement.get(gridEl);
    if (typeof timeoutId === 'number') {
      this.clearTimeout(documentRef, timeoutId);
      this.gridContainerSettleTimeoutByElement.delete(gridEl);
    }
  }

  private cancelPendingGridContainerEnterFrame(gridEl: Element, documentRef: Document): void {
    const frameId = this.gridContainerEnterFrameByElement.get(gridEl);
    if (typeof frameId === 'number') {
      this.cancelAnimationFrame(documentRef, frameId);
      this.gridContainerEnterFrameByElement.delete(gridEl);
    }
  }

  private setGridContainerHeight(gridEl: Element, heightPx: number | null): void {
    const style = this.resolveLoadingBoxStyle(gridEl);
    if (!style) {
      return;
    }
    if (heightPx == null) {
      if (typeof style.height === 'string' && style.height) {
        style.height = '';
      }
      return;
    }
    const nextHeight = `${Math.max(0, Math.ceil(heightPx))}px`;
    if (style.height === nextHeight) {
      return;
    }
    style.height = nextHeight;
  }

  private finalizeGridContainerShownState(gridEl: Element): void {
    this.gridContainerHasShownByElement.set(gridEl, true);
    this.setCardContainerClassToken(gridEl, cardContainerAnimatingClassName, false);
    this.setCardContainerClassToken(gridEl, cardContainerVisibleClassName, true);
    this.setGridContainerHeight(gridEl, null);
  }

  private hideGridContainer(documentRef: Document, gridEl: Element): void {
    const wasVisible =
      this.gridContainerVisibleByElement.get(gridEl) === true ||
      this.hasCardContainerClassToken(gridEl, cardContainerVisibleClassName) ||
      this.gridContainerEnterFrameByElement.has(gridEl);
    this.gridContainerVisibleByElement.set(gridEl, false);
    this.cancelPendingGridContainerEnterFrame(gridEl, documentRef);
    this.clearGridContainerSettleTimeout(gridEl, documentRef);
    this.setCardContainerClassToken(gridEl, cardContainerAnimatingClassName, true);
    if (!wasVisible) {
      this.setCardContainerClassToken(gridEl, cardContainerVisibleClassName, false);
      this.setGridContainerHeight(gridEl, 0);
      return;
    }
    this.setCardContainerClassToken(gridEl, cardContainerVisibleClassName, true);
    this.setGridContainerHeight(gridEl, this.resolveExpandedLoadingBoxHeight(gridEl));
    this.forceLayoutRead(gridEl);
    this.setCardContainerClassToken(gridEl, cardContainerVisibleClassName, false);
    this.setGridContainerHeight(gridEl, 0);
  }

  private showGridContainer(documentRef: Document, gridEl: Element): void {
    const isClassVisible = this.hasCardContainerClassToken(gridEl, cardContainerVisibleClassName);
    const pendingEnterFrame = this.gridContainerEnterFrameByElement.get(gridEl);
    this.gridContainerVisibleByElement.set(gridEl, true);
    this.clearGridContainerSettleTimeout(gridEl, documentRef);
    this.setCardContainerClassToken(gridEl, cardContainerAnimatingClassName, true);

    if (isClassVisible) {
      this.finalizeGridContainerShownState(gridEl);
      return;
    }

    if (typeof pendingEnterFrame === 'number') {
      return;
    }

    this.setCardContainerClassToken(gridEl, cardContainerVisibleClassName, false);
    this.setGridContainerHeight(gridEl, 0);
    this.forceLayoutRead(gridEl);

    const enter = (): void => {
      this.gridContainerEnterFrameByElement.delete(gridEl);
      if (this.gridContainerVisibleByElement.get(gridEl) !== true) {
        return;
      }
      this.setCardContainerClassToken(gridEl, cardContainerVisibleClassName, true);
      this.setGridContainerHeight(gridEl, this.resolveExpandedLoadingBoxHeight(gridEl));

      const timeoutId = this.scheduleTimeout(
        documentRef,
        () => {
          this.gridContainerSettleTimeoutByElement.delete(gridEl);
          if (this.gridContainerVisibleByElement.get(gridEl) !== true) {
            return;
          }
          this.finalizeGridContainerShownState(gridEl);
        },
        GRID_CONTAINER_TRANSITION_MS,
      );
      if (typeof timeoutId === 'number') {
        this.gridContainerSettleTimeoutByElement.set(gridEl, timeoutId);
      }
    };

    const frameId = this.requestAnimationFrame(documentRef, enter);
    if (typeof frameId === 'number') {
      this.gridContainerEnterFrameByElement.set(gridEl, frameId);
    }
  }

  private syncGridContainerVisibility(documentRef: Document, gridEl: Element | null, visible: boolean): void {
    if (!gridEl) {
      return;
    }
    if (visible) {
      this.showGridContainer(documentRef, gridEl);
      return;
    }
    if (
      this.gridContainerHasShownByElement.get(gridEl) === true ||
      this.gridContainerVisibleByElement.get(gridEl) === true ||
      this.gridContainerEnterFrameByElement.has(gridEl)
    ) {
      return;
    }
    this.hideGridContainer(documentRef, gridEl);
  }

  private forceLayoutRead(loadingBoxEl: Element): void {
    void (loadingBoxEl as Element & { scrollHeight?: number }).scrollHeight;
  }

  private finalizeLoadingBoxHiddenState(loadingBoxEl: Element, loadingIndicatorEl: Element): void {
    this.setElementClassToken(loadingBoxEl, 'cw-loading-box--visible', false);
    this.setLoadingBoxHeight(loadingBoxEl, 0);
    this.setElementDisplayStyle(loadingIndicatorEl, 'none');
    this.setElementDisplayStyle(loadingBoxEl, 'none');
  }

  private showLoadingBox(documentRef: Document, loadingBoxEl: Element, loadingIndicatorEl: Element): void {
    const isClassVisible = this.hasElementClassToken(loadingBoxEl, 'cw-loading-box--visible');
    const pendingEnterFrame = this.loadingBoxEnterFrameByElement.get(loadingBoxEl);
    this.loadingBoxVisibleByElement.set(loadingBoxEl, true);
    this.clearLoadingBoxExitTimeout(loadingBoxEl, documentRef);
    this.setElementDisplayStyle(loadingBoxEl, 'block');
    this.setElementDisplayStyle(loadingIndicatorEl, 'flex');

    if (isClassVisible) {
      this.setElementClassToken(loadingBoxEl, 'cw-loading-box--visible', true);
      this.setLoadingBoxHeight(loadingBoxEl, this.resolveExpandedLoadingBoxHeight(loadingBoxEl));
      return;
    }

    if (typeof pendingEnterFrame === 'number') {
      return;
    }

    this.setElementClassToken(loadingBoxEl, 'cw-loading-box--visible', false);
    this.setLoadingBoxHeight(loadingBoxEl, 0);
    this.forceLayoutRead(loadingBoxEl);

    const enter = (): void => {
      this.loadingBoxEnterFrameByElement.delete(loadingBoxEl);
      if (this.loadingBoxVisibleByElement.get(loadingBoxEl) !== true) {
        return;
      }
      this.setElementClassToken(loadingBoxEl, 'cw-loading-box--visible', true);
      this.setLoadingBoxHeight(loadingBoxEl, this.resolveExpandedLoadingBoxHeight(loadingBoxEl));
    };

    const frameId = this.requestAnimationFrame(documentRef, enter);
    if (typeof frameId === 'number') {
      this.loadingBoxEnterFrameByElement.set(loadingBoxEl, frameId);
    }
  }

  private hideLoadingBox(documentRef: Document, loadingBoxEl: Element, loadingIndicatorEl: Element): void {
    const wasVisible = this.loadingBoxVisibleByElement.get(loadingBoxEl) === true;
    this.loadingBoxVisibleByElement.set(loadingBoxEl, false);
    this.cancelPendingLoadingBoxEnterFrame(loadingBoxEl, documentRef);
    this.clearLoadingBoxExitTimeout(loadingBoxEl, documentRef);

    if (!wasVisible) {
      this.finalizeLoadingBoxHiddenState(loadingBoxEl, loadingIndicatorEl);
      return;
    }

    this.setElementDisplayStyle(loadingBoxEl, 'block');
    this.setElementDisplayStyle(loadingIndicatorEl, 'flex');
    this.setElementClassToken(loadingBoxEl, 'cw-loading-box--visible', true);
    this.setLoadingBoxHeight(loadingBoxEl, this.resolveExpandedLoadingBoxHeight(loadingBoxEl));
    this.forceLayoutRead(loadingBoxEl);
    this.setElementClassToken(loadingBoxEl, 'cw-loading-box--visible', false);
    this.setLoadingBoxHeight(loadingBoxEl, 0);

    const timeoutId = this.scheduleTimeout(
      documentRef,
      () => {
        this.loadingBoxExitTimeoutByElement.delete(loadingBoxEl);
        if (this.loadingBoxVisibleByElement.get(loadingBoxEl) === true) {
          return;
        }
        this.finalizeLoadingBoxHiddenState(loadingBoxEl, loadingIndicatorEl);
      },
      LOADING_BOX_TRANSITION_MS,
    );
    if (typeof timeoutId === 'number') {
      this.loadingBoxExitTimeoutByElement.set(loadingBoxEl, timeoutId);
    }
  }

  private clearLoadingBoxTopStyle(loadingBoxEl: Element | null): void {
    if (!loadingBoxEl) {
      return;
    }
    const style = (loadingBoxEl as PositionableElement).style;
    if (!style) {
      return;
    }
    if (typeof style.top === 'string' && style.top) {
      style.top = '';
    }
  }

  private createLoadingIndicatorDetailsNodes(
    documentRef: Document,
    loadingIndicatorEl: Element,
  ): LoadingIndicatorDetailsNodes {
    const details = documentRef.createElement('span');
    details.className = 'cw-loading__details';

    const detailsTitle = documentRef.createElement('span');
    detailsTitle.className = 'cw-loading__details-title';
    detailsTitle.textContent = 'Loading progress';
    this.appendChildElement(details, detailsTitle);

    const progress = documentRef.createElement('span');
    progress.className = 'cw-loading__progress';
    this.appendChildElement(details, progress);

    const requests = documentRef.createElement('ul');
    requests.className = 'cw-loading__requests';
    this.appendChildElement(details, requests);

    this.appendChildElement(loadingIndicatorEl, details);

    return {
      details: details as HTMLElement,
      progress: progress as HTMLElement,
      requests: requests as HTMLElement,
    };
  }

  private resolveLoadingIndicatorDetailsNodes(
    documentRef: Document,
    loadingIndicatorEl: Element,
  ): LoadingIndicatorDetailsNodes {
    const existingRefs = this.loadingIndicatorDetailsByElement.get(loadingIndicatorEl);
    if (existingRefs) {
      return existingRefs;
    }
    const refs = this.createLoadingIndicatorDetailsNodes(documentRef, loadingIndicatorEl);
    this.loadingIndicatorDetailsByElement.set(loadingIndicatorEl, refs);
    return refs;
  }

  private resolveLoadingBoxElement(
    loadingIndicatorEl: Element,
    loadingBoxEl: Element | null | undefined,
  ): Element | null {
    if (loadingBoxEl && typeof loadingBoxEl === 'object') {
      return loadingBoxEl;
    }
    const parentNode = (loadingIndicatorEl as LoadingIndicatorElement).parentNode;
    return parentNode && typeof parentNode === 'object' ? parentNode : null;
  }

  private setLoadingBoxVisibility(
    documentRef: Document,
    loadingBoxEl: Element | null,
    loadingIndicatorEl: Element,
    visible: boolean,
  ): void {
    if (!loadingBoxEl) {
      this.setElementDisplayStyle(loadingIndicatorEl, visible ? 'flex' : 'none');
      return;
    }
    if (visible) {
      this.showLoadingBox(documentRef, loadingBoxEl, loadingIndicatorEl);
      return;
    }
    this.hideLoadingBox(documentRef, loadingBoxEl, loadingIndicatorEl);
  }

  private syncLoadingIndicatorDetails(
    documentRef: Document,
    loadingIndicatorEl: Element,
    loading: boolean,
    pendingRequests: string[],
    requestProgress: RequestProgress,
  ): void {
    const { details, progress, requests } = this.resolveLoadingIndicatorDetailsNodes(documentRef, loadingIndicatorEl);

    const totalCount = Math.max(requestProgress.started, requestProgress.completed + requestProgress.inProgress);
    const showDetails = loading && (pendingRequests.length > 0 || totalCount > 0);

    this.setElementDisplayStyle(details, showDetails ? 'block' : 'none');
    if (!showDetails) {
      progress.textContent = '';
      requests.textContent = '';
      return;
    }

    progress.textContent = `Completed ${requestProgress.completed} of ${totalCount} • In progress ${requestProgress.inProgress}`;
    requests.textContent = '';
    pendingRequests.forEach((requestLabel) => {
      const requestItem = documentRef.createElement('li');
      requestItem.className = 'cw-loading__request';
      requestItem.textContent = requestLabel;
      this.appendChildElement(requests, requestItem);
    });

    this.setElementDisplayStyle(requests, pendingRequests.length ? 'grid' : 'none');
  }

  sync(options: CuratedPanelLoadingIndicatorSyncOptions): void {
    const {
      documentRef,
      loadingIndicatorEl,
      loading,
      loadingBoxEl,
      gridEl,
      firstLoadInFlight,
      pendingRequests,
      requestProgress,
    } = options;

    this.syncLoadingIndicatorDetails(documentRef, loadingIndicatorEl, loading, pendingRequests, requestProgress);
    const resolvedLoadingBox = this.resolveLoadingBoxElement(loadingIndicatorEl, loadingBoxEl);
    this.clearLoadingBoxTopStyle(resolvedLoadingBox);
    this.setLoadingBoxVisibility(documentRef, resolvedLoadingBox, loadingIndicatorEl, firstLoadInFlight);
    this.syncGridContainerVisibility(documentRef, gridEl || null, !firstLoadInFlight);
  }
}

export function createCuratedPanelLoadingIndicatorRuntime(): CuratedPanelLoadingIndicatorRuntime {
  const controller = new CuratedPanelLoadingIndicatorController();
  return {
    syncLoadingIndicator: (options: CuratedPanelLoadingIndicatorSyncOptions) => {
      controller.sync(options);
    },
  };
}
