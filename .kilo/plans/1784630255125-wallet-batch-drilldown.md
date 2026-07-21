# Wallet Page Redesign — Batch Drill-Down

## Goal
Keep the global Needs/Savings/Growth totals visible at the top, and let users drill into a specific batch's allocations below. The aggregate summary never hides; the batch selector only filters the detail section.

## Current State
- `WalletsSnapshot` returns `{ walletTx: WalletTransaction[], settings }`
- `WalletTransaction` already has `batch_id: string | null` populated by `allocateBatchProfit()` on batch close
- Page shows: 3 global wallet cards → allocation summary → per-wallet transaction list
- No batch context available on the Wallets page

## Target UX
1. **Top (unchanged):** 3 wallet cards — Needs / Savings / Growth with balance, income, outflow across ALL batches
2. **Batch selector:** Dropdown below the cards. Options: "All Batches" (default) + each batch's name/code
3. **Allocation summary section:** Shows total allocated per wallet for the selected scope
   - "All Batches": sums all `Allocation` transactions
   - Specific batch: sums only that batch's `Allocation` transactions
4. **Transaction list:** Filters `walletTx` by selected batch_id. Non-batch transactions (withdrawals, transfers) appear only in "All Batches"

## Implementation Steps

### 1. Add calculation helpers (`src/services/calculations.ts`)
- `walletBalancesByBatch(txs: WalletTransaction[], batchId: string | null): WalletBalance[]`
  - If `batchId` is null, include all transactions; otherwise filter `tx.batch_id === batchId`
  - Then aggregate per wallet exactly like `walletBalances`
- `batchAllocationTotals(txs: WalletTransaction[], batchId: string | null): { wallet: WalletName; amount: number }[]`
  - Filters to `transaction_type === 'Allocation'` then groups by wallet for the selected batch scope

### 2. Update Wallets page (`src/pages/Wallets/Wallets.tsx`)
- Import `useBatches` to get batch metadata for the selector
- Import new calculation helpers
- Add state: `selectedBatchId: string | null` (null = All Batches)
- Add `<Select>` batch selector below the wallet cards
- Derive `batches` list from `useBatches()` snapshot, sorted by `created_at` desc
- Replace the existing "Batch Profit Allocations" section with a scope-aware version:
  - Title: "Allocations" (All Batches) or `{batch_name} Allocations` (specific batch)
  - Compute via `batchAllocationTotals(tx, selectedBatchId)`
- Filter transaction list by `selectedBatchId`:
  - If null: show all `tx`
  - If set: show `tx.filter(t => t.batch_id === selectedBatchId)`
- Keep the 3 top wallet cards always computing from the full `tx` array (unchanged)

### 3. No backend changes required
- `WalletTransaction.batch_id` is already populated
- `useWalletsSnapshot` already returns the full transaction list
- Batch names come from existing `useBatches()` hook

## Edge Cases
- **No allocations for selected batch:** Show "No allocations yet" in the summary section
- **Batch selector with 0 batches:** Hide selector, show "No batches available"
- **Transactions without batch_id:** Only appear in "All Batches" view (withdrawals, transfers, adjustments)
- **Deleted/archived batches:** Still appear in selector since they may have historical allocations; optionally filter to exclude `Deleted`

## Files Changed
- `src/services/calculations.ts` — add 2 helpers
- `src/pages/Wallets/Wallets.tsx` — restructure layout, add selector, filter logic
