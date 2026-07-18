# Veloura Manager — Load & Save Performance Fix

## Context
The app is a React SPA backed by a Google Apps Script (`code.gs`) JSON API that reads/writes
Google Sheets. The user reports the app is **very slow to load**, and **especially slow when
adding/saving** (recording a sale, creating an expense, closing a batch).

### Why it is slow (verified by reading the code)
The latency is dominated by **counting HTTP round-trips × Apps Script fixed overhead**, plus
**redundant full-sheet reads inside each call**. Apps Script web-app calls have a large fixed
cost (cold start + round-trip, typically 1–5s each), so the number of requests matters more
than the work in each.

1. **No request batching on load.** The Dashboard (`src/pages/Dashboard/Dashboard.tsx:30-34`)
   fires 5 independent queries: `useBatches`, `useProducts`, `useSales`, `useExpenses`,
   `useWalletTransactions` — 5 sequential HTTP round-trips. Every page has a similar fan-out
   (`AppLayout` → `useNotifications`; mutations invalidate 4+ keys → 4+ refetch round-trips).
2. **Every `getRecords` reads the WHOLE sheet** (`code.gs:432` `sheet.getDataRange().getValues()`)
   and there is **no caching**. `getRecordById` (`code.gs:451`) calls `getRecords` again (another
   full read). `joinSales`/`joinExpenses`/`joinWalletTransactions` call `getRecordById` **once per
   row** (e.g. `code.gs:606-631`) — so listing 100 sales does 100×3 full sheet reads.
3. **Saves do many reads.** `recordSale` → `recomputeBatch` (reads Products, Sales, Expenses,
   Settings = 4 full reads, `code.gs:879-915`) → `allocateBatchProfit` (WalletTransactions +
   Settings = 2 more, `code.gs:822,829`) → `createRecord` re-reads (`code.gs:490`) →
   `updateRecord` re-reads (`code.gs:502,519`). Then the mutation invalidates 4 React Query keys
   (`queries.ts:220-225`) → 4 more refetch round-trips.
4. **No server-side cache**: every `getRecords`/`getRecordById` hits the sheet again.

### Goal
Cut perceived load time and save time dramatically by (a) **batching reads into one round-trip**,
(b) **caching sheet reads within a single request**, and (c) **reducing post-save refetch
chatter**. No backend infra change (still Apps Script + Sheets).

## Affected boundaries
- `code.gs` — add a per-request read cache for `getRecords`/`getRecordById`; add batched
  read actions; keep `join*` but reuse the cache.
- `src/lib/sheets.ts` — add a `batchRequest` helper.
- `src/services/api.ts` — add `fetchDashboardSnapshot()` etc. using the batch endpoint.
- `src/hooks/queries.ts` — replace multi-query page loads with snapshot queries; trim
  mutation invalidations.
- Page components (Dashboard, InventoryList, BatchDetail, Sales, Wallets, etc.) — use the
  snapshot hooks instead of parallel `useX()` calls.

## Implementation steps

### 1. Add a per-request read cache in `code.gs`
`getRecords`/`getRecordById` are the hottest paths and are re-read repeatedly within one request.
Cache by sheet name for the lifetime of the request:

```javascript
const _recordCache = {};   // sheetName -> array of records (request-scoped)
function getRecords(sheetName) {
  if (_recordCache[sheetName]) return _recordCache[sheetName];
  ... existing body, then ...
  _recordCache[sheetName] = result;
  return result;
}
```
`getRecordById` already delegates to `getRecords`, so it is covered automatically. This alone
removes the N× per-row reads in `join*` and the repeated reads inside `recomputeBatch`/
`allocateBatchProfit`/`createRecord`. Cache is naturally reset per invocation (top-level `const`
is fresh on each `doGet`/`doPost`).

### 2. Add a batched read action `getSnapshot`
Add a single action that returns everything a page needs in one HTTP call. Example for the
dashboard (extend per page):

```javascript
case 'getDashboardSnapshot':
  result = {
    settings: getRecords('Settings')[0] || null,
    batches: joinBatches(getRecords('InventoryBatches')),
    products: joinProducts(getRecords('Products')),
    sales: joinSales(getRecords('Sales')),
    expenses: joinExpenses(getRecords('Expenses')),
    walletTx: joinWalletTransactions(getRecords('WalletTransactions')),
    notifications: getRecords('Notifications')
  };
  break;
```
Because of the cache from step 1, these `getRecords` calls cost only one real sheet read each.
Add similar snapshots for InventoryList (`batches`, `products`), BatchDetail (`batch`, `products`,
`sales`, `expenses`, `walletTx`), Sales (`sales`, `products`, `customers`, `batches`), Wallets
(`walletTx`, `settings`). Keep them coarse; the cache keeps them cheap.

### 3. Add `batchRequest` to `sheets.ts`
Allow firing several actions in one round-trip for cases where a snapshot doesn't fit:

```javascript
export async function sheetsBatch(actions: {action:string; params?:any}[]): Promise<any[]> {
  return request('batch', { actions });
}
```
Server side (`handleRequest`): add `case 'batch'` that loops `actions`, collects each
`result`, and returns `{ success:true, data: results[] }`. (Optional — snapshots in step 2
may be enough; include only if needed for mutations.)

### 4. Service layer + hooks
- `api.ts`: add `fetchDashboardSnapshot()` → `sheetsAction('getDashboardSnapshot')`.
- `queries.ts`: add `useDashboardSnapshot()` keyed `['dashboard']` with `staleTime: 15_000`;
  add `useInventorySnapshot()`, `useBatchSnapshot(id)`, `useSalesSnapshot()`,
  `useWalletsSnapshot()` similarly.
- Keep existing granular hooks for forms/detail writes, but use snapshots for list/initial loads.

### 5. Trim post-save refetch chatter
Mutations currently invalidate 4+ keys (`queries.ts:220-225`, `131-135`, `167-172`).
After step 4 the list pages read from snapshot keys. Update `onSuccess` invalidations to
invalidate only the relevant snapshot key(s) (e.g. `qc.invalidateQueries({ queryKey: ['dashboard'] })`
and `['inventory']`, `['batch', id]`) instead of 4 granular keys. This turns 4 refetch
round-trips into 1.

### 6. Optional quick wins (if still slow)
- Increase `staleTime` on heavy queries (already 10–60s; bump snapshots to 30–60s).
- Ensure the Apps Script deployment is **"Execute as: Me" + "Who has access: Anyone"** and is a
  deployed **/exec** URL (not /dev) so it isn't re-deployed/re-authored each call.
- Confirm only ONE spreadsheet is being opened per request (already the case).

## Data-flow / edge cases
- Cache is request-scoped: a `createRecord`/`updateRecord` that runs *after* a `getRecords` in the
  same request will see the cached (pre-write) value. Audit each write path: writes happen at the
  END of a request (e.g. `recomputeBatch` reads then writes; `closeBatchAction` recomputes then
  allocates). The cache returning slightly stale reads within a single request is acceptable and
  matches current behavior (current code already re-reads post-write via `getRecordById`). To be
  safe, clear `_recordCache[sheetName]` inside `createRecord`/`updateRecord`/`deleteRecord` after
  mutating that sheet so subsequent reads in the same request are fresh.
- `getDashboardSnapshot` returns large payloads; that is fine (one round-trip vs five+).
- Snapshot shape must be documented so frontend hooks map fields correctly (batches/products/...).

## Validation
1. Redeploy Apps Script as a new version; hard-refresh.
2. Open Dashboard: Network tab should show **1** `getDashboardSnapshot` request instead of 5+
   parallel ones; total load time should drop from ~5×latency to ~1×latency.
3. Record a sale: confirm `recomputeBatch` + `allocateBatchProfit` still produce correct
   `net_profit` and 3 Allocation rows (cache must not break recompute math — verify totals).
4. Confirm post-save the UI refreshes from a single snapshot refetch, not 4.
5. Close a batch: verify allocation + notification still fire (regression check on the earlier fix).
6. Spot-check Wallets/Sales/Inventory pages load via their snapshots in one request.

## Open questions / notes
- Exact snapshot composition per page should be confirmed against each page's current queries
  (Dashboard confirmed: 5 queries; others to be matched 1:1).
- If the spreadsheet itself has very large sheets (thousands of rows), consider `batchUpdate`/
  targeted `getRange` reads later, but caching + batching addresses the reported symptom first.
- This plan only optimizes read fan-out and caching; it does not change the Sheets backend model.
