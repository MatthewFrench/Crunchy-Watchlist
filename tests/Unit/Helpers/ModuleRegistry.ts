import { vi } from 'vitest';

type RuntimeModuleRegistry = Record<string, unknown> & {
  domain?: Record<string, unknown>;
};

type RuntimeGlobal = typeof globalThis & {
  __CW_WATCHLIST_CURATOR_MODULES__?: RuntimeModuleRegistry;
};

function getRuntimeGlobal(): RuntimeGlobal {
  return globalThis as RuntimeGlobal;
}

export async function loadRuntimeModules(moduleUrls: string[]): Promise<RuntimeModuleRegistry> {
  vi.resetModules();

  const runtimeGlobal = getRuntimeGlobal();
  runtimeGlobal.__CW_WATCHLIST_CURATOR_MODULES__ = {};

  for (const moduleUrl of moduleUrls) {
    await import(moduleUrl);
  }

  return runtimeGlobal.__CW_WATCHLIST_CURATOR_MODULES__ ?? {};
}

export function clearRuntimeModulesRegistry(): void {
  delete getRuntimeGlobal().__CW_WATCHLIST_CURATOR_MODULES__;
}

export function getRuntimeModulesRegistry(): RuntimeModuleRegistry {
  const runtimeGlobal = getRuntimeGlobal();
  if (!runtimeGlobal.__CW_WATCHLIST_CURATOR_MODULES__) {
    runtimeGlobal.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  return runtimeGlobal.__CW_WATCHLIST_CURATOR_MODULES__;
}
