// Ward-boundary tooling: match polygons from any source (OpenStreetMap, IEBC, a county GIS export) to this county's
// 85-or-so ward ids, simplify them for the web, and describe what did not match. Pure functions, unit-tested.

const ROMAN = { i: '1', ii: '2', iii: '3', iv: '4', v: '5' };

/** "Dandora Area II Ward" -> "dandora area 2". Lowercase, no accents, no "ward", punctuation as spaces, roman numerals as digits. */
export function normName(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\bwards?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i, all) => (i > 0 && ROMAN[w] && i === all.length - 1 ? ROMAN[w] : w))
    .join(' ')
    .trim();
}

/** Names OSM/IEBC write differently from KNBS. Keys and values are already normalised. Extend as real data shows gaps. */
export const ALIASES = {
  'mugumo ini': 'mugumoini',
  'south c': 'south c',
  'woodley kenyatta golf course': 'woodley',
  'kahawa wendani': 'kahawa west',
  'clay city': 'claycity',
};

const NAME_PROPS = ['name', 'NAME', 'Name', 'ward', 'WARD', 'Ward', 'ward_name', 'WARD_NAME', 'Ward_Name', 'ADM3_EN', 'admin3Name', 'name:en', 'official_name'];

/** Find which property of a feature holds the ward name. */
export function pickNameProp(features, hint) {
  if (hint) return hint;
  const counts = new Map();
  for (const f of features) for (const p of NAME_PROPS) if (typeof f.properties?.[p] === 'string' && f.properties[p].trim()) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * @param features  GeoJSON features with Polygon/MultiPolygon geometry
 * @param wards     [{ id, name, code? }] from the county's reference data
 * @returns { matched: [{ ward, feature }], unmatchedWards, unmatchedFeatures, ambiguous }
 */
export function matchWards(features, wards, { nameProp, codeProp } = {}) {
  const prop = pickNameProp(features, nameProp);
  const polys = features.filter((f) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'));
  const key = (n) => { const k = normName(n); return ALIASES[k] ?? k; };

  const byCode = new Map();
  if (codeProp) for (const f of polys) { const c = Number(f.properties?.[codeProp]); if (Number.isFinite(c)) byCode.set(c, f); }

  const byName = new Map();
  for (const f of polys) {
    const k = prop ? key(f.properties?.[prop]) : '';
    if (!k) continue;
    byName.set(k, [...(byName.get(k) ?? []), f]);
  }

  const used = new Set();
  const matched = [];
  const unmatchedWards = [];
  const ambiguous = [];
  for (const w of wards) {
    let f = w.code != null ? byCode.get(w.code) : undefined;
    if (!f) {
      const c = byName.get(key(w.name)) ?? [];
      if (c.length > 1) { ambiguous.push({ ward: w, candidates: c.length }); }
      f = c.find((x) => !used.has(x)) ?? undefined;
    }
    if (f && !used.has(f)) { used.add(f); matched.push({ ward: w, feature: f }); } else unmatchedWards.push(w);
  }
  const unmatchedFeatures = polys.filter((f) => !used.has(f)).map((f) => (prop ? f.properties?.[prop] : undefined) ?? '(no name)');
  return { matched, unmatchedWards, unmatchedFeatures, ambiguous, nameProp: prop };
}

// ---- geometry ----------------------------------------------------------------------------------------------------------------

/** Douglas-Peucker on one ring, keeping it closed and at least a triangle. */
export function simplifyRing(ring, tol) {
  if (ring.length <= 4) return ring;
  const pts = ring.slice(0, -1);
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const d2 = (p, a, b) => {
    let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
    if (dx || dy) {
      const t = Math.max(0, Math.min(1, ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy)));
      x += t * dx; y += t * dy;
    }
    return (p[0] - x) ** 2 + (p[1] - y) ** 2;
  };
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0, idx = -1;
    for (let i = s + 1; i < e; i++) { const d = d2(pts[i], pts[s], pts[e]); if (d > max) { max = d; idx = i; } }
    if (max > tol * tol && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  const out = pts.filter((_, i) => keep[i]);
  if (out.length < 3) return ring;
  out.push(out[0]);
  return out;
}

const mapRings = (g, fn) => (g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.coordinates.map(fn) } : { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.map(fn)) });

export const simplifyGeometry = (g, tol) => mapRings(g, (r) => simplifyRing(r, tol));
export const roundGeometry = (g, decimals = 5) => { const m = 10 ** decimals; return mapRings(g, (r) => r.map(([x, y]) => [Math.round(x * m) / m, Math.round(y * m) / m])); };

/** Drop duplicate consecutive points (rounding creates them), then any ring that collapsed. */
export function tidyGeometry(g) {
  const dedupe = (r) => r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);
  const ringOk = (r) => r.length >= 4;
  if (g.type === 'Polygon') {
    const rings = g.coordinates.map(dedupe).filter(ringOk);
    return rings.length ? { type: 'Polygon', coordinates: rings } : null;
  }
  const polys = g.coordinates.map((p) => p.map(dedupe).filter(ringOk)).filter((p) => p.length);
  return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
}

export function bboxOf(g) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) for (const ring of poly) for (const [x, y] of ring) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [a, b, c, d];
}

export function ringArea(ring) {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(s / 2);
}

/** Area-weighted centroid of the largest polygon (good enough to place a label). */
export function centroidOf(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const biggest = polys.reduce((m, p) => (ringArea(p[0]) > ringArea(m[0]) ? p : m));
  const ring = biggest[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
  }
  return a === 0 ? [ring[0][0], ring[0][1]] : [cx / (3 * a), cy / (3 * a)];
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  const r = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Turn matched wards into the site's FeatureCollection and the rows for the database, and list anything suspicious:
 * a polygon whose centre is far from where the KNBS data says the ward is, or one outside the county's box.
 */
export function buildOutputs(matched, { countyBbox, refCentroids = new Map(), tolerance = 0.0002, maxCentreKm = 12 } = {}) {
  const features = [];
  const rows = [];
  const warnings = [];
  for (const { ward, feature } of matched) {
    const geom = tidyGeometry(roundGeometry(simplifyGeometry(feature.geometry, tolerance), 5));
    if (!geom) { warnings.push(`${ward.name}: geometry collapsed while simplifying`); continue; }
    const [lng, lat] = centroidOf(geom);
    const box = bboxOf(geom);
    const ref = refCentroids.get(ward.id);
    if (ref && distanceKm(lat, lng, ref.lat, ref.lng) > maxCentreKm) warnings.push(`${ward.name}: polygon centre is ${distanceKm(lat, lng, ref.lat, ref.lng).toFixed(1)} km from the ward's known position, check the match`);
    if (countyBbox && (box[0] < countyBbox[0] - 0.05 || box[2] > countyBbox[2] + 0.05 || box[1] < countyBbox[1] - 0.05 || box[3] > countyBbox[3] + 0.05)) warnings.push(`${ward.name}: extends outside the county's bounding box`);
    features.push({ type: 'Feature', properties: { id: ward.id, name: ward.name, ...(ward.subCountyId ? { sub_county_id: ward.subCountyId } : {}) }, geometry: geom });
    rows.push({ id: ward.id, geojson: geom, bbox: box.map((v) => Math.round(v * 1e5) / 1e5), centroid_lat: Math.round(lat * 1e6) / 1e6, centroid_lng: Math.round(lng * 1e6) / 1e6 });
  }
  return { collection: { type: 'FeatureCollection', features }, rows, warnings };
}
