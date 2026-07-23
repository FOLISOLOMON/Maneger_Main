import os
path = r'explain.md'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

insert_after = None
for i, line in enumerate(lines):
    if '```' in line and i > 180 and i < 220:
        # Find the closing ``` after manualChunks block
        pass
    if '## 8. Calculation Engine' in line:
        insert_after = i
        break

missing = """
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
"""

if insert_after is not None:
    lines.insert(insert_after, missing)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)