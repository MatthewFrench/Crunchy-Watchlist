# Modern Architecture Improvement Plan (v2)

Last updated: 2026-03-01
Status: Complete (2026-03-01)
Scope: Runtime/Data/UI refactor and stabilization after v1 completion

## 1) Why v2 exists

`v1` closed major debt (module-registry removal, zero `unknown`/`AnyFn` token usage in `extension/src/**`, class-based UI owners, full gate coverage), but it did not fully finish:

- request-budget hardening under real churn and long-tail watch-history behavior,
- decomposition of the largest runtime owner files,
- a strict telemetry contract that catches request/render regressions before UX lag,
- full owner-hierarchy decomposition so large owners are orchestration-only.

This v2 object defines the comprehensive follow-through path.

## 2) Verified baseline (starting point)

Verified at time of writing:

- Registry usage in production/tests: `0` (`__CW_WATCHLIST_CURATOR_MODULES__` absent outside guards).
- `unknown` references in `extension/src/**`: `0`.
- `AnyFn` references in `extension/src/**`: `0`.
- DOM lookup policy guard: pass (only allowlisted root/native lookups).
- Full architecture/lint/type/test/build gates: green.
- Create-once patch-in-place policy is active for curated cards.

## 3) Architecture goals (non-negotiable)

1. Create once, patch in place, preserve node identity.
2. Parent owners orchestrate; child owners mutate only their own subtree.
3. Data boundaries normalize once on ingress and expose typed runtime models.
4. No request storms: preload policies must be deduped and budget-tested.
5. Runtime telemetry must include request and render costs in stable contracts.

## 4) UI ownership inventory (must remain deterministic)

Primary runtime/UI owners and component surfaces:

- Runtime shells and panel orchestration:
  - `extension/src/Runtime/InterfaceShell.ts`
  - `extension/src/Runtime/CuratedPanel.ts`
  - `extension/src/Runtime/CuratedPanelGrid.ts`
  - `extension/src/Runtime/CuratedPanelLoadingIndicator.ts`
  - `extension/src/Runtime/CuratedInteractions.ts`
  - `extension/src/Runtime/CuratedInteractionsControls.ts`
- Card subtree owners:
  - `extension/src/Ui/CuratedCardShell.ts`
  - `extension/src/Ui/CuratedCardView.ts`
  - `extension/src/Ui/CuratedCardHeaderComponent.ts`
  - `extension/src/Ui/CuratedCardMediaComponent.ts`
  - `extension/src/Ui/CuratedCardMetadataComponent.ts`
  - `extension/src/Ui/CuratedCardActionsComponent.ts`
  - `extension/src/Ui/CuratedCardProgressComponent.ts`
  - `extension/src/Ui/CardMetadata.ts`
  - `extension/src/Ui/ControlsView.ts`

## 5) State-change procedures that must stay minimal-update

### Sort/filter/control interactions

- Entrypoints:
  - `CuratedInteractionsControls`
  - `CuratedPanel`
  - `CuratedPanelGrid`
- Required behavior:
  - recompute view model,
  - patch existing element owners,
  - reorder only when needed,
  - no replacement of owned nodes.

### Loader and metadata phases

- Entrypoints:
  - `CuratedLoader`
  - `CuratedLoaderLoadCycle`
  - `CuratedLoaderDeferredMetadata`
  - `HistoryRepositoryPreload`
  - `RatingsRepository`
- Required behavior:
  - bounded request counts,
  - per-locale/per-revision dedupe,
  - no unconditional render feedback loops.

### Host lifecycle and native interop

- Entrypoints:
  - `InterfaceShellHostLifecycle`
  - `BootstrapGate`
  - `ContentRuntimeBootstrapDomLock`
  - `NativeCardSelectorAdapter`
- Required behavior:
  - root/native discovery only,
  - no owned subtree mutation by selector lookup.

## 6) Current risk map

### A. Watch-history request churn risk

Risk:

- localized forced preload paths can repeatedly refetch under rapid trigger churn.
- pagination can become expensive when candidate series are unmatched.

Now addressed in this pass:

- `HistoryRepositoryPreload` now dedupes forced localized preload by `(locale, curated-data revision)`.
- concurrent forced localized requests for same locale now share inflight.
- added pagination budget test for unmatched candidates.

Status:

- locale/revision preload attempt counters are exposed through DebugApi diagnostics.
- synthetic multipage request-budget coverage is enforced in e2e.

### B. Large owner decomposition follow-through

Previously tracked hotspots were decomposed in v2:

- `CuratedPanel` split with dedicated controls-sync/localized-preload/render-orchestrator owners.
- `CuratedPanelGrid` split with dedicated order-planner/mount-reconciler/parking-manager owners.
- `CuratedCardView` split into explicit body refs/factory/patch sub-owners.

Current architecture metrics show no new structural opportunities above configured thresholds.

### C. Telemetry contract needs broader enforcement

Now addressed in this pass:

- `curated-load-timing` event now includes stable request counters:
  - `requestCountTotal`
  - `requestCounts.authToken`
  - `requestCounts.watchlist`
  - `requestCounts.ratings`
  - `requestCounts.watchHistory`
  - `requestCounts.other`

Status:

- telemetry contract guard now validates additional high-risk runtime events:
  - `watch-history-preload-start`,
  - `watch-history-preload`,
  - `watch-history-preload-failed`.

## 7) v2 workstreams

## WS-A: Network budget hardening

Status: Complete
Priority: P0

Primary files:

- `extension/src/Data/HistoryRepositoryPreload.ts`
- `extension/src/Data/HistoryRepositoryPreloadCollector.ts`
- `extension/src/Runtime/CuratedLoaderLoadCycle.ts`
- `extension/src/Runtime/BootstrapHelpers.ts`
- `tests/WatchHistoryNetworkBudget.spec.ts`
- `tests/Unit/Data/HistoryRepositoryPreload.test.ts`

Completed in this pass:

- forced localized watch-history preload dedupe by locale+revision,
- inflight sharing for concurrent forced localized requests,
- e2e pagination cap test (`unmatched candidates`),
- unit coverage for forced localized dedupe.
- locale/revision attempt counters emitted in watch-history preload runtime events:
  - `watch-history-preload-start`,
  - `watch-history-preload`,
  - `watch-history-preload-failed`.
- DebugApi diagnostics now expose normalized watch-history preload attempt stats via `getCuratedDomStats().watchHistoryPreloadAttempts`.
- request-budget scenarios now include stricter per-locale caps for:
  - initial load + control churn,
  - locale toggle churn,
  - refresh churn.
- added synthetic fixture-server multipage watch-history mode for stress budgeting:
  - `/watchlist?fixture_mode=watch-history-multipage-unmatched`,
  - cookie-scoped fixture routing in `tests/ServerRouter.ts`,
  - dedicated e2e stress assertion in `tests/WatchHistoryNetworkBudget.spec.ts`.

Remaining:

- [x] add locale-specific attempt counters to diagnostics (runtime events),
- [x] expose locale-specific attempt counters to DebugApi diagnostics,
- [x] create synthetic multipage fixture-server mode for stress request-budget tests,
- [x] enforce stricter per-locale expected max by scenario (initial, toggle churn, refresh churn).

## WS-B: Metadata request budgets beyond watch-history

Status: Complete
Priority: P0

Primary files:

- `tests/RatingsNetworkBudget.spec.ts`
- `tests/PreviewNetworkBudget.spec.ts`
- `extension/src/Data/RatingsClient.ts`
- `extension/src/Data/RatingsRepository.ts`
- `extension/src/Data/PreviewRepository.ts`
- `extension/src/Runtime/NativeBridgePreview.ts`
- `extension/src/Runtime/CuratedLoaderLoadCycle.ts`

Completed in this pass:

- added new e2e suite `tests/RatingsNetworkBudget.spec.ts`:
  - stable ratings requests during sort/filter churn,
  - bounded localized ratings preloads during rapid locale toggles.
  - legacy ratings fallback endpoint budget assertion (`/content-reviews/v3/rating/series/**` stays unused during curated control churn).
- added new e2e suite `tests/PreviewNetworkBudget.spec.ts`:
  - bounded streams preview requests under repeated hover churn,
  - bounded streams preview requests after sort/filter churn.

Remaining:

- [x] add ratings fallback (legacy endpoint) budget assertions.

## WS-C: Owner hierarchy decomposition

Status: Complete
Priority: P1

Primary files:

- `extension/src/Runtime/CuratedPanel.ts`
- `extension/src/Runtime/CuratedPanelGrid.ts`
- `extension/src/Runtime/InterfaceShell.ts`
- `extension/src/Ui/CuratedCardView.ts`

Plan:

- extract orchestration slices into child owners (stats owner, empty-state owner, render-signature owner, controls owner adapters),
- reduce parent owner responsibilities to composition and event routing,
- keep patch APIs explicit and typed.

Completed in this pass:

- extracted localized-preload ownership from `CuratedPanel` into a dedicated class owner:
  - `extension/src/Runtime/CuratedPanelLocalizedPreloadCoordinator.ts`,
  - `CuratedPanel` now delegates localized preload scheduling through `localizedPreloadCoordinator.queue(...)`.
- extracted controls/stats ownership from `CuratedPanel` into a dedicated class owner:
  - `extension/src/Runtime/CuratedPanelControlsSync.ts`,
  - `CuratedPanel` now delegates filter-option + stats text synchronization through `controlsSyncOwner`.
- extracted parked-card lifecycle ownership from `CuratedPanelGrid` into a dedicated class owner:
  - `extension/src/Runtime/CuratedPanelGridParkingManager.ts`,
  - `CuratedPanelGrid` now delegates park/unpark/trim/dispose responsibilities through typed owner methods.
- extracted `CuratedPanel` render scheduling/signature orchestration into a dedicated class owner:
  - `extension/src/Runtime/CuratedPanelRenderOrchestrator.ts`,
  - `CuratedPanel` now composes controls-sync, localized-preload coordinator, and render orchestrator owners.
- extracted `CuratedPanelGrid` order planning + mount reconciliation into dedicated child owners:
  - `extension/src/Runtime/CuratedPanelGridOrderPlanner.ts`,
  - `extension/src/Runtime/CuratedPanelGridMountReconciler.ts`,
  - `CuratedPanelGridRenderPhases` now delegates planning/reconciliation instead of owning both concerns directly.
- split `CuratedCardView` composition into explicit sub-owner contracts:
  - `CuratedCardBodyRefsStore`,
  - `CuratedCardBodyFactoryOwner`,
  - `CuratedCardBodyPatchOwner`.

Remaining:

- [x] split `CuratedPanel` into render-orchestrator + controls-sync + localized-preload coordinator,
- [x] split `CuratedPanelGrid` into order planner + mount reconciler + parking manager,
- [x] split `CuratedCardView` into explicit sub-owner composition contract.

## WS-D: Runtime telemetry + perf budgets

Status: Complete
Priority: P1

Primary files:

- `extension/src/Runtime/CuratedLoaderLoadCycle.ts`
- `tests/Unit/Runtime/CuratedLoaderLoadCycle.test.ts`
- `tests/Unit/Runtime/CuratedPerfBudget.test.ts`
- `tests/RenderStabilityBudget.spec.ts`

Completed in this pass:

- added request-count telemetry contract to `curated-load-timing`,
- added unit assertion coverage for telemetry payload.
- added render/layout stability e2e budgets:
  - card + thumbnail identity stability under control churn,
  - Chromium cumulative layout shift (CLS) budget during metadata patching.
- added sort-only churn stability budget:
  - `patched` lifecycle delta remains `0`,
  - no card-subtree content mutations during sort-only churn.
- added watch-ready dim-mode churn stability budget:
  - `patched` lifecycle delta remains `0`,
  - no card-subtree content mutations while toggling `none <-> dim`,
  - class-only dim state updates are still verified.
- removed redundant hot-path DOM writes:
  - `setElementDataAttribute(...)` now no-ops when value is unchanged,
  - parked-card class assignment now no-ops when computed class string is unchanged.
- changed card content signature policy:
  - `dimNotWatchReady` is excluded from content signatures so dim-mode style toggles do not force content patching.
- tightened hot-interaction render-pass budgets in E2E stability tests:
  - sort-only churn render-pass delta cap (`<= 7`),
  - watch-ready dim churn render-pass delta cap (`<= 6`).
- added runtime telemetry contract guard script:
  - `scripts/guard-runtime-telemetry-contract.mts`,
  - wired into `npm run lint` via `npm run guard:runtime-telemetry-contract`.

Remaining:

- [x] extend perf budgets to include render pass caps for hot interactions,
- [x] add guard/check for required telemetry keys in runtime events.
- [x] reduce metadata patch CLS budget from `<0.15` to `<0.05` via layout-stabilizing UI changes.

## WS-E: Data certainty and storage model clarity

Status: Complete
Priority: P1

Primary files:

- `extension/src/Data/ApiContracts.ts`
- `extension/src/Data/*Repository*.ts`
- `extension/src/Data/*Client.ts`
- `extension/src/Domain/EntryNormalizer.ts`

Policy:

- data shape uncertainty is handled only at ingress,
- runtime/ui consume normalized, extension-owned models,
- DOM is not a source of truth.

Completed in this pass:

- documented per-endpoint DTO contracts and normalization examples:
  - `docs/api-dto-contracts.md`
- added dedicated API envelope drift coverage for production envelope variants:
  - `tests/Unit/Data/ApiEnvelopeContractDrift.test.ts`

Remaining:

- [x] document per-endpoint DTO contracts with normalization examples,
- [x] add contract drift tests for each API envelope variant used in production paths.

## 8) Mass refactor protocol (allowed, but controlled)

Major delete/recreate refactors are allowed under this policy:

1. Define explicit invariants first (identity stability, no owned lookups, bounded requests).
2. Land structural moves with compatibility adapters if needed.
3. Re-run full quality gates.
4. Remove adapters once all tests and guards are green.

No exception rules:

- no owned subtree selector lookup shortcuts,
- no element replacement to fake diffing,
- no reintroduction of module-registry wiring,
- no internal `unknown`/`AnyFn` rewidening in `extension/src/**`.

## 9) Immediate execution queue

1. No open v2 checklist items remain.
2. Continue routine maintenance with architecture metrics and guard baselines.

## 10) Validation requirements for each v2 batch

Required checks:

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test:perf:budgets`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build:webext`
- `npm run build:safari`
- `npm run arch:metrics`

Recommended targeted checks (for this v2 scope):

- `npm run test:e2e -- tests/WatchHistoryNetworkBudget.spec.ts tests/RatingsNetworkBudget.spec.ts`
- `npm run test:e2e -- tests/RenderStabilityBudget.spec.ts tests/PreviewNetworkBudget.spec.ts`
- `npx vitest run tests/Unit/Data/HistoryRepositoryPreload.test.ts tests/Unit/Runtime/CuratedLoaderLoadCycle.test.ts`
