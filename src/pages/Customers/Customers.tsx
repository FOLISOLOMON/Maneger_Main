// Veloura Manager V2 — Customers page
// Spec section 7.12 + 3.10. Customer cards with stats (computed from sales,
// per spec 5.18). Detail modal shows purchase history + lifetime value.

import { useMemo, useState } from 'react';
import { Users, Plus, Search, Phone, MapPin } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useCustomers, useSales, useCreateCustomer } from '../../hooks/queries';
import { customerStats, customerLifetimeValue } from '../../services/calculations';
import { formatMoney, formatMoneyCompact, initials, formatRelative } from '../../utils/format';
import { Card, EmptyState, LoadingState, ErrorState, SectionHeader } from '../../components/common/Card';
import { SearchBar } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Field, Input, Select, Textarea } from '../../components/common/Form';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { useToast } from '../../components/common/Toast';

export function Customers() {
  const { currencySymbol } = useApp();
  const { data: customers, isLoading, isError, refetch } = useCustomers();
  const { data: sales } = useSales();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const createCustomer = useCreateCustomer();
  const toast = useToast();

  useFabRegistration({ label: 'New Customer', icon: Plus, onClick: () => setCreateOpen(true) });

  const filtered = useMemo(() => {
    const all = customers ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((c) => c.customer_name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, search]);

  const detailCustomer = (customers ?? []).find((c) => c.id === detailId);
  const detailStats = detailCustomer ? customerStats(detailCustomer.id, sales ?? []) : null;
  const detailSales = (sales ?? []).filter((s) => s.customer_id === detailId && s.status === 'Completed').slice(0, 10);

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Couldn't load customers" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader title="Customers" subtitle="Buyers and their purchase history" />

      <SearchBar value={search} onChange={setSearch} placeholder="Search customers by name or phone…" />

      {filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title={search ? 'No matching customers' : 'No customers yet'}
            description={search ? 'Try a different search.' : 'Add your first customer to track their purchases.'}
            action={!search && <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Customer</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const stats = customerStats(c.id, sales ?? []);
            return (
              <Card key={c.id} padding="md" hover onClick={() => setDetailId(c.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-plum-100 text-plum-700 flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
                    {initials(c.customer_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">{c.customer_name}</p>
                    {c.phone && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {c.phone}</p>}
                    {c.location && <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {c.location}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{formatMoneyCompact(stats.totalSpent, currencySymbol)}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Lifetime</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      <Modal
        open={!!detailId}
        onClose={() => setDetailId(null)}
        title={detailCustomer?.customer_name ?? 'Customer'}
        subtitle={detailCustomer?.phone ?? undefined}
        size="md"
      >
        {detailCustomer && detailStats && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-display font-bold text-slate-900 tabular-nums">{formatMoneyCompact(detailStats.totalSpent, currencySymbol)}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total spent</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-display font-bold text-slate-900 tabular-nums">{detailStats.totalOrders}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Orders</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-lg font-display font-bold text-slate-900 tabular-nums">{formatMoneyCompact(detailStats.averageOrder, currencySymbol)}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Avg order</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recent purchases</p>
              {detailSales.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No purchases yet.</p>
              ) : (
                <div className="space-y-2">
                  {detailSales.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{s.product?.product_name ?? 'Product'} × {s.quantity}</p>
                        <p className="text-xs text-slate-500">{formatRelative(s.sale_date)}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-slate-900">{formatMoney(s.total_sale, currencySymbol)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <CreateCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        creating={createCustomer.isPending}
        onCreate={async (payload) => {
          try {
            await createCustomer.mutateAsync(payload);
            toast('Customer added', 'success');
            setCreateOpen(false);
          } catch (e: any) {
            toast(e.message ?? 'Failed to add customer', 'error');
          }
        }}
      />
    </div>
  );
}

interface CreateCustomerModalProps {
  open: boolean;
  onClose: () => void;
  creating: boolean;
  onCreate: (payload: any) => void;
}

function CreateCustomerModal({ open, onClose, creating, onCreate }: CreateCustomerModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState('');
  const [notes, setNotes] = useState('');
  const toast = useToast();

  const reset = () => { setName(''); setPhone(''); setLocation(''); setGender(''); setNotes(''); };

  const submit = () => {
    if (!name.trim()) { toast('Customer name is required', 'error'); return; }
    onCreate({
      customer_name: name.trim(),
      phone: phone.trim() || null,
      location: location.trim() || null,
      gender: (gender || null) as any,
      notes: notes.trim() || null,
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Customer"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={creating}>Add Customer</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Customer name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024…" />
          </Field>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City / area" />
          </Field>
        </div>
        <Field label="Gender">
          <Select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Not specified</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferences, scent likes, etc." />
        </Field>
      </div>
    </Modal>
  );
}
