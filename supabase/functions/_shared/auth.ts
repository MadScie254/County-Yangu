// Who is calling? For functions that act for a signed-in person (payments, the AI gateway, invitations).
// The token is verified by Supabase Auth; the person's roles come from the database, never from the token or the request.
import { bearer, HttpError } from './http.ts';
import { rpc, serviceClient } from './db.ts';

export type Caller = { id: string; email: string | null; aal: string | null; jwt: string };

/** The `aal` claim (aal1 = password, aal2 = second factor) from a token that Supabase Auth has already verified. */
function aalOf(jwt: string): string | null {
  try {
    const part = jwt.split('.')[1] ?? '';
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4));
    const aal = (JSON.parse(json) as { aal?: unknown }).aal;
    return typeof aal === 'string' ? aal : null;
  } catch {
    return null;
  }
}

export async function requireUser(req: Request): Promise<Caller> {
  const jwt = bearer(req);
  if (!jwt) throw new HttpError(401, 'unauthenticated');
  const { data, error } = await serviceClient().auth.getUser(jwt);
  if (error || !data.user) throw new HttpError(401, 'unauthenticated');
  return { id: data.user.id, email: data.user.email ?? null, aal: aalOf(jwt), jwt };
}

export async function requireRole(req: Request, roles: readonly string[]): Promise<Caller> {
  const caller = await requireUser(req);
  const ok = await rpc<boolean>('svc_staff_check', { p_user: caller.id, p_roles: roles, p_aal: caller.aal });
  if (!ok) throw new HttpError(403, 'forbidden');
  return caller;
}

export const WORKING_ROLES = ['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer'] as const;
export const PUBLISHER_ROLES = ['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin'] as const;
export const ADMIN_ROLES = ['super_admin', 'admin'] as const;
