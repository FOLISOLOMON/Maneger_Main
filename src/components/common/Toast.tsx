// Veloura Manager V2 — Toast notifications
// Lightweight toast system using React context + a portal. Spec section 7.2
// mentions Sonner, but we avoid an extra dependency with a small built-in
// implementation that follows the same API shape.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onUndo: () => void;
}

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, options?: { duration?: number; action?: ToastAction }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success', options?: { duration?: number; action?: ToastAction }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message, duration: options?.duration, action: options?.action }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-[calc(100%-2rem)] max-w-sm">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { action } = toast;
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    if (!action) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [action, duration, onClose]);

  const handleUndo = () => {
    action?.onUndo();
    onClose();
  };

  const styles: Record<ToastType, string> = {
    success: 'bg-success',
    error: 'bg-danger',
    info: 'bg-action',
  };
  const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : Info;

  return (
    <div
      className={`${styles[toast.type]} text-white rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 pointer-events-auto animate-[slideIn_0.2s_ease-out]`}
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
      {action && (
        <button
          onClick={handleUndo}
          className="flex-shrink-0 text-xs font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
      <button onClick={onClose} className="flex-shrink-0 opacity-80 hover:opacity-100" aria-label="Close">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
