// Veloura Manager V2 — Suppliers page
// Spec section 7.13 + 3.6. Supplier cards with computed stats (batch count,
// avg profit, total purchases). Detail modal shows batch history.

import { useMemo, useState } from 'react';
import { Truck, Plus, MapPin, Phone, Package } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useSuppliers, useBatches, useCreateSupplier } from '../../hooks/queries';
import { supplierStats } from '../../services/calculations';
import { formatMoney, formatMoneyCompact, formatDate } from '../../utils/format';
import { Card, Badge, EmptyState, LoadingState, ErrorState, SectionHeader } from '../../components/common/Card';
import { SearchBar } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Field, Input, Textarea } from '../../components/common/Form';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { useToast } from '../../components/common/Toast';
import { BATCH_STATUS_META } from '../../constants';
import { Link } from 'react-router-dom';

export function Suppliers() {
  const { currencySymbol } = useApp();
  const { data: suppliers, isLoading, isError, refetch } = useSuppliers();
  const { data: batches } = useBatches();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const createSupplier = useCreateSupplier();
  const toast = useToast();

  useFabRegistration({ label: 'Add Supplier', icon: Plus, onClick: () => setCreateOpen(true) });

  const filtered = useMemo(() => {
    const all = (suppliers ?? []).filter((s) => s.status !== 'Deleted');
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((s) => s.supplier_name.toLowerCase().includes(q) || (s.location ?? '').toLowerCase().includes(q));
  }, [suppliers, search]);

  const detailSupplier = (suppliers ?? []).find((s) => s.id === detailId);
  const detailBatches = (batches ?? []).filter((b) => b.supplier_id === detailId);

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Couldn't load suppliers" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader title="Suppliers" subtitle="Vendors you buy inventory from" />

      <SearchBar value={search} onChange={setSearch} placeholder="Search suppliers…" />

      {filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<Truck className="w-7 h-7" />}
            title={search ? 'No matching suppliers' : 'No suppliers yet'}
            description={search ? 'Try a different search.' : 'Add a supplier to start creating batches.'}
            action={!search && <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Add Supplier</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const supplierBatches = (batches ?? []).filter((b) => b.supplier_id === s.id);
            const stats = supplierStats(supplierBatches);
            return (
              <Card key={s.id} padding="md" hover onClick={() => setDetailId(s.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-plum-50 text-plum-700 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900 text-sm truncate">{s.supplier_name}</p>
                      {s.status === 'Archived' && <Badge color="bg-slate-100 text-slate-500">Archived</Badge>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}</span>}
                    </p>
                    {s.phone && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {s.phone}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{stats.batchCount}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Batches</p>
                  </div>
                </div>
                {stats.batchCount > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
                    <div>
                      <p className="text-xs font-bold text-slate-900 tabular-nums">{formatMoneyCompact(stats.totalPurchaseCost, currencySymbol)}</p>
                      <p className="text-[10px] text-slate-500 uppercase">Purchases</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-600 tabular-nums">{formatMoneyCompact(stats.averageProfit, currencySymbol)}</p>
                      <p className="text-[10px] text-slate-500 uppercase">Avg profit</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{stats.lastBatchDate ? formatDate(stats.lastBatchDate, 'MMM yy') : '—'}</p>
                      <p className="text-[10px] text-slate-500 uppercase">Last batch</p>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detailSupplier?.supplier_name ?? 'Supplier'}
        subtitle={detailSupplier?.location ?? undefined}
        size="md"
      >
        {detailSupplier && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {detailSupplier.phone && (
                <div className="flex items-center gap-2 text-slate-600"><Phone className="w-4 h-4" /> {detailSupplier.phone}</div>
              )}
              {detailSupplier.contact_person && (
                <div className="text-slate-600">Contact: {detailSupplier.contact_person}</div>
              )}
            </div>
            {detailSupplier.notes && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{detailSupplier.notes}</div>
            )}

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Batch history ({detailBatches.length})</p>
              {detailBatches.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No batches from this supplier yet.</p>
              ) : (
                <div className="space-y-2">
                  {detailBatches.slice(0, 8).map((b) => {
                    const meta = BATCH_STATUS_META[b.status];
                    return (
                      <Link key={b.id} to={`/inventory/${b.id}`} onClick={() => setDetailId(null)}>
                        <div className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 -mx-1 px-1 rounded-lg">
                          <Package className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{b.batch_name}</p>
                            <p className="text-xs text-slate-500">{b.batch_code} · {formatDate(b.purchase_date)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold tabular-nums text-slate-900">{formatMoney(b.net_profit, currencySymbol)}</p>
                            <Badge color={meta.color} dot={meta.dot}>{meta.label}</Badge>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <CreateSupplierModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        creating={createSupplier.isPending}
        onCreate={async (payload) => {
          try {
            await createSupplier.mutateAsync(payload);
            toast('Supplier added', 'success');
            setCreateOpen(false);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to add supplier';
            toast(message, 'error');
          }
        }}
      />
    </div>
  );
}

interface CreateSupplierModalProps {
  open: boolean;
  onClose: () => void;
  creating: boolean;
  onCreate: (payload: {
    supplier_name: string;
    phone: string | null;
    location: string | null;
    contact_person: string | null;
    notes: string | null;
  }) => void;
}

function CreateSupplierModal({ open, onClose, creating, onCreate }: CreateSupplierModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [notes, setNotes] = useState('');
  const toast = useToast();

  const reset = () => { setName(''); setPhone(''); setLocation(''); setContactPerson(''); setNotes(''); };

  const submit = () => {
    if (!name.trim()) { toast('Supplier name is required', 'error'); return; }
    onCreate({
      supplier_name: name.trim(),
      phone: phone.trim() || null,
      location: location.trim() || null,
      contact_person: contactPerson.trim() || null,
      notes: notes.trim() || null,
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Supplier"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={creating}>Add Supplier</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Supplier name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dubai Imports" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contact number" />
          </Field>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City / country" />
          </Field>
        </div>
        <Field label="Contact person">
          <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Name of your contact" />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, reliability, etc." />
        </Field>
      </div>
    </Modal>
  );
}
