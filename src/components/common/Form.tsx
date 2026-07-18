// Veloura Manager V2 — Form input primitives
// Shared Input, Select, Textarea, Field wrapper. Spec section 7.26: "Reuse
// shared form components." Every form in the app composes these.

import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { clsx } from 'clsx';

const baseField =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-plum-500 focus:ring-2 focus:ring-plum-100 focus:outline-none transition-colors ' +
  'disabled:bg-slate-50 disabled:text-slate-500';

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, error, hint, required, children }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      {label && (
        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="text-xs text-slate-500">{hint}</span>}
      {error && <span className="text-xs text-red-600 font-medium">{error}</span>}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  prefix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, prefix, ...props }, ref) => (
    <div className="relative">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        className={clsx(
          baseField,
          'h-11',
          prefix && 'pl-8',
          invalid && 'border-red-400 focus:border-red-500 focus:ring-red-100',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
Input.displayName = 'Input';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx(
        baseField,
        'h-11 appearance-none bg-no-repeat pr-9',
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2364748b%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.06l3.71-3.83a.75.75%200%20111.08%201.04l-4.25%204.39a.75.75%200%2001-1.08%200L5.21%208.27a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%3E%3C/path%3E%3C/svg%3E')] bg-[right_0.6rem_center] bg-[length:1.2rem_1.2rem]",
        invalid && 'border-red-400 focus:border-red-500 focus:ring-red-100',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx(
        baseField,
        'py-2.5 resize-none leading-relaxed',
        invalid && 'border-red-400 focus:border-red-500 focus:ring-red-100',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
