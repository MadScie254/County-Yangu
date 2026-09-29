// Deterministic sample data for the staff console, used only when no backend is reachable.
// It persists to localStorage so actions (assign, resolve, decide) survive a reload and the whole
// workflow can be explored and demonstrated before the county's database is connected.
import { wards, subCounties, subCountyById } from '@/shared/config/county';
import { categoryIds } from '@/shared/data/categories';
import { uuid } from '@/shared/lib/utils';
import type { AuditRow, CaseEvent, CaseRow, Category, Dept, ReviewApp, RoleGrant, RoutingRule, StaffMember } from './types';

const KEY = 'cy-console-demo-v2';

function rng(seed: string) {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    a ^= seed.charCodeAt(i);
    a = Math.imul(a, 16777619);
  }
  a >>>= 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const demoDepts: Dept[] = [
  ['roads', 'Roads, Transport & Public Works'], ['water', 'Water, Sanitation & Drainage'], ['environment', 'Environment, Waste & Climate'],
  ['health', 'Health Services'], ['education', 'Education & Vocational Training'], ['planning', 'Urban Planning & Development Control'],
  ['trade', 'Trade, Markets & Licensing'], ['safety', 'Public Safety, Inspectorate & Disaster'], ['finance', 'Finance & Revenue'], ['integrity', 'Integrity, Ethics & Audit Desk'],
].map(([code, name]) => ({ id: `dept-${code}`, code: code!, name: name! }));

const catMeta: Record<string, { dept: string; ack: [number, 'hours' | 'working_days']; fix: [number, 'hours' | 'working_days']; prio: Category['default_priority']; sensitive?: boolean; name: string }> = {
  pothole: { dept: 'roads', ack: [2, 'working_days'], fix: [21, 'working_days'], prio: 'normal', name: 'Pothole or damaged road' },
  streetlight: { dept: 'roads', ack: [2, 'working_days'], fix: [10, 'working_days'], prio: 'normal', name: 'Streetlight not working' },
  water_main: { dept: 'water', ack: [2, 'hours'], fix: [24, 'hours'], prio: 'urgent', name: 'Burst water main' },
  sewer: { dept: 'water', ack: [8, 'hours'], fix: [72, 'hours'], prio: 'high', name: 'Blocked or overflowing sewer' },
  drainage: { dept: 'water', ack: [1, 'working_days'], fix: [5, 'working_days'], prio: 'high', name: 'Blocked drain or flooding' },
  garbage: { dept: 'environment', ack: [1, 'working_days'], fix: [3, 'working_days'], prio: 'normal', name: 'Uncollected garbage' },
  dumping: { dept: 'environment', ack: [2, 'working_days'], fix: [7, 'working_days'], prio: 'normal', name: 'Illegal dumping' },
  health_facility: { dept: 'health', ack: [2, 'working_days'], fix: [14, 'working_days'], prio: 'high', name: 'Health facility problem' },
  school: { dept: 'education', ack: [3, 'working_days'], fix: [30, 'working_days'], prio: 'normal', name: 'School infrastructure' },
  market: { dept: 'trade', ack: [2, 'working_days'], fix: [14, 'working_days'], prio: 'normal', name: 'Market or trading space' },
  illegal_build: { dept: 'planning', ack: [2, 'working_days'], fix: [14, 'working_days'], prio: 'high', name: 'Illegal or unsafe construction' },
  safety_hazard: { dept: 'safety', ack: [2, 'hours'], fix: [48, 'hours'], prio: 'urgent', name: 'Public safety hazard' },
  abandoned: { dept: 'integrity', ack: [2, 'working_days'], fix: [21, 'working_days'], prio: 'high', sensitive: true, name: 'Abandoned or stalled project' },
  missing_funds: { dept: 'integrity', ack: [2, 'working_days'], fix: [30, 'working_days'], prio: 'high', sensitive: true, name: 'Suspected misuse of funds' },
  other: { dept: 'environment', ack: [2, 'working_days'], fix: [14, 'working_days'], prio: 'normal', name: 'Something else' },
};

export const demoCategories: Category[] = categoryIds.map((id) => {
  const m = catMeta[id]!;
  return { id, name: m.name, department_id: `dept-${m.dept}`, ack_value: m.ack[0], ack_unit: m.ack[1], resolve_value: m.fix[0], resolve_unit: m.fix[1], default_priority: m.prio, sensitive: Boolean(m.sensitive), active: true };
});

export const demoStaff: StaffMember[] = [
  { user_id: 'u-rita', name: 'Rita Wanjiru', role: 'officer', department_id: 'dept-roads', sub_county_id: null, ward_id: null },
  { user_id: 'u-david', name: 'David Otieno', role: 'officer', department_id: 'dept-water', sub_county_id: null, ward_id: null },
  { user_id: 'u-grace', name: 'Grace Achieng', role: 'officer', department_id: 'dept-environment', sub_county_id: null, ward_id: null },
  { user_id: 'u-peter', name: 'Peter Kamau', role: 'chief_officer', department_id: 'dept-roads', sub_county_id: null, ward_id: null },
  { user_id: 'u-lucy', name: 'Lucy Mwende', role: 'sub_county_admin', department_id: null, sub_county_id: 'westlands', ward_id: null },
  { user_id: 'u-omar', name: 'Omar Hassan', role: 'officer', department_id: 'dept-integrity', sub_county_id: null, ward_id: null },
  { user_id: 'u-faith', name: 'Faith Njeri', role: 'officer', department_id: 'dept-trade', sub_county_id: null, ward_id: null },
  { user_id: 'u-admin', name: 'County Administrator', role: 'admin', department_id: null, sub_county_id: null, ward_id: null },
];

export const demoRules = (): RoutingRule[] => demoCategories.map((c) => ({ id: `rr-${c.id}`, category_id: c.id, ward_id: null, department_id: c.department_id!, officer_id: null }));

type Db = { cases: CaseRow[]; events: Record<string, CaseEvent[]>; reviews: ReviewApp[]; roles: RoleGrant[]; audit: AuditRow[] };

const descriptions: Record<string, string[]> = {
  pothole: ['Large pothole on the road beside the market. Matatus swerve into oncoming traffic.', 'Deep pothole outside the school gate. A child nearly fell in last week.'],
  streetlight: ['Three streetlights on the main road have been off for two weeks.', 'The high-mast light at the junction is dark. Muggings reported.'],
  water_main: ['Burst pipe flooding the road. Water has been running since morning.'],
  sewer: ['Sewer overflowing into the compound of the plot next to the church.'],
  drainage: ['Drain is blocked with plastic. The road floods every time it rains.'],
  garbage: ['Garbage not collected for three weeks. Piles are blocking the footpath.', 'The skip near the market is overflowing.'],
  dumping: ['People dump construction waste at night at the end of the road.'],
  health_facility: ['The dispensary has no drugs and the lab has been closed for a month.'],
  school: ['Classroom roof is leaking. Pupils are sent home when it rains.'],
  market: ['Stalls are being allocated to non-traders. Genuine traders are being pushed out.'],
  illegal_build: ['Multi-storey building going up without a board or approval. Cracks visible.'],
  safety_hazard: ['Open manhole at the junction, no cover. Very dangerous at night.'],
  abandoned: ['The borehole project has been abandoned for a year. The contractor left the site.'],
  missing_funds: ['The road tender was paid in full but only half of the work was done.'],
  other: ['Stray dogs attacking people near the bus stage.'],
};

function iso(msAgo: number) {
  return new Date(Date.now() - msAgo).toISOString();
}

function dueFrom(created: number, v: number, unit: 'hours' | 'working_days') {
  const days = unit === 'hours' ? v / 24 : Math.ceil(v * 1.4); // working days to calendar days, roughly
  return new Date(created + days * 86_400_000).toISOString();
}

export function levelFor(c: Pick<CaseRow, 'status' | 'ack_due_at' | 'resolve_due_at' | 'acknowledged_at' | 'created_at'>): number {
  if (c.status === 'resolved' || c.status === 'closed' || c.status === 'rejected') return 0;
  const now = Date.now();
  let lvl = 0;
  if (!c.acknowledged_at && c.ack_due_at && now > new Date(c.ack_due_at).getTime()) lvl = 1;
  if (!c.acknowledged_at && now > new Date(c.created_at).getTime() + 7 * 86_400_000) lvl = 2;
  if (c.resolve_due_at && now > new Date(c.resolve_due_at).getTime()) lvl = 3;
  if (c.resolve_due_at && now > new Date(c.resolve_due_at).getTime() + 30 * 86_400_000) lvl = 4;
  return lvl;
}

function generate(): Db {
  const r = rng('console');
  const channels = ['web', 'web', 'web', 'ussd', 'ussd', 'sms', 'ivr'];
  const cases: CaseRow[] = [];
  const events: Record<string, CaseEvent[]> = {};
  for (let i = 0; i < 60; i++) {
    const cat = categoryIds[Math.floor(r() * categoryIds.length)]!;
    const meta = catMeta[cat]!;
    const w = wards[Math.floor(r() * wards.length)]!;
    const sc = subCountyById.get(w.subCountyId ?? '') ?? subCounties[0]!;
    const ageDays = r() < 0.15 ? 35 + r() * 30 : r() * 28;
    const created = Date.now() - ageDays * 86_400_000;
    const roll = r();
    const status: CaseRow['status'] = roll < 0.2 ? 'resolved' : roll < 0.28 ? 'closed' : roll < 0.5 ? 'in_progress' : roll < 0.72 ? 'assigned' : roll < 0.82 ? 'triaged' : 'received';
    const officers = demoStaff.filter((s) => s.department_id === `dept-${meta.dept}` && s.role === 'officer');
    const assigned = status === 'received' ? null : (officers[0]?.user_id ?? null);
    const ack = status === 'received' ? null : new Date(created + r() * 2 * 86_400_000).toISOString();
    const row: CaseRow = {
      id: `case-${i}`,
      reference: `NAI-R${Math.floor(r() * 0xffffffffff).toString(16).toUpperCase().padStart(10, '0')}`,
      ward_id: w.id, category_id: cat, department_id: `dept-${meta.dept}`,
      description: descriptions[cat]![Math.floor(r() * descriptions[cat]!.length)]!,
      status, priority: meta.prio, channel: channels[Math.floor(r() * channels.length)]!, assigned_to: assigned,
      flagged_financial: Boolean(meta.sensitive), ack_due_at: dueFrom(created, meta.ack[0], meta.ack[1]), resolve_due_at: dueFrom(created, meta.fix[0], meta.fix[1]),
      acknowledged_at: ack, resolved_at: status === 'resolved' || status === 'closed' ? new Date(created + 6 * 86_400_000).toISOString() : null, escalation_level: 0,
      created_at: new Date(created).toISOString(), updated_at: new Date(Math.min(Date.now(), created + 3 * 86_400_000)).toISOString(),
      lat: (sc.lat ?? -1.29) + (r() - 0.5) * 0.03, lng: (sc.lng ?? 36.82) + (r() - 0.5) * 0.03, project_id: null,
    };
    row.escalation_level = levelFor(row);
    cases.push(row);
    const ev: CaseEvent[] = [{ id: uuid(), kind: 'created', actor_id: null, is_public: true, message: 'Report received', data: { channel: row.channel }, created_at: row.created_at }];
    if (assigned) ev.push({ id: uuid(), kind: 'assigned', actor_id: null, is_public: false, message: 'Routed by rule', data: {}, created_at: row.created_at });
    if (status === 'in_progress') ev.push({ id: uuid(), kind: 'status', actor_id: assigned, is_public: true, message: 'Crew dispatched', data: {}, created_at: row.updated_at });
    for (let l = 1; l <= row.escalation_level; l++) ev.push({ id: uuid(), kind: l === 1 ? 'reminder' : 'escalated', actor_id: null, is_public: l >= 3, message: ['', 'Reminder sent: waiting to be acknowledged', 'Escalated to the sub-county administrator', 'Past its target date; escalated to the chief officer', 'Escalated to the CEC member and Assembly committee'][l]!, data: { level: l }, created_at: iso((5 - l) * 86_400_000) });
    events[row.id] = ev;
  }

  const svcNames = ['Single Business Permit', 'Building plan approval', 'Seasonal parking', 'County bursary'];
  const reviews: ReviewApp[] = Array.from({ length: 10 }, (_, i) => {
    const names = ['Amina Yusuf', 'John Mwangi', 'Wanjiku Kariuki', 'Peter Ochieng', 'Halima Ali', 'Brian Kiprop', 'Mary Atieno', 'Samuel Njoroge', 'Zainab Omar', 'Kevin Mutua'];
    const st = ['submitted', 'submitted', 'under_review', 'submitted', 'changes_requested', 'submitted', 'approved', 'submitted', 'under_review', 'rejected'][i]!;
    const created = Date.now() - (i * 1.7 + 0.5) * 86_400_000;
    return {
      id: `app-${i}`, reference: `NAI-A${(1000000 + i * 7919).toString(16).toUpperCase().padStart(10, '0')}`, service_id: `svc-${i % 4}`, service_name: svcNames[i % 4]!, applicant_name: names[i]!, applicant_phone: `+2547${10000000 + i * 1234567}`.slice(0, 13),
      business_name: i % 4 === 0 ? `${names[i]!.split(' ')[1]} Traders` : null, kra_pin: i % 4 === 0 ? `A00${i}234567Z` : null, ward_id: wards[i * 7 % wards.length]!.id, status: st, amount: [5000, 25000, 3000, 0][i % 4]!,
      form_data: { business_activity: 'Retail shop', premises: 'shop' }, decision_note: st === 'changes_requested' ? 'Please attach a clearer copy of your ID.' : null, due_at: new Date(created + 7 * 86_400_000).toISOString(), created_at: new Date(created).toISOString(),
    };
  });

  const roles: RoleGrant[] = demoStaff.map((s, i) => ({ id: `role-${i}`, user_id: s.user_id, role: s.role, department_id: s.department_id, sub_county_id: s.sub_county_id, ward_id: s.ward_id, active: true, expires_at: null, name: s.name, email: `${s.name.toLowerCase().replace(/[^a-z]+/g, '.')}@county.go.ke` }));
  return { cases, events, reviews, roles, audit: [] };
}

let cache: Db | null = null;

export function db(): Db {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Db) : generate();
  } catch {
    cache = generate();
  }
  return cache;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

export function resetDemo() {
  cache = generate();
  save();
}

export function audit(entity: string, entity_id: string, action: string) {
  const d = db();
  d.audit.unshift({ id: d.audit.length + 1, at: new Date().toISOString(), actor_id: 'u-demo', via: 'authenticated', action, entity, entity_id });
}
