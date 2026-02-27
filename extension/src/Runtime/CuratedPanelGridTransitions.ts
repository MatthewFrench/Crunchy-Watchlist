;(() => {
  type RectSnapshot = {
    left: number
    top: number
    width: number
    height: number
  }

  type LeavingCardSnapshot = {
    card: Element
    rect: RectSnapshot
  }

  type CuratedPanelGridTransitionsRuntime = {
    reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[]) => void
  }

  const root = (typeof window !== 'undefined' ? window : globalThis) as Window & typeof globalThis
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>
  const cardMoveDurationMs = 220
  const cardExitDurationMs = 180

  function toggleClassNameToken(className: string, token: string, enabled: boolean): string {
    const classTokens = className
      .split(' ')
      .map((item) => item.trim())
      .filter(Boolean)
    const hasToken = classTokens.includes(token)
    if (enabled && !hasToken) {
      classTokens.push(token)
    }
    if (!enabled && hasToken) {
      return classTokens.filter((item) => item !== token).join(' ')
    }
    return classTokens.join(' ')
  }

  function hasClassToken(className: unknown, token: string): boolean {
    return (
      typeof className === 'string' &&
      className
        .split(' ')
        .map((item) => item.trim())
        .filter(Boolean)
        .includes(token)
    )
  }

  function isCardElement(value: unknown): value is Element {
    if (!value || typeof value !== 'object') {
      return false
    }
    const className = (value as Element & { className?: string }).className
    return hasClassToken(className, 'cw-curated-card') && !hasClassToken(className, 'cw-curated-card--leaving')
  }

  function toRectSnapshot(
    value: DOMRect | { left?: unknown; top?: unknown; width?: unknown; height?: unknown },
  ): RectSnapshot {
    return {
      left: Number(value.left) || 0,
      top: Number(value.top) || 0,
      width: Number(value.width) || 0,
      height: Number(value.height) || 0,
    }
  }

  function getElementRectSnapshot(element: Element): RectSnapshot | null {
    const measurableElement = element as Element & {
      getBoundingClientRect?: () => DOMRect
    }
    if (typeof measurableElement.getBoundingClientRect !== 'function') {
      return null
    }

    return toRectSnapshot(measurableElement.getBoundingClientRect())
  }

  function canAnimateCards(gridElement: Element, cards: Element[]): boolean {
    if (!cards.length) {
      return false
    }

    if (typeof (gridElement as Element & { appendChild?: unknown }).appendChild !== 'function') {
      return false
    }

    return cards.every((card) => getElementRectSnapshot(card) != null)
  }

  function captureCardRects(cards: Element[]): Map<Element, RectSnapshot> {
    const snapshots = new Map<Element, RectSnapshot>()
    cards.forEach((card) => {
      const snapshot = getElementRectSnapshot(card)
      if (snapshot) {
        snapshots.set(card, snapshot)
      }
    })
    return snapshots
  }

  function markCardEntering(card: Element): void {
    const cardElement = card as Element & { className?: string }
    cardElement.className = toggleClassNameToken(cardElement.className || '', 'cw-curated-card--entering', true)

    const removeEnterClass = () => {
      cardElement.className = toggleClassNameToken(cardElement.className || '', 'cw-curated-card--entering', false)
    }

    if (typeof root.requestAnimationFrame === 'function') {
      root.requestAnimationFrame(() => {
        root.requestAnimationFrame(removeEnterClass)
      })
      return
    }

    setTimeout(removeEnterClass, 0)
  }

  function animateCardMove(card: Element, previousRect: RectSnapshot, currentRect: RectSnapshot): void {
    const deltaX = previousRect.left - currentRect.left
    const deltaY = previousRect.top - currentRect.top
    if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
      return
    }

    const animatedElement = card as Element & {
      animate?: (
        keyframes: Keyframe[] | PropertyIndexedKeyframes,
        options?: number | KeyframeAnimationOptions,
      ) => Animation
    }
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
      )
      return
    }

    const styledElement = card as Element & {
      style?: Record<string, string>
      getBoundingClientRect?: () => DOMRect
    }
    if (!styledElement.style) {
      return
    }

    styledElement.style.transition = 'none'
    styledElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`
    if (typeof styledElement.getBoundingClientRect === 'function') {
      styledElement.getBoundingClientRect()
    }
    styledElement.style.transition = ''
    styledElement.style.transform = ''
  }

  function createLeavingCardSnapshots(gridElement: Element, nextCards: Element[]): LeavingCardSnapshot[] {
    const nextCardSet = new Set(nextCards)
    return Array.from(gridElement.children)
      .filter((child) => isCardElement(child) && !nextCardSet.has(child))
      .map((child) => {
        const rect = getElementRectSnapshot(child)
        if (!rect) {
          return null
        }
        return {
          card: child,
          rect,
        }
      })
      .filter((snapshot): snapshot is LeavingCardSnapshot => snapshot != null)
  }

  function animateRemovedCards(gridElement: Element, leavingCardSnapshots: LeavingCardSnapshot[]): void {
    if (!leavingCardSnapshots.length) {
      return
    }

    const gridRect = getElementRectSnapshot(gridElement)
    if (!gridRect) {
      return
    }

    // Clone + overlay removed cards so filter/sort removals can fade out without blocking grid reflow.
    leavingCardSnapshots.forEach(({ card, rect }) => {
      const cloneSource = card as Element & { cloneNode?: (deep?: boolean) => Node }
      if (typeof cloneSource.cloneNode !== 'function') {
        return
      }

      const clonedNode = cloneSource.cloneNode(true)
      const leavingCard = clonedNode as Element & {
        className?: string
        style?: Record<string, string>
        removeAttribute?: (name: string) => void
        setAttribute?: (name: string, value: string) => void
        animate?: (
          keyframes: Keyframe[] | PropertyIndexedKeyframes,
          options?: number | KeyframeAnimationOptions,
        ) => Animation
      }
      if (!leavingCard || !leavingCard.style) {
        return
      }

      leavingCard.className = toggleClassNameToken(leavingCard.className || '', 'cw-curated-card--leaving', true)
      leavingCard.removeAttribute?.('data-cw-curated-title')
      leavingCard.removeAttribute?.('data-cw-series-id')
      leavingCard.removeAttribute?.('data-cw-card-content-signature')
      leavingCard.removeAttribute?.('data-cw-loading-details')
      leavingCard.setAttribute?.('data-cw-transition-clone', 'true')
      leavingCard.style.position = 'absolute'
      leavingCard.style.left = `${Math.max(0, rect.left - gridRect.left)}px`
      leavingCard.style.top = `${Math.max(0, rect.top - gridRect.top)}px`
      leavingCard.style.width = `${Math.max(0, rect.width)}px`
      leavingCard.style.height = `${Math.max(0, rect.height)}px`
      leavingCard.style.zIndex = '2'
      leavingCard.style.pointerEvents = 'none'
      leavingCard.style.margin = '0'

      gridElement.appendChild(leavingCard)

      const removeClone = () => {
        if (leavingCard.parentNode === gridElement) {
          gridElement.removeChild(leavingCard)
        }
      }

      if (typeof leavingCard.animate === 'function') {
        const animation = leavingCard.animate(
          [
            {
              opacity: 1,
              transform: 'translateY(0px) scale(1)',
            },
            {
              opacity: 0,
              transform: 'translateY(6px) scale(0.985)',
            },
          ],
          {
            duration: cardExitDurationMs,
            easing: 'ease-out',
            fill: 'forwards',
          },
        )
        animation.addEventListener('finish', removeClone, { once: true })
      } else {
        leavingCard.style.opacity = '0'
        setTimeout(removeClone, cardExitDurationMs)
      }
    })
  }

  function reorderCuratedGridChildrenBare(gridElement: Element, nextCards: Element[]): void {
    nextCards.forEach((nextCard, index) => {
      const currentChild = gridElement.children[index] || null
      if (currentChild === nextCard) {
        return
      }
      gridElement.insertBefore(nextCard, currentChild)
    })

    while (gridElement.children.length > nextCards.length) {
      const overflow = gridElement.children[nextCards.length]
      if (!overflow) {
        break
      }
      gridElement.removeChild(overflow)
    }
  }

  function reorderCuratedGridChildren(gridElement: Element, nextCards: Element[]): void {
    const existingCards = Array.from(gridElement.children).filter((child) => isCardElement(child))
    const shouldAnimate = canAnimateCards(gridElement, existingCards)
    if (!shouldAnimate) {
      reorderCuratedGridChildrenBare(gridElement, nextCards)
      return
    }

    const previousRectsByCard = captureCardRects(existingCards)
    const leavingCardSnapshots = createLeavingCardSnapshots(gridElement, nextCards)
    reorderCuratedGridChildrenBare(gridElement, nextCards)
    animateRemovedCards(gridElement, leavingCardSnapshots)

    nextCards.forEach((card) => {
      const previousRect = previousRectsByCard.get(card) || null
      const currentRect = getElementRectSnapshot(card)
      if (!currentRect) {
        return
      }

      if (!previousRect) {
        markCardEntering(card)
        return
      }

      animateCardMove(card, previousRect, currentRect)
    })
  }

  function createCuratedPanelGridTransitionsRuntime(): CuratedPanelGridTransitionsRuntime {
    return {
      reorderCuratedGridChildren,
    }
  }

  moduleRegistry.runtimeCuratedPanelGridTransitions = {
    createCuratedPanelGridTransitionsRuntime,
  }
})()
