// Veloura Manager V2 — Dashboard
// Spec section 3.5 / 7.6: greeting, business health, quick stats, wallet
// cards, batch summary, sales chart, recent activity, quick actions.
// All KPIs flow through the calculation engine — no math in the component.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Wallet, PiggyBank, Package, AlertTriangle, ShoppingBag,
  Receipt, Plus, PackagePlus, ShoppingCart, ArrowRight, Activity,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useDashboardSnapshot } from '../../hooks/queries';
import {
  walletBalances, businessCash, filterSalesToday, filterExpensesToday,
  countLowStock, saleTotalSale,
} from '../../services/calculations';
import { formatMoney, formatMoneyCompact, formatRelative, formatPercent } from '../../utils/format';
import { Card, SectionHeader, EmptyState, LoadingState, ProgressBar, Badge } from '../../components/common/Card';
import { StatCard } from '../../components/common/StatCard';
import { ChartCard, CHART_COLORS } from '../../components/charts/ChartCard';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { BATCH_STATUS_META, WALLET_META } from '../../constants';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, parseISO, eachDayOfInterval, subDays, isSameDay } from 'date-fns';

export function Dashboard() {
  const { currencySymbol } = useApp();
  const { data: snapshot, isLoading: batchesLoading } = useDashboardSnapshot();
  const settings = snapshot?.settings ?? undefined;
  const batches = snapshot?.batches;
  const products = snapshot?.products;
  const sales = snapshot?.sales;
  const expenses = snapshot?.expenses;
  const walletTx = snapshot?.walletTx;
  const [quickOpen, setQuickOpen] = useState(false);

  useFabRegistration({
    label: 'Quick Actions',
    onClick: () => setQuickOpen(true),
  });

  const kpis = useMemo(() => {
    const allSales = sales ?? [];
    const allExpenses = expenses ?? [];
    const allProducts = products ?? [];
    const allBatches = batches ?? [];
    const allTx = walletTx ?? [];

    const todaySales = filterSalesToday(allSales);
    const todayExpenses = filterExpensesToday(allExpenses);
    const wallets = walletBalances(allTx);

    return {
      todaySalesCount: todaySales.length,
      todaySalesTotal: todaySales.reduce((s, x) => s + x.total_sale, 0),
      todayProfit: todaySales.reduce((s, x) => s + x.profit, 0),
      todayExpenses: todayExpenses.reduce((s, e) => s + e.amount, 0),
      businessCash: businessCash(wallets),
      wallets,
      activeBatches: allBatches.filter((b) => ['Draft', 'Purchased', 'Selling', 'Almost Finished'].includes(b.status)).length,
      completedBatches: allBatches.filter((b) => b.status === 'Completed').length,
      lowStock: countLowStock(allProducts, settings?.low_stock_threshold ?? 5),
    };
  }, [sales, expenses, products, batches, walletTx, settings]);

  const chartData = useMemo(() => buildSalesChart(sales ?? [], 7), [sales]);

  const recentSales = useMemo(() => (sales ?? []).slice(0, 5), [sales]);
  const recentExpenses = useMemo(() => (expenses ?? []).slice(0, 4), [expenses]);
  const activeBatches = useMemo(
    () => (batches ?? []).filter((b) => ['Selling', 'Almost Finished', 'Purchased'].includes(b.status)).slice(0, 3),
    [batches],
  );

  if (batchesLoading) return <LoadingState rows={4} />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-extrabold text-2xl text-slate-900 tracking-tight">
            Hi, {settings?.owner_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Here's how {settings?.business_name ?? 'your business'} is doing today.</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={ShoppingBag}
          label="Today's Sales"
          value={formatMoney(kpis.todaySalesTotal, currencySymbol)}
          hint={`${kpis.todaySalesCount} sale${kpis.todaySalesCount === 1 ? '' : 's'}`}
          iconBg="bg-plum-50"
          accent="text-plum-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Today's Profit"
          value={formatMoney(kpis.todayProfit, currencySymbol)}
          hint="From completed sales"
          iconBg="bg-emerald-50"
          accent="text-emerald-600"
        />
        <StatCard
          icon={Receipt}
          label="Today's Expenses"
          value={formatMoney(kpis.todayExpenses, currencySymbol)}
          hint="Batch + business"
          iconBg="bg-amber-50"
          accent="text-amber-600"
        />
        <StatCard
          icon={Wallet}
          label="Business Cash"
          value={formatMoney(kpis.businessCash, currencySymbol)}
          hint="Across all wallets"
          iconBg="bg-blue-50"
          accent="text-blue-600"
        />
      </div>

      {/* Wallet cards */}
      <div>
        <SectionHeader title="Wallets" subtitle="Net profit allocations" action={<Link to="/wallets" className="text-xs font-semibold text-plum-700 hover:underline">View all</Link>} />
        <div className="grid grid-cols-3 gap-3">
          {kpis.wallets.map((w) => {
            const meta = WALLET_META[w.wallet];
            return (
              <Card key={w.wallet} padding="sm" className="text-center" hover>
                <Link to="/wallets">
                  <div className={`w-9 h-9 rounded-xl ${meta.bg} mx-auto flex items-center justify-center mb-2`}>
                    {w.wallet === 'Needs' && <Wallet className={`w-5 h-5 ${meta.color}`} />}
                    {w.wallet === 'Savings' && <PiggyBank className={`w-5 h-5 ${meta.color}`} />}
                    {w.wallet === 'Growth' && <TrendingUp className={`w-5 h-5 ${meta.color}`} />}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">{meta.label}</p>
                  <p className="text-sm font-display font-bold text-slate-900 mt-0.5 tabular-nums">
                    {formatMoneyCompact(w.balance, currencySymbol)}
                  </p>
                </Link>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Sales chart */}
      <ChartCard title="Sales (last 7 days)" subtitle="Daily revenue trend">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.plum} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS.plum} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatMoneyCompact(Number(v), currencySymbol)} />
            <Tooltip
              formatter={(v) => [formatMoney(Number(v), currencySymbol), 'Revenue']}
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            />
            <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.plum} strokeWidth={2.5} fill="url(#salesGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Batch summary */}
      <div>
        <SectionHeader
          title="Active Batches"
          subtitle={`${kpis.activeBatches} active · ${kpis.completedBatches} completed`}
          action={<Link to="/inventory" className="text-xs font-semibold text-plum-700 hover:underline">View all</Link>}
        />
        {activeBatches.length === 0 ? (
          <Card padding="md">
            <EmptyState
              icon={<Package className="w-7 h-7" />}
              title="No active batches"
              description="Create a batch to start tracking inventory."
              action={<Link to="/inventory"><Button size="sm"><Plus className="w-4 h-4" /> New Batch</Button></Link>}
            />
          </Card>
        ) : (
          <div className="space-y-2.5">
            {activeBatches.map((b) => {
              const meta = BATCH_STATUS_META[b.status];
              return (
                <Link key={b.id} to={`/inventory/${b.id}`}>
                  <Card padding="md" hover className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 text-sm truncate">{b.batch_name}</p>
                        <Badge color={meta.color} dot={meta.dot}>{meta.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {b.batch_code} · {b.remaining_stock} in stock · {formatMoney(b.net_profit, currencySymbol)} profit
                      </p>
                      <div className="mt-2">
                        <ProgressBar value={b.completion_percentage} barClassName={b.completion_percentage > 80 ? 'bg-emerald-500' : 'bg-plum-600'} />
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <SectionHeader title="Recent Sales" action={<Link to="/sales" className="text-xs font-semibold text-plum-700 hover:underline">All</Link>} />
          {recentSales.length === 0 ? (
            <Card padding="md"><EmptyState icon={<ShoppingBag className="w-7 h-7" />} title="No sales yet" description="Record your first sale to see it here." /></Card>
          ) : (
            <div className="space-y-2">
              {recentSales.map((s) => (
                <Card key={s.id} padding="sm" className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-plum-50 text-plum-700 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{s.product?.product_name ?? 'Product'}</p>
                    <p className="text-xs text-slate-500">{s.customer?.customer_name ?? 'Walk-in'} · {formatRelative(s.sale_date)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{formatMoney(s.total_sale, currencySymbol)}</p>
                    <p className="text-xs text-emerald-600 font-semibold tabular-nums">+{formatMoney(s.profit, currencySymbol)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader title="Recent Expenses" action={<Link to="/expenses" className="text-xs font-semibold text-plum-700 hover:underline">All</Link>} />
          {recentExpenses.length === 0 ? (
            <Card padding="md"><EmptyState icon={<Receipt className="w-7 h-7" />} title="No expenses yet" description="Record an expense to track spending." /></Card>
          ) : (
            <div className="space-y-2">
              {recentExpenses.map((e) => (
                <Card key={e.id} padding="sm" className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{e.expense_name}</p>
                    <p className="text-xs text-slate-500">{e.category} · {formatRelative(e.expense_date)}</p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 tabular-nums flex-shrink-0">-{formatMoney(e.amount, currencySymbol)}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {kpis.lowStock > 0 && (
        <Link to="/inventory">
          <Card padding="md" className="bg-amber-50 border-amber-200 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">{kpis.lowStock} product{kpis.lowStock === 1 ? '' : 's'} low on stock</p>
              <p className="text-xs text-amber-700">Tap to review and restock.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-600" />
          </Card>
        </Link>
      )}

      {/* Quick actions modal */}
      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title="Quick Actions" subtitle="Jump straight to a common task">
        <div className="grid grid-cols-2 gap-3 pb-2">
          <QuickAction icon={PackagePlus} label="New Batch" to="/inventory" color="bg-plum-50 text-plum-700" />
          <QuickAction icon={ShoppingCart} label="Record Sale" to="/sales" color="bg-emerald-50 text-emerald-600" />
          <QuickAction icon={PackagePlus} label="Add Product" to="/inventory" color="bg-blue-50 text-blue-600" />
          <QuickAction icon={Receipt} label="Add Expense" to="/expenses" color="bg-amber-50 text-amber-600" />
          <QuickAction icon={Activity} label="View Reports" to="/reports" color="bg-slate-100 text-slate-700" />
          <QuickAction icon={Wallet} label="Wallets" to="/wallets" color="bg-gold-50 text-gold-700" />
        </div>
      </Modal>
    </div>
  );
}

function QuickAction({ icon: Icon, label, to, color }: { icon: any; label: string; to: string; color: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-card-hover transition-all active:scale-95">
      <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-sm font-semibold text-slate-700 text-center">{label}</span>
    </Link>
  );
}

function buildSalesChart(sales: any[], days: number) {
  const end = new Date();
  const start = subDays(end, days - 1);
  const range = eachDayOfInterval({ start, end });
  return range.map((day) => {
    const daySales = sales.filter((s) => isSameDay(parseISO(s.sale_date), day) && s.status === 'Completed');
    const revenue = daySales.reduce((sum, s) => sum + saleTotalSale(s.unit_price, s.quantity, s.discount, s.discount_type), 0);
    return {
      label: format(day, 'EEE'),
      revenue: Math.round(revenue * 100) / 100,
    };
  });
}
