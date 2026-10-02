import { describe, expect, it } from 'vitest';
import { KENYA_COUNTIES, opinionGroups } from '@/shared/api/civic2';
import { parseFinanceCsv, splitCsv } from '@/shared/lib/financeCsv';

describe('opinionGroups', () => {
  it('needs at least six people', () => {
    expect(opinionGroups([[1, 1, 1], [2, 1, -1]], [1, 2])).toBeNull();
  });

  it('splits two camps and finds the statement they disagree on', () => {
    const votes: [number, number, -1 | 0 | 1][] = [];
    for (let p = 1; p <= 10; p++) votes.push([p, 1, p <= 5 ? 1 : -1], [p, 2, 1]);
    const r = opinionGroups(votes, [1, 2])!;
    expect(r.groups.map((g) => g.size).sort()).toEqual([5, 5]);
    const [a, b] = r.groups;
    expect(Math.abs(a!.mean[1]! - b!.mean[1]!)).toBe(2);
    expect(a!.mean[2]).toBe(1);
    expect(b!.mean[2]).toBe(1);
  });

  it('returns nothing when everyone agrees', () => {
    const votes: [number, number, -1 | 0 | 1][] = [];
    for (let p = 1; p <= 8; p++) votes.push([p, 1, 1], [p, 2, 1]);
    expect(opinionGroups(votes, [1, 2])).toBeNull();
  });
});

describe('county finance CSV', () => {
  it('reads quoted cells, names and codes', () => {
    expect(splitCsv('a,"b, c","d ""e"""\r\n1,2,3\n')).toEqual([['a', 'b, c', 'd "e"'], ['1', '2', '3']]);
    const csv = 'county,fiscal_year,dev_budget,dev_spent,pending_bills,audit_opinion,source,source_url\n'
      + 'Nairobi,2024/25,"44,000,000",KES 26400000,,Qualified,CoB review,https://cob.go.ke/\n'
      + "1,2024/25,10,5,0,unqualified,CoB review,\n"
      + "Murang'a,2024/25,10,5,0,,CoB review,\n";
    const { rows, errors } = parseFinanceCsv(csv, KENYA_COUNTIES);
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.county_code)).toEqual([47, 1, 21]);
    expect(rows[0]).toMatchObject({ dev_budget: 44_000_000, dev_spent: 26_400_000, pending_bills: null, audit_opinion: 'qualified', source_url: 'https://cob.go.ke/' });
    expect(rows[2]!.audit_opinion).toBeNull();
  });

  it('reports bad rows instead of guessing', () => {
    const csv = 'county,fiscal_year,dev_budget,source,source_url\nAtlantis,2024/25,1,x src,\nNairobi,24/25,1,x src,\nNairobi,2024/25,-3,x src,\nNairobi,2024/25,1,x src,http://x\nNairobi,2024/25,1,,\n';
    const { rows, errors } = parseFinanceCsv(csv, KENYA_COUNTIES);
    expect(rows).toEqual([]);
    expect(errors).toHaveLength(5);
    expect(parseFinanceCsv('county,source\n', KENYA_COUNTIES).errors[0]).toMatch(/no data/);
    expect(parseFinanceCsv('county,source\nNairobi,x\n', KENYA_COUNTIES).errors[0]).toMatch(/fiscal_year/);
  });
});
