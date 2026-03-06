import { clearCuratedGridDomState } from './CuratedPanelGridDomState.js';

type CuratedGridReorderOptions = {
  onCardRemoved?: ((card: Element) => void) | null;
  shouldRetainCardInGrid?: ((card: Element) => boolean) | null;
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
  gridEl: Element;
  nextCards: Element[];
  visibleSeriesIds: Set<string>;
  loadedSeriesIds: Set<string>;
  reorderCuratedGridChildren: (gridElement: Element, nextCards: Element[], options?: CuratedGridReorderOptions) => void;
  shouldRetainCardInGrid: (card: Element) => boolean;
  parkCardForReuse: (card: Element) => void;
  parkUnusedControllersForReuse: (visibleSeriesIds: Set<string>, retainedSeriesIds?: Set<string>) => void;
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
    clearCuratedGridDomState(gridEl);
    const gridStyle = (gridEl as Element & { style?: Record<string, string> }).style;
    if (gridStyle) {
      gridStyle.height = '';
    }
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
      loadedSeriesIds,
      reorderCuratedGridChildren,
      shouldRetainCardInGrid,
      parkCardForReuse,
      parkUnusedControllersForReuse,
      trimParkedCardsForReuse,
    } = options;

    reorderCuratedGridChildren(gridEl, nextCards, {
      onCardRemoved: (removedCard) => {
        parkCardForReuse(removedCard);
      },
      shouldRetainCardInGrid,
    });

    parkUnusedControllersForReuse(visibleSeriesIds, loadedSeriesIds);
    trimParkedCardsForReuse();
  };
}
