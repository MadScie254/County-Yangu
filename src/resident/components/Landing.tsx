import { Link } from 'react-router-dom';
import { Activity, ArrowRight, BadgeCheck, BellRing, Building2, CalendarDays, CheckCircle2, ChevronDown, CircleHelp, Clock3, Compass, Database, FileQuestion, FileText, FolderKanban, Globe, Handshake, Landmark, Lightbulb, Megaphone, MessageSquareText, MessagesSquare, Scale, SearchCheck, ShieldCheck, Siren, Smartphone, Trophy, UserRound, Vote, type LucideIcon } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { county } from '@/shared/config/county';
import { useCategorySla, useCountySummary, useProcurementWatch, useTenders } from '@/shared/api/hooks';
import { categoryIds, type CategoryId } from '@/shared/data/categories';
import { CategoryIcon } from '@/shared/ui/CategoryIcon';
import { ButtonLink } from '@/shared/ui/Button';
import { SectionTitle, Skeleton } from '@/shared/ui/Card';
import { useAuth } from '@/shared/state/auth';
import { cn } from '@/shared/lib/utils';

const wrap = 'mx-auto max-w-7xl px-4 sm:px-6';

/** A band of live numbers right under the map. */
export function Glance() {
  const { t, number } = useI18n();
  const s = useCountySummary();
  const tenders = useTenders();
  const items = [
    { label: t('landing.glance.fixed'), value: s.data?.reports_resolved, tone: 'text-good' },
    { label: t('landing.glance.open'), value: s.data ? Math.max(0, s.data.reports_filed - s.data.reports_resolved) : undefined, tone: '' },
    { label: t('landing.glance.projects'), value: s.data?.projects_published, tone: '' },
    { label: t('landing.glance.tenders'), value: tenders.data ? tenders.data.filter((x) => x.status === 'open').length : undefined, tone: '' },
    { label: t('landing.glance.votes'), value: s.data?.votes_cast, tone: '' },
  ];
  return (
    <section aria-label={t('landing.glance.title')} className={cn(wrap, 'py-6 sm:py-10')}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 rounded-[2rem] border border-line bg-surface p-6 shadow-card sm:grid-cols-5 sm:p-8">
        {items.map((i) => (
          <div key={i.label}>
            {s.isLoading ? <Skeleton className="h-9 w-20" /> : <dd className={cn('font-display text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold leading-none tabular-nums', i.tone)}>{i.value === undefined ? '-' : number(i.value)}</dd>}
            <dt className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-muted">{i.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}

type Feature = { to: string; icon: LucideIcon; k: 'report' | 'track' | 'vote' | 'services' | 'alerts' | 'ideas' | 'open' | 'pulse' | 'check' | 'meetings' | 'results' | 'assembly' | 'verify' | 'tenders' | 'data' | 'how' | 'notices' | 'promises' | 'information' | 'haveYourSay'; tone: string };
const features: Feature[] = [
  { to: '/report', icon: Megaphone, k: 'report', tone: 'bg-brand text-brand-ink' },
  { to: '/case', icon: SearchCheck, k: 'check', tone: 'bg-brand-soft text-ink' },
  { to: '/notices', icon: Siren, k: 'notices', tone: 'bg-warn-soft text-warn' },
  { to: '/projects', icon: FolderKanban, k: 'track', tone: 'bg-info-soft text-info' },
  { to: '/vote', icon: Vote, k: 'vote', tone: 'bg-vote-soft text-vote' },
  { to: '/have-your-say', icon: MessagesSquare, k: 'haveYourSay', tone: 'bg-vote-soft text-vote' },
  { to: '/meetings', icon: CalendarDays, k: 'meetings', tone: 'bg-vote-soft text-vote' },
  { to: '/vote/results', icon: Trophy, k: 'results', tone: 'bg-good-soft text-good' },
  { to: '/services', icon: Landmark, k: 'services', tone: 'bg-good-soft text-good' },
  { to: '/verify', icon: BadgeCheck, k: 'verify', tone: 'bg-info-soft text-info' },
  { to: '/open', icon: Scale, k: 'open', tone: 'bg-bad-soft text-bad' },
  { to: '/tenders', icon: FileText, k: 'tenders', tone: 'bg-bad-soft text-bad' },
  { to: '/promises', icon: Handshake, k: 'promises', tone: 'bg-good-soft text-good' },
  { to: '/information', icon: FileQuestion, k: 'information', tone: 'bg-info-soft text-info' },
  { to: '/assembly', icon: Building2, k: 'assembly', tone: 'bg-bg-2 text-ink' },
  { to: '/pulse', icon: Activity, k: 'pulse', tone: 'bg-bg-2 text-ink' },
  { to: '/alerts', icon: BellRing, k: 'alerts', tone: 'bg-warn-soft text-warn' },
  { to: '/ideas', icon: Lightbulb, k: 'ideas', tone: 'bg-brand-soft text-ink' },
  { to: '/open/api', icon: Database, k: 'data', tone: 'bg-bg-2 text-ink' },
  { to: '/how-it-works', icon: CircleHelp, k: 'how', tone: 'bg-bg-2 text-ink' },
];

export function Features() {
  const { t } = useI18n();
  return (
    <section className={cn(wrap, 'py-14 sm:py-20')}>
      <SectionTitle title={t('landing.features.title')} intro={t('landing.features.intro')} />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ to, icon: Icon, k, tone }) => (
          <li key={k}>
            <Link to={to} className="group flex h-full flex-col rounded-[1.75rem] border border-line bg-surface p-6 shadow-card transition hover:-translate-y-1 hover:border-line-strong hover:shadow-float">
              <span className={cn('grid size-12 place-items-center rounded-2xl transition group-hover:scale-105', tone)}><Icon className="size-6" aria-hidden /></span>
              <h3 className="mt-5 font-display text-xl font-bold">{t(`landing.features.${k}.t` as MessageKey)}</h3>
              <p className="mt-2 flex-1 text-[0.95rem] text-ink-2">{t(`landing.features.${k}.d` as MessageKey)}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">{t('landing.features.go')} <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Explains the merge: one sign in, three kinds of people. */
export function Audiences() {
  const { t } = useI18n();
  const status = useAuth((s) => s.status);
  return (
    <section className="border-y border-line bg-bg-2">
      <div className={cn(wrap, 'py-14 sm:py-20')}>
        <SectionTitle title={t('landing.audiences.title')} intro={t('landing.audiences.intro')} />
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <article className="flex flex-col rounded-[1.75rem] border border-line bg-surface p-7 shadow-card">
            <span className="grid size-12 place-items-center rounded-2xl bg-brand text-brand-ink"><UserRound className="size-6" aria-hidden /></span>
            <h3 className="mt-5 font-display text-2xl font-bold">{t('landing.audiences.residents.t')}</h3>
            <p className="mt-2 flex-1 text-ink-2">{t('landing.audiences.residents.d')}</p>
            <ButtonLink to={status === 'in' ? '/me' : '/services/account?mode=up'} className="mt-6 self-start" iconRight={<ArrowRight className="size-4" aria-hidden />}>{t('landing.audiences.residents.cta')}</ButtonLink>
          </article>
          <article className="flex flex-col rounded-[1.75rem] border border-line bg-surface p-7 shadow-card">
            <span className="grid size-12 place-items-center rounded-2xl bg-panel text-panel-ink"><Building2 className="size-6" aria-hidden /></span>
            <h3 className="mt-5 font-display text-2xl font-bold">{t('landing.audiences.staff.t')}</h3>
            <p className="mt-2 flex-1 text-ink-2">{t('landing.audiences.staff.d')}</p>
            <a href="/console/" className="mt-6 inline-flex h-11 items-center gap-2 self-start rounded-full border border-line-strong bg-surface px-5 font-semibold transition hover:bg-bg-2">{t('landing.audiences.staff.cta')} <ArrowRight className="size-4" aria-hidden /></a>
          </article>
          <article className="flex flex-col rounded-[1.75rem] border border-line bg-surface p-7 shadow-card">
            <span className="grid size-12 place-items-center rounded-2xl bg-info-soft text-info"><Landmark className="size-6" aria-hidden /></span>
            <h3 className="mt-5 font-display text-2xl font-bold">{t('landing.audiences.oversight.t')}</h3>
            <p className="mt-2 flex-1 text-ink-2">{t('landing.audiences.oversight.d')}</p>
            <ButtonLink to="/how-it-works" variant="secondary" className="mt-6 self-start" iconRight={<ArrowRight className="size-4" aria-hidden />}>{t('landing.audiences.oversight.cta')}</ButtonLink>
          </article>
        </div>
      </div>
    </section>
  );
}

/** The response promises, straight from the report categories. */
export function Promises() {
  const { t } = useI18n();
  const q = useCategorySla();
  const fmt = (v: number, unit: 'hours' | 'working_days') => (unit === 'hours' ? t('landing.promises.hours', { n: v }) : t('landing.promises.days', { n: v }));
  const rows = (q.data ?? []).filter((r): r is typeof r & { id: CategoryId } => (categoryIds as readonly string[]).includes(r.id));
  return (
    <section className={cn(wrap, 'py-14 sm:py-20')}>
      <SectionTitle title={t('landing.promises.title')} intro={t('landing.promises.intro')} />
      <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-bg-2 text-xs uppercase tracking-[0.08em] text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-bold sm:px-6">{t('landing.promises.category')}</th>
              <th scope="col" className="px-4 py-3 font-bold sm:px-6">{t('landing.promises.ack')}</th>
              <th scope="col" className="px-4 py-3 font-bold sm:px-6">{t('landing.promises.fix')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {q.isLoading && [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={3} className="px-6 py-3"><Skeleton className="h-6" /></td></tr>)}
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="px-4 py-3 font-semibold sm:px-6"><span className="inline-flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-bg-2"><CategoryIcon id={r.id} className="size-4" /></span>{t(`categories.${r.id}` as MessageKey)}</span></th>
                <td className="px-4 py-3 font-data sm:px-6">{fmt(r.ack_value, r.ack_unit)}</td>
                <td className="px-4 py-3 font-data sm:px-6">{fmt(r.resolve_value, r.resolve_unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** A taste of Open County: who holds the money, and how many patterns are flagged. */
export function MoneyTeaser() {
  const { t, kes, number } = useI18n();
  const q = useProcurementWatch();
  const w = q.data;
  if (!w || w.summary.awarded_count === 0) return null;
  const top = w.contractors.slice(0, 5);
  const flags = w.flags.filter((f) => f.severity !== 'info').length;
  return (
    <section className="border-y border-line bg-surface">
      <div className={cn(wrap, 'grid gap-10 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center')}>
        <div>
          <SectionTitle title={t('landing.money.title')} intro={t('landing.money.intro')} />
          <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-ink-2">
            <span><b className="font-display text-3xl font-extrabold text-ink">{number(w.summary.awarded_count)}</b> {t('open.stats.awarded')}</span>
            <span><b className="font-display text-3xl font-extrabold text-ink">{kes(w.summary.awarded_value, { compact: true })}</b></span>
            <span><b className={cn('font-display text-3xl font-extrabold', flags > 0 ? 'text-bad' : 'text-ink')}>{number(flags)}</b> {t('open.stats.flags')}</span>
          </p>
          <ButtonLink to="/open" className="mt-7" iconRight={<ArrowRight className="size-4" aria-hidden />}>{t('landing.money.cta')}</ButtonLink>
        </div>
        <ul className="space-y-4 rounded-[1.75rem] border border-line bg-bg p-6 shadow-card">
          {top.map((c) => {
            const bar = c.share_value >= 40 ? 'bg-bad' : c.share_value >= 25 ? 'bg-warn' : 'bg-info';
            return (
              <li key={c.id}>
                <div className="flex items-baseline justify-between gap-3"><span className="truncate font-semibold">{c.name}</span><span className="shrink-0 font-data text-sm">{t('open.who.share', { share: c.share_value })}</span></div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-bg-2"><div className={cn('h-full rounded-full', bar)} style={{ width: `${Math.min(100, c.share_value)}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function RoadmapColumn({ title, items, icon: Icon, tone }: { title: string; items: string[]; icon: LucideIcon; tone: string }) {
  return (
    <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-card sm:p-7">
      <h3 className="flex items-center gap-2.5 font-display text-xl font-bold"><span className={cn('grid size-8 place-items-center rounded-full', tone)}><Icon className="size-4" aria-hidden /></span>{title}</h3>
      <ul className="mt-5 space-y-3.5">
        {items.map((i) => (
          <li key={i} className="flex gap-3 text-[0.95rem] text-ink-2"><span aria-hidden className={cn('mt-2 size-1.5 shrink-0 rounded-full', tone.split(' ')[0])} />{i}</li>
        ))}
      </ul>
    </div>
  );
}

export function Roadmap() {
  const { t, list } = useI18n();
  return (
    <section id="roadmap" className={cn(wrap, 'scroll-mt-24 py-14 sm:py-20')}>
      <SectionTitle eyebrow={t('nav.roadmap')} title={t('roadmap.title')} intro={t('roadmap.intro')} />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <RoadmapColumn title={t('roadmap.now')} items={list('roadmap.nowItems')} icon={CheckCircle2} tone="bg-good text-white" />
        <RoadmapColumn title={t('roadmap.next')} items={list('roadmap.nextItems')} icon={Clock3} tone="bg-brand text-brand-ink" />
        <RoadmapColumn title={t('roadmap.later')} items={list('roadmap.laterItems')} icon={Compass} tone="bg-line-strong text-bg" />
      </div>
      <p className="mt-6 text-sm text-muted">{t('roadmap.note')}</p>
    </section>
  );
}

export function Reach() {
  const { t } = useI18n();
  const cards = [
    { icon: Globe, title: t('landing.reach.web'), body: t('landing.reach.webBody') },
    { icon: Smartphone, title: t('landing.reach.ussd', { code: county.ussdCode }), body: t('landing.reach.ussdBody') },
    { icon: MessageSquareText, title: t('landing.reach.sms', { code: county.smsShortcode }), body: t('landing.reach.smsBody') },
  ];
  return (
    <section className="border-t border-line bg-panel text-panel-ink">
      <div className={cn(wrap, 'py-14 sm:py-20')}>
        <h2 className="max-w-2xl font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold">{t('landing.reach.title')}</h2>
        <ul className="mt-9 grid gap-4 md:grid-cols-3">
          {cards.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-[1.75rem] bg-panel-ink/10 p-6 ring-1 ring-panel-ink/15">
              <Icon className="size-7 text-brand" aria-hidden />
              <h3 className="mt-4 font-display text-2xl font-bold">{title}</h3>
              <p className="mt-2 text-panel-ink/80">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 flex items-start gap-3 text-panel-ink/80"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden /><span><b className="text-panel-ink">{t('home.trustTitle')}.</b> {t('home.trustBody')}</span></p>
      </div>
    </section>
  );
}

export function Faq() {
  const { t } = useI18n();
  const n = [1, 2, 3, 4, 5, 6, 7, 8] as const;
  return (
    <section className={cn(wrap, 'py-14 sm:py-20')}>
      <h2 className="max-w-2xl font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold">{t('landing.faqTitle')}</h2>
      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {n.map((i) => (
          <details key={i} className="group rounded-2xl border border-line bg-surface p-5 shadow-card open:border-line-strong">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-[1.05rem] font-bold [&::-webkit-details-marker]:hidden">
              {t(`faq.q${i}` as MessageKey)}
              <ChevronDown className="size-5 shrink-0 transition group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-3 text-ink-2">{t(`faq.a${i}` as MessageKey, { code: county.ussdCode })}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function FinalCta() {
  const { t } = useI18n();
  const status = useAuth((s) => s.status);
  return (
    <section className={cn(wrap, 'pb-20')}>
      <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface p-8 shadow-card sm:p-12">
        <div aria-hidden className="paper-grain absolute inset-0 opacity-50" />
        <div aria-hidden className="absolute -bottom-24 -right-16 size-72 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative max-w-2xl">
          <h2 className="font-display text-[clamp(1.8rem,5vw,3rem)] font-extrabold leading-[1.05]">{t('landing.cta.title')}</h2>
          <p className="mt-4 text-[1.05rem] text-ink-2">{t('landing.cta.body')}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink to="/report" size="lg" icon={<Megaphone className="size-5" aria-hidden />}>{t('home.reportCta')}</ButtonLink>
            <ButtonLink to={status === 'in' ? '/me' : '/services/account?mode=up'} size="lg" variant="secondary">{status === 'in' ? t('landing.audiences.residents.cta') : t('auth.signUp')}</ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
