// Veloura Manager V2 — React Query hooks
// Spec section 4.11: "Use React Query for server data." All server state
// flows through these hooks. Mutations invalidate the right query keys so
// the UI refreshes automatically.

import { useMemo } from 'react';
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
  return useQuery({ queryKey: qk.batches, queryFn: api.fetchBatches, staleTime: 5_000 });
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
    onSuccess: (data) => {
      qc.setQueryData(qk.dashboard, (old: any) => {
        if (!old) return old;
        return { ...old, batches: [data, ...old.batches] };
      });
      qc.setQueryData(qk.inventory, (old: any) => {
        if (!old) return old;
        return { ...old, batches: [data, ...old.batches] };
      });
      qc.invalidateQueries({ queryKey: qk.dashboard, exact: false });
      qc.invalidateQueries({ queryKey: qk.inventory, exact: false });
      qc.invalidateQueries({ queryKey: qk.batches, exact: false });
    },
  });
}

export function useUpdateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InventoryBatch> }) => api.updateBatch(id, patch),
    onSuccess: (data) => {
      qc.setQueryData(qk.dashboard, (old: any) => {
        if (!old) return old;
        return { ...old, batches: old.batches.map((b: any) => b.id === data.id ? { ...b, ...data } : b) };
      });
      qc.setQueryData(qk.inventory, (old: any) => {
        if (!old) return old;
        return { ...old, batches: old.batches.map((b: any) => b.id === data.id ? { ...b, ...data } : b) };
      });
      if (data.id) {
        qc.setQueryData(qk.batchSnapshot(data.id), (old: any) => {
          if (!old) return old;
          return { ...old, batch: { ...old.batch, ...data } };
        });
      }
      qc.invalidateQueries({ queryKey: qk.dashboard, exact: false });
      qc.invalidateQueries({ queryKey: qk.inventory, exact: false });
      qc.invalidateQueries({ queryKey: qk.batches, exact: false });
    },
  });
}

export function useCloseBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.closeBatch,
    onSuccess: (result) => {
      const batch = result.data?.batch;
      if (!batch) return;

      qc.setQueryData(qk.dashboard, (old: any) => {
        if (!old) return old;
        return { ...old, batches: old.batches.map((b: any) => b.id === batch.id ? batch : b) };
      });

      qc.setQueryData(qk.inventory, (old: any) => {
        if (!old) return old;
        return { ...old, batches: old.batches.map((b: any) => b.id === batch.id ? batch : b) };
      });

      qc.setQueryData(qk.batchSnapshot(batch.id), (old: any) => {
        if (!old) return old;
        return { ...old, batch: batch };
      });

      qc.invalidateQueries({ queryKey: qk.walletsSnapshot });
      qc.invalidateQueries({ queryKey: qk.notificationsSnapshot });
      qc.invalidateQueries({ queryKey: qk.dashboard, exact: false });
      qc.invalidateQueries({ queryKey: qk.inventory, exact: false });
      qc.invalidateQueries({ queryKey: qk.batches, exact: false });
    },
  });
}

// ---------- Products ----------

export function useProducts() {
  return useQuery({ queryKey: qk.products, queryFn: api.fetchProducts, staleTime: 5_000 });
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
    onSuccess: (data) => {
      const { product, batch } = data;
      qc.setQueryData(qk.dashboard, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          products: [product, ...old.products],
          batches: old.batches.map((b: any) => b.id === batch.id ? batch : b),
        };
      });
      qc.setQueryData(qk.inventory, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          products: [product, ...old.products],
          batches: old.batches.map((b: any) => b.id === batch.id ? batch : b),
        };
      });
      qc.setQueryData(qk.batchSnapshot(product.batch_id), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          products: [product, ...old.products],
          batch: batch,
        };
      });
      qc.invalidateQueries({ queryKey: qk.dashboard, exact: false });
      qc.invalidateQueries({ queryKey: qk.inventory, exact: false });
      qc.invalidateQueries({ queryKey: qk.batches, exact: false });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Product> }) => api.updateProduct(id, patch),
    onSuccess: async (data) => {
      qc.setQueryData(qk.dashboard, (old: any) => {
        if (!old) return old;
        return { ...old, products: old.products.map((p: any) => p.id === data.id ? { ...p, ...data } : p) };
      });
      qc.setQueryData(qk.inventory, (old: any) => {
        if (!old) return old;
        return { ...old, products: old.products.map((p: any) => p.id === data.id ? { ...p, ...data } : p) };
      });
      if (data.batch_id) {
        qc.invalidateQueries({ queryKey: qk.batchSnapshot(data.batch_id) });
        qc.invalidateQueries({ queryKey: qk.inventory, exact: false });
        try { await api.recomputeBatch(data.batch_id); } catch {}
      }
      qc.invalidateQueries({ queryKey: qk.dashboard, exact: false });
      qc.invalidateQueries({ queryKey: qk.batches, exact: false });
    },
  });
}

// ---------- Sales ----------

export function useSales(limit?: number, offset: number = 0) {
  return useQuery({
    queryKey: limit ? [...qk.sales, 'limited', limit, offset] : qk.sales,
    queryFn: () => api.fetchSales(limit, offset),
    staleTime: 5_000,
  });
}

export function useBatchSales(batchId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: batchId ? [...qk.batchSales(batchId), limit].filter(Boolean) as string[] : ['batch-sales', 'missing'],
    queryFn: () => api.fetchSalesByBatch(batchId!, limit),
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
    onSuccess: (result) => {
      const sale = result.data?.sale;
      const batch = result.data?.batch;
      if (!sale) return;

      qc.setQueryData(qk.salesSnapshot, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          sales: [sale, ...old.sales],
          products: old.products.map((p: any) =>
            p.id === sale.product?.id ? { ...p, current_stock: Math.max((p.current_stock || 0) - sale.quantity, 0) } : p
          ),
          batches: old.batches.map((b: any) =>
            b.id === sale.batch?.id ? { ...b, remaining_stock: Math.max((b.remaining_stock || 0) - sale.quantity, 0) } : b
          ),
        };
      });

      qc.setQueryData(qk.dashboard, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          sales: [sale, ...old.sales],
          products: old.products.map((p: any) =>
            p.id === sale.product?.id ? { ...p, current_stock: Math.max((p.current_stock || 0) - sale.quantity, 0) } : p
          ),
          batches: old.batches.map((b: any) =>
            b.id === sale.batch?.id ? { ...b, remaining_stock: Math.max((b.remaining_stock || 0) - sale.quantity, 0) } : b
          ),
        };
      });

      qc.setQueryData(qk.inventory, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          batches: old.batches.map((b: any) =>
            b.id === sale.batch?.id ? { ...b, remaining_stock: Math.max((b.remaining_stock || 0) - sale.quantity, 0) } : b
          ),
        };
      });

      if (batch && sale.batch?.id) {
        qc.setQueryData(qk.batchSnapshot(sale.batch.id), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            sales: [sale, ...old.sales],
            batch: batch,
            products: old.products.map((p: any) =>
              p.id === sale.product?.id ? { ...p, current_stock: Math.max((p.current_stock || 0) - sale.quantity, 0) } : p
            ),
          };
        });
      }

      qc.invalidateQueries({ queryKey: qk.notificationsSnapshot });
      qc.invalidateQueries({ queryKey: qk.salesSnapshot, exact: false });
      qc.invalidateQueries({ queryKey: qk.dashboard, exact: false });
      qc.invalidateQueries({ queryKey: qk.inventory, exact: false });
      qc.invalidateQueries({ queryKey: qk.batches, exact: false });
    },
  });
}

export function useVoidSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.voidSale,
    onSuccess: (result) => {
      const sale = result.data?.sale;
      const batch = result.data?.batch;
      if (!sale) return;

      qc.setQueryData(qk.salesSnapshot, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          sales: old.sales.map((s: any) => s.id === sale.id ? sale : s),
          products: old.products.map((p: any) =>
            p.id === sale.product?.id ? { ...p, current_stock: (p.current_stock || 0) + sale.quantity } : p
          ),
          batches: old.batches.map((b: any) =>
            b.id === sale.batch?.id ? { ...b, remaining_stock: (b.remaining_stock || 0) + sale.quantity } : b
          ),
        };
      });

      qc.setQueryData(qk.dashboard, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          sales: old.sales.map((s: any) => s.id === sale.id ? sale : s),
          products: old.products.map((p: any) =>
            p.id === sale.product?.id ? { ...p, current_stock: (p.current_stock || 0) + sale.quantity } : p
          ),
          batches: old.batches.map((b: any) =>
            b.id === sale.batch?.id ? { ...b, remaining_stock: (b.remaining_stock || 0) + sale.quantity } : b
          ),
        };
      });

      qc.setQueryData(qk.inventory, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          batches: old.batches.map((b: any) =>
            b.id === sale.batch?.id ? { ...b, remaining_stock: (b.remaining_stock || 0) + sale.quantity } : b
          ),
        };
      });

      if (batch && sale.batch?.id) {
        qc.setQueryData(qk.batchSnapshot(sale.batch.id), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            sales: old.sales.map((s: any) => s.id === sale.id ? sale : s),
            batch: batch,
            products: old.products.map((p: any) =>
              p.id === sale.product?.id ? { ...p, current_stock: (p.current_stock || 0) + sale.quantity } : p
            ),
          };
        });
      }

      qc.invalidateQueries({ queryKey: qk.notificationsSnapshot });
      qc.invalidateQueries({ queryKey: qk.salesSnapshot, exact: false });
      qc.invalidateQueries({ queryKey: qk.dashboard, exact: false });
      qc.invalidateQueries({ queryKey: qk.inventory, exact: false });
      qc.invalidateQueries({ queryKey: qk.batches, exact: false });
    },
  });
}

// ---------- Expenses ----------

export function useExpenses(limit?: number, offset: number = 0) {
  return useQuery({
    queryKey: limit ? [...qk.expenses, 'limited', limit, offset] : qk.expenses,
    queryFn: () => api.fetchExpenses(limit, offset),
    staleTime: 5_000,
  });
}

export function useBatchExpenses(batchId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: batchId ? [...qk.batchExpenses(batchId), limit].filter(Boolean) as string[] : ['batch-expenses', 'missing'],
    queryFn: () => api.fetchExpensesByBatch(batchId!, limit),
    enabled: !!batchId,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof api.createExpense>[0]) => api.createExpense(input),
    onSuccess: (data, variables) => {
      qc.setQueryData(qk.dashboard, (old: any) => {
        if (!old) return old;
        return { ...old, expenses: [data, ...old.expenses] };
      });

      qc.setQueryData(qk.inventory, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          batches: old.batches.map((b: any) =>
            b.id === variables.batch_id ? { ...b, remaining_stock: Math.max((b.remaining_stock || 0) - Number(variables.amount || 0), 0) } : b
          ),
        };
      });

      if (variables.batch_id) {
        qc.setQueryData(qk.batchSnapshot(variables.batch_id), (old: any) => {
          if (!old) return old;
          return {
            ...old,
            expenses: [data, ...old.expenses],
            batch: old.batch ? { ...old.batch, remaining_stock: Math.max((old.batch.remaining_stock || 0) - Number(variables.amount || 0), 0) } : old.batch,
          };
        });
      }

      qc.invalidateQueries({ queryKey: qk.walletsSnapshot });
      qc.invalidateQueries({ queryKey: qk.notificationsSnapshot });
      qc.invalidateQueries({ queryKey: qk.expenses, exact: false });
      qc.invalidateQueries({ queryKey: qk.dashboard, exact: false });
      qc.invalidateQueries({ queryKey: qk.batches, exact: false });
    },
  });
}

// ---------- Wallets ----------

export function useWalletTransactions(limit?: number, offset: number = 0) {
  return useQuery({
    queryKey: limit ? [...qk.walletTx, 'limited', limit, offset] : qk.walletTx,
    queryFn: () => api.fetchWalletTransactions(limit, offset),
    staleTime: 5_000,
  });
}

export function useCreateWalletTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createWalletTransaction,
    onSuccess: (data) => {
      qc.setQueryData(qk.walletTx, (old: any) => {
        if (!old) return old;
        return [data, ...old];
      });
      qc.invalidateQueries({ queryKey: qk.walletsSnapshot, exact: false });
    },
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
    onSuccess: (data) => {
      qc.setQueryData(qk.customers, (old: any) => {
        if (!old) return old;
        return [data, ...old];
      });
    },
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

export function useNotifications(limit?: number, offset: number = 0) {
  return useQuery({
    queryKey: limit ? [...qk.notifications, 'limited', limit, offset] : qk.notifications,
    queryFn: () => api.fetchNotifications(limit, offset),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markNotificationRead,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.notificationsSnapshot });
      await qc.cancelQueries({ queryKey: qk.notifications });

      const previousSnapshot = qc.getQueryData(qk.notificationsSnapshot);
      const previousNotifications = qc.getQueryData(qk.notifications);

      qc.setQueryData(qk.notificationsSnapshot, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: any) => n.id === id ? { ...n, read: true } : n),
        };
      });
      qc.setQueryData(qk.notifications, (old: any) => {
        if (!old) return old;
        return old.map((n: any) => n.id === id ? { ...n, read: true } : n);
      });

      return { previousSnapshot, previousNotifications };
    },
    onError: (_err, _id, ctx) => {
      if (ctx) {
        if (ctx.previousSnapshot) qc.setQueryData(qk.notificationsSnapshot, ctx.previousSnapshot);
        if (ctx.previousNotifications) qc.setQueryData(qk.notifications, ctx.previousNotifications);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.notificationsSnapshot, exact: false });
      qc.invalidateQueries({ queryKey: qk.notifications, exact: false });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markAllNotificationsRead,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: qk.notificationsSnapshot });
      await qc.cancelQueries({ queryKey: qk.notifications });

      const previousSnapshot = qc.getQueryData(qk.notificationsSnapshot);
      const previousNotifications = qc.getQueryData(qk.notifications);

      qc.setQueryData(qk.notificationsSnapshot, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: any) => ({ ...n, read: true })),
        };
      });
      qc.setQueryData(qk.notifications, (old: any) => {
        if (!old) return old;
        return old.map((n: any) => ({ ...n, read: true }));
      });

      return { previousSnapshot, previousNotifications };
    },
    onError: (_err, _id, ctx) => {
      if (ctx) {
        if (ctx.previousSnapshot) qc.setQueryData(qk.notificationsSnapshot, ctx.previousSnapshot);
        if (ctx.previousNotifications) qc.setQueryData(qk.notifications, ctx.previousNotifications);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.notificationsSnapshot, exact: false });
      qc.invalidateQueries({ queryKey: qk.notifications, exact: false });
    },
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

export function useDashboardSnapshot({
  salesLimit,
  expensesLimit,
  walletTxLimit,
  notificationsLimit,
}: {
  salesLimit?: number;
  expensesLimit?: number;
  walletTxLimit?: number;
  notificationsLimit?: number;
} = {}) {
  const key = useMemo(() => {
    const parts: unknown[] = [qk.dashboard];
    if (salesLimit) parts.push('sales', salesLimit);
    if (expensesLimit) parts.push('expenses', expensesLimit);
    if (walletTxLimit) parts.push('walletTx', walletTxLimit);
    if (notificationsLimit) parts.push('notifications', notificationsLimit);
    return parts;
  }, [salesLimit, expensesLimit, walletTxLimit, notificationsLimit]);

  return useQuery({
    queryKey: key,
    queryFn: () => api.fetchDashboardSnapshot({ salesLimit, expensesLimit, walletTxLimit, notificationsLimit }),
    staleTime: 5_000,
  });
}

export function useInventorySnapshot() {
  return useQuery({
    queryKey: qk.inventory,
    queryFn: api.fetchInventorySnapshot,
    staleTime: 5_000,
  });
}

export function useBatchSnapshot(id: string | undefined, options?: {
  salesLimit?: number;
  expensesLimit?: number;
  walletTxLimit?: number;
}) {
  return useQuery({
    queryKey: id ? [...qk.batchSnapshot(id), options].filter(Boolean) as string[] : ['batch-snapshot', 'missing'],
    queryFn: () => api.fetchBatchSnapshot(id!, options),
    enabled: !!id,
    staleTime: 5_000,
  });
}

export function useSalesSnapshot(salesLimit?: number) {
  return useQuery({
    queryKey: salesLimit ? [...qk.salesSnapshot, salesLimit] : qk.salesSnapshot,
    queryFn: () => api.fetchSalesSnapshot(salesLimit),
    staleTime: 10_000,
  });
}

export function useWalletsSnapshot(walletTxLimit?: number) {
  return useQuery({
    queryKey: walletTxLimit ? [...qk.walletsSnapshot, walletTxLimit] : qk.walletsSnapshot,
    queryFn: () => api.fetchWalletsSnapshot(walletTxLimit),
    staleTime: 10_000,
  });
}

export function useNotificationsSnapshot(notificationsLimit?: number) {
  return useQuery({
    queryKey: notificationsLimit ? [...qk.notificationsSnapshot, notificationsLimit] : qk.notificationsSnapshot,
    queryFn: () => api.fetchNotificationsSnapshot(notificationsLimit),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });
}
