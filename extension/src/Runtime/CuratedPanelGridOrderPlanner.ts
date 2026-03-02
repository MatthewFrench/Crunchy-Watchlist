type BoundaryValue = CwBoundaryValue;
type BoundaryRecord = Record<string, BoundaryValue>;

export type CuratedPanelGridOrderPlan = {
  visibleSeriesIds: Set<string>;
  nextCards: Element[];
};

type CuratedPanelGridOrderPlannerOptions = {
  visible: BoundaryRecord[];
  metadataLoading: boolean;
  createOrReuseCuratedCard: (entry: BoundaryRecord, detailsLoading: boolean, visibleSeriesIds: Set<string>) => Element;
  getEntrySeriesId: (entry: BoundaryRecord) => string;
  markCardControllerActive: (seriesId: string) => void;
  setCardParkedState: (card: Element, parked: boolean) => void;
  isRenderableEntryMetadataLoading: (entry: BoundaryRecord) => boolean;
};

export class CuratedPanelGridOrderPlannerOwner {
  readonly buildOrderPlan = (options: CuratedPanelGridOrderPlannerOptions): CuratedPanelGridOrderPlan => {
    const {
      visible,
      metadataLoading,
      createOrReuseCuratedCard,
      getEntrySeriesId,
      markCardControllerActive,
      setCardParkedState,
      isRenderableEntryMetadataLoading,
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

    return {
      visibleSeriesIds,
      nextCards,
    };
  };
}
