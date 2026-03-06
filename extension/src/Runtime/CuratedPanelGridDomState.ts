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
  const existingState = domStateByGridElement.get(gridElement);
  if (!existingState || existingState.activeCards.length === 0) {
    return Array.from(gridElement.children).filter(
      (child) => !(child as Element & { className?: string }).className?.includes('cw-curated-card--parked'),
    );
  }
  return [...existingState.activeCards];
}

export function writeCuratedGridActiveCards(gridElement: Element, activeCards: Element[]): void {
  const state = resolveCuratedGridDomState(gridElement);
  state.activeCards = [...activeCards];
}

export function clearCuratedGridDomState(gridElement: Element): void {
  domStateByGridElement.delete(gridElement);
}
