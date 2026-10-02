import type { ProjectStatus, PublicProject } from '@/shared/api/types';

export type ProjectFilters = { q: string; status: ProjectStatus | 'all'; sector: string | 'all'; ward: string | 'all' };
export const defaultFilters: ProjectFilters = { q: '', status: 'all', sector: 'all', ward: 'all' };

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

export function filterProjects(list: PublicProject[], f: ProjectFilters): PublicProject[] {
  const q = norm(f.q.trim());
  return list.filter((p) => {
    if (f.status !== 'all' && p.status !== f.status) return false;
    if (f.sector !== 'all' && p.sector !== f.sector) return false;
    if (f.ward !== 'all' && p.ward_id !== f.ward) return false;
    if (!q) return true;
    return [p.title, p.ward_name, p.sector, p.contractor ?? ''].some((v) => norm(v).includes(q));
  });
}

export const spentPct = (p: Pick<PublicProject, 'spent' | 'budget'>) => (p.budget > 0 ? Math.round((p.spent / p.budget) * 100) : 0);

/** Overspend = spent more than the approved budget. A leading red flag for oversight. */
export const isOverBudget = (p: Pick<PublicProject, 'spent' | 'budget'>) => p.spent > p.budget * 1.02;

export function milestoneProgress(p: Pick<PublicProject, 'milestones'>) {
  const total = p.milestones.length;
  const done = p.milestones.filter((m) => m.done).length;
  return { done, total, ratio: total ? done / total : 0 };
}

export const projectPhotoUrl = (path: string) => `${import.meta.env.VITE_SUPABASE_URL ?? ''}/storage/v1/object/public/project-photos/${path}`;

/** A started or finished project showing zero spent means the county has not published its spending, not that nothing was spent. */
export const spendUnknown = (p: Pick<PublicProject, 'spent' | 'status'>) => p.spent === 0 && (p.status === 'in_progress' || p.status === 'stalled' || p.status === 'completed');
