# Payments UX Improvements Plan

## Context
The payments/balances feature is functional but has UX gaps that make installment tracking and payment history hard to use. This plan fixes 8 targeted improvements.

## Current State
- `Sales` shows `pending`/`partial`/`paid` badge + tiny balance text
- `Pay` button opens `RecordPaymentModal` with linked-sale dropdown
- Payment method dropdown explicitly filters out `Credit`
- No payment history visible anywhere in the UI
- Customer detail modal shows "Recent purchases" but not payments
- Dashboard has `Outstanding Receivables` KPI but no aging/actionable list

## Task 1: Restore `Credit` as first-class payment method
**Files:** `src/pages/Sales/Sales.tsx`, `src/pages/Customers/Customers.tsx`
- Remove `.filter((m) => m !== 'Credit')` from both `RecordPaymentModal` and `RecordPaymentModalFromCustomer`
- `Credit` should appear as a selectable payment method in both modals
- No backend change needed — `recordPaymentAction` already accepts any `payment_method` string

## Task 2: Payment history inside `RecordPaymentModal` (Sales page)
**Files:** `src/pages/Sales/Sales.tsx`
- `RecordPaymentModal` receives `payments` prop (filtered from `snapshot.payments` by `sale_id`)
- Add a small list above the form fields:
  ```
  Payments for this sale
  ─────────────────────
  Jun 15   Cash   100.00
  Jun 20   Mobile  50.00
  ─────────────────────
  Balance: 200.00
  ```
- Show date (relative), method badge, and amount for each payment
- If no payments yet, show "No payments yet"

## Task 3: Payment history inside customer detail modal
**Files:** `src/pages/Customers/Customers.tsx`
- Customer detail modal already has "Recent purchases" section
- Add "Recent payments" section below it
- Filter `payments` by `customer_id === detailCustomer.id`
- Show: date, linked sale code, method badge, amount
- If none, show "No payments recorded"

## Task 4: Make balance more visible on sales cards
**Files:** `src/pages/Sales/Sales.tsx`
- When `payment_status === 'partial'`, change the balance from tiny text to a dedicated badge:
  - Color: `bg-warning-bg text-warning`
  - Content: `Partial — Bal: 200.00`
- When `payment_status === 'pending'`, keep current text style but bold it
- When `payment_status === 'paid'`, show a solid green `Paid` badge and remove `Pay`/`Void` buttons per Task 7

## Task 5: Quick-pay from customer cards
**Files:** `src/pages/Customers/Customers.tsx`
- On customer card (grid item), when `balance > 0.01`, show a small `Collect` button
- On click: `setDetailId(c.id)` then `setPayId(c.id)` (same flow as detail modal)
- This reduces the 4-step flow to 1 click

## Task 6: Dashboard aging / actionable receivables
**Files:** `src/pages/Dashboard/Dashboard.tsx`, `src/services/calculations.ts`
- Add new KPI section below "Outstanding Receivables" card titled "Aging receivables"
- Show max 5 items from `sales` where `payment_status !== 'paid' && status === 'Completed'`
- Columns: Customer, Sale code, Balance, Days since sale
- Sort by balance descending
- Use `formatMoney`, `formatRelative`, and customer name from joined relations

## Task 7: Auto-clear Pay button when fully paid
**Files:** `src/pages/Sales/Sales.tsx`
- In sales card map, wrap `Pay` and `Void` buttons in `s.payment_status !== 'paid'` guard
- When paid, show green `Paid` badge and hide both buttons
- Already partially done, just ensure consistency

## Task 8: Receipt confirmation after payment
**Files:** `src/pages/Sales/Sales.tsx`, `src/pages/Customers/Customers.tsx`
- After successful payment toast, show a brief inline confirmation in the modal before closing:
  ```
  ✓ Payment of 150.00 recorded
  New balance: 50.00
  Method: Cash
  ```
- Auto-close after 2 seconds (or add a "Close" button)
- Implementation: add `showConfirmation` state in both modals, set on success, render confirmation block, `setTimeout` to close

## Data Flow Notes
- `useCreatePayment` already invalidates `salesSnapshot`, `dashboard`, `customers` — no change needed
- `fetchPayments` is already available in `usePayments` hook
- Payment modal on Sales page needs access to `snapshot.payments` — currently only `sales` is passed; add `payments` prop
- Payment modal on Customers page already receives `customers` prop but doesn't need it per Task 1 — remove unused prop

## Backend
No backend changes required. `recordPaymentAction`, `Payments` sheet, and `joinPayments` already support all scenarios.

## Validation
- Build passes (`npm run build`)
- Lint passes (`npx eslint`) on modified files
- TypeScript passes (`npx tsc --noEmit`)
- Manual: record sale with Credit → see Pay button → enter partial payment → see history → pay again until paid → confirm history reflects all payments
- Manual: customer detail shows payment history and balance
- Dashboard shows aging receivables

## Out of Scope
- Changing `recordSaleAction` to auto-mark certain methods as `paid` (user request, separate decision)
- Refund flow from detail modal
- Print/email receipt