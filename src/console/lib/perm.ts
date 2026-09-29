import { useAuth, type StaffRoleName } from '@/shared/state/auth';

export const WORKING: StaffRoleName[] = ['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer'];
export const ADMINS: StaffRoleName[] = ['super_admin', 'admin'];
export const OVERSIGHT: StaffRoleName[] = ['assembly_member', 'auditor'];
export const PUBLISHERS: StaffRoleName[] = ['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin'];
export const FINANCE: StaffRoleName[] = ['super_admin', 'admin', 'chief_officer', 'auditor'];

export const roleLabel: Record<StaffRoleName, string> = {
  super_admin: 'Super admin', admin: 'County administrator', chief_officer: 'Chief officer', sub_county_admin: 'Sub-county administrator',
  ward_admin: 'Ward administrator', officer: 'Officer', assembly_member: 'Assembly member', auditor: 'Auditor',
};

/** What the signed-in person may see in the UI. The database enforces all of it again; this only hides what would be refused. */
export function useCan() {
  const roles = useAuth((s) => s.roles);
  const has = (...n: StaffRoleName[]) => roles.some((r) => n.includes(r.role));
  const top = (['super_admin', 'admin', 'chief_officer', 'sub_county_admin', 'ward_admin', 'officer', 'assembly_member', 'auditor'] as StaffRoleName[]).find((r) => has(r));
  return {
    has,
    working: has(...WORKING),
    admin: has(...ADMINS),
    publish: has(...PUBLISHERS),
    finance: has(...FINANCE),
    oversight: has(...OVERSIGHT, ...ADMINS),
    /** Assembly members and admins see named officers; auditors see departments only. */
    namedOfficers: has('assembly_member', ...ADMINS),
    readOnly: !has(...WORKING),
    topRole: top ? roleLabel[top] : '',
  };
}
