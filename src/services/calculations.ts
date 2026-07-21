// Veloura Manager V2 — Calculation Engine
// Spec section 4.12: "Never calculate business values directly in components.
// Create reusable services." This is that service. Every page and hook calls
// these pure functions — no business math anywhere else in the UI layer.

import type {
  BatchHealth,
  BatchHealthResult,
  Customer,
  CustomerStats,
  Expense,
  InventoryBatch,
  Product,
  Sale,
  Settings,
  SupplierStats,
  WalletBalance,
  WalletName,
  WalletTransaction,
} from '../types';

// ---------- Batch math ----------

export function totalBatchCost(batch: Pick<InventoryBatch, 'purchase_cost' | 'transport_cost' | 'loading_cost' | 'import_duty' | 'insurance' | 'other_costs'>): number {
  return (
    (Number(batch.purchase_cost) || 0) +
    (Number(batch.transport_cost) || 0) +
    (Number(batch.loading_cost) || 0) +
    (Number(batch.import_duty) || 0) +
    (Number(batch.insurance) || 0) +
    (Number(batch.other_costs) || 0)
  );
}

export function batchGrossProfit(revenue: number, cogs: number): number {
  return (Number(revenue) || 0) - (Number(cogs) || 0);
}

export function batchNetProfit(grossProfit: number, batchExpenses: number): number {
  return (Number(grossProfit) || 0) - (Number(batchExpenses) || 0);
}

export function roi(netProfit: number, totalCost: number): number {
  if (!totalCost || totalCost <= 0) return 0;
  return ((Number(netProfit) || 0) / totalCost) * 100;
}

export function completionPercentage(soldUnits: number, purchasedUnits: number): number {
  if (!purchasedUnits || purchasedUnits <= 0) return 0;
  return (soldUnits / purchasedUnits) * 100;
}

// ---------- Product / stock math ----------

export function profitMargin(sellingPrice: number, costPrice: number): number {
  if (!sellingPrice || sellingPrice <= 0) return 0;
  return ((sellingPrice - costPrice) / sellingPrice) * 100;
}

export function stockValue(products: Pick<Product, 'current_stock' | 'cost_price'>[]): number {
  return products.reduce((sum, p) => sum + (p.current_stock * p.cost_price), 0);
}

export function remainingStockValue(products: Pick<Product, 'current_stock' | 'cost_price'>[]): number {
  return stockValue(products);
}

export function isLowStock(product: Pick<Product, 'current_stock' | 'reorder_level'>, globalThreshold: number): boolean {
  const threshold = product.reorder_level > 0 ? product.reorder_level : globalThreshold;
  return product.current_stock <= threshold && product.current_stock > 0;
}

export function isOutOfStock(product: Pick<Product, 'current_stock'>): boolean {
  return product.current_stock <= 0;
}

// ---------- Wallet math ----------

export function walletBalances(
  transactions: WalletTransaction[],
): WalletBalance[] {
  const wallets: WalletName[] = ['Needs', 'Savings', 'Growth'];

  // Defensive: the Sheets backend can return a single object or null instead of
  // an array (e.g. before the web app is redeployed). Coerce to an array so the
  // UI never crashes on a malformed/empty response.
  const list = Array.isArray(transactions)
    ? transactions
    : transactions && typeof transactions === 'object'
      ? [transactions]
      : [];

  return wallets.map((wallet) => {
    const txs = list.filter((t) => t && t.wallet === wallet);
    // Allocation, Adjustment, Transfer-in are positive; Expense, Withdrawal, Transfer-out are negative.
    // In our ledger, amount is stored positive for inflows and we flip for outflows by type.
    let balance = 0;
    let income = 0;
    let outflow = 0;
    for (const t of txs) {
      const amount = Number(t.amount) || 0;
      const isOutflow = ['Expense', 'Withdrawal'].includes(t.transaction_type);
      if (isOutflow) {
        balance -= amount;
        outflow += amount;
      } else {
        balance += amount;
        income += amount;
      }
    }
    return { wallet, balance, income, outflow };
  });
}

export function walletAllocation(netProfit: number, settings: Pick<Settings, 'needs_percentage' | 'savings_percentage' | 'growth_percentage'>) {
  const net = Number(netProfit) || 0;
  if (net <= 0) {
    return { needs: 0, savings: 0, growth: 0, total: 0 };
  }
  const needs = (net * (settings.needs_percentage / 100));
  const savings = (net * (settings.savings_percentage / 100));
  const growth = (net * (settings.growth_percentage / 100));
  return { needs, savings, growth, total: needs + savings + growth };
}

export function businessCash(wallets: WalletBalance[]): number {
  return wallets.reduce((sum, w) => sum + w.balance, 0);
}

export function walletBalancesByBatch(
  transactions: WalletTransaction[],
  batchId: string | null,
): WalletBalance[] {
  const wallets: WalletName[] = ['Needs', 'Savings', 'Growth'];
  const list = Array.isArray(transactions)
    ? transactions
    : transactions && typeof transactions === 'object'
      ? [transactions]
      : [];
  const filtered = batchId
    ? list.filter((t) => t && t.batch_id === batchId)
    : list;

  return wallets.map((wallet) => {
    const txs = filtered.filter((t) => t && t.wallet === wallet);
    let balance = 0;
    let income = 0;
    let outflow = 0;
    for (const t of txs) {
      const amount = Number(t.amount) || 0;
      const isOutflow = ['Expense', 'Withdrawal'].includes(t.transaction_type);
      if (isOutflow) {
        balance -= amount;
        outflow += amount;
      } else {
        balance += amount;
        income += amount;
      }
    }
    return { wallet, balance, income, outflow };
  });
}

export function batchAllocationTotals(
  transactions: WalletTransaction[],
  batchId: string | null,
): { wallet: WalletName; amount: number }[] {
  const wallets: WalletName[] = ['Needs', 'Savings', 'Growth'];
  const list = Array.isArray(transactions)
    ? transactions
    : transactions && typeof transactions === 'object'
      ? [transactions]
      : [];
  const filtered = batchId
    ? list.filter((t) => t && t.batch_id === batchId && t.transaction_type === 'Allocation')
    : list.filter((t) => t && t.transaction_type === 'Allocation');

  return wallets.map((wallet) => ({
    wallet,
    amount: filtered
      .filter((t) => t && t.wallet === wallet)
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
  }));
}

// ---------- Sale math ----------

export function saleTotalSale(unitPrice: number, quantity: number, discount: number, discountType: 'Amount' | 'Percent'): number {
  const gross = (Number(unitPrice) || 0) * (Number(quantity) || 0);
  if (discountType === 'Percent') {
    return gross - (gross * (Number(discount) || 0) / 100);
  }
  return gross - (Number(discount) || 0);
}

export function saleProfit(unitPrice: number, unitCost: number, quantity: number, discount: number, discountType: 'Amount' | 'Percent'): number {
  const totalSale = saleTotalSale(unitPrice, quantity, discount, discountType);
  const totalCost = (Number(unitCost) || 0) * (Number(quantity) || 0);
  return totalSale - totalCost;
}

// ---------- Batch health (spec 2.17) ----------

export function batchHealth(
  batch: Pick<InventoryBatch, 'roi' | 'completion_percentage' | 'remaining_stock' | 'net_profit' | 'status'>,
  ageInDays: number,
): BatchHealthResult {
  let score = 50;
  const reasons: string[] = [];

  // ROI contribution (0-30)
  if (batch.roi >= 50) { score += 30; reasons.push('Excellent ROI'); }
  else if (batch.roi >= 25) { score += 20; reasons.push('Good ROI'); }
  else if (batch.roi >= 10) { score += 10; }
  else if (batch.roi < 0) { score -= 20; reasons.push('Negative ROI'); }

  // Completion (0-20) — higher completion with positive profit is good
  if (batch.completion_percentage >= 90 && batch.net_profit > 0) { score += 20; }
  else if (batch.completion_percentage >= 50) { score += 10; }

  // Profit (0-20)
  if (batch.net_profit > 0) { score += 15; }
  else if (batch.net_profit < 0) { score -= 15; reasons.push('Net loss'); }

  // Stale batch penalty
  if (ageInDays > 90 && batch.status !== 'Completed') {
    score -= 15;
    reasons.push('Batch is stale');
  }

  score = Math.max(0, Math.min(100, score));

  let health: BatchHealth;
  if (score >= 80) health = 'Excellent';
  else if (score >= 65) health = 'Good';
  else if (score >= 45) health = 'Average';
  else if (score >= 25) health = 'Poor';
  else health = 'Critical';

  return { health, score, reasons };
}

// ---------- Customer stats (spec 5.18 — computed, not stored) ----------

export function customerStats(customerId: string, sales: Sale[]): CustomerStats {
  const completed = sales.filter(
    (s) => s.customer_id === customerId && s.status === 'Completed',
  );
  const totalSpent = completed.reduce((sum, s) => sum + s.total_sale, 0);
  const totalOrders = completed.length;
  const averageOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;

  // favorite product by total quantity
  const productCounts: Record<string, { name: string; qty: number }> = {};
  for (const s of completed) {
    const key = s.product_id;
    if (!productCounts[key]) productCounts[key] = { name: key, qty: 0 };
    productCounts[key].qty += s.quantity;
  }
  const favorite = Object.values(productCounts).sort((a, b) => b.qty - a.qty)[0];

  const lastPurchase = completed
    .map((s) => s.sale_date)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  return {
    totalSpent,
    totalOrders,
    averageOrder,
    favoriteProduct: favorite?.name ?? null,
    lastPurchase,
  };
}

// ---------- Supplier stats (computed) ----------

export function supplierStats(
  batches: InventoryBatch[],
): SupplierStats {
  const batchCount = batches.length;
  const totalPurchaseCost = batches.reduce((sum, b) => sum + b.total_batch_cost, 0);
  const profits = batches.map((b) => b.net_profit);
  const averageProfit = batchCount > 0 ? profits.reduce((a, b) => a + b, 0) / batchCount : 0;

  const lastBatch = batches
    .sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime())[0];

  const best = batches
    .filter((b) => b.status === 'Completed')
    .sort((a, b) => b.net_profit - a.net_profit)[0];

  return {
    batchCount,
    totalPurchaseCost,
    averageProfit,
    lastBatchDate: lastBatch?.purchase_date ?? null,
    bestBatchCode: best?.batch_code ?? null,
    bestBatchProfit: best?.net_profit ?? 0,
  };
}

// ---------- Expense aggregates ----------

export function expenseTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function expensesByCategory(expenses: Expense[]): { category: string; total: number }[] {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    map[e.category] = (map[e.category] ?? 0) + e.amount;
  }
  return Object.entries(map)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

// ---------- Reinvestment capacity (spec 3.13) ----------

export function reinvestmentCapacity(
  savingsBalance: number,
  needsBalance: number,
): { capacity: number; canAfford: (cost: number) => boolean } {
  const capacity = (Number(savingsBalance) || 0) + (Number(needsBalance) || 0);
  return {
    capacity,
    canAfford: (cost: number) => capacity >= cost,
  };
}

// ---------- Dashboard KPIs ----------

export function filterSalesToday(sales: Sale[]): Sale[] {
  const today = new Date().toDateString();
  return sales.filter(
    (s) => new Date(s.sale_date).toDateString() === today && s.status === 'Completed',
  );
}

export function filterExpensesToday(expenses: Expense[]): Expense[] {
  const today = new Date().toDateString();
  return expenses.filter((e) => new Date(e.expense_date).toDateString() === today);
}

export function countLowStock(products: Product[], threshold: number): number {
  return products.filter((p) => isLowStock(p, threshold)).length;
}

// Customer helper kept for type completeness; stats are computed in selectors.
export function customerLifetimeValue(customer: Customer, sales: Sale[]): number {
  return customerStats(customer.id, sales).totalSpent;
}
