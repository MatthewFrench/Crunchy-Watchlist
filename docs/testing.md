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

Run a single engine:

```bash
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

## Optional Playwright UI mode

```bash
npm run test:e2e:ui
```

## Live WebKit visual session

For manual visual checks on a real Crunchyroll watchlist flow:

```bash
npm run pw:live
```

This launches a WebKit session and injects `extension/content.js` + `extension/content.css` into:
`https://www.crunchyroll.com/watchlist`.

Hot reloading behavior:

- Editing `extension/content.js` or `extension/content.css` triggers automatic reload and logs:
  - `[hot-reload] Reloading page and applying latest extension files...`
- Runtime status logs look like:
  - `[startup] /watchlist nativeCards=... curatedCards=... controls=yes`
  - `[watchlist-nav] /watchlist nativeCards=... curatedCards=... controls=yes`

Disable hot reload explicitly if needed:

```bash
CW_PW_HOT_RELOAD=0 npm run pw:live
```

## Firefox publish validation

Run this before release to validate Gecko packaging and manifest expectations:

```bash
npm run lint:firefox
```

## Fixture data and local test server

- `tests/server.mjs`
- `tests/fixtures/watchlist-fixture.html`

These fixtures and local fixtures are intentionally used to validate parsing, filtering, rendering, and action-forwarding without requiring live Crunchyroll account state.

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
