# Veloura Manager V2 — Bug Fixes & Improvements Plan

## Summary
Address 8 user-reported issues: stock inaccuracy, missing product edit, FAB instability on reload, iOS input zoom, missing sale void UI, wallet allocation visibility, slow instant updates, and overall performance.

## Root Causes Identified
1. **Unstable React Query keys**: Snapshot hooks (`useSalesSnapshot`, `useWalletsSnapshot`, `useNotificationsSnapshot`, `useDashboardSnapshot`) receive inline option objects (e.g., `{ salesLimit: PAGE_SIZE }`) on every render. React Query treats each new object reference as a new query, causing constant unmount/remount, loading flickers, stale optimistic updates, and perceived slowness.
2. **Stock drift**: Backend `updateProduct` uses generic `updateRecord` without calling `recomputeBatch`, so batch `remaining_stock` desyncs from actual product `current_stock`.
3. **Missing UI**: Product edit and sale void actions exist in the API/hooks but have no frontend entry points.

## Task List

### T1 — Stabilize React Query snapshot keys
- **Files**: `src/hooks/queries.ts`
- **Change**: Update all snapshot hooks to accept primitive/stable options instead of inline objects.
  - `useSalesSnapshot(options?: { salesLimit?: number })` → `useSalesSnapshot(salesLimit?: number)`
  - `useWalletsSnapshot(options?: { walletTxLimit?: number })` → `useWalletsSnapshot(walletTxLimit?: number)`
  - `useNotificationsSnapshot(options?: { notificationsLimit?: number })` → `useNotificationsSnapshot(notificationsLimit?: number)`
  - `useDashboardSnapshot(options?: { salesLimit?: number; expensesLimit?: number; walletTxLimit?: number; notificationsLimit?: number })` → accept individual number params or a single stable options object defined outside render.
- **Files**: `src/pages/Sales/Sales.tsx`, `src/pages/Wallets/Wallets.tsx`, `src/pages/Notifications/Notifications.tsx`, `src/pages/Dashboard/Dashboard.tsx`
- **Change**: Update call sites to pass primitives/stable references instead of inline `{}`.
- **Validation**: Verify FAB no longer flickers on reload; pages no longer flash loading on every state change.

### T2 — Fix stock calculation accuracy
- **File**: `code.gs`
- **Change**: In the generic `update` handler (or add a dedicated `updateProductAction`), after `updateRecord('Products', id, payload)`, call `recomputeBatch(product.batch_id)` so `remaining_stock` stays in sync when product stock is edited.
- **File**: `src/hooks/queries.ts`
- **Change**: In `useUpdateProduct` `onSuccess`, also invalidate `qk.batchSnapshot(data.batch_id)` and `qk.inventory` to refresh UI immediately.
- **Validation**: Edit a product’s stock in a batch; confirm batch `remaining_stock` updates correctly without manual refresh.

### T3 — Add product edit UI
- **File**: `src/pages/Inventory/BatchDetail.tsx`
- **Change**: 
  - Add edit icon button to each product card in the Products tab.
  - Add `EditProductModal` pre-filled with current product fields (name, brand, category, cost price, selling price, stock, reorder level, description).
  - Wire modal submit to `useUpdateProduct`.
- **Validation**: Edit a product; confirm changes persist and batch stock/stats update.

### T4 — Add sale void UI
- **Files**: `src/pages/Sales/Sales.tsx`, `src/pages/Inventory/BatchDetail.tsx`
- **Change**:
  - Add a `Void` action button on sale cards (visible only for `Completed` sales).
  - Show a confirmation dialog before voiding.
  - Wire to `useVoidSale`; on success show toast and update UI optimistically.
- **Validation**: Void a sale; confirm stock is restored, sale status changes to Voided, and wallet/batch numbers update.

### T5 — Wallet allocation: per-batch + total summary
- **Backend**: Already implemented (`allocateBatchProfit` creates `batch_id`-tagged Allocation rows). No change needed.
- **File**: `src/pages/Wallets/Wallets.tsx`
- **Change**:
  - Above the transaction list, add a “Batch Allocations” summary section showing total allocated per wallet (Needs / Savings / Growth) derived from wallet transactions filtered by `transaction_type === 'Allocation'`.
  - Keep existing per-batch transaction list (already shows `batch allocation` label).
- **Validation**: Close a batch; confirm allocation appears in both the summary and transaction list.

### T6 — Fix iOS input zoom
- **File**: `src/components/common/Form.tsx`
- **Change**: Increase input font size to at least 16px to prevent iOS Safari zoom on focus.
  - Update `baseField` class from `text-sm` to `text-base`.
  - Alternatively, add a global CSS rule in `index.html` or main CSS targeting inputs: `input, select, textarea { font-size: 16px; }`.
- **Validation**: Test on iPhone/iOS simulator; confirm focusing inputs no longer zooms.

### T7 — Performance & instant update polish
- **StaleTime tuning**: In `src/hooks/queries.ts`, reduce `staleTime` for high-churn data:
  - `useSalesSnapshot`: `10_000` → `5_000`
  - `useWalletsSnapshot`: `10_000` → `5_000`
  - `useInventorySnapshot`: `15_000` → `5_000`
  - Keep `useSettings` at `60_000`.
- **Optimistic updates**: After T1 fixes query keys, verify that `useRecordSale`, `useVoidSale`, `useCreateWalletTransaction`, and `useCloseBatch` optimistic patches still align with the stabilized keys. Adjust `setQueryData` calls if needed.
- **Validation**: Record a sale; confirm UI updates instantly without refresh. Switch pages rapidly; confirm no loading flicker.

## Rollout Order
1. T1 (query key stability) — unblocks T3, T4, T5, T7.
2. T2 (backend recompute + frontend invalidation).
3. T3 (product edit UI).
4. T4 (sale void UI).
5. T5 (wallet summary).
6. T6 (iOS zoom fix).
7. T7 (performance tuning).

## Risks & Mitigations
- **Risk**: Changing query key shapes may break existing `invalidateQueries` calls.
  - **Mitigation**: Search/replace all `qk.salesSnapshot`, `qk.walletsSnapshot`, etc., usages in `queries.ts` and update `setQueryData`/`invalidateQueries` to use new stable keys.
- **Risk**: Adding `recomputeBatch` on every product update may slow down Sheets writes.
  - **Mitigation**: `recomputeBatch` is a lightweight read+write; acceptable for this app scale.
- **Risk**: iOS `text-base` may break layout density.
  - **Mitigation**: Verify on small screens; if needed, use `text-[16px]` instead of `text-base` for inputs only.
