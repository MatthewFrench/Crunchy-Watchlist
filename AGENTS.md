# Crunchy Watchlist Curator Agent Guide

This file is the default operating guidance for AI/code agents working in this repository.

## Core Values

1. Preserve behavior first; refactor for clarity and ownership without regressions.
2. Prefer explicit module boundaries over convenience coupling.
3. Keep changes verifiable with deterministic checks.
4. Bias toward small, reviewable increments that leave the repo better than it was.

## Repository Structure and Ownership

```text
Crunchy-Watchlist/
  .github/                      # CI workflows and release automation
  docs/                         # Architecture, testing, release, and API contract docs
  extension/                    # Browser extension runtime and manifest assets
    src/
      runtime/                  # Bootstrap orchestration, lifecycle, state wiring
      data/                     # API/auth/storage/repository boundary owners
      domain/                   # Pure normalization/sorting/scoring logic
      ui/                       # DOM/view composition for curated UX
    types/                      # Ambient/browser global type declarations
    content.js                  # Composition-root runtime entry (transitional)
    content.css                 # Extension UI styling
    manifest.json               # Content-script ordering and extension permissions
  tests/                        # E2E specs, fixture server, unit suites, helpers
    unit/                       # Fast module-level unit tests (Vitest)
    helpers/                    # Shared test harness/runtime loaders
  scripts/                      # Build, packaging, runtime preparation, metrics tooling
  Crunchy Watchlist Curator/    # Safari wrapper app/extension bridge project
  dist/                         # Built artifacts (generated; do not hand-edit)
  .tmp/                         # Runtime/build scratch outputs (generated; do not hand-edit)
```

## Folder Expectations (Why It Exists / How to Change It)

- `.github/`: Keep gates deterministic and aligned with local scripts. Avoid one-off CI-only logic when a reusable script can be shared.
- `docs/`: Keep architecture and migration docs synchronized with actual code/tooling state after substantial changes.
- `extension/src/runtime/`: Composition and orchestration only; keep owner logic delegated to focused modules.
- `extension/src/data/`: All external payload handling and persistence boundaries; centralize retry/auth/contract handling here.
- `extension/src/domain/`: Pure and deterministic logic; no DOM/network dependencies.
- `extension/src/ui/`: Render and interaction wiring only; no direct data fetching/auth/storage mutation.
- `extension/types/`: Keep global contracts explicit (`browser`, `chrome`, module registry) instead of ad hoc `any`.
- `extension/content.js`: Transitional composition root; avoid re-introducing business ownership into bootstrap.
- `tests/unit/`: High-value, behavior-focused module tests. Prefer stable, minimal fakes over brittle integration-heavy fixtures.
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

## Quality Gates

Before concluding substantial refactors, keep these green:

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test:unit`
- `npm run lint:firefox`
- `npm run test:e2e`
- `npm run build:webext`
- `npm run build:safari`
- `npm run arch:metrics`

## Architecture Direction

1. Continue reducing transitional bootstrap concentration in `extension/content.js`.
2. Keep extracted owner modules TypeScript-first and strictly bounded by layer responsibilities.
3. Expand unit coverage around high-risk runtime/data paths before expanding behavior.
