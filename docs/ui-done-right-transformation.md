# UI Done-Right Transformation Plan

Last updated: 2026-02-27
Status: Completed (owned lookup migration)
Decision owner: Runtime/UI

## Objective

Rebuild the extension UI architecture around stable owner components that create nodes once, keep direct refs, and patch in place.

Non-negotiable outcome:
- No selector/class/id lookup in extension-owned subtrees.
- Root discovery and native-page bridge lookups are the only allowed lookup exceptions.
- UI state survives sort/filter/metadata churn without node recreation flicker.

## Framework Decision

Decision: keep vanilla component controllers, do not migrate to React for this overhaul.

Reasoning:
- The current extension can reach the target behavior without a framework rewrite.
- Most regressions came from ownership/ref discipline, not from lack of React.
- A React migration would add rewrite risk and integration overhead with existing runtime modules and content-script constraints.

Conclusion:
- We are not blocked by tech stack.
- We are blocked by architecture/discipline around ownership boundaries.

## Done vs Pending Snapshot

Completed:
- Grid path reuses cards by `seriesId` and reorders with `insertBefore` instead of wholesale replacement.
- Transition work now skips when order is identical and disables FLIP-style animation for large grids.
- DOM lifecycle counters exist (`created`, `patched`, `parked`, `unparked`, `disposed`, `renderPasses`).
- Debug API exposes DOM churn metrics and identity churn rate.
- Health warning exists for high identity churn.
- Unit + e2e coverage exists for identity stability and transition regressions.
- Renderable merge/filter cache now avoids entry re-merge on sort-only or filter-only churn in `extension/src/Runtime/CuratedRenderable.ts`.
- Runtime bindings now pass explicit cache revision tokens into renderable settings in `extension/src/Runtime/ContentCompositionRuntimeBindings.ts`.
- Shared owner/ref contracts are centralized in `extension/Types/ContentCompositionTypes.d.ts` and consumed by card/loading owner modules.
- CI now enforces owned-DOM lookup policy with `scripts/guard-owned-dom-lookups.mts` (`npm run guard:dom-lookups`).
- Perf budgets are enforced with `tests/Unit/Runtime/CuratedPerfBudget.test.ts` (`npm run test:perf:budgets`).

Not completed:
- Virtualization/windowing (explicitly deferred; current 300+ card rendering is stable in our environment).
- Remaining optional hardening only (telemetry tuning and incremental API cleanup).

## Comprehensive Lookup Inventory

Legend:
- `Refactor`: lookup must be removed and replaced with owner refs.
- `Allowed`: lookup is root discovery or non-owned native bridge.
- `Review`: allowed today, but should be reevaluated once owner refs are fully available.

Current scope count:
- `0` lookup-related owned callsites remaining in the scoped migration files.
- `18` lookup-related callsites currently allowed across root/native bridge files.

### A) Refactor Completed (Owned UI)

| File | Lines | Current pattern | Classification | Target replacement |
| --- | --- | --- | --- | --- |
| `extension/src/Ui/CuratedCardShell.ts` | 166-187, 552, 559, 593, 606, 632, 645-646, 668, 733 | `findElementByClassTokenWithin` descendant scans | Completed | `CuratedCardComponent.refs` with direct handles for header/title/badge/thumb/media/placeholder/progress/fill |
| `extension/src/Ui/CuratedCardShell.ts` | 171, 486 | `querySelector` on owned subtree | Completed | Store `descriptionEl` ref during create and move via direct node ref |
| `extension/src/Ui/CuratedCardShell.ts` | 576-588, 583 | tree walk + class-token filter for base image | Completed | persist `thumbImageEl` ref in media component |
| `extension/src/Ui/CuratedCardView.ts` | 148-159, 571, 579, 584, 592, 597, 602, 607 | body field lookup by class token | Completed | `CuratedCardBodyComponent.refs` for description/status/lastWatched/scope/genres/histogram/ratingMeta |
| `extension/src/Ui/CuratedCardView.ts` | 449-452, 464-470, 483 | histogram row/part lookup by class token | Completed | `RatingHistogramComponent.refsByStar` + fixed part refs per row |
| `extension/src/Ui/CuratedCardView.ts` | 514-518, 550-557 | class-token row filtering during patch | Completed | iterate typed `rowRefs` map instead of class checks |
| `extension/src/Runtime/CuratedPanelLoadingIndicator.ts` | 52-73, 124, 137, 144 | details/progress/requests lookup by class token | Completed | `LoadingIndicatorComponent.refs` created once |
| `extension/src/Runtime/CuratedPanelLoadingIndicator.ts` | 85 | duplicate nested loading cleanup via class-token scan | Completed | remove duplicate-creation path; enforce single owner instance |
| `extension/src/Runtime/CuratedPanelLoadingIndicator.ts` | 113 | parent class-token check for loading box | Completed | pass explicit `loadingBoxEl` ref from interface shell |
| `extension/src/Runtime/CuratedPanelGrid.ts` | 239 | favorite button `querySelector` | Completed | card controller carries `favoriteButtonEl` ref from actions component |
| `extension/src/Runtime/CuratedPanelGrid.ts` | 428, 720 | class-token checks for card/empty node identity | Completed | use typed controller map + explicit empty-state ref |
| `extension/src/Runtime/CuratedPanelGridTransitions.ts` | 44-60, 205, 223 | card detection via class tokens | Completed | reorder only known controller cards; avoid class-name type checks |
| `extension/src/Runtime/CuratedLoaderDeferredMetadata.ts` | 103 | `document.querySelectorAll('.cw-curated-card')` | Completed | use grid runtime/controller registry for visible series ordering |
| `extension/src/Runtime/WatchlistHealth.ts` | 329, 341 | `hostEl.querySelector(...)` for owned scaffold/loading | Completed | consume `state.loadingIndicatorEl`, `state.tab*`, `state.curatedPanelEl`, `state.gridEl` refs |

### B) Allowed Lookups (Root Discovery / Non-owned Elements)

| File | Lines | Why allowed |
| --- | --- | --- |
| `extension/src/Runtime/BootstrapGate.ts` | 111, 113, 134, 138, 148, 194 | stale-shell/root discovery before runtime ownership is established |
| `extension/src/Runtime/BootstrapGate.ts` | 90 | class check on discovered root/shell node |
| `extension/src/Runtime/ContentRuntimeBootstrapDomLock.ts` | 200, 211, 222 | cleanup of stale host/frame/native markers at document scope |
| `extension/src/Runtime/InterfaceShellHostLifecycle.ts` | 78, 193 | root-level host/native visibility lifecycle management |
| `extension/src/Runtime/NativeActionBridge.ts` | 64, 80, 120 | bridge to non-owned Crunchyroll native cards/buttons |
| `extension/src/Runtime/NativeBridgePreview.ts` | 145 | preview extraction from non-owned native card media |
| `extension/src/Runtime/WatchlistHealth.ts` | 258, 308 | health checks on host/root identity markers |

## Components and Element Ownership Targets

### 1) `CuratedCardComponent` (new typed owner boundary)

Primary files:
- `extension/src/Ui/CuratedCardShell.ts`
- `extension/src/Ui/CuratedCardView.ts`
- `extension/src/Runtime/CuratedInteractions.ts`
- `extension/src/Runtime/CuratedPanelGrid.ts`

Required refs (minimum):
- `rootEl` (`article.cw-curated-card`)
- `headerEl`, `titleLinkEl`, `ratingBadgeEl`
- `mediaEl`, `thumbLinkEl`, `thumbImageEl`, `placeholderEl`
- `thumbProgressEl`, `thumbProgressFillEl`
- `descriptionEl`, `statusEl`, `lastWatchedEl`, `scopeEl`, `genresEl`
- `histogramEl`, `histogramMissingEl`, `histogramRowsByStar[1..5]`
- `ratingMetaEl`
- `actionsEl`, `favoriteButtonEl`, `removeButtonEl`
- `detailsSkeletonEl`

### 2) `LoadingIndicatorComponent`

Primary files:
- `extension/src/Ui/ControlsView.ts`
- `extension/src/Runtime/CuratedPanelLoadingIndicator.ts`
- `extension/src/Runtime/InterfaceShell.ts`

Required refs:
- `loadingBoxEl`
- `loadingIndicatorRootEl`
- `headingEl`
- `detailsEl`, `progressEl`, `requestsEl`

### 3) `CuratedGridComponent` / controller registry integration

Primary files:
- `extension/src/Runtime/CuratedPanelGrid.ts`
- `extension/src/Runtime/CuratedPanelGridTransitions.ts`
- `extension/src/Runtime/CuratedLoaderDeferredMetadata.ts`

Required refs/state:
- `cardControllersBySeriesId`
- `visibleSeriesOrder[]`
- `emptyStateEl`
- optional `parkedCardContainer`

## State-Change Procedure Map (Minimal-Update Requirements)

| Trigger | Current entry points | Current behavior | Required minimal-update behavior |
| --- | --- | --- | --- |
| Sort/filter/layout/aud/genre control change | `extension/src/Runtime/CuratedInteractionsControls.ts` | settings mutate + `renderCuratedPanel()` | recompute ordering/visibility only; patch existing card refs; no descendant lookup |
| Tab switch (`Crunchyroll`/`Curated`) | `extension/src/Runtime/InterfaceShell.ts` | apply tab UI + optional render | use stored host/panel refs only; no shell re-query for owned nodes |
| Data load start/finish/fail | `extension/src/Runtime/CuratedLoader.ts`, `extension/src/Runtime/CuratedLoaderLoadCycle.ts` | state updates + render calls | keep cards stable; patch changed fields only; no create/remove unless entity truly changes |
| Deferred metadata chunk completion | `extension/src/Runtime/CuratedLoaderDeferredMetadata.ts` | repeated render while metadata enriches | patch in-place by controller refs; prioritize via controller order, not `querySelectorAll` |
| Render pass | `extension/src/Runtime/CuratedPanel.ts` | rebuild renderables + grid runtime | card/component patches must be idempotent and lookup-free |
| Favorite/remove card action | `extension/src/Runtime/CuratedInteractions.ts` + `CuratedPanelGrid.ts` | mutate entry + rerender | update button through stored `favoriteButtonEl`; avoid selector search |
| Loading indicator refresh | `extension/src/Runtime/CuratedPanelLoadingIndicator.ts` | ensures nodes via class-token scans | patch fixed `details/progress/requests` refs |
| Health checks/recovery | `extension/src/Runtime/WatchlistHealth.ts`, `BootstrapGate.ts` | mixed root + owned lookups | root/native lookups only; owned checks use state refs |

## Transformation Phases

### Phase 1: Type and contract foundation

Files:
- `extension/src/Ui/CuratedCardShell.ts`
- `extension/src/Ui/CuratedCardView.ts`
- `extension/src/Runtime/CuratedInteractions.ts`
- `extension/src/Runtime/CuratedPanelGrid.ts`

Tasks:
- Define `CuratedCardComponent` and `CuratedCardRefs` types.
- Make card create path return refs alongside root element.
- Store component refs in `CuratedCardController`.

Completion criteria:
- No `findElementByClassTokenWithin` in card shell/view.

### Phase 2: Card body + histogram refactor

Files:
- `extension/src/Ui/CuratedCardView.ts`

Tasks:
- Replace histogram row/part class searches with fixed refs.
- Remove class-token loops for row visibility and missing-state handling.

Completion criteria:
- No class-token child search in card body patch path.

### Phase 3: Action button and media patch refactor

Files:
- `extension/src/Runtime/CuratedInteractions.ts`
- `extension/src/Runtime/CuratedPanelGrid.ts`
- `extension/src/Ui/CuratedCardShell.ts`

Tasks:
- Expose `favoriteButtonEl`/`removeButtonEl` refs via card component.
- Remove grid favorite `querySelector` patch path.
- Remove media image/placeholder/progress lookup scans.

Completion criteria:
- Favorite/media patching is direct-ref only.

### Phase 4: Loading indicator componentization

Files:
- `extension/src/Runtime/CuratedPanelLoadingIndicator.ts`
- `extension/src/Runtime/InterfaceShell.ts`
- `extension/src/Ui/ControlsView.ts`

Tasks:
- Create fixed loading detail nodes once.
- Pass `loadingBoxEl` and loading refs explicitly.
- Remove duplicate cleanup class scans.

Completion criteria:
- No lookup helper in loading indicator runtime.

### Phase 5: Grid/transitions identity cleanup

Files:
- `extension/src/Runtime/CuratedPanelGrid.ts`
- `extension/src/Runtime/CuratedPanelGridTransitions.ts`

Tasks:
- Remove class-based card detection.
- Track explicit card identity via controller refs/order arrays.
- Track explicit empty-state ref instead of class checks.

Completion criteria:
- Grid/transitions no longer infer card type from class names.

### Phase 6: Metadata and health integration

Files:
- `extension/src/Runtime/CuratedLoaderDeferredMetadata.ts`
- `extension/src/Runtime/WatchlistHealth.ts`

Tasks:
- Replace document card query with controller/visible order source.
- Replace owned shell checks with state refs.

Completion criteria:
- No owned-element selector lookups outside root/native exceptions.

## Validation and Gates

Required checks after each phase:
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test:unit`
- `npm run test:e2e`

Additional targeted checks:
- Unit tests asserting stable node identity for card media/body/action refs across sort/filter/metadata updates.
- Unit tests for loading indicator patching without node recreation.
- E2E path: rapid sort/filter toggles + favorite toggle + deferred metadata updates with no image flicker and no multi-second lag.

## Tracking Matrix

| Work item | Status | Owner files |
| --- | --- | --- |
| Card reuse + no full rebuild baseline | Completed | `extension/src/Runtime/CuratedPanelGrid.ts` |
| Transition skip + large-grid animation guard | Completed | `extension/src/Runtime/CuratedPanelGridTransitions.ts` |
| DOM lifecycle counters + debug stats + health churn warning | Completed | `extension/src/Runtime/RuntimeStore.ts`, `extension/src/Runtime/DebugApi.ts`, `extension/src/Runtime/WatchlistHealth.ts` |
| Owned selector removal in card shell/view | Completed | `extension/src/Ui/CuratedCardShell.ts`, `extension/src/Ui/CuratedCardView.ts` |
| Owned selector removal in loading indicator | Completed | `extension/src/Runtime/CuratedPanelLoadingIndicator.ts` |
| Favorite/action direct refs | Completed | `extension/src/Runtime/CuratedInteractions.ts`, `extension/src/Runtime/CuratedPanelGrid.ts` |
| Grid/transitions class-token type checks removal | Completed | `extension/src/Runtime/CuratedPanelGrid.ts`, `extension/src/Runtime/CuratedPanelGridTransitions.ts` |
| Deferred metadata card query removal | Completed | `extension/src/Runtime/CuratedLoaderDeferredMetadata.ts` |
| Health owned-query cleanup | Completed | `extension/src/Runtime/WatchlistHealth.ts` |

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Ref contract drift between shell/view/interactions | broken patches | single `CuratedCardRefs` type source + unit tests |
| Hidden coupling to CSS class names | regressions on rename | refs-based wiring; classes only for styling |
| Over-patching from high render frequency | lag on sort/filter | guard by per-field signatures + scheduler batching already in place |
| Behavior regressions during migration | user-visible breakage | phase-by-phase rollout with unit+e2e after each phase |

## Immediate Next Implementation Slice

1. Add telemetry around render-coalescing latency and patch batch sizes.
2. Expand perf-budget coverage to deferred-metadata-heavy fixtures.
3. Continue shrinking runtime-local alias types in favor of shared owner contracts.
