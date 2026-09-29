import { cn } from '@/shared/lib/utils';

/** Horizontal bar, e.g. budget spent. Accessible as a meter. */
export function Meter({ value, max = 100, label, tone = 'brand', className }: { value: number; max?: number; label: string; tone?: 'brand' | 'good' | 'bad' | 'warn' | 'info'; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar = { brand: 'bg-brand', good: 'bg-good', bad: 'bg-bad', warn: 'bg-warn', info: 'bg-info' }[tone];
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className={cn('h-2.5 w-full overflow-hidden rounded-full bg-bg-2', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Circular progress ring, used for SLA countdowns and the trust index. */
export function Ring({ value, size = 84, stroke = 9, tone = 'brand', children, label }: { value: number; size?: number; stroke?: number; tone?: 'brand' | 'good' | 'bad' | 'warn' | 'info'; children?: React.ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value));
  const color = { brand: 'var(--brand)', good: 'var(--good)', bad: 'var(--bad)', warn: 'var(--warn)', info: 'var(--info)' }[tone];
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
