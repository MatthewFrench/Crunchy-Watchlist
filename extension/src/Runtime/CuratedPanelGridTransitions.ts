import {
  cancelRetainedCardHideIfNeeded,
  isParkedCardElement,
  isRetainedCardHiding,
  scheduleRetainedCardHide,
} from './CuratedPanelGridRetainedCardVisibility.js';

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
const cardReorderMoveDurationMs = 500;
const cardMoveEasing = 'cubic-bezier(0.22, 1, 0.36, 1)';
const absoluteCardMoveDurationMs = 500;
const absoluteGridDefaultGapPx = 12;
const absoluteGridDefaultMinCardWidthPx = 320;
const absoluteGridDefaultMaxCardWidthPx = 420;
const absoluteGridPreferredCardWidthPx = 370;
const absoluteCardTopLeftTransition = `top ${absoluteCardMoveDurationMs}ms ease-in-out, left ${absoluteCardMoveDurationMs}ms ease-in-out, opacity ${cardFadeDurationMs}ms ease, border-color 180ms ease, background-color 180ms ease`;
const leavingCardTimeoutByElement = new Map<Element, number>();
const movingCardTimeoutByElement = new Map<Element, number>();

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
  gridStyle.height = '';
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
  return Array.from(gridElement.children).filter(
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
    style.position = '';
    style.left = '';
    style.top = '';
    style.width = '';
    style.height = '';
    style.margin = '';
    style.pointerEvents = '';
    style.zIndex = '';
  }
  styledElement.className = toggleClassNameToken(styledElement.className || '', 'cw-curated-card--leaving', false);
}

function clearMovingCardStyles(card: Element): void {
  const styledElement = card as Element & {
    style?: Record<string, string>;
  };
  const style = styledElement.style;
  if (!style) {
    return;
  }
  style.transition = '';
  style.transform = '';
  style.willChange = '';
}

function applyCardAbsolutePosition(card: Element, leftPx: number, topPx: number, widthPx: number): void {
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

  style.position = 'absolute';
  style.margin = '0';
  style.width = nextWidth;
  style.maxWidth = nextWidth;
  style.pointerEvents = '';
  style.zIndex = '';

  if (!hasPositionSeeded) {
    style.transition = 'none';
    style.left = nextLeft;
    style.top = nextTop;
    if (typeof cardElement.getBoundingClientRect === 'function') {
      cardElement.getBoundingClientRect();
    }
    style.transition = absoluteCardTopLeftTransition;
    if (dataset) {
      dataset.cwAbsolutePositionSeeded = 'true';
    }
    return;
  }

  style.transition = absoluteCardTopLeftTransition;
  style.left = nextLeft;
  style.top = nextTop;
}

function applyAbsoluteGridCardPlacement(gridElement: Element, nextCards: Element[]): boolean {
  if (!nextCards.length || !hasGridStylesForAbsolutePlacement(gridElement)) {
    resetGridAbsoluteHeight(gridElement);
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

  nextCards.forEach((card) => {
    const style = getElementStyleRecord(card);
    if (!style) {
      return;
    }
    const roundedWidthPx = `${Math.max(1, Math.round(cardWidthPx))}px`;
    style.position = 'absolute';
    style.margin = '0';
    style.width = roundedWidthPx;
    style.maxWidth = roundedWidthPx;
    // Measure natural content height per card each render before applying uniform height.
    style.height = '';
  });

  const cardHeights = nextCards.map((card) => {
    const cardRect = getElementRectSnapshot(card);
    return cardRect && cardRect.height > 0 ? cardRect.height : 0;
  });

  if (cardHeights.every((height) => height <= 0)) {
    return false;
  }

  const uniformCardHeightPx = Math.max(...cardHeights, 1);
  const rowCount = Math.ceil(nextCards.length / columns);
  const gridHeight = rowCount > 0 ? Math.max(0, rowCount * uniformCardHeightPx + (rowCount - 1) * gapPx) : 0;

  const gridStyle = getElementStyleRecord(gridElement);
  if (gridStyle) {
    gridStyle.display = 'block';
    gridStyle.position = 'relative';
    gridStyle.height = `${Math.max(0, Math.round(gridHeight))}px`;
  }

  nextCards.forEach((card, index) => {
    const rowIndex = Math.floor(index / columns);
    const rowStartIndex = rowIndex * columns;
    const rowItemCount = Math.min(columns, nextCards.length - rowStartIndex);
    const columnIndex = index - rowStartIndex;
    const rowWidthPx = rowItemCount * cardWidthPx + Math.max(0, rowItemCount - 1) * gapPx;
    const rowLeftInsetPx = Math.max(0, (gridWidthPx - rowWidthPx) / 2);
    const leftPx = rowLeftInsetPx + columnIndex * (cardWidthPx + gapPx);
    const topPx = rowIndex * (uniformCardHeightPx + gapPx);
    const cardStyle = getElementStyleRecord(card);
    if (cardStyle) {
      cardStyle.height = `${Math.max(1, Math.round(uniformCardHeightPx))}px`;
    }
    applyCardAbsolutePosition(card, leftPx, topPx, cardWidthPx);
  });

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

function cancelMovingCardIfNeeded(card: Element): void {
  const existingTimeoutId = movingCardTimeoutByElement.get(card);
  if (typeof existingTimeoutId !== 'number') {
    return;
  }

  root.clearTimeout(existingTimeoutId);
  movingCardTimeoutByElement.delete(card);
  clearMovingCardStyles(card);
}

function shouldRetainCardInGrid(card: Element, options: ReorderCuratedGridChildrenBareOptions): boolean {
  const predicate = options.shouldRetainCardInGrid;
  if (typeof predicate !== 'function') {
    return false;
  }
  return Boolean(predicate(card));
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
  cancelMovingCardIfNeeded(card);
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

  style.position = 'absolute';
  style.left = `${Math.round(leftPx)}px`;
  style.top = `${Math.round(topPx)}px`;
  style.width = `${Math.round(cardRect.width)}px`;
  style.height = `${Math.round(cardRect.height)}px`;
  style.margin = '0';
  style.pointerEvents = 'none';
  style.zIndex = '2';
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

function canAnimateCards(gridElement: Element, cards: Element[]): boolean {
  if (!cards.length) {
    return false;
  }

  if (typeof (gridElement as { appendChild?: (...nodes: Element[]) => Element }).appendChild !== 'function') {
    return false;
  }

  return cards.every((card) => getElementRectSnapshot(card) != null);
}

function hasIdenticalChildOrder(gridElement: Element, nextCards: Element[]): boolean {
  const currentChildren = getActiveGridChildren(gridElement);
  if (currentChildren.length !== nextCards.length) {
    return false;
  }
  return currentChildren.every((child, index) => child === nextCards[index]);
}

function canUseAbsolutePlacementForReorder(gridElement: Element, nextCards: Element[]): boolean {
  if (typeof (gridElement as { appendChild?: (...nodes: Element[]) => Element }).appendChild !== 'function') {
    return false;
  }
  if (!hasGridStylesForAbsolutePlacement(gridElement)) {
    return false;
  }
  return nextCards.every((card) => hasCardStylesForAbsolutePlacement(card));
}

function shouldFadeInCard(nextCard: Element): boolean {
  return isParkedCardElement(nextCard) || isRetainedCardHiding(nextCard);
}

function captureCardRects(cards: Element[]): Map<Element, RectSnapshot> {
  const snapshots = new Map<Element, RectSnapshot>();
  cards.forEach((card) => {
    const snapshot = getElementRectSnapshot(card);
    if (snapshot) {
      snapshots.set(card, snapshot);
    }
  });
  return snapshots;
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

function animateCardMove(card: Element, previousRect: RectSnapshot, currentRect: RectSnapshot): void {
  const deltaX = previousRect.left - currentRect.left;
  const deltaY = previousRect.top - currentRect.top;
  if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
    return;
  }

  const styledElement = card as Element & {
    style?: Record<string, string>;
    getBoundingClientRect?: () => DOMRect;
  };
  if (!styledElement.style) {
    return;
  }

  cancelMovingCardIfNeeded(card);

  const durationMs = cardReorderMoveDurationMs;
  styledElement.style.transition = 'none';
  styledElement.style.willChange = 'transform';
  styledElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  if (typeof styledElement.getBoundingClientRect === 'function') {
    styledElement.getBoundingClientRect();
  }
  styledElement.style.transition = `transform ${durationMs}ms ${cardMoveEasing}`;
  styledElement.style.transform = '';

  const timeoutId = root.setTimeout(() => {
    movingCardTimeoutByElement.delete(card);
    clearMovingCardStyles(card);
  }, durationMs + 32);
  movingCardTimeoutByElement.set(card, timeoutId);
}

type ReorderCuratedGridChildrenBareOptions = {
  onCardRemoved: ((card: Element) => void) | null;
  animateRemovals: boolean;
  shouldRetainCardInGrid: ((card: Element) => boolean) | null;
};

function removeOverflowCard(
  gridElement: Element,
  overflow: Element,
  onCardRemoved: ((card: Element) => void) | null,
): void {
  cancelRetainedCardHideIfNeeded(overflow);
  cancelMovingCardIfNeeded(overflow);
  if (onCardRemoved && isTrackedCardElement(overflow)) {
    const parentNode = (overflow as Element & { parentNode?: Element | null }).parentNode;
    if (parentNode === gridElement) {
      gridElement.removeChild(overflow);
    }
    onCardRemoved(overflow);
    return;
  }

  gridElement.removeChild(overflow);
}

function reorderCuratedGridChildrenBare(
  gridElement: Element,
  nextCards: Element[],
  options: ReorderCuratedGridChildrenBareOptions,
): void {
  const { onCardRemoved, animateRemovals } = options;
  nextCards.forEach((nextCard) => {
    const shouldFadeIn = shouldFadeInCard(nextCard);
    cancelLeavingCardIfNeeded(nextCard);
    cancelRetainedCardHideIfNeeded(nextCard);
    cancelMovingCardIfNeeded(nextCard);
    if (shouldFadeIn) {
      markCardEntering(nextCard);
    }
  });

  nextCards.forEach((nextCard, index) => {
    const currentChild = gridElement.children[index] || null;
    if (currentChild === nextCard) {
      return;
    }
    gridElement.insertBefore(nextCard, currentChild);
  });

  const activeChildren = getActiveGridChildren(gridElement);
  const overflowChildren = activeChildren.slice(nextCards.length);
  if (!overflowChildren.length) {
    return;
  }

  const removableOverflow = overflowChildren.filter((overflow) => {
    if (shouldRetainCardInGrid(overflow, options)) {
      scheduleRetainedCardHide(overflow, cardMoveDurationMs);
      return false;
    }
    return true;
  });
  if (!removableOverflow.length) {
    return;
  }

  if (onCardRemoved && animateRemovals) {
    const gridRect = getElementRectSnapshot(gridElement);
    removableOverflow.forEach((overflow) => {
      if (!isTrackedCardElement(overflow) || !gridRect) {
        removeOverflowCard(gridElement, overflow, onCardRemoved);
        return;
      }
      const cardRect = getElementRectSnapshot(overflow);
      if (!cardRect) {
        removeOverflowCard(gridElement, overflow, onCardRemoved);
        return;
      }
      startLeavingCard(gridElement, overflow, gridRect, cardRect, onCardRemoved);
    });
    return;
  }

  removableOverflow.forEach((overflow) => {
    removeOverflowCard(gridElement, overflow, onCardRemoved);
  });
}

function reconcileCuratedGridChildrenForAbsolutePlacement(
  gridElement: Element,
  nextCards: Element[],
  options: ReorderCuratedGridChildrenBareOptions,
): void {
  const { onCardRemoved, animateRemovals } = options;
  nextCards.forEach((nextCard) => {
    const shouldFadeIn = shouldFadeInCard(nextCard);
    cancelLeavingCardIfNeeded(nextCard);
    cancelRetainedCardHideIfNeeded(nextCard);
    cancelMovingCardIfNeeded(nextCard);
    const parentNode = (nextCard as Element & { parentNode?: Element | null }).parentNode;
    if (parentNode === gridElement) {
      if (shouldFadeIn) {
        markCardEntering(nextCard);
      }
      return;
    }
    gridElement.appendChild(nextCard);
    markCardEntering(nextCard);
  });

  const nextCardsSet = new Set(nextCards);
  const activeChildren = getActiveGridChildren(gridElement);
  const overflowChildren = activeChildren.filter((child) => !nextCardsSet.has(child));
  if (!overflowChildren.length) {
    return;
  }

  const removableOverflow = overflowChildren.filter((overflow) => {
    if (shouldRetainCardInGrid(overflow, options)) {
      scheduleRetainedCardHide(overflow, cardMoveDurationMs);
      return false;
    }
    return true;
  });
  if (!removableOverflow.length) {
    return;
  }

  if (onCardRemoved && animateRemovals) {
    const gridRect = getElementRectSnapshot(gridElement);
    removableOverflow.forEach((overflow) => {
      if (!isTrackedCardElement(overflow) || !gridRect) {
        removeOverflowCard(gridElement, overflow, onCardRemoved);
        return;
      }
      const cardRect = getElementRectSnapshot(overflow);
      if (!cardRect) {
        removeOverflowCard(gridElement, overflow, onCardRemoved);
        return;
      }
      startLeavingCard(gridElement, overflow, gridRect, cardRect, onCardRemoved);
    });
    return;
  }

  removableOverflow.forEach((overflow) => {
    removeOverflowCard(gridElement, overflow, onCardRemoved);
  });
}

function reorderCuratedGridChildren(
  gridElement: Element,
  nextCards: Element[],
  options: CuratedGridReorderOptions = {},
): void {
  if (!nextCards.length) {
    resetGridAbsoluteHeight(gridElement);
  }

  const onCardRemoved = typeof options.onCardRemoved === 'function' ? options.onCardRemoved : null;
  const shouldRetainHiddenCard =
    typeof options.shouldRetainCardInGrid === 'function' ? options.shouldRetainCardInGrid : null;

  // Recompute absolute layout even when card membership/order is unchanged so container
  // height stays in sync with patched card content and the host flow stays correct.
  if (hasIdenticalChildOrder(gridElement, nextCards)) {
    applyAbsoluteGridCardPlacement(gridElement, nextCards);
    return;
  }

  const nextCardsSet = new Set(nextCards);
  const activeGridChildren = getActiveGridChildren(gridElement);
  const overflowCount = activeGridChildren.filter(
    (child) => !nextCardsSet.has(child) && !(shouldRetainHiddenCard?.(child) || false),
  ).length;
  const shouldAnimateRemovals = Boolean(onCardRemoved) && overflowCount > 0;

  if (canUseAbsolutePlacementForReorder(gridElement, nextCards)) {
    reconcileCuratedGridChildrenForAbsolutePlacement(gridElement, nextCards, {
      onCardRemoved,
      animateRemovals: shouldAnimateRemovals,
      shouldRetainCardInGrid: shouldRetainHiddenCard,
    });
    if (applyAbsoluteGridCardPlacement(gridElement, nextCards) || !nextCards.length) {
      return;
    }
  }

  const fallbackActiveGridChildren = getActiveGridChildren(gridElement);
  const fallbackOverflowCount = fallbackActiveGridChildren.filter(
    (child) => !nextCardsSet.has(child) && !(shouldRetainHiddenCard?.(child) || false),
  ).length;
  const shouldAnimateFallbackRemovals = Boolean(onCardRemoved) && fallbackOverflowCount > 0;

  const existingCards = fallbackActiveGridChildren.filter((child) => nextCardsSet.has(child));
  const shouldAnimate = canAnimateCards(gridElement, existingCards);
  if (!shouldAnimate) {
    reorderCuratedGridChildrenBare(gridElement, nextCards, {
      onCardRemoved,
      animateRemovals: shouldAnimateFallbackRemovals,
      shouldRetainCardInGrid: shouldRetainHiddenCard,
    });
    applyAbsoluteGridCardPlacement(gridElement, nextCards);
    return;
  }

  const previousRectsByCard = captureCardRects(existingCards);
  reorderCuratedGridChildrenBare(gridElement, nextCards, {
    onCardRemoved,
    animateRemovals: shouldAnimateFallbackRemovals,
    shouldRetainCardInGrid: shouldRetainHiddenCard,
  });

  if (applyAbsoluteGridCardPlacement(gridElement, nextCards)) {
    return;
  }

  nextCards.forEach((card) => {
    const previousRect = previousRectsByCard.get(card) || null;
    const currentRect = getElementRectSnapshot(card);
    if (!currentRect) {
      return;
    }

    if (!previousRect) {
      markCardEntering(card);
      return;
    }

    animateCardMove(card, previousRect, currentRect);
  });
}

export function createCuratedPanelGridTransitionsRuntime(): CuratedPanelGridTransitionsRuntime {
  return {
    reorderCuratedGridChildren,
  };
}
