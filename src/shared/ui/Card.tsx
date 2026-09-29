import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[var(--radius-card)] border border-line bg-surface shadow-card', className)} {...rest} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' | 'warn' }) {
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div>
      <div className={cn('font-display text-3xl font-extrabold leading-none tracking-tight tabular-nums', color)}>{value}</div>
      <div className="mt-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function SectionTitle({ eyebrow, title, intro, className }: { eyebrow?: string; title: string; intro?: string; className?: string }) {
  return (
    <div className={cn('max-w-2xl', className)}>
      {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-strong">{eyebrow}</p>}
      <h2 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold">{title}</h2>
      {intro && <p className="mt-3 text-[1.05rem] text-ink-2">{intro}</p>}
    </div>
  );
}
