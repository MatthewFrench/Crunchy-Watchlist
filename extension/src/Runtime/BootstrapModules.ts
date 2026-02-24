;(() => {
  type BootstrapConfig = {
    defaultSortMode: string
    validSortModes: Set<string>
    sortModeControlOptions: unknown[]
    defaultSettings: Record<string, unknown>
  }

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
    defaultSettings: Record<string, unknown>
  }

  type BootstrapModulesOptions = {
    windowRef?: unknown
  }

  type RuntimeModuleReferences = {
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
  }

  type DataModuleReferences = {
    storageModule: unknown
    apiContractsModule: unknown
    authClientModule: unknown
    watchlistClientModule: unknown
    watchlistRepositoryModule: unknown
    historyRepositoryModule: unknown
    ratingsClientModule: unknown
    ratingsRepositoryModule: unknown
    previewRepositoryModule: unknown
  }

  type DomainUiModuleReferences = {
    corePrimitivesModule: unknown
    imageVariantsModule: unknown
    entryNormalizerModule: unknown
    sortMetricsModule: unknown
    entrySortingModule: unknown
    cardMetadataModule: unknown
    controlsViewModule: unknown
    cardViewModule: unknown
    cardShellModule: unknown
  }

  type WindowWithRegistry = Window &
    typeof globalThis & {
      __CW_WATCHLIST_CURATOR_MODULES__?: Record<string, unknown>
    }

  const root = (typeof window !== 'undefined' ? window : globalThis) as WindowWithRegistry
  if (!root.__CW_WATCHLIST_CURATOR_MODULES__ || typeof root.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
    root.__CW_WATCHLIST_CURATOR_MODULES__ = {}
  }
  const moduleRegistry = root.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>

  function resolveWindowRef(value: unknown): WindowWithRegistry {
    if (!value || typeof value !== 'object') {
      throw new Error('[CW] Missing bootstrap modules windowRef')
    }

    const record = value as Record<string, unknown>
    if (!record.__CW_WATCHLIST_CURATOR_MODULES__ || typeof record.__CW_WATCHLIST_CURATOR_MODULES__ !== 'object') {
      record.__CW_WATCHLIST_CURATOR_MODULES__ = {}
    }

    return value as WindowWithRegistry
  }

  function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {}
    }
    return value as Record<string, unknown>
  }

  function isBootstrapConfig(value: unknown): value is BootstrapConfig {
    if (!value || typeof value !== 'object') {
      return false
    }

    const record = value as Record<string, unknown>
    return (
      typeof record.defaultSortMode === 'string' &&
      record.validSortModes instanceof Set &&
      Array.isArray(record.sortModeControlOptions) &&
      Boolean(record.defaultSettings) &&
      typeof record.defaultSettings === 'object'
    )
  }

  function areModulesDefined(values: unknown[]): boolean {
    return values.every((value) => Boolean(value))
  }

  function resolveRuntimeModuleReferences(registry: Record<string, unknown>): RuntimeModuleReferences | null {
    const moduleReferences: RuntimeModuleReferences = {
      runtimeStoreModule: registry.runtimeStore,
      runtimeTraceModule: registry.runtimeTrace,
      runtimeStateLoaderModule: registry.runtimeStateLoader,
      runtimeLifecycleModule: registry.runtimeLifecycle,
      runtimePreferredAudioModule: registry.runtimePreferredAudio,
      runtimeRenderableModule: registry.runtimeRenderable,
      runtimeCuratedPanelModule: registry.runtimeCuratedPanel,
      runtimeCuratedLoaderModule: registry.runtimeCuratedLoader,
      runtimeNativeBridgeModule: registry.runtimeNativeBridge,
      runtimeCuratedInteractionsModule: registry.runtimeCuratedInteractions,
      runtimeInterfaceShellModule: registry.runtimeInterfaceShell,
      runtimeDebugModule: registry.runtimeDebug,
      runtimeBootstrapHelpersModule: registry.runtimeBootstrapHelpers,
    }

    return areModulesDefined(Object.values(moduleReferences)) ? moduleReferences : null
  }

  function resolveDataModuleReferences(registry: Record<string, unknown>): DataModuleReferences | null {
    const moduleReferences: DataModuleReferences = {
      storageModule: registry.storage,
      apiContractsModule: registry.apiContracts,
      authClientModule: registry.authClient,
      watchlistClientModule: registry.watchlistClient,
      watchlistRepositoryModule: registry.watchlistRepository,
      historyRepositoryModule: registry.historyRepository,
      ratingsClientModule: registry.ratingsClient,
      ratingsRepositoryModule: registry.ratingsRepository,
      previewRepositoryModule: registry.previewRepository,
    }

    return areModulesDefined(Object.values(moduleReferences)) ? moduleReferences : null
  }

  function resolveDomainUiModuleReferences(registry: Record<string, unknown>): DomainUiModuleReferences | null {
    const domainModule = toRecord(registry.domain)
    const uiModule = toRecord(registry.ui)
    const moduleReferences: DomainUiModuleReferences = {
      corePrimitivesModule: domainModule.corePrimitives,
      imageVariantsModule: domainModule.imageVariants,
      entryNormalizerModule: domainModule.entryNormalizer,
      sortMetricsModule: domainModule.sortMetrics,
      entrySortingModule: domainModule.entrySorting,
      cardMetadataModule: uiModule.cardMetadata,
      controlsViewModule: uiModule.controlsView,
      cardViewModule: uiModule.cardView,
      cardShellModule: uiModule.cardShell,
    }

    return areModulesDefined(Object.values(moduleReferences)) ? moduleReferences : null
  }

  function resolveBootstrapConfig(registry: Record<string, unknown>): BootstrapConfig | null {
    const bootstrapConfigFactory = (
      registry.runtimeBootstrapConfig as {
        createBootstrapConfig?: () => unknown
      }
    )?.createBootstrapConfig
    if (typeof bootstrapConfigFactory !== 'function') {
      return null
    }

    const bootstrapConfig = bootstrapConfigFactory()
    return isBootstrapConfig(bootstrapConfig) ? bootstrapConfig : null
  }

  function createBootstrapModules(options: BootstrapModulesOptions = {}): BootstrapModulesRuntime | null {
    const windowRef = resolveWindowRef(options.windowRef)
    const registry = windowRef.__CW_WATCHLIST_CURATOR_MODULES__ as Record<string, unknown>
    const runtimeModuleReferences = resolveRuntimeModuleReferences(registry)
    const dataModuleReferences = resolveDataModuleReferences(registry)
    const domainUiModuleReferences = resolveDomainUiModuleReferences(registry)
    const bootstrapConfig = resolveBootstrapConfig(registry)
    if (!runtimeModuleReferences || !dataModuleReferences || !domainUiModuleReferences || !bootstrapConfig) {
      return null
    }

    return {
      ...runtimeModuleReferences,
      ...dataModuleReferences,
      ...domainUiModuleReferences,
      defaultSortMode: bootstrapConfig.defaultSortMode,
      validSortModes: bootstrapConfig.validSortModes,
      sortModeControlOptions: bootstrapConfig.sortModeControlOptions,
      defaultSettings: bootstrapConfig.defaultSettings,
    }
  }

  moduleRegistry.runtimeBootstrapModules = {
    createBootstrapModules,
  }
})()
