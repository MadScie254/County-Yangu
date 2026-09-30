import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flag, MessageSquarePlus, Send, UserCheck, EyeOff, Eye, Sparkles } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wardLabel } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { assignCase, getCase, noteCase, transitionCase } from '../api/ops';
import { draftReply } from '../api/ai';
import { nameMaps, useCategories, useDepartments, useDirectory } from '../api/hooks';
import { ackState, isOpen, levelLabel, priorityTone, sla, statusLabel, statusTone } from '../lib/cases';
import { useCan } from '../lib/perm';
import { Panel } from '../ui/Page';
import type { CaseStatus } from '../api/types';

const nextActions: { status: Exclude<CaseStatus, 'received'>; label: string; variant: 'primary' | 'secondary' | 'danger' }[] = [
  { status: 'in_progress', label: 'Mark in progress', variant: 'secondary' },
  { status: 'resolved', label: 'Mark resolved', variant: 'primary' },
  { status: 'rejected', label: 'Reject (not valid)', variant: 'danger' },
];

export default function CaseDetail() {
  const { id = '' } = useParams();
  const { relative, date } = useI18n();
  const qc = useQueryClient();
  const can = useCan();
  const q = useQuery({ queryKey: ['c-case', id], queryFn: () => getCase(id) });
  const cats = useCategories();
  const depts = useDepartments();
  const staff = useDirectory();
  const maps = nameMaps(depts.data, cats.data, staff.data);
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [note, setNote] = useState('');
  const [officer, setOfficer] = useState('');
  const [drafting, setDrafting] = useState(false);

  const c = q.data?.row;
  usePageTitle(c?.reference ?? 'Case', 'CountyConnect');
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['c-case', id] }); void qc.invalidateQueries({ queryKey: ['c-cases'] }); };
  const onError = (e: unknown) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined });

  const move = useMutation({
    mutationFn: (status: Exclude<CaseStatus, 'received'>) => transitionCase(id, status, message.trim() || null, isPublic && message.trim().length > 0),
    onSuccess: () => { setMessage(''); refresh(); toast({ tone: 'good', title: 'Case updated' }); },
    onError,
  });
  const assign = useMutation({ mutationFn: () => assignCase(id, officer), onSuccess: () => { refresh(); toast({ tone: 'good', title: 'Assigned' }); }, onError });
  const addNote = useMutation({ mutationFn: () => noteCase(id, note.trim()), onSuccess: () => { setNote(''); refresh(); }, onError });

  if (q.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-60" /></div>;
  if (!c) return <p className="text-ink-2">That case was not found, or you do not have access to it. <Link className="font-semibold underline" to="/cases">Back to the inbox</Link></p>;

  const s = sla(c);
  const open = isOpen(c);
  const candidates = (staff.data ?? []).filter((m) => m.role === 'officer' || m.role === 'chief_officer').filter((m) => !c.department_id || m.department_id === c.department_id || m.department_id === null);
  const ack = ackState(c);

  const suggest = async () => {
    setDrafting(true);
    try {
      const text = await draftReply({ category: maps.cat.get(c.category_id ?? '') ?? 'Report', ward: wardLabel(c.ward_id), status: c.status, description: c.description });
      setMessage(text);
    } catch {
      toast({ tone: 'bad', title: 'The AI assistant is not available right now' });
    } finally {
      setDrafting(false);
    }
  };

  return (
    <>
      <Link to="/cases" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="size-4" aria-hidden />Case inbox</Link>
      <header className="mb-6 mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-data text-2xl font-medium tracking-wide">{c.reference}</h1>
          <Chip tone={statusTone[c.status]}>{statusLabel[c.status]}</Chip>
          {(c.priority === 'high' || c.priority === 'urgent') && <Chip tone={priorityTone[c.priority]!}>{c.priority}</Chip>}
          {(c.supporters ?? 0) > 0 && <Chip tone="info">{c.supporters} more residents report the same problem</Chip>}
          {c.flagged_financial && <Chip tone="bad"><Flag className="size-3" aria-hidden />Integrity desk</Chip>}
        </div>
        <p className="mt-1.5 text-ink-2">{maps.cat.get(c.category_id ?? '') ?? 'Report'} · {wardLabel(c.ward_id)} · via {c.channel} · {relative(c.created_at)}</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="What was reported">
            <p className="whitespace-pre-wrap text-[1.02rem]">{c.description}</p>
            <p className="mt-3 text-xs text-muted">Personal details typed into the report have been removed automatically. The reporter is anonymous{c.channel === 'ussd' ? ' (reported by USSD)' : ''}.</p>
            {q.data!.photos.length > 0 && <ul className="mt-4 grid grid-cols-3 gap-2">{q.data!.photos.map((u) => <li key={u}><a href={u} target="_blank" rel="noreferrer"><img src={u} alt="Photo attached to the report" loading="lazy" className="aspect-square w-full rounded-xl object-cover" /></a></li>)}</ul>}
            {c.lat != null && c.lng != null && <a className="mt-4 inline-block text-sm font-semibold underline underline-offset-4" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=17/${c.lat}/${c.lng}`}>Open the location on the map</a>}
          </Panel>

          <Panel title="Timeline">
            <ol className="space-y-5 border-l-2 border-line pl-5">
              {[...q.data!.events].reverse().map((e) => (
                <li key={e.id} className="relative">
                  <span className={cn('absolute -left-[1.6rem] top-1.5 size-3 rounded-full ring-4 ring-surface', e.kind === 'escalated' ? 'bg-bad' : e.kind === 'note' ? 'bg-warn' : e.is_public ? 'bg-good' : 'bg-line-strong')} />
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <b className="font-semibold capitalize">{e.kind.replace('_', ' ')}</b>
                    {e.actor_id && <span className="text-muted">by {maps.staff.get(e.actor_id) ?? 'staff'}</span>}
                    <span className="text-muted" title={date(e.created_at, { dateStyle: 'medium', timeStyle: 'short' })}>{relative(e.created_at)}</span>
                    {e.is_public ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-good"><Eye className="size-3" aria-hidden />public</span> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted"><EyeOff className="size-3" aria-hidden />internal</span>}
                  </p>
                  {e.message && <p className="mt-0.5">{e.message}</p>}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Target dates">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><dt className="text-muted">Resolve by</dt><dd className="flex items-center gap-2 font-semibold">{c.resolve_due_at ? date(c.resolve_due_at) : '-'}<Chip tone={s.tone}>{s.label}</Chip></dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted">Acknowledge by</dt><dd className="font-semibold">{c.ack_due_at ? date(c.ack_due_at) : '-'}</dd></div>
              {ack && <p className={cn('rounded-lg px-3 py-2 text-xs font-semibold', ack.startsWith('Ack') ? 'bg-bad-soft text-bad' : 'bg-warn-soft text-warn')}>{ack}</p>}
              <div className="flex items-center justify-between"><dt className="text-muted">Escalation</dt><dd className={cn('font-semibold', c.escalation_level >= 3 && 'text-bad')}>{levelLabel[c.escalation_level]}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted">Department</dt><dd className="text-right font-semibold">{maps.dept.get(c.department_id ?? '') ?? '-'}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-muted">Assigned to</dt><dd className="font-semibold">{c.assigned_to ? (maps.staff.get(c.assigned_to) ?? 'Officer') : 'Nobody yet'}</dd></div>
            </dl>
          </Panel>

          {open && can.working && (
            <>
              <Panel title="Assign">
                <Field label="Officer">{({ id: fid }) => (
                  <SelectInput id={fid} value={officer} onChange={(e) => setOfficer(e.target.value)}>
                    <option value="">Choose an officer</option>
                    {candidates.map((m) => <option key={m.user_id} value={m.user_id}>{m.name} · {maps.dept.get(m.department_id ?? '') ?? m.role.replace('_', ' ')}</option>)}
                  </SelectInput>
                )}</Field>
                <Button className="mt-3" block variant="secondary" disabled={!officer} loading={assign.isPending} icon={<UserCheck className="size-4" aria-hidden />} onClick={() => assign.mutate()}>Assign</Button>
              </Panel>

              <Panel title="Update the case">
                <Field label="Message" hint={isPublic ? 'Shown on the public status page and sent by SMS if the reporter opted in.' : 'Internal: only staff see this.'}>
                  {({ id: fid, describedBy }) => <TextArea id={fid} aria-describedby={describedBy} className="min-h-24" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Crew dispatched. Repair expected by Friday." />}
                </Field>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[var(--ink)]" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />Tell the reporter</label>
                  <Button variant="ghost" size="sm" loading={drafting} icon={<Sparkles className="size-4" aria-hidden />} onClick={() => void suggest()}>Suggest a reply</Button>
                </div>
                <div className="mt-4 grid gap-2">
                  {nextActions.map((a) => <Button key={a.status} block variant={a.variant} disabled={move.isPending} icon={a.status === 'resolved' ? <Send className="size-4" aria-hidden /> : undefined} onClick={() => move.mutate(a.status)}>{a.label}</Button>)}
                </div>
                <p className="mt-3 text-xs text-muted">The AI only drafts. Nothing is sent until you press a button.</p>
              </Panel>
            </>
          )}

          {can.working && (
            <Panel title="Internal note">
              <TextArea aria-label="Internal note" className="min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Only staff can see notes." />
              <Button className="mt-3" block variant="secondary" disabled={!note.trim()} loading={addNote.isPending} icon={<MessageSquarePlus className="size-4" aria-hidden />} onClick={() => addNote.mutate()}>Add note</Button>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
