import { expect, test, type Page } from '@playwright/test';
import { FIXTURE_URL, gotoFixture, injectExtension } from './Helpers/ExtensionFixture';

type WatchHistoryRequestCounters = {
  total: number;
  byLocale: Record<string, number>;
};

type WatchHistoryPreloadAttemptStats = {
  totalAttempts: number;
  byLocale: Record<string, number>;
  byLocaleRevision: Record<string, number>;
  lastAttempt: {
    locale: string;
    curatedDataRevision: number;
    localeAttemptCount: number;
    localeRevisionAttemptCount: number;
  } | null;
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

async function readWatchHistoryPreloadAttemptStats(page: Page) {
  return page.evaluate(() => {
    type DebugApiShape = {
      getCuratedDomStats?: () => {
        watchHistoryPreloadAttempts?: WatchHistoryPreloadAttemptStats;
      };
    };

    const debugApi = (window as Window & typeof globalThis & { __CW_WATCHLIST_CURATOR_DEBUG__?: DebugApiShape })
      .__CW_WATCHLIST_CURATOR_DEBUG__;
    if (!debugApi || typeof debugApi.getCuratedDomStats !== 'function') {
      throw new Error('Missing debug API getCuratedDomStats()');
    }

    const stats = debugApi.getCuratedDomStats();
    return (
      stats.watchHistoryPreloadAttempts || {
        totalAttempts: 0,
        byLocale: {},
        byLocaleRevision: {},
        lastAttempt: null,
      }
    );
  });
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
    const preloadStats = await readWatchHistoryPreloadAttemptStats(page);
    expect(preloadStats.totalAttempts).toBe(1);
    expect(preloadStats.byLocale).toEqual({ 'en-us': 1 });
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
    const preloadStats = await readWatchHistoryPreloadAttemptStats(page);
    expect(preloadStats.totalAttempts).toBeLessThanOrEqual(3);
    expect(preloadStats.byLocale['en-us']).toBe(1);
    expect(preloadStats.byLocale['ja-jp']).toBeLessThanOrEqual(2);
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
    expect(getLocaleRequestCount(counters, 'ja-jp')).toBe(1);
    expect(counters.total).toBe(2);
    const preloadStats = await readWatchHistoryPreloadAttemptStats(page);
    expect(preloadStats.totalAttempts).toBe(2);
    expect(preloadStats.byLocale).toEqual({
      'en-us': 1,
      'ja-jp': 1,
    });
  });

  test('keeps refresh churn bounded to one default-locale request per refresh', async ({ page }) => {
    const counters = createWatchHistoryRequestCounters();
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      counters.total += 1;
      const localeKey = normalizeLocaleKey(new URL(route.request().url()).searchParams.get('preferred_audio_language'));
      counters.byLocale[localeKey] = (counters.byLocale[localeKey] || 0) + 1;
      await route.continue();
    });

    await injectExtension(page);
    await expect.poll(() => counters.total).toBe(1);

    for (let index = 1; index <= 3; index += 1) {
      await page.click('.cw-controls__refresh');
      await expect.poll(() => counters.total).toBe(index + 1);
    }

    expect(getLocaleRequestCount(counters, 'en-us')).toBe(4);
    expect(getLocaleRequestCount(counters, 'ja-jp')).toBe(0);
    const preloadStats = await readWatchHistoryPreloadAttemptStats(page);
    expect(preloadStats.totalAttempts).toBe(4);
    expect(preloadStats.byLocale).toEqual({
      'en-us': 4,
    });
  });

  test('uses multipage fixture mode to cap unmatched watch-history scanning at no-match limit', async ({ page }) => {
    const counters = createWatchHistoryRequestCounters();
    const requestedPages: number[] = [];
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      counters.total += 1;
      const requestUrl = new URL(route.request().url());
      const localeKey = normalizeLocaleKey(requestUrl.searchParams.get('preferred_audio_language'));
      counters.byLocale[localeKey] = (counters.byLocale[localeKey] || 0) + 1;
      requestedPages.push(Number(requestUrl.searchParams.get('page') || 1));
      await route.continue();
    });

    await page.goto(`${FIXTURE_URL}?fixture_mode=watch-history-multipage-unmatched`, {
      waitUntil: 'domcontentloaded',
    });
    await injectExtension(page);
    await expect.poll(() => counters.total).toBe(5);
    await page.waitForTimeout(250);

    expect(counters.total).toBe(5);
    expect(getLocaleRequestCount(counters, 'en-us')).toBe(5);
    expect(Math.max(...requestedPages)).toBe(5);
    const preloadStats = await readWatchHistoryPreloadAttemptStats(page);
    expect(preloadStats.byLocale['en-us']).toBe(1);
    expect(preloadStats.totalAttempts).toBe(1);
  });

  test('caps watch-history pagination when candidate series are unmatched', async ({ page }) => {
    const counters = createWatchHistoryRequestCounters();
    const requestedPages: number[] = [];
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      counters.total += 1;
      const requestUrl = new URL(route.request().url());
      const localeKey = normalizeLocaleKey(requestUrl.searchParams.get('preferred_audio_language'));
      counters.byLocale[localeKey] = (counters.byLocale[localeKey] || 0) + 1;
      requestedPages.push(Number(requestUrl.searchParams.get('page') || 1));

      const pageNumber = Number(requestUrl.searchParams.get('page') || 1);
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          total: 10_000,
          data: [
            {
              id: `unrelated-history-${pageNumber}`,
              date_played: '2025-03-14T11:30:00Z',
              playhead: 300,
              fully_watched: false,
              panel: {
                id: `unrelated-episode-${pageNumber}`,
                title: 'Unrelated episode',
                episode_metadata: {
                  series_id: 'UNRELATED-SERIES',
                  identifier: 'unrelated-id',
                  sequence_number: pageNumber,
                  season_number: 1,
                  episode_number: pageNumber,
                  audio_locale: 'en-US',
                },
              },
            },
          ],
        }),
      });
    });

    await injectExtension(page);
    await expect(page.locator('.cw-curated-card')).toHaveCount(3);
    await page.waitForTimeout(350);

    expect(requestedPages.length).toBeGreaterThanOrEqual(1);
    expect(counters.total).toBeLessThanOrEqual(5);
    expect(getLocaleRequestCount(counters, 'en-us')).toBeLessThanOrEqual(5);
    expect(Math.max(...requestedPages)).toBeLessThanOrEqual(5);
  });
});
