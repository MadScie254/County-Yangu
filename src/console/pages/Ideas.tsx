import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wardLabel } from '@/shared/config/county';
import { useAuth } from '@/shared/state/auth';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import type { Proposal } from '@/shared/api/types';
import { listIdeas, respondIdea } from '../api/content';
import { Empty, PageHeader, Panel, Table, td } from '../ui/Page';

const label: Record<Proposal['status'], string> = { submitted: 'New', under_review: 'Being looked at', accepted: 'Accepted', declined: 'Declined', merged: 'Merged with another' };
const tone: Record<Proposal['status'], Tone> = { submitted: 'info', under_review: 'warn', accepted: 'good', declined: 'neutral', merged: 'neutral' };
const filters = [['open', 'Needs a reply'], ['all', 'Everything']] as const;

/** Residents' ideas and petitions. A reply is public: it is shown to everyone who supported the idea. */
export default function Ideas() {
  usePageTitle('Ideas & petitions', 'CountyConnect');
  const { relative } = useI18n();
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['c-ideas'], queryFn: listIdeas });
  const [show, setShow] = useState<(typeof filters)[number][0]>('open');
  const [edit, setEdit] = useState<Proposal | null>(null);
  const [status, setStatus] = useState<Proposal['status']>('under_review');
  const [reply, setReply] = useState('');

  const open = (p: Proposal) => { setEdit(p); setStatus(p.status === 'submitted' ? 'under_review' : p.status); setReply(p.response ?? ''); };
  const save = useMutation({
    mutationFn: () => respondIdea(edit!.id, status, reply.trim(), me!.id),
    onSuccess: () => { toast({ tone: 'good', title: 'Reply published' }); setEdit(null); void qc.invalidateQueries({ queryKey: ['c-ideas'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const rows = (q.data ?? []).filter((p) => show === 'all' || p.status === 'submitted' || p.status === 'under_review');
  const needsReason = status === 'declined' || status === 'accepted';

  return (
    <>
      <PageHeader title="Ideas & petitions" subtitle="What residents are asking for, most supported first. Petitions above the threshold need a public answer." />
      <div role="tablist" aria-label="Filter" className="mb-4 flex gap-1.5">
        {filters.map(([id, t]) => <button key={id} type="button" role="tab" aria-selected={show === id} onClick={() => setShow(id)} className={cn('tap rounded-full border px-4 text-sm font-semibold', show === id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-line-strong')}>{t}</button>)}
      </div>
      <Panel pad={false}>
        {q.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : rows.length === 0 ? <div className="p-5"><Empty>Nothing waiting for a reply.</Empty></div> : (
          <Table head={['Idea', 'Type', 'Ward', 'Support', 'Status', '']}>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={cn(td, 'max-w-md')}><p className="font-semibold">{p.title}</p><p className="line-clamp-2 text-muted">{p.body}</p><p className="mt-1 text-xs text-muted">{relative(p.created_at)}</p></td>
                <td className={td}><Chip tone={p.kind === 'petition' ? 'vote' : 'neutral'}>{p.kind === 'petition' ? 'Petition' : 'Idea'}</Chip></td>
                <td className={td}>{p.ward_id ? wardLabel(p.ward_id) : 'County-wide'}</td>
                <td className={cn(td, 'font-data')}><span className="inline-flex items-center gap-1.5"><Users className="size-3.5 text-muted" aria-hidden />{p.supporters}</span></td>
                <td className={td}><Chip tone={tone[p.status]}>{label[p.status]}</Chip></td>
                <td className={cn(td, 'text-right')}><Button size="sm" variant="ghost" onClick={() => open(p)}>{p.response ? 'Edit reply' : 'Reply'}</Button></td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.title ?? 'Reply'} className="sm:max-w-xl">
        {edit && (
          <div className="space-y-4">
            <p className="whitespace-pre-line rounded-2xl bg-bg-2 p-4 text-sm text-ink-2">{edit.body}</p>
            <Field label="Decision">{({ id }) => <SelectInput id={id} value={status} onChange={(e) => setStatus(e.target.value as Proposal['status'])}>{(Object.keys(label) as Proposal['status'][]).filter((s) => s !== 'submitted').map((s) => <option key={s} value={s}>{label[s]}</option>)}</SelectInput>}</Field>
            <Field label="Reply to residents" hint="Plain words. This is public." error={needsReason && reply.trim().length < 20 ? 'Give a reason, at least a sentence.' : undefined}>{({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} rows={5} value={reply} onChange={(e) => setReply(e.target.value)} />}</Field>
            <Button block size="lg" loading={save.isPending} disabled={!me || (needsReason && reply.trim().length < 20)} onClick={() => save.mutate()}>Publish reply</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
