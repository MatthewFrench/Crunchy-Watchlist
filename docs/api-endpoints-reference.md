# Crunchyroll API Endpoint Reference (Extension)

Last updated: 2026-02-23
Source of truth: `extension/Content.js`

This document covers the network endpoints called directly by Crunchy Watchlist Curator, when each call happens, request/response structure, field meanings, and general data types.

## Scope

Included:
- Endpoints requested by extension code via `fetchWithResilience(...)`
- Fallback endpoints used only on error/missing-data paths
- Preview-stream endpoint used on demand (hover)

Excluded:
- Crunchyroll web app's own internal requests not initiated by the extension (for example `/accounts/v1/me`)

## Common Types

| Type | Meaning | Example |
| --- | --- | --- |
| `string` | Text value | `"GT00365613"` |
| `number` | JSON number | `7242` |
| `boolean` | True/false flag | `true` |
| `object` | JSON object/dictionary | `{ "average": "4.5" }` |
| `array<T>` | Ordered list of `T` | `["en-US", "ja-JP"]` |
| `locale` | Language locale (BCP-47 style) | `"en-US"` |
| `datetime` | ISO-8601 date-time string | `"2026-02-23T11:23:31Z"` |
| `url` | Absolute URL | `"https://www.crunchyroll.com/content/v2/..."` |
| `path` | Relative API path | `"/content/v2/cms/videos/.../streams"` |
| `id` | Crunchyroll resource identifier string | `"GE00366381ENUS"` |

## Endpoint Matrix

| Endpoint | Method | Called from | When called |
| --- | --- | --- | --- |
| `/auth/v1/token` | `POST` | `requestAccessToken()` | When auth token missing/expired or after auth-refresh retry |
| `/content/v2/discover/{account_id}/watchlist` | `GET` | `fetchWatchlistPage()` | On curated load and background revalidate; paginated |
| `/content/v2/{account_id}/watch-history` | `GET` | `fetchWatchHistoryPage()` | When watch-history cache stale or forced locale preload |
| `/content/v2/cms/objects/{series_ids}` | `GET` | `fetchRatingsBatch()`, `fetchRatingFromCmsObjects()` | When rating cache stale/missing localized counts |
| `/content-reviews/v3/rating/series/{series_id}` | `GET` | `fetchRating()` | Fallback only if CMS rating path fails/missing |
| `/series/{series_id}/{slug}` (HTML page) | `GET` | `fetchRatingFromSeriesPage()` | Final fallback after legacy rating path |
| `/content/v2/cms/videos/{video_id}/streams` | `GET` | `fetchPreviewUrlForEntry()` | On card hover when preview URL not cached (URL comes from `panel.streams_link`) |

## 1) Auth Token Endpoint

### Endpoint
`POST /auth/v1/token`

### Trigger
- Executed from `getAccessToken(false)` when current token is absent/expired.
- May be retried as part of 401 handling via `createAuthRefreshHandler(...)`.

### Request
- Headers:
  - `authorization: Basic <client credential>`
  - `content-type: application/x-www-form-urlencoded`
- Form body:

| Field | Type | Meaning |
| --- | --- | --- |
| `device_id` | `string` | Stable per-browser generated ID (`cw_auth_device_id_v1`) |
| `device_type` | `string` | Browser/platform label (e.g. `Safari on macOS`) |
| `grant_type` | `string` | Always `etp_rt_cookie` |

### Response (fields consumed)

| Field | Type | Meaning |
| --- | --- | --- |
| `access_token` | `string` | Bearer token for downstream API calls |
| `expires_in` | `number` | Token validity in seconds |
| `account_id` | `string` | Account/profile identifier used in watchlist/history URLs |

Observed optional fields (not required by extension): `refresh_token`, `token_type`, `scope`, `country`, `profile_id`, `fun_user`.

## 2) Watchlist Endpoint

### Endpoint
`GET /content/v2/discover/{account_id}/watchlist`

### Trigger
- Called during `loadCuratedEntries(...)`.
- Paged by `fetchAllWatchlistRows(...)` until exhausted.

### Query Parameters

| Field | Type | Meaning |
| --- | --- | --- |
| `order` | `string` | Sort order sent to API (`desc`) |
| `n` | `number` | Page size (`100`) |
| `start` | `number` | Row offset (0, 100, 200...) |
| `preferred_audio_language` | `locale` | Preferred audio locale for variant selection |
| `locale` | `locale` | UI locale for localized metadata |

### Response Shape
Top-level:

| Field | Type | Meaning |
| --- | --- | --- |
| `total` | `number` | Total watchlist rows available |
| `data` | `array<object>` | Watchlist rows |
| `meta` | `object` | Extra server metadata |

Row-level fields consumed:

| Field | Type | Meaning |
| --- | --- | --- |
| `new` | `boolean` | Marks item as newly available/next |
| `is_favorite` | `boolean` | User favorite flag |
| `fully_watched` | `boolean` | Series is fully watched |
| `never_watched` | `boolean` | User has not started series |
| `playhead` | `number` | Milliseconds/position for current episode progress |
| `date_added` / `updated_at` (and aliases) | `datetime` | Date signals used for sort/metadata |
| `panel` | `object` | Embedded episode/series card payload |

Important `panel` fields consumed:

| Field | Type | Meaning |
| --- | --- | --- |
| `panel.id` | `id` | Current watchlist panel media identifier |
| `panel.title` | `string` | Episode title |
| `panel.description` | `string` | Episode description |
| `panel.slug_title` | `string` | Episode slug |
| `panel.streams_link` | `path` | Endpoint path for stream/preview lookup |
| `panel.images` | `object` | Cover/thumbnail variants |
| `panel.episode_metadata` | `object` | Core series+episode metadata |

Important `panel.episode_metadata` fields consumed:

| Field | Type | Meaning |
| --- | --- | --- |
| `series_id` | `id` | Canonical series identifier |
| `identifier` | `string` | Canonical episode tuple (`GT...|S...|E...`) used for locale-agnostic episode identity |
| `series_title` | `string` | Series display title |
| `series_slug_title` | `string` | Series slug for URL |
| `season_number` | `number` | Season index |
| `season_id` | `id` | Locale-specific season GUID (`GS...<LOCALE4>`) |
| `episode_number` | `number` | Episode index within season |
| `sequence_number` | `number` | Global episode sequence index |
| `audio_locale` | `locale` | Audio locale of this row/variant |
| `availability_status` | `string` | Availability flag (`available`, etc.) |
| `is_dubbed` | `boolean` | Dub availability flag |
| `is_subbed` | `boolean` | Sub availability flag |
| `subtitle_locales` | `array<locale>` | Subtitle locales available |
| `tenant_categories` | `array<string>` | Genre/category tags |
| `versions` | `array<object>` | Available media variants by locale |

`versions[]` common fields:
- `guid` (`id`): media/episode identifier
- `media_guid` (`id`): stream/media object identifier
- `audio_locale` (`locale`): variant language
- `original` (`boolean`): marks original/main audio
- `roles` (`array<string>`): role tags (`main`, `dub`, etc.)

## 3) Watch-History Endpoint

### Endpoint
`GET /content/v2/{account_id}/watch-history`

### Trigger
- Called from `preloadWatchHistoryForEntries(...)` when cache stale.
- Also called for selected audio locale hydration (forced locale preload).

### Query Parameters

| Field | Type | Meaning |
| --- | --- | --- |
| `page_size` | `number` | Page size (`100`) |
| `page` | `number` | 1-based page index |
| `preferred_audio_language` | `locale` | Locale scoping for history retrieval |
| `locale` | `locale` | UI locale |

### Response Shape
Top-level:

| Field | Type | Meaning |
| --- | --- | --- |
| `total` | `number` | Total retained history rows |
| `data` | `array<object>` | History rows |
| `meta` | `object` | Paging metadata |

Row fields consumed:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `id` | Episode/media id for history item |
| `date_played` | `datetime` | Playback timestamp (source of "last watched") |
| `parent_id` | `id` | Parent resource id (series id in observed data) |
| `parent_type` | `string` | Parent type (`series`) |
| `playhead` | `number` | In-episode progress |
| `fully_watched` | `boolean` | Episode completion flag |
| `panel` | `object` | Episode panel metadata |

`panel.episode_metadata` fields consumed are the same core fields as watchlist (`series_id`, `series_title`, `season_number`, `episode_number`, `sequence_number`, `audio_locale`, `versions[]`, etc.).

Additional identity fields consumed for joins:
- `panel.episode_metadata.identifier` (`string`)
- `panel.id` (`id`)
- `id` (`id`, watch-history row id)

## 4) CMS Objects Endpoint (Ratings + Series Metadata)

### Endpoint
`GET /content/v2/cms/objects/{series_ids}`

### Trigger
- Primary rating/source metadata path.
- Batch mode via `fetchRatingsBatch(...)` for stale series IDs.
- Single-id mode via `fetchRatingFromCmsObjects(...)` fallback helper.
- Called per preferred audio locale when localized counts are missing.

### Query Parameters

| Field | Type | Meaning |
| --- | --- | --- |
| `ratings` | `boolean` (query string) | Always `true` in extension calls |
| `preferred_audio_language` | `locale` | Locale-specific count and metadata view |
| `locale` | `locale` | UI locale |

### Response Shape
Top-level:

| Field | Type | Meaning |
| --- | --- | --- |
| `total` | `number` | Number of objects returned |
| `data` | `array<object>` | Series objects |
| `meta` | `object` | Extra metadata |

Series object fields consumed:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `id` | Series identifier |
| `title` | `string` | Series title |
| `description` | `string` | Series summary |
| `slug_title` | `string` | Series slug |
| `rating` | `object` | Aggregate rating distribution |
| `series_metadata` | `object` | Audio/subtitle/count/category metadata |
| `images` | `object` | Poster/thumbnail variants |

`rating` fields consumed:

| Field | Type | Meaning |
| --- | --- | --- |
| `average` | `string` or `number` | Average score (normalized to numeric) |
| `total` | `number` | Total rating count |
| `1s`..`5s` | `object` | Star-bucket breakdown with `percentage`/`displayed` |

`series_metadata` fields consumed:

| Field | Type | Meaning |
| --- | --- | --- |
| `audio_locales` | `array<locale>` | Available audio locales |
| `subtitle_locales` | `array<locale>` | Available subtitle locales |
| `episode_count` | `number` | Total episodes (locale-dependent if API localizes) |
| `season_count` | `number` | Total seasons (locale-dependent if API localizes) |
| `tenant_categories` | `array<string>` | Genre/category tags |
| `genres` | `array<string>` | Genre tags (when provided) |
| `is_dubbed` | `boolean` | Dub availability |
| `is_subbed` | `boolean` | Subtitle availability |

## 5) Legacy Rating Fallback Endpoint

### Endpoint
`GET /content-reviews/v3/rating/series/{series_id}`

### Trigger
- Called only in `fetchRating(...)` if CMS rating path does not produce a rating.

### Response Handling
- Payload is parsed leniently by `parseRatingPayload(...)`.
- Accepted locations include:
  - `rating.average`, `rating.value`, `average`, `aggregateRating.ratingValue`
  - count via `rating.count`, `rating.total`, `count`, `total`, `aggregateRating.ratingCount`

General type expectations:
- Rating value: `string|number` convertible to `0..5`
- Vote count: `string|number` convertible to non-negative integer

## 6) Series Page HTML Fallback

### Endpoint
`GET /series/{series_id}/{slug}`

### Trigger
- Final rating fallback after both CMS and legacy rating endpoint fail.

### Response Handling
- This is HTML, not JSON.
- Regex parser attempts extraction from embedded structured Content:
  - `ratingValue` / `averageRating` / `average`
  - `ratingCount` / `votes` / `count`

## 7) Streams Endpoint (Preview)

### Endpoint
`GET /content/v2/cms/videos/{video_id}/streams`

### Trigger
- Called lazily on card hover in `fetchPreviewUrlForEntry(...)` if preview URL is not cached.
- Requested from `panel.streams_link` in watchlist payload (extension does not synthesize this path).

### Response Fields Used
`parsePreviewUrlFromPayload(...)` checks these candidates in order:

| Field | Type | Meaning |
| --- | --- | --- |
| `preview_url` / `previewUrl` | `url` | Direct preview media URL |
| `preview_image` / `previewImage` | `url` | Preview image URL |
| `preview.url` / `preview.image` | `url` | Nested preview URL |
| `url` | `url` | Generic URL fallback |
| `streams.adaptive_hls.url` / `streams.adaptive_hls[""]` | `url` | HLS stream URL |
| `streams.hls.url` / `streams.hls[""]` | `url` | Alternate HLS stream URL |

If those are absent, it recursively scans nested `streams` objects for first media-like URL.

## Call Lifecycle

Typical curated-load sequence:
1. `POST /auth/v1/token` (if needed)
2. `GET /content/v2/discover/{account_id}/watchlist` (paged)
3. `GET /content/v2/cms/objects/{series_ids}` (batched chunks)
4. `GET /content/v2/{account_id}/watch-history` (paged, early-stop heuristics)
5. Optional locale-specific repeats of (3) and (4) when selected audio locale differs or localized data is missing
6. On hover only: `GET /content/v2/cms/videos/{video_id}/streams`
7. Fallback only: legacy rating endpoint then series HTML page

## Cross-Field ID Inference (Live Capture)

Dataset analyzed:
- `.tmp/villainess-api-calls-live.json` (`2` watchlist calls, `4` watch-history calls, `3` CMS-object calls)

Generated path/type inventories used in this analysis:
- `.tmp/schema-content_v2_discover_account_id_watchlist.json`
- `.tmp/schema-content_v2_account_id_watch_history.json`
- `.tmp/schema-content_v2_cms_objects_series_ids.json`

### ID Taxonomy (Inferred)

| Pattern | Example | Inferred meaning | Confidence |
| --- | --- | --- | --- |
| `UUID` | `6568b56e-38dc-5552-82e3-99b3ade5802e` | `account_id` in watchlist/history route path | High |
| `GT########` | `GT00365613` | Series ID | High |
| `GS########<LOCALE4>` | `GS00365614ENUS` | Locale-specific season GUID | High |
| `GE########<LOCALE4>` | `GE00366381ENUS` | Locale-specific episode GUID | High |
| `GE...V` | `GE00366381ENUSV` | Video/media GUID used by streams endpoint | High |
| `EPI.<GE...>` | `EPI.GE00366381ENUS` | Episode external ID alias for episode GUID | High |
| `SRZ.<GT...>` | `SRZ.GT00365613` | Series external ID alias for series GUID | High |
| `cms:/episodes/<GE...>` | `cms:/episodes/GE00366381ENUS` | Linked-resource key for episode | High |
| `cms:/series/<GT...>` | `cms:/series/GT00365613` | Linked-resource key for series | High |
| `GT...|S...|E...` | `GT00365613|S00365614|E5` | Composite series/season/episode identifier (`S` uses season numeric core without locale suffix) | High |

Locale token mapping observed in IDs:
- `JAJP` -> `ja-JP`
- `ENUS` -> `en-US`
- `THTH` -> `th-TH`

### Proven Join/Consistency Rules

The following rules were verified via scripted checks against the captured JSON:

| Rule | Result |
| --- | --- |
| `watch-history.data[].id == panel.id` | `10/10` |
| `panel.id == versions[audio_locale == panel.episode_metadata.audio_locale].guid` | `12/12` |
| `panel.external_id == "EPI." + panel.id` | `12/12` |
| `panel.linked_resource_key == "cms:/episodes/" + panel.id` | `12/12` |
| `versions[].media_guid == versions[].guid + "V"` | `32/32` |
| `season_id == versions[audio_locale].season_guid` | `12/12` |
| `identifier` parses to `(series, season core, episode #)` and matches row metadata | `12/12` |
| `streams_link` video id matches selected version `media_guid` | `12/12` |
| `cms.external_id == "SRZ." + cms.id` | `3/3` |
| `cms.linked_resource_key == "cms:/series/" + cms.id` | `3/3` |

### Repeat-ID Patterns (Important for Deduping)

Observed repeated IDs are from repeated calls with different request params, not distinct Content rows:

- Watchlist:
  - Same row (`GE00366381ENUS`) returned in both calls:
    - without `preferred_audio_language`
    - with `preferred_audio_language=en-US`
- Watch-history:
  - Same five rows repeated across:
    - `preferred_audio_language=en-US` pages 1/2
    - `preferred_audio_language=any` pages 1/2
  - For this show, row payloads were byte-equivalent between `en-US` and `any`.
- CMS objects:
  - Same series row (`GT00365613`) repeated across 3 calls (two `en-US`, one `any`) and payloads were identical in this capture.

### Field-Level Addenda From Patterns

- `playhead` appears to be seconds, while `duration_ms` is milliseconds.
  - Example: `playhead=1107` with `duration_ms=1420087` (~`1420s`).
- `availability_ends` using `9998-12-01T07:59:00Z` behaves as a far-future sentinel (effectively no planned expiry in normal horizon).
- `rating.1s..5s.displayed` + `unit` is human-formatted text (`5.7` + `K`), while `rating.total` is numeric.
- `rating.1s..5s.percentage` is bucket percentage and can sum to slightly above 100 due to rounding.
- `slug` is empty in this capture; `slug_title` is the usable URL slug.
- `roles` fields are not restricted to `main`/`dub`; `description` also appears in some rows.

### User-Facing Behaviors Implemented From These Fields

- Continue labeling:
  - Card status uses in-progress playback (`playhead > 0 && !fully_watched`) from watchlist row, with watch-history as fallback.
- Audio-scoped progress and counts:
  - `Unwatched left` uses selected-audio watch-history progress when available (`preferred_audio_language` scoped history).
  - Episode totals prefer locale-scoped counts from CMS objects for selected audio.
- Canonical episode identity:
  - Extension derives a locale-agnostic key from `identifier` (`GT...|S...|E...`) and uses this to stabilize cross-endpoint joins.
- Preview correctness across variants:
  - Preview cache key is tied to `streams_link` / media identity (not only series id), avoiding stale preview reuse across variant changes.
- Repeated-result resilience:
  - Repeated rows across calls (for example `preferred_audio_language=en-US` vs `any`) are deduped by stable identity before progress aggregation.

## Reliability Notes

- Contracts are validated with `requirePayloadDataArray(...)` and audit helpers (`auditWatchlistRowsContract`, `auditWatchHistoryRowsContract`, `auditCmsObjectContract`).
- Rate-limit/5xx handling includes bounded retries and backoff (`fetchWithResilience`).
- Watchlist/history/rating caches are versioned and TTL-scoped in local storage.

## Related Files

- `extension/Content.js` (network calls, parsing, caching)
- `docs/crunchyroll-watchlist-findings.md` (broader live-observation notes)
- `.tmp/villainess-api-calls-live.json` (example per-show captured payload from live run)
