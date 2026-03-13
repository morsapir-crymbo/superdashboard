# API-Based Sync Architecture — Full Proposal

**Status:** Finalized — implementation in progress  
**Audience:** Architect, Backend, Data/DB, Product, Frontend, QA, Security/Auth  
**Goal:** Move from direct DB queries to JWT/API-based sync with incremental updates and checkpointing.

---

## 0. Finalized Decisions (Product)

- **Base URL:** Each customer has its own base URL. Sync calls **Laravel (crymbo-app)** for list data, not the Nest app directly.
- **Credentials:** One set per customer environment: `api_key`, `api_secret`, `username`; used to generate JWT via `POST /jwt/generate`. Dedicated sync user per environment.
- **Trades:** Use existing trades API; no new trades mechanism; no direct DB after bootstrap. Sync calls trades API like other endpoints, incrementally.
- **KYT:** No separate KYT API. Derive KYT from deposit API response (per-deposit KYT score/result/flag); count and process from deposit transactions.
- **Cursor:** APIs must support incremental sync via `since_id` (preferred) or `updated_after`. Add these params to `GET /deposits`, `GET /transfers`, `GET /withdrawals`, `GET /trades` if missing. Offset-based only as temporary fallback.
- **Bootstrap:** Initial historical load via direct DB. After bootstrap, switch to API-only incremental sync. DB credentials may remain for manual historical rebuilds; normal sync must not depend on DB.

---

## 1. Executive Summary

- **Current:** volume-sync connects directly to each customer’s MySQL, runs full-day queries every 15 minutes, and upserts into superdashboard’s Postgres.
- **Target:** Authenticate to each customer environment via JWT/API, fetch only **new/changed** data since last sync, store checkpoints (last processed IDs), and keep the UI reading from superdashboard’s DB only.

---

## 2. Current Architecture (Brief)

- **volume-sync** (Node/Express): loads customer config from env (DB host/port/user/pass), runs collectors (deposits, withdrawals, transfers, trades, KYT) with date ranges, converts currencies, upserts into Postgres (`daily_metrics`, `daily_environment_volume`).
- **Superdashboard API**: reads from Postgres only; no direct customer DB access.
- **Superdashboard Web**: calls superdashboard API; Volume and Metrics pages; 15‑min refresh triggers volume-sync then refetches from API.

---

## 3. Discovery: Available APIs

### 3.1 crymbo-app (Laravel)

| Area | Endpoint | Auth | Notes |
|------|----------|------|--------|
| **JWT** | `POST /jwt/generate` or `POST /auth/login/jwt` | none | Body: `api_key`, `api_secret`, `username`. Returns JWT (1h). Credentials in `jwt` table. |
| **Deposits (v3)** | `GET /v3/deposits?{queryString}` | JWT | Proxies to **app** `GET /deposits`. Query string forwarded as-is. |
| **Transfers (v3)** | `GET /v3/transfers?{qs}` | JWT | Proxies to **app** `GET /transfers`. |
| **Withdrawals (v3)** | `GET /v3/withdrawals` | JWT | Proxies to **app** (assumed). |
| **Deposits (admin)** | `GET /deposits` | Sanctum/backend | No proxy; `depositRepo->list()` — no pagination params in repo call. |
| **Transfers (admin)** | `GET /transfers` | backend | Proxies to app `GET /transfers?{qs}`. |
| **Trades (admin)** | `GET /trades` | backend | **Laravel only** — `TradeRepository->list()`; no app proxy. |
| **Withdrawals (admin)** | `GET /withdrawals` | backend | Laravel list. |
| **Stats / volume** | `GET /stats/volume?from_date=&to_date=` | backend | Aggregated stats (deposit, transfer, withdrawal, trade) for date range. No per-record list. |
| **KYT** | Per-deposit: `GET /v3/deposits/{id}/kyt` | JWT | No global “list KYT events” endpoint. |

- **Auth:** JWT from `api_key` + `api_secret` + `username`. Admin routes may use Sanctum or same JWT; must be confirmed per deployment.
- **Incremental:** List endpoints in Laravel (admin) do not expose `since_id` or `updated_after` in the discovered code. **v3** list endpoints are proxied to **app** with query string.

### 3.2 app (NestJS)

| Area | Endpoint | Auth | Pagination / filters |
|------|----------|------|----------------------|
| **Deposits** | `GET /deposits` | CrymboToken + auth | `offset`, `limit` (max 100), `sB`/`sD` (sort), `FilterMap` (fB, fV, fT, fO). Sort includes `created_at`, `updated_at`. FilterMap → Prisma where (field handlers for currency, status, etc.). **No explicit `since_id`;** can use filter `id` GTE if supported. |
| **Transfers** | `GET /transfers` | CrymboToken + auth | Same pattern: offset, limit, sort, FilterMap. |
| **Withdrawals** | `GET /withdrawals` | CrymboToken + auth | Same pattern. |
| **Trades** | — | — | **No list endpoint in app.** Trades live in Laravel only. |
| **KYT** | — | — | No standalone “list KYT” in app; KYT module exists for other use. |

- **Incremental:** Possible if FilterMap supports numeric `id` with GTE: request `id >= last_processed_id`, sort by `id` asc, limit 100, loop until empty. This requires confirming that list DTOs and filter builder allow `id` and GTE.
- **Who calls app:** In production, crymbo-app proxies to app and forwards auth. So “customer API” for superdashboard could be either (1) Laravel base URL + Laravel JWT, or (2) app base URL + app-compatible token (if exposed and secure).

---

## 4. Gaps and Constraints

- **Trades:** Only in Laravel. For API-based sync we need either a Laravel list endpoint with pagination/since_id, or a new endpoint in app that reads from the same DB and supports cursor/since.
- **KYT:** Only per-deposit KYT and scoreCheck. Daily “KYT event count” today comes from direct SQL on `kyt` table. For API sync we need either a “list KYT” (with optional since_id/updated_after) or accept that KYT stays DB-based or is derived from deposits.
- **Fiat/crypto split:** Available in aggregated stats (`/stats/volume`) and in list payloads (e.g. deposit has currency_type). No separate “fiat-only” list; filter in app by currency_type/currency.
- **Fees:** In list responses (e.g. deposit has system_fee). No single “fees only” endpoint; we derive from deposits/transfers/withdrawals/trades.
- **Cursor / since_id:** Not present on Laravel list endpoints. In app, cursor-style sync is possible only if we can pass `id > X` (or `updated_at > T`) via FilterMap and sort by id/updated_at.

---

## 5. Proposed Architecture

### 5.1 High-Level Flow

1. **Bootstrap (one-time, after you clean DB)**  
   - Insert all customers/environments (with optional DB config for bootstrap).  
   - You provide **per-customer API credentials** (e.g. api_key, api_secret, username for JWT, or a long-lived token).  
   - **Initial historical fill:** still **DB-based** (current volume-sync logic) for a defined date range (e.g. 2026-01-01 → today).  
   - **Before** the rebuild starts, capture per-source max-id watermarks from each customer DB.  
   - After bootstrap completes successfully, write **checkpoints** from those captured watermarks so the first incremental API sync starts exactly after the bootstrap snapshot boundary.

2. **Ongoing sync (every 15 minutes)**  
   - **API-only:** no direct DB access.  
   - For each customer: obtain/refresh JWT, then for each data source (deposits, transfers, withdrawals, trades, KYT if we have an endpoint):  
     - Call list API with “since last checkpoint” (e.g. `id > last_id` or `updated_at >= last_ts`).  
     - Paginate (e.g. limit 100, repeat until no more).  
     - Normalize, convert currency, aggregate by day.  
     - Upsert into superdashboard Postgres (daily_metrics, etc.).  
     - **Only then** update checkpoint (last processed id / timestamp) for that source.

3. **UI**  
   - Unchanged: reads only from superdashboard API → Postgres.

### 5.2 Auth / JWT Strategy per Customer

- **Store per customer (in your DB or config):**  
  - `api_key`, `api_secret`, `username` (for Laravel JWT), **or**  
  - Pre-issued long-lived token if the platform supports it.  
- **Flow:**  
  - Before each sync (or when 401): POST to customer auth endpoint → get JWT.  
  - Use JWT in `Authorization: Bearer <token>` for all list/stats calls.  
- **Security:** Secrets in env or in a secrets store; not in frontend. Prefer one set of credentials per environment (e.g. “sync bot” user).

### 5.3 Checkpoints (Last Processed IDs)

- **Table (new):** e.g. `sync_checkpoints`.  
  - Columns: `customer_id`, `source` (e.g. `deposits`, `transfers`, `withdrawals`, `trades`, `kyt`), `last_id` (bigint), `last_updated_at` (timestamp), `updated_at`.  
  - Unique on `(customer_id, source)`.  
- **Usage:**  
  - Incremental request: “list records where `id > last_id`” (or `updated_at >= last_updated_at` if APIs support it).  
  - After successfully processing a batch and upserting to Postgres, set `last_id = max(id)` (and optionally `last_updated_at`) for that customer+source.  
- **Bootstrap:** After full historical run, set checkpoint to current max id so next run is incremental.

### 5.4 Incremental Sync per Data Source

- **Deposits / Transfers / Withdrawals (if app exposes and supports id filter):**  
  - Call app (or Laravel proxy) with filter `id > last_id`, sort by `id` asc, limit 100.  
  - Loop until no rows; for each batch: map to our metrics, convert currency, aggregate by day, upsert; then update checkpoint to max id in batch.  
- **Trades:**  
  - Either: (1) new endpoint in app (or Laravel) that lists trades with pagination + since_id, or (2) keep trades as DB-based only for now, or (3) use Laravel GET /trades with offset/limit and track last offset or last id if the response includes id.  
- **KYT:**  
  - Option A: New “list KYT” API with since_id.  
  - Option B: Keep KYT from direct DB during bootstrap and optionally for incremental (if we add an endpoint).  
  - Option C: Derive from deposits (e.g. count deposits with KYT data) if that matches current semantics.  
- **Volume/stats:**  
  - We can still call `GET /stats/volume?from_date=&to_date=` for “today” or “last 7 days” as a **validation or fallback**; primary incremental path should be list + aggregate to avoid full rescan.

### 5.5 Idempotency, Retries, Partial Failures

- **Idempotency:** Upsert by (customer_id, date, and any composite key) so re-sending the same batch does not duplicate.  
- **Checkpoint update:** Only after successful upsert of a batch. If sync fails mid-run, checkpoint is not advanced; next run retries from same last_id.  
- **Retries:** Per-request retry with backoff (e.g. 3 attempts) for 5xx and network errors; then mark customer as “sync failed” for this cycle and move on.  
- **Partial failure:** One customer failing does not block others. Per-customer checkpoint is updated only when that customer’s batch is fully processed and written.

### 5.6 Pagination and Missing Records

- **Pagination:** Use limit 100 (or app max); loop until response has fewer than 100 rows.  
- **Missing records:** If the source supports only `updated_at` (no strict ordering by id), we may re-fetch some records; idempotent upsert keeps data correct.  
- **Ordering:** Prefer `id` asc for stable cursor; if only `updated_at` is available, use `updated_at >= T` and sort by `updated_at`, and store `last_updated_at` in checkpoint.

---

## 6. Database Design Changes (Superdashboard)

- **New table: `sync_checkpoints`**  
  - `customer_id` (FK or string), `source` (enum or string), `last_id` (bigint), `last_updated_at` (timestamptz), `updated_at`.  
  - Unique (customer_id, source).  
- **Optional: `customer_api_config`**  
  - Store per-customer API base URL, auth type (jwt_v1), and encrypted or hashed credentials (or reference to secret store).  
- **Existing:** `daily_metrics`, `daily_environment_volume` stay; we only change how they are filled (API + incremental instead of full DB scan).

---

## 7. Bootstrap Strategy (DB → API)

1. You clean the DB (as planned).  
2. Insert customers/environments; store API credentials (or reference) and optionally DB credentials for bootstrap.  
3. **Phase 1 — Historical (DB):**  
   - Capture bootstrap watermarks (MAX(id)) for deposits / transfers / withdrawals / trades **before** the rebuild begins.  
   - Run current volume-sync logic (direct DB) for 2026-01-01 → today (or your range).  
   - Write to `daily_metrics` and `daily_environment_volume`.  
   - After the rebuild succeeds, write `sync_checkpoints.last_id` from the captured watermarks. This prevents gaps for records created while the historical rebuild is still running.  
4. **Phase 2 — Switch to API:**  
   - The 15‑minute scheduler uses API + checkpoints **only after** checkpoint readiness is confirmed for all configured API customers.  
   - Before that readiness gate passes, sync stays DB/bootstrap-oriented.  
   - Once ready, all later runs use only API + checkpoints; no direct DB access.

---

## 8. UI and Reading Path

- **No change.**  
- UI continues to call superdashboard API; API reads from Postgres.  
- Only the **writer** (volume-sync or a new “sync worker”) switches from DB to API + checkpoints.

---

## 9. Risks and Tradeoffs

- **API contract:** List endpoints may not support `id > X` or `updated_at >= T`. We need to confirm (and possibly add query params in app or Laravel).  
- **Trades and KYT:** No app list for trades; no global KYT list. We need either new endpoints or a hybrid (e.g. trades/KYT still from DB until APIs exist).  
- **Rate limits:** High pagination volume could hit rate limits; we’ll need throttling and backoff.  
- **Token lifetime:** JWT 1h implies refresh every sync or on 401.  
- **Data consistency:** Incremental by id is consistent; by updated_at we might miss rows if clocks skew or ordering is not strict.  
- **Rollback:** Keep DB bootstrap path available so we can re-bootstrap if API sync is broken.

---

## 10. Recommended Approach (Summary)

1. **Add checkpoint table and customer API config** in superdashboard.  
2. **Implement API client** in volume-sync (or new service): JWT obtain, list calls with pagination, and optional filter by `id > last_id` (once confirmed).  
3. **Keep bootstrap as DB-based** for one-time historical load; write checkpoints at end.  
4. **Implement incremental sync** for deposits, transfers, withdrawals (and trades/KYT when endpoints exist); update checkpoint only after successful batch upsert.  
5. **Hybrid mode:** Use API where available; fall back to DB for sources without proper API (e.g. trades, KYT) until endpoints are added.  
6. **Validation:** Compare API-derived aggregates vs. DB bootstrap for a few days to validate before full cutover.

---

## 11. Questions for You (Required to Finalize)

1. **Which base URL does superdashboard use per customer?**  
   - Laravel (crymbo-app) base URL, or app (Nest) base URL?  
   - If Laravel, do admin list routes (`GET /deposits`, `/transfers`, `/trades`, `/withdrawals`) use the **same** JWT from `POST /jwt/generate` (api_key, api_secret, username)?

2. **Credentials:**  
   - Will you provide one set of (api_key, api_secret, username) per customer environment for the “sync bot”?  
   - Are these already in the `jwt` table or do we need a separate sync user per env?

3. **Trades:**  
   - Are you OK with **keeping trades on DB-based sync** until there is a list endpoint (Laravel or app) with pagination/since_id?  
   - Or should we add a new “GET /trades” (with since_id) in app and have Laravel proxy to it?

4. **KYT:**  
   - Is a **new “list KYT events” API** (with optional since_id) acceptable on app or Laravel?  
   - Or should we keep KYT count from direct DB for now?

5. **Cursor support:**  
   - Can we add (or do we already have) query params like `since_id` or `updated_after` to app’s `GET /deposits`, `GET /transfers`, `GET /withdrawals`?  
   - If not, are you OK with **offset-based** incremental (e.g. fetch in pages of 100 and track “last page” or last id from response) until proper cursor params exist?

6. **Bootstrap DB access:**  
   - After the one-time historical fill, should we **remove** DB credentials from config entirely and rely only on API, or keep them in a “bootstrap-only” store for re-runs if needed?

Once these are answered, the next step is to implement the checkpoint schema, customer API config, and incremental sync logic (with or without hybrid fallback) and to add any new API params or endpoints in app/crymbo-app as agreed.
