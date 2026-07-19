// Veloura Manager V2 — Expenses page
// Spec section 7.14 + 3.11. Tabs for batch vs business expenses. Unified
// create flow that asks expense type first, then batch (if batch), then
// category, amount, date.

import { useMemo, useState } from 'react';
import { Receipt, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../../contexts/AppContext';
import { useExpenses, useBatches, useCreateExpense } from '../../hooks/queries';
import { formatMoney, formatRelative, todayInputDate } from '../../utils/format';
import { Card, Badge, EmptyState, LoadingState, ErrorState, SectionHeader } from '../../components/common/Card';
import { SearchBar, StatCard } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Field, Input, Select, Textarea } from '../../components/common/Form';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { useToast } from '../../components/common/Toast';
import { BATCH_EXPENSE_CATEGORIES, BUSINESS_EXPENSE_CATEGORIES } from '../../constants';
import { expenseTotal, expensesByCategory } from '../../services/calculations';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartCard } from '../../components/charts/ChartCard';
import { chartColors } from '../../theme/designTokens';

type Tab = 'batch' | 'business';

export function Expenses() {
const { currencySymbol, theme } = useApp();
const { data: expenses, isLoading, isError, refetch } = useExpenses();
const charts = chartColors(theme);
const PIE_COLORS = [charts.accent, charts.accent, charts.success, charts.info, charts.danger, charts.neutral];
  const [tab, setTab] = useState<Tab>('batch');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const createExpense = useCreateExpense();
  const toast = useToast();

  useFabRegistration({ label: 'Add Expense', icon: Plus, onClick: () => setCreateOpen(true) });

  const filtered = useMemo(() => {
    const all = (expenses ?? []).filter((e) => e.expense_type === (tab === 'batch' ? 'Batch' : 'Business'));
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((e) =>
      e.expense_name.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.expense_code.toLowerCase().includes(q),
    );
  }, [expenses, tab, search]);

  const total = expenseTotal(filtered);
  const byCategory = expensesByCategory(filtered);

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Couldn't load expenses" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader title="Expenses" subtitle="Track batch and business costs" />

      <StatCard
        icon={Receipt}
        label={tab === 'batch' ? 'Total Batch Expenses' : 'Total Business Expenses'}
        value={formatMoney(total, currencySymbol)}
        hint={`${filtered.length} record${filtered.length === 1 ? '' : 's'}`}
        iconBg="bg-warning-bg"
        accent="text-warning"
      />

      <div className="flex gap-1.5">
        {(['batch', 'business'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-colors',
              tab === t ? 'bg-action text-white' : 'bg-surface text-text-secondary border border-border hover:bg-surface-alt',
            )}
          >
            {t} Expenses
          </button>
        ))}
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search expenses…" />

      {byCategory.length > 0 && (
        <ChartCard title="Spending by Category" subtitle={tab === 'batch' ? 'Batch expenses' : 'Business expenses'}>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={140}>
              <PieChart>
                <Pie data={byCategory.slice(0, 6)} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2}>
                  {byCategory.slice(0, 6).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(Number(v), currencySymbol)}             contentStyle={{ borderRadius: 12, border: `1px solid ${charts.grid}`, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {byCategory.slice(0, 5).map((c, i) => (
                <div key={c.category} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-text-secondary font-medium flex-1 truncate">{c.category}</span>
                  <span className="font-semibold tabular-nums text-text-primary">{formatMoney(c.total, currencySymbol)}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      )}

      {filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<Receipt className="w-7 h-7" />}
            title={search ? 'No matching expenses' : 'No expenses yet'}
            description={search ? 'Try a different search.' : 'Record your first expense to track spending.'}
            action={!search && <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Add Expense</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((e) => (
            <Card key={e.id} padding="sm" className="flex items-center gap-3" hover>
              <div className="w-10 h-10 rounded-xl bg-warning-bg text-warning flex items-center justify-center flex-shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-text-primary truncate">{e.expense_name}</p>
                  <Badge color="bg-surface-alt text-text-secondary">{e.category}</Badge>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {e.expense_code} · {formatRelative(e.expense_date)}
                  {e.batch && ` · ${e.batch.batch_code}`}
                </p>
              </div>
              <p className="text-sm font-bold text-text-primary tabular-nums flex-shrink-0">-{formatMoney(e.amount, currencySymbol)}</p>
            </Card>
          ))}
        </div>
      )}

      <CreateExpenseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        currencySymbol={currencySymbol}
        creating={createExpense.isPending}
        onCreate={async (payload) => {
          try {
            await createExpense.mutateAsync(payload);
            toast('Expense recorded', 'success');
            setCreateOpen(false);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to record expense';
            toast(message, 'error');
          }
        }}
      />
    </div>
  );
}

interface CreateExpensePayload {
  expense_type: 'Batch' | 'Business';
  batch_id: string | null;
  category: string;
  expense_name: string;
  amount: number;
  expense_date: string;
  description: string | null;
}

interface CreateExpenseModalProps {
  open: boolean;
  onClose: () => void;
  currencySymbol: string;
  creating: boolean;
  onCreate: (payload: CreateExpensePayload) => void;
}

function CreateExpenseModal({ open, onClose, currencySymbol, creating, onCreate }: CreateExpenseModalProps) {
  const { data: batches } = useBatches();
  const [type, setType] = useState<'Batch' | 'Business'>('Batch');
  const [batchId, setBatchId] = useState('');
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInputDate());
  const [description, setDescription] = useState('');
  const toast = useToast();

  const categories = type === 'Batch' ? BATCH_EXPENSE_CATEGORIES : BUSINESS_EXPENSE_CATEGORIES;
  const activeBatches = (batches ?? []).filter((b) => !['Archived'].includes(b.status));

  const reset = () => {
    setType('Batch'); setBatchId(''); setCategory(''); setName(''); setAmount('');
    setDate(todayInputDate()); setDescription('');
  };

  const submit = () => {
    if (type === 'Batch' && !batchId) { toast('Select a batch', 'error'); return; }
    if (!category) { toast('Choose a category', 'error'); return; }
    if (!name.trim()) { toast('Expense name is required', 'error'); return; }
    const amt = Number(amount) || 0;
    if (amt <= 0) { toast('Amount must be greater than 0', 'error'); return; }
    onCreate({
      expense_type: type,
      batch_id: type === 'Batch' ? batchId : null,
      category,
      expense_name: name.trim(),
      amount: amt,
      expense_date: date,
      description: description.trim() || null,
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Expense"
      subtitle="Record a batch or business expense"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={creating}>Save Expense</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Expense type" required>
          <div className="grid grid-cols-2 gap-2">
            {(['Batch', 'Business'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setType(t); setCategory(''); setBatchId(''); }}
                className={clsx(
                  'h-11 rounded-xl text-sm font-semibold border transition-colors',
                  type === t ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-border text-text-secondary hover:bg-surface-alt',
                )}
              >
                {t} Expense
              </button>
            ))}
          </div>
        </Field>

        {type === 'Batch' && (
          <Field label="Batch" required>
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} invalid={!batchId && open}>
              <option value="">Select a batch…</option>
              {activeBatches.map((b) => <option key={b.id} value={b.id}>{b.batch_name} ({b.batch_code})</option>)}
            </Select>
          </Field>
        )}

        <Field label="Category" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} invalid={!category && open}>
            <option value="">Select…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>

        <Field label="Expense name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fuel to market" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" required>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details" />
        </Field>
      </div>
    </Modal>
  );
}
