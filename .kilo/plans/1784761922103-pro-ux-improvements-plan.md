# Pro-Level UX Improvements Plan

## Context
The app is functional but still has "CRUD form app" feel. These 6 tasks raise perceived polish without changing backend behavior. No scope creep; each is small, bounded, and independently testable. Excluded: "What’s New" version notification.

## Task 1: Undo toast for destructive actions
**Files:** `src/components/common/Toast.tsx`, `src/pages/Sales/Sales.tsx`

Extend the existing toast API so destructive mutations can offer an undo action for 6 seconds.

Toast API change:
```ts
type ToastOptions = { duration?: number; action?: { label: string; onUndo: () => void } };
toast(message, type, options?)
```

Render action as a button inside the toast item. On click, call `onUndo`, then auto-remove after `duration` if not undone.

First use case: voiding a sale in `Sales.tsx`. After `voidSale.mutateAsync`, show:
```
Sale voided and stock restored [Undo]
```
If user clicks Undo, call a compensating `revertVoid` flow (same as current void RPC if reversible, else show info toast saying action can’t be undone).

**Validation:** Click void → toast appears with Undo → click Undo within 6s → sale returns to Completed. Wait 6s without clicking → toast disappears and void stays.

---

## Task 2: Faster sale recording (recent customers + auto-focus)
**Files:** `src/pages/Sales/Sales.tsx`

- Add a "Recent" chip row above the customer `<Select>`: show last 5 customers by `updated_at` or sales count, clickable to set `customerId` instantly.
- After product selection (`onProductChange`), auto-focus the quantity field via a ref.
- After quantity change, auto-focus unit price so keyboard users can tab through fewer fields.

Implementation: add a `const recentCustomers = useMemo(...)` derived from `customers`. Render chips when `customerId` is empty. Use `useRef<HTMLInputElement>` for the quantity and unit price inputs, calling `.focus()` in `useEffect` when the prior field changes.

**Validation:** Open Record Sale → click a recent customer chip → customer field populates → pick product → quantity field auto-focuses → type qty → tab to price → record.

---

## Task 3: Keyboard shortcuts
**Files:** `src/hooks/useKeyboardShortcuts.ts` (new), `src/components/layout/AppLayout.tsx`

Create a small reusable hook:
```ts
function useKeyboardShortcuts(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (shortcuts[key]) { e.preventDefault(); shortcuts[key](); }
      else if (mod && shortcuts[`${key}+mod`]) { e.preventDefault(); shortcuts[`${key}+mod`](); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcuts]);
}
```

Register at `AppLayout` level (or page level) so shortcuts are active globally:
- `/` → focus active search bar (add a `data-search` attribute to search inputs, then `document.querySelector('[data-search] input')?.focus()`)
- `n` → open New Sale FAB (already exposed via `useFabRegistration`; call the same `onClick`)
- `Escape` → close topmost modal (hook into existing Modal `onClose` behavior)

**Validation:** On Sales page, press `/` → search focused. Press `n` → Record Sale modal opens. Press `Esc` → modal closes.

---

## Task 4: Context-aware empty states with contextual CTAs
**Files:** `src/components/common/Card.tsx` (`EmptyState`)

Update `EmptyState` to accept an optional `hint` string and a secondary `secondaryAction`. This lets callers give one-line guidance without bloating every call site.

Then update high-traffic empty states:
- `Sales.tsx` (No sales yet): hint: "Record your first sale to see it here." action: existing Record Sale button.
- `Customers.tsx` (No customers yet): hint: "Customers let you track balances and payment history. Add your first customer to get started."
- `Dashboard.tsx` (Recent Sales / Recent Expenses empty): keep compact; add subtle hint "Sales will appear here once you start selling."
- `Reports.tsx`: hint differs by active tab (e.g., "Select a date range to generate a sales report.")

**Validation:** Navigate to empty pages → confirm richer description text appears. Ensure compact cards in Dashboard don’t overflow.

---

## Task 5: Inline validation + number formatting
**Files:** `src/components/common/Form.tsx` (`Input`), `src/components/common/Toast.tsx`

Instead of Toasts for simple validation, upgrade `Input` to support `validate` callback that renders inline helper text.

Example call site in `RecordPaymentModal`:
```tsx
<Input
  type="number"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  prefix={currencySymbol}
  validate={amount && Number(amount) > remainingBalance ? 'Exceeds remaining balance' : undefined}
  hint={sale ? `${formatMoney(remainingBalance, currencySymbol)} remaining` : undefined}
/>
```

Validation rules to add inline (replace existing toasts where applicable):
- Amount > balance → red helper text under the input.
- Quantity > stock → inline hint ("Only X in stock" already exists in `RecordSaleModal`; keep it there inline).
- Sale recording: empty required field → red border + helper text rather than toast.

**Validation:** Try entering amount larger than balance → see red inline message, no toast. Try blank required field on blur → inline error appears.

---

## Task 6: Persistent search + recent queries
**Files:** `src/components/common/SearchBar.tsx`, `src/hooks/useSearchState.ts` (new)

Create a `useSearchState` hook that:
- Reads/writes `recentQueries` array from `localStorage` under a namespaced key (`app_search_recent`).
- Exposes `query`, `setQuery`, `recent`, `clearRecent`.
- Limits history to 10 items.

Update `SearchBar` to accept an optional `recent` array. When input is focused and query is empty, show a dropdown of recent queries above the input. Clicking a recent item sets it as the current query.

Apply to pages with `SearchBar`: `Sales.tsx`, `Customers.tsx`, `Notifications.tsx`. Keep other pages untouched.

**Validation:** Type a search query → refresh page → query persists. Click search input → see recent queries dropdown. Clear recent from localStorage → dropdown disappears.

---

## General principles
- No new dependencies.
- All new utilities go in `src/hooks/` or `src/components/common/`.
- Reuse existing tokens (`bg-danger`, `text-text-muted`, etc.).
- Touch minimal files per task.

## Validation gate
- `npm run build` passes.
- `npx eslint src` clean.
- `npx tsc --noEmit -p tsconfig.app.json` clean.
- Manual smoke test on each page where changes land.

## Out of scope
- What’s New / version notification.
- Undo for actions that are not easily reversible.
- Advanced search filters (date range, multi-field).
- Dark mode refinements.
