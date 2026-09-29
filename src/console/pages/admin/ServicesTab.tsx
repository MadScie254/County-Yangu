import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import type { FormField, Service, ServiceCategory } from '@/shared/api/services-types';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { listAllServices, saveService, type ServiceInput, type ServiceRow } from '../../api/admin';
import { useDepartments } from '../../api/hooks';
import { Empty, Panel, Table, td } from '../../ui/Page';

const categories: ServiceCategory[] = ['permit', 'licence', 'rates', 'welfare', 'planning', 'health', 'other'];
const fieldTypes: FormField['type'][] = ['text', 'textarea', 'select', 'number', 'date', 'ward'];
const docKinds = ['id_copy', 'kra_pin_certificate', 'title_or_lease', 'architectural_drawings', 'logbook', 'admission_letter', 'fee_structure'];
const statusTone = { active: 'good', draft: 'neutral', suspended: 'warn' } as const;

type Draft = { key: string; type: FormField['type']; en: string; sw: string; required: boolean; options: string };

const toDraft = (f: FormField): Draft => ({ key: f.key, type: f.type, en: f.label.en, sw: f.label.sw ?? '', required: Boolean(f.required), options: (f.options ?? []).map((o) => `${o.value} | ${o.label.en}${o.label.sw ? ` | ${o.label.sw}` : ''}`).join('\n') });

function fromDraft(d: Draft): FormField {
  const f: FormField = { key: d.key.trim(), type: d.type, label: { en: d.en.trim(), ...(d.sw.trim() ? { sw: d.sw.trim() } : {}) }, required: d.required };
  if (d.type === 'select') {
    f.options = d.options.split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0] && p[1]).map((p) => ({ value: p[0]!, label: { en: p[1]!, ...(p[2] ? { sw: p[2] } : {}) } }));
  }
  return f;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

const blank: ServiceInput = { slug: '', name: '', name_sw: null, category: 'permit', description: '', fee: 0, fee_note: '', requires_kra_pin: false, form_schema: [], required_documents: [], sla_working_days: 14, status: 'draft', department_id: null };

/** Problems that would make the resident form broken; empty means it is safe to save. */
export function validateService(s: ServiceInput, fields: Draft[]): string | null {
  if (s.name.trim().length < 3) return 'Give the service a name.';
  if (!(s.fee >= 0)) return 'The fee cannot be negative.';
  if (!Number.isInteger(s.fee)) return 'Fees are in whole shillings (M-Pesa does not take cents).';
  if (!(s.sla_working_days >= 1)) return 'Set how many working days a decision should take.';
  const keys = new Set<string>();
  for (const f of fields) {
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(f.key.trim())) return `“${f.key || 'a field'}” needs a key of lowercase letters, digits and underscores (for example plot_number).`;
    if (keys.has(f.key.trim())) return `Two fields share the key “${f.key}”.`;
    keys.add(f.key.trim());
    if (!f.en.trim()) return `Field “${f.key}” needs a label.`;
    if (f.type === 'select' && fromDraft(f).options!.length === 0) return `Field “${f.key}” needs at least one choice (one per line: value | English | Kiswahili).`;
  }
  return null;
}

export function ServicesTab() {
  const { kes } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['c-services'], queryFn: listAllServices });
  const depts = useDepartments();
  const [edit, setEdit] = useState<ServiceInput | null>(null);
  const [fields, setFields] = useState<Draft[]>([]);
  const deptName = useMemo(() => new Map((depts.data ?? []).map((d) => [d.id, d.name])), [depts.data]);
  const error = edit ? validateService(edit, fields) : null;

  const open = (s: ServiceRow | null) => {
    const base: ServiceInput = s ? { ...s } : { ...blank };
    setEdit(base);
    setFields((s?.form_schema ?? []).map(toDraft));
  };
  const save = useMutation({
    mutationFn: () => saveService({ ...edit!, slug: edit!.slug || slugify(edit!.name), description: edit!.description?.trim() || null, fee_note: edit!.fee_note?.trim() || null, name_sw: edit!.name_sw?.trim() || null, form_schema: fields.map(fromDraft) }),
    onSuccess: () => { toast({ tone: 'good', title: 'Saved' }); setEdit(null); void qc.invalidateQueries({ queryKey: ['c-services'] }); },
    onError: (e) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined }),
  });
  const setField = (i: number, patch: Partial<Draft>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <Panel pad={false} title="Service catalogue" action={<Button size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => open(null)}>New service</Button>}>
      <p className="border-b border-line px-5 py-3 text-sm text-muted">What residents can apply for under My Services. The fee is fixed here and copied to every application by the database, so an applicant can never change it. Only active services are shown to residents.</p>
      {q.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : (q.data?.length ?? 0) === 0 ? <div className="p-5"><Empty>No services yet.</Empty></div> : (
        <Table head={['Service', 'Department', 'Fee', 'Decision in', 'Status', '']}>
          {q.data!.map((s) => (
            <tr key={s.id}>
              <td className={td}><span className="font-semibold">{s.name}</span><p className="text-muted capitalize">{s.category}{s.requires_kra_pin ? ' · KRA PIN needed' : ''}</p></td>
              <td className={td}>{s.department_id ? deptName.get(s.department_id) ?? '—' : '—'}</td>
              <td className={`${td} font-data`}>{s.fee > 0 ? kes(s.fee) : 'Free / assessed'}</td>
              <td className={td}>{s.sla_working_days} working days</td>
              <td className={td}><Chip tone={statusTone[s.status]}>{s.status}</Chip></td>
              <td className={`${td} text-right`}><Button size="sm" variant="ghost" onClick={() => open(s)}>Edit</Button></td>
            </tr>
          ))}
        </Table>
      )}

      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.id ? 'Edit service' : 'New service'} className="sm:max-w-2xl">
        {edit && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name (English)">{({ id }) => <TextInput id={id} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />}</Field>
              <Field label="Name (Kiswahili)" optionalLabel="Optional">{({ id }) => <TextInput id={id} value={edit.name_sw ?? ''} onChange={(e) => setEdit({ ...edit, name_sw: e.target.value })} />}</Field>
              <Field label="Kind">{({ id }) => <SelectInput id={id} value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value as ServiceCategory })}>{categories.map((c) => <option key={c}>{c}</option>)}</SelectInput>}</Field>
              <Field label="Department that decides">{({ id }) => <SelectInput id={id} value={edit.department_id ?? ''} onChange={(e) => setEdit({ ...edit, department_id: e.target.value || null })}><option value="">Choose…</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</SelectInput>}</Field>
              <Field label="Fee (KES)" hint="0 if the amount is assessed case by case.">{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} inputMode="numeric" value={edit.fee} onChange={(e) => setEdit({ ...edit, fee: Number(e.target.value.replace(/\D/g, '')) || 0 })} />}</Field>
              <Field label="Decision within (working days)">{({ id }) => <TextInput id={id} inputMode="numeric" value={edit.sla_working_days} onChange={(e) => setEdit({ ...edit, sla_working_days: Number(e.target.value.replace(/\D/g, '')) || 0 })} />}</Field>
              <Field label="Status">{({ id }) => <SelectInput id={id} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Service['status'] })}><option value="draft">Draft (hidden)</option><option value="active">Active (shown to residents)</option><option value="suspended">Suspended</option></SelectInput>}</Field>
              <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[var(--ink)]" checked={edit.requires_kra_pin} onChange={(e) => setEdit({ ...edit, requires_kra_pin: e.target.checked })} />Applicant must give a KRA PIN</label>
            </div>
            <Field label="Description" optionalLabel="Optional">{({ id }) => <TextArea id={id} rows={2} value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />}</Field>
            <Field label="Note about the fee" optionalLabel="Optional">{({ id }) => <TextInput id={id} value={edit.fee_note ?? ''} onChange={(e) => setEdit({ ...edit, fee_note: e.target.value })} />}</Field>

            <fieldset>
              <legend className="text-sm font-semibold">Documents the applicant uploads</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {docKinds.map((k) => {
                  const on = edit.required_documents.includes(k);
                  return <label key={k} className={`tap inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-medium ${on ? 'border-ink bg-brand-soft' : 'border-line'}`}><input type="checkbox" className="size-4 accent-[var(--ink)]" checked={on} onChange={() => setEdit({ ...edit, required_documents: on ? edit.required_documents.filter((x) => x !== k) : [...edit.required_documents, k] })} />{k.replace(/_/g, ' ')}</label>;
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold">Questions on the form</legend>
              <ul className="mt-2 space-y-3">
                {fields.map((f, i) => (
                  <li key={i} className="rounded-2xl border border-line p-3">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_9rem_auto]">
                      <TextInput aria-label="Key" placeholder="key, e.g. plot_number" className="font-data" value={f.key} onChange={(e) => setField(i, { key: e.target.value })} />
                      <TextInput aria-label="Label in English" placeholder="Question (English)" value={f.en} onChange={(e) => setField(i, { en: e.target.value })} />
                      <SelectInput aria-label="Answer type" value={f.type} onChange={(e) => setField(i, { type: e.target.value as FormField['type'] })}>{fieldTypes.map((t) => <option key={t}>{t}</option>)}</SelectInput>
                      <Button variant="ghost" size="sm" aria-label="Remove question" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setFields((fs) => fs.filter((_, j) => j !== i))} />
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <TextInput aria-label="Label in Kiswahili" placeholder="Swali (Kiswahili, optional)" value={f.sw} onChange={(e) => setField(i, { sw: e.target.value })} />
                      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[var(--ink)]" checked={f.required} onChange={(e) => setField(i, { required: e.target.checked })} />Required</label>
                    </div>
                    {f.type === 'select' && <TextArea aria-label="Choices" rows={3} className="mt-2 font-data text-sm" placeholder={'One choice per line:\nshop | Shop or office | Duka au ofisi'} value={f.options} onChange={(e) => setField(i, { options: e.target.value })} />}
                  </li>
                ))}
              </ul>
              <Button className="mt-3" variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setFields((fs) => [...fs, { key: '', type: 'text', en: '', sw: '', required: false, options: '' }])}>Add a question</Button>
            </fieldset>

            {error && <p role="alert" className="rounded-xl bg-bad-soft p-3 text-sm font-semibold text-bad">{error}</p>}
            <Button block size="lg" loading={save.isPending} disabled={Boolean(error)} onClick={() => save.mutate()}>Save service</Button>
          </div>
        )}
      </Sheet>
    </Panel>
  );
}
