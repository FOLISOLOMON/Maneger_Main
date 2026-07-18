// Veloura Manager V2 — Domain Types
// Mirrors the Supabase schema in src/types. Single source of truth for shapes.

export type BatchStatus =
  | 'Draft'
  | 'Purchased'
  | 'Selling'
  | 'Almost Finished'
  | 'Completed'
  | 'Archived';

export type ExpenseType = 'Batch' | 'Business';

export type WalletName = 'Needs' | 'Savings' | 'Growth';

export type WalletTxType =
  | 'Allocation'
  | 'Expense'
  | 'Transfer'
  | 'Withdrawal'
  | 'Adjustment';

export type SaleStatus = 'Completed' | 'Voided' | 'Refunded';

export type EntityStatus = 'Active' | 'Archived' | 'Deleted';

export type PaymentMethod =
  | 'Cash'
  | 'Mobile Money'
  | 'Bank Transfer'
  | 'Card'
  | 'Credit';

export type DiscountType = 'Amount' | 'Percent';

export type BatchHealth = 'Excellent' | 'Good' | 'Average' | 'Poor' | 'Critical';

export interface Settings {
  id: string;
  business_name: string;
  owner_name: string;
  phone: string | null;
  email: string | null;
  business_address: string | null;
  currency: string;
  currency_symbol: string;
  theme: 'light' | 'dark';
  low_stock_threshold: number;
  batch_completion_threshold: number;
  needs_percentage: number;
  savings_percentage: number;
  growth_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  supplier_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  contact_person: string | null;
  notes: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface InventoryBatch {
  id: string;
  batch_code: string;
  batch_name: string;
  supplier_id: string;
  purchase_date: string;
  expected_arrival: string | null;
  arrival_date: string | null;
  purchase_cost: number;
  transport_cost: number;
  loading_cost: number;
  import_duty: number;
  insurance: number;
  other_costs: number;
  total_batch_cost: number;
  status: BatchStatus;
  completion_percentage: number;
  remaining_stock: number;
  gross_revenue: number;
  gross_profit: number;
  net_profit: number;
  roi: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  product_code: string;
  batch_id: string;
  product_name: string;
  brand: string | null;
  category: string | null;
  sku: string | null;
  barcode: string | null;
  cost_price: number;
  selling_price: number;
  initial_stock: number;
  current_stock: number;
  reorder_level: number;
  description: string | null;
  image_url: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  customer_code: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  location: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  birthday: string | null;
  notes: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  sale_code: string;
  batch_id: string;
  product_id: string;
  customer_id: string | null;
  sale_date: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  discount: number;
  discount_type: DiscountType;
  total_cost: number;
  total_sale: number;
  profit: number;
  payment_method: PaymentMethod;
  reference_number: string | null;
  status: SaleStatus;
  notes: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  expense_code: string;
  expense_type: ExpenseType;
  batch_id: string | null;
  category: string;
  expense_name: string;
  amount: number;
  expense_date: string;
  description: string | null;
  receipt_url: string | null;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  transaction_code: string;
  wallet: WalletName;
  transaction_type: WalletTxType;
  batch_id: string | null;
  reference_id: string | null;
  amount: number;
  balance_after: number | null;
  reason: string | null;
  created_by: string;
  created_at: string;
}

export interface Notification {
  id: string;
  notification_code: string;
  type: string;
  title: string;
  message: string;
  reference_type: string | null;
  reference_id: string | null;
  priority: 'High' | 'Medium' | 'Low';
  read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  log_code: string;
  actor: string;
  action: string;
  module: string;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

// Joined / computed shapes used by the UI

export interface BatchWithSupplier extends InventoryBatch {
  supplier?: Pick<Supplier, 'id' | 'supplier_name' | 'supplier_code'>;
}

export interface ProductWithBatch extends Product {
  batch?: Pick<InventoryBatch, 'id' | 'batch_code' | 'batch_name'>;
}

export interface SaleWithRelations extends Sale {
  product?: Pick<Product, 'id' | 'product_name' | 'brand'>;
  customer?: Pick<Customer, 'id' | 'customer_name'> | null;
  batch?: Pick<InventoryBatch, 'id' | 'batch_code' | 'batch_name'>;
}

export interface ExpenseWithBatch extends Expense {
  batch?: Pick<InventoryBatch, 'id' | 'batch_code' | 'batch_name'> | null;
}

export interface WalletBalance {
  wallet: WalletName;
  balance: number;
  income: number;
  outflow: number;
}

export interface DashboardKPIs {
  todaySales: number;
  todayProfit: number;
  todayExpenses: number;
  businessCash: number;
  walletBalances: WalletBalance[];
  activeBatches: number;
  completedBatches: number;
  lowStockCount: number;
  totalSalesCount: number;
}

export interface BatchHealthResult {
  health: BatchHealth;
  score: number;
  reasons: string[];
}

export interface CustomerStats {
  totalSpent: number;
  totalOrders: number;
  averageOrder: number;
  favoriteProduct: string | null;
  lastPurchase: string | null;
}

export interface SupplierStats {
  batchCount: number;
  totalPurchaseCost: number;
  averageProfit: number;
  lastBatchDate: string | null;
  bestBatchCode: string | null;
  bestBatchProfit: number;
}
