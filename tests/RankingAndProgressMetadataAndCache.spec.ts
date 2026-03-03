import { expect, test } from '@playwright/test';
import { fulfillJsonWithTransform, gotoFixture, injectExtension } from './Helpers/ExtensionFixture';

type JsonRecord = Record<string, unknown>;

function asJsonRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as JsonRecord;
}

function rewriteWatchlistRows(payload: unknown, rewriteRow: (row: JsonRecord) => JsonRecord): JsonRecord {
  const payloadRecord = asJsonRecord(payload);
  const rows = Array.isArray(payloadRecord.data) ? payloadRecord.data.map((row) => asJsonRecord(row)) : [];
  return {
    ...payloadRecord,
    data: rows.map((row) => rewriteRow(row)),
  };
}

test.describe('Ranking, Filtering, and Progress (Metadata + Cache)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  test('updates unwatched count to match selected audio locale progress', async ({ page }) => {
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      await fulfillJsonWithTransform(route, (payload, request) => {
        const url = new URL(request.url());
        const preferredAudioLanguage = String(url.searchParams.get('preferred_audio_language') || '')
          .trim()
          .toLowerCase();
        const payloadRecord = asJsonRecord(payload);
        const rows = Array.isArray(payloadRecord.data) ? payloadRecord.data : [];
        const filteredRows = preferredAudioLanguage
          ? rows.filter((row) => {
              const rowRecord = asJsonRecord(row);
              const rowPanel = asJsonRecord(rowRecord.panel);
              const rowEpisodeMetadata = asJsonRecord(rowPanel.episode_metadata);
              const rowAudioLocale = String(rowEpisodeMetadata.audio_locale || '')
                .trim()
                .toLowerCase();
              return rowAudioLocale === preferredAudioLanguage;
            })
          : rows;

        return {
          ...payloadRecord,
          total: filteredRows.length,
          data: filteredRows,
        };
      });
    });

    await injectExtension(page);
    const highRatedScope = page.locator(
      '.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope',
    );

    await expect(highRatedScope).toContainText('Episodes: 36');
    await expect(highRatedScope).toContainText('Unwatched left: 20');

    await page.selectOption('#cw-audio-filter', 'ja-JP');
    await expect(highRatedScope).toContainText('Episodes: 32');
    await expect(highRatedScope).toContainText('Unwatched left: 4');

    await page.selectOption('#cw-audio-filter', 'en-US');
    await expect(highRatedScope).toContainText('Episodes: 36');
    await expect(highRatedScope).toContainText('Unwatched left: 20');
  });

  test('keeps unwatched count stable for high episode indices across audio filter toggles', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('preferred_audio_language', 'ja-JP');
    });

    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      await fulfillJsonWithTransform(route, (payload) => {
        return rewriteWatchlistRows(payload, (row) => {
          const rowPanel = asJsonRecord(row.panel);
          const rowEpisodeMetadata = asJsonRecord(rowPanel.episode_metadata);
          if (rowEpisodeMetadata.series_id !== 'GHIGH456') {
            return row;
          }

          return {
            ...row,
            panel: {
              ...rowPanel,
              episode_metadata: {
                ...rowEpisodeMetadata,
                season_number: 3,
                episode_number: 50,
                sequence_number: 3,
                audio_locale: 'ja-JP',
              },
            },
          };
        });
      });
    });

    await page.route('**/content/v2/**/watch-history*', async (route) => {
      await fulfillJsonWithTransform(route, (payload, request) => {
        const url = new URL(request.url());
        const preferredAudioLanguage = String(url.searchParams.get('preferred_audio_language') || '')
          .trim()
          .toLowerCase();
        const payloadRecord = asJsonRecord(payload);
        const rows = Array.isArray(payloadRecord.data) ? payloadRecord.data : [];
        const rewrittenRows = rows.map((row) => {
          const rowRecord = asJsonRecord(row);
          const rowPanel = asJsonRecord(rowRecord.panel);
          const rowEpisodeMetadata = asJsonRecord(rowPanel.episode_metadata);
          if (rowEpisodeMetadata.series_id !== 'GHIGH456') {
            return rowRecord;
          }

          const rowAudioLocale = String(rowEpisodeMetadata.audio_locale || '')
            .trim()
            .toLowerCase();
          if (rowAudioLocale === 'ja-jp') {
            return {
              ...rowRecord,
              fully_watched: true,
              panel: {
                ...rowPanel,
                episode_metadata: {
                  ...rowEpisodeMetadata,
                  season_number: 3,
                  episode_number: 49,
                  sequence_number: 2,
                  audio_locale: 'ja-JP',
                },
              },
            };
          }

          if (rowAudioLocale === 'en-us') {
            return {
              ...rowRecord,
              fully_watched: false,
              playhead: 0,
              panel: {
                ...rowPanel,
                episode_metadata: {
                  ...rowEpisodeMetadata,
                  season_number: 2,
                  episode_number: 24,
                  sequence_number: 24,
                  audio_locale: 'en-US',
                },
              },
            };
          }

          return rowRecord;
        });

        const filteredRows = preferredAudioLanguage
          ? rewrittenRows.filter((row) => {
              const rowRecord = asJsonRecord(row);
              const rowPanel = asJsonRecord(rowRecord.panel);
              const rowEpisodeMetadata = asJsonRecord(rowPanel.episode_metadata);
              const rowAudioLocale = String(rowEpisodeMetadata.audio_locale || '')
                .trim()
                .toLowerCase();
              return rowAudioLocale === preferredAudioLanguage;
            })
          : rewrittenRows;

        return {
          ...payloadRecord,
          total: filteredRows.length,
          data: filteredRows,
        };
      });
    });

    await page.route('**/content/v2/cms/objects/*', async (route) => {
      await fulfillJsonWithTransform(route, (payload, request) => {
        const url = new URL(request.url());
        const preferredAudioLanguage = String(url.searchParams.get('preferred_audio_language') || '')
          .trim()
          .toLowerCase();
        const payloadRecord = asJsonRecord(payload);
        const rows = Array.isArray(payloadRecord.data) ? payloadRecord.data : [];
        const rewrittenRows = rows.map((row) => {
          const rowRecord = asJsonRecord(row);
          if (rowRecord.id !== 'GHIGH456') {
            return rowRecord;
          }
          const seriesMetadata = asJsonRecord(rowRecord.series_metadata);
          return {
            ...rowRecord,
            series_metadata: {
              ...seriesMetadata,
              season_count: 3,
              episode_count: preferredAudioLanguage === 'en-us' ? 54 : 55,
            },
          };
        });

        return {
          ...payloadRecord,
          total: rewrittenRows.length,
          data: rewrittenRows,
        };
      });
    });

    await injectExtension(page, {
      activeTab: 'curated',
      audioLocaleFilter: 'any',
    });
    const highRatedScope = page.locator(
      '.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope',
    );

    await expect(highRatedScope).toContainText('Episodes: 55');
    await expect(highRatedScope).toContainText('Unwatched left: 6');

    await page.selectOption('#cw-audio-filter', 'en-US');
    await expect(highRatedScope).toContainText('Episodes: 54');
    await expect(highRatedScope).toContainText('Unwatched left: 5');

    await page.selectOption('#cw-audio-filter', 'any');
    await expect(highRatedScope).toContainText('Episodes: 55');
    await expect(highRatedScope).toContainText('Unwatched left: 6');

    await page.selectOption('#cw-audio-filter', 'en-US');
    await expect(highRatedScope).toContainText('Episodes: 54');
    await expect(highRatedScope).toContainText('Unwatched left: 5');
  });

  test('keeps default-audio unwatched count correct when watch-history rows omit audio locale', async ({ page }) => {
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      await fulfillJsonWithTransform(route, (payload) => {
        const payloadRecord = asJsonRecord(payload);
        const rows = Array.isArray(payloadRecord.data) ? payloadRecord.data : [];
        const rewrittenRows = rows.map((row) => {
          const rowRecord = asJsonRecord(row);
          const panel = asJsonRecord(rowRecord.panel);
          const episodeMetadata = asJsonRecord(panel.episode_metadata);
          if (!Object.keys(episodeMetadata).length) {
            return rowRecord;
          }

          const nextEpisodeMetadata = { ...episodeMetadata };
          delete nextEpisodeMetadata.audio_locale;

          return {
            ...rowRecord,
            panel: {
              ...panel,
              episode_metadata: nextEpisodeMetadata,
            },
          };
        });

        return {
          ...payloadRecord,
          data: rewrittenRows,
        };
      });
    });

    await injectExtension(page);

    const highRatedScope = page.locator(
      '.cw-curated-card[data-cw-curated-title="High Rated Show"] .cw-curated-card__scope',
    );
    await page.selectOption('#cw-audio-filter', 'en-US');
    await expect(highRatedScope).toContainText('Episodes: 36');
    await expect(highRatedScope).toContainText('Unwatched left: 20');
  });

  test('shows Continue instead of Up Next when playhead progress exists', async ({ page }) => {
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      await fulfillJsonWithTransform(route, (payload) => {
        return rewriteWatchlistRows(payload, (row) => {
          const rowPanel = asJsonRecord(row.panel);
          const rowEpisodeMetadata = asJsonRecord(rowPanel.episode_metadata);
          const seriesId = rowEpisodeMetadata.series_id;
          if (seriesId !== 'GNONE789') {
            return row;
          }

          return {
            ...row,
            new: true,
            never_watched: false,
            playhead: Math.max(1, Number(row.playhead || 0)),
          };
        });
      });
    });

    await injectExtension(page);

    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="No Rating Show"] .cw-curated-card__status'),
    ).toContainText('Continue');
  });

  test('uses watch-history progress to show Continue when watchlist playhead is zero', async ({ page }) => {
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      await fulfillJsonWithTransform(route, (payload) => {
        return rewriteWatchlistRows(payload, (row) => {
          const rowPanel = asJsonRecord(row.panel);
          const rowEpisodeMetadata = asJsonRecord(rowPanel.episode_metadata);
          const seriesId = rowEpisodeMetadata.series_id;
          if (seriesId !== 'GNONE789') {
            return row;
          }

          return {
            ...row,
            new: true,
            never_watched: false,
            playhead: 0,
          };
        });
      });
    });

    await injectExtension(page);

    await expect(
      page.locator('.cw-curated-card[data-cw-curated-title="No Rating Show"] .cw-curated-card__status'),
    ).toContainText('Continue');
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
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await injectExtension(page, { activeTab: 'curated' }, { waitForLoaded: false, preserveCaches: true });

    await expect(page.locator('.cw-curated-card[data-cw-curated-title="High Rated Show"]')).toBeVisible();
    await expect(page.locator('.cw-controls__stats')).toContainText('Showing 3 of 4');
    await expect.poll(() => watchlistCalls, { timeout: 5000 }).toBeGreaterThan(0);
    expect(watchlistCalls).toBeGreaterThan(0);
  });
});
