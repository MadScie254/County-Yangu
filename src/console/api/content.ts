// Publishing and money: projects, tenders, budget cycles, alerts, proposals, revenue.
// Live mode = Supabase under the staff member's own session (RLS decides). Demo mode = in-memory samples.
import { supabase } from '@/shared/api/client';
import { dataSource } from '@/shared/api/public';
import { demoProjects, demoProposals, demoTenders } from '@/shared/api/demo';
import { slugify, uuid } from '@/shared/lib/utils';
import { wards } from '@/shared/config/county';
import type { Proposal } from '@/shared/api/types';

const live = async () => (await dataSource()) === 'live' && Boolean(supabase);
const fail = (e: unknown): never => {
  throw e instanceof Error ? e : new Error((e as { message?: string })?.message ?? 'Request failed');
};

// ---- projects ------------------------------------------------------------------------------------------------
export type StaffProject = {
  id: string; slug: string; ward_id: string; title: string; sector: string; description: string | null;
  status: 'planned' | 'procurement' | 'in_progress' | 'stalled' | 'completed';
  budget: number; spent: number; contractor_id: string | null; contractor_name?: string | null; lat: number | null; lng: number | null;
  started_at: string | null; expected_at: string | null; completed_at: string | null; published: boolean;
};
export type StaffMilestone = { id: string; project_id: string; title: string; due_date: string | null; completed_at: string | null; sort: number };

let demoP: StaffProject[] | null = null;
const demoM: Record<string, StaffMilestone[]> = {};
const dp = () => (demoP ??= demoProjects().map((p, i) => ({ id: p.id, slug: p.slug, ward_id: p.ward_id, title: p.title, sector: p.sector, description: p.description, status: p.status, budget: p.budget, spent: p.spent, contractor_id: null, contractor_name: p.contractor, lat: p.lat, lng: p.lng, started_at: p.started_at, expected_at: p.expected_at, completed_at: p.completed_at, published: i % 5 !== 0 })));

export async function listProjects(): Promise<StaffProject[]> {
  if (!(await live())) return dp();
  const { data, error } = await supabase!.from('projects').select('*, contractors(name)').order('created_at', { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as (StaffProject & { contractors: { name: string } | null })[]).map((p) => ({ ...p, contractor_name: p.contractors?.name ?? null }));
}

export async function saveProject(p: Partial<StaffProject> & { title: string; ward_id: string }): Promise<void> {
  const row = { title: p.title, ward_id: p.ward_id, sector: p.sector ?? 'General', description: p.description ?? null, status: p.status ?? 'planned', budget: p.budget ?? 0, spent: p.spent ?? 0, contractor_id: p.contractor_id ?? null, lat: p.lat ?? null, lng: p.lng ?? null, started_at: p.started_at || null, expected_at: p.expected_at || null, completed_at: p.completed_at || null, published: p.published ?? false };
  if (!(await live())) {
    const list = dp();
    const i = list.findIndex((x) => x.id === p.id);
    if (i >= 0) list[i] = { ...list[i]!, ...row };
    else list.unshift({ id: uuid(), slug: `${slugify(p.title)}-${list.length + 1}`, contractor_name: null, ...row } as StaffProject);
    return;
  }
  if (p.id) {
    const { error } = await supabase!.from('projects').update(row).eq('id', p.id);
    if (error) fail(error);
  } else {
    const { error } = await supabase!.from('projects').insert({ ...row, slug: `${slugify(p.title)}-${Math.random().toString(36).slice(2, 6)}` });
    if (error) fail(error);
  }
}

export async function listMilestones(projectId: string): Promise<StaffMilestone[]> {
  if (!(await live())) return demoM[projectId] ?? (demoM[projectId] = []);
  const { data, error } = await supabase!.from('project_milestones').select('*').eq('project_id', projectId).order('sort').order('due_date');
  if (error) fail(error);
  return (data ?? []) as StaffMilestone[];
}

export async function addMilestone(projectId: string, title: string, due: string | null): Promise<void> {
  if (!(await live())) {
    (demoM[projectId] ??= []).push({ id: uuid(), project_id: projectId, title, due_date: due, completed_at: null, sort: demoM[projectId]?.length ?? 0 });
    return;
  }
  const { error } = await supabase!.from('project_milestones').insert({ project_id: projectId, title, due_date: due });
  if (error) fail(error);
}

export async function setMilestoneDone(m: StaffMilestone, done: boolean): Promise<void> {
  const completed_at = done ? new Date().toISOString().slice(0, 10) : null;
  if (!(await live())) {
    const x = demoM[m.project_id]?.find((y) => y.id === m.id);
    if (x) x.completed_at = completed_at;
    return;
  }
  const { error } = await supabase!.from('project_milestones').update({ completed_at }).eq('id', m.id);
  if (error) fail(error);
}

// ---- tenders & contractors ----------------------------------------------------------------------------------------
export type StaffTender = { id: string; reference: string; title: string; ward_id: string | null; sector: string; status: 'draft' | 'open' | 'evaluating' | 'awarded' | 'cancelled'; estimated_budget: number; applicants_count: number; awarded_contractor_id: string | null; awarded_name?: string | null; published_at: string | null; closes_at: string | null };
export type Contractor = { id: string; name: string; kra_pin: string | null; kra_compliant: boolean | null };

let demoT: StaffTender[] | null = null;
const demoC: Contractor[] = ['Kanjo Works Ltd', 'Mwangaza Builders', 'Savannah Civil Co.', 'Tumaini Contractors'].map((name, i) => ({ id: `ct-${i}`, name, kra_pin: `P05123456${i}Z`, kra_compliant: i !== 3 }));
const dt = () => (demoT ??= demoTenders().map((t) => ({ ...t, awarded_contractor_id: null, awarded_name: t.awarded_to, status: t.status as StaffTender['status'] })));

export async function listTenders(): Promise<StaffTender[]> {
  if (!(await live())) return dt();
  const { data, error } = await supabase!.from('tenders').select('*, contractors:awarded_contractor_id(name)').order('created_at', { ascending: false });
  if (error) fail(error);
  return ((data ?? []) as (StaffTender & { contractors: { name: string } | null })[]).map((t) => ({ ...t, awarded_name: t.contractors?.name ?? null }));
}

export async function listContractors(): Promise<Contractor[]> {
  if (!(await live())) return demoC;
  const { data, error } = await supabase!.from('contractors').select('id, name, kra_pin, kra_compliant').order('name');
  if (error) fail(error);
  return (data ?? []) as Contractor[];
}

export async function saveContractor(name: string, kra_pin: string | null): Promise<void> {
  if (!(await live())) return void demoC.push({ id: uuid(), name, kra_pin, kra_compliant: null });
  const { error } = await supabase!.from('contractors').insert({ name, kra_pin });
  if (error) fail(error);
}

export async function saveTender(t: Partial<StaffTender> & { title: string; estimated_budget: number }): Promise<void> {
  const row = { title: t.title, ward_id: t.ward_id || null, sector: t.sector ?? 'General', status: t.status ?? 'draft', estimated_budget: t.estimated_budget, awarded_contractor_id: t.awarded_contractor_id ?? null, closes_at: t.closes_at || null, published_at: t.status && t.status !== 'draft' ? (t.published_at ?? new Date().toISOString()) : null };
  if (!(await live())) {
    const list = dt();
    const i = list.findIndex((x) => x.id === t.id);
    const awarded_name = demoC.find((c) => c.id === row.awarded_contractor_id)?.name ?? (i >= 0 ? list[i]!.awarded_name : null) ?? null;
    if (i >= 0) list[i] = { ...list[i]!, ...row, awarded_name };
    else list.unshift({ id: uuid(), reference: `TND/${new Date().getFullYear()}/${100 + list.length}`, applicants_count: 0, awarded_name, ...row });
    return;
  }
  if (t.id) {
    const { error } = await supabase!.from('tenders').update(row).eq('id', t.id);
    if (error) fail(error);
  } else {
    const { error } = await supabase!.from('tenders').insert({ ...row, reference: `TND/${new Date().getFullYear()}/${Math.floor(Math.random() * 9000 + 1000)}` });
    if (error) fail(error);
  }
}

// ---- participatory budget ---------------------------------------------------------------------------------------------------
export type Cycle = { id: string; title: string; status: 'draft' | 'open' | 'closed'; starts_at: string; ends_at: string; published_results: boolean };
export type Option = { id: string; cycle_id: string; ward_id: string; title: string; sector: string; description: string | null; amount: number };

let demoCy: Cycle[] | null = null;
const demoOpt: Option[] = [];
const dcy = () => (demoCy ??= [{ id: 'fy2026-27', title: 'Ward Development Fund 2026/27', status: 'open', starts_at: new Date(Date.now() - 9 * 86_400_000).toISOString(), ends_at: new Date(Date.now() + 21 * 86_400_000).toISOString(), published_results: false }]);

export async function listCycles(): Promise<Cycle[]> {
  if (!(await live())) return dcy();
  const { data, error } = await supabase!.from('budget_cycles').select('*').order('starts_at', { ascending: false });
  if (error) fail(error);
  return (data ?? []) as Cycle[];
}

export async function saveCycle(c: Partial<Cycle> & { id: string; title: string }): Promise<void> {
  if (!(await live())) {
    const list = dcy();
    const i = list.findIndex((x) => x.id === c.id);
    if (i >= 0) list[i] = { ...list[i]!, ...c };
    else list.unshift({ status: 'draft', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), published_results: false, ...c });
    return;
  }
  const { error } = await supabase!.from('budget_cycles').upsert({ status: 'draft', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), ...c });
  if (error) fail(error);
}

export async function listOptions(cycleId: string, wardId: string): Promise<Option[]> {
  if (!(await live())) return demoOpt.filter((o) => o.cycle_id === cycleId && o.ward_id === wardId);
  const { data, error } = await supabase!.from('project_options').select('*').eq('cycle_id', cycleId).eq('ward_id', wardId);
  if (error) fail(error);
  return (data ?? []) as Option[];
}

export async function saveOption(o: Omit<Option, 'id'>): Promise<void> {
  const id = `${o.ward_id}-${slugify(o.title)}-${Math.random().toString(36).slice(2, 5)}`;
  if (!(await live())) return void demoOpt.push({ id, ...o });
  const { error } = await supabase!.from('project_options').insert({ id, ...o });
  if (error) fail(error);
}

export async function deleteOption(id: string): Promise<void> {
  if (!(await live())) {
    const i = demoOpt.findIndex((o) => o.id === id);
    if (i >= 0) demoOpt.splice(i, 1);
    return;
  }
  const { error } = await supabase!.from('project_options').delete().eq('id', id);
  if (error) fail(error);
}

// ---- ward alerts (draft -> submit -> a second person approves) -------------------------------------------------------------------
export type AlertRow = { id: string; ward_id: string | null; title: string; body: string; status: 'draft' | 'pending_approval' | 'approved' | 'sent' | 'cancelled'; created_by: string; approved_by: string | null; created_at: string };
let demoA: AlertRow[] | null = null;
const da = () => (demoA ??= [{ id: 'al-1', ward_id: wards[3]?.id ?? null, title: 'Water shut-off Tuesday', body: 'Water will be off from 9am to 4pm on Tuesday for pipe repairs.', status: 'pending_approval', created_by: 'u-lucy', approved_by: null, created_at: new Date().toISOString() }]);

export async function listAlerts(): Promise<AlertRow[]> {
  if (!(await live())) return da();
  const { data, error } = await supabase!.from('alerts').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) fail(error);
  return (data ?? []) as AlertRow[];
}

export async function createAlert(a: { ward_id: string | null; title: string; body: string }, userId: string): Promise<void> {
  if (!(await live())) return void da().unshift({ id: uuid(), status: 'draft', approved_by: null, created_at: new Date().toISOString(), created_by: userId, ...a });
  const { error } = await supabase!.from('alerts').insert({ ...a, status: 'draft', created_by: userId });
  if (error) fail(error);
}

export async function submitAlert(id: string): Promise<void> {
  if (!(await live())) { const a = da().find((x) => x.id === id); if (a) a.status = 'pending_approval'; return; }
  const { error } = await supabase!.rpc('alert_submit', { p_alert: id });
  if (error) fail(error);
}

export async function approveAlert(id: string, userId: string): Promise<void> {
  if (!(await live())) {
    const a = da().find((x) => x.id === id);
    if (!a) return;
    if (a.created_by === userId) throw new Error('A second person must approve this alert.');
    a.status = 'approved'; a.approved_by = userId;
    return;
  }
  const { error } = await supabase!.rpc('alert_approve', { p_alert: id });
  if (error) fail(error);
}

// ---- ideas & petitions ---------------------------------------------------------------------------------------------------------------
let demoI: Proposal[] | null = null;
const di = () => (demoI ??= demoProposals());

export async function listIdeas(): Promise<Proposal[]> {
  if (!(await live())) return di();
  const { data, error } = await supabase!.from('proposals').select('id, ward_id, kind, title, body, status, response, supporters, created_at').order('supporters', { ascending: false }).limit(200);
  if (error) fail(error);
  return (data ?? []) as Proposal[];
}

export async function respondIdea(id: string, status: Proposal['status'], response: string, userId: string): Promise<void> {
  if (!(await live())) { const p = di().find((x) => x.id === id); if (p) { p.status = status; p.response = response; } return; }
  const { error } = await supabase!.from('proposals').update({ status, response, responded_by: userId }).eq('id', id);
  if (error) fail(error);
}

// ---- revenue -------------------------------------------------------------------------------------------------------------------------------
export type RevenueRow = { id: string; reference: string; amount: number; payer_name: string | null; stream: string; source: string; reconciled: boolean; received_at: string };
let demoR: RevenueRow[] | null = null;
const dr = () => {
  if (demoR) return demoR;
  const streams = ['Single business permits', 'Land rates', 'Parking', 'Market fees', 'Building approvals', 'Health facility fees'];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return (demoR = Array.from({ length: 120 }, (_, i) => ({ id: `rv-${i}`, reference: `SIM${(1000000 + i * 373).toString(36).toUpperCase()}`, amount: Math.round((500 + rnd() * 24000) / 50) * 50, payer_name: null, stream: streams[Math.floor(rnd() * streams.length)]!, source: rnd() > 0.2 ? 'mpesa' : rnd() > 0.5 ? 'bank' : 'cash', reconciled: rnd() > 0.15, received_at: new Date(Date.now() - rnd() * 30 * 86_400_000).toISOString() })));
};

export async function listRevenue(): Promise<RevenueRow[]> {
  if (!(await live())) return dr();
  const { data, error } = await supabase!.from('revenue_entries').select('id, reference, amount, payer_name, stream, source, reconciled, received_at').gte('received_at', new Date(Date.now() - 31 * 86_400_000).toISOString()).order('received_at', { ascending: false }).limit(2000);
  if (error) fail(error);
  return (data ?? []) as RevenueRow[];
}
