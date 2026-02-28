(() => {
  type CuratedPanelGridState = {
    curatedError: unknown;
    curatedGridRenderSignature: string;
    gridEl: (Element & { textContent: string | null }) | null;
    settings: Record<string, unknown>;
    curatedDomLifecycleCounters?: CuratedDomLifecycleCounters;
  };

  type CuratedDomLifecycleCounters = {
    created: number;
    patched: number;
    parked: number;
    unparked: number;
    disposed: number;
    renderPasses: number;
  };

  type CuratedPanelGridRenderOptions = {
    state: CuratedPanelGridState;
    documentRef: Document;
    visible: Array<Record<string, unknown>>;
    total: number;
    loading: boolean;
    metadataLoading: boolean;
    gridRenderSignature: string;
    createCuratedCard: (entry: Record<string, unknown>) => Element;
    patchCuratedCard?: ((card: Element, entry: Record<string, unknown>) => void) | null;
  };

  type CuratedPanelGridRuntime = {
    renderCuratedGridIfNeeded: (options: CuratedPanelGridRenderOptions) => void;
  };

  type CuratedGridReorderOptions = {
    onCardRemoved?: ((card: Element) => void) | null;
  };

  type CuratedPanelGridTransitionsRuntime = {
    reorderCuratedGridChildren: (
      gridElement: Element,
      nextCards: Element[],
      options?: CuratedGridReorderOptions,
    ) => void;
  };

  type CuratedCardLayout = 'portrait' | 'landscape';

  type CuratedCardController = {
    seriesId: string;
    card: Element;
    contentSignature: string;
    cardLayout: CuratedCardLayout;
    parkedAt: number | null;
  };

  type CuratedPanelGridRuntimeState = {
    cardControllersBySeriesId: Map<string, CuratedCardController>;
    parkedCardSeriesOrder: string[];
    parkedCardContainer: (DocumentFragment | Element) | null;
  };

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;
  const maxParkedCardCount = 180;
  const maxParkedCardAgeMs = 5 * 60_000;

  function toNonNegativeInt(value: unknown): number {
    const normalizedValue = Number(value);
    if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
      return 0;
    }
    return Math.round(normalizedValue);
  }

  function resolveCuratedDomLifecycleCounters(state: CuratedPanelGridState): CuratedDomLifecycleCounters {
    const existingCounters =
      state.curatedDomLifecycleCounters && typeof state.curatedDomLifecycleCounters === 'object'
        ? state.curatedDomLifecycleCounters
        : null;
    if (existingCounters) {
      const normalizedExistingCounters: CuratedDomLifecycleCounters = {
        created: toNonNegativeInt(existingCounters.created),
        patched: toNonNegativeInt(existingCounters.patched),
        parked: toNonNegativeInt(existingCounters.parked),
        unparked: toNonNegativeInt(existingCounters.unparked),
        disposed: toNonNegativeInt(existingCounters.disposed),
        renderPasses: toNonNegativeInt(existingCounters.renderPasses),
      };
      state.curatedDomLifecycleCounters = normalizedExistingCounters;
      return normalizedExistingCounters;
    }

    const nextCounters: CuratedDomLifecycleCounters = {
      created: 0,
      patched: 0,
      parked: 0,
      unparked: 0,
      disposed: 0,
      renderPasses: 0,
    };
    state.curatedDomLifecycleCounters = nextCounters;
    return nextCounters;
  }

  function incrementCuratedDomLifecycleCounter(
    state: CuratedPanelGridState,
    key: keyof CuratedDomLifecycleCounters,
    amount = 1,
  ): void {
    const counters = resolveCuratedDomLifecycleCounters(state);
    counters[key] = Math.max(0, counters[key] + Math.max(0, Math.round(amount)));
  }

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing curated panel grid dependency: ${name}`);
    }

    return value as T;
  }

  function requireRuntimeFactory<T>(moduleName: string, factoryName: string): () => T {
    const moduleValue = moduleRegistry[moduleName];
    if (!moduleValue || typeof moduleValue !== 'object') {
      throw new Error(`[CW] Missing curated panel grid dependency: ${moduleName}`);
    }

    const factory = (moduleValue as Record<string, unknown>)[factoryName];
    if (typeof factory !== 'function') {
      throw new Error(`[CW] Missing curated panel grid dependency: ${moduleName}.${factoryName}`);
    }

    return factory as () => T;
  }

  function resolveCuratedPanelGridTransitionsRuntime(): CuratedPanelGridTransitionsRuntime {
    const createRuntime = requireRuntimeFactory<unknown>(
      'runtimeCuratedPanelGridTransitions',
      'createCuratedPanelGridTransitionsRuntime',
    );
    const runtime = createRuntime();
    if (!runtime || typeof runtime !== 'object') {
      throw new Error('[CW] Missing curated panel grid dependency: runtimeCuratedPanelGridTransitions.runtime');
    }

    return {
      reorderCuratedGridChildren: requireFunction(
        'runtimeCuratedPanelGridTransitions.reorderCuratedGridChildren',
        (runtime as Record<string, unknown>).reorderCuratedGridChildren,
      ),
    };
  }

  function getEntrySeriesId(entry: Record<string, unknown>): string {
    const value = entry.seriesId;
    if (typeof value === 'string') {
      return value.trim();
    }
    if (value == null) {
      return '';
    }
    return String(value).trim();
  }

  function normalizeCardLayout(value: unknown): CuratedCardLayout {
    return value === 'landscape' ? 'landscape' : 'portrait';
  }

  function buildCuratedCardContentSignature(entry: Record<string, unknown>, cardLayout: unknown): string {
    try {
      return (
        JSON.stringify({
          cardLayout: cardLayout === 'landscape' ? 'landscape' : 'portrait',
          entry,
        }) || ''
      );
    } catch {
      return '';
    }
  }

  function getElementDataAttribute(element: Element, datasetKey: string, attributeName: string): string {
    const datasetValue = (element as Element & { dataset?: Record<string, unknown> }).dataset?.[datasetKey];
    if (typeof datasetValue === 'string') {
      return datasetValue;
    }
    if (typeof element.getAttribute !== 'function') {
      return '';
    }
    return element.getAttribute(attributeName) || '';
  }

  function setElementDataAttribute(element: Element, datasetKey: string, attributeName: string, value: string): void {
    const dataset = (element as Element & { dataset?: Record<string, unknown> }).dataset;
    if (dataset && typeof dataset === 'object') {
      dataset[datasetKey] = value;
      return;
    }
    if (typeof element.setAttribute === 'function') {
      element.setAttribute(attributeName, value);
    }
  }

  function toggleClassNameToken(className: string, token: string, enabled: boolean): string {
    const classTokens = className
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean);
    const hasToken = classTokens.includes(token);
    if (enabled && !hasToken) {
      classTokens.push(token);
    }
    if (!enabled && hasToken) {
      return classTokens.filter((item) => item !== token).join(' ');
    }
    return classTokens.join(' ');
  }

  function annotateCuratedCardElement(
    card: Element,
    seriesId: string,
    contentSignature: string,
    detailsLoading: boolean,
  ): void {
    setElementDataAttribute(card, 'cwSeriesId', 'data-cw-series-id', seriesId);
    setElementDataAttribute(card, 'cwCardContentSignature', 'data-cw-card-content-signature', contentSignature);
    setElementDataAttribute(card, 'cwLoadingDetails', 'data-cw-loading-details', detailsLoading ? 'true' : 'false');
  }

  function isFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
  }

  function hasPositivePlaybackValue(value: unknown): boolean {
    const number = Number(value);
    return Number.isFinite(number) && number > 0;
  }

  function hasRenderableWatchHistoryData(entry: Record<string, unknown>): boolean {
    if (entry.neverWatched) {
      return true;
    }

    if (isFiniteNumber(entry.lastWatchedMs) && Number(entry.lastWatchedMs) > 0) {
      return true;
    }

    const progressEntry =
      entry.watchHistoryProgressEntry && typeof entry.watchHistoryProgressEntry === 'object'
        ? (entry.watchHistoryProgressEntry as Record<string, unknown>)
        : null;
    if (!progressEntry) {
      return false;
    }

    if (progressEntry.fullyWatched) {
      return true;
    }

    return (
      hasPositivePlaybackValue(progressEntry.playhead) ||
      hasPositivePlaybackValue(progressEntry.playheadMs) ||
      hasPositivePlaybackValue(progressEntry.progressMs)
    );
  }

  function isRenderableEntryMetadataLoading(entry: Record<string, unknown>): boolean {
    const ratingMissing = !isFiniteNumber(entry.rating);
    const votesMissing = !isFiniteNumber(entry.votes);
    const distributionMissing = !entry.distribution || typeof entry.distribution !== 'object';
    if (ratingMissing || votesMissing || distributionMissing) {
      return true;
    }

    if (!hasRenderableWatchHistoryData(entry)) {
      return true;
    }

    return false;
  }

  function parseCardLayoutFromContentSignature(signature: string): CuratedCardLayout | null {
    if (!signature) {
      return null;
    }
    try {
      const parsed = JSON.parse(signature) as { cardLayout?: unknown };
      if (parsed.cardLayout === 'landscape') {
        return 'landscape';
      }
      if (parsed.cardLayout === 'portrait') {
        return 'portrait';
      }
      return null;
    } catch {
      return null;
    }
  }

  function createOrReuseCuratedCard(
    state: CuratedPanelGridState,
    runtimeState: CuratedPanelGridRuntimeState,
    createCuratedCard: (entry: Record<string, unknown>) => Element,
    patchCuratedCard: ((card: Element, entry: Record<string, unknown>) => void) | null | undefined,
    usedSeriesIds: Set<string>,
    entry: Record<string, unknown>,
    detailsLoading: boolean,
  ): Element {
    const seriesId = getEntrySeriesId(entry);
    const normalizedCardLayout = normalizeCardLayout(state.settings.cardLayout);
    const contentSignature = buildCuratedCardContentSignature(entry, normalizedCardLayout);

    if (!seriesId || usedSeriesIds.has(seriesId)) {
      const nextCard = createCuratedCard(entry);
      incrementCuratedDomLifecycleCounter(state, 'created');
      annotateCuratedCardElement(nextCard, seriesId, contentSignature, detailsLoading);
      return nextCard;
    }

    usedSeriesIds.add(seriesId);
    let controller = runtimeState.cardControllersBySeriesId.get(seriesId) || null;
    if (!controller) {
      const nextCard = createCuratedCard(entry);
      incrementCuratedDomLifecycleCounter(state, 'created');
      controller = {
        seriesId,
        card: nextCard,
        contentSignature,
        cardLayout: normalizedCardLayout,
        parkedAt: null,
      };
      runtimeState.cardControllersBySeriesId.set(seriesId, controller);
      annotateCuratedCardElement(nextCard, seriesId, contentSignature, detailsLoading);
      return nextCard;
    }

    const previousSignature = controller.contentSignature;
    const hasMatchingSignature = previousSignature === contentSignature;
    // Preserve existing nodes while metadata is still enriching so skeleton shimmers don't reset.
    const canDeferContentRefresh =
      detailsLoading && Boolean(previousSignature) && controller.cardLayout === normalizedCardLayout;

    if (!hasMatchingSignature && !canDeferContentRefresh) {
      if (typeof patchCuratedCard === 'function') {
        patchCuratedCard(controller.card, entry);
        incrementCuratedDomLifecycleCounter(state, 'patched');
      } else {
        const replacementCard = createCuratedCard(entry);
        removeCardFromParentNode(controller.card);
        controller.card = replacementCard;
        incrementCuratedDomLifecycleCounter(state, 'created');
        incrementCuratedDomLifecycleCounter(state, 'disposed');
      }
      controller.contentSignature = contentSignature;
      controller.cardLayout = normalizedCardLayout;
    }

    if (controller.parkedAt != null) {
      removeSeriesIdFromParkedOrder(runtimeState, seriesId);
      controller.parkedAt = null;
      incrementCuratedDomLifecycleCounter(state, 'unparked');
    }

    annotateCuratedCardElement(
      controller.card,
      seriesId,
      hasMatchingSignature || !canDeferContentRefresh ? contentSignature : previousSignature,
      detailsLoading,
    );
    return controller.card;
  }

  function isCuratedCardElement(value: unknown): value is Element {
    if (!value || typeof value !== 'object') {
      return false;
    }
    return Boolean(getControllerSeriesIdForCard(value as Element));
  }

  function isCuratedGridEmptyElement(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }
    return getElementDataAttribute(value as Element, 'cwGridEmpty', 'data-cw-grid-empty') === 'true';
  }

  function setCardParkedState(card: Element, parked: boolean): void {
    const cardElement = card as Element & { className?: string };
    const currentClassName = cardElement.className || '';
    const nextWithParked = toggleClassNameToken(currentClassName, 'cw-curated-card--parked', parked);
    cardElement.className = parked
      ? toggleClassNameToken(nextWithParked, 'cw-curated-card--entering', false)
      : nextWithParked;
  }

  function removeSeriesIdFromParkedOrder(runtimeState: CuratedPanelGridRuntimeState, seriesId: string): void {
    const index = runtimeState.parkedCardSeriesOrder.indexOf(seriesId);
    if (index >= 0) {
      runtimeState.parkedCardSeriesOrder.splice(index, 1);
    }
  }

  function ensureParkedCardContainer(
    runtimeState: CuratedPanelGridRuntimeState,
    documentRef: Document,
  ): DocumentFragment | Element {
    if (runtimeState.parkedCardContainer) {
      return runtimeState.parkedCardContainer;
    }

    if (typeof documentRef.createDocumentFragment === 'function') {
      runtimeState.parkedCardContainer = documentRef.createDocumentFragment();
      return runtimeState.parkedCardContainer;
    }

    const fallback = documentRef.createElement('div');
    (fallback as HTMLElement).style.display = 'none';
    runtimeState.parkedCardContainer = fallback;
    return fallback;
  }

  function removeCardFromParentNode(card: Element): void {
    const parentNode = (card as Element & { parentNode?: Element | DocumentFragment | null }).parentNode;
    if (!parentNode || typeof parentNode.removeChild !== 'function') {
      return;
    }
    parentNode.removeChild(card);
  }

  function getControllerSeriesIdForCard(card: Element): string {
    return getElementDataAttribute(card, 'cwSeriesId', 'data-cw-series-id');
  }

  function getControllerForSeriesId(
    runtimeState: CuratedPanelGridRuntimeState,
    seriesId: string,
  ): CuratedCardController | null {
    if (!seriesId) {
      return null;
    }
    return runtimeState.cardControllersBySeriesId.get(seriesId) || null;
  }

  function createControllerFromCard(seriesId: string, card: Element): CuratedCardController {
    const contentSignature = getElementDataAttribute(card, 'cwCardContentSignature', 'data-cw-card-content-signature');
    const cardLayout = parseCardLayoutFromContentSignature(contentSignature) || 'portrait';
    return {
      seriesId,
      card,
      contentSignature,
      cardLayout,
      parkedAt: null,
    };
  }

  function getParkedControllerCount(runtimeState: CuratedPanelGridRuntimeState): number {
    let parkedCount = 0;
    runtimeState.cardControllersBySeriesId.forEach((controller) => {
      if (controller.parkedAt != null) {
        parkedCount += 1;
      }
    });
    return parkedCount;
  }

  function disposeCardController(
    state: CuratedPanelGridState,
    runtimeState: CuratedPanelGridRuntimeState,
    seriesId: string,
    controller: CuratedCardController,
  ): void {
    runtimeState.cardControllersBySeriesId.delete(seriesId);
    removeSeriesIdFromParkedOrder(runtimeState, seriesId);
    removeCardFromParentNode(controller.card);
    controller.parkedAt = null;
    incrementCuratedDomLifecycleCounter(state, 'disposed');
  }

  function trimParkedCardsForReuse(
    state: CuratedPanelGridState,
    runtimeState: CuratedPanelGridRuntimeState,
    now = Date.now(),
  ): void {
    // Reclaim stale parked nodes so detached card state does not grow unbounded.
    runtimeState.parkedCardSeriesOrder.slice().forEach((seriesId) => {
      const controller = runtimeState.cardControllersBySeriesId.get(seriesId);
      if (!controller || controller.parkedAt == null) {
        removeSeriesIdFromParkedOrder(runtimeState, seriesId);
        return;
      }
      if (now - controller.parkedAt <= maxParkedCardAgeMs) {
        return;
      }
      disposeCardController(state, runtimeState, seriesId, controller);
    });

    let parkedCount = getParkedControllerCount(runtimeState);
    while (parkedCount > maxParkedCardCount) {
      const oldestSeriesId = runtimeState.parkedCardSeriesOrder[0] || '';
      if (!oldestSeriesId) {
        break;
      }
      const controller = runtimeState.cardControllersBySeriesId.get(oldestSeriesId);
      if (!controller || controller.parkedAt == null) {
        removeSeriesIdFromParkedOrder(runtimeState, oldestSeriesId);
        continue;
      }
      disposeCardController(state, runtimeState, oldestSeriesId, controller);
      parkedCount -= 1;
    }
  }

  function parkControllerForReuse(
    state: CuratedPanelGridState,
    runtimeState: CuratedPanelGridRuntimeState,
    documentRef: Document,
    controller: CuratedCardController,
  ): void {
    if (!isCuratedCardElement(controller.card)) {
      return;
    }
    if (!controller.seriesId) {
      return;
    }
    if (controller.parkedAt != null) {
      return;
    }

    const parkingContainer = ensureParkedCardContainer(runtimeState, documentRef);
    setCardParkedState(controller.card, true);
    parkingContainer.appendChild(controller.card);
    controller.parkedAt = Date.now();
    removeSeriesIdFromParkedOrder(runtimeState, controller.seriesId);
    runtimeState.parkedCardSeriesOrder.push(controller.seriesId);
    incrementCuratedDomLifecycleCounter(state, 'parked');
  }

  function parkCardForReuse(
    state: CuratedPanelGridState,
    runtimeState: CuratedPanelGridRuntimeState,
    documentRef: Document,
    card: Element,
  ): void {
    if (!isCuratedCardElement(card)) {
      return;
    }
    const seriesId = getControllerSeriesIdForCard(card);
    if (!seriesId) {
      return;
    }

    const existingController = getControllerForSeriesId(runtimeState, seriesId);
    const controller =
      existingController && existingController.card === card
        ? existingController
        : createControllerFromCard(seriesId, card);
    if (!existingController) {
      runtimeState.cardControllersBySeriesId.set(seriesId, controller);
    } else if (existingController.card !== card) {
      removeCardFromParentNode(card);
      return;
    }

    parkControllerForReuse(state, runtimeState, documentRef, controller);
  }

  function parkUnusedControllersForReuse(
    state: CuratedPanelGridState,
    runtimeState: CuratedPanelGridRuntimeState,
    documentRef: Document,
    visibleSeriesIds: Set<string>,
  ): void {
    runtimeState.cardControllersBySeriesId.forEach((controller, seriesId) => {
      if (visibleSeriesIds.has(seriesId) || controller.parkedAt != null) {
        return;
      }
      parkControllerForReuse(state, runtimeState, documentRef, controller);
    });
  }

  function markCardControllerActive(
    state: CuratedPanelGridState,
    runtimeState: CuratedPanelGridRuntimeState,
    seriesId: string,
  ): void {
    if (!seriesId) {
      return;
    }
    const controller = runtimeState.cardControllersBySeriesId.get(seriesId);
    if (!controller || controller.parkedAt == null) {
      return;
    }
    controller.parkedAt = null;
    removeSeriesIdFromParkedOrder(runtimeState, seriesId);
    incrementCuratedDomLifecycleCounter(state, 'unparked');
  }

  function parkGridCardsForReuse(
    state: CuratedPanelGridState,
    runtimeState: CuratedPanelGridRuntimeState,
    documentRef: Document,
    gridElement: Element,
  ): void {
    Array.from(gridElement.children).forEach((child) => {
      if (!isCuratedCardElement(child)) {
        return;
      }
      parkCardForReuse(state, runtimeState, documentRef, child);
    });
  }

  function createCuratedGridEmptyElement(documentRef: Document, state: CuratedPanelGridState, total: number): Element {
    const empty = documentRef.createElement('div');
    empty.className = 'cw-empty';
    setElementDataAttribute(empty, 'cwGridEmpty', 'data-cw-grid-empty', 'true');

    if (state.curatedError && total === 0) {
      empty.textContent = String(state.curatedError);
      return empty;
    }

    if (total > 0) {
      empty.textContent = 'No shows match the current filters.';
      return empty;
    }

    empty.textContent = 'No watchlist items were returned by Crunchyroll.';
    return empty;
  }

  function renderCuratedGridIfNeeded(
    options: CuratedPanelGridRenderOptions,
    transitionsRuntime: CuratedPanelGridTransitionsRuntime,
    runtimeState: CuratedPanelGridRuntimeState,
  ): void {
    const {
      state,
      documentRef,
      visible,
      total,
      loading,
      metadataLoading,
      gridRenderSignature,
      createCuratedCard,
      patchCuratedCard,
    } = options;
    if (!state.gridEl) {
      return;
    }

    const gridEl = state.gridEl;
    const canSkipBySignature = state.curatedGridRenderSignature === gridRenderSignature;
    if (canSkipBySignature) {
      const children = Array.from(gridEl.children);
      if (visible.length > 0) {
        const hasExpectedCards =
          children.length === visible.length &&
          children.every((child, index) => {
            if (!isCuratedCardElement(child)) {
              return false;
            }
            const expectedSeriesId = getEntrySeriesId(visible[index] || {});
            if (!expectedSeriesId) {
              return true;
            }
            const renderedSeriesId = getElementDataAttribute(child, 'cwSeriesId', 'data-cw-series-id');
            return renderedSeriesId === expectedSeriesId;
          });
        if (hasExpectedCards) {
          return;
        }
      } else {
        const firstChild = children[0];
        if (loading && total === 0 && children.length === 0) {
          return;
        }
        if (children.length === 1 && isCuratedGridEmptyElement(firstChild)) {
          return;
        }
      }
    }

    incrementCuratedDomLifecycleCounter(state, 'renderPasses');

    if (!visible.length) {
      const visibleSeriesIds = new Set<string>();
      parkGridCardsForReuse(state, runtimeState, documentRef, gridEl);
      parkUnusedControllersForReuse(state, runtimeState, documentRef, visibleSeriesIds);
      gridEl.textContent = '';
      if (!(loading && total === 0)) {
        gridEl.appendChild(createCuratedGridEmptyElement(documentRef, state, total));
      }
      trimParkedCardsForReuse(state, runtimeState);
    } else {
      const visibleSeriesIds = new Set<string>();
      const nextCards = visible.map((entry) => {
        const nextCard = createOrReuseCuratedCard(
          state,
          runtimeState,
          createCuratedCard,
          patchCuratedCard,
          visibleSeriesIds,
          entry,
          metadataLoading && isRenderableEntryMetadataLoading(entry),
        );
        const seriesId = getEntrySeriesId(entry);
        markCardControllerActive(state, runtimeState, seriesId);
        setCardParkedState(nextCard, false);
        return nextCard;
      });
      transitionsRuntime.reorderCuratedGridChildren(gridEl, nextCards, {
        onCardRemoved: (removedCard) => {
          parkCardForReuse(state, runtimeState, documentRef, removedCard);
        },
      });
      parkUnusedControllersForReuse(state, runtimeState, documentRef, visibleSeriesIds);
      trimParkedCardsForReuse(state, runtimeState);
    }

    state.curatedGridRenderSignature = gridRenderSignature;
  }

  function createCuratedPanelGridRuntime(): CuratedPanelGridRuntime {
    const transitionsRuntime = resolveCuratedPanelGridTransitionsRuntime();
    const runtimeState: CuratedPanelGridRuntimeState = {
      cardControllersBySeriesId: new Map<string, CuratedCardController>(),
      parkedCardSeriesOrder: [],
      parkedCardContainer: null,
    };
    return {
      renderCuratedGridIfNeeded: (options) => renderCuratedGridIfNeeded(options, transitionsRuntime, runtimeState),
    };
  }

  moduleRegistry.runtimeCuratedPanelGrid = {
    createCuratedPanelGridRuntime,
  };
})();
