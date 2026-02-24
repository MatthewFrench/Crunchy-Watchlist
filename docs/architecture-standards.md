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
- Runtime source file size target: `<= 600` lines (default warning `> 800`, refactor required `> 1200`; near-threshold owners enforce tighter warning/refactor budgets of `> 600`/`> 700` for `NativeBridge.ts`, `AuthClient.ts`, `ContentComposition.ts`, `HistoryRepositoryCache.ts`, and `Content.js`).
- Test spec file size target: `<= 400` lines (warning `> 550`, refactor required `> 750`).
- Function length target: `<= 45` lines (warning `> 70`, refactor required `> 100`).
- Max parameters per exported function: `<= 6` (otherwise use typed object argument).
- Cyclomatic hotspots should be decomposed into named helpers before adding new branches.

## 16) Conformance Review Snapshot (2026-02-24)

Current-state findings from this repository:

1. Structural budgets are healthy on enforced thresholds (latest `npm run arch:metrics`):
   - `extension/Content.js`: `597` lines (strict target `<= 600` satisfied).
   - `extension/src/Runtime/ContentComposition.ts`: `568` lines (strict target `<= 600` satisfied).
   - `extension/src/Data/HistoryRepositoryPreload.ts`: `514` lines (strict target `<= 600` satisfied).
   - `extension/Content.css`: `576` lines and `extension/ContentResponsive.css`: `52` lines (split to keep style surfaces bounded).
   - Warning/refactor-level hotspots: `0` (files and functions).
2. Bootstrap prelude ownership was extracted from `Content.js` to:
   - `extension/src/Runtime/ContentBootstrap.ts`
   - `tests/Unit/Runtime/ContentBootstrap.test.ts`
   - `extension/manifest.json` updated to load `src/Runtime/ContentBootstrap.js` before `Content.js`.
3. Composition and data preload type-surface noise was removed from large runtime owners by extracting ambient contracts to:
   - `extension/Types/CommonRuntimeTypes.d.ts`
   - `extension/Types/ContentCompositionTypes.d.ts`
   - `extension/Types/HistoryRepositoryPreloadTypes.d.ts`
4. Runtime boundaries remain cleanly owned by typed modules:
   - Runtime orchestration: `extension/src/Runtime/**`
   - Data/access boundaries: `extension/src/Data/**`
   - Domain/pure logic: `extension/src/Domain/**`
   - UI rendering/composition: `extension/src/Ui/**`
5. User-facing behavior coverage remains aligned with recent feature work:
   - merged status-line labels (`Up Next`/`Continue`) without separate “Next unwatched” row,
   - favorites genre mode (`__favorites__`),
   - watch-ready hide-not-started mode,
   - loading diagnostics that preserve duplicate in-flight requests and show `Completed X of Y • In progress Z`.
6. Verified full architecture gates in this cycle:
   - `npm ci`
   - `npm audit --json` (`0` vulnerabilities)
   - `npm run typecheck`
   - `npm run lint`
   - `npm run format:check`
   - `npm run test:unit` (`146` passed)
   - `npm run pw:live:smoke`
   - `npm run lint:firefox`
   - `npm run test:e2e` (`81` passed)
   - `npm run build:webext`
   - `npm run build:safari` (Xcode build succeeded)
   - `npm run arch:metrics`
7. Remaining friction to track:
   - No hard blockers are currently open.
   - Full cross-browser + Safari gate runs are still high-cost; keep release-affecting validation cadence explicit.

## 17) Transitional Exceptions (Tracked)

Allowed while the transitional composition root remains in place:

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

## 20) Prioritized Next Items (Post-Completion Optimization Queue, Reviewed 2026-02-24)

Priority order for the next optimization cycle:

1. Priority 0: preserve dependency hygiene and lockfile parity (`npm ci` + `npm audit` remain clean) during upgrade windows, with full gate verification.
2. Priority 1: prevent regrowth in top runtime owners (`NativeBridge.ts`, `AuthClient.ts`, `ContentComposition.ts`, `HistoryRepositoryCache.ts`, `Content.js`) under tightened warning/refactor budgets.
3. Priority 1: preserve schema-first contract hardening as API surfaces evolve (watchlist/history/ratings/preview), including explicit contract-drift telemetry and focused unit coverage.
4. Priority 1: keep composition-root boundaries thin (`Content.js`, `ContentBootstrap.ts`, `ContentComposition.ts`) and avoid ownership regression into bootstrap.
5. Priority 2: continue CI/runtime throughput improvements without reducing cross-browser + Safari confidence.
6. Priority 2: keep architecture baseline/status documentation synchronized with every structural change cycle.

Definition of successful next cycle:

- No runtime/data module regresses above strict targets (`<= 600`) or warning thresholds while adding features.
- Safari build remains clean of script-phase output warnings after incremental Xcode updates.
- TypeScript migration coverage remains complete for extracted owners under `extension/src/**` with no regression to new JS modules.
- Typecheck/lint/format/unit/metrics gates stay green for each architecture slice.
- Release-confidence gates (`lint:firefox`, `test:e2e`, `build:webext`, `build:safari`) remain green for release-affecting slices.
- Dependency updates preserve `npm ci`/`npm audit` parity and do not regress Playwright/Xcode build stability.
- No warning-level structural hotspots are introduced.
