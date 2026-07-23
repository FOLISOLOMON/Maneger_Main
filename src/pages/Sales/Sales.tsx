// Veloura Manager V2 — Sales page
// Spec section 7.11 + 3.9. Record sale flow: select batch → product →
// customer → enter quantity, price, payment, discount. Uses the record_sale
// RPC for atomic stock decrement + profit calc.

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ShoppingCart, Plus, CreditCard, Banknote, Smartphone, XCircle, Wallet } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../../contexts/AppContext';
import {
  useSalesSnapshot, useRecordSale, useVoidSale, useCreatePayment,
} from '../../hooks/queries';
import { useSearchState } from '../../hooks/useSearchState';
import {
  formatMoney, formatRelative,
} from '../../utils/format';
import { Card, Badge, EmptyState, LoadingState, ErrorState, SectionHeader } from '../../components/common/Card';
import { Pagination } from '../../components/common/Pagination';
import { SearchBar, StatCard, ConfirmDialog } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Field, Input, Select, Textarea } from '../../components/common/Form';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { useToast } from '../../components/common/Toast';
import type { Customer, InventoryBatch, PaymentWithRelations, Product, SaleWithRelations } from '../../types';
import { PAYMENT_METHODS } from '../../constants';
import { saleTotalSale, saleProfit } from '../../services/calculations';
import { ShoppingCart as CartIcon, TrendingUp } from 'lucide-react';

export function Sales() {
  const { currencySymbol } = useApp();
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(0);
  const { data: snapshot, isLoading, isError, refetch } = useSalesSnapshot(9999);
  const sales = snapshot?.sales;
  const batches = snapshot?.batches;
  const products = snapshot?.products;
  const customers = snapshot?.customers;
  const { query: search, setQuery: setSearch, recent, clearRecent } = useSearchState();
  const [recordOpen, setRecordOpen] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const recordSale = useRecordSale();
  const voidSale = useVoidSale();
  const createPayment = useCreatePayment();
  const toast = useToast();

  useFabRegistration({ label: 'Record Sale', icon: Plus, onClick: () => setRecordOpen(true) });

  const allFiltered = useMemo(() => {
    const all = sales ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((s) =>
      (s.product?.product_name ?? '').toLowerCase().includes(q) ||
      (s.customer?.customer_name ?? '').toLowerCase().includes(q) ||
      s.sale_code.toLowerCase().includes(q),
    );
  }, [sales, search]);

  useEffect(() => { setPage(0); }, [search]);

  const totalPages = Math.max(1, Math.ceil(allFiltered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleSales = allFiltered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const todayStats = useMemo(() => {
    const today = new Date().toDateString();
    const todaySales = (sales ?? []).filter(
      (s) => new Date(s.sale_date).toDateString() === today && s.status === 'Completed',
    );
    return {
      count: todaySales.length,
      revenue: todaySales.reduce((s, x) => s + x.total_sale, 0),
    };
  }, [sales]);

  if (isLoading) return <LoadingState rows={4} />;
  if (isError) return <ErrorState message="Couldn't load sales" onRetry={() => refetch()} />;

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader title="Sales" subtitle="Record and review every sale" />

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={CartIcon} label="Today's Sales" value={`${todayStats.count}`} hint="Completed today" iconBg="bg-accent/10" accent="text-accent" />
        <StatCard icon={TrendingUp} label="Today's Revenue" value={formatMoney(todayStats.revenue, currencySymbol)} iconBg="bg-success-bg" accent="text-success" />
      </div>

      <SearchBar value={search} onChange={setSearch} recent={recent} onClearRecent={clearRecent} placeholder="Search sales by product, customer, code…" />

      {visibleSales.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<ShoppingCart className="w-7 h-7" />}
            title={search ? 'No matching sales' : 'No sales yet'}
            description={search ? 'Try a different search.' : 'Record your first sale to see it here.'}
            hint={!search ? 'Sales track payment status and profit per batch.' : undefined}
            action={!search && <Button onClick={() => setRecordOpen(true)}><Plus className="w-4 h-4" /> Record Sale</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="space-y-2.5">
            {visibleSales.map((s) => (
              <Card key={s.id} padding="sm" className="flex items-center gap-3" hover>
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', s.status === 'Voided' ? 'bg-danger-bg text-danger' : s.payment_status === 'paid' ? 'bg-success-bg text-success' : 'bg-accent/10 text-accent')}>
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text-primary truncate">{s.product?.product_name ?? 'Product'}</p>
                    {s.status === 'Voided' && <Badge color="bg-danger-bg text-danger">Voided</Badge>}
                    {s.status === 'Completed' && (
                      <Badge color={
                        s.payment_status === 'paid' ? 'bg-success-bg text-success' :
                        s.payment_status === 'partial' ? 'bg-warning-bg text-warning' :
                        'bg-surface-alt text-text-secondary'
                      }>
                        {s.payment_status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {s.quantity} × {formatMoney(s.unit_price, currencySymbol)} · {s.customer?.customer_name ?? 'Walk-in'} · {formatRelative(s.sale_date)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <PayBadge method={s.payment_method} />
                    <span className="text-[11px] text-text-muted">{s.sale_code}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-text-primary tabular-nums">{formatMoney(s.total_sale, currencySymbol)}</p>
                  {s.status === 'Completed' && (
                    <>
                      {s.payment_status === 'paid' ? (
                        <Badge color="bg-success-bg text-success">Paid</Badge>
                      ) : s.payment_status === 'partial' ? (
                        <span className="inline-flex items-center text-[11px] font-semibold text-warning bg-warning-bg px-1.5 py-0.5 rounded-md mt-0.5">
                          Partial — Bal: {formatMoney(s.balance, currencySymbol)}
                        </span>
                      ) : (
                        <p className="text-xs text-text-muted font-bold tabular-nums">
                          Bal: {formatMoney(s.balance, currencySymbol)}
                        </p>
                      )}
                      <p className="text-xs text-success font-semibold tabular-nums">+{formatMoney(s.profit, currencySymbol)}</p>
                      {s.payment_status !== 'paid' && (
                        <button
                          onClick={() => setPayId(s.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:bg-accent/10 px-2 py-1 rounded-md transition-colors"
                          aria-label="Record payment"
                        >
                          <Wallet className="w-3.5 h-3.5" /> Pay
                        </button>
                      )}
                      {s.payment_status !== 'paid' && (
                        <button
                          onClick={() => setVoidId(s.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-danger hover:bg-danger-bg px-2 py-1 rounded-md transition-colors"
                          aria-label="Void sale"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Void
                        </button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <RecordSaleModal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        currencySymbol={currencySymbol}
        recording={recordSale.isPending}
        batches={batches ?? []}
        products={products ?? []}
        customers={customers ?? []}
        onRecord={async (payload) => {
          try {
            const res = await recordSale.mutateAsync(payload);
            if (res?.success) {
              toast(`Sale recorded: ${formatMoney(Number(res.data?.sale?.total_sale ?? 0), currencySymbol)}`, 'success');
              setRecordOpen(false);
            } else {
              toast(res?.message ?? 'Failed to record sale', 'error');
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to record sale';
            toast(message, 'error');
          }
        }}
      />

      <RecordPaymentModal
        open={!!payId}
        onClose={() => setPayId(null)}
        currencySymbol={currencySymbol}
        recording={createPayment.isPending}
        saleId={payId}
        sales={(sales ?? []).filter((s) => s.status === 'Completed')}
        payments={snapshot?.payments ?? []}
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

      <ConfirmDialog
        open={!!voidId}
        onCancel={() => setVoidId(null)}
        title="Void this sale?"
        message={
          <div>
            <p>This will restore the product stock and mark the sale as voided.</p>
            <p className="mt-1 text-xs text-text-muted">This action cannot be undone.</p>
          </div>
        }
        confirmLabel="Void Sale"
        danger
        loading={voidSale.isPending}
        onConfirm={async () => {
          if (!voidId) return;
          try {
            const res = await voidSale.mutateAsync(voidId);
            if (res?.success) {
              toast('Sale voided and stock restored', 'success', {
                duration: 6000,
                action: {
                  label: 'Undo',
                  onUndo: () => toast('This action cannot be automatically reversed. Please re-record the sale if needed.', 'info', { duration: 4000 }),
                },
              });
              setVoidId(null);
            } else {
              toast(res?.message ?? 'Failed to void sale', 'error');
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to void sale';
            toast(message, 'error');
          }
        }}
      />
    </div>
  );
}

function PayBadge({ method }: { method: string }) {
  const Icon = method === 'Cash' ? Banknote : method === 'Mobile Money' ? Smartphone : CreditCard;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary bg-surface-alt px-1.5 py-0.5 rounded-md">
      <Icon className="w-3 h-3" />
      {method}
    </span>
  );
}

interface RecordSaleModalProps {
  open: boolean;
  onClose: () => void;
  currencySymbol: string;
  recording: boolean;
  onRecord: (payload: {
    product_id: string;
    customer_id: string | null;
    quantity: number;
    unit_price: number;
    discount: number;
    discount_type: 'Amount' | 'Percent';
    payment_method: string;
    notes: string | null;
  }) => void;
  batches: InventoryBatch[];
  products: Product[];
  customers: Customer[];
}

function RecordSaleModal({ open, onClose, currencySymbol, recording, onRecord, batches, products, customers }: RecordSaleModalProps) {
  const toast = useToast();
  const quantityRef = useRef<HTMLInputElement>(null);
  const unitPriceRef = useRef<HTMLInputElement>(null);

  const [batchId, setBatchId] = useState('');
  const [productId, setProductId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'Amount' | 'Percent'>('Amount');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const activeBatches = (batches ?? []).filter((b) => !['Completed', 'Archived', 'Draft'].includes(b.status));
  const batchProducts = (products ?? []).filter((p) => p.batch_id === batchId && p.current_stock > 0);
  const selectedProduct = (products ?? []).find((p) => p.id === productId);

  const recentCustomers = useMemo(() => {
    return [...(customers ?? [])]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  }, [customers]);

  const reset = () => {
    setBatchId(''); setProductId(''); setCustomerId(''); setQuantity('1'); setUnitPrice('');
    setDiscount(''); setDiscountType('Amount'); setPaymentMethod('Cash'); setNotes('');
    setErrors({});
  };

  useEffect(() => {
    if (open && productId && quantityRef.current) {
      quantityRef.current.focus();
    }
  }, [open, productId]);

  useEffect(() => {
    if (open && quantity && unitPriceRef.current) {
      unitPriceRef.current.focus();
    }
  }, [open, quantity]);

  // When product selected, default the unit price to its selling price
  const onProductChange = (id: string) => {
    setProductId(id);
    const p = (products ?? []).find((x) => x.id === id);
    if (p) setUnitPrice(String(p.selling_price));
  };

  const totalSale = saleTotalSale(Number(unitPrice) || 0, Number(quantity) || 1, Number(discount) || 0, discountType);
  const profit = selectedProduct
    ? saleProfit(Number(unitPrice) || 0, selectedProduct.cost_price, Number(quantity) || 1, Number(discount) || 0, discountType)
    : 0;

  const validate = useCallback(() => {
    const next: Record<string, string> = {};
    if (!productId) next.product = 'Select a product';
    const qty = Number(quantity) || 0;
    if (qty <= 0) next.quantity = 'Quantity must be greater than 0';
    if (selectedProduct && qty > selectedProduct.current_stock) next.quantity = `Only ${selectedProduct.current_stock} in stock`;
    if (!unitPrice || Number(unitPrice) <= 0) next.unitPrice = 'Enter a selling price';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [productId, quantity, unitPrice, selectedProduct]);

  const submit = () => {
    if (!validate()) {
      toast('Please fix the errors above', 'error');
      return;
    }
    const qty = Number(quantity) || 0;
    onRecord({
      product_id: productId,
      customer_id: customerId || null,
      quantity: qty,
      unit_price: Number(unitPrice) || 0,
      discount: Number(discount) || 0,
      discount_type: discountType,
      payment_method: paymentMethod,
      notes: notes.trim() || null,
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Sale"
      subtitle="Sell a product from an active batch"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={recording}>Record Sale</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Batch" required error={errors.batch}>
          <Select value={batchId} onChange={(e) => { setBatchId(e.target.value); setProductId(''); setErrors((p) => ({ ...p, batch: undefined })); }} invalid={!!errors.batch}>
            <option value="">Select a batch…</option>
            {activeBatches.map((b) => <option key={b.id} value={b.id}>{b.batch_name} ({b.batch_code})</option>)}
          </Select>
        </Field>

        <Field label="Product" required error={errors.product} hint={batchId && !batchProducts.length ? 'No products in stock in this batch' : undefined}>
          <Select value={productId} onChange={(e) => { onProductChange(e.target.value); setErrors((p) => ({ ...p, product: undefined })); }} disabled={!batchId} invalid={!!errors.product}>
            <option value="">Select a product…</option>
            {batchProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.product_name} — {p.current_stock}/{p.initial_stock} in stock ({formatMoney(p.selling_price, currencySymbol)})</option>
            ))}
          </Select>
        </Field>

        {!customerId && recentCustomers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recentCustomers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCustomerId(c.id)}
                className="text-[11px] font-semibold text-accent bg-accent/10 hover:bg-accent/20 px-2.5 py-1 rounded-lg transition-colors"
              >
                {c.customer_name}
              </button>
            ))}
          </div>
        )}

        <Field label="Customer" error={errors.customer}>
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} invalid={!!errors.customer}>
            <option value="">Walk-in customer</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" required error={errors.quantity}>
            <Input ref={quantityRef} type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} invalid={!!errors.quantity} />
          </Field>
          <Field label="Unit price" required error={errors.unitPrice}>
            <Input ref={unitPriceRef} type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} prefix={currencySymbol} invalid={!!errors.unitPrice} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount">
            <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} prefix={discountType === 'Percent' ? '%' : currencySymbol} />
          </Field>
          <Field label="Discount type">
            <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'Amount' | 'Percent')}>
              <option value="Amount">Amount ({currencySymbol})</option>
              <option value="Percent">Percent (%)</option>
            </Select>
          </Field>
        </div>

        <Field label="Payment method">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Field>

        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional sale notes" />
        </Field>

        {/* Summary */}
        <div className="rounded-xl bg-surface-alt p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Total sale</span>
            <span className="font-bold text-text-primary tabular-nums">{formatMoney(totalSale, currencySymbol)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Estimated profit</span>
            <span className={clsx('font-bold tabular-nums', profit >= 0 ? 'text-success' : 'text-danger')}>{formatMoney(profit, currencySymbol)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  currencySymbol: string;
  recording: boolean;
  saleId: string | null;
  sales: SaleWithRelations[];
  payments: PaymentWithRelations[];
  onSubmit: (payload: {
    sale_id: string | null;
    customer_id: string;
    amount: number;
    payment_method: string;
    payment_date?: string;
    notes?: string | null;
  }) => void;
}

function RecordPaymentModal({ open, onClose, currencySymbol, recording, saleId, sales, payments, onSubmit }: RecordPaymentModalProps) {
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [linkedSaleId, setLinkedSaleId] = useState(saleId || '');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastPayment, setLastPayment] = useState<{ amount: number; balance: number; method: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const sale = sales.find((s) => s.id === linkedSaleId) || sales.find((s) => s.id === saleId);
  const customerId = sale?.customer_id || '';
  const remainingBalance = sale ? Number(sale.balance || sale.total_sale || 0) : 0;

  const salePayments = useMemo(() => {
    if (!sale) return [];
    return (payments ?? [])
      .filter((p) => p.sale_id === sale.id)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }, [payments, sale]);

  useEffect(() => {
    if (open) {
      setLinkedSaleId(saleId || '');
      setAmount('');
      setMethod('Cash');
      setNotes('');
      setShowConfirmation(false);
      setLastPayment(null);
      setErrors({});
    }
  }, [open, saleId]);

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
    if (!linkedSaleId) next.linkedSale = 'Select a sale to link';
    const numericAmount = Number(amount) || 0;
    if (numericAmount <= 0) next.amount = 'Enter a valid amount';
    const currentSale = sales.find((s) => s.id === linkedSaleId);
    if (currentSale && numericAmount > Number(currentSale.balance || 0) + 0.01) {
      next.amount = `Exceeds remaining balance of ${formatMoney(currentSale.balance, currencySymbol)}`;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast('Please fix the errors above', 'error');
      return;
    }
    try {
      await onSubmit({
        sale_id: linkedSaleId || null,
        customer_id: customerId || (currentSale?.customer_id || ''),
        amount: numericAmount,
        payment_method: method,
        payment_date: new Date().toISOString(),
        notes: notes.trim() || null,
      });
      setLastPayment({
        amount: numericAmount,
        balance: currentSale ? Number(currentSale.balance || 0) - numericAmount : 0,
        method,
      });
      setShowConfirmation(true);
    } catch {
      // Error handled in parent
    }
  };

  const customerSales = sales.filter((s) => s.customer_id === customerId && s.status === 'Completed' && s.balance > 0.01);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Payment"
      subtitle={sale ? `Paying ${sale.product?.product_name ?? 'sale'}` : 'Record a customer payment'}
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

        {sale && salePayments.length > 0 && (
          <div className="rounded-xl bg-surface-alt p-3">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Payments for this sale</p>
            <div className="space-y-1.5">
              {salePayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">{formatRelative(p.payment_date)}</span>
                    <PayBadge method={p.payment_method} />
                  </div>
                  <span className="font-semibold tabular-nums text-text-primary">{formatMoney(p.amount, currencySymbol)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm">
              <span className="text-text-secondary">Balance</span>
              <span className="font-bold tabular-nums text-text-primary">{formatMoney(remainingBalance, currencySymbol)}</span>
            </div>
          </div>
        )}

        {sale && salePayments.length === 0 && (
          <p className="text-xs text-text-muted text-center">No payments yet</p>
        )}

        <Field label="Linked sale" required error={errors.linkedSale}>
          <Select value={linkedSaleId} onChange={(e) => setLinkedSaleId(e.target.value)} invalid={!!errors.linkedSale}>
            <option value="">Select a sale…</option>
            {customerSales.map((s) => (
              <option key={s.id} value={s.id}>{s.sale_code} — {s.product?.product_name ?? 'Product'} ({formatMoney(s.balance, currencySymbol)} remaining)</option>
            ))}
          </Select>
        </Field>

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
