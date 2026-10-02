import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { county, wardById } from '@/shared/config/county';
import { useCommitments, useCountyFinance, useCountySummary, useIsDemo, useWardLeague } from '@/shared/api/hooks';
import { getCaseStatus } from '@/shared/api/public';
import { useMyReports } from '@/shared/state/myreports';
import { usePrefs } from '@/shared/state/prefs';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Card';
import { ShareCardButton } from '@/shared/ui/ShareCardButton';

type Slide = { key: string; kicker: string; stat: string; title: string; line?: string; tone: string };

/** The year in review, story style: the county, your ward, and what you did. Built only from public figures and this phone. */
export default function Wrapped() {
  const { t, number, kes } = useI18n();
  const demo = useIsDemo();
  const summary = useCountySummary();
  const promises = useCommitments();
  const finance = useCountyFinance();
  const league = useWardLeague(365);
  const myWard = usePrefs((s) => s.wardId);
  const voted = usePrefs((s) => s.votedCycles);
  const saved = useMyReports((s) => s.items);
  const year = new Date().getFullYear();
  const mineThisYear = saved.filter((r) => new Date(r.at).getFullYear() === year);
  const cases = useQueries({ queries: mineThisYear.slice(0, 20).map((r) => ({ queryKey: ['case', r.reference], queryFn: () => getCaseStatus(r.reference), staleTime: 60_000 })) });
  const [i, setI] = useState(0);
  usePageTitle(t('wrapped.title', { year }));

  const slides: Slide[] = (() => {
    const s: Slide[] = [];
    const sm = summary.data;
    if (sm) {
      s.push({ key: 'reports', kicker: county.name, stat: number(sm.reports_filed), title: t('wrapped.reports'), line: t('wrapped.resolved', { n: number(sm.reports_resolved) }), tone: 'bg-panel text-panel-ink' });
    }
    const p = promises.data ?? [];
    if (p.length) {
      const kept = p.filter((c) => c.status === 'delivered').length;
      s.push({ key: 'promises', kicker: t('wrapped.promisesKicker'), stat: `${kept}/${p.length}`, title: t('wrapped.promises'), line: t('wrapped.promisesLine', { late: p.filter((c) => c.status === 'delayed').length }), tone: 'bg-brand text-brand-ink' });
    }
    const fin = [...(finance.data ?? [])].filter((r) => r.county_code === county.code && r.osr_actual).sort((a, b) => b.fiscal_year.localeCompare(a.fiscal_year))[0];
    if (fin?.osr_actual) {
      s.push({ key: 'money', kicker: t('wrapped.moneyKicker', { fy: fin.fiscal_year }), stat: kes(fin.osr_actual, { compact: true }), title: t('wrapped.money'),
        line: fin.osr_target ? t('wrapped.moneyLine', { pct: Math.round((100 * fin.osr_actual) / fin.osr_target) }) : undefined, tone: 'bg-good-soft' });
    }
    const ranked = (league.data?.wards ?? []).filter((w) => w.score !== null);
    if (ranked.length) {
      s.push({ key: 'top', kicker: t('wrapped.topKicker'), stat: ranked[0]!.name, title: t('wrapped.top'), line: t('wrapped.topLine', { score: ranked[0]!.score ?? 0 }), tone: 'bg-info-soft' });
      const mine = myWard ? ranked.findIndex((w) => w.ward_id === myWard) : -1;
      if (mine >= 0) s.push({ key: 'mine', kicker: wardById.get(myWard!)?.name ?? '', stat: `#${mine + 1}`, title: t('wrapped.yourWard', { of: ranked.length }), tone: 'bg-warn-soft' });
    }
    const fixed = cases.filter((c) => c.data && (c.data.status === 'resolved' || c.data.status === 'closed')).length;
    const backers = cases.reduce((n, c) => n + (c.data?.supporters ?? 0), 0);
    if (mineThisYear.length || voted.length) {
      s.push({ key: 'you', kicker: t('wrapped.youKicker'), stat: number(mineThisYear.length), title: t('wrapped.you', { count: mineThisYear.length }),
        line: [t('wrapped.youFixed', { count: fixed }), backers ? t('wrapped.youBackers', { count: backers }) : '', voted.length ? t('wrapped.youVoted', { count: voted.length }) : ''].filter(Boolean).join(' '), tone: 'bg-good-soft' });
    } else {
      s.push({ key: 'you', kicker: t('wrapped.youKicker'), stat: '0', title: t('wrapped.youNone'), line: t('wrapped.youNoneLine'), tone: 'bg-bg-2' });
    }
    return s;
  })();

  const loading = summary.isLoading || promises.isLoading || league.isLoading;
  const cur = slides[Math.min(i, slides.length - 1)];
  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="flex items-center gap-2 font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight"><Sparkles className="size-8 text-brand" aria-hidden />{t('wrapped.title', { year })}</h1>
      <p className="mt-2 text-ink-2">{t('wrapped.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}
      {loading || !cur ? <Skeleton className="mt-8 aspect-square" /> : (
        <>
          <div className="mt-6 flex gap-1" aria-hidden>{slides.map((x, k) => <span key={x.key} className={cn('h-1 flex-1 rounded-full', k <= i ? 'bg-ink' : 'bg-line')} />)}</div>
          <section key={cur.key} aria-live="polite" className={cn('mt-4 flex aspect-square flex-col justify-between rounded-[2rem] p-7 shadow-float animate-rise', cur.tone)}>
            <p className="text-sm font-bold uppercase tracking-[0.14em] opacity-80">{cur.kicker}</p>
            <div>
              <p className="font-display text-[clamp(3rem,14vw,5.5rem)] font-extrabold leading-none">{cur.stat}</p>
              <p className="mt-3 font-display text-2xl font-bold leading-tight">{cur.title}</p>
              {cur.line && <p className="mt-2 text-sm opacity-85">{cur.line}</p>}
            </div>
            <p className="text-xs font-semibold opacity-70">County Yangu · {county.name} · {year}</p>
          </section>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="secondary" disabled={i === 0} icon={<ChevronLeft className="size-4" aria-hidden />} onClick={() => setI((n) => n - 1)}>{t('wrapped.back')}</Button>
            <ShareCardButton path="/wrapped" text={t('wrapped.shareText', { year })} card={{ kicker: `${cur.kicker} · ${year}`, title: cur.title, stat: cur.stat, statLabel: cur.line, tone: 'brand' }} />
            <Button disabled={i >= slides.length - 1} iconRight={<ChevronRight className="size-4" aria-hidden />} onClick={() => setI((n) => n + 1)}>{t('wrapped.next')}</Button>
          </div>
          <p className="mt-6 text-center text-xs text-muted">{t('wrapped.privacy')} <Link to="/me" className="underline">{t('nav.me')}</Link></p>
        </>
      )}
    </div>
  );
}
