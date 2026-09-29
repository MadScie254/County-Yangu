import { useState } from 'react';
import { cn } from '@/shared/lib/utils';

export type BarSegment = { value: number; color: string; label: string };
export type BarRow = { key: string; label: string; segments: BarSegment[]; href?: string };

/**
 * Horizontal bars for comparing magnitude. Thin (14px), 4px rounded data-end, square at the baseline,
 * 2px surface gap between stacked segments, the total at the tip in ink (never in the series colour).
 */
export function BarList({ rows, format = (n: number) => String(n), labelWidth = 132, max: forcedMax, ariaLabel }: { rows: BarRow[]; format?: (n: number) => string; labelWidth?: number; max?: number; ariaLabel: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = forcedMax ?? Math.max(1, ...rows.map((r) => r.segments.reduce((a, s) => a + s.value, 0)));
  return (
    <ul aria-label={ariaLabel} className="space-y-2.5">
      {rows.map((r) => {
        const total = r.segments.reduce((a, s) => a + s.value, 0);
        const visible = r.segments.filter((s) => s.value > 0);
        return (
          <li key={r.key} className="relative" onMouseEnter={() => setActive(r.key)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(r.key)} onBlur={() => setActive(null)}>
            <div className="flex items-center gap-3">
              <span className="shrink-0 truncate text-sm text-ink-2" style={{ width: labelWidth }} title={r.label}>{r.label}</span>
              <div className="flex h-3.5 min-w-0 flex-1 items-center">
                <div className="flex h-full" style={{ width: `${(total / max) * 100}%`, minWidth: total > 0 ? 6 : 0, gap: 2 }} tabIndex={0} role="img" aria-label={`${r.label}: ${r.segments.map((s) => `${s.label} ${format(s.value)}`).join(', ')}`}>
                  {visible.map((s, i) => (
                    <span key={s.label} className="h-full" style={{ flex: s.value, background: s.color, borderTopRightRadius: i === visible.length - 1 ? 4 : 0, borderBottomRightRadius: i === visible.length - 1 ? 4 : 0 }} />
                  ))}
                </div>
                <span className="ml-2 shrink-0 font-data text-sm font-medium">{format(total)}</span>
              </div>
            </div>
            {active === r.key && r.segments.length > 1 && (
              <div role="status" className={cn('pointer-events-none absolute z-10 -top-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-float')} style={{ left: labelWidth + 16 }}>
                {r.segments.map((s) => (
                  <p key={s.label} className="flex items-center justify-between gap-4"><span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span><b className="font-data">{format(s.value)}</b></p>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
