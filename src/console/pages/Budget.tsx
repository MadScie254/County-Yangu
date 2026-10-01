import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextInput } from '@/shared/ui/Field';
import { toast } from '@/shared/ui/Toast';
import { draftNextRound } from '@/shared/api/loop';
import { deleteOption, listCycles, listOptions, saveCycle, saveOption } from '../api/content';
import { Empty, PageHeader, Panel } from '../ui/Page';

export default function Budget() {
  usePageTitle('Budget cycles', 'CountyConnect');
  const { kes, date } = useI18n();
  const qc = useQueryClient();
  const cycles = useQuery({ queryKey: ['c-cycles'], queryFn: listCycles });
  const [cycleId, setCycleId] = useState('');
  const [ward, setWard] = useState('');
  const [nc, setNc] = useState({ id: '', title: '' });
  const [opt, setOpt] = useState({ title: '', sector: '', amount: '', description: '' });
  const cycle = cycles.data?.find((c) => c.id === (cycleId || cycles.data?.[0]?.id));
  const options = useQuery({ queryKey: ['c-options', cycle?.id, ward], queryFn: () => listOptions(cycle!.id, ward), enabled: Boolean(cycle && ward) });
  const onErr = (e: unknown) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined });

  const setStatus = useMutation({ mutationFn: (v: { status?: 'draft' | 'open' | 'closed'; published_results?: boolean }) => saveCycle({ id: cycle!.id, title: cycle!.title, ...v }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['c-cycles'] }), onError: onErr });
  const draftNext = useMutation({
    mutationFn: draftNextRound,
    onSuccess: (id) => { toast({ tone: id ? 'good' : 'info', title: id ? `Drafted round ${id} with last round's ward envelopes. Add options, then open it.` : 'Next quarter already has a round.' }); void qc.invalidateQueries({ queryKey: ['c-cycles'] }); },
    onError: onErr,
  });
  const create = useMutation({ mutationFn: () => saveCycle({ id: nc.id.trim(), title: nc.title.trim() }), onSuccess: () => { setNc({ id: '', title: '' }); void qc.invalidateQueries({ queryKey: ['c-cycles'] }); }, onError: onErr });
  const addOpt = useMutation({ mutationFn: () => saveOption({ cycle_id: cycle!.id, ward_id: ward, title: opt.title.trim(), sector: opt.sector.trim() || 'General', description: opt.description.trim() || null, amount: Number(opt.amount.replace(/\D/g, '')) || 0 }), onSuccess: () => { setOpt({ title: '', sector: '', amount: '', description: '' }); void qc.invalidateQueries({ queryKey: ['c-options'] }); }, onError: onErr });
  const delOpt = useMutation({ mutationFn: deleteOption, onSuccess: () => void qc.invalidateQueries({ queryKey: ['c-options'] }), onError: onErr });

  return (
    <>
      <PageHeader title="Budget cycles" subtitle="Open a voting round, put forward the projects each ward can choose between, and publish the result." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title="Voting rounds">
          <ul className="space-y-2">
            {cycles.data?.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setCycleId(c.id)} className={`w-full rounded-2xl border p-4 text-left transition ${cycle?.id === c.id ? 'border-ink bg-brand-soft ring-2 ring-ink' : 'border-line hover:border-line-strong'}`}>
                  <div className="flex items-start justify-between gap-2"><span className="font-semibold">{c.title}</span><Chip tone={c.status === 'open' ? 'good' : c.status === 'closed' ? 'neutral' : 'warn'}>{c.status}</Chip></div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><CalendarClock className="size-3.5" aria-hidden />{date(c.starts_at)} to {date(c.ends_at)}</p>
                </button>
              </li>
            ))}
            {cycles.data?.length === 0 && <li><Empty>No rounds yet.</Empty></li>}
          </ul>
          {cycle && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {cycle.status !== 'open' && <Button size="sm" onClick={() => setStatus.mutate({ status: 'open' })}>Open voting</Button>}
              {cycle.status === 'open' && <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ status: 'closed' })}>Close voting</Button>}
              <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ published_results: !cycle.published_results })}>{cycle.published_results ? 'Unpublish results' : 'Publish results'}</Button>
            </div>
          )}
          <div className="mt-5 grid gap-2 border-t border-line pt-4">
            <p className="text-sm font-semibold">New round</p>
            <TextInput aria-label="Round id" placeholder="Short id, e.g. fy2027-28" value={nc.id} onChange={(e) => setNc({ ...nc, id: e.target.value })} />
            <TextInput aria-label="Round title" placeholder="Title" value={nc.title} onChange={(e) => setNc({ ...nc, title: e.target.value })} />
            <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} disabled={!nc.id.trim() || !nc.title.trim()} onClick={() => create.mutate()}>Create draft round</Button>
            <Button variant="ghost" icon={<CalendarClock className="size-4" aria-hidden />} loading={draftNext.isPending} onClick={() => draftNext.mutate()}>Schedule next quarter</Button>
            <p className="text-xs text-muted">Rounds open on their start date once they have options, and close on their end date. Publishing results stays a decision for a person.</p>
          </div>
        </Panel>

        <Panel title={cycle ? `Projects on the ballot · ${cycle.title}` : 'Projects on the ballot'}>
          <Field label="Ward">{({ id }) => <SelectInput id={id} value={ward} onChange={(e) => setWard(e.target.value)}><option value="">Choose a ward…</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
          {ward && cycle && (
            <>
              <ul className="mt-4 divide-y divide-line">
                {options.data?.map((o) => (
                  <li key={o.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-semibold">{o.title}</p><p className="text-sm text-muted">{o.sector} · {kes(o.amount, { compact: true })}</p></div><Button variant="ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => delOpt.mutate(o.id)}>Remove</Button></li>
                ))}
                {options.data?.length === 0 && <li className="py-3 text-sm text-muted">No projects on this ward’s ballot yet.</li>}
              </ul>
              <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
                <TextInput aria-label="Project title" placeholder="Project title" className="sm:col-span-2" value={opt.title} onChange={(e) => setOpt({ ...opt, title: e.target.value })} />
                <TextInput aria-label="Sector" placeholder="Sector" value={opt.sector} onChange={(e) => setOpt({ ...opt, sector: e.target.value })} />
                <TextInput aria-label="Cost (KES)" placeholder="Cost (KES)" inputMode="numeric" value={opt.amount} onChange={(e) => setOpt({ ...opt, amount: e.target.value })} />
                <TextInput aria-label="Description" placeholder="One line for residents" className="sm:col-span-2" value={opt.description} onChange={(e) => setOpt({ ...opt, description: e.target.value })} />
                <Button className="sm:col-span-2" icon={<Plus className="size-4" aria-hidden />} disabled={!opt.title.trim() || !opt.amount} loading={addOpt.isPending} onClick={() => addOpt.mutate()}>Add to ballot</Button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
