(() => {
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

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;
  const loadingIndicatorDetailsByElement = new WeakMap<Element, LoadingIndicatorDetailsNodes>();

  function appendChildElement(parent: Element, child: Element): void {
    const mutableParent = parent as Element & {
      appendChild?: (child: Element) => unknown;
    };
    mutableParent.appendChild?.(child);
  }

  function setElementDisplayStyle(element: Element, displayValue: string): void {
    const style = (element as Element & { style?: { display?: string } }).style;
    if (!style) {
      return;
    }
    style.display = displayValue;
  }

  function createLoadingIndicatorDetailsNodes(
    documentRef: Document,
    loadingIndicatorEl: Element,
  ): LoadingIndicatorDetailsNodes {
    const details = documentRef.createElement('span');
    details.className = 'cw-loading__details';

    const detailsTitle = documentRef.createElement('span');
    detailsTitle.className = 'cw-loading__details-title';
    detailsTitle.textContent = 'Request progress';
    appendChildElement(details, detailsTitle);

    const progress = documentRef.createElement('span');
    progress.className = 'cw-loading__progress';
    appendChildElement(details, progress);

    const requests = documentRef.createElement('ul');
    requests.className = 'cw-loading__requests';
    appendChildElement(details, requests);

    appendChildElement(loadingIndicatorEl, details);

    return {
      details: details as HTMLElement,
      progress: progress as HTMLElement,
      requests: requests as HTMLElement,
    };
  }

  function resolveLoadingIndicatorDetailsNodes(
    documentRef: Document,
    loadingIndicatorEl: Element,
  ): LoadingIndicatorDetailsNodes {
    const existingRefs = loadingIndicatorDetailsByElement.get(loadingIndicatorEl);
    if (existingRefs) {
      return existingRefs;
    }
    const refs = createLoadingIndicatorDetailsNodes(documentRef, loadingIndicatorEl);
    loadingIndicatorDetailsByElement.set(loadingIndicatorEl, refs);
    return refs;
  }

  function resolveLoadingBoxElement(
    loadingIndicatorEl: Element,
    loadingBoxEl: Element | null | undefined,
  ): Element | null {
    if (loadingBoxEl && typeof loadingBoxEl === 'object') {
      return loadingBoxEl;
    }
    const parentNode = (loadingIndicatorEl as LoadingIndicatorElement).parentNode;
    return parentNode && typeof parentNode === 'object' ? parentNode : null;
  }

  function setLoadingBoxVisibility(loadingBoxEl: Element | null, loading: boolean): void {
    if (!loadingBoxEl) {
      return;
    }
    setElementDisplayStyle(loadingBoxEl, loading ? 'block' : 'none');
  }

  function syncLoadingIndicatorDetails(
    documentRef: Document,
    loadingIndicatorEl: Element,
    loading: boolean,
    pendingRequests: string[],
    requestProgress: RequestProgress,
  ): void {
    const { details, progress, requests } = resolveLoadingIndicatorDetailsNodes(documentRef, loadingIndicatorEl);

    const totalCount = Math.max(requestProgress.started, requestProgress.completed + requestProgress.inProgress);
    const showDetails = loading && (pendingRequests.length > 0 || totalCount > 0);

    setElementDisplayStyle(details, showDetails ? 'block' : 'none');
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
      appendChildElement(requests, requestItem);
    });

    setElementDisplayStyle(requests, pendingRequests.length ? 'grid' : 'none');
  }

  function syncLoadingIndicator(options: CuratedPanelLoadingIndicatorSyncOptions): void {
    const {
      documentRef,
      loadingIndicatorEl,
      loading,
      loadingBoxEl,
      firstLoadInFlight,
      pendingRequests,
      requestProgress,
    } = options;
    syncLoadingIndicatorDetails(documentRef, loadingIndicatorEl, loading, pendingRequests, requestProgress);
    setLoadingBoxVisibility(resolveLoadingBoxElement(loadingIndicatorEl, loadingBoxEl), firstLoadInFlight);
    setElementDisplayStyle(loadingIndicatorEl, firstLoadInFlight ? 'flex' : 'none');
  }

  function createCuratedPanelLoadingIndicatorRuntime(): CuratedPanelLoadingIndicatorRuntime {
    return {
      syncLoadingIndicator,
    };
  }

  moduleRegistry.runtimeCuratedPanelLoadingIndicator = {
    createCuratedPanelLoadingIndicatorRuntime,
  };
})();
