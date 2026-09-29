import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition duration-150 ' +
  'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-ink shadow-card hover:bg-brand-strong',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-bg-2',
  soft: 'bg-brand-soft text-ink hover:brightness-95',
  ghost: 'text-ink hover:bg-bg-2',
  danger: 'bg-bad text-bg hover:brightness-110',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-14 px-7 text-base',
};

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) =>
  cn(base, variants[variant], sizes[size], extra);

type Common = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; iconRight?: ReactNode; block?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & Common & { loading?: boolean }>(function Button(
  { variant, size, icon, iconRight, block, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={buttonClass(variant, size, cn(block && 'w-full', className))} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export function ButtonLink({ variant, size, icon, iconRight, block, className, children, ...rest }: LinkProps & Common) {
  return (
    <Link className={buttonClass(variant, size, cn(block && 'w-full', className))} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('tap inline-flex items-center justify-center rounded-full text-ink transition hover:bg-bg-2 active:scale-95', className)}
      {...rest}
    >
      {children}
    </button>
  );
}
