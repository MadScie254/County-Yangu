import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useConcerns, useTenders } from '@/shared/api/hooks';
import { concernLate, updateConcern } from '@/shared/api/civic2';
import type { TenderConcern } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

const kinds: Record<TenderConcern['kind'], string> = {
  specs_tailored: 'Specifications fit one bidder', short_deadline: 'Deadline too short', single_bid: 'Only one bid', price_inflated: 'Price looks inflated',
  conflict_of_interest: 'Conflict of interest', not_delivered: 'Paid but not delivered', other: 'Other',
};
type Answer = 'answered' | 'fixed' | 'dismissed';

/** Residents' concerns about tenders, answered in public within 14 days. Late or dismissed ones can be escalated by the resident. */
export default function Concerns() {
  usePageTitle('Procurement concerns', 'CountyConnect');
  const { relative, date } = useI18n();
  const qc = useQueryClient();
  const q = useConcerns();
  const tenders = useTenders();
  const title = useMemo(() => new Map((tenders.data ?? []).map((t) => [t.id, `${t.reference} ${t.title}`])), [tenders.data]);
  const [now] = useState(() => Date.now());
  const [edit, setEdit] = useState<{ c: TenderConcern; status: Answer; response: string } | null>(null);
  const save = useMutation({
    mutationFn: () => updateConcern(edit!.c.id, { status: edit!.status, response: edit!.response.trim() }),
    onSuccess: () => { toast({ tone: 'good', title: 'Answered in public. The resident has been told.' }); setEdit(null); void qc.invalidateQueries({ queryKey: ['concerns'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error && e.message !== 'not_allowed' ? e.message : 'Only the county administrator and chief officers can answer.' }),
  });
  const list = q.data ?? [];
  const open = list.filter((c) => c.status === 'submitted').sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  const done = list.filter((c) => c.status !== 'submitted');
  const row = (c: TenderConcern) => (
    <li key={c.id} className="py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-data">{c.reference}</span>
        <Chip tone="warn">{kinds[c.kind]}</Chip>
        {concernLate(c, now) ? <Chip tone="bad">Late since {date(c.due_at)}</Chip> : c.status === 'submitted' ? <Chip tone="info">Due {date(c.due_at)}</Chip> : <Chip tone={c.status === 'fixed' ? 'good' : c.status === 'escalated' ? 'bad' : 'neutral'}>{c.status}{c.escalated_to ? ` to ${c.escalated_to}` : ''}</Chip>}
        <span className="text-muted">{relative(c.created_at)}</span>
      </div>
      <p className="mt-1 text-sm font-semibold">{title.get(c.tender_id) ?? 'Tender'}</p>
      <p className="mt-1 text-sm text-ink-2">{c.body}</p>
      {c.response && <p className="mt-2 rounded-xl bg-bg-2 p-3 text-sm"><span className="font-semibold">County answer: </span>{c.response}</p>}
      {c.status === 'submitted' && <Button className="mt-2" size="sm" onClick={() => setEdit({ c, status: 'answered', response: '' })}>Answer</Button>}
    </li>
  );
  return (
    <>
      <PageHeader title="Procurement concerns" subtitle="Residents flag tenders that look wrong. Each answer is published on Open County, and every concern not answered within 14 days counts against the county on the public deadlines board." />
      <div className="space-y-6">
        <Panel title={`Waiting for an answer (${open.length})`}>{open.length === 0 ? <Empty>Nothing waiting.</Empty> : <ul className="divide-y divide-line">{open.map(row)}</ul>}</Panel>
        <Panel title="Answered">{done.length === 0 ? <Empty>None yet.</Empty> : <ul className="divide-y divide-line">{done.map(row)}</ul>}</Panel>
      </div>
      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title="Answer in public" className="sm:max-w-xl">
        {edit && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (edit.response.trim().length >= 10) save.mutate(); }}>
            <p className="rounded-xl bg-bg-2 p-3 text-sm">{edit.c.body}</p>
            <Field label="Outcome">{({ id }) => <SelectInput id={id} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Answer })}>
              <option value="answered">Answered: explained why it is in order</option>
              <option value="fixed">Fixed: the tender was changed</option>
              <option value="dismissed">Dismissed: not a real problem</option>
            </SelectInput>}</Field>
            <Field label="Public answer" hint="Everyone can read this. Give facts and documents, not names of junior staff.">{({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} className="min-h-32" maxLength={3000} value={edit.response} onChange={(e) => setEdit({ ...edit, response: e.target.value })} />}</Field>
            <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={save.isPending} disabled={edit.response.trim().length < 10}>Publish answer</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
