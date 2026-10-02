// Browser side of migration 0022: fixed gallery, ward champions, procurement concerns, county finance, statements,
// polls and content flags. Live first; a labelled demo fallback keeps every screen working with no backend.
import { supabase } from './client';
import { dataSource } from './public';
import type {
  Champion, ChampionCheck, ConcernKind, CountyFinance, FixedItem, FlagKind, FlagReason, Poll, PollResults, StatementResults, TenderConcern,
} from './types';

const isDemo = async () => (await dataSource()) === 'demo' || !supabase;
const DAY = 86_400_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase!.rpc(name, args);
  if (error) throw error;
  return data as T;
}
const must = <T>(r: { data: T | null; error: unknown }): T => { if (r.error) throw r.error; return (r.data ?? ([] as unknown)) as T; };

export const fixPhotoUrl = (path: string) =>
  path.startsWith('demo:') ? path.slice(5) : `${import.meta.env.VITE_SUPABASE_URL ?? ''}/storage/v1/object/public/fix-photos/${path}`;

// ---- before and after ----

// Demo pictures are drawn, not photographed, and say so: a road before and after.
const svg = (body: string) => `demo:data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">${body}<text x="12" y="248" font-family="sans-serif" font-size="13" fill="#fff" opacity=".85">Demo illustration</text></svg>`)}`;
const roadBefore = svg('<rect width="400" height="260" fill="#8a7d6b"/><rect y="150" width="400" height="110" fill="#5b5249"/><ellipse cx="200" cy="200" rx="70" ry="22" fill="#2f2a25"/><ellipse cx="300" cy="220" rx="30" ry="9" fill="#2f2a25"/>');
const roadAfter = svg('<rect width="400" height="260" fill="#9db4c0"/><rect y="150" width="400" height="110" fill="#3b3f45"/><rect x="0" y="200" width="400" height="5" fill="#f5b400"/>');
const drainBefore = svg('<rect width="400" height="260" fill="#7d8a6b"/><rect y="170" width="400" height="90" fill="#4d5a3b"/><rect x="0" y="190" width="400" height="30" fill="#5f6b45"/><circle cx="120" cy="205" r="14" fill="#2d331f"/><circle cx="250" cy="200" r="18" fill="#2d331f"/>');
const drainAfter = svg('<rect width="400" height="260" fill="#a9c2a0"/><rect y="170" width="400" height="90" fill="#6b7a5b"/><rect x="0" y="190" width="400" height="30" fill="#5b8fb0"/>');

export async function getFixedGallery(limit = 24): Promise<FixedItem[]> {
  if (await isDemo()) {
    return [
      { reference: 'NAI-RDEMO0FIX1', category_id: 'pothole', category: 'Pothole or damaged road', category_sw: 'Shimo au barabara iliyoharibika', ward: 'Kileleshwa', ward_id: 'kileleshwa', reported_at: iso(-12 * DAY), resolved_at: iso(-2 * DAY), before: roadBefore, after: roadAfter },
      { reference: 'NAI-RDEMO0FIX2', category_id: 'drainage', category: 'Blocked drain or flooding', category_sw: 'Mfereji umeziba au mafuriko', ward: 'Kawangware', ward_id: 'kawangware', reported_at: iso(-9 * DAY), resolved_at: iso(-4 * DAY), before: drainBefore, after: drainAfter },
    ];
  }
  return rpc<FixedItem[]>('fixed_gallery', { p_limit: limit });
}

// ---- ward champions ----

export async function getChampions(): Promise<Champion[]> {
  if (await isDemo()) {
    return [
      { ward_id: 'kileleshwa', display_name: 'Wanjiru K.', status: 'active', approved_at: iso(-40 * DAY), created_at: iso(-45 * DAY) },
      { ward_id: 'kawangware', display_name: 'Otieno M.', status: 'active', approved_at: iso(-20 * DAY), created_at: iso(-22 * DAY) },
      { ward_id: 'embakasi', display_name: 'Amina H.', status: 'active', approved_at: iso(-8 * DAY), created_at: iso(-10 * DAY) },
    ];
  }
  return must(await supabase!.from('ward_champions').select('ward_id, display_name, status, approved_at, created_at').eq('status', 'active').order('ward_id')) as Champion[];
}

export async function getMyChampion(userId: string | undefined): Promise<Champion | null> {
  if (!userId || (await isDemo())) return null;
  const { data, error } = await supabase!.from('ward_champions').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as Champion | null;
}

export async function applyChampion(c: { ward_id: string; display_name: string; motivation: string }): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('ward_champions').insert({ ward_id: c.ward_id, display_name: c.display_name.trim(), motivation: c.motivation.trim() || null });
  if (error) throw error;
}

export async function getChampionQueue(): Promise<Champion[]> {
  if (await isDemo()) return [{ ward_id: 'kilimani', display_name: 'Njeri W.', status: 'applied', approved_at: null, created_at: iso(-1 * DAY), user_id: 'demo-user', motivation: 'I run a residents association and walk the ward weekly.' }];
  return must(await supabase!.from('ward_champions').select('*').order('created_at', { ascending: false }).limit(500)) as Champion[];
}

export async function decideChampion(userId: string, status: Champion['status']): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('ward_champions').update({ status }).eq('user_id', userId);
  if (error) throw error;
}

export async function getChampionChecks(slug: string): Promise<ChampionCheck[]> {
  if (await isDemo()) return [{ verdict: 'not_as_shown', comment: 'The drainage on the east side is not finished. (Demo)', at: iso(-3 * DAY), champion: 'Wanjiru K.' }];
  return rpc<ChampionCheck[]>('champion_checks_for', { p_slug: slug });
}

export async function postChampionCheck(projectId: string, verdict: ChampionCheck['verdict'], comment: string): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('champion_checks').insert({ project_id: projectId, verdict, comment: comment.trim() || null });
  if (error) throw error;
}

// ---- procurement concerns ----

export const concernLate = (c: Pick<TenderConcern, 'status' | 'due_at'>, now = Date.now()) => c.status === 'submitted' && Date.parse(c.due_at) < now;

export async function getConcerns(): Promise<TenderConcern[]> {
  if (await isDemo()) {
    const c = (id: string, kind: ConcernKind, body: string, ago: number, extra: Partial<TenderConcern> = {}): TenderConcern =>
      ({ id, reference: `NAI-C${id.toUpperCase().padEnd(10, '0')}`, tender_id: 't-demo', kind, body, status: 'submitted', response: null, escalated_to: null, due_at: iso(-ago * DAY + 14 * DAY), answered_at: null, created_at: iso(-ago * DAY), ...extra });
    return [
      c('d1', 'short_deadline', 'Bidders were given only three days to respond to the drainage tender. (Demo)', 20, { status: 'fixed', response: 'The deadline was extended to 21 days and the tender re-advertised.', answered_at: iso(-12 * DAY) }),
      c('d2', 'single_bid', 'Only one company bid for the market shed tender. (Demo)', 18),
      c('d3', 'price_inflated', 'The price for 40 streetlights is three times the usual market rate. (Demo)', 4),
    ];
  }
  return must(await supabase!.from('tender_concerns').select('id, reference, tender_id, kind, body, status, response, escalated_to, due_at, answered_at, created_at').order('created_at', { ascending: false }).limit(300)) as TenderConcern[];
}

export async function fileConcern(c: { tender_id: string; kind: ConcernKind; body: string }): Promise<{ reference: string } | null> {
  if (await isDemo()) return { reference: 'NAI-CDEMO000001' };
  const { data, error } = await supabase!.from('tender_concerns').insert(c).select('reference').single();
  if (error) throw error;
  return data as { reference: string };
}

export async function updateConcern(id: string, patch: Partial<Pick<TenderConcern, 'status' | 'response' | 'escalated_to'>>): Promise<void> {
  if (await isDemo()) return;
  // a row the caller may not change is silently skipped by row security, so count what actually changed
  const { data, error } = await supabase!.from('tender_concerns').update(patch).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('not_allowed');
}

// ---- county finance ----

/** Kenya's 47 counties, by their official code. */
export const KENYA_COUNTIES: [number, string][] = [
  [1, 'Mombasa'], [2, 'Kwale'], [3, 'Kilifi'], [4, 'Tana River'], [5, 'Lamu'], [6, 'Taita Taveta'], [7, 'Garissa'], [8, 'Wajir'], [9, 'Mandera'], [10, 'Marsabit'],
  [11, 'Isiolo'], [12, 'Meru'], [13, 'Tharaka Nithi'], [14, 'Embu'], [15, 'Kitui'], [16, 'Machakos'], [17, 'Makueni'], [18, 'Nyandarua'], [19, 'Nyeri'], [20, 'Kirinyaga'],
  [21, "Murang'a"], [22, 'Kiambu'], [23, 'Turkana'], [24, 'West Pokot'], [25, 'Samburu'], [26, 'Trans Nzoia'], [27, 'Uasin Gishu'], [28, 'Elgeyo Marakwet'], [29, 'Nandi'], [30, 'Baringo'],
  [31, 'Laikipia'], [32, 'Nakuru'], [33, 'Narok'], [34, 'Kajiado'], [35, 'Kericho'], [36, 'Bomet'], [37, 'Kakamega'], [38, 'Vihiga'], [39, 'Bungoma'], [40, 'Busia'],
  [41, 'Siaya'], [42, 'Kisumu'], [43, 'Homa Bay'], [44, 'Migori'], [45, 'Kisii'], [46, 'Nyamira'], [47, 'Nairobi'],
];
export const countyName = new Map(KENYA_COUNTIES);

export async function getCountyFinance(): Promise<CountyFinance[]> {
  if (await isDemo()) {
    // Invented figures for the demo only: the page labels them as such.
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const ops: CountyFinance['audit_opinion'][] = ['unqualified', 'qualified', 'qualified', 'adverse', 'disclaimer', 'qualified'];
    return KENYA_COUNTIES.map(([code]) => {
      const dev = Math.round((1.5 + rnd() * 6) * 1e9);
      const osrT = Math.round((0.3 + rnd() * 3) * 1e9);
      return { county_code: code, fiscal_year: '2024/25', dev_budget: dev, dev_spent: Math.round(dev * (0.25 + rnd() * 0.65)), rec_budget: Math.round(dev * 2.2), rec_spent: Math.round(dev * 2.2 * (0.8 + rnd() * 0.18)),
        osr_target: osrT, osr_actual: Math.round(osrT * (0.45 + rnd() * 0.6)), pending_bills: Math.round(rnd() * 4e9), audit_opinion: ops[Math.floor(rnd() * ops.length)]!, source: 'Demo figures', source_url: null, updated_at: iso(-30 * DAY) };
    });
  }
  return must(await supabase!.from('county_finance').select('*').order('fiscal_year', { ascending: false }).limit(1000)) as CountyFinance[];
}

export async function saveCountyFinance(rows: Omit<CountyFinance, 'updated_at'>[]): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('county_finance').upsert(rows, { onConflict: 'county_code,fiscal_year' });
  if (error) throw error;
}

// ---- statements (Pol.is-style) ----

export async function getStatementResults(slug: string): Promise<StatementResults> {
  if (await isDemo()) {
    const statements = [
      { id: 1, body: 'Parking fees should be lower for boda boda riders.', created_at: iso(-4 * DAY), agree: 0, disagree: 0, pass: 0 },
      { id: 2, body: 'Money from parking should fix estate roads first.', created_at: iso(-3 * DAY), agree: 0, disagree: 0, pass: 0 },
      { id: 3, body: 'One business permit is better than three separate licences.', created_at: iso(-3 * DAY), agree: 0, disagree: 0, pass: 0 },
      { id: 4, body: 'Daily parking in the CBD should cost more to cut traffic.', created_at: iso(-2 * DAY), agree: 0, disagree: 0, pass: 0 },
      { id: 5, body: 'Small kiosks should pay their permit monthly by M-Pesa.', created_at: iso(-1 * DAY), agree: 0, disagree: 0, pass: 0 },
    ];
    // two clear opinion groups plus agreement on 3 and 5, so the page has something to show
    const votes: [number, number, -1 | 0 | 1][] = [];
    for (let p = 1; p <= 24; p++) {
      const g = p % 2;
      votes.push([p, 1, g ? 1 : -1], [p, 2, 1], [p, 3, 1], [p, 4, g ? -1 : 1], [p, 5, p % 5 === 0 ? 0 : 1]);
    }
    for (const [, s, v] of votes) { const st = statements[s - 1]!; if (v === 1) st.agree++; else if (v === -1) st.disagree++; else st.pass++; }
    return slug === 'finance-bill-demo' ? { statements, participants: 24, votes } : { statements: [], participants: 0, votes: [] };
  }
  return rpc<StatementResults>('statement_results', { p_slug: slug });
}

export async function getMyStatementVotes(): Promise<Record<number, -1 | 0 | 1>> {
  if (await isDemo()) return {};
  const { data, error } = await supabase!.from('statement_votes').select('statement_id, vote');
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as { statement_id: number; vote: -1 | 0 | 1 }[]).map((v) => [v.statement_id, v.vote]));
}

export async function voteStatement(statementId: number, vote: -1 | 0 | 1): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('statement_votes').upsert({ statement_id: statementId, vote }, { onConflict: 'statement_id,user_id' });
  if (error) throw error;
}

export async function addStatement(consultationId: string, body: string): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('consultation_statements').insert({ consultation_id: consultationId, body: body.trim() });
  if (error) throw error;
}

/**
 * Opinion groups from the vote matrix, the way Pol.is does it in spirit: two-means clustering of participants by how
 * they voted, then the statements each group sees differently. Pure, so it is unit-tested.
 */
export function opinionGroups(votes: [number, number, -1 | 0 | 1][], statementIds: number[]): { groups: { size: number; mean: Record<number, number> }[] } | null {
  const people = [...new Set(votes.map((v) => v[0]))];
  if (people.length < 6 || statementIds.length < 2) return null;
  const idx = new Map(statementIds.map((s, i) => [s, i]));
  const vec = new Map(people.map((p) => [p, new Array(statementIds.length).fill(0) as number[]]));
  for (const [p, s, v] of votes) { const i = idx.get(s); if (i !== undefined) vec.get(p)![i] = v; }
  const pts = people.map((p) => vec.get(p)!);
  const dist = (a: number[], b: number[]) => a.reduce((n, x, i) => n + (x - b[i]!) ** 2, 0);
  // start from the two people who disagree most, so the result is the same every time
  let a = 0, b = 1, best = -1;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const d = dist(pts[i]!, pts[j]!); if (d > best) { best = d; a = i; b = j; } }
  let c = [pts[a]!.slice(), pts[b]!.slice()];
  let assign: number[] = [];
  for (let iter = 0; iter < 20; iter++) {
    assign = pts.map((p) => (dist(p, c[0]!) <= dist(p, c[1]!) ? 0 : 1));
    const next = [0, 1].map((g) => {
      const mem = pts.filter((_, i) => assign[i] === g);
      return mem.length ? statementIds.map((_, k) => mem.reduce((n, p) => n + p[k]!, 0) / mem.length) : c[g]!;
    });
    if (JSON.stringify(next) === JSON.stringify(c)) break;
    c = next;
  }
  const groups = [0, 1].map((g) => ({ size: assign.filter((x) => x === g).length, mean: Object.fromEntries(statementIds.map((s, k) => [s, c[g]![k]!])) }));
  if (groups.some((g) => g.size < 2)) return null;
  return { groups };
}

// ---- polls ----

export async function getPolls(): Promise<Poll[]> {
  if (await isDemo()) {
    return [
      { id: 'p1', slug: 'water-days-demo', question: 'Which days should water rationing fall on in your ward?', question_sw: 'Ni siku gani mgao wa maji unafaa kuwa katika wadi yako?', options: [{ id: 'a', label: 'Monday and Thursday', label_sw: 'Jumatatu na Alhamisi' }, { id: 'b', label: 'Tuesday and Friday', label_sw: 'Jumanne na Ijumaa' }, { id: 'c', label: 'Weekends only', label_sw: 'Wikendi tu' }], ward_id: null, opens_at: iso(-2 * DAY), closes_at: iso(5 * DAY) },
      { id: 'p2', slug: 'market-hours-demo', question: 'Should the city market open at 5am instead of 6am?', question_sw: 'Je, soko la jiji lifunguliwe saa kumi na moja asubuhi badala ya saa kumi na mbili?', options: [{ id: 'y', label: 'Yes', label_sw: 'Ndiyo' }, { id: 'n', label: 'No', label_sw: 'Hapana' }], ward_id: null, opens_at: iso(-20 * DAY), closes_at: iso(-6 * DAY) },
    ];
  }
  return must(await supabase!.from('polls').select('*').order('closes_at', { ascending: false }).limit(100)) as Poll[];
}

export async function getPollResults(slug: string): Promise<PollResults> {
  if (await isDemo()) {
    if (slug === 'water-days-demo') return { total: 412, by_option: { a: 188, b: 151, c: 73 }, by_ward: [] };
    return { total: 960, by_option: { y: 611, n: 349 }, by_ward: [] };
  }
  return (await rpc<PollResults | null>('poll_results', { p_slug: slug })) ?? { total: 0, by_option: {}, by_ward: [] };
}

export async function getMyPollVotes(): Promise<Record<string, string>> {
  if (await isDemo()) return {};
  const { data, error } = await supabase!.from('poll_votes').select('poll_id, option_id');
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as { poll_id: string; option_id: string }[]).map((v) => [v.poll_id, v.option_id]));
}

export async function votePoll(pollId: string, optionId: string, wardId: string | null): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('poll_votes').insert({ poll_id: pollId, option_id: optionId, ward_id: wardId });
  if (error) throw error;
}

export async function savePoll(p: Omit<Poll, 'id'> & { id?: string }): Promise<void> {
  if (await isDemo()) return;
  const { id, ...rest } = p;
  const q = id ? supabase!.from('polls').update(rest).eq('id', id) : supabase!.from('polls').insert(rest);
  const { error } = await q;
  if (error) throw error;
}

// ---- flags and moderation ----

export async function flagContent(kind: FlagKind, targetId: string, reason: FlagReason): Promise<void> {
  if (await isDemo()) return;
  const { error } = await supabase!.from('content_flags').insert({ kind, target_id: targetId, reason });
  if (error && (error as { code?: string }).code !== '23505') throw error;
}

export type ModerationItem = { kind: FlagKind; target_id: string; flags: number; reasons: FlagReason[]; last: string; text: string | null; hidden: boolean | null };
export async function getModerationQueue(): Promise<ModerationItem[]> {
  if (await isDemo()) return [{ kind: 'consultation_comment', target_id: '1', flags: 3, reasons: ['abuse'], last: iso(-1 * DAY), text: 'An insulting comment would show here. (Demo)', hidden: true }];
  return rpc<ModerationItem[]>('moderation_queue');
}
export async function moderate(kind: FlagKind, targetId: string, remove: boolean): Promise<void> {
  if (await isDemo()) return;
  await rpc('moderate', { p_kind: kind, p_target: targetId, p_remove: remove });
}

// ---- whistleblower inbox, staff side ----

export type InboxItem = { id: string; reference: string; topic: string; ward_id: string | null; status: string; referred_to: string | null; created_at: string; updated_at: string; messages: { from_reporter: boolean; body: string; at: string }[] };
export async function getDisclosureInbox(): Promise<InboxItem[]> {
  if (await isDemo()) {
    return [{ id: 'w1', reference: 'NAI-WDEMO00001', topic: 'procurement', ward_id: 'kileleshwa', status: 'received', referred_to: null, created_at: iso(-2 * DAY), updated_at: iso(-2 * DAY),
      messages: [{ from_reporter: true, body: 'The roads tender was decided before the bids were opened. (Demo)', at: iso(-2 * DAY) }] }];
  }
  return rpc<InboxItem[]>('disclosure_inbox');
}
export async function answerDisclosure(id: string, body: string | null, status: string | null, referredTo: string | null): Promise<void> {
  if (await isDemo()) return;
  await rpc('disclosure_answer', { p_id: id, p_body: body, p_status: status, p_referred_to: referredTo });
}

// ---- before / after upload (staff) ----

export async function uploadFixPhoto(reportId: string, kind: 'before' | 'after', file: Blob, caption: string | null): Promise<void> {
  if (await isDemo()) return;
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${reportId}/${kind}-${Date.now()}.${ext}`;
  const up = await supabase!.storage.from('fix-photos').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (up.error) throw up.error;
  const { error } = await supabase!.from('fix_photos').insert({ report_id: reportId, kind, path, caption });
  if (error) throw error;
}
