import { useQuery } from '@tanstack/react-query';
import { getCategories, getDepartments, getDigests, getDirectory, getAudit, getOverdue, getRoutingRules, listCases, listHolidays, listReviewApps, listRoles } from './ops';

export const useCases = () => useQuery({ queryKey: ['c-cases'], queryFn: listCases, refetchInterval: 60_000 });
export const useDepartments = () => useQuery({ queryKey: ['c-depts'], queryFn: getDepartments, staleTime: 5 * 60_000 });
export const useCategories = () => useQuery({ queryKey: ['c-cats'], queryFn: getCategories, staleTime: 5 * 60_000 });
export const useDirectory = () => useQuery({ queryKey: ['c-dir'], queryFn: getDirectory, staleTime: 5 * 60_000 });
export const useRules = () => useQuery({ queryKey: ['c-rules'], queryFn: getRoutingRules });
export const useReviewApps = () => useQuery({ queryKey: ['c-apps'], queryFn: listReviewApps, refetchInterval: 60_000 });
export const useOverdue = (named: boolean) => useQuery({ queryKey: ['c-overdue', named], queryFn: () => getOverdue(named) });
export const useDigests = () => useQuery({ queryKey: ['c-digests'], queryFn: getDigests });
export const useAudit = () => useQuery({ queryKey: ['c-audit'], queryFn: getAudit });
export const useRoles = () => useQuery({ queryKey: ['c-roles'], queryFn: listRoles });
export const useHolidays = () => useQuery({ queryKey: ['c-holidays'], queryFn: listHolidays });

/** Small lookups so tables show names, not ids. */
export function nameMaps(depts?: { id: string; name: string }[], cats?: { id: string; name: string }[], staff?: { user_id: string; name: string }[]) {
  return {
    dept: new Map((depts ?? []).map((d) => [d.id, d.name])),
    cat: new Map((cats ?? []).map((c) => [c.id, c.name])),
    staff: new Map((staff ?? []).map((s) => [s.user_id, s.name])),
  };
}
