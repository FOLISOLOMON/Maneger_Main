// Veloura Manager V2 — Modal / BottomSheet
// Single component that renders as a centered modal on desktop and a
// bottom sheet on mobile, per spec section 7.19. Handles backdrop click,
// ESC key, and scroll lock. Colors use the brand design tokens.

import { useEffect, type ReactNode } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
};

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-scrim/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={clsx(
          'relative bg-surface w-full rounded-t-3xl sm:rounded-2xl shadow-2xl',
          'max-h-[92vh] flex flex-col animate-slide-up sm:animate-scale-in',
          sizeMap[size],
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-border">
            <div className="min-w-0">
              <h2 className="text-lg font-display font-bold text-text-primary truncate">{title}</h2>
              {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-alt hover:text-text-secondary transition-colors touch-target"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-border bg-surface-alt/50 rounded-b-2xl flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
