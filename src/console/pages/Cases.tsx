import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Flag, Search } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useAuth } from '@/shared/state/auth';
import { wards, wardLabel } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { SelectInput, TextInput } from '@/shared/ui/Field';
import { isOpen, levelLabel, priorityTone, sla, statusLabel, statusTone } from '../lib/cases';
import { nameMaps, useCases, useCategories, useDepartments, useDirectory } from '../api/hooks';
import { Empty, PageHeader, Panel, Table, td } from '../ui/Page';

const views = [
  ['open', 'Open'], ['overdue', 'Overdue'], ['unassigned', 'Unassigned'], ['mine', 'Assigned to me'], ['flagged', 'Integrity'], ['closed', 'Closed'], ['all', 'All'],
] as const;
type View = (typeof views)[number][0];

export default function Cases() {
  usePageTitle('Case inbox', 'CountyConnect');
  const { relative } = useI18n();
  const [params, setParams] = useSearchParams();
  const me = useAuth((s) => s.user?.id);
  const cases = useCases();
  const cats = useCategories();
  const depts = useDepartments();
  const staff = useDirectory();
  const maps = nameMaps(depts.data, cats.data, staff.data);

  const view = (params.get('flag') ? 'flagged' : (params.get('view') as View | null)) ?? 'open';
  const q = params.get('q') ?? '';
  const ward = params.get('ward') ?? '';
  const cat = params.get('cat') ?? '';
  const dept = params.get('dept') ?? '';
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    n.delete('flag');
    if (v && !(k === 'view' && v === 'open')) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (cases.data ?? [])
      .filter((c) => {
        if (view === 'open' && !isOpen(c)) return false;
        if (view === 'closed' && isOpen(c)) return false;
        if (view === 'overdue' && sla(c).state !== 'overdue') return false;
        if (view === 'unassigned' && !(isOpen(c) && !c.assigned_to)) return false;
        if (view === 'mine' && c.assigned_to !== me) return false;
        if (view === 'flagged' && !c.flagged_financial) return false;
        if (ward && c.ward_id !== ward) return false;
        if (cat && c.category_id !== cat) return false;
        if (dept && c.department_id !== dept) return false;
        return !term || c.reference.toLowerCase().includes(term) || c.description.toLowerCase().includes(term);
      })
      .sort((a, b) => (isOpen(a) === isOpen(b) ? sla(a).ms - sla(b).ms : Number(isOpen(b)) - Number(isOpen(a))));
  }, [cases.data, view, q, ward, cat, dept, me]);

  return (
    <>
      <PageHeader title="Case inbox" subtitle="Everything residents report, sorted by how close each case is to its target date." />

      <div role="tablist" aria-label="Views" className="mb-4 flex flex-wrap gap-1.5">
        {views.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => set('view', id)} className={cn('tap rounded-full border px-4 text-sm font-semibold transition', view === id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-line-strong')}>
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-[1.05rem] -translate-y-1/2 text-muted" />
          <TextInput aria-label="Search cases" placeholder="Search reference or description" value={q} onChange={(e) => set('q', e.target.value)} className="rounded-full pl-11" />
        </div>
        <SelectInput aria-label="Ward" value={ward} onChange={(e) => set('ward', e.target.value)} className="rounded-full">
          <option value="">All wards</option>
          {[...wards].sort((a, b) => a.name.localeCompare(b.name)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </SelectInput>
        <SelectInput aria-label="Category" value={cat} onChange={(e) => set('cat', e.target.value)} className="rounded-full">
          <option value="">All categories</option>
          {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectInput>
        <SelectInput aria-label="Department" value={dept} onChange={(e) => set('dept', e.target.value)} className="rounded-full">
          <option value="">All departments</option>
          {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </SelectInput>
      </div>

      <Panel pad={false}>
        {cases.isLoading ? (
          <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-5"><Empty>No cases match these filters.</Empty></div>
        ) : (
          <>
            <p className="border-b border-line px-5 py-2.5 text-sm text-muted" aria-live="polite">{rows.length} case{rows.length === 1 ? '' : 's'}</p>
            <Table head={['Case', 'Category', 'Ward', 'Status', 'Target', 'Assigned', 'Ladder']}>
              {rows.slice(0, 200).map((c) => {
                const s = sla(c);
                return (
                  <tr key={c.id} className="hover:bg-bg-2/50">
                    <td className={td}>
                      <Link to={`/cases/${c.id}`} className="font-data text-[0.82rem] font-medium underline-offset-4 hover:underline">{c.reference}</Link>
                      <p className="mt-0.5 max-w-xs truncate text-muted">{c.description}</p>
                    </td>
                    <td className={td}>
                      <span className="block font-semibold">{maps.cat.get(c.category_id ?? '') ?? '—'}</span>
                      <span className="mt-1 flex flex-wrap gap-1">{(c.priority === 'urgent' || c.priority === 'high') && <Chip tone={priorityTone[c.priority]!}>{c.priority}</Chip>}{c.flagged_financial && <Chip tone="bad"><Flag className="size-3" aria-hidden />integrity</Chip>}</span>
                    </td>
                    <td className={td}>{wardLabel(c.ward_id)}</td>
                    <td className={td}><Chip tone={statusTone[c.status]}>{statusLabel[c.status]}</Chip><p className="mt-1 text-xs text-muted">{relative(c.created_at)}</p></td>
                    <td className={td}><Chip tone={s.tone}>{s.label}</Chip></td>
                    <td className={td}>{c.assigned_to ? (maps.staff.get(c.assigned_to) ?? 'Officer') : <span className="font-semibold text-warn">Unassigned</span>}</td>
                    <td className={td}><span className={cn('text-xs', c.escalation_level >= 3 ? 'font-bold text-bad' : 'text-muted')}>{levelLabel[c.escalation_level]}</span></td>
                  </tr>
                );
              })}
            </Table>
          </>
        )}
      </Panel>
    </>
  );
}
