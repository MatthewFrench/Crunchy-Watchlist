import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { NON_WATCHLIST_URL, gotoFixture, injectExtension, loadExtensionAssets } from './helpers/extension-fixture'

test('manifest injects on all Crunchyroll pages for SPA watchlist navigation', async () => {
  const manifestPath = path.join(process.cwd(), 'extension', 'manifest.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    content_scripts?: Array<{
      matches?: string[]
    }>
  }
  const matches = manifest.content_scripts?.[0]?.matches || []

  expect(matches).toContain('https://www.crunchyroll.com/*')
})

test.describe('Routing and Mounting', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page)
  })

  test('does not mount or call watchlist APIs on non-watchlist pages', async ({ page }) => {
    let watchlistRequestCount = 0
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      watchlistRequestCount += 1
      await route.continue()
    })

    await page.goto(NON_WATCHLIST_URL, { waitUntil: 'domcontentloaded' })
    await loadExtensionAssets(page)
    await page.waitForTimeout(300)

    await expect(page.locator('.cw-host')).toHaveCount(0)
    await expect(page.locator('.cw-watchlist-frame')).toHaveCount(0)

    const runtime = await page.evaluate(() => window.__CW_WATCHLIST_CURATOR_RUNTIME__ || null)
    expect(runtime?.events?.some((entry) => entry.event === 'mounted')).toBeFalsy()
    expect(watchlistRequestCount).toBe(0)
  })

  test('updates mount state via history route events without polling', async ({ page }) => {
    await injectExtension(page)
    await expect(page.locator('.cw-host')).toBeVisible()

    await page.evaluate(() => {
      history.pushState({}, '', '/browse')
    })
    await expect(page.locator('.cw-host')).toHaveCount(0)
    await expect(page.locator('.cw-watchlist-frame')).toHaveCount(0)

    await page.evaluate(() => {
      history.pushState({}, '', '/watchlist')
    })
    await expect(page.locator('.cw-host')).toBeVisible()
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')
  })
})
