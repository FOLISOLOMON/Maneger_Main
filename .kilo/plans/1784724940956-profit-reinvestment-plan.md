# Profit Realization & Continuous Reinvestment Plan

## 1. Goal

Upgrade Avencia Manager V2 from a **Batch Completion Allocation Model** to a **Continuous Profit Realization Model**, enabling wallet allocations after every sale based on Available Profit, with reconciliation when batches close.

## 2. Context

- **Spec:** Veloura Manager V2.1 Profit Realization & Continuous Reinvestment Specification
- **Current behavior:** Wallets are allocated ONLY when a batch is closed (manually or auto-complete). A proof-based guard prevents duplicate allocations.
- **Desired behavior:** Allocations happen automatically after each sale based on Available Profit. Batch closing becomes a reconciliation step.

## 3. Key Design Decisions

### 3.1 Allocation Granularity
**Decision:** Allocate **Available Profit** after each sale.
- Available Profit = Realized Net Profit - Allocated Profit
- Realized Net Profit = Gross Profit - Paid Batch Expenses

### 3.2 Concurrency Guard
**Decision:** Per-sale `reference_id` guard + `LockService` serialization.
- Each Allocation stores `reference_id = sale.id` (the sale that triggered it).
- Before allocating, check if any WalletTransaction already has `reference_id === saleId` for the same batch.
- Wrap allocation in `LockService.getScriptLock()` (10s timeout).

### 3.3 Batch Close Behavior
**Decision:** `closeBatch` becomes pure reconciliation—no fresh allocations.
- Sum existing allocations for the batch.
- Compare against Final Net Profit.
- **Exact match:** no action.
- **Under-allocated:** create additional Allocation transactions for the remaining amount.
- **Over-allocated:** create `Adjustment` WalletTransactions to reverse the excess.

### 3.4 Auto-Complete Behavior
**Decision:** When `recomputeBatch` detects `remaining_stock === 0` and sets `status = 'Completed'`, trigger reconciliation automatically.

### 3.5 Reinvestment Tracking
**Decision:** No schema changes. Use existing `WalletTransaction` fields.
- Investment from Savings into a new batch = `Withdrawal` transaction with `batch_id` set to the new batch.

### 3.6 Migration
**Decision:** Additive only.
- Existing closed batches keep their existing Allocation transactions.
- New behavior applies only to sales recorded AFTER deployment.
- No script to recompute historical allocations.

## 4. Implementation Tasks

### 4.1 Backend (`Code.gs`)

**A. New helper functions**
Add before `recordSaleAction`:
```javascript
function calculateAllocatedProfit(batchId) {
  return getRecords('WalletTransactions')
    .filter(tx => String(tx.batch_id || '') === String(batchId) && tx.transaction_type === 'Allocation')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

function calculateAdjustmentProfit(batchId) {
  return getRecords('WalletTransactions')
    .filter(tx => String(tx.batch_id || '') === String(batchId) && tx.transaction_type === 'Adjustment')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

function allocateIncrementalProfit(batchId, amount, triggerSaleId) {
  // ... same splitting logic as current allocateBatchProfit, but:
  // - reference_id = triggerSaleId
  // - returns { needs, savings, growth }
}

function reconcileBatch(batchId) {
  // Calculate delta = finalProfit - (allocated - adjustments)
  // If Math.abs(delta) < 0.01 return
  // If delta > 0: allocateIncrementalProfit(batchId, delta, null)
  // If delta < 0: create Adjustment transactions proportional to wallet percentages
}
```

**B. Modify `recordSaleAction`**
After `recomputeBatch(batch.id)`, before `logActivity(...)`:
```javascript
const refreshedBatch = getRecordById('InventoryBatches', batch.id);
const realizedProfit = Number(refreshedBatch.net_profit || 0);
const allocatedProfit = calculateAllocatedProfit(batch.id);
const availableProfit = realizedProfit - allocatedProfit;

if (availableProfit > 0.01) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const currentAllocated = calculateAllocatedProfit(batch.id);
    const currentAvailable = realizedProfit - currentAllocated;
    if (currentAvailable > 0.01) {
      const alreadyDid = getRecords('WalletTransactions').some(function(tx) {
        return String(tx.batch_id || '') === String(batch.id) && String(tx.reference_id || '') === String(sale.id);
      });
      if (!alreadyDid) {
        allocateIncrementalProfit(batch.id, currentAvailable, sale.id);
      }
    }
  } catch (e) {
    console.log('Allocation lock failed: ' + e.message);
  } finally {
    lock.releaseLock();
  }
}
```

**C. Modify `closeBatchAction`**
- Replace `allocateBatchProfit(batch.id)` with `reconcileBatch(batch.id)`.
- Notify only if reconciliation created adjustments.

**D. Modify `recomputeBatch` auto-close path**
- When status auto-transitions to `Completed`, call `reconcileBatch(batch.id)` instead of `allocateBatchProfit(batch.id)`.

**E. Legacy `allocateBatchProfit`**
- Keep as thin wrapper calling `reconcileBatch(batchId)` to avoid breaking any external references.

### 4.2 Frontend Calculation Engine (`src/services/calculations.ts`)

Add pure functions:
```typescript
export function realizedProfit(batches: InventoryBatch[]): number
export function unrealizedProfit(products: Product[]): number
export function availableProfit(realized: number, walletTx: WalletTransaction[]): number
export function pendingProfit(batches: InventoryBatch[], products: Product[]): number
```

No changes to existing functions.

### 4.3 Frontend UI — Dashboard (`src/pages/Dashboard/Dashboard.tsx`)

Add 3 new KPI cards after the existing 4 quick stats:
- **Realized Profit**: `realizedProfit(batches)`
- **Available for Reinvestment**: `availableProfit(realizedProfit(batches), walletTx)`
- **Pending Profit**: `pendingProfit(batches, products)`

### 4.4 Frontend UI — Wallets (`src/pages/Wallets/Wallets.tsx`)

Show allocation source info: if `transaction_type === 'Allocation'` and `reference_id` is set, display it.

### 4.5 Frontend UI — Batch Detail (`src/pages/BatchDetail.tsx`)

In Overview tab profit breakdown, show:
- Realized Profit
- Unrealized Profit (from remaining products)
- Available Profit

### 4.6 Frontend UI — Reports (`src/pages/Reports/Reports.tsx`)

**Financial Report:** Add Realized Profit, Unrealized Profit, Allocated Profit, Available Profit.
**Wallet Report:** Add allocation history breakdown per wallet, optionally filtered by batch.

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Race condition on concurrent sales | `LockService` + per-sale `reference_id` guard |
| Floating point drift | Round wallet amounts to 2 decimals with `Math.round(x * 100) / 100` |
| Existing closed batches | Migration is additive; old allocations untouched |
| Batch expenses added after allocations | Reconciliation at close creates Adjustment transactions |
| Large batch >100 wallet transactions | Existing limitation acknowledged; operates on arrays from hooks |
| `LockService` timeout | 10s timeout; if lock fails, allocation is skipped and caught by reconciliation |

## 6. Validation Plan

1. **Unit tests (manual or scripted):**
   - Sale with no expenses → Available Profit = sale profit → allocation created
   - Sale then batch expense → next sale sees reduced Available Profit
   - Batch close with exact match → no adjustments
   - Batch close under-allocated → additional allocations created
   - Batch close over-allocated → Adjustment transactions created
   - Concurrent sales → no duplicate allocations
   - Existing closed batch → no modifications to old transactions

2. **UI smoke tests:**
   - Dashboard shows 3 new KPIs with correct values
   - Wallets page shows transaction type and source
   - Batch detail shows profit breakdown
   - Reports include new metrics

3. **Data integrity checks:**
   - WalletTransactions count only increases after migration
   - Sum of allocations + adjustments = final batch net profit for closed batches
   - No existing batch financials changed

## 7. Out of Scope

- **Reinvestment linking mechanism:** Implemented via WalletTransaction `batch_id` + reason string.
- **Calculation Version:** Deferred. Not defined in spec.
- **Offline queue / sync:** Assumed unchanged.
- **User-facing "Reinvestment" button:** Not in this spec.
