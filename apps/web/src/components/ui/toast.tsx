import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  title: string;
  description?: string | undefined;
  variant?: ToastVariant | undefined;
  durationMs?: number | undefined;
}

interface ToastRecord {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: 'border-border bg-card text-card-foreground',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  error: 'border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-100',
};

function VariantIcon({ variant }: { variant: ToastVariant }) {
  const className = 'size-4 shrink-0';
  if (variant === 'success') return <CheckCircle2 className={className} aria-hidden />;
  if (variant === 'warning') return <AlertTriangle className={className} aria-hidden />;
  if (variant === 'error') return <XCircle className={className} aria-hidden />;
  return <Info className={className} aria-hidden />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = `toast_${crypto.randomUUID()}`;
      const record: ToastRecord = {
        id,
        title: options.title,
        variant: options.variant ?? 'info',
        ...(options.description !== undefined ? { description: options.description } : {}),
      };
      setToasts((current) => [...current, record]);
      window.setTimeout(() => dismiss(id), options.durationMs ?? 5000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className={cn(
              'animate-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur',
              VARIANT_STYLES[item.variant],
            )}
          >
            <VariantIcon variant={item.variant} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-xs opacity-80">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded-md p-1 opacity-60 transition hover:opacity-100 focus-visible:opacity-100"
              aria-label="Fermer la notification"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast doit être utilisé dans un ToastProvider.');
  return context;
}
