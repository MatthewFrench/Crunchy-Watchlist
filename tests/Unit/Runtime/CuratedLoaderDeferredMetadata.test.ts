import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DeferredMetadataRuntime = {
  splitMetadataPreloadEntries: (
    context: {
      metadataPriorityEntryCount: number;
    },
    entries: unknown[],
  ) => { priorityEntries: unknown[]; deferredEntries: unknown[] };
};

type DeferredMetadataModule = {
  createCuratedLoaderDeferredMetadataRuntime: () => DeferredMetadataRuntime;
};

const curatedLoaderDeferredMetadataModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedLoaderDeferredMetadata.ts'),
).href;

let curatedLoaderDeferredMetadataModule: DeferredMetadataModule | null = null;

function getModule(): DeferredMetadataModule {
  if (!curatedLoaderDeferredMetadataModule) {
    throw new Error('Curated loader deferred metadata module is not initialized');
  }
  return curatedLoaderDeferredMetadataModule;
}

function createEntries(count: number): unknown[] {
  return Array.from({ length: count }, (_value, index) => ({
    seriesId: `series-${index + 1}`,
  }));
}

describe('curated-loader-deferred-metadata runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    curatedLoaderDeferredMetadataModule = (await import(
      curatedLoaderDeferredMetadataModuleUrl
    )) as DeferredMetadataModule;
  });

  afterEach(() => {
    curatedLoaderDeferredMetadataModule = null;
  });

  it('keeps all entries in priority when total does not exceed configured priority count', () => {
    const runtime = getModule().createCuratedLoaderDeferredMetadataRuntime();
    const entries = createEntries(20);

    const result = runtime.splitMetadataPreloadEntries(
      {
        metadataPriorityEntryCount: 36,
      },
      entries,
    );

    expect(result.priorityEntries).toHaveLength(20);
    expect(result.deferredEntries).toHaveLength(0);
  });

  it('caps priority metadata to 18 entries for medium-large lists', () => {
    const runtime = getModule().createCuratedLoaderDeferredMetadataRuntime();
    const entries = createEntries(180);

    const result = runtime.splitMetadataPreloadEntries(
      {
        metadataPriorityEntryCount: 36,
      },
      entries,
    );

    expect(result.priorityEntries).toHaveLength(18);
    expect(result.deferredEntries).toHaveLength(162);
  });

  it('caps priority metadata to 12 entries for very large lists', () => {
    const runtime = getModule().createCuratedLoaderDeferredMetadataRuntime();
    const entries = createEntries(300);

    const result = runtime.splitMetadataPreloadEntries(
      {
        metadataPriorityEntryCount: 36,
      },
      entries,
    );

    expect(result.priorityEntries).toHaveLength(12);
    expect(result.deferredEntries).toHaveLength(288);
  });

  it('respects smaller configured priority counts when adaptive caps are higher', () => {
    const runtime = getModule().createCuratedLoaderDeferredMetadataRuntime();
    const entries = createEntries(300);

    const result = runtime.splitMetadataPreloadEntries(
      {
        metadataPriorityEntryCount: 12,
      },
      entries,
    );

    expect(result.priorityEntries).toHaveLength(12);
    expect(result.deferredEntries).toHaveLength(288);
  });
});
