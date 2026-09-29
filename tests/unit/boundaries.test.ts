import { describe, it, expect } from 'vitest';
// @ts-expect-error plain .mjs without types
import { normName, matchWards, simplifyRing, buildOutputs, tidyGeometry, roundGeometry, centroidOf, bboxOf, pickNameProp } from '../../scripts/lib/boundaries.mjs';

const sq = (x: number, y: number, s = 0.02) => ({ type: 'Polygon', coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] });
const feat = (name: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ type: 'Feature', properties: { name, ...extra }, geometry: sq(x, y) });
const wards = [
  { id: 'kileleshwa', code: 1, name: 'Kileleshwa', subCountyId: 'dagoretti' },
  { id: 'dandora-area-ii', code: 2, name: 'Dandora Area II', subCountyId: 'embakasi' },
  { id: 'woodley', code: 3, name: 'Woodley/Kenyatta Golf Course', subCountyId: 'dagoretti' },
  { id: 'kabiro', code: 4, name: 'Kabiro', subCountyId: 'dagoretti' },
];

describe('ward name matching', () => {
  it('normalises the ways sources spell the same ward', () => {
    expect(normName('KILELESHWA Ward')).toBe('kileleshwa');
    expect(normName('Dandora Area II')).toBe('dandora area 2');
    expect(normName('Dandora Area 2 ward')).toBe('dandora area 2');
    expect(normName('Uthiru/Ruthimitu')).toBe('uthiru ruthimitu');
    expect(normName('Ngando')).toBe(normName('  ngando '));
    expect(normName('Café Ward')).toBe('cafe');
  });

  it('matches by name across spelling differences and reports what is left over', () => {
    const feats = [feat('Kileleshwa Ward', 36.7, -1.3), feat('Dandora Area 2', 36.9, -1.25), feat('Woodley', 36.8, -1.31), feat('Somewhere Else', 36.6, -1.2)];
    const r = matchWards(feats, wards);
    expect(r.matched.map((m: { ward: { id: string } }) => m.ward.id)).toEqual(['kileleshwa', 'dandora-area-ii', 'woodley']);
    expect(r.unmatchedWards.map((w: { name: string }) => w.name)).toEqual(['Kabiro']);
    expect(r.unmatchedFeatures).toEqual(['Somewhere Else']);
  });

  it('prefers an official ward code when the file has one', () => {
    const feats = [feat('Wrongly named', 36.7, -1.3, { CODE: 1 }), feat('Kileleshwa', 36.9, -1.25, { CODE: 999 })];
    const r = matchWards(feats, [wards[0]], { codeProp: 'CODE' });
    expect(r.matched[0].feature.properties.name).toBe('Wrongly named');
  });

  it('never uses one polygon for two wards, and flags ambiguous names', () => {
    const feats = [feat('Kabiro', 36.7, -1.3), feat('Kabiro', 36.8, -1.3)];
    const r = matchWards(feats, [wards[3], { ...wards[3], id: 'kabiro-2', code: 9 }]);
    expect(new Set(r.matched.map((m: { feature: object }) => m.feature)).size).toBe(r.matched.length);
    expect(r.ambiguous.length).toBeGreaterThan(0);
  });

  it('finds the name property by itself, and ignores non-polygons', () => {
    expect(pickNameProp([{ properties: { WARD_NAME: 'x' } }, { properties: { WARD_NAME: 'y' } }])).toBe('WARD_NAME');
    const r = matchWards([{ type: 'Feature', properties: { name: 'Kileleshwa' }, geometry: { type: 'Point', coordinates: [0, 0] } }], wards);
    expect(r.matched).toHaveLength(0);
  });
});

describe('geometry', () => {
  it('simplifies a wiggly ring but keeps its shape and closure', () => {
    const ring: number[][] = [];
    for (let i = 0; i <= 100; i++) ring.push([i / 100, 0 + (i % 2) * 0.00001]);
    ring.push([1, 1], [0, 1], [0, 0]);
    const out = simplifyRing(ring, 0.001);
    expect(out.length).toBeLessThan(ring.length / 4);
    expect(out[0]).toEqual(out[out.length - 1]);
    expect(out.length).toBeGreaterThanOrEqual(4);
  });

  it('rounds, removes duplicate points and drops collapsed rings', () => {
    const tiny = { type: 'Polygon', coordinates: [[[0, 0], [0.000001, 0], [0.000001, 0.000001], [0, 0]]] };
    expect(tidyGeometry(roundGeometry(tiny, 3))).toBeNull();
    expect(tidyGeometry(roundGeometry(sq(36.123456789, -1.234567891), 5))!.coordinates[0][0]).toEqual([36.12346, -1.23457]);
  });

  it('finds the box and centre', () => {
    expect(bboxOf(sq(1, 2, 2))).toEqual([1, 2, 3, 4]);
    const [x, y] = centroidOf(sq(1, 2, 2));
    expect([+x.toFixed(6), +y.toFixed(6)]).toEqual([2, 3]);
  });
});

describe('outputs', () => {
  it('builds the site collection and database rows, and warns about a match that looks wrong', () => {
    const m = matchWards([feat('Kileleshwa', 36.78, -1.29), feat('Kabiro', 36.7, -1.27)], wards);
    const refCentroids = new Map([['kileleshwa', { lat: -1.28, lng: 36.79 }], ['kabiro', { lat: -1.6, lng: 37.5 }]]);
    const out = buildOutputs(m.matched, { countyBbox: [36.6, -1.5, 37.1, -1.1], refCentroids });
    expect(out.collection.features.map((f: { properties: { id: string } }) => f.properties.id)).toEqual(['kileleshwa', 'kabiro']);
    expect(out.collection.features[0].properties).toEqual({ id: 'kileleshwa', name: 'Kileleshwa', sub_county_id: 'dagoretti' });
    expect(out.rows[0]).toMatchObject({ id: 'kileleshwa', centroid_lat: -1.28, centroid_lng: 36.79 });
    expect(out.rows[0].bbox).toEqual([36.78, -1.29, 36.8, -1.27]);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/Kabiro.*km from/);
  });
});
