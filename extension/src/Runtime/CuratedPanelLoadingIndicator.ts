type RequestProgress = {
  started: number;
  completed: number;
  inProgress: number;
};

type CuratedPanelLoadingIndicatorSyncOptions = {
  documentRef: Document;
  loadingIndicatorEl: Element;
  loadingBoxEl?: Element | null;
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
  parentElement?: Element | null;
  children?: ArrayLike<Element>;
  offsetTop?: number;
  offsetHeight?: number;
};

class CuratedPanelLoadingIndicatorController {
  private readonly loadingIndicatorDetailsByElement = new WeakMap<Element, LoadingIndicatorDetailsNodes>();

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

  private setElementTopStyle(element: Element, topValue: string): void {
    const style = (element as Element & { style?: { top?: string } }).style;
    if (!style) {
      return;
    }
    if (style.top === topValue) {
      return;
    }
    style.top = topValue;
  }

  private getLoadingBoxTopOffsetPx(loadingBoxEl: Element): number {
    const panelElement = (loadingBoxEl as PositionableElement).parentElement;
    if (!panelElement) {
      return 0;
    }

    const panelChildren = panelElement.children;
    if (!panelChildren || panelChildren.length === 0) {
      return 0;
    }

    const firstChild = panelChildren[0] as PositionableElement | null;
    if (!firstChild || firstChild === loadingBoxEl) {
      return 0;
    }

    const controlsTop = Number(firstChild.offsetTop) || 0;
    const controlsHeight = Number(firstChild.offsetHeight) || 0;
    return Math.max(0, Math.round(controlsTop + controlsHeight + 8));
  }

  private syncLoadingBoxOverlayOffset(loadingBoxEl: Element | null): void {
    if (!loadingBoxEl) {
      return;
    }
    const topOffsetPx = this.getLoadingBoxTopOffsetPx(loadingBoxEl);
    this.setElementTopStyle(loadingBoxEl, `${topOffsetPx}px`);
  }

  private createLoadingIndicatorDetailsNodes(
    documentRef: Document,
    loadingIndicatorEl: Element,
  ): LoadingIndicatorDetailsNodes {
    const details = documentRef.createElement('span');
    details.className = 'cw-loading__details';

    const detailsTitle = documentRef.createElement('span');
    detailsTitle.className = 'cw-loading__details-title';
    detailsTitle.textContent = 'Request progress';
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

  private setLoadingBoxVisibility(loadingBoxEl: Element | null, loading: boolean): void {
    if (!loadingBoxEl) {
      return;
    }
    this.setElementDisplayStyle(loadingBoxEl, loading ? 'block' : 'none');
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
      firstLoadInFlight,
      pendingRequests,
      requestProgress,
    } = options;

    this.syncLoadingIndicatorDetails(documentRef, loadingIndicatorEl, loading, pendingRequests, requestProgress);
    const resolvedLoadingBox = this.resolveLoadingBoxElement(loadingIndicatorEl, loadingBoxEl);
    this.syncLoadingBoxOverlayOffset(resolvedLoadingBox);
    this.setLoadingBoxVisibility(resolvedLoadingBox, firstLoadInFlight);
    this.setElementDisplayStyle(loadingIndicatorEl, firstLoadInFlight ? 'flex' : 'none');
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
