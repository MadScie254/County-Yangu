import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useInfoRequests } from '@/shared/api/hooks';
import { answerInfoRequest, infoDeadline, infoOpen, infoOverdue } from '@/shared/api/rights';
import type { InfoRequest } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, TextArea, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

type Mode = 'answer' | 'extend' | 'refuse';

/** Access to Information Act, 2016: decide within 21 days (48 hours when urgent), extend once by 14 days, give reasons. */
export default function Information() {
  usePageTitle('Information requests', 'CountyConnect');
  const { date, relative } = useI18n();
  const qc = useQueryClient();
  const q = useInfoRequests();
  const [now] = useState(() => Date.now());
  const [sel, setSel] = useState<InfoRequest | null>(null);
  const [mode, setMode] = useState<Mode>('answer');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [partly, setPartly] = useState(false);
  const act = useMutation({
    mutationFn: () => answerInfoRequest(sel!.id, mode === 'extend' ? { status: 'extended', extension_reason: text.trim() }
      : mode === 'refuse' ? { status: 'refused', refusal_reason: text.trim() }
      : { status: partly ? 'partly_answered' : 'answered', response: text.trim() || null, response_url: url.trim() || null }),
    onSuccess: () => { toast({ tone: 'good', title: 'Saved and published. The resident has been told.' }); setSel(null); void qc.invalidateQueries({ queryKey: ['info-requests'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const list = q.data ?? [];
  const open = list.filter((r) => infoOpen(r)).sort((a, b) => infoDeadline(a).localeCompare(infoDeadline(b)));
  const done = list.filter((r) => !infoOpen(r));
  const late = open.filter((r) => infoOverdue(r, now)).length;
  const valid = mode === 'answer' ? text.trim().length > 0 || url.trim().startsWith('https://') : text.trim().length >= 10;
  const pick = (r: InfoRequest, m: Mode) => { setSel(r); setMode(m); setText(''); setUrl(''); setPartly(false); };

  const row = (r: InfoRequest) => {
    const overdue = infoOverdue(r, now);
    return (
      <li key={r.id} className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          {r.urgent && <Chip tone="bad">48 hours</Chip>}
          <Chip tone={overdue ? 'bad' : r.status === 'extended' ? 'warn' : r.status === 'refused' ? 'bad' : infoOpen(r) ? 'info' : 'good'}>{overdue ? 'late' : r.status.replace('_', ' ')}</Chip>
          <span className="font-semibold">{r.title}</span>
          <span className="ml-auto font-data text-xs text-muted">{r.reference}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-ink-2">{r.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className={cn(overdue && 'font-semibold text-bad')}><Clock className="mr-1 inline size-3.5" aria-hidden />{infoOpen(r) ? `Decide by ${date(infoDeadline(r), { dateStyle: 'medium', timeStyle: 'short' })}` : `Closed ${relative(r.answered_at ?? r.created_at)}`}</span>
          {!r.is_public && <Chip>private</Chip>}
          {infoOpen(r) && (
            <span className="ml-auto flex gap-2">
              <Button size="sm" icon={<CheckCircle2 className="size-4" aria-hidden />} onClick={() => pick(r, 'answer')}>Answer</Button>
              {r.status === 'submitted' && !r.urgent && <Button size="sm" variant="secondary" onClick={() => pick(r, 'extend')}>Extend 14 days</Button>}
              <Button size="sm" variant="ghost" icon={<XCircle className="size-4" aria-hidden />} onClick={() => pick(r, 'refuse')}>Refuse</Button>
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Information requests" subtitle="Requests under the Access to Information Act, 2016. Decide within 21 days, or 48 hours where a life or liberty is at stake. You may extend once, by 14 days, with a reason. Answers and refusals are published; a refusal must give the reason and the section of the Act." />
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs font-bold uppercase text-muted">Waiting</p><p className="font-display text-2xl font-extrabold">{open.length}</p></div>
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs font-bold uppercase text-muted">Late</p><p className={cn('font-display text-2xl font-extrabold', late && 'text-bad')}>{late}</p></div>
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs font-bold uppercase text-muted">Decided</p><p className="font-display text-2xl font-extrabold">{done.length}</p></div>
      </div>
      <div className="space-y-6">
        <Panel title="Waiting for a decision, soonest deadline first">{open.length === 0 ? <Empty>Nothing waiting.</Empty> : <ul className="divide-y divide-line">{open.map(row)}</ul>}</Panel>
        <Panel title="Decided">{done.length === 0 ? <Empty>Nothing decided yet.</Empty> : <ul className="divide-y divide-line">{done.map(row)}</ul>}</Panel>
      </div>

      <Sheet open={Boolean(sel)} onClose={() => setSel(null)} title={mode === 'answer' ? 'Answer the request' : mode === 'extend' ? 'Extend by 14 days' : 'Refuse the request'} className="sm:max-w-xl">
        {sel && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) act.mutate(); }}>
            <div className="rounded-2xl bg-bg-2 p-3 text-sm"><b>{sel.title}</b><p className="mt-1 whitespace-pre-line text-ink-2">{sel.body}</p></div>
            {mode === 'answer' && (
              <>
                <Field label="The answer (published)">{({ id }) => <TextArea id={id} className="min-h-32" maxLength={10000} value={text} onChange={(e) => setText(e.target.value)} />}</Field>
                <Field label="Link to the documents" optionalLabel="optional">{({ id }) => <TextInput id={id} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />}</Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={partly} onChange={(e) => setPartly(e.target.checked)} />Only part of the information is given (say what was withheld and why)</label>
              </>
            )}
            {mode === 'extend' && <Field label="Why more time is needed (published, shown to the resident)">{({ id }) => <TextArea id={id} className="min-h-24" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />}</Field>}
            {mode === 'refuse' && <Field label="Reason and the section of the Act relied on (published)">{({ id }) => <TextArea id={id} className="min-h-28" maxLength={2000} placeholder="For example: section 6(1)(d), personal information of third parties" value={text} onChange={(e) => setText(e.target.value)} />}</Field>}
            <Button type="submit" variant={mode === 'refuse' ? 'danger' : 'primary'} loading={act.isPending} disabled={!valid}>{mode === 'answer' ? 'Publish answer' : mode === 'extend' ? 'Extend once' : 'Refuse with reasons'}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
