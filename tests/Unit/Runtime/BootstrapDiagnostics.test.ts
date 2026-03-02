import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RuntimeBootstrapDiagnostics = {
  updateDiagnostics: (patch?: unknown) => void;
  setBootstrapIssue: (stage: unknown, details?: unknown) => void;
};

const bootstrapDiagnosticsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapDiagnostics.ts'),
).href;
let createBootstrapDiagnosticsRuntimeFactory:
  | ((options: Record<string, unknown>) => RuntimeBootstrapDiagnostics)
  | null = null;

describe('bootstrap-diagnostics runtime module', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(bootstrapDiagnosticsModuleUrl)) as {
      createBootstrapDiagnosticsRuntime: (options: Record<string, unknown>) => object;
    };
    createBootstrapDiagnosticsRuntimeFactory = (options) =>
      module.createBootstrapDiagnosticsRuntime(options) as RuntimeBootstrapDiagnostics;
  });

  afterEach(() => {
    createBootstrapDiagnosticsRuntimeFactory = null;
    vi.restoreAllMocks();
  });

  it('merges diagnostics updates with timestamp and href', () => {
    if (typeof createBootstrapDiagnosticsRuntimeFactory !== 'function') {
      throw new Error('Bootstrap diagnostics runtime was not initialized for test');
    }
    const windowRef = {
      location: { href: 'https://www.crunchyroll.com/watchlist' },
      __CW_WATCHLIST_CURATOR_DIAGNOSTICS__: {
        existing: true,
      },
    };

    const runtime = createBootstrapDiagnosticsRuntimeFactory({
      windowRef,
    });

    runtime.updateDiagnostics({
      stage: 'bootstrap-started',
      ok: false,
    });

    const diagnostics = windowRef.__CW_WATCHLIST_CURATOR_DIAGNOSTICS__ as Record<string, unknown>;
    expect(diagnostics.existing).toBe(true);
    expect(diagnostics.stage).toBe('bootstrap-started');
    expect(diagnostics.ok).toBe(false);
    expect(typeof diagnostics.updatedAt).toBe('string');
    expect(diagnostics.href).toBe('https://www.crunchyroll.com/watchlist');
  });

  it('records bootstrap issues and logs with stage details', () => {
    if (typeof createBootstrapDiagnosticsRuntimeFactory !== 'function') {
      throw new Error('Bootstrap diagnostics runtime was not initialized for test');
    }
    const errorSpy = vi.fn();
    const windowRef = {
      location: { href: 'https://www.crunchyroll.com/watchlist' },
      __CW_WATCHLIST_CURATOR_DIAGNOSTICS__: {},
    };

    const runtime = createBootstrapDiagnosticsRuntimeFactory({
      windowRef,
      consoleRef: {
        error: errorSpy,
      },
    });

    runtime.setBootstrapIssue('missing-module', {
      module: 'runtimeBootstrapModules',
    });

    const diagnostics = windowRef.__CW_WATCHLIST_CURATOR_DIAGNOSTICS__ as Record<string, unknown>;
    expect(diagnostics.stage).toBe('missing-module');
    expect(diagnostics.module).toBe('runtimeBootstrapModules');
    expect(errorSpy).toHaveBeenCalledWith('[CW] missing-module', {
      module: 'runtimeBootstrapModules',
    });
  });
});
