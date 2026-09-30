import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, Eye, Info, Megaphone, ShieldCheck } from 'lucide-react';
import { useProcurementWatch } from '@/shared/api/hooks';
import { reviewFlag } from '@/shared/api/procurement';
import type { FlagSeverity, FlagStatus, ProcurementFlag } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { SelectInput, TextArea } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { useCan } from '../lib/perm';
import { Empty, Kpi, PageHeader, Panel } from '../ui/Page';

const sevTone: Record<FlagSeverity, Tone> = { high: 'bad', watch: 'warn', info: 'info' };
const sevLabel: Record<FlagSeverity, string> = { high: 'High priority', watch: 'Worth a look', info: 'For information' };
const statusTone: Record<FlagStatus, Tone> = { open: 'neutral', reviewing: 'info', explained: 'good', referred: 'vote', cleared: 'neutral' };
const statusLabel: Record<FlagStatus, string> = { open: 'Not yet reviewed', reviewing: 'Under review', explained: 'Explained', referred: 'Referred', cleared: 'No longer applies' };
type Choice = Exclude<FlagStatus, 'cleared'>;

function ReviewBox({ f, onDone }: { f: ProcurementFlag; onDone: () => void }) {
  const [status, setStatus] = useState<Choice>(f.status === 'cleared' ? 'open' : f.status);
  const [response, setResponse] = useState(f.response ?? '');
  const needsText = status === 'explained' || status === 'referred';
  const save = useMutation({
    mutationFn: () => reviewFlag({ code: f.code, key: f.subject_key, status, response }),
    onSuccess: () => { toast({ tone: 'good', title: 'Review saved' }); onDone(); },
    onError: (e) => toast({ tone: 'bad', title: (e as Error).message || 'Could not save the review' }),
  });
  return (
    <form
      className="mt-4 space-y-3 rounded-2xl border border-line bg-bg-2/60 p-4"
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
    >
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <label className="text-sm font-semibold">
          Status
          <SelectInput className="mt-1.5" value={status} onChange={(e) => setStatus(e.target.value as Choice)}>
            <option value="open">Not yet reviewed</option>
            <option value="reviewing">Under review</option>
            <option value="explained">Explained</option>
            <option value="referred">Referred to an oversight body</option>
          </SelectInput>
        </label>
        <label className="text-sm font-semibold">
          Public response {needsText ? '(required)' : '(optional)'}
          <TextArea className="mt-1.5 min-h-24" value={response} maxLength={800} onChange={(e) => setResponse(e.target.value)} placeholder="Say what the county found, in plain language." />
        </label>
      </div>
      <p className="flex items-start gap-2 text-xs text-muted"><Megaphone className="mt-0.5 size-3.5 shrink-0" aria-hidden />This response is shown to everyone on the Open County page. Do not include personal details.</p>
      <Button type="submit" size="sm" loading={save.isPending} disabled={needsText && response.trim().length < 10}>Save review</Button>
    </form>
  );
}

function FlagRow({ f, canReview }: { f: ProcurementFlag; canReview: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const Icon = f.severity === 'high' ? AlertOctagon : f.severity === 'watch' ? Eye : Info;
  return (
    <li className={cn('rounded-2xl border border-l-4 border-line bg-surface p-4 shadow-card sm:p-5', f.severity === 'high' ? 'border-l-bad' : f.severity === 'watch' ? 'border-l-warn' : 'border-l-info')}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={sevTone[f.severity]}><Icon className="size-3.5" aria-hidden />{sevLabel[f.severity]}</Chip>
        <Chip tone={statusTone[f.status]}>{statusLabel[f.status]}</Chip>
        <span className="text-xs text-muted">{f.subject_kind}</span>
      </div>
      <h3 className="mt-2 font-display text-lg font-bold leading-snug">{f.title}</h3>
      <p className="mt-1 text-[0.95rem] text-ink-2">{f.detail}</p>
      {f.response && <p className="mt-3 rounded-xl bg-good-soft p-3 text-sm"><b className="text-good">Published response.</b> {f.response}</p>}
      {canReview && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mt-3 text-sm font-semibold underline-offset-4 hover:underline">{open ? 'Close review' : f.status === 'open' ? 'Review this flag' : 'Update the review'}</button>
          {open && <ReviewBox f={f} onDone={() => { setOpen(false); void qc.invalidateQueries({ queryKey: ['procurement-watch'] }); }} />}
        </>
      )}
    </li>
  );
}

/**
 * The county's side of Open County. Everyone can see the flags on the public page; administrators review them here,
 * and what they write is published beside the flag. Auditors and Assembly members see the same list read-only.
 */
export default function Procurement() {
  usePageTitle('Procurement watch', 'CountyConnect');
  const can = useCan();
  const q = useProcurementWatch();
  const [show, setShow] = useState<'todo' | 'all'>('todo');
  const flags = useMemo(() => (q.data?.flags ?? []).filter((f) => f.status !== 'cleared'), [q.data]);
  const todo = flags.filter((f) => f.severity !== 'info' && f.status === 'open');
  const shown = show === 'todo' ? todo : flags;
  const high = flags.filter((f) => f.severity === 'high').length;
  const reviewed = flags.filter((f) => f.status === 'explained' || f.status === 'referred').length;

  return (
    <>
      <PageHeader
        title="Procurement watch"
        subtitle="Patterns in tenders and projects that deserve a closer look. Flags are prompts, not findings. Your responses are published on the public Open County page."
        actions={<a href="/open" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-surface px-5 text-[0.95rem] font-semibold hover:bg-bg-2">View public page</a>}
      />

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Kpi label="Waiting for review" value={todo.length} tone={todo.length ? 'warn' : 'good'} hint="High priority and worth a look" />
          <Kpi label="High priority" value={high} tone={high ? 'bad' : 'good'} />
          <Kpi label="Answered publicly" value={reviewed} hint="Explained or referred" />
          <Kpi label="Market concentration" value={q.data?.summary.hhi.toLocaleString('en-US') ?? '-'} hint={q.data ? q.data.summary.hhi_band : ''} tone={q.data?.summary.hhi_band === 'high' ? 'bad' : q.data?.summary.hhi_band === 'moderate' ? 'warn' : 'good'} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2" role="tablist" aria-label="Which flags">
        {([['todo', `To review (${todo.length})`], ['all', `All flags (${flags.length})`]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={show === id} onClick={() => setShow(id)} className={cn('tap rounded-full border px-4 text-sm font-semibold', show === id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-line-strong')}>{label}</button>
        ))}
      </div>

      <div className="mt-4">
        {q.isLoading ? (
          <Skeleton className="h-40" />
        ) : shown.length === 0 ? (
          <Empty>{show === 'todo' ? 'Nothing is waiting for review. The checks keep running every day.' : 'No flags right now.'}</Empty>
        ) : (
          <ul className="space-y-3">{shown.map((f) => <FlagRow key={`${f.code}|${f.subject_key}`} f={f} canReview={can.admin} />)}</ul>
        )}
      </div>

      {!can.admin && (
        <Panel className="mt-6">
          <p className="flex items-start gap-2 text-sm text-ink-2"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />You can see every flag but only a county administrator can review one. Reviews are recorded in the audit trail.</p>
        </Panel>
      )}
    </>
  );
}
