import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useCommitments, useProjects } from '@/shared/api/hooks';
import { isOverdue, saveCommitment } from '@/shared/api/loop';
import type { Commitment, CommitmentStatus } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

const statuses: [CommitmentStatus, string, Tone][] = [['not_started', 'Not started', 'neutral'], ['in_progress', 'In progress', 'info'], ['delivered', 'Delivered', 'good'], ['delayed', 'Delayed', 'warn'], ['dropped', 'Dropped', 'bad']];
const tone = Object.fromEntries(statuses.map(([k, , t]) => [k, t])) as Record<CommitmentStatus, Tone>;
type Draft = { id?: string; slug: string; title: string; title_sw: string; detail: string; source: string; source_url: string; made_on: string; due_on: string; sector: string; ward_id: string; project_id: string; status: CommitmentStatus; evidence: string };
const blank: Draft = { slug: '', title: '', title_sw: '', detail: '', source: '', source_url: '', made_on: '', due_on: '', sector: '', ward_id: '', project_id: '', status: 'not_started', evidence: '' };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);

/** The county's public promises. Every status change and moved due date is kept on the public record automatically. */
export default function Promises() {
  usePageTitle('Promise tracker', 'CountyConnect');
  const { date } = useI18n();
  const qc = useQueryClient();
  const q = useCommitments();
  const projects = useProjects();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [was, setWas] = useState<Commitment | null>(null);
  const save = useMutation({
    mutationFn: (d: Draft) => saveCommitment({
      id: d.id, slug: d.slug, title: d.title.trim(), title_sw: d.title_sw.trim() || null, detail: d.detail.trim() || null, source: d.source.trim(),
      source_url: d.source_url.trim() || null, made_on: d.made_on || null, due_on: d.due_on || null, sector: d.sector.trim() || null,
      ward_id: d.ward_id || null, project_id: d.project_id || null, status: d.status, evidence: d.evidence.trim() || null,
    }),
    onSuccess: () => { toast({ tone: 'good', title: 'Saved. The change is on the public record and followers are told about status changes.' }); setEdit(null); void qc.invalidateQueries({ queryKey: ['commitments'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const open = (c: Commitment) => {
    setWas(c);
    setEdit({ id: c.id, slug: c.slug, title: c.title, title_sw: c.title_sw ?? '', detail: c.detail ?? '', source: c.source, source_url: c.source_url ?? '', made_on: c.made_on ?? '', due_on: c.due_on ?? '', sector: c.sector ?? '', ward_id: c.ward_id ?? '', project_id: c.project_id ?? '', status: c.status, evidence: c.evidence ?? '' });
  };
  const statusChanged = Boolean(edit?.id && was && was.status !== edit.status);
  const valid = edit && edit.title.trim().length >= 5 && edit.source.trim().length >= 2 && /^[a-z0-9][a-z0-9-]{2,78}$/.test(edit.slug)
    && (!edit.source_url || edit.source_url.startsWith('https://')) && (!statusChanged || edit.evidence.trim().length > 0 && edit.evidence !== was?.evidence);
  const list = q.data ?? [];

  return (
    <>
      <PageHeader title="Promise tracker" subtitle="Publish what the county has committed to, with its source and due date, then keep the status honest. Residents can follow each promise. You cannot edit history: every status change and moved due date is shown publicly."
        actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => { setWas(null); setEdit({ ...blank }); }}>New promise</Button>} />
      <Panel title={`Promises (${list.length})`}>
        {list.length === 0 ? <Empty>No promises published yet. Start with the headline commitments in the CIDP and the latest budget speech.</Empty> : (
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => open(c)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-bg-2/60">
                  <Chip tone={tone[c.status]}>{c.status.replace('_', ' ')}</Chip>
                  <span className="min-w-0 flex-1 font-semibold">{c.title}</span>
                  {isOverdue(c) && <Chip tone="bad">past due</Chip>}
                  <span className="w-28 text-right text-sm text-muted">{c.due_on ? date(c.due_on, { dateStyle: 'medium' }) : 'no date'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Update promise' : 'New promise'} className="sm:max-w-xl">
        {edit && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(edit); }}>
            <Field label="The promise, in plain words">{({ id }) => <TextInput id={id} value={edit.title} maxLength={200} onChange={(e) => setEdit({ ...edit, title: e.target.value, slug: edit.id ? edit.slug : slugify(e.target.value) })} />}</Field>
            <Field label="In Kiswahili" optionalLabel="optional">{({ id }) => <TextInput id={id} value={edit.title_sw} maxLength={200} onChange={(e) => setEdit({ ...edit, title_sw: e.target.value })} />}</Field>
            <Field label="Detail" optionalLabel="optional">{({ id }) => <TextArea id={id} className="min-h-16" value={edit.detail} maxLength={3000} onChange={(e) => setEdit({ ...edit, detail: e.target.value })} />}</Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Where it was promised">{({ id }) => <TextInput id={id} value={edit.source} maxLength={200} placeholder="CIDP 2023-2027" onChange={(e) => setEdit({ ...edit, source: e.target.value })} />}</Field>
              <Field label="Link to the source" optionalLabel="optional">{({ id }) => <TextInput id={id} value={edit.source_url} placeholder="https://" onChange={(e) => setEdit({ ...edit, source_url: e.target.value })} />}</Field>
              <Field label="Promised on" optionalLabel="optional">{({ id }) => <TextInput id={id} type="date" value={edit.made_on} onChange={(e) => setEdit({ ...edit, made_on: e.target.value })} />}</Field>
              <Field label="Due by" optionalLabel="optional">{({ id }) => <TextInput id={id} type="date" value={edit.due_on} onChange={(e) => setEdit({ ...edit, due_on: e.target.value })} />}</Field>
              <Field label="Sector" optionalLabel="optional">{({ id }) => <TextInput id={id} value={edit.sector} maxLength={60} placeholder="Health" onChange={(e) => setEdit({ ...edit, sector: e.target.value })} />}</Field>
              <Field label="Ward">{({ id }) => <SelectInput id={id} value={edit.ward_id} onChange={(e) => setEdit({ ...edit, ward_id: e.target.value })}><option value="">County-wide</option>{[...wards].sort((a, b) => a.name.localeCompare(b.name)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
            </div>
            <Field label="Linked project" optionalLabel="optional">{({ id }) => <SelectInput id={id} value={edit.project_id} onChange={(e) => setEdit({ ...edit, project_id: e.target.value })}><option value="">None</option>{(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</SelectInput>}</Field>
            <Field label="Web address">{({ id }) => <TextInput id={id} value={edit.slug} disabled={Boolean(edit.id)} onChange={(e) => setEdit({ ...edit, slug: slugify(e.target.value) })} />}</Field>
            <Field label="Status">{({ id }) => <SelectInput id={id} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as CommitmentStatus })}>{statuses.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput>}</Field>
            <Field label={statusChanged ? 'What changed (required, shown publicly)' : 'Latest progress (shown publicly)'} optionalLabel={statusChanged ? undefined : 'optional'}>
              {({ id }) => <TextArea id={id} className="min-h-20" value={edit.evidence} maxLength={2000} onChange={(e) => setEdit({ ...edit, evidence: e.target.value })} />}
            </Field>
            <Button type="submit" icon={<Save className="size-4" aria-hidden />} loading={save.isPending} disabled={!valid}>Save promise</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
