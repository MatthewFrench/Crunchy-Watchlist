import {
  createContentRuntimeSetupDataInitializationPhases,
  type DataInitializationDependencyOptions,
  type DataInitializationRuntime,
  type RequireFunction,
} from './ContentRuntimeSetupDataInitializationPhases.js';

type DataInitializationRuntimeOptions = DataInitializationDependencyOptions & {
  requireFunction?: RequireFunction;
};

type RuntimeBoundaryValue = LooseRecord[string];

function requireFunction<T>(name: string, value: RuntimeBoundaryValue): T {
  if (typeof value !== 'function') {
    throw new Error(`[CW] Missing content runtime setup data initialization dependency: ${name}`);
  }
  return value as T;
}

function toRuntimeOptions(value: RuntimeBoundaryValue): DataInitializationRuntimeOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as DataInitializationRuntimeOptions;
}

function resolveDependencyOptions(options: DataInitializationRuntimeOptions): DataInitializationDependencyOptions {
  const dependencyOptions: DataInitializationDependencyOptions = {};

  if ('runtimeBootstrapFinalizeModule' in options) {
    dependencyOptions.runtimeBootstrapFinalizeModule = options.runtimeBootstrapFinalizeModule;
  }
  if ('runtimeBootstrapHelpersModule' in options) {
    dependencyOptions.runtimeBootstrapHelpersModule = options.runtimeBootstrapHelpersModule;
  }
  if (typeof options.createBootstrapFinalizeRuntimeModule === 'function') {
    dependencyOptions.createBootstrapFinalizeRuntimeModule = options.createBootstrapFinalizeRuntimeModule;
  }
  if (typeof options.createRuntimeBootstrapHelpersRuntime === 'function') {
    dependencyOptions.createRuntimeBootstrapHelpersRuntime = options.createRuntimeBootstrapHelpersRuntime;
  }

  return dependencyOptions;
}

export function createContentRuntimeSetupDataInitializationRuntime(
  options: RuntimeBoundaryValue = {},
): DataInitializationRuntime {
  const runtimeOptions = toRuntimeOptions(options);
  const requireFn = runtimeOptions.requireFunction ?? requireFunction;
  return createContentRuntimeSetupDataInitializationPhases(requireFn, resolveDependencyOptions(runtimeOptions));
}
