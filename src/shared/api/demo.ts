// Deterministic sample data. Used only when no backend is reachable, and always labelled
// "Demo data" in the UI. Seeded per ward so the picture is stable between reloads.
import { wards, subCountyById, subCounties, county } from '@/shared/config/county';
import type { ActivityItem, CountySummary, PublicProject, PublicTender, ProjectStatus, WardStat } from './types';

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
