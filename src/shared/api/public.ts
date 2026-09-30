// Read-side API for the resident door. Everything here reads curated public views or calls the
// public RPCs; nothing touches base tables. Falls back to labelled sample data when the backend is
// unavailable so the app stays usable (and testable) before a county's database is connected.
import { supabase, backendConfigured } from './client';
import { demoActivity, demoProjects, demoProposals, demoPulse, demoSummary, demoTenders, demoVoteData, demoWardStats } from './demo';
import type { ActivityItem, BudgetCycle, CaseStatus, CountySummary, DataSource, ProjectOption, Proposal, PulseSummary, PublicProject, PublicTender, VoteData, WardStat } from './types';

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

export type CategorySla = { id: string; ack_value: number; ack_unit: 'hours' | 'working_days'; resolve_value: number; resolve_unit: 'hours' | 'working_days' };

// Mirrors the report categories seeded in supabase/migrations/*_seed_operations.sql, for demo mode.
const demoCategorySla = (): CategorySla[] => [
  ['pothole', 2, 'working_days', 21, 'working_days'], ['streetlight', 2, 'working_days', 10, 'working_days'], ['water_main', 2, 'hours', 24, 'hours'],
  ['sewer', 8, 'hours', 72, 'hours'], ['drainage', 1, 'working_days', 5, 'working_days'], ['garbage', 1, 'working_days', 3, 'working_days'],
  ['dumping', 2, 'working_days', 7, 'working_days'], ['health_facility', 2, 'working_days', 14, 'working_days'], ['school', 3, 'working_days', 30, 'working_days'],
  ['market', 2, 'working_days', 14, 'working_days'], ['illegal_build', 2, 'working_days', 14, 'working_days'], ['safety_hazard', 2, 'hours', 48, 'hours'],
  ['abandoned', 2, 'working_days', 21, 'working_days'], ['missing_funds', 2, 'working_days', 30, 'working_days'],
].map(([id, ack_value, ack_unit, resolve_value, resolve_unit]) => ({ id, ack_value, ack_unit, resolve_value, resolve_unit }) as CategorySla);

export const getCategorySla = () =>
  live<CategorySla[]>(
    async () => (await supabase!.from('report_categories').select('id, ack_value, ack_unit, resolve_value, resolve_unit').order('sort')) as { data: CategorySla[] | null; error: unknown },
    demoCategorySla,
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

export async function getVoteData(wardId: string): Promise<VoteData> {
  if ((await dataSource()) === 'demo' || !supabase) return demoVoteData(wardId);
  const { data: cycles, error } = await supabase.from('budget_cycles').select('*').in('status', ['open', 'closed']).order('starts_at', { ascending: false }).limit(1);
  if (error) throw error;
  const cycle = (cycles?.[0] as BudgetCycle | undefined) ?? null;
  if (!cycle) return { cycle: null, envelope: null, options: [], tally: {} };
  const [opts, tally, env] = await Promise.all([
    supabase.from('project_options').select('*').eq('cycle_id', cycle.id).eq('ward_id', wardId).order('amount', { ascending: false }),
    supabase.from('public_vote_tally').select('option_id, vote_count').eq('cycle_id', cycle.id).eq('ward_id', wardId),
    supabase.from('ward_budget_envelopes').select('amount').eq('cycle_id', cycle.id).eq('ward_id', wardId).maybeSingle(),
  ]);
  if (opts.error) throw opts.error;
  const counts: Record<string, number> = {};
  for (const row of (tally.data ?? []) as { option_id: string; vote_count: number }[]) counts[row.option_id] = (counts[row.option_id] ?? 0) + row.vote_count;
  return { cycle, envelope: (env.data as { amount: number } | null)?.amount ?? null, options: (opts.data ?? []) as ProjectOption[], tally: counts };
}

export const getProposals = () =>
  live<Proposal[]>(
    async () => (await supabase!.from('proposals').select('id, ward_id, kind, title, body, status, response, supporters, created_at').order('supporters', { ascending: false }).limit(100)) as { data: Proposal[] | null; error: unknown },
    demoProposals,
  );

export const getPulse = () =>
  live<PulseSummary>(
    async () => (await supabase!.rpc('pulse_summary')) as { data: PulseSummary | null; error: unknown },
    demoPulse,
  );
