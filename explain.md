# Avencia Manager V2 — Architecture & Functionality Explanation

> **Codename:** Phoenix
> **Type:** Offline-first perfume business management application
> **Primary Stack:** React + TypeScript + Vite + TanStack Query + Google Sheets (Apps Script)

---

## 1. Application Overview

Avencia Manager is a mobile-first Progressive Web App (PWA) designed for perfume retailers to manage their entire business lifecycle on a smartphone. It tracks inventory purchase cycles (batches), individual products, sales, customers, suppliers, expenses, and automatically computes financial KPIs (revenue, profit, ROI, wallet allocations). The app is built around the concept of an **inventory batch** — a single stock purchase cycle — and computes all derived values from it.

The app runs without a traditional backend server. Instead, data persists in Google Sheets via a deployed Google Apps Script Web App (`code.gs`). This makes the stack extremely lightweight and portable: the spreadsheet acts as both database and admin interface.

---

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend framework** | React 18 (React Router DOM) | SPA routing and component rendering |
| **Language** | TypeScript | Type safety across the entire domain model |
| **Build tool** | Vite | Fast dev server, HMR, and optimized production builds |
| **Data fetching** | TanStack Query (React Query) | Server state, caching, deduplication, and optimistic updates |
| **State / UI state** | React Context (`AppContext`) | Theme, currency symbol, onboarding flag, and settings redistribution |
| **Charts** | Recharts | Dashboard and Reports visualizations (area, bar, pie charts) |
| **Date handling** | date-fns | ISO-8601 date parsing, relative timestamps, and date arithmetic |
| **Styling** | Tailwind CSS (via PostCSS) | Mobile-first responsive utility styling |
| **PWA** | VitePWA / Workbox | Offline shell, asset caching, and manifest |
| **Backend** | Google Apps Script (`code.gs`) | CRUD over Google Sheets, business-logic entrypoints, batch snapshots |
| **Icons** | Lucide React | Consistent iconography across the UI |
| **Utilities** | clsx, classnames | Conditional class composition |

---

## 3. Project Structure

```
C:\Users\Solomon\Desktop\Maneger_main
├── index.html                        # PWA entry, meta tags, manifest link
├── vite.config.ts                    # Vite config with manual chunks and PWA plugin
├── Code.gs                           # Google Apps Script backend (deployed as Web App)
├── src/
│   ├── main.tsx                      # React bootstrap — QueryClient + Router + Providers
│   ├── App.tsx                       # Root route config + onboarding gate
│   ├── contexts/
│   │   └── AppContext.tsx            # Settings redistribution, theme class toggle
│   ├── services/
│   │   ├── api.ts                    # Typed API service layer over Google Sheets
│   │   └── calculations.ts           # Central calculation engine (pure functions)
│   ├── hooks/
│   │   └── queries.ts                # React Query hooks, cache keys, mutation optimizers
│   ├── lib/
│   │   └── sheets.ts                 # Google Sheets HTTP client (GET-only to avoid CORS)
│   ├── types/
│   │   └── index.ts                  # Domain model interfaces and joined shapes
│   ├── theme/
│   │   └── designTokens.ts           # Brand palette, semantic colors, chart palettes
│   ├── constants/
│   │   └── index.ts                  # Enums, categories, wallet meta, navigation
│   ├── utils/
│   │   └── format.ts                 # Currency, number, percent, date formatting
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppLayout.tsx         # Desktop sidebar + mobile bottom nav + header + FAB
│   │   ├── charts/
│   │   │   └── ChartCard.tsx         # Reusable chart card wrapper
│   │   └── common/                   # Button, Card, Modal, Form, StatCard, Toast, Pagination
│   └── pages/
│       ├── Onboarding.tsx            # 4-step first-time setup wizard
│       ├── Dashboard/Dashboard.tsx   # KPI cards, sales chart, recent activity, low stock
│       ├── Inventory/InventoryList.tsx, BatchDetail.tsx
│       ├── Sales/Sales.tsx
│       ├── Expenses/Expenses.tsx
│       ├── Wallets/Wallets.tsx
│       ├── Customers/Customers.tsx
│       ├── Suppliers/Suppliers.tsx
│       ├── Reports/Reports.tsx       # 8 report types with charts and tables
│       ├── Settings/Settings.tsx
│       └── Notifications/Notifications.tsx
```

---

## 4. Routing & Navigation

**Files:** `src/App.tsx`, `src/components/layout/AppLayout.tsx`, `src/constants/index.ts`

### 4.1 Route Table

| Path | Page | Bottom Nav | More Menu |
|---|---|---|---|
| `/` | Dashboard | `LayoutDashboard` | — |
| `/inventory` | Inventory List | `Package` | — |
| `/inventory/:id` | Batch Detail | — | — |
| `/sales` | Sales | `ShoppingCart` | — |
| `/reports` | Reports | `BarChart3` | — |
| `/customers` | Customers | — | `Users` |
| `/suppliers` | Suppliers | — | `Truck` |
| `/expenses` | Expenses | — | `Receipt` |
| `/wallets` | Wallets | — | `Wallet` |
| `/notifications` | Notifications | — | `Bell` |
| `/settings` | Settings | — | `Settings` |

### 4.2 Onboarding Gate

The app renders `<Onboarding />` when the `Settings` table has no rows (`isOnboarded === false`). Once settings are created (step 3 of onboarding), the main layout appears with bottom/side navigation.

### 4.3 Context-Aware FAB (Floating Action Button)

Pages register a FAB action via `useFabRegistration()`. A module-level singleton in `AppLayout.tsx` listens for route changes and updates the FAB accordingly:

- **Dashboard:** "Quick Actions" (opens modal)
- **Inventory:** "New Batch"
- **Sales:** "Record Sale"
- **Expenses:** "Add Expense"
- **Wallets:** "Transfer"
- **Customers:** "New Customer"
- **Suppliers:** "Add Supplier"
- **Others:** No FAB (`null`)

---

## 5. Data Model

### 5.1 Entities (Google Sheets)

**Files:** `src/types/index.ts`, `Code.gs` (`SHEET_DEFINITIONS`)

| Sheet | Primary Key Prefix | Description |
|---|---|---|
| `Settings` | `SET-` | Single-row business configuration |
| `Suppliers` | `SUP-` | Vendors from whom inventory is purchased |
| `InventoryBatches` | `BAT-` | A complete stock purchase cycle (e.g. "Dubai Trip May 2026") |
| `Products` | `PRD-` | Individual perfume SKUs within a batch |
| `Customers` | `CUS-` | Buyer profiles |
| `Sales` | `SAL-` | Completed or voided transaction records |
| `Expenses` | `EXP-` | Batch-specific or business operating costs |
| `WalletTransactions` | `WTX-` | Allocation inflows and expense/withdrawal outflows |
| `Notifications` | `NOT-` | System alerts (batch completed, etc.) |
| `ActivityLogs` | `LOG-` | Audit trail of user actions |

### 5.2 Key Interfaces

- **`InventoryBatch`** — aggregate financial fields (`total_batch_cost`, `gross_revenue`, `gross_profit`, `net_profit`, `roi`, `completion_percentage`, `remaining_stock`) are **stored** on the sheet but are **recomputed** by the backend on every write.
- **`SaleWithRelations`** — `Sale` joined with `Product`, `Customer`, and `InventoryBatch`.
- **`ExpenseWithBatch`** — `Expense` joined with `InventoryBatch` (if applicable).
- **`WalletBalance`** — derived balance, income, and outflow per wallet.

### 5.3 ID Generation

**File:** `Code.gs` → `generateBusinessId()`

IDs are generated server-side using `PropertiesService` counters with typed prefixes (e.g. `BAT-000001`, `SAL-000042`). This guarantees uniqueness and readable codes.

---


---
## 6. Backend Architecture (Google Apps Script)

**File:** `Code.gs`

The Apps Script is deployed as a **Web App** (`doGet`/`doPost`) and serves as the JSON API for the frontend.

### 6.1 HTTP API Design

To avoid CORS preflight requests (which Google Apps Script does not support reliably), **all requests are simple GETs** with parameters encoded into a single `params` JSON query string.

```
GET https://script.google.com/macros/s/.../exec?
  action=getDashboardSnapshot&
  params={"salesLimit":50,"expensesLimit":50,"walletTxLimit":100,"notificationsLimit":20}
```

Commands:
- `doGet(e)` -> decodes `params` JSON + flat `action`/`key`
- `doPost(e)` -> parses JSON body or falls back to flat parameters
- `doOptions(e)` -> returns `200 OK` with `{ ok: true }` for preflight safety

Optional `API_KEY` constant can be set to require `?key=` or `x-api-key` header for public web app deployments.

### 6.2 Request-Scoped Read Cache

**File:** `Code.gs` -> `_recordCache`

```javascript
const _recordCache = {};
```

Every `doGet`/`doPost` invocation has its own cache (module-level variable). Reading an entire sheet via `getDataRange().getValues()` is the dominant cost. The `_recordCache` avoids re-reading the same sheet multiple times within a single request (e.g. join helpers call `getRecordById` repeatedly). **Writes clear the affected sheet cache** so subsequent reads in the same request stay fresh.

### 6.3 Generic CRUD

- `list(sheet)` -> returns all non-empty rows mapped by header names
- `get(sheet, id)` -> `find` by `id`
- `create(sheet, payload)` -> `appendRow`, auto-generates `id`, `created_at`, `updated_at`
- `update(sheet, id, payload)` -> `setValues` at row index, updates `updated_at`
- `delete(sheet, id)` -> `deleteRow`
- `getRecordsByBatch(sheetName, batchId)` / `byCustomer` -> server-side filters

### 6.4 Joined Reads

Server-side `join*` helpers return enriched objects so the frontend does not need to do client-side joins for every list view:

- `joinBatch` -> embeds `supplier` (id, name, code)
- `joinProduct` -> embeds `batch` (id, code, name)
- `joinSale` -> embeds `product`, `customer`, `batch`
- `joinExpense` -> embeds `batch`
- `joinWalletTx` -> embeds `batch`

### 6.5 Business Actions (Server-Side)

These are atomic entrypoints that encapsulate multiple CRUD operations and recomputation:

| Action | Trigger | Side Effects |
|---|---|---|
| `recordSale` | User records a sale | Validates stock, decrements product stock, writes sale row, recomputes batch aggregates, logs activity |
| `voidSale` | User voids a sale | Restores product stock, marks sale `Voided`, recomputes batch, logs activity |
| `closeBatch` | User closes a batch | Validates zero remaining stock, recomputes batch, allocates net profit to Needs/Savings/Growth wallets, marks batch `Completed`, creates notification, logs activity |
| `recomputeBatch` | Triggered automatically after create/update/delete/void | Reads all products, completed sales, batch expenses from the sheet, recalculates cost/revenue/profit/ROI/completion/status, writes back to the batch row. If the batch transitions to `Completed` with positive net profit, calls `allocateBatchProfit` |
| `createExpense` | User records an expense | Writes expense row. If `expense_type` == "Batch", recomputes batch and creates a wallet outflow from `Needs`. If `Business`, only creates the wallet outflow |
| `allocateBatchProfit` | Called by `recomputeBatch` (auto-close) or `closeBatch` | Splits `net_profit` into Needs/Savings/Growth wallets using configured percentages (default 40/35/25). **Proof-based single-allocation guard:** checks existing `WalletTransactions` with `transaction_type` == 'Allocation' for this batch ID before creating new rows |
| `createInventoryBatch` / `createBatchAction` / `createProductAction` | User creates entities | Writes rows, links products to batches, recomputes batch after product creation, logs activity |

### 6.6 Batched Snapshots (One Round-Trip Per Page)

To reduce network chatter, several snapshot actions aggregate everything a page needs into a single JSON response:

- `getDashboardSnapshot` — settings, batches, products, sales (limited), expenses (limited), walletTx (limited), notifications (limited)
- `getInventorySnapshot` — batches, products, suppliers
- `getBatchSnapshot` — batch, products, sales (limited), expenses (limited), walletTx (limited)
- `getSalesSnapshot` — sales (limited), products, customers, batches
- `getWalletsSnapshot` — walletTx (limited), settings
- `getNotificationsSnapshot` — notifications (limited)

The `batch` action also allows the client to execute several actions in a single HTTP call.

---
## 7. Frontend Service Layer & Data Fetching

### 7.1 Sheets Client (`src/lib/sheets.ts`)

A thin wrapper around `fetch()` that constructs GET requests. It unwraps the `{ success: true, data: ... }` envelope from the Apps Script, returning only the `data` property. If `success === false`, it throws an error.

```typescript
const url = new URL(apiUrl);
url.searchParams.set('action', action);
url.searchParams.set('params', JSON.stringify({ /* nested payload */ }));
```

**Performance note:** `lucide-react` is excluded from Vite dependency pre-bundling because it is an ESM-only library that Vite handles natively.

### 7.2 React Query (`src/hooks/queries.ts`)

All server state flows through `@tanstack/react-query` hooks.

- **Query Keys (`qk`)** — Centralized constants prevent cache-key drift and make invalidation predictable.
- **Stale Times** — Most queries use a 5-second stale time. Sales, expenses, wallets snapshots use 10-15 seconds. Notifications use a 10-second refetch interval.
- **Optimistic Updates** — Mutations (`useRecordSale`, `useVoidSale`, `useCreateExpense`, etc.) use `setQueryData` to **immediately** update the relevant snapshots in the cache before the server responds. This makes the UI feel instantaneous.
- **Cache Invalidation** — After mutations, related queries are invalidated:
  - `useCreateBatch` invalidates `dashboard`, `inventory`, `batches`
  - `useCloseBatch` invalidates `walletsSnapshot`, `notificationsSnapshot`, plus all batch-related caches
  - `useMarkNotificationRead` uses `onMutate` to **optimistically** flip the `read` flag, with `onError` rollback and `onSettled` refetch
- **Notifications** — `refetchOnWindowFocus: true`, `refetchOnReconnect: true`, `refetchInterval: 10000` ms keep notifications fresh while the page is open.

### 7.3 Manual Chunks (`vite.config.ts`)

The Vite build splits the vendor code into three chunks for better long-term caching:

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-charts': ['recharts'],
  'vendor-query': ['@tanstack/react-query'],
}
```

---

## 8. Calculation Engine

**File:** `src/services/calculations.ts`

Spec rule (4.12): *"Never calculate business values directly in components."* All business math lives in pure functions here.

### 8.1 Batch Cost

```typescript
totalBatchCost(batch) =
  batch.purchase_cost + batch.transport_cost + batch.loading_cost +
  batch.import_duty + batch.insurance + batch.other_costs;
```

All values default to `0` via `Number(x) || 0` to guard against `null`/`undefined` from Sheets.

### 8.2 Sale Math

```typescript
saleTotalSale(unitPrice, quantity, discount, discountType) =
  (unitPrice * quantity) - discountAmount

  where discountAmount =
    discountType === 'Percent' ? (unitPrice * quantity) * (discount / 100)
    : discount

saleProfit(unitPrice, unitCost, quantity, discount, discountType) =
  saleTotalSale(...) - (unitCost * quantity)
```

The **client-side** mirror is used in the Sales modal for live preview. The **server-side** mirror is used inside `recordSaleAction` in `Code.gs` to write `total_sale`, `total_cost`, and `profit` atomically.

### 8.3 Stock & Low-Stock Detection

```typescript
profitMargin(sellingPrice, costPrice) =
  sellingPrice > 0 ? ((sellingPrice - costPrice) / sellingPrice) * 100 : 0

isLowStock(product, globalThreshold) =
  product.current_stock <= (product.reorder_level > 0 ? product.reorder_level : globalThreshold)
  && product.current_stock > 0
```

The `low_stock_threshold` from Settings is the fallback when a product has no `reorder_level` set.

### 8.4 Wallet Math

```typescript
// Iterates all transactions for a wallet. Inflows (Allocation, Adjustment, Transfer-in) add to balance.
// Outflows (Expense, Withdrawal, Transfer-out) subtract from balance.
walletBalances(transactions) = {
  wallets: ['Needs', 'Savings', 'Growth'],
  for each wallet:
    balance = Sum(inflow) - Sum(outflow)
    income = Sum(inflow)
    outflow = Sum(outflow)
}

businessCash(wallets) = Sum(wallet.balance)

// Sum all Allocation rows for a given wallet, optionally filtered by batchId
batchAllocationTotals(transactions, batchId) = {
  for each wallet: amount = Sum(allocation.amount where wallet === x[, batchId === y])
}
```

### 8.5 Batch Health Score

**File:** `src/services/calculations.ts` -> `batchHealth()`

A scoring algorithm that transforms raw financial metrics into a 0-100 health score:

| Factor | Points | Condition |
|---|---|---|
| **ROI** | +30 | ROI >= 50% |
| | +20 | ROI >= 25% |
| | +10 | ROI >= 10% |
| | -20 | ROI < 0% |
| **Completion** | +20 | completion >= 90% && net_profit > 0 |
| | +10 | completion >= 50% |
| **Net Profit** | +15 | net_profit > 0 |
| | -15 | net_profit < 0 |
| **Staleness** | -15 | ageInDays > 90 && status !== `Completed` |
| **Base** | 50 | starting score |

Score is clamped to `[0, 100]`. Thresholds:

| Score | Health |
|---|---|
| >= 80 | Excellent |
| >= 65 | Good |
| >= 45 | Average |
| >= 25 | Poor |
| < 25 | Critical |

### 8.6 Customer Stats (Computed, Not Stored)

**Spec 5.18** — Stats are derived from the `Sales` table at query time:

```typescript
customerStats(customerId, sales) = {
  completedSales: sales.filter(s => s.customer_id === id && s.status === 'Completed'),
  totalSpent: Sum(completedSales.total_sale),
  totalOrders: completedSales.length,
  averageOrder: totalOrders > 0 ? totalSpent / totalOrders : 0,
  favoriteProduct: product_id with highest total quantity sold,
  lastPurchase: most recent sale_date
}
```

### 8.7 Supplier Stats (Computed)

```typescript
supplierStats(batches) = {
  batchCount: batches.length,
  totalPurchaseCost: Sum(batches.total_batch_cost),
  averageProfit: batchCount > 0 ? Sum(batches.net_profit) / batchCount : 0,
  lastBatchDate: most recent purchase_date,
  bestBatchCode: completed batch with highest net_profit,
  bestBatchProfit: corresponding net_profit
}
```

### 8.8 Expense Aggregates

```typescript
expenseTotal(expenses) = Sum(expenses.amount)

expensesByCategory(expenses) = // grouped sum sorted descending by total
```

### 8.9 Dashboard KPIs

```typescript
filterSalesToday(sales) =
  sales where new Date(sale_date).toDateString() === new Date().toDateString()
  && status === 'Completed'

filterExpensesToday(expenses) =
  expenses where new Date(expense_date + 'T00:00:00').toDateString() === today

countLowStock(products, threshold) =
  count where isLowStock(product, threshold)
```

### 8.10 Batch Recompute Logic (Server-Side)

**File:** `Code.gs` -> `recomputeBatch()`

```typescript
totalCost = totalBatchCost(batch)                     // sum of all cost fields

products = getRecordsByBatch('Products', batchId)
sales = getRecordsByBatch('Sales', batchId).filter(s => s.status === 'Completed')

totalInitial = Sum(products.initial_stock)
totalCurrent = Sum(products.current_stock)

grossRevenue = Sum(sales.total_sale)
cogs = Sum(sales.total_cost)
grossProfit = grossRevenue - cogs

batchExpenses = Sum(expenses.filter(e => e.expense_type === 'Batch').amount)
netProfit = grossProfit - batchExpenses

roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0

completion = totalInitial > 0
  ? ((totalInitial - totalCurrent) / totalInitial) * 100
  : 0

// Auto-status transition:
status =
  if totalCurrent === 0 && totalInitial > 0  -> 'Completed'
  else if remaining% <= threshold             -> 'Almost Finished'
  else if grossRevenue > 0                    -> 'Selling'
  else if totalInitial > 0                    -> 'Purchased'
  else                                        -> 'Draft'
```

### 8.11 Wallet Allocation Splitting

**File:** `Code.gs` -> `allocateBatchProfit()`

```
netProfit = batch.net_profit

needs = netProfit * (needs_percentage / 100)
savings = netProfit * (savings_percentage / 100)
growth = netProfit * (growth_percentage / 100)

// Default 40/35/25 when all percentages are unset/0
if (needsPct <= 0 && savingsPct <= 0 && growthPct <= 0) {
  needsPct = 40; savingsPct = 35; growthPct = 25;
}

// Creates 3 WalletTransactions (Needs, Savings, Growth) with type='Allocation'
```

**Guard:** If any `WalletTransaction` already exists with `transaction_type === 'Allocation'` and `batch_id === batchId`, allocation is skipped. This is a "proof-based" guard because `recomputeBatch` writes `status = 'Completed'` to the sheet **before** calling `allocateBatchProfit`, so a status-based guard would incorrectly block allocation on the same request.



---
## 9. Pages & Functionality

### 9.1 Onboarding

**File:** `src/pages/Onboarding.tsx`

A 4-step wizard that runs only when no `Settings` row exists:
1. **Business Info:** Name, owner, phone, address, currency, and wallet split percentages (must total 100%).
2. **Supplier:** Name, phone, location, notes.
3. **First Batch:** Name, purchase date, inventory cost.
4. **Done:** Redirects to `/` after creating Settings -> Supplier -> Batch in sequence.

### 9.2 Dashboard

**File:** `src/pages/Dashboard/Dashboard.tsx`

Loads `getDashboardSnapshot` with limits (sales: 50, expenses: 50, walletTx: 100, notifications: 20).

**KPIs:**
- Today's Sales count & total revenue
- Today's Profit (sum of `profit` from today's completed sales)
- Today's Expenses (sum of `amount` from today's expenses)
- Business Cash (sum of all wallet balances)

**Wallet Cards:** Needs, Savings, Growth — showing compact balances.

**Sales Chart:** Last 7-day area chart built with `buildSalesChart()`:

```
// For each day in the last 7 days:
revenue = Sum(saleTotalSale(s.unit_price, s.quantity, s.discount, s.discount_type))
  for sales where sale_date falls on that day && status === 'Completed'
```

**Active Batches:** Draft, Purchased, Selling, or Almost Finished — shown with completion progress bars.

**Low Stock Alert:** Shown at the bottom when `countLowStock(products, threshold) > 0`.

### 9.3 Inventory

**File:** `src/pages/Inventory/InventoryList.tsx`

Tabs: `active` | `completed` | `archived` | `all`.

Batch cards show:
- Batch name, code, supplier, purchase date
- Revenue, Net Profit, ROI, Stock (`remaining / initial`)
- Completion progress bar

**Create Batch Modal:** Collects supplier, name, dates, and 6 cost categories. `totalBatchCost` is previewed live. On submit, calls `createBatch` which triggers `createBatchAction` on the server.

**File:** `src/pages/Inventory/BatchDetail.tsx`

Tabs: `overview` | `products` | `sales` | `expenses`.

Header shows Revenue, Net Profit, ROI, Stock, and a Health score (computed client-side via `batchHealth()`).

**Batch actions:**
- **Add Product** (modal) -> name, brand, category, cost price, selling price, initial stock, reorder level, description. On create, server triggers `recomputeBatch`.
- **Edit Product** -> updates stock/prices, server triggers `recomputeBatch`.
- **Void Sale** -> calls `voidSale` action.
- **Close Batch** -> requires zero remaining stock, then calls `closeBatch` which allocates profit and marks `Completed`.

### 9.4 Sales

**File:** `src/pages/Sales/Sales.tsx`

Uses `useSalesSnapshot(9999)` to fetch all sales, products, batches, and customers in one snapshot.

Live preview in the Record Sale modal:
```
totalSale = saleTotalSale(unitPrice, quantity, discount, discountType)
profit    = saleProfit(unitPrice, product.cost_price, quantity, discount, discountType)
```

Validation:
- Select active batch -> only products with `current_stock > 0` are listed.
- Quantity must be `> 0` and `<= selectedProduct.current_stock`.
- `unitPrice` must be `> 0`.

**Void Sale:** Confirmation dialog -> calls `voidSale` -> stock restored, batch recomputed.

### 9.5 Expenses

**File:** `src/pages/Expenses/Expenses.tsx`

Two types:
- **Batch** -> linked to a specific batch, affects that batch's net profit and triggers a wallet outflow from `Needs`.
- **Business** -> operating expense (rent, WiFi, etc.), only affects the `Needs` wallet.

Summary stat shows total for the active tab. A pie chart visualizes spending by category.

### 9.6 Wallets

**File:** `src/pages/Wallets/Wallets.tsx`

Three virtual wallets: **Needs**, **Savings**, **Growth**.

Balances are **derived** from `WalletTransactions` — there is no stored balance row. The app iterates the transaction list to compute `balance`, `income`, and `outflow`.

**Allocation Summary:** Shows how much each wallet received from batch completions (filterable by batch).

**Actions:**
- **Withdrawal:** Creates a `WalletTransaction` with type `Withdrawal`. Amount must be `<= balance`.
- **Transfer:** Creates two transactions -> a `Transfer` outflow from the source wallet and a `Transfer` inflow to the target wallet.

### 9.7 Customers

**File:** `src/pages/Customers/Customers.tsx`

List cards show computed `customerStats`: lifetime spent, order count, and average order.

Detail modal:
- Total spent, total orders, average order
- Favorite product (highest quantity purchased)
- Last purchase date
- Recent purchase history (last 10 completed sales)

### 9.8 Suppliers

**File:** `src/pages/Suppliers/Suppliers.tsx`

List cards show computed `supplierStats`: batch count, total purchases, average profit, last batch date, and best batch profit.

Detail modal:
- Contact info
- Batch history linked to the supplier (last 8 batches)

### 9.9 Reports

**File:** `src/pages/Reports/Reports.tsx`

8 report types with a period selector (`today` | `7 days` | `30 days` | `1 year`):

| Report | Included Data | Key Metrics / Charts |
|---|---|---|
| **Business** | batches, sales, expenses | Total revenue, profit, expenses, active batch count; 14-day revenue trend area chart |
| **Financial** | sales, expenses, walletTx | Gross revenue, COGS, gross profit, net batch profit, business expenses; cash flow breakdown |
| **Batch** | batches | Total batches, completed count, average ROI, total profit; bar chart of top 8 batches by net profit |
| **Product** | products, sales | In-stock count, sold quantity, period revenue; ranked top-10 product performance table |
| **Supplier** | suppliers, batches | Suppler count, total purchases, total profit; ranked supplier performance table |
| **Customer** | customers, sales | Customer count, active buyers, average order, revenue; ranked top-10 customer table |
| **Expense** | expenses | Total expenses, batch vs business split, category count; pie chart of top 6 categories |
| **Wallet** | walletTx | Per-wallet balance, total income, total outflow; flow breakdown |

### 9.10 Settings

**File:** `src/pages/Settings/Settings.tsx`

Edits the single `Settings` row:
- Business name, owner name, phone, email, address
- Theme (light / dark) -> toggles the `.dark` class on `documentElement`
- Currency -> one of GHS, USD, NGN, KES, ZAR, GBP, EUR
- Wallet percentages (Needs / Savings / Growth) -> **must total exactly 100%**, enforced client-side before save
- Low stock threshold -> default 5
- Batch completion threshold -> default 10 (percent)

### 9.11 Notifications

**File:** `src/pages/Notifications/Notifications.tsx`

Notifications are created server-side by:
- `recomputeBatch` when a batch auto-completes (`batch_completed` type)
- `closeBatchAction` when a batch is manually closed (`batch_completed` type)

Grouped by:
- **Today** (diffDays === 0)
- **Yesterday** (diffDays === 1)
- **Earlier** (diffDays > 1)

Priority badges: High, Medium, Low. Unread count is shown in the header bell icon (capped at `9+`). Supports mark-as-read (single and bulk).



---
## 10. Performance Considerations

### 10.1 Backend Optimizations

- **Request-scoped read cache** (`_recordCache` in `Code.gs`): Sheets API calls are expensive. Caching whole-sheet reads per request eliminates redundant I/O inside a single `doGet`/`doPost`.
- **Sheet initialization guard:** Headers are only written if the first row is empty, preventing overwrites on repeated invocations.
- **GET-only requests:** Avoiding POST bodies and CORS preflight reduces round-trip latency and simplifies the Apps Script deploy permissions.

### 10.2 Frontend Optimizations

- **TanStack Query stale times:** Writes and recomputes happen frequently, so stale times are kept short (5-15s) to ensure UI consistency.
- **Optimistic cache updates:** `onSuccess` callbacks in mutations use `setQueryData` to instantly reflect changes in all relevant snapshots (dashboard, inventory, sales, batch detail) without waiting for a refetch.
- **Manual Vite chunks:** `vendor-react`, `vendor-charts`, and `vendor-query` are split so they are cached independently of app code.
- **`lucide-react` ESM exclusion:** Prevents Vite from trying to pre-bundle an already-ESM-only library.
- **PWA Workbox precaching:** Assets listed in `globPatterns` are precached, enabling instant loading and true offline operation.
- **Responsive charts:** `ResponsiveContainer` from Recharts redraws only when its container dimensions change, not on every render.
- **Pagination:** List pages paginate at 20 items (`PAGE_SIZE = 20`) to keep DOM node counts manageable.

---
## 11. Authentication & Security

- The Apps Script Web App can be deployed with `Execute as: Me` and `Who has access: Anyone` (public URL).
- An optional shared `API_KEY` constant in `Code.gs` can restrict access. The frontend sends it via `?key=` or an `x-api-key` header.
- No user authentication exists in the frontend currently. Settings act as the single-tenant configuration row.
- CORS is handled by using simple GET requests (which Apps Script returns `Access-Control-Allow-Origin` for) and an explicit `doOptions` handler.

---
## 12. PWA & Offline Behavior

**Files:** `vite.config.ts`, `index.html`

- **Manifest:** `manifest.webmanifest` defines standalone display, theme color, and app icons (192x192, 512x512, maskable).
- **Service Worker:** Workbox caches all `js`, `css`, `html`, `svg`, `woff2` assets. In dev mode, a valid manifest and SW are served so the browser does not intercept `/manifest.webmanifest` with `index.html`.
- **Apple meta tags:** `apple-mobile-web-app-capable`, status bar style, and touch icon are configured.

---
## 13. Theming

**Files:** `src/theme/designTokens.ts`, `src/contexts/AppContext.tsx`

- `settings.theme` is either `'light'` or `'dark'`.
- `AppProvider` toggles the `.dark` class on `document.documentElement`.
- All color classes in Tailwind map to CSS variables (e.g. `bg-surface`, `text-primary`, `border-border`, `bg-accent`).
- Charts read from `chartColors(theme)` which returns a mapped palette for Recharts props (accent, success, warning, danger, info, neutral, grid, axis).

---
## 14. Key Business Rules & Invariants

1. A sale **cannot** be recorded against a batch with status `Completed` or `Archived`.
2. Stock is **atomically decremented** server-side during `recordSale` and restored on `voidSale`.
3. `net_profit = gross_profit - batch_expenses` where batch expenses are only those with `expense_type === 'Batch'`.
4. A batch is **auto-closed** (status -> `Completed`) when `remaining_stock === 0` and `initial_stock > 0`.
5. Wallet profit allocation runs **exactly once** per batch, guarded by checking for existing `Allocation` transactions for that batch.
6. Wallet percentages **must total 100%** before settings can be saved (enforced client-side in Settings and Onboarding).
7. Closing a batch requires **zero remaining stock** (validated server-side).
8. Expense categories differ by type: `Batch` uses logistics/import categories; `Business` uses operating categories.
9. All currency amounts default to `0` defensively (`Number(x) || 0`) to survive missing/null spreadsheet values.

---
## 15. Build & Deployment

### Frontend
```
npm install
npm run dev      # Vite dev server with PWA plugin
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

Environment variables (`.env`):
- `VITE_SHEETS_API_URL` — the deployed Google Apps Script Web App URL
- `VITE_SHEETS_API_KEY` — optional shared secret

### Backend (`Code.gs`)
1. Open the Google Sheet -> Extensions -> Apps Script.
2. Paste the contents of `Code.gs`.
3. Run `initializeVelouraSheets` from the Apps Script editor to create all tabs with headers.
4. Deploy -> New deployment -> Web app:
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Copy the Web App URL into `VITE_SHEETS_API_URL`.

The spreadsheet itself serves as an admin interface; you can inspect, edit, or archive any record directly in Google Sheets.

---

*Last updated: 2026-07-22*
