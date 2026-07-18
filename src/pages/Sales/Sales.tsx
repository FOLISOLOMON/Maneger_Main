// Veloura Manager V2 — Sales page
// Spec section 7.11 + 3.9. Record sale flow: select batch → product →
// customer → enter quantity, price, payment, discount. Uses the record_sale
// RPC for atomic stock decrement + profit calc.

import { useMemo, useState } from 'react';
import { ShoppingCart, Plus, CreditCard, Banknote, Smartphone } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../../contexts/AppContext';
import {
  useSalesSnapshot, useRecordSale,
} from '../../hooks/queries';
import {
  formatMoney, formatRelative,
} from '../../utils/format';
import { Card, Badge, EmptyState, LoadingState, ErrorState, SectionHeader } from '../../components/common/Card';
import { SearchBar, StatCard } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Field, Input, Select, Textarea } from '../../components/common/Form';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { useToast } from '../../components/common/Toast';
import type { Customer, InventoryBatch, Product } from '../../types';
import { PAYMENT_METHODS } from '../../constants';
import { saleTotalSale, saleProfit } from '../../services/calculations';
import { ShoppingCart as CartIcon, TrendingUp } from 'lucide-react';

export function Sales() {
  const { currencySymbol } = useApp();
  const { data: snapshot, isLoading, isError, refetch } = useSalesSnapshot();
  const sales = snapshot?.sales;
  const batches = snapshot?.batches;
  const products = snapshot?.products;
  const customers = snapshot?.customers;
  const [search, setSearch] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);
  const recordSale = useRecordSale();
  const toast = useToast();

  useFabRegistration({ label: 'Record Sale', icon: Plus, onClick: () => setRecordOpen(true) });

  const filtered = useMemo(() => {
    const all = sales ?? [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter((s) =>
      (s.product?.product_name ?? '').toLowerCase().includes(q) ||
      (s.customer?.customer_name ?? '').toLowerCase().includes(q) ||
      s.sale_code.toLowerCase().includes(q),
    );
  }, [sales, search]);

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
        <StatCard icon={CartIcon} label="Today's Sales" value={`${todayStats.count}`} hint="Completed today" iconBg="bg-plum-50" accent="text-plum-700" />
        <StatCard icon={TrendingUp} label="Today's Revenue" value={formatMoney(todayStats.revenue, currencySymbol)} iconBg="bg-emerald-50" accent="text-emerald-600" />
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search sales by product, customer, code…" />

      {filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<ShoppingCart className="w-7 h-7" />}
            title={search ? 'No matching sales' : 'No sales yet'}
            description={search ? 'Try a different search.' : 'Record your first sale to get started.'}
            action={!search && <Button onClick={() => setRecordOpen(true)}><Plus className="w-4 h-4" /> Record Sale</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((s) => (
            <Card key={s.id} padding="sm" className="flex items-center gap-3" hover>
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', s.status === 'Voided' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600')}>
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 truncate">{s.product?.product_name ?? 'Product'}</p>
                  {s.status === 'Voided' && <Badge color="bg-red-50 text-red-700">Voided</Badge>}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {s.quantity} × {formatMoney(s.unit_price, currencySymbol)} · {s.customer?.customer_name ?? 'Walk-in'} · {formatRelative(s.sale_date)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <PayBadge method={s.payment_method} />
                  <span className="text-[11px] text-slate-400">{s.sale_code}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{formatMoney(s.total_sale, currencySymbol)}</p>
                {s.status === 'Completed' && <p className="text-xs text-emerald-600 font-semibold tabular-nums">+{formatMoney(s.profit, currencySymbol)}</p>}
              </div>
            </Card>
          ))}
        </div>
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
              toast(`Sale recorded: ${formatMoney(Number(res.data?.total_sale ?? 0), currencySymbol)}`, 'success');
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
    </div>
  );
}

function PayBadge({ method }: { method: string }) {
  const Icon = method === 'Cash' ? Banknote : method === 'Mobile Money' ? Smartphone : CreditCard;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
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

  const [batchId, setBatchId] = useState('');
  const [productId, setProductId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'Amount' | 'Percent'>('Amount');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');

  const activeBatches = (batches ?? []).filter((b) => !['Completed', 'Archived', 'Draft'].includes(b.status));
  const batchProducts = (products ?? []).filter((p) => p.batch_id === batchId && p.current_stock > 0);
  const selectedProduct = (products ?? []).find((p) => p.id === productId);

  const reset = () => {
    setBatchId(''); setProductId(''); setCustomerId(''); setQuantity('1'); setUnitPrice('');
    setDiscount(''); setDiscountType('Amount'); setPaymentMethod('Cash'); setNotes('');
  };

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

  const submit = () => {
    if (!productId) { toast('Select a product', 'error'); return; }
    const qty = Number(quantity) || 0;
    if (qty <= 0) { toast('Quantity must be greater than 0', 'error'); return; }
    if (selectedProduct && qty > selectedProduct.current_stock) {
      toast(`Only ${selectedProduct.current_stock} in stock`, 'error');
      return;
    }
    if (!unitPrice || Number(unitPrice) <= 0) { toast('Enter a selling price', 'error'); return; }
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
        <Field label="Batch" required>
          <Select value={batchId} onChange={(e) => { setBatchId(e.target.value); setProductId(''); }} invalid={!batchId && open}>
            <option value="">Select a batch…</option>
            {activeBatches.map((b) => <option key={b.id} value={b.id}>{b.batch_name} ({b.batch_code})</option>)}
          </Select>
        </Field>

        <Field label="Product" required hint={batchId && !batchProducts.length ? 'No products in stock in this batch' : undefined}>
          <Select value={productId} onChange={(e) => onProductChange(e.target.value)} disabled={!batchId} invalid={!productId && open}>
            <option value="">Select a product…</option>
            {batchProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.product_name} — {p.current_stock} in stock ({formatMoney(p.selling_price, currencySymbol)})</option>
            ))}
          </Select>
        </Field>

        <Field label="Customer">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Walk-in customer</option>
            {(customers ?? []).map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" required>
            <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Unit price" required>
            <Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} prefix={currencySymbol} />
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
        <div className="rounded-xl bg-slate-50 p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Total sale</span>
            <span className="font-bold text-slate-900 tabular-nums">{formatMoney(totalSale, currencySymbol)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Estimated profit</span>
            <span className={clsx('font-bold tabular-nums', profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>{formatMoney(profit, currencySymbol)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
