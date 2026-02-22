# Crunchy Watchlist Curator (Safari Web Extension)

This extension improves `https://www.crunchyroll.com/watchlist` by adding:

- A separate `Curated` tab (leaves Crunchyroll's native tab content untouched)
- A 3-way non-actionable mode selector: `None` / `Dim non-actionable` / `Hide non-actionable`
- An `Audio` dropdown filter (from available `audio_locales`, including `en-US`)
- A `Genre` dropdown filter (from available series category/genre tags)
- A `Landscape cards` toggle to switch between portrait and landscape card layouts
- Rich rating UI on curated cards (score, rating count, 5-star histogram)
- Layout-aware cover art selection (portrait cards prefer tall posters; landscape cards prefer wide posters)
- Small per-show description snippet on each curated card
- Next unwatched episode line (`Sx Ey`) plus series totals (`seasons`, `episodes`, and estimated `unwatched left` when calculable)
- Genre/category line when available from Crunchyroll metadata
- A `Sort` selector for rating, `date added`, `date updated`, total rating count, total star points, and per-star counts (`5★` to `1★`)
- Native action buttons on curated cards (`Favorite` heart and `Remove` trash)
- Hover preview on curated thumbnails when a stream preview URL is available

## Files

- `extension/manifest.json`
- `extension/content.js`
- `extension/content.css`
- `docs/crunchyroll-watchlist-findings.md` (live selectors, API/auth endpoints, reverse-engineering notes)

## Load in Safari

1. Convert the WebExtension into an Xcode Safari extension project:

   ```bash
   xcrun safari-web-extension-converter /Users/matthewfrench/GitHub/Crunchy-Watchlist/extension
   ```

2. Open the generated Xcode project.
3. Build and run the extension target.
4. In Safari, enable the extension in:
   `Safari > Settings > Extensions`.

### Xcode Target Note (iOS vs macOS)

The converter creates both iOS and macOS wrapper targets by default. For Safari on Mac, run:

- Scheme: `Crunchy Watchlist Curator (macOS)`
- Destination: `My Mac`
- Extension target used: `Crunchy Watchlist Curator Extension (macOS)`

You can ignore iOS targets unless you also want Safari on iOS support.

### Should the converted Xcode project be temporary?

Treat the generated Xcode wrapper project as **permanent** and check it into git:

- Keep it after the first conversion and continue editing/signing it in Xcode
- Regenerate only when you intentionally want to replace wrapper scaffolding
- Daily extension iteration should happen by editing files in `extension/` and rebuilding the existing macOS scheme

## Playwright Setup (Fast WebKit Validation)

This repo now includes Playwright tooling to quickly test the same content-script behavior in WebKit before Safari/Xcode validation.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Install Playwright WebKit runtime:

   ```bash
   npm run pw:install
   ```

3. Run automated fixture tests:

   ```bash
   npm run test:e2e
   ```

4. (Optional) Run with Playwright UI:

   ```bash
   npm run test:e2e:ui
   ```

## Live WebKit Visual Session

For manual visual checks on the real Crunchyroll watchlist (WebKit browser, not Safari):

```bash
npm run pw:live
```

This opens a persistent WebKit profile and injects `extension/content.js` + `extension/content.css` into `https://www.crunchyroll.com/watchlist`.

Use this for quick interactive checks. Final extension behavior still needs Safari/Xcode validation.

`pw:live` keeps injection active across login/redirect navigation, enables hot reload by default, and prints status lines like:

- `[startup] /watchlist nativeCards=... curatedCards=... controls=yes`
- `[watchlist-nav] /watchlist nativeCards=... curatedCards=... controls=yes`

Hot reload only reloads when file content actually changes (no-op for noisy watch events).

To disable hot reload explicitly:

```bash
CW_PW_HOT_RELOAD=0 npm run pw:live
```

Edits to `extension/content.js` or `extension/content.css` trigger:

- `[hot-reload] Reloading page and applying latest extension files...`

## Use (Real Site)

1. Open [https://www.crunchyroll.com/watchlist](https://www.crunchyroll.com/watchlist).
2. Use the tabs:
   - `Crunchyroll`: native watchlist (untouched)
   - `Curated`: extension-managed view
3. In `Curated`, use the toggles/selects to filter, sort, and switch card orientation.
4. Use `Refresh ratings` if you want to clear cached metadata and refetch.

## Behavior Notes

- `Non-actionable`, `Audio`, `Genre`, `Sort`, and `Landscape cards` selections all persist in extension storage so your view stays consistent across reloads.
- `Curated` is API-driven: it fetches all watchlist pages up front via Crunchyroll API pagination and preloads ratings in batches.
- Ratings and related metadata are fetched from Crunchyroll endpoints and cached locally for 12 hours.
- If API auth/loading fails, `Curated` shows an explicit API error instead of falling back to partial DOM-loaded rows.
- `Curated` shows a spinner while loading, and data preload starts in the background as soon as the watchlist page is ready.
- Crunchyroll native watchlist uses virtualization; `Curated` renders its own full-data list, so sorting/filtering is controlled entirely by the extension UI.
- Curated `Favorite`/`Remove` buttons forward clicks to Crunchyroll's native controls; nothing is triggered automatically.
- Because native watchlist is virtualized, action forwarding requires that native controls for that show have been loaded at least once in the native tab.

## Local fixture data

Automated tests use a local fixture server (`tests/server.mjs`) and fixture page (`tests/fixtures/watchlist-fixture.html`) so UI logic can be validated quickly without account/login dependencies.
