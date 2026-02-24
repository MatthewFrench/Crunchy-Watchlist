type RatingDistribution = Record<number, number>

export type FixtureRating = {
  average: number | null
  count: number | null
  distribution: RatingDistribution | null
  audioLocales: string[]
  description: string
  seasonCount: number | null
  seasonCountByAudioLocale?: Record<string, number>
  episodeCount: number | null
  episodeCountByAudioLocale?: Record<string, number>
  tenantCategories: string[]
}

type WatchlistRowOptions = {
  seriesId: string
  title: string
  slug: string
  seasonNumber?: number
  episodeNumber: number
  sequenceNumber: number
  playhead: number
  dateAdded: string
  dateUpdated: string
  fullyWatched?: boolean
  neverWatched?: boolean
  isFavorite?: boolean
  isNew?: boolean
  isDubbed?: boolean
  isSubbed?: boolean
  audioLocale?: string
  availabilityStatus?: string
}

type WatchHistoryRowOptions = {
  seriesId: string
  title: string
  slug: string
  seasonNumber?: number
  episodeNumber: number
  sequenceNumber: number
  playhead?: number
  datePlayed: string
  fullyWatched?: boolean
  audioLocale?: string
}

export const ACCOUNT_ID = 'fixture-account'
export const ACCESS_TOKEN = 'fixture-access-token'

export const ratingMap: Record<string, FixtureRating> = {
  GHIGH456: {
    average: 4.9,
    count: 1284,
    distribution: { 5: 82, 4: 11, 3: 4, 2: 2, 1: 1 },
    audioLocales: ['en-US', 'ja-JP'],
    description: 'A high-rated fixture series with English audio.',
    seasonCount: 3,
    episodeCount: 36,
    episodeCountByAudioLocale: {
      'en-US': 36,
      'ja-JP': 32,
    },
    tenantCategories: ['action', 'fantasy'],
  },
  GLOW123: {
    average: 3.2,
    count: 189,
    distribution: { 5: 18, 4: 21, 3: 29, 2: 19, 1: 13 },
    audioLocales: ['ja-JP'],
    description: 'A lower-rated fixture series without EN-US audio.',
    seasonCount: 2,
    episodeCount: 24,
    tenantCategories: ['drama'],
  },
  GWATCH999: {
    average: 4.4,
    count: 443,
    distribution: { 5: 62, 4: 22, 3: 10, 2: 4, 1: 2 },
    audioLocales: ['en-US'],
    description: 'A completed fixture series.',
    seasonCount: 1,
    episodeCount: 12,
    tenantCategories: ['comedy'],
  },
  GNONE789: {
    average: null,
    count: null,
    distribution: null,
    audioLocales: ['en-US'],
    description: 'Fixture series intentionally missing rating data.',
    seasonCount: 2,
    episodeCount: 20,
    tenantCategories: ['romance'],
  },
}

export function pickLocalizedValue<T>(valuesByLocale: unknown, preferredAudioLanguage: unknown, fallbackValue: T): T {
  if (!valuesByLocale || typeof valuesByLocale !== 'object' || Array.isArray(valuesByLocale)) {
    return fallbackValue
  }

  const normalizedPreferred = String(preferredAudioLanguage || '')
    .trim()
    .toLowerCase()
  if (!normalizedPreferred) {
    return fallbackValue
  }

  for (const [locale, value] of Object.entries(valuesByLocale as Record<string, T>)) {
    if (
      String(locale || '')
        .trim()
        .toLowerCase() === normalizedPreferred
    ) {
      return value
    }
  }

  return fallbackValue
}

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
  availabilityStatus = 'available',
}: WatchlistRowOptions) {
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
        roles: isDubbed ? ['dub'] : ['sub'],
      },
    },
  }
}

export const watchlistRows = [
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
    audioLocale: 'ja-JP',
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
    audioLocale: 'en-US',
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
    audioLocale: 'en-US',
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
    audioLocale: 'en-US',
  }),
]

function makeWatchHistoryRow({
  seriesId,
  title,
  slug,
  seasonNumber = 1,
  episodeNumber,
  sequenceNumber,
  playhead = 0,
  datePlayed,
  fullyWatched = false,
  audioLocale = 'ja-JP',
}: WatchHistoryRowOptions) {
  return {
    id: `${seriesId}-history-${episodeNumber}`,
    date_played: datePlayed,
    parent_id: seriesId,
    parent_type: 'series',
    playhead,
    fully_watched: fullyWatched,
    panel: {
      id: `${seriesId}-episode-${episodeNumber}`,
      type: 'episode',
      title: `${title} E${episodeNumber}`,
      description: `${title} fixture history episode`,
      slug_title: `${slug}-e${episodeNumber}`,
      episode_metadata: {
        series_id: seriesId,
        series_title: title,
        series_slug_title: slug,
        episode_number: episodeNumber,
        season_number: seasonNumber,
        sequence_number: sequenceNumber,
        audio_locale: audioLocale,
        availability_starts: '2025-01-01T12:00:00Z',
        availability_ends: '9998-12-01T07:59:00Z',
        episode_air_date: '2025-01-01T12:00:00Z',
      },
    },
  }
}

export const watchHistoryRows = [
  makeWatchHistoryRow({
    seriesId: 'GHIGH456',
    title: 'High Rated Show',
    slug: 'high-rated-show',
    seasonNumber: 2,
    episodeNumber: 4,
    sequenceNumber: 16,
    playhead: 0,
    fullyWatched: true,
    datePlayed: '2025-03-14T11:30:00Z',
    audioLocale: 'en-US',
  }),
  makeWatchHistoryRow({
    seriesId: 'GHIGH456',
    title: 'High Rated Show',
    slug: 'high-rated-show',
    seasonNumber: 3,
    episodeNumber: 4,
    sequenceNumber: 28,
    playhead: 0,
    fullyWatched: true,
    datePlayed: '2025-03-01T08:05:00Z',
    audioLocale: 'ja-JP',
  }),
  makeWatchHistoryRow({
    seriesId: 'GLOW123',
    title: 'Low Rated Show',
    slug: 'low-rated-show',
    seasonNumber: 1,
    episodeNumber: 2,
    sequenceNumber: 2,
    playhead: 700,
    fullyWatched: false,
    datePlayed: '2025-02-09T10:15:00Z',
    audioLocale: 'ja-JP',
  }),
  makeWatchHistoryRow({
    seriesId: 'GNONE789',
    title: 'No Rating Show',
    slug: 'no-rating-show',
    seasonNumber: 1,
    episodeNumber: 1,
    sequenceNumber: 1,
    playhead: 1200,
    fullyWatched: false,
    datePlayed: '2025-03-19T08:20:00Z',
    audioLocale: 'en-US',
  }),
]
