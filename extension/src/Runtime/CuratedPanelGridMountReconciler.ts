type CuratedGridReorderOptions = {
  onCardRemoved?: ((card: Element) => void) | null;
};

export type RenderEmptyCuratedGridStateOptions = {
  documentRef: Document;
  gridEl: Element;
  total: number;
  loading: boolean;
  parkGridCardsForReuse: (gridElement: Element) => void;
  parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>) => void;
  createCuratedGridEmptyElement: (documentRef: Document, total: number) => Element;
  trimParkedCardsForReuse: () => void;
};

export type RenderVisibleCuratedGridStateOptions = {
  gridEl: Element;
  nextCards: Element[];
  visibleSeriesIds: Set<string>;
  reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[], options?: CuratedGridReorderOptions) => void;
  parkCardForReuse: (card: Element) => void;
  parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>) => void;
  trimParkedCardsForReuse: () => void;
};

export class CuratedPanelGridMountReconcilerOwner {
  readonly renderEmptyState = (options: RenderEmptyCuratedGridStateOptions): void => {
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
  };

  readonly renderVisibleState = (options: RenderVisibleCuratedGridStateOptions): void => {
    const {
      gridEl,
      nextCards,
      visibleSeriesIds,
      reorderCuratedGridChildren,
      parkCardForReuse,
      parkUnusedControllersForReuse,
      trimParkedCardsForReuse,
    } = options;

    reorderCuratedGridChildren(gridEl, nextCards, {
      onCardRemoved: (removedCard) => {
        parkCardForReuse(removedCard);
      },
    });

    parkUnusedControllersForReuse(visibleSeriesIds);
    trimParkedCardsForReuse();
  };
}
