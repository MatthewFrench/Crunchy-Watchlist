import type { Page } from '@playwright/test';

type InteractionLatencyExpectation = 'order' | 'count-or-order';

export type ControlInteractionLatencyMeasurement = {
  elapsedMs: number;
  baselineOrder: string;
  finalOrder: string;
  baselineCount: number;
  finalCount: number;
};

export async function measureControlInteractionLatency(
  page: Page,
  options: {
    selector: string;
    nextValue: string;
    expectation: InteractionLatencyExpectation;
    maxWaitMs?: number;
  },
): Promise<ControlInteractionLatencyMeasurement> {
  return await page.evaluate(async ({ selector, nextValue, expectation, maxWaitMs }) => {
    const select = document.querySelector(selector);
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error(`Control not found: ${selector}`);
    }
    const grid = document.querySelector('.cw-curated-grid');
    if (!(grid instanceof HTMLElement)) {
      throw new Error('Curated grid not found for latency probe');
    }

    const readActiveSeriesIds = (): string[] => {
      const debugApi = (window as Window &
        typeof globalThis & {
          __CW_WATCHLIST_CURATOR_DEBUG__?: {
            getCuratedDomStats?: () => {
              activeSeriesIds?: string[];
            };
          };
        }).__CW_WATCHLIST_CURATOR_DEBUG__;
      const activeSeriesIds = debugApi?.getCuratedDomStats?.()?.activeSeriesIds;
      if (!Array.isArray(activeSeriesIds) || activeSeriesIds.length === 0) {
        return Array.from(grid.querySelectorAll<HTMLElement>('.cw-curated-card'))
          .map((card) => String(card.dataset.cwSeriesId || '').trim())
          .filter(Boolean);
      }
      return activeSeriesIds.map((seriesId) => String(seriesId || '').trim()).filter(Boolean);
    };

    const readOrder = (): string => readActiveSeriesIds().join('|');
    const readCount = (): number => readActiveSeriesIds().length;
    const hasChanged = (baselineOrder: string, baselineCount: number): boolean => {
      const currentOrder = readOrder();
      const currentCount = readCount();
      if (expectation === 'order') {
        return currentOrder !== baselineOrder;
      }
      return currentCount !== baselineCount || currentOrder !== baselineOrder;
    };

    const baselineOrder = readOrder();
    const baselineCount = readCount();
    const startedAt = performance.now();

    select.value = nextValue;
    select.dispatchEvent(new Event('change', { bubbles: true }));

    const waitBudgetMs = typeof maxWaitMs === 'number' && Number.isFinite(maxWaitMs) ? maxWaitMs : 2_000;
    await new Promise<void>((resolve, reject) => {
      const deadline = startedAt + waitBudgetMs;
      const poll = (): void => {
        const now = performance.now();
        if (hasChanged(baselineOrder, baselineCount)) {
          resolve();
          return;
        }
        if (now >= deadline) {
          reject(
            new Error(
              `Timed out waiting for visible grid change after control update (${selector}=${nextValue}, expectation=${expectation})`,
            ),
          );
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });

    return {
      elapsedMs: performance.now() - startedAt,
      baselineOrder,
      finalOrder: readOrder(),
      baselineCount,
      finalCount: readCount(),
    };
  }, options);
}
