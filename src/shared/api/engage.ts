// Browser side of migration 0023: ward league, live feed, community events, Ask your MCA.
// Live first; a labelled demo fallback keeps every screen working with no backend.
import { supabase } from './client';
import { dataSource } from './public';

const isDemo = async () => (await dataSource()) === 'demo' || !supabase;
const DAY = 86_400_000;
const MIN = 60_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase!.rpc(name, args);
  if (error) throw error;
  return data as T;
}
const must = <T>(r: { data: T | null; error: unknown }): T => { if (r.error) throw r.error; return (r.data ?? ([] as unknown)) as T; };

// ---- ward league ----

export type LeagueRow = {
  ward_id: string; name: string; score: number | null; previous: number | null; change: number | null;
  reports: number; fixed: number; due: number; fixed_on_time: number; acked_on_time: number; median_days: number | null; taking_part: number;
};
export type League = { days: number; generated_at: string; wards: LeagueRow[] };

/** Demo league: a handful of wards with plausible, clearly invented numbers. */
function demoLeague(days: number): League {
  const rows: [string, string, number, number | null][] = [
    ['kileleshwa', 'Kileleshwa', 81.5, 70.2], ['kawangware', 'Kawangware', 74.0, 61.8], ['karen', 'Karen', 71.2, 73.9],
    ['embakasi', 'Embakasi', 66.4, 52.1], ['kilimani', 'Kilimani', 63.0, 64.5], ['mountain-view', 'Mountain View', 58.7, 49.0],
    ['kitisuru', 'Kitisuru', 55.1, null], ['karura', 'Karura', 47.9, 51.3],
  ];
  return {
    days, generated_at: new Date().toISOString(),
    wards: rows.map(([ward_id, name, score, previous], i) => ({
      ward_id, name, score, previous, change: previous === null ? null : Math.round((score - previous) * 10) / 10,
      reports: 40 - i * 3, fixed: 30 - i * 3, due: 28 - i * 2, fixed_on_time: 24 - i * 3, acked_on_time: 36 - i * 3, median_days: 2 + i * 0.7, taking_part: 220 - i * 18,
    })),
  };
}

export async function getWardLeague(days = 30): Promise<League> {
  if (await isDemo()) return demoLeague(days);
  return rpc<League>('ward_league', { p_days: days });
}

// ---- live feed ----

export type LiveItem =
  | { kind: 'report'; ward: string; ward_id: string; category: string; category_sw: string | null; at: string }
  | { kind: 'resolved'; ward: string; ward_id: string; category: string; category_sw: string | null; at: string; reference: string; days: number }
  | { kind: 'milestone'; ward: string; ward_id: string; title: string; project: string; slug: string; at: string }
  | { kind: 'poll'; title: string; slug: string; at: string }
  | { kind: 'notice'; ward: string | null; title: string; at: string };

export async function getLiveActivity(limit = 30): Promise<LiveItem[]> {
  if (await isDemo()) {
    return [
      { kind: 'resolved', ward: 'Embakasi', ward_id: 'embakasi', category: 'Pothole', category_sw: 'Shimo barabarani', at: iso(-2 * MIN), reference: 'NAI-RDEMO00001', days: 3 },
      { kind: 'report', ward: 'Kawangware', ward_id: 'kawangware', category: 'Blocked drain', category_sw: 'Mtaro ulioziba', at: iso(-6 * MIN) },
      { kind: 'report', ward: 'Kilimani', ward_id: 'kilimani', category: 'Street light out', category_sw: 'Taa ya barabarani imezimika', at: iso(-14 * MIN) },
      { kind: 'milestone', ward: 'Waithaka', ward_id: 'waithaka', title: 'Drainage laid', project: 'Waithaka road rehabilitation', slug: 'waithaka-roads-1', at: iso(-55 * MIN) },
      { kind: 'resolved', ward: 'Kileleshwa', ward_id: 'kileleshwa', category: 'Garbage not collected', category_sw: 'Taka hazijakusanywa', at: iso(-2 * 60 * MIN), reference: 'NAI-RDEMO00002', days: 0 },
      { kind: 'poll', title: 'Which days should water rationing fall on in your ward?', slug: 'water-days-demo', at: iso(-2 * DAY) },
    ].slice(0, limit) as LiveItem[];
  }
  return rpc<LiveItem[]>('live_activity', { p_limit: limit });
}

// ---- community events ----

export type CommunityEvent = {
  id: string; ward_id: string; kind: 'cleanup' | 'tree_planting' | 'drainage' | 'other'; title: string; details: string | null; meet_at: string;
  starts_at: string; ends_at: string; status: 'scheduled' | 'cancelled' | 'held'; going: number; attended: number | null; outcome: string | null; created_at: string;
};
const EVENT_COLS = 'id, ward_id, kind, title, details, meet_at, starts_at, ends_at, status, going, attended, outcome, created_at';

export async function getEvents(): Promise<CommunityEvent[]> {
  if (await isDemo()) {
    const at = (d: number, h: number) => { const x = new Date(Date.now() + d * DAY); x.setHours(h, 0, 0, 0); return x.toISOString(); };
    return [
      { id: 'e1', ward_id: 'kawangware', kind: 'cleanup', title: 'Clean-up along the Kawangware market road (demo)', details: 'Gloves and bags provided by the county. Bring water.', meet_at: 'Kawangware market main gate', starts_at: at(3, 8), ends_at: at(3, 12), status: 'scheduled', going: 34, attended: null, outcome: null, created_at: iso(-2 * DAY) },
      { id: 'e2', ward_id: 'embakasi', kind: 'drainage', title: 'Unblock the drains before the rains (demo)', details: null, meet_at: 'Embakasi chief\'s camp', starts_at: at(9, 9), ends_at: at(9, 13), status: 'scheduled', going: 12, attended: null, outcome: null, created_at: iso(-1 * DAY) },
      { id: 'e3', ward_id: 'kileleshwa', kind: 'tree_planting', title: 'Tree planting at Kileleshwa primary (demo)', details: null, meet_at: 'School main gate', starts_at: at(-10, 9), ends_at: at(-10, 12), status: 'held', going: 51, attended: 47, outcome: '120 seedlings planted along the school fence.', created_at: iso(-20 * DAY) },
    ];
  }
  return must(await supabase!.from('community_events').select(EVENT_COLS).gte('ends_at', iso(-60 * DAY)).order('starts_at').limit(200)) as CommunityEvent[];
}

export async function getMyRsvps(): Promise<string[]> {
  if (await isDemo()) return [];
  const { data, error } = await supabase!.from('event_rsvps').select('event_id');
  if (error) throw error;
  return ((data ?? []) as { event_id: string }[]).map((r) => r.event_id);
}

export async function setRsvp(eventId: string, going: boolean): Promise<void> {
  if (await isDemo()) return;
  const q = going ? supabase!.from('event_rsvps').insert({ event_id: eventId }) : supabase!.from('event_rsvps').delete().eq('event_id', eventId);
  const { error } = await q;
  if (error && (error as { code?: string }).code !== '23505') throw error;
}

export async function createEvent(e: Pick<CommunityEvent, 'ward_id' | 'kind' | 'title' | 'details' | 'meet_at' | 'starts_at' | 'ends_at'>): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('community_events').insert(e);
  if (error) throw error;
}

export async function updateEvent(id: string, patch: Partial<Pick<CommunityEvent, 'status' | 'attended' | 'outcome'>>): Promise<void> {
  if (await isDemo()) return;
  const { data, error } = await supabase!.from('community_events').update(patch).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('not_allowed');
}

// ---- Ask your MCA ----

export type McaQuestion = { id: string; ward_id: string; body: string; votes: number; status: 'open' | 'answered'; hidden: boolean; answer: string | null; answered_at: string | null; created_at: string };
export type McaScore = { ward_id: string; asked: number; answered: number; on_time: number; waiting: number };

export async function getQuestions(wardId: string | null): Promise<McaQuestion[]> {
  if (await isDemo()) {
    const all: McaQuestion[] = [
      { id: 'q1', ward_id: 'kileleshwa', body: 'When will the drains on Laikipia Road be cleared before the rains? (demo)', votes: 41, status: 'answered', hidden: false, answer: 'The ward drainage crew starts on Laikipia Road on Monday; I will post photos when done. (demo)', answered_at: iso(-1 * DAY), created_at: iso(-5 * DAY) },
      { id: 'q2', ward_id: 'kileleshwa', body: 'Why has the Kileleshwa ECDE classroom been stalled since March? (demo)', votes: 27, status: 'open', hidden: false, answer: null, answered_at: null, created_at: iso(-3 * DAY) },
      { id: 'q3', ward_id: 'kawangware', body: 'Can the market get working toilets and water? (demo)', votes: 63, status: 'open', hidden: false, answer: null, answered_at: null, created_at: iso(-9 * DAY) },
    ];
    return wardId ? all.filter((q) => q.ward_id === wardId) : all;
  }
  let q = supabase!.from('mca_questions').select('id, ward_id, body, votes, status, hidden, answer, answered_at, created_at').eq('hidden', false).order('votes', { ascending: false }).limit(200);
  if (wardId) q = q.eq('ward_id', wardId);
  return must(await q) as McaQuestion[];
}

export async function getMyQuestionVotes(): Promise<string[]> {
  if (await isDemo()) return [];
  const { data, error } = await supabase!.from('mca_question_votes').select('question_id');
  if (error) throw error;
  return ((data ?? []) as { question_id: string }[]).map((r) => r.question_id);
}

export async function askQuestion(wardId: string, body: string): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('mca_questions').insert({ ward_id: wardId, body: body.trim() });
  if (error) throw error;
}

export async function voteQuestion(id: string, on: boolean): Promise<void> {
  if (await isDemo()) return;
  const q = on ? supabase!.from('mca_question_votes').insert({ question_id: id }) : supabase!.from('mca_question_votes').delete().eq('question_id', id);
  const { error } = await q;
  if (error && (error as { code?: string }).code !== '23505') throw error;
}

export async function answerQuestion(id: string, answer: string): Promise<void> {
  if (await isDemo()) return;
  const { data, error } = await supabase!.from('mca_questions').update({ answer: answer.trim() }).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('not_allowed');
}

export async function getMcaScoreboard(): Promise<McaScore[]> {
  if (await isDemo()) return [{ ward_id: 'kileleshwa', asked: 2, answered: 1, on_time: 1, waiting: 1 }, { ward_id: 'kawangware', asked: 1, answered: 0, on_time: 0, waiting: 1 }];
  return rpc<McaScore[]>('mca_scoreboard');
}
