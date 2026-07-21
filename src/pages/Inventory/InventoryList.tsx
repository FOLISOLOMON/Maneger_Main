// Veloura Manager V2 — Inventory Batches list
// Spec section 7.8: active / completed / archived tabs, batch cards with
// name, supplier, completion, profit, remaining stock, status.

import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Package, ChevronRight } from 'lucide-react';
import { useInventorySnapshot, useCreateBatch } from '../../hooks/queries';
import { useApp } from '../../contexts/AppContext';
import { formatMoney, formatMoneyCompact, formatPercent, formatDate } from '../../utils/format';
import { Card, Badge, ProgressBar, EmptyState, LoadingState, ErrorState, SectionHeader } from '../../components/common/Card';
import { Pagination } from '../../components/common/Pagination';
import { SearchBar } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Field, Input, Select, Textarea } from '../../components/common/Form';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { useToast } from '../../components/common/Toast';
import { BATCH_STATUS_META, ACTIVE_BATCH_STATUSES } from '../../constants';
import { todayInputDate } from '../../utils/format';
import { totalBatchCost } from '../../services/calculations';
import type { BatchWithSupplier } from '../../types';

type Tab = 'active' | 'completed' | 'archived' | 'all';

export function InventoryList() {
  const { currencySymbol } = useApp();
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const { data: snapshot, isLoading, isError, refetch } = useInventorySnapshot();
  const batches = snapshot?.batches;
  const products = snapshot?.products;
  const suppliers = snapshot?.suppliers;
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const createBatch = useCreateBatch();
  const toast = useToast();

  useFabRegistration({
    label: 'New Batch',
    icon: Plus,
    onClick: () => setCreateOpen(true),
  });

  const filtered = useMemo(() => {
    const all = batches ?? [];
    const byTab = all.filter((b) => {
      if (tab === 'active') return ACTIVE_BATCH_STATUSES.includes(b.status);
      if (tab === 'completed') return b.status === 'Completed';
      if (tab === 'archived') return b.status === 'Archived';
      return true;
    });
    if (!search.trim()) return byTab;
    const q = search.toLowerCase();
    return byTab.filter((b) =>
      b.batch_name.toLowerCase().includes(q) ||
      b.batch_code.toLowerCase().includes(q) ||
      (b as BatchWithSupplier).supplier?.supplier_name?.toLowerCase().includes(q),
    );
  }, [batches, tab, search]);

  useEffect(() => { setPage(0); }, [tab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleBatches = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const batchInitialStock = useMemo(() => {
    const map: Record<string, number> = {};
    (products ?? []).forEach((p) => {
      map[p.batch_id] = (map[p.batch_id] || 0) + p.initial_stock;
    });
    return map;
  }, [products]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'archived', label: 'Archived' },
    { key: 'all', label: 'All' },
  ];

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Couldn't load batches" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader title="Inventory" subtitle="Manage your stock purchase cycles" />

      <SearchBar value={search} onChange={setSearch} placeholder="Search batches…" />

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-action text-white' : 'bg-surface text-text-secondary border border-border hover:bg-surface-alt'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<Package className="w-7 h-7" />}
            title={search ? 'No matching batches' : 'No batches yet'}
            description={search ? 'Try a different search term.' : 'Create your first inventory batch to start tracking stock.'}
            action={!search && <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Batch</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {visibleBatches.map((b) => {
              const meta = BATCH_STATUS_META[b.status] || BATCH_STATUS_META.Draft;
              return (
                <Link key={b.id} to={`/inventory/${b.id}`}>
                  <Card padding="md" hover>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-bold text-text-primary truncate">{b.batch_name}</h3>
                          <Badge color={meta.color} dot={meta.dot}>{meta.label}</Badge>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">
                          {b.batch_code} · {(b as BatchWithSupplier).supplier?.supplier_name ?? 'Unknown supplier'} · {formatDate(b.purchase_date)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0 mt-1" />
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <Stat label="Revenue" value={formatMoneyCompact(b.gross_revenue, currencySymbol)} />
                      <Stat label="Net Profit" value={formatMoneyCompact(b.net_profit, currencySymbol)} valueClass={b.net_profit >= 0 ? 'text-success' : 'text-danger'} />
                      <Stat label="ROI" value={formatPercent(b.roi)} />
                      <Stat label="Stock" value={`${b.remaining_stock}/${batchInitialStock[b.id] ?? 0}`} />
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <ProgressBar value={b.completion_percentage} barClassName={b.completion_percentage >= 100 ? 'bg-success' : 'bg-accent'} />
                      <span className="text-xs font-semibold text-text-secondary tabular-nums flex-shrink-0 w-10 text-right">{formatPercent(b.completion_percentage, 0)}</span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <CreateBatchModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        suppliers={suppliers ?? []}
        currencySymbol={currencySymbol}
        creating={createBatch.isPending}
        onCreate={async (payload) => {
          try {
            await createBatch.mutateAsync(payload);
            toast('Batch created successfully', 'success');
            setCreateOpen(false);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to create batch';
            toast(message, 'error');
          }
        }}
      />
    </div>
  );
}

function Stat({ label, value, valueClass = 'text-text-primary' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-text-muted font-medium uppercase tracking-wide">{label}</p>
    </div>
  );
}

interface CreateBatchModalProps {
  open: boolean;
  onClose: () => void;
  suppliers: { id: string; supplier_name: string }[];
  currencySymbol: string;
  creating: boolean;
  onCreate: (payload: {
    supplier_id: string;
    batch_name: string;
    purchase_date: string;
    expected_arrival: string | null;
    purchase_cost: number;
    transport_cost: number;
    loading_cost: number;
    import_duty: number;
    insurance: number;
    other_costs: number;
    notes: string | null;
  }) => void;
}

export function CreateBatchModal({ open, onClose, suppliers, currencySymbol, creating, onCreate }: CreateBatchModalProps) {
  const [supplierId, setSupplierId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayInputDate());
  const [expectedArrival, setExpectedArrival] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [transportCost, setTransportCost] = useState('');
  const [loadingCost, setLoadingCost] = useState('');
  const [importDuty, setImportDuty] = useState('');
  const [insurance, setInsurance] = useState('');
  const [otherCosts, setOtherCosts] = useState('');
  const [notes, setNotes] = useState('');
  const toast = useToast();

  const reset = () => {
    setSupplierId(''); setBatchName(''); setPurchaseDate(todayInputDate()); setExpectedArrival('');
    setPurchaseCost(''); setTransportCost(''); setLoadingCost(''); setImportDuty(''); setInsurance('');
    setOtherCosts(''); setNotes('');
  };

  const total = totalBatchCost({
    purchase_cost: Number(purchaseCost) || 0,
    transport_cost: Number(transportCost) || 0,
    loading_cost: Number(loadingCost) || 0,
    import_duty: Number(importDuty) || 0,
    insurance: Number(insurance) || 0,
    other_costs: Number(otherCosts) || 0,
  });

  const submit = () => {
    if (!supplierId) { toast('Choose a supplier', 'error'); return; }
    if (!batchName.trim()) { toast('Batch name is required', 'error'); return; }
    onCreate({
      supplier_id: supplierId,
      batch_name: batchName.trim(),
      purchase_date: purchaseDate,
      expected_arrival: expectedArrival || null,
      purchase_cost: Number(purchaseCost) || 0,
      transport_cost: Number(transportCost) || 0,
      loading_cost: Number(loadingCost) || 0,
      import_duty: Number(importDuty) || 0,
      insurance: Number(insurance) || 0,
      other_costs: Number(otherCosts) || 0,
      notes: notes.trim() || null,
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Inventory Batch"
      subtitle="One complete stock purchase cycle"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={creating}>Create Batch</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Supplier" required>
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} invalid={!supplierId && open}>
            <option value="">Select a supplier…</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </Select>
        </Field>
        <Field label="Batch name" required>
          <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="e.g. Dubai Trip June 2026" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase date">
            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </Field>
          <Field label="Expected arrival">
            <Input type="date" value={expectedArrival} onChange={(e) => setExpectedArrival(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-xl bg-surface-alt p-3 space-y-3">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Purchase Costs</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Inventory cost">
              <Input type="number" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
            </Field>
            <Field label="Transport">
              <Input type="number" value={transportCost} onChange={(e) => setTransportCost(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
            </Field>
            <Field label="Loading">
              <Input type="number" value={loadingCost} onChange={(e) => setLoadingCost(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
            </Field>
            <Field label="Import duty">
              <Input type="number" value={importDuty} onChange={(e) => setImportDuty(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
            </Field>
            <Field label="Insurance">
              <Input type="number" value={insurance} onChange={(e) => setInsurance(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
            </Field>
            <Field label="Other costs">
              <Input type="number" value={otherCosts} onChange={(e) => setOtherCosts(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
            </Field>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm font-semibold text-text-secondary">Total batch cost</span>
            <span className="text-lg font-display font-bold text-accent tabular-nums">{formatMoney(total, currencySymbol)}</span>
          </div>
        </div>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember about this batch" />
        </Field>
      </div>
    </Modal>
  );
}
