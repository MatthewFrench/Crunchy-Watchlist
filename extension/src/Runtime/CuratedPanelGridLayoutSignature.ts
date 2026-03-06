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

export function buildCuratedGridLayoutSignature(nextCards: Element[], gridWidthPx: number, gapPx: number): string {
  return [
    `w:${Math.round(gridWidthPx)}`,
    `g:${Math.round(gapPx)}`,
    `c:${nextCards.length}`,
    ...nextCards.map((card) =>
      [
        readTrackedElementDataAttribute(card, 'cwSeriesId', 'data-cw-series-id'),
        readTrackedElementDataAttribute(card, 'cwCardContentSignature', 'data-cw-card-content-signature'),
        readTrackedElementDataAttribute(card, 'cwLoadingDetails', 'data-cw-loading-details'),
      ].join(':'),
    ),
  ].join('|');
}
