import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquareWarning, X } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wardLabel } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Sheet } from '@/shared/ui/Sheet';
import { TextArea } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { cn } from '@/shared/lib/utils';
import { decideApp } from '../api/ops';
import { revokePermit } from '@/shared/api/loop';
import { useCan } from '../lib/perm';
import { useReviewApps } from '../api/hooks';
import type { ReviewApp } from '../api/types';
import { Empty, PageHeader, Panel, Table, td } from '../ui/Page';

const tone: Record<string, Tone> = { submitted: 'info', under_review: 'warn', changes_requested: 'warn', approved: 'good', rejected: 'bad', awaiting_payment: 'neutral' };
const label: Record<string, string> = { submitted: 'Received', under_review: 'Under review', changes_requested: 'Changes requested', approved: 'Approved', rejected: 'Rejected', awaiting_payment: 'Awaiting payment' };
const tabs = [['todo', 'To review'], ['waiting', 'Waiting on applicant'], ['done', 'Decided']] as const;

export default function Applications() {
  usePageTitle('Applications', 'CountyConnect');
  const { kes, date, relative } = useI18n();
  const qc = useQueryClient();
  const apps = useReviewApps();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>('todo');
  const [open, setOpen] = useState<ReviewApp | null>(null);
  const [note, setNote] = useState('');

  const list = useMemo(() => (apps.data ?? []).filter((a) => (tab === 'todo' ? a.status === 'submitted' || a.status === 'under_review' : tab === 'waiting' ? a.status === 'changes_requested' || a.status === 'awaiting_payment' : a.status === 'approved' || a.status === 'rejected')), [apps.data, tab]);

  const can = useCan();
  const [revokeReason, setRevokeReason] = useState('');
  const revoke = useMutation({
    mutationFn: () => revokePermit(open!.id, revokeReason.trim()),
    onSuccess: () => { toast({ tone: 'good', title: 'Permit withdrawn. The holder has been told.' }); setOpen(null); setRevokeReason(''); void qc.invalidateQueries({ queryKey: ['c-apps'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const decide = useMutation({
    mutationFn: (d: 'approved' | 'rejected' | 'changes_requested') => decideApp(open!.id, d, note.trim() || null),
    onSuccess: () => { toast({ tone: 'good', title: 'Decision recorded. The applicant has been notified.' }); setOpen(null); setNote(''); void qc.invalidateQueries({ queryKey: ['c-apps'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });

  return (
    <>
      <PageHeader title="Applications" subtitle="Permits, licences and bursaries for the services your department runs. A person decides every outcome; nothing is automatic." />
      <div role="tablist" aria-label="Queues" className="mb-4 flex gap-1.5">
        {tabs.map(([id, t]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('tap rounded-full border px-4 text-sm font-semibold', tab === id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-line-strong')}>{t}</button>)}
      </div>
      <Panel pad={false}>
        {apps.isLoading ? <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div> : list.length === 0 ? <div className="p-5"><Empty>Nothing here.</Empty></div> : (
          <Table head={['Application', 'Applicant', 'Service', 'Ward', 'Fee', 'Status', 'Decide by']}>
            {list.map((a) => (
              <tr key={a.id} className="cursor-pointer hover:bg-bg-2/50" onClick={() => { setOpen(a); setNote(a.decision_note ?? ''); }}>
                <td className={td}><button type="button" className="font-data text-[0.82rem] font-medium underline-offset-4 hover:underline" onClick={() => { setOpen(a); setNote(a.decision_note ?? ''); }}>{a.reference}</button><p className="text-xs text-muted">{relative(a.created_at)}</p></td>
                <td className={td}><span className="font-semibold">{a.applicant_name}</span>{a.business_name && <p className="text-muted">{a.business_name}</p>}</td>
                <td className={td}>{a.service_name}</td>
                <td className={td}>{a.ward_id ? wardLabel(a.ward_id) : '-'}</td>
                <td className={cn(td, 'font-data')}>{a.amount > 0 ? kes(a.amount) : 'Free'}</td>
                <td className={td}><Chip tone={tone[a.status] ?? 'neutral'}>{label[a.status] ?? a.status}</Chip></td>
                <td className={td}>{a.due_at ? date(a.due_at) : '-'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Sheet open={Boolean(open)} onClose={() => setOpen(null)} title={open?.reference ?? 'Application'} className="sm:max-w-xl">
        {open && (
          <div>
            <p className="font-display text-lg font-bold">{open.service_name}</p>
            <dl className="mt-3 divide-y divide-line rounded-2xl border border-line text-sm">
              {[['Applicant', open.applicant_name], ['Phone', open.applicant_phone ?? '-'], ['Business', open.business_name ?? '-'], ['KRA PIN', open.kra_pin ?? '-'], ['Fee paid', open.amount > 0 ? kes(open.amount) : 'Free'], ...Object.entries(open.form_data).map(([k, v]) => [k.replace(/_/g, ' '), String(v)])].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="capitalize text-muted">{k}</dt><dd className="max-w-[60%] text-right font-semibold">{v}</dd></div>
              ))}
            </dl>
            {(open.status === 'submitted' || open.status === 'under_review' || open.status === 'changes_requested') ? (
              <>
                <label className="mt-4 block text-sm font-semibold" htmlFor="note">Note to the applicant <span className="font-normal text-muted">(required when asking for changes or rejecting)</span></label>
                <TextArea id="note" className="mt-1.5 min-h-24" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <Button variant="primary" icon={<Check className="size-4" aria-hidden />} loading={decide.isPending} onClick={() => decide.mutate('approved')}>Approve</Button>
                  <Button variant="secondary" icon={<MessageSquareWarning className="size-4" aria-hidden />} disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate('changes_requested')}>Ask for changes</Button>
                  <Button variant="danger" icon={<X className="size-4" aria-hidden />} disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate('rejected')}>Reject</Button>
                </div>
              </>
            ) : <p className="mt-4 rounded-xl bg-bg-2 p-3 text-sm text-ink-2">Status: {label[open.status] ?? open.status}{open.decision_note ? `: ${open.decision_note}` : ''}</p>}
            {open.status === 'approved' && can.admin && (
              <div className="mt-4 rounded-2xl border border-line p-4">
                <p className="text-sm font-semibold">Withdraw this permit</p>
                <p className="mt-1 text-xs text-muted">Use this for a permit issued in error or obtained by fraud. The holder is told, and anyone checking its code sees that it was withdrawn.</p>
                <TextArea className="mt-2 min-h-16" placeholder="Reason (shown to the holder and on the public check)" value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} />
                <Button className="mt-2" variant="danger" size="sm" disabled={revokeReason.trim().length < 5} loading={revoke.isPending} onClick={() => revoke.mutate()}>Withdraw permit</Button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
