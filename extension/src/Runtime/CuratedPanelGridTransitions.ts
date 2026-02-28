(() => {
  type RectSnapshot = {
    left: number;
    top: number;
    width: number;
    height: number;
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

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis;
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>;
  const cardMoveDurationMs = 220;
  const maxAnimatedCardCount = 120;

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

  function isTrackedCardElement(value: unknown): value is Element {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const element = value as Element & {
      dataset?: Record<string, string>;
      getAttribute?: (name: string) => string | null;
    };
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
    value: DOMRect | { left?: unknown; top?: unknown; width?: unknown; height?: unknown },
  ): RectSnapshot {
    return {
      left: Number(value.left) || 0,
      top: Number(value.top) || 0,
      width: Number(value.width) || 0,
      height: Number(value.height) || 0,
    };
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

  function canAnimateCards(gridElement: Element, cards: Element[], nextCards: Element[]): boolean {
    if (!cards.length) {
      return false;
    }

    if (typeof (gridElement as Element & { appendChild?: unknown }).appendChild !== 'function') {
      return false;
    }

    if (Math.max(cards.length, nextCards.length) > maxAnimatedCardCount) {
      return false;
    }

    return cards.every((card) => getElementRectSnapshot(card) != null);
  }

  function hasIdenticalChildOrder(gridElement: Element, nextCards: Element[]): boolean {
    const currentChildren = Array.from(gridElement.children);
    if (currentChildren.length !== nextCards.length) {
      return false;
    }
    return currentChildren.every((child, index) => child === nextCards[index]);
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

    const animatedElement = card as Element & {
      animate?: (
        keyframes: Keyframe[] | PropertyIndexedKeyframes,
        options?: number | KeyframeAnimationOptions,
      ) => Animation;
    };
    if (typeof animatedElement.animate === 'function') {
      animatedElement.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px)`,
          },
          {
            transform: 'translate(0px, 0px)',
          },
        ],
        {
          duration: cardMoveDurationMs,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        },
      );
      return;
    }

    const styledElement = card as Element & {
      style?: Record<string, string>;
      getBoundingClientRect?: () => DOMRect;
    };
    if (!styledElement.style) {
      return;
    }

    styledElement.style.transition = 'none';
    styledElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    if (typeof styledElement.getBoundingClientRect === 'function') {
      styledElement.getBoundingClientRect();
    }
    styledElement.style.transition = '';
    styledElement.style.transform = '';
  }

  function reorderCuratedGridChildrenBare(
    gridElement: Element,
    nextCards: Element[],
    onCardRemoved: ((card: Element) => void) | null,
  ): void {
    nextCards.forEach((nextCard, index) => {
      const currentChild = gridElement.children[index] || null;
      if (currentChild === nextCard) {
        return;
      }
      gridElement.insertBefore(nextCard, currentChild);
    });

    while (gridElement.children.length > nextCards.length) {
      const overflow = gridElement.children[nextCards.length];
      if (!overflow) {
        break;
      }
      gridElement.removeChild(overflow);
      if (onCardRemoved && isTrackedCardElement(overflow)) {
        onCardRemoved(overflow);
      }
    }
  }

  function reorderCuratedGridChildren(
    gridElement: Element,
    nextCards: Element[],
    options: CuratedGridReorderOptions = {},
  ): void {
    const onCardRemoved = typeof options.onCardRemoved === 'function' ? options.onCardRemoved : null;

    // Favor responsiveness when a render only patches card internals (for example favorite toggles).
    if (hasIdenticalChildOrder(gridElement, nextCards)) {
      return;
    }

    const nextCardsSet = new Set(nextCards);
    const existingCards = Array.from(gridElement.children).filter((child) => nextCardsSet.has(child));
    const shouldAnimate = canAnimateCards(gridElement, existingCards, nextCards);
    if (!shouldAnimate) {
      reorderCuratedGridChildrenBare(gridElement, nextCards, onCardRemoved);
      return;
    }

    const previousRectsByCard = captureCardRects(existingCards);
    reorderCuratedGridChildrenBare(gridElement, nextCards, onCardRemoved);

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

  function createCuratedPanelGridTransitionsRuntime(): CuratedPanelGridTransitionsRuntime {
    return {
      reorderCuratedGridChildren,
    };
  }

  moduleRegistry.runtimeCuratedPanelGridTransitions = {
    createCuratedPanelGridTransitionsRuntime,
  };
})();
