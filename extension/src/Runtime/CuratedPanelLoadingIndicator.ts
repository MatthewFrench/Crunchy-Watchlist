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
    style.display = displayValue;
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
    this.setLoadingBoxVisibility(this.resolveLoadingBoxElement(loadingIndicatorEl, loadingBoxEl), firstLoadInFlight);
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
