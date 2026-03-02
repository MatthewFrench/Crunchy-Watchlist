# API DTO Contracts And Normalization

Last updated: 2026-03-01
Status: Active
Scope: production API envelope/DTO boundaries under `extension/src/Data/**`

## Boundary policy

1. Parse uncertain payloads once at ingress.
2. Convert to extension-owned DTO contracts immediately.
3. Keep runtime/UI paths on typed DTOs and normalized domain models.
4. Treat DOM as render target only; API payload objects are not long-lived state.

## Shared envelope contract

Owner: `extension/src/Data/ApiContracts.ts`

Production envelope parser:

- `parsePayloadDataEnvelope(endpointName, payload)`
- normalized output contract:

```ts
{
  rows: Record<string, unknown>[]
  total: number | null
}
```

Normalization behavior:

- requires `payload.data` to be an array; otherwise throws contract error.
- non-object rows are normalized to `{}` and emit a warning.
- `total` is parsed to non-negative integer, otherwise `null`.

Example:

```json
{
  "total": "12",
  "data": [{ "id": "row-1" }, null, "bad-row"]
}
```

Normalized envelope:

```json
{
  "rows": [{ "id": "row-1" }, {}, {}],
  "total": 12
}
```

## Watchlist DTO contract

Primary owners:

- `extension/src/Data/WatchlistClient.ts`
- `extension/src/Data/WatchlistRepository.ts`

Ingress endpoint:

- `GET /content/v2/discover/{accountId}/watchlist`

Envelope consumption:

- `parsePayloadDataEnvelope('watchlist', payload)`
- fallback when `total == null`: use `rows.length` and emit `watchlist-contract-warning`.

Row-level contract checks:

- `auditWatchlistRowsContract(rows)` verifies `panel`, `episode_metadata`, and series id derivation.

Runtime DTO used by watchlist fetch pipeline:

```ts
{
  rows: WatchlistRow[]
  total: number
}
```

Where:

- `WatchlistRow = Record<string, unknown>` at boundary,
- then normalized downstream by `EntryNormalizer` into extension-owned entry models.

## Watch-history DTO contract

Primary owners:

- `extension/src/Data/HistoryRepositoryPreload.ts`
- `extension/src/Data/HistoryRepositoryPreloadCollector.ts`
- `extension/src/Data/HistoryRepository.ts`

Ingress endpoint:

- `GET /content/v2/{accountId}/watch-history`

Envelope consumption:

- `parsePayloadDataEnvelope('watch-history', payload)`
- `totalRows = envelope.total` (nullable)
- fallback telemetry warning when `total == null`.

Page DTO used by collector:

```ts
{
  rows: Record<string, unknown>[]
  totalRows: number | null
}
```

Row-level contract checks:

- `auditWatchHistoryRowsContract(rows)` verifies series-id derivation and parseable `date_played`.

Collector normalization:

- page rows normalized once (`toPageRows`) and merged into update buckets.
- no-match scan limits are enforced by preload planning + collector bounds.

## Ratings/CMS DTO contract

Primary owners:

- `extension/src/Data/RatingsClient.ts`
- `extension/src/Data/RatingsRepository.ts`

Ingress endpoints:

- `GET /content/v2/cms/objects/{id}`
- `GET /content/v2/cms/objects/{id,id,...}`

Envelope consumption:

- `parsePayloadDataEnvelope('cms-objects', payload)`
- `auditCmsObjectContract(rows)` verifies `id`, `series_metadata`, and `rating` presence.

Boundary DTO before repository merge:

```ts
{
  seriesId: string
  rating: number | null
  votes: number | null
  distribution: Record<string, unknown> | null
  description: string
  audioLocales: string[]
  episodeCount: number | null
  seasonCount: number | null
  genreTags: string[]
}
```

Notes:

- single-series fallback still parses legacy payload rating/votes when CMS row parsing fails.
- repository applies final cache normalization and typed updates.

## Preview DTO contract

Primary owner:

- `extension/src/Data/PreviewRepository.ts`

Ingress endpoint:

- `streamsLink` URL resolved from watchlist rows

Payload normalization:

- preview payload root normalized to object-or-null (`normalizePreviewPayloadRootInternal`).
- media URL extracted by explicit candidate keys, then bounded recursive scan.

Boundary DTO:

```ts
{
  previewUrl: string | null
}
```

Cache contract:

- state cache is keyed by resolved stream/episode/canonical/series key.
- inflight dedupe map prevents duplicate preview requests per key.

## Auth token DTO contract

Primary owner:

- `extension/src/Data/AuthClient.ts`

Ingress endpoint:

- `POST /auth/v1/token`

Boundary normalization:

- token payload parsed once into:

```ts
{
  accessToken: string
  expiresInSeconds: number | null
  accountId: string | null
  profileId: string | null
  tokenType: string | null
  country: string | null
}
```

Stored runtime token DTO:

```ts
{
  accessToken: string
  accountId: string | null
  profileId: string | null
  expiresAt: number
}
```

Validation:

- validity check gates minimum token shape and non-expired window (`authTokenSkewMs`).

## Drift-test mapping

Contract-drift coverage lives in:

- `tests/Unit/Data/ApiEnvelopeContractDrift.test.ts`
- `tests/Unit/Data/ApiContracts.test.ts`
- `tests/Unit/Data/WatchlistClient.test.ts`
- `tests/Unit/Data/HistoryRepositoryPreload.test.ts`
- `tests/Unit/Data/RatingsClient.test.ts`

These suites enforce envelope shape handling, total normalization, warning/error semantics, and row-level contract audits.
