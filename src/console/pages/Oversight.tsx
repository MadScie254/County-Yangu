import { useState } from 'react';
import { FileText, Flag } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { levelLabel } from '../lib/cases';
import { useCan } from '../lib/perm';
import { useAudit, useDigests, useOverdue } from '../api/hooks';
import { Empty, Kpi, PageHeader, Panel, Table, td } from '../ui/Page';

const tabs = [['overdue', 'Overdue cases'], ['digests', 'Monthly digests'], ['audit', 'Audit trail']] as const;

/**
 * Read-only oversight for the County Assembly, the Controller of Budget and auditors.
 * Assembly members see named officers; auditors see departments only. Nobody here can change a record.
 */
export default function Oversight() {
  usePageTitle('Overdue & digests', 'CountyConnect');
  const can = useCan();
  const { date, relative } = useI18n();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>('overdue');
  const overdue = useOverdue(can.namedOfficers);
  const digests = useDigests();
  const audit = useAudit();
  const rows = overdue.data ?? [];
  const critical = rows.filter((r) => r.days_overdue > 30 || r.escalation_level >= 4);
  const financial = rows.filter((r) => r.flagged_financial);
  const tabList = tabs.filter(([id]) => id !== 'audit' || can.has('auditor', 'admin', 'super_admin'));

  return (
    <>
      <PageHeader title="Overdue & digests" subtitle="Where the county is late, how far it has climbed the escalation ladder, and what has been sent to oversight bodies." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Overdue cases" value={rows.length} tone={rows.length ? 'bad' : 'good'} />
        <Kpi label="More than 30 days late" value={critical.length} tone={critical.length ? 'bad' : undefined} />
        <Kpi label="Flagged finance / integrity" value={financial.length} tone={financial.length ? 'warn' : undefined} />
        <Kpi label="Longest wait" value={rows[0] ? `${rows[0].days_overdue}d` : '-'} />
      </div>

      <div role="tablist" aria-label="Oversight" className="mb-4 mt-6 flex flex-wrap gap-1.5">
        {tabList.map(([id, t]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('tap rounded-full border px-4 text-sm font-semibold', tab === id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-line-strong')}>{t}</button>)}
      </div>

      {tab === 'overdue' && (
        <Panel pad={false}>
          {overdue.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : rows.length === 0 ? <div className="p-5"><Empty>No case is overdue.</Empty></div> : (
            <Table head={['Case', 'Ward', 'Category', 'Department', can.namedOfficers ? 'Officer' : 'Officer (hidden)', 'Days late', 'Ladder']}>
              {rows.map((r) => (
                <tr key={r.reference}>
                  <td className={td}><span className="font-data text-[0.82rem] font-medium">{r.reference}</span>{r.flagged_financial && <Chip tone="bad" className="ml-2"><Flag className="size-3" aria-hidden />finance</Chip>}</td>
                  <td className={td}>{r.ward}</td><td className={td}>{r.category}</td><td className={td}>{r.department}</td>
                  <td className={td}>{r.officer ?? <span className="text-muted">-</span>}</td>
                  <td className={cn(td, 'font-data font-semibold', r.days_overdue > 30 && 'text-bad')}>{r.days_overdue}</td>
                  <td className={td}><span className={cn('text-xs', r.escalation_level >= 3 ? 'font-bold text-bad' : 'text-muted')}>{levelLabel[r.escalation_level]}</span></td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {tab === 'digests' && (
        <div className="grid gap-4 md:grid-cols-2">
          {digests.data?.length === 0 && <Empty>No digests yet. The first is built at the end of the month.</Empty>}
          {digests.data?.map((d) => (
            <Panel key={d.id}>
              <p className="flex items-center gap-2 font-display text-lg font-bold capitalize"><FileText className="size-5 text-muted" aria-hidden />{d.kind.replace(/_/g, ' ')}</p>
              <p className="mt-1 text-sm text-muted">{date(d.period_start)} to {date(d.period_end)}</p>
              <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{d.body_md}</p>
            </Panel>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <Panel pad={false}>
          {audit.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : (audit.data?.length ?? 0) === 0 ? <div className="p-5"><Empty>Nothing recorded yet.</Empty></div> : (
            <Table head={['When', 'Action', 'Record', 'Who', 'Via']}>
              {audit.data!.map((a) => (
                <tr key={a.id}><td className={td} title={date(a.at, { dateStyle: 'medium', timeStyle: 'medium' })}>{relative(a.at)}</td><td className={cn(td, 'font-semibold')}>{a.action}</td><td className={td}><span className="font-data text-[0.82rem]">{a.entity}</span>{a.entity_id && <span className="ml-1 font-data text-[0.75rem] text-muted">{String(a.entity_id).slice(0, 8)}</span>}</td><td className={td}>{a.actor_id ? String(a.actor_id).slice(0, 8) : 'system'}</td><td className={td}>{a.via ?? ''}</td></tr>
              ))}
            </Table>
          )}
        </Panel>
      )}
    </>
  );
}
