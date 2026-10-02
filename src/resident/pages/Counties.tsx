import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { county } from '@/shared/config/county';
import { useCountyFinance, useIsDemo } from '@/shared/api/hooks';
import { countyName } from '@/shared/api/civic2';
import type { CountyFinance } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { SelectInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';

type Sort = 'dev' | 'osr' | 'bills' | 'name';
const pct = (a: number | null, b: number | null) => (a !== null && b ? Math.round((100 * a) / b) : null);
const opinionTone: Record<NonNullable<CountyFinance['audit_opinion']>, Tone> = { unqualified: 'good', qualified: 'warn', adverse: 'bad', disclaimer: 'bad' };

/** Every county's spending, revenue and audit result, from the Controller of Budget and the Auditor-General. */
export default function Counties() {
  const { t, kes, number } = useI18n();
  const q = useCountyFinance();
  const demo = useIsDemo();
  usePageTitle(t('counties.title'));
  const years = useMemo(() => [...new Set((q.data ?? []).map((r) => r.fiscal_year))].sort().reverse(), [q.data]);
  const [year, setYear] = useState('');
  const [sort, setSort] = useState<Sort>('dev');
  const fy = year || years[0] || '';
  const rows = useMemo(() => {
    const r = (q.data ?? []).filter((x) => x.fiscal_year === fy).map((x) => ({ ...x, dev: pct(x.dev_spent, x.dev_budget), osr: pct(x.osr_actual, x.osr_target) }));
    const key = (x: (typeof r)[number]) => (sort === 'dev' ? x.dev ?? -1 : sort === 'osr' ? x.osr ?? -1 : sort === 'bills' ? -(x.pending_bills ?? 0) : 0);
    return sort === 'name' ? r.sort((a, b) => (countyName.get(a.county_code) ?? '').localeCompare(countyName.get(b.county_code) ?? '')) : r.sort((a, b) => key(b) - key(a));
  }, [q.data, fy, sort]);
  const avg = (k: 'dev' | 'osr') => { const v = rows.map((r) => r[k]).filter((x): x is number => x !== null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  const me = county.code;
  const bar = (v: number | null) => (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-2"><span className={cn('block h-full rounded-full', v === null ? '' : v >= 80 ? 'bg-good' : v >= 50 ? 'bg-warn' : 'bg-bad')} style={{ width: `${Math.min(100, v ?? 0)}%` }} /></span>
      <span className="font-data">{v === null ? '-' : `${v}%`}</span>
    </span>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('counties.title')}</h1>
      <p className="mt-3 max-w-3xl text-[1.05rem] text-ink-2">{t('counties.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-bad">{t('counties.demo')}</p>}

      {q.isLoading ? <Skeleton className="mt-8 h-96" /> : rows.length === 0 ? <p className="mt-8 rounded-2xl bg-bg-2 p-5 text-sm">{t('counties.none')}</p> : (
        <>
          <div className="mt-6 flex flex-wrap items-end gap-3">
            {years.length > 1 && <label className="text-sm font-semibold">{t('counties.year')}<SelectInput className="mt-1.5" value={fy} onChange={(e) => setYear(e.target.value)}>{years.map((y) => <option key={y} value={y}>{y}</option>)}</SelectInput></label>}
            <label className="text-sm font-semibold">{t('counties.sort')}<SelectInput className="mt-1.5" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{(['dev', 'osr', 'bills', 'name'] as Sort[]).map((s) => <option key={s} value={s}>{t(`counties.sorts.${s}` as MessageKey)}</option>)}</SelectInput></label>
            <p className="text-sm text-muted">{t('counties.average', { dev: avg('dev') ?? '-', osr: avg('osr') ?? '-' })}</p>
          </div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[46rem] text-sm">
              <thead><tr className="border-b border-line bg-bg-2/60 text-left text-xs uppercase tracking-[0.06em] text-muted">
                <th scope="col" className="px-3 py-2.5">#</th><th scope="col" className="px-3 py-2.5">{t('counties.county')}</th>
                <th scope="col" className="px-3 py-2.5">{t('counties.dev')}</th><th scope="col" className="px-3 py-2.5">{t('counties.osr')}</th>
                <th scope="col" className="px-3 py-2.5 text-right">{t('counties.bills')}</th><th scope="col" className="px-3 py-2.5">{t('counties.audit')}</th><th scope="col" className="px-3 py-2.5"><span className="sr-only">{t('counties.source')}</span></th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((r, i) => (
                  <tr key={r.county_code} className={cn(r.county_code === me && 'bg-brand-soft font-semibold')}>
                    <td className="px-3 py-2 font-data text-muted">{i + 1}</td>
                    <th scope="row" className="px-3 py-2 text-left">{countyName.get(r.county_code) ?? r.county_code}</th>
                    <td className="px-3 py-2">{bar(r.dev)}</td>
                    <td className="px-3 py-2">{bar(r.osr)}</td>
                    <td className="px-3 py-2 text-right font-data">{r.pending_bills === null ? '-' : kes(r.pending_bills, { compact: true })}</td>
                    <td className="px-3 py-2">{r.audit_opinion ? <Chip tone={opinionTone[r.audit_opinion]}>{t(`counties.opinion.${r.audit_opinion}` as MessageKey)}</Chip> : '-'}</td>
                    <td className="px-3 py-2">{r.source_url ? <a href={r.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline" title={r.source}><ExternalLink className="size-3.5" aria-hidden />{t('counties.source')}</a> : <span className="text-xs text-muted" title={r.source}>{r.source.slice(0, 18)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-5 grid gap-3 text-sm text-ink-2 sm:grid-cols-3">
            <div><dt className="font-semibold text-ink">{t('counties.dev')}</dt><dd>{t('counties.devHelp')}</dd></div>
            <div><dt className="font-semibold text-ink">{t('counties.osr')}</dt><dd>{t('counties.osrHelp')}</dd></div>
            <div><dt className="font-semibold text-ink">{t('counties.audit')}</dt><dd>{t('counties.auditHelp')}</dd></div>
          </dl>
          <p className="mt-4 text-xs text-muted">{t('counties.counted', { n: number(rows.length) })}</p>
        </>
      )}
    </div>
  );
}
