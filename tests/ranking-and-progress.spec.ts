import { expect, test } from '@playwright/test'
import {
  fulfillJsonWithTransform,
  gotoFixture,
  injectExtension,
  visibleFixtureOrder,
} from './helpers/extension-fixture'

type JsonRecord = Record<string, unknown>

function asJsonRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as JsonRecord
}

function rewriteWatchlistRows(payload: unknown, rewriteRow: (row: JsonRecord) => JsonRecord): JsonRecord {
  const payloadRecord = asJsonRecord(payload)
  const rows = Array.isArray(payloadRecord.data) ? payloadRecord.data.map((row) => asJsonRecord(row)) : []
  return {
    ...payloadRecord,
    data: rows.map((row) => rewriteRow(row)),
  }
}

test.describe('Ranking, Filtering, and Progress', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page)
  })

  test('uses correct watchlist API params and keeps filter changes local only', async ({ page }) => {
    const callLog: {
      count: number
      firstUrl: string
      params: Record<string, string>
    } = {
      count: 0,
      firstUrl: '',
      params: {},
    }

    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      callLog.count += 1
      if (callLog.count === 1) {
        const url = new URL(route.request().url())
        callLog.firstUrl = url.toString()
        callLog.params = Object.fromEntries(url.searchParams.entries())
      }

      await route.continue()
    })

    await injectExtension(page)
    const watchAgainItem = page.locator('.cw-curated-card[data-cw-curated-title="Watch Again Show"]')

    await expect(watchAgainItem).toHaveCount(0)
    expect(callLog.count).toBeGreaterThan(0)
    expect(callLog.count).toBeGreaterThanOrEqual(1)
    expect(callLog.firstUrl).toContain('/content/v2/discover/fixture-account/watchlist')
    expect(callLog.params.order).toBe('desc')
    expect(callLog.params.n).toBe('100')
    expect(callLog.params.locale).toBeTruthy()
    expect(callLog.params.preferred_audio_language).toBe(callLog.params.locale)

    const beforeFilterCallCount = callLog.count

    await page.selectOption('#cw-watch-ready-mode', 'dim')
    await expect(watchAgainItem).toHaveCount(1)
    await expect(watchAgainItem).toHaveClass(/cw-curated-card--not-watch-ready/)
    await expect(page.locator('.cw-controls__stats')).toContainText('4 shows')
    expect(callLog.count).toBe(beforeFilterCallCount)

    await page.selectOption('#cw-watch-ready-mode', 'none')
    await expect(watchAgainItem).toHaveCount(1)
    await expect(watchAgainItem).not.toHaveClass(/cw-curated-card--not-watch-ready/)
    await expect(page.locator('.cw-controls__stats')).toContainText('4 shows')
    expect(callLog.count).toBe(beforeFilterCallCount)
  })

  test('uses persisted preferred audio language for watchlist API params', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('preferred_audio_language', 'ja-JP')
    })

    const callLog: {
      count: number
      params: Record<string, string>
    } = {
      count: 0,
      params: {},
    }

    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      callLog.count += 1
      if (callLog.count === 1) {
        const url = new URL(route.request().url())
        callLog.params = Object.fromEntries(url.searchParams.entries())
      }

      await route.continue()
    })

    await injectExtension(page)

    expect(callLog.count).toBeGreaterThan(0)
    expect(callLog.params.preferred_audio_language).toBe('ja-JP')
    expect(callLog.params.locale).toBeTruthy()
  })

  test('shows ratings and sorts loaded cards by rating', async ({ page }) => {
    await injectExtension(page)
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-rating-badge')).toHaveText(
      '★ 4.9',
    )

    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"] .cw-rating-badge')).toHaveText(
      '★ 3.2',
    )

    await expect(page.locator('.cw-curated-card[data-cw-curated-title="No Rating Show"] .cw-rating-badge')).toHaveText(
      'NR',
    )
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-rating-row__percentage').first(),
    ).toHaveText('82%')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__description'),
    ).toContainText('English audio')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__next'),
    ).toHaveText('Next unwatched: S2 E5')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__last-watched'),
    ).toContainText('Last watched:')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__last-watched'),
    ).not.toContainText('unknown')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"] .cw-curated-card__last-watched'),
    ).not.toContainText('unknown')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope'),
    ).toContainText('Seasons: 3')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope'),
    ).toContainText('Episodes: 36')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope'),
    ).toContainText('Unwatched left: 20')
    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__genres'),
    ).toContainText('action')

    const before = await visibleFixtureOrder(page)
    expect(before[0]).toBe('Low Rated Show')

    await page.selectOption('#cw-sort-mode', 'rating_desc')
    await page.waitForTimeout(250)

    const afterDesc = await visibleFixtureOrder(page)
    expect(afterDesc[0]).toBe('High Rated Show')
    expect(afterDesc[afterDesc.length - 1]).toBe('No Rating Show')

    await page.selectOption('#cw-sort-mode', 'rating_asc')
    await page.waitForTimeout(250)

    const afterAsc = await visibleFixtureOrder(page)
    expect(afterAsc[0]).toBe('Low Rated Show')

    await page.selectOption('#cw-sort-mode', 'star_5_desc')
    await page.waitForTimeout(250)

    const afterFiveStar = await visibleFixtureOrder(page)
    expect(afterFiveStar[0]).toBe('High Rated Show')

    await page.selectOption('#cw-sort-mode', 'star_1_pct_desc')
    await page.waitForTimeout(250)

    const afterOneStarPct = await visibleFixtureOrder(page)
    expect(afterOneStarPct[0]).toBe('Low Rated Show')

    await page.selectOption('#cw-sort-mode', 'hidden_gems_desc')
    await page.waitForTimeout(250)

    const afterHiddenGems = await visibleFixtureOrder(page)
    expect(afterHiddenGems[0]).toBe('High Rated Show')

    await page.selectOption('#cw-sort-mode', 'consensus_quality_desc')
    await page.waitForTimeout(250)

    const afterConsensus = await visibleFixtureOrder(page)
    expect(afterConsensus[0]).toBe('High Rated Show')

    await page.selectOption('#cw-sort-mode', 'controversial_desc')
    await page.waitForTimeout(250)

    const afterControversial = await visibleFixtureOrder(page)
    expect(afterControversial[0]).toBe('Low Rated Show')

    await page.selectOption('#cw-sort-mode', 'quality_floor_asc')
    await page.waitForTimeout(250)

    const afterQualityFloor = await visibleFixtureOrder(page)
    expect(afterQualityFloor[0]).toBe('High Rated Show')

    await page.selectOption('#cw-sort-mode', 'quick_wins_asc')
    await page.waitForTimeout(250)

    const afterQuickWins = await visibleFixtureOrder(page)
    expect(afterQuickWins[0]).toBe('No Rating Show')

    await page.selectOption('#cw-sort-mode', 'dormant_backlog_asc')
    await page.waitForTimeout(250)

    const afterDormantBacklog = await visibleFixtureOrder(page)
    expect(afterDormantBacklog[0]).toBe('Low Rated Show')

    await page.selectOption('#cw-sort-mode', 'rewatch_memory_desc')
    await page.waitForTimeout(250)

    const afterRewatchMemory = await visibleFixtureOrder(page)
    expect(afterRewatchMemory[0]).toBe('High Rated Show')

    await page.selectOption('#cw-sort-mode', 'date_added_desc')
    await page.waitForTimeout(250)

    const afterDateAdded = await visibleFixtureOrder(page)
    expect(afterDateAdded[0]).toBe('High Rated Show')

    await page.selectOption('#cw-sort-mode', 'date_updated_desc')
    await page.waitForTimeout(250)

    const afterDateUpdated = await visibleFixtureOrder(page)
    expect(afterDateUpdated[0]).toBe('No Rating Show')
  })

  test('filters by audio locale and genre using dropdowns', async ({ page }) => {
    await injectExtension(page)
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toHaveCount(1)

    await page.selectOption('#cw-audio-filter', 'en-US')
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="Low Rated Show"]')).toHaveCount(0)
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 2 of 4')

    await page.selectOption('#cw-genre-filter', 'action')
    await expect(page.locator('.cw-curated-card')).toHaveCount(1)
    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]')).toHaveCount(1)
  })

  test('updates unwatched count to match selected audio locale progress', async ({ page }) => {
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      await fulfillJsonWithTransform(route, (payload, request) => {
        const url = new URL(request.url())
        const preferredAudioLanguage = String(url.searchParams.get('preferred_audio_language') || '')
          .trim()
          .toLowerCase()
        const payloadRecord = asJsonRecord(payload)
        const rows = Array.isArray(payloadRecord.data) ? payloadRecord.data : []
        const filteredRows = preferredAudioLanguage
          ? rows.filter((row) => {
              const rowRecord = asJsonRecord(row)
              const rowPanel = asJsonRecord(rowRecord.panel)
              const rowEpisodeMetadata = asJsonRecord(rowPanel.episode_metadata)
              const rowAudioLocale = String(rowEpisodeMetadata.audio_locale || '')
                .trim()
                .toLowerCase()
              return rowAudioLocale === preferredAudioLanguage
            })
          : rows

        return {
          ...payloadRecord,
          total: filteredRows.length,
          data: filteredRows,
        }
      })
    })

    await injectExtension(page)
    const highRatedScope = page.locator(
      '.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope',
    )

    await expect(highRatedScope).toContainText('Episodes: 36')
    await expect(highRatedScope).toContainText('Unwatched left: 20')

    await page.selectOption('#cw-audio-filter', 'ja-JP')
    await expect(highRatedScope).toContainText('Episodes: 32')
    await expect(highRatedScope).toContainText('Unwatched left: 4')

    await page.selectOption('#cw-audio-filter', 'en-US')
    await expect(highRatedScope).toContainText('Episodes: 36')
    await expect(highRatedScope).toContainText('Unwatched left: 20')
  })

  test('keeps default-audio unwatched count correct when watch-history rows omit audio locale', async ({ page }) => {
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      await fulfillJsonWithTransform(route, (payload) => {
        const payloadRecord = asJsonRecord(payload)
        const rows = Array.isArray(payloadRecord.data) ? payloadRecord.data : []
        const rewrittenRows = rows.map((row) => {
          const rowRecord = asJsonRecord(row)
          const panel = asJsonRecord(rowRecord.panel)
          const episodeMetadata = asJsonRecord(panel.episode_metadata)
          if (!Object.keys(episodeMetadata).length) {
            return rowRecord
          }

          const nextEpisodeMetadata = { ...episodeMetadata }
          delete nextEpisodeMetadata.audio_locale

          return {
            ...rowRecord,
            panel: {
              ...panel,
              episode_metadata: nextEpisodeMetadata,
            },
          }
        })

        return {
          ...payloadRecord,
          data: rewrittenRows,
        }
      })
    })

    await injectExtension(page)

    const highRatedScope = page.locator(
      '.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope',
    )
    await page.selectOption('#cw-audio-filter', 'en-US')
    await expect(highRatedScope).toContainText('Episodes: 36')
    await expect(highRatedScope).toContainText('Unwatched left: 20')
  })

  test('shows Continue instead of Up Next when playhead progress exists', async ({ page }) => {
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      await fulfillJsonWithTransform(route, (payload) => {
        return rewriteWatchlistRows(payload, (row) => {
          const rowPanel = asJsonRecord(row.panel)
          const rowEpisodeMetadata = asJsonRecord(rowPanel.episode_metadata)
          const seriesId = rowEpisodeMetadata.series_id
          if (seriesId !== 'GNONE789') {
            return row
          }

          return {
            ...row,
            new: true,
            never_watched: false,
            playhead: Math.max(1, Number(row.playhead || 0)),
          }
        })
      })
    })

    await injectExtension(page)

    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="No Rating Show"] .cw-curated-card__status'),
    ).toContainText('Continue')
  })

  test('uses watch-history progress to show Continue when watchlist playhead is zero', async ({ page }) => {
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      await fulfillJsonWithTransform(route, (payload) => {
        return rewriteWatchlistRows(payload, (row) => {
          const rowPanel = asJsonRecord(row.panel)
          const rowEpisodeMetadata = asJsonRecord(rowPanel.episode_metadata)
          const seriesId = rowEpisodeMetadata.series_id
          if (seriesId !== 'GNONE789') {
            return row
          }

          return {
            ...row,
            new: true,
            never_watched: false,
            playhead: 0,
          }
        })
      })
    })

    await injectExtension(page)

    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="No Rating Show"] .cw-curated-card__status'),
    ).toContainText('Continue')
  })

  test('hydrates from watchlist cache immediately and revalidates in background', async ({ page }) => {
    await injectExtension(page)
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')
    await page.evaluate(() => {
      const key = 'cw_watchlist_cache_v1'
      const rawCache = localStorage.getItem(key)
      if (!rawCache) {
        return
      }

      const cache = JSON.parse(rawCache)
      if (!cache || typeof cache !== 'object') {
        return
      }

      cache.updatedAt = Date.now() - 2000
      localStorage.setItem(key, JSON.stringify(cache))
    })

    let watchlistCalls = 0
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      watchlistCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 700))
      await route.continue()
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await injectExtension(page, { activeTab: 'curated' }, { waitForLoaded: false, preserveCaches: true })

    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]')).toBeVisible()
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4')
    await expect.poll(() => watchlistCalls, { timeout: 5000 }).toBeGreaterThan(0)
    expect(watchlistCalls).toBeGreaterThan(0)
  })
})
