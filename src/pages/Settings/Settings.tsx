// Veloura Manager V2 — Settings page
// Spec section 7.18. Business info, wallet percentages, thresholds, currency,
// theme, about. Updates the single settings row.

import { useEffect, useState } from 'react';
import { Store, Palette, Percent, AlertTriangle, Info, Save } from 'lucide-react';
import { clsx } from 'clsx';
import { useApp } from '../../contexts/AppContext';
import { useUpdateSettings } from '../../hooks/queries';
import { CURRENCIES, DEFAULT_LOW_STOCK_THRESHOLD, DEFAULT_COMPLETION_THRESHOLD } from '../../constants';
import { Card, SectionHeader, LoadingState } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Field, Input, Select } from '../../components/common/Form';
import { useToast } from '../../components/common/Toast';
import { logos } from '../../theme/designTokens';

export function Settings() {
  const { settings } = useApp();
  const updateSettings = useUpdateSettings();
  const toast = useToast();

  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    phone: '',
    email: '',
    business_address: '',
    currency: 'GHS',
    theme: 'light' as 'light' | 'dark',
    low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD,
    batch_completion_threshold: DEFAULT_COMPLETION_THRESHOLD,
    needs_percentage: 40,
    savings_percentage: 35,
    growth_percentage: 25,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        business_name: settings.business_name,
        owner_name: settings.owner_name,
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        business_address: settings.business_address ?? '',
        currency: settings.currency,
        theme: settings.theme,
        low_stock_threshold: settings.low_stock_threshold,
        batch_completion_threshold: settings.batch_completion_threshold,
        needs_percentage: settings.needs_percentage,
        savings_percentage: settings.savings_percentage,
        growth_percentage: settings.growth_percentage,
      });
    }
  }, [settings]);

  if (!settings) return <LoadingState rows={3} />;

  const pctTotal = form.needs_percentage + form.savings_percentage + form.growth_percentage;
  const selectedCurrency = CURRENCIES.find((c) => c.code === form.currency)!;

  const save = async () => {
    if (pctTotal !== 100) {
      toast('Wallet percentages must total 100%', 'error');
      return;
    }
    try {
      await updateSettings.mutateAsync({
        id: settings.id,
        patch: {
          business_name: form.business_name.trim(),
          owner_name: form.owner_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          business_address: form.business_address.trim() || null,
          currency: form.currency,
          currency_symbol: selectedCurrency.symbol,
          theme: form.theme,
          low_stock_threshold: form.low_stock_threshold,
          batch_completion_threshold: form.batch_completion_threshold,
          needs_percentage: form.needs_percentage,
          savings_percentage: form.savings_percentage,
          growth_percentage: form.growth_percentage,
        },
      });
      toast('Settings saved', 'success');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save settings';
      toast(message, 'error');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <SectionHeader title="Settings" subtitle="Configure your business" />

      {/* Business info */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Store className="w-5 h-5 text-accent" />
          <h3 className="font-display font-bold text-text-primary">Business information</h3>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Business name">
              <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
            </Field>
            <Field label="Owner name">
              <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Address">
            <Input value={form.business_address} onChange={(e) => setForm({ ...form, business_address: e.target.value })} />
          </Field>
        </div>
      </Card>

      {/* Appearance */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-5 h-5 text-accent" />
          <h3 className="font-display font-bold text-text-primary">Appearance & currency</h3>
        </div>
        <div className="space-y-3">
          <Field label="Currency">
            <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="Theme">
            <div className="grid grid-cols-2 gap-2">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, theme: t })}
                  className={clsx(
                    'h-11 rounded-xl text-sm font-semibold border capitalize transition-colors',
                    form.theme === t ? 'bg-accent/10 border-accent text-accent' : 'bg-surface border-border text-text-secondary',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Card>

      {/* Wallet percentages */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Percent className="w-5 h-5 text-accent" />
          <h3 className="font-display font-bold text-text-primary">Wallet allocation</h3>
        </div>
        <p className="text-xs text-text-muted mb-3">How net profit splits when a batch closes. Must total 100%.</p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Needs">
            <Input type="number" value={form.needs_percentage} onChange={(e) => setForm({ ...form, needs_percentage: Number(e.target.value) })} prefix="%" />
          </Field>
          <Field label="Savings">
            <Input type="number" value={form.savings_percentage} onChange={(e) => setForm({ ...form, savings_percentage: Number(e.target.value) })} prefix="%" />
          </Field>
          <Field label="Growth">
            <Input type="number" value={form.growth_percentage} onChange={(e) => setForm({ ...form, growth_percentage: Number(e.target.value) })} prefix="%" />
          </Field>
        </div>
        <p className={clsx('text-xs font-semibold mt-2', pctTotal === 100 ? 'text-success' : 'text-danger')}>
          Total: {pctTotal}% {pctTotal === 100 ? '— perfect' : '— must equal 100%'}
        </p>
      </Card>

      {/* Thresholds */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-display font-bold text-text-primary">Thresholds</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Low stock threshold" hint="Alert when stock drops to this">
            <Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} />
          </Field>
          <Field label="Batch completion %" hint="Alert when remaining stock hits this %">
            <Input type="number" value={form.batch_completion_threshold} onChange={(e) => setForm({ ...form, batch_completion_threshold: Number(e.target.value) })} prefix="%" />
          </Field>
        </div>
      </Card>

      {/* About */}
      <Card padding="md">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-text-muted" />
            <h3 className="font-display font-bold text-text-primary">About</h3>
          </div>
          <img src={logos.wordmark.gold} alt="Avencia Manager" className="h-6 w-auto object-contain" />
        </div>
        <div className="text-sm text-text-secondary space-y-1">
          <p>Avencia Manager V2 — Codename Phoenix</p>
          <p className="text-xs text-text-muted">Offline-first perfume business management. Built with Supabase + React.</p>
        </div>
      </Card>

      <div className="sticky bottom-20 md:bottom-4 flex justify-end">
        <Button size="lg" onClick={save} loading={updateSettings.isPending} className="shadow-lg">
          <Save className="w-4 h-4" /> Save Settings
        </Button>
      </div>
    </div>
  );
}
