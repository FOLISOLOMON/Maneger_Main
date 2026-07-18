# Fix: More-menu tabs all show the same icon

## Root cause
In `src/components/layout/AppLayout.tsx` the `ICONS` lookup map (lines 18-21)
only contains: `LayoutDashboard, Package, ShoppingCart, BarChart3, Menu, X, Bell, Plus`.

`MORE_ITEMS` in `src/constants/index.ts` (lines 184-191) references icon names
`Users`, `Truck`, `Receipt`, `Wallet`, `Settings` (plus `Bell`). Five of those
names are **missing** from `ICONS`, so the fallback `?? LayoutDashboard` paints
every More tile (and the desktop sidebar "More" section) with the Dashboard icon.
That is why "they are all the same."

The assigned icon names are already semantically correct, so no re-selection is
needed — they just need to be imported and registered in the map.

## Decision
Wire the missing icons only. Keep the current uniform purple tile style
(`bg-plum-50 text-plum-700`). No per-tile accent colors.

## Implementation
Edit `src/components/layout/AppLayout.tsx`:

1. Extend the lucide-react import (line 9-12) to include:
   `Users, Truck, Receipt, Wallet, Settings` (Verified exported by lucide-react).
   Keep existing imports (`LayoutDashboard, Package, ShoppingCart, BarChart3,
   Menu, X, Bell, Plus`).

2. Add those 5 names to the `ICONS` map so the lookup resolves correctly:
   ```ts
   const ICONS: Record<string, LucideIcon> = {
     LayoutDashboard, Package, ShoppingCart, BarChart3, Menu, X,
     Bell, Plus, Users, Truck, Receipt, Wallet, Settings,
   };
   ```

That is the only file change required. `SidebarLink`, the mobile bottom-nav
"More" button, and the More sheet all read `ICONS[item.icon]` and will now pick
the correct icon per item.

## Resulting icon mapping (no change to labels/routes)
- /customers      → Users
- /suppliers      → Truck
- /expenses       → Receipt
- /wallets        → Wallet
- /notifications  → Bell   (already worked)
- /settings       → Settings

## Files touched
- `src/components/layout/AppLayout.tsx` (import + ICONS map only)

## Validation
- `npm run dev`, open mobile viewport (or DevTools device mode), tap bottom-nav
  "More" → each of the 6 tiles now shows a distinct icon (Users, Truck, Receipt,
  Wallet, Bell, Settings), not the dashboard icon.
- Desktop: sidebar "More" section shows the same distinct icons.
- `npm run lint` and `npm run typecheck` remain green.
