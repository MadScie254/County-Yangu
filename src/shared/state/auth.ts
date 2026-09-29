// One auth store for both doors. Live: Supabase Auth (email + password). Demo: a localStorage stand-in.
// Roles are read from public.staff_roles (RLS: you can only read your own). A role is never inferred
// from a form choice, from user metadata, or from the URL.
import { create } from 'zustand';
import { supabase } from '@/shared/api/client';
import { dataSource } from '@/shared/api/public';
import { readDb, writeDb } from '@/shared/api/services-demo';
import type { SessionUser } from '@/shared/api/services-types';
import { uuid } from '@/shared/lib/utils';

export type StaffRoleName = 'super_admin' | 'admin' | 'chief_officer' | 'sub_county_admin' | 'ward_admin' | 'officer' | 'assembly_member' | 'auditor';
export type StaffRole = { role: StaffRoleName; department_id: string | null; sub_county_id: string | null; ward_id: string | null };

export type AuthError = 'invalid' | 'exists' | 'weak' | 'unconfirmed' | 'generic';
export type AuthResult = { ok: true; needsEmailConfirmation?: boolean } | { ok: false; error: AuthError };

type AuthState = {
  status: 'loading' | 'anon' | 'in';
  user: SessionUser | null;
  roles: StaffRole[];
  demo: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: { name: string; email: string; password: string; phone?: string }) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  hasRole: (...names: StaffRoleName[]) => boolean;
};

const DEMO_SESSION = 'cy-demo-session';
let started = false;

const mapError = (e: { message?: string; status?: number; code?: string } | null): AuthError => {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'invalid';
  if (m.includes('already') || m.includes('registered')) return 'exists';
  if (m.includes('password')) return 'weak';
  if (m.includes('confirm')) return 'unconfirmed';
  return 'generic';
};

async function loadRoles(userId: string): Promise<StaffRole[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('staff_roles').select('role, department_id, sub_county_id, ward_id, expires_at, active').eq('user_id', userId).eq('active', true);
  return ((data ?? []) as (StaffRole & { expires_at: string | null })[]).filter((r) => !r.expires_at || new Date(r.expires_at) > new Date());
}

/** Demo staff sessions pick a role from the email prefix so the console can be explored without a database. */
function demoRoles(email: string): StaffRole[] {
  const prefix = email.split('@')[0]?.toLowerCase() ?? '';
  const role: StaffRoleName = prefix.startsWith('admin') ? 'admin' : prefix.startsWith('assembly') ? 'assembly_member' : prefix.startsWith('audit') ? 'auditor' : prefix.startsWith('ward') ? 'ward_admin' : prefix.startsWith('resident') ? 'officer' : 'officer';
  return prefix.startsWith('resident') ? [] : [{ role, department_id: null, sub_county_id: null, ward_id: null }];
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  user: null,
  roles: [],
  demo: false,

  init: async () => {
    if (started) return;
    started = true;
    const source = await dataSource();
    if (source === 'demo' || !supabase) {
      const raw = localStorage.getItem(DEMO_SESSION);
      const u = raw ? (JSON.parse(raw) as SessionUser) : null;
      set({ demo: true, status: u ? 'in' : 'anon', user: u, roles: u ? demoRoles(u.email) : [] });
      return;
    }
    const apply = async (session: { user: { id: string; email?: string; phone?: string; user_metadata?: Record<string, unknown> } } | null) => {
      if (!session) return set({ status: 'anon', user: null, roles: [] });
      const u = session.user;
      set({ status: 'in', user: { id: u.id, email: u.email ?? '', name: String(u.user_metadata?.name ?? ''), phone: u.phone ?? null } });
      set({ roles: await loadRoles(u.id) });
    };
    const { data } = await supabase.auth.getSession();
    await apply(data.session);
    supabase.auth.onAuthStateChange((_evt, session) => void apply(session));
  },

  signIn: async (email, password) => {
    if (get().demo || !supabase) {
      const db = readDb();
      const found = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      const user = found ?? { id: uuid(), email, name: email.split('@')[0] ?? 'Demo user', phone: null };
      if (!found) writeDb({ ...db, users: [...db.users, user] });
      localStorage.setItem(DEMO_SESSION, JSON.stringify(user));
      set({ status: 'in', user, roles: demoRoles(email) });
      return { ok: true };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: mapError(error) } : { ok: true };
  },

  signUp: async ({ name, email, password, phone }) => {
    if (get().demo || !supabase) {
      const db = readDb();
      if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return { ok: false, error: 'exists' };
      const user = { id: uuid(), email, name, phone: phone ?? null };
      writeDb({ ...db, users: [...db.users, user] });
      localStorage.setItem(DEMO_SESSION, JSON.stringify(user));
      set({ status: 'in', user, roles: demoRoles(email) });
      return { ok: true };
    }
    // `name` and `phone_number` are personal details only; the database ignores any role in metadata.
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, phone_number: phone ?? null }, emailRedirectTo: `${location.origin}/services` } });
    if (error) return { ok: false, error: mapError(error) };
    return { ok: true, needsEmailConfirmation: !data.session };
  },

  signOut: async () => {
    if (get().demo || !supabase) {
      localStorage.removeItem(DEMO_SESSION);
      set({ status: 'anon', user: null, roles: [] });
      return;
    }
    await supabase.auth.signOut();
  },

  hasRole: (...names) => get().roles.some((r) => names.includes(r.role)),
}));
