import { Link, useParams } from 'react-router-dom';
import { Copy, Mail, MessageCircle, Printer } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useIsDemo, useNotices, useWardScorecard } from '@/shared/api/hooks';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { FollowButton } from '@/shared/ui/FollowButton';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { ShareCardButton } from '@/shared/ui/ShareCardButton';

export default function WardScorecard() {
  const { id = '' } = useParams();
  const { t, number, kes, date, locale } = useI18n();
  const q = useWardScorecard(id || null);
  const demo = useIsDemo();
  const notices = useNotices();
  const s = q.data;
  usePageTitle(s ? t('loop.scorecard.emailSubject', { ward: s.ward }) : t('loop.scorecard.title'));

  if (q.isLoading) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-10"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-72" /></div>;
  if (!s) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold">{t('loop.scorecard.notFound')}</h1>
        <ButtonLink to="/pulse" className="mt-8">{t('nav.pulse')}</ButtonLink>
      </div>
    );
  }

  const url = `${window.location.origin}/ward/${s.ward_id}`;
  const text = `${t('loop.scorecard.emailSubject', { ward: s.ward })}: ${url}`;
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: t('loop.scorecard.emailSubject', { ward: s.ward }), url }); return; }
      await navigator.clipboard.writeText(url);
      toast({ tone: 'good', title: t('common.copied') });
    } catch { /* cancelled */ }
  };
  const fixedShare = s.confirmed.responses > 0 ? Math.round((100 * s.confirmed.fixed) / s.confirmed.responses) : null;
  const tile = (label: string, value: string, tone?: 'bad' | 'good') => (
    <div className="rounded-2xl border border-line bg-bg-2/50 p-4">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-extrabold', tone === 'bad' && 'text-bad', tone === 'good' && 'text-good')}>{value}</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14 print:py-0">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{t('loop.scorecard.title')}</p>
      <h1 className="mt-1 font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{s.ward}</h1>
      <p className="mt-1 text-muted">{[s.sub_county, s.constituency, s.population ? `${number(s.population)}` : null].filter(Boolean).join(' · ')}</p>
      <p className="mt-3 max-w-2xl text-ink-2">{t('loop.scorecard.intro', { ward: s.ward })}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <div className="mt-6 flex flex-wrap gap-2 print:hidden">
        <Button variant="secondary" size="sm" icon={<Copy className="size-4" aria-hidden />} onClick={() => void share()}>{t('loop.scorecard.share')}</Button>
        <a className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-bg-2" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4" aria-hidden />{t('loop.scorecard.whatsapp')}</a>
        <a className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-bg-2" href={`mailto:?subject=${encodeURIComponent(t('loop.scorecard.emailSubject', { ward: s.ward }))}&body=${encodeURIComponent(t('loop.scorecard.emailBody', { ward: s.ward, url }))}`}><Mail className="size-4" aria-hidden />{t('loop.scorecard.email')}</a>
        <Button variant="secondary" size="sm" icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>{t('loop.scorecard.print')}</Button>
        <ShareCardButton path={`/ward/${s.ward_id}`} text={t('scoreShare.text', { ward: s.ward })}
          card={{ kicker: t('loop.scorecard.title'), title: s.ward, stat: number(s.cases.resolved_90d), statLabel: t('scoreShare.fixed'),
            tone: s.cases.overdue > 0 ? 'warn' : 'good', lines: [t('scoreShare.line', { open: s.cases.open, overdue: s.cases.overdue })] }} />
        <FollowButton kind="ward_tenders" id={s.ward_id} label={s.ward} />
        <Link to={`/compare?a=${s.ward_id}`} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold text-brand hover:underline">{t('loop.compare.with')}</Link>
      </div>

      {(() => {
        const live = (notices.data ?? []).filter((n) => n.status === 'active' && n.ward_id === s.ward_id);
        return live.length > 0 && (
          <Link to={`/notices?ward=${s.ward_id}`} className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-warn-soft p-4 text-sm font-semibold print:hidden">
            <span>{live.length === 1 ? live[0]!.title : t('loop.notices.inWard', { count: live.length, ward: s.ward })}</span>
            <span className="shrink-0 underline underline-offset-4">{t('loop.notices.see')}</span>
          </Link>
        );
      })()}

      <section className="mt-8" aria-label={t('nav.report')}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tile(t('loop.scorecard.received'), number(s.cases.received_90d))}
          {tile(t('loop.scorecard.resolved'), number(s.cases.resolved_90d), 'good')}
          {tile(t('loop.scorecard.open'), number(s.cases.open))}
          {tile(t('loop.scorecard.overdue'), number(s.cases.overdue), s.cases.overdue > 0 ? 'bad' : 'good')}
          {tile(t('loop.scorecard.median'), s.cases.median_days === null ? '-' : number(Number(s.cases.median_days)))}
          {tile(t('loop.scorecard.confirmed'), fixedShare === null ? '-' : `${fixedShare}%`, fixedShare !== null && fixedShare < 70 ? 'bad' : undefined)}
        </div>
      </section>

      {s.top_categories.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-bold">{t('loop.scorecard.topIssues')}</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {s.top_categories.map((c) => (
              <li key={c.category} className="flex items-center justify-between gap-3 px-4 py-3"><span className="font-semibold">{locale === 'sw' && c.category_sw ? c.category_sw : c.category}</span><span className="font-data text-sm">{number(c.count)}</span></li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold"><Link to="/projects" className="hover:underline">{t('loop.scorecard.projects')}</Link></h2>
          <p className="mt-2 text-sm text-ink-2">{number(s.projects.count)} · {number(s.projects.completed)} {t('loop.assembly.completed').toLowerCase()} · {number(s.projects.stalled)} {t('loop.assembly.stalled').toLowerCase()}</p>
          {s.projects.budget > 0 && <p className="mt-1 font-data text-sm">{kes(s.projects.spent, { compact: true })} / {kes(s.projects.budget, { compact: true })}</p>}
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold"><Link to="/tenders" className="hover:underline">{t('loop.scorecard.tenders')}</Link></h2>
          <p className="mt-2 text-sm text-ink-2">{number(s.tenders.open)} {t('loop.assembly.openTenders').toLowerCase()} · {number(s.tenders.awarded)} {t('loop.assembly.awarded').toLowerCase()}</p>
          {s.tenders.awarded_value > 0 && <p className="mt-1 font-data text-sm">{kes(s.tenders.awarded_value, { compact: true })}</p>}
        </div>
        {s.budget && (
          <div className="rounded-2xl border border-line bg-surface p-5 sm:col-span-2">
            <h2 className="font-display text-lg font-bold"><Link to="/vote/results" className="hover:underline">{t('loop.scorecard.budgetVote')}</Link></h2>
            <p className="mt-2 text-sm text-ink-2">{s.budget.cycle}: {t('loop.results.votes', { count: number(s.budget.votes) })}{s.budget.envelope ? ` · ${kes(s.budget.envelope, { compact: true })}` : ''}</p>
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-muted">{t('loop.scorecard.generated', { date: date(s.generated_at) })}</p>
    </div>
  );
}
