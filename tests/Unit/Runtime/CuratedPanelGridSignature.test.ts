import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CuratedPanelGridSignatureRuntime = {
  normalizeCardLayout: (value: unknown) => 'portrait' | 'landscape';
  buildCuratedCardContentSignature: (entry: Record<string, unknown>, cardLayout: unknown) => string;
  parseCardLayoutFromContentSignature: (signature: string) => 'portrait' | 'landscape' | null;
};

const moduleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridSignature.ts'),
).href;

let runtime: CuratedPanelGridSignatureRuntime | null = null;

function getRuntime(): CuratedPanelGridSignatureRuntime {
  if (!runtime) {
    throw new Error('Curated panel grid signature runtime is not initialized');
  }
  return runtime;
}

describe('curated-panel-grid-signature runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(moduleUrl)) as {
      createCuratedPanelGridSignatureRuntime: () => CuratedPanelGridSignatureRuntime;
    };
    runtime = module.createCuratedPanelGridSignatureRuntime();
  });

  afterEach(() => {
    runtime = null;
  });

  it('ignores dimNotWatchReady when computing card content signature', () => {
    const signatureRuntime = getRuntime();
    const baseEntry = {
      seriesId: 'SERIES-1',
      title: 'Fixture',
      rating: 4.8,
      votes: 999,
      dimNotWatchReady: false,
    };

    const dimmedSignature = signatureRuntime.buildCuratedCardContentSignature(
      { ...baseEntry, dimNotWatchReady: true },
      'portrait',
    );
    const defaultSignature = signatureRuntime.buildCuratedCardContentSignature(baseEntry, 'portrait');

    expect(dimmedSignature).toBe(defaultSignature);
  });

  it('changes signature when render-affecting content changes', () => {
    const signatureRuntime = getRuntime();
    const original = signatureRuntime.buildCuratedCardContentSignature(
      {
        seriesId: 'SERIES-1',
        title: 'Fixture',
        rating: 4.8,
      },
      'portrait',
    );
    const changed = signatureRuntime.buildCuratedCardContentSignature(
      {
        seriesId: 'SERIES-1',
        title: 'Fixture changed',
        rating: 4.8,
      },
      'portrait',
    );

    expect(changed).not.toBe(original);
  });

  it('normalizes and parses layout segments correctly', () => {
    const signatureRuntime = getRuntime();
    expect(signatureRuntime.normalizeCardLayout('landscape')).toBe('landscape');
    expect(signatureRuntime.normalizeCardLayout('portrait')).toBe('portrait');
    expect(signatureRuntime.normalizeCardLayout('unexpected')).toBe('portrait');

    const landscapeSignature = signatureRuntime.buildCuratedCardContentSignature({ seriesId: 'SERIES-1' }, 'landscape');
    const portraitSignature = signatureRuntime.buildCuratedCardContentSignature({ seriesId: 'SERIES-1' }, 'portrait');
    expect(signatureRuntime.parseCardLayoutFromContentSignature(landscapeSignature)).toBe('landscape');
    expect(signatureRuntime.parseCardLayoutFromContentSignature(portraitSignature)).toBe('portrait');
    expect(signatureRuntime.parseCardLayoutFromContentSignature('')).toBeNull();
  });
});
