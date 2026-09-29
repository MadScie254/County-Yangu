// Authenticator-app (TOTP) second factor for county staff. Enforced in the database when the county sets
// settings.require_staff_mfa (every staff permission then needs an aal2 session); this module is the UI half.
import { supabase } from '@/shared/api/client';
import { dataSource } from '@/shared/api/public';

export type MfaState = 'ok' | 'challenge' | 'enroll';

export async function countyRequiresMfa(): Promise<boolean> {
  if ((await dataSource()) !== 'live' || !supabase) return false;
  const { data } = await supabase.from('county').select('settings').maybeSingle();
  return (data?.settings as { require_staff_mfa?: boolean } | null)?.require_staff_mfa === true;
}

/** Where is this session on the way to a second factor? */
export async function getMfaState(): Promise<MfaState> {
  if (!supabase || !(await countyRequiresMfa())) return 'ok';
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === 'aal2') return 'ok';
  return data?.nextLevel === 'aal2' ? 'challenge' : 'enroll';
}

export async function enrollTotp(): Promise<{ factorId: string; qr: string; secret: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `CountyConnect ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) return null;
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function verifyTotp(code: string, factorId?: string): Promise<boolean> {
  if (!supabase) return code === '123456';
  let id = factorId;
  if (!id) {
    const { data } = await supabase.auth.mfa.listFactors();
    id = data?.totp?.find((f) => f.status === 'verified')?.id;
  }
  if (!id) return false;
  const ch = await supabase.auth.mfa.challenge({ factorId: id });
  if (ch.error || !ch.data) return false;
  const v = await supabase.auth.mfa.verify({ factorId: id, challengeId: ch.data.id, code });
  return !v.error;
}
