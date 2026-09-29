import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, EyeOff, Plus } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards, wardLabel } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip, projectTone } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Meter } from '@/shared/ui/Meter';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { addMilestone, listMilestones, listProjects, saveProject, setMilestoneDone, type StaffProject } from '../api/content';
import { useCan } from '../lib/perm';
import { Empty, PageHeader, Panel, Table, td } from '../ui/Page';

const statuses = ['planned', 'procurement', 'in_progress', 'stalled', 'completed'] as const;
const label: Record<string, string> = { planned: 'Planned', procurement: 'Tendering', in_progress: 'Under way', stalled: 'Stalled', completed: 'Done' };
const blank: StaffProject = { id: '', slug: '', ward_id: '', title: '', sector: '', description: '', status: 'planned', budget: 0, spent: 0, contractor_id: null, lat: null, lng: null, started_at: null, expected_at: null, completed_at: null, published: false };

function Milestones({ project }: { project: StaffProject }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['c-ms', project.id], queryFn: () => listMilestones(project.id) });
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const refresh = () => void qc.invalidateQueries({ queryKey: ['c-ms', project.id] });
  const add = useMutation({ mutationFn: () => addMilestone(project.id, title.trim(), due || null), onSuccess: () => { setTitle(''); setDue(''); refresh(); } });
  const toggle = useMutation({ mutationFn: (v: { m: NonNullable<typeof q.data>[number]; done: boolean }) => setMilestoneDone(v.m, v.done), onSuccess: refresh });
  return (
    <div className="mt-6 border-t border-line pt-5">
      <h3 className="font-display text-lg font-bold">Milestones</h3>
      <ul className="mt-3 space-y-1.5">
        {q.data?.map((m) => (
          <li key={m.id}><label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-bg-2"><input type="checkbox" className="size-4 accent-[var(--good)]" checked={Boolean(m.completed_at)} onChange={(e) => toggle.mutate({ m, done: e.target.checked })} /><span className={cn('flex-1', m.completed_at && 'text-muted line-through')}>{m.title}</span>{m.due_date && <span className="text-xs text-muted">{m.due_date}</span>}</label></li>
        ))}
        {q.data?.length === 0 && <li className="text-sm text-muted">No milestones yet. Residents see these on the project page.</li>}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
        <TextInput aria-label="Milestone" placeholder="New milestone" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextInput aria-label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} disabled={!title.trim()} onClick={() => add.mutate()}>Add</Button>
      </div>
    </div>
  );
}

export default function Projects() {
  usePageTitle('Projects', 'CountyConnect');
  const { kes } = useI18n();
  const can = useCan();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['c-projects'], queryFn: listProjects });
  const [edit, setEdit] = useState<StaffProject | null>(null);
  const save = useMutation({
    mutationFn: (p: StaffProject) => saveProject({ ...p, id: p.id || undefined }),
    onSuccess: () => { toast({ tone: 'good', title: 'Saved' }); setEdit(null); void qc.invalidateQueries({ queryKey: ['c-projects'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const publish = useMutation({ mutationFn: (p: StaffProject) => saveProject({ ...p, published: !p.published }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['c-projects'] }) });
  const num = (v: string) => Number(v.replace(/[^\d.]/g, '')) || 0;

  return (
    <>
      <PageHeader title="Projects" subtitle="What you publish here appears on the public project map, budget and tracker with no retyping." actions={can.publish && <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit({ ...blank })}>New project</Button>} />
      <Panel pad={false}>
        {q.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : (q.data?.length ?? 0) === 0 ? <div className="p-5"><Empty>No projects yet.</Empty></div> : (
          <Table head={['Project', 'Ward', 'Status', 'Spent of budget', 'Public', '']}>
            {q.data!.map((p) => (
              <tr key={p.id}>
                <td className={td}><span className="font-semibold">{p.title}</span><p className="text-muted">{p.sector}{p.contractor_name ? ` · ${p.contractor_name}` : ''}</p></td>
                <td className={td}>{wardLabel(p.ward_id)}</td>
                <td className={td}><Chip tone={projectTone(p.status)}>{label[p.status]}</Chip></td>
                <td className={cn(td, 'min-w-48')}><Meter value={p.spent} max={p.budget || 1} label="Spent" tone={p.spent > p.budget * 1.02 ? 'bad' : 'brand'} /><p className="mt-1 font-data text-xs text-muted">{kes(p.spent, { compact: true })} / {kes(p.budget, { compact: true })}</p></td>
                <td className={td}><button type="button" onClick={() => publish.mutate(p)} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', p.published ? 'bg-good-soft text-good' : 'bg-bg-2 text-muted')}>{p.published ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}{p.published ? 'Published' : 'Hidden'}</button></td>
                <td className={cn(td, 'text-right')}><Button variant="ghost" size="sm" onClick={() => setEdit({ ...p })}>Edit</Button></td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Edit project' : 'New project'} className="sm:max-w-xl">
        {edit && (
          <div className="space-y-4">
            <Field label="Title">{({ id }) => <TextInput id={id} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ward">{({ id }) => <SelectInput id={id} value={edit.ward_id} onChange={(e) => setEdit({ ...edit, ward_id: e.target.value })}><option value="">Choose…</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
              <Field label="Sector">{({ id }) => <TextInput id={id} value={edit.sector} onChange={(e) => setEdit({ ...edit, sector: e.target.value })} />}</Field>
              <Field label="Status">{({ id }) => <SelectInput id={id} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as StaffProject['status'] })}>{statuses.map((s) => <option key={s} value={s}>{label[s]}</option>)}</SelectInput>}</Field>
              <Field label="Contractor">{({ id }) => <TextInput id={id} disabled value={edit.contractor_name ?? '— awarded through a tender —'} readOnly />}</Field>
              <Field label="Budget (KES)">{({ id }) => <TextInput id={id} inputMode="numeric" value={edit.budget} onChange={(e) => setEdit({ ...edit, budget: num(e.target.value) })} />}</Field>
              <Field label="Spent so far (KES)">{({ id }) => <TextInput id={id} inputMode="numeric" value={edit.spent} onChange={(e) => setEdit({ ...edit, spent: num(e.target.value) })} />}</Field>
              <Field label="Started" optionalLabel="Optional">{({ id }) => <TextInput id={id} type="date" value={edit.started_at ?? ''} onChange={(e) => setEdit({ ...edit, started_at: e.target.value || null })} />}</Field>
              <Field label="Expected finish" optionalLabel="Optional">{({ id }) => <TextInput id={id} type="date" value={edit.expected_at ?? ''} onChange={(e) => setEdit({ ...edit, expected_at: e.target.value || null })} />}</Field>
              <Field label="Latitude" optionalLabel="Optional" hint="For the map pin">{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} inputMode="decimal" value={edit.lat ?? ''} onChange={(e) => setEdit({ ...edit, lat: e.target.value ? Number(e.target.value) : null })} />}</Field>
              <Field label="Longitude" optionalLabel="Optional">{({ id }) => <TextInput id={id} inputMode="decimal" value={edit.lng ?? ''} onChange={(e) => setEdit({ ...edit, lng: e.target.value ? Number(e.target.value) : null })} />}</Field>
            </div>
            <Field label="Description" optionalLabel="Optional">{({ id }) => <TextArea id={id} value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />}</Field>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[var(--ink)]" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} />Show on the public tracker</label>
            <Button block size="lg" icon={<Check className="size-4" aria-hidden />} loading={save.isPending} disabled={!edit.title.trim() || !edit.ward_id} onClick={() => save.mutate(edit)}>Save project</Button>
            {edit.id && <Milestones project={edit} />}
          </div>
        )}
      </Sheet>
    </>
  );
}
