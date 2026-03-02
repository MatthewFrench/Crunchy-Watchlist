import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BootstrapGateRuntime = {
  shouldRun: (options: Record<string, unknown>) => boolean;
  isWatchlistPath: (pathname: unknown) => boolean;
  getWatchlistRoot: (documentRef: unknown) => Element | null;
  getWatchlistHeader: (documentRef: unknown) => Element | null;
};

const bootstrapGateModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapGate.ts'),
).href;

let bootstrapGateRuntime: BootstrapGateRuntime | null = null;

function getBootstrapGateRuntime(): BootstrapGateRuntime {
  if (!bootstrapGateRuntime) {
    throw new Error('Bootstrap gate runtime was not initialized for test');
  }

  return bootstrapGateRuntime;
}

describe('bootstrap-gate runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(bootstrapGateModuleUrl)) as {
      createBootstrapGateRuntime: () => object;
    };
    bootstrapGateRuntime = module.createBootstrapGateRuntime() as BootstrapGateRuntime;
  });

  afterEach(() => {
    bootstrapGateRuntime = null;
    vi.restoreAllMocks();
  });

  it('blocks iframe execution and duplicate same-version bootstrap runs', () => {
    const runtime = getBootstrapGateRuntime();

    const iframeWindow = {
      top: {},
    };
    expect(
      runtime.shouldRun({
        windowRef: iframeWindow,
        browserRef: {
          runtime: {
            getManifest: () => ({ version: '1.2.3' }),
          },
        },
      }),
    ).toBe(false);

    const topWindow = {
      top: null as unknown,
      __CW_WATCHLIST_CURATOR_LOADED__: undefined as unknown,
    };
    topWindow.top = topWindow;

    const firstRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });
    const secondRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });

    expect(firstRun).toBe(true);
    expect(secondRun).toBe(false);
  });

  it('allows same-version rebootstrap when previous runtime exposes shutdown control', () => {
    const runtime = getBootstrapGateRuntime();
    const shutdown = vi.fn();
    const topWindow = {
      top: null as unknown,
      __CW_WATCHLIST_CURATOR_LOADED__: undefined as unknown,
      __CW_WATCHLIST_CURATOR_CONTROL__: {
        shutdown,
      },
      location: {
        pathname: '/watchlist',
      },
      document: {
        querySelector: () => null,
      },
    };
    topWindow.top = topWindow;

    const firstRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });
    const secondRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });

    expect(firstRun).toBe(true);
    expect(secondRun).toBe(true);
    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(shutdown).toHaveBeenCalledWith({
      reason: 'same-version-rebootstrap',
      staleShellDetected: false,
    });
  });

  it('allows same-version rebootstrap when a stale framed shell exists without control hooks', () => {
    const runtime = getBootstrapGateRuntime();
    const watchlistRoot = {
      classList: {
        contains: (name: string) => name === 'cw-watchlist-frame',
      },
      querySelector: (_selector: string) => null,
      contains: (element: unknown) => element != null && (element as { kind?: string }).kind === 'host',
    };
    const host = {
      kind: 'host',
      contains: (_candidate: unknown) => false,
    };
    const topWindow = {
      top: null as unknown,
      __CW_WATCHLIST_CURATOR_LOADED__: undefined as unknown,
      location: {
        pathname: '/watchlist',
      },
      document: {
        querySelector: (selector: string) => {
          if (selector === '.erc-watchlist') {
            return watchlistRoot;
          }
          if (selector === '.cw-host') {
            return host;
          }
          return null;
        },
      },
    };
    topWindow.top = topWindow;

    const firstRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });
    const secondRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });

    expect(firstRun).toBe(true);
    expect(secondRun).toBe(true);
  });

  it('keeps same-version run blocked when stable owned refs indicate a healthy shell', () => {
    const runtime = getBootstrapGateRuntime();
    const tabCrunchyroll = {
      className: 'cw-tab',
      contains: (_candidate: unknown) => false,
    };
    const tabCurated = {
      className: 'cw-tab',
      contains: (_candidate: unknown) => false,
    };
    const loadingIndicator = {
      className: 'cw-loading-indicator',
      style: {
        display: 'none',
      },
      contains: (_candidate: unknown) => false,
    };
    const grid = {
      className: 'cw-curated-grid',
      children: [{}],
      contains: (_candidate: unknown) => false,
    };
    const panel = {
      className: 'cw-panel',
      contains: (candidate: unknown) => candidate === loadingIndicator || candidate === grid,
    };
    const host = {
      className: 'cw-host',
      contains: (candidate: unknown) =>
        candidate === tabCrunchyroll || candidate === tabCurated || candidate === panel || candidate === grid,
    };
    const watchlistRoot = {
      classList: {
        contains: (name: string) => name === 'cw-watchlist-frame',
      },
      querySelector: (_selector: string) => null,
      contains: (element: unknown) => element === host,
    };
    const topWindow = {
      top: null as unknown,
      __CW_WATCHLIST_CURATOR_LOADED__: undefined as unknown,
      __CW_WATCHLIST_CURATOR_CONTROL__: {
        ownedRefs: {
          hostEl: host,
          tabCrunchyrollEl: tabCrunchyroll,
          tabCuratedEl: tabCurated,
          curatedPanelEl: panel,
          gridEl: grid,
          loadingIndicatorEl: loadingIndicator,
        },
      },
      location: {
        pathname: '/watchlist',
      },
      document: {
        querySelector: (selector: string) => {
          if (selector === '.erc-watchlist') {
            return watchlistRoot;
          }
          if (selector === '.cw-host') {
            return host;
          }
          return null;
        },
      },
    };
    topWindow.top = topWindow;

    const firstRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });
    const secondRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });

    expect(firstRun).toBe(true);
    expect(secondRun).toBe(false);
  });

  it('allows same-version rebootstrap when framed watchlist residue exists without host nodes', () => {
    const runtime = getBootstrapGateRuntime();
    const watchlistRoot = {
      classList: {
        contains: (name: string) => name === 'cw-watchlist-frame',
      },
      querySelector: (_selector: string) => null,
    };
    const topWindow = {
      top: null as unknown,
      __CW_WATCHLIST_CURATOR_LOADED__: undefined as unknown,
      location: {
        pathname: '/watchlist',
      },
      document: {
        querySelector: (selector: string) => {
          if (selector === '.erc-watchlist') {
            return watchlistRoot;
          }
          if (selector === '.cw-host') {
            return null;
          }
          return null;
        },
      },
    };
    topWindow.top = topWindow;

    const firstRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });
    const secondRun = runtime.shouldRun({
      windowRef: topWindow,
      browserRef: {
        runtime: {
          getManifest: () => ({ version: '1.2.3' }),
        },
      },
    });

    expect(firstRun).toBe(true);
    expect(secondRun).toBe(true);
  });

  it('detects watchlist paths only for trailing watchlist segment', () => {
    const runtime = getBootstrapGateRuntime();

    expect(runtime.isWatchlistPath('/watchlist')).toBe(true);
    expect(runtime.isWatchlistPath('/en-us/watchlist')).toBe(true);
    expect(runtime.isWatchlistPath('/browse')).toBe(false);
    expect(runtime.isWatchlistPath('/watchlist/extra')).toBe(false);
  });

  it('finds watchlist root and header selectors', () => {
    const runtime = getBootstrapGateRuntime();
    const watchlistRoot = { className: 'erc-watchlist' };
    const watchlistHeader = { className: 'watchlist-header' };
    const fakeDocument = {
      querySelector: (selector: string) => {
        if (selector === '.erc-watchlist' || selector === '[data-t="watchlist-page"]') {
          return watchlistRoot;
        }
        if (
          selector === '.erc-watchlist .watchlist-header' ||
          selector === '.erc-watchlist [class*="watchlist-header"]'
        ) {
          return watchlistHeader;
        }
        return null;
      },
    };

    expect(runtime.getWatchlistRoot(fakeDocument)?.className).toContain('erc-watchlist');
    expect(runtime.getWatchlistHeader(fakeDocument)?.className).toContain('watchlist-header');
  });
});
