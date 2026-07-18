// Veloura Manager V2 — StatCard + SearchBar
// StatCard shows an icon, value, label, and optional trend. Spec 7.7.
// SearchBar provides instant search used by every major module (spec 3.18).

import type { ComponentType, ReactNode } from 'react';
import { clsx } from 'clsx';
import { Search, X, ArrowUpRight, ArrowDownRight, type LucideProps } from 'lucide-react';
import { Card } from './Card';

interface StatCardProps {
  icon: ComponentType<LucideProps>;
  label: string;
  value: string;
  hint?: string;
  trend?: { value: string; up: boolean };
  accent?: string;
  iconBg?: string;
}

export function StatCard({ icon: Icon, label, value, hint, trend, accent = 'text-plum-700', iconBg = 'bg-plum-50' }: StatCardProps) {
  return (
    <Card padding="md" className="group hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
          <Icon className={clsx('w-5 h-5', accent)} />
        </div>
        {trend && (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md',
              trend.up ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50',
            )}
          >
            {trend.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-display font-extrabold text-slate-900 mt-3 tracking-tight tabular-nums">{value}</p>
      <p className="text-sm font-medium text-slate-500 mt-0.5">{label}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </Card>
  );
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder = 'Search…', className }: SearchBarProps) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 pl-9 pr-9 rounded-xl border border-slate-300 bg-white text-sm placeholder:text-slate-400 focus:border-plum-500 focus:ring-2 focus:ring-plum-100 focus:outline-none transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger,
  loading,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-scale-in">
        <h3 className="text-lg font-display font-bold text-slate-900">{title}</h3>
        <div className="text-sm text-slate-600 mt-2 leading-relaxed">{message}</div>
        <div className="flex gap-2 mt-5 justify-end">
          <button
            onClick={onCancel}
            className="h-10 px-4 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={clsx(
              'h-10 px-4 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-plum-700 hover:bg-plum-800',
            )}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
