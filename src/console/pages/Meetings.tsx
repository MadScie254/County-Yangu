import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Plus } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useMeetings } from '@/shared/api/hooks';
import { saveMeeting } from '@/shared/api/loop';
import type { PublicMeeting } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

const kinds: [PublicMeeting['kind'], string][] = [['baraza', 'Ward baraza'], ['budget_hearing', 'Budget hearing'], ['assembly_sitting', 'Assembly sitting'], ['town_hall', 'Town hall'], ['other', 'Other']];
const wardName = new Map(wards.map((w) => [w.id, w.name]));
type Draft = { id?: string; ward_id: string; kind: PublicMeeting['kind']; title: string; title_sw: string; agenda: string; venue: string; date: string; start: string; end: string; status: PublicMeeting['status']; outcome: string; attendance: string };
const blank: Draft = { ward_id: '', kind: 'baraza', title: '', title_sw: '', agenda: '', venue: '', date: '', start: '10:00', end: '12:00', status: 'scheduled', outcome: '', attendance: '' };
const eat = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`).toISOString();

/** Announce ward barazas, budget hearings and sittings; record the outcome afterwards. Residents see them at /meetings. */
export default function Meetings() {
  usePageTitle('Public meetings', 'CountyConnect');
  const { date } = useI18n();
  const qc = useQueryClient();
  const q = useMeetings();
  const [edit, setEdit] = useState<Draft | null>(null);
  const save = useMutation({
    mutationFn: (d: Draft) => saveMeeting({
      id: d.id, ward_id: d.ward_id || null, kind: d.kind, title: d.title.trim(), title_sw: d.title_sw.trim() || null, agenda: d.agenda.trim() || null,
      venue: d.venue.trim(), starts_at: eat(d.date, d.start), ends_at: eat(d.date, d.end), status: d.status,
      outcome: d.outcome.trim() || null, attendance: d.attendance ? Number(d.attendance) : null,
    }),
    onSuccess: () => { toast({ tone: 'good', title: 'Saved. Followers of the ward are told about new and cancelled meetings.' }); setEdit(null); void qc.invalidateQueries({ queryKey: ['meetings'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const open = (m: PublicMeeting) => {
    const nai = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString();
    setEdit({ id: m.id, ward_id: m.ward_id ?? '', kind: m.kind, title: m.title, title_sw: m.title_sw ?? '', agenda: m.agenda ?? '', venue: m.venue, date: nai(m.starts_at).slice(0, 10), start: nai(m.starts_at).slice(11, 16), end: nai(m.ends_at).slice(11, 16), status: m.status, outcome: m.outcome ?? '', attendance: m.attendance?.toString() ?? '' });
  };
  const valid = edit && edit.title.trim().length >= 5 && edit.venue.trim().length >= 2 && edit.date && edit.end > edit.start;
  const list = [...(q.data ?? [])].reverse();

  return (
    <>
      <PageHeader title="Public meetings" subtitle="Announce barazas, budget hearings and sittings. Residents see them on the Meetings page and ward followers are notified. After the meeting, record what was decided." actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit({ ...blank })}>New meeting</Button>} />
      <Panel title="Meetings">
        {list.length === 0 ? <Empty>No meetings yet.</Empty> : (
          <ul className="divide-y divide-line">
            {list.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => open(m)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-bg-2/60">
                  <span className="w-28 shrink-0 text-sm font-semibold">{date(m.starts_at, { dateStyle: 'medium', timeZone: 'Africa/Nairobi' })}</span>
                  <span className="min-w-0 flex-1 font-semibold">{m.title}</span>
                  <span className="text-sm text-muted">{m.ward_id ? wardName.get(m.ward_id) : 'County-wide'}</span>
                  <Chip tone={m.status === 'cancelled' ? 'bad' : m.status === 'held' ? 'good' : 'info'}>{m.status}</Chip>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Edit meeting' : 'New meeting'} className="sm:max-w-xl">
        {edit && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(edit); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kind">{({ id }) => <SelectInput id={id} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Draft['kind'] })}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput>}</Field>
              <Field label="Ward">{({ id }) => <SelectInput id={id} value={edit.ward_id} onChange={(e) => setEdit({ ...edit, ward_id: e.target.value })}><option value="">County-wide</option>{[...wards].sort((a, b) => a.name.localeCompare(b.name)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
            </div>
            <Field label="Title">{({ id }) => <TextInput id={id} value={edit.title} maxLength={160} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />}</Field>
            <Field label="Title in Kiswahili" optionalLabel="optional">{({ id }) => <TextInput id={id} value={edit.title_sw} maxLength={160} onChange={(e) => setEdit({ ...edit, title_sw: e.target.value })} />}</Field>
            <Field label="Venue">{({ id }) => <TextInput id={id} value={edit.venue} maxLength={200} onChange={(e) => setEdit({ ...edit, venue: e.target.value })} />}</Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Date">{({ id }) => <TextInput id={id} type="date" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} />}</Field>
              <Field label="Starts">{({ id }) => <TextInput id={id} type="time" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} />}</Field>
              <Field label="Ends">{({ id }) => <TextInput id={id} type="time" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} />}</Field>
            </div>
            <Field label="Agenda" optionalLabel="optional">{({ id }) => <TextArea id={id} className="min-h-20" value={edit.agenda} maxLength={2000} onChange={(e) => setEdit({ ...edit, agenda: e.target.value })} />}</Field>
            {edit.id && (
              <>
                <Field label="Status">{({ id }) => <SelectInput id={id} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Draft['status'] })}><option value="scheduled">Scheduled</option><option value="held">Held</option><option value="cancelled">Cancelled</option></SelectInput>}</Field>
                <Field label="What was decided (published)" optionalLabel="optional">{({ id }) => <TextArea id={id} className="min-h-24" value={edit.outcome} maxLength={4000} onChange={(e) => setEdit({ ...edit, outcome: e.target.value })} />}</Field>
                <Field label="Attendance" optionalLabel="optional">{({ id }) => <TextInput id={id} inputMode="numeric" value={edit.attendance} onChange={(e) => setEdit({ ...edit, attendance: e.target.value.replace(/\D/g, '') })} />}</Field>
              </>
            )}
            <Button type="submit" icon={<CalendarPlus className="size-4" aria-hidden />} loading={save.isPending} disabled={!valid}>Save meeting</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
