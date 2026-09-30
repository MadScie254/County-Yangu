// Read and write side of the resident loop: was it fixed, is this permit real, what did the ward decide, who do I follow,
// what does my ward or committee look like, and the open data behind it all. Live first, labelled demo fallback.
import { supabase } from './client';
import { dataSource, getWardStats } from './public';
import { demoProjects, demoTenders } from './demo';
import type { PublicMeeting, BudgetResults, CommitteeView, FixStats, Follow, FollowKind, OcdsPackage, VerifyResult, WardScorecard } from './types';

const isDemo = async () => (await dataSource()) === 'demo' || !supabase;

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase!.rpc(name, args);
  if (error) throw error;
  return data as T;
}

// ---- was it fixed ----

export async function getFixStats(): Promise<FixStats> {
  if (await isDemo()) {
    return { responses: 46, fixed: 38, reopened: 8, by_ward: [{ ward_id: 'kileleshwa', ward: 'Kileleshwa', responses: 18, fixed: 16 }, { ward_id: 'kilimani', ward: 'Kilimani', responses: 15, fixed: 11 }, { ward_id: 'kawangware', ward: 'Kawangware', responses: 13, fixed: 11 }] };
  }
  return rpc<FixStats>('fix_confirmation_stats');
}

// ---- permits and receipts ----

export async function verifyDocument(code: string): Promise<VerifyResult> {
  const c = code.trim().toUpperCase();
  if (await isDemo()) {
    if (c === 'CY-DEMO-2026') return { kind: 'permit', valid: true, state: 'valid', service: 'Single business permit', holder: 'Mama Nuru Groceries', ward: 'Kileleshwa', issued_at: '2026-03-04T09:00:00Z', reference: 'NAI-A0000DEMO' };
    if (c === 'CY-VOID-2026') return { kind: 'permit', valid: false, state: 'revoked', service: 'Single business permit', holder: 'Sample Kiosk', ward: 'Kilimani', issued_at: '2026-01-12T09:00:00Z', revoked_at: '2026-02-01T09:00:00Z', revoked_reason: 'Issued in error' };
    return { kind: null, valid: false, state: 'unknown' };
  }
  return rpc<VerifyResult>('verify_document', { p_code: c });
}

export async function revokePermit(applicationId: string, reason: string): Promise<void> {
  if (await isDemo()) return;
  await rpc('revoke_document', { p_application: applicationId, p_reason: reason });
}

// ---- ward budget results and rounds ----

export async function getBudgetResults(cycle?: string | null): Promise<BudgetResults> {
  if (await isDemo()) {
    const o = (id: string, title: string, sector: string, amount: number, votes: number, funded: boolean) => ({ id, title, sector, amount, votes, funded });
    return {
      cycle: { id: 'demo-q2', title: 'Ward budget, Q2 (sample)', starts_at: '2026-04-01', ends_at: '2026-04-15', status: 'closed' },
      cycles: [{ id: 'demo-q2', title: 'Ward budget, Q2 (sample)' }],
      total_votes: 412,
      wards: [
        { ward_id: 'kileleshwa', ward: 'Kileleshwa', envelope: 12_000_000, votes: 231, options: [o('a', 'Streetlights on Othaya Road', 'Roads', 6_000_000, 118, true), o('b', 'Drainage clearing', 'Water', 4_000_000, 74, true), o('c', 'Playground repairs', 'Education', 5_000_000, 39, false)] },
        { ward_id: 'kawangware', ward: 'Kawangware', envelope: 10_000_000, votes: 181, options: [o('d', 'Borehole and water kiosk', 'Water', 7_000_000, 101, true), o('e', 'Market shed', 'Markets', 6_000_000, 80, false)] },
      ],
    };
  }
  return rpc<BudgetResults>('budget_results', { p_cycle: cycle ?? null });
}

export async function draftNextRound(): Promise<string | null> {
  if (await isDemo()) return '2026-q4';
  return rpc<string | null>('draft_next_round');
}

// ---- follows ----

const DEMO_FOLLOWS = 'cy-demo-follows';
const readDemo = (): Follow[] => { try { return JSON.parse(localStorage.getItem(DEMO_FOLLOWS) ?? '[]') as Follow[]; } catch { return []; } };
const writeDemo = (f: Follow[]) => { try { localStorage.setItem(DEMO_FOLLOWS, JSON.stringify(f)); } catch { /* private mode */ } };

export async function listFollows(): Promise<Follow[]> {
  if (await isDemo()) return readDemo();
  const { data: u } = await supabase!.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase!.from('follows').select('id, kind, key, label, created_at').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Follow[];
}

export async function follow(kind: FollowKind, key: string, label: string): Promise<void> {
  if (await isDemo()) {
    const all = readDemo();
    if (!all.some((f) => f.kind === kind && f.key === key)) writeDemo([{ id: `${kind}:${key}`, kind, key, label, created_at: new Date().toISOString() }, ...all]);
    return;
  }
  const { data: u } = await supabase!.auth.getUser();
  if (!u.user) throw new Error('signin');
  const { error } = await supabase!.from('follows').upsert({ user_id: u.user.id, kind, key, label }, { onConflict: 'user_id,kind,key', ignoreDuplicates: true });
  if (error) throw error;
}

export async function unfollow(kind: FollowKind, key: string): Promise<void> {
  if (await isDemo()) { writeDemo(readDemo().filter((f) => !(f.kind === kind && f.key === key))); return; }
  const { error } = await supabase!.from('follows').delete().eq('kind', kind).eq('key', key);
  if (error) throw error;
}

// ---- committees and scorecards ----

export async function getAssembly(): Promise<CommitteeView[]> {
  if (await isDemo()) {
    const projects = demoProjects();
    const tenders = demoTenders();
    const mk = (code: string, name: string, name_sw: string, sectors: string[], cases: CommitteeView['cases']): CommitteeView => {
      const p = projects.filter((x) => sectors.includes(x.sector.toLowerCase()));
      const t = tenders.filter((x) => sectors.includes(x.sector.toLowerCase()));
      return {
        code, name, name_sw, cases,
        projects: { count: p.length, budget: p.reduce((a, x) => a + x.budget, 0), spent: p.reduce((a, x) => a + x.spent, 0), stalled: p.filter((x) => x.status === 'stalled').length, completed: p.filter((x) => x.status === 'completed').length },
        tenders: { open: t.filter((x) => x.status === 'open').length, awarded: t.filter((x) => x.status === 'awarded').length, awarded_value: t.filter((x) => x.status === 'awarded').reduce((a, x) => a + (x.award_amount ?? x.estimated_budget), 0) },
        flags: 0,
        attention: p.filter((x) => x.status === 'stalled' || x.spent > x.budget).slice(0, 5).map((x) => ({ slug: x.slug, title: x.title, status: x.status, budget: x.budget, spent: x.spent })),
      };
    };
    return [
      mk('roads', 'Roads, Transport and Public Works', 'Barabara, Uchukuzi na Kazi za Umma', ['roads', 'transport'], { received_90d: 212, open: 58, overdue: 17, resolved_90d: 141, reopened: 9, median_days: 6.5 }),
      mk('water', 'Water, Environment and Sanitation', 'Maji, Mazingira na Usafi', ['water', 'environment', 'sanitation'], { received_90d: 168, open: 44, overdue: 12, resolved_90d: 112, reopened: 6, median_days: 5.2 }),
      mk('health', 'Health', 'Afya', ['health'], { received_90d: 63, open: 15, overdue: 3, resolved_90d: 44, reopened: 1, median_days: 4.1 }),
      mk('trade', 'Trade, Markets and Licensing', 'Biashara, Masoko na Leseni', ['markets', 'trade'], { received_90d: 57, open: 12, overdue: 2, resolved_90d: 41, reopened: 2, median_days: 7.8 }),
    ];
  }
  return rpc<CommitteeView[]>('assembly_dashboard');
}

export async function getWardScorecard(ward: string): Promise<WardScorecard | null> {
  if (await isDemo()) {
    const w = (await getWardStats()).find((x) => x.ward_id === ward);
    if (!w) return null;
    return {
      ward_id: w.ward_id, ward: w.name, constituency: w.constituency, population: w.population, sub_county: null, generated_at: new Date().toISOString(),
      cases: { received_90d: w.open_reports + w.resolved_90d, resolved_90d: w.resolved_90d, open: w.open_reports, overdue: w.overdue_reports, median_days: 6.2, reopened: 1 },
      confirmed: { responses: 9, fixed: 7 },
      top_categories: [{ category: 'Garbage not collected', category_sw: 'Taka hazijakusanywa', count: 14 }, { category: 'Pothole or damaged road', category_sw: 'Shimo au barabara iliyoharibika', count: 11 }],
      projects: { count: w.projects, budget: 0, spent: 0, stalled: 0, completed: w.projects_completed },
      tenders: { open: 1, awarded: 2, awarded_value: 0 },
      budget: { cycle: 'Ward budget (sample)', votes: w.votes_cast, envelope: null },
    };
  }
  return rpc<WardScorecard | null>('ward_scorecard', { p_ward: ward });
}

// ---- open data ----

export async function getOcds(limit = 100, offset = 0): Promise<OcdsPackage> {
  if (await isDemo()) {
    const t = demoTenders().slice(offset, offset + limit);
    return {
      uri: '/open/api', version: '1.1', publishedDate: new Date().toISOString(), publisher: { name: 'Sample County Government' }, license: 'https://creativecommons.org/licenses/by/4.0/',
      releases: t.map((x) => ({
        ocid: `ocds-ke-sample-${x.reference.toLowerCase()}`, id: `${x.id}-${x.status}`, date: x.awarded_at ?? x.published_at, tag: [x.status === 'awarded' ? 'award' : 'tender'], initiationType: 'tender',
        tender: { id: x.reference, title: x.title, value: { amount: x.estimated_budget, currency: 'KES' }, numberOfTenderers: x.applicants_count, mainProcurementCategory: x.sector.toLowerCase() },
        ...(x.status === 'awarded' && x.awarded_to ? { awards: [{ id: `${x.reference}-award`, value: { amount: x.award_amount ?? x.estimated_budget, currency: 'KES' }, suppliers: [{ name: x.awarded_to }] }] } : {}),
      })),
    };
  }
  return rpc<OcdsPackage>('ocds_releases', { p_limit: limit, p_offset: offset });
}

// ---- public participation calendar ----

function demoMeetings(): PublicMeeting[] {
  const day = (d: number, h: number) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  const m = (id: string, ward_id: string | null, kind: PublicMeeting['kind'], title: string, title_sw: string, venue: string, d: number, h: number, extra: Partial<PublicMeeting> = {}): PublicMeeting =>
    ({ id, ward_id, kind, title, title_sw, venue, agenda: null, starts_at: day(d, h), ends_at: day(d, h + 2), status: 'scheduled', outcome: null, attendance: null, ...extra });
  return [
    m('m1', 'kileleshwa', 'baraza', 'Ward baraza: drainage and street lighting', 'Baraza la wadi: mifereji na taa za barabarani', "Chief's camp, Kileleshwa", 4, 10, { agenda: 'Blocked drains on Othaya Road; streetlights promised in the last budget round; questions from residents.' }),
    m('m2', null, 'budget_hearing', 'County budget hearing 2027/28', 'Kikao cha bajeti ya kaunti 2027/28', 'City Hall, Nairobi', 9, 9, { agenda: 'Draft budget estimates for each department. Residents may speak for up to three minutes each.' }),
    m('m3', 'kawangware', 'town_hall', 'Town hall: water supply schedule', 'Mkutano wa hadhara: ratiba ya maji', 'Kawangware social hall', 12, 14),
    m('m4', 'kilimani', 'baraza', 'Ward baraza: parking and hawkers', 'Baraza la wadi: maegesho na wachuuzi', 'Kilimani primary school', -6, 10, { status: 'held', attendance: 142, outcome: 'Residents asked for a hawkers market off Ngong Road. The ward administrator will bring a site proposal to the next baraza.' }),
    m('m5', 'embakasi', 'baraza', 'Ward baraza: garbage collection', 'Baraza la wadi: ukusanyaji wa taka', 'Embakasi social hall', -2, 11, { status: 'cancelled' }),
  ];
}

export async function getMeetings(): Promise<PublicMeeting[]> {
  if (await isDemo()) return demoMeetings();
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString();
  const { data, error } = await supabase!.from('public_meetings').select('*').gte('starts_at', since).order('starts_at').limit(300);
  if (error) throw error;
  return (data ?? []) as PublicMeeting[];
}

export async function saveMeeting(m: Partial<PublicMeeting> & Pick<PublicMeeting, 'title' | 'venue' | 'starts_at' | 'ends_at' | 'kind'>): Promise<void> {
  if (await isDemo()) return;
  const { id, ...rest } = m;
  const q = id ? supabase!.from('public_meetings').update(rest).eq('id', id) : supabase!.from('public_meetings').insert(rest);
  const { error } = await q;
  if (error) throw error;
}

/** An .ics file so a resident can put the meeting in their phone's calendar. */
export function meetingIcs(m: PublicMeeting, title: string, url: string): string {
  const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//County Yangu//Meetings//EN', 'BEGIN:VEVENT',
    `UID:${m.id}@county-yangu`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(new Date(m.starts_at).toISOString())}`, `DTEND:${stamp(new Date(m.ends_at).toISOString())}`,
    `SUMMARY:${esc(title)}`, `LOCATION:${esc(m.venue)}`, `DESCRIPTION:${esc((m.agenda ? `${m.agenda}\n\n` : '') + url)}`,
    ...(m.status === 'cancelled' ? ['STATUS:CANCELLED'] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}
