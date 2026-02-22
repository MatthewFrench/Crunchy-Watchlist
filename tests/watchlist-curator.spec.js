const path = require('node:path');
const { test, expect } = require('@playwright/test');

const FIXTURE_URL = 'http://127.0.0.1:4173/watchlist';
const NON_WATCHLIST_URL = 'http://127.0.0.1:4173/browse';

async function loadExtensionAssets(page) {
  await page.addStyleTag({ path: path.join(process.cwd(), 'extension', 'content.css') });
  await page.addScriptTag({ path: path.join(process.cwd(), 'extension', 'content.js') });
}

async function injectExtension(page, settingsOverride = {}, options = {}) {
  const settings = {
    activeTab: 'curated',
    watchReadyFilterMode: 'hide',
    audioLocaleFilter: 'any',
    genreFilter: 'any',
    cardLayout: 'portrait',
    sortMode: 'none',
    ...settingsOverride
  };
  const waitForLoaded = options.waitForLoaded !== false;
  const expectCuratedVisible =
    typeof options.expectCuratedVisible === 'boolean' ? options.expectCuratedVisible : settings.activeTab === 'curated';
  const preserveCaches = options.preserveCaches === true;

  await page.evaluate(({ nextSettings, keepCaches }) => {
    localStorage.setItem(
      'cw_settings_v1',
      JSON.stringify(nextSettings)
    );
    if (!keepCaches) {
      localStorage.removeItem('cw_rating_cache_v2');
      localStorage.removeItem('cw_watch_history_cache_v1');
      localStorage.removeItem('cw_watchlist_cache_v1');
    }
  }, { nextSettings: settings, keepCaches: preserveCaches });

  await loadExtensionAssets(page);
  await expect(page.locator('.cw-host')).toBeVisible();
  await expect(page.locator('.cw-curated-grid')).toHaveCount(1);

  if (expectCuratedVisible) {
    await expect(page.locator('.cw-panel')).toBeVisible();
  } else {
    await expect(page.locator('.cw-panel')).toBeHidden();
  }

  if (waitForLoaded) {
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
  }
}

async function visibleFixtureOrder(page) {
  return page.$$eval(
    '.cw-curated-card',
    (cards) => cards.map((card) => card.getAttribute('data-cw-curated-title'))
  );
}

test.describe('Crunchy Watchlist Curator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FIXTURE_URL, { waitUntil: 'domcontentloaded' });
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

  test('hides not watch-ready cards by default and can toggle visibility', async ({ page }) => {
    await injectExtension(page);
    const watchAgainItem = page.locator('.cw-curated-card[data-cw-curated-title="Watch Again Show"]');

    await expect(watchAgainItem).toHaveCount(0);
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');

    await page.selectOption('#cw-watch-ready-mode', 'dim');
    await expect(watchAgainItem).toHaveCount(1);
    await expect(watchAgainItem).toHaveClass(/cw-curated-card--not-watch-ready/);
    await expect(page.locator('.cw-controls__stats')).toContainText('4 shows');

    await page.selectOption('#cw-watch-ready-mode', 'none');
    await expect(watchAgainItem).toHaveCount(1);
    await expect(watchAgainItem).not.toHaveClass(/cw-curated-card--not-watch-ready/);
    await expect(page.locator('.cw-controls__stats')).toContainText('4 shows');
  });

  test('uses correct watchlist API params and keeps filter changes local only', async ({ page }) => {
    const callLog = {
      count: 0,
      firstUrl: '',
      params: {}
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
    expect(callLog.params).toMatchObject({
      order: 'desc',
      n: '100',
      preferred_audio_language: 'en-US',
      locale: 'en-US'
    });

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

  test('renders refresh action as a button and toggles card layout mode', async ({ page }) => {
    await injectExtension(page);

    const refreshButton = page.getByRole('button', { name: 'Refresh ratings' });
    await expect(refreshButton).toHaveClass(/cw-button/);
    await expect(refreshButton).toHaveClass(/cw-button--primary/);

    await expect(page.locator('.cw-host')).toHaveAttribute('data-cw-card-layout', 'portrait');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__thumb img')
    ).toHaveAttribute('src', /GHIGH456-portrait\.jpg$/);

    await page.locator('#cw-landscape-cards').check();
    await expect(page.locator('.cw-host')).toHaveAttribute('data-cw-card-layout', 'landscape');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__thumb img')
    ).toHaveAttribute('src', /GHIGH456-landscape\.jpg$/);

    await page.locator('#cw-landscape-cards').uncheck();
    await expect(page.locator('.cw-host')).toHaveAttribute('data-cw-card-layout', 'portrait');
  });

  test('forwards favorite and remove actions to native controls', async ({ page }) => {
    await injectExtension(page);

    const highRatedCard = page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]');
    const highFavoriteButton = highRatedCard.locator('button[data-cw-action="favorite"]');

    await expect(highFavoriteButton).toHaveAttribute('aria-pressed', 'true');
    await highFavoriteButton.click();
    await expect(highFavoriteButton).toHaveAttribute('aria-pressed', 'false');

    await highRatedCard.locator('.cw-curated-card__thumb').hover();

    page.once('dialog', (dialog) => dialog.accept());
    await page
      .locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"] button[data-cw-action="remove"]')
      .click();
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toHaveCount(0);

    const actionLog = await page.evaluate(() => window.__cwFixtureActionLog || []);
    expect(actionLog.some((entry) => entry.action === 'favorite' && entry.seriesId === 'GHIGH456')).toBeTruthy();
    expect(actionLog.some((entry) => entry.action === 'remove' && entry.seriesId === 'GLOW123')).toBeTruthy();
  });

  test('navigates to series page when clicking non-interactive card body area', async ({ page }) => {
    await injectExtension(page);

    await page
      .locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__description')
      .click();

    await expect(page).toHaveURL(/\/series\/GHIGH456\/high-rated-show$/);
  });

  test('shows ratings and sorts loaded cards by rating', async ({ page }) => {
    await injectExtension(page);
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-rating-badge')
    ).toHaveText('★ 4.9');

    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"] .cw-rating-badge')
    ).toHaveText('★ 3.2');

    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="No Rating Show"] .cw-rating-badge')
    ).toHaveText('NR');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-rating-row__percentage').first()
    ).toHaveText('82%');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__description')
    ).toContainText('English audio');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__next')
    ).toHaveText('Next unwatched: S2 E5');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__last-watched')
    ).toContainText('Last watched:');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__last-watched')
    ).not.toContainText('unknown');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"] .cw-curated-card__last-watched')
    ).not.toContainText('unknown');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope')
    ).toContainText('Seasons: 3');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope')
    ).toContainText('Episodes: 36');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope')
    ).toContainText('Unwatched left: 20');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__genres')
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
    expect(afterQuickWins[0]).toBe('No Rating Show');

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

  test('filters by audio locale and genre using dropdowns', async ({ page }) => {
    await injectExtension(page);
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toHaveCount(1);

    await page.selectOption('#cw-audio-filter', 'en-US');
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toHaveCount(0);
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 2 of 4');

    await page.selectOption('#cw-genre-filter', 'action');
    await expect(page.locator('.cw-curated-card')).toHaveCount(1);
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]')).toHaveCount(1);
  });

  test('restores native watchlist visibility when switching back to Crunchyroll tab', async ({ page }) => {
    await injectExtension(page);
    await expect(page.locator('.cw-curated-grid')).toBeVisible();
    await page.getByRole('button', { name: 'Crunchyroll' }).click();

    await expect(page.locator('[data-t="watch-list-card"]').first()).toBeVisible();
    await expect(page.locator('.cw-panel')).toBeHidden();
  });

  test('shows loading indicator while curated data is loading', async ({ page }) => {
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      await page.waitForTimeout(700);
      await route.continue();
    });

    await injectExtension(page, { activeTab: 'curated' }, { waitForLoaded: false });
    await expect(page.locator('.cw-loading-indicator')).toBeVisible();
    await expect(page.locator('.cw-empty .cw-spinner')).toBeVisible();

    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
    await expect(page.locator('.cw-loading-indicator')).toBeHidden();
  });

  test('preloads curated data while Crunchyroll tab is active', async ({ page }) => {
    await injectExtension(page, { activeTab: 'crunchyroll' }, { waitForLoaded: false, expectCuratedVisible: false });

    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
    await page.getByRole('button', { name: 'Curated' }).click();
    await expect(page.locator('.cw-curated-card').first()).toBeVisible({ timeout: 500 });
  });

  test('hydrates from watchlist cache immediately and revalidates in background', async ({ page }) => {
    await injectExtension(page);
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
    await page.evaluate(() => {
      const key = 'cw_watchlist_cache_v1';
      const rawCache = localStorage.getItem(key);
      if (!rawCache) {
        return;
      }

      const cache = JSON.parse(rawCache);
      if (!cache || typeof cache !== 'object') {
        return;
      }

      cache.updatedAt = Date.now() - 2000;
      localStorage.setItem(key, JSON.stringify(cache));
    });

    let watchlistCalls = 0;
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      watchlistCalls += 1;
      await page.waitForTimeout(700);
      await route.continue();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await injectExtension(page, { activeTab: 'curated' }, { waitForLoaded: false, preserveCaches: true });

    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]')).toBeVisible();
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
    await expect
      .poll(() => watchlistCalls)
      .toBeGreaterThan(0, { timeout: 5000 });
    expect(watchlistCalls).toBeGreaterThan(0);
  });

  test('retries transient 5xx watchlist failures', async ({ page }) => {
    let watchlistCalls = 0;
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      watchlistCalls += 1;
      if (watchlistCalls === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: 'upstream unavailable' })
        });
        return;
      }

      await route.continue();
    });

    await injectExtension(page);
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
    expect(watchlistCalls).toBeGreaterThanOrEqual(2);
  });

  test('refreshes auth token once and retries after a 401 watchlist response', async ({ page }) => {
    let watchlistCalls = 0;
    let authCalls = 0;

    await page.route('**/auth/v1/token', async (route) => {
      authCalls += 1;
      await route.continue();
    });

    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      watchlistCalls += 1;
      if (watchlistCalls === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: 'unauthorized' })
        });
        return;
      }

      await route.continue();
    });

    await injectExtension(page);
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
    expect(watchlistCalls).toBeGreaterThanOrEqual(2);
    expect(authCalls).toBeGreaterThanOrEqual(2);
  });

  test('surfaces watchlist contract drift when data[] is missing', async ({ page }) => {
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ total: 4, items: [] })
      });
    });

    await injectExtension(page, { activeTab: 'curated' }, { waitForLoaded: false });
    await expect(page.locator('.cw-controls__stats')).toContainText('API load failed');
    await expect(page.locator('.cw-empty')).toContainText('contract changed for watchlist');

    const runtime = await page.evaluate(() => window.__CW_WATCHLIST_CURATOR_RUNTIME__ || null);
    const hasContractError = Boolean(
      runtime?.events?.some(
        (entry) => entry.event === 'api-contract-error' && entry.data?.endpoint === 'watchlist'
      )
    );
    expect(hasContractError).toBeTruthy();
  });

  test('degrades gracefully when watch-history contract changes', async ({ page }) => {
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ total: 3, items: [] })
      });
    });

    await injectExtension(page);
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__last-watched')
    ).toContainText('history unavailable');

    const runtime = await page.evaluate(() => window.__CW_WATCHLIST_CURATOR_RUNTIME__ || null);
    const hasHistoryContractError = Boolean(
      runtime?.events?.some(
        (entry) => entry.event === 'api-contract-error' && entry.data?.endpoint === 'watch-history'
      )
    );
    expect(hasHistoryContractError).toBeTruthy();
  });

  test('degrades gracefully when cms object contract changes', async ({ page }) => {
    await page.route('**/content/v2/cms/objects/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ total: 4, items: [] })
      });
    });

    await injectExtension(page);
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-rating-badge')
    ).toHaveText('NR');

    const runtime = await page.evaluate(() => window.__CW_WATCHLIST_CURATOR_RUNTIME__ || null);
    const hasCmsContractError = Boolean(
      runtime?.events?.some(
        (entry) => entry.event === 'api-contract-error' && entry.data?.endpoint === 'cms-objects'
      )
    );
    expect(hasCmsContractError).toBeTruthy();
  });

  test('persists selected dropdown filters across reload', async ({ page }) => {
    await injectExtension(page);

    await page.selectOption('#cw-watch-ready-mode', 'dim');
    await page.selectOption('#cw-audio-filter', 'en-US');
    await page.selectOption('#cw-genre-filter', 'action');
    await page.selectOption('#cw-sort-mode', 'date_updated_desc');
    await page.locator('#cw-landscape-cards').check();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await loadExtensionAssets(page);
    await expect(page.locator('.cw-host')).toBeVisible();

    await expect(page.locator('#cw-watch-ready-mode')).toHaveValue('dim');
    await expect(page.locator('#cw-audio-filter')).toHaveValue('en-US');
    await expect(page.locator('#cw-genre-filter')).toHaveValue('action');
    await expect(page.locator('#cw-sort-mode')).toHaveValue('date_updated_desc');
    await expect(page.locator('#cw-landscape-cards')).toBeChecked();
    await expect(page.locator('.cw-host')).toHaveAttribute('data-cw-card-layout', 'landscape');
  });
});
