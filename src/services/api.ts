// Veloura Manager V2 — API service layer
// Spec section 4.2: "No page should communicate directly with [storage]."
// This module is the only place that imports the Sheets client and builds
// requests. Pages call these functions through React Query hooks. All business
// IDs are generated server-side by code.gs.

import {
  sheetsList,
  sheetsGet,
  sheetsCreate,
  sheetsUpdate,
  sheetsAction,
} from '../lib/sheets';
import { totalBatchCost } from './calculations';
import type {
  ActivityLog,
  Customer,
  Expense,
  ExpenseType,
  InventoryBatch,
  Notification,
  Product,
  SaleWithRelations,
  ExpenseWithBatch,
  Settings,
  Supplier,
  WalletName,
  WalletTransaction,
  ApiRecord,
} from '../types';

// Defensive normalization: the Sheets backend can return a single object, null,
// or an array depending on deployment state. Coerce list responses to arrays so
// the UI never crashes on a malformed/empty response.
function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && !Array.isArray(value)) return [value as T];
  return [];
}

// ---------- Settings ----------

export async function fetchSettings(): Promise<Settings | null> {
  return (await sheetsAction('listSettings')) as Settings | null;
}

export async function createSettings(input: Omit<Settings, 'id' | 'created_at' | 'updated_at'>): Promise<Settings> {
  return (await sheetsCreate('Settings', input)) as Settings;
}

export async function updateSettings(id: string, patch: Partial<Settings>): Promise<Settings> {
  return (await sheetsUpdate('Settings', id, patch)) as Settings;
}

// ---------- Suppliers ----------

export async function fetchSuppliers(): Promise<Supplier[]> {
  return asArray<Supplier>(await sheetsList('Suppliers'));
}

export async function fetchSupplier(id: string): Promise<Supplier | null> {
  return (await sheetsGet('Suppliers', id)) as Supplier | null;
}

export async function createSupplier(input: {
  supplier_name: string;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  contact_person?: string | null;
  notes?: string | null;
}): Promise<Supplier> {
  const supplier = (await sheetsCreate('Suppliers', {
    ...input,
    status: 'Active',
  })) as Supplier;

  await logActivity('Supplier Created', 'Suppliers', supplier.id, `Created supplier ${supplier.supplier_name}`);
  return supplier;
}

export async function updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier> {
  return (await sheetsUpdate('Suppliers', id, patch)) as Supplier;
}

export async function archiveSupplier(id: string): Promise<void> {
  await sheetsUpdate('Suppliers', id, { status: 'Archived' });
}

// ---------- Batches ----------

export async function fetchBatches(): Promise<InventoryBatch[]> {
  return asArray<InventoryBatch>(await sheetsAction('listBatches'));
}

export async function fetchBatch(id: string): Promise<InventoryBatch | null> {
  return (await sheetsAction('getBatch', { id })) as InventoryBatch | null;
}

export async function fetchBatchesBySupplier(supplierId: string): Promise<InventoryBatch[]> {
  const batches = asArray<InventoryBatch>(await sheetsList('InventoryBatches'));
  return batches.filter((b) => String(b.supplier_id) === String(supplierId));
}

export async function createBatch(input: {
  supplier_id: string;
  batch_name: string;
  purchase_date: string;
  expected_arrival?: string | null;
  purchase_cost: number;
  transport_cost: number;
  loading_cost: number;
  import_duty: number;
  insurance: number;
  other_costs: number;
  notes?: string | null;
}): Promise<InventoryBatch> {
  const total = totalBatchCost(input);
  const status = total > 0 ? 'Purchased' : 'Draft';

  const batch = (await sheetsCreate('InventoryBatches', {
    ...input,
    total_batch_cost: total,
    status,
    completion_percentage: 0,
    remaining_stock: 0,
    gross_revenue: 0,
    gross_profit: 0,
    net_profit: 0,
    roi: 0,
  })) as InventoryBatch;

  await logActivity('Batch Created', 'Inventory', batch.id, `Created batch ${batch.batch_code}`);
  return batch;
}

export async function updateBatch(id: string, patch: Partial<InventoryBatch>): Promise<InventoryBatch> {
  return (await sheetsUpdate('InventoryBatches', id, patch)) as InventoryBatch;
}

export async function archiveBatch(id: string): Promise<void> {
  await sheetsUpdate('InventoryBatches', id, { status: 'Archived' });
}

// ---------- Products ----------

export async function fetchProducts(): Promise<Product[]> {
  return asArray<Product>(await sheetsAction('listProducts'));
}

export async function fetchProductsByBatch(batchId: string): Promise<Product[]> {
  return asArray<Product>(await sheetsAction('listProductsByBatch', { batchId }));
}

export async function createProduct(input: {
  batch_id: string;
  product_name: string;
  brand?: string | null;
  category?: string | null;
  cost_price: number;
  selling_price: number;
  initial_stock: number;
  reorder_level?: number;
  description?: string | null;
  image_url?: string | null;
}): Promise<Product> {
  const product = (await sheetsCreate('Products', {
    ...input,
    current_stock: input.initial_stock,
    reorder_level: input.reorder_level ?? 0,
    status: 'Active',
  })) as Product;

  await sheetsAction('recomputeBatch', { batchId: input.batch_id });

  await logActivity('Product Added', 'Inventory', product.id, `Added product ${product.product_name}`);
  return product;
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  return (await sheetsUpdate('Products', id, patch)) as Product;
}

// ---------- Sales (uses server-side recordSale) ----------

export async function recordSale(input: {
  product_id: string;
  customer_id?: string | null;
  quantity: number;
  unit_price: number;
  discount?: number;
  discount_type?: 'Amount' | 'Percent';
  payment_method: string;
  notes?: string | null;
  sale_date?: string;
}): Promise<{ success: boolean; message: string; data?: ApiRecord }> {
  return (await sheetsAction('recordSale', {
    payload: {
      ...input,
      discount: input.discount ?? 0,
      discount_type: input.discount_type ?? 'Amount',
      sale_date: input.sale_date ?? new Date().toISOString(),
    },
  })) as { success: boolean; message: string; data?: ApiRecord };
}

export async function voidSale(saleId: string): Promise<{ success: boolean; message: string }> {
  return (await sheetsAction('voidSale', { saleId })) as { success: boolean; message: string };
}

export async function fetchSales(limit?: number): Promise<SaleWithRelations[]> {
  const sales = asArray<SaleWithRelations>(await sheetsAction('listSales'));
  return limit ? sales.slice(0, limit) : sales;
}

export async function fetchSalesByBatch(batchId: string): Promise<SaleWithRelations[]> {
  return asArray<SaleWithRelations>(await sheetsAction('listSalesByBatch', { batchId }));
}

export async function fetchSalesByCustomer(customerId: string): Promise<SaleWithRelations[]> {
  return asArray<SaleWithRelations>(await sheetsAction('listSalesByCustomer', { customerId }));
}

// ---------- Expenses ----------

export async function fetchExpenses(): Promise<ExpenseWithBatch[]> {
  return asArray<ExpenseWithBatch>(await sheetsAction('listExpenses'));
}

export async function fetchExpensesByBatch(batchId: string): Promise<Expense[]> {
  return asArray<Expense>(await sheetsAction('listExpensesByBatch', { batchId }));
}

export async function createExpense(input: {
  expense_type: ExpenseType;
  batch_id?: string | null;
  category: string;
  expense_name: string;
  amount: number;
  expense_date: string;
  description?: string | null;
}): Promise<Expense> {
  return (await sheetsAction('createExpense', { payload: input })) as Expense;
}

// ---------- Wallets ----------

export async function fetchWalletTransactions(): Promise<WalletTransaction[]> {
  return asArray<WalletTransaction>(await sheetsAction('listWalletTransactions'));
}

export async function fetchWalletTransactionsByWallet(wallet: WalletName): Promise<WalletTransaction[]> {
  const tx = asArray<WalletTransaction>(await sheetsAction('listWalletTransactions'));
  return tx.filter((t) => t.wallet === wallet);
}

export async function createWalletTransaction(input: {
  wallet: WalletName;
  transaction_type: 'Allocation' | 'Expense' | 'Transfer' | 'Withdrawal' | 'Adjustment';
  batch_id?: string | null;
  reference_id?: string | null;
  amount: number;
  reason?: string | null;
}): Promise<WalletTransaction> {
  return (await sheetsCreate('WalletTransactions', input)) as WalletTransaction;
}

export async function closeBatch(batchId: string): Promise<{ success: boolean; message: string; data?: ApiRecord }> {
  return (await sheetsAction('closeBatch', { batchId })) as { success: boolean; message: string; data?: ApiRecord };
}

// ---------- Customers ----------

export async function fetchCustomers(): Promise<Customer[]> {
  return asArray<Customer>(await sheetsList('Customers'));
}

export async function fetchCustomer(id: string): Promise<Customer | null> {
  return (await sheetsGet('Customers', id)) as Customer | null;
}

export async function createCustomer(input: {
  customer_name: string;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | null;
  birthday?: string | null;
  notes?: string | null;
}): Promise<Customer> {
  const customer = (await sheetsCreate('Customers', {
    ...input,
    status: 'Active',
  })) as Customer;
  await logActivity('Customer Created', 'Customers', customer.id, `Added customer ${customer.customer_name}`);
  return customer;
}

export async function updateCustomer(id: string, patch: Partial<Customer>): Promise<Customer> {
  return (await sheetsUpdate('Customers', id, patch)) as Customer;
}

// ---------- Notifications ----------

export async function fetchNotifications(): Promise<Notification[]> {
  return asArray<Notification>(await sheetsList('Notifications'));
}

export async function markNotificationRead(id: string): Promise<void> {
  await sheetsUpdate('Notifications', id, { read: true });
}

export async function markAllNotificationsRead(): Promise<void> {
  const all = asArray<Notification>(await sheetsList('Notifications'));
  await Promise.all(
    all.filter((n) => !n.read).map((n) => sheetsUpdate('Notifications', n.id, { read: true })),
  );
}

// ---------- Activity logs ----------

export async function logActivity(action: string, module: string, referenceId?: string, description?: string): Promise<void> {
  await sheetsAction('logActivity', {
    actor: 'System',
    actionName: action,
    moduleName: module,
    referenceId: referenceId ?? null,
    description: description ?? null,
  });
}

export async function fetchActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
  const logs = asArray<ActivityLog>(await sheetsList('ActivityLogs'));
  return logs.slice(0, limit);
}

// ---------- Batched snapshots (one HTTP round-trip per page) ----------

export interface DashboardSnapshot {
  settings: Settings | null;
  batches: InventoryBatch[];
  products: Product[];
  sales: SaleWithRelations[];
  expenses: ExpenseWithBatch[];
  walletTx: WalletTransaction[];
  notifications: Notification[];
}

export interface InventorySnapshot {
  batches: InventoryBatch[];
  products: Product[];
  suppliers: Supplier[];
}

export interface BatchSnapshot {
  batch: InventoryBatch | null;
  products: Product[];
  sales: SaleWithRelations[];
  expenses: Expense[];
  walletTx: WalletTransaction[];
}

export interface SalesSnapshot {
  sales: SaleWithRelations[];
  products: Product[];
  customers: Customer[];
  batches: InventoryBatch[];
}

export interface WalletsSnapshot {
  walletTx: WalletTransaction[];
  settings: Settings | null;
}

export interface NotificationsSnapshot {
  notifications: Notification[];
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  return (await sheetsAction('getDashboardSnapshot')) as DashboardSnapshot;
}

export async function fetchInventorySnapshot(): Promise<InventorySnapshot> {
  return (await sheetsAction('getInventorySnapshot')) as InventorySnapshot;
}

export async function fetchBatchSnapshot(id: string): Promise<BatchSnapshot> {
  return (await sheetsAction('getBatchSnapshot', { id })) as BatchSnapshot;
}

export async function fetchSalesSnapshot(): Promise<SalesSnapshot> {
  return (await sheetsAction('getSalesSnapshot')) as SalesSnapshot;
}

export async function fetchWalletsSnapshot(): Promise<WalletsSnapshot> {
  return (await sheetsAction('getWalletsSnapshot')) as WalletsSnapshot;
}

export async function fetchNotificationsSnapshot(): Promise<NotificationsSnapshot> {
  return (await sheetsAction('getNotificationsSnapshot')) as NotificationsSnapshot;
}

// Fire several actions in a single round-trip. Returns an array of each
// action's unwrapped data (or a { success:false, message } error object).
export async function sheetsBatch(actions: { action: string; params?: ApiRecord }[]): Promise<unknown[]> {
  return (await sheetsAction('batch', { actions })) as unknown[];
}
