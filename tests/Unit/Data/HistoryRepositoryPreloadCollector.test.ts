import { afterEach, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type HistoryUpdateBuckets = {
  remainingSeriesIds: Set<string>
  seriesUpdates: Record<string, Record<string, unknown>>
  seriesProgressUpdates: Record<string, Record<string, unknown>>
  localeUpdates: Record<string, Record<string, Record<string, unknown>>>
  localeProgressUpdates: Record<string, Record<string, Record<string, unknown>>>
  pages: number
  totalRows: number | null
  fetchedRows: number
  noMatchPageStreak: number
  seenRowKeys: Set<string>
}

type HistoryRepositoryPreloadCollectorModule = {
  collectWatchHistoryUpdateBuckets: (options: {
    tokenEntry: Record<string, unknown>
    effectivePreferredAudioLanguage: string
    candidateSeriesIds: string[]
    isDefaultPreferredAudio: boolean
    watchHistoryMaxPages: number
    watchHistoryPageSize: number
    watchHistoryNoMatchPageLimit: number
    fetchWatchHistoryPage: (
      tokenEntry: Record<string, unknown>,
      pageNumber: number,
      preferredAudioLanguage?: unknown,
    ) => Promise<{ rows: Array<Record<string, unknown>>; total: number }>
    normalizeAudioLocale: (value: unknown) => string
    sanitizePositiveInt: (value: unknown) => number | null
    parseDateMs: (value: unknown) => number | null
    deriveCanonicalEpisodeKeyFromEpisodeMetadata: (metadata: Record<string, unknown>, seriesId?: unknown) => string
    getAbsoluteEpisodeNumberFromEpisodeMetadata: (metadata: Record<string, unknown>) => number | null
    shouldReplaceWatchHistoryProgress: (
      previous: Record<string, unknown> | null | undefined,
      next: Record<string, unknown> | null | undefined,
    ) => boolean
  }) => Promise<HistoryUpdateBuckets>
}

const collectorModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Data', 'HistoryRepositoryPreloadCollector.ts'),
).href

function normalizeAudioLocale(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function sanitizePositiveInt(value: unknown): number | null {
  const numericValue = Number(value)
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null
}

function parseDateMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Date.parse(value)
    return Number.isFinite(parsedValue) ? parsedValue : null
  }
  return null
}

function deriveCanonicalEpisodeKeyFromEpisodeMetadata(metadata: Record<string, unknown>, seriesId?: unknown): string {
  const identifier = typeof metadata.identifier === 'string' ? metadata.identifier : ''
  return `${typeof seriesId === 'string' ? seriesId : ''}|${identifier}|${String(metadata.sequence_number ?? '')}`
}

function getAbsoluteEpisodeNumberFromEpisodeMetadata(metadata: Record<string, unknown>): number | null {
  return sanitizePositiveInt(metadata.sequence_number)
}

function shouldReplaceWatchHistoryProgress(
  previous: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): boolean {
  const previousPlayhead = Number(previous?.playhead || 0)
  const nextPlayhead = Number(next?.playhead || 0)
  return nextPlayhead >= previousPlayhead
}

async function loadCollectorModule(): Promise<HistoryRepositoryPreloadCollectorModule> {
  const registry = await loadRuntimeModules([collectorModuleUrl])
  return registry.historyRepositoryPreloadCollector as HistoryRepositoryPreloadCollectorModule
}

afterEach(() => {
  clearRuntimeModulesRegistry()
})

describe('HistoryRepositoryPreloadCollector', () => {
  it('collects candidate updates and dedupes repeated rows', async () => {
    const collector = await loadCollectorModule()
    const fetchWatchHistoryPage = vi.fn(async () => ({
      total: 2,
      rows: [
        {
          id: 'episode-1',
          date_played: '2024-01-02T00:00:00.000Z',
          playhead: 1200,
          fully_watched: false,
          panel: {
            id: 'episode-1',
            title: 'Episode 1',
            episode_metadata: {
              series_id: 'series-a',
              identifier: 's1-e1',
              sequence_number: 1,
              season_number: 1,
              episode_number: 1,
              duration_ms: 1_420_087,
              audio_locale: 'en-us',
            },
          },
        },
        {
          id: 'episode-1',
          date_played: '2024-01-02T00:00:00.000Z',
          playhead: 1200,
          fully_watched: false,
          panel: {
            id: 'episode-1',
            title: 'Episode 1',
            episode_metadata: {
              series_id: 'series-a',
              identifier: 's1-e1',
              sequence_number: 1,
              season_number: 1,
              episode_number: 1,
              duration_ms: 1_420_087,
              audio_locale: 'en-us',
            },
          },
        },
      ],
    }))

    const buckets = await collector.collectWatchHistoryUpdateBuckets({
      tokenEntry: { accountId: 'acct-1', accessToken: 'token-1' },
      effectivePreferredAudioLanguage: 'en-us',
      candidateSeriesIds: ['series-a'],
      isDefaultPreferredAudio: true,
      watchHistoryMaxPages: 5,
      watchHistoryPageSize: 100,
      watchHistoryNoMatchPageLimit: 2,
      fetchWatchHistoryPage,
      normalizeAudioLocale,
      sanitizePositiveInt,
      parseDateMs,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      getAbsoluteEpisodeNumberFromEpisodeMetadata,
      shouldReplaceWatchHistoryProgress,
    })

    expect(fetchWatchHistoryPage).toHaveBeenCalledTimes(1)
    expect(buckets.pages).toBe(1)
    expect(buckets.remainingSeriesIds.size).toBe(0)
    expect(Object.keys(buckets.seriesUpdates)).toContain('series-a')
    expect(buckets.seriesUpdates['series-a']?.episodeDurationMs).toBe(1_420_087)
    expect(buckets.seenRowKeys.size).toBe(1)
  })

  it('stops collection when no-match page streak reaches the configured limit', async () => {
    const collector = await loadCollectorModule()
    const fetchWatchHistoryPage = vi.fn(async () => ({
      total: 10,
      rows: [
        {
          id: `other-${fetchWatchHistoryPage.mock.calls.length + 1}`,
          date_played: '2024-01-02T00:00:00.000Z',
          playhead: 300,
          fully_watched: false,
          panel: {
            id: 'other-episode',
            title: 'Other Episode',
            episode_metadata: {
              series_id: 'series-other',
              identifier: 'other-id',
              sequence_number: 1,
              season_number: 1,
              episode_number: 1,
              audio_locale: 'en-us',
            },
          },
        },
      ],
    }))

    const buckets = await collector.collectWatchHistoryUpdateBuckets({
      tokenEntry: { accountId: 'acct-1', accessToken: 'token-1' },
      effectivePreferredAudioLanguage: 'en-us',
      candidateSeriesIds: ['series-target'],
      isDefaultPreferredAudio: true,
      watchHistoryMaxPages: 10,
      watchHistoryPageSize: 1,
      watchHistoryNoMatchPageLimit: 2,
      fetchWatchHistoryPage,
      normalizeAudioLocale,
      sanitizePositiveInt,
      parseDateMs,
      deriveCanonicalEpisodeKeyFromEpisodeMetadata,
      getAbsoluteEpisodeNumberFromEpisodeMetadata,
      shouldReplaceWatchHistoryProgress,
    })

    expect(fetchWatchHistoryPage).toHaveBeenCalledTimes(2)
    expect(buckets.pages).toBe(2)
    expect(buckets.remainingSeriesIds.has('series-target')).toBe(true)
    expect(buckets.noMatchPageStreak).toBe(2)
  })
})
