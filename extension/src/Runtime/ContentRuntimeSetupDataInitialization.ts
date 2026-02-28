import {
  createContentRuntimeSetupDataInitializationPhases,
  type DataInitializationRuntime,
  type LooseRecord,
  type RequireFunction,
} from './ContentRuntimeSetupDataInitializationPhases.js';

let createContentRuntimeSetupDataInitializationRuntimeFactory:
  | ((options?: LooseRecord) => DataInitializationRuntime)
  | null = null;

(() => {
  const root = (typeof window !== 'undefined' ? window : globalThis) as Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: LooseRecord;
    };
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {};
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as LooseRecord;

  function requireFunction<T>(name: string, value: unknown): T {
    if (typeof value !== 'function') {
      throw new Error(`[CW] Missing content runtime setup data initialization dependency: ${name}`);
    }
    return value as T;
  }

  /**
   * Splits setup-time data owner wiring out of `ContentRuntimeSetup` so bootstrap orchestration
   * remains focused on sequencing while this module owns all auth/API/storage/repository bindings.
   */
  function createContentRuntimeSetupDataInitializationRuntime(options: LooseRecord = {}): DataInitializationRuntime {
    const requireFn = (options.requireFunction as RequireFunction | undefined) ?? requireFunction;
    return createContentRuntimeSetupDataInitializationPhases(requireFn);
  }

  createContentRuntimeSetupDataInitializationRuntimeFactory = createContentRuntimeSetupDataInitializationRuntime;
  moduleRegistry.runtimeContentRuntimeSetupDataInitialization = {
    createContentRuntimeSetupDataInitializationRuntime,
  };
})();

export function createContentRuntimeSetupDataInitializationRuntime(
  options: LooseRecord = {},
): DataInitializationRuntime {
  if (typeof createContentRuntimeSetupDataInitializationRuntimeFactory !== 'function') {
    throw new Error('[CW] Content runtime setup data-initialization factory was not initialized.');
  }
  return createContentRuntimeSetupDataInitializationRuntimeFactory(options);
}
