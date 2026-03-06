export function shouldRetainCuratedGridCard(card: Element, predicate: ((card: Element) => boolean) | null): boolean {
  if (typeof predicate !== 'function') {
    return false;
  }
  return Boolean(predicate(card));
}

export function removeCuratedGridOverflowCard(
  gridElement: Element,
  overflow: Element,
  onCardRemoved: ((card: Element) => void) | null,
  isTrackedCardElement: (value: Element) => boolean,
  cancelRetainedCardHideIfNeeded: (card: Element) => void,
): void {
  cancelRetainedCardHideIfNeeded(overflow);
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

export function hasIdenticalCuratedGridChildOrder(currentChildren: Element[], nextCards: Element[]): boolean {
  if (currentChildren.length !== nextCards.length) {
    return false;
  }
  return currentChildren.every((child, index) => child === nextCards[index]);
}

function resolveCuratedGridLongestIncreasingSubsequenceIndexes(values: number[]): Set<number> {
  if (!values.length) {
    return new Set<number>();
  }

  const predecessors = new Array<number>(values.length).fill(-1);
  const tails: number[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== 'number') {
      continue;
    }
    let left = 0;
    let right = tails.length;
    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      const tailIndex = tails[middle] ?? 0;
      if ((values[tailIndex] ?? 0) < value) {
        left = middle + 1;
      } else {
        right = middle;
      }
    }
    if (left > 0) {
      predecessors[index] = tails[left - 1] ?? -1;
    }
    tails[left] = index;
  }

  const sequenceIndexes = new Set<number>();
  let currentIndex = tails[tails.length - 1] ?? -1;
  while (currentIndex >= 0) {
    sequenceIndexes.add(currentIndex);
    currentIndex = predecessors[currentIndex] ?? -1;
  }
  return sequenceIndexes;
}

function resolveCuratedGridStableMountedCards(nextCards: Element[], currentActiveChildren: Element[]): Set<Element> {
  const currentIndexByCard = new Map<Element, number>();
  currentActiveChildren.forEach((card, index) => {
    currentIndexByCard.set(card, index);
  });

  const mountedCardsInNextOrder: Element[] = [];
  const mountedIndexes: number[] = [];
  nextCards.forEach((card) => {
    const currentIndex = currentIndexByCard.get(card);
    if (typeof currentIndex !== 'number') {
      return;
    }
    mountedCardsInNextOrder.push(card);
    mountedIndexes.push(currentIndex);
  });

  const lisIndexes = resolveCuratedGridLongestIncreasingSubsequenceIndexes(mountedIndexes);
  const stableCards = new Set<Element>();
  mountedCardsInNextOrder.forEach((card, index) => {
    if (lisIndexes.has(index)) {
      stableCards.add(card);
    }
  });
  return stableCards;
}

export function mountCuratedGridNextCards(
  gridElement: Element,
  nextCards: Element[],
  currentActiveChildren: Element[],
  preserveMountedDomOrder: boolean,
  shouldReorderMountedChildren: boolean,
  shouldFadeInCard: (card: Element) => boolean,
  cancelLeavingCardIfNeeded: (card: Element) => void,
  cancelRetainedCardHideIfNeeded: (card: Element) => void,
  markCardEntering: (card: Element) => void,
  stageCardCenterIntro: (gridElement: Element, nextCard: Element) => void,
): void {
  if (preserveMountedDomOrder) {
    nextCards.forEach((nextCard) => {
      if (!nextCard) {
        return;
      }
      const shouldFadeIn = shouldFadeInCard(nextCard);
      cancelLeavingCardIfNeeded(nextCard);
      cancelRetainedCardHideIfNeeded(nextCard);
      const parentNode = (nextCard as Element & { parentNode?: Element | null }).parentNode;
      if (parentNode !== gridElement) {
        gridElement.appendChild(nextCard);
        stageCardCenterIntro(gridElement, nextCard);
      }
      if (shouldFadeIn) {
        markCardEntering(nextCard);
      }
    });
    return;
  }

  const mountedChildren = new Set(currentActiveChildren);
  const stableMountedCards = shouldReorderMountedChildren
    ? resolveCuratedGridStableMountedCards(nextCards, currentActiveChildren)
    : new Set<Element>();
  let anchor: Element | null = null;

  for (let index = nextCards.length - 1; index >= 0; index -= 1) {
    const nextCard = nextCards[index];
    if (!nextCard) {
      continue;
    }
    const shouldFadeIn = shouldFadeInCard(nextCard);
    cancelLeavingCardIfNeeded(nextCard);
    cancelRetainedCardHideIfNeeded(nextCard);
    const parentNode = (nextCard as Element & { parentNode?: Element | null }).parentNode;
    const isMountedActive = parentNode === gridElement && mountedChildren.has(nextCard);

    if (isMountedActive && (!shouldReorderMountedChildren || stableMountedCards.has(nextCard))) {
      if (shouldFadeIn) {
        markCardEntering(nextCard);
      }
      anchor = nextCard;
      continue;
    }

    if (anchor) {
      gridElement.insertBefore(nextCard, anchor);
    } else {
      gridElement.appendChild(nextCard);
    }
    stageCardCenterIntro(gridElement, nextCard);
    if (shouldFadeIn) {
      markCardEntering(nextCard);
    }
    anchor = nextCard;
  }
}

export function animateCuratedGridOverflowRemovals(options: {
  gridElement: Element;
  removableOverflow: Element[];
  onCardRemoved: (card: Element) => void;
  gridRect: { left: number; top: number; width: number; height: number } | null;
  isTrackedCardElement: (value: Element) => boolean;
  getElementRectSnapshot: (element: Element) => { left: number; top: number; width: number; height: number } | null;
  startLeavingCard: (
    gridElement: Element,
    card: Element,
    gridRect: { left: number; top: number; width: number; height: number },
    cardRect: { left: number; top: number; width: number; height: number },
    onCardRemoved: (card: Element) => void,
  ) => void;
  removeCuratedGridOverflowCard: (
    gridElement: Element,
    overflow: Element,
    onCardRemoved: (card: Element) => void,
  ) => void;
}): void {
  const {
    gridElement,
    removableOverflow,
    onCardRemoved,
    gridRect,
    isTrackedCardElement,
    getElementRectSnapshot,
    startLeavingCard,
    removeCuratedGridOverflowCard,
  } = options;

  removableOverflow.forEach((overflow) => {
    if (!isTrackedCardElement(overflow) || !gridRect) {
      removeCuratedGridOverflowCard(gridElement, overflow, onCardRemoved);
      return;
    }
    const cardRect = getElementRectSnapshot(overflow);
    if (!cardRect) {
      removeCuratedGridOverflowCard(gridElement, overflow, onCardRemoved);
      return;
    }
    startLeavingCard(gridElement, overflow, gridRect, cardRect, onCardRemoved);
  });
}

export function isCuratedGridOverflowCardLikelyVisible(
  overflow: Element,
  gridRect: { top: number; height: number } | null,
  viewportHeight: number,
  getElementStyleRecord: (value: Element) => Record<string, string> | null,
  parseNonNegativePixelValue: (value: string) => number,
): boolean {
  if (!gridRect || viewportHeight <= 0) {
    return true;
  }

  const style = getElementStyleRecord(overflow);
  if (!style) {
    return true;
  }

  const relativeTopPx = parseNonNegativePixelValue(style.top || '');
  const heightPx = parseNonNegativePixelValue(style.height || '');
  if (heightPx <= 0) {
    return true;
  }

  const absoluteTopPx = gridRect.top + relativeTopPx;
  const absoluteBottomPx = absoluteTopPx + heightPx;
  return absoluteBottomPx > -160 && absoluteTopPx < viewportHeight + 160;
}

export function resolveCuratedGridRemovableOverflow(options: {
  overflowChildren: Element[];
  shouldRetainCardInGrid: ((card: Element) => boolean) | null;
  isLikelyVisible: (card: Element) => boolean;
  onImmediateRetain: (card: Element) => void;
  onAnimatedRetain: (card: Element) => void;
}): Element[] {
  const removableOverflow: Element[] = [];
  options.overflowChildren.forEach((overflow) => {
    if (!shouldRetainCuratedGridCard(overflow, options.shouldRetainCardInGrid)) {
      removableOverflow.push(overflow);
      return;
    }
    if (!options.isLikelyVisible(overflow)) {
      options.onImmediateRetain(overflow);
      return;
    }
    options.onAnimatedRetain(overflow);
  });
  return removableOverflow;
}

export function resolveCuratedGridOverflowChildren(
  gridElement: Element,
  nextCards: Element[],
  getActiveGridChildren: (gridElement: Element) => Element[],
): Element[] {
  const nextCardsSet = new Set(nextCards);
  return getActiveGridChildren(gridElement).filter((child) => !nextCardsSet.has(child));
}

export function finalizeCuratedGridOverflow(options: {
  gridElement: Element;
  removableOverflow: Element[];
  onCardRemoved: ((card: Element) => void) | null;
  animateRemovals: boolean;
  animateCuratedGridOverflowRemovals: (options: {
    gridElement: Element;
    removableOverflow: Element[];
    onCardRemoved: (card: Element) => void;
    gridRect: { left: number; top: number; width: number; height: number } | null;
    isTrackedCardElement: (value: Element) => boolean;
    getElementRectSnapshot: (element: Element) => { left: number; top: number; width: number; height: number } | null;
    startLeavingCard: (
      gridElement: Element,
      card: Element,
      gridRect: { left: number; top: number; width: number; height: number },
      cardRect: { left: number; top: number; width: number; height: number },
      onCardRemoved: (card: Element) => void,
    ) => void;
    removeCuratedGridOverflowCard: (
      gridElement: Element,
      overflow: Element,
      onCardRemoved: (card: Element) => void,
    ) => void;
  }) => void;
  gridRect: { left: number; top: number; width: number; height: number } | null;
  isTrackedCardElement: (value: Element) => boolean;
  getElementRectSnapshot: (element: Element) => { left: number; top: number; width: number; height: number } | null;
  startLeavingCard: (
    gridElement: Element,
    card: Element,
    gridRect: { left: number; top: number; width: number; height: number },
    cardRect: { left: number; top: number; width: number; height: number },
    onCardRemoved: (card: Element) => void,
  ) => void;
  removeCuratedGridOverflowCard: (
    gridElement: Element,
    overflow: Element,
    onCardRemoved: (card: Element) => void,
  ) => void;
}): void {
  if (!options.onCardRemoved || !options.animateRemovals) {
    options.removableOverflow.forEach((overflow) => {
      options.removeCuratedGridOverflowCard(options.gridElement, overflow, options.onCardRemoved || (() => {}));
    });
    return;
  }

  options.animateCuratedGridOverflowRemovals({
    gridElement: options.gridElement,
    removableOverflow: options.removableOverflow,
    onCardRemoved: options.onCardRemoved,
    gridRect: options.gridRect,
    isTrackedCardElement: options.isTrackedCardElement,
    getElementRectSnapshot: options.getElementRectSnapshot,
    startLeavingCard: options.startLeavingCard,
    removeCuratedGridOverflowCard: options.removeCuratedGridOverflowCard,
  });
}
