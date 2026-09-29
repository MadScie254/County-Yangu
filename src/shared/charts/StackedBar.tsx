import { useState } from 'react';
import { useElementWidth } from './util';

export type Part = { key: string; label: string; value: number; color: string };

/** One 100% bar: part-to-whole. 2px gaps between parts; a % is written inside a part only if it fits. */
export function StackedBar({ parts, format = (n: number) => `${Math.round(n)}%`, ariaLabel }: { parts: Part[]; format?: (pct: number) => string; ariaLabel: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<string | null>(null);
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div ref={ref} className="relative">
      <div className="flex h-9 w-full" style={{ gap: 2 }} role="img" aria-label={ariaLabel}>
        {shown.map((p, i) => {
          const pct = (p.value / total) * 100;
          const fits = (width * pct) / 100 > 52;
          return (
            <div
              key={p.key}
              tabIndex={0}
              onMouseEnter={() => setActive(p.key)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(p.key)} onBlur={() => setActive(null)}
              className="grid place-items-center overflow-hidden text-xs font-bold text-white"
              style={{ flex: p.value, background: p.color, borderRadius: `${i === 0 ? 8 : 2}px ${i === shown.length - 1 ? 8 : 2}px ${i === shown.length - 1 ? 8 : 2}px ${i === 0 ? 8 : 2}px`, textShadow: '0 1px 1px rgb(0 0 0 / .25)' }}
            >
              {fits && format(pct)}
            </div>
          );
        })}
      </div>
      {active && (() => {
        const p = parts.find((x) => x.key === active)!;
        return (
          <div role="status" className="pointer-events-none absolute -top-12 left-0 z-10 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-float">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: p.color }} />{p.label}</span> <b className="ml-2 font-data">{format((p.value / total) * 100)} · {p.value}</b>
          </div>
        );
      })()}
    </div>
  );
}
