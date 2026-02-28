export type CuratedGridReorderOptions = {
  onCardRemoved?: ((card: Element) => void) | null;
};

type CuratedPanelGridRenderPhasesRuntime = {
  shouldSkipCuratedGridRender: (options: Record<string, unknown>) => boolean;
  renderEmptyCuratedGridState: (options: Record<string, unknown>) => void;
  renderVisibleCuratedGridState: (options: Record<string, unknown>) => void;
};

type CuratedPanelGridTransitionsRuntime = {
  reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[], options?: CuratedGridReorderOptions) => void;
};

export type CuratedGridRenderContext = {
  stateRenderSignature: string;
  gridRenderSignature: string;
  visible: Array<Record<string, unknown>>;
  total: number;
  loading: boolean;
  metadataLoading: boolean;
  gridEl: Element;
  transitionsRuntime: CuratedPanelGridTransitionsRuntime;
  renderPhasesRuntime: CuratedPanelGridRenderPhasesRuntime;
  isCuratedCardElement: (value: unknown) => boolean;
  getEntrySeriesId: (entry: Record<string, unknown>) => string;
  getElementDataAttribute: (element: Element, datasetKey: string, attributeName: string) => string;
  isCuratedGridEmptyElement: (value: unknown) => boolean;
  isRenderableEntryMetadataLoading: (entry: Record<string, unknown>) => boolean;
  setCardParkedState: (card: Element, parked: boolean) => void;
  parkGridCardsForReuse: (gridElement: Element) => void;
  parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>) => void;
  createCuratedGridEmptyElement: (documentRef: Document, total: number) => Element;
  trimParkedCardsForReuse: () => void;
  createOrReuseCuratedCard: (
    entry: Record<string, unknown>,
    detailsLoading: boolean,
    visibleSeriesIds: Set<string>,
  ) => Element;
  markCardControllerActive: (seriesId: string) => void;
  parkCardForReuse: (card: Element) => void;
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
    parkCardForReuse: context.parkCardForReuse,
    parkUnusedControllersForReuse: context.parkUnusedControllersForReuse,
    trimParkedCardsForReuse: context.trimParkedCardsForReuse,
  });
}

export function renderCuratedGridPass(context: CuratedGridRenderContext): void {
  if (!context.visible.length) {
    renderEmptyCuratedGridPass(context);
    return;
  }
  renderVisibleCuratedGridPass(context);
}
