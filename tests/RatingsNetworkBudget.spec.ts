import { expect, test } from '@playwright/test';
import { gotoFixture, injectExtension } from './Helpers/ExtensionFixture';

type RatingsRequestCounters = {
  total: number;
  byLocale: Record<string, number>;
};

function createRatingsRequestCounters(): RatingsRequestCounters {
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

function getLocaleRequestCount(counters: RatingsRequestCounters, locale: string): number {
  return counters.byLocale[locale] || 0;
}

test.describe('Ratings Network Budget', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  test('keeps ratings requests stable during sort/filter churn', async ({ page }) => {
    const counters = createRatingsRequestCounters();
    await page.route('**/content/v2/cms/objects/**', async (route) => {
      const url = new URL(route.request().url());
      const hasRatingsQuery = url.searchParams.get('ratings') === 'true';
      if (hasRatingsQuery) {
        counters.total += 1;
        const localeKey = normalizeLocaleKey(url.searchParams.get('preferred_audio_language'));
        counters.byLocale[localeKey] = (counters.byLocale[localeKey] || 0) + 1;
      }
      await route.continue();
    });

    await injectExtension(page);
    await expect(page.locator('.cw-curated-card[data-cw-loading-details="true"]')).toHaveCount(0);

    const baselineTotal = counters.total;
    expect(baselineTotal).toBeGreaterThanOrEqual(1);

    await page.selectOption('#cw-sort-mode', 'rating_desc');
    await page.selectOption('#cw-sort-mode', 'rating_asc');
    await page.selectOption('#cw-watch-ready-mode', 'dim');
    await page.selectOption('#cw-watch-ready-mode', 'none');
    await page.selectOption('#cw-genre-filter', 'drama');
    await page.selectOption('#cw-genre-filter', 'any');
    await page.waitForTimeout(350);

    expect(counters.total).toBe(baselineTotal);
    expect(getLocaleRequestCount(counters, 'en-us')).toBeGreaterThanOrEqual(1);
  });

  test('bounds localized ratings preloads during rapid locale toggles', async ({ page }) => {
    const counters = createRatingsRequestCounters();
    await page.route('**/content/v2/cms/objects/**', async (route) => {
      const url = new URL(route.request().url());
      const hasRatingsQuery = url.searchParams.get('ratings') === 'true';
      if (hasRatingsQuery) {
        counters.total += 1;
        const localeKey = normalizeLocaleKey(url.searchParams.get('preferred_audio_language'));
        counters.byLocale[localeKey] = (counters.byLocale[localeKey] || 0) + 1;
      }
      await route.continue();
    });

    await injectExtension(page);
    await expect(page.locator('.cw-curated-card[data-cw-loading-details="true"]')).toHaveCount(0);

    const baselineTotal = counters.total;

    for (let index = 0; index < 4; index += 1) {
      await page.selectOption('#cw-audio-filter', 'ja-JP');
      await page.selectOption('#cw-sort-mode', index % 2 === 0 ? 'rating_desc' : 'date_updated_desc');
      await page.selectOption('#cw-audio-filter', 'any');
    }
    await page.waitForTimeout(450);

    expect(getLocaleRequestCount(counters, 'ja-jp')).toBeLessThanOrEqual(2);
    expect(counters.total).toBeLessThanOrEqual(baselineTotal + 2);
  });

  test('keeps legacy ratings fallback endpoint unused during control churn', async ({ page }) => {
    const counters = createRatingsRequestCounters();
    let legacyFallbackRequests = 0;

    await page.route('**/content/v2/cms/objects/**', async (route) => {
      const url = new URL(route.request().url());
      const hasRatingsQuery = url.searchParams.get('ratings') === 'true';
      if (hasRatingsQuery) {
        counters.total += 1;
        const localeKey = normalizeLocaleKey(url.searchParams.get('preferred_audio_language'));
        counters.byLocale[localeKey] = (counters.byLocale[localeKey] || 0) + 1;
      }
      await route.continue();
    });
    await page.route('**/content-reviews/v3/rating/series/**', async (route) => {
      legacyFallbackRequests += 1;
      await route.continue();
    });

    await injectExtension(page);
    await expect(page.locator('.cw-curated-card[data-cw-loading-details="true"]')).toHaveCount(0);
    const baselineTotal = counters.total;

    for (let index = 0; index < 4; index += 1) {
      await page.selectOption('#cw-audio-filter', 'ja-JP');
      await page.selectOption('#cw-sort-mode', index % 2 === 0 ? 'rating_desc' : 'date_updated_desc');
      await page.selectOption('#cw-watch-ready-mode', index % 2 === 0 ? 'dim' : 'none');
      await page.selectOption('#cw-audio-filter', 'any');
    }
    await page.waitForTimeout(450);

    expect(counters.total).toBeLessThanOrEqual(baselineTotal + 2);
    expect(legacyFallbackRequests).toBe(0);
  });
});
