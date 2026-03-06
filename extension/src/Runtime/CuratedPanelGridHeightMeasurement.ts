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

function readTrackedElementDataAttribute(element: Element, datasetKey: string, attributeName: string): string {
  const trackedElement = element as Element & {
    dataset?: Record<string, string>;
    getAttribute?: (name: string) => string | null;
  };
  const datasetValue = trackedElement.dataset?.[datasetKey];
  if (typeof datasetValue === 'string' && datasetValue) {
    return datasetValue;
  }
  if (typeof trackedElement.getAttribute === 'function') {
    return trackedElement.getAttribute(attributeName) || '';
  }
  return '';
}

function buildCardMeasurementSignature(card: Element, cardWidthPx: number): string {
  return [
    Math.max(1, Math.round(cardWidthPx)),
    readTrackedElementDataAttribute(card, 'cwCardContentSignature', 'data-cw-card-content-signature'),
    readTrackedElementDataAttribute(card, 'cwLoadingDetails', 'data-cw-loading-details'),
  ].join('|');
}

export function prepareCuratedGridHeightMeasurements(
  nextCards: Element[],
  cardWidthPx: number,
  getElementStyleRecord: (value: Element) => Record<string, string> | null,
  parseNonNegativePixelValue: (value: string) => number,
): CuratedGridPreparedHeightMeasurement[] {
  const roundedWidthPx = `${Math.max(1, Math.round(cardWidthPx))}px`;

  return nextCards.map((card) => {
    const style = getElementStyleRecord(card);
    const measurementSignature = buildCardMeasurementSignature(card, cardWidthPx);
    const cachedMeasurement = naturalHeightByCardElement.get(card);
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
  nextCards: Element[],
  measurements: CuratedGridPreparedHeightMeasurement[],
  getElementRectSnapshot: (element: Element) => { height: number } | null,
  resolveFallbackCardHeightPx: (card: Element, previousHeightPx: number) => number,
): number[] {
  return nextCards.map((card, index) => {
    const measurement = measurements[index];
    if (measurement?.cachedNaturalHeightPx != null && measurement.cachedNaturalHeightPx > 0) {
      return measurement.cachedNaturalHeightPx;
    }

    const cardRect = getElementRectSnapshot(card);
    const fallbackHeight = resolveFallbackCardHeightPx(card, measurement?.previousHeightPx || 0);
    const resolvedHeight = cardRect && cardRect.height > 0 ? cardRect.height : fallbackHeight > 0 ? fallbackHeight : 0;

    if (resolvedHeight > 0 && measurement?.measurementSignature) {
      naturalHeightByCardElement.set(card, {
        measurementSignature: measurement.measurementSignature,
        naturalHeightPx: resolvedHeight,
      });
    } else {
      naturalHeightByCardElement.delete(card);
    }

    return resolvedHeight;
  });
}
