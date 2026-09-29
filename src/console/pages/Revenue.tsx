import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { BarList } from '@/shared/charts/BarList';
import { ChartCard } from '@/shared/charts/ChartCard';
import { LineChart } from '@/shared/charts/LineChart';
import { compact } from '@/shared/charts/util';
import { listRevenue, type RevenueRow } from '../api/content';
import { Empty, Kpi, PageHeader, Panel, Table, td } from '../ui/Page';

const sourceLabel: Record<string, string> = { mpesa: 'M-Pesa', bank: 'Bank', cash: 'Cash' };

const csvCell = (v: string | number | null) => {
  const s = String(v ?? '');
  // Cells that start with = + - @ would be run as formulas by a spreadsheet: neutralise them.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function download(rows: RevenueRow[]) {
  const head = ['Received', 'Reference', 'Stream', 'Source', 'Amount (KES)', 'Reconciled'];
  const lines = [head, ...rows.map((r) => [r.received_at, r.reference, r.stream, sourceLabel[r.source] ?? r.source, r.amount, r.reconciled ? 'yes' : 'no'])];
  const blob = new Blob([lines.map((l) => l.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `revenue-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Money in over the last 30 days, by stream and by day, with what still has to be matched to a bank line. */
export default function Revenue() {
  usePageTitle('Revenue', 'CountyConnect');
  const { kes, date } = useI18n();
  const q = useQuery({ queryKey: ['c-revenue'], queryFn: listRevenue });
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const [now] = useState(() => Date.now());

  const stats = useMemo(() => {
    const total = rows.reduce((a, r) => a + r.amount, 0);
    const open = rows.filter((r) => !r.reconciled);
    const byStream = new Map<string, number>();
    rows.forEach((r) => byStream.set(r.stream, (byStream.get(r.stream) ?? 0) + r.amount));
    const streams = [...byStream].sort((a, b) => b[1] - a[1]);
    const days = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * 86_400_000));
    const key = (d: Date) => d.toISOString().slice(0, 10);
    const perDay = new Map(days.map((d) => [key(d), 0]));
    rows.forEach((r) => { const k = r.received_at.slice(0, 10); if (perDay.has(k)) perDay.set(k, perDay.get(k)! + r.amount); });
    return { total, open, openTotal: open.reduce((a, r) => a + r.amount, 0), streams, days, perDay: days.map((d) => perDay.get(key(d)) ?? 0) };
  }, [rows, now]);

  return (
    <>
      <PageHeader title="Revenue" subtitle="Everything paid to the county in the last 30 days: M-Pesa payments arrive by themselves, bank and cash lines are matched by the finance team." actions={<Button variant="secondary" icon={<Download className="size-4" aria-hidden />} disabled={!rows.length} onClick={() => download(rows)}>Download CSV</Button>} />
      {q.isLoading ? <Skeleton className="h-64" /> : rows.length === 0 ? <Empty>No revenue recorded in the last 30 days.</Empty> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Collected" value={kes(stats.total, { compact: true })} hint="last 30 days" />
            <Kpi label="Payments" value={rows.length} />
            <Kpi label="Not yet matched" value={stats.open.length} tone={stats.open.length ? 'warn' : 'good'} hint={kes(stats.openTotal, { compact: true })} />
            <Kpi label="Top stream" value={stats.streams[0]?.[0] ?? '–'} hint={stats.streams[0] ? kes(stats.streams[0][1], { compact: true }) : undefined} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <ChartCard
              title="By day" subtitle="Collections per day, last 30 days" chartLabel="Show chart" tableLabel="Show table"
              table={{ head: ['Day', 'Collected (KES)'], rows: stats.days.map((d, i) => [date(d, { day: 'numeric', month: 'short' }), stats.perDay[i]!]) }}
            >
              <LineChart ariaLabel="Revenue collected per day" labels={stats.days.map((d) => date(d, { day: 'numeric', month: 'short' }))} series={[{ key: 'kes', label: 'Collected', color: 'var(--series-1)', values: stats.perDay, area: true }]} format={(n) => `KES ${compact(n)}`} />
            </ChartCard>
            <ChartCard
              title="By stream" subtitle="Where the money comes from" chartLabel="Show chart" tableLabel="Show table"
              table={{ head: ['Stream', 'Collected (KES)'], rows: stats.streams.map(([s, v]) => [s, v]) }}
            >
              <BarList ariaLabel="Revenue by stream" labelWidth={150} format={(n) => compact(n)} rows={stats.streams.map(([s, v]) => ({ key: s, label: s, segments: [{ value: v, color: 'var(--series-1)', label: s }] }))} />
            </ChartCard>
          </div>

          <Panel className="mt-6" title="Not yet matched to a bank line" pad={false}>
            {stats.open.length === 0 ? <div className="p-5"><Empty>Everything is matched.</Empty></div> : (
              <Table head={['Received', 'Reference', 'Stream', 'Source', 'Amount']}>
                {stats.open.slice(0, 25).map((r) => (
                  <tr key={r.id}>
                    <td className={td}>{date(r.received_at)}</td>
                    <td className={`${td} font-data text-[0.82rem]`}>{r.reference}</td>
                    <td className={td}>{r.stream}</td>
                    <td className={td}><Chip>{sourceLabel[r.source] ?? r.source}</Chip></td>
                    <td className={`${td} font-data font-semibold`}>{kes(r.amount)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
