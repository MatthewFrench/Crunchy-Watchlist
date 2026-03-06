import {
  applyUniformCardHeight,
  resolveCompactUniformCardHeightPx,
  roundCardHeightPx,
} from './CuratedPanelGridAbsoluteHeight.js';
import { toggleClassNameToken } from './CuratedPanelGridDom.js';
import {
  clearCuratedGridDomState,
  readCuratedGridActiveCards,
  writeCuratedGridActiveCards,
} from './CuratedPanelGridDomState.js';
import {
  prepareCuratedGridHeightMeasurements,
  resolveCuratedGridCardHeights,
} from './CuratedPanelGridHeightMeasurement.js';
import { buildCuratedGridLayoutSignature } from './CuratedPanelGridLayoutSignature.js';
import {
  animateCuratedGridOverflowRemovals,
  finalizeCuratedGridOverflow,
  hasIdenticalCuratedGridChildOrder,
  isCuratedGridOverflowCardLikelyVisible,
  mountCuratedGridNextCards,
  removeCuratedGridOverflowCard,
  resolveCuratedGridOverflowChildren,
  resolveCuratedGridRemovableOverflow,
} from './CuratedPanelGridOverflowSupport.js';
import {
  applyRetainedCardHiddenState,
  cancelRetainedCardHideIfNeeded,
  isParkedCardElement,
  isRetainedCardHiding,
  scheduleRetainedCardHide,
} from './CuratedPanelGridRetainedCardVisibility.js';
import { clearCuratedGridStyleValue, setCuratedGridStyleValue } from './CuratedPanelGridStyleSupport.js';
import { incrementRuntimePerfDiagnostic } from './RuntimePerfDiagnostics.js';

type RectSnapshot = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type TransitionBoundaryValue = LooseRecord[string];
type TrackedElementLike = Element & {
  dataset?: Record<string, string>;
  getAttribute?: (name: string) => string | null;
};

type CuratedGridReorderOptions = {
  onCardRemoved?: ((card: Element) => void) | null;
  shouldRetainCardInGrid?: ((card: Element) => boolean) | null;
};

type CuratedPanelGridTransitionsRuntime = {
  reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[], options?: CuratedGridReorderOptions) => void;
};

const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
const cardFadeDurationMs = 1000;
const cardMoveDurationMs = cardFadeDurationMs;
const retainedCardHideDurationMs = 320;
const absoluteCardMoveDurationMs = 500;
const absoluteGridDefaultGapPx = 12;
const absoluteGridDefaultMinCardWidthPx = 320;
const absoluteGridDefaultMaxCardWidthPx = 420;
const absoluteGridPreferredCardWidthPx = 370;
const absoluteGridFallbackCardHeightPx = 320;
const cardContainerContentHeightCssVariable = '--cw-curated-card-container-height';
const absoluteCardTopLeftTransition = `top ${absoluteCardMoveDurationMs}ms ease-in-out, left ${absoluteCardMoveDurationMs}ms ease-in-out, opacity ${cardFadeDurationMs}ms ease, border-color 180ms ease, background-color 180ms ease`;
const leavingCardTimeoutByElement = new Map<Element, number>();
const absoluteGridLayoutSignatureByElement = new WeakMap<Element, string>();

function isTrackedCardElement(value: TransitionBoundaryValue): value is Element {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const element = value as TrackedElementLike;
  const datasetSeriesId = typeof element.dataset?.cwSeriesId === 'string' ? element.dataset.cwSeriesId : '';
  if (datasetSeriesId) {
    return true;
  }
  if (typeof element.getAttribute === 'function') {
    return Boolean(element.getAttribute('data-cw-series-id') || '');
  }
  return false;
}

function toRectSnapshot(
  value:
    | DOMRect
    | {
        left?: TransitionBoundaryValue;
        top?: TransitionBoundaryValue;
        width?: TransitionBoundaryValue;
        height?: TransitionBoundaryValue;
      },
): RectSnapshot {
  return {
    left: Number(value.left) || 0,
    top: Number(value.top) || 0,
    width: Number(value.width) || 0,
    height: Number(value.height) || 0,
  };
}

function parseNonNegativePixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function getElementRectSnapshot(element: Element): RectSnapshot | null {
  const measurableElement = element as Element & {
    getBoundingClientRect?: () => DOMRect;
  };
  if (typeof measurableElement.getBoundingClientRect !== 'function') {
    return null;
  }

  return toRectSnapshot(measurableElement.getBoundingClientRect());
}

function getElementStyleRecord(value: Element): Record<string, string> | null {
  const elementWithStyle = value as Element & { style?: Record<string, string> };
  return elementWithStyle.style || null;
}

type CustomStyleRecord = Record<string, string> & {
  setProperty?: (propertyName: string, value: string) => void;
};

function setStyleCustomProperty(style: Record<string, string>, propertyName: string, value: string): void {
  if (style[propertyName] === value) {
    return;
  }
  const styleWithSetProperty = style as CustomStyleRecord;
  if (typeof styleWithSetProperty.setProperty === 'function') {
    styleWithSetProperty.setProperty(propertyName, value);
    return;
  }
  style[propertyName] = value;
}

function resolveFallbackCardHeightPx(card: Element, previousHeightPx: number): number {
  if (Number.isFinite(previousHeightPx) && previousHeightPx > 0) {
    return previousHeightPx;
  }

  const scrollHeight = Number((card as Element & { scrollHeight?: number }).scrollHeight) || 0;
  if (scrollHeight > 0) {
    return scrollHeight;
  }

  const offsetHeight = Number((card as Element & { offsetHeight?: number }).offsetHeight) || 0;
  if (offsetHeight > 0) {
    return offsetHeight;
  }

  const clientHeight = Number((card as Element & { clientHeight?: number }).clientHeight) || 0;
  if (clientHeight > 0) {
    return clientHeight;
  }

  const style = getElementStyleRecord(card);
  return style ? parseNonNegativePixelValue(style.height || '') : 0;
}

function hasGridStylesForAbsolutePlacement(value: Element): boolean {
  return Boolean(getElementStyleRecord(value));
}

function hasCardStylesForAbsolutePlacement(value: Element): boolean {
  const card = value as Element & {
    style?: Record<string, string>;
    getBoundingClientRect?: () => DOMRect;
  };
  return Boolean(card.style) && typeof card.getBoundingClientRect === 'function';
}

function resolveGridGapPx(gridElement: Element): number {
  const ownerWindow = (gridElement as Element & { ownerDocument?: Document }).ownerDocument?.defaultView || null;
  if (!ownerWindow || typeof ownerWindow.getComputedStyle !== 'function') {
    return absoluteGridDefaultGapPx;
  }

  const computedStyle = ownerWindow.getComputedStyle(gridElement);
  const columnGap = parseNonNegativePixelValue(computedStyle.columnGap || '');
  if (columnGap > 0) {
    return columnGap;
  }
  const gridGap = parseNonNegativePixelValue(computedStyle.gap || '');
  if (gridGap > 0) {
    return gridGap;
  }
  return absoluteGridDefaultGapPx;
}

function resolveGridWidthPx(gridElement: Element): number {
  const parentElement = (gridElement as Element & { parentElement?: Element | null }).parentElement;
  const parentNode = (gridElement as Element & { parentNode?: object | null }).parentNode;
  const widthContainer =
    parentElement || (parentNode && typeof parentNode === 'object' ? (parentNode as Element) : null);
  if (widthContainer) {
    const parentRect = getElementRectSnapshot(widthContainer);
    if (parentRect && parentRect.width > 0) {
      return parentRect.width;
    }

    const parentClientWidth = Number((widthContainer as Element & { clientWidth?: number }).clientWidth) || 0;
    if (parentClientWidth > 0) {
      return parentClientWidth;
    }
  }

  const gridRect = getElementRectSnapshot(gridElement);
  if (gridRect && gridRect.width > 0) {
    return gridRect.width;
  }

  const clientWidth = Number((gridElement as Element & { clientWidth?: number }).clientWidth) || 0;
  if (clientWidth > 0) {
    return clientWidth;
  }
  return 0;
}

function resetGridAbsoluteHeight(gridElement: Element): void {
  const gridStyle = getElementStyleRecord(gridElement);
  if (!gridStyle) {
    return;
  }
  setStyleCustomProperty(gridStyle, cardContainerContentHeightCssVariable, '0px');
  if (typeof gridStyle.height === 'string' && gridStyle.height) {
    gridStyle.height = '';
  }
}

function resolveAbsoluteGridColumnCount(gridWidthPx: number, gapPx: number): number {
  const minCardWidth = Math.max(1, absoluteGridDefaultMinCardWidthPx);
  const maxCardWidth = Math.max(minCardWidth, absoluteGridDefaultMaxCardWidthPx);
  const preferredCardWidth = Math.max(minCardWidth, Math.min(maxCardWidth, absoluteGridPreferredCardWidthPx));
  const resolveCardWidth = (columns: number): number => {
    const safeColumns = Math.max(1, columns);
    return (gridWidthPx - gapPx * (safeColumns - 1)) / safeColumns;
  };
  const getWidthPenalty = (widthPx: number): number => {
    if (widthPx < minCardWidth) {
      return minCardWidth - widthPx;
    }
    if (widthPx > maxCardWidth) {
      return widthPx - maxCardWidth;
    }
    return 0;
  };

  const minColumns = Math.max(1, Math.ceil((gridWidthPx + gapPx) / (maxCardWidth + gapPx)));
  const maxColumns = Math.max(1, Math.floor((gridWidthPx + gapPx) / (minCardWidth + gapPx)));
  if (minColumns <= maxColumns) {
    const idealColumns = Math.max(1, Math.round((gridWidthPx + gapPx) / (preferredCardWidth + gapPx)));
    return Math.max(minColumns, Math.min(maxColumns, idealColumns));
  }

  const widthAtMinColumns = resolveCardWidth(minColumns);
  const widthAtMaxColumns = resolveCardWidth(maxColumns);
  const minColumnsPenalty = getWidthPenalty(widthAtMinColumns);
  const maxColumnsPenalty = getWidthPenalty(widthAtMaxColumns);
  if (minColumnsPenalty !== maxColumnsPenalty) {
    return minColumnsPenalty < maxColumnsPenalty ? minColumns : maxColumns;
  }
  const minColumnsDistance = Math.abs(widthAtMinColumns - preferredCardWidth);
  const maxColumnsDistance = Math.abs(widthAtMaxColumns - preferredCardWidth);
  return minColumnsDistance <= maxColumnsDistance ? minColumns : maxColumns;
}

function isLeavingCardElement(value: Element): boolean {
  return leavingCardTimeoutByElement.has(value);
}

function getActiveGridChildren(gridElement: Element): Element[] {
  return readCuratedGridActiveCards(gridElement).filter(
    (child) => !isLeavingCardElement(child) && !isRetainedCardHiding(child) && !isParkedCardElement(child),
  );
}

function clearLeavingCardStyles(card: Element): void {
  const styledElement = card as Element & {
    className?: string;
    style?: Record<string, string>;
  };
  const style = styledElement.style;
  if (style) {
    clearCuratedGridStyleValue(style, 'position');
    clearCuratedGridStyleValue(style, 'left');
    clearCuratedGridStyleValue(style, 'top');
    clearCuratedGridStyleValue(style, 'width');
    clearCuratedGridStyleValue(style, 'height');
    clearCuratedGridStyleValue(style, 'margin');
    clearCuratedGridStyleValue(style, 'pointerEvents');
    clearCuratedGridStyleValue(style, 'zIndex');
    clearCuratedGridStyleValue(style, 'display');
  }
  styledElement.className = toggleClassNameToken(styledElement.className || '', 'cw-curated-card--leaving', false);
}

function applyCardAbsolutePosition(
  card: Element,
  leftPx: number,
  topPx: number,
  widthPx: number,
  initialLeftPx: number,
  initialTopPx: number,
): void {
  const style = getElementStyleRecord(card);
  if (!style) {
    return;
  }

  const cardElement = card as Element & {
    dataset?: Record<string, string>;
    getBoundingClientRect?: () => DOMRect;
  };
  const dataset = cardElement.dataset || null;
  const hasPositionSeeded = dataset?.cwAbsolutePositionSeeded === 'true';
  const nextLeft = `${Math.round(leftPx)}px`;
  const nextTop = `${Math.round(topPx)}px`;
  const nextWidth = `${Math.max(1, Math.round(widthPx))}px`;
  const initialLeft = `${Math.round(initialLeftPx)}px`;
  const initialTop = `${Math.round(initialTopPx)}px`;
  const hasCenterIntroStaged = dataset?.cwCenterIntroStaged === 'true';

  setCuratedGridStyleValue(style, 'position', 'absolute');
  setCuratedGridStyleValue(style, 'margin', '0');
  setCuratedGridStyleValue(style, 'width', nextWidth);
  setCuratedGridStyleValue(style, 'maxWidth', nextWidth);
  clearCuratedGridStyleValue(style, 'pointerEvents');
  clearCuratedGridStyleValue(style, 'zIndex');
  clearCuratedGridStyleValue(style, 'transform');

  if (!hasPositionSeeded) {
    if (hasCenterIntroStaged) {
      setCuratedGridStyleValue(style, 'transition', absoluteCardTopLeftTransition);
      setCuratedGridStyleValue(style, 'left', nextLeft);
      setCuratedGridStyleValue(style, 'top', nextTop);
      if (dataset) {
        dataset.cwAbsolutePositionSeeded = 'true';
        delete dataset.cwCenterIntroStaged;
      }
      return;
    }

    setCuratedGridStyleValue(style, 'transition', 'none');
    setCuratedGridStyleValue(style, 'left', initialLeft);
    setCuratedGridStyleValue(style, 'top', initialTop);
    setCuratedGridStyleValue(style, 'opacity', '0');
    if (typeof cardElement.getBoundingClientRect === 'function') {
      cardElement.getBoundingClientRect();
    }
    setCuratedGridStyleValue(style, 'transition', absoluteCardTopLeftTransition);
    if (dataset) {
      dataset.cwAbsolutePositionSeeded = 'true';
    }
    const applyFinalPosition = () => {
      setCuratedGridStyleValue(style, 'left', nextLeft);
      setCuratedGridStyleValue(style, 'top', nextTop);
      clearCuratedGridStyleValue(style, 'opacity');
    };
    if (typeof root.requestAnimationFrame === 'function') {
      root.requestAnimationFrame(applyFinalPosition);
      return;
    }
    applyFinalPosition();
    return;
  }

  setCuratedGridStyleValue(style, 'transition', absoluteCardTopLeftTransition);
  setCuratedGridStyleValue(style, 'left', nextLeft);
  setCuratedGridStyleValue(style, 'top', nextTop);
}

function stageCardCenterIntro(gridElement: Element, card: Element): void {
  const style = getElementStyleRecord(card);
  if (!style) {
    return;
  }

  const cardElement = card as Element & {
    dataset?: Record<string, string>;
    getBoundingClientRect?: () => DOMRect;
  };
  const dataset = cardElement.dataset || null;
  if (dataset?.cwAbsolutePositionSeeded === 'true' || dataset?.cwCenterIntroStaged === 'true') {
    return;
  }

  const gridWidthPx = resolveGridWidthPx(gridElement);
  const measuredRect = getElementRectSnapshot(card);
  const measuredWidthPx =
    measuredRect && measuredRect.width > 0
      ? measuredRect.width
      : Number.parseFloat(style.width || '') || absoluteGridDefaultMinCardWidthPx;
  const introWidthPx = Math.max(1, measuredWidthPx);
  const introLeftPx = gridWidthPx > 0 ? Math.max(0, (gridWidthPx - introWidthPx) / 2) : 0;

  setCuratedGridStyleValue(style, 'position', 'absolute');
  setCuratedGridStyleValue(style, 'margin', '0');
  setCuratedGridStyleValue(style, 'width', `${Math.round(introWidthPx)}px`);
  setCuratedGridStyleValue(style, 'maxWidth', `${Math.round(introWidthPx)}px`);
  setCuratedGridStyleValue(style, 'left', gridWidthPx > 0 ? `${Math.round(introLeftPx)}px` : '50%');
  setCuratedGridStyleValue(style, 'top', '0px');
  if (gridWidthPx > 0) {
    clearCuratedGridStyleValue(style, 'transform');
  } else {
    setCuratedGridStyleValue(style, 'transform', 'translateX(-50%)');
  }
  setCuratedGridStyleValue(style, 'opacity', '0');
  setCuratedGridStyleValue(style, 'transition', 'none');
  if (typeof cardElement.getBoundingClientRect === 'function') {
    cardElement.getBoundingClientRect();
  }
  setCuratedGridStyleValue(style, 'transition', absoluteCardTopLeftTransition);
  if (dataset) {
    dataset.cwCenterIntroStaged = 'true';
  }

  const fadeIn = () => {
    clearCuratedGridStyleValue(style, 'opacity');
  };
  if (typeof root.requestAnimationFrame === 'function') {
    root.requestAnimationFrame(fadeIn);
    return;
  }
  fadeIn();
}

function resolveUniformAbsoluteCardHeightPx(cardHeights: number[], columns: number): number {
  const measurableCardHeights = cardHeights.filter((height) => height > 0);
  return (
    resolveCompactUniformCardHeightPx(
      measurableCardHeights.length ? measurableCardHeights : [absoluteGridFallbackCardHeightPx],
      columns,
    ) || absoluteGridFallbackCardHeightPx
  );
}

function setGridAbsolutePlacementHeight(
  gridElement: Element,
  cardCount: number,
  columns: number,
  roundedUniformCardHeightPx: number,
  gapPx: number,
): void {
  const rowCount = Math.ceil(cardCount / columns);
  const gridHeight = rowCount > 0 ? Math.max(0, rowCount * roundedUniformCardHeightPx + (rowCount - 1) * gapPx) : 0;
  const gridStyle = getElementStyleRecord(gridElement);
  if (!gridStyle) {
    return;
  }
  setCuratedGridStyleValue(gridStyle, 'display', 'block');
  setCuratedGridStyleValue(gridStyle, 'position', 'relative');
  setStyleCustomProperty(gridStyle, cardContainerContentHeightCssVariable, `${Math.max(0, Math.round(gridHeight))}px`);
  if (typeof gridStyle.height === 'string' && gridStyle.height) {
    clearCuratedGridStyleValue(gridStyle, 'height');
  }
}

function applyAbsoluteCardPositions(
  nextCards: Element[],
  columns: number,
  cardWidthPx: number,
  gapPx: number,
  gridWidthPx: number,
  roundedUniformCardHeightPx: number,
  firstRowCenterLeftPx: number,
  firstRowCenterTopPx: number,
): void {
  nextCards.forEach((card, index) => {
    const rowIndex = Math.floor(index / columns);
    const rowStartIndex = rowIndex * columns;
    const rowItemCount = Math.min(columns, nextCards.length - rowStartIndex);
    const columnIndex = index - rowStartIndex;
    const rowWidthPx = rowItemCount * cardWidthPx + Math.max(0, rowItemCount - 1) * gapPx;
    const rowLeftInsetPx = Math.max(0, (gridWidthPx - rowWidthPx) / 2);
    const leftPx = rowLeftInsetPx + columnIndex * (cardWidthPx + gapPx);
    const topPx = rowIndex * (roundedUniformCardHeightPx + gapPx);
    applyCardAbsolutePosition(card, leftPx, topPx, cardWidthPx, firstRowCenterLeftPx, firstRowCenterTopPx);
  });
}

function applyAbsoluteGridCardPlacement(gridElement: Element, nextCards: Element[]): boolean {
  if (!nextCards.length || !hasGridStylesForAbsolutePlacement(gridElement)) {
    resetGridAbsoluteHeight(gridElement);
    writeCuratedGridActiveCards(gridElement, []);
    return false;
  }

  if (!nextCards.every((card) => hasCardStylesForAbsolutePlacement(card))) {
    return false;
  }

  const gridWidthPx = resolveGridWidthPx(gridElement);
  if (!Number.isFinite(gridWidthPx) || gridWidthPx <= 0) {
    return false;
  }

  const gapPx = resolveGridGapPx(gridElement);
  const columns = resolveAbsoluteGridColumnCount(gridWidthPx, gapPx);
  const cardWidthPx = Math.max(1, (gridWidthPx - gapPx * (columns - 1)) / columns);
  const firstRowCenterLeftPx = Math.max(0, (gridWidthPx - cardWidthPx) / 2);
  const firstRowCenterTopPx = 0;
  const measurements = prepareCuratedGridHeightMeasurements(
    nextCards,
    cardWidthPx,
    getElementStyleRecord,
    parseNonNegativePixelValue,
  );
  const cardHeights = resolveCuratedGridCardHeights(
    nextCards,
    measurements,
    getElementRectSnapshot,
    resolveFallbackCardHeightPx,
  );
  const uniformCardHeightPx = resolveUniformAbsoluteCardHeightPx(cardHeights, columns);
  applyUniformCardHeight(nextCards, uniformCardHeightPx);
  const roundedUniformCardHeightPx = roundCardHeightPx(uniformCardHeightPx);
  setGridAbsolutePlacementHeight(gridElement, nextCards.length, columns, roundedUniformCardHeightPx, gapPx);
  applyAbsoluteCardPositions(
    nextCards,
    columns,
    cardWidthPx,
    gapPx,
    gridWidthPx,
    roundedUniformCardHeightPx,
    firstRowCenterLeftPx,
    firstRowCenterTopPx,
  );
  writeCuratedGridActiveCards(gridElement, nextCards);

  return true;
}

function cancelLeavingCardIfNeeded(card: Element): void {
  const existingTimeoutId = leavingCardTimeoutByElement.get(card);
  if (typeof existingTimeoutId !== 'number') {
    return;
  }

  root.clearTimeout(existingTimeoutId);
  leavingCardTimeoutByElement.delete(card);
  clearLeavingCardStyles(card);
}

function startLeavingCard(
  gridElement: Element,
  card: Element,
  gridRect: RectSnapshot,
  cardRect: RectSnapshot,
  onCardRemoved: (card: Element) => void,
): void {
  if (leavingCardTimeoutByElement.has(card)) {
    return;
  }
  const styledCard = card as Element & {
    className?: string;
    style?: Record<string, string>;
  };
  const style = styledCard.style;
  if (!style) {
    const parentNode = (card as Element & { parentNode?: Element | null }).parentNode;
    if (parentNode === gridElement) {
      gridElement.removeChild(card);
    }
    onCardRemoved(card);
    return;
  }

  const leftPx = cardRect.left - gridRect.left;
  const topPx = cardRect.top - gridRect.top;

  setCuratedGridStyleValue(style, 'position', 'absolute');
  setCuratedGridStyleValue(style, 'left', `${Math.round(leftPx)}px`);
  setCuratedGridStyleValue(style, 'top', `${Math.round(topPx)}px`);
  setCuratedGridStyleValue(style, 'width', `${Math.round(cardRect.width)}px`);
  setCuratedGridStyleValue(style, 'height', `${Math.round(cardRect.height)}px`);
  setCuratedGridStyleValue(style, 'margin', '0');
  setCuratedGridStyleValue(style, 'pointerEvents', 'none');
  setCuratedGridStyleValue(style, 'zIndex', '2');
  styledCard.className = toggleClassNameToken(styledCard.className || '', 'cw-curated-card--leaving', true);
  gridElement.appendChild(card);

  const timeoutId = root.setTimeout(() => {
    leavingCardTimeoutByElement.delete(card);
    clearLeavingCardStyles(card);
    const parentNode = (card as Element & { parentNode?: Element | null }).parentNode;
    if (parentNode === gridElement) {
      gridElement.removeChild(card);
    }
    onCardRemoved(card);
  }, cardMoveDurationMs);

  leavingCardTimeoutByElement.set(card, timeoutId);
}

function shouldFadeInCard(nextCard: Element): boolean {
  return isParkedCardElement(nextCard) || isRetainedCardHiding(nextCard);
}

function markCardEntering(card: Element): void {
  const cardElement = card as Element & { className?: string };
  cardElement.className = toggleClassNameToken(cardElement.className || '', 'cw-curated-card--entering', true);

  const removeEnterClass = () => {
    cardElement.className = toggleClassNameToken(cardElement.className || '', 'cw-curated-card--entering', false);
  };

  if (typeof root.requestAnimationFrame === 'function') {
    root.requestAnimationFrame(() => {
      root.requestAnimationFrame(removeEnterClass);
    });
    return;
  }

  setTimeout(removeEnterClass, 0);
}

type ReorderCuratedGridChildrenBareOptions = {
  onCardRemoved: ((card: Element) => void) | null;
  animateRemovals: boolean;
  shouldRetainCardInGrid: ((card: Element) => boolean) | null;
};

function removeTrackedCuratedGridOverflowCard(
  gridElement: Element,
  overflow: Element,
  onCardRemoved: ((card: Element) => void) | null,
): void {
  removeCuratedGridOverflowCard(
    gridElement,
    overflow,
    onCardRemoved,
    isTrackedCardElement,
    cancelRetainedCardHideIfNeeded,
  );
}

function hideTrackedCuratedGridRetainedCard(
  card: Element,
  onCardRemoved: ((card: Element) => void) | null,
): void {
  applyRetainedCardHiddenState(card);
  onCardRemoved?.(card);
}

function reconcileCuratedGridChildrenForAbsolutePlacement(
  gridElement: Element,
  nextCards: Element[],
  options: ReorderCuratedGridChildrenBareOptions,
): void {
  const { onCardRemoved, animateRemovals } = options;
  const activeGridChildren = getActiveGridChildren(gridElement);
  const shouldReorderMountedChildren = activeGridChildren.length <= nextCards.length;
  mountCuratedGridNextCards(
    gridElement,
    nextCards,
    activeGridChildren,
    shouldReorderMountedChildren,
    shouldFadeInCard,
    cancelLeavingCardIfNeeded,
    cancelRetainedCardHideIfNeeded,
    markCardEntering,
    stageCardCenterIntro,
  );

  const overflowChildren = resolveCuratedGridOverflowChildren(gridElement, nextCards, getActiveGridChildren);
  if (!overflowChildren.length) {
    return;
  }
  const gridRect = getElementRectSnapshot(gridElement);
  const viewportHeight = Number(root.innerHeight) || 0;

  const removableOverflow = resolveCuratedGridRemovableOverflow({
    overflowChildren,
    shouldRetainCardInGrid: options.shouldRetainCardInGrid,
    isLikelyVisible: (overflow) =>
      isCuratedGridOverflowCardLikelyVisible(
        overflow,
        gridRect,
        viewportHeight,
        getElementStyleRecord,
        parseNonNegativePixelValue,
      ),
    onImmediateRetain: (overflow) => {
      cancelLeavingCardIfNeeded(overflow);
      cancelRetainedCardHideIfNeeded(overflow);
      hideTrackedCuratedGridRetainedCard(overflow, onCardRemoved);
    },
    onAnimatedRetain: (overflow) => {
      incrementRuntimePerfDiagnostic('retainedCardHideScheduled');
      scheduleRetainedCardHide(overflow, retainedCardHideDurationMs, () => {
        incrementRuntimePerfDiagnostic('retainedCardHideCompleted');
        hideTrackedCuratedGridRetainedCard(overflow, onCardRemoved);
      });
    },
  });
  if (!removableOverflow.length) {
    return;
  }

  finalizeCuratedGridOverflow({
    gridElement,
    removableOverflow,
    onCardRemoved,
    animateRemovals,
    animateCuratedGridOverflowRemovals,
    gridRect,
    isTrackedCardElement,
    getElementRectSnapshot,
    startLeavingCard,
    removeCuratedGridOverflowCard: (nextGridElement, overflow, nextOnCardRemoved) => {
      removeTrackedCuratedGridOverflowCard(nextGridElement, overflow, nextOnCardRemoved);
    },
  });
}

function reorderCuratedGridChildren(
  gridElement: Element,
  nextCards: Element[],
  options: CuratedGridReorderOptions = {},
): void {
  if (!nextCards.length) {
    resetGridAbsoluteHeight(gridElement);
    absoluteGridLayoutSignatureByElement.delete(gridElement);
    clearCuratedGridDomState(gridElement);
  }

  const onCardRemoved = typeof options.onCardRemoved === 'function' ? options.onCardRemoved : null;
  const shouldRetainHiddenCard =
    typeof options.shouldRetainCardInGrid === 'function' ? options.shouldRetainCardInGrid : null;

  // Recompute absolute layout even when card membership/order is unchanged so container
  // height stays in sync with patched card content and the host flow stays correct.
  if (hasIdenticalCuratedGridChildOrder(getActiveGridChildren(gridElement), nextCards)) {
    const gridWidthPx = resolveGridWidthPx(gridElement);
    const layoutSignature =
      Number.isFinite(gridWidthPx) && gridWidthPx > 0
        ? buildCuratedGridLayoutSignature(nextCards, gridWidthPx, resolveGridGapPx(gridElement))
        : null;
    if (layoutSignature && absoluteGridLayoutSignatureByElement.get(gridElement) === layoutSignature) {
      incrementRuntimePerfDiagnostic('gridLayoutCacheHits');
      return;
    }

    incrementRuntimePerfDiagnostic('gridLayoutCacheMisses');
    const applied = applyAbsoluteGridCardPlacement(gridElement, nextCards);
    if (applied && layoutSignature) {
      absoluteGridLayoutSignatureByElement.set(gridElement, layoutSignature);
    } else {
      absoluteGridLayoutSignatureByElement.delete(gridElement);
    }
    return;
  }

  const nextCardsSet = new Set(nextCards);
  const activeGridChildren = getActiveGridChildren(gridElement);
  const overflowCount = activeGridChildren.filter(
    (child) => !nextCardsSet.has(child) && !(shouldRetainHiddenCard?.(child) || false),
  ).length;
  const shouldAnimateRemovals = Boolean(onCardRemoved) && overflowCount > 0;

  reconcileCuratedGridChildrenForAbsolutePlacement(gridElement, nextCards, {
    onCardRemoved,
    animateRemovals: shouldAnimateRemovals,
    shouldRetainCardInGrid: shouldRetainHiddenCard,
  });
  incrementRuntimePerfDiagnostic('gridLayoutCacheMisses');
  const applied = applyAbsoluteGridCardPlacement(gridElement, nextCards);
  const gridWidthPx = resolveGridWidthPx(gridElement);
  const layoutSignature =
    Number.isFinite(gridWidthPx) && gridWidthPx > 0
      ? buildCuratedGridLayoutSignature(nextCards, gridWidthPx, resolveGridGapPx(gridElement))
      : null;
  if (applied && layoutSignature) {
    absoluteGridLayoutSignatureByElement.set(gridElement, layoutSignature);
    return;
  }
  absoluteGridLayoutSignatureByElement.delete(gridElement);
}

export function createCuratedPanelGridTransitionsRuntime(): CuratedPanelGridTransitionsRuntime {
  return {
    reorderCuratedGridChildren,
  };
}
