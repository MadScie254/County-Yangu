import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { subCounties, wards } from '@/shared/config/county';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput, TextInput } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { addHoliday, deleteHoliday, findUser, grantRole, revokeRole, saveCategory, saveRoutingRule, deleteRoutingRule } from '../api/ops';
import { nameMaps, useCategories, useDepartments, useDirectory, useHolidays, useRoles, useRules } from '../api/hooks';
import { roleLabel, useCan } from '../lib/perm';
import type { Category } from '../api/types';
import { Empty, PageHeader, Panel, Table, td } from '../ui/Page';
import { AiTab } from './admin/AiTab';
import { ServicesTab } from './admin/ServicesTab';
import { SettingsTab } from './admin/SettingsTab';
import { InviteAuditor } from './admin/InviteAuditor';
import type { StaffRoleName } from '@/shared/state/auth';

const tabs = [['people', 'People & roles'], ['services', 'Services'], ['categories', 'Categories & timers'], ['routing', 'Routing'], ['holidays', 'Holidays'], ['ai', 'AI spending'], ['settings', 'Settings']] as const;
type Tab = (typeof tabs)[number][0];
const roleNames = Object.keys(roleLabel) as StaffRoleName[];
const onErr = (e: unknown) => toast({ tone: 'bad', title: 'That did not work', body: e instanceof Error ? e.message : undefined });

function People() {
  const qc = useQueryClient();
  const can = useCan();
  const roles = useRoles();
  const depts = useDepartments();
  const maps = nameMaps(depts.data);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', role: 'officer' as StaffRoleName, department_id: '', sub_county_id: '', ward_id: '', days: '' });

  const grant = useMutation({
    mutationFn: async () => {
      const u = await findUser(form.email.trim());
      if (!u) throw new Error('No account with that email. Ask the person to create one first (they can do it under My Services).');
      await grantRole({ user_id: u.id, role: form.role, department_id: form.department_id || null, sub_county_id: form.sub_county_id || null, ward_id: form.ward_id || null, expires_at: form.days ? new Date(Date.now() + Number(form.days) * 86_400_000).toISOString() : null, name: u.name, email: u.email });
    },
    onSuccess: () => { toast({ tone: 'good', title: 'Role granted' }); setOpen(false); void qc.invalidateQueries({ queryKey: ['c-roles'] }); void qc.invalidateQueries({ queryKey: ['c-dir'] }); },
    onError: onErr,
  });
  const revoke = useMutation({ mutationFn: revokeRole, onSuccess: () => { toast({ tone: 'good', title: 'Role removed' }); void qc.invalidateQueries({ queryKey: ['c-roles'] }); }, onError: onErr });

  const needsDept = form.role === 'chief_officer' || form.role === 'officer';
  const needsSub = form.role === 'sub_county_admin';
  const needsWard = form.role === 'ward_admin';
  const valid = form.email.includes('@') && (!needsDept || form.department_id) && (!needsSub || form.sub_county_id) && (!needsWard || form.ward_id);
  const superOnly = form.role === 'admin' || form.role === 'super_admin';

  return (
    <Panel pad={false} title="People & roles" action={<div className="flex gap-2"><InviteAuditor /><Button size="sm" icon={<UserPlus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>Grant a role</Button></div>}>
      {roles.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : (roles.data?.length ?? 0) === 0 ? <div className="p-5"><Empty>No roles yet.</Empty></div> : (
        <Table head={['Person', 'Role', 'Scope', 'Access', '']}>
          {roles.data!.map((r) => (
            <tr key={r.id}>
              <td className={td}><span className="font-semibold">{r.name || 'Staff'}</span><p className="text-muted">{r.email}</p></td>
              <td className={td}>{roleLabel[r.role as StaffRoleName] ?? r.role}</td>
              <td className={td}>{r.department_id ? maps.dept.get(r.department_id) : r.sub_county_id ? subCounties.find((s) => s.id === r.sub_county_id)?.name : r.ward_id ? wards.find((w) => w.id === r.ward_id)?.name : 'County-wide'}</td>
              <td className={td}>{r.active ? <Chip tone="good">Active</Chip> : <Chip>Removed</Chip>}{r.expires_at && <p className="mt-1 text-xs text-muted">until {new Date(r.expires_at).toLocaleDateString()}</p>}</td>
              <td className={cn(td, 'text-right')}>{r.active && <Button variant="ghost" size="sm" icon={<UserMinus className="size-4" aria-hidden />} onClick={() => revoke.mutate(r.id)}>Remove</Button>}</td>
            </tr>
          ))}
        </Table>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Grant a role">
        <div className="space-y-4">
          <Field label="Email of an existing account">{({ id }) => <TextInput id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
          <Field label="Role">{({ id }) => <SelectInput id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as StaffRoleName })}>{roleNames.filter((n) => can.has('super_admin') || (n !== 'admin' && n !== 'super_admin')).map((n) => <option key={n} value={n}>{roleLabel[n]}</option>)}</SelectInput>}</Field>
          {needsDept && <Field label="Department">{({ id }) => <SelectInput id={id} value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}><option value="">Choose…</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</SelectInput>}</Field>}
          {needsSub && <Field label="Sub-county">{({ id }) => <SelectInput id={id} value={form.sub_county_id} onChange={(e) => setForm({ ...form, sub_county_id: e.target.value })}><option value="">Choose…</option>{subCounties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</SelectInput>}</Field>}
          {needsWard && <Field label="Ward">{({ id }) => <SelectInput id={id} value={form.ward_id} onChange={(e) => setForm({ ...form, ward_id: e.target.value })}><option value="">Choose…</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>}
          <Field label="Expires after (days)" optionalLabel="Optional" hint="Use for auditors and temporary cover.">{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} inputMode="numeric" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value.replace(/\D/g, '') })} />}</Field>
          {superOnly && <p className="rounded-xl bg-warn-soft p-3 text-sm font-medium text-warn">Only a super admin can grant this role.</p>}
          <Button block size="lg" loading={grant.isPending} disabled={!valid} onClick={() => grant.mutate()}>Grant role</Button>
        </div>
      </Sheet>
    </Panel>
  );
}

function Categories() {
  const qc = useQueryClient();
  const cats = useCategories();
  const depts = useDepartments();
  const save = useMutation({ mutationFn: saveCategory, onSuccess: () => { toast({ tone: 'good', title: 'Saved' }); void qc.invalidateQueries({ queryKey: ['c-cats'] }); }, onError: onErr });
  const [edit, setEdit] = useState<Category | null>(null);
  return (
    <Panel pad={false} title="Categories & timers" action={<span className="text-sm text-muted">Every report gets two timers: time to acknowledge and time to fix.</span>}>
      {cats.isLoading ? <div className="p-5"><Skeleton className="h-40" /></div> : (
        <Table head={['Category', 'Department', 'Acknowledge within', 'Fix within', 'Priority', 'Integrity', '']}>
          {cats.data!.map((c) => (
            <tr key={c.id} className={cn(!c.active && 'opacity-50')}>
              <td className={cn(td, 'font-semibold')}>{c.name}</td>
              <td className={td}>{depts.data?.find((d) => d.id === c.department_id)?.name ?? '—'}</td>
              <td className={td}>{c.ack_value} {c.ack_unit === 'hours' ? 'hours' : 'working days'}</td>
              <td className={td}>{c.resolve_value} {c.resolve_unit === 'hours' ? 'hours' : 'working days'}</td>
              <td className={td}><Chip tone={c.default_priority === 'urgent' ? 'bad' : c.default_priority === 'high' ? 'warn' : 'neutral'}>{c.default_priority}</Chip></td>
              <td className={td}>{c.sensitive ? <Chip tone="bad">routed around dept</Chip> : '—'}</td>
              <td className={cn(td, 'text-right')}><Button size="sm" variant="ghost" onClick={() => setEdit({ ...c })}>Edit</Button></td>
            </tr>
          ))}
        </Table>
      )}
      <Sheet open={Boolean(edit)} onClose={() => setEdit(null)} title={edit?.name ?? 'Category'}>
        {edit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Acknowledge within">{({ id }) => <TextInput id={id} inputMode="numeric" value={edit.ack_value} onChange={(e) => setEdit({ ...edit, ack_value: Number(e.target.value.replace(/\D/g, '')) || 0 })} />}</Field>
              <Field label="Unit">{({ id }) => <SelectInput id={id} value={edit.ack_unit} onChange={(e) => setEdit({ ...edit, ack_unit: e.target.value as Category['ack_unit'] })}><option value="hours">hours</option><option value="working_days">working days</option></SelectInput>}</Field>
              <Field label="Fix within">{({ id }) => <TextInput id={id} inputMode="numeric" value={edit.resolve_value} onChange={(e) => setEdit({ ...edit, resolve_value: Number(e.target.value.replace(/\D/g, '')) || 0 })} />}</Field>
              <Field label="Unit">{({ id }) => <SelectInput id={id} value={edit.resolve_unit} onChange={(e) => setEdit({ ...edit, resolve_unit: e.target.value as Category['resolve_unit'] })}><option value="hours">hours</option><option value="working_days">working days</option></SelectInput>}</Field>
            </div>
            <Field label="Default priority">{({ id }) => <SelectInput id={id} value={edit.default_priority} onChange={(e) => setEdit({ ...edit, default_priority: e.target.value as Category['default_priority'] })}>{['low', 'normal', 'high', 'urgent'].map((p) => <option key={p}>{p}</option>)}</SelectInput>}</Field>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[var(--ink)]" checked={edit.sensitive} onChange={(e) => setEdit({ ...edit, sensitive: e.target.checked })} />Integrity category: route around the department it concerns</label>
            <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4 accent-[var(--ink)]" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Offered to residents</label>
            <Button block size="lg" loading={save.isPending} onClick={() => { save.mutate(edit); setEdit(null); }}>Save</Button>
          </div>
        )}
      </Sheet>
    </Panel>
  );
}

function Routing() {
  const qc = useQueryClient();
  const rules = useRules();
  const cats = useCategories();
  const depts = useDepartments();
  const staff = useDirectory();
  const maps = nameMaps(depts.data, cats.data, staff.data);
  const [f, setF] = useState({ category_id: '', ward_id: '', department_id: '', officer_id: '' });
  const add = useMutation({ mutationFn: () => saveRoutingRule({ category_id: f.category_id, ward_id: f.ward_id || null, department_id: f.department_id, officer_id: f.officer_id || null }), onSuccess: () => { toast({ tone: 'good', title: 'Rule saved' }); void qc.invalidateQueries({ queryKey: ['c-rules'] }); }, onError: onErr });
  const del = useMutation({ mutationFn: deleteRoutingRule, onSuccess: () => void qc.invalidateQueries({ queryKey: ['c-rules'] }), onError: onErr });
  return (
    <Panel pad={false} title="Routing matrix">
      <p className="border-b border-line px-5 py-3 text-sm text-muted">A new report goes to the most specific matching rule: a ward-specific rule beats a county-wide one. Name an officer to assign it automatically.</p>
      <div className="grid gap-3 border-b border-line p-5 md:grid-cols-5">
        <SelectInput aria-label="Category" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}><option value="">Category…</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</SelectInput>
        <SelectInput aria-label="Ward" value={f.ward_id} onChange={(e) => setF({ ...f, ward_id: e.target.value })}><option value="">Whole county</option>{wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>
        <SelectInput aria-label="Department" value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })}><option value="">Department…</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</SelectInput>
        <SelectInput aria-label="Officer" value={f.officer_id} onChange={(e) => setF({ ...f, officer_id: e.target.value })}><option value="">No named officer</option>{staff.data?.filter((s) => s.role === 'officer').map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}</SelectInput>
        <Button icon={<Plus className="size-4" aria-hidden />} disabled={!f.category_id || !f.department_id} loading={add.isPending} onClick={() => add.mutate()}>Add rule</Button>
      </div>
      <Table head={['Category', 'Where', 'Department', 'Officer', '']}>
        {(rules.data ?? []).sort((a, b) => (maps.cat.get(a.category_id) ?? '').localeCompare(maps.cat.get(b.category_id) ?? '')).map((r) => (
          <tr key={r.id}><td className={cn(td, 'font-semibold')}>{maps.cat.get(r.category_id)}</td><td className={td}>{r.ward_id ? wards.find((w) => w.id === r.ward_id)?.name : 'Whole county'}</td><td className={td}>{maps.dept.get(r.department_id)}</td><td className={td}>{r.officer_id ? maps.staff.get(r.officer_id) : '—'}</td><td className={cn(td, 'text-right')}><Button size="sm" variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => del.mutate(r.id)}>Delete</Button></td></tr>
        ))}
      </Table>
    </Panel>
  );
}

function Holidays() {
  const { date } = useI18n();
  const qc = useQueryClient();
  const hol = useHolidays();
  const [day, setDay] = useState('');
  const [name, setName] = useState('');
  const add = useMutation({ mutationFn: () => addHoliday({ day, name }), onSuccess: () => { setDay(''); setName(''); void qc.invalidateQueries({ queryKey: ['c-holidays'] }); }, onError: onErr });
  const del = useMutation({ mutationFn: deleteHoliday, onSuccess: () => void qc.invalidateQueries({ queryKey: ['c-holidays'] }), onError: onErr });
  return (
    <Panel pad={false} title="Public holidays">
      <p className="border-b border-line px-5 py-3 text-sm text-muted">Working-day timers skip weekends and these dates. Add movable holidays (such as Idd-ul-Fitr) and any day gazetted by the Cabinet Secretary.</p>
      <div className="grid gap-3 border-b border-line p-5 sm:grid-cols-[10rem_1fr_auto]">
        <TextInput aria-label="Date" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        <TextInput aria-label="Name" placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button icon={<Plus className="size-4" aria-hidden />} disabled={!day || !name.trim()} loading={add.isPending} onClick={() => add.mutate()}>Add</Button>
      </div>
      <Table head={['Date', 'Holiday', '']}>
        {(hol.data ?? []).map((h) => <tr key={h.day}><td className={cn(td, 'font-data')}>{date(h.day, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td><td className={td}>{h.name}</td><td className={cn(td, 'text-right')}><Button size="sm" variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => del.mutate(h.day)}>Delete</Button></td></tr>)}
      </Table>
    </Panel>
  );
}

export default function Admin() {
  usePageTitle('Administration', 'CountyConnect');
  const [tab, setTab] = useState<Tab>('people');
  return (
    <>
      <PageHeader title="Administration" subtitle="Who can do what, how reports are routed, and how fast each kind must be answered." />
      <div role="tablist" aria-label="Administration" className="mb-5 flex flex-wrap gap-1.5">
        {tabs.map(([id, t]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('tap rounded-full border px-4 text-sm font-semibold', tab === id ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-line-strong')}>{t}</button>)}
      </div>
      {tab === 'people' && <People />}
      {tab === 'categories' && <Categories />}
      {tab === 'routing' && <Routing />}
      {tab === 'holidays' && <Holidays />}
      {tab === 'services' && <ServicesTab />}
      {tab === 'ai' && <AiTab />}
      {tab === 'settings' && <SettingsTab />}
    </>
  );
}
