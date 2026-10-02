import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Send } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useDisclosureInbox } from '@/shared/api/hooks';
import { answerDisclosure, type InboxItem } from '@/shared/api/civic2';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

const wardName = new Map(wards.map((w) => [w.id, w.name]));
const topics: Record<string, string> = { bribery: 'Bribery', procurement: 'Procurement', payroll: 'Ghost workers or payroll', theft: 'Theft of county property', abuse_of_office: 'Abuse of office', other: 'Other' };
const statuses = ['received', 'reviewing', 'referred', 'closed'] as const;
const tone = (s: string) => (s === 'received' ? 'warn' : s === 'closed' ? 'neutral' : 'info') as 'warn' | 'neutral' | 'info';

/**
 * The integrity desk's inbox. Whoever wrote in is known only by a key they hold; nothing here can identify them,
 * so the only way to reach them is to reply in the thread.
 */
export default function Disclosures() {
  usePageTitle('Integrity inbox', 'CountyConnect');
  const q = useDisclosureInbox();
  const [sel, setSel] = useState<string | null>(null);
  const list = q.data ?? [];
  const cur = list.find((d) => d.id === sel) ?? list[0] ?? null;

  return (
    <>
      <PageHeader title="Integrity inbox" subtitle="Anonymous reports of bribery, rigged tenders, ghost workers and theft. The person who wrote holds a private key; they read your replies with it. Never try to work out who they are." />
      <p className="mb-4 flex items-center gap-2 rounded-2xl bg-bg-2 p-3 text-sm"><Lock className="size-4 shrink-0" aria-hidden />Under the Whistleblower Protection rules, sharing anything that could identify a reporter is an offence. Refer serious matters to EACC, the DCI or the Auditor-General.</p>
      {q.isLoading ? null : list.length === 0 ? <Empty>Nothing has come in.</Empty> : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <Panel title={`Reports (${list.length})`} pad={false}>
            <ul className="divide-y divide-line">
              {list.map((d) => (
                <li key={d.id}>
                  <button type="button" onClick={() => setSel(d.id)} className={cn('w-full px-5 py-3 text-left hover:bg-bg-2/60', cur?.id === d.id && 'bg-bg-2')}>
                    <span className="flex items-center justify-between gap-2"><span className="font-data text-xs">{d.reference}</span><Chip tone={tone(d.status)}>{d.status}</Chip></span>
                    <span className="mt-1 block text-sm font-semibold">{topics[d.topic] ?? d.topic}{d.ward_id ? `, ${wardName.get(d.ward_id) ?? d.ward_id}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          {cur && <Thread key={cur.id} d={cur} />}
        </div>
      )}
    </>
  );
}

function Thread({ d }: { d: InboxItem }) {
  const { relative } = useI18n();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [status, setStatus] = useState(d.status);
  const [referred, setReferred] = useState(d.referred_to ?? '');
  const save = useMutation({
    mutationFn: () => answerDisclosure(d.id, body.trim() || null, status !== d.status ? status : null, referred.trim() && referred !== d.referred_to ? referred.trim() : null),
    onSuccess: () => { setBody(''); toast({ tone: 'good', title: 'Saved. The reporter sees it the next time they check with their key.' }); void qc.invalidateQueries({ queryKey: ['disclosures'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const changed = body.trim().length >= 2 || status !== d.status || (referred.trim() !== '' && referred !== d.referred_to);
  return (
    <Panel title={`${d.reference} · ${topics[d.topic] ?? d.topic}`}>
      <ol className="space-y-3">
        {d.messages.map((m, i) => (
          <li key={i} className={cn('max-w-[85%] rounded-2xl p-3 text-sm', m.from_reporter ? 'bg-bg-2' : 'ml-auto bg-brand-soft')}>
            <p className="text-xs font-semibold text-muted">{m.from_reporter ? 'Reporter' : 'Integrity desk'} · {relative(m.at)}</p>
            <p className="mt-1 whitespace-pre-line">{m.body}</p>
          </li>
        ))}
      </ol>
      <form className="mt-5 space-y-3 border-t border-line pt-4" onSubmit={(e) => { e.preventDefault(); if (changed) save.mutate(); }}>
        <Field label="Reply to the reporter" optionalLabel="optional" hint="Ask for documents, dates or names of officials. Do not ask who they are.">{({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} className="min-h-24" maxLength={6000} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">{({ id }) => <SelectInput id={id} value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</SelectInput>}</Field>
          <Field label="Referred to" optionalLabel="optional">{({ id }) => <TextInput id={id} placeholder="EACC, DCI, Auditor-General" maxLength={120} value={referred} onChange={(e) => setReferred(e.target.value)} />}</Field>
        </div>
        <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={save.isPending} disabled={!changed}>Save</Button>
      </form>
    </Panel>
  );
}
