import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RuntimeBootstrapHelpersModule = {
  createContentRuntimeBootstrapHelpers: (options?: Record<string, unknown>) => Record<string, unknown>;
};

const contentRuntimeBootstrapHelpersModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'ContentRuntimeBootstrapHelpers.ts'),
).href;
let runtimeBootstrapHelpersModule: RuntimeBootstrapHelpersModule | null = null;

function getRuntimeBootstrapHelpersModule(): RuntimeBootstrapHelpersModule {
  if (!runtimeBootstrapHelpersModule) {
    throw new Error('Runtime bootstrap helpers module was not initialized for test');
  }

  return runtimeBootstrapHelpersModule;
}

function createRuntimeControl(activeInstanceId: string): Record<string, unknown> {
  return {
    active: true,
    activeInstanceId,
  };
}

describe('content-runtime-bootstrap-helpers', () => {
  beforeEach(async () => {
    vi.resetModules();
    runtimeBootstrapHelpersModule = (await import(
      contentRuntimeBootstrapHelpersModuleUrl
    )) as RuntimeBootstrapHelpersModule;
  });

  afterEach(() => {
    runtimeBootstrapHelpersModule = null;
    vi.restoreAllMocks();
  });

  it('preserves foreign active owner when dom-lock runtime initialization fails', () => {
    const runtimeControl = createRuntimeControl('runtime-foreign');
    const consoleError = vi.fn();
    const setRuntimeControl = vi.fn((patch: Record<string, unknown>) => {
      Object.assign(runtimeControl, patch);
    });

    const helpers = getRuntimeBootstrapHelpersModule().createContentRuntimeBootstrapHelpers({
      runtimeControl,
      windowRef: {
        __CW_WATCHLIST_CURATOR_CONTROL__: runtimeControl,
      },
      consoleRef: {
        error: consoleError,
      },
      setRuntimeControl,
      runtimeInstanceId: 'runtime-local',
      createDomLockRuntimeFactory: () => {
        throw new Error('boom');
      },
    });

    expect(helpers.tryAcquireDomRuntimeLock).toBeTypeOf('function');
    expect(consoleError).toHaveBeenCalledWith('[CW] missing-content-runtime-bootstrap-dom-lock-module');
    expect(runtimeControl.active).toBe(true);
    expect(runtimeControl.activeInstanceId).toBe('runtime-foreign');
    expect(runtimeControl.lastShutdownPayload).toEqual({
      reason: 'missing-content-runtime-bootstrap-dom-lock-module',
    });
  });

  it('clears ownership only when current runtime owns the control', () => {
    const runtimeControl = createRuntimeControl('runtime-local');
    const setRuntimeControl = vi.fn((patch: Record<string, unknown>) => {
      Object.assign(runtimeControl, patch);
    });

    getRuntimeBootstrapHelpersModule().createContentRuntimeBootstrapHelpers({
      runtimeControl,
      windowRef: {
        __CW_WATCHLIST_CURATOR_CONTROL__: runtimeControl,
      },
      consoleRef: {
        error: vi.fn(),
      },
      setRuntimeControl,
      runtimeInstanceId: 'runtime-local',
      createDomLockRuntimeFactory: () => {
        throw new Error('boom');
      },
    });

    expect(runtimeControl.active).toBe(false);
    expect(runtimeControl.activeInstanceId).toBeNull();
    expect(runtimeControl.lastShutdownPayload).toEqual({
      reason: 'missing-content-runtime-bootstrap-dom-lock-module',
    });
  });
});
