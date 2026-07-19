// Veloura Manager V2 — Button component
// Single button with variants. Spec section 7.19 lists Button as a core
// reusable component. Colors flow from the brand design tokens.

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'gold';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-action text-white hover:bg-action-light active:bg-action-dark shadow-sm',
  secondary: 'bg-surface-alt text-text-primary hover:bg-border active:bg-border-strong',
  ghost: 'text-text-secondary hover:bg-surface-alt active:bg-border',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-80 shadow-sm',
  outline: 'border border-border-strong text-text-primary hover:bg-surface-alt active:bg-border bg-surface',
  gold: 'bg-accent text-white hover:bg-accent-muted active:opacity-90 shadow-sm',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
  icon: 'h-10 w-10 rounded-lg justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold transition-all duration-150 touch-target',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
