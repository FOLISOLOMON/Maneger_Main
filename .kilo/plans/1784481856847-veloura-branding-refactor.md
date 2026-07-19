# Veloura Manager — Branding & Design System Refactor

## Goal
Replace the current "plum + gold" UI with the new **Veloura Manager** luxury brand
(matte black `#111111`, metallic gold `#C9A227`, ivory `#F8F6F2`, white, charcoal
`#3D3D3D`). Centralize all colors in a design-token module, wire the new logo
assets everywhere, implement **light + dark** modes, and keep 100% of existing
functionality, APIs, business logic, and database untouched.

This is a **UI/branding-only** refactor (per client: no new features until done).

---

## Brand palette (source of truth)

| Token            | Light      | Dark       | Use |
|------------------|-----------|-----------|-----|
| `primary`        | `#111111`  | `#FFFFFF`  | Primary action, headings (dark text on light, white on dark) — the brand "black" |
| `primaryLight`   | (lighter)  | `#E5E5E5`  | Hover/active of primary |
| `primaryDark`    | `#000000`  | `#D4D4D4`  | Pressed state of primary |
| `accent` (gold)  | `#C9A227`  | `#D9B441`  | Accent borders, highlights, active nav, gold logo |
| `accentLight`    | `#E6CE86`  | `#E6CE86`  | Soft gold tint (badges, chips) |
| `accentMuted`    | `#8A6D1B`  | `#B5912F`  | Gold text on ivory for AA contrast |
| `background`      | `#F8F6F2`  | `#0E0E0E`  | App background (ivory / near-black) |
| `surface`        | `#FFFFFF`  | `#1A1A1A`  | Cards, header, sidebar |
| `surfaceAlt`     | `#F1EEE8`  | `#141414`  | Subtle raised/inset panels |
| `card`           | `#FFFFFF`  | `#1A1A1A`  | Card base |
| `textPrimary`    | `#111111`  | `#F5F5F5`  | Headings/body |
| `textSecondary`  | `#3D3D3D`  | `#A1A1A1`  | Secondary text (charcoal) |
| `textMuted`      | `#6B6B6B`  | `#777777`  | Tertiary/hints |
| `border`         | `#E7E2D8`  | `#2A2A2A`  | Borders/dividers |
| `borderStrong`   | `#D8D2C6`  | `#3A3A3A`  | Hover borders |

### Muted semantic palette (per client decision: "muted semantic")
Low-saturation, luxe-compatible, AA contrast on light & dark:

| Token            | Light      | Dark       | Semantic |
|------------------|-----------|-----------|----------|
| `success`        | `#2F6B4F`  | `#4FA37A`  | positive / profit / completed |
| `successBg`      | `#EAF3EE`  | `#16241D`  |
| `warning`        | `#9A6A12`  | `#D9A742`  | low stock / attention |
| `warningBg`      | `#F6EEDD`  | `#26200F`  |
| `danger`         | `#A1322B`  | `#E07A70`  | negative / error |
| `dangerBg`       | `#F7E9E7`  | `#2A1715`  |
| `info`           | `#3D6B8A`  | `#6FA3C7`  | neutral info |
| `infoBg`         | `#EAF1F6`  | `#13212B`  |

Chart palette: gold `#C9A227`, success `#2F6B4F`, warning `#9A6A12`,
danger `#A1322B`, info `#3D6B8A`, muted `#8A8478` (replaces `CHART_COLORS`).

---

## Deliverables / Tasks

### 1. Design tokens — `src/theme/designTokens.ts` (NEW)
Create the single source of truth. Export:
- `colors` object (brand + semantic, light/dark maps).
- `useThemeColors()` hook OR a `tokens` resolver that returns the right map based on
  current `theme` (`light`/`dark`) from `useApp()`. Components that need raw values
  (charts, inline styles) import this.
- `shadows`, `radii`, `spacing`, `typography`, `iconSize` constants for consistent
  spacing/radius/shadow/icon sizing across the app.
- `CHART_COLORS` (light + dark) moved here from `ChartCard.tsx`.
- **No hex values hardcoded anywhere else.** Tailwind utility classes that map to
  tokens are acceptable (see task 2), but status/badge/chart colors go through tokens.

### 2. Tailwind config — `tailwind.config.js`
- Replace `plum`/`gold` scales with semantic theme color keys bound to CSS variables
  so dark mode "just works": e.g. `primary`, `accent`, `bg`, `surface`, `card`,
  `text-primary`, `text-secondary`, `border`, `border-strong`, `success`, `warning`,
  `danger`, `info` + their `-bg`/`-light`/`-dark` variants — each using
  `rgb(var(--...))` referencing values set in `index.css` per `.dark`.
- Keep `fontFamily` (Inter + Plus Jakarta Sans) and existing `boxShadow`/`animation`.
- Add `shadow-card`, `shadow-card-hover`, `shadow-fab` (soft, low-opacity = premium).
- This lets components keep Tailwind classes (`bg-surface`, `text-primary`,
  `border-border`, `bg-accent`, `text-accent`) instead of `slate-*`/`plum-*`.

### 3. CSS variables & base — `src/index.css`
- Define `:root` (light) and `.dark` CSS vars from the palette.
- Update `body` base: `bg-background text-text-primary`.
- Update `.dark body` accordingly.
- Keep `touch-target`, `scrollbar-hide`, `slideIn` keyframes.
- Add a `.glass` utility (glassmorphism: `bg-surface/70 backdrop-blur-xl`) for header
  and overlays where appropriate.

### 4. Logo assets — `public/`
- New logos already present (client confirmed `Avencia*` = the new Veloura logos):
  `Avencia black logo.png`, `Avencia gold logo.png`, `Avencia white logo.png`
  (wordmarks) + matching `- icon logo.png` (icon-only). All 2048² PNG.
- Rename/re-derive canonical usage:
  - `logo-gold.png`, `logo-black.png`, `logo-white.png` (wordmarks)
  - `icon-gold.png`, `icon-black.png`, `icon-white.png`
  (clean names; keep `Avencia*` originals or replace — pick canonical names and
  reference those consistently).
- **Favicon**: add `public/favicon.svg` (gold-on-black or black-on-gold icon mark)
  and reference in `index.html` (`<link rel="icon" type="image/svg+xml" href="/favicon.svg">`).
- **PWA icons** (old `pwa-*` are the OLD logos — replace): generate
  `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512x512.png` from the new
  black/gold icon art (e.g. gold icon on `#111111` background). Keep 512 PNG + 192 PNG
  + maskable 512. (Generating exact PNGs requires an image tool — do it via a small
  script/online step; flag if manual asset generation is needed.)
- Update `vite.config.ts` PWA `manifest` `theme_color` → `#111111`,
  `background_color` → `#F8F6F2`, keep `name`/`short_name`, point icons at new files.
- Update `index.html`: `theme-color` → `#111111`, title stays, og images optional.

### 5. Reusable components (`src/components/**`)
Refactor to tokens; do NOT rename components.
- **Button.tsx**: map `primary`→`bg-primary`, `secondary`→neutral surface, `danger`→
  `danger`, `gold`→`accent`. Focus ring → `ring-accent`.
- **Card.tsx**: `bg-card border-border shadow-card`. `Badge` default → neutral token;
  `ProgressBar` bar → `bg-accent`. `EmptyState`/`LoadingState`/`ErrorState`/`Skeleton`
  use neutral tokens; error icon uses `danger`.
- **StatCard.tsx**: defaults `accent`→`text-accent`, `iconBg`→`bg-accent/10`;
  trend up/down → `success`/`danger`. `SearchBar` focus → `border-accent ring-accent/20`.
  `ConfirmDialog` confirm → primary/danger, backdrop uses token overlay.
- **Modal.tsx**: surface + border tokens; backdrop overlay token.
- **Form.tsx**: inputs `bg-surface border-border`, focus `border-accent ring-accent/20`;
  error states → `danger`; select chevron fill use neutral var.
- **Toast.tsx**: success→`success`, error→`danger`, info→`info` (solid, on white text).
- **AppLayout.tsx**: sidebar surface/border; active nav `bg-accent/10 text-accent`;
  FAB `bg-primary text-white`; header `glass`; mobile nav surface/border; "More" drawer
  surface; notification badge `danger`.
- **ChartCard.tsx**: move `CHART_COLORS` to design tokens; cards use surface tokens.

### 6. Pages — retheme every hardcoded `plum-*`/`gold-*`/`slate-*`/`emerald*`/`red*`/
`amber*`/`blue*`/`rose*`/`violet*` reference (~344 total) via tokens/utilities:
- `App.tsx` loading screen → new logo (icon) + `bg-background text-text-secondary`.
- `Onboarding.tsx` → brand wordmark/icon (not text "V"), gradient backgrounds
  rethemed to ivory+gold; stepper active → `accent`, done → `success`, pending neutral.
- `Settings.tsx` → About section uses new logo; theme toggle uses `accent`. Keep the
  existing light/dark toggle (it already writes `settings.theme`).
- `Dashboard.tsx` (StatCards, wallet cards, charts, quick actions, low-stock alert) →
  tokens + new `CHART_COLORS`.
- `Reports.tsx` → `REPORTS[].color` and `KpiGrid` colors via tokens; pie/bar/area
  charts use new `CHART_COLORS`; grid lines/axis ticks neutral tokens.
- `Wallets.tsx`, `Sales.tsx`, `Inventory/*`, `Expenses.tsx`, `Customers.tsx`,
  `Suppliers.tsx`, `Notifications.tsx` → token-based neutrals + semantic colors.
- **Constants** (`src/constants/index.ts`): replace `BATCH_STATUS_META` and
  `WALLET_META` hardcoded Tailwind color strings with token-backed class strings
  (e.g. `bg-accent/10 text-accent`) or values from `designTokens`. Keep keys/labels.

### 7. Dark / light mode
- `darkMode: 'class'` already configured; `AppContext` already toggles `.dark` from
  `settings.theme`. No change to that logic (preserve functionality).
- Ensure every token has light + dark values (done in tasks 1–3) so toggling the
  existing Settings theme switch fully re-themes the app.
- Verify charts/inline styles (`CHART_COLORS`, axis tick fills, pie legend dots) also
  swap per theme.

---

## Constraints (must hold)
- No business logic, API, or DB changes. No component renames.
- No new features; pure visual refactor.
- Preserve responsive layout (mobile bottom-nav + desktop sidebar) and all
  interactions (FAB, modals, drawers, toasts).
- Maintain AA contrast: charcoal/gold-on-ivory and white-on-black both verified.

## Validation
1. `npm run lint` and `npm run typecheck` pass.
2. `npm run build` succeeds (PWA manifest generated with new theme_color/icons).
3. Manual: toggle theme in Settings → entire app (incl. charts, badges, modals)
   re-themes with no leftover plum/slate colors. Grep confirms zero `plum-`, `gold-`,
   `slate-`, `emerald-`, `amber-`, `rose-`, `violet-`, `blue-` utility usage remains
   (replaced by tokens) and no raw old hex in `src`.
4. New logo visible on splash, header, sidebar, mobile nav, About, favicon, PWA
   install icon.

## Open / risks
- **PNG generation**: producing correctly-sized/colored `favicon.svg` + new
  `pwa-*.png` from the 2048² source may need an image tool or a one-off script. If the
  execution agent cannot rasterize, flag it and provide the SVGs + instructions.
- **Maskable icon**: must have safe-zone padding (gold icon centered on `#111111`).
- Some components pass color strings as props (e.g. `StatCard accent`, `Badge color`,
  `QuickAction color`, `REPORTS[].color`); convert these to token class strings.
