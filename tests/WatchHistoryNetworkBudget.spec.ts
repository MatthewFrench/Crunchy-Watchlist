import { expect, test } from '@playwright/test';
import { gotoFixture, injectExtension } from './Helpers/ExtensionFixture';

type WatchHistoryRequestCounters = {
  total: number;
  byLocale: Record<string, number>;
};

function createWatchHistoryRequestCounters(): WatchHistoryRequestCounters {
  return {
    total: 0,
    byLocale: {},
  };
}

function normalizeLocaleKey(value: string | null): string {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();
  return normalizedValue || 'unknown';
}

function getLocaleRequestCount(counters: WatchHistoryRequestCounters, locale: string): number {
  return counters.byLocale[locale] || 0;
}

test.describe('Watch History Network Budget', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  test('keeps watch-history requests bounded during initial load and sort/filter churn', async ({ page }) => {
    const counters = createWatchHistoryRequestCounters();
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      counters.total += 1;
      const localeKey = normalizeLocaleKey(new URL(route.request().url()).searchParams.get('preferred_audio_language'));
      counters.byLocale[localeKey] = (counters.byLocale[localeKey] || 0) + 1;
      await route.continue();
    });

    await injectExtension(page);
    await expect.poll(() => counters.total).toBe(1);

    await page.selectOption('#cw-sort-mode', 'rating_desc');
    await page.selectOption('#cw-sort-mode', 'rating_asc');
    await page.selectOption('#cw-watch-ready-mode', 'dim');
    await page.selectOption('#cw-watch-ready-mode', 'hide');
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await page.waitForTimeout(350);

    expect(counters.total).toBe(1);
    expect(getLocaleRequestCount(counters, 'en-us')).toBe(1);
  });

  test('limits incremental watch-history requests when selecting a non-default audio locale', async ({ page }) => {
    const counters = createWatchHistoryRequestCounters();
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      counters.total += 1;
      const localeKey = normalizeLocaleKey(new URL(route.request().url()).searchParams.get('preferred_audio_language'));
      counters.byLocale[localeKey] = (counters.byLocale[localeKey] || 0) + 1;
      await route.continue();
    });

    await injectExtension(page);
    await expect.poll(() => counters.total).toBe(1);

    await page.selectOption('#cw-audio-filter', 'ja-JP');
    await expect.poll(() => counters.total).toBeLessThanOrEqual(2);

    const afterLocaleSelection = counters.total;
    await page.selectOption('#cw-sort-mode', 'date_updated_desc');
    await page.selectOption('#cw-watch-ready-mode', 'dim');
    await page.waitForTimeout(350);

    expect(counters.total).toBeLessThanOrEqual(afterLocaleSelection + 1);
    expect(getLocaleRequestCount(counters, 'en-us')).toBe(1);
    expect(getLocaleRequestCount(counters, 'ja-jp')).toBeLessThanOrEqual(2);
  });

  test('keeps watch-history requests bounded during rapid locale toggles and sort churn', async ({ page }) => {
    const counters = createWatchHistoryRequestCounters();
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      counters.total += 1;
      const localeKey = normalizeLocaleKey(new URL(route.request().url()).searchParams.get('preferred_audio_language'));
      counters.byLocale[localeKey] = (counters.byLocale[localeKey] || 0) + 1;
      await route.continue();
    });

    await injectExtension(page);
    await expect.poll(() => counters.total).toBe(1);

    const sortModes = ['rating_desc', 'date_updated_desc', 'consensus_quality_desc'];
    const watchReadyModes = ['dim', 'hide', 'none'];
    for (let index = 0; index < 4; index += 1) {
      await page.selectOption('#cw-audio-filter', 'ja-JP');
      await page.selectOption('#cw-sort-mode', sortModes[index] || sortModes[0] || 'rating_desc');
      await page.selectOption('#cw-watch-ready-mode', watchReadyModes[index] || watchReadyModes[0] || 'none');
      await page.selectOption('#cw-audio-filter', 'any');
    }
    await page.waitForTimeout(450);

    expect(getLocaleRequestCount(counters, 'en-us')).toBe(1);
    expect(getLocaleRequestCount(counters, 'ja-jp')).toBeLessThanOrEqual(2);
    expect(counters.total).toBeLessThanOrEqual(3);
  });
});
