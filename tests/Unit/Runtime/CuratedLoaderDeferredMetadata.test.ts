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
  queueDeferredMetadataPreload: (options: {
    context: {
      state: {
        mounted: boolean;
        deferredMetadataRunId: number;
        curatedDeferredMetadataInFlight?: boolean;
        gridEl: Element | null;
      };
      windowRef: {
        innerHeight: number;
        setTimeout: (callback: () => void, delay: number) => number;
      };
      documentRef: Document | null;
      locationRef: {
        pathname: string;
      };
      runtimeEvent: (event: string, data?: unknown) => void;
      isWatchlistPath: (pathname: string) => boolean;
      renderCuratedPanel: () => void;
      metadataPriorityEntryCount: number;
      metadataDeferredChunkSize: number;
      metadataDeferredIdleTimeoutMs: number;
      metadataDeferredHiddenDelayMs: number;
      metadataViewportPriorityCount: number;
      deferredMetadataRunId: number;
    };
    deferredEntries: unknown[];
    tokenEntry: unknown;
    preloadMetadataForEntries: (entries: unknown[], tokenEntry: unknown) => Promise<void>;
  }) => void;
};

type DeferredMetadataModule = {
  createCuratedLoaderDeferredMetadataRuntime: () => DeferredMetadataRuntime;
};

const curatedLoaderDeferredMetadataModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedLoaderDeferredMetadata.ts'),
).href;
const curatedPanelGridDomStateModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'CuratedPanelGridDomState.ts'),
).href;

let curatedLoaderDeferredMetadataModule: DeferredMetadataModule | null = null;
let curatedPanelGridDomStateModule: {
  writeProjectedCuratedGridChildren: (gridElement: Element, activeCards: Element[]) => void;
} | null = null;

function getModule(): DeferredMetadataModule {
  if (!curatedLoaderDeferredMetadataModule) {
    throw new Error('Curated loader deferred metadata module is not initialized');
  }
  return curatedLoaderDeferredMetadataModule;
}

function getDomStateModule(): {
  writeProjectedCuratedGridChildren: (gridElement: Element, activeCards: Element[]) => void;
} {
  if (!curatedPanelGridDomStateModule) {
    throw new Error('Curated panel grid DOM state module is not initialized');
  }
  return curatedPanelGridDomStateModule;
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
    curatedPanelGridDomStateModule = (await import(curatedPanelGridDomStateModuleUrl)) as {
      writeProjectedCuratedGridChildren: (gridElement: Element, activeCards: Element[]) => void;
    };
  });

  afterEach(() => {
    curatedLoaderDeferredMetadataModule = null;
    curatedPanelGridDomStateModule = null;
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

  it('keeps parked cards out of viewport-priority deferred metadata ordering', () => {
    const runtime = getModule().createCuratedLoaderDeferredMetadataRuntime();
    const parkedCard = {
      className: 'cw-curated-card--parked',
      dataset: { cwSeriesId: 'series-2' },
      getBoundingClientRect: () => ({ top: 0, bottom: 0 }),
    } as unknown as Element;
    const visibleCard = {
      className: 'cw-curated-card',
      dataset: { cwSeriesId: 'series-4' },
      getBoundingClientRect: () => ({ top: 80, bottom: 320 }),
    } as unknown as Element;
    const gridElement = {
      children: [parkedCard, visibleCard],
    } as unknown as Element;
    (parkedCard as Element & { parentNode?: Element | null }).parentNode = gridElement;
    (visibleCard as Element & { parentNode?: Element | null }).parentNode = gridElement;
    getDomStateModule().writeProjectedCuratedGridChildren(gridElement, [visibleCard]);
    const preloadMetadataForEntries = vi.fn(async () => {});

    runtime.queueDeferredMetadataPreload({
      context: {
        state: {
          mounted: true,
          deferredMetadataRunId: 1,
          gridEl: gridElement,
        },
        windowRef: {
          innerHeight: 900,
          setTimeout: (callback) => {
            callback();
            return 1;
          },
        },
        documentRef: null,
        locationRef: {
          pathname: '/watchlist',
        },
        runtimeEvent: () => {},
        isWatchlistPath: (pathname) => pathname === '/watchlist',
        renderCuratedPanel: () => {},
        metadataPriorityEntryCount: 1,
        metadataDeferredChunkSize: 1,
        metadataDeferredIdleTimeoutMs: 0,
        metadataDeferredHiddenDelayMs: 0,
        metadataViewportPriorityCount: 1,
        deferredMetadataRunId: 1,
      },
      deferredEntries: [{ seriesId: 'series-2' }, { seriesId: 'series-3' }, { seriesId: 'series-4' }],
      tokenEntry: {},
      preloadMetadataForEntries,
    });

    expect(preloadMetadataForEntries).toHaveBeenCalledWith([{ seriesId: 'series-4' }], {});
  });
});
