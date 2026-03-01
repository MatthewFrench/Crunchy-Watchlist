import { getElementDataAttribute, setElementDataAttribute, toggleClassNameToken } from './CuratedPanelGridDom.js';
import {
  type CuratedGridEntry,
  type CuratedGridRenderContext,
  type CuratedPanelGridRenderPhasesRuntime,
  type CuratedPanelGridTransitionsRuntime,
  renderCuratedGridPass,
  shouldSkipCuratedGridRenderPass,
} from './CuratedPanelGridRenderPass.js';
import { createCuratedPanelGridRenderPhasesRuntime as createCuratedPanelGridRenderPhasesRuntimeFactory } from './CuratedPanelGridRenderPhases.js';
import { createCuratedPanelGridSignatureRuntime as createCuratedPanelGridSignatureRuntimeFactory } from './CuratedPanelGridSignature.js';
import { createCuratedPanelGridTransitionsRuntime as createCuratedPanelGridTransitionsRuntimeFactory } from './CuratedPanelGridTransitions.js';

type CuratedBoundaryValue = CwBoundaryValue;
type CuratedBoundaryRecord = Record<string, CuratedBoundaryValue>;
type CuratedCardFactory = (entry: CuratedGridEntry) => Element;
type CuratedCardPatchFn = (card: Element, entry: CuratedGridEntry) => void;

type CuratedPanelGridState = {
  curatedError: CuratedBoundaryValue;
  curatedGridRenderSignature: string;
  gridEl: (Element & { textContent: string | null }) | null;
  settings: CuratedBoundaryRecord;
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
  visible: CuratedGridEntry[];
  total: number;
  loading: boolean;
  metadataLoading: boolean;
  gridRenderSignature: string;
  createCuratedCard: CuratedCardFactory;
  patchCuratedCard?: CuratedCardPatchFn | null;
};

type CuratedPanelGridRuntime = {
  renderCuratedGridIfNeeded: (options: CuratedPanelGridRenderOptions) => void;
  dispose: () => void;
};

type CuratedPanelGridSignatureRuntime = {
  normalizeCardLayout: (value: CuratedBoundaryValue) => CuratedCardLayout;
  buildCuratedCardContentSignature: (entry: CuratedGridEntry, cardLayout: CuratedBoundaryValue) => string;
  parseCardLayoutFromContentSignature: (signature: string) => CuratedCardLayout | null;
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

const maxParkedCardCount = 180;
const maxParkedCardAgeMs = 5 * 60_000;
let cachedSignatureRuntime: CuratedPanelGridSignatureRuntime | null = null;

function toNonNegativeInt(value: CuratedBoundaryValue): number {
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

function requireFunction<T>(name: string, value: CuratedBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing curated panel grid dependency: ${name}`);
  }

  return value as T;
}

function resolveCuratedPanelGridTransitionsRuntime(): CuratedPanelGridTransitionsRuntime {
  const runtime = createCuratedPanelGridTransitionsRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated panel grid dependency: runtimeCuratedPanelGridTransitions.runtime');
  }

  return {
    reorderCuratedGridChildren: requireFunction(
      'runtimeCuratedPanelGridTransitions.reorderCuratedGridChildren',
      (runtime as CuratedBoundaryRecord).reorderCuratedGridChildren,
    ),
  };
}

function resolveCuratedPanelGridSignatureRuntime(): CuratedPanelGridSignatureRuntime {
  const runtime = createCuratedPanelGridSignatureRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated panel grid dependency: runtimeCuratedPanelGridSignature.runtime');
  }

  return {
    normalizeCardLayout: requireFunction(
      'runtimeCuratedPanelGridSignature.normalizeCardLayout',
      (runtime as CuratedBoundaryRecord).normalizeCardLayout,
    ),
    buildCuratedCardContentSignature: requireFunction(
      'runtimeCuratedPanelGridSignature.buildCuratedCardContentSignature',
      (runtime as CuratedBoundaryRecord).buildCuratedCardContentSignature,
    ),
    parseCardLayoutFromContentSignature: requireFunction(
      'runtimeCuratedPanelGridSignature.parseCardLayoutFromContentSignature',
      (runtime as CuratedBoundaryRecord).parseCardLayoutFromContentSignature,
    ),
  };
}

function resolveCuratedPanelGridRenderPhasesRuntime(): CuratedPanelGridRenderPhasesRuntime {
  const runtime = createCuratedPanelGridRenderPhasesRuntimeFactory();
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('[CW] Missing curated panel grid dependency: runtimeCuratedPanelGridRenderPhases.runtime');
  }

  return {
    shouldSkipCuratedGridRender: requireFunction(
      'runtimeCuratedPanelGridRenderPhases.shouldSkipCuratedGridRender',
      (runtime as CuratedBoundaryRecord).shouldSkipCuratedGridRender,
    ),
    renderEmptyCuratedGridState: requireFunction(
      'runtimeCuratedPanelGridRenderPhases.renderEmptyCuratedGridState',
      (runtime as CuratedBoundaryRecord).renderEmptyCuratedGridState,
    ),
    renderVisibleCuratedGridState: requireFunction(
      'runtimeCuratedPanelGridRenderPhases.renderVisibleCuratedGridState',
      (runtime as CuratedBoundaryRecord).renderVisibleCuratedGridState,
    ),
  };
}

function getCuratedPanelGridSignatureRuntime(): CuratedPanelGridSignatureRuntime {
  if (cachedSignatureRuntime) {
    return cachedSignatureRuntime;
  }

  cachedSignatureRuntime = resolveCuratedPanelGridSignatureRuntime();
  return cachedSignatureRuntime;
}

function getEntrySeriesId(entry: CuratedGridEntry): string {
  const value = entry.seriesId;
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value == null) {
    return '';
  }
  return String(value).trim();
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

function isFiniteNumber(value: CuratedBoundaryValue): boolean {
  return Number.isFinite(Number(value));
}

function hasPositivePlaybackValue(value: CuratedBoundaryValue): boolean {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function hasRenderableWatchHistoryData(entry: CuratedGridEntry): boolean {
  if (entry.neverWatched) {
    return true;
  }

  if (isFiniteNumber(entry.lastWatchedMs) && Number(entry.lastWatchedMs) > 0) {
    return true;
  }

  const progressEntry =
    entry.watchHistoryProgressEntry && typeof entry.watchHistoryProgressEntry === 'object'
      ? (entry.watchHistoryProgressEntry as CuratedBoundaryRecord)
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

function isRenderableEntryMetadataLoading(entry: CuratedGridEntry): boolean {
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

function createOrReuseCuratedCard(
  state: CuratedPanelGridState,
  runtimeState: CuratedPanelGridRuntimeState,
  createCuratedCard: CuratedCardFactory,
  patchCuratedCard: CuratedCardPatchFn | null | undefined,
  usedSeriesIds: Set<string>,
  entry: CuratedGridEntry,
  detailsLoading: boolean,
): Element {
  const seriesId = getEntrySeriesId(entry);
  const signatureRuntime = getCuratedPanelGridSignatureRuntime();
  const normalizedCardLayout = signatureRuntime.normalizeCardLayout(state.settings.cardLayout);
  const contentSignature = signatureRuntime.buildCuratedCardContentSignature(entry, normalizedCardLayout);

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
  const previousDetailsLoading =
    getElementDataAttribute(controller.card, 'cwLoadingDetails', 'data-cw-loading-details') === 'true';
  const detailsLoadingResolved = previousDetailsLoading && !detailsLoading;
  // Preserve existing nodes while metadata is still enriching so skeleton shimmers don't reset.
  const canDeferContentRefresh =
    detailsLoading && Boolean(previousSignature) && controller.cardLayout === normalizedCardLayout;

  const shouldPatchForContent = !hasMatchingSignature && !canDeferContentRefresh;
  // Patch in place only; do not replace existing card nodes on content churn.
  if (shouldPatchForContent && typeof patchCuratedCard === 'function') {
    patchCuratedCard(controller.card, entry);
    incrementCuratedDomLifecycleCounter(state, 'patched');
    controller.contentSignature = contentSignature;
    controller.cardLayout = normalizedCardLayout;
  } else if (detailsLoadingResolved && typeof patchCuratedCard === 'function') {
    patchCuratedCard(controller.card, entry);
    incrementCuratedDomLifecycleCounter(state, 'patched');
  }

  if (controller.parkedAt != null) {
    removeSeriesIdFromParkedOrder(runtimeState, seriesId);
    controller.parkedAt = null;
    incrementCuratedDomLifecycleCounter(state, 'unparked');
  }

  annotateCuratedCardElement(controller.card, seriesId, controller.contentSignature, detailsLoading);
  return controller.card;
}

function isCuratedCardElement(value: CuratedBoundaryValue): value is Element {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return Boolean(getControllerSeriesIdForCard(value as Element));
}

function isCuratedGridEmptyElement(value: CuratedBoundaryValue): boolean {
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
  const cardLayout =
    getCuratedPanelGridSignatureRuntime().parseCardLayoutFromContentSignature(contentSignature) || 'portrait';
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
  renderPhasesRuntime: CuratedPanelGridRenderPhasesRuntime,
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

  const renderContext: CuratedGridRenderContext = {
    stateRenderSignature: state.curatedGridRenderSignature,
    gridRenderSignature,
    documentRef,
    visible,
    total,
    loading,
    metadataLoading,
    gridEl: state.gridEl,
    transitionsRuntime,
    renderPhasesRuntime,
    isCuratedCardElement,
    getEntrySeriesId,
    getElementDataAttribute,
    isCuratedGridEmptyElement,
    isRenderableEntryMetadataLoading,
    setCardParkedState,
    parkGridCardsForReuse: (gridElement: Element) => {
      parkGridCardsForReuse(state, runtimeState, documentRef, gridElement);
    },
    parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>) => {
      parkUnusedControllersForReuse(state, runtimeState, documentRef, visibleSeriesIds);
    },
    createCuratedGridEmptyElement: (nextDocumentRef: Document, nextTotal: number) =>
      createCuratedGridEmptyElement(nextDocumentRef, state, nextTotal),
    trimParkedCardsForReuse: () => {
      trimParkedCardsForReuse(state, runtimeState);
    },
    createOrReuseCuratedCard: (entry: CuratedGridEntry, detailsLoading: boolean, visibleSeriesIds: Set<string>) =>
      createOrReuseCuratedCard(
        state,
        runtimeState,
        createCuratedCard,
        patchCuratedCard ?? null,
        visibleSeriesIds,
        entry,
        detailsLoading,
      ),
    markCardControllerActive: (seriesId: string) => {
      markCardControllerActive(state, runtimeState, seriesId);
    },
    parkCardForReuse: (card: Element) => {
      parkCardForReuse(state, runtimeState, documentRef, card);
    },
  };

  if (shouldSkipCuratedGridRenderPass(renderContext)) {
    return;
  }

  incrementCuratedDomLifecycleCounter(state, 'renderPasses');

  renderCuratedGridPass(renderContext);

  state.curatedGridRenderSignature = gridRenderSignature;
}

class CuratedPanelGridOwner implements CuratedPanelGridRuntime {
  private readonly transitionsRuntime: CuratedPanelGridTransitionsRuntime;
  private readonly renderPhasesRuntime: CuratedPanelGridRenderPhasesRuntime;
  private readonly runtimeState: CuratedPanelGridRuntimeState;
  private disposed = false;

  constructor() {
    this.transitionsRuntime = resolveCuratedPanelGridTransitionsRuntime();
    this.renderPhasesRuntime = resolveCuratedPanelGridRenderPhasesRuntime();
    cachedSignatureRuntime = resolveCuratedPanelGridSignatureRuntime();
    this.runtimeState = {
      cardControllersBySeriesId: new Map<string, CuratedCardController>(),
      parkedCardSeriesOrder: [],
      parkedCardContainer: null,
    };
  }

  readonly renderCuratedGridIfNeeded = (options: CuratedPanelGridRenderOptions): void => {
    if (this.disposed) {
      return;
    }
    renderCuratedGridIfNeeded(options, this.transitionsRuntime, this.renderPhasesRuntime, this.runtimeState);
  };

  readonly dispose = (): void => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    this.runtimeState.cardControllersBySeriesId.forEach((controller) => {
      const removable = controller.card as Element & { isConnected?: boolean; remove?: () => void };
      if (removable.isConnected && typeof removable.remove === 'function') {
        removable.remove();
      }
    });
    this.runtimeState.cardControllersBySeriesId.clear();
    this.runtimeState.parkedCardSeriesOrder = [];
    this.runtimeState.parkedCardContainer = null;
  };
}

export function createCuratedPanelGridRuntime(): CuratedPanelGridRuntime {
  return new CuratedPanelGridOwner();
}
