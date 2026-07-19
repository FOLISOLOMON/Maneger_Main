// Veloura Manager V2 — App root
// Spec section 4.9: routing with bottom nav (Dashboard, Inventory, Sales,
// Reports) + More menu (Customers, Suppliers, Expenses, Wallets, Settings,
// Notifications). Onboarding shows when no settings row exists yet.

import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './contexts/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard/Dashboard';
import { InventoryList } from './pages/Inventory/InventoryList';
import { BatchDetail } from './pages/Inventory/BatchDetail';
import { Sales } from './pages/Sales/Sales';
import { Expenses } from './pages/Expenses/Expenses';
import { Wallets } from './pages/Wallets/Wallets';
import { Customers } from './pages/Customers/Customers';
import { Suppliers } from './pages/Suppliers/Suppliers';
import { Reports } from './pages/Reports/Reports';
import { Settings } from './pages/Settings/Settings';
import { Notifications } from './pages/Notifications/Notifications';

export default function App() {
  const { isOnboarded, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/icon-gold.png"
            alt="Avencia"
            className="w-12 h-12 rounded-2xl shadow-lg animate-pulse"
          />
          <p className="text-sm text-text-secondary font-medium">Loading Avencia Manager…</p>
        </div>
      </div>
    );
  }

  if (!isOnboarded) {
    return <Onboarding />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<InventoryList />} />
        <Route path="/inventory/:id" element={<BatchDetail />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/wallets" element={<Wallets />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
