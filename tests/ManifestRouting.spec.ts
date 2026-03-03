import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { gotoFixture, injectExtension, loadExtensionAssets, NON_WATCHLIST_URL } from './Helpers/ExtensionFixture';

type WindowWithSavedPushState = Window & {
  __CW_TEST_NATIVE_PUSH_STATE__?: (state: unknown, title: string, url?: string | URL | null) => void;
};

test('manifest injects on all Crunchyroll pages for SPA watchlist navigation', async () => {
  const manifestPath = path.join(process.cwd(), 'extension', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    content_scripts?: Array<{
      matches?: string[];
    }>;
  };
  const matches = manifest.content_scripts?.[0]?.matches || [];

  expect(matches).toContain('https://www.crunchyroll.com/*');
});

test.describe('Routing and Mounting', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  test('does not mount or call watchlist APIs on non-watchlist pages', async ({ page }) => {
    let watchlistRequestCount = 0;
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      watchlistRequestCount += 1;
      await route.continue();
    });

    await page.goto(NON_WATCHLIST_URL, { waitUntil: 'domcontentloaded' });
    await loadExtensionAssets(page);
    await page.waitForTimeout(300);

    await expect(page.locator('.cw-host')).toHaveCount(0);
    await expect(page.locator('.cw-watchlist-frame')).toHaveCount(0);

    const runtime = await page.evaluate(() => window.__CW_WATCHLIST_CURATOR_RUNTIME__ || null);
    expect(runtime?.events?.some((entry) => entry.event === 'mounted')).toBeFalsy();
    expect(watchlistRequestCount).toBe(0);
  });

  test('updates mount state via history route events without polling', async ({ page }) => {
    await injectExtension(page);
    await expect(page.locator('.cw-host')).toBeVisible();

    await page.evaluate(() => {
      history.pushState({}, '', '/browse');
    });
    await expect(page.locator('.cw-host')).toHaveCount(0);
    await expect(page.locator('.cw-watchlist-frame')).toHaveCount(0);

    await page.evaluate(() => {
      history.pushState({}, '', '/watchlist');
    });
    await expect(page.locator('.cw-host')).toBeVisible();
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
  });

  test('mounts when SPA navigation uses native history references captured before extension injection', async ({
    page,
  }) => {
    await page.goto(NON_WATCHLIST_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const windowWithSavedPushState = window as WindowWithSavedPushState;
      windowWithSavedPushState.__CW_TEST_NATIVE_PUSH_STATE__ = history.pushState.bind(history);
    });

    await loadExtensionAssets(page);
    await expect(page.locator('.cw-host')).toHaveCount(0);

    await page.evaluate(async () => {
      const windowWithSavedPushState = window as WindowWithSavedPushState;
      const savedPushState = windowWithSavedPushState.__CW_TEST_NATIVE_PUSH_STATE__;
      if (typeof savedPushState === 'function') {
        savedPushState({}, '', '/watchlist');
      }

      const watchlistResponse = await fetch('/watchlist');
      const watchlistHtml = await watchlistResponse.text();
      const bodyMatch = watchlistHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch?.[1]) {
        document.body.innerHTML = bodyMatch[1];
      }
    });

    await expect(page.locator('.cw-host')).toBeVisible();
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
  });

  test('survives repeated sort/filter + route churn without duplicate hosts', async ({ page }) => {
    await injectExtension(page);
    await expect(page.locator('.cw-host')).toHaveCount(1);
    await expect(page.locator('.cw-curated-card').first()).toBeVisible();

    const assertGridHeightContainsCards = async () => {
      const metrics = await page.evaluate(() => {
        const grid = document.querySelector('.cw-curated-card-container') as HTMLElement | null;
        if (!grid) {
          return null;
        }

        const cards = Array.from(grid.querySelectorAll<HTMLElement>('.cw-curated-card'));
        const maxCardBottom = cards.reduce((maxBottom, card) => {
          return Math.max(maxBottom, card.offsetTop + card.offsetHeight);
        }, 0);

        const styleHeight = Number.parseFloat(grid.style.height || '0') || 0;
        const clientHeight = grid.clientHeight;
        const measuredHeight = grid.getBoundingClientRect().height;

        return {
          cardCount: cards.length,
          maxCardBottom,
          styleHeight,
          clientHeight,
          measuredHeight,
        };
      });

      expect(metrics).not.toBeNull();
      if (!metrics) {
        return;
      }

      expect(metrics.cardCount).toBeGreaterThan(0);
      const effectiveHeight = Math.max(metrics.styleHeight, metrics.clientHeight, metrics.measuredHeight);
      expect(effectiveHeight + 1).toBeGreaterThanOrEqual(metrics.maxCardBottom);
    };

    await assertGridHeightContainsCards();

    const sortModes = ['rating_desc', 'date_added_desc', 'date_updated_desc'];
    const watchReadyModes = ['hide', 'dim', 'none'];

    for (let cycle = 0; cycle < 6; cycle += 1) {
      await page.selectOption('#cw-sort-mode', sortModes[cycle % sortModes.length] || 'rating_desc');
      await page.selectOption('#cw-watch-ready-mode', watchReadyModes[cycle % watchReadyModes.length] || 'hide');
      await expect(page.locator('.cw-host')).toHaveCount(1);
      await expect(page.locator('.cw-curated-card').first()).toBeVisible();

      await page.evaluate(() => {
        history.pushState({}, '', '/browse');
      });
      await expect(page.locator('.cw-host')).toHaveCount(0);

      await page.evaluate(() => {
        history.pushState({}, '', '/watchlist');
      });
      await expect(page.locator('.cw-host')).toHaveCount(1);
      await expect(page.locator('.cw-curated-card').first()).toBeVisible();
      await assertGridHeightContainsCards();
    }
  });
});
