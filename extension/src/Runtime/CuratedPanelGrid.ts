import { getElementDataAttribute, setElementDataAttribute, toggleClassNameToken } from './CuratedPanelGridDom.js';
import {
  type CuratedCardLayout,
  type CuratedPanelGridParkingLifecycleHandlers,
  CuratedPanelGridParkingManager,
} from './CuratedPanelGridParkingManager.js';
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

type CuratedGridRenderContextOptions = {
  state: CuratedPanelGridState;
  gridEl: Element;
  documentRef: Document;
  visible: CuratedGridEntry[];
  total: number;
  loading: boolean;
  metadataLoading: boolean;
  gridRenderSignature: string;
  createCuratedCard: CuratedCardFactory;
  patchCuratedCard: CuratedCardPatchFn | null | undefined;
  transitionsRuntime: CuratedPanelGridTransitionsRuntime;
  renderPhasesRuntime: CuratedPanelGridRenderPhasesRuntime;
  parkingManager: CuratedPanelGridParkingManager;
  parkingLifecycleHandlers: CuratedPanelGridParkingLifecycleHandlers;
};

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
  parkingManager: CuratedPanelGridParkingManager,
  parkingLifecycleHandlers: CuratedPanelGridParkingLifecycleHandlers,
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
    setCardClassToken(nextCard, 'cw-curated-card--not-watch-ready', Boolean(entry.dimNotWatchReady));
    annotateCuratedCardElement(nextCard, seriesId, contentSignature, detailsLoading);
    return nextCard;
  }

  usedSeriesIds.add(seriesId);
  let controller = parkingManager.getControllerForSeriesId(seriesId);
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
    parkingManager.setController(controller);
    setCardClassToken(nextCard, 'cw-curated-card--not-watch-ready', Boolean(entry.dimNotWatchReady));
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
    parkingManager.markCardControllerActive(seriesId, parkingLifecycleHandlers);
  }

  setCardClassToken(controller.card, 'cw-curated-card--not-watch-ready', Boolean(entry.dimNotWatchReady));
  annotateCuratedCardElement(controller.card, seriesId, controller.contentSignature, detailsLoading);
  return controller.card;
}

function isCuratedCardElement(value: CuratedBoundaryValue): value is Element {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return Boolean(getElementDataAttribute(value as Element, 'cwSeriesId', 'data-cw-series-id'));
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
  const nextClassName = parked
    ? toggleClassNameToken(nextWithParked, 'cw-curated-card--entering', false)
    : nextWithParked;
  if (nextClassName === currentClassName) {
    return;
  }
  cardElement.className = nextClassName;
}

function setCardClassToken(card: Element, token: string, enabled: boolean): void {
  const cardElement = card as Element & { className?: string };
  const currentClassName = cardElement.className || '';
  const nextClassName = toggleClassNameToken(currentClassName, token, enabled);
  if (nextClassName === currentClassName) {
    return;
  }
  cardElement.className = nextClassName;
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

function createParkingLifecycleHandlers(state: CuratedPanelGridState): CuratedPanelGridParkingLifecycleHandlers {
  return {
    onParked: () => {
      incrementCuratedDomLifecycleCounter(state, 'parked');
    },
    onUnparked: () => {
      incrementCuratedDomLifecycleCounter(state, 'unparked');
    },
    onDisposed: () => {
      incrementCuratedDomLifecycleCounter(state, 'disposed');
    },
  };
}

function createCuratedGridRenderContext(options: CuratedGridRenderContextOptions): CuratedGridRenderContext {
  const {
    state,
    gridEl,
    documentRef,
    visible,
    total,
    loading,
    metadataLoading,
    gridRenderSignature,
    createCuratedCard,
    patchCuratedCard,
    transitionsRuntime,
    renderPhasesRuntime,
    parkingManager,
    parkingLifecycleHandlers,
  } = options;

  return {
    stateRenderSignature: state.curatedGridRenderSignature,
    gridRenderSignature,
    documentRef,
    visible,
    total,
    loading,
    metadataLoading,
    gridEl,
    transitionsRuntime,
    renderPhasesRuntime,
    isCuratedCardElement,
    getEntrySeriesId,
    getElementDataAttribute,
    isCuratedGridEmptyElement,
    isRenderableEntryMetadataLoading,
    setCardParkedState,
    parkGridCardsForReuse: (gridElement: Element) => {
      parkingManager.parkGridCardsForReuse(documentRef, gridElement, parkingLifecycleHandlers);
    },
    parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>) => {
      parkingManager.parkUnusedControllersForReuse(documentRef, visibleSeriesIds, parkingLifecycleHandlers);
    },
    createCuratedGridEmptyElement: (nextDocumentRef: Document, nextTotal: number) =>
      createCuratedGridEmptyElement(nextDocumentRef, state, nextTotal),
    trimParkedCardsForReuse: () => {
      parkingManager.trimParkedCardsForReuse(parkingLifecycleHandlers);
    },
    createOrReuseCuratedCard: (entry: CuratedGridEntry, detailsLoading: boolean, visibleSeriesIds: Set<string>) =>
      createOrReuseCuratedCard(
        state,
        parkingManager,
        parkingLifecycleHandlers,
        createCuratedCard,
        patchCuratedCard ?? null,
        visibleSeriesIds,
        entry,
        detailsLoading,
      ),
    markCardControllerActive: (seriesId: string) => {
      parkingManager.markCardControllerActive(seriesId, parkingLifecycleHandlers);
    },
    parkCardForReuse: (card: Element) => {
      parkingManager.parkCardForReuse(documentRef, card, parkingLifecycleHandlers);
    },
  };
}

function renderCuratedGridIfNeeded(
  options: CuratedPanelGridRenderOptions,
  transitionsRuntime: CuratedPanelGridTransitionsRuntime,
  renderPhasesRuntime: CuratedPanelGridRenderPhasesRuntime,
  parkingManager: CuratedPanelGridParkingManager,
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
  const gridEl = state.gridEl;
  if (!gridEl) {
    return;
  }

  const parkingLifecycleHandlers = createParkingLifecycleHandlers(state);
  const renderContext = createCuratedGridRenderContext({
    state,
    gridEl,
    documentRef,
    visible,
    total,
    loading,
    metadataLoading,
    gridRenderSignature,
    createCuratedCard,
    patchCuratedCard,
    transitionsRuntime,
    renderPhasesRuntime,
    parkingManager,
    parkingLifecycleHandlers,
  });

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
  private readonly parkingManager: CuratedPanelGridParkingManager;
  private disposed = false;

  constructor() {
    this.transitionsRuntime = resolveCuratedPanelGridTransitionsRuntime();
    this.renderPhasesRuntime = resolveCuratedPanelGridRenderPhasesRuntime();
    const signatureRuntime = resolveCuratedPanelGridSignatureRuntime();
    cachedSignatureRuntime = signatureRuntime;
    this.parkingManager = new CuratedPanelGridParkingManager({
      isCuratedCardElement,
      getElementDataAttribute,
      parseCardLayoutFromContentSignature: signatureRuntime.parseCardLayoutFromContentSignature,
      setCardParkedState,
    });
  }

  readonly renderCuratedGridIfNeeded = (options: CuratedPanelGridRenderOptions): void => {
    if (this.disposed) {
      return;
    }
    renderCuratedGridIfNeeded(options, this.transitionsRuntime, this.renderPhasesRuntime, this.parkingManager);
  };

  readonly dispose = (): void => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.parkingManager.dispose();
  };
}

export function createCuratedPanelGridRuntime(): CuratedPanelGridRuntime {
  return new CuratedPanelGridOwner();
}
