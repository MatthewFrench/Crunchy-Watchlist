# UI DOM State Architecture Overhaul

## 1. Purpose

This document defines the refactor required to make curated-watchlist UI updates cheap, stable, and identity-preserving.

Primary mandate:

- Create once.
- Update in place.
- Reorder without rebuilding.
- Hide/park rather than delete for routine removal paths.
- Delete only when elements are provably no longer needed.

This aligns with the repository policy in [`AGENTS.md`](../AGENTS.md) under **DOM Rendering Policy (Non-Negotiable)**.

## 2. Current State Snapshot

### Completed

- [x] Card identity reuse exists by `seriesId` when signatures match in `extension/src/Runtime/CuratedPanelGrid.ts`.
- [x] Card runtime now supports in-place patching via `patchCuratedCard(...)` and grid reuse on signature changes in:
  - `extension/src/Ui/CuratedCardShell.ts`
  - `extension/src/Ui/CuratedCardView.ts`
  - `extension/src/Ui/CardMetadata.ts`
  - `extension/src/Runtime/CuratedPanelGrid.ts`
  - `extension/src/Runtime/CuratedPanel.ts`
  - `extension/src/Runtime/ContentComposition.ts`
  - `extension/src/Runtime/ContentCompositionRuntimeBindings.ts`
- [x] Grid transitions skip no-op reorder work and disable animation above threshold in `extension/src/Runtime/CuratedPanelGridTransitions.ts`.
- [x] Clone-based exit overlays were removed; transitions now animate only live grid nodes in `extension/src/Runtime/CuratedPanelGridTransitions.ts`.
- [x] Filtered-out cards now transition into a parked reuse pool (instead of delete/recreate) with cap/age disposal in `extension/src/Runtime/CuratedPanelGrid.ts`.
- [x] Park/unpark lifecycle state class is now explicit via `.cw-curated-card--parked` in:
  - `extension/src/Runtime/CuratedPanelGrid.ts`
  - `extension/Content.css`
- [x] Grid signatures now use compact revision keys (hashed visible entry revisions) instead of full `visible` JSON payload serialization in `extension/src/Runtime/CuratedPanel.ts`.
- [x] Central render coalescing now exists through queued panel render requests (`requestCuratedPanelRender`) in:
  - `extension/src/Runtime/CuratedPanel.ts`
  - `extension/src/Runtime/ContentCompositionRuntimeBindings.ts`
- [x] Grid rendering now uses `seriesId`-keyed `CuratedCardController` ownership with controller diff + reorder-only rendering in `extension/src/Runtime/CuratedPanelGrid.ts`.
- [x] Controller lifecycle counters (`created`, `patched`, `parked`, `unparked`, `disposed`, `renderPasses`) are now tracked on runtime state in:
  - `extension/src/Runtime/RuntimeStore.ts`
  - `extension/src/Runtime/CuratedPanelGrid.ts`
- [x] Identity-churn health warning checks now run from watchlist health runtime in `extension/src/Runtime/WatchlistHealth.ts`.
- [x] Debug runtime now exposes curated DOM lifecycle diagnostics via `getCuratedDomStats()` in:
  - `extension/src/Runtime/DebugApi.ts`
  - `extension/src/Runtime/BootstrapFinalize.ts`
- [x] No-op state-write guards now short-circuit unchanged setting/entry mutations in:
  - `extension/src/Runtime/CuratedInteractionsControls.ts`
  - `extension/src/Runtime/BootstrapHelpers.ts`
- [x] Deferred metadata loading now preserves metadata-loading semantics while background chunks run in:
  - `extension/src/Runtime/CuratedLoaderDeferredMetadata.ts`
  - `extension/src/Runtime/CuratedLoaderLoadCycle.ts`
  - `extension/src/Runtime/CuratedPanel.ts`
  - `extension/src/Runtime/RuntimeStore.ts`
  - `extension/src/Runtime/RouteLifecycle.ts`
- [x] Renderable memoization exists in `extension/src/Runtime/ContentCompositionRuntimeBindings.ts` (`buildRenderableEntries` memo keying).

### Hardening Follow-up (Completed)

- [x] Add perf benchmarks for sort/filter/metadata settle regressions (`tests/Unit/Runtime/CuratedPerfBudget.test.ts`, `npm run test:perf:budgets`).
- [x] Add strict owned-DOM lookup CI guard for runtime/UI modules (`scripts/guard-owned-dom-lookups.mts`, `npm run guard:dom-lookups`).
- [x] Centralize shared UI component ref contracts in `extension/Types/ContentCompositionTypes.d.ts` and consume them across owner modules.

## 3. Refactor Goals

1. **Identity stability**
   - Keep `article.cw-curated-card` and child media nodes stable for each `seriesId`.

2. **Minimal writes**
   - Only mutate changed fields/attributes/classes/styles.
   - Never rewrite `img.src` unless URL changed.

3. **Lifecycle separation**
   - Differentiate `active`, `parked`, and `disposed`.
   - Routine removal is `parked`, not deleted.

4. **Deterministic rendering**
   - Separate order updates from content updates.
   - Separate data recompute from DOM patch.

5. **No rebuild-driven transitions**
   - Remove clone-based exit strategy for normal updates.

6. **Testable guarantees**
   - Unit tests must assert node identity stability through sort/filter/metadata changes.

## 4. Scope and File Inventory

## 4.1 Composition and Wiring

- `extension/src/Runtime/ContentComposition.ts`
- `extension/src/Runtime/ContentCompositionRuntimeBindings.ts`

Responsibility:

- Wires runtimes for renderable computation, card construction, panel rendering, interactions, loader, and shell.

## 4.2 UI Construction Owners

- `extension/src/Ui/ControlsView.ts`
- `extension/src/Ui/CuratedCardShell.ts`
- `extension/src/Ui/CuratedCardView.ts`
- `extension/src/Ui/CardMetadata.ts`

Responsibility:

- Creates controls, card shell/media/header, card body/details, rating badge/histogram metadata nodes.

## 4.3 Runtime DOM Owners

- `extension/src/Runtime/InterfaceShell.ts`
- `extension/src/Runtime/InterfaceShellHostLifecycle.ts`
- `extension/src/Runtime/CuratedPanel.ts`
- `extension/src/Runtime/CuratedPanelGrid.ts`
- `extension/src/Runtime/CuratedPanelGridTransitions.ts`
- `extension/src/Runtime/CuratedPanelLoadingIndicator.ts`
- `extension/src/Runtime/NativeBridgePreview.ts`
- `extension/src/Runtime/CuratedInteractions.ts`
- `extension/src/Runtime/CuratedInteractionsControls.ts`

Responsibility:

- Mount/unmount shell, update controls/loading/grid, reorder cards, transitions, previews, and action wiring.

## 4.4 Runtime State and Data Flow Owners

- `extension/src/Runtime/RuntimeStore.ts`
- `extension/src/Runtime/StateLoader.ts`
- `extension/src/Runtime/CuratedLoader.ts`
- `extension/src/Runtime/CuratedLoaderLoadCycle.ts`
- `extension/src/Runtime/CuratedLoaderDeferredMetadata.ts`
- `extension/src/Runtime/CuratedLoaderPendingRequests.ts`
- `extension/src/Runtime/CuratedRenderable.ts`
- `extension/src/Runtime/CuratedRenderableListProcessing.ts`
- `extension/src/Runtime/CuratedRenderableMergeSupport.ts`
- `extension/src/Runtime/BootstrapHelpers.ts`
- `extension/src/Runtime/RouteLifecycle.ts`

Responsibility:

- State initialization, loader phases, derived renderables, sort/filter procedures, and lifecycle triggers.

## 4.5 Styling/Selectors

- `extension/Content.css`

Responsibility:

- All class-driven visual states and data-attribute selectors.

## 4.6 Test Owners to Update

- `tests/Unit/Runtime/CuratedPanel.test.ts`
- `tests/Unit/Runtime/CuratedPanelGridTransitions.test.ts`
- `tests/Unit/Ui/CuratedCardShell.test.ts`
- `tests/UiBehavior.spec.ts`

## 5. UI Element Inventory (Research Baseline)

This is the curated UI element inventory currently in play.

## 5.1 Shell and Layout

- `.cw-host`
- `.cw-tabs`, `.cw-tab`, `.cw-tab--active`
- `.cw-panel`
- `.cw-curated-grid`
- `.cw-watchlist-frame`
- `.cw-empty`
- `[data-cw-prev-display]` marker for native visibility restoration

Owners:

- `InterfaceShell.ts`
- `InterfaceShellHostLifecycle.ts`
- `ContentRuntimeBootstrapDomLock.ts`

## 5.2 Controls

- `.cw-controls`, `.cw-controls__row`, `.cw-controls__field`, `.cw-controls__field--grow`
- `.cw-controls__refresh`
- `.cw-controls__stats`
- `.cw-button`, `.cw-button--primary`
- `.cw-loading`, `.cw-loading-indicator`, `.cw-loading__heading`, `.cw-loading__label`, `.cw-spinner`

IDs:

- `#cw-watch-ready-mode`
- `#cw-landscape-cards`
- `#cw-audio-filter`
- `#cw-genre-filter`
- `#cw-sort-mode`
- `#cw-secondary-sort-mode`

Owners:

- `ControlsView.ts`
- `CuratedInteractionsControls.ts`
- `CuratedPanel.ts`
- `CuratedPanelLoadingIndicator.ts`

## 5.3 Card Container and Base State

- `.cw-curated-card`
- `.cw-curated-card--clickable`
- `.cw-curated-card--not-watch-ready`
- `.cw-curated-card--entering`
- `.cw-curated-card--leaving`
- `.cw-curated-card--parked`
- `[data-cw-series-id]`
- `[data-cw-card-content-signature]`
- `[data-cw-loading-details]`
- `[data-cw-curated-title]`

Owners:

- `CuratedCardShell.ts`
- `CuratedPanelGrid.ts`
- `CuratedPanelGridTransitions.ts`

## 5.4 Card Header and Media

- `.cw-curated-card__header`
- `.cw-curated-card__title`
- `.cw-curated-card__media`
- `.cw-curated-card__thumb`
- `.cw-curated-card__thumb--loading`
- `.cw-curated-card__thumb--loaded`
- `.cw-curated-card__thumb--failed`
- `.cw-curated-card__thumb-loading`
- `.cw-curated-card__thumb-progress`
- `.cw-curated-card__thumb-progress-fill`
- `.cw-curated-card__placeholder`
- `.cw-curated-card__preview`
- `.cw-curated-card__preview-image`
- `.cw-curated-card__preview-video`
- `.cw-curated-card__thumb--previewing`

Owners:

- `CuratedCardShell.ts`
- `NativeBridgePreview.ts`

## 5.5 Card Body and Detail Rows

- `.cw-curated-card__body`
- `.cw-curated-card__description`
- `.cw-curated-card__status`
- `.cw-curated-card__last-watched`
- `.cw-curated-card__scope`
- `.cw-curated-card__genres`
- `.cw-curated-card__value`
- `.cw-curated-card__next`
- `.cw-curated-card__details-skeleton`
- `.cw-curated-card__details-skeleton-line`
- `.cw-curated-card__details-skeleton-line--status`
- `.cw-curated-card__details-skeleton-line--last-watched`
- `.cw-curated-card__details-skeleton-line--scope`
- `.cw-curated-card__details-skeleton-line--genres`
- `.cw-curated-card__details-skeleton-line--star-row`
- `.cw-curated-card__details-skeleton-line--star-row-5`
- `.cw-curated-card__details-skeleton-line--star-row-4`
- `.cw-curated-card__details-skeleton-line--star-row-3`
- `.cw-curated-card__details-skeleton-line--star-row-2`
- `.cw-curated-card__details-skeleton-line--star-row-1`
- `.cw-curated-card__details-skeleton-line--rating-meta`
- `[data-cw-last-watched-state]`
- `[data-cw-empty="true"]`

Owners:

- `CuratedCardView.ts`
- `CardMetadata.ts`

## 5.6 Ratings and Histogram

- `.cw-rating-badge`
- `.cw-rating-badge--headline`
- `.cw-rating-histogram`
- `.cw-rating-histogram__missing`
- `.cw-rating-row`
- `.cw-rating-row__label`
- `.cw-rating-row__track`
- `.cw-rating-row__fill`
- `.cw-rating-row__percentage`
- `.cw-rating-row__count`
- `[data-cw-rating-state="ok|missing"]`

Owners:

- `CardMetadata.ts`
- `CuratedCardShell.ts`

## 5.7 Actions

- `.cw-curated-card__actions`
- `.cw-curated-card__actions-row`
- `.cw-curated-card__rating-meta`
- `.cw-card-action`
- `.cw-card-action--favorite`
- `.cw-card-action--remove`
- `[data-cw-action="favorite|remove"]`

Owners:

- `CuratedInteractions.ts`
- `CuratedPanelGrid.ts` (favorite button patching)

## 5.8 Loading Box and Request Diagnostics

- `.cw-loading-box`
- `.cw-loading-box__title`
- `.cw-loading__details`
- `.cw-loading__details-title`
- `.cw-loading__progress`
- `.cw-loading__requests`
- `.cw-loading__request`

Owners:

- `InterfaceShell.ts`
- `CuratedPanelLoadingIndicator.ts`

## 5.9 Runtime Ownership and Bootstrapping Attributes

- `[data-cw-runtime-owner]`
- `[data-cw-runtime-owner-ts]`
- `.cw-runtime-takeover-request`
- `[data-cw-transition-clone]`
- `[data-cw-native-action="favorite|remove"]` (bridge selector contract for native card controls)

Owners:

- `ContentRuntimeBootstrapDomLock.ts`
- `ContentRuntimeBootstrapHelpers.ts`
- `CuratedPanelGridTransitions.ts`
- `NativeActionBridge.ts`

## 6. State Mutation Inventory and Minimal-Update Requirements

## 6.1 Curated UI State Fields

Fields:

- `state.settings.*`
- `state.curatedEntries`
- `state.curatedInflight`
- `state.curatedDeferredMetadataInFlight`
- `state.curatedPendingRequests`
- `state.curatedPendingRequestStartedCount`
- `state.curatedPendingRequestCompletedCount`
- `state.curatedError`
- `state.curatedSource`
- `state.curatedLastRevalidateAt`
- `state.curatedObservedPromise`
- `state.curatedInitialLoadDone`
- `state.curatedGridRenderSignature`
- shell refs (`hostEl`, `gridEl`, `statsEl`, control refs, etc.)

Mutation owners:

- Loader path: `CuratedLoader.ts`, `CuratedLoaderLoadCycle.ts`, `CuratedLoaderDeferredMetadata.ts`, `CuratedLoaderPendingRequests.ts`
- Controls/actions path: `CuratedInteractionsControls.ts`, `CuratedInteractions.ts`, `BootstrapHelpers.ts`
- Shell/lifecycle path: `InterfaceShell.ts`, `InterfaceShellHostLifecycle.ts`, `RouteLifecycle.ts`, `StateLoader.ts`

## 6.2 Required behavior for each mutation category

1. Settings mutation (`sortMode`, filters, layout, tab)
   - Requirement: no-op write guard if value unchanged.
   - Requirement: no full card recreation due to settings-only change.

2. `curatedEntries` mutation
   - Requirement: entry-level diff by `seriesId`.
   - Requirement: existing card nodes patched in place.
   - Requirement: removed entries transition to `parked`, not immediate delete.

3. Loader progress mutation
   - Requirement: update loading UI only; avoid touching card internals unless needed.

4. Shell lifecycle mutation
   - Requirement: host shell remains stable across watchlist churn whenever possible.
   - Requirement: unmount disposes only when route/session invalidates ownership.

5. Grid signature mutation
   - Requirement: replace broad JSON signature with structured revision keys.
   - Requirement: isolate reorder triggers from content-patch triggers.

## 6.3 Full Runtime State Surface (From `RuntimeStore.ts`)

Lifecycle/process control:

- `mounted`, `observer`, `routeWatcherStarted`, `routeSyncTimer`, `processTimer`
- `saveRatingsTimer`, `saveWatchHistoryTimer`, `saveWatchlistCacheTimer`
- `mutationMuted`

Settings and UI selection:

- `settings.activeTab`
- `settings.watchReadyFilterMode`
- `settings.cardLayout`
- `settings.audioLocaleFilter`
- `settings.genreFilter`
- `settings.sortMode`
- `settings.secondarySortMode`

Data/cache revision and inflight:

- `ratingCache`, `ratingCacheRevision`, `ratingInflight`, `ratingLocalePreloadInflight`
- `watchHistoryCache`, `watchHistoryStatus`, `watchHistoryInflight`, `watchHistoryLocalePreloadInflight`
- `watchlistCache`
- `previewCache`, `previewInflight`
- `authToken`, `authTokenInflight`
- `preferredAudioLanguage`, `preferredAudioLanguageUpdatedAt`

Curated list and render signaling:

- `curatedEntries`, `curatedError`, `curatedSource`
- `curatedInflight`, `curatedDeferredMetadataInFlight`, `curatedInitialLoadDone`
- `curatedPendingRequests`, `curatedPendingRequestStartedCount`, `curatedPendingRequestCompletedCount`
- `curatedObservedPromise`, `curatedLastRevalidateAt`, `curatedGridRenderSignature`

DOM host references:

- `hostEl`, `tabCrunchyrollEl`, `tabCuratedEl`, `curatedPanelEl`
- `controlsEl`, `loadingIndicatorEl`, `audioFilterSelectEl`, `genreFilterSelectEl`
- `statsEl`, `gridEl`
- `framedRootEl`, `nativeHiddenNodes`

State fields that can trigger wide UI churn today:

- `settings.*` changes (controls)
- `curatedEntries` replacement arrays (favorite/remove/load commits)
- `curatedDeferredMetadataInFlight` toggles
- `curatedPendingRequests*` progress updates
- `curatedGridRenderSignature` invalidation

## 7. Current Update Procedures (As-Is)

## 7.1 Control-change path

- User changes select/checkbox.
- `CuratedInteractionsControls.ts` mutates `state.settings`, persists, calls `renderCuratedPanel()`.
- `CuratedPanel.ts` recomputes visible list and grid signature, updates select options, loading indicator, grid.

Cost hot spots:

- `buildRenderableEntries(...)` can be heavy on large lists.
- broad signature invalidation can force card recreation path.

## 7.2 Loader path

- `ensureCuratedDataLoad` -> load cycle -> partial commit -> metadata preloads -> final commit -> background metadata chunks.
- Re-renders occur at multiple phase boundaries.

Cost hot spots:

- repeated render invocations while metadata settles.
- if card content signature differs, recreation path can trigger.

## 7.3 Interaction path (favorite/remove)

- action button handler -> native action -> mutate `state.curatedEntries` via `BootstrapHelpers.ts` -> `renderCuratedPanel()`.

Cost hot spots:

- entry array map/filter rewrites entire array references.
- downstream render can recalc/sort/filter full list.

## 7.4 Tab + Shell Lifecycle Path

- tab click -> `InterfaceShell.ts` `setActiveTabInternal(...)` updates `settings.activeTab` -> `persistSettings()` -> `applyTabUi()`.
- `applyTabUi()` toggles `.cw-tab--active`, `aria-selected`, and `curatedPanel.style.display`.
- `InterfaceShellHostLifecycle.ts` hides/restores native Crunchyroll nodes via `[data-cw-prev-display]` and `nativeHiddenNodes`.
- route churn (`RouteLifecycle.ts`) can trigger `unmountInternal()` which currently removes `hostEl` and nulls all shell refs.

Cost hot spots:

- shell teardown/remount loses transient UI state unless explicitly preserved.
- unmount path still performs hard DOM removal for host shell.

## 7.5 Pending Request Diagnostics Path

- tracked request wrappers in `CuratedLoaderPendingRequests.ts` mutate:
  - `curatedPendingRequests`
  - `curatedPendingRequestStartedCount`
  - `curatedPendingRequestCompletedCount`
- these trigger `refreshCuratedLoadingIndicator()` and mutate `.cw-loading__progress`/`.cw-loading__requests`.

Cost hot spots:

- repeated request progress writes can cause frequent loading-node text/list updates during load bursts.

## 7.6 Deferred Metadata Progress Path

- deferred chunks (`CuratedLoaderDeferredMetadata.ts`) toggle `curatedDeferredMetadataInFlight`.
- throttled progress renderer calls `renderCuratedPanel()` roughly every 180ms while chunks complete.

Cost hot spots:

- repeated panel renders during chunking can still evaluate grid-signature and card-refresh pathways.

## 7.7 Preview Hover Path

- `NativeBridgePreview.ts` creates preview image/video nodes lazily once, then updates `src`/visibility/classes.
- preview state toggles `.cw-curated-card__thumb--previewing` and image opacity on base thumb image.

Cost hot spots:

- if card node identity is not stable, preview media buffers and hover callbacks are repeatedly rebuilt.

## 8. Target Architecture (To-Be)

## 8.1 Card Controller Layer

Introduce `CardController` keyed by `seriesId`:

- `create(entry)` once
- `patch(entry, patchMask)` in place
- `setVisibility(active|parked)`
- `dispose()`

Owned refs:

- `root`, `thumbLink`, `thumbImage`, `previewImage`, `previewVideo`, `progressFill`, `statusEl`, `genresEl`, `ratingMetaEl`, action buttons.

## 8.2 Element Lifecycle States

- `active`: rendered and ordered in grid.
- `parked`: detached or hidden in parking area; listeners/refs retained.
- `disposed`: listeners removed, references released.

Parking strategy:

- use `DocumentFragment` or hidden parking container as recycle pool.
- reattach parked nodes on filter/sort reappearance.

Deletion policy:

- allow disposal only on:
  - route unmount/teardown
  - account/profile scope reset
  - explicit hard refresh reset
  - stale parked entries beyond configured cap/TTL

## 8.3 Patch-Only Render Pipeline

Split render into deterministic stages:

1. Compute derived model revision.
2. Diff keys (`seriesId`) to determine add/patch/park/unpark/reorder.
3. Patch visible controllers in place.
4. Reorder active nodes with minimal DOM moves.
5. Update shell/controls/loading/stats separately.

No stage may replace an existing card node for routine metadata updates.

## 8.4 Transition Strategy Without Clones

Replace clone overlay exits:

- use class toggles on existing nodes.
- if a card leaves visible set, transition to parked state with CSS state class.
- perform move animations only on active nodes and only when order changed.

## 8.5 Render Scheduling

Introduce render queue:

- coalesce multiple triggers in same task/frame.
- dedupe by reason and model revision.
- prioritize user interactions over telemetry/loading cosmetics.

## 8.6 Derived Data Caching

Keep current memoization but strengthen:

- cache merged entries by `entryRevision + ratingRevision + watchHistoryRevision + selected filters/sort`.
- avoid repeated `JSON.stringify(visible)` signatures.
- maintain stable decorated objects when no field changes.

## 9. Phased Execution Plan

## Phase 0: Policy and baseline

- [x] Add DOM policy to `AGENTS.md`.
- [x] Stabilize deferred metadata loading semantics.
- [x] Transition skip/threshold safeguards.

## Phase 1: Controller introduction

Files:

- `extension/src/Runtime/CuratedPanelGrid.ts`
- `extension/src/Ui/CuratedCardShell.ts`
- `extension/src/Ui/CuratedCardView.ts`
- `extension/src/Ui/CardMetadata.ts`
- `extension/src/Runtime/NativeBridgePreview.ts`

Tasks:

- [x] Add controller map keyed by `seriesId`.
- [x] Extract first-pass card patch methods per subsection in `CuratedCardShell.ts` and wire through grid render runtime.
- [x] Ensure `img.src` guarded by equality check.
- [x] Keep existing listeners; no rebinding on patch.

## Phase 2: Park/unpark lifecycle

Files:

- `extension/src/Runtime/CuratedPanelGrid.ts`
- `extension/src/Runtime/InterfaceShell.ts`
- `extension/src/Runtime/InterfaceShellHostLifecycle.ts`

Tasks:

- [x] Add parked-node container/pool.
- [x] Convert filtered-out path from remove/delete to park.
- [x] Implement disposal policy (TTL, cap, teardown events).

## Phase 3: Transition rewrite

Files:

- `extension/src/Runtime/CuratedPanelGridTransitions.ts`
- `extension/Content.css`

Tasks:

- [x] Remove clone-node exit animation path.
- [x] Keep reorder moves only; animate existing nodes.
- [x] Add transition state classes for park/unpark.

## Phase 4: Signature and scheduling

Files:

- `extension/src/Runtime/CuratedPanel.ts`
- `extension/src/Runtime/CuratedRenderable.ts`
- `extension/src/Runtime/CuratedRenderableListProcessing.ts`
- `extension/src/Runtime/ContentCompositionRuntimeBindings.ts`

Tasks:

- [x] Replace full `visible` serialization signatures with compact revision keys.
- [x] Add render scheduler/coalescer for repeated `renderCuratedPanel()` calls.
- [x] Add no-op state-write guards before persist/render.

## Phase 5: Hardening and diagnostics

Files:

- `extension/src/Runtime/WatchlistHealth.ts`
- `extension/src/Runtime/DebugApi.ts`
- tests

Tasks:

- [x] Add debug counters: created/parked/unparked/disposed/patched.
- [x] Add health checks for identity churn rate.
- [x] Add regression perf benchmarks (sort/filter/metadata settle).

## 10. Test Strategy

Unit:

- identity stability across rerenders:
  - sort change
  - filter change
  - metadata updates
  - favorite toggle
- ensure no `img.src` rewrite when unchanged
- park/unpark reuse behavior

E2E (Playwright):

- no visible image blink during metadata enrichment
- sort latency bounded under large fixture
- filter toggles preserve scroll/focus/hover state

Quality gates:

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test:unit`
- focused `npm run test:e2e:chromium -- ...` for changed paths
- full CI gates before merge

## 11. Key Considerations and Constraints

1. MutationObserver safety
   - Use `withMutedObserver` around controlled DOM writes.

2. Accessibility state preservation
   - keep `aria-*` and focus state stable on patches.

3. Preview media handling
   - preserve preview nodes; avoid recreating video/image buffers.

4. Memory control
   - parked pools need cap/TTL and explicit disposal hooks.

5. Data consistency under async updates
   - loader phase changes and control changes can overlap; scheduler must serialize patch application per revision.

6. Extension host volatility
   - Crunchyroll DOM churn may temporarily detach host root; park/dispose logic must handle reconnect safely.

## 12. Completion Criteria

Refactor is complete when all are true:

- No routine card node recreation for metadata/filter/sort/favorite updates.
- No clone-based exit nodes in normal paths.
- Filter removal uses park/unpark lifecycle.
- Profile traces show reduced layout/paint churn during sort and metadata settle.
- Tests explicitly assert node identity stability.

## 13. Immediate TODO Backlog

- [x] Create `CardController` interface and runtime owner (inside `CuratedPanelGrid.ts`).
- [x] Add per-section patch functions:
  - media patch
  - text/status patch
  - rating/histogram patch
  - action patch
- [x] Change `CuratedPanelGrid` to controller diff and reorder only.
- [x] Introduce parked pool and disposal policy.
- [x] Remove clone exit transition path.
- [x] Introduce compact render revision keys in `CuratedPanel`.
- [x] Add render coalescing scheduler.
- [x] Add unit/e2e regressions for blink and latency.
- [x] Add CI-enforced owned selector guard and perf-budget checks.

## 14. Exhaustive Selector Registry (Audited 2026-02-27)

Audit method:

- `rg` inventory over `extension/src/Ui/**`, `extension/src/Runtime/**`, and `extension/Content.css`.
- grouped into class selectors, data attributes, and control IDs.

Class selectors:

- `.cw-button`
- `.cw-button--primary`
- `.cw-card-action`
- `.cw-card-action--favorite`
- `.cw-card-action--remove`
- `.cw-controls`
- `.cw-controls__field`
- `.cw-controls__field--grow`
- `.cw-controls__refresh`
- `.cw-controls__row`
- `.cw-controls__stats`
- `.cw-curated-card`
- `.cw-curated-card--clickable`
- `.cw-curated-card--entering`
- `.cw-curated-card--leaving`
- `.cw-curated-card--parked`
- `.cw-curated-card--not-watch-ready`
- `.cw-curated-card__actions`
- `.cw-curated-card__actions-row`
- `.cw-curated-card__body`
- `.cw-curated-card__description`
- `.cw-curated-card__details-skeleton`
- `.cw-curated-card__details-skeleton-line`
- `.cw-curated-card__details-skeleton-line--genres`
- `.cw-curated-card__details-skeleton-line--last-watched`
- `.cw-curated-card__details-skeleton-line--rating-meta`
- `.cw-curated-card__details-skeleton-line--scope`
- `.cw-curated-card__details-skeleton-line--star-row`
- `.cw-curated-card__details-skeleton-line--star-row-1`
- `.cw-curated-card__details-skeleton-line--star-row-2`
- `.cw-curated-card__details-skeleton-line--star-row-3`
- `.cw-curated-card__details-skeleton-line--star-row-4`
- `.cw-curated-card__details-skeleton-line--star-row-5`
- `.cw-curated-card__details-skeleton-line--status`
- `.cw-curated-card__genres`
- `.cw-curated-card__header`
- `.cw-curated-card__last-watched`
- `.cw-curated-card__media`
- `.cw-curated-card__next`
- `.cw-curated-card__placeholder`
- `.cw-curated-card__preview`
- `.cw-curated-card__preview-image`
- `.cw-curated-card__preview-video`
- `.cw-curated-card__rating-meta`
- `.cw-curated-card__scope`
- `.cw-curated-card__status`
- `.cw-curated-card__thumb`
- `.cw-curated-card__thumb--failed`
- `.cw-curated-card__thumb--loaded`
- `.cw-curated-card__thumb--loading`
- `.cw-curated-card__thumb--previewing`
- `.cw-curated-card__thumb-loading`
- `.cw-curated-card__thumb-progress`
- `.cw-curated-card__thumb-progress-fill`
- `.cw-curated-card__title`
- `.cw-curated-card__value`
- `.cw-curated-grid`
- `.cw-empty`
- `.cw-host`
- `.cw-loading`
- `.cw-loading-box`
- `.cw-loading-box__title`
- `.cw-loading-indicator`
- `.cw-loading__details`
- `.cw-loading__details-title`
- `.cw-loading__heading`
- `.cw-loading__label`
- `.cw-loading__progress`
- `.cw-loading__request`
- `.cw-loading__requests`
- `.cw-panel`
- `.cw-rating-badge`
- `.cw-rating-badge--headline`
- `.cw-rating-histogram`
- `.cw-rating-histogram__missing`
- `.cw-rating-row`
- `.cw-rating-row__count`
- `.cw-rating-row__fill`
- `.cw-rating-row__label`
- `.cw-rating-row__percentage`
- `.cw-rating-row__track`
- `.cw-runtime-takeover-request`
- `.cw-spinner`
- `.cw-tab`
- `.cw-tab--active`
- `.cw-tabs`
- `.cw-watchlist-frame`

Data attributes:

- `[data-cw-action]`
- `[data-cw-card-content-signature]`
- `[data-cw-card-layout]`
- `[data-cw-curated-title]`
- `[data-cw-empty]`
- `[data-cw-last-watched-state]`
- `[data-cw-loading-details]`
- `[data-cw-native-action]`
- `[data-cw-prev-display]`
- `[data-cw-rating-state]`
- `[data-cw-runtime-owner]`
- `[data-cw-runtime-owner-ts]`
- `[data-cw-series-id]`
- `[data-cw-tab]`
- `[data-cw-transition-clone]`

Control IDs:

- `#cw-watch-ready-mode`
- `#cw-landscape-cards`
- `#cw-audio-filter`
- `#cw-genre-filter`
- `#cw-sort-mode`
- `#cw-secondary-sort-mode`

Non-selector animation/runtime identifiers (must stay stable when refactoring CSS/runtime contracts):

- `@keyframes cw-spin`
- `@keyframes cw-skeleton-shimmer`

## 15. State-Change Procedure Matrix (Current vs Required)

| Procedure | Current mutation(s) | Current DOM impact | Required optimization target |
| --- | --- | --- | --- |
| Watch-ready/layout/audio/genre/sort control change (`CuratedInteractionsControls.ts`) | `state.settings.*` write + persist + immediate `renderCuratedPanel()` | full render pipeline and potential grid churn | add no-op guards, queue render, patch-only updates |
| Refresh button (`CuratedInteractionsControls.ts`, `InterfaceShell.ts`, `CuratedLoader.ts`) | clears curated transient diagnostics, starts force load | loading panel changes + repeated render pass during load | keep cards stable while loading; isolate loading UI updates |
| Favorite action (`CuratedInteractions.ts`, `BootstrapHelpers.ts`) | rewrites `state.curatedEntries` via `map` | may trigger full list recompute | entry-level patch map keyed by `seriesId`; avoid remerge where possible |
| Remove action (`CuratedInteractions.ts`, `BootstrapHelpers.ts`) | rewrites `state.curatedEntries` via `filter` | card removed from active list; may trigger clone exit | park card and preserve controller unless disposal policy triggers |
| Loader partial/final commit (`CuratedLoaderLoadCycle.ts`) | sets `curatedEntries`, `curatedSource`, `curatedError`, timestamps | render from partial then final data; potential recreate path | patch existing cards between phases; only patch changed fields |
| Deferred metadata chunk progress (`CuratedLoaderDeferredMetadata.ts`) | toggles `curatedDeferredMetadataInFlight`; throttled render requests | repeated panel renders during chunk completion | coalesce chunk renders; patch metadata subregions only |
| Pending request tracking (`CuratedLoaderPendingRequests.ts`) | updates `curatedPendingRequests*` counters | updates loading details text/list | keep updates scoped to loading details nodes only |
| Tab switch (`InterfaceShell.ts`) | writes `settings.activeTab` + persist | toggles tab classes/aria; shows/hides curated panel; native hide/show | keep shell/card DOM intact; do not remount cards on tab toggles |
| Route unmount/remount (`RouteLifecycle.ts`) | toggles `mounted`; nulls host refs; currently removes host node | full shell teardown/recreate | park host/panel tree where possible; dispose only on hard lifecycle boundaries |
| Grid render (`CuratedPanel.ts` + `CuratedPanelGrid.ts`) | recompute `visible`, compute signature, set `curatedGridRenderSignature` | reuses by `seriesId` when possible; recreates on signature mismatch | controller diff + patch; remove signature-driven recreate path |
| Grid transition reorder (`CuratedPanelGridTransitions.ts`) | no state write; DOM reorder logic | uses `insertBefore`; clone overlay for leaving cards | class-based exit on real nodes; no clone overlays |
| Native preview hover (`NativeBridgePreview.ts`) | local preview context timers/session, no global state write | preview image/video nodes created lazily, visibility toggled | maintain stable preview nodes across all list updates |
| Shell integrity repair (`InterfaceShell.ts`, `InterfaceShellHostLifecycle.ts`) | shell refs reset if invalid/disconnected | host can be removed and rebuilt | prefer repair-in-place before full shell reset |

This matrix is the implementation contract for “as little updates as possible while maintaining UI state and element identity”.
