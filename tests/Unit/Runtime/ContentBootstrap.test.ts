import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ContentBootstrapPrelude = {
  ok: boolean;
  isWatchlistPath?: (pathname: string) => boolean;
  getWatchlistRoot?: (documentRef: Document) => Element | null;
  getWatchlistHeader?: (documentRef: Document) => Element | null;
  assertRuntimeMethods?: (...args: unknown[]) => unknown;
  bootstrapModulesRuntime?: Record<string, unknown>;
};

type ContentBootstrapModule = {
  createContentBootstrapPrelude: (options: {
    windowRef: Window & typeof globalThis;
    consoleRef: Console;
    browserRef?: unknown;
    chromeRef?: unknown;
    runtimeBootstrapDiagnosticsModule?: unknown;
    runtimeBootstrapGateModule?: unknown;
    runtimeBootstrapModulesModule?: unknown;
  }) => ContentBootstrapPrelude;
};

const contentBootstrapModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentBootstrap.ts'),
).href;
let contentBootstrapModule: ContentBootstrapModule | null = null;

function getContentBootstrapModule(): ContentBootstrapModule {
  if (!contentBootstrapModule) {
    throw new Error('Content bootstrap module was not initialized for test');
  }
  return contentBootstrapModule;
}

function createWindowRef(pathname = '/watchlist'): Window & typeof globalThis {
  const windowRef = {
    location: { pathname },
  } as unknown as Window & typeof globalThis;
  (windowRef as unknown as { top: unknown }).top = windowRef;
  return windowRef;
}

describe('content-bootstrap runtime module', () => {
  beforeEach(async () => {
    vi.resetModules();
    contentBootstrapModule = (await import(contentBootstrapModuleUrl)) as ContentBootstrapModule;
  });

  afterEach(() => {
    contentBootstrapModule = null;
  });

  it('returns not-ok when route gate denies execution and emits gated diagnostics', () => {
    const updateDiagnostics = vi.fn();
    const setBootstrapIssue = vi.fn();
    const runtimeBootstrapDiagnosticsModule = {
      createBootstrapDiagnostics: () => ({
        updateDiagnostics,
        setBootstrapIssue,
      }),
    };
    const runtimeBootstrapGateModule = {
      shouldRun: () => false,
      isWatchlistPath: () => true,
      getWatchlistRoot: () => null,
      getWatchlistHeader: () => null,
    };
    const runtimeBootstrapModulesModule = {
      createBootstrapModules: () => ({}),
      assertRuntimeMethods: () => {},
    };
    const prelude = getContentBootstrapModule().createContentBootstrapPrelude({
      windowRef: createWindowRef('/browse'),
      consoleRef: console,
      runtimeBootstrapDiagnosticsModule,
      runtimeBootstrapGateModule,
      runtimeBootstrapModulesModule,
    });

    expect(prelude.ok).toBe(false);
    expect(setBootstrapIssue).not.toHaveBeenCalled();
    expect(updateDiagnostics).toHaveBeenCalledWith({
      ok: false,
      stage: 'bootstrap-gated',
      pathname: '/browse',
      inTopFrame: true,
    });
  });

  it('returns runtime modules when all required owners are available and route is eligible', () => {
    const updateDiagnostics = vi.fn();
    const setBootstrapIssue = vi.fn();
    const gateModule = {
      shouldRun: () => true,
      isWatchlistPath: () => true,
      getWatchlistRoot: () => null,
      getWatchlistHeader: () => null,
    };
    const modulesModule = {
      createBootstrapModules: () => ({ runtimeStoreModule: {} }),
      assertRuntimeMethods: () => {},
    };
    const diagnosticsModule = {
      createBootstrapDiagnostics: () => ({
        updateDiagnostics,
        setBootstrapIssue,
      }),
    };

    const prelude = getContentBootstrapModule().createContentBootstrapPrelude({
      windowRef: createWindowRef('/watchlist'),
      consoleRef: console,
      runtimeBootstrapDiagnosticsModule: diagnosticsModule,
      runtimeBootstrapGateModule: gateModule,
      runtimeBootstrapModulesModule: modulesModule,
    });

    expect(prelude.ok).toBe(true);
    expect(prelude.isWatchlistPath).toBe(gateModule.isWatchlistPath);
    expect(prelude.getWatchlistRoot).toBe(gateModule.getWatchlistRoot);
    expect(prelude.getWatchlistHeader).toBe(gateModule.getWatchlistHeader);
    expect(prelude.assertRuntimeMethods).toBe(modulesModule.assertRuntimeMethods);
    expect(prelude.bootstrapModulesRuntime).toEqual({ runtimeStoreModule: {} });
    expect(setBootstrapIssue).not.toHaveBeenCalled();
  });
});
