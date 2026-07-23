// Veloura Manager V2 — Batch detail page
// Spec section 7.9: overview, products, sales, expenses, wallet allocation.
// Top summary shows batch, supplier, cost, revenue, profit, ROI, completion.

import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Package, ShoppingCart, Receipt, Plus,
  TrendingUp, Boxes, Lock, AlertCircle, Pencil,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../../contexts/AppContext';
import {
  useBatchSnapshot, useCreateProduct, useCloseBatch, useUpdateProduct, useVoidSale,
} from '../../hooks/queries';
import {
  formatMoney, formatMoneyCompact, formatPercent, formatDate, formatRelative,
} from '../../utils/format';
import { Card, Badge, EmptyState, LoadingState, ErrorState } from '../../components/common/Card';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Field, Input, Select, Textarea } from '../../components/common/Form';
import { ConfirmDialog } from '../../components/common/StatCard';
import { useFabRegistration } from '../../components/layout/AppLayout';
import { useToast } from '../../components/common/Toast';
import { BATCH_STATUS_META, PRODUCT_CATEGORIES } from '../../constants';
import { batchHealth, profitMargin, realizedProfit, unrealizedProfit, availableProfit } from '../../services/calculations';
import { differenceInDays, parseISO } from 'date-fns';
import type { BatchWithSupplier, Product } from '../../types';

type Tab = 'overview' | 'products' | 'sales' | 'expenses';

export function BatchDetail() {
  const { id } = useParams<{ id: string }>();
  const { currencySymbol, settings } = useApp();
  const { data: snapshot, isLoading, isError, refetch } = useBatchSnapshot(id);
  const batch = snapshot?.batch;
  const products = snapshot?.products;
  const sales = snapshot?.sales;
  const expenses = snapshot?.expenses;
  const walletTx = snapshot?.walletTx;
  const [tab, setTab] = useState<Tab>('overview');
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [editProductId, setEditProductId] = useState<string | null>(null);
  const [voidSaleId, setVoidSaleId] = useState<string | null>(null);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const voidSale = useVoidSale();
  const closeBatch = useCloseBatch();
  const toast = useToast();

  const isClosed = batch?.status === 'Completed' || batch?.status === 'Archived';

  useFabRegistration(
    !isClosed
      ? { label: 'Add Product', icon: Plus, onClick: () => setAddProductOpen(true) }
      : null,
  );

  const health = useMemo(() => {
    if (!batch) return null;
    const ageDays = batch.purchase_date ? differenceInDays(new Date(), parseISO(batch.purchase_date)) : 0;
    return batchHealth(batch, ageDays);
  }, [batch]);

  const realized = batch ? realizedProfit([batch]) : 0;
  const unrealized = products ? unrealizedProfit(products) : 0;
  const available = availableProfit(realized, walletTx ?? []);

  const tabs: { key: Tab; label: string; icon: LucideIcon }[] = [
    { key: 'overview', label: 'Overview', icon: Package },
    { key: 'products', label: `Products (${products?.length ?? 0})`, icon: Boxes },
    { key: 'sales', label: `Sales (${sales?.length ?? 0})`, icon: ShoppingCart },
    { key: 'expenses', label: `Expenses (${expenses?.length ?? 0})`, icon: Receipt },
  ];

  if (isLoading) return <LoadingState rows={4} />;
  if (isError || !batch) return <ErrorState message="Batch not found" onRetry={() => refetch()} />;

  const meta = BATCH_STATUS_META[batch.status] || BATCH_STATUS_META.Draft;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Back link */}
      <Link to="/inventory" className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-muted hover:text-text-secondary">
        <ArrowLeft className="w-4 h-4" /> Inventory
      </Link>

      {/* Header card */}
      <Card padding="lg" className="bg-action border-0">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-extrabold text-xl tracking-tight truncate">{batch.batch_name}</h1>
              <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', meta.color)}>
                <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
                {meta.label}
              </span>
            </div>
            <p className="text-sm text-text-secondary mt-1">
              {batch.batch_code} · {(batch as BatchWithSupplier).supplier?.supplier_name ?? 'Supplier'} · {formatDate(batch.purchase_date)}
            </p>
          </div>
          {health && (
            <div className="text-right flex-shrink-0">
              <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">Health</p>
              <p className="text-lg font-display font-bold text-text-muted">{health.health}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-3 mt-5 items-center">
          <HeaderStat label="Revenue" value={formatMoneyCompact(batch.gross_revenue, currencySymbol)} valueClass="text-text-primary" />
          <HeaderStat label="Net Profit" value={formatMoneyCompact(batch.net_profit, currencySymbol)} valueClass={batch.net_profit >= 0 ? 'text-success' : 'text-danger'} />
          <HeaderStat label="ROI" value={formatPercent(batch.roi)} valueClass="text-text-primary" />
          <HeaderStat label="Stock" value={`${batch.remaining_stock}`} valueClass="text-text-primary" />
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-text-secondary mb-1.5">
            <span>Completion</span>
            <span className="font-semibold tabular-nums">{formatPercent(batch.completion_percentage, 0)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-border overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all duration-500', batch.completion_percentage >= 100 ? 'bg-success' : 'bg-accent')}
              style={{ width: `${batch.completion_percentage}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Close batch callout */}
      {batch.status !== 'Completed' && batch.status !== 'Archived' && (
        batch.remaining_stock === 0 ? (
        <Card padding="md" className="bg-success-bg border-success/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success-bg text-success flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-success">Ready to close</p>
              <p className="text-xs text-success">All stock sold. Close this batch to finalize profit and allocate wallets.</p>
            </div>
            <Button size="sm" variant="primary" onClick={() => setCloseConfirm(true)}>Close Batch</Button>
          </Card>
        ) : null
      )}

      {isClosed && (
        <Card padding="md" className="bg-surface-alt border-border flex items-center gap-3">
          <Lock className="w-5 h-5 text-text-muted flex-shrink-0" />
          <p className="text-sm text-text-secondary font-medium">This batch is {batch.status.toLowerCase()}. Records are read-only.</p>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5',
              tab === t.key ? 'bg-action text-white' : 'bg-surface text-text-secondary border border-border hover:bg-surface-alt',
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="space-y-3 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card padding="md">
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Total batch cost</p>
              <p className="text-xl font-display font-bold text-text-primary mt-1 tabular-nums">{formatMoney(batch.total_batch_cost, currencySymbol)}</p>
              <div className="mt-2 space-y-1 text-xs text-text-muted">
                <Row label="Inventory" value={formatMoney(batch.purchase_cost, currencySymbol)} />
                <Row label="Transport" value={formatMoney(batch.transport_cost, currencySymbol)} />
                <Row label="Loading" value={formatMoney(batch.loading_cost, currencySymbol)} />
                <Row label="Import duty" value={formatMoney(batch.import_duty, currencySymbol)} />
                <Row label="Insurance" value={formatMoney(batch.insurance, currencySymbol)} />
                <Row label="Other" value={formatMoney(batch.other_costs, currencySymbol)} />
              </div>
            </Card>
            <Card padding="md">
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide">Profit breakdown</p>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Gross revenue</span>
                  <span className="font-semibold tabular-nums">{formatMoney(batch.gross_revenue, currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Gross profit</span>
                  <span className="font-semibold tabular-nums">{formatMoney(batch.gross_profit, currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Batch expenses</span>
                  <span className="font-semibold tabular-nums text-danger">-{formatMoney((expenses ?? []).filter(e => e.expense_type === 'Batch').reduce((s, e) => s + e.amount, 0), currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="font-semibold text-text-secondary">Net profit</span>
                  <span className={clsx('font-display font-bold tabular-nums', batch.net_profit >= 0 ? 'text-success' : 'text-danger')}>
                    {formatMoney(batch.net_profit, currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Realized Profit</span>
                  <span className="font-semibold tabular-nums">{formatMoney(realized, currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Unrealized Profit</span>
                  <span className="font-semibold tabular-nums">{formatMoney(unrealized, currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-border">
                  <span className="font-semibold text-text-secondary">Available Profit</span>
                  <span className="font-semibold tabular-nums">{formatMoney(available, currencySymbol)}</span>
                </div>
              </div>
            </Card>
          </div>

          {batch.notes && (
            <Card padding="md">
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-text-secondary">{batch.notes}</p>
            </Card>
          )}

          {health && health.reasons.length > 0 && (
            <Card padding="md">
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-2">Health signals</p>
              <div className="flex flex-wrap gap-2">
                {health.reasons.map((r: string, i: number) => (
                  <Badge key={i} color="bg-surface-alt text-text-secondary">{r}</Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-2.5 animate-fade-in">
          {(products ?? []).length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon={<Package className="w-7 h-7" />}
                title="No products yet"
                description="Add products to this batch to start selling."
                action={!isClosed && <Button onClick={() => setAddProductOpen(true)}><Plus className="w-4 h-4" /> Add Product</Button>}
              />
            </Card>
          ) : (
            (products ?? []).map((p) => {
              const margin = profitMargin(p.selling_price, p.cost_price);
              const low = p.current_stock <= (p.reorder_level || settings?.low_stock_threshold || 5) && p.current_stock > 0;
              const out = p.current_stock <= 0;
              return (
                <Card key={p.id} padding="md">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0 font-display font-bold text-sm">
                      {p.product_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-text-primary text-sm truncate">{p.product_name}</h3>
                        {p.brand && <span className="text-xs text-text-muted">{p.brand}</span>}
                        {out && <Badge color="bg-danger-bg text-danger">Out of stock</Badge>}
                        {low && <Badge color="bg-warning-bg text-warning">Low</Badge>}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">{p.product_code} · {p.category ?? 'Uncategorized'}</p>
                      <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                        <MiniStat label="Stock" value={`${p.current_stock}/${p.initial_stock}`} />
                        <MiniStat label="Cost" value={formatMoney(p.cost_price, currencySymbol)} />
                        <MiniStat label="Price" value={formatMoney(p.selling_price, currencySymbol)} />
                        <MiniStat label="Margin" value={formatPercent(margin)} valueClass={margin >= 30 ? 'text-success' : 'text-text-secondary'} />
                      </div>
                    </div>
                    {!isClosed && (
                      <button
                        onClick={() => setEditProductId(p.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-accent hover:bg-accent/10 transition-colors flex-shrink-0"
                        aria-label="Edit product"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === 'sales' && (
        <div className="space-y-2.5 animate-fade-in">
          {(sales ?? []).length === 0 ? (
            <Card padding="lg"><EmptyState icon={<ShoppingCart className="w-7 h-7" />} title="No sales yet" description="Sales will appear here once you start selling." /></Card>
          ) : (
            (sales ?? []).map((s) => (
              <Card key={s.id} padding="sm" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success-bg text-success flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{s.product?.product_name ?? 'Product'} × {s.quantity}</p>
                  <p className="text-xs text-text-muted">{s.customer?.customer_name ?? 'Walk-in'} · {formatRelative(s.sale_date)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-text-primary tabular-nums">{formatMoney(s.total_sale, currencySymbol)}</p>
                  {s.status === 'Voided' && <Badge color="bg-danger-bg text-danger">Voided</Badge>}
                  {s.status === 'Completed' && <p className="text-xs text-success font-semibold tabular-nums">+{formatMoney(s.profit, currencySymbol)}</p>}
                  {s.status === 'Completed' && (
                    <button
                      onClick={() => setVoidSaleId(s.id)}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-danger hover:bg-danger-bg px-2 py-1 rounded-md transition-colors"
                    >
                      Void
                    </button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === 'expenses' && (
        <div className="space-y-2.5 animate-fade-in">
          {(expenses ?? []).length === 0 ? (
            <Card padding="lg"><EmptyState icon={<Receipt className="w-7 h-7" />} title="No expenses yet" description="Record transport, packaging, or other batch costs." /></Card>
          ) : (
            (expenses ?? []).map((e) => (
              <Card key={e.id} padding="sm" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning-bg text-warning flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{e.expense_name}</p>
                  <p className="text-xs text-text-muted">{e.category} · {formatDate(e.expense_date)}</p>
                </div>
                <p className="text-sm font-bold text-text-primary tabular-nums flex-shrink-0">-{formatMoney(e.amount, currencySymbol)}</p>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Add product modal */}
      {!isClosed && (
        <AddProductModal
          open={addProductOpen}
          onClose={() => setAddProductOpen(false)}
          currencySymbol={currencySymbol}
          creating={createProduct.isPending}
          onCreate={async (payload) => {
            try {
              await createProduct.mutateAsync({ ...payload, batch_id: id! });
              toast('Product added', 'success');
              setAddProductOpen(false);
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : 'Failed to add product';
              toast(message, 'error');
            }
          }}
        />
      )}

      {/* Edit product modal */}
      {editProductId && !isClosed && (
        <EditProductModal
          open={!!editProductId}
          onClose={() => setEditProductId(null)}
          currencySymbol={currencySymbol}
          product={(products ?? []).find((p) => p.id === editProductId)!}
          saving={updateProduct.isPending}
          onSave={async (patch) => {
            try {
              await updateProduct.mutateAsync({ id: editProductId, patch });
              toast('Product updated', 'success');
              setEditProductId(null);
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : 'Failed to update product';
              toast(message, 'error');
            }
          }}
        />
      )}

      {/* Void sale confirm */}
      <ConfirmDialog
        open={!!voidSaleId}
        onCancel={() => setVoidSaleId(null)}
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
          if (!voidSaleId) return;
          try {
            const res = await voidSale.mutateAsync(voidSaleId);
            if (res?.success) {
              toast('Sale voided and stock restored', 'success');
              setVoidSaleId(null);
            } else {
              toast(res?.message ?? 'Failed to void sale', 'error');
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to void sale';
            toast(message, 'error');
          }
        }}
      />

      {/* Close batch confirm */}
      <ConfirmDialog
        open={closeConfirm}
        title="Close this batch?"
        message={
          <div>
            <p>This will finalize the batch and allocate <strong>{formatMoney(batch.net_profit, currencySymbol)}</strong> net profit to your wallets:</p>
            <ul className="mt-2 space-y-1 text-xs text-text-secondary">
              <li>Needs ({settings?.needs_percentage}%): {formatMoney(batch.net_profit * (settings?.needs_percentage ?? 0) / 100, currencySymbol)}</li>
              <li>Savings ({settings?.savings_percentage}%): {formatMoney(batch.net_profit * (settings?.savings_percentage ?? 0) / 100, currencySymbol)}</li>
              <li>Growth ({settings?.growth_percentage}%): {formatMoney(batch.net_profit * (settings?.growth_percentage ?? 0) / 100, currencySymbol)}</li>
            </ul>
            <p className="mt-2 text-xs text-warning flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> This action cannot be undone.</p>
          </div>
        }
        confirmLabel="Close & Allocate"
        danger
        loading={closeBatch.isPending}
        onConfirm={async () => {
          try {
            const res = await closeBatch.mutateAsync(id!);
            if (res?.success) {
              toast('Batch closed and profit allocated', 'success');
              setCloseConfirm(false);
            } else {
              toast(res?.message ?? 'Failed to close batch', 'error');
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to close batch';
            toast(message, 'error');
          }
        }}
        onCancel={() => setCloseConfirm(false)}
      />
    </div>
  );
}

function HeaderStat({ label, value, valueClass = 'text-text-primary' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className={clsx('text-base md:text-lg font-display font-bold tabular-nums leading-tight', valueClass)}>{value}</p>
      <p className="text-[11px] text-text-muted font-medium uppercase tracking-wide mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function MiniStat({ label, value, valueClass = 'text-text-primary' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className={clsx('text-xs font-bold tabular-nums', valueClass)}>{value}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wide">{label}</p>
    </div>
  );
}

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  currencySymbol: string;
  creating: boolean;
  onCreate: (payload: {
    product_name: string;
    brand: string | null;
    category: string | null;
    cost_price: number;
    selling_price: number;
    initial_stock: number;
    reorder_level: number;
    description: string | null;
  }) => void;
}

function AddProductModal({ open, onClose, currencySymbol, creating, onCreate }: AddProductModalProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stock, setStock] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [description, setDescription] = useState('');
  const toast = useToast();

  const reset = () => {
    setName(''); setBrand(''); setCategory(''); setCostPrice(''); setSellingPrice('');
    setStock(''); setReorderLevel(''); setDescription('');
  };

  const margin = (() => {
    const c = Number(costPrice) || 0;
    const s = Number(sellingPrice) || 0;
    return s > 0 ? ((s - c) / s) * 100 : 0;
  })();

  const submit = () => {
    if (!name.trim()) { toast('Product name is required', 'error'); return; }
    const qty = Number(stock) || 0;
    if (qty <= 0) { toast('Initial stock must be greater than 0', 'error'); return; }
    onCreate({
      product_name: name.trim(),
      brand: brand.trim() || null,
      category: category || null,
      cost_price: Number(costPrice) || 0,
      selling_price: Number(sellingPrice) || 0,
      initial_stock: qty,
      reorder_level: Number(reorderLevel) || 0,
      description: description.trim() || null,
    });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Product"
      subtitle="Add a perfume to this batch"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={creating}>Add Product</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Product name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue Oud 100ml" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Lattafa" />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select…</option>
              {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost price" required>
            <Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
          </Field>
          <Field label="Selling price" required>
            <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
          </Field>
        </div>
        {Number(sellingPrice) > 0 && (
          <p className="text-xs font-semibold text-text-secondary">
            Profit margin: <span className={margin >= 30 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-danger'}>{margin.toFixed(1)}%</span>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Initial stock" required>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Reorder level" hint="When to alert low stock">
            <Input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scent profile, size, notes" />
        </Field>
      </div>
    </Modal>
  );
}

interface EditProductModalProps {
  open: boolean;
  onClose: () => void;
  currencySymbol: string;
  product: Product;
  saving: boolean;
  onSave: (patch: Partial<Product>) => void;
}

function EditProductModal({ open, onClose, currencySymbol, product, saving, onSave }: EditProductModalProps) {
  const [name, setName] = useState(product.product_name);
  const [brand, setBrand] = useState(product.brand ?? '');
  const [category, setCategory] = useState(product.category ?? '');
  const [costPrice, setCostPrice] = useState(String(product.cost_price));
  const [sellingPrice, setSellingPrice] = useState(String(product.selling_price));
  const [stock, setStock] = useState(String(product.current_stock));
  const [reorderLevel, setReorderLevel] = useState(String(product.reorder_level));
  const [description, setDescription] = useState(product.description ?? '');
  const toast = useToast();

  const margin = (() => {
    const c = Number(costPrice) || 0;
    const s = Number(sellingPrice) || 0;
    return s > 0 ? ((s - c) / s) * 100 : 0;
  })();

  const submit = () => {
    if (!name.trim()) { toast('Product name is required', 'error'); return; }
    const qty = Number(stock) || 0;
    if (qty < 0) { toast('Stock cannot be negative', 'error'); return; }
    onSave({
      product_name: name.trim(),
      brand: brand.trim() || null,
      category: category || null,
      cost_price: Number(costPrice) || 0,
      selling_price: Number(sellingPrice) || 0,
      current_stock: qty,
      reorder_level: Number(reorderLevel) || 0,
      description: description.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Product"
      subtitle={product.product_code}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Save Changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Product name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blue Oud 100ml" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand">
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Lattafa" />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select…</option>
              {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost price" required>
            <Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
          </Field>
          <Field label="Selling price" required>
            <Input type="number" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} prefix={currencySymbol} placeholder="0.00" />
          </Field>
        </div>
        {Number(sellingPrice) > 0 && (
          <p className="text-xs font-semibold text-text-secondary">
            Profit margin: <span className={margin >= 30 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-danger'}>{margin.toFixed(1)}%</span>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Initial stock" hint="Original quantity">
            <Input type="number" value={String(product.initial_stock)} disabled className="bg-surface-alt text-text-muted" />
          </Field>
          <Field label="Current stock" required>
            <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reorder level" hint="When to alert low stock">
            <Input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} placeholder="0" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scent profile, size, notes" />
        </Field>
      </div>
    </Modal>
  );
}
