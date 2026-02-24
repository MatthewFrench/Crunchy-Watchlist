import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  ACCOUNT_ID,
  ACCESS_TOKEN,
  pickLocalizedValue,
  ratingMap,
  watchHistoryRows,
  watchlistRows,
} from './ServerFixtures'
import { extToContentType, json, readExtensionAsset, readFixture, text } from './ServerResponse'

type FixtureServerRouterOptions = {
  host: string
  port: number
}

function parsePositiveInt(value: string | null, fallback: number): number {
  return Math.max(1, Number.parseInt(String(value || `${fallback}`), 10) || fallback)
}

function buildSeriesPageHtml(seriesId: string, average: number, count: number): string {
  return `<!doctype html>
<html>
  <head>
    <title>${seriesId}</title>
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'TVSeries',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: average,
        ratingCount: count,
      },
    })}</script>
  </head>
  <body>Series ${seriesId}</body>
</html>`
}

export async function handleFixtureRequest(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  { host, port }: FixtureServerRouterOptions,
): Promise<void> {
  try {
    const url = new URL(req.url || '/', `http://${host}:${port}`)

    if (url.pathname === '/' || url.pathname === '/watchlist') {
      const html = await readFixture('WatchlistFixture.html')
      text(res, 200, html, 'text/html; charset=utf-8')
      return
    }

    if (url.pathname === '/browse') {
      const html = await readFixture('NonWatchlistFixture.html')
      text(res, 200, html, 'text/html; charset=utf-8')
      return
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
          watch_data_status: 'ready',
        },
      })
      return
    }

    if (url.pathname.match(/^\/content\/v2\/discover\/[^/]+\/watchlist$/)) {
      const requestedAccount = decodeURIComponent(url.pathname.split('/')[4] || '')
      if (requestedAccount !== ACCOUNT_ID) {
        json(res, 403, { error: 'invalid_account' })
        return
      }

      const n = parsePositiveInt(url.searchParams.get('n'), 100)
      const start = Math.max(0, Number.parseInt(url.searchParams.get('start') || '0', 10) || 0)
      const pageRows = watchlistRows.slice(start, start + n)

      json(res, 200, {
        total: watchlistRows.length,
        data: pageRows,
        meta: {
          total_before_filter: watchlistRows.length,
        },
      })
      return
    }

    if (url.pathname.match(/^\/content\/v2\/[^/]+\/watch-history$/)) {
      const requestedAccount = decodeURIComponent(url.pathname.split('/')[3] || '')
      if (requestedAccount !== ACCOUNT_ID) {
        json(res, 403, { error: 'invalid_account' })
        return
      }

      const pageSize = parsePositiveInt(url.searchParams.get('page_size'), 100)
      const pageNumber = parsePositiveInt(url.searchParams.get('page'), 1)
      const start = (pageNumber - 1) * pageSize
      const pageRows = watchHistoryRows.slice(start, start + pageSize)

      json(res, 200, {
        total: watchHistoryRows.length,
        data: pageRows,
        meta: {
          page: pageNumber,
          page_size: pageSize,
        },
      })
      return
    }

    if (url.pathname.match(/^\/content\/v2\/cms\/episodes\/[^/]+\/streams$/)) {
      json(res, 200, {
        preview_url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        streams: {
          adaptive_hls: {
            '': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
          },
        },
      })
      return
    }

    if (url.pathname.startsWith('/content/v2/cms/objects/')) {
      const encodedIds = url.pathname.replace('/content/v2/cms/objects/', '')
      const preferredAudioLanguage = String(url.searchParams.get('preferred_audio_language') || '').trim()
      const seriesIds = decodeURIComponent(encodedIds)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      const data = seriesIds.map((seriesId) => {
        const details = ratingMap[seriesId]
        const localizedEpisodeCount = pickLocalizedValue(
          details?.episodeCountByAudioLocale,
          preferredAudioLanguage,
          details?.episodeCount ?? null,
        )
        const localizedSeasonCount = pickLocalizedValue(
          details?.seasonCountByAudioLocale,
          preferredAudioLanguage,
          details?.seasonCount ?? null,
        )
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
            season_count: localizedSeasonCount,
            episode_count: localizedEpisodeCount,
            tenant_categories: details?.tenantCategories || [],
          },
          rating:
            details?.average != null
              ? {
                  average: details.average,
                  total: details.count,
                  '5s': {
                    displayed: `${details.distribution?.[5] ?? 0}%`,
                    percentage: details.distribution?.[5] ?? 0,
                    unit: '%',
                  },
                  '4s': {
                    displayed: `${details.distribution?.[4] ?? 0}%`,
                    percentage: details.distribution?.[4] ?? 0,
                    unit: '%',
                  },
                  '3s': {
                    displayed: `${details.distribution?.[3] ?? 0}%`,
                    percentage: details.distribution?.[3] ?? 0,
                    unit: '%',
                  },
                  '2s': {
                    displayed: `${details.distribution?.[2] ?? 0}%`,
                    percentage: details.distribution?.[2] ?? 0,
                    unit: '%',
                  },
                  '1s': {
                    displayed: `${details.distribution?.[1] ?? 0}%`,
                    percentage: details.distribution?.[1] ?? 0,
                    unit: '%',
                  },
                }
              : undefined,
        }
      })

      json(res, 200, {
        total: data.length,
        data,
        meta: {},
      })
      return
    }

    if (url.pathname.startsWith('/content-reviews/v3/rating/series/')) {
      const seriesId = decodeURIComponent(url.pathname.split('/').pop() || '')
      const rating = ratingMap[seriesId]
      if (!rating || rating.average == null) {
        json(res, 404, { error: 'not_found' })
        return
      }

      json(res, 200, {
        rating: {
          average: rating.average,
          count: rating.count,
        },
      })
      return
    }

    if (url.pathname.startsWith('/series/')) {
      const seriesId = decodeURIComponent(url.pathname.split('/')[2] || '')
      const rating = ratingMap[seriesId]
      if (!rating || rating.average == null || rating.count == null) {
        text(res, 200, '<!doctype html><html><body>No rating data</body></html>', 'text/html; charset=utf-8')
        return
      }

      text(res, 200, buildSeriesPageHtml(seriesId, rating.average, rating.count), 'text/html; charset=utf-8')
      return
    }

    if (url.pathname.startsWith('/extension/')) {
      const fileName = url.pathname.replace('/extension/', '')
      if (!fileName || fileName.includes('..') || fileName.includes('/')) {
        text(res, 400, 'Bad request')
        return
      }

      const data = await readExtensionAsset(fileName)
      res.writeHead(200, {
        'Content-Type': extToContentType(fileName),
        'Content-Length': data.byteLength,
        'Cache-Control': 'no-store',
      })
      res.end(data)
      return
    }

    text(res, 404, 'Not found')
  } catch (error) {
    text(res, 500, `Server error: ${error instanceof Error ? error.message : 'unknown'}`)
  }
}
