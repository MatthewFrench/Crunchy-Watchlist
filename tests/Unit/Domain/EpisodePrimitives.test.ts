import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type EpisodePrimitivesRuntime = {
  parseCanonicalEpisodeIdentifier: (
    value: unknown,
  ) => { seriesId: string; seasonCore: number; episodeNumber: number; canonicalEpisodeKey: string } | null;
  deriveCanonicalEpisodeKeyFromEpisodeMetadata: (meta: unknown, fallbackSeriesId?: unknown) => string | null;
  getAbsoluteEpisodeNumberFromEpisodeMetadata: (meta: unknown) => number | null;
  getEpisodeAvailabilityByAudioLocale: (meta: unknown) => Record<string, number>;
  mergeEpisodeAvailabilityByAudioLocale: (previousMap: unknown, nextMap: unknown) => Record<string, number>;
};

type EpisodePrimitivesModule = {
  createEpisodePrimitives: (deps: Record<string, unknown>) => EpisodePrimitivesRuntime;
};

const moduleUrl = pathToFileURL(path.join(process.cwd(), 'extension', 'src', 'Domain', 'EpisodePrimitives.ts')).href;

let createEpisodePrimitives: EpisodePrimitivesModule['createEpisodePrimitives'] | null = null;

function sanitizePositiveInt(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return Math.round(numeric);
}

function pickFirstPositiveInt(values: unknown[]): number | null {
  for (const value of values) {
    const parsed = sanitizePositiveInt(value);
    if (parsed != null) {
      return parsed;
    }
  }
  return null;
}

function normalizeAudioLocale(locale: unknown): string | null {
  const text = String(locale || '').trim();
  return text ? text : null;
}

function normalizeAudioLocaleCountMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [localeKey, count] of Object.entries(value as Record<string, unknown>)) {
    const locale = normalizeAudioLocale(localeKey);
    const parsedCount = sanitizePositiveInt(count);
    if (!locale || parsedCount == null) {
      continue;
    }
    normalized[locale.toLowerCase()] = parsedCount;
  }
  return normalized;
}

function createEpisodePrimitivesRuntime(): EpisodePrimitivesRuntime {
  if (typeof createEpisodePrimitives !== 'function') {
    throw new Error('Episode primitives runtime was not initialized for test');
  }

  return createEpisodePrimitives({
    sanitizePositiveInt,
    pickFirstPositiveInt,
    normalizeAudioLocale,
    normalizeAudioLocaleCountMap,
  });
}

describe('episode-primitives domain module', () => {
  beforeEach(async () => {
    vi.resetModules();
    const episodePrimitivesModule = (await import(moduleUrl)) as {
      createEpisodePrimitivesRuntime: () => EpisodePrimitivesModule;
    };
    createEpisodePrimitives = episodePrimitivesModule.createEpisodePrimitivesRuntime().createEpisodePrimitives;
  });

  afterEach(() => {
    createEpisodePrimitives = null;
    vi.restoreAllMocks();
  });

  it('parses canonical identifiers and derives fallback keys', () => {
    const runtime = createEpisodePrimitivesRuntime();
    expect(runtime.parseCanonicalEpisodeIdentifier('GR5P2X4Y|S1|E7')).toEqual({
      seriesId: 'GR5P2X4Y',
      seasonCore: 1,
      episodeNumber: 7,
      canonicalEpisodeKey: 'GR5P2X4Y|S1|E7',
    });

    expect(
      runtime.deriveCanonicalEpisodeKeyFromEpisodeMetadata({
        series_id: 'GR75N4Q2Y',
        season_id: 'GS012345',
        episode_number: 13,
      }),
    ).toBe('GR75N4Q2Y|S12345|E13');
  });

  it('prefers robust absolute episode metadata fields', () => {
    const runtime = createEpisodePrimitivesRuntime();
    expect(
      runtime.getAbsoluteEpisodeNumberFromEpisodeMetadata({
        sequence_number: 44,
        episode_sequence_number: 11,
        global_episode_num: 3,
      }),
    ).toBe(44);
    expect(
      runtime.getAbsoluteEpisodeNumberFromEpisodeMetadata({
        season_number: 1,
        episode_number: 9,
      }),
    ).toBe(9);
  });

  it('builds and merges audio-locale availability maps with max episode tracking', () => {
    const runtime = createEpisodePrimitivesRuntime();
    expect(
      runtime.getEpisodeAvailabilityByAudioLocale({
        audio_locale: 'ja-JP',
        episode_number: 14,
        season_number: 1,
        versions: [{ audio_locale: 'en-US' }, { audio_locale: 'pt-BR' }],
      }),
    ).toEqual({
      'ja-jp': 14,
      'en-us': 14,
      'pt-br': 14,
    });

    expect(
      runtime.mergeEpisodeAvailabilityByAudioLocale(
        { 'ja-jp': 10, 'en-us': 8 },
        { 'ja-jp': 12, 'en-us': 6, 'es-es': 9 },
      ),
    ).toEqual({
      'ja-jp': 12,
      'en-us': 8,
      'es-es': 9,
    });
  });
});
