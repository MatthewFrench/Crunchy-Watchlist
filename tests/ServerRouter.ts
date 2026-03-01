import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  buildAuthTokenPayload,
  buildCmsObjectsPayload,
  buildLegacySeriesRatingPayload,
  buildSeriesPageHtml,
  buildStreamsPayload,
  buildWatchHistoryPagePayload,
  buildWatchlistPagePayload,
} from './Helpers/FixturePayloadBuilders';
import { ACCOUNT_ID, ratingMap, watchHistoryRows, watchlistRows } from './ServerFixtures';
import { extToContentType, json, readExtensionAsset, readFixture, text } from './ServerResponse';

type FixtureServerRouterOptions = {
  host: string;
  port: number;
};

const fixtureModeCookieName = 'cw_fixture_mode';
const multipageUnmatchedWatchHistoryFixtureMode = 'watch-history-multipage-unmatched';

function parsePositiveInt(value: string | null, fallback: number): number {
  return Math.max(1, Number.parseInt(String(value || `${fallback}`), 10) || fallback);
}

function parseCookies(headerValue: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!headerValue) {
    return cookies;
  }

  headerValue.split(';').forEach((part) => {
    const [rawKey, ...rest] = part.split('=');
    const key = String(rawKey || '').trim();
    if (!key) {
      return;
    }
    const value = rest.join('=').trim();
    cookies[key] = decodeURIComponent(value);
  });

  return cookies;
}

function createFixtureModeCookieHeader(fixtureMode: string | null): string {
  if (!fixtureMode) {
    return `${fixtureModeCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
  }

  return `${fixtureModeCookieName}=${encodeURIComponent(fixtureMode)}; Path=/; SameSite=Lax`;
}

function getFixtureModeFromRequest(req: IncomingMessage): string {
  const cookieHeader = req.headers.cookie;
  const cookies = parseCookies(typeof cookieHeader === 'string' ? cookieHeader : undefined);
  return String(cookies[fixtureModeCookieName] || '').trim();
}

function createSyntheticUnmatchedWatchHistoryRow(index: number): Record<string, unknown> {
  const sequenceNumber = index + 1;
  const seriesId = `UNRELATED-SERIES-${sequenceNumber}`;
  return {
    id: `unrelated-history-${sequenceNumber}`,
    date_played: '2025-03-14T11:30:00Z',
    parent_id: seriesId,
    parent_type: 'series',
    playhead: 300,
    fully_watched: false,
    panel: {
      id: `unrelated-episode-${sequenceNumber}`,
      type: 'episode',
      title: `Unrelated episode ${sequenceNumber}`,
      description: 'Synthetic unmatched watch-history row',
      slug_title: `unrelated-episode-${sequenceNumber}`,
      episode_metadata: {
        series_id: seriesId,
        series_title: `Unrelated Series ${sequenceNumber}`,
        series_slug_title: `unrelated-series-${sequenceNumber}`,
        identifier: `unrelated-id-${sequenceNumber}`,
        sequence_number: sequenceNumber,
        season_number: 1,
        episode_number: sequenceNumber,
        audio_locale: 'en-US',
      },
    },
  };
}

const syntheticUnmatchedWatchHistoryRows = Array.from({ length: 1_500 }, (_value, index) =>
  createSyntheticUnmatchedWatchHistoryRow(index),
);

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
      continue;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  return parsed as Record<string, unknown>;
}

export async function handleFixtureRequest(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  { host, port }: FixtureServerRouterOptions,
): Promise<void> {
  try {
    const url = new URL(req.url || '/', `http://${host}:${port}`);

    if (url.pathname === '/' || url.pathname === '/watchlist') {
      const html = await readFixture('WatchlistFixture.html');
      const requestedFixtureMode = String(url.searchParams.get('fixture_mode') || '').trim();
      const nextFixtureMode =
        requestedFixtureMode === multipageUnmatchedWatchHistoryFixtureMode ? requestedFixtureMode : null;
      text(res, 200, html, 'text/html; charset=utf-8', {
        'Set-Cookie': createFixtureModeCookieHeader(nextFixtureMode),
      });
      return;
    }

    if (url.pathname === '/browse') {
      const html = await readFixture('NonWatchlistFixture.html');
      text(res, 200, html, 'text/html; charset=utf-8');
      return;
    }

    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      json(res, 200, buildAuthTokenPayload());
      return;
    }

    if (url.pathname.match(/^\/content\/v2\/discover\/[^/]+\/watchlist$/)) {
      const requestedAccount = decodeURIComponent(url.pathname.split('/')[4] || '');
      if (requestedAccount !== ACCOUNT_ID) {
        json(res, 403, { error: 'invalid_account' });
        return;
      }

      const n = parsePositiveInt(url.searchParams.get('n'), 100);
      const start = Math.max(0, Number.parseInt(url.searchParams.get('start') || '0', 10) || 0);
      const pageRows = watchlistRows.slice(start, start + n);

      json(res, 200, buildWatchlistPagePayload(pageRows, watchlistRows.length));
      return;
    }

    if (url.pathname.match(/^\/content\/v2\/[^/]+\/watch-history$/)) {
      const requestedAccount = decodeURIComponent(url.pathname.split('/')[3] || '');
      if (requestedAccount !== ACCOUNT_ID) {
        json(res, 403, { error: 'invalid_account' });
        return;
      }

      const fixtureMode = getFixtureModeFromRequest(req);
      const sourceRows =
        fixtureMode === multipageUnmatchedWatchHistoryFixtureMode
          ? syntheticUnmatchedWatchHistoryRows
          : watchHistoryRows;
      const pageSize = parsePositiveInt(url.searchParams.get('page_size'), 100);
      const pageNumber = parsePositiveInt(url.searchParams.get('page'), 1);
      const start = (pageNumber - 1) * pageSize;
      const pageRows = sourceRows.slice(start, start + pageSize);

      json(res, 200, buildWatchHistoryPagePayload(pageRows, sourceRows.length, pageNumber, pageSize));
      return;
    }

    if (url.pathname.match(/^\/content\/v2\/cms\/episodes\/[^/]+\/streams$/)) {
      json(res, 200, buildStreamsPayload());
      return;
    }

    if (url.pathname.startsWith('/content/v2/cms/objects/')) {
      const encodedIds = url.pathname.replace('/content/v2/cms/objects/', '');
      const preferredAudioLanguage = String(url.searchParams.get('preferred_audio_language') || '').trim();
      const seriesIds = decodeURIComponent(encodedIds)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      json(res, 200, buildCmsObjectsPayload(seriesIds, preferredAudioLanguage));
      return;
    }

    if (url.pathname.startsWith('/content-reviews/v3/rating/series/')) {
      const seriesId = decodeURIComponent(url.pathname.split('/').pop() || '');
      const rating = ratingMap[seriesId];
      if (!rating || rating.average == null) {
        json(res, 404, { error: 'not_found' });
        return;
      }

      json(res, 200, buildLegacySeriesRatingPayload(seriesId));
      return;
    }

    if (url.pathname.startsWith('/series/')) {
      const seriesId = decodeURIComponent(url.pathname.split('/')[2] || '');
      const rating = ratingMap[seriesId];
      if (!rating || rating.average == null || rating.count == null) {
        text(res, 200, '<!doctype html><html><body>No rating data</body></html>', 'text/html; charset=utf-8');
        return;
      }

      text(res, 200, buildSeriesPageHtml(seriesId, rating.average, rating.count), 'text/html; charset=utf-8');
      return;
    }

    if (url.pathname.match(/^\/content\/v2\/[^/]+\/watchlist\/[^/]+$/)) {
      const requestedAccount = decodeURIComponent(url.pathname.split('/')[3] || '');
      const requestedSeriesId = decodeURIComponent(url.pathname.split('/')[5] || '');
      if (requestedAccount !== ACCOUNT_ID) {
        json(res, 403, { error: 'invalid_account' });
        return;
      }
      if (!requestedSeriesId) {
        json(res, 400, { error: 'invalid_series' });
        return;
      }

      if (req.method === 'DELETE') {
        json(res, 200, {
          status: 'ok',
          action: 'remove',
          seriesId: requestedSeriesId,
        });
        return;
      }

      if (req.method === 'PATCH') {
        const body = await readJsonBody(req);
        if (typeof body.is_favorite !== 'boolean') {
          json(res, 400, { error: 'invalid_is_favorite' });
          return;
        }

        json(res, 200, {
          status: 'ok',
          action: 'favorite',
          seriesId: requestedSeriesId,
          is_favorite: body.is_favorite,
        });
        return;
      }

      json(res, 405, { error: 'method_not_allowed' });
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
        'Cache-Control': 'no-store',
      });
      res.end(data);
      return;
    }

    text(res, 404, 'Not found');
  } catch (error) {
    text(res, 500, `Server error: ${error instanceof Error ? error.message : 'unknown'}`);
  }
}
