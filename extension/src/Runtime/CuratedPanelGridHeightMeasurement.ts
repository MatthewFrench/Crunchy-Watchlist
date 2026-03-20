import type { CuratedGridRenderCard } from './CuratedPanelGridRenderCard.js';

export type CuratedGridPreparedHeightMeasurement = {
  previousHeightPx: number;
  measurementSignature: string;
  cachedNaturalHeightPx: number | null;
};

const naturalHeightByCardElement = new WeakMap<
  Element,
  {
    measurementSignature: string;
    naturalHeightPx: number;
  }
>();

function buildCardMeasurementSignature(card: CuratedGridRenderCard, cardWidthPx: number): string {
  return [
    Math.max(1, Math.round(cardWidthPx)),
    card.contentSignature,
    card.detailsLoading ? 'true' : 'false',
  ].join('|');
}

export function prepareCuratedGridHeightMeasurements(
  nextCards: CuratedGridRenderCard[],
  cardWidthPx: number,
  getElementStyleRecord: (value: Element) => Record<string, string> | null,
  parseNonNegativePixelValue: (value: string) => number,
): CuratedGridPreparedHeightMeasurement[] {
  const roundedWidthPx = `${Math.max(1, Math.round(cardWidthPx))}px`;

  return nextCards.map((card) => {
    const style = getElementStyleRecord(card.card);
    const measurementSignature = buildCardMeasurementSignature(card, cardWidthPx);
    const cachedMeasurement = naturalHeightByCardElement.get(card.card);
    const cachedNaturalHeightPx =
      cachedMeasurement && cachedMeasurement.measurementSignature === measurementSignature
        ? cachedMeasurement.naturalHeightPx
        : null;
    const previousHeightPx = style ? parseNonNegativePixelValue(style.height || '') : 0;

    if (style) {
      style.position = 'absolute';
      style.margin = '0';
      style.width = roundedWidthPx;
      style.maxWidth = roundedWidthPx;
      // Only clear height when we actually need a fresh natural measurement.
      if (cachedNaturalHeightPx == null) {
        style.height = '';
      }
    }

    return {
      previousHeightPx,
      measurementSignature,
      cachedNaturalHeightPx,
    };
  });
}

export function resolveCuratedGridCardHeights(
  nextCards: CuratedGridRenderCard[],
  measurements: CuratedGridPreparedHeightMeasurement[],
  getElementRectSnapshot: (element: Element) => { height: number } | null,
  resolveFallbackCardHeightPx: (card: Element, previousHeightPx: number) => number,
): number[] {
  return nextCards.map((card, index) => {
    const measurement = measurements[index];
    if (measurement?.cachedNaturalHeightPx != null && measurement.cachedNaturalHeightPx > 0) {
      return measurement.cachedNaturalHeightPx;
    }

    const cardRect = getElementRectSnapshot(card.card);
    const fallbackHeight = resolveFallbackCardHeightPx(card.card, measurement?.previousHeightPx || 0);
    const resolvedHeight = cardRect && cardRect.height > 0 ? cardRect.height : fallbackHeight > 0 ? fallbackHeight : 0;

    if (resolvedHeight > 0 && measurement?.measurementSignature) {
      naturalHeightByCardElement.set(card.card, {
        measurementSignature: measurement.measurementSignature,
        naturalHeightPx: resolvedHeight,
      });
    } else {
      naturalHeightByCardElement.delete(card.card);
    }

    return resolvedHeight;
  });
}
