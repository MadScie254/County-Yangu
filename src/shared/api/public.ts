// Read-side API for the resident door. Everything here reads curated public views or calls the
// public RPCs; nothing touches base tables. Falls back to labelled sample data when the backend is
// unavailable so the app stays usable (and testable) before a county's database is connected.
import { supabase, backendConfigured } from './client';
import { demoActivity, demoProjects, demoSummary, demoTenders, demoWardStats } from './demo';
import type { ActivityItem, CaseStatus, CountySummary, DataSource, PublicProject, PublicTender, WardStat } from './types';

let sourcePromise: Promise<DataSource> | null = null;

/** Probe the backend once; if it answers, everything is "live", otherwise "demo". */
export function dataSource(): Promise<DataSource> {
  if (!sourcePromise) {
    sourcePromise = (async () => {
      if (!backendConfigured || !supabase) return 'demo';
      try {
        const { error } = await supabase.from('public_county_summary').select('votes_cast').limit(1).abortSignal(AbortSignal.timeout(6000));
        return error ? 'demo' : 'live';
      } catch {
        return 'demo';
      }
    })();
  }
  return sourcePromise;
}

export function resetDataSource() {
  sourcePromise = null;
}

async function live<T>(read: () => Promise<{ data: T | null; error: unknown }>, fallback: () => T): Promise<T> {
  if ((await dataSource()) === 'demo' || !supabase) return fallback();
  const { data, error } = await read();
  if (error || data === null) throw error instanceof Error ? error : new Error('Request failed');
  return data;
}

export const getWardStats = () =>
  live<WardStat[]>(
    async () => (await supabase!.from('public_ward_stats').select('*')) as { data: WardStat[] | null; error: unknown },
    demoWardStats,
  );

export const getCountySummary = () =>
  live<CountySummary>(
    async () => {
      const r = await supabase!.from('public_county_summary').select('*').single();
      return r as { data: CountySummary | null; error: unknown };
    },
    () => demoSummary(),
  );

export const getProjects = () =>
  live<PublicProject[]>(
    async () => (await supabase!.from('public_projects').select('*').order('title')) as { data: PublicProject[] | null; error: unknown },
    demoProjects,
  );

export const getTenders = () =>
  live<PublicTender[]>(
    async () => (await supabase!.from('public_tenders').select('*').order('published_at', { ascending: false })) as { data: PublicTender[] | null; error: unknown },
    demoTenders,
  );

export const getActivity = async (): Promise<ActivityItem[]> => ((await dataSource()) === 'demo' ? demoActivity() : []);

export async function getCaseStatus(reference: string): Promise<CaseStatus | null> {
  const ref = reference.trim().toUpperCase();
  if ((await dataSource()) === 'demo' || !supabase) {
    // In demo mode any well-formed reference resolves to a sample case so the page can be explored.
    if (!/^[A-Z]{3}-R[0-9A-Z]{6,}$/.test(ref)) return null;
    const created = new Date(Date.now() - 6 * 86_400_000).toISOString();
    return {
      reference: ref,
      status: 'in_progress',
      category: 'Pothole or damaged road',
      category_sw: 'Shimo au barabara iliyoharibika',
      category_id: 'pothole',
      ward: 'Kileleshwa',
      ward_id: 'kileleshwa',
      created_at: created,
      updated_at: new Date(Date.now() - 86_400_000).toISOString(),
      resolve_due_at: new Date(Date.now() + 9 * 86_400_000).toISOString(),
      project_slug: null,
      events: [
        { kind: 'created', message: 'Report received', at: created },
        { kind: 'status', message: 'Crew dispatched to the site', at: new Date(Date.now() - 86_400_000).toISOString() },
      ],
    };
  }
  const { data, error } = await supabase.rpc('case_status', { p_reference: ref });
  if (error) throw error;
  return (data as CaseStatus | null) ?? null;
}
