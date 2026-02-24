import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { clearRuntimeModulesRegistry, loadRuntimeModules } from '../Helpers/ModuleRegistry'

type BootstrapModulesRuntime = {
  runtimeStoreModule: unknown
  runtimeTraceModule: unknown
  runtimeStateLoaderModule: unknown
  runtimeLifecycleModule: unknown
  runtimePreferredAudioModule: unknown
  runtimeRenderableModule: unknown
  runtimeCuratedPanelModule: unknown
  runtimeCuratedLoaderModule: unknown
  runtimeNativeBridgeModule: unknown
  runtimeCuratedInteractionsModule: unknown
  runtimeInterfaceShellModule: unknown
  runtimeDebugModule: unknown
  runtimeBootstrapHelpersModule: unknown
  storageModule: unknown
  apiContractsModule: unknown
  authClientModule: unknown
  watchlistClientModule: unknown
  watchlistRepositoryModule: unknown
  historyRepositoryModule: unknown
  ratingsClientModule: unknown
  ratingsRepositoryModule: unknown
  previewRepositoryModule: unknown
  corePrimitivesModule: unknown
  imageVariantsModule: unknown
  entryNormalizerModule: unknown
  sortMetricsModule: unknown
  entrySortingModule: unknown
  cardMetadataModule: unknown
  controlsViewModule: unknown
  cardViewModule: unknown
  cardShellModule: unknown
  defaultSortMode: string
  validSortModes: Set<string>
  sortModeControlOptions: unknown[]
  runtimeConstants: Record<string, unknown>
  defaultSettings: Record<string, unknown>
}

type BootstrapModulesModule = {
  runtimeBootstrapModules: {
    createBootstrapModules: (options: Record<string, unknown>) => BootstrapModulesRuntime | null
  }
}

const bootstrapModulesModuleUrl = pathToFileURL(
  path.join(process.cwd(), 'extension', 'src', 'Runtime', 'BootstrapModules.ts'),
).href

function getBootstrapModulesModule() {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as BootstrapModulesModule
  return registry.runtimeBootstrapModules
}

function seedRequiredModules(overrides: Record<string, unknown> = {}) {
  const registry = (globalThis as Record<string, unknown>).__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  registry.runtimeStore = { id: 'runtimeStore' }
  registry.runtimeTrace = { id: 'runtimeTrace' }
  registry.runtimeStateLoader = { id: 'runtimeStateLoader' }
  registry.runtimeLifecycle = { id: 'runtimeLifecycle' }
  registry.runtimePreferredAudio = { id: 'runtimePreferredAudio' }
  registry.runtimeRenderable = { id: 'runtimeRenderable' }
  registry.runtimeCuratedPanel = { id: 'runtimeCuratedPanel' }
  registry.runtimeCuratedLoader = { id: 'runtimeCuratedLoader' }
  registry.runtimeNativeBridge = { id: 'runtimeNativeBridge' }
  registry.runtimeCuratedInteractions = { id: 'runtimeCuratedInteractions' }
  registry.runtimeInterfaceShell = { id: 'runtimeInterfaceShell' }
  registry.runtimeDebug = { id: 'runtimeDebug' }
  registry.runtimeBootstrapHelpers = { id: 'runtimeBootstrapHelpers' }
  registry.storage = { id: 'storage' }
  registry.apiContracts = { id: 'apiContracts' }
  registry.authClient = { id: 'authClient' }
  registry.watchlistClient = { id: 'watchlistClient' }
  registry.watchlistRepository = { id: 'watchlistRepository' }
  registry.historyRepository = { id: 'historyRepository' }
  registry.ratingsClient = { id: 'ratingsClient' }
  registry.ratingsRepository = { id: 'ratingsRepository' }
  registry.previewRepository = { id: 'previewRepository' }
  registry.domain = {
    corePrimitives: { id: 'corePrimitives' },
    imageVariants: { id: 'imageVariants' },
    entryNormalizer: { id: 'entryNormalizer' },
    sortMetrics: { id: 'sortMetrics' },
    entrySorting: { id: 'entrySorting' },
  }
  registry.ui = {
    cardMetadata: { id: 'cardMetadata' },
    controlsView: { id: 'controlsView' },
    cardView: { id: 'cardView' },
    cardShell: { id: 'cardShell' },
  }
  registry.runtimeBootstrapConfig = {
    createBootstrapConfig: () => ({
      defaultSortMode: 'rating_desc',
      validSortModes: new Set(['none', 'rating_desc']),
      sortModeControlOptions: [{ value: 'rating_desc', label: 'Rating' }],
      runtimeConstants: {
        settingsKey: 'cw_settings_v1',
      },
      defaultSettings: {
        activeTab: 'curated',
      },
    }),
  }

  Object.assign(registry, overrides)
}

describe('bootstrap-modules runtime', () => {
  beforeEach(async () => {
    await loadRuntimeModules([bootstrapModulesModuleUrl])
  })

  afterEach(() => {
    clearRuntimeModulesRegistry()
  })

  it('returns null when required modules are missing', () => {
    const runtime = getBootstrapModulesModule().createBootstrapModules({
      windowRef: globalThis,
    })
    expect(runtime).toBeNull()
  })

  it('returns null when bootstrap config payload is invalid', () => {
    seedRequiredModules({
      runtimeBootstrapConfig: {
        createBootstrapConfig: () => ({
          defaultSortMode: 42,
          validSortModes: [],
          sortModeControlOptions: null,
          defaultSettings: null,
        }),
      },
    })

    const runtime = getBootstrapModulesModule().createBootstrapModules({
      windowRef: globalThis,
    })
    expect(runtime).toBeNull()
  })

  it('returns resolved modules and validated bootstrap config', () => {
    seedRequiredModules()

    const runtime = getBootstrapModulesModule().createBootstrapModules({
      windowRef: globalThis,
    })

    expect(runtime).not.toBeNull()
    expect(runtime?.runtimeStoreModule).toEqual({ id: 'runtimeStore' })
    expect(runtime?.runtimeTraceModule).toEqual({ id: 'runtimeTrace' })
    expect(runtime?.runtimeBootstrapHelpersModule).toEqual({ id: 'runtimeBootstrapHelpers' })
    expect(runtime?.defaultSortMode).toBe('rating_desc')
    expect(runtime?.validSortModes).toBeInstanceOf(Set)
    expect(runtime?.sortModeControlOptions).toEqual([{ value: 'rating_desc', label: 'Rating' }])
    expect(runtime?.runtimeConstants).toEqual({ settingsKey: 'cw_settings_v1' })
    expect(runtime?.defaultSettings).toEqual({ activeTab: 'curated' })
  })
})
