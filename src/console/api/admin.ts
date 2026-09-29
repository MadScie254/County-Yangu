// Administration data: the service catalogue, AI budgets, county settings, auditor invitations, KRA checks.
// Live mode calls Supabase as the signed-in administrator (row-level security and the database decide what is allowed);
// demo mode keeps everything in memory so the screens can be explored without a backend.
import { functionsUrl, supabase } from '@/shared/api/client';
import { dataSource } from '@/shared/api/public';
import { demoServices } from '@/shared/api/services-demo';
import type { Service } from '@/shared/api/services-types';
import { sleep, uuid } from '@/shared/lib/utils';
import { demoDepts } from './demo';

const live = async () => (await dataSource()) === 'live' && Boolean(supabase);
const fail = (e: unknown): never => {
  throw e instanceof Error ? e : new Error((e as { message?: string })?.message ?? 'Request failed');
};

// ---- service catalogue ------------------------------------------------------------------------------------------------------------------

export type ServiceInput = Omit<Service, 'id'> & { id?: string; department_id: string | null };
export type ServiceRow = Service & { department_id: string | null };

export async function listAllServices(): Promise<ServiceRow[]> {
  if (!(await live())) return demoServices.map((s) => ({ ...s, department_id: null }));
  const { data, error } = await supabase!.from('services').select('*').order('name');
  if (error) fail(error);
  return (data ?? []) as ServiceRow[];
}

export async function saveService(s: ServiceInput): Promise<void> {
  if (!(await live())) {
    const i = demoServices.findIndex((x) => x.id === s.id);
    const row: Service = { ...s, id: s.id ?? uuid() };
    if (i >= 0) demoServices[i] = row;
    else demoServices.push(row);
    return;
  }
  const { id, ...rest } = s;
  const { error } = id ? await supabase!.from('services').update(rest).eq('id', id) : await supabase!.from('services').insert(rest);
  if (error) fail(error);
}

// ---- AI budgets -----------------------------------------------------------------------------------------------------------------------------

export type AiUsageRow = { department_id: string | null; department: string; spent_kes: number; cap_kes: number; calls: number };

let demoAi: AiUsageRow[] | null = null;
const da = () => (demoAi ??= [{ department_id: null, department: 'County-wide pool', spent_kes: 0, cap_kes: 500, calls: 0 }, ...demoDepts.slice(0, 5).map((d, i) => ({ department_id: d.id, department: d.name, spent_kes: [42.5, 180, 0, 310.25, 12][i]!, cap_kes: 500, calls: [17, 61, 0, 104, 5][i]! }))]);

export async function getAiUsage(): Promise<AiUsageRow[]> {
  if (!(await live())) return da();
  const { data, error } = await supabase!.rpc('ai_usage');
  if (error) fail(error);
  return ((data ?? []) as AiUsageRow[]).map((r) => ({ ...r, spent_kes: Number(r.spent_kes), cap_kes: Number(r.cap_kes), calls: Number(r.calls) }));
}

export async function setAiBudget(department: string | null, cap: number | null): Promise<void> {
  if (!(await live())) {
    const r = da().find((x) => x.department_id === department);
    if (r && cap !== null) r.cap_kes = cap;
    return;
  }
  const { error } = await supabase!.rpc('set_ai_budget', { p_department: department, p_cap: cap });
  if (error) fail(error);
}

// ---- county settings --------------------------------------------------------------------------------------------------------------------------

export const DIGEST_KINDS = [
  ['assembly', 'County Assembly'],
  ['controller_of_budget', 'Controller of Budget'],
  ['auditor_general', 'Auditor-General'],
  ['executive', 'County executive'],
] as const;

export type CountySettings = {
  require_staff_mfa: boolean;
  ai_default_cap_kes: number | null;
  web_url: string;
  console_url: string;
  digest_recipients: Record<string, string[]>;
};

let demoSettings: CountySettings = { require_staff_mfa: false, ai_default_cap_kes: 500, web_url: '', console_url: '', digest_recipients: {} };

export async function getSettings(): Promise<CountySettings> {
  if (!(await live())) return demoSettings;
  const { data, error } = await supabase!.from('county').select('settings').maybeSingle();
  if (error) fail(error);
  const s = (data?.settings ?? {}) as Partial<CountySettings>;
  return { require_staff_mfa: s.require_staff_mfa === true, ai_default_cap_kes: s.ai_default_cap_kes ?? null, web_url: s.web_url ?? '', console_url: s.console_url ?? '', digest_recipients: s.digest_recipients ?? {} };
}

export async function saveSettings(patch: Partial<CountySettings>): Promise<void> {
  if (!(await live())) {
    demoSettings = { ...demoSettings, ...patch };
    return;
  }
  const { data, error } = await supabase!.from('county').select('settings').maybeSingle();
  if (error) fail(error);
  const next = { ...((data?.settings as object | undefined) ?? {}), ...patch };
  const { error: e2 } = await supabase!.from('county').update({ settings: next }).eq('id', 1);
  if (e2) fail(e2);
}

/** True when this session was signed in with an authenticator app (needed before switching two-factor on for everyone). */
export async function hasSecondFactor(): Promise<boolean> {
  if (!(await live())) return true;
  const { data } = await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === 'aal2';
}

// ---- functions that need the server ----------------------------------------------------------------------------------------------------------

async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data } = await supabase!.auth.getSession();
  const res = await fetch(`${functionsUrl}/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string, authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  });
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(out.error ?? `http-${res.status}`);
  return out;
}

export async function inviteAuditor(input: { email: string; organisation: string; days: number }): Promise<void> {
  if (!(await live()) || !functionsUrl) {
    await sleep(600);
    return;
  }
  await callFunction('auditor-invite', input);
}

export type KraResult = { pin_format_valid: boolean; status: 'compliant' | 'non_compliant' | 'unknown'; source: 'format-only' | 'gavaconnect' };

export async function checkKra(pin: string, contractorId?: string): Promise<KraResult> {
  if (!(await live()) || !functionsUrl) {
    await sleep(400);
    const ok = /^[AP]\d{9}[A-Z]$/i.test(pin.trim());
    return { pin_format_valid: ok, status: ok ? 'unknown' : 'non_compliant', source: 'format-only' };
  }
  return callFunction<KraResult>('kra-check', { pin, contractor_id: contractorId });
}
