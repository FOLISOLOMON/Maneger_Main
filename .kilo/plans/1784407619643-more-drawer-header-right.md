# Move "More" to header + right-side drawer (mobile)

## Goal
On phone size (`md:hidden`), move the "More" trigger out of the bottom nav and
into the Header next to the notification bell. Tapping it opens the More panel as
a **right-side drawer** that slides in from the right (instead of the current
bottom sheet). This removes the 5th "More" cell from the bottom nav, giving the
4 main tabs more room.

Desktop (`md+`) is **unchanged**: it keeps the sidebar with NAV_ITEMS + MORE_ITEMS
and has no header "More" button.

## Current state (src/components/layout/AppLayout.tsx)
- Mobile bottom nav: `grid grid-cols-5` = 4 NAV_ITEMS + 1 `<button>` "More"
  (lines 134-164). `moreOpen` state opens the sheet.
- More sheet: `absolute bottom-0 inset-x-0 ... animate-slide-up` (lines 166-192),
  `md:hidden`, grid-cols-3 of icon tiles.
- Header right cluster: only the notification `Bell` `Link` (lines 218-231).
- `Menu` icon already imported; `ICONS` map already has all MORE_ITEMS icons.

## Available animation
- `@keyframes slideIn` exists in `src/index.css:37` (translateX(100%) → 0) but is
  NOT wired to a Tailwind utility. `tailwind.config.js:44-48` only defines
  `slide-up`, `fade-in`, `scale-in`. Need to add a `slide-in` animation util.

## Implementation steps

### 1. Add `slide-in` animation utility (tailwind.config.js)
In `theme.extend.animation`, add:
```js
'slide-in': 'slideIn 0.25s ease-out',
```
This reuses the existing global `@keyframes slideIn` from `src/index.css` (no new
keyframe needed). No change to `keyframes` block required.

### 2. Add "More" button to Header (mobile only)
Inside the Header's right cluster (`<div className="flex items-center gap-1">`,
lines 218-231), add a `md:hidden` `<button>` **before** the notification `Link`:
```tsx
<button
  onClick={() => setMoreOpen(true)}
  aria-label="More"
  className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors touch-target"
>
  <Menu className="w-5 h-5" />
</button>
```
Note: `setMoreOpen` lives in `AppLayout`; `Header` is a nested function component
that already reads `useApp`/`useNotifications`. To keep the change localized and
avoid prop-drilling, either lift the state up or pass `onMore` into `Header`.
Recommended: pass `onMore={() => setMoreOpen(true)}` as a prop to `Header` (mirrors
how FAB state is shared) and call it from the new button.

### 3. Remove the "More" cell from the mobile bottom nav
In the bottom nav (lines 134-164):
- Change `grid grid-cols-5` → `grid grid-cols-4`.
- Delete the trailing `<button onClick={() => setMoreOpen(true)}>…More</button>`
  block (lines 156-162). Bottom nav now shows only the 4 NAV_ITEMS.
- Keep `pb-28` main padding (bottom nav height unchanged at `h-16`; FAB still at
  `bottom-20`).

### 4. Convert the More sheet into a right-side drawer
Replace the bottom-sheet markup (lines 166-192) with a right drawer, still
`md:hidden`, still toggled by `moreOpen` and closed on route change (existing
`useEffect` at line 65) and on backdrop tap:
```tsx
{moreOpen && (
  <div className="md:hidden fixed inset-0 z-50">
    <div
      className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
      onClick={() => setMoreOpen(false)}
    />
    <div className="absolute right-0 inset-y-0 w-[80%] max-w-xs bg-white shadow-xl flex flex-col animate-slide-in">
      <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200">
        <h3 className="font-display font-bold text-slate-900">More</h3>
        <button
          onClick={() => setMoreOpen(false)}
          aria-label="Close"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {MORE_ITEMS.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutDashboard;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 active:bg-slate-100 transition-colors"
            >
              <span className="w-9 h-9 rounded-xl bg-plum-50 text-plum-700 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  </div>
)}
```
(`X` icon already imported.)

## Files touched
- `tailwind.config.js` — add `slide-in` animation.
- `src/components/layout/AppLayout.tsx` — header More button (via `onMore` prop),
  bottom nav `grid-cols-4` + remove More cell, replace bottom sheet with right
  drawer (vertical list).

## Validation
- `npm run dev`, open in mobile viewport (e.g. 375px):
  - Bottom nav shows exactly 4 tabs (Dashboard, Inventory, Sales, Reports), no
    "More" cell; tabs have more horizontal space.
  - Header top-right shows Bell + a More (Menu) button next to it.
  - Tapping More slides a panel in from the **right**; backdrop tap or Close (X)
    or tapping an item dismisses it; items navigate correctly.
  - `X` close button works.
- Resize to desktop (≥768px): no header More button; sidebar still shows
  NAV_ITEMS + MORE_ITEMS; no right drawer.
- `npm run lint` and `npm run typecheck` remain green (lint `src` only → 0 errors).

## Risks / notes
- Keep `moreOpen` state and the route-change `useEffect` (line 65) so the drawer
  auto-closes on navigation.
- Do NOT add `animate-slide-in` keyframe to index.css — reuse the existing
  `@keyframes slideIn`. Only add the Tailwind `animation` mapping.
- `X` and `Menu` are already imported in AppLayout; no new icon imports needed.
