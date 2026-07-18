// Veloura Manager V2 — API service layer
// Spec section 4.2: "No page should communicate directly with [storage]."
// This module is the only place that imports the supabase client and builds
// queries. Pages call these functions through React Query hooks.

import { supabase } from '../lib/supabase';
import { generateBusinessIdRpc } from './id';
import {
  totalBatchCost,
} from './calculations';
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
} from '../types';

// ---------- Settings ----------

export async function fetchSettings(): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Settings | null;
}

export async function createSettings(input: Omit<Settings, 'id' | 'created_at' | 'updated_at'>): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Settings;
}

export async function updateSettings(id: string, patch: Partial<Settings>): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Settings;
}

// ---------- Suppliers ----------

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function fetchSupplier(id: string): Promise<Supplier | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Supplier | null;
}

export async function createSupplier(input: {
  supplier_name: string;
  phone?: string | null;
  email?: string | null;
  location?: string | null;
  contact_person?: string | null;
  notes?: string | null;
}): Promise<Supplier> {
  const supplier_code = await generateBusinessIdRpc('SUP');
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...input, supplier_code })
    .select()
    .single();
  if (error) throw error;

  await logActivity('Supplier Created', 'Suppliers', (data as Supplier).id, `Created supplier ${(data as Supplier).supplier_name}`);
  return data as Supplier;
}

export async function updateSupplier(id: string, patch: Partial<Supplier>): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Supplier;
}

export async function archiveSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .update({ status: 'Archived' })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Batches ----------

export async function fetchBatches(): Promise<InventoryBatch[]> {
  const { data, error } = await supabase
    .from('inventory_batches')
    .select('*, supplier:suppliers(id, supplier_name, supplier_code)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InventoryBatch[];
}

export async function fetchBatch(id: string): Promise<InventoryBatch | null> {
  const { data, error } = await supabase
    .from('inventory_batches')
    .select('*, supplier:suppliers(id, supplier_name, supplier_code)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as InventoryBatch | null;
}

export async function fetchBatchesBySupplier(supplierId: string): Promise<InventoryBatch[]> {
  const { data, error } = await supabase
    .from('inventory_batches')
    .select('*')
    .eq('supplier_id', supplierId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InventoryBatch[];
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
  const batch_code = await generateBusinessIdRpc('BAT');
  const total = totalBatchCost(input);
  const status = total > 0 ? 'Purchased' : 'Draft';

  const { data, error } = await supabase
    .from('inventory_batches')
    .insert({
      ...input,
      batch_code,
      total_batch_cost: total,
      status,
    })
    .select()
    .single();
  if (error) throw error;

  await logActivity('Batch Created', 'Inventory', (data as InventoryBatch).id, `Created batch ${(data as InventoryBatch).batch_code}`);
  return data as InventoryBatch;
}

export async function updateBatch(id: string, patch: Partial<InventoryBatch>): Promise<InventoryBatch> {
  const { data, error } = await supabase
    .from('inventory_batches')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as InventoryBatch;
}

export async function archiveBatch(id: string): Promise<void> {
  const { error } = await supabase
    .from('inventory_batches')
    .update({ status: 'Archived' })
    .eq('id', id);
  if (error) throw error;
}

// ---------- Products ----------

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, batch:inventory_batches(id, batch_code, batch_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function fetchProductsByBatch(batchId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Product[];
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
  const product_code = await generateBusinessIdRpc('PRD');
  const { data, error } = await supabase
    .from('products')
    .insert({
      ...input,
      product_code,
      current_stock: input.initial_stock,
      reorder_level: input.reorder_level ?? 0,
    })
    .select()
    .single();
  if (error) throw error;

  // recompute the parent batch via RPC
  await supabase.rpc('recompute_batch', { p_batch_id: input.batch_id });

  await logActivity('Product Added', 'Inventory', (data as Product).id, `Added product ${(data as Product).product_name}`);
  return data as Product;
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

// ---------- Sales (uses RPC for atomicity) ----------

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
}): Promise<{ success: boolean; message: string; data?: any }> {
  const { data, error } = await supabase.rpc('record_sale', {
    p_product_id: input.product_id,
    p_customer_id: input.customer_id ?? null,
    p_quantity: input.quantity,
    p_unit_price: input.unit_price,
    p_discount: input.discount ?? 0,
    p_discount_type: input.discount_type ?? 'Amount',
    p_payment_method: input.payment_method,
    p_notes: input.notes ?? null,
    p_sale_date: input.sale_date ?? new Date().toISOString(),
  });
  if (error) throw error;
  return data;
}

export async function voidSale(saleId: string): Promise<{ success: boolean; message: string }> {
  const { data, error } = await supabase.rpc('void_sale', { p_sale_id: saleId });
  if (error) throw error;
  return data;
}

export async function fetchSales(limit?: number): Promise<SaleWithRelations[]> {
  let q = supabase
    .from('sales')
    .select('*, product:products(id, product_name, brand), customer:customers(id, customer_name), batch:inventory_batches(id, batch_code, batch_name)')
    .order('sale_date', { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SaleWithRelations[];
}

export async function fetchSalesByBatch(batchId: string): Promise<SaleWithRelations[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, product:products(id, product_name, brand), customer:customers(id, customer_name)')
    .eq('batch_id', batchId)
    .order('sale_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SaleWithRelations[];
}

export async function fetchSalesByCustomer(customerId: string): Promise<SaleWithRelations[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, product:products(id, product_name, brand), batch:inventory_batches(id, batch_code, batch_name)')
    .eq('customer_id', customerId)
    .order('sale_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SaleWithRelations[];
}

// ---------- Expenses ----------

export async function fetchExpenses(): Promise<ExpenseWithBatch[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, batch:inventory_batches(id, batch_code, batch_name)')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ExpenseWithBatch[];
}

export async function fetchExpensesByBatch(batchId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('batch_id', batchId)
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Expense[];
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
  const expense_code = await generateBusinessIdRpc('EXP');
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...input, expense_code })
    .select()
    .single();
  if (error) throw error;

  // If batch expense, recompute batch and create a Needs wallet outflow
  if (input.expense_type === 'Batch' && input.batch_id) {
    await supabase.rpc('recompute_batch_if_active', { p_batch_id: input.batch_id });
    await createWalletTransaction({
      wallet: 'Needs',
      transaction_type: 'Expense',
      batch_id: input.batch_id,
      amount: input.amount,
      reason: `Expense: ${input.expense_name}`,
    });
  } else {
    // Business expense also deducts from Needs wallet
    await createWalletTransaction({
      wallet: 'Needs',
      transaction_type: 'Expense',
      amount: input.amount,
      reason: `Business expense: ${input.expense_name}`,
    });
  }

  await logActivity('Expense Added', 'Expenses', (data as Expense).id, `Recorded ${input.expense_type} expense ${input.expense_name} (${input.amount})`);
  return data as Expense;
}

// ---------- Wallets ----------

export async function fetchWalletTransactions(): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*, batch:inventory_batches(id, batch_code, batch_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WalletTransaction[];
}

export async function fetchWalletTransactionsByWallet(wallet: WalletName): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet', wallet)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WalletTransaction[];
}

export async function createWalletTransaction(input: {
  wallet: WalletName;
  transaction_type: 'Allocation' | 'Expense' | 'Transfer' | 'Withdrawal' | 'Adjustment';
  batch_id?: string | null;
  reference_id?: string | null;
  amount: number;
  reason?: string | null;
}): Promise<WalletTransaction> {
  const transaction_code = await generateBusinessIdRpc('WTX');
  const { data, error } = await supabase
    .from('wallet_transactions')
    .insert({ ...input, transaction_code })
    .select()
    .single();
  if (error) throw error;
  return data as WalletTransaction;
}

export async function closeBatch(batchId: string): Promise<{ success: boolean; message: string; data?: any }> {
  const { data, error } = await supabase.rpc('close_batch', { p_batch_id: batchId });
  if (error) throw error;
  return data;
}

// ---------- Customers ----------

export async function fetchCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function fetchCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Customer | null;
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
  const customer_code = await generateBusinessIdRpc('CUS');
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...input, customer_code })
    .select()
    .single();
  if (error) throw error;
  await logActivity('Customer Created', 'Customers', (data as Customer).id, `Added customer ${(data as Customer).customer_name}`);
  return data as Customer;
}

export async function updateCustomer(id: string, patch: Partial<Customer>): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Customer;
}

// ---------- Notifications ----------

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('read', false);
  if (error) throw error;
}

// ---------- Activity logs ----------

export async function logActivity(action: string, module: string, referenceId?: string, description?: string): Promise<void> {
  const log_code = await generateBusinessIdRpc('LOG');
  await supabase.from('activity_logs').insert({
    log_code,
    action,
    module,
    reference_id: referenceId ?? null,
    description: description ?? null,
  });
}

export async function fetchActivityLogs(limit: number = 50): Promise<any[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
