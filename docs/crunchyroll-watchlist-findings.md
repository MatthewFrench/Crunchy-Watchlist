# Crunchyroll Watchlist Integration Findings

Last verified: 2026-02-21 (US locale), live WebKit session against `https://www.crunchyroll.com/watchlist`.

## Core page routes

- Watchlist route: `https://www.crunchyroll.com/watchlist`
- Series route pattern: `https://www.crunchyroll.com/series/<SERIES_ID>/<slug>`

## Watchlist layout identifiers (live)

These are stable DOM hooks observed on the live watchlist. The extension itself depends on the page root/header for mounting; card-level selectors are still useful for diagnostics and smoke tooling.

- Watchlist root: `.erc-watchlist`
- Watchlist header: `.watchlist-header`
- Watchlist row container: `.erc-watchlist-virtual-list-row`
- Card wrapper item: `.erc-my-lists-item`
- Watchlist card: `[data-t="watch-list-card"]`
- Card title link: `.watchlist-card-title--o1sAO` and fallback `a[class*="watchlist-card-title"]`
- Card subtitle/status text: `.watchlist-card-subtitle--IROsU` and fallback `[class*="watchlist-card-subtitle"]`
- Card language/meta tags: `[data-t="meta-tags"]` and fallback `[class*="meta-tags"]`

Extension UI container:

- Tab host: `.cw-host`
- Tabs: `.cw-tabs`, `.cw-tab` (`Crunchyroll` and `Curated`)
- Controls root: `.cw-controls`
- Curated grid: `.cw-curated-grid`
- Curated card: `.cw-curated-card`
- Per-card rating marker: `.cw-rating-badge`
- Curated card native-action buttons: `.cw-card-action[data-cw-action="favorite|remove"]`
- Curated card hover preview node: `.cw-curated-card__preview`

## Actionability heuristic

Current non-actionable status patterns:

- `watch again`
- `rewatch`
- `coming soon`
- `unavailable`

Optional stricter filter:

- Filter by selected `audio_locales` value from the Audio dropdown.
- Filter by selected category/genre tag from the Genre dropdown.

## API and auth endpoints observed from live watchlist

User/session endpoints:

- `POST /auth/v1/token`
- `GET /accounts/v1/me`
- `GET /accounts/v1/me/multiprofile`

Watchlist and content endpoints:

- `GET /content/v2/discover/<account_or_profile_id>/watchlist?order=desc&n=100&locale=en-US`
- `GET /content/v2/cms/objects/<comma_separated_series_ids>?ratings=true&preferred_audio_language=en-US&locale=en-US`
- `GET <panel.streams_link>` (used for hover-preview URL lookup when present in watchlist panel payload)

Series page-related endpoints observed:

- `GET /content/v2/cms/series/<seriesId>?preferred_audio_language=en-US&locale=en-US`
- `GET /content/v2/cms/series/<seriesId>/seasons?force_locale=&preferred_audio_language=en-US&locale=en-US`
- `GET /content/v2/cms/seasons/<seasonId>/episodes?preferred_audio_language=en-US&locale=en-US`

## Data retrieval flow used by the extension

Rating fetch path (in order):

1. Load full watchlist from API:
   - Request bearer token (`POST /auth/v1/token`)
   - Paginate `/content/v2/discover/<accountId>/watchlist?...` with `n=100` and `start=0,100,200...`
   - Collect unique `series_id` values from entries
2. Batch rating preload for stale cache entries:
   - `GET /content/v2/cms/objects/<comma_separated_series_ids>?ratings=true&preferred_audio_language=en-US&locale=<locale>`
3. Build curated entries from API payload (title, series slug, availability, audio locale signals, thumbnail, etc.).
   - Collect cover variants from `images.*` and map to:
     - Portrait card cover (prefer `poster_tall`/portrait ratios)
     - Landscape card cover (prefer `poster_wide`/landscape ratios)
4. Render curated cards from extension-owned data model (not Crunchyroll's virtualized list DOM).
5. Store normalized `{ rating, votes, distribution, audioLocales, description, episodeCount, seasonCount, genreTags, updatedAt }` back into cache.
6. Start loading in the background when watchlist page mounts; curated tab shows spinner/loader while inflight.
7. On curated-card thumbnail hover, resolve stream preview URL from `panel.streams_link` response and render muted inline preview video when available.
8. On curated-card heart/trash clicks, forward click to matching native watchlist controls (same Crunchyroll handlers) when native row is currently loaded.

## Auth flow required for ratings

Direct calls to ratings/content endpoints can return `401` without a bearer token. The working flow is:

1. `POST /auth/v1/token` with:
   - Header `Authorization: Basic bm9haWhkZXZtXzZpeWcwYThsMHE6`
   - Header `Content-Type: application/x-www-form-urlencoded`
   - Body fields:
     - `device_id=<uuid>`
     - `device_type=Safari on macOS`
     - `grant_type=etp_rt_cookie`
2. Use returned `access_token` as:
   - Header `Authorization: Bearer <access_token>`
3. Request CMS object ratings using:
   - `/content/v2/cms/objects/<seriesId>?ratings=true&preferred_audio_language=en-US&locale=en-US`

Ratings are returned in payload shape:

- `data[0].rating.average`
- `data[0].rating.total`

## Response structure (observed schemas)

### `POST /auth/v1/token` (status `200`)

Top-level keys:

- `access_token`
- `refresh_token`
- `expires_in`
- `token_type`
- `scope`
- `country`
- `account_id`
- `profile_id`
- `fun_user`

Nested keys used/observed:

- `fun_user.is_fun_login`
- `fun_user.migration_status`
- `fun_user.watch_data_status`

### `GET /content/v2/cms/objects/<seriesIds>?ratings=true...` (status `200`)

Top-level keys:

- `total`
- `data[]`
- `meta`

Important `data[]` keys observed:

- Identity/content: `id`, `type`, `title`, `description`, `slug_title`, `channel_id`, `external_id`
- Rating block: `rating.average`, `rating.total`, `rating.1s..5s` (`displayed`, `percentage`, `unit`)
- Series metadata:
  - `series_metadata.audio_locales[]`
  - `series_metadata.subtitle_locales[]`
  - `series_metadata.is_dubbed`, `is_subbed`, `is_simulcast`, `is_mature`
  - `series_metadata.language_presentation.audio_notation`, `text_notation`
  - `series_metadata.content_descriptors[]`
  - `series_metadata.maturity_ratings[]`
  - `series_metadata.extended_maturity_rating.{level,rating,system}`
  - `series_metadata.season_count`, `episode_count`, `series_launch_year`
  - `series_metadata.tenant_categories[]`
- Images:
  - `images.poster_tall[][]` (variants by resolution)
  - `images.poster_wide[][]` (variants by resolution)
  - `images.thumbnail[][]` (wide thumbnail variants)

### `GET /content/v2/discover/<accountId>/watchlist?...` (status `200` with bearer token)

Top-level keys:

- `total`
- `data[]`
- `meta.total_before_filter`

Important `data[]` keys observed:

- `panel` (episode/series panel payload)
- Timestamps: `date_added`, `updated_at` (used when available for date sorting)
- Flags: `new`, `is_favorite`, `fully_watched`, `never_watched`
- `playhead`

Notable `data[].panel` keys:

- `id`, `type`, `title`, `description`, `slug_title`
- `images.thumbnail`
  - `images.poster_tall` (when present in this endpoint payload)
  - `images.poster_wide` (when present in this endpoint payload)
- `streams_link`
- `episode_metadata.*` including:
  - `audio_locale`, `duration_ms`, `episode_number`, `season_number`
  - `series_id`, `series_title`
  - `is_dubbed`, `is_subbed`, `is_premium_only`
  - `availability_status`, `availability_starts`, `availability_ends`
  - `subtitle_locales[]`, `tenant_categories[]`, `versions[]`

### Fallback endpoint behavior observed

- `GET /content-reviews/v3/rating/series/<seriesId>` returned `401` in our live tests without separate auth context.
- `GET /series/<seriesId>/<slug>` HTML did not reliably expose rating metadata on current pages.

## Extension storage schema

Settings key: `cw_settings_v1`

```json
{
  "activeTab": "curated | crunchyroll",
  "actionabilityMode": "none | dim | hide",
  "audioLocaleFilter": "any | en-US | ...",
  "genreFilter": "any | action | fantasy | ...",
  "cardLayout": "portrait | landscape",
  "sortMode": "none | rating_desc | rating_asc | date_added_desc | date_added_asc | date_updated_desc | date_updated_asc | votes_desc | star_points_desc | star_5_desc | star_4_desc | star_3_desc | star_2_desc | star_1_desc | star_5_pct_desc | star_4_pct_desc | star_3_pct_desc | star_2_pct_desc | star_1_pct_desc"
}
```

Ratings cache key: `cw_rating_cache_v2`

```json
{
  "GT00365592": {
    "rating": 4.6,
    "votes": 7506,
    "distribution": { "5": 64, "4": 21, "3": 9, "2": 4, "1": 2 },
    "audioLocales": ["ja-JP", "en-US"],
    "description": "Series summary text...",
    "episodeCount": 36,
    "seasonCount": 3,
    "genreTags": ["action", "fantasy"],
    "updatedAt": 1771704720075
  }
}
```

Auth device key: `cw_auth_device_id_v1` (UUID-like string used for `/auth/v1/token`)

## Data volume (measured)

Observed payload sizes in live tests:

- CMS single-series rating response: ~4.8 KB
- CMS 32-series batch response: ~152 KB
- Local cache for 40 series (`cw_rating_cache_v2`): ~2.5 KB

Implication: storing normalized rating cache locally is small and safe for long-lived extension storage.

## What this extension currently does with ratings

- Adds its own `Curated` tab and leaves Crunchyroll native tab content untouched.
- Acquires token via `/auth/v1/token`
- Preloads all watchlist pages (paginated `start` offsets) to gather full series set up front
- Prefetches ratings in batches for stale series IDs
- Fetches per-series rating via CMS objects endpoint
- Caches ratings + distribution + audio locales + description + series totals/category tags in `cw_rating_cache_v2` for 12 hours
- Renders rating score (`★ X.X`), vote count, and 5-star distribution bars with estimated per-star counts on each curated card
- Uses selected audio-locale and genre dropdown values for filtering
- Supports a card-layout toggle (`portrait` / `landscape`) driven by persisted setting state
- Shows next unwatched episode (`Sx Ey`) from watchlist panel metadata
- Shows seasons/episodes totals and estimated unwatched-left counts when episode ordering metadata is available
- Shows category/genre-like tags from `series_metadata.tenant_categories` when present
- Supports sort by rating ascending/descending, date added, date updated, total rating count, total star points, per-star counts, and per-star percentages in the extension-owned curated grid built from full watchlist API data
- Adds curated-card heart/trash controls that forward to native Crunchyroll watchlist actions
- Adds curated thumbnail hover preview via stream metadata when preview URL is available
- Uses portrait cover art for portrait cards and wide cover art for landscape cards (with ratio-based fallbacks when only one variant exists)

Currently used rating fields:

- `rating.average` -> shown in badge and used for sorting
- `rating.total` -> shown as rating count
- `rating.1s..5s.percentage` -> shown as histogram bars
- `series_metadata.audio_locales[]` -> used to populate/apply Audio dropdown filter
- `description` -> shown as compact card summary
- `series_metadata.season_count`, `episode_count` -> shown as totals and used in unwatched-left estimate
- `series_metadata.tenant_categories[]` -> shown as category/genre-like tags
- `images.poster_tall[][]` / `images.poster_wide[][]` / `panel.images.*` -> selected for non-hover card cover by card layout mode

Additional available fields not yet surfaced:

- More `series_metadata` attributes (simulcast, maturity, launch year, content descriptors, etc.)
- Extra panel metadata from discover/watchlist endpoint (`fully_watched`, `never_watched`, playhead, availability windows)

## Known constraints and caveats

- Crunchyroll native watchlist remains virtualized; the extension avoids mutating native row order and instead renders a separate curated grid.
- Curated entries are deduplicated by `series_id` from watchlist API rows.
- If API auth/pagination fails, curated mode shows an explicit API error and does not fall back to partial DOM rows.
- If a user has previously persisted settings in `cw_settings_v1`, those settings override defaults.
- CSS class names on Crunchyroll are partially hashed and may change; extension includes fallback selectors but future breakage is possible.
- Native action forwarding depends on the matching native row being present in DOM (watchlist virtualization can delay availability until row is loaded at least once).

## Live validation snapshot (WebKit)

Observed from an automated smoke pass against a logged-in profile:

- Controls mounted: yes
- Curated data source: API
- Curated total series loaded: 284
- Curated view rendered without mutating native watchlist tab content
