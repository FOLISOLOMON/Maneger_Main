# Offline Sync, Partial Payments & Customer Balances Plan

## 1. Goal
Add three capabilities to Avencia Manager:
1. **Partial payments / installments** — record payments against a sale and track outstanding balances.
2. **Outstanding customer balance** — surface per-customer receivables in the Customers UI and Dashboard.
3. **Background sync** — queue mutations while offline and replay them automatically when connectivity returns.

All changes are additive. Existing batch/sale/wallet flows continue to work unchanged.

## 2. Context
- Backend is Google Apps Script (`Code.gs`) with GET-only API to avoid CORS preflight.
- Frontend is React + Vite PWA with React Query caching.
- `doPost` already exists in `Code.gs` and pipes through the same `runAction` router as GET.
- Sheets used today: `Settings`, `Suppliers`, `InventoryBatches`, `Products`, `Customers`, `Sales`, `Expenses`, `WalletTransactions`, `Notifications`, `ActivityLogs`.

## 3. Design Decisions

### 3.1 Data model: separate `Payments` sheet
**Decision:** Introduce a new `Payments` sheet instead of adding columns to `Sales`.
- Rationale: keeps `Sales` as the immutable transaction record; payments are a separate lifecycle event.
- Enables multiple payments per sale, partial payments, and a clean audit trail.
- Columns:
  - `id`, `payment_code`, `sale_id`, `customer_id`, `amount`, `payment_method`, `payment_date`, `notes`, `created_at`
  - `sale_id` is nullable so a payment can be recorded against a customer balance without linking a specific sale (generic settlement).

### 3.2 Sale payment status
**Decision:** Add three computed/denormalized fields to `Sales`:
- `amount_paid` (number, default 0)
- `balance` (number, default = `total_sale`)
- `payment_status` (string, default `pending`): `pending` | `partial` | `paid`
- These are updated server-side whenever a `Payment` row is created or a sale is voided.
- Why not compute entirely from `Payments`: reduces repeated summation in Reports/Dashboard hot paths.

### 3.3 Outstanding balance computation
**Decision:** Two views of “balance”:
1. **Sale-level balance** = `Sales.balance` per row.
2. **Customer-level balance** = sum of `Sales.balance` for `customer_id`, minus any unallocated customer payments (payments where `sale_id` is null).
- Customer cards/detail modal show the customer-level balance.
- Dashboard shows total business receivables (sum of all sale balances).

### 3.4 Payment recording UX
**Decision:** Integrate into existing pages—no new top-level page.
- **Sales list/card** — show a small payment status badge (`Pending`, `Partial`, `Paid`) and `balance`.
- **Customer detail modal** — add a `Record Payment` button that opens a small modal (amount, method, optional sale link, notes).
- **FAB / Actions** — on the Customers page, the FAB stays `New Customer`. Payment recording is context-sensitive inside the detail modal.
- After a payment is recorded, the sale list and customer card refresh via React Query cache updates.

### 3.5 Backend action flow
New business actions in `Code.gs`:
- `recordPayment(params)` — creates a `Payment` row, revalidate `amount_paid`/`balance`/`payment_status` on the linked sale, create a `WalletTransactions` `Withdrawal` from `Needs` (mirroring how expenses already create outflows), log activity.
- `voidSaleAction` — when a sale is voided, reverse any linked payments:
  - If `amount_paid > 0`, create refund `Payment` rows or mark original payments as refunded. Simplest safe path: create reverse `Payment` with negative amount and `notes: 'Refund for voided sale ...'`. Then zero out `Sales.amount_paid`, `Sales.balance`, `Sales.payment_status`.
- Do NOT auto-create `WalletTransactions` on every `recordPayment`. Only create the `Withdrawal` from `Needs` if the payment represents the *customer settling an outstanding receivable*. Actually, the cleaner model: a customer payment is an inflow to the business, not an outflow. The existing `WalletTransactions` model treats `Withdrawal` and `Expense` as outflows. We should add `Payment` or `Receipt` as an inflow type, or reuse `Allocation` semantically. Decision: treat customer payment as a new `transaction_type: 'Receipt'` that is an inflow to a new `Customers` wallet or simply track it separately from the 3 operational wallets. For now, **do not create a WalletTransaction for customer payments** — receivables are tracked in `Sales`/`Payments`; wallet logic remains unchanged.

### 3.6 Background sync architecture
**Decision:** Queue mutations offline, replay via POST when online.
- Current API is GET-only. We need POST for mutations because GET with large bodies is unreliable and URL-length-limited.
- `Code.gs` `doPost` already exists and handles `runAction`. It must be reachable at a different Apps Script deployment URL or the same URL with POST method. **Important:** when the Web App is deployed as `Execute as: Me`, both GET and POST work on the same URL.
- Frontend changes:
  1. `src/services/syncQueue.ts` — new module with `enqueue`, `flush`, `onStatusChange`, `useSyncStatus`.
  2. `src/lib/sheets.ts` — add `postAction` helper parallel to `request`.
  3. `src/hooks/queries.ts` — wrap mutations with `SyncQueue.enqueue` when offline.
  4. `src/components/layout/AppLayout.tsx` — add a sync-status pill (`Online` / `Offline • N pending`).
  5. `src/main.tsx` — listen for `online`/`offline` events and trigger `flush`.

Queue schema (localStorage):
```json
{
  "id": "uuid",
  "action": "recordSale",
  "params": { ... },
  "createdAt": 1700000000000,
  "retries": 0
}
```

Replay rules:
- Process serially (FIFO).
- On success, remove from queue.
- On failure (network or server error), increment `retries`. If `retries >= 3`, move to `failed` sub-array and surface in UI notification.
- Do not auto-delete failed items; let user retry manually or clear.

### 3.7 Validation rules
- Cannot record a payment larger than the remaining balance for that sale.
- Balance never drops below zero.
- Voiding a sale with `balance > 0` creates a refund payment of `amount_paid` (negative amount) and resets sale balances.

## 4. Implementation Tasks

### 4.1 Backend (`Code.gs`)
1. Add `Payments` to `SHEET_DEFINITIONS` with headers: `id`, `payment_code`, `sale_id`, `customer_id`, `amount`, `payment_method`, `payment_date`, `notes`, `created_at`.
2. Add `initializePaymentsSheet()` helper and call it from `initializeVelouraSheets` (guarded by row-empty check).
3. Add `recordPaymentAction(params)`:
   - Validates sale exists and is `Completed`.
   - Computes `newPaid = sale.amount_paid + amount`, `newBalance = sale.total_sale - newPaid`.
   - Creates `Payment` row.
   - Updates `Sales.amount_paid = newPaid`, `Sales.balance = newBalance`, `Sales.payment_status = newBalance <= 0 ? 'paid' : 'partial'`.
   - Logs activity.
4. Update `voidSaleAction`:
   - If `sale.amount_paid > 0`, create a refund `Payment` with negative amount.
   - Zero out `amount_paid`, set `balance = total_sale`, set `payment_status = 'pending'`.
5. Modify `getDashboardSnapshot` and `getSalesSnapshot` to include `payments` (limited slice).

### 4.2 Frontend — Types & Constants
1. Add `Payment` interface in `src/types/index.ts`.
2. Add `PaymentStatus` type: `pending | partial | paid`.
3. Add `PaymentMethod` to existing `PaymentMethod` type if needed, or reuse existing.
4. Update snapshot types in `src/services/api.ts` to include `payments`.

### 4.3 Frontend — Services & Hooks
1. `src/services/calculations.ts`:
   - `saleBalance(sale)` → returns `{ amountPaid, balance, status }`.
   - `customerBalance(customerId, sales, payments)` → sum of sale balances + unallocated payment surplus.
   - `totalReceivables(sales)` → sum of all balances.
2. `src/services/api.ts`:
   - `fetchPayments(limit?)`, `createPayment(input)`.
3. `src/hooks/queries.ts`:
   - `usePayments()`, `useCreatePayment()`.
   - `useCreatePayment` should invalidate `salesSnapshot`, `dashboard`, `customers`.

### 4.4 Frontend — Sales Page
1. In sales list card, render a `PayBadge` overlay showing `payment_status` and `balance`.
2. Add a small `Pay` button on `partial`/`pending` sales that opens `RecordPaymentModal` pre-linked to that sale.

### 4.5 Frontend — Customers Page
1. In customer list cards, append `formatMoneyCompact(customerBalance, currencySymbol)` with label `Outstanding` or `Balance`.
2. In detail modal, add `Record Payment` button.
3. `RecordPaymentModal`:
   - Fields: amount (required), payment method (select), linked sale (optional select filtered to that customer’s pending/partial sales), notes.
   - On submit, call `createPayment`.
   - Show `balance` preview.

### 4.6 Frontend — Background Sync
1. `src/services/syncQueue.ts`:
   - `enqueue(action, params)` — appends to `localStorage['syncQueue']`.
   - `flush()` — iterates queue, calls `postAction`, removes on success.
   - `useSyncStatus()` — returns `{ isOnline, pendingCount, failedCount, flush }`.
   - Auto-flush on `window.addEventListener('online', flush)`.
2. `src/lib/sheets.ts`:
   - Add `postAction(action, params)` using `fetch(url, { method: 'POST', body: JSON.stringify({ action, ...params }) })`.
   - Keep `request` for GET (snapshots/reads).
3. `src/hooks/queries.ts`:
   - Wrap mutation `mutationFn` with sync queue: if `!navigator.onLine`, `enqueue` instead of calling API immediately; else call API directly.
4. `src/components/layout/AppLayout.tsx`:
   - Import `useSyncStatus`, render a pill in the header: `Online` (green dot) or `Offline • N pending` (amber dot).
5. `src/main.tsx`:
   - Initialize queue listener on app boot.

## 5. Migration & Rollout
- **Existing data:** `Sales` rows will need `amount_paid = 0`, `balance = total_sale`, `payment_status = 'pending'` backfill. This can be a one-time Apps Script `backfillPayments()` function run manually.
- **Deployment order:**
  1. Deploy `Code.gs` with new sheet + actions.
  2. Run backfill.
  3. Deploy frontend.

## 6. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| `doPost` CORS issues | Apps Script Web App returns `Access-Control-Allow-Origin:*` on POST when deployed as `Anyone`. Test explicitly. |
| Queue grows unbounded offline | Max queue size 500; if exceeded, show error toast and drop oldest non-critical items. |
| Duplicate payments if user spams | Idempotency: use sale_id + amount + timestamp window in backend, or rely on UI disable button during submit. |
| Voiding sale with partial payments | Refund payment is created automatically; no orphaned balance. |
| React Query cache stale after sync flush | `flush()` invalidates all `qk` mutations + snapshots after replay. |

## 7. Validation Plan
1. **Unit/manual:**
   - Record sale → status `pending`, balance = total_sale.
   - Record payment of 50% → status `partial`, balance halves.
   - Record remaining payment → status `paid`, balance 0.
   - Record payment > balance → rejected with error.
   - Void sale with partial payments → refund payment created, sale reset.
2. **Offline:**
   - Toggle airplane mode, record sale + payment → queued.
   - Toggle back online → auto-flush, UI updates, queue empty.
3. **UI smoke:**
   - Sales list shows status badge + balance.
   - Customer cards show outstanding balance.
   - Header sync pill updates on connectivity change.
4. **Data integrity:**
   - Sum of all `Payments.amount` for a sale = `Sales.amount_paid`.
   - Total receivables on Dashboard = sum of `Sales.balance` where `payment_status != 'paid'`.
