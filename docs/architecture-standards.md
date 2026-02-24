# Crunchy Watchlist Curator Architecture Standards

Last updated: 2026-02-24

This document is the architecture contract for this repository. It defines required boundaries, ownership, and quality gates for extension runtime code, build/distribution tooling, and automated tests.

## 1) Scope

Applies to all hand-authored code and docs in:

- `extension/**`
- `scripts/**`
- `tests/**`
- `.github/workflows/**`
- `docs/**`
- `Crunchy Watchlist Curator/**` (Safari wrapper host app + extension bridge)

Exempt from naming/size rules:

- `node_modules/**`
- `dist/**`
- `.tmp/**`
- Xcode user-state artifacts under `**/xcuserdata/**`
- Generated artifacts from Playwright and Xcode build output

## 2) Core Goals

1. Keep extension UI rendering, domain logic, data access, and runtime orchestration separate.
2. Keep all Crunchyroll API contract handling at explicit boundary modules.
3. Keep mutable state owned by explicit modules/services.
4. Keep route lifecycle and DOM mutation deterministic under SPA navigation.
5. Keep build and packaging deterministic across Chrome/Edge/Firefox/Safari.
6. Keep architecture evolution safe with regression tests and migration gates.
7. Move the repository to a TypeScript-first development model without breaking release parity.

## 3) Repository Surface Ownership

- `extension/` owns browser runtime behavior.
- `scripts/` owns artifact creation and local live-debug workflows.
- `tests/` owns fixture server, fixture HTML, and cross-browser behavior contracts.
- `Crunchy Watchlist Curator/` owns Safari macOS/iOS wrapper app/extension bridge only.
- `docs/` owns architecture, operational, release, and endpoint contracts.

Rule: browser behavior must not be implemented in `scripts/` or wrapper app sources.

## 4) Runtime Layers (Target)

The browser extension runtime must follow this logical layering even when code is being migrated.

1. `Runtime/Bootstrap`
   - Mount/unmount decisions
   - Route watchers
   - High-level orchestration only
2. `Runtime/State`
   - Runtime store ownership
   - Settings/session/cache state APIs
3. `DataAccess`
   - Auth token acquisition
   - Watchlist/history/ratings/preview API clients
   - Storage adapters and TTL policy
4. `DomainModel`
   - Normalization
   - Watch-ready determination
   - Scoring/sort/filter computations
5. `UserInterface`
   - View-model to DOM rendering
   - UI events -> typed intents

## 5) Dependency Direction

Allowed dependencies:

- `Runtime/Bootstrap -> Runtime/State, DataAccess, DomainModel, UserInterface`
- `UserInterface -> Runtime/State (read-only selectors), DomainModel (formatters), intent callbacks`
- `DomainModel -> no DOM, no network`
- `DataAccess -> transport/storage helpers only`
- `Runtime/State -> pure helpers and schema/validator modules`

Prohibited dependencies:

- `UserInterface -> fetch/auth/storage directly`
- `DomainModel -> document/window/mutation observers`
- `DataAccess -> DOM selectors or rendering`
- Cross-layer mutation of another module's internal maps/objects

## 6) Composition Roots

Composition roots are the only places where owners are wired together:

- Browser runtime bootstrap: currently `extension/Content.js` init/mount path; target is thin bootstrap entry file.
- Build composition root: `scripts/build-webextensions.mts` and `scripts/build-safari-macos.sh`.
- Live debug composition root: `scripts/live-webkit-watchlist.mts`.
- Test composition root: `tests/*.spec.ts` + fixture server composition (`tests/Server.ts`, `tests/ServerRouter.ts`, `tests/ServerFixtures.ts`, `tests/ServerResponse.ts`).

Rule: composition roots wire modules and call owner APIs; they do not host business logic.

## 7) API Boundary and Contract Rules

1. All untrusted response payloads must be parsed in data-access boundary modules.
2. Contract drift detection must emit structured runtime events.
3. Parser modules must normalize to strict internal shapes before passing values inward.
4. Retry/auth-refresh logic belongs only in transport/auth boundary modules.
5. API path/query construction must be centralized; avoid endpoint strings spread across unrelated modules.

## 8) State and Mutation Ownership Rules

Every mutable state surface must have one explicit owner.

Required ownership map:

- Settings persistence: settings store owner.
- Ratings cache + inflight dedupe maps: ratings repository/cache owner.
- Watch-history cache + locale progress maps: history repository/cache owner.
- Watchlist cache and revalidation timestamps: watchlist repository owner.
- Preview cache + inflight preview state: preview repository owner.
- UI mounted element references and observers: UI runtime owner.

Rules:

- Only owners may mutate their state.
- Non-owners interact via owner APIs returning snapshots/readonly views.
- Module-global mutable objects are allowed only in owner modules and must not be shared by reference.

## 9) Storage and Cache Policy

1. Storage keys are owned constants under one storage key registry.
2. Every persisted object must carry:
   - version
   - updated timestamp
   - schema migration handling
3. TTL must be explicit and co-located with the cache owner.
4. Cache invalidation triggers must be explicit (`manual refresh`, `TTL expiry`, `account mismatch`, `schema version bump`).
5. Fallback to `localStorage` must be isolated in one adapter module.

## 10) UI and DOM Interaction Rules

1. UI modules may render only extension-owned DOM under extension host container.
2. Native Crunchyroll DOM probing/bridging is restricted to dedicated bridge modules.
3. Global observers/listeners must have explicit setup/cleanup ownership.
4. UI controls emit intents; orchestration decides side effects.
5. UI modules must be resilient to missing native selectors and virtualization states.

## 11) Security and Privacy Rules

1. Host permissions and content-script matches must follow least privilege required for current functionality.
2. Auth and account identifiers must never be logged in full in persistent logs.
3. Runtime telemetry/debug traces must be bounded in memory and avoid sensitive payload dumps.
4. No hidden telemetry or external analytics.
5. Security-relevant API/auth behavior changes require updates to:
   - `docs/api-endpoints-reference.md`
   - this architecture standards document

## 12) Build and Distribution Architecture Rules

1. Browser packaging logic remains single-source in `scripts/build-webextensions.mts`.
2. Manifest transformations by browser are centralized in one build module.
3. Safari wrapper packaging remains isolated in `scripts/build-safari-macos.sh`.
4. CI workflow stages must preserve order:
   - verify
   - build artifacts
   - publish release
5. Build output (`dist/**`) is never import/runtime source input.

## 13) Test Architecture Rules

1. Tests are layered:
   - unit/domain tests (Vitest, Node environment, fast feedback)
   - fixture integration tests (Playwright + local server)
   - cross-browser smoke coverage
2. Fixture server contracts are treated as extension boundary contracts.
3. Behavior-changing refactors require test updates in same PR.
4. API contract drift and retry/auth regressions must remain covered.
5. Live WebKit script is diagnostic, not a substitute for automated regression tests.

## 14) TypeScript and Tooling Standards (Target Stack)

1. Source language target:
   - TypeScript for `extension/src/**`, `scripts/**`, and `tests/Helpers/**`.
   - Legacy JavaScript remains temporarily allowed in `extension/Content.js` during migration.
2. Type-safety baseline (target `tsconfig` defaults):
   - `strict: true`
   - `noUncheckedIndexedAccess: true`
   - `exactOptionalPropertyTypes: true`
   - `useUnknownInCatchVariables: true`
   - `noImplicitOverride: true`
   - `noEmitOnError: true`
3. Migration bridge:
   - allow JS ingestion during migration (`allowJs`) but avoid permanent `checkJs: false` islands.
   - no new `// @ts-nocheck` in migrated modules.
4. Runtime boundary typing:
   - API boundary modules must produce typed normalized shapes.
   - Runtime schema validation is required at external payload boundaries (schema-first parsing contract).
5. Lint and formatting standard:
   - Biome is the repository-standard lint/format tool for current migration surfaces.
   - keep one formatter standard across the repo (Biome), not mixed tooling.
   - expand Biome coverage incrementally until full-repo lint/format enforcement is practical.
   - `npm run format:check` must stay green on migration slices.
6. Unit test standard:
   - Vitest is the standard unit-test runner for pure domain/data modules.
   - Decision record: `node:test` was reviewed, but Vitest is preferred here for TS-native ergonomics (`vi` mocks/spies, include globs, watch mode, and cleaner parity with current Playwright/ESM tooling).
   - unit tests should avoid browser globals and run in Node by default.
   - unit suites must execute under `npm run test:unit`.
7. Build standard for TS:
   - transpilation/bundling must be deterministic and local (no remote code generation).
   - packaging scripts consume generated artifacts only from repository-local build outputs.
   - generated runtime outputs must be isolated by workflow (for example `.tmp/extension-runtime-webext`, `.tmp/extension-runtime-safari`, `.tmp/extension-runtime-e2e`) to avoid cross-command races.
   - integration test fixture loaders must consume generated runtime assets only (no implicit fallback to raw TypeScript/JavaScript source trees).
8. Browser API typing:
   - browser extension globals (`browser`, `chrome`, window module registry contracts) must be declared in explicit ambient types (`*.d.ts`) rather than ad hoc `any`.
9. CI target gates once TS bootstrap lands:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run format:check`
   - `npm run test:unit`
   - existing runtime gates (`test:e2e`, `build:webext`, `build:safari`, `arch:metrics`)

## 15) Naming and Size Budgets

These budgets are enforcement triggers.

- Source and test module naming standard: use PascalCase for files/folders under `extension/src/**`, `extension/Types/**`, and `tests/**` (keep root ecosystem anchors lowercase: `extension/`, `extension/src/`, `tests/`, `scripts/`, `docs/`).
- Runtime source file size target: `<= 600` lines (default warning `> 800`, refactor required `> 1200`; temporary composition-root override for `extension/Content.js`: warning `> 1000`, refactor `> 1200`).
- Test spec file size target: `<= 400` lines (warning `> 550`, refactor required `> 750`).
- Function length target: `<= 45` lines (warning `> 70`, refactor required `> 100`).
- Max parameters per exported function: `<= 6` (otherwise use typed object argument).
- Cyclomatic hotspots should be decomposed into named helpers before adding new branches.

## 16) Conformance Review Snapshot (2026-02-24)

Current-state findings from this repository:

1. `extension/Content.js` is at `892` lines (below the next-cycle `< 900` target and under the temporary composition-root warning override), and now delegates baseline ownership to extracted modules loaded before bootstrap:
   - `extension/src/Runtime/RuntimeStore.ts`
   - `extension/src/Runtime/RuntimeTrace.ts`
   - `extension/src/Runtime/StateLoader.ts`
   - `extension/src/Runtime/RouteLifecycle.ts`
   - `extension/src/Runtime/PreferredAudioDetector.ts`
   - `extension/src/Runtime/CuratedRenderable.ts`
   - `extension/src/Runtime/CuratedPanel.ts`
   - `extension/src/Runtime/CuratedLoader.ts`
   - `extension/src/Runtime/CuratedInteractions.ts`
   - `extension/src/Runtime/InterfaceShell.ts`
   - `extension/src/Runtime/NativeBridge.ts`
   - `extension/src/Runtime/DebugApi.ts`
   - `extension/src/Runtime/BootstrapConfig.ts`
   - `extension/src/Runtime/BootstrapHelpers.ts`
   - `extension/src/Runtime/BootstrapFinalize.ts`
   - `extension/src/Runtime/BootstrapModules.ts`
   - `extension/src/Runtime/BootstrapGate.ts`
   - `extension/src/Data/StorageAdapter.ts`
   - `extension/src/Data/ApiContracts.ts`
   - `extension/src/Data/AuthClient.ts`
   - `extension/src/Data/WatchlistClient.ts`
   - `extension/src/Data/WatchlistRepository.ts`
   - `extension/src/Data/RatingsClient.ts`
   - `extension/src/Data/RatingsRepository.ts`
   - `extension/src/Data/HistoryRepositoryCache.ts`
   - `extension/src/Data/HistoryRepositoryPreloadPlanning.ts`
   - `extension/src/Data/HistoryRepositoryPreloadCollector.ts`
   - `extension/src/Data/HistoryRepositoryPreload.ts`
   - `extension/src/Data/HistoryRepository.ts`
   - `extension/src/Data/PreviewRepository.ts`
   - `extension/src/Domain/CorePrimitives.ts`
   - `extension/src/Domain/ImageVariants.ts`
   - `extension/src/Domain/EntryNormalizer.ts`
   - `extension/src/Domain/SortMetrics.ts`
   - `extension/src/Domain/EntrySorting.ts`
   - `extension/src/Ui/ControlsView.ts`
   - `extension/src/Ui/CuratedCardView.ts`
   - `extension/src/Ui/CuratedCardShell.ts`
   - `extension/src/Ui/CardMetadata.ts`
2. Major UI/runtime hotspots were reduced in this refactor sequence:
   - `createCuratedCard`: `458 -> 3` lines
   - `ensureInterface`: `240 -> 3` lines
   - `preloadWatchHistoryForEntries`: `240 -> 84` lines
   - `installCuratedCardPreview`: extracted to `Runtime/NativeBridge` ownership (removed from bootstrap surface)
   - `buildRenderableEntries`: `167 -> 28` lines
3. Additional function-level hotspot reductions completed:
   - `compareRenderableEntries`: `122 -> 29` lines
   - `normalizeEntriesFromApiRows`: `119 -> 23` lines
   - `renderCuratedPanel`: `115 -> 34` lines
   - renderable merge/filter/build ownership extracted from `Content.js` into `extension/src/Runtime/CuratedRenderable.ts` (`Content.js`: `3907 -> 3764`)
   - curated panel/grid/stats/preload rendering ownership extracted from `Content.js` into `extension/src/Runtime/CuratedPanel.ts` (`Content.js`: `3764 -> 3639`)
   - curated loading/revalidation ownership extracted from `Content.js` into `extension/src/Runtime/CuratedLoader.ts` (`Content.js`: `3639 -> 3549`)
   - curated card-actions and control-binding ownership extracted from `Content.js` into `extension/src/Runtime/CuratedInteractions.ts` (`Content.js`: `3549 -> 3463`)
   - image variant normalization/selection ownership extracted from `Content.js` into `extension/src/Domain/ImageVariants.ts` (`Content.js`: `3463 -> 3342`)
   - debug series-data ownership extracted from `Content.js` into `extension/src/Runtime/DebugApi.ts` (`Content.js`: `3342 -> 3220`)
   - native action forwarding and curated preview/session ownership extracted from `Content.js` into `extension/src/Runtime/NativeBridge.ts` (`Content.js`: `3220 -> 2835`)
   - sorting/scoring/watch-progress metric ownership extracted from `Content.js` into `extension/src/Domain/SortMetrics.ts` (`Content.js`: `2835 -> 2755`)
   - sorting-comparator ownership extracted from `Content.js` into `extension/src/Domain/EntrySorting.ts` (`Content.js`: `2755 -> 2592`)
   - card metadata/rating badge ownership extracted from `Content.js` into `extension/src/Ui/CardMetadata.ts` (`Content.js`: `2592 -> 2506`)
   - legacy wrapper cleanup removed dead indirection in `Content.js` (`Content.js`: `2506 -> 2421`)
   - interface shell ownership extracted from `Content.js` into `extension/src/Runtime/InterfaceShell.ts` (`Content.js`: `2421 -> 2267`)
   - curated card shell ownership extracted from `Content.js` into `extension/src/Ui/CuratedCardShell.ts` (`Content.js`: `2267 -> 2154`)
   - core primitives and API contract helper ownership extracted from `Content.js` into `extension/src/Domain/CorePrimitives.ts` and `extension/src/Data/ApiContracts.ts` (`Content.js`: `2154 -> 1604`)
   - bootstrap sort/settings config ownership extracted from `Content.js` into `extension/src/Runtime/BootstrapConfig.ts`
   - bootstrap guard/method assertion consolidation and delegate cleanup reduced `Content.js` from `1604 -> 1200`
   - bootstrap scheduling/preferred-audio/preload/favorite/layout/settings helpers extracted from `Content.js` into `extension/src/Runtime/BootstrapHelpers.ts` (`Content.js`: `1200 -> 1116`)
   - runtime event/API trace ownership extracted from `Content.js` into `extension/src/Runtime/RuntimeTrace.ts` (`Content.js`: `1116 -> 1072`)
   - bootstrap module-resolution/validation ownership extracted from `Content.js` into `extension/src/Runtime/BootstrapModules.ts` (`Content.js`: `1072 -> 999`)
   - bootstrap runtime guard/path/header ownership extracted from `Content.js` into `extension/src/Runtime/BootstrapGate.ts`
   - `createBootstrapModules` was decomposed into focused resolver helpers, removing the final refactor-threshold runtime function hotspot.
   - inlined ratings transport and cache-owner logic were extracted from `Content.js` into:
     - `extension/src/Data/RatingsClient.ts`
     - `extension/src/Data/RatingsRepository.ts`
   - inlined watchlist page/pagination transport logic was extracted from `Content.js` into:
     - `extension/src/Data/WatchlistClient.ts`
   - inlined preview payload parsing/cache-key/fetch ownership logic was extracted from `Content.js` into:
     - `extension/src/Data/PreviewRepository.ts`
4. Phase 1/2/3/4 foundations are now extracted behind module boundaries and manifest ordering:
   - runtime store owner (`runtime-store`)
   - storage adapter owner (`storage-adapter`)
   - auth/transport owner (`auth-client`)
   - watchlist transport owner (`watchlist-client`)
   - watchlist cache/revalidation owner (`watchlist-repository`)
   - ratings transport owner (`ratings-client`)
   - ratings cache/repository owner (`ratings-repository`)
   - history cache owner (`history-repository-cache`)
   - history preload/fetch owner (`history-repository-preload`)
   - history composition root (`history-repository`)
   - preview cache/repository owner (`preview-repository`)
   - domain image variant owner (`image-variants`)
   - domain entry normalization owner (`entry-normalizer`)
   - domain entry sorting owner (`entry-sorting`)
   - UI controls owner (`controls-view`)
   - UI card body owner (`curated-card-view`)
   - UI card metadata owner (`card-metadata`)
   - fixture loader now consumes `manifest.json` script order (`tests/Helpers/ExtensionFixture.ts`)
5. Extracted factory hotspot cleanup completed:
   - `createEntryNormalizer`: `291 -> 11` lines
   - `createCardView`: `118 -> 7` lines
   - `createControlsView`: `106 -> 8` lines
6. Current hotspots to monitor include:
   - `extension/Content.js` file size (`892` lines; below `< 900` next-cycle target but still above long-term target)
   - `extension/src/Domain/CorePrimitives.ts` file size (`735` lines, largest remaining runtime owner file)
   - architecture metrics currently report no warning-level file/function hotspots.
7. Playwright coverage is split into concern-specific spec files with shared helpers, and each spec file is within size budget.
8. Current strengths to preserve:
   - Cross-browser Playwright coverage and fixture server contract tests are strong.
   - Playwright fixture and config composition roots are TypeScript-based (`tests/Server.ts`, `tests/ServerRouter.ts`, `tests/ServerFixtures.ts`, `tests/ServerResponse.ts`, `playwright.config.ts`).
   - Build/release tooling and Safari packaging pipeline are deterministic and working.
   - Contract-drift and retry/auth scenarios are already tested.
   - Cache hydration/revalidation behavior is now covered in a stabilized cross-browser test path.
9. `extension/manifest.json` currently injects on all Crunchyroll paths, with route-level early exit enforcing watchlist-only runtime behavior.
10. Auth client credential material is now isolated to `extension/src/Data/AuthClient.ts` and must remain constrained to auth-boundary modules.
11. Data-access boundaries currently isolated to extracted modules:
   - `extension/src/Data/AuthClient.ts`
   - `extension/src/Data/WatchlistClient.ts`
   - `extension/src/Data/WatchlistRepository.ts`
   - `extension/src/Data/RatingsClient.ts`
   - `extension/src/Data/RatingsRepository.ts`
   - `extension/src/Data/HistoryRepositoryCache.ts`
   - `extension/src/Data/HistoryRepositoryPreload.ts`
   - `extension/src/Data/HistoryRepository.ts`
   - `extension/src/Data/PreviewRepository.ts`
12. Required architecture gates were re-run after this extraction pass:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run format:check`
   - `npm run test:unit` (120 passed)
   - `npm run pw:live:smoke`
   - `npm run lint:firefox`
   - `npm run test:e2e` (78 passed)
   - `npm run build:webext`
   - `npm run build:safari`
   - `npm run arch:metrics`
13. Current maintainability/tooling gaps from stack review:
   - TypeScript foundations are now in place (`tsconfig.*`, deterministic `build:runtime`, and CI `typecheck` gate).
   - generated runtime output isolation is in place for webext/safari/e2e flows, reducing prior cross-command race friction.
   - dependency hygiene pass is completed for current review scope (`web-ext` upgraded to `^9.3.0`) and Firefox lint remains green.
   - Playwright lockfile casing was normalized (`playwright` lowercase package keys/paths) to restore `npm ci` parity on Node 20 CI runners.
   - `test:e2e*` scripts now run through an isolated runtime wrapper (`scripts/run-playwright-suite.mts`), preventing default shared-output collisions across concurrent E2E runs.
   - E2E wrapper now invokes `@playwright/test` CLI directly (`scripts/run-playwright-suite.mts`), avoiding runner-context mismatch regressions from bin resolution drift.
   - Playwright fixture server startup now supports per-run dynamic ports (`PW_FIXTURE_SERVER_PORT`) to avoid `EADDRINUSE` conflicts in parallel E2E runs.
   - E2E fixture loading now requires explicit generated runtime paths (`EXTENSION_RUNTIME_DIR`) and no longer falls back to raw source assets.
   - E2E wrapper now sanitizes conflicting `NO_COLOR`/`FORCE_COLOR` env combinations in both wrapper and spawned command environments, and latest standard `npm run test:e2e` runs are clean of that warning noise.
   - Playwright fixture server/config migrated to TypeScript (`tests/Server.ts`, `playwright.config.ts`) and covered by `typecheck:tests`.
   - preferred-audio detection ownership moved from `Content.js` into `extension/src/Runtime/PreferredAudioDetector.ts`, reducing bootstrap hotspot concentration.
   - curated panel/grid/stats/preload rendering ownership moved from `Content.js` into `extension/src/Runtime/CuratedPanel.ts`, reducing bootstrap orchestration concentration.
   - curated loading and background revalidation ownership moved from `Content.js` into `extension/src/Runtime/CuratedLoader.ts`, reducing bootstrap orchestration concentration.
   - curated card-actions and controls event-binding ownership moved from `Content.js` into `extension/src/Runtime/CuratedInteractions.ts`, reducing bootstrap orchestration concentration.
   - image normalization/cover/thumbnail ownership moved from `Content.js` into `extension/src/Domain/ImageVariants.ts`, reducing runtime utility concentration.
   - sorting/scoring/watch-progress metric ownership moved from `Content.js` into `extension/src/Domain/SortMetrics.ts`, reducing embedded domain logic in bootstrap.
   - debug series-dump ownership moved from `Content.js` into `extension/src/Runtime/DebugApi.ts`, reducing bootstrap utility concentration.
   - Phase 9 conversion for extracted owners is complete (`extension/src/**` owner modules are now TypeScript-based).
   - build/live/metrics script composition roots are now TypeScript-based (`scripts/*.mts`) with strict typecheck coverage.
   - Biome lint/format stack is active and CI-enforced for format checks on current migration surfaces.
   - Vitest unit-test layer is active in CI with coverage for history/domain plus runtime-store, runtime-trace, watchlist repository/client, preferred-audio detector, bootstrap-helpers, bootstrap-finalize, curated-renderable, curated-panel, curated-loader, curated-interactions, interface-shell, bootstrap-config, bootstrap-gate, bootstrap-modules, state-loader, route-lifecycle, auth-client, ratings-client, ratings-repository, preview-repository, history preload planning/collector/preload, native-bridge action-forwarding, image-variants, sort-metrics, entry-sorting, core-primitives, api-contracts, card-metadata, curated-card-shell, and debug-api owners (120 tests).
   - schema-first boundary hardening was expanded in data owners (`RatingsRepository.ts`, `PreviewRepository.ts`) with explicit malformed-payload contract warnings/events and unit coverage.
   - ratings series-page fallback parsing now normalizes plain and escaped decimal payload forms to avoid silent rating truncation in fallback mode.
   - fixture server payload contracts now use explicit typed payload builders (`tests/Helpers/FixturePayloadBuilders.ts`), reducing route-payload drift risk.
   - live-debug injection (`pw:live`) now rebuilds and injects generated-runtime assets, reducing execution-path drift versus packaged/test flows.
   - non-interactive generated-runtime smoke validation is now automated through `npm run pw:live:smoke` and enforced in CI.
   - route lifecycle now includes a DOM-churn pathname-change fallback watcher to mount correctly when SPA navigation bypasses patched history methods.
   - Safari app icon asset mapping was corrected (`512x512@1x` now points to a 512 image), removing prior app-icon dimension warnings from `npm run build:safari`.
   - source/test module paths are now standardized to PascalCase across `extension/src/**` and `tests/**`; manifest/build/test harness references are aligned to that convention.
   - repository-level `AGENTS.md` now documents structure-tree ownership context and function-change guardrails (high-value unit-test checks first, high-value comments only when needed).
   - architecture metrics now include TS sources, split server modules, function declarations, and function-expression/arrow assignments for broader hotspot visibility.
   - architecture metrics improvement opportunities now include warning-threshold file/function items (not only refactor-threshold misses), and now support explicit per-file budget overrides for transitional composition roots to keep signal actionable.

## 17) Temporary Exceptions During Migration

Allowed until transformation phases complete:

1. Monolithic `extension/Content.js` remains accepted as transition surface.
2. Legacy fallback rating paths may remain while CMS/contract strategy is stabilized.

Each exception must shrink over time and be tracked in the architecture transformation plan.

## 18) Required Change Gates for Architecture Refactors

For each architecture PR:

1. Document owner moves (old owner -> new owner).
2. Keep behavior parity with fixture tests.
3. Run required checks:
   - `npm run test:unit`
   - `npm run lint:firefox`
   - `npm run test:e2e`
   - `npm run build:webext`
   - `npm run build:safari` (when Safari-affecting)
   - `npm run arch:metrics`
4. Required static-analysis gates for migration slices:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run format:check`
5. Update architecture docs when boundaries, ownership, or tech-stack standards change.

## 19) Non-Negotiable Prohibitions

- Do not add new feature logic directly into monolithic bootstrap sections once extracted owners exist.
- Do not mix network fetch and DOM rendering in the same new module.
- Do not bypass repository/owner APIs by mutating raw state maps from UI handlers.
- Do not spread endpoint string literals across unrelated files.
- Do not introduce new JavaScript-only modules in `extension/src/**` once TypeScript migration starts for that layer.
- Do not bypass schema validation at API boundaries by casting unknown payloads directly to typed shapes.

## 20) Prioritized Next Items (Reviewed 2026-02-24)

Priority order for the next architecture cycle:

1. Priority 0: continue decomposing `extension/Content.js` from `892` toward `<= 800` while keeping composition-only ownership and behavior parity.
2. Priority 1: keep dependency/tooling hygiene green (ongoing audit follow-ups, Playwright/toolchain drift checks, and lockfile parity checks on Node 20 CI semantics).
3. Priority 1: preserve schema-first boundary guarantees and contract-warning coverage as new endpoints/features are added.
4. Priority 2: keep near-threshold files (`CorePrimitives.ts`) from warning-level growth with explicit headroom guardrails.
5. Priority 2: continue CI throughput optimization without reducing cross-browser/Safari confidence.
6. Priority 2: continue reducing composition-root complexity by extracting remaining bootstrap orchestration from `Content.js`.

Definition of successful next cycle:

- `extension/Content.js` stays at or below the current baseline (`892`) while remaining composition-focused and trending toward `<= 800`.
- TypeScript migration coverage remains complete for extracted owners under `extension/src/**` with no regression to new JS modules.
- TypeScript typecheck gate remains active and green in CI.
- History preload internals remain below warning-level function thresholds with file-size headroom kept below `800`.
- `NativeBridge.ts` is back under the strict runtime file-size target (`<= 600`).
- `npm ci` stays deterministic on CI runners with lockfile/package parity intact.
- Remaining runtime orchestration in `Content.js` stays limited to composition/root wiring with no direct ownership logic regrowth.
- No additional refactor-threshold functions are introduced.
- Architecture metrics hotspot scanning continues to include declarations plus function-expression/arrow surfaces.
- Architecture metrics remains calibrated for transitional composition-root signal quality while preserving strict refactor thresholds.
- Mandatory architecture gates remain green.
