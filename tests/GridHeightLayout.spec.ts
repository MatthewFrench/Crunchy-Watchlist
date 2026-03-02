import { expect, test } from '@playwright/test';
import { gotoFixture, injectExtension } from './Helpers/ExtensionFixture';

test.describe('Grid Height Layout', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  test('keeps curated grid height large enough for absolutely positioned cards during sort churn', async ({ page }) => {
    await injectExtension(
      page,
      {
        watchReadyFilterMode: 'none',
      },
      {
        waitForLoaded: false,
      },
    );
    await expect(page.locator('.cw-controls__stats')).toContainText('4 shows');

    const assertGridHeightContainsCards = async () => {
      const metrics = await page.evaluate(() => {
        const grid = document.querySelector('.cw-curated-grid') as HTMLElement | null;
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

    const sortModes = ['rating_desc', 'rating_asc', 'date_updated_desc', 'consensus_quality_desc'];
    for (const sortMode of sortModes) {
      await page.selectOption('#cw-sort-mode', sortMode);
      await page.waitForTimeout(1100);
      await assertGridHeightContainsCards();
    }
  });
});
