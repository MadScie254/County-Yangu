import { useState } from 'react';
import { Check, Vote } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useBudgetResults, useIsDemo } from '@/shared/api/hooks';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { ButtonLink } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { SelectInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';

export default function Results() {
  const { t, kes, number, date } = useI18n();
  const [cycle, setCycle] = useState<string | null>(null);
  const q = useBudgetResults(cycle);
  const demo = useIsDemo();
  usePageTitle(t('loop.results.title'));
  const d = q.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('loop.results.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('loop.results.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      {q.isLoading && <Skeleton className="mt-8 h-64" />}
      {d && !d.cycle && (
        <div className="mt-8 rounded-[1.5rem] border border-line bg-surface p-6 shadow-card">
          <p className="text-ink-2">{t('loop.results.empty')}</p>
          <ButtonLink to="/vote" className="mt-4" icon={<Vote className="size-4" aria-hidden />}>{t('loop.results.voteNow')}</ButtonLink>
        </div>
      )}
      {d?.cycle && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-display text-xl font-bold">{d.cycle.title}</p>
              <p className="text-sm text-muted">{date(d.cycle.starts_at)} to {date(d.cycle.ends_at)} · {t('loop.results.total', { count: number(d.total_votes ?? 0) })}</p>
            </div>
            {d.cycles.length > 1 && (
              <label className="text-sm font-semibold">
                {t('loop.results.round')}
                <SelectInput className="mt-1.5" value={d.cycle.id} onChange={(e) => setCycle(e.target.value)}>
                  {d.cycles.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </SelectInput>
              </label>
            )}
          </div>
          <div className="mt-6 space-y-5">
            {d.wards.map((w) => {
              const top = Math.max(1, ...w.options.map((o) => o.votes));
              return (
                <section key={w.ward_id} className="rounded-[1.5rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-label={w.ward}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-xl font-bold">{w.ward}</h2>
                    <p className="text-sm text-muted">{t('loop.results.envelope')}: <b className="text-ink">{kes(w.envelope, { compact: true })}</b> · {t('loop.results.votes', { count: w.votes })}</p>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {w.options.map((o) => (
                      <li key={o.id}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 font-semibold">{o.title} <span className="font-normal text-muted">· {kes(o.amount, { compact: true })}</span></span>
                          {o.funded ? <Chip tone="good"><Check className="size-3.5" aria-hidden />{t('loop.results.funded')}</Chip> : <Chip>{t('loop.results.notFunded')}</Chip>}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <div className="h-3 flex-1 overflow-hidden rounded-r-md bg-bg-2" aria-hidden><div className={cn('h-full rounded-r-md', o.funded ? 'bg-good' : 'bg-line-strong')} style={{ width: `${(100 * o.votes) / top}%`, minWidth: o.votes ? 6 : 0 }} /></div>
                          <span className="w-24 shrink-0 text-right font-data text-sm">{t('loop.results.votes', { count: o.votes })}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
