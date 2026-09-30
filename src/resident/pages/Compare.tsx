import { Link, useSearchParams } from 'react-router-dom';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useIsDemo, useWardScorecard } from '@/shared/api/hooks';
import type { WardScorecard } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { SelectInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';

const sorted = [...wards].sort((a, b) => a.name.localeCompare(b.name));

type Row = { key: MessageKey; get: (s: WardScorecard) => number | null; higherIsBetter: boolean | null; format?: 'kes' | 'pct' };
const rows: Row[] = [
  { key: 'loop.scorecard.received', get: (s) => s.cases.received_90d, higherIsBetter: null },
  { key: 'loop.scorecard.resolved', get: (s) => s.cases.resolved_90d, higherIsBetter: true },
  { key: 'loop.scorecard.open', get: (s) => s.cases.open, higherIsBetter: false },
  { key: 'loop.scorecard.overdue', get: (s) => s.cases.overdue, higherIsBetter: false },
  { key: 'loop.scorecard.median', get: (s) => (s.cases.median_days === null ? null : Number(s.cases.median_days)), higherIsBetter: false },
  { key: 'loop.scorecard.confirmed', get: (s) => (s.confirmed.responses > 0 ? Math.round((100 * s.confirmed.fixed) / s.confirmed.responses) : null), higherIsBetter: true, format: 'pct' },
  { key: 'loop.scorecard.projects', get: (s) => s.projects.count, higherIsBetter: null },
  { key: 'loop.assembly.stalled', get: (s) => s.projects.stalled, higherIsBetter: false },
  { key: 'loop.assembly.awarded', get: (s) => s.tenders.awarded_value, higherIsBetter: null, format: 'kes' },
];

function WardPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { t } = useI18n();
  return (
    <label className="block text-sm font-semibold">
      {label}
      <SelectInput className="mt-1.5 w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('loop.compare.pick')}</option>
        {sorted.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </SelectInput>
    </label>
  );
}

export default function Compare() {
  const { t, number, kes } = useI18n();
  const [params, setParams] = useSearchParams();
  const a = params.get('a') ?? '';
  const b = params.get('b') ?? '';
  const qa = useWardScorecard(a || null);
  const qb = useWardScorecard(b || null);
  const demo = useIsDemo();
  usePageTitle(t('loop.compare.title'));
  const set = (k: 'a' | 'b', v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  const fmt = (v: number | null, f?: Row['format']) => (v === null ? '-' : f === 'kes' ? kes(v, { compact: true }) : f === 'pct' ? `${v}%` : number(v));
  const sa = qa.data;
  const sb = qb.data;
  const loading = (a && qa.isLoading) || (b && qb.isLoading);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('loop.compare.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('loop.compare.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <WardPicker label="A" value={a} onChange={(v) => set('a', v)} />
        <WardPicker label="B" value={b} onChange={(v) => set('b', v)} />
      </div>

      {loading ? <Skeleton className="mt-8 h-80" /> : sa && sb ? (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b border-line bg-bg-2/60 text-left">
                <th scope="col" className="px-4 py-3 font-semibold text-muted">{t('loop.compare.metric')}</th>
                <th scope="col" className="px-4 py-3 text-right font-display font-bold"><Link to={`/ward/${sa.ward_id}`} className="hover:underline">{sa.ward}</Link></th>
                <th scope="col" className="px-4 py-3 text-right font-display font-bold"><Link to={`/ward/${sb.ward_id}`} className="hover:underline">{sb.ward}</Link></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const va = r.get(sa);
                const vb = r.get(sb);
                const winner = r.higherIsBetter === null || va === null || vb === null || va === vb ? null : (va > vb) === r.higherIsBetter ? 'a' : 'b';
                const cell = (v: number | null, side: 'a' | 'b') => (
                  <td className={cn('px-4 py-3 text-right font-data', winner === side && 'font-bold text-good')}>
                    {fmt(v, r.format)}
                    {winner === side && <span className="ml-1.5 rounded-full bg-good-soft px-2 py-0.5 text-[0.7rem] font-semibold">{t('loop.compare.better')}</span>}
                  </td>
                );
                return (
                  <tr key={r.key}>
                    <th scope="row" className="px-4 py-3 text-left font-semibold">{t(r.key)}</th>
                    {cell(va, 'a')}
                    {cell(vb, 'b')}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
