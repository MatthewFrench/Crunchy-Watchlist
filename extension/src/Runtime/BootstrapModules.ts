import { createApiContractsRuntime } from '../Data/ApiContracts.js';
import { createAuthClientRuntime } from '../Data/AuthClient.js';
import { createHistoryRepositoryRuntime } from '../Data/HistoryRepository.js';
import { createPreviewRepositoryRuntime } from '../Data/PreviewRepository.js';
import { createRatingsClientRuntime } from '../Data/RatingsClient.js';
import { createRatingsRepositoryRuntime } from '../Data/RatingsRepository.js';
import { createStorageRuntime } from '../Data/StorageAdapter.js';
import { createWatchlistClientRuntime } from '../Data/WatchlistClient.js';
import { createWatchlistRepositoryRuntime } from '../Data/WatchlistRepository.js';
import { createCorePrimitivesRuntime } from '../Domain/CorePrimitives.js';
import { createEntryNormalizerRuntime } from '../Domain/EntryNormalizer.js';
import { createEntrySortingRuntime } from '../Domain/EntrySorting.js';
import { createImageVariantsRuntime } from '../Domain/ImageVariants.js';
import { createSortMetricsRuntime } from '../Domain/SortMetrics.js';
import { createCardMetadataRuntime } from '../Ui/CardMetadata.js';
import { createControlsViewRuntime } from '../Ui/ControlsView.js';
import { createCardShellRuntime } from '../Ui/CuratedCardShell.js';
import { createCardViewRuntime } from '../Ui/CuratedCardView.js';
import { createRuntimeBootstrapConfigRuntime } from './BootstrapConfig.js';
import { createRuntimeCuratedInteractionsRuntime } from './CuratedInteractions.js';
import { createRuntimeCuratedLoaderRuntime } from './CuratedLoader.js';
import { createRuntimeCuratedPanelRuntime } from './CuratedPanel.js';
import { createRuntimeRenderableRuntime } from './CuratedRenderable.js';
import { createRuntimeDebugRuntime } from './DebugApi.js';
import { createRuntimeInterfaceShellRuntime } from './InterfaceShell.js';
import { createNativeBridgeRuntime } from './NativeBridge.js';
import { createRuntimePreferredAudioRuntime } from './PreferredAudioDetector.js';
import { createRuntimeLifecycleRuntime } from './RouteLifecycle.js';
import { createRuntimeStoreRuntime } from './RuntimeStore.js';
import { createRuntimeTraceRuntime } from './RuntimeTrace.js';

type BoundaryValue = CwBoundaryValue;
type BoundaryArray = BoundaryValue[];
type BoundaryRecord = Record<string, BoundaryValue>;
type ModuleReference = BoundaryRecord;

type BootstrapConfig = {
  defaultSortMode: string;
  validSortModes: Set<string>;
  sortModeControlOptions: BoundaryArray;
  runtimeConstants: BoundaryRecord;
  defaultSettings: BoundaryRecord;
};

type BootstrapModulesRuntime = {
  runtimeStoreModule: ModuleReference;
  runtimeTraceModule: ModuleReference;
  runtimeLifecycleModule: ModuleReference;
  runtimePreferredAudioModule: ModuleReference;
  runtimeRenderableModule: ModuleReference;
  runtimeCuratedPanelModule: ModuleReference;
  runtimeCuratedLoaderModule: ModuleReference;
  runtimeNativeBridgeModule: ModuleReference;
  runtimeCuratedInteractionsModule: ModuleReference;
  runtimeInterfaceShellModule: ModuleReference;
  runtimeDebugModule: ModuleReference;
  storageModule: ModuleReference;
  apiContractsModule: ModuleReference;
  authClientModule: ModuleReference;
  watchlistClientModule: ModuleReference;
  watchlistRepositoryModule: ModuleReference;
  historyRepositoryModule: ModuleReference;
  ratingsClientModule: ModuleReference;
  ratingsRepositoryModule: ModuleReference;
  previewRepositoryModule: ModuleReference;
  corePrimitivesModule: ModuleReference;
  imageVariantsModule: ModuleReference;
  entryNormalizerModule: ModuleReference;
  sortMetricsModule: ModuleReference;
  entrySortingModule: ModuleReference;
  cardMetadataModule: ModuleReference;
  controlsViewModule: ModuleReference;
  cardViewModule: ModuleReference;
  cardShellModule: ModuleReference;
  defaultSortMode: string;
  validSortModes: Set<string>;
  sortModeControlOptions: BoundaryArray;
  runtimeConstants: BoundaryRecord;
  defaultSettings: BoundaryRecord;
};

type RuntimeModuleReferences = {
  runtimeStoreModule: ModuleReference;
  runtimeTraceModule: ModuleReference;
  runtimeLifecycleModule: ModuleReference;
  runtimePreferredAudioModule: ModuleReference;
  runtimeRenderableModule: ModuleReference;
  runtimeCuratedPanelModule: ModuleReference;
  runtimeCuratedLoaderModule: ModuleReference;
  runtimeNativeBridgeModule: ModuleReference;
  runtimeCuratedInteractionsModule: ModuleReference;
  runtimeInterfaceShellModule: ModuleReference;
  runtimeDebugModule: ModuleReference;
};

type DataModuleReferences = {
  storageModule: ModuleReference;
  apiContractsModule: ModuleReference;
  authClientModule: ModuleReference;
  watchlistClientModule: ModuleReference;
  watchlistRepositoryModule: ModuleReference;
  historyRepositoryModule: ModuleReference;
  ratingsClientModule: ModuleReference;
  ratingsRepositoryModule: ModuleReference;
  previewRepositoryModule: ModuleReference;
};

type DomainUiModuleReferences = {
  corePrimitivesModule: ModuleReference;
  imageVariantsModule: ModuleReference;
  entryNormalizerModule: ModuleReference;
  sortMetricsModule: ModuleReference;
  entrySortingModule: ModuleReference;
  cardMetadataModule: ModuleReference;
  controlsViewModule: ModuleReference;
  cardViewModule: ModuleReference;
  cardShellModule: ModuleReference;
};

function toRecord(value: BoundaryValue): ModuleReference {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as ModuleReference;
}

function isBootstrapConfig(value: BoundaryValue): value is BootstrapConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as BoundaryRecord;
  return (
    typeof record.defaultSortMode === 'string' &&
    record.validSortModes instanceof Set &&
    Array.isArray(record.sortModeControlOptions) &&
    Boolean(record.runtimeConstants) &&
    typeof record.runtimeConstants === 'object' &&
    Boolean(record.defaultSettings) &&
    typeof record.defaultSettings === 'object'
  );
}

function assertRuntimeMethods(ownerLabel: string, instance: BoundaryValue, methodNames: string[]): void {
  if (!instance || typeof instance !== 'object') {
    throw new Error(`[CW] Missing ${ownerLabel}`);
  }
  const record = instance as ModuleReference;
  for (const methodName of methodNames) {
    if (typeof record[methodName] !== 'function') {
      throw new Error(`[CW] Missing ${methodName} ${ownerLabel}`);
    }
  }
}

function areModulesDefined(values: BoundaryArray): boolean {
  return values.every((value) => Boolean(value));
}

function resolveRuntimeModuleReferences(): RuntimeModuleReferences | null {
  try {
    const moduleReferences: RuntimeModuleReferences = {
      runtimeStoreModule: toRecord(createRuntimeStoreRuntime()),
      runtimeTraceModule: toRecord(createRuntimeTraceRuntime()),
      runtimeLifecycleModule: toRecord(createRuntimeLifecycleRuntime()),
      runtimePreferredAudioModule: toRecord(createRuntimePreferredAudioRuntime()),
      runtimeRenderableModule: toRecord(createRuntimeRenderableRuntime()),
      runtimeCuratedPanelModule: toRecord(createRuntimeCuratedPanelRuntime()),
      runtimeCuratedLoaderModule: toRecord(createRuntimeCuratedLoaderRuntime()),
      runtimeNativeBridgeModule: {
        createNativeBridgeRuntime,
      },
      runtimeCuratedInteractionsModule: toRecord(createRuntimeCuratedInteractionsRuntime()),
      runtimeInterfaceShellModule: toRecord(createRuntimeInterfaceShellRuntime()),
      runtimeDebugModule: toRecord(createRuntimeDebugRuntime()),
    };

    return areModulesDefined(Object.values(moduleReferences)) ? moduleReferences : null;
  } catch {
    return null;
  }
}

function resolveDataModuleReferences(): DataModuleReferences | null {
  try {
    const moduleReferences: DataModuleReferences = {
      storageModule: toRecord(createStorageRuntime()),
      apiContractsModule: toRecord(createApiContractsRuntime()),
      authClientModule: toRecord(createAuthClientRuntime()),
      watchlistClientModule: toRecord(createWatchlistClientRuntime()),
      watchlistRepositoryModule: toRecord(createWatchlistRepositoryRuntime()),
      historyRepositoryModule: toRecord(createHistoryRepositoryRuntime()),
      ratingsClientModule: toRecord(createRatingsClientRuntime()),
      ratingsRepositoryModule: toRecord(createRatingsRepositoryRuntime()),
      previewRepositoryModule: toRecord(createPreviewRepositoryRuntime()),
    };

    return areModulesDefined(Object.values(moduleReferences)) ? moduleReferences : null;
  } catch {
    return null;
  }
}

function resolveDomainUiModuleReferences(): DomainUiModuleReferences | null {
  try {
    const moduleReferences: DomainUiModuleReferences = {
      corePrimitivesModule: toRecord(createCorePrimitivesRuntime()),
      imageVariantsModule: toRecord(createImageVariantsRuntime()),
      entryNormalizerModule: toRecord(createEntryNormalizerRuntime()),
      sortMetricsModule: toRecord(createSortMetricsRuntime()),
      entrySortingModule: toRecord(createEntrySortingRuntime()),
      cardMetadataModule: toRecord(createCardMetadataRuntime()),
      controlsViewModule: toRecord(createControlsViewRuntime()),
      cardViewModule: toRecord(createCardViewRuntime()),
      cardShellModule: toRecord(createCardShellRuntime()),
    };

    return areModulesDefined(Object.values(moduleReferences)) ? moduleReferences : null;
  } catch {
    return null;
  }
}

function resolveBootstrapConfig(): BootstrapConfig | null {
  const runtimeBootstrapConfigModule = toRecord(createRuntimeBootstrapConfigRuntime());
  const bootstrapConfigFactory = (
    runtimeBootstrapConfigModule as {
      createBootstrapConfig?: () => BoundaryValue;
    }
  ).createBootstrapConfig;
  if (typeof bootstrapConfigFactory !== 'function') {
    return null;
  }

  const bootstrapConfig = bootstrapConfigFactory();
  return isBootstrapConfig(bootstrapConfig) ? bootstrapConfig : null;
}

function createBootstrapModules(): BootstrapModulesRuntime | null {
  const runtimeModuleReferences = resolveRuntimeModuleReferences();
  const dataModuleReferences = resolveDataModuleReferences();
  const domainUiModuleReferences = resolveDomainUiModuleReferences();
  const bootstrapConfig = resolveBootstrapConfig();
  if (!runtimeModuleReferences || !dataModuleReferences || !domainUiModuleReferences || !bootstrapConfig) {
    return null;
  }

  return {
    ...runtimeModuleReferences,
    ...dataModuleReferences,
    ...domainUiModuleReferences,
    defaultSortMode: bootstrapConfig.defaultSortMode,
    validSortModes: bootstrapConfig.validSortModes,
    sortModeControlOptions: bootstrapConfig.sortModeControlOptions,
    runtimeConstants: bootstrapConfig.runtimeConstants,
    defaultSettings: bootstrapConfig.defaultSettings,
  };
}

const runtimeBootstrapModules = {
  createBootstrapModules,
  assertRuntimeMethods,
};

export function createBootstrapModulesRuntime(): object {
  return runtimeBootstrapModules;
}
