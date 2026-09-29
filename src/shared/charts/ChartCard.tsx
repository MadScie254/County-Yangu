import { useState, type ReactNode } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type ChartTable = { head: string[]; rows: (string | number)[][] };

/** Title + subtitle + chart, with a "view as table" switch: every chart has a text equivalent. */
export function ChartCard({ title, subtitle, legend, table, chartLabel, tableLabel, children, className }: { title: string; subtitle?: string; legend?: ReactNode; table: ChartTable; chartLabel: string; tableLabel: string; children: ReactNode; className?: string }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={cn('rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6', className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold leading-tight">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="tap -mr-2 -mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-ink-2 hover:bg-bg-2">
          {asTable ? <BarChart3 className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
          {asTable ? chartLabel : tableLabel}
        </button>
      </header>
      {legend && !asTable && <div className="mt-3">{legend}</div>}
      <div className="mt-4">
        {asTable ? (
          <div className="max-h-80 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-bg-2 text-xs uppercase tracking-wide text-muted">
                <tr>{table.head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j} className={cn('px-3 py-2', j > 0 && 'font-data')}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
          {i.value && <b className="font-data text-ink">{i.value}</b>}
        </li>
      ))}
    </ul>
  );
}
