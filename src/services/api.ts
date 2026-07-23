// Veloura Manager V2 — API service layer
// Spec section 4.2: "No page should communicate directly with [storage]."
// This module is the only place that imports the Sheets client and builds
// requests. Pages call these functions through React Query hooks. All business
// IDs are generated server-side by code.gs.

import {
  sheetsList,
  sheetsCreate,
  sheetsUpdate,
  sheetsAction,
} from '../lib/sheets';
import type {
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
  PaymentWithRelations,
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

// ---------- Batches ----------

export async function fetchBatches(): Promise<InventoryBatch[]> {
  return asArray<InventoryBatch>(await sheetsAction('listBatches'));
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
  const batch = (await sheetsAction('createBatchAction', { payload: input })) as InventoryBatch;

  await logActivity('Batch Created', 'Inventory', batch.id, `Created batch ${batch.batch_code}`);
  return batch;
}

export async function updateBatch(id: string, patch: Partial<InventoryBatch>): Promise<InventoryBatch> {
  return (await sheetsUpdate('InventoryBatches', id, patch)) as InventoryBatch;
}

// ---------- Products ----------

export async function fetchProducts(): Promise<Product[]> {
  return asArray<Product>(await sheetsAction('listProducts'));
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
}): Promise<{ product: Product; batch: InventoryBatch }> {
  const result = (await sheetsAction('createProductAction', { payload: input })) as { product: Product; batch: InventoryBatch };

  await logActivity('Product Added', 'Inventory', result.product.id, `Added product ${result.product.product_name}`);
  return result;
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  return (await sheetsUpdate('Products', id, patch)) as Product;
}

export async function recomputeBatch(batchId: string): Promise<void> {
  await sheetsAction('recomputeBatch', { batchId });
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
}): Promise<{ success: boolean; message: string; data?: { sale: SaleWithRelations; batch: InventoryBatch } }> {
  return (await sheetsAction('recordSale', {
    payload: {
      ...input,
      discount: input.discount ?? 0,
      discount_type: input.discount_type ?? 'Amount',
      sale_date: input.sale_date ?? new Date().toISOString(),
    },
  })) as { success: boolean; message: string; data?: { sale: SaleWithRelations; batch: InventoryBatch } };
}

export async function voidSale(saleId: string): Promise<{ success: boolean; message: string; data?: { sale: SaleWithRelations; batch: InventoryBatch } }> {
  return (await sheetsAction('voidSale', { saleId })) as { success: boolean; message: string; data?: { sale: SaleWithRelations; batch: InventoryBatch } };
}

export async function fetchSales(limit?: number, offset: number = 0): Promise<SaleWithRelations[]> {
  const sales = asArray<SaleWithRelations>(await sheetsAction('listSales'));
  const start = offset || 0;
  const end = limit ? start + limit : sales.length;
  return sales.slice(start, end);
}

// ---------- Expenses ----------

export async function fetchExpenses(limit?: number, offset: number = 0): Promise<ExpenseWithBatch[]> {
  const expenses = asArray<ExpenseWithBatch>(await sheetsAction('listExpenses'));
  const start = offset || 0;
  const end = limit ? start + limit : expenses.length;
  return expenses.slice(start, end);
}

export async function fetchExpensesByBatch(batchId: string, limit?: number): Promise<Expense[]> {
  const expenses = asArray<Expense>(await sheetsAction('listExpensesByBatch', { batchId }));
  return limit ? expenses.slice(0, limit) : expenses;
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

export async function fetchWalletTransactions(limit?: number, offset: number = 0): Promise<WalletTransaction[]> {
  const tx = asArray<WalletTransaction>(await sheetsAction('listWalletTransactions'));
  const start = offset || 0;
  const end = limit ? start + limit : tx.length;
  return tx.slice(start, end);
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

export async function closeBatch(batchId: string): Promise<{ success: boolean; message: string; data?: { batch: InventoryBatch; needs: number; savings: number; growth: number } }> {
  return (await sheetsAction('closeBatch', { batchId })) as { success: boolean; message: string; data?: { batch: InventoryBatch; needs: number; savings: number; growth: number } };
}

// ---------- Customers ----------

export async function fetchCustomers(): Promise<Customer[]> {
  return asArray<Customer>(await sheetsList('Customers'));
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

// ---------- Payments ----------

export async function fetchPayments(limit?: number, offset: number = 0): Promise<PaymentWithRelations[]> {
  const payments = asArray<PaymentWithRelations>(await sheetsAction('listPayments'));
  const start = offset || 0;
  const end = limit ? start + limit : payments.length;
  return payments.slice(start, end);
}

export async function createPayment(input: {
  sale_id?: string | null;
  customer_id: string;
  amount: number;
  payment_method: string;
  payment_date?: string;
  notes?: string | null;
}): Promise<{ success: boolean; message: string; data?: { payment: PaymentWithRelations; sale: SaleWithRelations | null } }> {
  return (await sheetsAction('recordPayment', input)) as { success: boolean; message: string; data?: { payment: PaymentWithRelations; sale: SaleWithRelations | null } };
}

// ---------- Notifications ----------

export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  return (await sheetsAction('markNotificationRead', { id })) as { success: boolean };
}

export async function markAllNotificationsRead(): Promise<{ success: boolean; count: number }> {
  return (await sheetsAction('markAllNotificationsRead')) as { success: boolean; count: number };
}

export async function createNotification(payload: {
  type: string;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: string;
  priority?: string;
}): Promise<{ success: boolean; notification?: Notification }> {
  return (await sheetsAction('createNotification', { payload })) as { success: boolean; notification?: Notification };
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

// ---------- Batched snapshots (one HTTP round-trip per page) ----------

export interface DashboardSnapshot {
  settings: Settings | null;
  batches: InventoryBatch[];
  products: Product[];
  sales: SaleWithRelations[];
  expenses: ExpenseWithBatch[];
  walletTx: WalletTransaction[];
  payments: PaymentWithRelations[];
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
  payments: PaymentWithRelations[];
}

export interface WalletsSnapshot {
  walletTx: WalletTransaction[];
  settings: Settings | null;
}

export interface NotificationsSnapshot {
  notifications: Notification[];
}

export async function fetchDashboardSnapshot({
  salesLimit,
  expensesLimit,
  walletTxLimit,
  notificationsLimit,
}: {
  salesLimit?: number;
  expensesLimit?: number;
  walletTxLimit?: number;
  notificationsLimit?: number;
} = {}): Promise<DashboardSnapshot> {
  const params: ApiRecord = {};
  if (salesLimit) params.salesLimit = salesLimit;
  if (expensesLimit) params.expensesLimit = expensesLimit;
  if (walletTxLimit) params.walletTxLimit = walletTxLimit;
  if (notificationsLimit) params.notificationsLimit = notificationsLimit;
  return (await sheetsAction('getDashboardSnapshot', params)) as DashboardSnapshot;
}

export async function fetchInventorySnapshot(): Promise<InventorySnapshot> {
  return (await sheetsAction('getInventorySnapshot')) as InventorySnapshot;
}

export async function fetchBatchSnapshot(id: string, options?: {
  salesLimit?: number;
  expensesLimit?: number;
  walletTxLimit?: number;
}): Promise<BatchSnapshot> {
  return (await sheetsAction('getBatchSnapshot', { id, ...options })) as BatchSnapshot;
}

export async function fetchSalesSnapshot(salesLimit?: number): Promise<SalesSnapshot> {
  const params: ApiRecord = {};
  if (salesLimit) params.salesLimit = salesLimit;
  return (await sheetsAction('getSalesSnapshot', params)) as SalesSnapshot;
}

export async function fetchWalletsSnapshot(walletTxLimit?: number): Promise<WalletsSnapshot> {
  const params: ApiRecord = {};
  if (walletTxLimit) params.walletTxLimit = walletTxLimit;
  return (await sheetsAction('getWalletsSnapshot', params)) as WalletsSnapshot;
}

export async function fetchNotificationsSnapshot(notificationsLimit?: number): Promise<NotificationsSnapshot> {
  const params: ApiRecord = {};
  if (notificationsLimit) params.notificationsLimit = notificationsLimit;
  return (await sheetsAction('getNotificationsSnapshot', params)) as NotificationsSnapshot;
}
