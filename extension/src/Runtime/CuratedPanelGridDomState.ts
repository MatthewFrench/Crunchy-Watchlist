type CuratedGridDomState = {
  projectedChildren: Element[];
  projectedSeriesIds: string[];
};

const domStateByGridElement = new WeakMap<Element, CuratedGridDomState>();

function resolveCuratedGridDomState(gridElement: Element): CuratedGridDomState {
  const existingState = domStateByGridElement.get(gridElement);
  if (existingState) {
    return existingState;
  }

  const nextState: CuratedGridDomState = {
    projectedChildren: [],
    projectedSeriesIds: [],
  };
  domStateByGridElement.set(gridElement, nextState);
  return nextState;
}

export function readProjectedCuratedGridChildren(gridElement: Element): Element[] {
  const existingState = domStateByGridElement.get(gridElement);
  if (!existingState) {
    return [];
  }

  const projectedChildren = existingState.projectedChildren.filter((child) => {
    const parentNode = (child as Element & { parentNode?: object | null }).parentNode;
    return (
      parentNode === gridElement &&
      !(child as Element & { className?: string }).className?.includes('cw-curated-card--parked')
    );
  });
  if (projectedChildren.length !== existingState.projectedChildren.length) {
    existingState.projectedChildren = [...projectedChildren];
  }
  return [...projectedChildren];
}

export function readProjectedCuratedGridSeriesIds(gridElement: Element): string[] {
  const existingState = domStateByGridElement.get(gridElement);
  if (!existingState) {
    return [];
  }
  return [...existingState.projectedSeriesIds];
}

export function writeProjectedCuratedGridChildren(
  gridElement: Element,
  activeCards: Element[],
  projectedSeriesIds: string[] = [],
): void {
  const state = resolveCuratedGridDomState(gridElement);
  state.projectedChildren = [...activeCards];
  state.projectedSeriesIds = projectedSeriesIds.filter(Boolean);
}

export function clearCuratedGridDomState(gridElement: Element): void {
  domStateByGridElement.delete(gridElement);
}
