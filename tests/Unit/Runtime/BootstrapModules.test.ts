import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BootstrapModulesRuntime = {
  runtimeStoreModule: unknown;
  runtimeTraceModule: unknown;
  runtimeLifecycleModule: unknown;
  runtimePreferredAudioModule: unknown;
  runtimeRenderableModule: unknown;
  runtimeCuratedPanelModule: unknown;
  runtimeCuratedLoaderModule: unknown;
  runtimeNativeBridgeModule: unknown;
  runtimeCuratedInteractionsModule: unknown;
  runtimeInterfaceShellModule: unknown;
  runtimeDebugModule: unknown;
  storageModule: unknown;
  apiContractsModule: unknown;
  authClientModule: unknown;
  watchlistClientModule: unknown;
  watchlistRepositoryModule: unknown;
  historyRepositoryModule: unknown;
  ratingsClientModule: unknown;
  ratingsRepositoryModule: unknown;
  previewRepositoryModule: unknown;
  corePrimitivesModule: unknown;
  imageVariantsModule: unknown;
  entryNormalizerModule: unknown;
  sortMetricsModule: unknown;
  entrySortingModule: unknown;
  cardMetadataModule: unknown;
  controlsViewModule: unknown;
  cardViewModule: unknown;
  cardShellModule: unknown;
  defaultSortMode: string;
  validSortModes: Set<string>;
  sortModeControlOptions: unknown[];
  runtimeConstants: Record<string, unknown>;
  defaultSettings: Record<string, unknown>;
};

type RuntimeBootstrapModulesModule = {
  assertRuntimeMethods: (ownerLabel: string, instance: unknown, methodNames: string[]) => void;
  createBootstrapModules: () => BootstrapModulesRuntime | null;
};

const bootstrapModulesModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapModules.ts'),
).href;

let runtimeBootstrapModulesModule: RuntimeBootstrapModulesModule | null = null;

function getBootstrapModulesModule(): RuntimeBootstrapModulesModule {
  if (!runtimeBootstrapModulesModule) {
    throw new Error('Bootstrap modules runtime module was not initialized for test');
  }

  return runtimeBootstrapModulesModule;
}

describe('bootstrap-modules runtime', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = (await import(bootstrapModulesModuleUrl)) as {
      createBootstrapModulesRuntime: () => object;
    };
    runtimeBootstrapModulesModule = module.createBootstrapModulesRuntime() as RuntimeBootstrapModulesModule;
  });

  afterEach(() => {
    runtimeBootstrapModulesModule = null;
    vi.restoreAllMocks();
  });

  it('resolves bootstrap modules from direct runtime factories', () => {
    const runtime = getBootstrapModulesModule().createBootstrapModules();
    expect(runtime).not.toBeNull();
  });

  it('throws when required runtime methods are missing', () => {
    const moduleRuntime = getBootstrapModulesModule();
    expect(() => moduleRuntime.assertRuntimeMethods('runtime store module', {}, ['createRuntimeState'])).toThrow(
      'Missing createRuntimeState runtime store module',
    );
  });

  it('returns resolved modules and validated bootstrap config', () => {
    const runtime = getBootstrapModulesModule().createBootstrapModules();

    expect(runtime).not.toBeNull();
    expect(runtime?.runtimeStoreModule).toMatchObject({
      createRuntimeState: expect.any(Function),
      createWatchlistCacheSnapshot: expect.any(Function),
      createEmptyWatchHistoryCache: expect.any(Function),
    });
    expect(runtime?.runtimeTraceModule).toMatchObject({
      createRuntimeTrace: expect.any(Function),
    });
    expect(runtime?.storageModule).toMatchObject({
      createStorageAdapter: expect.any(Function),
    });
    expect(runtime?.corePrimitivesModule).toMatchObject({
      createCorePrimitives: expect.any(Function),
    });
    expect(runtime?.cardShellModule).toMatchObject({
      createCardShell: expect.any(Function),
    });
    expect(typeof runtime?.defaultSortMode).toBe('string');
    expect(runtime?.validSortModes).toBeInstanceOf(Set);
    expect(runtime?.validSortModes.has(runtime?.defaultSortMode as string)).toBe(true);
    expect(Array.isArray(runtime?.sortModeControlOptions)).toBe(true);
    expect((runtime?.sortModeControlOptions as unknown[]).length).toBeGreaterThan(0);
    expect(runtime?.runtimeConstants).toMatchObject({ settingsKey: 'cw_settings_v1' });
    expect(runtime?.defaultSettings).toMatchObject({ activeTab: 'curated' });
  });
});
