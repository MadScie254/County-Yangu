import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-[clamp(1.7rem,4vw,2.3rem)] font-extrabold leading-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, action, children, className, pad = true }: { title?: string; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn('rounded-[1.5rem] border border-line bg-surface shadow-card', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={cn(pad && 'p-5')}>{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line-strong p-10 text-center text-muted">{children}</p>;
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: 'bad' | 'good' | 'warn' }) {
  return (
    <div className="rounded-[1.25rem] border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={cn('mt-1.5 font-display text-3xl font-extrabold leading-none tracking-tight', tone === 'bad' && 'text-bad', tone === 'good' && 'text-good', tone === 'warn' && 'text-warn')}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const th = 'px-4 py-2.5 text-left text-xs font-bold uppercase tracking-[0.08em] text-muted';
export const td = 'px-4 py-3 align-top';

export function Table({ head, children, className }: { head: string[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative overflow-x-auto', className)}>
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-line bg-bg-2/60"><tr>{head.map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
