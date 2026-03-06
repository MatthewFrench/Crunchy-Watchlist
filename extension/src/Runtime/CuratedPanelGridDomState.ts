type CuratedGridDomState = {
  activeCards: Element[];
};

const domStateByGridElement = new WeakMap<Element, CuratedGridDomState>();

function resolveCuratedGridDomState(gridElement: Element): CuratedGridDomState {
  const existingState = domStateByGridElement.get(gridElement);
  if (existingState) {
    return existingState;
  }

  const nextState: CuratedGridDomState = {
    activeCards: [],
  };
  domStateByGridElement.set(gridElement, nextState);
  return nextState;
}

export function readCuratedGridActiveCards(gridElement: Element): Element[] {
  const liveChildren = Array.from(gridElement.children).filter(
    (child) => !(child as Element & { className?: string }).className?.includes('cw-curated-card--parked'),
  );
  const existingState = domStateByGridElement.get(gridElement);
  if (!existingState || existingState.activeCards.length === 0) {
    return liveChildren;
  }

  const activeCards = existingState.activeCards.filter((card) => {
    const parentNode = (card as Element & { parentNode?: object | null }).parentNode;
    return (
      parentNode === gridElement && !(card as Element & { className?: string }).className?.includes('cw-curated-card--parked')
    );
  });
  if (activeCards.length !== existingState.activeCards.length) {
    existingState.activeCards = [...activeCards];
  }
  if (activeCards.length === 0) {
    return liveChildren;
  }
  return [...activeCards];
}

export function writeCuratedGridActiveCards(gridElement: Element, activeCards: Element[]): void {
  const state = resolveCuratedGridDomState(gridElement);
  state.activeCards = [...activeCards];
}

export function clearCuratedGridDomState(gridElement: Element): void {
  domStateByGridElement.delete(gridElement);
}
