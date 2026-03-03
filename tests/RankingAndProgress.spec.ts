import { expect, test } from '@playwright/test';
import { gotoFixture, injectExtension, visibleFixtureOrder } from './Helpers/ExtensionFixture';

test.describe('Ranking, Filtering, and Progress', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  test('uses correct watchlist API params and keeps filter changes local only', async ({ page }) => {
    const callLog: {
      count: number;
      firstUrl: string;
      params: Record<string, string>;
    } = {
      count: 0,
      firstUrl: '',
      params: {},
    };

    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      callLog.count += 1;
      if (callLog.count === 1) {
        const url = new URL(route.request().url());
        callLog.firstUrl = url.toString();
        callLog.params = Object.fromEntries(url.searchParams.entries());
      }

      await route.continue();
    });

    await injectExtension(page);
    const watchAgainItem = page.locator('.cw-curated-card[data-cw-curated-title="Watch Again Show"]');

    await expect(watchAgainItem).toHaveCount(0);
    expect(callLog.count).toBeGreaterThan(0);
    expect(callLog.count).toBeGreaterThanOrEqual(1);
    expect(callLog.firstUrl).toContain('/content/v2/discover/fixture-account/watchlist');
    expect(callLog.params.order).toBe('desc');
    expect(callLog.params.n).toBe('100');
    expect(callLog.params.locale).toBeTruthy();
    expect(callLog.params.preferred_audio_language).toBe(callLog.params.locale);

    const beforeFilterCallCount = callLog.count;

    await page.selectOption('#cw-watch-ready-mode', 'dim');
    await expect(watchAgainItem).toHaveCount(1);
    await expect(watchAgainItem).toHaveClass(/cw-curated-card--not-watch-ready/);
    await expect(page.locator('.cw-controls__stats')).toContainText('4 shows');
    expect(callLog.count).toBe(beforeFilterCallCount);

    await page.selectOption('#cw-watch-ready-mode', 'none');
    await expect(watchAgainItem).toHaveCount(1);
    await expect(watchAgainItem).not.toHaveClass(/cw-curated-card--not-watch-ready/);
    await expect(page.locator('.cw-controls__stats')).toContainText('4 shows');
    expect(callLog.count).toBe(beforeFilterCallCount);
  });

  test('uses persisted preferred audio language for watchlist API params', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('preferred_audio_language', 'ja-JP');
    });

    const callLog: {
      count: number;
      params: Record<string, string>;
    } = {
      count: 0,
      params: {},
    };

    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      callLog.count += 1;
      if (callLog.count === 1) {
        const url = new URL(route.request().url());
        callLog.params = Object.fromEntries(url.searchParams.entries());
      }

      await route.continue();
    });

    await injectExtension(page);

    expect(callLog.count).toBeGreaterThan(0);
    expect(callLog.params.preferred_audio_language).toBe('ja-JP');
    expect(callLog.params.locale).toBeTruthy();
  });

  test('shows ratings and sorts loaded cards by rating', async ({ page }) => {
    await injectExtension(page);
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-rating-badge')).toHaveText(
      '★ 4.9',
    );

    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"] .cw-rating-badge')).toHaveText(
      '★ 3.2',
    );

    await expect(page.locator('.cw-curated-card[data-cw-curated-title="No Rating Show"] .cw-rating-badge')).toHaveText(
      'NR',
    );
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-rating-row__percentage').first(),
    ).toHaveText('82%');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__description'),
    ).toContainText('English audio');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__status'),
    ).toHaveText('Up Next: S2 E5');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__last-watched'),
    ).toContainText('Last watched:');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__last-watched'),
    ).not.toContainText('unknown');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"] .cw-curated-card__last-watched'),
    ).not.toContainText('unknown');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope'),
    ).toContainText('Seasons: 3');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope'),
    ).toContainText('Episodes: 36');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope'),
    ).toContainText('Unwatched left: 8');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__genres'),
    ).toContainText('action');

    const before = await visibleFixtureOrder(page);
    expect(before[0]).toBe('Low Rated Show');

    await page.selectOption('#cw-sort-mode', 'rating_desc');
    await page.waitForTimeout(250);

    const afterDesc = await visibleFixtureOrder(page);
    expect(afterDesc[0]).toBe('High Rated Show');
    expect(afterDesc[afterDesc.length - 1]).toBe('No Rating Show');

    await page.selectOption('#cw-sort-mode', 'rating_asc');
    await page.waitForTimeout(250);

    const afterAsc = await visibleFixtureOrder(page);
    expect(afterAsc[0]).toBe('Low Rated Show');

    await page.selectOption('#cw-sort-mode', 'star_5_desc');
    await page.waitForTimeout(250);

    const afterFiveStar = await visibleFixtureOrder(page);
    expect(afterFiveStar[0]).toBe('High Rated Show');

    await page.selectOption('#cw-sort-mode', 'star_1_pct_desc');
    await page.waitForTimeout(250);

    const afterOneStarPct = await visibleFixtureOrder(page);
    expect(afterOneStarPct[0]).toBe('Low Rated Show');

    await page.selectOption('#cw-sort-mode', 'hidden_gems_desc');
    await page.waitForTimeout(250);

    const afterHiddenGems = await visibleFixtureOrder(page);
    expect(afterHiddenGems[0]).toBe('High Rated Show');

    await page.selectOption('#cw-sort-mode', 'consensus_quality_desc');
    await page.waitForTimeout(250);

    const afterConsensus = await visibleFixtureOrder(page);
    expect(afterConsensus[0]).toBe('High Rated Show');

    await page.selectOption('#cw-sort-mode', 'controversial_desc');
    await page.waitForTimeout(250);

    const afterControversial = await visibleFixtureOrder(page);
    expect(afterControversial[0]).toBe('Low Rated Show');

    await page.selectOption('#cw-sort-mode', 'quality_floor_asc');
    await page.waitForTimeout(250);

    const afterQualityFloor = await visibleFixtureOrder(page);
    expect(afterQualityFloor[0]).toBe('High Rated Show');

    await page.selectOption('#cw-sort-mode', 'quick_wins_asc');
    await page.waitForTimeout(250);

    const afterQuickWins = await visibleFixtureOrder(page);
    expect(afterQuickWins[0]).toBe('High Rated Show');

    await page.selectOption('#cw-sort-mode', 'dormant_backlog_asc');
    await page.waitForTimeout(250);

    const afterDormantBacklog = await visibleFixtureOrder(page);
    expect(afterDormantBacklog[0]).toBe('Low Rated Show');

    await page.selectOption('#cw-sort-mode', 'rewatch_memory_desc');
    await page.waitForTimeout(250);

    const afterRewatchMemory = await visibleFixtureOrder(page);
    expect(afterRewatchMemory[0]).toBe('High Rated Show');

    await page.selectOption('#cw-sort-mode', 'date_added_desc');
    await page.waitForTimeout(250);

    const afterDateAdded = await visibleFixtureOrder(page);
    expect(afterDateAdded[0]).toBe('High Rated Show');

    await page.selectOption('#cw-sort-mode', 'date_updated_desc');
    await page.waitForTimeout(250);

    const afterDateUpdated = await visibleFixtureOrder(page);
    expect(afterDateUpdated[0]).toBe('No Rating Show');
  });

  test('preserves thumbnail element identity across sort and visibility churn', async ({ page }) => {
    await injectExtension(page);

    const initializeThumbRefs = await page.evaluate(() => {
      const refsBySeriesId = new Map<string, Element>();
      const cards = Array.from(document.querySelectorAll('.cw-curated-card'));
      cards.forEach((card) => {
        const seriesId = String((card as HTMLElement).dataset.cwSeriesId || '').trim();
        if (!seriesId) {
          return;
        }
        const images = Array.from(card.querySelectorAll('img'));
        const baseImage = images.find((image) => !image.classList.contains('cw-curated-card__preview-image')) as
          | Element
          | undefined;
        if (!baseImage) {
          return;
        }
        refsBySeriesId.set(seriesId, baseImage);
      });

      (window as unknown as { __cwThumbRefsBySeriesId?: Map<string, Element> }).__cwThumbRefsBySeriesId =
        refsBySeriesId;
      return refsBySeriesId.size;
    });

    expect(initializeThumbRefs).toBeGreaterThan(0);

    const assertVisibleThumbRefsStable = async () => {
      const stable = await page.evaluate(() => {
        const refsBySeriesId = (window as unknown as { __cwThumbRefsBySeriesId?: Map<string, Element> })
          .__cwThumbRefsBySeriesId;
        if (!refsBySeriesId) {
          return false;
        }

        const cards = Array.from(document.querySelectorAll('.cw-curated-card'));
        for (const card of cards) {
          const seriesId = String((card as HTMLElement).dataset.cwSeriesId || '').trim();
          if (!seriesId) {
            continue;
          }
          const images = Array.from(card.querySelectorAll('img'));
          const baseImage = images.find((image) => !image.classList.contains('cw-curated-card__preview-image')) as
            | Element
            | undefined;
          if (!baseImage) {
            continue;
          }

          const previousRef = refsBySeriesId.get(seriesId);
          if (!previousRef) {
            refsBySeriesId.set(seriesId, baseImage);
            continue;
          }
          if (previousRef !== baseImage) {
            return false;
          }
        }
        return true;
      });
      expect(stable).toBe(true);
    };

    await page.selectOption('#cw-sort-mode', 'rating_desc');
    await page.waitForTimeout(250);
    await assertVisibleThumbRefsStable();

    await page.selectOption('#cw-watch-ready-mode', 'hide');
    await page.waitForTimeout(250);
    await assertVisibleThumbRefsStable();

    await page.selectOption('#cw-watch-ready-mode', 'none');
    await page.waitForTimeout(250);
    await assertVisibleThumbRefsStable();
  });

  test('filters by audio locale and genre using dropdowns', async ({ page }) => {
    await injectExtension(page);
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toHaveCount(1);

    await page.selectOption('#cw-audio-filter', 'en-US');
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toBeHidden();
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 2 of 4');

    await page.selectOption('#cw-genre-filter', 'action');
    await expect(page.locator('.cw-curated-card:visible')).toHaveCount(1);
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]')).toHaveCount(1);
  });

  test('filters by favorites using genre dropdown option', async ({ page }) => {
    await injectExtension(page);

    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]')).toHaveCount(1);
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toHaveCount(1);

    await page.selectOption('#cw-genre-filter', '__favorites__');
    await expect(page.locator('.cw-curated-card:visible')).toHaveCount(1);
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]')).toHaveCount(1);
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toBeHidden();
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 1 of 4');
  });

});
