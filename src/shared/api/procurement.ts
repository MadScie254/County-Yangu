// Procurement watch: read side for everyone (public.procurement_watch()), review side for county administrators
// (public.flag_review()). Demo mode analyses the sample tenders in the browser and keeps reviews on this device only.
import { supabase } from './client';
import { dataSource } from './public';
import { demoProjects, demoTenders } from './demo';
import { computeProcurementWatch } from '@/shared/lib/procurement';
import type { FlagStatus, ProcurementWatch } from './types';

const DEMO_REVIEWS = 'cy-demo-flag-reviews';
type DemoReview = { status: FlagStatus; response: string | null; at: string };
const readReviews = (): Record<string, DemoReview> => {
  try { return JSON.parse(localStorage.getItem(DEMO_REVIEWS) ?? '{}') as Record<string, DemoReview>; } catch { return {}; }
};

export async function getProcurementWatch(): Promise<ProcurementWatch> {
  if ((await dataSource()) === 'demo' || !supabase) {
    const w = computeProcurementWatch(demoTenders(), demoProjects());
    const reviews = readReviews();
    return { ...w, flags: w.flags.map((f) => { const r = reviews[`${f.code}|${f.subject_key}`]; return r ? { ...f, status: r.status, response: r.response, first_seen: r.at } : f; }) };
  }
  const { data, error } = await supabase.rpc('procurement_watch');
  if (error) throw error;
  return data as ProcurementWatch;
}

export async function reviewFlag(input: { code: string; key: string; status: Exclude<FlagStatus, 'cleared'>; response: string }): Promise<void> {
  if ((await dataSource()) === 'demo' || !supabase) {
    const all = readReviews();
    all[`${input.code}|${input.key}`] = { status: input.status, response: input.response.trim() || null, at: new Date().toISOString() };
    localStorage.setItem(DEMO_REVIEWS, JSON.stringify(all));
    return;
  }
  const { error } = await supabase.rpc('flag_review', { p_code: input.code, p_key: input.key, p_status: input.status, p_response: input.response });
  if (error) throw error;
}
