# Remove Unused / Dead Code

Goal: delete exports, imports, types, and comments that have no effect, then verify the app still type-checks and components compile.

## Files to modify

### 1. `src/pages/Notifications/Notifications.tsx`
- **Line 5**: remove unused `useEffect` from the React import.

### 2. `src/types/index.ts`
- **Lines 222–224**: remove unused `ProductWithBatch` interface.
- **Lines 243–253**: remove unused `DashboardKPIs` interface.

### 3. `src/services/calculations.ts`
Remove the following unused exported functions:
- `stockValue` (lines 60–62)
- `remainingStockValue` (lines 64–66)
- `batchGrossProfit` (lines 35–37)
- `batchNetProfit` (lines 39–41)
- `roi` (lines 43–46)
- `completionPercentage` (lines 48–51)
- `isOutOfStock` (lines 73–75)
- `reinvestmentCapacity` (lines 320–329)
- `customerLifetimeValue` (lines 350–352)
- `walletAllocation` (lines 115–124)
- `walletBalancesByBatch` (lines 130–162)

### 4. `src/services/api.ts`
Remove the following unused exported functions:
- `fetchBatch` (lines 95–97)
- `fetchBatchesBySupplier` (lines 99–102)
- `fetchSupplier` (lines 60–62)
- `updateSupplier` (lines 81–83)
- `archiveSupplier` (lines 85–87)
- `fetchCustomer` (lines 271–273)
- `updateCustomer` (lines 292–294)
- `fetchSalesByBatch` (lines 201–204)
- `fetchSalesByCustomer` (lines 206–208)
- `fetchProductsByBatch` (lines 137–139)
- `fetchExpensesByBatch` (lines 219–222)
- `fetchWalletTransactionsByWallet` (lines 245–248)
- `archiveBatch` (lines 127–129)
- `fetchNotifications` (lines 298–303)
- `fetchActivityLogs` (lines 325–328)
- `sheetsBatch` (lines 423–425)
- `sheetsDelete` (lines 63–65)

Also remove the now-unused type-only imports at the top if any become dangling after the above deletions (e.g. `ActivityLog`, `Notification`, `Customer`, `Supplier`, `WalletName` if no longer referenced).

### 5. `src/hooks/queries.ts`
Remove the following unused exported hooks (and their internal `api.*` references):
- `useSupplier` (lines 75–81)
- `useUpdateSupplier` (lines 91–99)
- `useBatch` (lines 107–113)
- `useBatchesBySupplier` (lines 115–121)
- `useBatchProducts` (lines 207–213)
- `useUpdateBatch` (lines 143–167)
- `useBatchSales` (lines 286–292)
- `useCustomerSales` (lines 294–300)
- `useBatchExpenses` (lines 452–458)
- `useCustomer` (lines 530–536)
- `useUpdateCustomer` (lines 551–559)
- `useNotifications` (lines 563–571)
- `useActivityLogs` (lines 651–657)

### 6. `src/pages/Inventory/InventoryList.tsx`
- **Line 25**: remove stale comment `// (BatchStatus type removed — not used in this file)`.

## Validation

1. Run `npx tsc --noEmit` to confirm no missing imports or type errors.
2. Run `npm run build` (or `vite build`) to confirm the app bundles without errors.
3. Spot-check that all pages still render by starting the dev server and navigating to each route.

## Risks / Notes

- `sheetsDelete` and the per-entity `fetch*ById` helpers are removed even though they are generic CRUD wrappers, because nothing in the UI calls them.
- `useNotifications` / `useActivityLogs` are removed; the app uses the `*Snapshot` variants instead.
- If future features need any of the removed helpers, they can be restored from git history.
