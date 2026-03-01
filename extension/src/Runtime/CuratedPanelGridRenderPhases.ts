type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

type CuratedGridReorderOptions = {
  onCardRemoved?: ((card: Element) => void) | null;
};

type ShouldSkipCuratedGridRenderOptions = {
  stateRenderSignature: string;
  gridRenderSignature: string;
  visible: BoundaryRecord[];
  total: number;
  loading: boolean;
  gridEl: Element;
  isCuratedCardElement: (value: BoundaryValue) => boolean;
  getEntrySeriesId: (entry: BoundaryRecord) => string;
  getElementDataAttribute: (element: Element, datasetKey: string, attributeName: string) => string;
  isCuratedGridEmptyElement: (value: BoundaryValue) => boolean;
};

type RenderEmptyCuratedGridStateOptions = {
  documentRef: Document;
  gridEl: Element;
  total: number;
  loading: boolean;
  parkGridCardsForReuse: (gridElement: Element) => void;
  parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>) => void;
  createCuratedGridEmptyElement: (documentRef: Document, total: number) => Element;
  trimParkedCardsForReuse: () => void;
};

type RenderVisibleCuratedGridStateOptions = {
  visible: BoundaryRecord[];
  metadataLoading: boolean;
  gridEl: Element;
  createOrReuseCuratedCard: (entry: BoundaryRecord, detailsLoading: boolean, visibleSeriesIds: Set<string>) => Element;
  getEntrySeriesId: (entry: BoundaryRecord) => string;
  markCardControllerActive: (seriesId: string) => void;
  setCardParkedState: (card: Element, parked: boolean) => void;
  isRenderableEntryMetadataLoading: (entry: BoundaryRecord) => boolean;
  reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[], options?: CuratedGridReorderOptions) => void;
  parkCardForReuse: (card: Element) => void;
  parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>) => void;
  trimParkedCardsForReuse: () => void;
};

type CuratedPanelGridRenderPhasesRuntime = {
  shouldSkipCuratedGridRender: (options: ShouldSkipCuratedGridRenderOptions) => boolean;
  renderEmptyCuratedGridState: (options: RenderEmptyCuratedGridStateOptions) => void;
  renderVisibleCuratedGridState: (options: RenderVisibleCuratedGridStateOptions) => void;
};

function shouldSkipCuratedGridRender(options: ShouldSkipCuratedGridRenderOptions): boolean {
  const {
    stateRenderSignature,
    gridRenderSignature,
    visible,
    total,
    loading,
    gridEl,
    isCuratedCardElement,
    getEntrySeriesId,
    getElementDataAttribute,
    isCuratedGridEmptyElement,
  } = options;

  if (stateRenderSignature !== gridRenderSignature) {
    return false;
  }

  const children = Array.from(gridEl.children);
  if (visible.length > 0) {
    return (
      children.length === visible.length &&
      children.every((child, index) => {
        if (!isCuratedCardElement(child)) {
          return false;
        }
        const expectedSeriesId = getEntrySeriesId(visible[index] || {});
        if (!expectedSeriesId) {
          return true;
        }
        const renderedSeriesId = getElementDataAttribute(child, 'cwSeriesId', 'data-cw-series-id');
        return renderedSeriesId === expectedSeriesId;
      })
    );
  }

  const firstChild = children[0];
  if (loading && total === 0 && children.length === 0) {
    return true;
  }

  return children.length === 1 && isCuratedGridEmptyElement(firstChild);
}

function renderEmptyCuratedGridState(options: RenderEmptyCuratedGridStateOptions): void {
  const {
    documentRef,
    gridEl,
    total,
    loading,
    parkGridCardsForReuse,
    parkUnusedControllersForReuse,
    createCuratedGridEmptyElement,
    trimParkedCardsForReuse,
  } = options;

  const visibleSeriesIds = new Set<string>();
  parkGridCardsForReuse(gridEl);
  parkUnusedControllersForReuse(visibleSeriesIds);
  gridEl.textContent = '';
  if (!(loading && total === 0)) {
    gridEl.appendChild(createCuratedGridEmptyElement(documentRef, total));
  }
  trimParkedCardsForReuse();
}

function renderVisibleCuratedGridState(options: RenderVisibleCuratedGridStateOptions): void {
  const {
    visible,
    metadataLoading,
    gridEl,
    createOrReuseCuratedCard,
    getEntrySeriesId,
    markCardControllerActive,
    setCardParkedState,
    isRenderableEntryMetadataLoading,
    reorderCuratedGridChildren,
    parkCardForReuse,
    parkUnusedControllersForReuse,
    trimParkedCardsForReuse,
  } = options;

  const visibleSeriesIds = new Set<string>();
  const nextCards = visible.map((entry) => {
    const nextCard = createOrReuseCuratedCard(
      entry,
      metadataLoading && isRenderableEntryMetadataLoading(entry),
      visibleSeriesIds,
    );
    const seriesId = getEntrySeriesId(entry);
    markCardControllerActive(seriesId);
    setCardParkedState(nextCard, false);
    return nextCard;
  });

  reorderCuratedGridChildren(gridEl, nextCards, {
    onCardRemoved: (removedCard) => {
      parkCardForReuse(removedCard);
    },
  });

  parkUnusedControllersForReuse(visibleSeriesIds);
  trimParkedCardsForReuse();
}

export function createCuratedPanelGridRenderPhasesRuntime(): CuratedPanelGridRenderPhasesRuntime {
  return {
    shouldSkipCuratedGridRender,
    renderEmptyCuratedGridState,
    renderVisibleCuratedGridState,
  };
}
