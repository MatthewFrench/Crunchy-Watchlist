import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../helpers/module-registry'

type UnknownRecord = Record<string, unknown>

type NormalizedEntry = {
  seriesId: string
  knownEpisodeMaxByAudioLocale: Record<string, number>
  hasEnglishAudio: boolean
  watchReadyBase: boolean
}

type EntryNormalizer = {
  normalizeEntriesFromApiRows: (rows: unknown) => NormalizedEntry[]
}

type EntryNormalizerModule = {
  createEntryNormalizer: (deps: Record<string, unknown>) => EntryNormalizer
}

const entryNormalizerModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'domain', 'entry-normalizer.ts'),
).href

function sanitizePositiveInt(value: unknown): number | null {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function normalizeAudioLocale(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function pickFirstDateMs(candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsedValue = Date.parse(candidate)
      if (Number.isFinite(parsedValue)) {
        return parsedValue
      }
    }
  }

  return null
}

function toRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return value as UnknownRecord
}

function createEntryNormalizer(): EntryNormalizer {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>
  const domainRegistry = registry.domain as Record<string, unknown>
  const entryNormalizerModule = domainRegistry.entryNormalizer as EntryNormalizerModule

  return entryNormalizerModule.createEntryNormalizer({
    sanitizePositiveInt,
    getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: UnknownRecord) =>
      sanitizePositiveInt(meta.sequence_number) ?? sanitizePositiveInt(meta.global_episode_number),
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: (meta: UnknownRecord, seriesId: string) => {
      const identifier = typeof meta.identifier === 'string' ? meta.identifier : ''
      return `${seriesId}|${identifier}`
    },
    formatEpisodeIdentifier: (seasonNumber: number | null, episodeNumber: number | null) => {
      if (seasonNumber == null || episodeNumber == null) {
        return ''
      }
      return `S${seasonNumber}E${episodeNumber}`
    },
    hasEnUsAudio: (audioLocales: string[]) => audioLocales.includes('en-us'),
    extractCoverImagesFromApiImages: () => ({
      portrait: 'portrait.jpg',
      landscape: 'landscape.jpg',
      fallback: 'fallback.jpg',
    }),
    extractThumbnailImageFromApiImages: () => 'thumb.jpg',
    pickFirstDateMs,
    getWatchlistSeriesId: (row: UnknownRecord) => {
      const panel = toRecord(row.panel)
      const episodeMetadata = toRecord(panel.episode_metadata)
      return typeof episodeMetadata.series_id === 'string' ? episodeMetadata.series_id : ''
    },
    getEpisodeAvailabilityByAudioLocale: (meta: UnknownRecord) => {
      const audioLocale = normalizeAudioLocale(meta.audio_locale)
      const sequenceNumber = sanitizePositiveInt(meta.sequence_number)
      if (!audioLocale || sequenceNumber == null) {
        return {}
      }
      return {
        [audioLocale]: sequenceNumber,
      }
    },
    mergeEpisodeAvailabilityByAudioLocale: (
      existing: Record<string, number>,
      next: Record<string, number>,
    ): Record<string, number> => {
      const merged: Record<string, number> = { ...existing }
      Object.entries(next).forEach(([locale, count]) => {
        const previousCount = merged[locale]
        merged[locale] = previousCount == null ? count : Math.max(previousCount, count)
      })
      return merged
    },
    normalizeAudioLocales: (audioLocales: unknown[]): string[] => {
      const normalized = audioLocales.map(normalizeAudioLocale).filter((locale) => !!locale)
      return Array.from(new Set(normalized))
    },
  })
}

function createApiRow(
  seriesId: string,
  audioLocale: string,
  sequenceNumber: number,
  watchReady: unknown,
): UnknownRecord {
  return {
    watch_ready: watchReady,
    panel: {
      id: `panel-${seriesId}-${sequenceNumber}`,
      title: `Episode ${sequenceNumber}`,
      description: 'Episode description',
      episode_metadata: {
        series_id: seriesId,
        series_slug_title: `series-${seriesId}`,
        series_title: `Series ${seriesId}`,
        season_number: 1,
        episode_number: sequenceNumber,
        sequence_number: sequenceNumber,
        identifier: `s1-e${sequenceNumber}`,
        audio_locale: audioLocale,
        availability_status: 'available',
      },
      images: {},
    },
    date_added: `2024-01-0${sequenceNumber}T00:00:00.000Z`,
    fully_watched: false,
    never_watched: true,
    playhead: 0,
    is_favorite: false,
  }
}

describe('entry-normalizer', () => {
  beforeEach(async () => {
    await loadRuntimeModules([entryNormalizerModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('deduplicates series rows and merges audio-locale episode availability', () => {
    const normalizer = createEntryNormalizer()

    const rows = [createApiRow('series-a', 'en-US', 1, true), createApiRow('series-a', 'ja-JP', 2, true)]
    const normalized = normalizer.normalizeEntriesFromApiRows(rows)

    expect(normalized).toHaveLength(1)
    expect(normalized[0]?.knownEpisodeMaxByAudioLocale['en-us']).toBe(1)
    expect(normalized[0]?.knownEpisodeMaxByAudioLocale['ja-jp']).toBe(2)
    expect(normalized[0]?.hasEnglishAudio).toBe(true)
  })

  it('applies explicit watch-ready flags from API rows', () => {
    const normalizer = createEntryNormalizer()

    const rows = [createApiRow('series-false', 'en-US', 1, 'no'), createApiRow('series-true', 'en-US', 1, 'yes')]

    const normalized = normalizer.normalizeEntriesFromApiRows(rows)
    const bySeriesId = new Map(normalized.map((entry) => [entry.seriesId, entry]))

    expect(bySeriesId.get('series-false')?.watchReadyBase).toBe(false)
    expect(bySeriesId.get('series-true')?.watchReadyBase).toBe(true)
  })
})
