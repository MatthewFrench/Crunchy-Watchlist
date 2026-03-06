# Non-Watchlist Audio Filter And Rating Plan

Last updated: 2026-03-06

## 1) Objective

Add an opt-in extension-owned filter component for these Crunchyroll surfaces:

- homepage / `https://www.crunchyroll.com/discover`
- New / `https://www.crunchyroll.com/videos/new`
- Popular / `https://www.crunchyroll.com/videos/popular`
- Search / `https://www.crunchyroll.com/search`

User promise:

- users can choose `All audio` or filter to a specific audio locale
- when a specific audio locale is selected, titles without that audio are hidden
- when Crunchyroll API data includes ratings but the native card does not visibly show them, the extension adds a compact rating chip

## 2) Scope

In scope:

- add an extension-owned audio filter control on supported non-watchlist routes
- support `All audio` plus specific audio locale filtering
- hide non-matching native Crunchyroll cards/results in place
- add ratings only when missing from the native card
- preserve native DOM node identity and patch in place
- reuse existing auth, CMS, locale-normalization, and cache patterns where possible
- add deterministic unit, fixture, and Playwright coverage

Out of scope for the first release:

- replacing Crunchyroll browse/search layouts with extension-owned layouts
- filtering series pages, watch pages, Crunchylists, or History
- filtering News, Store, Manga, Games, ads, or merch-only content
- anti-bot bypass or spoofing work

## 3) Current Baseline

Repository findings:

- the extension injects on all Crunchyroll pages but intentionally activates only on `/watchlist`
- non-watchlist pages are explicit runtime no-ops today
- the repo already has working audio-locale normalization and `en-US` eligibility logic, but only inside the curated watchlist flow
- existing settings already understand `en-US`, but that state is watchlist-scoped and should not silently become global

Key references:

- `extension/manifest.json`
- `extension/src/Runtime/BootstrapGate.ts`
- `extension/src/Runtime/RouteLifecycle.ts`
- `extension/src/Runtime/InterfaceShell.ts`
- `extension/src/Domain/EntryNormalizer.ts`
- `extension/src/Runtime/StateLoader.ts`

## 4) Live API Findings (Verified 2026-03-06)

### Popular

Observed route:

- `/videos/popular`

Observed API:

- `GET /content/v2/discover/browse?n=36&sort_by=popularity&ratings=true&locale=en-US`

Observed useful fields on series rows:

- `id`
- `title`
- `slug_title`
- `series_metadata.audio_locales[]`
- `series_metadata.is_dubbed`
- `series_metadata.subtitle_locales[]`
- `series_metadata.language_presentation`
- `rating.average`
- `rating.total`

Implication:

- Popular already exposes enough data for both audio filtering and rating augmentation from one route payload

### New

Observed route:

- `/videos/new`

Observed API:

- `GET /content/v2/discover/browse?n=36&sort_by=newly_added&ratings=true&locale=en-US`

Observed useful fields:

- same useful series metadata and rating shape as Popular

Implication:

- New can share the same route-data pipeline as Popular

### Search

Observed route:

- `/search?q=<query>`

Observed API:

- `GET /content/v2/discover/search?q=<query>&n=6&type=music,series,episode,top_results,movie_listing&ratings=true&locale=en-US`

Observed grouped behavior:

- `series` items include `series_metadata.audio_locales[]`, `rating.average`, and `rating.total`
- `top_results` items include the same series-level fields
- `episode` items include `episode_metadata.series_id` and `episode_metadata.audio_locale`
- `episode` items carry a different vote object and should not be treated as the canonical series rating source
- `music` and other non-series groups should be ignored by the filter

Implication:

- Search is viable for both features, with a series-level fallback needed for episode rows

### Discover / Homepage

Observed route:

- `/discover`

Observed behavior:

- many native `/series/<seriesId>/<slug>` links are present in the DOM
- ratings are visible on some native homepage cards and absent on others
- the rendered HTML does not expose clean `audio_locales` fields directly to the content script
- runtime calls observed during the session were mostly `up_next`, `history`, `watchlist`, and `seasonal_tags`, not a single clean browse feed suitable for direct reuse
- the page is rendered through Next/Flight script payloads and runtime data, not simple static markup

Implication:

- Discover is still viable, but it needs DOM `seriesId` extraction plus cached CMS fallback for audio and ratings

### Audio label source

Observed public config:

- `https://static.crunchyroll.com/config/i18n/v3/audio_languages.json`

Observed behavior:

- the config includes useful locale labels such as `en-US`, `de-DE`, `es-419`, `fr-FR`, and `pt-BR`
- it did not include `ja-JP` in the live capture

Implication:

- the filter component can use this config, but it also needs a locale-code fallback label path

## 5) Architectural Decision

This is a new non-watchlist product surface, not a watchlist extension.

Do not:

- extend the watchlist shell into browse/search/homepage routes
- couple non-watchlist filtering to watchlist DOM anchors
- rebuild or clone native Crunchyroll cards
- depend on repeated descendant selector scans inside extension-owned state

Recommended direction:

- add a separate non-watchlist controller family
- keep it passive and native-page-respecting
- classify native cards by route payloads where available
- fall back to shared series metadata lookup by `seriesId` where needed

Important implementation constraint:

- content scripts do not automatically get page-owned `fetch` response bodies from the main world
- direct unauthenticated `fetch('/content/v2/...')` calls from page context return `401`
- the page app succeeds because it adds a bearer token
- the extension should therefore use its own existing auth flow and self-issued requests instead of depending on page-request interception

Recommendation:

- self-fetch `discover/browse` and `discover/search` with the extension auth path
- use DOM extraction plus batched CMS object lookup for Discover gaps

## 6) Product Decision

Recommended first-release behavior:

- feature is opt-in
- audio control defaults to `All audio`
- filtering behavior is hide, not dim
- rating enhancement is enabled by default
- do not silently upgrade watchlist-only `audioLocaleFilter` into a global browse/search filter

Recommended settings:

- `browseAudioLocaleFilter: string`
  - `all`
  - normalized locale such as `en-US`
- `browseEnhanceMissingRatings: boolean`

Possible future settings:

- per-surface audio scope
- per-surface rating enhancement scope

## 7) Confidence Assessment

Current confidence by area:

- Popular audio filter: high
- New audio filter: high
- Search audio filter: high
- Discover audio filter: medium-high
- Popular/New rating augmentation: high
- Search rating augmentation: high
- Discover rating augmentation: medium-high

Why confidence is high:

- Popular/New/Search already expose the needed audio and rating data in route payloads
- the repo already has working auth and CMS infrastructure
- native cards expose stable `/series/<seriesId>/...` links for fallback classification

Why confidence is lower on Discover:

- homepage data is not exposed through one clean route payload to the content script
- homepage needs DOM extraction plus CMS fallback rather than a single route request

## 8) Route Strategy

| Surface | Detection | Primary data source | Fallback | Notes |
| --- | --- | --- | --- | --- |
| Popular | `/videos/popular` | self-fetch `discover/browse?sort_by=popularity` | none | route payload already includes audio locales and series ratings |
| New | `/videos/new` | self-fetch `discover/browse?sort_by=newly_added` | none | same implementation shape as Popular |
| Search | `/search` | self-fetch `discover/search` | CMS batch for unresolved `episode_metadata.series_id` | ignore non-series groups |
| Discover | `/discover` | DOM `seriesId` extraction + cache | CMS batch objects lookup | highest complexity; reuse fallback for both audio and ratings |

## 9) Audio Filter Component

Recommended control shape:

- extension-owned `Audio` select control
- first option: `All audio`
- remaining options: normalized audio locale choices

Preferred option sources:

1. `audio_languages.json`
2. locales observed in route payloads
3. locale-code fallback labels generated locally

Recommended label resolution:

- use Crunchyroll config label when available
- otherwise derive a readable label from locale code

Examples:

- `en-US` -> `English`
- `ja-JP` -> `Japanese (Japan)` via local fallback
- `es-419` -> `Spanish (Latin America)` via local fallback

Filtering rule:

- if selected value is `all`, do not hide on audio grounds
- otherwise keep a title only if its normalized audio locales contain the selected locale

## 10) Rating Augmentation

Goal:

- inject ratings only when the native card does not already visibly show one

Recommended rating source priority:

1. route payload `rating.average` and `rating.total`
2. CMS object fallback `rating.average` and `rating.total`

Recommended display:

- compact chip with `4.7`
- optional compact vote count such as `(225.4k)` where space allows

Recommended injection rules:

- never duplicate an already visible native rating
- patch a single extension-owned rating ref per card
- do not re-query deep descendants repeatedly after patching

Route note:

- Popular/New/Search series cards can usually be rated from their main route payload
- Discover should reuse the same CMS fallback record used for audio classification

## 11) Eligibility And Rating Rules

Primary audio rule:

- a title matches if its normalized audio locales contain the selected audio locale

Route-specific audio rules:

- Popular/New series cards:
  - classify from `series_metadata.audio_locales`
- Search series/top-results:
  - classify from `series_metadata.audio_locales`
- Search episode rows:
  - provisional fallback: `episode_metadata.audio_locale === <selected locale>`
  - authoritative fallback: resolve `episode_metadata.series_id` through shared series cache / CMS lookup
- Discover:
  - classify by extracted `seriesId` through shared series cache / CMS lookup

Rating rules:

- series/top-results route ratings are valid series score sources
- episode-row vote objects are not a replacement for canonical series ratings
- do not inject ratings into non-series cards

Native content that should not be filtered:

- music results
- editorial cards with no series id
- external links, ads, merch, and non-Crunchyroll content units

## 12) Proposed Modules

### Runtime

- `extension/src/Runtime/BrowseRouteGate.ts`
  - non-watchlist route detection and scope gating
- `extension/src/Runtime/BrowseAudioFilterOwner.ts`
  - lifecycle, async orchestration, cleanup
- `extension/src/Runtime/BrowseDomAdapter.ts`
  - native-page discovery only
- `extension/src/Runtime/BrowseVisibilityPatcher.ts`
  - hide/show patching for existing native cards
- `extension/src/Runtime/BrowseRatingPatcher.ts`
  - injects compact rating chip when missing
- `extension/src/Runtime/BrowseFilterControls.ts`
  - creates and patches the `Audio` select control

### Data

- `extension/src/Data/BrowseDiscoveryClient.ts`
  - self-fetches `discover/browse` and `discover/search`
- `extension/src/Data/BrowseSeriesMetadataRepository.ts`
  - shared audio + rating cache
  - CMS fallback lookup by `seriesId`

### Domain

- `extension/src/Domain/BrowseCardMetadata.ts`
  - normalizes route payloads into one typed metadata contract
- `extension/src/Domain/BrowseAudioEligibility.ts`
  - selected-audio matching
- `extension/src/Domain/BrowseLocaleLabels.ts`
  - config-backed and locale-code fallback label resolution

### Tests

- `tests/Unit/Data/BrowseDiscoveryClient.test.ts`
- `tests/Unit/Data/BrowseSeriesMetadataRepository.test.ts`
- `tests/Unit/Domain/BrowseCardMetadata.test.ts`
- `tests/Unit/Domain/BrowseLocaleLabels.test.ts`
- `tests/Unit/Runtime/BrowseAudioFilterOwner.test.ts`
- `tests/Unit/Runtime/BrowseVisibilityPatcher.test.ts`
- `tests/Unit/Runtime/BrowseRatingPatcher.test.ts`
- `tests/BrowseAudioFilter.spec.ts`

## 13) DOM Policy

Non-negotiable rules:

- do not replace native Crunchyroll cards
- do not clone native cards for filtering or animation
- preserve native image and video node identity
- patch visibility and rating UI in place
- keep extension-created state in owners or `WeakMap`s, never DOM expandos
- give every listener, observer, timer, and async flow a deterministic `dispose()` path

Recommended visibility mechanism:

- add one extension-owned class such as `.cw-browse-hidden`
- apply it only to native page-owned wrappers already identified by the adapter
- do not reset native media `src`

Recommended rating mechanism:

- add one extension-owned rating chip root per patched card
- patch its text in place
- keep the injected ref in owner state or `WeakMap`

## 14) Network And Cache Plan

### Popular / New

- one self-issued `discover/browse` request per route revision
- no CMS fallback expected in steady state
- same request drives both audio filtering and rating augmentation

### Search

- one self-issued `discover/search` request per query revision
- CMS fallback only for unresolved episode `seriesId`s
- use series/top-results rating payloads directly

### Discover

- do not try to mirror the entire homepage feed
- extract visible `seriesId`s from native links
- query cache first
- batch unresolved ids through existing CMS objects endpoint in chunks of `50`
- reuse the same fallback metadata for audio and ratings

### Cache

Recommended cache key:

- `cw_browse_series_metadata_cache_v1`

Recommended record:

- `seriesId`
- `audioLocales`
- `ratingAverage`
- `ratingTotal`
- `updatedAt`
- `source` (`discover-browse`, `discover-search`, `cms-objects`)

Recommended TTL:

- 12 hours unless testing proves a shorter budget is needed

## 15) Rollout Plan

### Phase 1: Foundation

- add new browse settings and storage wiring
- add route gate and top-level owner skeleton
- add shared metadata normalization for audio and ratings
- add shared series metadata repository and cache

### Phase 2: Popular and New

- implement self-fetch `discover/browse`
- map returned `seriesId`s to visible native cards
- hide unsupported cards in place
- inject rating chips only where native rating is absent
- add fixture coverage for both routes

### Phase 3: Search

- implement self-fetch `discover/search`
- classify `series` and `top_results` directly
- add `seriesId` fallback for episode rows
- ignore `music` and other non-series groups
- inject series ratings only where absent

### Phase 4: Discover

- extract visible `seriesId`s from native `/series/` links
- query shared cache first
- batch unresolved ids through CMS objects
- hide unsupported cards in place
- inject missing ratings from the same fallback record
- dedupe repeated homepage appearances of the same series

### Phase 5: UX Surface

- mount the route-local `Audio` filter control
- decide whether browse settings also need a longer-lived settings home

### Phase 6: Hardening

- add request-budget tests
- add node-identity stability tests
- add duplicate-rating prevention tests
- run live read-only verification on all four surfaces

## 16) Acceptance Criteria

The feature is complete when:

- the `Audio` control supports `All audio` plus specific locale filtering
- selecting a locale hides non-matching titles on Popular, New, Search, and Discover
- supported titles remain visible
- non-series/native editorial content remains untouched
- no native card nodes are replaced during filtering
- ratings are injected only when the native card does not already visibly show one
- Popular/New/Search do not require per-title CMS lookups in steady state
- Discover fallback is batched, cached, and deduped by `seriesId`
- disabling or resetting the filter restores native visibility cleanly
- route transitions clean up observers and timers deterministically

## 17) Risks

### Risk: homepage DOM drift

- Discover is the least stable surface
- mitigation:
  - keep the adapter narrow and series-link based
  - cache by `seriesId`
  - add route-specific fixture coverage

### Risk: false negatives on search episode rows

- episode rows may represent one locale variant of an English-capable series
- mitigation:
  - prefer series-level classification
  - use `episode_metadata.audio_locale` only as a temporary fallback

### Risk: rating duplication in mixed native layouts

- some native cards already show ratings and some do not
- mitigation:
  - use a visible-rating detector before injection
  - add tests for rated and unrated native layouts

### Risk: duplicate network churn

- route churn and DOM churn can trigger repeated work
- mitigation:
  - revision-gate route fetches
  - dedupe inflight fallback lookups by `seriesId`
  - cache route metadata

### Risk: surprising user behavior change

- watchlist-only audio settings could accidentally become global
- mitigation:
  - use separate browse settings
  - default to `All audio`

## 18) Verification Plan

Automated:

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

Manual live verification:

- follow the repo's Cloudflare-safe CDP workflow
- verify read-only behavior on:
  - `/discover`
  - `/videos/new`
  - `/videos/popular`
  - `/search?q=naruto`
- verify hidden cards do not flicker back during churn or scroll
- verify cards with existing visible ratings are not double-badged
- verify missing-rating cards receive the injected rating chip

## 19) Tracker

Legend:

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[!]` blocked / needs decision

### 19.1 Decisions

- [ ] Confirm one global `Audio` control vs per-surface controls
- [ ] Confirm the first user-facing home for persistent browse settings
- [ ] Confirm whether search episode rows should use strict episode-level audio or series-level eligibility when they disagree
- [ ] Confirm rating chip visual treatment and placement rules

### 19.2 Foundation

- [ ] Add `browseAudioLocaleFilter` setting contract and persistence
- [ ] Add `browseEnhanceMissingRatings` setting contract and persistence
- [ ] Add non-watchlist route gate owner
- [ ] Add shared browse metadata normalization for audio + ratings
- [ ] Add shared browse metadata cache repository
- [ ] Add locale label-resolution helper with config-backed and locale-code fallback labels
- [ ] Add runtime cleanup/disposal tests

### 19.3 Popular / New

- [ ] Add `BrowseDiscoveryClient` support for `discover/browse`
- [ ] Add DOM adapter for native Popular/New cards
- [ ] Add visibility patcher for native cards
- [ ] Add missing-rating patcher for Popular/New cards
- [ ] Add fixture coverage for Popular
- [ ] Add fixture coverage for New

### 19.4 Search

- [ ] Add `BrowseDiscoveryClient` support for `discover/search`
- [ ] Add search classifier for `series` and `top_results`
- [ ] Add episode-group `seriesId` fallback lookup
- [ ] Ignore non-series groups explicitly
- [ ] Add missing-rating patcher for Search results
- [ ] Add search fixture coverage

### 19.5 Discover

- [ ] Add homepage native-card/link discovery adapter
- [ ] Add `seriesId` extraction from native `/series/` links
- [ ] Add CMS batch fallback for unresolved homepage series ids
- [ ] Add duplicate-series dedupe across homepage rails
- [ ] Add missing-rating patcher for homepage cards lacking visible rating
- [ ] Add homepage fixture coverage

### 19.6 Hardening

- [ ] Add request-budget tests for steady-state filtering
- [ ] Add node-identity stability tests for filtered native cards
- [ ] Add route-churn tests for cleanup and remount behavior
- [ ] Add duplicate-rating prevention tests
- [ ] Add live Playwright verification notes to the resulting implementation updates

### 19.7 Release

- [ ] Run full quality gate suite
- [ ] Validate Chromium, Firefox, WebKit, and Safari packaging
- [ ] Perform final live verification against real Crunchyroll pages
- [ ] Update end-user documentation if the setting becomes user-visible

## 20) Recommended Execution Order

1. Foundation
2. Popular / New
3. Search
4. Discover
5. UX surface
6. Hardening and release validation

This order delivers the highest-confidence routes first and defers Discover until the shared metadata, caching, and patching infrastructure already exists.
