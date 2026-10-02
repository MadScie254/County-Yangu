import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Trash2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { usePolls } from '@/shared/api/hooks';
import { savePoll } from '@/shared/api/civic2';
import type { Poll } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

const wardName = new Map(wards.map((w) => [w.id, w.name]));
type Opt = { label: string; label_sw: string };
type Draft = { id?: string; slug?: string; question: string; question_sw: string; ward_id: string; days: number; options: Opt[] };
const blank: Draft = { question: '', question_sw: '', ward_id: '', days: 7, options: [{ label: '', label_sw: '' }, { label: '', label_sw: '' }] };
const slugify = (s: string) => `${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'poll'}-${Math.random().toString(36).slice(2, 6)}`;

/** Quick polls: one question, two to six answers, results by ward. Ward followers are told when a ward poll opens. */
export default function Polls() {
  usePageTitle('Quick polls', 'CountyConnect');
  const { date } = useI18n();
  const qc = useQueryClient();
  const q = usePolls();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [now] = useState(() => Date.now());
  const save = useMutation({
    mutationFn: (d: Draft) => {
      const opens = new Date();
      return savePoll({
        slug: d.slug ?? slugify(d.question), question: d.question.trim(), question_sw: d.question_sw.trim() || null, ward_id: d.ward_id || null,
        options: d.options.filter((o) => o.label.trim()).map((o, i) => ({ id: String.fromCharCode(97 + i), label: o.label.trim(), ...(o.label_sw.trim() ? { label_sw: o.label_sw.trim() } : {}) })),
        opens_at: opens.toISOString(), closes_at: new Date(opens.getTime() + d.days * 86_400_000).toISOString(),
      });
    },
    onSuccess: () => { toast({ tone: 'good', title: 'Poll is open. Residents see it at /polls.' }); setEdit(null); void qc.invalidateQueries({ queryKey: ['polls'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const close = useMutation({
    mutationFn: (p: Poll) => savePoll({ ...p, closes_at: new Date(Math.max(Date.parse(p.opens_at) + 60_000, Date.now())).toISOString() }),
    onSuccess: () => { toast({ tone: 'good', title: 'Closed.' }); void qc.invalidateQueries({ queryKey: ['polls'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const filled = edit ? edit.options.filter((o) => o.label.trim()).length : 0;
  const valid = edit && edit.question.trim().length >= 8 && filled >= 2;
  const list = q.data ?? [];

  return (
    <>
      <PageHeader title="Quick polls" subtitle="Ask residents one short question and see answers by ward. Answers cannot be changed or deleted, by anyone." actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit({ ...blank, options: blank.options.map((o) => ({ ...o })) })}>New poll</Button>} />
      <Panel title="Polls">
        {list.length === 0 ? <Empty>No polls yet.</Empty> : (
          <ul className="divide-y divide-line">{list.map((p) => {
            const open = Date.parse(p.opens_at) <= now && Date.parse(p.closes_at) > now;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                <Chip tone={open ? 'good' : 'neutral'}>{open ? 'open' : 'closed'}</Chip>
                <a href={`/polls#${p.slug}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 font-semibold hover:underline">{p.question}</a>
                <span className="text-sm text-muted">{p.ward_id ? wardName.get(p.ward_id) : 'County-wide'} · closes {date(p.closes_at)}</span>
                {open && <Button size="sm" variant="secondary" loading={close.isPending} onClick={() => close.mutate(p)}>Close now</Button>}
              </li>
            );
          })}</ul>
        )}
      </Panel>
      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title="New poll" className="sm:max-w-xl">
        {edit && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(edit); }}>
            <Field label="Question">{({ id }) => <TextInput id={id} maxLength={200} value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} />}</Field>
            <Field label="Question in Kiswahili" optionalLabel="optional">{({ id }) => <TextInput id={id} maxLength={200} value={edit.question_sw} onChange={(e) => setEdit({ ...edit, question_sw: e.target.value })} />}</Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Answers (2 to 6)</legend>
              {edit.options.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <TextInput aria-label={`Answer ${i + 1}`} placeholder={`Answer ${i + 1}`} maxLength={80} value={o.label} onChange={(e) => setEdit({ ...edit, options: edit.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <TextInput aria-label={`Answer ${i + 1} in Kiswahili`} placeholder="Kiswahili" maxLength={80} value={o.label_sw} onChange={(e) => setEdit({ ...edit, options: edit.options.map((x, j) => (j === i ? { ...x, label_sw: e.target.value } : x)) })} />
                  {edit.options.length > 2 && <Button type="button" size="sm" variant="ghost" aria-label="Remove answer" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setEdit({ ...edit, options: edit.options.filter((_, j) => j !== i) })} />}
                </div>
              ))}
              {edit.options.length < 6 && <Button type="button" size="sm" variant="secondary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit({ ...edit, options: [...edit.options, { label: '', label_sw: '' }] })}>Add answer</Button>}
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Who it is for">{({ id }) => <SelectInput id={id} value={edit.ward_id} onChange={(e) => setEdit({ ...edit, ward_id: e.target.value })}><option value="">County-wide</option>{[...wards].sort((a, b) => a.name.localeCompare(b.name)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
              <Field label="Open for">{({ id }) => <SelectInput id={id} value={edit.days} onChange={(e) => setEdit({ ...edit, days: Number(e.target.value) })}>{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}</SelectInput>}</Field>
            </div>
            <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={save.isPending} disabled={!valid}>Open the poll</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
