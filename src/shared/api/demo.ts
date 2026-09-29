// Deterministic sample data. Used only when no backend is reachable, and always labelled
// "Demo data" in the UI. Seeded per ward so the picture is stable between reloads.
import { wards, subCountyById, subCounties, county } from '@/shared/config/county';
import type { ActivityItem, PulseSummary, BudgetCycle, Proposal, ProjectOption, CountySummary, PublicProject, PublicTender, ProjectStatus, WardStat } from './types';

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function demoWardStats(): WardStat[] {
  return wards.map((w) => {
    const r = rng(`stat:${w.id}`);
    const open = 2 + Math.floor(r() * 38);
    const projects = Math.floor(r() * 4);
    return {
      ward_id: w.id,
      name: w.name,
      sub_county_id: w.subCountyId,
      constituency: subCountyById.get(w.subCountyId ?? '')?.name ?? '',
      population: null,
      open_reports: open,
      overdue_reports: Math.floor(open * r() * 0.45),
      resolved_90d: Math.floor(r() * 70),
      projects,
      projects_completed: Math.min(projects, Math.floor(r() * 3)),
      votes_cast: Math.floor(r() * 900),
      trust_index: Math.round((32 + r() * 58) * 10) / 10,
    };
  });
}

export function demoSummary(stats = demoWardStats()): CountySummary {
  const sum = (f: (s: WardStat) => number) => stats.reduce((a, s) => a + f(s), 0);
  return {
    votes_cast: sum((s) => s.votes_cast),
    reports_filed: sum((s) => s.open_reports + s.resolved_90d),
    reports_resolved: sum((s) => s.resolved_90d),
    reports_overdue: sum((s) => s.overdue_reports),
    milestones_hit: sum((s) => s.projects_completed * 4 + s.projects),
    projects_published: sum((s) => s.projects),
  };
}

const projectTemplates: { title: string; sector: string; budget: number }[] = [
  { title: 'Road rehabilitation and drainage', sector: 'Roads', budget: 84_000_000 },
  { title: 'Borehole and piped water extension', sector: 'Water', budget: 32_500_000 },
  { title: 'Health centre maternity wing', sector: 'Health', budget: 58_000_000 },
  { title: 'Market shed and stalls', sector: 'Trade', budget: 21_000_000 },
  { title: 'Classroom block and toilets', sector: 'Education', budget: 27_500_000 },
  { title: 'Streetlights and high-mast lighting', sector: 'Roads', budget: 18_000_000 },
  { title: 'Storm-water drain upgrade', sector: 'Drainage', budget: 46_000_000 },
  { title: 'Community hall and social centre', sector: 'Social', budget: 24_000_000 },
];
const statuses: ProjectStatus[] = ['in_progress', 'in_progress', 'completed', 'procurement', 'stalled', 'planned', 'in_progress', 'completed'];

export function demoProjects(): PublicProject[] {
  const r = rng('projects');
  return Array.from({ length: 18 }, (_, i) => {
    const w = wards[Math.floor(r() * wards.length)]!;
    const sc = subCountyById.get(w.subCountyId ?? '') ?? subCounties[0]!;
    const t = projectTemplates[i % projectTemplates.length]!;
    const status = statuses[Math.floor(r() * statuses.length)]!;
    const budget = Math.round((t.budget * (0.7 + r() * 0.7)) / 100_000) * 100_000;
    const spentRatio = status === 'completed' ? 0.94 + r() * 0.12 : status === 'planned' || status === 'procurement' ? 0 : 0.2 + r() * 0.6;
    const slug = `${w.id}-${t.sector.toLowerCase()}-${i + 1}`;
    return {
      id: `demo-${i}`,
      slug,
      ward_id: w.id,
      ward_name: w.name,
      title: `${w.name} ${t.title.toLowerCase()}`,
      sector: t.sector,
      description: `Sample project for ${w.name}. Real projects appear here as the county publishes them.`,
      status,
      budget,
      spent: Math.round(budget * spentRatio),
      contractor: status === 'planned' || status === 'procurement' ? null : ['Kanjo Works Ltd', 'Mwangaza Builders', 'Savannah Civil Co.', 'Tumaini Contractors'][Math.floor(r() * 4)]!,
      lat: (sc.lat ?? county.center[1]) + (r() - 0.5) * 0.03,
      lng: (sc.lng ?? county.center[0]) + (r() - 0.5) * 0.03,
      started_at: status === 'planned' || status === 'procurement' ? null : '2026-01-15',
      expected_at: '2026-12-15',
      completed_at: status === 'completed' ? '2026-08-30' : null,
      milestones: [
        { title: 'Site handover', due: '2026-02-01', done: status !== 'planned' && status !== 'procurement' },
        { title: 'Groundwork', due: '2026-04-30', done: status === 'completed' || (status === 'in_progress' && r() > 0.4) },
        { title: 'Main works', due: '2026-09-30', done: status === 'completed' },
        { title: 'Handover to community', due: '2026-12-15', done: status === 'completed' },
      ],
      photos: [],
    };
  });
}

export function demoTenders(): PublicTender[] {
  const r = rng('tenders');
  const statusList = ['open', 'open', 'evaluating', 'awarded', 'awarded', 'open', 'evaluating', 'cancelled'] as const;
  return Array.from({ length: 8 }, (_, i) => {
    const w = wards[Math.floor(r() * wards.length)]!;
    const t = projectTemplates[i % projectTemplates.length]!;
    const status = statusList[i]!;
    return {
      id: `demo-tender-${i}`,
      reference: `${county.slug.slice(0, 3).toUpperCase()}/T/${2026}/${String(101 + i)}`,
      title: `${t.title} — ${w.name}`,
      ward_id: w.id,
      ward_name: w.name,
      sector: t.sector,
      status,
      estimated_budget: t.budget,
      applicants_count: 3 + Math.floor(r() * 12),
      awarded_to: status === 'awarded' ? ['Kanjo Works Ltd', 'Mwangaza Builders'][i % 2]! : null,
      published_at: '2026-08-01',
      closes_at: '2026-10-30',
    };
  });
}

export function demoActivity(): ActivityItem[] {
  const r = rng('activity');
  const kinds: ActivityItem['kind'][] = ['report', 'resolved', 'milestone', 'vote', 'report', 'resolved'];
  const text: Record<ActivityItem['kind'], string> = {
    report: 'A new report was received',
    resolved: 'A report was marked fixed',
    milestone: 'A project milestone was completed',
    vote: 'Residents voted on ward priorities',
    tender: 'A tender was published',
  };
  return Array.from({ length: 8 }, (_, i) => {
    const w = wards[Math.floor(r() * wards.length)]!;
    const kind = kinds[i % kinds.length]!;
    return { id: `a${i}`, kind, ward: w.name, text: text[kind], at: new Date(Date.now() - (i * 17 + 3) * 60_000).toISOString() };
  });
}

export function demoVoteData(wardId: string): { cycle: BudgetCycle; envelope: number; options: ProjectOption[]; tally: Record<string, number> } {
  const r = rng(`vote:${wardId}`);
  const cycle: BudgetCycle = {
    id: 'fy2026-27',
    title: 'Ward Development Fund 2026/27',
    status: 'open',
    starts_at: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    ends_at: new Date(Date.now() + 21 * 86_400_000).toISOString(),
    published_results: false,
  };
  const pool = [
    { title: 'Tarmac the main access road', sector: 'Roads', amount: 18_000_000, description: 'Tarmac and drainage on the ward\'s busiest feeder road.' },
    { title: 'Borehole and water kiosks', sector: 'Water', amount: 9_500_000, description: 'A new borehole with three water kiosks and a storage tank.' },
    { title: 'Streetlights at market and junctions', sector: 'Safety', amount: 6_200_000, description: 'Solar streetlights on 14 poles around the market and main junctions.' },
    { title: 'Upgrade the dispensary', sector: 'Health', amount: 14_000_000, description: 'A maternity room, a lab and 24-hour cover at the local dispensary.' },
    { title: 'Classrooms and toilets', sector: 'Education', amount: 11_000_000, description: 'Four classrooms and gender-separate toilets at the public primary school.' },
    { title: 'Storm-water drains', sector: 'Drainage', amount: 12_500_000, description: 'Open the blocked drains that flood the ward every rainy season.' },
  ];
  const options: ProjectOption[] = [...pool].sort(() => r() - 0.5).slice(0, 4).map((o, i) => ({ id: `${wardId}-opt-${i}`, cycle_id: cycle.id, ward_id: wardId, ...o }));
  const tally: Record<string, number> = {};
  options.forEach((o) => (tally[o.id] = Math.floor(r() * 400)));
  return { cycle, envelope: 40_000_000, options, tally };
}

export function demoProposals(): Proposal[] {
  const r = rng('proposals');
  const base: Omit<Proposal, 'id' | 'ward_id' | 'supporters' | 'created_at'>[] = [
    { kind: 'petition', title: 'Fix the flooding on the main road every rainy season', body: 'The drain beside the market blocks each April and the road becomes a river. We ask the county to desilt and widen it before the rains.', status: 'under_review', response: null },
    { kind: 'proposal', title: 'Solar streetlights around the primary school', body: 'Children walk home in the dark during exams. Six solar lights along the school road would make it much safer.', status: 'accepted', response: 'Accepted for the 2026/27 ward development fund. Procurement opens in November.' },
    { kind: 'petition', title: 'Open the health centre for 24 hours', body: 'Mothers travel 12 km at night for delivery. A night shift at the local health centre would save lives.', status: 'submitted', response: null },
    { kind: 'proposal', title: 'Youth talent centre in the old social hall', body: 'Renovate the hall into a small studio and training space for young people.', status: 'declined', response: 'The hall is scheduled for demolition under the road expansion. We will look for another site.' },
    { kind: 'proposal', title: 'More waste collection trucks on Saturdays', body: 'Garbage piles up over the weekend. Please add a Saturday route.', status: 'under_review', response: null },
  ];
  return base.map((b, i) => ({ ...b, id: `demo-p-${i}`, ward_id: wards[Math.floor(r() * wards.length)]!.id, supporters: 20 + Math.floor(r() * 900), created_at: new Date(Date.now() - (i + 2) * 5 * 86_400_000).toISOString() }));
}

export function demoPulse(): PulseSummary {
  const r = rng('pulse');
  const monday = new Date();
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() - (11 - i) * 7);
    const filed = Math.round(1300 + r() * 500 + i * 22);
    return { week: d.toISOString().slice(0, 10), filed, resolved: Math.round(filed * (0.62 + i * 0.018 + r() * 0.05)) };
  });
  const cats = [['pothole', 3100], ['garbage', 2650], ['drainage', 1900], ['streetlight', 1700], ['water_main', 1200], ['sewer', 980], ['dumping', 760], ['health_facility', 420], ['illegal_build', 330], ['abandoned', 210], ['school', 180], ['market', 150], ['safety_hazard', 130], ['missing_funds', 70], ['other', 260]] as const;
  return {
    weekly,
    by_category: cats.map(([category_id, total]) => ({ category_id, total, open: Math.round(total * (0.18 + r() * 0.2)) })),
    by_channel: { web: 8200, ussd: 5400, sms: 2100, ivr: 700, voice: 480 },
    median_ack_hours: 9.5,
    median_resolve_days: 6.2,
  };
}
