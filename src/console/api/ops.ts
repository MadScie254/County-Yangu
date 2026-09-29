// Staff console data access. Live mode calls Supabase as the signed-in staff member: every read and
// write is decided by row-level security and the case_* / decide_* functions, never by this file.
// Demo mode (no backend) uses the localStorage dataset in ./demo.
import { supabase } from '@/shared/api/client';
import { dataSource } from '@/shared/api/public';
import { uuid } from '@/shared/lib/utils';
import { wardById } from '@/shared/config/county';
import { audit, db, demoCategories, demoDepts, demoRules, demoStaff, levelFor, save } from './demo';
import type { AuditRow, CaseEvent, CaseRow, CaseStatus, Category, Dept, OverdueRow, ReviewApp, RoleGrant, RoutingRule, StaffMember } from './types';

const live = async () => (await dataSource()) === 'live' && Boolean(supabase);
const fail = (e: unknown): never => {
  throw e instanceof Error ? e : new Error((e as { message?: string })?.message ?? 'Request failed');
};

// ---- reference ------------------------------------------------------------------------------------------

export async function getDepartments(): Promise<Dept[]> {
  if (!(await live())) return demoDepts;
  const { data, error } = await supabase!.from('departments').select('id, code, name').order('name');
  if (error) fail(error);
  return (data ?? []) as Dept[];
}

export async function getCategories(): Promise<Category[]> {
  if (!(await live())) return demoCategories;
  const { data, error } = await supabase!.from('report_categories').select('*').order('sort');
  if (error) fail(error);
  return (data ?? []) as Category[];
}

export async function getDirectory(): Promise<StaffMember[]> {
  if (!(await live())) return demoStaff;
  const { data, error } = await supabase!.rpc('staff_directory');
  if (error) fail(error);
  return (data ?? []) as StaffMember[];
}

export async function getRoutingRules(): Promise<RoutingRule[]> {
  if (!(await live())) return demoRules();
  const { data, error } = await supabase!.from('routing_rules').select('*');
  if (error) fail(error);
  return (data ?? []) as RoutingRule[];
}

// ---- cases ------------------------------------------------------------------------------------------------

export async function listCases(): Promise<CaseRow[]> {
  if (!(await live())) return db().cases.map((c) => ({ ...c, escalation_level: levelFor(c) }));
  const { data, error } = await supabase!.from('reports').select('*').order('resolve_due_at', { ascending: true, nullsFirst: false }).limit(1000);
  if (error) fail(error);
  return (data ?? []) as CaseRow[];
}

export async function getCase(id: string): Promise<{ row: CaseRow; events: CaseEvent[]; photos: string[] } | null> {
  if (!(await live())) {
    const row = db().cases.find((c) => c.id === id);
    return row ? { row, events: db().events[id] ?? [], photos: [] } : null;
  }
  const { data: row, error } = await supabase!.from('reports').select('*').eq('id', id).maybeSingle();
  if (error) fail(error);
  if (!row) return null;
  const [ev, ph] = await Promise.all([
    supabase!.from('report_events').select('*').eq('report_id', id).order('created_at', { ascending: true }),
    supabase!.from('report_photos').select('storage_path').eq('report_id', id),
  ]);
  const paths = ((ph.data ?? []) as { storage_path: string }[]).map((p) => p.storage_path);
  const signed = paths.length ? await supabase!.storage.from('report-photos').createSignedUrls(paths, 3600) : { data: [] as { signedUrl: string }[] };
  const photos = (signed.data ?? []).map((s) => s.signedUrl).filter((u): u is string => Boolean(u));
  return { row: row as CaseRow, events: (ev.data ?? []) as CaseEvent[], photos };
}

function demoEvent(caseId: string, e: Omit<CaseEvent, 'id' | 'created_at' | 'data'> & { data?: Record<string, unknown> }) {
  const d = db();
  (d.events[caseId] ??= []).push({ id: uuid(), created_at: new Date().toISOString(), data: {}, ...e });
}

export async function assignCase(id: string, officerId: string, departmentId?: string | null): Promise<void> {
  if (!(await live())) {
    const c = db().cases.find((x) => x.id === id);
    if (!c) return;
    c.assigned_to = officerId;
    if (departmentId) c.department_id = departmentId;
    if (c.status === 'received' || c.status === 'triaged') c.status = 'assigned';
    c.updated_at = new Date().toISOString();
    demoEvent(id, { kind: 'assigned', actor_id: 'u-demo', is_public: false, message: null, data: { assigned_to: officerId } });
    audit('reports', id, 'UPDATE');
    return save();
  }
  const { error } = await supabase!.rpc('case_assign', { p_report: id, p_officer: officerId, p_department: departmentId ?? null });
  if (error) fail(error);
}

export async function transitionCase(id: string, status: Exclude<CaseStatus, 'received'>, message: string | null, isPublic: boolean): Promise<void> {
  if (!(await live())) {
    const c = db().cases.find((x) => x.id === id);
    if (!c) return;
    c.status = status;
    c.acknowledged_at ??= new Date().toISOString();
    if (status === 'resolved' || status === 'closed') c.resolved_at ??= new Date().toISOString();
    c.updated_at = new Date().toISOString();
    demoEvent(id, { kind: 'status', actor_id: 'u-demo', is_public: isPublic, message, data: { status } });
    audit('reports', id, 'UPDATE');
    return save();
  }
  const { error } = await supabase!.rpc('case_transition', { p_report: id, p_status: status, p_message: message, p_public: isPublic });
  if (error) fail(error);
}

export async function noteCase(id: string, message: string): Promise<void> {
  if (!(await live())) {
    demoEvent(id, { kind: 'note', actor_id: 'u-demo', is_public: false, message });
    return save();
  }
  const { error } = await supabase!.rpc('case_note', { p_report: id, p_message: message });
  if (error) fail(error);
}

// ---- applications ---------------------------------------------------------------------------------------------

export async function listReviewApps(): Promise<ReviewApp[]> {
  if (!(await live())) return db().reviews;
  const { data, error } = await supabase!.rpc('review_queue');
  if (error) fail(error);
  return (data ?? []) as ReviewApp[];
}

export async function decideApp(id: string, decision: 'approved' | 'rejected' | 'changes_requested' | 'under_review', note: string | null): Promise<void> {
  if (!(await live())) {
    const a = db().reviews.find((x) => x.id === id);
    if (!a) return;
    a.status = decision;
    if (note) a.decision_note = note;
    audit('applications', id, 'UPDATE');
    return save();
  }
  const { error } = await supabase!.rpc('decide_application', { p_application: id, p_decision: decision, p_note: note });
  if (error) fail(error);
}

// ---- oversight ------------------------------------------------------------------------------------------------------

export async function getOverdue(named: boolean): Promise<OverdueRow[]> {
  if (!(await live())) {
    const cats = new Map(demoCategories.map((c) => [c.id, c.name]));
    const depts = new Map(demoDepts.map((d) => [d.id, d.name]));
    const staff = new Map(demoStaff.map((s) => [s.user_id, s.name]));
    return db()
      .cases.filter((c) => (c.status === 'received' || c.status === 'triaged' || c.status === 'assigned' || c.status === 'in_progress') && c.resolve_due_at && new Date(c.resolve_due_at) < new Date())
      .map((c) => ({ reference: c.reference, ward: wardById.get(c.ward_id)?.name ?? c.ward_id, category: cats.get(c.category_id ?? '') ?? '', department: depts.get(c.department_id ?? '') ?? '', days_overdue: Math.max(0, Math.floor((Date.now() - new Date(c.resolve_due_at!).getTime()) / 86_400_000)), escalation_level: levelFor(c), flagged_financial: c.flagged_financial, officer: named ? (staff.get(c.assigned_to ?? '') ?? null) : null, created_at: c.created_at }))
      .sort((a, b) => b.days_overdue - a.days_overdue);
  }
  const { data, error } = await supabase!.rpc('oversight_overdue');
  if (error) fail(error);
  return (data ?? []) as OverdueRow[];
}

export type Digest = { id: string; kind: string; period_start: string; period_end: string; body_md: string; created_at: string };

export async function getDigests(): Promise<Digest[]> {
  if (!(await live())) {
    const end = new Date();
    const mk = (kind: string, monthsAgo: number): Digest => {
      const s = new Date(end.getFullYear(), end.getMonth() - monthsAgo - 1, 1);
      const e = new Date(end.getFullYear(), end.getMonth() - monthsAgo, 0);
      return { id: `dg-${kind}-${monthsAgo}`, kind, period_start: s.toISOString().slice(0, 10), period_end: e.toISOString().slice(0, 10), created_at: e.toISOString(), body_md: `Monthly ${kind.replace(/_/g, ' ')} digest.\n\nEvery case that is more than 30 days overdue, and every case flagged as financial, stays on this digest until it is closed.` };
    };
    return [mk('assembly', 0), mk('controller_of_budget', 0), mk('auditor_general', 0), mk('assembly', 1)];
  }
  const { data, error } = await supabase!.from('digests').select('id, kind, period_start, period_end, body_md, created_at').order('created_at', { ascending: false }).limit(50);
  if (error) fail(error);
  return (data ?? []) as Digest[];
}

export async function getAudit(): Promise<AuditRow[]> {
  if (!(await live())) return db().audit.slice(0, 200);
  const { data, error } = await supabase!.from('audit_log').select('id, at, actor_id, via, action, entity, entity_id').order('id', { ascending: false }).limit(200);
  if (error) fail(error);
  return (data ?? []) as AuditRow[];
}

// ---- admin: roles, categories, routing --------------------------------------------------------------------------------------

export async function listRoles(): Promise<RoleGrant[]> {
  if (!(await live())) return db().roles;
  const { data, error } = await supabase!.from('staff_roles').select('id, user_id, role, department_id, sub_county_id, ward_id, active, expires_at').order('created_at', { ascending: false });
  if (error) fail(error);
  const roles = (data ?? []) as RoleGrant[];
  const ids = [...new Set(roles.map((r) => r.user_id))];
  const { data: people } = ids.length ? await supabase!.from('profiles').select('id, name, email').in('id', ids) : { data: [] };
  const byId = new Map(((people ?? []) as { id: string; name: string; email: string }[]).map((p) => [p.id, p]));
  return roles.map((r) => ({ ...r, name: byId.get(r.user_id)?.name, email: byId.get(r.user_id)?.email }));
}

export async function findUser(email: string): Promise<{ id: string; name: string; email: string } | null> {
  if (!(await live())) return { id: uuid(), name: email.split('@')[0] ?? 'New staff', email };
  const { data, error } = await supabase!.rpc('admin_find_user', { p_email: email });
  if (error) fail(error);
  return ((data ?? []) as { id: string; name: string; email: string }[])[0] ?? null;
}

export type GrantInput = { user_id: string; role: string; department_id?: string | null; sub_county_id?: string | null; ward_id?: string | null; expires_at?: string | null; name?: string; email?: string };

export async function grantRole(g: GrantInput): Promise<void> {
  if (!(await live())) {
    db().roles.unshift({ id: uuid(), user_id: g.user_id, role: g.role, department_id: g.department_id ?? null, sub_county_id: g.sub_county_id ?? null, ward_id: g.ward_id ?? null, active: true, expires_at: g.expires_at ?? null, ...(g.name ? { name: g.name } : {}), ...(g.email ? { email: g.email } : {}) });
    audit('staff_roles', g.user_id, 'INSERT');
    return save();
  }
  const { error } = await supabase!.rpc('grant_staff_role', { p_user: g.user_id, p_role: g.role, p_department: g.department_id ?? null, p_sub_county: g.sub_county_id ?? null, p_ward: g.ward_id ?? null, p_expires_at: g.expires_at ?? null });
  if (error) fail(error);
}

export async function revokeRole(id: string): Promise<void> {
  if (!(await live())) {
    const r = db().roles.find((x) => x.id === id);
    if (r) r.active = false;
    audit('staff_roles', id, 'UPDATE');
    return save();
  }
  const { error } = await supabase!.rpc('revoke_staff_role', { p_role_id: id });
  if (error) fail(error);
}

export async function saveCategory(c: Category): Promise<void> {
  if (!(await live())) {
    const i = demoCategories.findIndex((x) => x.id === c.id);
    if (i >= 0) demoCategories[i] = c;
    else demoCategories.push(c);
    return;
  }
  const { error } = await supabase!.from('report_categories').upsert({ id: c.id, name: c.name, department_id: c.department_id, ack_value: c.ack_value, ack_unit: c.ack_unit, resolve_value: c.resolve_value, resolve_unit: c.resolve_unit, default_priority: c.default_priority, sensitive: c.sensitive, active: c.active });
  if (error) fail(error);
}

export async function saveRoutingRule(r: Omit<RoutingRule, 'id'>): Promise<void> {
  if (!(await live())) return;
  const { error } = await supabase!.from('routing_rules').upsert(r, { onConflict: 'category_id,ward_id' });
  if (error) fail(error);
}

export async function deleteRoutingRule(id: string): Promise<void> {
  if (!(await live())) return;
  const { error } = await supabase!.from('routing_rules').delete().eq('id', id);
  if (error) fail(error);
}

export type Holiday = { day: string; name: string };
const demoHolidays: Holiday[] = [{ day: '2026-10-20', name: 'Mashujaa Day' }, { day: '2026-12-12', name: 'Jamhuri Day' }, { day: '2026-12-25', name: 'Christmas Day' }, { day: '2026-12-26', name: 'Boxing Day' }];

export async function listHolidays(): Promise<Holiday[]> {
  if (!(await live())) return demoHolidays;
  const { data, error } = await supabase!.from('holidays').select('day, name').gte('day', new Date().toISOString().slice(0, 10)).order('day');
  if (error) fail(error);
  return (data ?? []) as Holiday[];
}

export async function addHoliday(h: Holiday): Promise<void> {
  if (!(await live())) {
    demoHolidays.push(h);
    return;
  }
  const { error } = await supabase!.from('holidays').upsert(h);
  if (error) fail(error);
}

export async function deleteHoliday(day: string): Promise<void> {
  if (!(await live())) {
    const i = demoHolidays.findIndex((h) => h.day === day);
    if (i >= 0) demoHolidays.splice(i, 1);
    return;
  }
  const { error } = await supabase!.from('holidays').delete().eq('day', day);
  if (error) fail(error);
}
