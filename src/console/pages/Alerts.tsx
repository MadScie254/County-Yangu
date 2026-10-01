import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, Check, Send, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards, wardLabel } from '@/shared/config/county';
import { useAuth } from '@/shared/state/auth';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { approveAlert, createAlert, listAlerts, submitAlert, type AlertRow } from '../api/content';
import { useCan } from '../lib/perm';
import { Empty, PageHeader, Panel } from '../ui/Page';

const SMS_LIMIT = 160;
const label: Record<AlertRow['status'], string> = { draft: 'Draft', pending_approval: 'Waiting for a second person', approved: 'Approved, sending', sent: 'Sent', cancelled: 'Cancelled' };
const tone: Record<AlertRow['status'], Tone> = { draft: 'neutral', pending_approval: 'warn', approved: 'info', sent: 'good', cancelled: 'neutral' };

/**
 * Ward alerts reach real phones, so nobody can send one alone: one person writes and submits it and a
 * different person approves it. The database enforces the second person; this page just shows who is who.
 */
export default function Alerts() {
  usePageTitle('Ward alerts', 'CountyConnect');
  const { relative } = useI18n();
  const me = useAuth((s) => s.user);
  const can = useCan();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['c-alerts'], queryFn: listAlerts });
  const [f, setF] = useState({ ward_id: '', title: '', body: '' });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['c-alerts'] });
  const onErr = (e: unknown) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined });

  const create = useMutation({
    mutationFn: () => createAlert({ ward_id: f.ward_id || null, title: f.title.trim(), body: f.body.trim() }, me!.id),
    onSuccess: () => { setF({ ward_id: '', title: '', body: '' }); toast({ tone: 'good', title: 'Draft saved' }); refresh(); },
    onError: onErr,
  });
  const submit = useMutation({ mutationFn: submitAlert, onSuccess: () => { toast({ tone: 'good', title: 'Sent for approval' }); refresh(); }, onError: onErr });
  const approve = useMutation({ mutationFn: (id: string) => approveAlert(id, me!.id), onSuccess: () => { toast({ tone: 'good', title: 'Approved', body: 'It will go out to subscribers in the next minute.' }); refresh(); }, onError: onErr });
  const over = f.body.length > SMS_LIMIT;

  return (
    <>
      <PageHeader title="Ward alerts" subtitle="Short SMS notices to residents who subscribed to a ward. Every alert needs two people: one to write it, another to approve it." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title="Write an alert">
          <div className="space-y-4">
            <Field label="Who should get it?">{({ id }) => <SelectInput id={id} value={f.ward_id} onChange={(e) => setF({ ...f, ward_id: e.target.value })}><option value="">Everyone in the county</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
            <Field label="Headline">{({ id }) => <TextInput id={id} maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
            <Field label="Message" hint={`${f.body.length}/${SMS_LIMIT} characters. Longer messages cost more than one SMS.`} error={over ? 'This will be sent as more than one SMS.' : undefined}>{({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
            <Button block size="lg" icon={<BellRing className="size-4" aria-hidden />} loading={create.isPending} disabled={!f.title.trim() || !f.body.trim() || !me} onClick={() => create.mutate()}>Save draft</Button>
          </div>
        </Panel>

        <Panel title="Alerts" pad={false}>
          {q.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : (q.data?.length ?? 0) === 0 ? <div className="p-5"><Empty>No alerts yet.</Empty></div> : (
            <ul className="divide-y divide-line">
              {q.data!.map((a) => {
                const mine = a.created_by === me?.id;
                return (
                  <li key={a.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{a.title}</p>
                        <p className="text-xs text-muted">{a.ward_id ? wardLabel(a.ward_id) : 'Whole county'} · {relative(a.created_at)}{mine ? ' · written by you' : ''}</p>
                      </div>
                      <Chip tone={tone[a.status]}>{label[a.status]}</Chip>
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{a.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.status === 'draft' && mine && <Button size="sm" variant="secondary" icon={<Send className="size-4" aria-hidden />} loading={submit.isPending} onClick={() => submit.mutate(a.id)}>Send for approval</Button>}
                      {a.status === 'pending_approval' && can.publish && !mine && <Button size="sm" icon={<Check className="size-4" aria-hidden />} loading={approve.isPending} onClick={() => approve.mutate(a.id)}>Approve and send</Button>}
                      {a.status === 'pending_approval' && mine && <p className="flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="size-4" aria-hidden />Someone else has to approve this. You cannot approve your own alert.</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
