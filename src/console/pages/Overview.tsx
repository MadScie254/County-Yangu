import { DeadlinesBoard } from '@/shared/ui/DeadlinesBoard';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, Banknote, ClipboardCheck, Eye, FileStack, Flag, FolderKanban, Inbox, Lightbulb, Scale, Settings, Sparkles, Timer, UserRound, Vote, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/shared/state/auth';
import { wardLabel } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { useProcurementWatch } from '@/shared/api/hooks';
import { cn } from '@/shared/lib/utils';
import { useCan } from '../lib/perm';
import { isOpen, sla, statusLabel } from '../lib/cases';
import { useCases, useCategories, useDepartments, useReviewApps } from '../api/hooks';
import { nameMaps } from '../api/hooks';
import { Empty, Kpi, PageHeader, Panel } from '../ui/Page';

type Tile = { to: string; label: string; hint: string; icon: LucideIcon; show: boolean; badge?: number; tone?: 'bad' | 'warn'; external?: boolean };

function QuickTile({ t }: { t: Tile }) {
  const inner = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="grid size-10 place-items-center rounded-xl bg-bg-2 text-ink transition group-hover:bg-brand group-hover:text-brand-ink"><t.icon className="size-5" aria-hidden /></span>
        {t.badge !== undefined && t.badge > 0 && <span className={cn('rounded-full px-2 py-0.5 font-data text-xs font-medium', t.tone === 'bad' ? 'bg-bad-soft text-bad' : t.tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-bg-2 text-ink-2')}>{t.badge}</span>}
      </span>
      <span className="mt-3 block font-display font-bold leading-tight">{t.label}</span>
      <span className="mt-0.5 block text-xs text-muted">{t.hint}</span>
    </>
  );
  const cls = 'group block rounded-[1.25rem] border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-float';
  return t.external ? <a href={t.to} className={cls}>{inner}</a> : <Link to={t.to} className={cls}>{inner}</Link>;
}

export default function Overview() {
  usePageTitle('Overview', 'CountyConnect');
  const can = useCan();
  const user = useAuth((s) => s.user);
  const cases = useCases();
  const apps = useReviewApps();
  const cats = useCategories();
  const depts = useDepartments();
  const maps = nameMaps(depts.data, cats.data);

  const mine = useMemo(() => (cases.data ?? []).filter(isOpen), [cases.data]);
  const overdue = mine.filter((c) => sla(c).state === 'overdue');
  const atRisk = mine.filter((c) => sla(c).state === 'at_risk');
  const unassigned = mine.filter((c) => !c.assigned_to);
  const flagged = mine.filter((c) => c.flagged_financial);
  const waiting = (apps.data ?? []).filter((a) => a.status === 'submitted' || a.status === 'under_review');
  const attention = [...overdue, ...atRisk].sort((a, b) => sla(a).ms - sla(b).ms).slice(0, 8);
  const first = (user?.name || user?.email || '').split(/[ @]/)[0];
  const watch = useProcurementWatch();
  const flagsHigh = (watch.data?.flags ?? []).filter((f) => f.severity === 'high' && f.status !== 'cleared').length;
  const flagsTodo = (watch.data?.flags ?? []).filter((f) => f.severity !== 'info' && f.status === 'open').length;

  const tiles: Tile[] = [
    { to: '/cases', label: 'Case inbox', hint: 'Work reports from residents', icon: Inbox, show: can.working, badge: mine.length },
    { to: '/sla', label: 'SLA board', hint: 'Deadlines at a glance', icon: Timer, show: can.working, badge: overdue.length, tone: 'bad' },
    { to: '/applications', label: 'Applications', hint: 'Permits and licences', icon: ClipboardCheck, show: can.working, badge: waiting.length, tone: 'warn' },
    { to: '/assistant', label: 'AI assistant', hint: 'Ask questions of the data', icon: Sparkles, show: can.working },
    { to: '/projects', label: 'Projects', hint: 'Publish progress', icon: FolderKanban, show: can.publish },
    { to: '/tenders', label: 'Tenders', hint: 'Publish and award', icon: FileStack, show: can.publish },
    { to: '/alerts', label: 'Ward alerts', hint: 'SMS to residents', icon: BellRing, show: can.working },
    { to: '/ideas', label: 'Ideas & petitions', hint: 'Answer residents', icon: Lightbulb, show: can.working },
    { to: '/budget', label: 'Budget cycles', hint: 'Ward votes', icon: Vote, show: can.admin },
    { to: '/revenue', label: 'Revenue', hint: 'Payments and matching', icon: Banknote, show: can.finance },
    { to: '/oversight', label: 'Overdue & digests', hint: 'What is late, and who holds it', icon: Eye, show: can.oversight },
    { to: '/procurement', label: 'Procurement watch', hint: 'Patterns worth a look', icon: Scale, show: can.oversight, badge: flagsTodo, tone: flagsHigh ? 'bad' : 'warn' },
    { to: '/admin', label: 'Administration', hint: 'People, services, AI budget', icon: Settings, show: can.admin },
    { to: '/me', label: 'Citizen view', hint: 'Your own dashboard', icon: UserRound, show: true, external: true },
  ];

  const quick = (
      <section aria-label="Quick access" className="mt-6">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
          {tiles.filter((t) => t.show).map((t) => <li key={t.to}><QuickTile t={t} /></li>)}
        </ul>
      </section>
  );

  return (
    <>
      <PageHeader title={`Good day${first ? `, ${first}` : ''}`} subtitle={can.working ? 'What needs your attention right now.' : 'You have read-only access. Open Overdue & digests to see what is late.'} />

      {!can.working && quick}

      {can.working && (
        <>
          {cases.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
              <Kpi label="Open cases" value={mine.length} />
              <Kpi label="Overdue" value={overdue.length} tone={overdue.length ? 'bad' : 'good'} hint="Past their target date" />
              <Kpi label="Due within 24h" value={atRisk.length} tone={atRisk.length ? 'warn' : undefined} />
              <Kpi label="Unassigned" value={unassigned.length} tone={unassigned.length ? 'warn' : undefined} />
              <Kpi label="Applications waiting" value={waiting.length} />
            </div>
          )}

          {quick}

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel title="Needs attention" pad={false} action={<Link to="/cases" className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">All cases <ArrowRight className="size-4" aria-hidden /></Link>}>
              {attention.length === 0 ? (
                <div className="p-5"><Empty>Nothing is overdue or about to be. Well done.</Empty></div>
              ) : (
                <ul className="divide-y divide-line">
                  {attention.map((c) => {
                    const s = sla(c);
                    return (
                      <li key={c.id}>
                        <Link to={`/cases/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-bg-2/60">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{maps.cat.get(c.category_id ?? '') ?? 'Report'} · {wardLabel(c.ward_id)}</p>
                            <p className="truncate text-sm text-muted"><span className="font-data">{c.reference}</span> · {statusLabel[c.status]}{c.flagged_financial && <span className="ml-2 inline-flex items-center gap-1 text-bad"><Flag className="size-3" aria-hidden />integrity</span>}</p>
                          </div>
                          <Chip tone={s.tone}>{s.label}</Chip>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <div className="space-y-6">
              {flagged.length > 0 && (
                <Panel title="Integrity desk">
                  <p className="text-sm text-ink-2"><b className="font-data text-xl text-ink">{flagged.length}</b> open case{flagged.length === 1 ? '' : 's'} flagged as finance or integrity. They are routed around the department they concern.</p>
                  <Link to="/cases?flag=1" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">Review <ArrowRight className="size-4" aria-hidden /></Link>
                </Panel>
              )}
              {can.oversight && watch.data && (
                <Panel title="Procurement watch">
                  <p className="text-sm text-ink-2"><b className={cn('font-data text-xl', flagsHigh ? 'text-bad' : 'text-ink')}>{flagsTodo}</b> pattern{flagsTodo === 1 ? '' : 's'} waiting for review, {flagsHigh} high priority.</p>
                  <Link to="/procurement" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">Open the watch <ArrowRight className="size-4" aria-hidden /></Link>
                </Panel>
              )}
              <Panel title="Quick links">
                <ul className="space-y-2 text-sm font-semibold">
                  <li><Link to="/cases?view=unassigned" className="underline-offset-4 hover:underline">Assign the {unassigned.length} unassigned case{unassigned.length === 1 ? '' : 's'}</Link></li>
                  <li><Link to="/applications" className="underline-offset-4 hover:underline">Review {waiting.length} application{waiting.length === 1 ? '' : 's'}</Link></li>
                  <li><Link to="/sla" className="underline-offset-4 hover:underline">Open the SLA board</Link></li>
                </ul>
              </Panel>
            </div>
          </div>
        </>
      )}

      <section className="mt-6">
        <Panel title="Legal deadlines" action={<span className="text-sm text-muted">Counted from the records. Residents see the same numbers on Open County.</span>}>
          <DeadlinesBoard links="console" />
        </Panel>
      </section>

      {!can.working && (
        <Panel title="Oversight"><p className="text-ink-2">See every case that is past its target, how far it has climbed the escalation ladder, and the monthly digests.</p><Link to="/oversight" className="mt-3 inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline">Open Overdue & digests <ArrowRight className="size-4" aria-hidden /></Link></Panel>
      )}
    </>
  );
}
