import { describe, expect, it } from 'vitest';
import {
  buildAuthTokenPayload,
  buildCmsObjectsPayload,
  buildSeriesPageHtml,
} from '../../Helpers/FixturePayloadBuilders';
import { ACCESS_TOKEN, ACCOUNT_ID } from '../../ServerFixtures';

describe('fixture payload builders', () => {
  it('builds a stable auth token payload contract', () => {
    const payload = buildAuthTokenPayload();

    expect(payload.access_token).toBe(ACCESS_TOKEN);
    expect(payload.account_id).toBe(ACCOUNT_ID);
    expect(payload.token_type).toBe('bearer');
    expect(payload.expires_in).toBe(3600);
  });

  it('builds cms object payloads with localized episode/season counts', () => {
    const payload = buildCmsObjectsPayload(['GHIGH456'], 'en-US');
    const series = payload.data[0];
    if (!series) {
      throw new Error('Expected CMS payload row');
    }

    expect(series.id).toBe('GHIGH456');
    expect(series.series_metadata.episode_count).toBe(36);
    expect(series.series_metadata.season_count).toBe(3);
    expect(series.rating?.average).toBe(4.9);
  });

  it('builds schema.org series page markup with aggregate rating', () => {
    const html = buildSeriesPageHtml('SERIES_X', 4.7, 1234);

    expect(html).toContain('"@type":"TVSeries"');
    expect(html).toContain('"ratingValue":4.7');
    expect(html).toContain('"ratingCount":1234');
  });
});
