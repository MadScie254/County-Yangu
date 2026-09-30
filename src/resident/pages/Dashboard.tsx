import { MyDataPanel } from '../components/MyDataPanel';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FollowKind } from '@/shared/api/types';
import { BadgeCheck, CalendarDays, ArrowRight, Bell, BellRing, Building2, CalendarClock, CreditCard, FileQuestion, FileWarning, FolderKanban, Handshake, Landmark, Lightbulb, LogOut, MapPin, Megaphone, MessagesSquare, Scale, SearchCheck, ShieldCheck, Siren, Smartphone, Vote, type LucideIcon } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { county, wardLabel } from '@/shared/config/county';
import { useCountySummary, useFollows, useProcurementWatch, useProjects, useTenders, useVoteData, useWardStats } from '@/shared/api/hooks';
import { getCaseStatus } from '@/shared/api/public';
import { listMyApplications, listNotifications, listServices } from '@/shared/api/services';
import type { Application, ApplicationStatus } from '@/shared/api/services-types';
import { unfollow } from '@/shared/api/loop';
import { useAuth } from '@/shared/state/auth';
import { usePrefs } from '@/shared/state/prefs';
import { useMyReports } from '@/shared/state/myreports';
import { useCan } from '@/shared/lib/perm';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip, reportTone, type Tone } from '@/shared/ui/Chip';
import { Meter, Ring } from '@/shared/ui/Meter';
import { Skeleton } from '@/shared/ui/Card';
import { SpaceSwitch } from '@/shared/ui/SpaceSwitch';
import { ButtonLink } from '@/shared/ui/Button';
import { WardSearch } from '../components/WardSearch';

const appTone = (s: ApplicationStatus): Tone =>
  ({ draft: 'neutral', awaiting_payment: 'warn', submitted: 'info', under_review: 'info', changes_requested: 'warn', approved: 'good', rejected: 'bad', withdrawn: 'neutral' } as Record<ApplicationStatus, Tone>)[s];
const appProgress: Record<ApplicationStatus, number> = { draft: 10, awaiting_payment: 30, submitted: 50, under_review: 75, changes_requested: 60, approved: 100, rejected: 100, withdrawn: 0 };

function Panel({ title, action, children, className, id }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string; id: string }) {
  return (
    <section aria-labelledby={id} className={cn('rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6', className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="font-display text-xl font-bold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

const quickTone = {
  brand: 'bg-brand text-brand-ink',
  info: 'bg-info-soft text-info',
  vote: 'bg-vote-soft text-vote',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn',
  soft: 'bg-brand-soft text-ink',
  neutral: 'bg-bg-2 text-ink',
} as const;

function Tile({ to, icon: Icon, title, hint, tone }: { to: string; icon: LucideIcon; title: string; hint: string; tone: keyof typeof quickTone }) {
  return (
    <Link to={to} className="group flex flex-col gap-3 rounded-[1.5rem] border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-float">
      <span className={cn('grid size-11 place-items-center rounded-2xl transition group-hover:scale-105', quickTone[tone])}><Icon className="size-5" aria-hidden /></span>
      <span>
        <span className="block font-display text-[1.02rem] font-bold leading-tight">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{hint}</span>
      </span>
    </Link>
  );
}

function Row({ to, icon: Icon, tone, title, hint }: { to: string; icon: LucideIcon; tone: keyof typeof quickTone; title: string; hint: string }) {
  return (
    <li>
      <Link to={to} className="group flex items-center gap-3 rounded-2xl border border-line bg-bg p-3.5 transition hover:border-line-strong hover:bg-bg-2">
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', quickTone[tone])}><Icon className="size-[1.15rem]" aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{title}</span>
          <span className="block truncate text-sm text-muted">{hint}</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
      </Link>
    </li>
  );
}

function FollowsList() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const f = useFollows();
  const remove = useMutation({ mutationFn: (x: { kind: FollowKind; key: string }) => unfollow(x.kind, x.key), onSuccess: () => void qc.invalidateQueries({ queryKey: ['follows'] }) });
  const list = f.data ?? [];
  if (list.length === 0) return <p className="text-sm text-ink-2">{t('loop.follow.empty')}</p>;
  return (
    <ul className="space-y-2">
      {list.map((x) => (
        <li key={x.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0"><b className="block truncate">{x.label}</b><span className="text-xs text-muted">{t(`loop.follow.kind.${x.kind}` as MessageKey)}</span></span>
          <button type="button" className="shrink-0 text-xs font-semibold underline underline-offset-4 hover:text-bad" onClick={() => remove.mutate({ kind: x.kind, key: x.key })}>{t('loop.follow.removed')}</button>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { t, number, kes, date, relative } = useI18n();
  usePageTitle(t('nav.me'));
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const can = useCan();
  const wardId = usePrefs((s) => s.wardId);
  const setWardId = usePrefs((s) => s.setWardId);
  const votedCycles = usePrefs((s) => s.votedCycles);
  const saved = useMyReports((s) => s.items);

  const stats = useWardStats();
  const summary = useCountySummary();
  const projects = useProjects();
  const tenders = useTenders();
  const watch = useProcurementWatch();
  const vote = useVoteData(wardId);
  const apps = useQuery({ queryKey: ['my-applications'], queryFn: listMyApplications });
  const notes = useQuery({ queryKey: ['notifications'], queryFn: listNotifications, refetchInterval: 60_000 });
  const services = useQuery({ queryKey: ['services'], queryFn: listServices, staleTime: 10 * 60_000 });
  const cases = useQueries({ queries: saved.slice(0, 4).map((r) => ({ queryKey: ['case', r.reference], queryFn: () => getCaseStatus(r.reference), staleTime: 30_000 })) });

  const first = (user?.name || user?.email.split('@')[0] || '').split(/\s+/)[0] ?? '';
  const ward = wardId ? stats.data?.find((w) => w.ward_id === wardId) : undefined;
  const wardProjects = useMemo(() => (projects.data ?? []).filter((p) => p.ward_id === wardId), [projects.data, wardId]);
  const wardTenders = useMemo(() => (tenders.data ?? []).filter((x) => x.ward_id === wardId && (x.status === 'open' || x.status === 'evaluating')), [tenders.data, wardId]);
  const coming = useMemo(
    () => wardProjects.flatMap((p) => p.milestones.filter((m) => !m.done && m.due).map((m) => ({ project: p.title, title: m.title, due: m.due! }))).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4),
    [wardProjects],
  );
  const serviceName = (id: string) => services.data?.find((s) => s.id === id)?.name ?? '';
  const unread = (notes.data ?? []).filter((n) => !n.read).length;
  const cycle = vote.data?.cycle ?? null;
  const voteOpen = Boolean(cycle && cycle.status === 'open' && new Date(cycle.ends_at) > new Date() && !votedCycles.includes(cycle.id));

  const attention: { key: string; to: string; icon: LucideIcon; tone: keyof typeof quickTone; title: string; hint: string }[] = [];
  for (const a of apps.data ?? []) {
    if (a.status === 'awaiting_payment') attention.push({ key: `pay-${a.id}`, to: `/services/applications/${a.id}`, icon: CreditCard, tone: 'warn', title: t('me.attention.pay', { ref: a.reference }), hint: t('me.attention.payHint', { amount: number(a.amount) }) });
    if (a.status === 'changes_requested') attention.push({ key: `chg-${a.id}`, to: `/services/applications/${a.id}`, icon: FileWarning, tone: 'warn', title: t('me.attention.changes', { ref: a.reference }), hint: t('me.attention.changesHint') });
  }
  if (voteOpen) attention.push({ key: 'vote', to: '/vote', icon: Vote, tone: 'vote', title: t('me.attention.vote'), hint: t('me.attention.voteHint') });
  if (unread > 0) attention.push({ key: 'unread', to: '/services/notifications', icon: Bell, tone: 'info', title: t('me.attention.unread', { count: unread }), hint: t('me.attention.unreadHint') });

  const flagCount = (watch.data?.flags ?? []).filter((f) => f.severity !== 'info').length;
  const trust = ward?.trust_index ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      {/* ---------- Greeting ---------- */}
      <section className="relative overflow-hidden rounded-[2rem] border border-line bg-surface p-6 shadow-card sm:p-9">
        <div aria-hidden className="paper-grain absolute inset-0 opacity-50" />
        <div aria-hidden className="absolute -right-20 -top-24 size-72 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">{t('me.signedInAs', { email: user?.email ?? '' })}</p>
            <h1 className="mt-1 font-display text-[clamp(2rem,6vw,3.2rem)] font-extrabold leading-[1.02]">{first ? t('me.greeting', { name: first }) : t('me.greetingAnon')}</h1>
            <p className="mt-3 max-w-xl text-[1.05rem] text-ink-2">{t('me.lead')}</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <SpaceSwitch current="citizen" citizenLabel={t('nav.citizenView')} staffLabel={t('nav.staffConsole')} groupLabel={t('me.spaces.label')} />
            <button type="button" onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              <LogOut className="size-4" aria-hidden /> {t('nav.signOut')}
            </button>
          </div>
        </div>

        {can.has('super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer', 'assembly_member', 'auditor') && (
          <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-bg/70 p-4 backdrop-blur">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-panel text-panel-ink"><Building2 className="size-5" aria-hidden /></span>
              <div>
                <p className="font-display font-bold">{t('me.spaces.title')}</p>
                <p className="max-w-xl text-sm text-ink-2">{t('me.spaces.body')}</p>
                <p className="mt-1 text-xs font-semibold text-muted">{t('me.spaces.role', { role: can.topRole })}</p>
              </div>
            </div>
            <a href="/console/" className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-brand-ink shadow-card transition hover:bg-brand-strong">
              {t('me.spaces.open')} <ArrowRight className="size-4" aria-hidden />
            </a>
          </div>
        )}
      </section>

      {/* ---------- Quick actions ---------- */}
      <section aria-labelledby="quick">
        <h2 id="quick" className="mb-3 font-display text-xl font-bold">{t('me.quick.title')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile to="/report" icon={Megaphone} tone="brand" title={t('me.quick.report')} hint={t('me.quick.reportHint')} />
          <Tile to="/projects" icon={FolderKanban} tone="info" title={t('me.quick.track')} hint={t('me.quick.trackHint')} />
          <Tile to="/vote" icon={Vote} tone="vote" title={t('me.quick.vote')} hint={t('me.quick.voteHint')} />
          <Tile to="/services" icon={Landmark} tone="good" title={t('me.quick.services')} hint={t('me.quick.servicesHint')} />
          <Tile to="/alerts" icon={BellRing} tone="warn" title={t('me.quick.alerts')} hint={t('me.quick.alertsHint')} />
          <Tile to="/ideas" icon={Lightbulb} tone="soft" title={t('me.quick.ideas')} hint={t('me.quick.ideasHint')} />
          <Tile to="/open" icon={Scale} tone="neutral" title={t('me.quick.open')} hint={t('me.quick.openHint')} />
          <Tile to="/case" icon={SearchCheck} tone="neutral" title={t('me.quick.check')} hint={t('me.quick.checkHint')} />
          <Tile to="/meetings" icon={CalendarDays} tone="vote" title={t('me.quick.meetings')} hint={t('me.quick.meetingsHint')} />
          <Tile to="/verify" icon={BadgeCheck} tone="info" title={t('me.quick.verify')} hint={t('me.quick.verifyHint')} />
          <Tile to="/notices" icon={Siren} tone="warn" title={t('me.quick.notices')} hint={t('me.quick.noticesHint')} />
          <Tile to="/promises" icon={Handshake} tone="good" title={t('me.quick.promises')} hint={t('me.quick.promisesHint')} />
          <Tile to="/information" icon={FileQuestion} tone="info" title={t('me.quick.information')} hint={t('me.quick.informationHint')} />
          <Tile to="/have-your-say" icon={MessagesSquare} tone="vote" title={t('me.quick.haveYourSay')} hint={t('me.quick.haveYourSayHint')} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* ---------- Main column ---------- */}
        <div className="space-y-6">
          <Panel id="attention" title={t('me.attention.title')}>
            {apps.isLoading || notes.isLoading ? (
              <Skeleton className="h-16" />
            ) : attention.length === 0 ? (
              <p className="flex items-center gap-2 rounded-2xl bg-good-soft p-4 text-sm font-semibold text-good"><ShieldCheck className="size-5 shrink-0" aria-hidden />{t('me.attention.none')}</p>
            ) : (
              <ul className="space-y-2.5">{attention.map((a) => <Row key={a.key} to={a.to} icon={a.icon} tone={a.tone} title={a.title} hint={a.hint} />)}</ul>
            )}
          </Panel>

          <Panel
            id="ward"
            title={ward || wardId ? `${t('me.ward.title')}: ${wardLabel(wardId)}` : t('me.ward.title')}
            action={wardId ? <button type="button" onClick={() => setWardId(null)} className="text-sm font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline">{t('me.ward.change')}</button> : undefined}
          >
            {!wardId ? (
              <div>
                <p className="mb-3 text-ink-2">{t('me.ward.choose')}</p>
                <WardSearch onPick={setWardId} />
              </div>
            ) : stats.isLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="flex items-center gap-4">
                  <Ring value={trust === null ? 0 : trust / 100} size={104} stroke={11} tone={trust === null ? 'info' : trust >= 60 ? 'good' : trust >= 40 ? 'warn' : 'bad'} label={`${t('me.ward.trust')}: ${trust ?? '-'}`}>
                    <span><span className="block font-display text-2xl font-extrabold leading-none">{trust === null ? '-' : Math.round(trust)}</span><span className="mt-0.5 block text-[0.62rem] font-bold uppercase tracking-wide text-muted">{t('me.ward.trust')}</span></span>
                  </Ring>
                  <p className="max-w-[12rem] text-xs text-muted sm:hidden">{t('me.ward.trustHint')}</p>
                </div>
                <div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                    {[
                      [t('me.ward.open'), ward?.open_reports, ''],
                      [t('me.ward.fixed'), ward?.resolved_90d, 'text-good'],
                      [t('me.ward.overdue'), ward?.overdue_reports, ward && ward.overdue_reports > 0 ? 'text-bad' : ''],
                      [t('me.ward.projects'), ward?.projects, ''],
                    ].map(([label, value, tone]) => (
                      <div key={String(label)}>
                        <dd className={cn('font-display text-3xl font-extrabold leading-none tabular-nums', String(tone))}>{value === undefined ? '-' : number(Number(value))}</dd>
                        <dt className="mt-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">{String(label)}</dt>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 hidden text-xs text-muted sm:block">{t('me.ward.trustHint')}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ButtonLink to={`/report?ward=${wardId}`} size="sm" icon={<Megaphone className="size-4" aria-hidden />}>{t('me.ward.reportHere', { ward: wardLabel(wardId) })}</ButtonLink>
                    <ButtonLink to="/" variant="secondary" size="sm" icon={<MapPin className="size-4" aria-hidden />}>{t('me.ward.seeMap')}</ButtonLink>
                  </div>
                </div>
              </div>
            )}
          </Panel>

          <Panel id="apps" title={t('me.apps.title')} action={<Link to="/services/applications" className="text-sm font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline">{t('me.apps.all')}</Link>}>
            {apps.isLoading ? (
              <Skeleton className="h-24" />
            ) : (apps.data ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-strong p-6 text-center">
                <p className="text-ink-2">{t('me.apps.none')}</p>
                <ButtonLink to="/services" variant="secondary" size="sm" className="mt-4">{t('me.apps.browse')}</ButtonLink>
              </div>
            ) : (
              <ul className="space-y-3">
                {(apps.data as Application[]).slice(0, 4).map((a) => (
                  <li key={a.id}>
                    <Link to={`/services/applications/${a.id}`} className="block rounded-2xl border border-line bg-bg p-4 transition hover:border-line-strong hover:bg-bg-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{serviceName(a.service_id) || a.reference}</p>
                          <p className="font-data text-xs text-muted">{a.reference} · {date(a.created_at)}</p>
                        </div>
                        <Chip tone={appTone(a.status)}>{t(`services.app.statuses.${a.status}` as MessageKey)}</Chip>
                      </div>
                      <Meter value={appProgress[a.status]} label={t(`services.app.statuses.${a.status}` as MessageKey)} tone={a.status === 'rejected' ? 'bad' : a.status === 'approved' ? 'good' : 'brand'} className="mt-3" />
                      {(a.due_at || a.status === 'awaiting_payment') && (
                        <p className="mt-2 text-xs text-muted">
                          {a.status === 'awaiting_payment' ? <b className="text-ink">{`KES ${number(a.amount)}`}</b> : <>{t('services.app.due')}: <b className="text-ink">{date(a.due_at!)}</b></>}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {wardId && (
            <div className="grid gap-6 md:grid-cols-2">
              <Panel id="near-projects" title={t('me.near.projects')}>
                {wardProjects.length === 0 ? (
                  <p className="text-sm text-muted">{t('me.near.projectsNone')}</p>
                ) : (
                  <ul className="space-y-4">
                    {wardProjects.slice(0, 3).map((p) => (
                      <li key={p.id}>
                        <Link to={`/projects/${p.slug}`} className="block rounded-xl transition hover:opacity-80">
                          <p className="line-clamp-2 font-semibold leading-snug">{p.title}</p>
                          <Meter value={p.spent} max={p.budget} label={`${t('common.spent')}: ${kes(p.spent)}`} tone={p.status === 'stalled' ? 'bad' : 'brand'} className="mt-2" />
                          <p className="mt-1 text-xs text-muted">{kes(p.spent, { compact: true })} / {kes(p.budget, { compact: true })}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel id="near-tenders" title={t('me.near.tenders')}>
                {wardTenders.length === 0 ? (
                  <p className="text-sm text-muted">{t('me.near.tendersNone')}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {wardTenders.slice(0, 3).map((x) => (
                      <li key={x.id} className="py-2.5 first:pt-0 last:pb-0">
                        <Link to="/tenders" className="block hover:opacity-80">
                          <p className="line-clamp-2 font-semibold leading-snug">{x.title}</p>
                          <p className="mt-0.5 text-xs text-muted"><span className="font-data">{x.reference}</span> · {kes(x.estimated_budget, { compact: true })}{x.closes_at ? ` · ${date(x.closes_at)}` : ''}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}
        </div>

        {/* ---------- Side column ---------- */}
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Panel id="follows" title={t('loop.follow.title')}>
            <FollowsList />
          </Panel>

          <Panel id="my-data" title={t('rights.data.title')}>
            <MyDataPanel />
          </Panel>

          <Panel id="mine" title={t('me.reports.title')}>
            {saved.length === 0 ? (
              <p className="text-sm text-ink-2">{t('me.reports.none')}</p>
            ) : (
              <ul className="space-y-2.5">
                {saved.slice(0, 4).map((r, i) => {
                  const c = cases[i]?.data;
                  return (
                    <li key={r.reference}>
                      <Link to={`/case/${r.reference}`} className="block rounded-2xl border border-line bg-bg p-3.5 transition hover:border-line-strong hover:bg-bg-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-data text-sm font-medium">{r.reference}</span>
                          {c ? <Chip tone={reportTone(c.status)}>{t(`statuses.${c.status}` as MessageKey)}</Chip> : <Skeleton className="h-5 w-16" />}
                        </div>
                        <p className="mt-1 truncate text-sm text-ink-2">
                          {r.category_id ? t(`categories.${r.category_id}` as MessageKey) : ''} · {wardLabel(r.ward_id)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{t('me.reports.filed', { when: relative(r.at) })}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">{t('me.reports.note')}</p>
          </Panel>

          {wardId && (
            <Panel id="coming" title={t('me.near.coming')}>
              {coming.length === 0 ? (
                <p className="text-sm text-muted">{t('me.near.comingNone')}</p>
              ) : (
                <ol className="relative space-y-4 border-l-2 border-line pl-5">
                  {coming.map((m, i) => {
                    const late = new Date(m.due) < new Date();
                    return (
                      <li key={`${m.project}-${m.title}-${i}`} className="relative">
                        <span aria-hidden className={cn('absolute -left-[1.72rem] top-1 grid size-5 place-items-center rounded-full border-2 border-surface', late ? 'bg-bad' : 'bg-brand')}><CalendarClock className="size-2.5 text-white" /></span>
                        <p className="text-sm font-semibold leading-snug">{m.title}</p>
                        <p className="text-xs text-muted">{m.project}</p>
                        <p className={cn('mt-0.5 text-xs font-semibold', late ? 'text-bad' : 'text-ink-2')}>{date(m.due)}</p>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Panel>
          )}

          <Panel id="county" title={t('me.county.title')}>
            <dl className="grid grid-cols-3 gap-3 text-center">
              <div><dd className="font-display text-2xl font-extrabold text-good tabular-nums">{summary.data ? number(summary.data.reports_resolved) : '-'}</dd><dt className="mt-1 text-[0.68rem] font-bold uppercase tracking-wide text-muted">{t('home.resolved')}</dt></div>
              <div><dd className="font-display text-2xl font-extrabold tabular-nums">{summary.data ? number(Math.max(0, summary.data.reports_filed - summary.data.reports_resolved)) : '-'}</dd><dt className="mt-1 text-[0.68rem] font-bold uppercase tracking-wide text-muted">{t('home.openIssues')}</dt></div>
              <div><dd className={cn('font-display text-2xl font-extrabold tabular-nums', summary.data && summary.data.reports_overdue > 0 && 'text-bad')}>{summary.data ? number(summary.data.reports_overdue) : '-'}</dd><dt className="mt-1 text-[0.68rem] font-bold uppercase tracking-wide text-muted">{t('home.overdue')}</dt></div>
            </dl>
            <Link to="/open" className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-bg-2 p-3.5 transition hover:bg-line/60">
              <span>
                <span className="block text-sm font-semibold">{t('me.county.flags')}: <b className="font-data">{number(flagCount)}</b></span>
                <span className="block text-xs text-muted">{t('me.county.flagsHint')}</span>
              </span>
              <Scale className="size-5 shrink-0 text-ink-2" aria-hidden />
            </Link>
          </Panel>

          <Panel id="help" title={t('me.help.title')}>
            <ul className="space-y-3 text-sm text-ink-2">
              <li className="flex gap-3"><Smartphone className="mt-0.5 size-5 shrink-0 text-brand-strong" aria-hidden />{t('me.help.ussd', { code: county.ussdCode })}</li>
              <li className="flex gap-3"><Bell className="mt-0.5 size-5 shrink-0 text-brand-strong" aria-hidden />{t('me.help.sms', { code: county.smsShortcode })}</li>
            </ul>
          </Panel>

          <p className="px-1 text-xs text-muted">{t('me.privacy')}</p>
        </div>
      </div>
    </div>
  );
}
