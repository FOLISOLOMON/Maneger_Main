# Veloura Manager — Make the App a PWA

## Goal
Make the existing Vite + React SPA installable on mobile/desktop and resilient to
flaky networks by caching the app shell (HTML/JS/CSS/fonts) in a service worker.
Scope is **installable + app-shell cache only** — there is NO offline data sync.
All data still requires a live network call to the Google Apps Script backend.

## Stack decisions
- Add **`vite-plugin-pwa`** (Workbox under the hood). Auto-generates
  `manifest.webmanifest` + service worker, handles precache + runtime caching.
- Keep current `BrowserRouter` (no routing change needed).
- Backend is off-host Google Apps Script. Service worker will **not** cache API
  responses in this phase; it only precaches the static app shell.

## Implementation tasks

### 1. Add dependency
- `npm i -D vite-plugin-pwa`
- Confirm it lands in `devDependencies` (it is build-time only).

### 2. Configure Vite (`vite.config.ts`)
- Import `VitePWA` from `'vite-plugin-pwa'`.
- Add plugin with:
  - `registerType: 'autoUpdate'` (sw auto-updates; app reloads on new version).
  - `includeAssets`: reference any static icons already used (e.g. `vite.svg`).
  - `manifest`:
    - `name: 'Veloura Manager'`
    - `short_name: 'Veloura'`
    - `description: 'Offline-first perfume business management: inventory, sales, expenses, wallets, profit.'`
    - `theme_color: '#7e22ce'`
    - `background_color: '#ffffff'`
    - `display: 'standalone'`
    - `start_url: '/'`
    - `scope: '/'`
    - `icons`: declare 192 and 512 masksable + any. (see task 3)
  - `workbox`:
    - `globPatterns: ['**/*.{js,css,html,svg,woff2}']` (app shell precache)
    - `navigateFallback: '/index.html'` (SPA offline fallback for navigations)
    - Do NOT add `runtimeCaching` for the Sheets API URL — out of scope.

### 3. App icons
- Generate `public/pwa-192x192.png` and `public/pwa-512x512.png`
  (plus optional `pwa-maskable-512x512.png`). Purple `#7e22ce` brand.
- Reference them in the manifest `icons` array with `"purpose": "any"` and
  `"purpose": "maskable"` respectively. `public/` files are served at root.

### 4. Register the service worker (`src/main.tsx`)
- `vite-plugin-pwa` with `registerType: 'autoUpdate'` + `injectRegister: 'auto'`
  (default) auto-injects the registration, so **no manual code change is required**.
- If `injectRegister` is disabled, add `import 'virtual:pwa-register'` handling
  (use `registerSW({ immediate: true })`). Keep default to minimize code churn.

### 5. HTML meta polish (`index.html`)
- Add `<link rel="manifest" href="/manifest.webmanifest" />` (plugin can inject,
  but explicit link is safe).
- Add `<meta name="apple-mobile-web-app-capable" content="yes" />` and
  `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`.
- Apple touch icon: `<link rel="apple-touch-icon" href="/pwa-192x192.png" />`.

### 6. TypeScript env types (`src/vite-env.d.ts`)
- Add `/// <reference types="vite-plugin-pwa/client" />` so the
  `virtual:pwa-register` module is typed (needed only if manual registration used).

## Files touched
- `package.json` (dep)
- `vite.config.ts` (plugin + manifest)
- `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512x512.png` (new)
- `index.html` (meta + manifest link)
- `src/vite-env.d.ts` (type ref, if manual registration)

## Validation
1. `npm run build` — must succeed and emit `dist/manifest.webmanifest` + `sw.js`.
2. `npm run preview` then open DevTools > Application > Manifest: confirm name,
   icons, `display: standalone` parse with no errors.
3. Application > Service Workers: confirm `sw.js` registered and activated.
4. Go offline in DevTools, reload — app shell loads (cached HTML/JS/CSS).
   Data panels will show load errors (expected; no offline data in this phase).
5. Lighthouse > Installable PWA: should pass the "installable" audit.
6. `npm run lint` and `npm run typecheck` remain green.

## Out of scope (future phases)
- Offline read cache of API responses (TanStack Query persistence).
- Offline mutation queue + Background Sync / IndexedDB.
- Push notifications.

## Risks / notes
- `VITE_SHEETS_API_URL` is required at build (throws if missing). Build offline
  only caches the shell; the first load still needs network for data.
- Apps Script CORS: unchanged — service worker only helps the static shell.
- After deploy, users must refresh to pick up the new service worker (autoUpdate
  handles this automatically).
