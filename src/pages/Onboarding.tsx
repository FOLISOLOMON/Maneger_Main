// Veloura Manager V2 — Onboarding flow
// Spec section 3.4: first-time setup walks the owner through business info,
// first supplier, and first inventory batch. Renders when no settings row
// exists yet.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Store, Truck, Package, Check, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Field, Input, Select, Textarea } from '../components/common/Form';
import { useCreateSettings, useCreateSupplier, useCreateBatch } from '../hooks/queries';
import { useToast } from '../components/common/Toast';
import { CURRENCIES, DEFAULT_WALLET_PERCENTAGES, DEFAULT_LOW_STOCK_THRESHOLD, DEFAULT_COMPLETION_THRESHOLD } from '../constants';
import { todayInputDate } from '../utils/format';

type Step = 0 | 1 | 2 | 3;

export function Onboarding() {
  const [step, setStep] = useState<Step>(0);
  const navigate = useNavigate();
  const toast = useToast();
  const createSettings = useCreateSettings();
  const createSupplier = useCreateSupplier();
  const createBatch = useCreateBatch();

  // Step 0 — business info
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [needsPct, setNeedsPct] = useState(DEFAULT_WALLET_PERCENTAGES.needs);
  const [savingsPct, setSavingsPct] = useState(DEFAULT_WALLET_PERCENTAGES.savings);
  const [growthPct, setGrowthPct] = useState(DEFAULT_WALLET_PERCENTAGES.growth);

  // Step 1 — first supplier
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierLocation, setSupplierLocation] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');

  // Step 2 — first batch
  const [batchName, setBatchName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(todayInputDate());
  const [purchaseCost, setPurchaseCost] = useState('');

  const [createdSupplierId, setCreatedSupplierId] = useState<string | null>(null);

  const selectedCurrency = CURRENCIES.find((c) => c.code === currency)!;
  const pctTotal = needsPct + savingsPct + growthPct;

  const steps = [
    { icon: Store, label: 'Business' },
    { icon: Truck, label: 'Supplier' },
    { icon: Package, label: 'First Batch' },
    { icon: Check, label: 'Done' },
  ];

  const finishStep0 = () => {
    if (!businessName.trim() || !ownerName.trim()) {
      toast('Business name and owner name are required', 'error');
      return;
    }
    if (pctTotal !== 100) {
      toast('Wallet percentages must total 100%', 'error');
      return;
    }
    setStep(1);
  };

  const finishStep1 = async () => {
    if (!supplierName.trim()) {
      toast('Supplier name is required', 'error');
      return;
    }
    try {
      const supplier = await createSupplier.mutateAsync({
        supplier_name: supplierName.trim(),
        phone: supplierPhone.trim() || null,
        location: supplierLocation.trim() || null,
        notes: supplierNotes.trim() || null,
      });
      setCreatedSupplierId(supplier.id);
      setStep(2);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to create supplier';
      toast(message, 'error');
    }
  };

  const finishStep2 = async () => {
    if (!batchName.trim()) {
      toast('Batch name is required', 'error');
      return;
    }
    if (!createdSupplierId) {
      toast('Missing supplier. Please go back.', 'error');
      return;
    }
    try {
      // Create settings first (single row)
      await createSettings.mutateAsync({
        business_name: businessName.trim(),
        owner_name: ownerName.trim(),
        phone: phone.trim() || null,
        email: null,
        business_address: address.trim() || null,
        currency,
        currency_symbol: selectedCurrency.symbol,
        theme: 'light',
        low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
        batch_completion_threshold: DEFAULT_COMPLETION_THRESHOLD,
        needs_percentage: needsPct,
        savings_percentage: savingsPct,
        growth_percentage: growthPct,
      });

      await createBatch.mutateAsync({
        supplier_id: createdSupplierId,
        batch_name: batchName.trim(),
        purchase_date: purchaseDate,
        expected_arrival: null,
        purchase_cost: Number(purchaseCost) || 0,
        transport_cost: 0,
        loading_cost: 0,
        import_duty: 0,
        insurance: 0,
        other_costs: 0,
        notes: null,
      });

      setStep(3);
      setTimeout(() => navigate('/'), 1500);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to complete setup';
      toast(message, 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-plum-50 via-slate-50 to-gold-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Brand header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-plum-600 to-plum-800 flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg">
            V
          </div>
          <div>
            <h1 className="font-display font-extrabold text-xl text-slate-900">Veloura Manager</h1>
            <p className="text-xs text-slate-500">Business setup · Phoenix V2</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 px-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className={clsx(
                'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-colors',
                i < step ? 'bg-emerald-500 text-white' :
                i === step ? 'bg-plum-700 text-white shadow-md' :
                'bg-slate-200 text-slate-400',
              )}>
                {i < step ? <Check className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
              </div>
              {i < steps.length - 1 && (
                <div className={clsx('flex-1 h-0.5 mx-2 rounded-full transition-colors', i < step ? 'bg-emerald-500' : 'bg-slate-200')} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-card border border-slate-200/70 p-6">
          {step === 0 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900">Tell us about your business</h2>
                <p className="text-sm text-slate-500 mt-0.5">This appears on your dashboard and reports.</p>
              </div>
              <Field label="Business name" required>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Veloura Scents" />
              </Field>
              <Field label="Owner name" required>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Your name" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024…" />
                </Field>
                <Field label="Currency">
                  <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Business address">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop location" />
              </Field>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Wallet allocation percentages</p>
                <p className="text-xs text-slate-500 mb-3">How net profit is split when a batch closes. Must total 100%.</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Needs">
                    <Input type="number" value={needsPct} onChange={(e) => setNeedsPct(Number(e.target.value))} prefix="%" />
                  </Field>
                  <Field label="Savings">
                    <Input type="number" value={savingsPct} onChange={(e) => setSavingsPct(Number(e.target.value))} prefix="%" />
                  </Field>
                  <Field label="Growth">
                    <Input type="number" value={growthPct} onChange={(e) => setGrowthPct(Number(e.target.value))} prefix="%" />
                  </Field>
                </div>
                <p className={clsx('text-xs font-semibold mt-2', pctTotal === 100 ? 'text-emerald-600' : 'text-red-600')}>
                  Total: {pctPctTotalLabel(pctTotal)}
                </p>
              </div>
              <Button fullWidth size="lg" onClick={finishStep0}>
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900">Create your first supplier</h2>
                <p className="text-sm text-slate-500 mt-0.5">Where you buy your inventory from.</p>
              </div>
              <Field label="Supplier name" required>
                <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="e.g. Dubai Imports" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <Input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} placeholder="Contact number" />
                </Field>
                <Field label="Location">
                  <Input value={supplierLocation} onChange={(e) => setSupplierLocation(e.target.value)} placeholder="City / country" />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} placeholder="Anything useful to remember" />
              </Field>
              <div className="flex gap-2">
                <Button variant="outline" size="lg" onClick={() => setStep(0)}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
                <Button fullWidth size="lg" loading={createSupplier.isPending} onClick={finishStep1}>
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="font-display font-bold text-lg text-slate-900">Create your first batch</h2>
                <p className="text-sm text-slate-500 mt-0.5">An inventory batch is one stock purchase cycle.</p>
              </div>
              <Field label="Batch name" required hint="e.g. Dubai Trip May 2026">
                <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="Name this purchase" />
              </Field>
              <Field label="Purchase date">
                <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
              </Field>
              <Field label="Inventory cost" hint="Total cost of goods. You can add transport and other costs later.">
                <Input type="number" value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} prefix={selectedCurrency.symbol} placeholder="0.00" />
              </Field>
              <div className="flex gap-2">
                <Button variant="outline" size="lg" onClick={() => setStep(1)}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
                <Button fullWidth size="lg" loading={createSettings.isPending || createBatch.isPending} onClick={finishStep2}>
                  Finish setup <Check className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8 animate-scale-in">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="font-display font-extrabold text-xl text-slate-900">You're all set!</h2>
              <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                Your business is ready. Take me to your dashboard…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function pctPctTotalLabel(total: number): string {
  if (total === 100) return '100% — perfect';
  return `${total}% — must equal 100%`;
}
