import { expect, test } from '@playwright/test';
import { gotoFixture, injectExtension } from './Helpers/ExtensionFixture';

type PreviewStreamsRequestCounters = {
  total: number;
  bySeriesId: Record<string, number>;
};

function createPreviewStreamsRequestCounters(): PreviewStreamsRequestCounters {
  return {
    total: 0,
    bySeriesId: {},
  };
}

function parseSeriesIdFromStreamsUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  const match = url.pathname.match(/^\/content\/v2\/cms\/episodes\/([^/]+)\/streams$/);
  const episodeKey = decodeURIComponent(match?.[1] || '');
  const seriesId = String(episodeKey.split('-episode-')[0] || '').trim();
  return seriesId || 'unknown';
}

function getSeriesRequestCount(counters: PreviewStreamsRequestCounters, seriesId: string): number {
  return counters.bySeriesId[seriesId] || 0;
}

test.describe('Preview Network Budget', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  test('keeps streams preview requests bounded during repeated hover and control churn', async ({ page }) => {
    const counters = createPreviewStreamsRequestCounters();
    await page.route('**/content/v2/cms/episodes/**/streams', async (route) => {
      counters.total += 1;
      const seriesId = parseSeriesIdFromStreamsUrl(route.request().url());
      counters.bySeriesId[seriesId] = (counters.bySeriesId[seriesId] || 0) + 1;
      await route.continue();
    });

    await injectExtension(page);
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await expect(page.locator('.cw-curated-card')).toHaveCount(4);

    const hoverForPreview = async (selector: string): Promise<void> => {
      await page.locator(selector).hover();
      await page.waitForTimeout(1300);
      await page.locator('body').hover({ position: { x: 1, y: 1 } });
      await page.waitForTimeout(120);
    };

    const highRatedThumbSelector = '.cw-curated-card[data-cw-series-id="GHIGH456"] .cw-curated-card__thumb';
    const lowRatedThumbSelector = '.cw-curated-card[data-cw-series-id="GLOW123"] .cw-curated-card__thumb';

    await hoverForPreview(highRatedThumbSelector);
    await hoverForPreview(highRatedThumbSelector);
    await hoverForPreview(lowRatedThumbSelector);

    await page.selectOption('#cw-sort-mode', 'rating_desc');
    await page.selectOption('#cw-sort-mode', 'date_updated_desc');
    await page.selectOption('#cw-watch-ready-mode', 'hide');
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await hoverForPreview(highRatedThumbSelector);

    expect(getSeriesRequestCount(counters, 'GHIGH456')).toBeLessThanOrEqual(1);
    expect(getSeriesRequestCount(counters, 'GLOW123')).toBeLessThanOrEqual(1);
    expect(counters.total).toBeLessThanOrEqual(2);
  });
});
