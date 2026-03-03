function getElementStyleRecord(value: Element): Record<string, string> | null {
  const elementWithStyle = value as Element & { style?: Record<string, string> };
  return elementWithStyle.style || null;
}

const compactHeightTargetPercentileDefault = 0.5;
const compactHeightTargetPercentileTwoColumns = 0.65;
const compactHeightMinPx = 240;
const compactShortestHeightGuardRatio = 0.82;

function resolveCompactHeightTargetPercentile(columns: number): number {
  return columns === 2 ? compactHeightTargetPercentileTwoColumns : compactHeightTargetPercentileDefault;
}

export function roundCardHeightPx(heightPx: number): number {
  return Math.max(1, Math.round(heightPx));
}

export function resolveCompactUniformCardHeightPx(cardHeights: number[], columns = 0): number {
  const measurableHeights = cardHeights.filter((height) => Number.isFinite(height) && height > 0);
  if (!measurableHeights.length) {
    return 0;
  }

  const sortedHeights = [...measurableHeights].sort((left, right) => left - right);
  const maxHeightPx = sortedHeights[sortedHeights.length - 1] || 0;
  const shortestHeightPx = sortedHeights[0] || maxHeightPx;
  const compactHeightTargetPercentile = resolveCompactHeightTargetPercentile(columns);
  const compactHeightIndex = Math.max(0, Math.floor((sortedHeights.length - 1) * compactHeightTargetPercentile));
  const compactBaseHeightPx = sortedHeights[compactHeightIndex] || maxHeightPx;
  const shortestHeightGuardPx = shortestHeightPx * compactShortestHeightGuardRatio;
  const compactCandidatePx = Math.max(compactHeightMinPx, shortestHeightGuardPx, compactBaseHeightPx);

  return Math.max(1, Math.min(maxHeightPx, compactCandidatePx));
}

export function applyUniformCardHeight(nextCards: Element[], heightPx: number): void {
  const roundedHeight = `${roundCardHeightPx(heightPx)}px`;
  nextCards.forEach((card) => {
    const style = getElementStyleRecord(card);
    if (!style) {
      return;
    }
    style.height = roundedHeight;
  });
}
