// Veloura Manager V2 — Calculation Engine
// Spec section 4.12: "Never calculate business values directly in components.
// Create reusable services." This is that service. Every page and hook calls
// these pure functions — no business math anywhere else in the UI layer.

import type {
  BatchHealth,
  BatchHealthResult,
  CustomerStats,
  Expense,
  InventoryBatch,
  Payment,
  PaymentStatus,
  Product,
  Sale,
  SaleWithRelations,
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

// ---------- Product / stock math ----------

export function profitMargin(sellingPrice: number, costPrice: number): number {
  if (!sellingPrice || sellingPrice <= 0) return 0;
  return ((sellingPrice - costPrice) / sellingPrice) * 100;
}

export function isLowStock(product: Pick<Product, 'current_stock' | 'reorder_level'>, globalThreshold: number): boolean {
  const threshold = product.reorder_level > 0 ? product.reorder_level : globalThreshold;
  return product.current_stock <= threshold && product.current_stock > 0;
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

export function businessCash(wallets: WalletBalance[]): number {
  return wallets.reduce((sum, w) => sum + w.balance, 0);
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

export function totalReceivables(sales: Sale[]): number {
  return sales
    .filter((s) => s.payment_status !== 'paid' && s.status === 'Completed')
    .reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
}

export function customerBalance(customerId: string, sales: Sale[], payments: Payment[]): number {
  const saleBalances = sales
    .filter((s) => s.customer_id === customerId && s.status === 'Completed')
    .reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
  const unallocated = payments
    .filter((p) => p.customer_id === customerId && !p.sale_id)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return Math.max(saleBalances - unallocated, 0);
}

export function saleBalance(sale: Sale): { amountPaid: number; balance: number; status: PaymentStatus } {
  return {
    amountPaid: Number(sale.amount_paid || 0),
    balance: Number(sale.balance || sale.total_sale || 0),
    status: sale.payment_status || 'pending',
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

// ---------- Profit realization (profit reinvestment spec) ----------

export function realizedProfit(batches: InventoryBatch[]): number {
  return batches
    .filter((b) => Number(b.gross_revenue || 0) > 0)
    .reduce((sum, b) => sum + Number(b.net_profit || 0), 0);
}

export function unrealizedProfit(products: Product[]): number {
  return products.reduce((sum, p) => {
    const margin = Number(p.selling_price || 0) - Number(p.cost_price || 0);
    return sum + margin * Number(p.current_stock || 0);
  }, 0);
}

export function availableProfit(realized: number, walletTx: WalletTransaction[]): number {
  const allocated = (walletTx ?? [])
    .filter((t) => t.transaction_type === 'Allocation')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  return Math.round((realized - allocated) * 100) / 100;
}

export function pendingProfit(batches: InventoryBatch[], products: Product[]): number {
  const activeBatchIds = new Set(
    batches
      .filter((b) => !['Completed', 'Archived'].includes(b.status))
      .map((b) => b.id),
  );
  const remaining = products.filter((p) => activeBatchIds.has(p.batch_id));
  return unrealizedProfit(remaining);
}

export function agingReceivables(sales: SaleWithRelations[], limit = 5) {
  const now = Date.now();
  return sales
    .filter((s) => s.payment_status !== 'paid' && s.status === 'Completed')
    .map((s) => ({
      ...s,
      daysSinceSale: Math.floor((now - new Date(s.sale_date).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => (Number(b.balance) || 0) - (Number(a.balance) || 0))
    .slice(0, limit);
}
