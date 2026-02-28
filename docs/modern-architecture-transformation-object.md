# Modern Architecture Transformation Object

Last updated: 2026-02-28
Status: Active
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
status: active
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

Audit date: 2026-02-28

### Key Counts

| Surface | Current baseline |
| --- | --- |
| Files using `__CW_WATCHLIST_CURATOR_MODULES__` | 81 files |
| Registry references (`__CW_WATCHLIST_CURATOR_MODULES__`) | 353 occurrences |
| Runtime files with registry usage | 48/48 |
| UI files with registry usage | 9/9 |
| Data files with registry usage | 15/15 |
| Domain files with registry usage | 7/7 |
| `unknown` token count in Runtime | 1506 |
| `unknown` token count in UI | 279 |
| `unknown` token count in Data | 539 |
| `unknown` token count in Domain | 391 |
| `AnyFn` occurrences (all `extension/src/**`) | 247 |
| Selector-lookup callsites in Runtime/UI | 7 |
| Selector-lookup files in Runtime/UI | 3 |
| Dataset read/write callsites in Runtime/UI | 34 |
| Dataset files in Runtime/UI | 12 |
| DOM expando callsites (`__cw...__`) | 0 |
| `cloneNode` callsites | 0 |

### Selector Lookup Inventory (Current)

Current lookups are constrained to root/native bridging and runtime lock cleanup:

- `extension/src/Runtime/BootstrapGate.ts`
- `extension/src/Runtime/ContentRuntimeBootstrapDomLock.ts`
- `extension/src/Runtime/InterfaceShellHostLifecycle.ts`
- `extension/src/Runtime/NativeCardSelectorAdapter.ts`

Policy status:
- Allowed for root discovery and non-owned native bridge operations.
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
- Runtime warning hotspots reduced below threshold with extracted phase helpers:
  - `CuratedPanelGrid` render pass orchestration via `CuratedPanelGridRenderPass.ts`
  - `CuratedLoaderDeferredMetadata` chunk-finalization scheduling helpers
  - `ContentComposition` runtime assembly helpers
- `ContentRuntimeSetup` no longer silently falls back to registry-hydrated setup modules; composition/data-init module dependencies are now explicit.
- `CuratedPanelLoadingIndicator` now uses a class-based owner/controller with explicit owned refs/state.

### Not Completed

- Proper bundled static module graph replacing registry-first runtime wiring.
- Reduction of widespread runtime-internal `unknown`/`AnyFn` re-widening after boundary checks.
- Class-first owner/controller normalization for all UI manipulation surfaces.
- Consolidation of repetitive module-registry bootstrapping helpers into cleaner composition-root patterns (or full removal once bundled).

## Workstreams and Plan

## WS1: Bundled Static Runtime Module Graph

Status: In progress
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

## WS2: Boundary-Type Discipline Cleanup

Status: In progress
Priority: P0

Goal:
- Keep `unknown` only at real external boundaries, convert once, stay typed internally.

Primary files:
- Runtime bootstrap/control modules
- Data boundary modules (`ApiContracts`, client/repository seams)
- Domain primitive modules currently using registry-injected `AnyFn`

Deliverables:
- Explicit validated DTOs/contracts at API and page boundaries.
- Typed internal interfaces replacing broad `AnyFn`/loose records in owner paths.

Done when:
- Internal owner APIs stop re-widening to `unknown`/`AnyFn` after boundary conversion.

Progress notes:
- 2026-02-28: reduced boundary-noise concentration by extracting typed normalization/runtime-factory seams from `HistoryRepositoryCache`, `ContentRuntimeSetupDataInitialization`, and `CorePrimitives` while preserving existing public registry APIs.
- 2026-02-28: hardened runtime wiring seams with deferred checked binding adapters in `ContentRuntimeSetupDataInitializationPhases.ts` (preserving intentional late-bound callbacks) and extracted composition/render-phase helpers to keep warning hotspots at zero.
- 2026-02-28: added `guard-boundary-type-growth` baseline gate (`docs/boundary-type-growth-baseline.json`) and wired it into lint/check pipelines to block `AnyFn`/`unknown` backslide while WS2 reduces internal rewidening.

## WS3: Class-Based UI Owner/Controller Standardization

Status: In progress
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

## WS4: Native Interop Adapter Isolation and Cleanup

Status: Not started
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

## WS5: Data/Domain Contract Tightening

Status: Not started
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

## WS6: Verification and Regression Discipline

Status: In progress
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

These files currently participate in global registry wiring and are in scope for WS1 migration:

- `extension/src/Data/ApiContracts.ts`
- `extension/src/Data/AuthClient.ts`
- `extension/src/Data/AuthClientFetchResilience.ts`
- `extension/src/Data/HistoryRepository.ts`
- `extension/src/Data/HistoryRepositoryCache.ts`
- `extension/src/Data/HistoryRepositoryPreload.ts`
- `extension/src/Data/HistoryRepositoryPreloadCollector.ts`
- `extension/src/Data/HistoryRepositoryPreloadPlanning.ts`
- `extension/src/Data/PreviewRepository.ts`
- `extension/src/Data/RatingsClient.ts`
- `extension/src/Data/RatingsRepository.ts`
- `extension/src/Data/RatingsRepositoryCacheSupport.ts`
- `extension/src/Data/StorageAdapter.ts`
- `extension/src/Data/WatchlistClient.ts`
- `extension/src/Data/WatchlistRepository.ts`
- `extension/src/Domain/CorePrimitives.ts`
- `extension/src/Domain/EntryNormalizer.ts`
- `extension/src/Domain/EntrySorting.ts`
- `extension/src/Domain/EpisodePrimitives.ts`
- `extension/src/Domain/ImageVariants.ts`
- `extension/src/Domain/RatingPrimitives.ts`
- `extension/src/Domain/SortMetrics.ts`
- `extension/src/Runtime/BootstrapConfig.ts`
- `extension/src/Runtime/BootstrapDiagnostics.ts`
- `extension/src/Runtime/BootstrapFinalize.ts`
- `extension/src/Runtime/BootstrapGate.ts`
- `extension/src/Runtime/BootstrapHelpers.ts`
- `extension/src/Runtime/BootstrapModules.ts`
- `extension/src/Runtime/ContentBootstrap.ts`
- `extension/src/Runtime/ContentComposition.ts`
- `extension/src/Runtime/ContentCompositionBindings.ts`
- `extension/src/Runtime/ContentCompositionRuntimeBindings.ts`
- `extension/src/Runtime/ContentRuntimeBootstrapDomLock.ts`
- `extension/src/Runtime/ContentRuntimeBootstrapFinalizeFlow.ts`
- `extension/src/Runtime/ContentRuntimeBootstrapHelpers.ts`
- `extension/src/Runtime/ContentRuntimeBootstrapSession.ts`
- `extension/src/Runtime/ContentRuntimeBootstrapSessionAssembly.ts`
- `extension/src/Runtime/ContentRuntimeBootstrapSessionSupport.ts`
- `extension/src/Runtime/ContentRuntimeBootstrapSetupBindings.ts`
- `extension/src/Runtime/ContentRuntimeSetup.ts`
- `extension/src/Runtime/ContentRuntimeSetupComposition.ts`
- `extension/src/Runtime/ContentRuntimeSetupDataInitialization.ts`
- `extension/src/Runtime/CuratedInteractions.ts`
- `extension/src/Runtime/CuratedInteractionsControls.ts`
- `extension/src/Runtime/CuratedLoader.ts`
- `extension/src/Runtime/CuratedLoaderDeferredMetadata.ts`
- `extension/src/Runtime/CuratedLoaderLoadCycle.ts`
- `extension/src/Runtime/CuratedLoaderPendingRequests.ts`
- `extension/src/Runtime/CuratedPanel.ts`
- `extension/src/Runtime/CuratedPanelGrid.ts`
- `extension/src/Runtime/CuratedPanelGridRenderPhases.ts`
- `extension/src/Runtime/CuratedPanelGridSignature.ts`
- `extension/src/Runtime/CuratedPanelGridTransitions.ts`
- `extension/src/Runtime/CuratedPanelLoadingIndicator.ts`
- `extension/src/Runtime/CuratedRenderable.ts`
- `extension/src/Runtime/CuratedRenderableListProcessing.ts`
- `extension/src/Runtime/CuratedRenderableMergeSupport.ts`
- `extension/src/Runtime/DebugApi.ts`
- `extension/src/Runtime/InterfaceShell.ts`
- `extension/src/Runtime/InterfaceShellHostLifecycle.ts`
- `extension/src/Runtime/NativeActionBridge.ts`
- `extension/src/Runtime/NativeBridge.ts`
- `extension/src/Runtime/NativeBridgePreview.ts`
- `extension/src/Runtime/NativeCardSelectorAdapter.ts`
- `extension/src/Runtime/PreferredAudioDetector.ts`
- `extension/src/Runtime/RouteLifecycle.ts`
- `extension/src/Runtime/RuntimeStore.ts`
- `extension/src/Runtime/RuntimeTrace.ts`
- `extension/src/Runtime/StateLoader.ts`
- `extension/src/Runtime/WatchlistHealth.ts`
- `extension/src/Ui/CardMetadata.ts`
- `extension/src/Ui/ControlsView.ts`
- `extension/src/Ui/CuratedCardActionsComponent.ts`
- `extension/src/Ui/CuratedCardHeaderComponent.ts`
- `extension/src/Ui/CuratedCardMediaComponent.ts`
- `extension/src/Ui/CuratedCardMetadataComponent.ts`
- `extension/src/Ui/CuratedCardProgressComponent.ts`
- `extension/src/Ui/CuratedCardShell.ts`
- `extension/src/Ui/CuratedCardView.ts`

## References

- `docs/architecture-standards.md`
- `docs/architecture-transformation-plan.md`
- `docs/ui-dom-state-architecture-overhaul.md`
- `docs/ui-done-right-transformation.md`
