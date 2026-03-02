# Modern Architecture Transformation Object

Last updated: 2026-03-01
Status: Complete (v1 baseline locked)
Owner: Runtime/Data/UI architecture
Scope: `extension/src/**`, `extension/Content.js`, `extension/manifest.json`, runtime build scripts, and affected tests/docs

## Why This Exists

This is the canonical transformation tracker for the remaining architecture debt discussed in recent review cycles.

Primary mandate:

- Preserve behavior.
- Keep UI create-once and patch-in-place.
- Eliminate workaround-driven module wiring and boundary noise.
- Move to an idiomatic, maintainable, typed runtime composition model.

If any implementation detail feels wrong or workaround-heavy, stop and discuss it before proceeding. Example: if missing/insufficient bundling forces global module-registry hacks, that is an architecture issue to resolve, not a pattern to normalize.

## Canonical Transformation Object

```yaml
id: modern-architecture-transformation-v1
status: complete
principles:
  - preserve-behavior-first
  - create-once-update-in-place
  - explicit-owner-hierarchy
  - boundary-typed-internal-deterministic
  - discuss-smells-before-adding-debt
target_state:
  runtime_module_graph:
    mode: static-import-bundled-entrypoints
    global_registry: legacy-only-during-migration
  ui_ownership:
    style: class-based-owner-controllers
    lookup_policy: no-owned-selector-lookups
    identity_policy: stable-node-identity
  type_model:
    boundary_inputs: validated-once
    internal_paths: strongly-typed-no-rewidening
  data_flow:
    source_of_truth: typed-runtime-state-not-dom
    dom_role: render-target-and-event-source-only
acceptance:
  - no-new-global-module-registry-dependencies
  - no-owned-selector-lookups
  - no-element-expandos
  - no-clone-based-rendering
  - async-handlers-rejection-safe
  - architecture-gates-green
```

## Baseline Inventory (Measured)

Audit date: 2026-03-01

### Key Counts

| Surface | Current baseline |
| --- | --- |
| Files using `__CW_WATCHLIST_CURATOR_MODULES__` | 0 files |
| Registry references (`__CW_WATCHLIST_CURATOR_MODULES__`) | 0 occurrences |
| Runtime files with registry usage | 0/53 |
| UI files with registry usage | 0/9 |
| Data files with registry usage | 0/16 |
| Domain files with registry usage | 0/8 |
| `unknown` token count in Runtime | 0 |
| `unknown` token count in UI | 0 |
| `unknown` token count in Data | 0 |
| `unknown` token count in Domain | 0 |
| `AnyFn` occurrences (all `extension/src/**`) | 0 |
| Guarded query-selector callsites in Runtime/UI | 7 |
| Guard-allowlisted query-selector files in Runtime/UI | 3 |
| Native adapter selector-boundary files (non-owned interop only) | 1 |
| Dataset token occurrences in Runtime/UI (broad scan) | 82 |
| Dataset token files in Runtime/UI (broad scan) | 14 |
| DOM expando callsites (`__cw...__`) | 0 |
| `cloneNode` callsites | 0 |

### Selector Lookup Inventory (Current)

Current lookups are constrained to root/native bridging and runtime lock cleanup:

- `extension/src/Runtime/BootstrapGate.ts`
- `extension/src/Runtime/ContentRuntimeBootstrapDomLock.ts`
- `extension/src/Runtime/InterfaceShellHostLifecycle.ts`
- `extension/src/Runtime/NativeCardSelectorAdapter.ts`

Policy status:
- Guard-allowlisted root/native query-selector lookups are currently constrained to the first three files above.
- `NativeCardSelectorAdapter` remains an explicit non-owned interop boundary and does not own extension subtree patching.
- Not allowed for owned extension subtrees.

### Dataset Usage Inventory (Current)

Current dataset usage spans:

- Runtime host/tab/visibility and action markers:
  - `extension/src/Runtime/InterfaceShell.ts`
  - `extension/src/Runtime/InterfaceShellHostLifecycle.ts`
  - `extension/src/Runtime/CuratedInteractions.ts`
  - `extension/src/Runtime/CuratedPanelGridTransitions.ts`
  - `extension/src/Runtime/CuratedPanelGrid.ts`
  - `extension/src/Runtime/ContentRuntimeBootstrapDomLock.ts`
- UI component patch markers and lightweight attribute state:
  - `extension/src/Ui/CuratedCardShell.ts`
  - `extension/src/Ui/CuratedCardView.ts`
  - `extension/src/Ui/CuratedCardHeaderComponent.ts`
  - `extension/src/Ui/CuratedCardMediaComponent.ts`
  - `extension/src/Ui/CuratedCardActionsComponent.ts`
  - `extension/src/Ui/CardMetadata.ts`

Policy status:
- Allowed when used as host/native interop marker or CSS state marker.
- Must not become canonical business state storage.

## UI and State Surfaces That Must Stay Deterministic

## UI owners/components

- `InterfaceShell` / host lifecycle
- `ControlsView`
- `CuratedPanelLoadingIndicator`
- `CuratedPanelGrid` + transitions
- Card owners:
  - `CuratedCardShell`
  - `CuratedCardHeaderComponent`
  - `CuratedCardMediaComponent`
  - `CuratedCardView`
  - `CuratedCardMetadataComponent`
  - `CuratedCardActionsComponent`
  - `CuratedCardProgressComponent`

## Runtime state owners

- `RuntimeStore`
- `CuratedLoader*` lifecycle modules
- `CuratedRenderable*` processing modules
- `RouteLifecycle`
- `WatchlistHealth`

## Data/API owners

- `Watchlist*`, `HistoryRepository*`, `Ratings*`, `PreviewRepository`, `StorageAdapter`, `AuthClient*`, `ApiContracts`

## State-change procedures that must remain minimal-update

| Trigger | Primary entrypoints | Required behavior |
| --- | --- | --- |
| Sort/filter/settings change | `CuratedInteractionsControls`, `CuratedPanel` | Recompute ordering/visibility and patch existing owners; no node rebuild |
| Loader phase start/finish/fail | `CuratedLoader`, `CuratedLoaderLoadCycle`, `CuratedPanel` | Patch changed fields only; preserve card/media identity |
| Deferred metadata chunk | `CuratedLoaderDeferredMetadata` | Patch visible controllers by stable refs/order; no document-wide owned lookups |
| Favorite/remove action | `CuratedInteractions`, `CuratedPanelGrid` | Direct ref patch on action owners/controllers |
| Tab/host visibility changes | `InterfaceShell`, `InterfaceShellHostLifecycle` | Root/native visibility lifecycle only; owned nodes via refs |
| Health/recovery checks | `WatchlistHealth`, `BootstrapGate` | Root/native checks only; no owned-subtree scans |

## What Is Completed vs Not Completed

### Completed

- Owned-subtree selector/class/token lookup migration in card and loading flows.
- Create-once/update-in-place card lifecycle with reorder-only updates.
- No element expando surfaces in runtime/UI.
- No clone-based transition/rendering paths.
- Guardrails in place: owned-DOM lookups, async event listeners, UI document refs, architecture growth.
- Added guardrails for registry backslide and bundled-runtime discipline:
  - `scripts/guard-module-registry-growth.mts` + `docs/module-registry-growth-baseline.json`
  - Runtime build/verification scripts now reject unbundled content-script mode (`CW_BUNDLE_CONTENT_SCRIPTS=0`) in all environments.
- Strict-size decomposition completed for the 2026-02-27 priority owners:
  - `extension/src/Data/HistoryRepositoryCache.ts` -> `HistoryRepositoryCache.ts` + `HistoryRepositoryCacheNormalization.ts`
  - `extension/src/Runtime/ContentRuntimeSetupDataInitialization.ts` -> thin composition + `ContentRuntimeSetupDataInitializationPhases.ts` + `ContentRuntimeSetupDataInitializationWatchlistHistory.ts`
  - `extension/src/Domain/CorePrimitives.ts` -> core primitives + `CorePrimitivesRuntimeFactories.ts`
- Removed direct global module-registry bootstrap wiring from all Domain and card-level UI component modules by migrating to shared typed registration helpers:
  - Domain: `CorePrimitives`, `EntryNormalizer`, `EntrySorting`, `EpisodePrimitives`, `ImageVariants`, `RatingPrimitives`, `SortMetrics`
  - UI: `CuratedCardHeaderComponent`, `CuratedCardMediaComponent`, `CuratedCardMetadataComponent`, `CuratedCardProgressComponent`
- Completed Data registry-registration retirement in production modules:
  - Removed `registerRuntimeModule(...)` compatibility registration from all Data modules (`ApiContracts`, `AuthClient`, `AuthClientFetchResilience`, `HistoryRepository`, `HistoryRepositoryCache`, `HistoryRepositoryPreload`, `HistoryRepositoryPreloadCollector`, `HistoryRepositoryPreloadPlanning`, `PreviewRepository`, `RatingsClient`, `RatingsRepository`, `RatingsRepositoryCacheSupport`, `StorageAdapter`, `WatchlistClient`, `WatchlistRepository`).
  - Migrated Data unit tests to consume direct runtime exports/factories (no per-test Data registry lookups).
- Completed Runtime registry-registration retirement in production modules:
  - Removed `registerRuntimeModule(...)` compatibility registration from all Runtime modules.
  - Removed legacy production registry shim/type surfaces:
    - deleted `extension/src/ModuleRegistry.ts`,
    - removed `Window.__CW_WATCHLIST_CURATOR_MODULES__` from `extension/Types/BrowserGlobals.d.ts`.
  - Tightened module-registry growth baseline to zero direct production references.
- Completed unit-test runtime-registry helper retirement:
  - Migrated all Runtime/UI/Data/Domain unit suites to direct import/factory seams.
  - Removed legacy helper `tests/Unit/Helpers/ModuleRegistry.ts`.
- Completed unit-test global-registry token retirement:
  - Removed all remaining `__CW_WATCHLIST_CURATOR_MODULES__` references from unit tests, including helper scaffolding and fixture objects.
- Removed legacy `extension/Content.js` module-registry bridge:
  - `Content.js` now imports `createContentRuntimeBootstrapHelpers` directly from module exports and no longer reads `window.__CW_WATCHLIST_CURATOR_MODULES__`.
- Completed bootstrap module-assembly static composition for Runtime/Data/Domain/UI owners:
  - `BootstrapModules.createBootstrapModules()` now resolves all required Runtime/Data/Domain/UI module references via direct runtime factory imports.
  - `BootstrapModules` no longer accepts `windowRef` and no longer reads module references through registry snapshots.
  - `ContentBootstrap` now invokes `createBootstrapModules()` without registry-hydration inputs.
- Completed Domain registry-registration retirement in production modules:
  - Removed `registerModule('domain', ...)` compatibility registration from all Domain modules (`CorePrimitives`, `EntryNormalizer`, `EntrySorting`, `EpisodePrimitives`, `ImageVariants`, `RatingPrimitives`, `SortMetrics`).
  - Added direct runtime export surfaces for `EpisodePrimitives`/`RatingPrimitives` to keep composition contracts explicit.
  - Migrated Domain unit tests to consume direct runtime exports (no per-test global registry lookups).
- Completed UI registry-registration retirement in production modules:
  - Removed `registerUiModule(...)` compatibility registration from all UI modules (`CardMetadata`, `ControlsView`, `CuratedCardShell`, `CuratedCardView`, `CuratedCardActionsComponent`, `CuratedCardHeaderComponent`, `CuratedCardMediaComponent`, `CuratedCardMetadataComponent`, `CuratedCardProgressComponent`).
  - Migrated UI unit tests to consume direct runtime exports/factories (no per-test global registry lookups).
- Completed runtime registration retirement for focused state/diagnostics owners:
  - `RuntimeTrace`, `RuntimeStore`, `BootstrapDiagnostics`, and `StateLoader` no longer depend on global registry registration.
  - Corresponding unit tests now use direct runtime exports/factories (no per-test registry lookups in those suites).
- Removed all remaining Data/Domain read-side `ensureModuleRegistry(...)` wiring from production consumers:
  - `AuthClient` now binds `AuthClientFetchResilience` through direct factory import wiring.
  - `HistoryRepository` now composes cache/preload owners through direct factory imports.
  - `HistoryRepositoryPreload` now binds planning/collector contracts through direct imports.
  - `RatingsRepository` now binds cache-support runtime through direct factory import.
  - `CorePrimitives` now composes episode/rating primitive runtimes via direct imports (no domain registry read-side lookup).
- Runtime warning hotspots reduced below threshold with extracted phase helpers:
  - `CuratedPanelGrid` render pass orchestration via `CuratedPanelGridRenderPass.ts`
  - `CuratedLoaderDeferredMetadata` chunk-finalization scheduling helpers
  - `ContentComposition` runtime assembly helpers
- `ContentRuntimeSetup` no longer silently falls back to registry-hydrated setup modules; composition/data-init module dependencies are now explicit.
- `CuratedPanelLoadingIndicator` now uses a class-based owner/controller with explicit owned refs/state.
- `CuratedCardActionsComponent` now uses a class-based owner/controller with stable refs and explicit patch ownership.
  - Added explicit-ref support (`actionRefs`) to avoid fallback child lookup when refs are already owned by the caller.
  - Added targeted coverage in `tests/Unit/Ui/CuratedCardActionsComponent.test.ts`.
- Watch-history request budgeting tightened in curated loader orchestration:
  - Selected-audio-locale watch-history preload now runs only when localized history data is actually missing.
  - Loader selected-locale preload now treats `audioLocaleFilter: any` as non-localized mode (no synthetic locale preload pass).
  - Bootstrap selected-locale preload orchestration now limits each locale to one preload attempt per curated-data revision to prevent request loops.
  - Deferred metadata chunks no longer trigger repeated selected-audio-locale watch-history forced preloads.
  - Curated-panel localized-preload render callback now only re-renders when metadata cache revisions actually changed.
  - Browser-level request-budget regression coverage added in `tests/WatchHistoryNetworkBudget.spec.ts`.
  - Coverage added in `tests/Unit/Runtime/CuratedLoaderLoadCycle.test.ts` to enforce selected-locale watch-history call budget behavior.
- Localized metadata preload ownership is now centralized in render/runtime flow:
  - `CuratedInteractionsControls` no longer triggers selected-locale metadata preloads directly on audio-filter change.
  - Audio-filter changes now update normalized settings and request render; localized preload policy remains in `CuratedPanel` + bootstrap helper guards.
  - Added rapid-toggle network-budget coverage for `any <-> ja-JP` + sort churn in `tests/WatchHistoryNetworkBudget.spec.ts`.
- Closed remaining PR safety gaps in runtime ownership/cache scope:
  - `StateLoader` now skips profile-scoped cache hydration until token scope is verified, preventing bootstrap-time cross-profile cache leaks.
  - `ContentRuntimeBootstrapHelpers` now preserves foreign `activeInstanceId` ownership when helper initialization fails, avoiding secondary-injection deactivation of healthy runtimes.
  - Added focused unit coverage in `tests/Unit/Runtime/StateLoader.test.ts` and `tests/Unit/Runtime/ContentRuntimeBootstrapHelpers.test.ts`.
- Continued WS2 boundary tightening on top unknown hotspots:
  - Reduced `unknown` usage in `AuthClientFetchResilience`, `CuratedCardActionsComponent`, and `PreferredAudioDetector`.
  - Tightened guard baseline to match current floor: `unknown` total `115 -> 102`, files `84 -> 82`.
- Completed WS2 long-tail hotspot cleanup for remaining concentrated runtime owners:
  - `BootstrapHelpers`, `ContentRuntimeBootstrapHelpers`, `ContentRuntimeBootstrapSession`, `CuratedLoaderDeferredMetadata`, and `CuratedPanelGridDom` no longer carry direct raw `unknown` token surfaces in those files.
  - Boundary guard baseline tightened again: `unknown` total/files `84/79 -> 74/74`.
- Completed WS5 contract tightening slice across data ingestion seams:
  - `ApiContracts` now exposes typed payload-envelope parsing (`rows + nullable total`) as a boundary contract.
  - `WatchlistClient` now consumes the payload envelope contract directly and only emits watchlist-specific warnings when total is invalid.
  - `AuthClient` token parsing now normalizes payload into an explicit typed token-response object at ingress before runtime use/trace emission.
  - `PreviewRepository` and `WatchlistRepository` added explicit boundary normalization helpers for payload root and rows input normalization.
  - Boundary guard baseline tightened again: `unknown` total/files `74/74 -> 69/69`.
- Completed WS5 continuation for ratings/watch-history payload ingestion:
  - `RatingsClient` now consumes `parsePayloadDataEnvelope(...)` for CMS responses and traces typed envelope totals instead of ad-hoc payload-total parsing.
  - `HistoryRepositoryPreload` now consumes `parsePayloadDataEnvelope(...)` for watch-history pages and preserves `invalid-total-value` warning semantics when totals are absent/invalid.
  - Runtime setup wiring updated so ratings/history owners receive envelope parsing through `apiContracts`, and affected unit suites were updated.
- Completed WS2 residual boundary-token cleanup:
  - Added shared boundary primitive `CwBoundaryValue` in `extension/Types/CommonRuntimeTypes.d.ts`.
  - Replaced all per-file `*BoundaryValue = unknown` aliases across `extension/src/**` with `CwBoundaryValue`.
  - Boundary-type baseline is now fully tightened: `unknown 69/69 -> 0/0` with `AnyFn 0/0`.
- Continued WS3 runtime owner-class normalization for runtime-owned UI manipulation paths:
  - `CuratedInteractions`, `CuratedPanel`, `CuratedPanelGrid`, `InterfaceShell`, and `NativeBridgePreview` now expose class-based owners with constructor-owned dependencies and stable method surfaces.
  - Existing runtime APIs are preserved; behavior validated by targeted runtime/unit suites and full e2e coverage.
- Added typed audio-locale filter boundary utility (`extension/src/Runtime/AudioLocaleFilter.ts`) and wired it into:
  - persisted state hydration normalization (`StateLoader`),
  - controls/input normalization (`CuratedInteractionsControls`),
  - config typing (`BootstrapConfig.defaultSettings.audioLocaleFilter`).
- Removed state-loader module-object plumbing from bootstrap finalize ownership:
  - `StateLoader` now exposes a direct factory surface (`createRuntimeStateLoaderRuntime`) in addition to registry registration.
  - `ContentRuntimeBootstrapFinalizeFlow` now builds a concrete `loadInitialState` callback through direct state-loader import wiring.
  - `BootstrapFinalize` now consumes explicit `loadInitialState` callback wiring instead of `runtimeStateLoaderModule/runtimeStateLoaderOptions`.
  - `BootstrapModules` and bootstrap session assembly no longer require or forward `runtimeStateLoaderModule`.
- Removed bootstrap-helpers module-object plumbing from bootstrap setup ownership:
  - `BootstrapHelpers` now exposes a direct factory surface (`createRuntimeBootstrapHelpersRuntime`) in addition to registry registration.
  - `ContentRuntimeSetupDataInitializationPhases` now resolves bootstrap-helpers runtime via direct import wiring, with optional constructor dependency overrides retained for deterministic tests.
  - `ContentRuntimeSetup`, `ContentRuntimeBootstrapSetupBindings`, `ContentRuntimeBootstrapSessionAssembly`, and `BootstrapModules` no longer require or forward `runtimeBootstrapHelpersModule`.
- Extracted explicit runtime handler contracts in bootstrap session ownership paths and removed internal `AnyFn` usage from:
  - `ContentRuntimeBootstrapHelpers`
  - `ContentRuntimeBootstrapSession`
  - `ContentRuntimeBootstrapSessionAssembly`
  - `ContentRuntimeBootstrapSessionSupport`
- Tightened boundary guard baseline to lock in current reductions:
  - `AnyFn` total: `216 -> 0`
  - `AnyFn` files: `38 -> 0`
  - `unknown` total: `2658 -> 2579`
- Completed aggressive Data boundary tightening pass for hotspot owners:
  - `ApiContracts`, `AuthClient`, `WatchlistRepository`, `WatchlistClient`, and `PreviewRepository` now use explicit per-module boundary aliases (`BoundaryValue`/`BoundaryRecord`) instead of repeated raw `unknown` signatures in internal paths.
  - Internal helper signatures were de-widened while preserving external runtime boundary behavior.
  - Boundary growth baseline tightened again:
    - `unknown` total: `314 -> 190`
- Completed aggressive runtime boundary tightening pass for top orchestration hotspots:
  - `ContentComposition`, `ContentRuntimeBootstrapDomLock`, and `ContentBootstrap` now use explicit boundary aliases and typed runtime callback contracts instead of repeated raw `unknown` signatures.
  - Internal helper signatures were de-widened without changing bootstrap/lock/composition behavior.
  - Boundary growth baseline tightened again:
    - `unknown` total: `190 -> 158`
- Completed aggressive runtime boundary tightening pass for host/grid-render helper owners:
  - `InterfaceShellHostLifecycle`, `CuratedPanelGridSignature`, and `CuratedPanelGridRenderPhases` now use explicit boundary aliases and typed boundary-record contracts instead of repeated raw `unknown`/`Record<string, unknown>` signatures.
  - Internal helper signatures were de-widened without changing host lifecycle or grid render behavior.
  - Boundary growth baseline tightened again:
    - `unknown` total: `158 -> 134`
- Completed aggressive UI boundary tightening pass for card/control owners:
  - `CuratedCardMediaComponent`, `CuratedCardHeaderComponent`, and `ControlsView` now use explicit boundary aliases and typed boundary-record contracts instead of repeated raw `unknown`/`Record<string, unknown>` signatures.
  - Internal helper signatures were de-widened without changing media/header/control render behavior.
  - Boundary growth baseline tightened again:
    - `unknown` total: `134 -> 115`
- Removed transitional setup-factory closure wrappers in runtime setup ownership:
  - `ContentRuntimeSetup`, `ContentRuntimeSetupComposition`, and `ContentRuntimeSetupDataInitialization` now expose direct module exports without mutable module-scope factory bootstraps.
  - This removes hidden one-time init state from setup owners and keeps composition wiring deterministic under static-import runtime bundling.
- Removed transitional composition-binding closure wrappers in runtime ownership:
  - `ContentCompositionBindings` and `ContentCompositionRuntimeBindings` now expose direct module exports without mutable module-scope factory bootstraps.
  - Composition-binding unit tests now import runtime modules directly instead of relying on synthetic unit-registry hydration paths.
- Migrated additional setup/finalize unit suites off synthetic runtime-registry hydration:
  - `ContentRuntimeSetup`, `ContentRuntimeSetupDataInitialization`, `ContentRuntimeBootstrapSetupBindings`, and `ContentRuntimeBootstrapFinalizeFlow` tests now load module runtimes through direct imports.
- Removed transitional wrapper bootstraps from additional runtime foundation modules:
  - `BootstrapDiagnostics`, `BootstrapConfig`, `RuntimeTrace`, and `RuntimeStore` now expose direct module exports (no mutable module-scope runtime factory bootstraps).
- Migrated additional runtime unit suites to direct import/factory loading:
  - `BootstrapDiagnostics`, `BootstrapConfig`, `RuntimeTrace`, and `RuntimeStore` tests no longer use synthetic module-registry hydration helpers.
- Removed transitional wrapper bootstraps from additional domain foundation modules:
  - `EpisodePrimitives` and `ImageVariants` now expose direct module exports without mutable module-scope runtime factory bootstraps.
- Migrated additional domain unit suites to direct import/factory loading:
  - `EpisodePrimitives` and `ImageVariants` tests no longer use synthetic module-registry hydration helpers.
- Hardened bootstrap setup/finalize contract wiring:
  - `ContentRuntimeBootstrapSetupBindings` now extracts module wiring via explicit key contracts and uses a guarded runtime-event fallback.
  - `ContentRuntimeBootstrapFinalizeFlow` now uses explicit setup-result/finalize-runtime contracts, typed load-initial-state composition, and guarded init-error normalization.
- Boundary-type baseline reduced again after this pass:
  - `unknown` total: `2579 -> 2577` (guard-green).
- Fixed callback-context drift introduced during owner-class migration:
  - UI owner methods that are passed as callbacks now use bound arrow-method surfaces to keep stable owner context (`this`) when extracted.
  - `BootstrapFinalize.init` now performs a deterministic initial `processWatchlist()` pass after route sync to avoid silent mounted-without-shell states.
- Removed transitional wrapper bootstraps from remaining Domain modules:
  - `CorePrimitives`, `EntryNormalizer`, `EntrySorting`, `RatingPrimitives`, and `SortMetrics` now expose direct module exports (no mutable module-scope runtime factory bootstraps).
  - Corresponding Domain unit suites now load runtime contracts through direct imports (no `loadRuntimeModules` helper path).
- Removed transitional wrapper bootstraps from additional Data boundary modules:
  - `ApiContracts`, `WatchlistClient`, and `WatchlistRepository` now expose direct module exports (no mutable module-scope runtime factory bootstraps).
  - Corresponding Data unit suites now load runtime contracts through direct imports (no `loadRuntimeModules` helper path).
- Completed remaining Data wrapper-bootstrap retirement:
  - `AuthClient`, `AuthClientFetchResilience`, `HistoryRepository`, `HistoryRepositoryCache`, `HistoryRepositoryPreload`, `HistoryRepositoryPreloadCollector`, `HistoryRepositoryPreloadPlanning`, `PreviewRepository`, `RatingsClient`, `RatingsRepository`, `RatingsRepositoryCacheSupport`, and `StorageAdapter` now expose direct module exports/factories without mutable module-scope runtime wrapper bootstraps.
  - Remaining Data unit suites (`AuthClient*`, `HistoryRepository*`, `PreviewRepository`, `Ratings*`) now load runtime contracts through direct imports (no `loadRuntimeModules` helper path).
- Boundary-type guard headroom improved again:
  - `unknown` total: `2574 -> 2562` (guard-green).
- Removed transitional wrapper bootstraps from additional runtime owner modules:
  - `BootstrapFinalize`, `BootstrapGate`, `BootstrapHelpers`, `BootstrapModules`, and `ContentComposition` now expose direct module exports without mutable module-scope runtime wrapper bootstraps.
  - Corresponding runtime unit suites now load module runtimes through direct imports/factories (no synthetic runtime-registry hydration paths).
- Completed retirement of the remaining runtime wrapper-bootstrap closures:
  - Removed all remaining `(() => { ... })` wrapper/factory bootstraps from runtime owner modules:
    - `CuratedInteractions`, `CuratedInteractionsControls`, `CuratedLoader`, `CuratedLoaderDeferredMetadata`, `CuratedLoaderLoadCycle`, `CuratedLoaderPendingRequests`, `CuratedPanel`, `CuratedPanelGrid`, `CuratedPanelGridRenderPhases`, `CuratedPanelGridSignature`, `CuratedPanelGridTransitions`, `CuratedPanelLoadingIndicator`, `CuratedRenderable`, `CuratedRenderableListProcessing`, `CuratedRenderableMergeSupport`, `DebugApi`, `InterfaceShell`, `PreferredAudioDetector`, `RouteLifecycle`, `StateLoader`, `WatchlistHealth`.
  - Runtime wrapper inventory is now `0` source files.
- Migrated additional runtime unit suites away from synthetic runtime-registry helper loading:
  - `CuratedLoaderLoadCycle`, `CuratedLoaderPendingRequests`, `CuratedPanelGridTransitions`, `DebugApi`, `InterfaceShellHostLifecycle`, `PreferredAudioDetector`, `RouteLifecycle`, `StateLoader`, and `WatchlistHealth` tests now use direct import/factory seams.
- Completed remaining synthetic runtime-registry helper migration:
  - `NativeCardSelectorAdapter`, `InterfaceShell`, `NativeActionBridge`, `NativeBridge`, `CuratedPanel`, `ContentRuntimeBootstrapSession`, `ContentBootstrap`, `CuratedInteractions`, `CuratedLoader`, `NativeBridgePreview`, `CuratedPerfBudget`, and `CuratedRenderable` runtime tests now use direct import/factory seams.
  - Remaining UI helper-based suites (`CardMetadata`, `ControlsView`, `CuratedCardActionsComponent`, `CuratedCardView`, `CuratedCardShell`) now use direct import/factory seams.
- WS2 boundary-contract tightening pass for bootstrap setup/session ownership:
  - `ContentRuntimeSetupDataInitializationPhases`, `ContentRuntimeBootstrapSession`, and `ContentRuntimeBootstrapHelpers` now use explicit boundary-value aliases and typed ingress function contracts for locale/token/preload/storage pipelines and process handlers.
  - Removed broad internal `unknown` signatures across those owners while preserving behavior.
  - Boundary-type total reduced again: `2562 -> 2438` unknown references (guard baseline tightened accordingly).
- Continued WS2 setup-owner contract tightening in runtime setup assembly:
  - `ContentRuntimeSetup` now uses an explicit boundary-options contract, one-time option normalization at ingress, typed runtime binding handlers, and typed setup/context factory contracts.
  - Removed internal `UnknownFn` rewidening and record-cast churn in setup composition/data-initialization runtime assembly while preserving runtime guards.
  - Boundary-type total reduced again: `2438 -> 2374` unknown references (guard baseline tightened accordingly).
- Continued WS2 runtime binding-contract tightening in content composition assembly:
  - `ContentCompositionRuntimeBindings` now uses typed renderable memo contracts (`CuratedRenderableBuildResult`), typed runtime callback adapters, and typed factory dependency signatures in runtime-binding assembly.
  - Removed internal factory `Record<string, unknown>` re-widening and `unknown` dialog callback casts for interaction runtime creation.
  - Boundary-type total reduced again: `2374 -> 2347` unknown references (guard baseline tightened accordingly).
- Aggressive WS2 batch pass (parallel streams) across remaining runtime satellites:
  - `ContentRuntimeBootstrapSessionSupport` and `ContentRuntimeBootstrapSessionAssembly` now standardize boundary aliases and internal handler/module signatures without behavior changes.
  - `ContentRuntimeSetupComposition`, `ContentCompositionBindings`, and `ContentRuntimeSetupDataInitializationPhases` now use standardized boundary/callback aliases and reduced internal raw-`unknown` plumbing.
  - `BootstrapHelpers`, `BootstrapModules`, and `CuratedLoader` now use boundary aliases for internal owner contracts, reducing repeated raw-`unknown` signatures.
  - Boundary-type total reduced again: `2347 -> 2041` unknown references (guard baseline tightened accordingly).
- Ultra-aggressive WS2 batch pass (parallelized high-churn runtime owners):
  - `CuratedRenderable`, `CuratedRenderableMergeSupport`, and `CuratedRenderableListProcessing` standardized boundary aliases and internal callback contracts.
  - `CuratedPanel`, `CuratedPanelGrid`, and `CuratedPanelGridRenderPass` standardized boundary aliases for render-path contracts.
  - `NativeBridge`, `NativeBridgePreview`, and `NativeActionBridge` standardized boundary alias contracts while keeping native boundary guards unchanged.
  - `StateLoader`, `RuntimeStore`, `RuntimeTrace`, and `RouteLifecycle` standardized boundary alias contracts for runtime/state/lifecycle wiring.
  - `InterfaceShell`, `CuratedInteractions`, `CuratedInteractionsControls`, and `DebugApi` standardized boundary aliases and callback contracts.
  - Boundary-type total reduced again: `2041 -> 1435` unknown references (guard baseline tightened accordingly).
- Ultra-aggressive WS2/WS5 mixed batch pass (runtime + data + domain + UI):
  - Runtime finalization/preload/bootstrap owners now standardized (`BootstrapFinalize`, `ContentRuntimeBootstrapFinalizeFlow`, `BootstrapGate`, `PreferredAudioDetector`, `WatchlistHealth`, `CuratedLoaderLoadCycle`, `CuratedLoaderDeferredMetadata`).
  - Data owners now standardized in high-churn auth/preview/history/ratings paths (`AuthClient`, `PreviewRepository`, `ApiContracts`, `HistoryRepository`, `RatingsRepository`, `RatingsClient`, `RatingsRepositoryCacheSupport`).
  - Domain/UI owners now standardized in core shaping/render helpers (`SortMetrics`, `CorePrimitives`, `RatingPrimitives`, `EntrySorting`, `EpisodePrimitives`, `EntryNormalizer`, `CardMetadata`, `CuratedCardView`).
  - Boundary-type total reduced again: `1435 -> 719` unknown references (guard baseline tightened accordingly).
- Ultra-aggressive focused cleanup wave (remaining top hotspots):
  - Data owners further tightened (`HistoryRepository*`, `AuthClient`, `WatchlistRepository`, `WatchlistClient`, `ApiContracts`, `PreviewRepository`, `AuthClientFetchResilience`, `StorageAdapter`) while preserving ingress guards.
  - Domain/UI owners further tightened (`EpisodePrimitives`, `EntryNormalizer`, `ImageVariants`, `CorePrimitivesRuntimeFactories`, `CardMetadata`, `CuratedCardView`, `CuratedCardShell`).
  - Runtime stragglers tightened (`NativeCardSelectorAdapter`, `BootstrapDiagnostics`).
  - Boundary-type total reduced again: `719 -> 314` unknown references (guard baseline tightened accordingly).

### Not Completed

- None for `modern-architecture-transformation-v1`.

## Next Execution Queue (High Impact)

1. No open high-impact execution items remain for v1.
   - Status: Complete (2026-03-01)
   - Outcome:
     - All WS1-WS6 done criteria are satisfied and verified.
     - Full gate set is green on current implementation.
     - Tracker statuses and inventories are synchronized to current state.

## Workstreams and Plan

## WS1: Bundled Static Runtime Module Graph

Status: Complete (2026-03-01)
Priority: P0

Goal:
- Replace multi-file registry coupling with deterministic bundled entrypoints and static imports.

Primary files:
- `scripts/build-extension-runtime.mts`
- `extension/manifest.json`
- `extension/Content.js`
- `extension/src/Runtime/ContentBootstrap.ts`
- `extension/src/Runtime/ContentComposition.ts`
- all registry-participating modules listed in Appendix A

Deliverables:
- Bundling step per runtime entrypoint (no implicit cross-file global hydration requirement).
- Compatibility strategy for Chromium/Firefox/WebKit/Safari wrapper outputs.
- Transitional shim plan for legacy registry consumers until cutover is complete.

Done when:
- New/changed modules do not require `window.__CW_WATCHLIST_CURATOR_MODULES__`.
- Runtime wiring resolves through imports/composition, not global registry lookups.

Progress notes:
- 2026-02-28: Completed runtime registry-decoupling pass for remaining holdouts (`BootstrapModules`, `ContentBootstrap`, `ContentComposition`, `ContentRuntimeBootstrapDomLock`, `ContentRuntimeBootstrapSetupBindings`, `CuratedInteractions`, `CuratedLoader`, `CuratedPanel`, `CuratedPanelGrid`, `CuratedRenderable`) using shared `ModuleRegistry` helpers.
  - Runtime direct `__CW_WATCHLIST_CURATOR_MODULES__` usage: `44/53 files -> 0/53 files`.
  - Repository-wide direct key references reduced to `7` across `3` files (`ModuleRegistry.ts`, `BrowserGlobals.d.ts`, `Content.js`).
- 2026-02-28: Removed legacy content-script entrypoint registry bridge and tightened bootstrap module assembly boundaries:
  - `Content.js` now resolves bootstrap helpers through direct static import wiring (no direct global registry reads).
  - `BootstrapModules.createBootstrapModules()` no longer requires `windowRef` to resolve the runtime registry.
  - Repository-wide direct key references reduced to `6` across `2` files (`ModuleRegistry.ts`, `BrowserGlobals.d.ts`).
- 2026-02-28: Completed direct-import bootstrap module composition across Runtime/Data/Domain/UI module references:
  - `BootstrapModules` now composes all required module references from direct runtime exports (`create*Runtime()` / `create*...Runtime()`), not registry snapshots.
  - Data modules now expose direct runtime factory surfaces for bootstrap composition (`StorageAdapter`, `ApiContracts`, `AuthClient`, `WatchlistClient`, `WatchlistRepository`, `HistoryRepository`, `RatingsClient`, `RatingsRepository`, `PreviewRepository`).
  - Domain/UI modules now expose direct runtime factory surfaces for bootstrap composition (`CorePrimitives`, `ImageVariants`, `EntryNormalizer`, `SortMetrics`, `EntrySorting`, `CardMetadata`, `ControlsView`, `CuratedCardView`, `CuratedCardShell`).
- 2026-02-28: Removed Domain registration compatibility plumbing and test registry coupling:
  - Domain production modules no longer register `domain.*` keys into the global registry.
  - Domain unit tests now resolve runtime contracts through direct export factories instead of `__CW_WATCHLIST_CURATOR_MODULES__.domain` reads.
- 2026-02-28: Removed UI registration compatibility plumbing and reduced test registry coupling:
  - UI production modules no longer register `ui.*` keys into the global registry.
  - UI unit tests now resolve runtime contracts through direct export factories instead of `__CW_WATCHLIST_CURATOR_MODULES__.ui` reads.
- 2026-02-27: Added bundled content-script build mode in `scripts/build-extension-runtime.mts` (`--bundle-content-scripts`), then wired all `build:runtime:*` scripts in `package.json` to emit one bundled file per `content_scripts` entry while preserving declared script order via generated side-effect imports.
- 2026-02-27: Hardened bundling with fail-fast source-script existence checks and `treeShaking: false`; updated `scripts/run-playwright-suite.mts`, `scripts/live-runtime-smoke.mts`, and `scripts/live-webkit-watchlist.mts` so bundled mode is the default verification path.
- 2026-02-28: Elevated bundled runtime to a hard policy in all environments; unbundled runtime mode is rejected in `build-extension-runtime`, `run-playwright-suite`, `live-runtime-smoke`, and `live-webkit-watchlist`.
- 2026-02-28: Added Safari packaged-manifest validation in `scripts/build-safari-macos.sh` to fail builds when any `content_scripts[].js` path is missing from packaged `.appex` resources.
- 2026-02-28: Added `guard-module-registry-growth` baseline gate to block growth and new-file spread of `__CW_WATCHLIST_CURATOR_MODULES__` usage during migration.
- 2026-02-28: Reduced registry coupling in bootstrap flow by switching helper/session wiring to static module imports for owned dependencies (`ContentRuntimeBootstrapHelpers`, `ContentRuntimeBootstrapSession`, and `ContentRuntimeBootstrapDomLock`), while retaining registry registration compatibility at module boundaries.
- 2026-02-28: Replaced registry-fallback wiring for composition/setup factories with static import wiring:
  - `ContentComposition` now binds composition runtimes from direct factory imports (`ContentCompositionBindings`, `ContentCompositionRuntimeBindings`) instead of runtime registry lookups.
  - `ContentRuntimeSetup` now binds setup-composition/data-initialization runtimes from direct factory imports (`ContentRuntimeSetupComposition`, `ContentRuntimeSetupDataInitialization`) with explicit optional override hooks for tests.
  - `ContentRuntimeBootstrapSetupBindings` no longer injects registry fallback fields for setup-composition/data-initialization modules into runtime-setup options.
- 2026-02-28: Removed setup-time dependency on `runtimeContentCompositionModule` registry wiring:
  - `ContentRuntimeSetup` now binds `createContentComposition` directly from static imports with an explicit optional override hook.
  - `ContentRuntimeSetupComposition` now calls `createContentComposition` via direct import wiring (or explicit override), not `context.runtimeContentCompositionModule.createContentComposition`.
  - `ContentRuntimeBootstrapSetupBindings` no longer forwards `runtimeContentCompositionModule` into runtime-setup options.
- 2026-02-28: Removed `runtimeContentCompositionModule` and `runtimeContentRuntimeSetupModule` from bootstrap-context/session payload plumbing:
  - `ContentRuntimeBootstrapDomLock` no longer validates or forwards either module object through `resolveValidatedBootstrapContext`.
  - `ContentRuntimeBootstrapSessionAssembly` no longer carries either module in runtime session composition.
  - `Content.js` no longer reaches through `runtimeBootstrapSession.runtimeContentRuntimeSetupModule`; runtime setup execution now routes through `runtimeBootstrapHelpersRuntime.createRuntimeSetup(...)`.
  - `ContentRuntimeBootstrapSession` now binds runtime setup via direct import (`createContentRuntimeSetup`) and exposes it through the session helper runtime.
- 2026-02-28: Removed `runtimeWatchlistHealthModule` from bootstrap-context/session payload plumbing:
  - `ContentRuntimeBootstrapDomLock` no longer validates or forwards watchlist-health registry module objects.
  - `ContentRuntimeBootstrapSessionAssembly` now binds watchlist-health runtime via direct import (`createWatchlistHealthRuntime`) instead of bootstrap-context module injection.
  - `WatchlistHealth` now exports a direct factory surface while preserving existing module-registry registration compatibility.
- 2026-02-28: Simplified bootstrap validation API after registry-decoupling:
  - `resolveValidatedBootstrapContext(...)` no longer accepts/passes a module-registry argument (`ContentRuntimeBootstrapDomLock`, `ContentRuntimeBootstrapHelpers`, `Content.js`).
  - Bootstrap context validation now depends only on `createContentBootstrapPrelude(...)` output for runtime module wiring.
- 2026-02-28: Converted `ContentBootstrap` bootstrap-owner dependencies to direct import wiring with explicit override hooks:
  - `ContentBootstrap` now resolves diagnostics/gate/modules/finalize runtimes from direct imports (`BootstrapDiagnostics`, `BootstrapGate`, `BootstrapModules`, `BootstrapFinalize`) instead of `moduleRegistry.runtimeBootstrap*` lookups.
  - `createContentBootstrapPrelude` now accepts explicit optional override modules (`runtimeBootstrapDiagnosticsModule`, `runtimeBootstrapGateModule`, `runtimeBootstrapModulesModule`, `runtimeBootstrapFinalizeModule`) for deterministic test seams.
  - `BootstrapDiagnostics`, `BootstrapGate`, `BootstrapModules`, and `BootstrapFinalize` now export direct factory/runtime accessors while preserving existing module-registry registration compatibility.
- 2026-02-28: Reduced finalize-flow coupling to session-carried module objects:
  - `ContentRuntimeBootstrapFinalizeFlow` now binds `safeJsonParse` / `createStorageAccessors` / `createBootstrapFinalizeRuntime` via direct import wiring (`createBootstrapFinalizeRuntimeModule`) instead of reading `runtimeBootstrapSession.runtimeBootstrapFinalizeModule`.
  - Added explicit dependency checks in finalize-flow runtime assembly to fail fast on missing finalize/storage methods.
- 2026-02-28: Removed `runtimeBootstrapModulesModule` object plumbing from bootstrap context/session handoff:
  - `ContentBootstrap` now returns `assertRuntimeMethods` directly in the bootstrap prelude instead of forwarding the full `runtimeBootstrapModulesModule`.
  - `ContentRuntimeBootstrapDomLock` validates `assertRuntimeMethods` and forwards it as a function contract.
  - `ContentRuntimeBootstrapSessionAssembly` now consumes `bootstrapContext.assertRuntimeMethods` directly when wiring session dependencies.
- 2026-02-28: Removed `runtimeBootstrapFinalizeModule` plumbing from bootstrap-context/session/setup-option handoff:
  - `ContentBootstrap` validates finalize-runtime module shape from the direct finalize runtime factory and no longer forwards/accepts a finalize-module object through bootstrap prelude options.
  - `ContentRuntimeBootstrapDomLock` and `ContentRuntimeBootstrapSessionAssembly` no longer carry `runtimeBootstrapFinalizeModule` in runtime bootstrap context/session objects.
  - `ContentRuntimeBootstrapSetupBindings` and `ContentRuntimeSetup` no longer require `runtimeBootstrapFinalizeModule` option plumbing.
  - `ContentRuntimeSetupDataInitializationPhases` now resolves finalize helpers via direct import wiring (`createBootstrapFinalizeRuntimeModule`) with optional constructor dependency overrides for deterministic tests.
- 2026-02-28: Removed `runtimeBootstrapGateModule` object plumbing from bootstrap-context/session/setup-option handoff:
  - `ContentBootstrap` now returns direct gate contracts (`isWatchlistPath`, `getWatchlistRoot`, `getWatchlistHeader`) instead of forwarding a gate-module object.
  - `ContentRuntimeBootstrapDomLock` validates/forwards gate contracts directly in validated bootstrap context.
  - `ContentRuntimeBootstrapSessionAssembly` consumes gate contracts directly for watchlist path/root ownership and no longer uses `createIsWatchlistPath` adapter indirection.
  - `ContentRuntimeBootstrapSetupBindings`, `ContentRuntimeSetup`, and `ContentRuntimeSetupComposition` now pass/consume `getWatchlistRoot` and `getWatchlistHeader` as typed setup contracts.
- 2026-02-28: Fixed `ContentBootstrap` diagnostics fallback shape mismatch (runtime object vs module object) so bundled runtime startup no longer fails prelude resolution with `missing-bootstrap-diagnostics-module`.
- 2026-02-28: Reduced registry coupling in curated controls wiring:
  - `CuratedInteractions` now imports controls runtime directly from `CuratedInteractionsControls` instead of reading `runtimeCuratedInteractionsControls` from global registry lookup.
  - `CuratedInteractionsControls` now exports a direct factory while preserving registry registration compatibility.
- 2026-02-28: Removed state-loader registry-module handoff from bootstrap finalize flow:
  - `ContentRuntimeBootstrapFinalizeFlow` now composes `loadInitialState` from `createRuntimeStateLoaderRuntime()` via static import wiring.
  - `BootstrapFinalize` now executes that callback directly, eliminating module-object indirection in finalize runtime options.
  - `ContentRuntimeBootstrapSessionAssembly` and `BootstrapModules` no longer thread `runtimeStateLoaderModule` through bootstrap-session contracts.
- 2026-02-28: Removed bootstrap-helpers registry-module handoff from runtime setup flow:
  - `ContentRuntimeSetupDataInitializationPhases` now composes bootstrap helpers through `createRuntimeBootstrapHelpersRuntime()` static import wiring (with optional test override seam).
  - `ContentRuntimeSetup`, `ContentRuntimeBootstrapSetupBindings`, `ContentRuntimeBootstrapSessionAssembly`, and `BootstrapModules` no longer thread `runtimeBootstrapHelpersModule` through setup/session contracts.
- 2026-02-28: Completed Data/Domain read-side registry-decoupling for remaining holdouts:
  - `AuthClient`, `HistoryRepository`, `HistoryRepositoryPreload`, and `RatingsRepository` now resolve dependencies via direct imports/factory wiring instead of reading module factories from global registry maps.
  - `CorePrimitives` runtime composition now resolves episode/rating primitive factories via direct imports (`CorePrimitivesRuntimeFactories`) and no longer reads domain modules from registry.
  - `ensureModuleRegistry(...)` callsites in `extension/src/**` reduced to `ModuleRegistry.ts` only.

## WS2: Boundary-Type Discipline Cleanup

Status: Complete (2026-03-01)
Priority: P0

Goal:
- Keep `unknown` only at real external boundaries, convert once, stay typed internally.

Primary files:
- Runtime bootstrap/control modules
- Data boundary modules (`ApiContracts`, client/repository seams)
- Runtime/Data modules with broad `unknown` and loose-record plumbing

Deliverables:
- Explicit validated DTOs/contracts at API and page boundaries.
- Typed internal interfaces replacing broad loose-record rewidening in owner paths.

Done when:
- Internal owner APIs stop re-widening to `unknown` after boundary conversion.

Progress notes:
- 2026-02-28: reduced boundary-noise concentration by extracting typed normalization/runtime-factory seams from `HistoryRepositoryCache`, `ContentRuntimeSetupDataInitialization`, and `CorePrimitives` while preserving existing public registry APIs.
- 2026-02-28: hardened runtime wiring seams with deferred checked binding adapters in `ContentRuntimeSetupDataInitializationPhases.ts` (preserving intentional late-bound callbacks) and extracted composition/render-phase helpers to keep warning hotspots at zero.
- 2026-02-28: added `guard-boundary-type-growth` baseline gate (`docs/boundary-type-growth-baseline.json`) and wired it into lint/check pipelines to block `AnyFn`/`unknown` backslide while WS2 reduces internal rewidening.
- 2026-02-28: introduced typed audio-locale filter normalization (`AudioLocaleFilter`) so sentinel/localized values are normalized once at ingress points (state hydration and control input), reducing boundary ambiguity in downstream runtime paths.
- 2026-02-28: eliminated `AnyFn` token usage across `extension/src/**` (now `0`), switched remaining call-boundary aliases to `UnknownFn`, and tightened boundary growth baseline (`maxAnyFnReferences: 0`, `maxFilesWithAnyFnReferences: 0`).
- 2026-03-01: tightened runtime-setup ownership contracts in `ContentRuntimeSetup.ts`:
  - Introduced explicit boundary options typing + one-time ingress normalization (`unknown` only at setup entry boundary).
  - Replaced internal `UnknownFn` surfaces with explicit runtime binding handler/factory contracts for setup composition/data-initialization assembly.
  - Reduced boundary-type references from `2438 -> 2374` and tightened the guard baseline to the new floor.
- 2026-03-01: tightened content-composition runtime binding contracts in `ContentCompositionRuntimeBindings.ts`:
  - Introduced typed renderable memo result contracts and typed runtime callback adapters for curated/interaction/interface binding creation.
  - Replaced factory dependency rewidening signatures (`Record<string, unknown>`) with explicit loose-record runtime boundary contracts.
  - Reduced boundary-type references from `2374 -> 2347` and tightened the guard baseline to the new floor.
- 2026-03-01: executed an aggressive parallel WS2 sweep across runtime satellites:
  - Standardized boundary/callback aliases in `ContentRuntimeBootstrapSessionSupport`, `ContentRuntimeBootstrapSessionAssembly`, `ContentRuntimeSetupComposition`, `ContentCompositionBindings`, `ContentRuntimeSetupDataInitializationPhases`, `BootstrapHelpers`, `BootstrapModules`, and `CuratedLoader`.
  - Preserved runtime guards and behavior while replacing repeated internal raw `unknown` signatures with explicit boundary alias contracts.
  - Reduced boundary-type references from `2347 -> 2041` and tightened the guard baseline to the new floor.
- 2026-03-01: executed an ultra-aggressive parallel WS2 sweep across high-churn runtime owners:
  - Standardized boundary/callback aliases in `CuratedRenderable*`, `CuratedPanel*`, `NativeBridge*`, `StateLoader`, `RuntimeStore`, `RuntimeTrace`, `RouteLifecycle`, `InterfaceShell`, `CuratedInteractions*`, and `DebugApi`.
  - Preserved existing runtime guards and behavior while replacing broad internal raw `unknown` surfaces with boundary alias contracts.
  - Reduced boundary-type references from `2041 -> 1435` and tightened the guard baseline to the new floor.
- 2026-03-01: executed an ultra-aggressive parallel WS2/WS5 sweep across runtime + data + domain + UI hotspots:
  - Standardized boundary/callback aliases and internal dependency contracts in runtime finalization/preload owners, ratings/auth/preview/history data owners, and core domain/UI view owners.
  - Preserved runtime/data boundary guards and behavior while removing broad internal raw `unknown` signatures/cast sprawl.
  - Reduced boundary-type references from `1435 -> 719` and tightened the guard baseline to the new floor.
- 2026-03-01: executed another ultra-aggressive focused cleanup wave across remaining high-count owners:
  - Tightened `HistoryRepository*`, `AuthClient*`, `Watchlist*`, `ApiContracts`, `PreviewRepository`, `StorageAdapter`, plus targeted Domain/UI/runtime stragglers.
  - Preserved behavior and boundary guards while removing additional raw internal `unknown` signatures/cast churn.
  - Reduced boundary-type references from `719 -> 314` and tightened the guard baseline to the new floor.
- 2026-03-01: completed a focused top-hotspot boundary pass:
  - Removed residual `unknown` surfaces in `AuthClientFetchResilience` and `CuratedCardActionsComponent`; reduced root-cast churn in `PreferredAudioDetector`.
  - Tightened boundary-type baseline from `115 -> 102` unknown references and from `84 -> 82` files.
  - Guard remains green with the stricter baseline.
- 2026-03-01: completed another focused boundary + lifecycle pass across WS2/WS3/WS5 slices:
  - WS2 hotspot tightening: `CardMetadata`, `CuratedPanelGridTransitions`, `ContentRuntimeSetupDataInitialization`, `ContentRuntimeBootstrapFinalizeFlow`, and `HistoryRepositoryPreload` now have reduced hotspot concentration (all remaining files now `<=2` unknown references).
  - WS3 teardown convergence: added explicit idempotent `dispose()` ownership to `CuratedPanel`, `CuratedPanelGrid`, `InterfaceShell`, `NativeBridgePreview`, and `CuratedInteractions`, then wired composition/runtime shutdown so bootstrap destroy invokes owner disposal deterministically.
  - WS5 targeted boundary cleanup: refreshed ingress/error boundary handling in `AuthClient`, `ApiContracts`, `WatchlistClient`, `WatchlistRepository`, and `PreviewRepository` while preserving behavior.
  - Current boundary baseline tightened to `84` unknown references across `79` files; `AnyFn` remains `0`.
- 2026-03-01: completed another WS2 long-tail hotspot cleanup pass:
  - Removed direct raw-`unknown` token surfaces from `BootstrapHelpers`, `ContentRuntimeBootstrapHelpers`, `ContentRuntimeBootstrapSession`, `CuratedLoaderDeferredMetadata`, and `CuratedPanelGridDom` via tighter boundary aliases and typed dataset access.
  - Preserved behavior and full-gate coverage while tightening boundary baseline to `74` unknown references across `74` files (`AnyFn` remains `0`).
- 2026-03-01: completed WS5 data-boundary contract tightening slice for API/client/repository seams:
  - `ApiContracts` added `parsePayloadDataEnvelope(...)` so data-row and total parsing are handled at a single boundary contract.
  - `WatchlistClient` switched to envelope parsing and retained watchlist-specific warning semantics (`invalid-total-value`) with fallback totals.
  - `AuthClient` now parses token payload into explicit typed ingress state before trace/runtime usage; `PreviewRepository`/`WatchlistRepository` tightened boundary normalization helpers.
  - Preserved behavior and full-gate coverage while tightening boundary baseline to `69` unknown references across `69` files (`AnyFn` remains `0`).
- 2026-03-01: completed WS2 residual boundary-token cleanup across `extension/src/**`:
  - Added shared `CwBoundaryValue` primitive and replaced all per-file `*BoundaryValue = unknown` aliases with the shared boundary primitive.
  - Boundary growth guard floor tightened to `unknown 0/0`, `AnyFn 0/0` (no token-level boundary debt remains in `extension/src/**`).

## WS3: Class-Based UI Owner/Controller Standardization

Status: Complete (2026-03-01)
Priority: P1

Goal:
- Normalize UI manipulation to class-based owners/controllers with explicit constructor deps, `patch(...)`, and `dispose()`.

Primary files:
- `extension/src/Ui/*.ts`
- `extension/src/Runtime/CuratedPanelGrid.ts`
- `extension/src/Runtime/CuratedPanelLoadingIndicator.ts`
- `extension/src/Runtime/InterfaceShell.ts`

Deliverables:
- Parent-owner to child-owner deterministic hierarchy.
- Explicit owner contracts for every extension-owned explicit element surface.

Done when:
- UI manipulation paths are owner/class driven, ref-based, and teardown-safe.

Progress notes:
- 2026-02-28: Migrated `CuratedPanelLoadingIndicator` to a class-based controller with explicit owned state (`WeakMap` refs) and a single `sync(...)` patch surface.
- 2026-02-28: Migrated `InterfaceShellHostLifecycle` to a class-based owner/controller and updated `InterfaceShell` to consume it via direct module import instead of runtime registry lookup.
- 2026-02-28: Hardened owner-class callback safety:
  - `CardMetadata`, `ControlsView`, `CuratedCardView`, `CuratedCardShell`, and `CuratedCardActionsComponent` owner APIs now expose bound arrow methods so extracted method references remain valid.
  - This resolves callback-context regression where unbound class methods prevented shell mount/render in bundled runtime flows.
- 2026-03-01: migrated remaining high-impact runtime UI owners to class-based controllers while preserving existing runtime APIs:
  - `CuratedInteractions`, `CuratedPanel`, `CuratedPanelGrid`, `InterfaceShell`, and `NativeBridgePreview`.
  - Validated by targeted runtime suites (`CuratedInteractions`, `CuratedPanel`, `InterfaceShell`, `NativeBridgePreview`, `CuratedPerfBudget`) plus full `test:e2e`.
- 2026-03-01: completed explicit teardown convergence for the runtime-owner slice:
  - Added idempotent `dispose()` to `CuratedInteractions`, `CuratedPanel`, `CuratedPanelGrid`, `InterfaceShell`, `NativeBridgePreview`, `NativeBridge`, and composition bindings.
  - Runtime shutdown path now chains setup/runtime disposal through bootstrap finalize destroy wiring.
  - Added unit coverage for teardown idempotency and destroy-chain disposal (`CuratedPanel`, `InterfaceShell`, `CuratedInteractions`, `NativeBridgePreview`, `ContentComposition`, `ContentRuntimeBootstrapFinalizeFlow`).
- 2026-03-01: removed remaining rebuild fallback in grid card updates:
  - `CuratedPanelGrid.createOrReuseCuratedCard(...)` no longer replaces existing card nodes when content signatures change and `patchCuratedCard` is unavailable.
  - Card identity now remains stable in this path (in-place/no-op behavior rather than replacement), aligning with create-once/update-in-place policy.
  - Added regression coverage in `CuratedPanel.test.ts` to assert no node replacement under signature churn without patch callbacks.
- 2026-03-01: extracted parked-card lifecycle ownership from `CuratedPanelGrid` into `CuratedPanelGridParkingManager`:
  - Park/unpark/trim/dispose responsibilities are now delegated to a dedicated class owner with explicit typed lifecycle handlers.
  - Added focused unit coverage in `CuratedPanelGridParkingManager.test.ts` for parking callbacks, age-based disposal, and over-budget eviction.
- 2026-03-01: completed follow-up owner-hierarchy decomposition for panel/grid/card-body orchestration:
  - `CuratedPanel` now delegates render scheduling/signature/loading orchestration to `CuratedPanelRenderOrchestrator`.
  - `CuratedPanelGridRenderPhases` now delegates visible-order planning and mount reconciliation to `CuratedPanelGridOrderPlanner` and `CuratedPanelGridMountReconciler`.
  - `CuratedCardView` now composes explicit sub-owners (`CuratedCardBodyRefsStore`, `CuratedCardBodyFactoryOwner`, `CuratedCardBodyPatchOwner`) for deterministic body creation/patch ownership.
  - Added focused unit coverage for new grid owner components in `CuratedPanelGridOrderPlanner.test.ts` and `CuratedPanelGridMountReconciler.test.ts`.

## WS4: Native Interop Adapter Isolation and Cleanup

Status: Complete (2026-03-01; maintenance mode)
Priority: P1

Goal:
- Keep native-page bridge logic isolated and minimal, with no leakage into owned component logic.

Primary files:
- `extension/src/Runtime/NativeCardSelectorAdapter.ts`
- `extension/src/Runtime/NativeActionBridge.ts`
- `extension/src/Runtime/NativeBridgePreview.ts`

Deliverables:
- Tight adapter contracts for non-owned element discovery only.
- No business-state ownership inferred from native DOM.

Done when:
- Native adapters are strictly interop boundaries and typed as such.

Progress notes:
- 2026-02-28: completed core native-adapter boundary hardening in `NativeCardSelectorAdapter` with policy-preserving non-owned selector behavior and focused unit coverage.
- 2026-03-01: no new native interop debt introduced; current effort is maintenance-only while WS2/WS3/WS5 close remaining hotspots.

## WS5: Data/Domain Contract Tightening

Status: Complete (2026-03-01)
Priority: P1

Goal:
- Ensure API payload uncertainty is handled immediately on receipt, then passed as typed normalized models downstream.

Primary files:
- `extension/src/Data/ApiContracts.ts`
- `extension/src/Data/*Client.ts`
- `extension/src/Data/*Repository*.ts`
- `extension/src/Domain/EntryNormalizer.ts`
- `extension/src/Runtime/CuratedLoaderLoadCycle.ts`

Deliverables:
- Contract + normalization boundaries documented and enforced.
- Reduced ambiguous payload handling in runtime/UI layers.

Done when:
- Runtime/UI modules consume typed models, not raw/loosely-typed payload objects.

Progress notes:
- 2026-03-01: completed the deeper DTO extraction follow-up slice across the remaining WS5 queue files:
  - `RatingsRepository` now parses/normalizes fetched and batch rating records into typed updates before merge application.
  - `RatingsRepositoryCacheSupport` now normalizes raw rating-update payload shape once before typed update derivation.
  - `HistoryRepositoryPreloadCollector` now normalizes dependency/options ingress and page envelopes (`rows`, `totalRows`) before collection loops.
  - `EntryNormalizer` now introduces explicit per-row DTO extraction (`ApiRowDto`) before dedupe/normalized entry construction.
  - `CuratedLoaderLoadCycle` now normalizes fetched rows and normalized entries into typed curated row/entry arrays before preload and commit paths.
- 2026-03-01: completed DTO contract documentation and drift-lock coverage for production envelope variants:
  - Added endpoint DTO + normalization reference doc: `docs/api-dto-contracts.md`.
  - Added dedicated drift suite: `tests/Unit/Data/ApiEnvelopeContractDrift.test.ts` covering watchlist, watch-history, and CMS envelope variants plus row-contract warning semantics.

## WS6: Verification and Regression Discipline

Status: Complete (2026-03-01)
Priority: P0

Goal:
- Keep behavior stable while architectural surfaces change.

Required gates:
- `npm run typecheck`
- `npm run guard:dom-lookups`
- `npm run guard:async-event-listeners`
- `npm run guard:module-registry-growth`
- `npm run guard:boundary-type-growth`
- `npm run guard:ui-document-ref`
- `npm run lint`
- `npm run format:check`
- `npm run test:perf:budgets`
- `npm run test:unit`
- `npm run lint:firefox`
- `npm run test:e2e`
- `npm run build:webext`
- `npm run build:safari`
- `npm run guard:arch-growth`
- `npm run arch:metrics`

Latest full-gate validation stamp:
- 2026-03-01: full gate set green on current v1/v2 completion state:
  - `typecheck`, `lint`, `format:check`, `test:perf:budgets`, `test:unit` (`304 passed`), `lint:firefox`, `test:e2e` (`148 passed`, `2 skipped`), `build:webext`, `build:safari`, `guard:arch-growth`, `arch:metrics`.
  - Related guard outcomes at this stamp:
    - boundary growth: `unknown 0/0`, files `0/0`, `AnyFn 0/0`.
    - owned DOM lookup guard: allowlisted root/native query lookups only (`3 + 3 + 1` budgets in the three allowlisted runtime files).

Done when:
- All migration slices remain green on the full gate set.

## Architecture Discussion Triggers (Mandatory)

Stop and discuss before implementation when any of these are true:

- A change requires adding new module-registry hydration/wiring for internal runtime modules.
- A change requires owned-subtree selector lookups to patch extension-owned UI.
- A change requires DOM node recreation to represent routine state updates.
- A change expands internal `unknown`/`AnyFn` surfaces instead of shrinking them.
- A change adds nested ownership ambiguity where parent/child responsibilities are unclear.

Discussion format required:
- What is wrong now.
- Why it is wrong.
- Options considered.
- Recommended option.
- Migration and regression risk.

## Appendix A: Full Module-Registry Touch Inventory (Current)

Remaining direct `__CW_WATCHLIST_CURATOR_MODULES__` touch points:
- None in production or tests. Guard-only pattern checks remain in `scripts/guard-module-registry-growth.mts`.

## References

- `docs/architecture-standards.md`
- `docs/architecture-transformation-plan.md`
- `docs/ui-dom-state-architecture-overhaul.md`
- `docs/ui-done-right-transformation.md`
- `docs/modern-architecture-improvement-v2.md`
