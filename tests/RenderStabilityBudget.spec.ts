import { expect, type Page, test } from '@playwright/test';
import { gotoFixture, injectExtension } from './Helpers/ExtensionFixture';
import {
  installCardContentMutationProbe,
  readAndDisposeCardContentMutationProbe,
  readCuratedDomLifecycleStats,
} from './Helpers/RenderStabilityProbe';

type RenderStabilityProbeResult = {
  baselineSeriesCount: number;
  newCardInstanceCount: number;
  replacedCardSeriesIds: string[];
  replacedThumbSeriesIds: string[];
};

type LayoutShiftProbeResult = {
  supported: boolean;
  cls: number;
  entryCount: number;
};

type InteractionLatencyExpectation = 'order' | 'count-or-order';

type ControlInteractionLatencyMeasurement = {
  elapsedMs: number;
  baselineOrder: string;
  finalOrder: string;
  baselineCount: number;
  finalCount: number;
};

async function measureControlInteractionLatency(
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

    const readOrder = (): string =>
      Array.from(grid.querySelectorAll<HTMLElement>('.cw-curated-card'))
        .map((card) => String(card.dataset.cwSeriesId || '').trim())
        .filter(Boolean)
        .join('|');
    const readCount = (): number => grid.querySelectorAll('.cw-curated-card').length;
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

test.describe('Render Stability Budget', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  test('keeps sort and genre interaction latency within budget', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Interaction-latency budget currently runs on Chromium only.');

    await injectExtension(page);
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await expect(page.locator('.cw-curated-card')).toHaveCount(4);

    await page.selectOption('#cw-sort-mode', 'rating_asc');
    await expect(page.locator('.cw-curated-card')).toHaveCount(4);

    const sortMeasurement = await measureControlInteractionLatency(page, {
      selector: '#cw-sort-mode',
      nextValue: 'rating_desc',
      expectation: 'order',
      maxWaitMs: 2_000,
    });
    const genreMeasurement = await measureControlInteractionLatency(page, {
      selector: '#cw-genre-filter',
      nextValue: '__favorites__',
      expectation: 'count-or-order',
      maxWaitMs: 2_000,
    });
    const genreResetMeasurement = await measureControlInteractionLatency(page, {
      selector: '#cw-genre-filter',
      nextValue: 'any',
      expectation: 'count-or-order',
      maxWaitMs: 2_000,
    });

    const samples = [sortMeasurement.elapsedMs, genreMeasurement.elapsedMs, genreResetMeasurement.elapsedMs];
    const maxLatencyMs = Math.max(...samples);
    const averageLatencyMs = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;

    expect(sortMeasurement.finalOrder).not.toBe(sortMeasurement.baselineOrder);
    expect(genreMeasurement.finalCount).toBe(1);
    expect(genreResetMeasurement.finalCount).toBe(4);
    expect(maxLatencyMs).toBeLessThan(650);
    expect(averageLatencyMs).toBeLessThan(350);
  });

  test('keeps card patch count flat during sort-only churn', async ({ page }) => {
    await injectExtension(page);
    await expect(page.locator('.cw-curated-card')).toHaveCount(3);

    const before = await readCuratedDomLifecycleStats(page);
    const mutationProbeInstalled = await installCardContentMutationProbe(page, 'sort-only');

    expect(mutationProbeInstalled).toBe(true);

    await page.selectOption('#cw-sort-mode', 'rating_desc');
    await page.selectOption('#cw-sort-mode', 'rating_asc');
    await page.selectOption('#cw-sort-mode', 'date_updated_desc');
    await page.selectOption('#cw-sort-mode', 'consensus_quality_desc');
    await page.selectOption('#cw-sort-mode', 'controversial_desc');
    await page.waitForTimeout(320);

    const after = await readCuratedDomLifecycleStats(page);
    const patchedDelta = after.counters.patched - before.counters.patched;
    const createdDelta = after.counters.created - before.counters.created;
    const disposedDelta = after.counters.disposed - before.counters.disposed;
    const renderPassDelta = after.counters.renderPasses - before.counters.renderPasses;
    const contentMutationCount = await readAndDisposeCardContentMutationProbe(page, 'sort-only');

    expect(createdDelta).toBe(0);
    expect(disposedDelta).toBe(0);
    expect(patchedDelta).toBe(0);
    expect(contentMutationCount).toBe(0);
    expect(renderPassDelta).toBeGreaterThan(0);
    expect(renderPassDelta).toBeLessThanOrEqual(7);
  });

  test('keeps watch-ready dim mode churn class-only without content patches', async ({ page }) => {
    await injectExtension(page);
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await expect(page.locator('.cw-curated-card')).toHaveCount(4);

    const before = await readCuratedDomLifecycleStats(page);
    const mutationProbeInstalled = await installCardContentMutationProbe(page, 'watch-ready-dim');

    expect(mutationProbeInstalled).toBe(true);
    await expect(page.locator('.cw-curated-card--not-watch-ready')).toHaveCount(0);

    await page.selectOption('#cw-watch-ready-mode', 'dim');
    await expect(page.locator('.cw-curated-card')).toHaveCount(4);
    await expect(page.locator('.cw-curated-card--not-watch-ready')).toHaveCount(1);

    await page.selectOption('#cw-watch-ready-mode', 'none');
    await expect(page.locator('.cw-curated-card')).toHaveCount(4);
    await expect(page.locator('.cw-curated-card--not-watch-ready')).toHaveCount(0);

    await page.selectOption('#cw-watch-ready-mode', 'dim');
    await expect(page.locator('.cw-curated-card')).toHaveCount(4);
    await expect(page.locator('.cw-curated-card--not-watch-ready')).toHaveCount(1);

    await page.selectOption('#cw-watch-ready-mode', 'none');
    await expect(page.locator('.cw-curated-card')).toHaveCount(4);
    await expect(page.locator('.cw-curated-card--not-watch-ready')).toHaveCount(0);
    await page.waitForTimeout(220);

    const after = await readCuratedDomLifecycleStats(page);
    const patchedDelta = after.counters.patched - before.counters.patched;
    const createdDelta = after.counters.created - before.counters.created;
    const disposedDelta = after.counters.disposed - before.counters.disposed;
    const renderPassDelta = after.counters.renderPasses - before.counters.renderPasses;
    const contentMutationCount = await readAndDisposeCardContentMutationProbe(page, 'watch-ready-dim');

    expect(createdDelta).toBe(0);
    expect(disposedDelta).toBe(0);
    expect(patchedDelta).toBe(0);
    expect(contentMutationCount).toBe(0);
    expect(renderPassDelta).toBeGreaterThan(0);
    expect(renderPassDelta).toBeLessThanOrEqual(6);
  });

  test('preserves card and thumbnail element identity during control churn', async ({ page }) => {
    await injectExtension(page);
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await expect(page.locator('.cw-curated-card')).toHaveCount(4);

    const probeInitialized = await page.evaluate(() => {
      type RenderProbeState = {
        baselineCardsBySeries: Map<string, HTMLElement>;
        baselineThumbsBySeries: Map<string, HTMLImageElement>;
        seenCardInstances: Set<HTMLElement>;
        replacedCardSeriesIds: Set<string>;
        replacedThumbSeriesIds: Set<string>;
        newCardInstanceCount: number;
        observer: MutationObserver | null;
      };

      type ProbeWindow = Window &
        typeof globalThis & {
          __cwRenderStabilityProbeState__?: RenderProbeState;
        };

      const windowWithProbe = window as ProbeWindow;
      const grid = document.querySelector('.cw-curated-grid');
      if (!(grid instanceof HTMLElement)) {
        return false;
      }

      const readSeriesId = (card: Element): string => String((card as HTMLElement).dataset.cwSeriesId || '').trim();
      const getBaseThumbImage = (card: Element): HTMLImageElement | null => {
        const images = Array.from(card.querySelectorAll('img'));
        for (const image of images) {
          if (!image.classList.contains('cw-curated-card__preview-image')) {
            return image as HTMLImageElement;
          }
        }
        return null;
      };
      const collectCardsFromNode = (node: Node): HTMLElement[] => {
        if (!(node instanceof Element)) {
          return [];
        }

        const cards: HTMLElement[] = [];
        if (node.classList.contains('cw-curated-card')) {
          cards.push(node as HTMLElement);
        }
        cards.push(...Array.from(node.querySelectorAll<HTMLElement>('.cw-curated-card')));
        return cards;
      };

      const baselineCardsBySeries = new Map<string, HTMLElement>();
      const baselineThumbsBySeries = new Map<string, HTMLImageElement>();
      const visibleCards = Array.from(grid.querySelectorAll('.cw-curated-card'));
      for (const card of visibleCards) {
        const seriesId = readSeriesId(card);
        if (!seriesId) {
          continue;
        }

        baselineCardsBySeries.set(seriesId, card as HTMLElement);
        const baseThumb = getBaseThumbImage(card);
        if (baseThumb) {
          baselineThumbsBySeries.set(seriesId, baseThumb);
        }
      }

      const state: RenderProbeState = {
        baselineCardsBySeries,
        baselineThumbsBySeries,
        seenCardInstances: new Set(baselineCardsBySeries.values()),
        replacedCardSeriesIds: new Set(),
        replacedThumbSeriesIds: new Set(),
        newCardInstanceCount: 0,
        observer: null,
      };

      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const addedNode of Array.from(record.addedNodes)) {
            const cards = collectCardsFromNode(addedNode);
            for (const card of cards) {
              const seriesId = readSeriesId(card);
              if (!seriesId) {
                continue;
              }

              const baselineCard = state.baselineCardsBySeries.get(seriesId);
              if (baselineCard && baselineCard !== card) {
                state.replacedCardSeriesIds.add(seriesId);
              }

              if (!state.seenCardInstances.has(card)) {
                state.seenCardInstances.add(card);
                if (!baselineCard || baselineCard !== card) {
                  state.newCardInstanceCount += 1;
                }
              }

              const baselineThumb = state.baselineThumbsBySeries.get(seriesId);
              const currentThumb = getBaseThumbImage(card);
              if (baselineThumb && currentThumb && baselineThumb !== currentThumb) {
                state.replacedThumbSeriesIds.add(seriesId);
              }
            }
          }
        }
      });
      observer.observe(grid, { childList: true, subtree: true });
      state.observer = observer;
      windowWithProbe.__cwRenderStabilityProbeState__ = state;
      return true;
    });

    expect(probeInitialized).toBe(true);

    const sortModes = [
      'rating_desc',
      'rating_asc',
      'date_updated_desc',
      'consensus_quality_desc',
      'controversial_desc',
    ];
    for (const sortMode of sortModes) {
      await page.selectOption('#cw-sort-mode', sortMode);
    }
    await page.selectOption('#cw-watch-ready-mode', 'hide');
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await page.selectOption('#cw-watch-ready-mode', 'dim');
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await page.waitForTimeout(350);

    const probeResult = await page.evaluate(() => {
      type RenderProbeState = {
        baselineCardsBySeries: Map<string, HTMLElement>;
        baselineThumbsBySeries: Map<string, HTMLImageElement>;
        replacedCardSeriesIds: Set<string>;
        replacedThumbSeriesIds: Set<string>;
        newCardInstanceCount: number;
        observer: MutationObserver | null;
      };

      type ProbeWindow = Window &
        typeof globalThis & {
          __cwRenderStabilityProbeState__?: RenderProbeState;
        };

      const windowWithProbe = window as ProbeWindow;
      const state = windowWithProbe.__cwRenderStabilityProbeState__;
      if (!state) {
        return null;
      }

      state.observer?.disconnect();

      const getCurrentCardBySeriesId = (seriesId: string): HTMLElement | null => {
        const cards = Array.from(document.querySelectorAll('.cw-curated-card'));
        for (const card of cards) {
          const currentSeriesId = String((card as HTMLElement).dataset.cwSeriesId || '').trim();
          if (currentSeriesId === seriesId) {
            return card as HTMLElement;
          }
        }
        return null;
      };
      const getBaseThumbImage = (card: Element): HTMLImageElement | null => {
        const images = Array.from(card.querySelectorAll('img'));
        for (const image of images) {
          if (!image.classList.contains('cw-curated-card__preview-image')) {
            return image as HTMLImageElement;
          }
        }
        return null;
      };

      for (const [seriesId, baselineCard] of Array.from(state.baselineCardsBySeries.entries())) {
        const currentCard = getCurrentCardBySeriesId(seriesId);
        if (currentCard && baselineCard !== currentCard) {
          state.replacedCardSeriesIds.add(seriesId);
        }

        const baselineThumb = state.baselineThumbsBySeries.get(seriesId);
        const currentThumb = currentCard ? getBaseThumbImage(currentCard) : null;
        if (baselineThumb && currentThumb && baselineThumb !== currentThumb) {
          state.replacedThumbSeriesIds.add(seriesId);
        }
      }

      const result: RenderStabilityProbeResult = {
        baselineSeriesCount: state.baselineCardsBySeries.size,
        newCardInstanceCount: state.newCardInstanceCount,
        replacedCardSeriesIds: Array.from(state.replacedCardSeriesIds.values()).sort(),
        replacedThumbSeriesIds: Array.from(state.replacedThumbSeriesIds.values()).sort(),
      };
      return result;
    });

    expect(probeResult).not.toBeNull();
    if (!probeResult) {
      return;
    }

    expect(probeResult.baselineSeriesCount).toBe(4);
    expect(probeResult.newCardInstanceCount).toBe(0);
    expect(probeResult.replacedCardSeriesIds).toEqual([]);
    expect(probeResult.replacedThumbSeriesIds).toEqual([]);
  });

  test('keeps metadata patch cumulative layout shift below budget', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Layout-shift entry budget only runs on Chromium.');

    await page.route('**/content-reviews/v3/rating/series/**', async (route) => {
      await page.waitForTimeout(700);
      await route.continue();
    });
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      await page.waitForTimeout(700);
      await route.continue();
    });

    await injectExtension(page, {}, { waitForLoaded: false });
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await expect(page.locator('.cw-curated-card[data-cw-loading-details="true"]')).toHaveCount(4);

    const probeInstalled = await page.evaluate(() => {
      type LayoutShiftProbeState = {
        supported: boolean;
        cls: number;
        entryCount: number;
        observer: PerformanceObserver | null;
      };

      type ProbeWindow = Window &
        typeof globalThis & {
          __cwLayoutShiftProbeState__?: LayoutShiftProbeState;
        };

      const windowWithProbe = window as ProbeWindow;
      const supportedEntryTypes = (PerformanceObserver as unknown as { supportedEntryTypes?: string[] })
        .supportedEntryTypes;
      const supportsLayoutShift =
        typeof PerformanceObserver === 'function' &&
        Array.isArray(supportedEntryTypes) &&
        supportedEntryTypes.includes('layout-shift');
      if (!supportsLayoutShift) {
        windowWithProbe.__cwLayoutShiftProbeState__ = {
          supported: false,
          cls: 0,
          entryCount: 0,
          observer: null,
        };
        return false;
      }

      const state: LayoutShiftProbeState = {
        supported: true,
        cls: 0,
        entryCount: 0,
        observer: null,
      };
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShiftEntry = entry as PerformanceEntry & {
            value?: unknown;
            hadRecentInput?: unknown;
          };
          state.entryCount += 1;
          const value = Number(layoutShiftEntry.value || 0);
          if (!layoutShiftEntry.hadRecentInput && Number.isFinite(value) && value > 0) {
            state.cls += value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true } as unknown as PerformanceObserverInit);
      state.observer = observer;
      windowWithProbe.__cwLayoutShiftProbeState__ = state;
      return true;
    });

    expect(probeInstalled).toBe(true);

    await expect(page.locator('.cw-curated-card[data-cw-loading-details="true"]')).toHaveCount(0);
    await page.waitForTimeout(180);

    const layoutShiftResult = await page.evaluate(() => {
      type LayoutShiftProbeState = {
        supported: boolean;
        cls: number;
        entryCount: number;
        observer: PerformanceObserver | null;
      };

      type ProbeWindow = Window &
        typeof globalThis & {
          __cwLayoutShiftProbeState__?: LayoutShiftProbeState;
        };

      const state = (window as ProbeWindow).__cwLayoutShiftProbeState__;
      if (!state) {
        return null;
      }

      state.observer?.disconnect();
      const result: LayoutShiftProbeResult = {
        supported: state.supported,
        cls: state.cls,
        entryCount: state.entryCount,
      };
      return result;
    });

    expect(layoutShiftResult).not.toBeNull();
    if (!layoutShiftResult) {
      return;
    }
    expect(layoutShiftResult.supported).toBe(true);
    expect(layoutShiftResult.cls).toBeLessThan(0.05);
  });
});
