import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/shared/i18n';
import { useAssembly, useFixStats, useIsDemo } from '@/shared/api/hooks';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui/Card';

export default function Assembly() {
  const { t, kes, number, locale } = useI18n();
  const q = useAssembly();
  const demo = useIsDemo();
  const fix = useFixStats().data;
  const fixShare = fix && fix.responses > 0 ? Math.round((100 * fix.fixed) / fix.responses) : null;
  usePageTitle(t('loop.assembly.title'));
  const cell = (label: string, value: string, tone?: 'bad' | 'good') => (
    <div><dt className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted">{label}</dt><dd className={cn('font-display text-xl font-extrabold', tone === 'bad' && 'text-bad', tone === 'good' && 'text-good')}>{value}</dd></div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('loop.assembly.title')}</h1>
      <p className="mt-3 max-w-3xl text-[1.05rem] text-ink-2">{t('loop.assembly.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <section className="mt-6 rounded-[1.5rem] border border-line bg-surface p-5 shadow-card" aria-labelledby="fixhold">
        <h2 id="fixhold" className="font-display text-lg font-bold">{t('loop.stats.title')}</h2>
        <p className="mt-1 text-sm text-ink-2">{t('loop.stats.intro')}</p>
        {fixShare === null ? <p className="mt-2 text-sm text-muted">{t('loop.stats.none')}</p> : (
          <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <b className={cn('font-display text-3xl font-extrabold', fixShare < 70 ? 'text-bad' : 'text-good')}>{t('loop.stats.confirmed', { share: fixShare })}</b>
            <span className="text-sm text-muted">{t('loop.stats.answers', { count: fix!.responses })} · {t('loop.stats.reopened', { count: fix!.reopened })}</span>
          </p>
        )}
      </section>

      {q.isLoading ? <Skeleton className="mt-8 h-96" /> : (
        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {(q.data ?? []).map((c) => (
            <article key={c.code} className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6">
              <h2 className="font-display text-xl font-bold leading-snug">{locale === 'sw' && c.name_sw ? c.name_sw : c.name}</h2>

              <p className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-muted">{t('loop.assembly.cases')}</p>
              <dl className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {cell(t('loop.assembly.received'), number(c.cases.received_90d))}
                {cell(t('loop.assembly.open'), number(c.cases.open))}
                {cell(t('loop.assembly.overdue'), number(c.cases.overdue), c.cases.overdue > 0 ? 'bad' : 'good')}
                {cell(t('loop.assembly.resolved'), number(c.cases.resolved_90d))}
                {cell(t('loop.assembly.median'), c.cases.median_days === null ? '-' : number(Number(c.cases.median_days)))}
                {cell(t('loop.assembly.reopened'), number(c.cases.reopened))}
              </dl>

              <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{t('loop.assembly.projects')}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-3">
                    {cell(t('loop.assembly.projects'), number(c.projects.count))}
                    {cell(t('loop.assembly.stalled'), number(c.projects.stalled), c.projects.stalled > 0 ? 'bad' : 'good')}
                    {cell(t('loop.assembly.budget'), kes(c.projects.budget, { compact: true }))}
                    {cell(t('loop.assembly.spent'), kes(c.projects.spent, { compact: true }))}
                  </dl>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{t('loop.assembly.tenders')}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-3">
                    {cell(t('loop.assembly.openTenders'), number(c.tenders.open))}
                    {cell(t('loop.assembly.awarded'), number(c.tenders.awarded))}
                    {cell(t('loop.assembly.awardedValue'), kes(c.tenders.awarded_value, { compact: true }))}
                    {cell(t('loop.assembly.flags'), number(c.flags), c.flags > 0 ? 'bad' : 'good')}
                  </dl>
                </div>
              </div>

              <div className="mt-5 border-t border-line pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{t('loop.assembly.attention')}</p>
                {c.attention.length === 0 ? <p className="mt-2 text-sm text-muted">{t('loop.assembly.none')}</p> : (
                  <ul className="mt-2 space-y-1.5">
                    {c.attention.map((p) => (
                      <li key={p.slug}>
                        <Link to={`/projects/${p.slug}`} className="flex items-center gap-2 text-sm font-semibold hover:underline">
                          <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{p.title}</span>
                          <span className="shrink-0 font-data text-xs text-muted">{kes(p.spent, { compact: true })} / {kes(p.budget, { compact: true })}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-8 text-sm text-muted">{t('loop.assembly.note')}</p>
    </div>
  );
}
