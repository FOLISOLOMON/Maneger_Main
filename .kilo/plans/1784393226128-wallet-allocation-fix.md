# Veloura Manager — Wallet Profit Allocation Fix (code.gs)

## Context
The app is a React frontend backed by a Google Apps Script (`code.gs`) JSON API
(replacing Supabase). The user completed a batch with positive `net_profit` but saw:
- **Needs wallet negative** (driven by expense outflows).
- **Savings = 0 and Growth = 0** (no allocation rows created).

Root causes confirmed by reading `code.gs`:
1. **Split only runs on the explicit `closeBatch` action** — NOT when a batch
   auto-completes by selling out. In `recomputeBatch` (lines ~850–863) the status flips
   to `'Completed'` automatically once `remaining_stock === 0`, but that path never
   allocates to wallets. So a sold-out batch sits "Completed" with profit stored but
   unsplit.
2. **Missing default for allocation percentages.** In `closeBatchAction` (lines 900–903)
   the split multiplies `net` by `Number(settings.savings_percentage || 0)` /
   `Number(settings.growth_percentage || 0)`. When those Settings cells are blank/0,
   `savings` and `growth` silently become `0` — even with positive profit. Needs only
   *looks* populated because `createExpenseAction` writes `Needs` **Expense** (outflow)
   rows for every expense, unrelated to the split.
3. Two separate allocation code paths (`recomputeBatch` auto-complete vs `closeBatchAction`)
   would drift if both edited independently.

Net profit IS computed correctly (`recomputeBatch`: `netProfit = grossProfit - batchExpenses`,
`grossProfit = grossRevenue - cogs`, sales filtered to `status === 'Completed'`). The bug
is purely in *when/with-what-percent the split fires*.

## Decision (Option A — agreed with user)
Make the profit split fire on **BOTH** auto-complete (sell-out) and explicit close, via a
**single shared `allocateBatchProfit(batchId)` function**, guarded to run **exactly once**
per batch. Add a **40/35/25 default** when Settings percentages are missing/blank.

This leaves the negative-Needs behavior as-is (expense outflows are correct accounting);
the actual fix is ensuring Savings/Growth allocation actually lands.

## Affected boundaries (all in `code.gs`)
- `recomputeBatch(batchId)` — add once-only allocation call on auto-complete.
- `closeBatchAction(batchId)` — replace inline split with call to shared function.
- New `allocateBatchProfit(batchId)` — single source of truth.

No frontend (`src/`) changes required. `walletBalances()` (calculations.ts) already treats
`Allocation` as inflow and `Expense`/`Withdrawal` as outflow — correct.

## Implementation steps

### 1. Add `allocateBatchProfit(batchId)` (new function, place above `recomputeBatch`)
Behavior:
- Look up batch; if missing return `{needs:0,savings:0,growth:0}`.
- **Once-only guard**: if `batch.status === 'Completed' || 'Archived'` → return zeros
  (already finalized; do not re-allocate).
- `net = Number(batch.net_profit || 0)`; if `net <= 0` → return zeros.
- Read Settings `[0]`; compute `needsPct/savingsPct/growthPct` via `Number(...)`.
  If all three `<= 0`, default to `40/35/25`.
- Create 3 `WalletTransactions` rows (`transaction_type: 'Allocation'`, `batch_id`,
  `created_by: 'System'`, `reason: 'Allocation from ' + batch.batch_code`):
  - Needs  = net * needsPct/100
  - Savings = net * savingsPct/100
  - Growth  = net * growthPct/100
- Return `{needs, savings, growth}`.

### 2. Edit `recomputeBatch` (replace lines ~850–873)
- Capture `const wasCompleted = (status === 'Completed' || status === 'Archived')` BEFORE
  the status-transition block.
- Keep the existing transition logic (Draft→Purchased→Selling→Almost Finished→Completed).
- After `updateRecord(...)` of aggregates, add:
  `if (!wasCompleted && status === 'Completed' && netProfit > 0) allocateBatchProfit(batchId);`
  (uses `netProfit` already computed in scope; only fires on the run that flips to Completed.)

### 3. Edit `closeBatchAction` (replace lines ~891–931)
- Keep the `remaining_stock > 0` guard and `recomputeBatch(batchId)` + `refreshed` read.
- Replace the inline `needs/savings/growth` block + 3 `createRecord` calls with:
  `const allocated = allocateBatchProfit(batchId);`
  `const needs = allocated.needs; const savings = allocated.savings; const growth = allocated.growth;`
- Keep `updateRecord('InventoryBatches', batchId, { status: 'Completed' });` and the
  existing notification + logActivity + return (they reference `net/needs/savings/growth`,
  still defined).

## Data-flow / edge cases
- **Sell everything out**: `recordSale` → `recomputeBatch` → status flips to Completed →
  `allocateBatchProfit` fires once → 3 Allocation rows created. ✓
- **Click "Close Batch"**: `closeBatch` → `recomputeBatch` (status already Completed, guard
  skips) → `allocateBatchProfit` (status Completed → returns zeros, no double alloc). ✓
  Note: to re-allocate an already-unsplit Completed batch, call `allocateBatchProfit`
  manually or add Allocation rows by hand (guard prevents auto re-run).
- **Partial sale then close with stock left**: `closeBatch` guard `remaining_stock > 0`
  blocks; no allocation (correct — matches spec "cannot close with remaining stock").
- **net <= 0**: no Allocation rows (by spec); Needs still shows expense outflows.
- **Blank Settings percentages**: default 40/35/25 ensures Savings/Growth > 0 when net > 0.

## Validation
1. Redeploy Apps Script (New version); hard-refresh app.
2. Sell out an existing open batch → confirm 3 `Allocation` rows (Needs/Savings/Growth)
   appear in `WalletTransactions`, amounts = net×40/35/25%.
3. Verify Savings = 35% and Growth = 25% of `net_profit` (read from InventoryBatches row).
4. Confirm re-closing the same batch does NOT create duplicate Allocation rows (once-only
   guard).
5. Confirm a batch with `net_profit <= 0` creates no Allocation rows.
6. Confirm wallet page shows positive Savings/Growth balances; Needs may be negative due to
   expense outflows (expected).

## Open questions / notes
- Business expenses currently also write `Needs` outflows (createExpenseAction else-branch).
  Left as-is for this fix; can be revisited if negative Needs is undesirable.
- `balance_after` column exists in WalletTransactions but is never computed; out of scope.
- The edit tool was unavailable in the prior session; this plan is for a fresh
  implementation-capable session to apply the three patches and redeploy.
