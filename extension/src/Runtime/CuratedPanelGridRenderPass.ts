type CuratedBoundaryValue = CwBoundaryValue;
export type CuratedGridEntry = Record<string, CuratedBoundaryValue>;
type CuratedElementPredicate = (value: CuratedBoundaryValue) => boolean;

export type CuratedGridReorderOptions = {
  onCardRemoved?: ((card: Element) => void) | null;
  shouldRetainCardInGrid?: ((card: Element) => boolean) | null;
};

export type CuratedPanelGridTransitionsRuntime = {
  reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[], options?: CuratedGridReorderOptions) => void;
};

export type ShouldSkipCuratedGridRenderOptions = {
  stateRenderSignature: string;
  gridRenderSignature: string;
  visible: CuratedGridEntry[];
  total: number;
  loading: boolean;
  gridEl: Element;
  isCuratedCardElement: CuratedElementPredicate;
  getEntrySeriesId: (entry: CuratedGridEntry) => string;
  getElementDataAttribute: (element: Element, datasetKey: string, attributeName: string) => string;
  isCuratedGridEmptyElement: CuratedElementPredicate;
};

export type RenderEmptyCuratedGridStateOptions = {
  documentRef: Document;
  gridEl: Element;
  total: number;
  loading: boolean;
  parkGridCardsForReuse: (gridElement: Element) => void;
  parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>, retainedSeriesIds?: Set<string>) => void;
  createCuratedGridEmptyElement: (documentRef: Document, total: number) => Element;
  trimParkedCardsForReuse: () => void;
};

export type RenderVisibleCuratedGridStateOptions = {
  visible: CuratedGridEntry[];
  loadedSeriesIds: Set<string>;
  metadataLoading: boolean;
  gridEl: Element;
  createOrReuseCuratedCard: (
    entry: CuratedGridEntry,
    detailsLoading: boolean,
    visibleSeriesIds: Set<string>,
  ) => Element;
  getEntrySeriesId: (entry: CuratedGridEntry) => string;
  markCardControllerActive: (seriesId: string) => void;
  setCardParkedState: (card: Element, parked: boolean) => void;
  isRenderableEntryMetadataLoading: (entry: CuratedGridEntry) => boolean;
  reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[], options?: CuratedGridReorderOptions) => void;
  shouldRetainCardInGrid: (card: Element) => boolean;
  parkCardForReuse: (card: Element) => void;
  parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>, retainedSeriesIds?: Set<string>) => void;
  trimParkedCardsForReuse: () => void;
};

export type CuratedPanelGridRenderPhasesRuntime = {
  shouldSkipCuratedGridRender: (options: ShouldSkipCuratedGridRenderOptions) => boolean;
  renderEmptyCuratedGridState: (options: RenderEmptyCuratedGridStateOptions) => void;
  renderVisibleCuratedGridState: (options: RenderVisibleCuratedGridStateOptions) => void;
};

export type CuratedGridRenderContext = {
  stateRenderSignature: string;
  gridRenderSignature: string;
  visible: CuratedGridEntry[];
  loadedSeriesIds: Set<string>;
  total: number;
  loading: boolean;
  metadataLoading: boolean;
  gridEl: Element;
  transitionsRuntime: CuratedPanelGridTransitionsRuntime;
  renderPhasesRuntime: CuratedPanelGridRenderPhasesRuntime;
  isCuratedCardElement: CuratedElementPredicate;
  getEntrySeriesId: (entry: CuratedGridEntry) => string;
  getElementDataAttribute: (element: Element, datasetKey: string, attributeName: string) => string;
  isCuratedGridEmptyElement: CuratedElementPredicate;
  isRenderableEntryMetadataLoading: (entry: CuratedGridEntry) => boolean;
  setCardParkedState: (card: Element, parked: boolean) => void;
  parkGridCardsForReuse: (gridElement: Element) => void;
  parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>, retainedSeriesIds?: Set<string>) => void;
  createCuratedGridEmptyElement: (documentRef: Document, total: number) => Element;
  trimParkedCardsForReuse: () => void;
  createOrReuseCuratedCard: (
    entry: CuratedGridEntry,
    detailsLoading: boolean,
    visibleSeriesIds: Set<string>,
  ) => Element;
  markCardControllerActive: (seriesId: string) => void;
  parkCardForReuse: (card: Element) => void;
  shouldRetainCardInGrid: (card: Element) => boolean;
  documentRef: Document;
};

export function shouldSkipCuratedGridRenderPass(context: CuratedGridRenderContext): boolean {
  return context.renderPhasesRuntime.shouldSkipCuratedGridRender({
    stateRenderSignature: context.stateRenderSignature,
    gridRenderSignature: context.gridRenderSignature,
    visible: context.visible,
    total: context.total,
    loading: context.loading,
    gridEl: context.gridEl,
    isCuratedCardElement: context.isCuratedCardElement,
    getEntrySeriesId: context.getEntrySeriesId,
    getElementDataAttribute: context.getElementDataAttribute,
    isCuratedGridEmptyElement: context.isCuratedGridEmptyElement,
  });
}

function renderEmptyCuratedGridPass(context: CuratedGridRenderContext): void {
  context.renderPhasesRuntime.renderEmptyCuratedGridState({
    documentRef: context.documentRef,
    gridEl: context.gridEl,
    total: context.total,
    loading: context.loading,
    parkGridCardsForReuse: context.parkGridCardsForReuse,
    parkUnusedControllersForReuse: context.parkUnusedControllersForReuse,
    createCuratedGridEmptyElement: context.createCuratedGridEmptyElement,
    trimParkedCardsForReuse: context.trimParkedCardsForReuse,
  });
}

function renderVisibleCuratedGridPass(context: CuratedGridRenderContext): void {
  context.renderPhasesRuntime.renderVisibleCuratedGridState({
    visible: context.visible,
    loadedSeriesIds: context.loadedSeriesIds,
    metadataLoading: context.metadataLoading,
    gridEl: context.gridEl,
    createOrReuseCuratedCard: context.createOrReuseCuratedCard,
    getEntrySeriesId: context.getEntrySeriesId,
    markCardControllerActive: context.markCardControllerActive,
    setCardParkedState: context.setCardParkedState,
    isRenderableEntryMetadataLoading: context.isRenderableEntryMetadataLoading,
    reorderCuratedGridChildren: (
      gridElement: Element,
      nextCards: Element[],
      reorderOptions?: CuratedGridReorderOptions,
    ) => {
      context.transitionsRuntime.reorderCuratedGridChildren(gridElement, nextCards, reorderOptions);
    },
    shouldRetainCardInGrid: context.shouldRetainCardInGrid,
    parkCardForReuse: context.parkCardForReuse,
    parkUnusedControllersForReuse: context.parkUnusedControllersForReuse,
    trimParkedCardsForReuse: context.trimParkedCardsForReuse,
  });
}

export function renderCuratedGridPass(context: CuratedGridRenderContext): void {
  if (!context.visible.length) {
    if (context.total > 0) {
      renderVisibleCuratedGridPass(context);
      return;
    }
    renderEmptyCuratedGridPass(context);
    return;
  }
  renderVisibleCuratedGridPass(context);
}
