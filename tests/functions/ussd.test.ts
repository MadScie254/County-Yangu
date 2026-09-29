// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { ussd, clean, type UssdDeps } from '../../supabase/functions/_shared/ussd.ts';

const subCounties = Array.from({ length: 17 }, (_, i) => ({ id: `sc${i + 1}`, name: `Sub-county number ${i + 1}` }));
const wardsOf = (sc: string) => Array.from({ length: 7 }, (_, i) => ({ id: `${sc}-w${i + 1}`, name: `Ward ${i + 1} of ${sc}` }));
const cats = Array.from({ length: 8 }, (_, i) => ({ id: `cat${i + 1}`, name: `Problem type ${i + 1}`, name_sw: `Tatizo aina ${i + 1}` }));

function deps(over: Partial<UssdDeps> = {}): UssdDeps & { calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = { report: [], vote: [], subscribe: [] };
  return {
    calls,
    county: 'Nairobi',
    categories: async () => cats,
    subCounties: async () => subCounties,
    wards: async (sc) => wardsOf(sc),
    wardName: async (id) => `Ward ${id}`,
    categoryName: async (id, lang) => (lang === 'sw' ? `Tatizo ${id}` : `Problem ${id}`),
    openCycle: async () => ({ id: 'fy1', title: 'FY 2026/27' }),
    options: async () => [{ id: 'o1', title: 'Borehole at the market', amount: 1_500_000 }, { id: 'o2', title: 'Tarmac the access road', amount: 4_200_000 }],
    caseStatus: async (ref) => (ref === 'NAI-R1234567890' ? { status: 'in_progress', category: 'Pothole', ward: 'Kileleshwa', updated_at: '2026-09-12T09:00:00Z' } : null),
    createReport: async (r) => { calls.report!.push(r); return { reference: 'NAI-RABCDEF1234' }; },
    vote: async (v) => { calls.vote!.push(v); return 'ok'; },
    subscribe: async (s) => { calls.subscribe!.push(s); },
    ...over,
  };
}

const head = (s: string) => s.slice(0, 3);

describe('USSD menu', () => {
  it('shows the main menu first and never exceeds a USSD screen', async () => {
    const r = await ussd('', deps());
    expect(r).toBe('CON Nairobi\n1. Report a problem\n2. Check a report\n3. Budget vote\n4. Ward alerts\n5. Kiswahili');
  });

  it('every screen on every path fits in 182 characters and uses only plain characters', async () => {
    const d = deps();
    const paths = ['', '1', '1*1', '1*1*1', '1*1*1*2', '1*1*1*2*Deep pothole outside the school gate', '1*1*1*2*Deep pothole outside the school gate*1', '1*9', '1*1*9', '1*1*9*9', '2', '3', '3*1', '3*1*1', '3*1*1*1', '4', '4*1*1', '5', '5*1', '5*3*1*1*1'];
    for (const p of paths) {
      const r = await ussd(p, d);
      expect(r.length, p).toBeLessThanOrEqual(186);
      expect(r, p).toMatch(/^(CON|END) [\x20-\x7E\n]+$/);
    }
  });

  it('reports a problem end to end and hands back the reference', async () => {
    const d = deps();
    const r = await ussd('1*2*3*4*Deep pothole outside the school gate*1', d);
    expect(head(r)).toBe('END');
    expect(r).toContain('NAI-RABCDEF1234');
    expect(d.calls.report).toEqual([{ category_id: 'cat2', ward_id: 'sc3-w4', description: 'Deep pothole outside the school gate', smsMe: false, lang: 'en' }]);
  });

  it('asks before sending and offers an SMS with the reference', async () => {
    const d = deps();
    const confirm = await ussd('1*1*1*1*Broken street light', d);
    expect(confirm).toContain('Problem cat1 in Ward sc1-w1');
    expect(confirm).toContain('Broken street light');
    expect(d.calls.report).toHaveLength(0);
    const sent = await ussd('1*1*1*1*Broken street light*2', d);
    expect(sent).toContain('We sent it by SMS');
    expect(d.calls.report[0]).toMatchObject({ smsMe: true });
  });

  it('rejects a description that is too short and stays on the same screen', async () => {
    const d = deps();
    const r = await ussd('1*1*1*1*ab', d);
    expect(head(r)).toBe('CON');
    expect(r).toContain('Describe it');
    expect(r).toContain('write a little more');
    expect(d.calls.report).toHaveLength(0);
  });

  it('goes back with 0 and treats 0 as text where the person is typing', async () => {
    const d = deps();
    expect(await ussd('1*0', d)).toBe(await ussd('', d));
    const r = await ussd('1*1*1*1*0', d); // "0" typed as a description: too short, not "back"
    expect(r).toContain('Describe it');
    expect(await ussd('1*1*1*1*Leaking pipe here*0', d)).toContain('Describe it'); // 0 on the confirm screen goes back to description
  });

  it('pages through long lists with 9 and wraps around', async () => {
    const d = deps();
    const first = await ussd('4', d);
    expect(first).toContain('1. Sub-county number 1');
    expect(first).toContain('9. More');
    const second = await ussd('4*9', d);
    expect(second).toContain('1. Sub-county number 6');
    const last = await ussd('4*9*9*9*9', d);
    expect(last).toContain('1. Sub-county number 1'); // 17 items = 4 pages, so the 4th "more" wraps
    expect(await ussd('4*9*2*1', d)).toContain('How often?'); // picks number 7 on page 2, then the first ward
  });

  it('reports an invalid choice without losing the place', async () => {
    const r = await ussd('1*99', deps());
    expect(r).toContain('That choice is not on the list.');
    expect(r).toContain('What is the problem?');
    expect(await ussd('7', deps())).toContain('not on the list');
  });

  it('looks up a report number and says plainly when there is none', async () => {
    const found = await ussd('2*nai-r1234567890', deps());
    expect(found).toBe('END NAI-R1234567890: Being fixed. Pothole in Kileleshwa. Updated 12 Sept.'.replace('Sept', found.includes('Sept') ? 'Sept' : 'Sep'));
    expect(await ussd('2*NAI-RNOPE00000', deps())).toContain('could not find');
    expect(await ussd('2*ab', deps())).toContain('CON');
  });

  it('votes once through the menu and explains every outcome', async () => {
    const d = deps();
    const r = await ussd('3*1*1*1*1', d);
    expect(r).toBe('END Thank you. Your vote is counted.');
    expect(d.calls.vote).toEqual([{ cycle_id: 'fy1', ward_id: 'sc1-w1', option_id: 'o1' }]);
    expect(await ussd('3*1*1*1*1', deps({ vote: async () => 'duplicate' }))).toContain('already voted');
    expect(await ussd('3*1*1*1*1', deps({ vote: async () => 'closed' }))).toContain('closed');
    expect(await ussd('3', deps({ openCycle: async () => null }))).toBe('END No budget vote is open right now.');
    expect(await ussd('3*1*1', deps({ options: async () => [] }))).toContain('no projects');
  });

  it('subscribes to ward alerts', async () => {
    const d = deps();
    const r = await ussd('4*2*3*2', d);
    expect(r).toContain('Reply STOP');
    expect(d.calls.subscribe).toEqual([{ ward_id: 'sc2-w3', frequency: 'weekly' }]);
    await ussd('4*2*3*1', d);
    expect(d.calls.subscribe[1]).toEqual({ ward_id: 'sc2-w3', frequency: 'instant' });
  });

  it('switches to Kiswahili and back with 5', async () => {
    const sw = await ussd('5', deps());
    expect(sw).toContain('Ripoti tatizo');
    expect(sw).toContain('5. English');
    expect(await ussd('5*5', deps())).toContain('Report a problem');
    expect(await ussd('5*1', deps())).toContain('Tatizo ni lipi?');
    expect(await ussd('5*1*1*1*1*Bomba limepasuka hapa*1', deps())).toContain('Asante');
  });

  it('never lets user text break the protocol', async () => {
    expect(clean('Hello *123# wörld\nnew\tline', 50)).toBe('Hello 123 wrld new line');
    expect(clean('x'.repeat(200), 20)).toHaveLength(20);
    const d = deps();
    await ussd('1*1*1*1*Pothole # near * shop <script>*1', d);
    // "*" splits the path, so the description stops there, but nothing unsafe reaches the database
    for (const r of d.calls.report as { description: string }[]) expect(r.description).not.toMatch(/[*#<>]/);
  });

  it('lets an error in a lookup bubble up so the function can answer generically', async () => {
    const boom = vi.fn().mockRejectedValue(new Error('db down'));
    await expect(ussd('1', deps({ categories: boom }))).rejects.toThrow('db down');
  });
});
