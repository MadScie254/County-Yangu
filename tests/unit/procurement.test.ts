import { describe, it, expect } from 'vitest';
import { computeProcurementWatch } from '../../src/shared/lib/procurement';
import { demoProjects, demoTenders } from '../../src/shared/api/demo';
import type { PublicProject, PublicTender } from '../../src/shared/api/types';

const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}T09:00:00Z`;
let seq = 0;
const award = (by: string, o: Partial<PublicTender> & { estimate?: number }): PublicTender => {
  seq += 1;
  return {
    id: `t${seq}`, reference: `T-${seq}`, title: `Tender ${seq}`, ward_id: 'kileleshwa', ward_name: 'Kileleshwa', sector: 'Roads', status: 'awarded',
    estimated_budget: o.estimate ?? 10_000_000, applicants_count: 3, awarded_to: by, contractor_id: `c-${by}`, published_at: day(1), closes_at: day(20),
    procurement_method: 'open_tender', award_amount: null, awarded_at: day(25), ...o,
  };
};
const project = (o: Partial<PublicProject>): PublicProject => ({
  id: 'p', slug: 'p', ward_id: 'kileleshwa', ward_name: 'Kileleshwa', title: 'Project', sector: 'Roads', description: null, status: 'in_progress', budget: 10_000_000, spent: 1_000_000,
  contractor: null, lat: null, lng: null, started_at: null, expected_at: null, completed_at: null, milestones: [], photos: [], ...o,
});

// the same market as tests/db/procurement.test.mjs
const market = (): PublicTender[] => [
  ...[2, 5, 8, 11].map((d) => award('Alpha Builders', { published_at: day(d - 1), closes_at: day(d + 3), awarded_at: day(d) })),
  award('Beta Roads', { estimate: 5_000_000, applicants_count: 1, procurement_method: 'direct', sector: 'Water', ward_id: 'kileleshwa' }),
  award('Gamma Works', { estimate: 3_000_000, sector: 'Health', ward_id: null, ward_name: null }),
  award('Delta Supplies', { estimate: 2_000_000, applicants_count: 1, sector: 'Education', ward_id: null, ward_name: null }),
  award('Echo Ltd', { estimate: 2_000_000, award_amount: 3_000_000, sector: 'Markets', ward_id: null, ward_name: null }),
];
const projects = (): PublicProject[] => [
  project({ id: 'over', title: 'Over budget road', spent: 13_000_000 }),
  project({ id: 'stuck', title: 'Stalled market', status: 'stalled', budget: 8_000_000, spent: 5_000_000 }),
  project({ id: 'late', title: 'Late clinic', expected_at: '2026-01-01', spent: 1_000_000 }),
  project({ id: 'quiet', title: 'On track', spent: 1_000_000 }),
];

describe('procurement watch (demo twin of the database function)', () => {
  it('adds up and ranks suppliers', () => {
    const w = computeProcurementWatch(market(), projects(), new Date('2026-06-01'));
    expect(w.summary.awarded_count).toBe(8);
    expect(w.summary.awarded_value).toBe(53_000_000);
    expect(w.summary.suppliers).toBe(5);
    expect(w.contractors[0]).toMatchObject({ name: 'Alpha Builders', wins: 4, share_value: 75.5 });
    expect(w.summary.hhi_band).toBe('high');
    expect(w.summary.top3_share).toBeGreaterThan(85);
  });

  it('fires every rule on the pattern it is named for, most serious first', () => {
    const w = computeProcurementWatch(market(), projects(), new Date('2026-06-01'));
    const codes = new Set(w.flags.map((f) => f.code));
    for (const c of ['dominant_supplier', 'repeat_winner', 'top3_concentration', 'single_bidder_share', 'short_tender_period', 'award_above_estimate', 'split_awards', 'project_overrun', 'stalled_after_spend', 'project_late']) {
      expect(codes.has(c), c).toBe(true);
    }
    expect(w.flags.find((f) => f.code === 'dominant_supplier')?.severity).toBe('high');
    expect(w.flags.find((f) => f.code === 'award_above_estimate')?.severity).toBe('high');
    expect(w.flags.find((f) => f.code === 'project_late')?.severity).toBe('info');
    expect(w.flags.some((f) => f.subject_label === 'On track')).toBe(false);
    expect(codes.has('non_competitive_share')).toBe(false);
    const order = w.flags.map((f) => ({ high: 0, watch: 1, info: 2 })[f.severity]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('a fair market raises nothing', () => {
    const fair = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].map((n) => award(n, { applicants_count: 6 }));
    const w = computeProcurementWatch(fair, [project({})], new Date('2026-06-01'));
    expect(w.flags).toEqual([]);
    expect(w.summary.hhi_band).toBe('low');
  });

  it('an empty market does not divide by zero', () => {
    const w = computeProcurementWatch([], []);
    expect(w.flags).toEqual([]);
    expect(w.summary).toMatchObject({ awarded_count: 0, awarded_value: 0, hhi: 0, hhi_band: 'low', top3_share: 0 });
  });

  it('thresholds sit where the public page says they do', () => {
    // exactly 25% of value with two wins is flagged; a hair under is not
    const at25 = [award('X', { estimate: 25_000_000 }), award('X', { estimate: 0.000001 * 0 }), award('Y', { estimate: 75_000_000 })];
    expect(computeProcurementWatch(at25, []).flags.some((f) => f.code === 'dominant_supplier' && f.subject_label === 'X')).toBe(true);
    const under = [award('X', { estimate: 24_000_000 }), award('X', { estimate: 0 }), award('Y', { estimate: 76_000_000 })];
    expect(computeProcurementWatch(under, []).flags.some((f) => f.code === 'dominant_supplier' && f.subject_label === 'X')).toBe(false);
  });

  it('the sample data shows the interesting cases', () => {
    const w = computeProcurementWatch(demoTenders(), demoProjects(), new Date('2026-09-30'));
    const codes = w.flags.map((f) => f.code);
    expect(w.contractors[0]!.name).toBe('Kanjo Works Ltd');
    expect(codes).toEqual(expect.arrayContaining(['dominant_supplier', 'repeat_winner', 'award_above_estimate', 'top3_concentration', 'project_overrun', 'stalled_after_spend']));
    expect(w.flags.every((f) => !f.detail.includes('\u2014') && !f.title.includes('\u2014'))).toBe(true);
  });
});
