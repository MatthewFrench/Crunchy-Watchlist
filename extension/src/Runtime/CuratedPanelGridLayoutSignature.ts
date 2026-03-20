import type { CuratedGridRenderCard } from './CuratedPanelGridRenderCard.js';

export function buildCuratedGridLayoutSignature(nextCards: CuratedGridRenderCard[], gridWidthPx: number, gapPx: number): string {
  return [
    `w:${Math.round(gridWidthPx)}`,
    `g:${Math.round(gapPx)}`,
    `c:${nextCards.length}`,
    ...nextCards.map((card) =>
      [
        card.seriesId,
        card.contentSignature,
        card.detailsLoading ? 'true' : 'false',
      ].join(':'),
    ),
  ].join('|');
}
