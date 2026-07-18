// Veloura Manager V2 — Reports page
// Spec section 7.16 + 3.15. Report type cards open detail views with KPIs,
// charts, and tables. Period selector (today/week/month/year).

import { useMemo, useState } from 'react';
import {
  Building, Package, Truck, Box, Users, Receipt, Wallet, Coins,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../../contexts/AppContext';
import {
  useBatches, useProducts, useSales, useExpenses,
  useWalletTransactions, useSuppliers, useCustomers,
} from '../../hooks/queries';
import {
  walletBalances, businessCash, expenseTotal, expensesByCategory,
} from '../../services/calculations';
import { formatMoney, formatMoneyCompact, formatPercent } from '../../utils/format';
import { Card, EmptyState, LoadingState, SectionHeader } from '../../components/common/Card';
import { ChartCard, CHART_COLORS } from '../../components/charts/ChartCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { subDays, parseISO, format, isAfter, eachDayOfInterval } from 'date-fns';
import type {
  Customer,
  ExpenseWithBatch,
  InventoryBatch,
  Product,
  SaleWithRelations,
  Supplier,
  WalletBalance,
  WalletTransaction,
} from '../../types';

type ReportType = 'business' | 'batch' | 'product' | 'customer' | 'supplier' | 'expense' | 'wallet' | 'financial';
type Period = 'today' | 'week' | 'month' | 'year';

const REPORTS: { key: ReportType; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'business', label: 'Business', icon: Building, color: 'bg-plum-50 text-plum-700' },
  { key: 'financial', label: 'Financial', icon: Coins, color: 'bg-emerald-50 text-emerald-600' },
  { key: 'batch', label: 'Batch', icon: Package, color: 'bg-blue-50 text-blue-600' },
  { key: 'product', label: 'Product', icon: Box, color: 'bg-amber-50 text-amber-600' },
  { key: 'supplier', label: 'Supplier', icon: Truck, color: 'bg-slate-100 text-slate-700' },
  { key: 'customer', label: 'Customer', icon: Users, color: 'bg-rose-50 text-rose-600' },
  { key: 'expense', label: 'Expense', icon: Receipt, color: 'bg-red-50 text-red-600' },
  { key: 'wallet', label: 'Wallet', icon: Wallet, color: 'bg-gold-50 text-gold-700' },
];

export function Reports() {
  const { currencySymbol } = useApp();
  const [active, setActive] = useState<ReportType>('business');
  const [period, setPeriod] = useState<Period>('month');

  const { data: batches } = useBatches();
  const { data: products } = useProducts();
  const { data: sales } = useSales();
  const { data: expenses } = useExpenses();
  const { data: walletTx } = useWalletTransactions();
  const { data: suppliers } = useSuppliers();
  const { data: customers } = useCustomers();

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'today') return subDays(now, 1);
    if (period === 'week') return subDays(now, 7);
    if (period === 'month') return subDays(now, 30);
    return subDays(now, 365);
  }, [period]);

  const periodSales = useMemo(
    () => (sales ?? []).filter((s) => s.status === 'Completed' && isAfter(parseISO(s.sale_date), periodStart)),
    [sales, periodStart],
  );
  const periodExpenses = useMemo(
    () => (expenses ?? []).filter((e) => isAfter(parseISO(e.expense_date + 'T00:00:00'), periodStart)),
    [expenses, periodStart],
  );

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: '7 days' },
    { key: 'month', label: '30 days' },
    { key: 'year', label: '1 year' },
  ];

  const isLoading = !batches || !sales || !expenses;
  if (isLoading) return <LoadingState rows={4} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader title="Reports" subtitle="Analyze your business performance" />

      {/* Report type grid */}
      <div className="grid grid-cols-4 gap-2">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={clsx(
              'flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all',
              active === r.key ? 'border-plum-500 bg-plum-50 ring-2 ring-plum-100' : 'border-slate-200 bg-white hover:bg-slate-50',
            )}
          >
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', r.color)}>
              <r.icon className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-slate-700 text-center">{r.label}</span>
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={clsx(
              'px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors',
              period === p.key ? 'bg-plum-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Report content */}
      <ReportContent
        type={active}
        currencySymbol={currencySymbol}
        batches={batches ?? []}
        products={products ?? []}
        sales={periodSales}
        expenses={periodExpenses}
        walletTx={walletTx ?? []}
        suppliers={suppliers ?? []}
        customers={customers ?? []}
      />
    </div>
  );
}

interface ReportContentProps {
  type: ReportType;
  currencySymbol: string;
  batches: InventoryBatch[];
  products: Product[];
  sales: SaleWithRelations[];
  expenses: ExpenseWithBatch[];
  walletTx: WalletTransaction[];
  suppliers: Supplier[];
  customers: Customer[];
}

function ReportContent({ type, currencySymbol, batches, products, sales, expenses, walletTx, suppliers, customers }: ReportContentProps) {
  if (type === 'business') return <BusinessReport currencySymbol={currencySymbol} batches={batches} sales={sales} expenses={expenses} />;
  if (type === 'financial') return <FinancialReport currencySymbol={currencySymbol} sales={sales} expenses={expenses} walletTx={walletTx} />;
  if (type === 'batch') return <BatchReport currencySymbol={currencySymbol} batches={batches} />;
  if (type === 'product') return <ProductReport currencySymbol={currencySymbol} products={products} sales={sales} />;
  if (type === 'supplier') return <SupplierReport currencySymbol={currencySymbol} batches={batches} suppliers={suppliers} />;
  if (type === 'customer') return <CustomerReport currencySymbol={currencySymbol} customers={customers} sales={sales} />;
  if (type === 'expense') return <ExpenseReport currencySymbol={currencySymbol} expenses={expenses} />;
  if (type === 'wallet') return <WalletReport currencySymbol={currencySymbol} walletTx={walletTx} />;
  return null;
}

function KpiGrid({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((k) => (
        <Card key={k.label} padding="sm">
          <p className={`text-lg font-display font-bold tabular-nums ${k.color ?? 'text-slate-900'}`}>{k.value}</p>
          <p className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">{k.label}</p>
        </Card>
      ))}
    </div>
  );
}

function BusinessReport({ currencySymbol, batches, sales, expenses }: { currencySymbol: string; batches: InventoryBatch[]; sales: SaleWithRelations[]; expenses: ExpenseWithBatch[] }) {
  const totalRevenue = sales.reduce((s: number, x: SaleWithRelations) => s + x.total_sale, 0);
  const totalProfit = sales.reduce((s: number, x: SaleWithRelations) => s + x.profit, 0);
  const totalExpenses = expenseTotal(expenses);
  const activeBatches = batches.filter((b: InventoryBatch) => !['Completed', 'Archived'].includes(b.status)).length;

  const trend = useMemo(() => buildTrend(sales, 14), [sales]);

  return (
    <div className="space-y-4">
      <KpiGrid items={[
        { label: 'Revenue', value: formatMoneyCompact(totalRevenue, currencySymbol) },
        { label: 'Profit', value: formatMoneyCompact(totalProfit, currencySymbol), color: 'text-emerald-600' },
        { label: 'Expenses', value: formatMoneyCompact(totalExpenses, currencySymbol), color: 'text-red-600' },
        { label: 'Active batches', value: `${activeBatches}` },
      ]} />
      <ChartCard title="Revenue trend" subtitle="Last 14 days">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.plum} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.plum} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyCompact(Number(v), currencySymbol)} />
            <Tooltip formatter={(v) => formatMoney(Number(v), currencySymbol)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.plum} strokeWidth={2.5} fill="url(#rev)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function FinancialReport({ currencySymbol, sales, expenses, walletTx }: { currencySymbol: string; sales: SaleWithRelations[]; expenses: ExpenseWithBatch[]; walletTx: WalletTransaction[] }) {
  const totalRevenue = sales.reduce((s: number, x: SaleWithRelations) => s + x.total_sale, 0);
  const totalCogs = sales.reduce((s: number, x: SaleWithRelations) => s + x.total_cost, 0);
  const grossProfit = totalRevenue - totalCogs;
  const batchExpenses = expenses.filter((e: ExpenseWithBatch) => e.expense_type === 'Batch').reduce((s: number, e: ExpenseWithBatch) => s + e.amount, 0);
  const businessExpenses = expenses.filter((e: ExpenseWithBatch) => e.expense_type === 'Business').reduce((s: number, e: ExpenseWithBatch) => s + e.amount, 0);
  const netProfit = grossProfit - batchExpenses;
  const wallets = walletBalances(walletTx);
  const cash = businessCash(wallets);

  return (
    <div className="space-y-4">
      <KpiGrid items={[
        { label: 'Gross revenue', value: formatMoneyCompact(totalRevenue, currencySymbol) },
        { label: 'Gross profit', value: formatMoneyCompact(grossProfit, currencySymbol), color: 'text-emerald-600' },
        { label: 'Net profit', value: formatMoneyCompact(netProfit, currencySymbol), color: netProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
        { label: 'Business cash', value: formatMoneyCompact(cash, currencySymbol) },
      ]} />
      <Card padding="md">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cash flow breakdown</p>
        <div className="space-y-2 text-sm">
          <FlowRow label="Sales revenue" value={formatMoney(totalRevenue, currencySymbol)} />
          <FlowRow label="Cost of goods sold" value={`-${formatMoney(totalCogs, currencySymbol)}`} valueClass="text-red-600" />
          <FlowRow label="Gross profit" value={formatMoney(grossProfit, currencySymbol)} bold />
          <FlowRow label="Batch expenses" value={`-${formatMoney(batchExpenses, currencySymbol)}`} valueClass="text-red-600" />
          <FlowRow label="Net batch profit" value={formatMoney(netProfit, currencySymbol)} bold />
          <FlowRow label="Business expenses" value={`-${formatMoney(businessExpenses, currencySymbol)}`} valueClass="text-red-600" />
        </div>
      </Card>
    </div>
  );
}

function FlowRow({ label, value, valueClass = 'text-slate-900', bold }: { label: string; value: string; valueClass?: string; bold?: boolean }) {
  return (
    <div className={clsx('flex justify-between items-center py-1', bold && 'border-t border-slate-100 pt-2 font-display font-bold')}>
      <span className="text-slate-600">{label}</span>
      <span className={clsx('tabular-nums', valueClass, bold && 'text-base')}>{value}</span>
    </div>
  );
}

function BatchReport({ currencySymbol, batches }: { currencySymbol: string; batches: InventoryBatch[] }) {
  const completed = batches.filter((b: InventoryBatch) => b.status === 'Completed');
  const sorted = [...batches].sort((a, b) => b.net_profit - a.net_profit).slice(0, 8);
  const data = sorted.map((b) => ({ name: b.batch_code, profit: b.net_profit, revenue: b.gross_revenue }));

  return (
    <div className="space-y-4">
      <KpiGrid items={[
        { label: 'Total batches', value: `${batches.length}` },
        { label: 'Completed', value: `${completed.length}` },
        { label: 'Avg ROI', value: formatPercent(batches.reduce((s: number, b: InventoryBatch) => s + b.roi, 0) / (batches.length || 1)) },
        { label: 'Total profit', value: formatMoneyCompact(batches.reduce((s: number, b: InventoryBatch) => s + b.net_profit, 0), currencySymbol), color: 'text-emerald-600' },
      ]} />
      {data.length > 0 && (
        <ChartCard title="Profit by batch" subtitle="Top batches by net profit">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyCompact(Number(v), currencySymbol)} />
              <Tooltip formatter={(v) => formatMoney(Number(v), currencySymbol)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="profit" fill={CHART_COLORS.plum} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

function ProductReport({ currencySymbol, products, sales }: { currencySymbol: string; products: Product[]; sales: SaleWithRelations[] }) {
  const productPerf = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; profit: number; qty: number }> = {};
    for (const s of sales) {
      const key = s.product_id;
      if (!map[key]) map[key] = { name: s.product?.product_name ?? 'Product', revenue: 0, profit: 0, qty: 0 };
      map[key].revenue += s.total_sale;
      map[key].profit += s.profit;
      map[key].qty += s.quantity;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales]);

  return (
    <div className="space-y-4">
      <KpiGrid items={[
        { label: 'Products', value: `${products.length}` },
        { label: 'In stock', value: `${products.reduce((s: number, p: Product) => s + p.current_stock, 0)}` },
        { label: 'Sold (period)', value: `${sales.reduce((s: number, x: SaleWithRelations) => s + x.quantity, 0)}` },
        { label: 'Revenue', value: formatMoneyCompact(sales.reduce((s: number, x: SaleWithRelations) => s + x.total_sale, 0), currencySymbol) },
      ]} />
      {productPerf.length > 0 ? (
        <Card padding="md">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Top products</p>
          <div className="space-y-2">
            {productPerf.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="w-6 h-6 rounded-lg bg-plum-50 text-plum-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.qty} sold</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-900 tabular-nums">{formatMoney(p.revenue, currencySymbol)}</p>
                  <p className="text-xs text-emerald-600 tabular-nums">+{formatMoney(p.profit, currencySymbol)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card padding="lg"><EmptyState icon={<Box className="w-7 h-7" />} title="No sales in this period" /></Card>
      )}
    </div>
  );
}

function SupplierReport({ currencySymbol, batches, suppliers }: { currencySymbol: string; batches: InventoryBatch[]; suppliers: Supplier[] }) {
  const supplierPerf = useMemo(() => {
    return suppliers.map((s: Supplier) => {
      const sb = batches.filter((b: InventoryBatch) => b.supplier_id === s.id);
      return {
        name: s.supplier_name,
        batches: sb.length,
        profit: sb.reduce((sum: number, b: InventoryBatch) => sum + b.net_profit, 0),
        cost: sb.reduce((sum: number, b: InventoryBatch) => sum + b.total_batch_cost, 0),
      };
    }).filter((x) => x.batches > 0).sort((a, b) => b.profit - a.profit);
  }, [suppliers, batches]);

  return (
    <div className="space-y-4">
      <KpiGrid items={[
        { label: 'Suppliers', value: `${suppliers.length}` },
        { label: 'With batches', value: `${supplierPerf.length}` },
        { label: 'Total purchases', value: formatMoneyCompact(supplierPerf.reduce((s: number, x) => s + x.cost, 0), currencySymbol) },
        { label: 'Total profit', value: formatMoneyCompact(supplierPerf.reduce((s: number, x) => s + x.profit, 0), currencySymbol), color: 'text-emerald-600' },
      ]} />
      {supplierPerf.length > 0 ? (
        <Card padding="md">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Supplier performance</p>
          <div className="space-y-2">
            {supplierPerf.map((s, i: number) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.batches} batch{s.batches === 1 ? '' : 'es'} · {formatMoney(s.cost, currencySymbol)} spent</p>
                </div>
                <p className="text-sm font-bold text-emerald-600 tabular-nums flex-shrink-0">+{formatMoney(s.profit, currencySymbol)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card padding="lg"><EmptyState icon={<Truck className="w-7 h-7" />} title="No supplier activity" /></Card>
      )}
    </div>
  );
}

function CustomerReport({ currencySymbol, customers, sales }: { currencySymbol: string; customers: Customer[]; sales: SaleWithRelations[] }) {
  const customerPerf = useMemo(() => {
    const map: Record<string, { name: string; spent: number; orders: number }> = {};
    for (const s of sales) {
      if (!s.customer_id) continue;
      if (!map[s.customer_id]) map[s.customer_id] = { name: s.customer?.customer_name ?? 'Customer', spent: 0, orders: 0 };
      map[s.customer_id].spent += s.total_sale;
      map[s.customer_id].orders += 1;
    }
    return Object.values(map).sort((a, b) => b.spent - a.spent).slice(0, 10);
  }, [sales]);

  return (
    <div className="space-y-4">
      <KpiGrid items={[
        { label: 'Customers', value: `${customers.length}` },
        { label: 'Active buyers', value: `${customerPerf.length}` },
        { label: 'Avg order', value: formatMoneyCompact(sales.reduce((s: number, x: SaleWithRelations) => s + x.total_sale, 0) / (sales.length || 1), currencySymbol) },
        { label: 'Revenue', value: formatMoneyCompact(sales.reduce((s: number, x: SaleWithRelations) => s + x.total_sale, 0), currencySymbol) },
      ]} />
      {customerPerf.length > 0 ? (
        <Card padding="md">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Top customers</p>
          <div className="space-y-2">
            {customerPerf.map((c, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.orders} order{c.orders === 1 ? '' : 's'}</p>
                </div>
                <p className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">{formatMoney(c.spent, currencySymbol)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Card padding="lg"><EmptyState icon={<Users className="w-7 h-7" />} title="No customer sales in this period" /></Card>
      )}
    </div>
  );
}

function ExpenseReport({ currencySymbol, expenses }: { currencySymbol: string; expenses: ExpenseWithBatch[] }) {
  const total = expenseTotal(expenses);
  const byCat = expensesByCategory(expenses);
  const PIE_COLORS = [CHART_COLORS.plum, CHART_COLORS.gold, CHART_COLORS.emerald, CHART_COLORS.blue, CHART_COLORS.red, CHART_COLORS.slate];

  return (
    <div className="space-y-4">
      <KpiGrid items={[
        { label: 'Total expenses', value: formatMoneyCompact(total, currencySymbol), color: 'text-red-600' },
        { label: 'Batch expenses', value: formatMoneyCompact(expenses.filter((e: ExpenseWithBatch) => e.expense_type === 'Batch').reduce((s: number, e: ExpenseWithBatch) => s + e.amount, 0), currencySymbol) },
        { label: 'Business expenses', value: formatMoneyCompact(expenses.filter((e: ExpenseWithBatch) => e.expense_type === 'Business').reduce((s: number, e: ExpenseWithBatch) => s + e.amount, 0), currencySymbol) },
        { label: 'Categories', value: `${byCat.length}` },
      ]} />
      {byCat.length > 0 && (
        <ChartCard title="Spending by category">
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={160}>
              <PieChart>
                <Pie data={byCat.slice(0, 6)} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {byCat.slice(0, 6).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(Number(v), currencySymbol)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {byCat.slice(0, 6).map((c, i) => (
                <div key={c.category} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-700 font-medium flex-1 truncate">{c.category}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{formatMoney(c.total, currencySymbol)}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function WalletReport({ currencySymbol, walletTx }: { currencySymbol: string; walletTx: WalletTransaction[] }) {
  const wallets = walletBalances(walletTx);
  return (
    <div className="space-y-4">
      <KpiGrid items={wallets.map((w: WalletBalance) => ({
        label: w.wallet,
        value: formatMoneyCompact(w.balance, currencySymbol),
        color: w.balance >= 0 ? 'text-slate-900' : 'text-red-600',
      }))} />
      <Card padding="md">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Wallet flow</p>
        <div className="space-y-3">
          {wallets.map((w: WalletBalance) => (
            <div key={w.wallet}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold text-slate-700">{w.wallet}</span>
                <span className="font-bold tabular-nums text-slate-900">{formatMoney(w.balance, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span className="text-emerald-600">+{formatMoney(w.income, currencySymbol)} in</span>
                <span className="text-red-500">-{formatMoney(w.outflow, currencySymbol)} out</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function buildTrend(sales: SaleWithRelations[], days: number) {
  const end = new Date();
  const start = subDays(end, days - 1);
  return eachDayOfInterval({ start, end }).map((day) => {
    const daySales = sales.filter((s) => format(parseISO(s.sale_date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
    return { label: format(day, 'dd MMM'), revenue: daySales.reduce((sum, s) => sum + s.total_sale, 0) };
  });
}
