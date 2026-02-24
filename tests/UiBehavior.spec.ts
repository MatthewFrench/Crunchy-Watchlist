import { expect, test } from '@playwright/test'
import { gotoFixture, injectExtension, loadExtensionAssets } from './Helpers/ExtensionFixture'

test.describe('UI Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page)
  })

  test('hides not watch-ready cards by default and can toggle visibility', async ({ page }) => {
    await injectExtension(page)
    const watchAgainItem = page.locator('.cw-curated-card[data-cw-curated-title="Watch Again Show"]')

    await expect(watchAgainItem).toHaveCount(0)
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')

    await page.selectOption('#cw-watch-ready-mode', 'dim')
    await expect(watchAgainItem).toHaveCount(1)
    await expect(watchAgainItem).toHaveClass(/cw-curated-card--not-watch-ready/)
    await expect(page.locator('.cw-controls__stats')).toContainText('4 shows')

    await page.selectOption('#cw-watch-ready-mode', 'none')
    await expect(watchAgainItem).toHaveCount(1)
    await expect(watchAgainItem).not.toHaveClass(/cw-curated-card--not-watch-ready/)
    await expect(page.locator('.cw-controls__stats')).toContainText('4 shows')
  })

  test('renders refresh action as a button and toggles card layout mode', async ({ page }) => {
    await injectExtension(page)

    const refreshButton = page.getByRole('button', { name: 'Refresh ratings' })
    await expect(refreshButton).toHaveClass(/cw-button/)
    await expect(refreshButton).toHaveClass(/cw-button--primary/)

    await expect(page.locator('.cw-host')).toHaveAttribute('data-cw-card-layout', 'portrait')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__thumb img'),
    ).toHaveAttribute('src', /GHIGH456-portrait\.jpg$/)

    await page.locator('#cw-landscape-cards').check()
    await expect(page.locator('.cw-host')).toHaveAttribute('data-cw-card-layout', 'landscape')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__thumb img'),
    ).toHaveAttribute('src', /GHIGH456-landscape\.jpg$/)

    await page.locator('#cw-landscape-cards').uncheck()
    await expect(page.locator('.cw-host')).toHaveAttribute('data-cw-card-layout', 'portrait')
  })

  test('forwards favorite and remove actions to native controls', async ({ page }) => {
    await injectExtension(page)

    const highRatedCard = page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]')
    const highFavoriteButton = highRatedCard.locator('button[data-cw-action="favorite"]')

    await expect(highFavoriteButton).toHaveAttribute('aria-pressed', 'true')
    await highFavoriteButton.click()
    await expect(highFavoriteButton).toHaveAttribute('aria-pressed', 'false')

    await highRatedCard.locator('.cw-curated-card__thumb').hover()

    page.once('dialog', (dialog) => dialog.accept())
    await page
      .locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"] button[data-cw-action="remove"]')
      .click()
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toHaveCount(0)

    const actionLog = await page.evaluate(() => window.__cwFixtureActionLog || [])
    expect(actionLog.some((entry) => entry.action === 'favorite' && entry.seriesId === 'GHIGH456')).toBeTruthy()
    expect(actionLog.some((entry) => entry.action === 'remove' && entry.seriesId === 'GLOW123')).toBeTruthy()
  })

  test('navigates to series page when clicking non-interactive card body area', async ({ page }) => {
    await injectExtension(page)

    await page
      .locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__description')
      .click()

    await expect(page).toHaveURL(/\/series\/GHIGH456\/high-rated-show$/)
  })

  test('restores native watchlist visibility when switching back to Crunchyroll tab', async ({ page }) => {
    await injectExtension(page)
    await expect(page.locator('.cw-curated-grid')).toBeVisible()
    await page.getByRole('button', { name: 'Crunchyroll' }).click()

    await expect(page.locator('[data-t="watch-list-card"]').first()).toBeVisible()
    await expect(page.locator('.cw-panel')).toBeHidden()
  })

  test('shows loading indicator while curated data is loading', async ({ page }) => {
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      await page.waitForTimeout(700)
      await route.continue()
    })

    await injectExtension(page, { activeTab: 'curated' }, { waitForLoaded: false })
    await expect(page.locator('.cw-loading-indicator')).toBeVisible()
    await expect(page.locator('.cw-empty .cw-spinner')).toBeVisible()

    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')
    await expect(page.locator('.cw-loading-indicator')).toBeHidden()
  })

  test('preloads curated data while Crunchyroll tab is active', async ({ page }) => {
    await injectExtension(page, { activeTab: 'crunchyroll' }, { waitForLoaded: false, expectCuratedVisible: false })

    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')
    await page.getByRole('button', { name: 'Curated' }).click()
    await expect(page.locator('.cw-curated-card').first()).toBeVisible({ timeout: 500 })
  })

  test('persists selected dropdown filters across reload', async ({ page }) => {
    await injectExtension(page)

    await page.selectOption('#cw-watch-ready-mode', 'dim')
    await page.selectOption('#cw-audio-filter', 'en-US')
    await page.selectOption('#cw-genre-filter', 'action')
    await page.selectOption('#cw-sort-mode', 'date_updated_desc')
    await page.locator('#cw-landscape-cards').check()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await loadExtensionAssets(page)
    await expect(page.locator('.cw-host')).toBeVisible()

    await expect(page.locator('#cw-watch-ready-mode')).toHaveValue('dim')
    await expect(page.locator('#cw-audio-filter')).toHaveValue('en-US')
    await expect(page.locator('#cw-genre-filter')).toHaveValue('action')
    await expect(page.locator('#cw-sort-mode')).toHaveValue('date_updated_desc')
    await expect(page.locator('#cw-landscape-cards')).toBeChecked()
    await expect(page.locator('.cw-host')).toHaveAttribute('data-cw-card-layout', 'landscape')
  })
})
