import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Send } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useNotices } from '@/shared/api/hooks';
import { saveNotice } from '@/shared/api/loop';
import type { ServiceNotice } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { toast } from '@/shared/ui/Toast';
import { Empty, PageHeader, Panel } from '../ui/Page';

const kinds: [ServiceNotice['kind'], string][] = [['water', 'Water'], ['power', 'Power and street lights'], ['road', 'Road closure or works'], ['waste', 'Garbage collection'], ['health', 'Health'], ['other', 'Other']];
const severities: [ServiceNotice['severity'], string][] = [['disruption', 'Disruption (SMS to instant subscribers)'], ['emergency', 'Emergency (SMS; county-wide reaches every instant subscriber)'], ['info', 'For information (no SMS)']];
const wardName = new Map(wards.map((w) => [w.id, w.name]));
type Draft = { id?: string; ward_id: string; kind: ServiceNotice['kind']; severity: ServiceNotice['severity']; title: string; title_sw: string; area: string; body: string; ends: string; status: ServiceNotice['status']; resolved_note: string };
const blank: Draft = { ward_id: '', kind: 'water', severity: 'disruption', title: '', title_sw: '', area: '', body: '', ends: '', status: 'active', resolved_note: '' };
const nai = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 16);

/** Post water cuts, road closures and similar for a ward, and mark them resolved. Residents see them at /notices. */
export default function Notices() {
  usePageTitle('Service notices', 'CountyConnect');
  const { relative } = useI18n();
  const qc = useQueryClient();
  const q = useNotices();
  const [edit, setEdit] = useState<Draft | null>(null);
  const save = useMutation({
    mutationFn: (d: Draft) => saveNotice({
      id: d.id, ward_id: d.ward_id || null, kind: d.kind, severity: d.severity, title: d.title.trim(), title_sw: d.title_sw.trim() || null,
      area: d.area.trim() || null, body: d.body.trim() || null, ends_at: d.ends ? new Date(`${d.ends}:00+03:00`).toISOString() : null,
      status: d.status, resolved_note: d.resolved_note.trim() || null,
    }),
    onSuccess: (_, d) => {
      toast({ tone: 'good', title: d.id ? 'Saved.' : 'Posted. Ward followers are told now, and SMS goes out for disruptions and emergencies.' });
      setEdit(null); void qc.invalidateQueries({ queryKey: ['notices'] });
    },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : 'You can post only for wards you manage.' }),
  });
  const open = (n: ServiceNotice) => setEdit({ id: n.id, ward_id: n.ward_id ?? '', kind: n.kind, severity: n.severity, title: n.title, title_sw: n.title_sw ?? '', area: n.area ?? '', body: n.body ?? '', ends: n.ends_at ? nai(n.ends_at) : '', status: n.status, resolved_note: n.resolved_note ?? '' });
  const valid = edit && edit.title.trim().length >= 5;
  const list = q.data ?? [];
  const active = list.filter((n) => n.status === 'active');
  const past = list.filter((n) => n.status !== 'active');
  const row = (n: ServiceNotice) => (
    <li key={n.id}>
      <button type="button" onClick={() => open(n)} className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-bg-2/60">
        <Chip tone={n.severity === 'emergency' ? 'bad' : n.severity === 'disruption' ? 'warn' : 'info'}>{n.severity}</Chip>
        <span className="min-w-0 flex-1 font-semibold">{n.title}</span>
        <span className="text-sm text-muted">{n.ward_id ? wardName.get(n.ward_id) : 'County-wide'}</span>
        <span className="w-28 text-right text-sm text-muted">{relative(n.status === 'active' ? n.starts_at : n.resolved_at ?? n.updated_at)}</span>
      </button>
    </li>
  );

  return (
    <>
      <PageHeader title="Service notices" subtitle="Tell residents about water cuts, road closures, power and collection changes before they have to ask. Mark it resolved when the service is back: followers hear that too." actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit({ ...blank })}>New notice</Button>} />
      <div className="space-y-6">
        <Panel title={`Active (${active.length})`}>{active.length === 0 ? <Empty>Nothing active.</Empty> : <ul className="divide-y divide-line">{active.map(row)}</ul>}</Panel>
        <Panel title="Recent">{past.length === 0 ? <Empty>Nothing resolved in the last 30 days.</Empty> : <ul className="divide-y divide-line">{past.map(row)}</ul>}</Panel>
      </div>

      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Update notice' : 'New notice'} className="sm:max-w-xl">
        {edit && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(edit); }}>
            {edit.id && edit.status === 'active' && (
              <div className="rounded-2xl bg-good-soft p-4">
                <Field label="What was done (sent to followers)" optionalLabel="optional">{({ id }) => <TextArea id={id} className="min-h-16" value={edit.resolved_note} maxLength={1000} onChange={(e) => setEdit({ ...edit, resolved_note: e.target.value })} />}</Field>
                <Button className="mt-3" type="button" variant="secondary" icon={<CheckCircle2 className="size-4" aria-hidden />} loading={save.isPending} onClick={() => save.mutate({ ...edit, status: 'resolved' })}>Mark back to normal</Button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="What">{({ id }) => <SelectInput id={id} value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as Draft['kind'] })}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput>}</Field>
              <Field label="Ward">{({ id }) => <SelectInput id={id} value={edit.ward_id} disabled={Boolean(edit.id)} onChange={(e) => setEdit({ ...edit, ward_id: e.target.value })}><option value="">County-wide</option>{[...wards].sort((a, b) => a.name.localeCompare(b.name)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
            </div>
            <Field label="How serious">{({ id }) => <SelectInput id={id} value={edit.severity} disabled={Boolean(edit.id)} onChange={(e) => setEdit({ ...edit, severity: e.target.value as Draft['severity'] })}>{severities.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</SelectInput>}</Field>
            <Field label="Headline">{({ id }) => <TextInput id={id} value={edit.title} maxLength={160} placeholder="No piped water while a main is repaired" onChange={(e) => setEdit({ ...edit, title: e.target.value })} />}</Field>
            <Field label="Headline in Kiswahili" optionalLabel="optional">{({ id }) => <TextInput id={id} value={edit.title_sw} maxLength={160} onChange={(e) => setEdit({ ...edit, title_sw: e.target.value })} />}</Field>
            <Field label="Estates, roads or landmarks affected" optionalLabel="optional">{({ id }) => <TextInput id={id} value={edit.area} maxLength={200} onChange={(e) => setEdit({ ...edit, area: e.target.value })} />}</Field>
            <Field label="Details and what residents can do" optionalLabel="optional">{({ id }) => <TextArea id={id} className="min-h-20" value={edit.body} maxLength={2000} placeholder="Water bowsers at the market from 8am" onChange={(e) => setEdit({ ...edit, body: e.target.value })} />}</Field>
            <Field label="Expected back (Nairobi time)" optionalLabel="optional">{({ id }) => <TextInput id={id} type="datetime-local" value={edit.ends} onChange={(e) => setEdit({ ...edit, ends: e.target.value })} />}</Field>
            {edit.id && edit.status === 'active' && <Button type="button" variant="ghost" onClick={() => save.mutate({ ...edit, status: 'cancelled' })}>Withdraw notice (posted by mistake)</Button>}
            <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={save.isPending} disabled={!valid}>{edit.id ? 'Save changes' : 'Post notice'}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
