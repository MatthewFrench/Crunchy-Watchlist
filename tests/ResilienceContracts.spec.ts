import { expect, test } from '@playwright/test'
import { gotoFixture, injectExtension } from './Helpers/ExtensionFixture'

test.describe('Resilience and API Contract Handling', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page)
  })

  test('retries transient 5xx watchlist failures', async ({ page }) => {
    let watchlistCalls = 0
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      watchlistCalls += 1
      if (watchlistCalls === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: 'upstream unavailable' }),
        })
        return
      }

      await route.continue()
    })

    await injectExtension(page)
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')
    expect(watchlistCalls).toBeGreaterThanOrEqual(2)
  })

  test('refreshes auth token once and retries after a 401 watchlist response', async ({ page }) => {
    let watchlistCalls = 0
    let authCalls = 0

    await page.route('**/auth/v1/token', async (route) => {
      authCalls += 1
      await route.continue()
    })

    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      watchlistCalls += 1
      if (watchlistCalls === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ error: 'unauthorized' }),
        })
        return
      }

      await route.continue()
    })

    await injectExtension(page)
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')
    expect(watchlistCalls).toBeGreaterThanOrEqual(2)
    expect(authCalls).toBeGreaterThanOrEqual(2)
  })

  test('surfaces watchlist contract drift when data[] is missing', async ({ page }) => {
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ total: 4, items: [] }),
      })
    })

    await injectExtension(page, { activeTab: 'curated' }, { waitForLoaded: false })
    await expect(page.locator('.cw-controls__stats')).toContainText('API load failed')
    await expect(page.locator('.cw-empty')).toContainText('contract changed for watchlist')

    const runtime = await page.evaluate(() => window.__CW_WATCHLIST_CURATOR_RUNTIME__ || null)
    const hasContractError = Boolean(
      runtime?.events?.some((entry) => {
        const data = entry.data as { endpoint?: unknown } | null | undefined
        return entry.event === 'api-contract-error' && data?.endpoint === 'watchlist'
      }),
    )
    expect(hasContractError).toBeTruthy()
  })

  test('degrades gracefully when watch-history contract changes', async ({ page }) => {
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ total: 3, items: [] }),
      })
    })

    await injectExtension(page)
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__last-watched'),
    ).toContainText('history unavailable')

    const runtime = await page.evaluate(() => window.__CW_WATCHLIST_CURATOR_RUNTIME__ || null)
    const hasHistoryContractError = Boolean(
      runtime?.events?.some((entry) => {
        const data = entry.data as { endpoint?: unknown } | null | undefined
        return entry.event === 'api-contract-error' && data?.endpoint === 'watch-history'
      }),
    )
    expect(hasHistoryContractError).toBeTruthy()
  })

  test('degrades gracefully when cms object contract changes', async ({ page }) => {
    await page.route('**/content/v2/cms/objects/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ total: 4, items: [] }),
      })
    })

    await injectExtension(page)
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-rating-badge')).toHaveText(
      'NR',
    )

    const runtime = await page.evaluate(() => window.__CW_WATCHLIST_CURATOR_RUNTIME__ || null)
    const hasCmsContractError = Boolean(
      runtime?.events?.some((entry) => {
        const data = entry.data as { endpoint?: unknown } | null | undefined
        return entry.event === 'api-contract-error' && data?.endpoint === 'cms-objects'
      }),
    )
    expect(hasCmsContractError).toBeTruthy()
  })
})
