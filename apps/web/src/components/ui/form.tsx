import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
export function FormMessage({ children }: { children: ReactNode }) {
  return <p className={cn('text-xs text-red-600', !children && 'hidden')}>{children}</p>;
}
