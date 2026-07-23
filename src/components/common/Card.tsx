// Veloura Manager V2 — Card + state components
// Card is the base surface for all content panels. EmptyState, LoadingState,
// ErrorState, and Skeleton follow spec sections 7.22-7.24. Colors use the
// brand design tokens.

import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import { Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export function Card({ children, className, padding = 'md', hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-card rounded-2xl shadow-card border border-border',
        hover && 'transition-all duration-200 hover:shadow-card-hover hover:border-border-strong cursor-pointer',
        onClick && 'cursor-pointer',
        paddingMap[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h2 className="text-base md:text-lg font-display font-bold text-text-primary truncate">{title}</h2>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  color?: string;
  dot?: string;
  className?: string;
}

export function Badge({ children, color = 'bg-surface-alt text-text-secondary', dot, className }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap', color, className)}>
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dot)} />}
      {children}
    </span>
  );
}

export function ProgressBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx('h-2 w-full rounded-full bg-border overflow-hidden', className)}>
      <div
        className={clsx('h-full rounded-full bg-accent transition-all duration-500', barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  hint?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}

export function EmptyState({ icon, title, description, hint, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-surface-alt flex items-center justify-center text-text-muted mb-4">
        {icon ?? <Inbox className="w-7 h-7" />}
      </div>
      <h3 className="font-display font-bold text-text-primary text-base">{title}</h3>
      {description && <p className="text-sm text-text-muted mt-1 max-w-xs">{description}</p>}
      {hint && <p className="text-xs text-text-muted/80 mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
      {secondaryAction && <div className="mt-3">{secondaryAction}</div>}
    </div>
  );
}

export function LoadingState({ message = 'Loading…', rows = 3 }: { message?: string; rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-alt" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-surface-alt rounded w-1/3" />
            <div className="h-3 bg-border rounded w-1/2" />
          </div>
          <div className="h-3 bg-surface-alt rounded w-16" />
        </div>
      ))}
      <p className="text-xs text-text-muted text-center">{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-danger-bg flex items-center justify-center text-danger mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <p className="text-sm font-semibold text-text-primary">{message ?? 'Something went wrong'}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-surface-alt', className)} />;
}
