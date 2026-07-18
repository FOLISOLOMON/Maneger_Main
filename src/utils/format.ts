// Veloura Manager V2 — Formatting utilities
// All currency, number, and date formatting goes through here so the whole
// app stays consistent. Currency symbol comes from settings at render time.

import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export function formatMoney(
  amount: number,
  symbol: string = '₵',
  decimals: number = 2,
): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${symbol}${formatted}`;
}

export function formatMoneyCompact(amount: number, symbol: string = '₵'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  if (abs >= 1_000_000) return `${symbol}${(safe / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${symbol}${(safe / 1_000).toFixed(1)}K`;
  return `${symbol}${safe.toFixed(0)}`;
}

export function formatNumber(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString('en-US');
}

export function formatPercent(value: number, decimals: number = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(decimals)}%`;
}

export function formatDate(date: string | Date | null, pattern: string = 'dd MMM yyyy'): string {
  if (!date) return '—';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(parsed.getTime())) return '—';
  return format(parsed, pattern);
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return '—';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(parsed.getTime())) return '—';
  return format(parsed, 'dd MMM yyyy, HH:mm');
}

export function formatTime(date: string | Date | null): string {
  if (!date) return '—';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(parsed.getTime())) return '—';
  return format(parsed, 'HH:mm');
}

export function formatRelative(date: string | Date | null): string {
  if (!date) return '—';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(parsed.getTime())) return '—';
  if (isToday(parsed)) return `Today, ${format(parsed, 'HH:mm')}`;
  if (isYesterday(parsed)) return `Yesterday, ${format(parsed, 'HH:mm')}`;
  return formatDistanceToNow(parsed, { addSuffix: true });
}

export function initials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function toInputDate(date: string | Date | null): string {
  if (!date) return '';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (isNaN(parsed.getTime())) return '';
  return format(parsed, 'yyyy-MM-dd');
}

export function todayInputDate(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
