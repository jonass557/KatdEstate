import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'default';
export type ButtonSize = 'sm' | 'default' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  default: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
  outline: 'border border-border bg-background hover:bg-muted text-foreground',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

/** Shared class recipe so links can be styled as buttons without abusing the element. */
export function buttonVariants(variant: ButtonVariant = 'primary', className?: string): string {
  return cn(BASE, SIZES.default, VARIANTS[variant], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ className, variant = 'primary', size = 'default', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(BASE, SIZES[size], VARIANTS[variant], className)} {...props} />;
}
