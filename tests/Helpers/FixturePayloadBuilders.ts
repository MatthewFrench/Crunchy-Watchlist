import { ACCESS_TOKEN, ACCOUNT_ID, pickLocalizedValue, ratingMap } from '../ServerFixtures';

type CmsDistributionBreakdown = {
  displayed: string;
  percentage: number;
  unit: '%';
};

type CmsRatingPayload = {
  average: number | null;
  total: number | null;
  '5s': CmsDistributionBreakdown;
  '4s': CmsDistributionBreakdown;
  '3s': CmsDistributionBreakdown;
  '2s': CmsDistributionBreakdown;
  '1s': CmsDistributionBreakdown;
};

type CmsSeriesMetadataPayload = {
  audio_locales: string[];
  subtitle_locales: string[];
  is_dubbed: boolean;
  is_subbed: true;
  season_count: number | null;
  episode_count: number | null;
  tenant_categories: string[];
};

type CmsObjectPayload = {
  id: string;
  type: 'series';
  title: string;
  description: string;
  series_metadata: CmsSeriesMetadataPayload;
  rating?: CmsRatingPayload;
};

type AuthTokenPayload = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'bearer';
  scope: string;
  country: string;
  account_id: string;
  profile_id: string;
  fun_user: {
    is_fun_login: boolean;
    migration_status: string;
    watch_data_status: string;
  };
};

type WatchlistPagePayload = {
  total: number;
  data: unknown[];
  meta: {
    total_before_filter: number;
  };
};

type WatchHistoryPagePayload = {
  total: number;
  data: unknown[];
  meta: {
    page: number;
    page_size: number;
  };
};

type CmsObjectsPayload = {
  total: number;
  data: CmsObjectPayload[];
  meta: Record<string, never>;
};

type LegacyRatingPayload = {
  rating: {
    average: number;
    count: number | null;
  };
};

type StreamsPayload = {
  preview_url: string;
  streams: {
    adaptive_hls: {
      '': string;
    };
  };
};

function buildDistributionBreakdown(value: number): CmsDistributionBreakdown {
  return {
    displayed: `${value}%`,
    percentage: value,
    unit: '%',
  };
}

function buildCmsRatingPayload(seriesId: string): CmsRatingPayload | undefined {
  const details = ratingMap[seriesId];
  if (!details || details.average == null) {
    return undefined;
  }

  return {
    average: details.average,
    total: details.count,
    '5s': buildDistributionBreakdown(details.distribution?.[5] ?? 0),
    '4s': buildDistributionBreakdown(details.distribution?.[4] ?? 0),
    '3s': buildDistributionBreakdown(details.distribution?.[3] ?? 0),
    '2s': buildDistributionBreakdown(details.distribution?.[2] ?? 0),
    '1s': buildDistributionBreakdown(details.distribution?.[1] ?? 0),
  };
}

function buildCmsSeriesMetadataPayload(seriesId: string, preferredAudioLanguage: string): CmsSeriesMetadataPayload {
  const details = ratingMap[seriesId];
  const localizedEpisodeCount = pickLocalizedValue(
    details?.episodeCountByAudioLocale,
    preferredAudioLanguage,
    details?.episodeCount ?? null,
  );
  const localizedSeasonCount = pickLocalizedValue(
    details?.seasonCountByAudioLocale,
    preferredAudioLanguage,
    details?.seasonCount ?? null,
  );

  return {
    audio_locales: details?.audioLocales || [],
    subtitle_locales: ['en-US'],
    is_dubbed: (details?.audioLocales || []).includes('en-US'),
    is_subbed: true,
    season_count: localizedSeasonCount,
    episode_count: localizedEpisodeCount,
    tenant_categories: details?.tenantCategories || [],
  };
}

function buildCmsObjectPayload(seriesId: string, preferredAudioLanguage: string): CmsObjectPayload {
  const details = ratingMap[seriesId];
  const payload: CmsObjectPayload = {
    id: seriesId,
    type: 'series',
    title: seriesId,
    description: details?.description || '',
    series_metadata: buildCmsSeriesMetadataPayload(seriesId, preferredAudioLanguage),
  };

  const rating = buildCmsRatingPayload(seriesId);
  if (rating) {
    payload.rating = rating;
  }

  return payload;
}

export function buildAuthTokenPayload(): AuthTokenPayload {
  return {
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
  };
}

export function buildWatchlistPagePayload(pageRows: unknown[], totalRows: number): WatchlistPagePayload {
  return {
    total: totalRows,
    data: pageRows,
    meta: {
      total_before_filter: totalRows,
    },
  };
}

export function buildWatchHistoryPagePayload(
  pageRows: unknown[],
  totalRows: number,
  pageNumber: number,
  pageSize: number,
): WatchHistoryPagePayload {
  return {
    total: totalRows,
    data: pageRows,
    meta: {
      page: pageNumber,
      page_size: pageSize,
    },
  };
}

export function buildStreamsPayload(): StreamsPayload {
  return {
    preview_url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    streams: {
      adaptive_hls: {
        '': 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      },
    },
  };
}

export function buildCmsObjectsPayload(seriesIds: string[], preferredAudioLanguage: string): CmsObjectsPayload {
  const data = seriesIds.map((seriesId) => buildCmsObjectPayload(seriesId, preferredAudioLanguage));
  return {
    total: data.length,
    data,
    meta: {},
  };
}

export function buildLegacySeriesRatingPayload(seriesId: string): LegacyRatingPayload | null {
  const rating = ratingMap[seriesId];
  if (!rating || rating.average == null) {
    return null;
  }

  return {
    rating: {
      average: rating.average,
      count: rating.count,
    },
  };
}

export function buildSeriesPageHtml(seriesId: string, average: number, count: number): string {
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
</html>`;
}
