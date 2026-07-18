# Veloura Manager — Supabase → Google Sheets Migration Plan

## Context
The app (`src/`) is a React + Vite + TypeScript frontend built against **Supabase** (Postgres + RPC functions). The user wants to:
1. Verify `Code.gs` (a Google Apps Script) matches the Supabase schema.
2. Produce a Markdown doc describing the exact Google-Sheet tables + columns.
3. Remove all Supabase usage from the project.
4. Wire the app to a **Google Sheet backend** via `Code.gs` (web app `doGet`/`doPost` JSON API).

## Finding 1 — Does `Code.gs` match Supabase? (No — major mismatches)
`Code.gs` is a generic CRUD scaffold. It does **not** match Supabase. Key gaps:
- **Tables/sheets mismatch**: Supabase has 11 tables + `id_sequences` (12). `Code.gs` has 10 sheets and **no `id_sequences`** — IDs there are generated via `PropertiesService` script counters.
- **Field-name mismatches** (GS uses `_`-free / different names in several places):
  - `InventoryBatches`: GS = `expected_arrival`, `arrival_date`, `remaining_stock`, `gross_revenue`, `gross_profit`, `net_profit`, `roi`, `completion_percentage` — matches. But GS has **no UUID `id` column semantics issue** (it uses business IDs as PK).
  - `WalletTransactions`: GS uses `wallet`, `transaction_type`, `balance_after`, `created_by` — matches names. Supabase adds `id` (uuid) — GS uses `id` as `WAL-000001` style **code**.
  - Supabase `sales` has `unit_cost` + `total_cost`; GS has `unit_cost` + `total_cost` (matches).
  - Supabase `Suppliers/Products/Customers` use `supplier_code`/`product_code`/`customer_code`; GS uses those too (matches).
  - **Missing/extra columns**: GS `Settings` lacks nothing but Supabase `settings` has no `id_sequences`. Functionally GS is a *superset-friendly* subset but **does not enforce**: enums (status), `single settings row`, computed batch aggregates recompute, RLS, RPC logic (`record_sale`, `close_batch`, `void_sale`, `recompute_batch`).
- **No business logic**: GS `recordSale` only decrements `current_stock`. It does NOT recompute batch aggregates, does NOT allocate wallets on close, does NOT void/restore stock. All of that currently lives in Supabase RPCs (`20260718133436_0002_...sql`) — it must be re-implemented in `Code.gs`.

**Conclusion**: `Code.gs` is a starting point only. It must be extended/replaced so its API contract matches what the frontend needs.

## Target Data Model (Google Sheets = 10 sheets)
Use the exact columns from `Code.gs` `SHEET_DEFINITIONS` (already aligned with Supabase field names). Sheets:
`Settings, Suppliers, InventoryBatches, Products, Customers, Sales, Expenses, WalletTransactions, Notifications, ActivityLogs`.
(Note: `id_sequences` is NOT needed — Apps Script uses `PropertiesService` counters instead.)

See the generated `GOOGLE_SHEETS_SETUP.md` for the full per-sheet column list.

## Connectivity design (Apps Script JSON API)
`Code.gs` must expose HTTP endpoints consumed by the web app:
- `doGet(e)` / `doPost(e)` returning JSON (ContentService, `application/json`).
- Actions (routed via `?action=` or POST body `action`): `list`, `get`, `create`, `update`, `delete` per sheet, plus business actions:
  - `recordSale` (validates stock, decrements product, recomputes batch aggregates).
  - `voidSale` (restores stock, recomputes batch).
  - `closeBatch` (recomputes, allocates Needs/Savings/Growth from `net_profit` using Settings %s, sets Completed).
  - `recomputeBatch`, `createExpense` (inserts + recompute + wallet outflow).
- ID generation: keep `generateBusinessId` using `PropertiesService` counters (prefixes match Supabase: SET/SUP/BAT/PRD/CUS/SAL/EXP/WAL/NOT/LOG).

## Frontend changes (remove Supabase, add Sheets client)
1. **Delete / neutralize Supabase**:
   - `src/lib/supabase.ts` → replace with `src/lib/sheets.ts` that calls `UrlFetch`/fetch to the deployed Apps Script web-app URL (stored in `VITE_SHEETS_API_URL`).
   - `src/services/id.ts` → remove `generateBusinessIdRpc` (IDs now generated server-side by Apps Script on create).
   - `src/services/api.ts` → rewrite every function to call the Sheets JSON API instead of `supabase.from(...)` / `supabase.rpc(...)`. Keep the same function signatures + return shapes (the UI depends on them).
   - `src/hooks/queries.ts` → unchanged (calls `api.*`); ensure `api.ts` exports identical names.
2. **Config**:
   - Remove `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` usage; add `VITE_SHEETS_API_URL` (and optional `VITE_SHEETS_API_KEY` for a shared secret header the Apps Script verifies).
   - Add `.env.example` with the new var.
   - Remove `@supabase/supabase-js` from `package.json` deps (optional, but recommended for cleanliness).
3. **Key contract constraints to preserve** (so no UI changes are needed):
   - Relations are returned inline (UI expects `batch.supplier?.supplier_name`, `sale.product?.product_name`, etc. — currently via Supabase joins). The Sheets API must **return joined objects** (e.g., `fetchBatch` returns `{...batch, supplier:{supplier_name,supplier_code}}`). Implement a small join layer in `Code.gs`.
   - Wallet/derived values (KPIs, balances, batch health) stay **computed in the frontend** (`src/services/calculations.ts`) — only source rows are stored. This already matches the app design; keep it.
   - `recompute_batch` logic (gross_revenue=gross_profit=revenue−COGS; net=−batchExpenses; roi; completion; status transitions; remaining_stock) must be replicated in `Code.gs` because `InventoryBatches` stores those aggregate columns and the UI reads them directly.

## Validation
- Deploy `Code.gs` as a web app; curl each action (list/create recordSale/closeBatch) and verify JSON.
- Run `npm run build` + `tsc --noEmit` to confirm no Supabase imports remain.
- Manually test onboarding → create batch → add product → record sale → close batch → verify wallet allocation rows appear.

## Risks / open decisions
- **CORS**: Apps Script web apps send `Access-Control-Allow-Origin: *` automatically for GET; for POST from a browser you may need `doOptions` preflight handling or call via `no-cors`/backend. Plan: prefer GET-with-query for reads, POST JSON for writes, add `doOptions` returning permissive CORS.
- **Auth**: single-tenant, no login. Use a shared secret query/header verified in `Code.gs` (replace `persistSession:false` supabase auth). Optional.
- **Performance**: Apps Script `getDataRange()` on every call is fine for SMB data sizes.
- **ID collisions** when migrating existing Supabase data: not in scope unless user has data to port.

---

## Execution log
Done:
1. **`code.gs`** — added `doGet`/`doPost`/`doOptions` JSON API, join helpers
   (`joinBatch(s)`, `joinProduct(s)`, `joinSale(s)`, `joinExpense(s)`, `joinWalletTx`),
   and re-implemented the RPCs as `recordSaleAction`, `voidSaleAction`,
   `closeBatchAction`, `recomputeBatch`, `createExpenseAction`. IDs still generated
   server-side via `PropertiesService` counters. Optional `API_KEY` constant for a
   shared secret.
2. **`src/lib/sheets.ts`** (new) — replaced `supabase.ts`; `fetch()` client for the
   Apps Script web app with a `{success,data}` envelope unwrapper.
3. **`src/services/api.ts`** — rewritten to call Sheets actions; same function names &
   return shapes so `hooks/queries.ts` and all pages are unchanged. Writes use POST
   JSON; IDs are produced by the script.
4. **`src/services/id.ts`** — deleted (`generateBusinessIdRpc` no longer needed).
5. **`src/lib/supabase.ts`** — deleted.
6. **`src/vite-env.d.ts`** — typed `VITE_SHEETS_API_URL` / `VITE_SHEETS_API_KEY`.
7. **`.env.example`** — new, documents the two new vars.
8. **`package.json`** — removed `@supabase/supabase-js` dependency.

Validation:
- `npm run build` passes (only a pre-existing chunk-size warning).
- `tsc --noEmit` is clean for all changed files. The remaining `tsc` errors are
  **pre-existing** `noUnusedLocals` warnings in untouched UI components
  (AppLayout, Customers, Dashboard, Expenses, BatchDetail, InventoryList, Reports).

Remaining manual steps for the user:
- Deploy `code.gs` as a Web App (Execute as: Me / Access: Anyone) and set
  `VITE_SHEETS_API_URL` in a real `.env` file.
- Open the sheet once and run `initializeVelouraSheets()` (or just let the app
  create rows via the API; headers are created on first write).
