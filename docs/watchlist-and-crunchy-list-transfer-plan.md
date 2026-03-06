# Watchlist And Crunchy List Transfer Plan

Last updated: 2026-03-06

This document defines the recommended implementation plan for a new transfer feature that can:

1. Copy all shows from the active profile's watchlist into extension storage.
2. Copy all shows from a Crunchy List into extension storage.
3. Preserve both captured sets in storage across profile switches.
4. Import a stored set into another profile's watchlist.
5. Import a stored set into another profile's existing Crunchy List.

The feature tracks shows at series level only. Episode progress, ratings, favorite state, and watch-history state are out of scope.

## 1) Goals

1. Allow users to snapshot a profile's watchlist or Crunchy List into persistent extension storage.
2. Allow users to switch to a different Crunchyroll profile and import a stored snapshot.
3. Keep imports safe, incremental, and rate-limited.
4. Reuse the existing auth, storage, and request resilience architecture where possible.
5. Keep the implementation aligned with current runtime ownership rules:
   - explicit data/runtime/ui boundaries,
   - class-based UI owners/controllers for new UI work,
   - direct element refs only for extension-owned DOM,
   - deterministic teardown and rejection-safe async flows.

## 2) Non-Goals

1. Syncing snapshots automatically across profiles.
2. Tracking episode-level progress, watch-history, favorites, or ratings inside saved snapshots.
3. Creating new Crunchy Lists as part of v1. Import targets are the watchlist or an existing Crunchy List.
4. Performing destructive list operations such as bulk remove, replace, or clear target list.
5. Supporting import/export from non-Crunchyroll sources.

## 3) Current Baseline

### 3.1 Already implemented

1. Auth requests already return both `account_id` and `profile_id`, so active profile scope is already available to the runtime.
2. Watchlist fetch already loads the full watchlist through Crunchyroll's paged API.
3. Existing entry normalization already deduplicates to a single series-level entry by `seriesId`.
4. Extension storage access already exists through a storage adapter with extension-storage-first and localStorage fallback behavior.
5. Current watchlist cache behavior is already account/profile scoped.

### 3.2 Missing today

1. There is no existing Crunchy List data client, repository, or runtime owner.
2. There is no list catalog fetch, list-members fetch, add-to-watchlist, or add-to-Crunchy-List implementation in the repo.
3. There is no persisted multi-snapshot storage model for saved transfers.
4. There is no transfer queue, import progress UI, or result summary UI.
5. Runtime mounting is watchlist-only today and assumes watchlist-specific DOM anchors.

### 3.3 Existing constraints that shape the design

1. The extension injects on all Crunchyroll pages, but the runtime only mounts on `/watchlist`.
2. The current `watchlistCache` is not a suitable home for saved transfer snapshots because it is a single active-scope cache and resets on scope mismatch.
3. Existing watchlist mutations only support favorite/remove. Import requires a new add path even for watchlist support.

### 3.4 Live API discovery findings (verified 2026-03-06)

Read-only live exploration was performed against a logged-in Edge CDP session on real `crunchyroll.com` pages.
No list mutations were allowed to reach Crunchyroll:

1. Read-only navigation was used for list catalog and list detail pages.
2. Mutation discovery clicks were performed only after matching write requests were intercepted and aborted locally.

Observed routes and request shapes:

1. Crunchy List catalog

```text
GET /content/v2/{account_id}/custom-lists?locale=en-US
```

Observed response shape:

```ts
type CustomListCatalogResponse = {
  total: number;
  data: Array<{
    list_id: string;
    is_public: boolean;
    total: number;
    modified_at: string;
    title: string;
  }>;
  meta: {
    total_public: number;
    total_private: number;
    max_private: number;
  };
};
```

Observed notes:

1. The route is driven by the public page `https://www.crunchyroll.com/crunchylists`.
2. The sample account response reported `max_private: 10`.

2. Crunchy List members

```text
GET /content/v2/{account_id}/custom-lists/{list_id}?ratings=true&locale=en-US
```

Observed response shape:

```ts
type CustomListMembersResponse = {
  total: number;
  data: Array<{
    list_id: string;
    id: string;
    modified_at: string;
    panel: {
      id: string;
      type: 'series';
      title: string;
      slug_title: string;
      description: string;
      rating?: unknown;
      images?: unknown;
      series_metadata?: unknown;
    };
  }>;
  meta: {
    title: string;
    is_public: boolean;
    modified_at: string;
    prev_page: string;
    next_page: string;
    max: number;
  };
};
```

Observed notes:

1. `panel.id` is the series id needed for snapshot/import.
2. The sample response reported `meta.max: 100`.
3. The sample response returned all items directly with empty `prev_page` / `next_page`.

3. Watchlist membership lookup by series ids

```text
GET /content/v2/{account_id}/watchlist?content_ids={comma_separated_series_ids}&preferred_audio_language=en-US&locale=en-US
```

Observed response shape:

```ts
type WatchlistMembershipLookupResponse = {
  total: number;
  data: Array<{
    id: string;
    is_favorite: boolean;
    date_added: string;
  }>;
  meta: Record<string, unknown>;
};
```

Observed notes:

1. This was triggered by Crunchyroll's own Crunchy List detail page to determine which cards are already in watchlist.
2. This is a useful duplicate-skip primitive for import-to-watchlist.

4. Add to watchlist

```text
POST /content/v2/{account_id}/watchlist?preferred_audio_language=en-US&locale=en-US
content-type: application/json
body: { "content_id": "{series_id}" }
```

Observed notes:

1. This request was captured by clicking the native `Add to Watchlist` button on a series page.
2. The request was intercepted and aborted locally before it was sent upstream.
3. The UI used a single `content_id`, not a bulk array.

5. Add to existing Crunchy List

```text
POST /content/v2/{account_id}/custom-lists/{list_id}?preferred_audio_language=en-US&locale=en-US
content-type: application/json
body: { "content_id": "{series_id}" }
```

Observed notes:

1. This request was captured by opening the native `My List` modal on a series page and selecting an existing list.
2. The request was intercepted and aborted locally before it was sent upstream.
3. The UI used a single `content_id`, not a bulk array.

Discovery conclusions:

1. The repo can support v1 import/export without route expansion because all required list contracts were observed through API-driven flows.
2. Observed endpoints remain under existing `https://www.crunchyroll.com/content/v2/*` host permissions.
3. No bulk-add contract was observed. Implementation should assume one-item-at-a-time `POST` imports unless later discovery proves otherwise.

## 4) Recommended Product Shape

### 4.1 Core concept

Introduce a new storage concept called a saved show set.

A saved show set is an immutable snapshot of shows captured from one source:

1. Watchlist snapshot
2. Crunchy List snapshot

Each saved show set stores:

1. Source kind
2. Source account/profile scope
3. Source list metadata when applicable
4. Capture timestamp
5. Series-level show records

### 4.2 Show record shape

Only store fields needed for identity and basic UX:

```ts
type SavedShowRecord = {
  seriesId: string;
  title: string;
  seriesSlugTitle?: string;
};
```

`seriesId` is the only required import identity. `title` and optional slug are display helpers.

### 4.3 Saved set shape

```ts
type SavedShowSetKind = 'watchlist' | 'crunchy-list';

type SavedShowSet = {
  id: string;
  kind: SavedShowSetKind;
  name: string;
  sourceAccountId: string;
  sourceProfileId: string;
  sourceListId: string | null;
  sourceListName: string | null;
  capturedAt: number;
  showCount: number;
  shows: SavedShowRecord[];
};
```

### 4.4 Recommended first shipping UX

For the first implementation slice, keep transfer UI on the watchlist page.

This is the lowest-risk shape because the existing shell, controls, auth flow, and testing harness are watchlist-centric already.

Recommended UX on the watchlist page:

1. Capture current watchlist
2. Capture a selected Crunchy List
3. Browse saved sets
4. Import selected saved set into watchlist
5. Import selected saved set into a selected existing Crunchy List
6. Show progress and final results

If live API discovery shows that capturing the current list page is materially simpler than API-driven list selection, route expansion can be added later.

## 5) High-Level Rollout Strategy

### Phase 0: Contract discovery and proof of feasibility

Goal:
Confirm the live Crunchyroll endpoints and request shapes required for:

1. Fetching the user's Crunchy List catalog
2. Fetching all shows in a specific Crunchy List
3. Adding a series to watchlist
4. Adding a series to an existing Crunchy List
5. Reading target-list membership for duplicate skipping

Exit criteria:

1. Concrete endpoint matrix with sample request/response notes
2. Confirmation of whether bulk add exists
3. Confirmation of whether list routes require new host permissions
4. Updated fixture server contract plan

Status on 2026-03-06:

1. Concrete catalog/detail/add request shapes were observed live.
2. No bulk-add endpoint was observed in native UI traffic.
3. No new host permissions are required for the observed routes.
4. Fixture server updates are still pending implementation work.

### Phase 1: Saved-set storage and watchlist snapshot support

Goal:
Add saved-set storage and allow users to capture a watchlist snapshot and browse saved sets.

Exit criteria:

1. Persistent saved-set repository exists
2. Watchlist capture works and deduplicates by `seriesId`
3. Saved sets survive reload and profile switch
4. UI can list and inspect saved sets

### Phase 2: Watchlist import support

Goal:
Allow importing any saved set into the active profile's watchlist.

Exit criteria:

1. Watchlist add client exists
2. Duplicate skipping is implemented
3. Sequential queue with delay exists
4. UI shows progress and results

### Phase 3: Crunchy List capture and import support

Goal:
Allow capturing a Crunchy List and importing a saved set into an existing Crunchy List.

Exit criteria:

1. Crunchy List catalog fetch exists
2. Crunchy List members fetch exists
3. Existing-list target selector exists
4. Add-to-list queue exists

### Phase 4: Hardening and release preparation

Goal:
Finish resilience, tests, docs, and live verification.

Exit criteria:

1. Unit and Playwright coverage for transfer flows
2. Live verification on real Crunchyroll session
3. Bounded request counts and safe pacing behavior verified
4. Docs and release notes updated

## 6) Proposed Architecture

### 6.1 Data layer additions

Recommended new modules:

1. `extension/src/Data/SavedShowSetRepository.ts`
2. `extension/src/Data/CrunchyListClient.ts`
3. `extension/src/Data/WatchlistImportClient.ts`
4. `extension/src/Data/CrunchyListImportClient.ts`

Responsibilities:

1. `SavedShowSetRepository`
   - normalize stored saved-set payloads
   - add/update/delete saved sets
   - enforce versioning and storage-shape guarantees
   - never mix active watchlist cache semantics with saved snapshot semantics
2. `CrunchyListClient`
   - fetch list catalog
   - fetch list membership
   - audit payload contracts
3. `WatchlistImportClient`
   - add a series to watchlist
   - surface stable success/failure result categories
4. `CrunchyListImportClient`
   - add a series to an existing Crunchy List
   - surface stable success/failure result categories

### 6.2 Runtime layer additions

Recommended new modules:

1. `extension/src/Runtime/TransferQueue.ts`
2. `extension/src/Runtime/TransferState.ts` or equivalent runtime-store additions
3. `extension/src/Runtime/TransferInteractions.ts`

Responsibilities:

1. `TransferQueue`
   - one transfer job at a time
   - sequential requests only unless a safe bulk endpoint is discovered
   - delay between requests
   - retry limited transient failures only
   - stop safely on profile change, route disposal, or explicit cancel
2. `TransferState`
   - active job status
   - active job target metadata
   - added/skipped/failed counters
   - final summary
3. `TransferInteractions`
   - wire UI actions to repository and queue operations
   - keep async handlers rejection-safe

### 6.3 UI layer additions

Recommended new modules:

1. `extension/src/Ui/TransferControlsView.ts`
2. `extension/src/Ui/TransferSavedSetsView.ts`
3. `extension/src/Ui/TransferProgressView.ts`

New UI code should use class-based owners/controllers and direct refs only.

Responsibilities:

1. `TransferControlsView`
   - render capture actions
   - render target selectors
   - render import buttons
2. `TransferSavedSetsView`
   - render saved set list
   - render snapshot details
   - expose direct refs for patching selected state and counts
3. `TransferProgressView`
   - render job status
   - render progress counts
   - render final result summary

### 6.4 Bootstrap and composition changes

Expected existing files to update:

1. `extension/src/Runtime/RuntimeStore.ts`
2. `extension/src/Runtime/BootstrapConfig.ts`
3. `extension/src/Runtime/StateLoader.ts`
4. `extension/src/Runtime/ContentRuntimeSetupDataInitializationPhases.ts`
5. `extension/src/Runtime/ContentRuntimeSetupDataInitializationWatchlistHistory.ts`
6. `extension/src/Runtime/ContentCompositionRuntimeBindings.ts`
7. `extension/src/Runtime/InterfaceShell.ts`
8. `extension/src/Runtime/CuratedInteractionsControls.ts`
9. `extension/src/Ui/ControlsView.ts`
10. `extension/manifest.json`

## 7) Storage Plan

### 7.1 New storage key

Recommended new key:

```ts
cw_saved_show_sets_v1
```

### 7.2 Stored payload shape

```ts
type SavedShowSetStore = {
  version: 1;
  sets: SavedShowSet[];
};
```

### 7.3 Storage behavior

1. Saved sets must be independent from current profile scope.
2. Captured sets should remain available after switching profiles.
3. Repository should reject malformed records and normalize partial input.
4. Repository should support deletion of old saved sets.
5. Repository should preserve insertion order or explicit `capturedAt` sort order for UI.

### 7.4 Deduping rules

1. Deduplicate inside a captured set by `seriesId`.
2. Deduplicate against the import target by `seriesId`.
3. Keep first valid record for title display.
4. Report skipped duplicates explicitly in the import summary.

## 8) Import Queue Behavior

### 8.1 Default behavior when no bulk endpoint exists

1. Concurrency: `1`
2. Delay: fixed base delay plus small jitter
3. Retry: transient network errors and safe `429`/`5xx` responses only
4. Duplicate handling: skip before write when target membership is known
5. Final summary: `added`, `already_present`, `failed`, `cancelled`

### 8.2 Recommended starting pacing

If no bulk endpoint exists, start with:

1. `1` request at a time
2. `750ms` base delay
3. `0-250ms` jitter

This should be treated as a starting default, not a final contract. Live verification should confirm whether the delay is conservative enough.

### 8.3 Cancellation conditions

Cancel active import when:

1. profile scope changes,
2. auth becomes unavailable,
3. runtime is disposed,
4. user explicitly cancels.

### 8.4 Job result shape

```ts
type TransferJobResult = {
  added: string[];
  alreadyPresent: string[];
  failed: Array<{ seriesId: string; reason: string }>;
  cancelled: boolean;
};
```

## 9) Routing And UI Strategy

### 9.1 Recommended v1 approach

Do not expand runtime mounting beyond `/watchlist` in the first slice unless live API discovery forces it.

Reason:

1. Existing shell mounts only on watchlist routes.
2. Existing DOM hook discovery is watchlist-specific.
3. Transfer UX can still support Crunchy List capture by offering a list selector on the watchlist page.
4. Live discovery confirmed the required list catalog/detail/add endpoints are API-driven and do not require list-page mounting for v1.

### 9.2 When route expansion becomes necessary

Expand routing only if one of these becomes true:

1. Crunchy List APIs are unavailable but current-page DOM can be read safely.
2. Capture from current list page is a hard product requirement for usability.
3. Existing list metadata needed for capture is only discoverable from the list page.

If route expansion is needed, it should be treated as a separate architecture slice because it affects:

1. route gating,
2. host/root/header discovery,
3. shell mounting assumptions,
4. fixture coverage.

## 10) Testing Strategy

### 10.1 Unit coverage

Add or update unit tests for:

1. saved-set repository normalization and persistence
2. saved-set dedupe by `seriesId`
3. transfer queue pacing and retry behavior
4. cancellation on profile change
5. watchlist import client request shape
6. Crunchy List client request parsing
7. Crunchy List import client request shape
8. state loading and hydration of saved sets

Recommended new test files:

1. `tests/Unit/Data/SavedShowSetRepository.test.ts`
2. `tests/Unit/Data/CrunchyListClient.test.ts`
3. `tests/Unit/Data/WatchlistImportClient.test.ts`
4. `tests/Unit/Data/CrunchyListImportClient.test.ts`
5. `tests/Unit/Runtime/TransferQueue.test.ts`
6. `tests/Unit/Runtime/TransferState.test.ts`
7. `tests/Unit/Ui/TransferControlsView.test.ts`

### 10.2 Playwright coverage

Add focused fixture-driven coverage for:

1. capturing current watchlist to storage
2. listing saved sets after reload
3. importing saved watchlist into watchlist
4. importing saved Crunchy List into watchlist
5. importing saved watchlist into an existing Crunchy List
6. duplicate skipping and result summary
7. progress UI updates during long-running import

Recommended new spec:

1. `tests/TransferFlows.spec.ts`

### 10.3 Live verification

After implementation, run focused live verification against Crunchyroll:

1. capture a real watchlist snapshot
2. capture a real Crunchy List snapshot
3. switch profiles
4. import into watchlist
5. import into existing Crunchy List
6. verify pacing is safe and no obvious throttling occurs

## 11) Quality Gates Before Merge

Keep these green before landing the feature:

1. `npm run typecheck`
2. `npm run guard:dom-lookups`
3. `npm run guard:async-event-listeners`
4. `npm run guard:module-registry-growth`
5. `npm run guard:boundary-type-growth`
6. `npm run guard:ui-document-ref`
7. `npm run lint`
8. `npm run format:check`
9. `npm run test:perf:budgets`
10. `npm run test:unit`
11. `npm run lint:firefox`
12. `npm run test:e2e`
13. `npm run build:webext`
14. `npm run build:safari`
15. `npm run guard:arch-growth`
16. `npm run arch:metrics`

## 12) Risks And Unknowns

### 12.1 Highest-risk unknown

The highest-risk unknown from initial planning was Crunchy List endpoint discovery.

This is now resolved for the native flows observed on 2026-03-06:

1. list catalog fetch,
2. list members fetch,
3. add-to-watchlist,
4. add-to-existing-list,
5. watchlist membership lookup.

Remaining uncertainty is narrower:

1. response details for success/failure edge cases,
2. rate-limit behavior under sustained import,
3. whether any hidden bulk path exists outside the observed native UI flow.

### 12.2 Secondary risks

1. Watchlist import uses a newly discovered `POST /watchlist` path, so implementation must not reuse the existing favorite/remove mutation helper without refactoring.
2. Crunchyroll may return different scopes or identifiers for watchlist and list endpoints in other profile/account states.
3. List target membership fetch may still be required to avoid excessive duplicate writes when importing into an existing Crunchy List.
4. Success/failure response contracts for blocked write requests were not observed because writes were intentionally not allowed to complete.
5. Route expansion is no longer required for v1 based on the observed API-driven paths, but could still be revisited for richer UI later.

### 12.3 Safety requirements

1. No destructive replacement semantics.
2. No bypass or anti-bot tactics.
3. No uncontrolled burst writes.
4. No raw thrown objects shown in UI.

## 13) Acceptance Criteria

The feature is complete when all of the following are true:

1. User can capture the active watchlist into a saved set.
2. User can capture a Crunchy List into a saved set.
3. Saved sets persist across reloads and profile switches.
4. User can import any saved set into the active profile's watchlist.
5. User can import any saved set into an existing Crunchy List.
6. Import skips duplicates by `seriesId`.
7. Import runs with safe pacing when no bulk endpoint exists.
8. Import progress and final result summary are visible in the UI.
9. Unit and Playwright coverage exist for core paths.
10. Live verification confirms expected behavior on real Crunchyroll pages.

## 14) Recommended Implementation Order

1. Discover live Crunchy List and add-to-watchlist/add-to-list contracts.
2. Add saved-set repository and runtime state hydration.
3. Add watchlist snapshot capture.
4. Add saved-set browsing UI.
5. Add watchlist import queue and result UI.
6. Add Crunchy List catalog/membership fetch.
7. Add Crunchy List capture.
8. Add import-to-existing-list support.
9. Harden retry/pacing/cancellation behavior.
10. Complete test and live verification passes.

## 15) Tracker

Status values:

1. `Done`
2. `Planned`
3. `Blocked`

| ID | Status | Area | Task | Notes |
| --- | --- | --- | --- | --- |
| T01 | Done | Planning | Investigate current repo support for watchlist/profile/list transfer | Repository investigation completed on 2026-03-06 |
| T02 | Done | Planning | Create implementation planning document with tracker | This document |
| T03 | Done | Discovery | Capture live API contracts for Crunchy List catalog fetch | Observed `GET /content/v2/{account_id}/custom-lists?locale=en-US` |
| T04 | Done | Discovery | Capture live API contracts for Crunchy List members fetch | Observed `GET /content/v2/{account_id}/custom-lists/{list_id}?ratings=true&locale=en-US` |
| T05 | Done | Discovery | Capture live API contract for add-to-watchlist | Observed blocked native `POST /content/v2/{account_id}/watchlist` with `{ content_id }` body |
| T06 | Done | Discovery | Capture live API contract for add-to-existing-Crunchy-List | Observed blocked native `POST /content/v2/{account_id}/custom-lists/{list_id}` with `{ content_id }` body |
| T07 | Done | Discovery | Confirm whether bulk add exists for watchlist or list targets | No bulk-add request observed in native UI flows; assume single-item POSTs |
| T08 | Done | Discovery | Confirm whether new host permissions are required | Observed routes stay under existing `content/v2/*` host permission |
| T09 | Planned | Data | Add `SavedShowSetRepository` with normalized persisted shape | Use dedicated storage key |
| T10 | Planned | Data | Add saved-set state hydration to runtime bootstrap | Must not reuse `watchlistCache` |
| T11 | Planned | Data | Add `CrunchyListClient` for list catalog and membership fetch | Contract-audited boundary module |
| T12 | Planned | Data | Add `WatchlistImportClient` for add-to-watchlist | Request/response result mapping required |
| T13 | Planned | Data | Add `CrunchyListImportClient` for add-to-list | Request/response result mapping required |
| T14 | Planned | Runtime | Extend runtime state for saved sets and active transfer job | Include progress/result summary |
| T15 | Planned | Runtime | Add sequential `TransferQueue` owner with delay, jitter, and cancellation | One active job at a time |
| T16 | Planned | Runtime | Abort transfer when active profile scope changes | Use account/profile from auth state |
| T17 | Planned | UI | Add capture/import controls to watchlist UI shell | Keep v1 on watchlist route |
| T18 | Planned | UI | Add saved-set browser and selection UI | Show name, source, profile, timestamp, count |
| T19 | Planned | UI | Add import progress and final summary UI | Added/skipped/failed/cancelled |
| T20 | Planned | UI | Add target selector for existing Crunchy Lists | Requires list catalog fetch |
| T21 | Done | Routing | Decide whether list-page route expansion is required | Not required for v1 based on observed API-driven catalog/detail/add flows |
| T22 | Planned | Tests | Add unit tests for repository normalization and dedupe | Series-level only |
| T23 | Planned | Tests | Add unit tests for transfer queue pacing, retry, and cancellation | Include profile-switch cancellation |
| T24 | Planned | Tests | Add unit tests for watchlist and list import clients | Request contract coverage |
| T25 | Planned | Tests | Add Playwright flow coverage for capture/import scenarios | Fixture-driven |
| T26 | Planned | Live QA | Run live manual verification on real Crunchyroll session | Read-only capture, controlled import |
| T27 | Planned | Docs | Update endpoint docs after discovery | Extend `docs/api-endpoints-reference.md` if needed |
| T28 | Planned | Docs | Update testing docs for new flow coverage | Add transfer verification commands/notes |
| T29 | Planned | Release | Run full quality gates and build matrix | Must stay release-ready |
| T30 | Planned | Release | Prepare user-facing release notes for transfer feature | Keep scope and limitations explicit |

## 16) Recommendation

Proceed in two steps:

1. Perform live API discovery first.
2. After contracts are known, implement the feature in vertical slices:
   - saved sets + watchlist capture,
   - watchlist import,
   - Crunchy List capture/import.

That sequence keeps the largest unknown isolated early and lets the rest of the work follow the repo's existing architecture cleanly.
