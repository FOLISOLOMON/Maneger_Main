// Veloura Manager — Design Tokens
// Single source of truth for the brand + semantic palette, spacing, radii,
// shadows, typography, icon sizes and chart colors. Everything visual flows
// through here so the app can be re-themed (light / dark) in one place.
//
// Usage:
//  - Tailwind utility classes (bg-surface, text-primary, border-border, bg-accent,
//    text-accent, text-success, bg-danger, ...) map to the CSS variables declared in
//    index.css and switched via the `.dark` class.
//  - For raw values (recharts props, inline styles, SVG) use `light` / `dark` maps
//    or the `chartColors(theme)` helper.

export type ThemeMode = 'light' | 'dark';

export const colors = {
  // --- Brand ---
  primary: { light: '#111111', dark: '#FFFFFF' },
  primaryLight: { light: '#2B2B2B', dark: '#E5E5E5' },
  primaryDark: { light: '#000000', dark: '#D4D4D4' },
  // Solid action color for filled buttons: brand black in light, metallic gold
  // in dark — keeps white label text readable in both themes.
  action: { light: '#111111', dark: '#C9A227' },
  actionLight: { light: '#2B2B2B', dark: '#D9B441' },
  actionDark: { light: '#000000', dark: '#B5912F' },

  accent: { light: '#C9A227', dark: '#D9B441' },
  accentLight: { light: '#E6CE86', dark: '#E6CE86' },
  accentMuted: { light: '#8A6D1B', dark: '#B5912F' },

  // --- Surfaces ---
  background: { light: '#F8F6F2', dark: '#0E0E0E' },
  surface: { light: '#FFFFFF', dark: '#1A1A1A' },
  surfaceAlt: { light: '#F1EEE8', dark: '#141414' },
  card: { light: '#FFFFFF', dark: '#1A1A1A' },

  // --- Text ---
  textPrimary: { light: '#111111', dark: '#F5F5F5' },
  textSecondary: { light: '#3D3D3D', dark: '#A1A1A1' },
  textMuted: { light: '#6B6B6B', dark: '#777777' },

  // --- Borders ---
  border: { light: '#E7E2D8', dark: '#2A2A2A' },
  borderStrong: { light: '#D8D2C6', dark: '#3A3A3A' },

  // --- Semantic (muted, luxe-compatible, AA contrast) ---
  success: { light: '#2F6B4F', dark: '#4FA37A' },
  successBg: { light: '#EAF3EE', dark: '#16241D' },
  warning: { light: '#9A6A12', dark: '#D9A742' },
  warningBg: { light: '#F6EEDD', dark: '#26200F' },
  danger: { light: '#A1322B', dark: '#E07A70' },
  dangerBg: { light: '#F7E9E7', dark: '#2A1715' },
  info: { light: '#3D6B8A', dark: '#6FA3C7' },
  infoBg: { light: '#EAF1F6', dark: '#13212B' },

  // --- Legacy-style aliases used by charts / status chips ---
  neutral: { light: '#64748B', dark: '#94A3B8' },
} as const;

export type ColorToken = keyof typeof colors;

// Resolve a single token for a given theme.
export function token(name: ColorToken, theme: ThemeMode = 'light'): string {
  return colors[name][theme];
}

// Raw chart palette (used by recharts props / inline styles).
export const CHART_COLORS = {
  light: {
    accent: '#C9A227',
    success: '#2F6B4F',
    warning: '#9A6A12',
    danger: '#A1322B',
    info: '#3D6B8A',
    neutral: '#8A8478',
    grid: '#ECE8E0',
    axis: '#9A9389',
  },
  dark: {
    accent: '#D9B441',
    success: '#4FA37A',
    warning: '#D9A742',
    danger: '#E07A70',
    info: '#6FA3C7',
    neutral: '#7A756C',
    grid: '#262626',
    axis: '#6B6B6B',
  },
};

export function chartColors(theme: ThemeMode = 'light') {
  return CHART_COLORS[theme];
}

// --- Spacing scale (keeps rhythm consistent across the app) ---
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  '2xl': '2rem',
} as const;

// --- Border radius scale (rounded, premium feel) ---
export const radii = {
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  full: '9999px',
} as const;

// --- Soft, low-opacity shadows (premium / clean) ---
export const shadows = {
  card: '0 1px 2px 0 rgb(17 17 17 / 0.04), 0 1px 3px -1px rgb(17 17 17 / 0.05)',
  'card-hover': '0 8px 24px -8px rgb(17 17 17 / 0.10), 0 2px 6px -2px rgb(17 17 17 / 0.06)',
  fab: '0 10px 28px -6px rgb(17 17 17 / 0.35)',
  glass: '0 4px 20px -6px rgb(17 17 17 / 0.10)',
} as const;

// --- Typography ---
export const typography = {
  fontSans: "'Inter', system-ui, -apple-system, sans-serif",
  fontDisplay: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
} as const;

// --- Consistent icon sizes across the app ---
export const iconSize = {
  xs: '0.75rem', // 12px
  sm: '1rem', // 16px
  md: '1.25rem', // 20px
  lg: '1.5rem', // 24px
  xl: '2rem', // 32px
} as const;

// --- Logo asset paths (canonical names in /public) ---
export const logos = {
  wordmark: {
    gold: '/logo-gold.png',
    black: '/logo-black.png',
    white: '/logo-white.png',
  },
  icon: {
    gold: '/icon-gold.png',
    black: '/icon-black.png',
    white: '/icon-white.png',
  },
} as const;
