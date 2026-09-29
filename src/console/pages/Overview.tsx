import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flag } from 'lucide-react';
import { useAuth } from '@/shared/state/auth';
import { wardLabel } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { useCan } from '../lib/perm';
import { isOpen, sla, statusLabel } from '../lib/cases';
import { useCases, useCategories, useDepartments, useReviewApps } from '../api/hooks';
import { nameMaps } from '../api/hooks';
import { Empty, Kpi, PageHeader, Panel } from '../ui/Page';

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

  return (
    <>
      <PageHeader title={`Good day${first ? `, ${first}` : ''}`} subtitle={can.working ? 'What needs your attention right now.' : 'You have read-only access. Open Overdue & digests to see what is late.'} />

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

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
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

      {!can.working && (
        <Panel title="Oversight"><p className="text-ink-2">See every case that is past its target, how far it has climbed the escalation ladder, and the monthly digests.</p><Link to="/oversight" className="mt-3 inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline">Open Overdue & digests <ArrowRight className="size-4" aria-hidden /></Link></Panel>
      )}
    </>
  );
}
