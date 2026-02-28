import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry';

type RuntimeBootstrapDiagnosticsModule = {
  runtimeBootstrapDiagnostics: {
    createBootstrapDiagnostics: (options: Record<string, unknown>) => {
      updateDiagnostics: (patch?: unknown) => void;
      setBootstrapIssue: (stage: unknown, details?: unknown) => void;
    };
  };
};

const bootstrapDiagnosticsModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapDiagnostics.ts'),
).href;

function getBootstrapDiagnosticsModule() {
  const registry = (globalThis as Record<string, unknown>)
    .__CW_WATCHLIST_CURATOR_MODULES__ as RuntimeBootstrapDiagnosticsModule;
  return registry.runtimeBootstrapDiagnostics;
}

describe('bootstrap-diagnostics runtime module', () => {
  beforeEach(async () => {
    await loadRuntimeModules([bootstrapDiagnosticsModuleUrl]);
  });

  afterEach(() => {
    clearRuntimeModulesRegistry();
  });

  it('merges diagnostics updates with timestamp and href', () => {
    const windowRef = {
      location: { href: 'https://www.crunchyroll.com/watchlist' },
      __CW_WATCHLIST_CURATOR_DIAGNOSTICS__: {
        existing: true,
      },
    };

    const runtime = getBootstrapDiagnosticsModule().createBootstrapDiagnostics({
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
    const errorSpy = vi.fn();
    const windowRef = {
      location: { href: 'https://www.crunchyroll.com/watchlist' },
      __CW_WATCHLIST_CURATOR_DIAGNOSTICS__: {},
    };

    const runtime = getBootstrapDiagnosticsModule().createBootstrapDiagnostics({
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
