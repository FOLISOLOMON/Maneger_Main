// Veloura Manager V2 — React Query hooks
// Spec section 4.11: "Use React Query for server data." All server state
// flows through these hooks. Mutations invalidate the right query keys so
// the UI refreshes automatically.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import type {
  Customer,
  InventoryBatch,
  Product,
  Settings,
  Supplier,
  WalletName,
} from '../types';

// Query keys — centralized so invalidation is predictable.
export const qk = {
  settings: ['settings'] as const,
  suppliers: ['suppliers'] as const,
  supplier: (id: string) => ['supplier', id] as const,
  batches: ['batches'] as const,
  batch: (id: string) => ['batch', id] as const,
  supplierBatches: (id: string) => ['supplier-batches', id] as const,
  products: ['products'] as const,
  batchProducts: (id: string) => ['batch-products', id] as const,
  sales: ['sales'] as const,
  batchSales: (id: string) => ['batch-sales', id] as const,
  customerSales: (id: string) => ['customer-sales', id] as const,
  expenses: ['expenses'] as const,
  batchExpenses: (id: string) => ['batch-expenses', id] as const,
  walletTx: ['wallet-tx'] as const,
  walletTxByWallet: (w: WalletName) => ['wallet-tx', w] as const,
  customers: ['customers'] as const,
  customer: (id: string) => ['customer', id] as const,
  notifications: ['notifications'] as const,
  activityLogs: ['activity-logs'] as const,
  dashboard: ['dashboard'] as const,
  inventory: ['inventory'] as const,
  batchSnapshot: (id: string) => ['batch-snapshot', id] as const,
  salesSnapshot: ['sales-snapshot'] as const,
  walletsSnapshot: ['wallets-snapshot'] as const,
  notificationsSnapshot: ['notifications-snapshot'] as const,
};

// ---------- Settings ----------

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: api.fetchSettings, staleTime: 60_000 });
}

export function useCreateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.settings }),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Settings> }) => api.updateSettings(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.settings }),
  });
}

// ---------- Suppliers ----------

export function useSuppliers() {
  return useQuery({ queryKey: qk.suppliers, queryFn: api.fetchSuppliers, staleTime: 30_000 });
}

export function useSupplier(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.supplier(id) : ['supplier', 'missing'],
    queryFn: () => api.fetchSupplier(id!),
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSupplier,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.suppliers }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Supplier> }) => api.updateSupplier(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.suppliers });
    },
  });
}

// ---------- Batches ----------

export function useBatches() {
  return useQuery({ queryKey: qk.batches, queryFn: api.fetchBatches, staleTime: 15_000 });
}

export function useBatch(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.batch(id) : ['batch', 'missing'],
    queryFn: () => api.fetchBatch(id!),
    enabled: !!id,
  });
}

export function useBatchesBySupplier(supplierId: string | undefined) {
  return useQuery({
    queryKey: supplierId ? qk.supplierBatches(supplierId) : ['supplier-batches', 'missing'],
    queryFn: () => api.fetchBatchesBySupplier(supplierId!),
    enabled: !!supplierId,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createBatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.inventory });
    },
  });
}

export function useUpdateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InventoryBatch> }) => api.updateBatch(id, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.inventory });
      if (data.id) qc.invalidateQueries({ queryKey: qk.batchSnapshot(data.id) });
    },
  });
}

export function useCloseBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.closeBatch,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.inventory });
      qc.invalidateQueries({ queryKey: qk.walletsSnapshot });
      qc.invalidateQueries({ queryKey: qk.notificationsSnapshot });
    },
  });
}

// ---------- Products ----------

export function useProducts() {
  return useQuery({ queryKey: qk.products, queryFn: api.fetchProducts, staleTime: 15_000 });
}

export function useBatchProducts(batchId: string | undefined) {
  return useQuery({
    queryKey: batchId ? qk.batchProducts(batchId) : ['batch-products', 'missing'],
    queryFn: () => api.fetchProductsByBatch(batchId!),
    enabled: !!batchId,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createProduct,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.inventory });
      if (variables.batch_id) qc.invalidateQueries({ queryKey: qk.batchSnapshot(variables.batch_id) });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Product> }) => api.updateProduct(id, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.inventory });
      if (data.batch_id) {
        qc.invalidateQueries({ queryKey: qk.batchSnapshot(data.batch_id) });
      }
    },
  });
}

// ---------- Sales ----------

export function useSales(limit?: number) {
  return useQuery({
    queryKey: limit ? [...qk.sales, 'limited', limit] : qk.sales,
    queryFn: () => api.fetchSales(limit),
    staleTime: 10_000,
  });
}

export function useBatchSales(batchId: string | undefined) {
  return useQuery({
    queryKey: batchId ? qk.batchSales(batchId) : ['batch-sales', 'missing'],
    queryFn: () => api.fetchSalesByBatch(batchId!),
    enabled: !!batchId,
  });
}

export function useCustomerSales(customerId: string | undefined) {
  return useQuery({
    queryKey: customerId ? qk.customerSales(customerId) : ['customer-sales', 'missing'],
    queryFn: () => api.fetchSalesByCustomer(customerId!),
    enabled: !!customerId,
  });
}

export function useRecordSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.recordSale,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.inventory });
      qc.invalidateQueries({ queryKey: qk.salesSnapshot });
      qc.invalidateQueries({ queryKey: qk.walletsSnapshot });
      qc.invalidateQueries({ queryKey: qk.notificationsSnapshot });
    },
  });
}

export function useVoidSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.voidSale,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.inventory });
      qc.invalidateQueries({ queryKey: qk.salesSnapshot });
    },
  });
}

// ---------- Expenses ----------

export function useExpenses() {
  return useQuery({ queryKey: qk.expenses, queryFn: api.fetchExpenses, staleTime: 15_000 });
}

export function useBatchExpenses(batchId: string | undefined) {
  return useQuery({
    queryKey: batchId ? qk.batchExpenses(batchId) : ['batch-expenses', 'missing'],
    queryFn: () => api.fetchExpensesByBatch(batchId!),
    enabled: !!batchId,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createExpense>[0]) => api.createExpense(input),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: qk.dashboard });
      qc.invalidateQueries({ queryKey: qk.inventory });
      qc.invalidateQueries({ queryKey: qk.walletsSnapshot });
      qc.invalidateQueries({ queryKey: qk.notificationsSnapshot });
      if (variables.batch_id) {
        qc.invalidateQueries({ queryKey: qk.batchSnapshot(variables.batch_id) });
      }
    },
  });
}

// ---------- Wallets ----------

export function useWalletTransactions() {
  return useQuery({ queryKey: qk.walletTx, queryFn: api.fetchWalletTransactions, staleTime: 10_000 });
}

export function useCreateWalletTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createWalletTransaction,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.walletTx }),
  });
}

// ---------- Customers ----------

export function useCustomers() {
  return useQuery({ queryKey: qk.customers, queryFn: api.fetchCustomers, staleTime: 30_000 });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.customer(id) : ['customer', 'missing'],
    queryFn: () => api.fetchCustomer(id!),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createCustomer,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.customers }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Customer> }) => api.updateCustomer(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.customers });
    },
  });
}

// ---------- Notifications ----------

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications, queryFn: api.fetchNotifications, staleTime: 15_000 });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notificationsSnapshot }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notificationsSnapshot }),
  });
}

// ---------- Activity logs ----------

export function useActivityLogs(limit: number = 50) {
  return useQuery({
    queryKey: [...qk.activityLogs, limit] as const,
    queryFn: () => api.fetchActivityLogs(limit),
    staleTime: 15_000,
  });
}

// ---------- Batched snapshots (one HTTP round-trip per page) ----------

export function useDashboardSnapshot() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: api.fetchDashboardSnapshot,
    staleTime: 15_000,
  });
}

export function useInventorySnapshot() {
  return useQuery({
    queryKey: qk.inventory,
    queryFn: api.fetchInventorySnapshot,
    staleTime: 15_000,
  });
}

export function useBatchSnapshot(id: string | undefined) {
  return useQuery({
    queryKey: id ? qk.batchSnapshot(id) : ['batch-snapshot', 'missing'],
    queryFn: () => api.fetchBatchSnapshot(id!),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useSalesSnapshot() {
  return useQuery({
    queryKey: qk.salesSnapshot,
    queryFn: api.fetchSalesSnapshot,
    staleTime: 10_000,
  });
}

export function useWalletsSnapshot() {
  return useQuery({
    queryKey: qk.walletsSnapshot,
    queryFn: api.fetchWalletsSnapshot,
    staleTime: 10_000,
  });
}

export function useNotificationsSnapshot() {
  return useQuery({
    queryKey: qk.notificationsSnapshot,
    queryFn: api.fetchNotificationsSnapshot,
    staleTime: 15_000,
  });
}
