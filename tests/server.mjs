import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const HOST = '127.0.0.1';
const PORT = 4173;
const ACCOUNT_ID = 'fixture-account';
const ACCESS_TOKEN = 'fixture-access-token';

const ratingMap = {
  GHIGH456: {
    average: 4.9,
    count: 1284,
    distribution: { 5: 82, 4: 11, 3: 4, 2: 2, 1: 1 },
    audioLocales: ['en-US', 'ja-JP'],
    description: 'A high-rated fixture series with English audio.',
    seasonCount: 3,
    episodeCount: 36,
    tenantCategories: ['action', 'fantasy']
  },
  GLOW123: {
    average: 3.2,
    count: 189,
    distribution: { 5: 18, 4: 21, 3: 29, 2: 19, 1: 13 },
    audioLocales: ['ja-JP'],
    description: 'A lower-rated fixture series without EN-US audio.',
    seasonCount: 2,
    episodeCount: 24,
    tenantCategories: ['drama']
  },
  GWATCH999: {
    average: 4.4,
    count: 443,
    distribution: { 5: 62, 4: 22, 3: 10, 2: 4, 1: 2 },
    audioLocales: ['en-US'],
    description: 'A completed fixture series.',
    seasonCount: 1,
    episodeCount: 12,
    tenantCategories: ['comedy']
  },
  GNONE789: {
    average: null,
    count: null,
    distribution: null,
    audioLocales: ['en-US'],
    description: 'Fixture series intentionally missing rating data.',
    seasonCount: 2,
    episodeCount: 20,
    tenantCategories: ['romance']
  }
};

function makeWatchlistRow({
  seriesId,
  title,
  slug,
  seasonNumber = 1,
  episodeNumber,
  sequenceNumber,
  playhead,
  dateAdded,
  dateUpdated,
  fullyWatched = false,
  neverWatched = false,
  isFavorite = false,
  isNew = false,
  isDubbed = false,
  isSubbed = true,
  audioLocale = 'ja-JP',
  availabilityStatus = 'available'
}) {
  return {
    new: isNew,
    is_favorite: isFavorite,
    date_added: dateAdded,
    updated_at: dateUpdated,
    fully_watched: fullyWatched,
    never_watched: neverWatched,
    playhead,
    panel: {
      id: `${seriesId}-episode-${episodeNumber}`,
      type: 'episode',
      title: `${title} E${episodeNumber}`,
      description: `${title} fixture episode`,
      slug_title: `${slug}-e${episodeNumber}`,
      streams_link: `/content/v2/cms/episodes/${seriesId}-episode-${episodeNumber}/streams`,
      images: {
        poster_tall: [
          [
            {
              source: `https://example.invalid/${seriesId}-portrait.jpg`,
              width: 600,
              height: 900
            }
          ]
        ],
        poster_wide: [
          [
            {
              source: `https://example.invalid/${seriesId}-landscape.jpg`,
              width: 960,
              height: 540
            }
          ]
        ],
        thumbnail: [
          [
            {
              source: `https://example.invalid/${seriesId}-thumb.jpg`,
              width: 640,
              height: 360
            }
          ]
        ]
      },
      episode_metadata: {
        series_id: seriesId,
        series_title: title,
        series_slug_title: slug,
        episode_number: episodeNumber,
        season_number: seasonNumber,
        sequence_number: sequenceNumber,
        audio_locale: audioLocale,
        is_dubbed: isDubbed,
        is_subbed: isSubbed,
        availability_status: availabilityStatus,
        subtitle_locales: ['en-US'],
        roles: isDubbed ? ['dub'] : ['sub']
      }
    }
  };
}

const watchlistRows = [
  makeWatchlistRow({
    seriesId: 'GLOW123',
    title: 'Low Rated Show',
    slug: 'low-rated-show',
    seasonNumber: 1,
    episodeNumber: 3,
    sequenceNumber: 3,
    playhead: 180000,
    dateAdded: '2025-01-10T12:00:00Z',
    dateUpdated: '2025-02-10T12:00:00Z',
    isDubbed: false,
    isSubbed: true,
    audioLocale: 'ja-JP'
  }),
  makeWatchlistRow({
    seriesId: 'GHIGH456',
    title: 'High Rated Show',
    slug: 'high-rated-show',
    seasonNumber: 2,
    episodeNumber: 5,
    sequenceNumber: 17,
    playhead: 0,
    dateAdded: '2025-03-08T12:00:00Z',
    dateUpdated: '2025-03-15T12:00:00Z',
    isFavorite: true,
    isNew: true,
    isDubbed: true,
    isSubbed: true,
    audioLocale: 'en-US'
  }),
  makeWatchlistRow({
    seriesId: 'GWATCH999',
    title: 'Watch Again Show',
    slug: 'watch-again-show',
    seasonNumber: 1,
    episodeNumber: 12,
    sequenceNumber: 12,
    playhead: 0,
    dateAdded: '2024-12-20T12:00:00Z',
    dateUpdated: '2025-01-01T12:00:00Z',
    fullyWatched: true,
    isDubbed: true,
    isSubbed: true,
    audioLocale: 'en-US'
  }),
  makeWatchlistRow({
    seriesId: 'GNONE789',
    title: 'No Rating Show',
    slug: 'no-rating-show',
    seasonNumber: 1,
    episodeNumber: 2,
    sequenceNumber: 2,
    playhead: 60000,
    dateAdded: '2025-02-18T12:00:00Z',
    dateUpdated: '2025-03-20T12:00:00Z',
    isDubbed: true,
    isSubbed: true,
    audioLocale: 'en-US'
  })
];

function json(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

function text(res, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function readFixture(fileName) {
  return readFile(join(process.cwd(), 'tests', 'fixtures', fileName), 'utf8');
}

async function readExtensionAsset(fileName) {
  return readFile(join(process.cwd(), 'extension', fileName));
}

function extToContentType(fileName) {
  const ext = extname(fileName).toLowerCase();
  if (ext === '.js') {
    return 'application/javascript; charset=utf-8';
  }
  if (ext === '.css') {
    return 'text/css; charset=utf-8';
  }
  if (ext === '.json') {
    return 'application/json; charset=utf-8';
  }
  return 'application/octet-stream';
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

    if (url.pathname === '/' || url.pathname === '/watchlist') {
      const html = await readFixture('watchlist-fixture.html');
      text(res, 200, html, 'text/html; charset=utf-8');
      return;
    }

    if (url.pathname === '/browse') {
      const html = await readFixture('non-watchlist-fixture.html');
      text(res, 200, html, 'text/html; charset=utf-8');
      return;
    }

    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      json(res, 200, {
        access_token: ACCESS_TOKEN,
        refresh_token: 'fixture-refresh-token',
        expires_in: 3600,
        token_type: 'bearer',
        scope: 'offline_access',
        country: 'US',
        account_id: ACCOUNT_ID,
        profile_id: 'fixture-profile-id',
        fun_user: {
          is_fun_login: true,
          migration_status: 'migrated',
          watch_data_status: 'ready'
        }
      });
      return;
    }

    if (url.pathname.match(/^\/content\/v2\/discover\/[^/]+\/watchlist$/)) {
      const requestedAccount = decodeURIComponent(url.pathname.split('/')[4] || '');
      if (requestedAccount !== ACCOUNT_ID) {
        json(res, 403, { error: 'invalid_account' });
        return;
      }

      const n = Math.max(1, Number.parseInt(url.searchParams.get('n') || '100', 10) || 100);
      const start = Math.max(0, Number.parseInt(url.searchParams.get('start') || '0', 10) || 0);
      const pageRows = watchlistRows.slice(start, start + n);

      json(res, 200, {
        total: watchlistRows.length,
        data: pageRows,
        meta: {
          total_before_filter: watchlistRows.length
        }
      });
      return;
    }

    if (url.pathname.match(/^\/content\/v2\/cms\/episodes\/[^/]+\/streams$/)) {
      json(res, 200, {
        preview_url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        streams: {
          adaptive_hls: {
            '': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
          }
        }
      });
      return;
    }

    if (url.pathname.startsWith('/content/v2/cms/objects/')) {
      const encodedIds = url.pathname.replace('/content/v2/cms/objects/', '');
      const seriesIds = decodeURIComponent(encodedIds)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      const data = seriesIds.map((seriesId) => {
        const details = ratingMap[seriesId];
        return {
          id: seriesId,
          type: 'series',
          title: seriesId,
          description: details?.description || '',
          series_metadata: {
            audio_locales: details?.audioLocales || [],
            subtitle_locales: ['en-US'],
            is_dubbed: (details?.audioLocales || []).includes('en-US'),
            is_subbed: true,
            season_count: details?.seasonCount ?? null,
            episode_count: details?.episodeCount ?? null,
            tenant_categories: details?.tenantCategories || []
          },
          rating: details?.average != null
            ? {
                average: details.average,
                total: details.count,
                '5s': { displayed: `${details.distribution?.[5] ?? 0}%`, percentage: details.distribution?.[5] ?? 0, unit: '%' },
                '4s': { displayed: `${details.distribution?.[4] ?? 0}%`, percentage: details.distribution?.[4] ?? 0, unit: '%' },
                '3s': { displayed: `${details.distribution?.[3] ?? 0}%`, percentage: details.distribution?.[3] ?? 0, unit: '%' },
                '2s': { displayed: `${details.distribution?.[2] ?? 0}%`, percentage: details.distribution?.[2] ?? 0, unit: '%' },
                '1s': { displayed: `${details.distribution?.[1] ?? 0}%`, percentage: details.distribution?.[1] ?? 0, unit: '%' }
              }
            : undefined
        };
      });

      json(res, 200, {
        total: data.length,
        data,
        meta: {}
      });
      return;
    }

    if (url.pathname.startsWith('/content-reviews/v3/rating/series/')) {
      const seriesId = decodeURIComponent(url.pathname.split('/').pop() || '');
      const rating = ratingMap[seriesId];
      if (!rating || rating.average == null) {
        json(res, 404, { error: 'not_found' });
        return;
      }

      json(res, 200, {
        rating: {
          average: rating.average,
          count: rating.count
        }
      });
      return;
    }

    if (url.pathname.startsWith('/series/')) {
      const seriesId = decodeURIComponent(url.pathname.split('/')[2] || '');
      const rating = ratingMap[seriesId];
      if (!rating || rating.average == null) {
        text(res, 200, '<!doctype html><html><body>No rating data</body></html>', 'text/html; charset=utf-8');
        return;
      }

      const html = `<!doctype html>
<html>
  <head>
    <title>${seriesId}</title>
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'TVSeries',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: rating.average,
        ratingCount: rating.count
      }
    })}</script>
  </head>
  <body>Series ${seriesId}</body>
</html>`;
      text(res, 200, html, 'text/html; charset=utf-8');
      return;
    }

    if (url.pathname.startsWith('/extension/')) {
      const fileName = url.pathname.replace('/extension/', '');
      if (!fileName || fileName.includes('..') || fileName.includes('/')) {
        text(res, 400, 'Bad request');
        return;
      }

      const data = await readExtensionAsset(fileName);
      res.writeHead(200, {
        'Content-Type': extToContentType(fileName),
        'Content-Length': data.byteLength,
        'Cache-Control': 'no-store'
      });
      res.end(data);
      return;
    }

    text(res, 404, 'Not found');
  } catch (error) {
    text(res, 500, `Server error: ${error instanceof Error ? error.message : 'unknown'}`);
  }
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`Fixture server running on http://${HOST}:${PORT}`);
});
