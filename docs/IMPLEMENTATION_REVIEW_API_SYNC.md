# Implementation Review: API-Based Incremental Sync

Multi-perspective review (Architect, Backend, Data/DB, Frontend, QA, Security) before and during implementation.

---

## Architect

**Scope**
- Sync reads from **crymbo-app (Laravel)** only; Laravel proxies deposits/transfers/withdrawals to app (Nest); trades are Laravel-native.
- Checkpoints are stored in superdashboard Postgres per (customerId, environmentId, source). No full rescan after bootstrap.
- Bootstrap remains DB-based; a bootstrap wrapper captures per-source max-id watermarks before rebuild and writes checkpoints after rebuild success.
- Normal 15-min cadence is API-only with `since_id`, but only after checkpoint readiness is confirmed.

**Risks**
- If Laravel or app change response shape, sync must be versioned or tolerant.
- Checkpoint advancement only after successful batch write keeps consistency; partial failure leaves checkpoint unchanged.

**Sign-off:** Design matches finalized decisions; implementation can proceed.

---

## Backend

**API parameter support**
- **App (Nest):** `since_id` and `updated_after` added to base `PaginationValidationDto`; deposit, transfer, withdrawal list repos apply `id > since_id` and/or `updated_at >= updated_after`. Sort options include `id` for cursor stability.
- **Laravel (trades):** `TradeRepository::list()` reads `since_id` from request and appends `AND t.id > :since_id` to WHERE; `id` added to sortable fields.

**Sync service (volume-sync)**
- New API client: obtain JWT via `POST /jwt/generate` (api_key, api_secret, username), then call `GET /v3/deposits`, `GET /v3/transfers`, `GET /v3/withdrawals`, `GET /trades` with `since_id`, `limit`, and ascending `id` sort. Paginate until empty; aggregate by day; increment Postgres; then update checkpoint.
- Added `bootstrap-history` and `init-checkpoints` jobs/endpoints so checkpoint initialization is automatic after DB bootstrap and available standalone for recovery.
- KYT derived from deposit response (per-deposit KYT flag/score), not a separate endpoint.

**Sign-off:** Backend changes are consistent with proposal.

---

## Data/DB

**Schema**
- **SyncCheckpoint:** `customer_id`, `environment_id`, `source`, `last_id` (bigint), `last_updated_at` (nullable), `updated_at`. Unique on (customer_id, environment_id, source).
- **DailyMetrics / DailyEnvironmentVolume:** Unchanged; only the writer path changes (API + incremental instead of full DB scan).

**Checkpoint semantics**
- Update checkpoint only after the batch is successfully written. On failure, do not advance checkpoint so next run retries from same `last_id`.

**Sign-off:** Checkpoint table and usage are correct.

---

## Frontend

**Impact**
- None. UI continues to read from superdashboard API → Postgres. No new endpoints or pages required for the sync flow.

**Sign-off:** No frontend changes.

---

## QA

**Test focus**
- App: list deposits/transfers/withdrawals with `since_id` returns only rows with `id > since_id`; order by `id` asc when used for sync.
- Laravel: `GET /trades?since_id=123` returns only trades with id > 123.
- volume-sync: after bootstrap, run incremental sync; verify checkpoint advances only after successful write; simulate failure and verify checkpoint not advanced and next run retries.
- Bootstrap: verify captured watermark is written after rebuild and that records created during rebuild are picked up by the first incremental API sync.

**Sign-off:** Test plan aligns with implementation.

---

## Security

**Credentials**
- API credentials (api_key, api_secret, username) per customer: stored in env (e.g. `CUSTOMER_<id>_API_*`) or future secrets store; not in frontend or logs.
- JWT is short-lived; obtained per sync or on 401.

**Sign-off:** No credentials in client; sync service uses server-side config only.

---

## Summary

All perspectives aligned. Implementation includes:
1. ✅ App: `since_id` / `updated_after` on list DTOs and repos (deposit, transfer, withdrawal).
2. ✅ Laravel: `since_id` on trades list.
3. ✅ Superdashboard: `SyncCheckpoint` model and migration.
4. ✅ volume-sync: API client, checkpoint read/write, incremental sync job.
5. ✅ bootstrap-history + init-checkpoints flow with readiness gating.
