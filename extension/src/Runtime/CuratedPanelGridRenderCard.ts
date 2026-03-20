export type CuratedCardTransitionState = {
  absolutePositionSeeded: boolean;
  centerIntroStaged: boolean;
};

export type CuratedGridRenderCard = {
  seriesId: string;
  card: Element;
  contentSignature: string;
  detailsLoading: boolean;
  transitionState: CuratedCardTransitionState;
};

export function createCuratedCardTransitionState(): CuratedCardTransitionState {
  return {
    absolutePositionSeeded: false,
    centerIntroStaged: false,
  };
}
