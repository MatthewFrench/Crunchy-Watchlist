# Testing and validation

This project uses fixture-driven and browser-live checks to validate content-script behavior.

## Playwright setup

1. Install dependencies:

```bash
npm install
```

2. Install browser runtimes:

```bash
npm run pw:install
```

## Cross-engine automated tests

Run the fixture test suite in all engines:

```bash
npm run test:e2e
```

Note: E2E scripts now route through a wrapper that builds generated runtime output into an isolated per-run directory (for example `.tmp/extension-runtime-e2e-*`) and sets `EXTENSION_RUNTIME_DIR` automatically.
This removes prior parallel-run collisions on shared runtime output paths.
The wrapper also assigns an isolated fixture server port per run (`PW_FIXTURE_SERVER_PORT`) to avoid `EADDRINUSE` conflicts during parallel Playwright runs.
Direct `playwright test` execution now fails fast unless `EXTENSION_RUNTIME_DIR` is explicitly provided.
Use wrapper-managed commands (`npm run test:e2e*`) as the default path.
The wrapper also normalizes conflicting parent color env vars (`NO_COLOR` + `FORCE_COLOR`).

Run a single engine:

```bash
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

Current test-suite split:

- `tests/manifest-routing.spec.ts` (manifest/routing/mount lifecycle)
- `tests/ui-behavior.spec.ts` (controls, tab behavior, action forwarding, persistence)
- `tests/ranking-and-progress.spec.ts` (sorting/filtering/progress/data joins)
- `tests/resilience-contracts.spec.ts` (retry and API contract drift behavior)

## Fast unit tests (Vitest)

Run architecture-focused unit tests in Node:

```bash
npm run test:unit
```

Watch mode:

```bash
npm run test:unit:watch
```

Current unit-test focus:

- `tests/unit/data/history-repository-cache.test.ts`
- `tests/unit/data/history-repository-preload.test.ts`
- `tests/unit/data/history-repository-composition.test.ts`
- `tests/unit/data/watchlist-repository.test.ts`
- `tests/unit/domain/entry-normalizer.test.ts`
- `tests/unit/runtime/runtime-store.test.ts`
- `tests/unit/runtime/runtime-trace.test.ts`
- `tests/unit/runtime/bootstrap-helpers.test.ts`
- `tests/unit/runtime/bootstrap-modules.test.ts`

## Optional Playwright UI mode

```bash
npm run test:e2e:ui
```

## Live WebKit visual session

For manual visual checks on a real Crunchyroll watchlist flow:

```bash
npm run pw:live
```

This launches a WebKit session and injects manifest-ordered runtime assets (all configured content scripts + CSS) into:
`https://www.crunchyroll.com/watchlist`.
Runtime source for injection is generated output (default `.tmp/extension-runtime-dev`), rebuilt on startup and hot reload.

Hot reloading behavior:

- Editing files under `extension/**/*.(js|ts|css|json)` triggers automatic reload and logs:
  - `[hot-reload] Reloading page and applying latest extension files...`
- Runtime status logs look like:
  - `[startup] /watchlist nativeCards=... curatedCards=... controls=yes`
  - `[watchlist-nav] /watchlist nativeCards=... curatedCards=... controls=yes`

Disable hot reload explicitly if needed:

```bash
CW_PW_HOT_RELOAD=0 npm run pw:live
```

Non-interactive smoke check for live-runtime parity:

```bash
npm run pw:live:smoke
```

## Firefox publish validation

Run this before release to validate Gecko packaging and manifest expectations:

```bash
npm run lint:firefox
```

## Static type validation

Run TypeScript type checks for runtime, scripts, and test-typing surfaces:

```bash
npm run typecheck
```

Run current repository lint checks (Biome-scoped surfaces):

```bash
npm run lint
```

## Fixture data and local test server

- `tests/server.ts`
- `tests/server-router.ts`
- `tests/server-fixtures.ts`
- `tests/server-response.ts`
- `tests/fixtures/watchlist-fixture.html`

These fixtures and the local fixture server are intentionally used to validate parsing, filtering, rendering, and action-forwarding without requiring live Crunchyroll account state.

## Behavior checks included in automated tests

The test suite also exercises:

- watchlist loading states and loading indicators,
- filter dropdown persistence,
- sort and ranking behavior,
- API request contract usage,
- resilience to missing fields and API contract drift,
- auth/401 retry flows,
- signed/unsigned Firefox packaging expectations.

## Runtime behavior notes

- `Curated`, `Audio`, `Genre`, `Sort`, and layout selections persist in extension storage across reloads.
- Curated rendering is API-driven and requests all watchlist pages up front, preloads ratings in batched CMS calls, and preloads watch history in account calls.
- Ratings and watch-history data are cached locally for 12 hours.
- `Last watched` values come from `date_played` in watch-history, joined by `series_id`; missing matches display fallback values.
- If API auth or loading fails, `Curated` presents an explicit API error instead of a partial DOM fallback.
- `Curated` shows loading state while enriched metadata resolves; preload starts when the watchlist page becomes ready.
- Native watchlist is virtualized. Curated list rendering is independent, and forwarded `Favorite`/`Remove` actions rely on native controls being available.

## Post-change quick sanity checks

After substantial content-script or CSS changes, validate at least:

1. Extension loads and injects on `https://www.crunchyroll.com/watchlist`.
2. Curated tab appears and filter/sort controls are functional.
3. API calls in the watchlist request paths still match expected pagination and pagination size behavior.
4. Data rendering remains stable after a refresh with non-watch-ready toggles.
