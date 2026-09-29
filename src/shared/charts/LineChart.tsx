import { useId, useMemo, useState } from 'react';
import { compact, niceScale, useElementWidth } from './util';

export type Series = { key: string; label: string; color: string; values: number[]; area?: boolean };

/**
 * Multi-series line chart. 2px lines, hairline solid grid, 8px end dots with a surface ring,
 * hover (and arrow-key) crosshair with a tooltip. One y-axis only.
 */
export function LineChart({ series, labels, height = 240, ariaLabel, format = (n: number) => String(n) }: { series: Series[]; labels: string[]; height?: number; ariaLabel: string; format?: (n: number) => string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const uid = useId();
  const n = labels.length;
  const m = { top: 12, right: 18, bottom: 26, left: 40 };
  const iw = Math.max(0, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const scale = useMemo(() => niceScale(Math.max(1, ...series.flatMap((s) => s.values))), [series]);
  const x = (i: number) => m.left + (n <= 1 ? 0 : (i * iw) / (n - 1));
  const y = (v: number) => m.top + ih - (v / scale.max) * ih;
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const onMove = (clientX: number, rect: DOMRect) => {
    if (n < 2) return;
    const rel = (clientX - rect.left - m.left) / iw;
    setHover(Math.min(n - 1, Math.max(0, Math.round(rel * (n - 1)))));
  };

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} className="overflow-visible">
          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]" style={{ fontVariantNumeric: 'tabular-nums' }}>{compact(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % Math.ceil(n / Math.max(2, Math.floor(iw / 64))) === 0 || i === n - 1) && <text key={l + i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-muted text-[11px]">{l}</text>)}

          {series.map((s, si) => (
            <g key={s.key}>
              {s.area && (
                <>
                  <defs>
                    <linearGradient id={`${uid}-${si}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor={s.color} stopOpacity="0.14" />
                      <stop offset="1" stopColor={s.color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${path(s.values)} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${uid}-${si})`} />
                </>
              )}
              <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            </g>
          ))}

          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + ih} stroke="var(--line-strong)" strokeWidth={1} />
              {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
            </g>
          )}

          {/* hit area is the whole plot, far larger than any mark */}
          <rect
            x={m.left} y={m.top} width={iw} height={ih} fill="transparent" tabIndex={0} role="group" aria-label={`${ariaLabel} — arrow keys`}
            onMouseMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onTouchMove={(e) => e.touches[0] && onMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
            onMouseLeave={() => setHover(null)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
              else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
              else if (e.key === 'Escape') setHover(null);
            }}
          />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 min-w-36 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-float"
          style={{ left: Math.min(Math.max(x(hover) - 72, 0), Math.max(0, width - 150)), top: 0 }}
        >
          <p className="text-xs font-semibold text-muted">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.key} className="mt-0.5 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />{s.label}</span>
              <b className="font-data">{format(s.values[hover] ?? 0)}</b>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
