# Non-Watchlist English Audio Filter Plan

Last updated: 2026-03-06

## 1) Objective

Add an opt-in feature that hides non-`en-US` audio titles from these Crunchyroll surfaces:

- homepage / `https://www.crunchyroll.com/discover`
- New / `https://www.crunchyroll.com/videos/new`
- Popular / `https://www.crunchyroll.com/videos/popular`
- Search / `https://www.crunchyroll.com/search`

User promise:

- when enabled, users who only want English-dubbed shows should not see titles that do not offer `en-US` audio on the supported surfaces.

## 2) Scope

In scope:

- hide native Crunchyroll cards/results for unsupported titles
- preserve native DOM node identity and mutate visibility in place
- reuse existing locale-normalization logic where possible
- add deterministic fixture and unit coverage
- add focused live read-only Playwright verification on real Crunchyroll pages

Out of scope for the first release:

- filtering Crunchylists, History, Series detail pages, or watch pages
- filtering non-anime content such as News, Store, Manga, Games, ads, or merch banners
- replacing Crunchyroll layouts with extension-owned browse/search layouts
- anti-bot workarounds or page-spoofing tactics

## 3) Current Baseline

Repository findings:

- The extension injects on all Crunchyroll pages but intentionally activates only on `/watchlist`.
- Non-watchlist pages are currently explicit no-ops.
- The existing audio-locale classifier is real and reliable, but it is only used inside the curated watchlist pipeline.
- Existing settings already understand `en-US` as the English-audio filter value, but that state is currently watchlist-scoped.

Key code references:

- global content-script match: `extension/manifest.json`
- watchlist-only route gating: `extension/src/Runtime/BootstrapGate.ts`
- watchlist-only mount/unmount lifecycle: `extension/src/Runtime/RouteLifecycle.ts`
- watchlist-only UI shell anchoring: `extension/src/Runtime/InterfaceShell.ts`
- existing `audio_locale` / `audio_locales` normalization: `extension/src/Domain/EntryNormalizer.ts`
- legacy `requireEnglishAudio` migration: `extension/src/Runtime/StateLoader.ts`

## 4) Live Route Findings (Verified 2026-03-06)

### Popular

Observed page route:

- `/videos/popular`

Observed data path:

- `GET /content/v2/discover/browse?n=36&sort_by=popularity&ratings=true&locale=en-US`

Observed metadata on returned series rows:

- `series_metadata.audio_locales[]`
- `series_metadata.is_dubbed`
- `series_metadata.subtitle_locales[]`
- `id`, `slug_title`, `title`

Implication:

- Popular can be filtered by series-level English-audio availability without per-title CMS fallback.

### New

Observed page route:

- `/videos/new`

Observed data path:

- `GET /content/v2/discover/browse?n=36&sort_by=newly_added&ratings=true&locale=en-US`

Observed metadata on returned series rows:

- `series_metadata.audio_locales[]`
- `series_metadata.is_dubbed`

Implication:

- New can be filtered the same way as Popular.

### Search

Observed page route:

- `/search?q=<query>`

Observed data path:

- `GET /content/v2/discover/search?q=<query>&n=6&type=music,series,episode,top_results,movie_listing&ratings=true&locale=en-US`

Observed grouped result behavior:

- `series` and `top_results` items include `series_metadata.audio_locales[]`
- `episode` items include `episode_metadata.series_id` and `episode_metadata.audio_locale`
- non-series groups such as `music` should be ignored by this feature

Implication:

- Search is filterable, but episode-group handling needs a series-level fallback to avoid false negatives.

### Discover / Homepage

Observed page route:

- `/discover`

Observed behavior:

- rendered DOM exposes many native `/series/<seriesId>/<slug>` links
- rendered HTML did not expose `audio_locales` directly in the DOM
- the page issues many first-party data calls, but there was no single stable, fully observed browse feed suitable for a content-script-only dependency

Implication:

- homepage filtering should not depend on scraping label text
- homepage needs DOM series-id extraction plus cached metadata lookup and batched CMS fallback

## 5) Architectural Decision

This feature is a new product surface, not a watchlist extension.

Do not:

- extend the watchlist `InterfaceShell` to non-watchlist pages
- couple browse/search lifecycle to watchlist DOM anchors
- rely on cloned/rebuilt native card nodes
- depend on descendant selector lookups inside extension-owned UI

Recommended direction:

- add a separate non-watchlist runtime/controller family for browse/search/homepage filtering
- keep it passive and native-page-respecting: discover native page-owned cards, classify them, and patch visibility in place
- keep watchlist runtime ownership unchanged

Important implementation constraint:

- content scripts do not automatically get access to page-owned `fetch` response bodies from the main world
- because the repo does not currently inject a main-world network bridge, the extension should make its own bounded API requests instead of depending on page-request interception

Recommendation:

- self-fetch `discover/browse` and `discover/search` with the existing auth flow
- use DOM extraction plus batched CMS object lookup for homepage-only gaps

## 6) Product Decision

Recommended first-release behavior:

- feature is opt-in
- behavior is hide, not dim
- criterion is series-level English-audio eligibility where possible
- default should be off for existing users to avoid surprise cross-surface behavior changes

Do not automatically reuse watchlist-only `audioLocaleFilter === 'en-US'` as the browse/search enable flag.

Reason:

- existing users may have intended that setting only for the curated watchlist
- silently turning on global homepage/search hiding would be a behavior expansion, not a bug fix

Recommended new setting:

- `browseRequireEnglishAudio: boolean`

Optional future extension:

- per-surface scope flags:
  - `browseRequireEnglishAudioDiscover`
  - `browseRequireEnglishAudioPopular`
  - `browseRequireEnglishAudioNew`
  - `browseRequireEnglishAudioSearch`

## 7) Route Strategy

| Surface | Detection | Primary data source | Fallback | Notes |
| --- | --- | --- | --- | --- |
| Popular | `/videos/popular` | self-fetch `discover/browse?sort_by=popularity` | none | strong first target |
| New | `/videos/new` | self-fetch `discover/browse?sort_by=newly_added` | none | same pipeline as Popular |
| Search | `/search` | self-fetch `discover/search` | CMS batch for unresolved episode series ids | ignore non-series groups |
| Discover | `/discover` | DOM series-id extraction + cache | CMS batch objects lookup | highest complexity |

## 8) Eligibility Rules

Primary rule:

- keep a title if its normalized series audio locales contain `en-US`

Route-specific rules:

- Popular/New series cards:
  - classify from `series_metadata.audio_locales`
- Search series/top-results groups:
  - classify from `series_metadata.audio_locales`
- Search episode group:
  - provisional fallback: `episode_metadata.audio_locale === 'en-US'`
  - authoritative fallback: resolve `episode_metadata.series_id` through shared series cache / CMS batch lookup
- Discover homepage:
  - classify by extracted `seriesId` through shared series cache / CMS batch lookup

Native content that should not be filtered:

- music results
- editorial cards with no series id
- external links, ads, merch, and non-Crunchyroll content units

## 9) Proposed Modules

### Runtime

- `extension/src/Runtime/BrowseAudioFilterRouteGate.ts`
  - non-watchlist route detection and scope gating
- `extension/src/Runtime/BrowseAudioFilterOwner.ts`
  - top-level class owner for lifecycle, async orchestration, and cleanup
- `extension/src/Runtime/BrowseAudioFilterDomAdapter.ts`
  - native-page discovery only
  - allowed to query native page-owned nodes
- `extension/src/Runtime/BrowseAudioFilterVisibilityPatcher.ts`
  - applies hide/show state to existing nodes only
- `extension/src/Runtime/BrowseAudioFilterSettings.ts`
  - loads/persists new storage-backed setting

### Data

- `extension/src/Data/BrowseDiscoveryClient.ts`
  - self-fetches `discover/browse` and `discover/search`
- `extension/src/Data/BrowseAudioLocaleRepository.ts`
  - shared cache and CMS fallback lookup by `seriesId`

### Domain

- `extension/src/Domain/BrowseAudioEligibility.ts`
  - normalizes route payloads into `hasEnUsAudio`
- `extension/src/Domain/BrowseAudioFilterModels.ts`
  - typed result records and cache shapes

### Tests

- `tests/Unit/Data/BrowseDiscoveryClient.test.ts`
- `tests/Unit/Data/BrowseAudioLocaleRepository.test.ts`
- `tests/Unit/Domain/BrowseAudioEligibility.test.ts`
- `tests/Unit/Runtime/BrowseAudioFilterOwner.test.ts`
- `tests/Unit/Runtime/BrowseAudioFilterVisibilityPatcher.test.ts`
- `tests/BrowseAudioFilter.spec.ts`

## 10) DOM Policy For This Feature

Non-negotiable implementation rules:

- do not replace native Crunchyroll cards
- do not clone native cards to animate filtering
- preserve image/video node identity
- patch visibility in place via class/attribute/style changes on the existing native node
- keep all extension-created state in owners or `WeakMap`s, never DOM expandos
- keep all listeners, observers, and timers behind deterministic `dispose()` cleanup

Recommended visibility mechanism:

- add one extension-owned class such as `.cw-browse-hidden`
- apply `display: none !important` only to native page-owned card wrappers already identified by the adapter
- never reset `src` on native media nodes

## 11) Network And Cache Plan

### Popular / New

- one self-issued `discover/browse` request per route revision
- no CMS fallback expected in normal flow
- no repeated request churn for unchanged route + locale + revision

### Search

- one self-issued `discover/search` request per query revision
- batch CMS fallback only for unresolved `episode_metadata.series_id` values not already covered by series/top-results groups or cache

### Discover

- no attempt to mirror the entire homepage feed
- extract visible series ids from native links
- query cache first
- batch unresolved ids through existing CMS objects endpoint in chunks of `50`

### Cache

Recommended new cache key:

- `cw_browse_audio_locale_cache_v1`

Recommended cache record:

- `seriesId`
- `audioLocales`
- `hasEnUsAudio`
- `updatedAt`
- `source` (`discover-browse`, `discover-search`, `cms-objects`)

Recommended TTL:

- 12 hours to match current metadata cache posture unless testing shows the need for a shorter window

## 12) Rollout Plan

### Phase 1: Foundation

- add new setting and storage wiring
- add route gate and top-level owner skeleton
- add shared audio-eligibility domain helpers
- add shared series-audio cache repository

### Phase 2: Popular and New

- implement self-fetch `discover/browse`
- map returned series ids to visible native cards
- hide unsupported cards in place
- add fixture coverage for both routes

### Phase 3: Search

- implement self-fetch `discover/search`
- classify `series` and `top_results` groups directly
- add series-id fallback path for `episode` group
- explicitly ignore `music` and non-series result groups

### Phase 4: Discover / Homepage

- extract visible series ids from native `/series/` links
- classify by cache first
- batch unresolved ids via CMS objects
- hide unsupported native cards in place
- ensure duplicates across homepage rails share the same cached classification

### Phase 5: UX and Settings Surface

- decide where the user toggles the feature
- minimum path: storage-backed setting reachable from an existing extension settings surface
- stronger path: dedicated action popup or global settings surface

### Phase 6: Hardening

- add request-budget tests
- add render-stability checks to guarantee no node replacement
- run live read-only Playwright validation on all four surfaces

## 13) Acceptance Criteria

The feature is complete when:

- enabling the setting hides non-`en-US` titles on Popular, New, Search, and Discover
- supported titles remain visible
- non-series/native editorial content remains untouched
- no native card nodes are replaced during filtering
- Popular/New/Search do not require per-title CMS lookups in the steady state
- Discover CMS fallback is batched, cached, and deduped by `seriesId`
- disabling the setting restores native visibility cleanly without reload-only dependence
- route transitions clean up observers and timers deterministically

## 14) Risks

### Risk: homepage DOM drift

- Discover is the least stable surface
- mitigation:
  - keep homepage adapter narrow and series-link based
  - cache by `seriesId`
  - add route-specific fixture coverage

### Risk: false negatives on search episode rows

- episode rows may be Japanese variants for English-capable series
- mitigation:
  - prefer series-level classification
  - use `episode_metadata.audio_locale` only as a temporary fallback

### Risk: duplicate network churn

- route transitions and DOM churn can trigger repeated work
- mitigation:
  - revision-gate self-fetches
  - dedupe CMS lookups by `seriesId`
  - keep inflight maps keyed by route/query/revision

### Risk: surprising user behavior change

- existing watchlist audio filter settings could accidentally become global
- mitigation:
  - use a separate opt-in setting for browse/search/homepage filtering

## 15) Verification Plan

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

- follow the repository’s Cloudflare-safe CDP workflow
- verify read-only behavior on:
  - `/discover`
  - `/videos/new`
  - `/videos/popular`
  - `/search?q=naruto`
- verify that hidden cards do not flicker back during route churn or scroll

## 16) Tracker

Legend:

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[!]` blocked / needs decision

### 16.1 Decisions

- [ ] Confirm final setting shape: one global toggle vs per-surface toggles
- [ ] Confirm the first user-facing settings surface
- [ ] Confirm whether search episode rows should use strict episode-level audio or series-level eligibility when they disagree

### 16.2 Foundation

- [ ] Add `browseRequireEnglishAudio` setting contract and persistence
- [ ] Add non-watchlist route gate owner
- [ ] Add shared browse audio eligibility domain helpers
- [ ] Add shared browse audio locale cache repository
- [ ] Add runtime cleanup/disposal tests

### 16.3 Popular / New

- [ ] Add `BrowseDiscoveryClient` support for `discover/browse`
- [ ] Add DOM adapter for native Popular/New cards
- [ ] Add visibility patcher for native cards
- [ ] Add fixture coverage for Popular route
- [ ] Add fixture coverage for New route

### 16.4 Search

- [ ] Add `BrowseDiscoveryClient` support for `discover/search`
- [ ] Add search group classifier for `series` and `top_results`
- [ ] Add episode-group `seriesId` fallback lookup
- [ ] Ignore non-series groups explicitly
- [ ] Add search fixture coverage

### 16.5 Discover / Homepage

- [ ] Add homepage native-card/link discovery adapter
- [ ] Add series-id extraction from native `/series/` links
- [ ] Add CMS batch fallback for unresolved homepage series ids
- [ ] Add duplicate-series dedupe across homepage rails
- [ ] Add homepage fixture coverage

### 16.6 Hardening

- [ ] Add request-budget tests for steady-state filtering
- [ ] Add node-identity stability tests for filtered native cards
- [ ] Add route-churn tests for cleanup and remount behavior
- [ ] Add live Playwright verification notes to the resulting implementation PR/doc updates

### 16.7 Release

- [ ] Run full quality gate suite
- [ ] Validate Chromium, Firefox, WebKit, and Safari packaging
- [ ] Perform final live verification against real Crunchyroll pages
- [ ] Update end-user documentation if the setting becomes user-visible

## 17) Recommended Execution Order

1. Foundation
2. Popular / New
3. Search
4. Discover / Homepage
5. Settings UX
6. Hardening and release validation

This order delivers value early on the cleanest routes and defers the homepage-specific instability to after the shared cache, route, and patching infrastructure exists.
