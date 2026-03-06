# Crunchy Watchlist Curator Agent Guide

This file is the default operating guidance for AI/code agents working in this repository.

## Core Values

1. Preserve behavior first; refactor for clarity and ownership without regressions.
2. Prefer explicit module boundaries over convenience coupling.
3. Keep changes verifiable with deterministic checks.
4. Bias toward small, reviewable increments that leave the repo better than it was.
5. Escalate architectural smells early: if a pattern seems wrong, pause and discuss before adding more debt.

## Repository Structure and Ownership

```text
Crunchy-Watchlist/
  .github/                      # CI workflows and release automation
  docs/                         # Architecture, testing, release, and API contract docs
  extension/                    # Browser extension runtime and manifest assets
    src/
      Runtime/                  # Bootstrap orchestration, lifecycle, state wiring
      Data/                     # API/auth/storage/repository boundary owners
      Domain/                   # Pure normalization/sorting/scoring logic
      Ui/                       # DOM/view composition for curated UX
    Types/                      # Ambient/browser global type declarations
    Content.js                  # Composition-root runtime entry (transitional)
    Content.css                 # Extension UI styling
    manifest.json               # content-script ordering and extension permissions
  tests/                        # E2E specs, fixture server, unit suites, helpers
    Unit/                       # Fast module-level unit tests (Vitest)
    Helpers/                    # Shared test harness/runtime loaders
    Fixtures/                   # HTML fixtures for E2E and fixture-server contracts
    Server*.ts                  # Fixture server composition roots
  scripts/                      # Build, packaging, runtime preparation, metrics tooling
  Crunchy Watchlist Curator/    # Safari wrapper app/extension bridge project
  dist/                         # Built artifacts (generated; do not hand-edit)
  .tmp/                         # Runtime/build scratch outputs (generated; do not hand-edit)
```

## Naming Standard

Source and test code naming is PascalCase by default:

- Use PascalCase for files and folders under `extension/src/**`, `extension/Types/**`, and `tests/**`.
- Keep test/spec suffixes idiomatic (`*.spec.ts`, `*.test.ts`), but keep the module stem PascalCase (for example `RankingAndProgress.spec.ts`).
- Keep ecosystem root anchors lowercase (`extension/`, `extension/src/`, `tests/`, `scripts/`, `docs/`); apply PascalCase beneath them.
- When adding new modules, match existing PascalCase segment conventions (`Runtime`, `Data`, `Domain`, `Ui`, `Unit`, `Helpers`, `Fixtures`).

## Folder Expectations (Why It Exists / How to Change It)

- `.github/`: Keep gates deterministic and aligned with local scripts. Avoid one-off CI-only logic when a reusable script can be shared.
- `docs/`: Keep architecture and migration docs synchronized with actual code/tooling state after substantial changes.
- `extension/src/Runtime/`: Composition and orchestration only; keep owner logic delegated to focused modules.
- `extension/src/Data/`: All external payload handling and persistence boundaries; centralize retry/auth/contract handling here.
- `extension/src/Domain/`: Pure and deterministic logic; no DOM/network dependencies.
- `extension/src/Ui/`: Render and interaction wiring only; no direct data fetching/auth/storage mutation.
- `extension/Types/`: Keep global contracts explicit (`browser`, `chrome`, module registry) instead of ad hoc `any`.
- `extension/Content.js`: Transitional composition root; avoid re-introducing business ownership into bootstrap.
- `tests/Unit/`: High-value, behavior-focused module tests. Prefer stable, minimal fakes over brittle integration-heavy fixtures.
- `tests/` E2E suites: Verify cross-browser behavior and contract drift resilience for user-visible flows.
- `scripts/`: Deterministic composition roots for build/test/metrics. Keep script behavior platform-aware and explicit.
- `Crunchy Watchlist Curator/`: Safari wrapper host concerns only; no runtime logic ownership that belongs in `extension/src/**`.
- `dist/` and `.tmp/`: Generated outputs. Never treat as source-of-truth.

## Function Modification Standards

When modifying an existing production function (or adding a new one), follow these rules:

1. **Unit test check first (within reason)**:
   - Confirm whether high-value unit tests already cover the changed behavior.
   - If coverage is missing and the function is testable in unit scope, add/upgrade tests in the same change.
   - Focus on meaningful behavior/edge cases, not line-by-line implementation snapshots.

2. **High-value comments only (when necessary)**:
   - For complex or non-obvious function logic, add or update a concise top-level comment that captures:
     - purpose,
     - execution context,
     - edge cases/caveats,
     - relevant tribal knowledge/constraints.
   - Do **not** add comments that restate obvious code.
   - Apply the same standard to helper functions: comment only when it materially improves maintainability.

3. **Manual Playwright verification for implemented features**:
   - After implementing user-visible runtime/UI behavior, run a focused manual verification using Playwright-capable tooling.
   - Keep this verification safe and read-only against production-like pages (no destructive account mutations or bulk data actions).
   - Prioritize the exact interaction paths that changed (for example: toggle actions, sorting/filtering, or route transitions).

## Live Crunchyroll Verification Workflow (Cloudflare-Safe)

Use this workflow when validating behavior on real `crunchyroll.com` while avoiding repeated Cloudflare challenge failures.

1. **Default to fixtures for automation-heavy coverage**:
   - Keep most regression/behavior checks on fixture-driven tests (`npm run test:unit`, `npm run test:e2e*`).
   - Reserve live Crunchyroll checks for final, focused read-only verification.

2. **Do not rely on Playwright-launched fresh browser profiles for Cloudflare login**:
   - Fresh automated contexts are more likely to challenge-loop.
   - Prefer a long-lived, user-managed browser profile for live site checks.

3. **Use a separate Chromium-family app/profile and attach over CDP**:
   - Prefer attaching to an already-running user-managed Edge/Chrome session on a DevTools port before launching any browser yourself.
   - This avoids the "fresh automated browser" pattern that is more likely to trigger Crunchyroll/Cloudflare lock-down behavior.
   - Launch a separate browser process with a dedicated profile and DevTools port only when no reusable session already exists.
   - Preferred agent default for Edge on macOS when no session is available:
     - `open -na '/Applications/Microsoft Edge.app' --args --remote-debugging-port=9222 --new-window 'https://www.crunchyroll.com/watchlist'`
   - After launching, agents should attach to that running browser over CDP instead of creating a fresh Playwright browser/profile.
   - Example launch (macOS, Chrome app copy):
     - `open -na '/Applications/Google Chrome copy.app' --args --remote-debugging-port=9222 --user-data-dir='/Users/matthewfrench/GitHub/Crunchy-Watchlist/.tmp/chrome-copy-cdp-profile' --new-window 'https://www.crunchyroll.com/watchlist'`
   - Example launch (macOS, Microsoft Edge):
     - `open -na '/Applications/Microsoft Edge.app' --args --remote-debugging-port=9222 --new-window 'https://www.crunchyroll.com/watchlist'`
   - Agent control model: attach with Playwright `chromium.connectOverCDP('http://127.0.0.1:9222')` to the already-running browser instead of launching a new automated browser or a fresh persistent context.

4. **Manual challenge handling is expected**:
   - User manually completes Cloudflare/login in that browser window when prompted.
   - Agent resumes read-only verification after confirmation.

5. **For rapid iteration, inject built runtime directly into watchlist**:
   - Build runtime: `npm run build:runtime:dev`
   - Inject bundled content-script JS/CSS into the live watchlist tab (no extension installation required for this step).
   - Use this mode for debugging logic/UI quickly.

6. **For release-parity validation, user tests real installed extension**:
   - Final parity checks (manifest/permissions/content-script wiring) should be done with the actual extension installed and enabled by the user.

7. **Session hygiene and safety**:
   - Keep one live browser session/profile per verification pass; avoid parallel controlling sessions against Crunchyroll.
   - Avoid destructive account actions.
   - Do not implement or suggest anti-bot bypass/spoofing tactics.

## Architecture Smell Escalation (Required)

1. **Stop-and-discuss trigger**:
   - If code or runtime constraints seem structurally wrong, stop and raise it explicitly with concrete file references and impact.
   - Do not normalize workaround-heavy patterns as "just how this repo works."

2. **Bundler/composition-root smell must be called out**:
   - If missing/insufficient bundling forces global registry hydration, loose `unknown` plumbing, or cross-script wiring hacks, treat that as an architectural issue to discuss immediately.
   - Example: content-runtime modules depending on global module registration instead of static imports is debt to reduce, not a target pattern.

3. **Decision clarity**:
   - When escalating, provide: current behavior, root cause, options, recommendation, and migration risk.
   - If uncertain, ask before implementing broad refactors.

## DOM Rendering Policy (Non-Negotiable)

1. **Create once, update in place**:
   - For persistent UI records (for example curated cards keyed by `seriesId`), create DOM nodes once and mutate existing nodes on state changes.
   - Do not replace existing card nodes to reflect metadata updates, loading-state updates, filter/sort updates, or cosmetic state transitions.

2. **No rebuild-driven rendering loops**:
   - Do not use full-node recreation as a diff strategy (`create new node -> insert -> remove old node`) for routine panel refreshes.
   - Prefer explicit patch functions per owner module (for example `patchCuratedCard(element, nextEntry)`), updating only fields that changed.

3. **Identity stability is required**:
   - Preserve node identity for media elements (`img`, preview nodes, progress bars) to avoid flicker, repeated decoding, and event-listener churn.
   - Never reset `img.src` unless the resolved URL actually changed.

4. **Animation and transitions must not require cloning**:
   - Avoid `cloneNode`-based transition shells for normal list updates.
   - Use class toggles, transform/opacity transitions, and layout-safe animation techniques on existing nodes.

5. **Verification expectations**:
   - When modifying runtime rendering logic, add/adjust unit tests that assert node identity stability across re-renders.
   - Include at least one Playwright check covering the changed interaction path and verifying no visible media flicker regression.

6. **No owned-element lookup by selector/token/id**:
   - For extension-owned UI subtrees, do **not** use `querySelector*`, `getElement*`, class-token scans, ID lookups, or helper wrappers (for example `findElementByClassTokenWithin`) to find descendants.
   - Allowed lookup exceptions are limited to:
     - page/root discovery (for example finding the Crunchyroll watchlist root/header or extension host root),
     - non-owned/native page elements that the extension does not construct or control.
   - If an element is extension-owned, the owner module must create it, hold a direct reference, and patch it in place.

7. **Owner components must expose stable refs and patch APIs**:
   - Owner modules return `{ root, refs, patch(...) }` (or equivalent) and never depend on descendant selector lookups for owned elements.
   - Prefer explicit typed refs over implicit class-name contracts.

```ts
type CuratedCardMediaRefs = {
  thumbLink: HTMLAnchorElement
  image: HTMLImageElement | null
  placeholder: HTMLSpanElement | null
  progress: HTMLDivElement | null
  progressFill: HTMLSpanElement | null
}

type CuratedCardMediaComponent = {
  root: HTMLElement
  refs: CuratedCardMediaRefs
  patch: (next: { title: string; href: string; coverImageUrl: string; progressRatio: number | null }) => void
}

function createCuratedCardMediaComponent(documentRef: Document): CuratedCardMediaComponent {
  const root = documentRef.createElement('div')
  root.className = 'cw-curated-card__media'

  const thumbLink = documentRef.createElement('a')
  thumbLink.className = 'cw-curated-card__thumb'
  root.appendChild(thumbLink)

  const refs: CuratedCardMediaRefs = {
    thumbLink,
    image: null,
    placeholder: null,
    progress: null,
    progressFill: null,
  }

  return {
    root,
    refs,
    patch: (next) => {
      // Patch by direct refs only; no descendant selector scans.
      if (refs.thumbLink.href !== next.href) refs.thumbLink.href = next.href
      refs.thumbLink.setAttribute('aria-label', next.title)
    },
  }
}
```

## Frontend Engineering Standards (Strict)

1. **No element expando ownership for new code**:
   - Do not attach mutable controller/reference payloads directly on DOM nodes (for example `element.__cwSomething__`).
   - Use explicit owner/controller objects returned from constructors, or `WeakMap<Element, Refs>` when node-keyed storage is required.
   - Legacy expandos may exist temporarily during migrations, but new/changed code must not introduce additional expando surfaces.

2. **Async UI handlers must be rejection-safe**:
   - Never leave promise-returning event handlers without explicit rejection handling.
   - Wrap async listener work in guarded runners (`void run().catch(...)`) and route failures through a consistent error/reporting path.
   - Do not fire-and-forget async work in UI flows unless an explicit `.catch(...)` is attached.

3. **Monkey-patching requires restoration contracts**:
   - Any patching of browser/page APIs (`history.pushState`, `history.replaceState`, etc.) must define deterministic install/uninstall lifecycles.
   - If patches can be applied more than once, use idempotent patch guards and restore originals on teardown.

4. **Document ownership must be explicit**:
   - UI owner modules construct nodes through injected `documentRef`/`ownerDocument`; do not rely on ambient global `document`.
   - This is required for test isolation and safe host/document boundary behavior.

5. **Boundary checks must be meaningful**:
   - Runtime `typeof`/shape guards are required at untyped external boundaries (browser APIs, module-registry hydration, page-owned nodes).
   - Inside typed owner paths, avoid defensive `typeof` noise that duplicates compile-time guarantees.

6. **Accessibility is a release requirement**:
   - Interactive composites (tabs, loading/status regions, list controls) must use valid semantic structure and ARIA relationships.
   - Status/progress updates must be exposed via appropriate live-region semantics (`role="status"`, `aria-live`).

7. **Render-path cost control**:
   - Avoid deep object hashing/stringification in hot render loops when stable revision keys can be used.
   - Keep reorder/paging/filter updates data-driven and incremental with stable identity.
   - Do not observe the full document subtree unless strictly necessary; scope observers to owned roots and filter mutation targets aggressively.

8. **Long-lived callbacks must not capture stale render data**:
   - Event handlers, hover/preview callbacks, and timers must read current mutable controller state (or patched refs), not stale create-time snapshots.
   - If a component can be patched, its side-effect callbacks must also support patching of their runtime context.

9. **Lifecycle cleanup is mandatory**:
   - Every created listener/observer/timer/patch must have a deterministic teardown path in owner disposal/unmount.
   - Teardown must be idempotent and safe to call multiple times.

10. **User-visible error hygiene**:
   - Do not surface raw thrown objects or stack-like strings directly in UI text.
   - Map failures to stable user-facing messages; send diagnostic detail to debug/telemetry channels.

11. **Type discipline for runtime wiring**:
   - `unknown` is allowed only at true external boundaries (host page APIs, module hydration boundaries, storage/network payloads).
   - Inside owned runtime/UI modules, convert boundary inputs once and continue with explicit typed contracts.
   - Avoid widening to `AnyFn` in non-boundary logic; prefer typed interfaces/factory contracts.

12. **Class-based UI owners/controllers are mandatory for new or refactored UI code**:
   - Do not introduce new optional/factory-sprawl patterns for UI ownership logic.
   - Use classes with explicit constructor dependencies, `patch(...)`/update methods, and deterministic `dispose()` cleanup.

13. **Deterministic ownership hierarchy is required**:
   - Parent owners/controllers may operate on their own root plus direct child-owner contracts only.
   - Each child owner/controller is responsible for its subtree refs/patching; do not bypass ownership with deep utility lookups.

## Metadata Preload And Network Budget Guardrails

1. **Single-owner preload policy**:
   - Metadata preloads (ratings/watch-history/localized variants) must be orchestrated by one owner policy per flow.
   - Avoid duplicate trigger paths that can each schedule the same preload on render/control-change/load-complete without shared guards.

2. **Sentinel filters are hard no-op boundaries**:
   - Treat sentinel filter values (for example `audioLocaleFilter = 'any'`) as explicit "do not preload localized metadata" at trigger boundaries.
   - Do not rely on downstream normalization to infer this behavior.

3. **Render feedback loops must be revision-gated**:
   - Any async preload completion callback that requests another render must first verify data revision/cache timestamps changed.
   - Never call render-unconditionally from preload completion handlers.

4. **Forced localized preload requires idempotency across revision**:
   - If localized preload uses force semantics to fill gaps, guard calls by `(locale, curatedDataRevision)` and inflight maps.
   - Repeated sort/filter/render churn must not produce repeated network requests for unchanged data revision.

5. **Request-budget tests are required for network-heavy UI flows**:
   - Add or update unit tests for sentinel no-op behavior and per-revision dedupe.
   - Maintain focused Playwright coverage that asserts bounded request counts for initial load, locale switching, and sort/filter churn.

## Formatting And Linting Discipline

1. **Biome is the single source of truth for style**:
   - Do not hand-enforce style preferences that conflict with configured Biome behavior.
   - Keep logic changes and formatting-only changes separate whenever possible.

2. **Strict linting by default**:
   - Run lint with warnings treated as failures.
   - Prefer introducing strict rules in low-risk batches that are proven clean before enabling in CI.
   - Keep policy guards alongside lint (for example owned-DOM lookup, async event-listener, and UI document-ref guards).

3. **Semicolon policy changes require a dedicated migration**:
   - If switching semicolon style (for example to `always`), do a one-time repo-wide mechanical reformat in a dedicated change.
   - Do not combine style migrations with behavioral refactors.

4. **Commit hygiene is enforced locally**:
   - Keep a pre-commit hook that runs Biome write + check (`npm run precommit:biome`).
   - Treat hook failures as blockers; do not bypass formatting/lint drift.

## Quality Gates

Before concluding substantial refactors, keep these green:

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

## Architecture Direction

1. Continue reducing transitional bootstrap concentration in `extension/Content.js`.
2. Keep extracted owner modules TypeScript-first and strictly bounded by layer responsibilities.
3. Expand unit coverage around high-risk runtime/data paths before expanding behavior.
4. Move toward a proper bundled static module graph per runtime entrypoint; reduce global module-registration/hydration surfaces.
5. Keep one explicit composition root per runtime entry and treat registry-based cross-script wiring as transitional debt only.
