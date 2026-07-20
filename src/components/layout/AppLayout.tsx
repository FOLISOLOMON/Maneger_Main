// Veloura Manager V2 — App layout shell
// Spec section 7.3: mobile-first with bottom nav, desktop with sidebar.
// Header shows business name, sync status, notifications. FAB is
// context-aware (spec 7.5) and provided by each page via useFab.
// Colors use the brand design tokens; logo uses the official Veloura mark.

import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Package, ShoppingCart, BarChart3, Menu, X,
  Bell, Plus, Users, Truck, Receipt, Wallet, Settings, type LucideIcon,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useNotificationsSnapshot } from '../../hooks/queries';
import { NAV_ITEMS, MORE_ITEMS } from '../../constants';
import { logos } from '../../theme/designTokens';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Package, ShoppingCart, BarChart3, Menu, X,
  Bell, Plus, Users, Truck, Receipt, Wallet, Settings,
};

interface FabConfig {
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
}

// Simple module-level holder so pages can register their FAB action without
// prop-drilling. Reset on route change.
let currentFab: FabConfig | null = null;
const fabListeners = new Set<() => void>();

export function setFab(config: FabConfig | null) {
  currentFab = config;
  fabListeners.forEach((l) => l());
}

export function useFabRegistration(config: FabConfig | null) {
  const location = useLocation();
  useEffect(() => {
    setFab(config);
    return () => setFab(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}

function useFabState() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    fabListeners.add(l);
    return () => { fabListeners.delete(l); };
  }, []);
  return currentFab;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { settings, isOnboarded } = useApp();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const fab = useFabState();

  // Close the More sheet on navigation
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  if (!isOnboarded) {
    return <>{children}</>;
  }

  const SidebarLink = ({ to, label, icon }: { to: string; label: string; icon: string }) => {
    const Icon = ICONS[icon] ?? LayoutDashboard;
    return (
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) =>
          clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
            isActive ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary',
          )
        }
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {label}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-surface p-4 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-2.5 px-2 py-3 mb-4">
          <img src={logos.icon.gold} alt="Avencia" className="w-9 h-9 rounded-xl object-contain" />
          <div className="min-w-0">
            <p className="font-display font-bold text-text-primary text-sm leading-tight truncate">Avencia</p>
            <p className="text-[11px] text-text-muted leading-tight truncate">{settings?.business_name ?? 'Manager'}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => (
            <SidebarLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
          ))}
          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-text-muted uppercase tracking-wider">More</p>
          {MORE_ITEMS.map((item) => (
            <SidebarLink key={item.to} to={item.to} label={item.label} icon={item.icon} />
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 md:ml-60 flex flex-col min-w-0">
        <Header onMore={() => setMoreOpen(true)} />
        <main className="flex-1 px-4 pt-4 pb-28 md:pb-8 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* FAB */}
      {fab && (
        <button
          onClick={fab.onClick}
          className="fixed right-4 bottom-20 md:bottom-6 z-40 h-14 pl-4 pr-5 rounded-2xl bg-action text-white shadow-fab hover:bg-action-light active:scale-95 transition-all flex items-center gap-2 font-semibold"
          aria-label={fab.label}
        >
          {fab.icon ? <fab.icon className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          <span className="hidden sm:inline">{fab.label}</span>
        </button>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors touch-target',
                    isActive ? 'text-accent' : 'text-text-muted',
                  )
                }
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* More drawer (mobile) — slides in from the right */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-scrim/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute right-0 inset-y-0 w-[80%] max-w-xs bg-surface shadow-xl flex flex-col animate-slide-in">
            <div className="flex items-center justify-between px-4 h-14 border-b border-border">
              <h3 className="font-display font-bold text-text-primary">More</h3>
              <button
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:bg-surface-alt"
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
                    className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-text-secondary hover:bg-surface-alt active:bg-surface-alt transition-colors"
                  >
                    <span className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
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
    </div>
  );
}

function Header({ onMore }: { onMore: () => void }) {
  const { settings } = useApp();
  const { data: snapshot } = useNotificationsSnapshot();
  const notifications = snapshot?.notifications;
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-20 glass border-b border-border">
      <div className="h-14 px-4 flex items-center justify-between gap-3 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src={logos.icon.gold} alt="Avencia" className="md:hidden w-8 h-8 rounded-lg object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-display font-bold text-text-primary text-sm leading-tight truncate">
              {settings?.business_name ?? 'Avencia Manager'}
            </p>
            <p className="text-[11px] text-text-muted leading-tight truncate">
              {settings?.owner_name ? `Welcome, ${settings.owner_name}` : 'Business management'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            to="/notifications"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors touch-target"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          <button
            onClick={onMore}
            aria-label="More"
            className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:bg-surface-alt hover:text-text-primary transition-colors touch-target"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
