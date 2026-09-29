import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { Button } from '@/shared/ui/Button';
import { Chip, tenderTone } from '@/shared/ui/Chip';
import { Field, SelectInput, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { checkKra } from '../api/admin';
import { listContractors, listTenders, saveContractor, saveTender, type StaffTender } from '../api/content';
import { Empty, PageHeader, Panel, Table, td } from '../ui/Page';

const label: Record<string, string> = { draft: 'Draft', open: 'Open', evaluating: 'Being evaluated', awarded: 'Awarded', cancelled: 'Cancelled' };
const blank: StaffTender = { id: '', reference: '', title: '', ward_id: null, sector: '', status: 'draft', estimated_budget: 0, applicants_count: 0, awarded_contractor_id: null, published_at: null, closes_at: null };

export default function Tenders() {
  usePageTitle('Tenders', 'CountyConnect');
  const { kes, date } = useI18n();
  const qc = useQueryClient();
  const tenders = useQuery({ queryKey: ['c-tenders'], queryFn: listTenders });
  const contractors = useQuery({ queryKey: ['c-contractors'], queryFn: listContractors });
  const [edit, setEdit] = useState<StaffTender | null>(null);
  const [newC, setNewC] = useState({ name: '', pin: '' });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ['c-tenders'] }); void qc.invalidateQueries({ queryKey: ['c-contractors'] }); };
  const save = useMutation({ mutationFn: (t: StaffTender) => saveTender({ ...t, id: t.id || undefined }), onSuccess: () => { toast({ tone: 'good', title: 'Saved' }); setEdit(null); refresh(); }, onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }) });
  const addC = useMutation({ mutationFn: () => saveContractor(newC.name.trim(), newC.pin.trim().toUpperCase() || null), onSuccess: () => { setNewC({ name: '', pin: '' }); refresh(); } });
  const kra = useMutation({
    mutationFn: (c: { id: string; kra_pin: string }) => checkKra(c.kra_pin, c.id),
    onSuccess: (r) => {
      refresh();
      if (!r.pin_format_valid) toast({ tone: 'bad', title: 'That is not a valid KRA PIN', body: 'A PIN is a letter, nine digits and a letter.' });
      else if (r.source === 'format-only') toast({ tone: 'info', title: 'The PIN is well formed', body: 'The live check with KRA is not switched on for this county yet, so tax compliance is still unknown.' });
      else toast({ tone: r.status === 'compliant' ? 'good' : 'bad', title: r.status === 'compliant' ? 'Tax compliant' : 'Not tax compliant' });
    },
    onError: () => toast({ tone: 'bad', title: 'KRA could not be reached', body: 'Try again in a few minutes.' }),
  });
  const awardedTo = edit?.awarded_contractor_id ? contractors.data?.find((c) => c.id === edit.awarded_contractor_id) : undefined;

  return (
    <>
      <PageHeader title="Tenders" subtitle="Publish tenders and record awards. The public sees status, value and the winner, and contractors who win a lot are flagged for scrutiny." actions={<Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit({ ...blank })}>New tender</Button>} />
      <Panel pad={false}>
        {tenders.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : (tenders.data?.length ?? 0) === 0 ? <div className="p-5"><Empty>No tenders yet.</Empty></div> : (
          <Table head={['Reference', 'Tender', 'Value', 'Status', 'Closes', 'Awarded to', '']}>
            {tenders.data!.map((t) => (
              <tr key={t.id}>
                <td className={`${td} font-data text-[0.8rem]`}>{t.reference}</td>
                <td className={td}><span className="font-semibold">{t.title}</span><p className="text-muted">{t.sector}</p></td>
                <td className={`${td} font-data`}>{kes(t.estimated_budget, { compact: true })}</td>
                <td className={td}><Chip tone={tenderTone(t.status === 'draft' ? 'cancelled' : t.status)}>{label[t.status]}</Chip></td>
                <td className={td}>{t.closes_at ? date(t.closes_at) : '—'}</td>
                <td className={td}>{t.awarded_name ?? '—'}</td>
                <td className={`${td} text-right`}><Button size="sm" variant="ghost" onClick={() => setEdit({ ...t })}>Edit</Button></td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel className="mt-6" title="Contractors">
        <div className="grid gap-2 sm:grid-cols-[1fr_11rem_auto]">
          <TextInput aria-label="Contractor name" placeholder="Contractor name" value={newC.name} onChange={(e) => setNewC({ ...newC, name: e.target.value })} />
          <TextInput aria-label="KRA PIN" placeholder="KRA PIN" className="font-data uppercase" maxLength={11} value={newC.pin} onChange={(e) => setNewC({ ...newC, pin: e.target.value })} />
          <Button variant="secondary" icon={<Plus className="size-4" aria-hidden />} disabled={!newC.name.trim()} onClick={() => addC.mutate()}>Add</Button>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {contractors.data?.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2.5"><span className="font-semibold">{c.name}</span><span className="flex items-center gap-3 text-sm text-muted"><span className="font-data">{c.kra_pin ?? 'no PIN'}</span>{c.kra_compliant === true ? <Chip tone="good"><ShieldCheck className="size-3.5" aria-hidden />Tax compliant</Chip> : c.kra_compliant === false ? <Chip tone="bad"><ShieldAlert className="size-3.5" aria-hidden />Not compliant</Chip> : <Chip>Not checked</Chip>}{c.kra_pin && <Button size="sm" variant="ghost" loading={kra.isPending && kra.variables?.id === c.id} onClick={() => kra.mutate({ id: c.id, kra_pin: c.kra_pin! })}>Check</Button>}</span></li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Tax compliance is checked against KRA when a contractor is awarded a tender or applies for a permit.</p>
      </Panel>

      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Edit tender' : 'New tender'} className="sm:max-w-xl">
        {edit && (
          <div className="space-y-4">
            <Field label="Title">{({ id }) => <TextInput id={id} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sector">{({ id }) => <TextInput id={id} value={edit.sector} onChange={(e) => setEdit({ ...edit, sector: e.target.value })} />}</Field>
              <Field label="Ward" optionalLabel="Optional">{({ id }) => <SelectInput id={id} value={edit.ward_id ?? ''} onChange={(e) => setEdit({ ...edit, ward_id: e.target.value || null })}><option value="">County-wide</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
              <Field label="Estimated value (KES)">{({ id }) => <TextInput id={id} inputMode="numeric" value={edit.estimated_budget} onChange={(e) => setEdit({ ...edit, estimated_budget: Number(e.target.value.replace(/\D/g, '')) || 0 })} />}</Field>
              <Field label="Closes" optionalLabel="Optional">{({ id }) => <TextInput id={id} type="date" value={edit.closes_at?.slice(0, 10) ?? ''} onChange={(e) => setEdit({ ...edit, closes_at: e.target.value || null })} />}</Field>
              <Field label="Status">{({ id }) => <SelectInput id={id} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as StaffTender['status'] })}>{Object.entries(label).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</SelectInput>}</Field>
              {edit.status === 'awarded' && <Field label="Awarded to">{({ id }) => <SelectInput id={id} value={edit.awarded_contractor_id ?? ''} onChange={(e) => setEdit({ ...edit, awarded_contractor_id: e.target.value || null })}><option value="">Choose…</option>{contractors.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput>}</Field>}
            </div>
            {edit.status === 'awarded' && awardedTo?.kra_compliant === false && <p className="flex gap-2 rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />This contractor is not tax compliant with KRA. Awarding them may breach procurement rules.</p>}
            {edit.status === 'draft' && <p className="text-xs text-muted">Drafts are not shown to the public.</p>}
            <Button block size="lg" loading={save.isPending} disabled={!edit.title.trim() || edit.estimated_budget <= 0 || (edit.status === 'awarded' && !edit.awarded_contractor_id)} onClick={() => save.mutate(edit)}>Save tender</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
