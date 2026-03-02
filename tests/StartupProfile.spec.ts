import { expect, type Page, test } from '@playwright/test';
import { gotoFixture, injectExtension } from './Helpers/ExtensionFixture';

type RequestCounters = {
  total: number;
  authToken: number;
  watchlist: number;
  ratings: number;
  watchHistory: number;
  other: number;
};

type RuntimeProfile = {
  eventCount: number;
  phase: string;
  loadStartAt: number | null;
  loadPartialAt: number | null;
  loadDoneAt: number | null;
  totalDurationMs: number | null;
  partialDurationMs: number | null;
  postPartialDurationMs: number | null;
  loadTimingData: Record<string, unknown>;
};

type StartupProfileSummary = {
  fromInjectToDoneMs: number;
  requestCounters: RequestCounters;
  runtimeProfile: RuntimeProfile;
};

function createRequestCounters(): RequestCounters {
  return {
    total: 0,
    authToken: 0,
    watchlist: 0,
    ratings: 0,
    watchHistory: 0,
    other: 0,
  };
}

function trackApiRequest(counters: RequestCounters, requestUrl: string): void {
  if (
    !requestUrl.includes('/auth/v1/token') &&
    !requestUrl.includes('/content/v2/') &&
    !requestUrl.includes('/content-reviews/')
  ) {
    return;
  }

  counters.total += 1;
  if (requestUrl.includes('/auth/v1/token')) {
    counters.authToken += 1;
    return;
  }
  if (requestUrl.includes('/content/v2/discover/') && requestUrl.includes('/watchlist')) {
    counters.watchlist += 1;
    return;
  }
  if (requestUrl.includes('/content-reviews/v3/rating/series/')) {
    counters.ratings += 1;
    return;
  }
  if (requestUrl.includes('/watch-history')) {
    counters.watchHistory += 1;
    return;
  }
  counters.other += 1;
}

function createSyntheticWatchlistRows(rowCount: number): unknown[] {
  return Array.from({ length: rowCount }, (_value, index) => {
    const rowNumber = index + 1;
    const seriesId = `GSYN${String(rowNumber).padStart(4, '0')}`;
    const episodeNumber = ((index % 24) + 1).toString();
    const dayOfMonth = ((index % 28) + 1).toString().padStart(2, '0');
    return {
      new: index % 7 === 0,
      is_favorite: index % 11 === 0,
      date_added: `2025-01-${dayOfMonth}T12:00:00Z`,
      updated_at: `2025-02-${dayOfMonth}T12:00:00Z`,
      fully_watched: false,
      never_watched: false,
      playhead: (index % 5) * 30_000,
      panel: {
        id: `${seriesId}-episode-${episodeNumber}`,
        type: 'episode',
        title: `Synthetic Series ${rowNumber} E${episodeNumber}`,
        description: `Synthetic startup profile row ${rowNumber}`,
        slug_title: `synthetic-series-${rowNumber}-e${episodeNumber}`,
        streams_link: `/content/v2/cms/episodes/${seriesId}-episode-${episodeNumber}/streams`,
        images: {
          poster_tall: [
            [
              {
                source: `https://example.invalid/${seriesId}-portrait.jpg`,
                width: 600,
                height: 900,
              },
            ],
          ],
          poster_wide: [
            [
              {
                source: `https://example.invalid/${seriesId}-landscape.jpg`,
                width: 960,
                height: 540,
              },
            ],
          ],
          thumbnail: [
            [
              {
                source: `https://example.invalid/${seriesId}-thumb.jpg`,
                width: 640,
                height: 360,
              },
            ],
          ],
        },
        episode_metadata: {
          series_id: seriesId,
          series_title: `Synthetic Series ${rowNumber}`,
          series_slug_title: `synthetic-series-${rowNumber}`,
          episode_number: Number(episodeNumber),
          season_number: 1,
          sequence_number: rowNumber,
          audio_locale: index % 3 === 0 ? 'ja-JP' : 'en-US',
          is_dubbed: true,
          is_subbed: true,
          availability_status: 'available',
          subtitle_locales: ['en-US'],
          roles: ['sub'],
        },
      },
    };
  });
}

async function profileStartupLoad(page: Page): Promise<StartupProfileSummary> {
  const requestCounters = createRequestCounters();
  page.on('request', (request) => {
    trackApiRequest(requestCounters, request.url());
  });

  const profileStartedAt = Date.now();
  await injectExtension(page, { activeTab: 'curated' }, { waitForLoaded: false });

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const runtime = window.__CW_WATCHLIST_CURATOR_RUNTIME__;
          if (!runtime || !Array.isArray(runtime.events)) {
            return false;
          }
          return runtime.events.some((entry) => entry.event === 'curated-load-done');
        }),
      { timeout: 25_000 },
    )
    .toBe(true);

  const runtimeProfile = await page.evaluate(() => {
    const runtime = window.__CW_WATCHLIST_CURATOR_RUNTIME__;
    const events = Array.isArray(runtime?.events) ? runtime.events : [];

    const findFirstEvent = (eventName: string) => {
      for (const event of events) {
        if (event.event === eventName) {
          return event;
        }
      }
      return null;
    };

    const loadStart = findFirstEvent('curated-load-start');
    const loadPartial = findFirstEvent('curated-load-partial');
    const loadDone = findFirstEvent('curated-load-done');
    const loadTiming = findFirstEvent('curated-load-timing');
    const loadTimingData =
      loadTiming?.data && typeof loadTiming.data === 'object' ? (loadTiming.data as Record<string, unknown>) : {};

    const totalDurationMs =
      loadStart && loadDone && Number.isFinite(loadDone.at - loadStart.at) ? loadDone.at - loadStart.at : null;
    const partialDurationMs =
      loadStart && loadPartial && Number.isFinite(loadPartial.at - loadStart.at) ? loadPartial.at - loadStart.at : null;
    const postPartialDurationMs =
      loadPartial && loadDone && Number.isFinite(loadDone.at - loadPartial.at) ? loadDone.at - loadPartial.at : null;

    return {
      eventCount: events.length,
      phase: runtime?.phase || '',
      loadStartAt: loadStart?.at ?? null,
      loadPartialAt: loadPartial?.at ?? null,
      loadDoneAt: loadDone?.at ?? null,
      totalDurationMs,
      partialDurationMs,
      postPartialDurationMs,
      loadTimingData,
    };
  });

  expect(runtimeProfile.loadStartAt).not.toBeNull();
  expect(runtimeProfile.loadDoneAt).not.toBeNull();
  expect(runtimeProfile.totalDurationMs).not.toBeNull();

  return {
    fromInjectToDoneMs: Date.now() - profileStartedAt,
    requestCounters,
    runtimeProfile,
  };
}

test.describe('Startup Load Profile', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFixture(page);
  });

  test('profiles startup from bootstrap to curated-load-done', async ({ page }) => {
    const profileSummary = await profileStartupLoad(page);
    // Intentionally logged so profiling runs provide a concrete timing/request breakdown.
    console.log(`[startup-profile] ${JSON.stringify(profileSummary, null, 2)}`);
  });

  test('profiles startup with a synthetic 300-row watchlist', async ({ page }) => {
    const syntheticRows = createSyntheticWatchlistRows(300);
    await page.route('**/content/v2/discover/**/watchlist*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const start = Math.max(0, Number.parseInt(requestUrl.searchParams.get('start') || '0', 10) || 0);
      const pageSize = Math.max(1, Number.parseInt(requestUrl.searchParams.get('n') || '100', 10) || 100);
      const pageRows = syntheticRows.slice(start, start + pageSize);
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          total: syntheticRows.length,
          data: pageRows,
          meta: {
            total_before_filter: syntheticRows.length,
          },
        }),
      });
    });
    await page.route('**/content/v2/**/watch-history*', async (route) => {
      const requestUrl = new URL(route.request().url());
      const pageNumber = Math.max(1, Number.parseInt(requestUrl.searchParams.get('page') || '1', 10) || 1);
      const pageSize = Math.max(1, Number.parseInt(requestUrl.searchParams.get('page_size') || '100', 10) || 100);
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          total: 0,
          data: [],
          meta: {
            page: pageNumber,
            page_size: pageSize,
          },
        }),
      });
    });

    const profileSummary = await profileStartupLoad(page);
    expect(profileSummary.runtimeProfile.loadTimingData.totalEntries).toBe(300);
    // Intentionally logged so profiling runs provide a concrete timing/request breakdown.
    console.log(`[startup-profile-300] ${JSON.stringify(profileSummary, null, 2)}`);
  });
});
