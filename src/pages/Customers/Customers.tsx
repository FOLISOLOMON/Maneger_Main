// Veloura Manager V2 — Customers page
// Spec section 7.12 + 3.10. Customer cards with stats (computed from sales,
// per spec 5.18). Detail modal shows purchase history + lifetime value.

import { useMemo, useState, useEffect, useRef } from 'react';
import { Users, Plus, Phone, MapPin, Wallet, Banknote, Smartphone, CreditCard } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useCustomers, useSales, useCreateCustomer, useCreatePayment, usePayments } from '../../hooks/queries';
import { customerStats, customerBalance } from '../../services/calculations';
import { useSearchState } from '../../hooks/useSearchState';
import { formatMoney, formatMoneyCompact, initials, formatRelative } from '../../utils/format';
import { Card, EmptyState, LoadingState, ErrorState, SectionHeader } from '../../components/common/Card';
import { Pagination } from '../../components/common/Pagination';
import { SearchBar } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Field, Input, Select, Textarea } from '../../components/common/Form';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { useToast } from '../../components/common/Toast';
import type { SaleWithRelations } from '../../types';
import { PAYMENT_METHODS } from '../../constants';

export function Customers() {
  const { currencySymbol } = useApp();
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const { data: customers, isLoading, isError, refetch } = useCustomers();
  const { data: sales } = useSales();
  const { data: payments } = usePayments();
  const { query: search, setQuery: setSearch, recent, clearRecent } = useSearchState();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const createCustomer = useCreateCustomer();
  const createPayment = useCreatePayment();
  const toast = useToast();

  useFabRegistration({ label: 'New Customer', icon: Plus, onClick: () => setCreateOpen(true) });

  const filtered = useMemo(() => {
    const all = customers ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((c) => c.customer_name.toLowerCase().includes(q) || (c.phone ?? '').includes(q));
  }, [customers, search]);

  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleCustomers = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const detailCustomer = (customers ?? []).find((c) => c.id === detailId);
  const detailStats = detailCustomer ? customerStats(detailCustomer.id, sales ?? []) : null;
  const detailSales = (sales ?? []).filter((s) => s.customer_id === detailId && s.status === 'Completed').slice(0, 10);
  const detailBalance = detailCustomer ? customerBalance(detailCustomer.id, sales ?? [], payments ?? []) : 0;
  const detailPayments = useMemo(() => {
    if (!detailId) return [];
    return (payments ?? []).filter((p) => p.customer_id === detailId);
  }, [payments, detailId]);

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Couldn't load customers" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader title="Customers" subtitle="Buyers and their purchase history" />

      <SearchBar value={search} onChange={setSearch} recent={recent} onClearRecent={clearRecent} placeholder="Search customers by name or phone…" />

      {filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title={search ? 'No matching customers' : 'No customers yet'}
            description={search ? 'Try a different search.' : 'Add your first customer to start tracking balances and payment history.'}
            hint={!search ? 'Customers let you track balances and sales history. Add your first customer to enable credit sales.' : undefined}
            action={!search && <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> New Customer</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleCustomers.map((c) => {
              const stats = customerStats(c.id, sales ?? []);
              const balance = customerBalance(c.id, sales ?? [], payments ?? []);
              return (
                <Card key={c.id} padding="md" hover onClick={() => setDetailId(c.id)}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-accent/10 text-accent flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
                      {initials(c.customer_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary text-sm truncate">{c.customer_name}</p>
                      {c.phone && <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {c.phone}</p>}
                      {c.location && <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {c.location}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-text-primary tabular-nums">{formatMoneyCompact(stats.totalSpent, currencySymbol)}</p>
                      <p className="text-[10px] text-text-muted uppercase">Lifetime</p>
                      {balance > 0.01 && (
                        <>
                          <p className="text-xs font-bold text-warning tabular-nums mt-0.5">Bal: {formatMoneyCompact(balance, currencySymbol)}</p>
                          <p className="text-[10px] text-text-muted uppercase">Outstanding</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPayId(c.id); }}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:bg-accent/10 px-2 py-1 rounded-md transition-colors"
                          >
                            <Wallet className="w-3.5 h-3.5" /> Collect
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
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
              <div className="rounded-xl bg-surface-alt p-3">
                <p className="text-lg font-display font-bold text-text-primary tabular-nums">{formatMoneyCompact(detailStats.totalSpent, currencySymbol)}</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wide">Total spent</p>
              </div>
              <div className="rounded-xl bg-surface-alt p-3">
                <p className="text-lg font-display font-bold text-text-primary tabular-nums">{detailStats.totalOrders}</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wide">Orders</p>
              </div>
              <div className="rounded-xl bg-surface-alt p-3">
                <p className="text-lg font-display font-bold text-text-primary tabular-nums">{formatMoneyCompact(detailStats.averageOrder, currencySymbol)}</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wide">Avg order</p>
              </div>
            </div>

            {detailBalance > 0.01 && (
              <div className="rounded-xl bg-warning-bg/50 border border-warning/30 p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-muted">Outstanding balance</p>
                  <p className="text-lg font-display font-bold text-warning tabular-nums">{formatMoney(detailBalance, currencySymbol)}</p>
                </div>
                <Button size="sm" onClick={() => { setDetailId(null); setPayId(detailCustomer.id); }}>
                  <Wallet className="w-4 h-4" /> Record Payment
                </Button>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Recent purchases</p>
              {detailSales.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">No purchases yet.</p>
              ) : (
                <div className="space-y-2">
                  {detailSales.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{s.product?.product_name ?? 'Product'} × {s.quantity}</p>
                        <p className="text-xs text-text-muted">{formatRelative(s.sale_date)}</p>
                      </div>
                      <p className="text-sm font-semibold tabular-nums text-text-primary">{formatMoney(s.total_sale, currencySymbol)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Recent payments</p>
              {detailPayments.length === 0 ? (
                <p className="text-sm text-text-muted py-4 text-center">No payments recorded.</p>
              ) : (
                <div className="space-y-2">
                  {detailPayments.slice(0, 10).map((p) => {
                    const MethodIcon = p.payment_method === 'Cash' ? Banknote : p.payment_method === 'Mobile Money' ? Smartphone : CreditCard;
                    return (
                      <div key={p.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{p.sale?.sale_code ?? 'Unlinked'}</p>
                          <p className="text-xs text-text-muted">{formatRelative(p.payment_date)}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary bg-surface-alt px-1.5 py-0.5 rounded-md">
                            <MethodIcon className="w-3 h-3" />
                            {p.payment_method}
                          </span>
                          <p className="text-sm font-semibold tabular-nums text-text-primary">{formatMoney(p.amount, currencySymbol)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <RecordPaymentModalFromCustomer
        open={!!payId}
        onClose={() => setPayId(null)}
        currencySymbol={currencySymbol}
        recording={createPayment.isPending}
        customerId={payId || ''}
        sales={(sales ?? []).filter((s) => s.status === 'Completed')}
        onSubmit={async (payload) => {
          try {
            const res = await createPayment.mutateAsync(payload);
            if (!res?.success) {
              toast(res?.message ?? 'Failed to record payment', 'error');
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to record payment';
            toast(message, 'error');
          }
        }}
      />

      <CreateCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        creating={createCustomer.isPending}
        onCreate={async (payload) => {
          try {
            await createCustomer.mutateAsync(payload);
            toast('Customer added', 'success');
            setCreateOpen(false);
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to add customer';
            toast(message, 'error');
          }
        }}
      />
    </div>
  );
}

interface CreateCustomerPayload {
  customer_name: string;
  phone: string | null;
  location: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  notes: string | null;
}

interface CreateCustomerModalProps {
  open: boolean;
  onClose: () => void;
  creating: boolean;
  onCreate: (payload: CreateCustomerPayload) => void;
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
      gender: (gender || null) as 'Male' | 'Female' | 'Other' | null,
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

interface RecordPaymentModalFromCustomerProps {
  open: boolean;
  onClose: () => void;
  currencySymbol: string;
  recording: boolean;
  customerId: string;
  sales: SaleWithRelations[];
  onSubmit: (payload: {
    sale_id: string | null;
    customer_id: string;
    amount: number;
    payment_method: string;
    payment_date?: string;
    notes?: string | null;
  }) => void;
}

function RecordPaymentModalFromCustomer({ open, onClose, currencySymbol, recording, customerId, sales, onSubmit }: RecordPaymentModalFromCustomerProps) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [linkedSaleId, setLinkedSaleId] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastPayment, setLastPayment] = useState<{ amount: number; balance: number; method: string } | null>(null);
  const prevOpenRef = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const customerSales = sales.filter((s) => s.customer_id === customerId && s.status === 'Completed' && (s.balance || 0) > 0.01);
  const sale = customerSales.find((s) => s.id === linkedSaleId) || customerSales[0];
  const remainingBalance = sale ? Number(sale.balance || 0) : 0;

  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!open || wasOpen) return;
    if (customerSales.length > 0) {
      setLinkedSaleId(customerSales[0].id);
    } else {
      setLinkedSaleId('');
    }
    setAmount('');
    setMethod('Cash');
    setNotes('');
    setShowConfirmation(false);
    setLastPayment(null);
    setErrors({});
  }, [open, customerSales, prevOpenRef]);

  useEffect(() => {
    if (!showConfirmation) return;
    const timer = setTimeout(() => {
      setShowConfirmation(false);
      onClose();
    }, 2000);
    return () => clearTimeout(timer);
  }, [showConfirmation, onClose]);

  if (showConfirmation && lastPayment) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Payment recorded"
        size="md"
        footer={
          <Button variant="outline" onClick={onClose}>Close</Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-success-bg/50 border border-success/30 p-4 text-center">
            <p className="text-success font-semibold">✓ Payment of {formatMoney(lastPayment.amount, currencySymbol)} recorded</p>
            <p className="text-sm text-text-secondary mt-1">New balance: {formatMoney(lastPayment.balance, currencySymbol)}</p>
            <p className="text-sm text-text-muted">Method: {lastPayment.method}</p>
          </div>
        </div>
      </Modal>
    );
  }

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!linkedSaleId && customerSales.length > 0) next.linkedSale = 'Select a sale to link';
    const numericAmount = Number(amount) || 0;
    if (numericAmount <= 0) next.amount = 'Enter a valid amount';
    if (sale && numericAmount > Number(sale.balance || 0) + 0.01) {
      next.amount = `Exceeds remaining balance of ${formatMoney(sale.balance, currencySymbol)}`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast('Please fix the errors above', 'error');
      return;
    }
    try {
      await onSubmit({
        sale_id: linkedSaleId || null,
        customer_id: customerId,
        amount: numericAmount,
        payment_method: method,
        payment_date: new Date().toISOString(),
        notes: notes.trim() || null,
      });
      setLastPayment({
        amount: numericAmount,
        balance: sale ? Number(sale.balance || 0) - numericAmount : 0,
        method,
      });
      setShowConfirmation(true);
    } catch {
      // Error handled in parent
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      subtitle={sale ? `Paying ${sale.product?.product_name ?? 'sale'} for ${sale.customer?.customer_name ?? 'customer'}` : 'Record a customer payment'}
      size="md"
      footer={
        showConfirmation ? (
          <Button variant="outline" onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={recording}>Record Payment</Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {sale && (
          <div className="rounded-xl bg-surface-alt p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted">Remaining balance</p>
              <p className="text-lg font-display font-bold text-text-primary tabular-nums">{formatMoney(remainingBalance, currencySymbol)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Amount paid</p>
              <p className="text-sm font-bold tabular-nums text-success">{formatMoney(sale.amount_paid, currencySymbol)}</p>
            </div>
          </div>
        )}

        {customerSales.length > 1 && (
          <Field label="Linked sale" required error={errors.linkedSale}>
            <Select value={linkedSaleId} onChange={(e) => setLinkedSaleId(e.target.value)} invalid={!!errors.linkedSale}>
              {customerSales.map((s) => (
                <option key={s.id} value={s.id}>{s.sale_code} — {s.product?.product_name ?? 'Product'} ({formatMoney(s.balance, currencySymbol)} remaining)</option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Amount" required error={errors.amount} hint={sale ? `${formatMoney(remainingBalance, currencySymbol)} remaining` : undefined}>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} prefix={currencySymbol} invalid={!!errors.amount} />
        </Field>

        <Field label="Payment method">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional payment notes" />
        </Field>
      </div>
    </Modal>
  );
}
