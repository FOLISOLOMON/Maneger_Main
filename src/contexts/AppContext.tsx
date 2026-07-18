// Veloura Manager V2 — App context
// Spec section 4.11: "Use Context only for UI state." This holds the loaded
// settings (currency symbol, theme, wallet percentages, thresholds) and
// derives helper values that many components need. Settings come from the
// settings table via React Query; this context just redistributes them.

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useSettings } from '../hooks/queries';
import type { Settings } from '../types';

interface AppContextValue {
  settings: Settings | null;
  isLoading: boolean;
  currencySymbol: string;
  isOnboarded: boolean;
  theme: 'light' | 'dark';
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { data: settings, isLoading } = useSettings();

  const theme = settings?.theme ?? 'light';

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const value = useMemo<AppContextValue>(() => ({
    settings: settings ?? null,
    isLoading,
    currencySymbol: settings?.currency_symbol ?? '₵',
    isOnboarded: !!settings,
    theme,
  }), [settings, isLoading, theme]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
