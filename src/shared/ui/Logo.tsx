import { cn } from '@/shared/lib/utils';

/** The County Yangu mark: a map pin at sunrise. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-9 w-9 shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="40" height="40" rx="12" fill="var(--ink)" />
      <path d="M20 7.5c-5.2 0-9.2 3.9-9.2 8.9 0 6.2 7.2 13.6 8.4 14.8a1.1 1.1 0 0 0 1.6 0c1.2-1.2 8.4-8.6 8.4-14.8 0-5-4-8.9-9.2-8.9Z" fill="var(--brand)" />
      <circle cx="20" cy="16.6" r="3.6" fill="var(--ink)" />
      <path d="M8 33.2c3.2-2.4 6.6-3.4 12-3.4s8.8 1 12 3.4" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

export function Wordmark({ className, sub }: { className?: string; sub?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="leading-none">
        <span className="whitespace-nowrap font-display text-[1.15rem] font-extrabold tracking-tight">
          County <span className="text-brand-strong">Yangu</span>
        </span>
        {sub && <span className="sub mt-0.5 block text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted">{sub}</span>}
      </span>
    </span>
  );
}
