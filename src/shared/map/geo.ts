import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { subCounties } from '@/shared/config/county';

export type LngLat = { lat: number; lng: number };
export type Bbox = [minLng: number, minLat: number, maxLng: number, maxLat: number];

/** Ray casting on one ring. */
function inRing(x: number, y: number, ring: Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(x: number, y: number, rings: Position[][]) {
  const [outer, ...holes] = rings;
  if (!outer || !inRing(x, y, outer)) return false;
  return !holes.some((h) => inRing(x, y, h));
}

export function pointInGeometry(p: LngLat, g: Polygon | MultiPolygon): boolean {
  return g.type === 'Polygon' ? inPolygon(p.lng, p.lat, g.coordinates) : g.coordinates.some((poly) => inPolygon(p.lng, p.lat, poly));
}

export function bboxOf(g: Polygon | MultiPolygon): Bbox {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const ring of poly) for (const [x, y] of ring as [number, number][]) {
    if (x < minLng) minLng = x;
    if (x > maxLng) maxLng = x;
    if (y < minLat) minLat = y;
    if (y > maxLat) maxLat = y;
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function centroidOf(g: Polygon | MultiPolygon): LngLat {
  // Area-weighted centroid of the largest ring (good enough for a label anchor).
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let best = { area: -1, lng: 0, lat: 0 };
  for (const poly of polys) {
    const ring = poly[0] as [number, number][] | undefined;
    if (!ring || ring.length < 3) continue;
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x0, y0] = ring[j]!;
      const [x1, y1] = ring[i]!;
      const f = x0 * y1 - x1 * y0;
      a += f;
      cx += (x0 + x1) * f;
      cy += (y0 + y1) * f;
    }
    a /= 2;
    if (Math.abs(a) > best.area && a !== 0) best = { area: Math.abs(a), lng: cx / (6 * a), lat: cy / (6 * a) };
  }
  if (best.area < 0) {
    const [minLng, minLat, maxLng, maxLat] = bboxOf(g);
    return { lng: (minLng + maxLng) / 2, lat: (minLat + maxLat) / 2 };
  }
  return { lng: best.lng, lat: best.lat };
}

export type WardFeature = Feature<Polygon | MultiPolygon, { id: string; name?: string }>;
export type WardCollection = FeatureCollection<Polygon | MultiPolygon, { id: string; name?: string }>;

/** Which ward polygon (if any) contains this point. */
export function wardAtPoint(fc: WardCollection | null, p: LngLat): string | null {
  if (!fc) return null;
  for (const f of fc.features) if (f.geometry && pointInGeometry(p, f.geometry)) return f.properties.id;
  return null;
}

export function inBbox(p: LngLat, bbox: number[] | null, padDeg = 0): boolean {
  if (!bbox || bbox.length < 4) return true;
  const [minLng, minLat, maxLng, maxLat] = bbox as Bbox;
  return p.lng >= minLng - padDeg && p.lng <= maxLng + padDeg && p.lat >= minLat - padDeg && p.lat <= maxLat + padDeg;
}

export function distanceKm(a: LngLat, b: LngLat) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Nearest sub-county by centroid. Used to narrow the ward list when ward polygons are not loaded. */
export function nearestSubCounty(p: LngLat) {
  let best: { id: string; name: string; km: number } | null = null;
  for (const sc of subCounties) {
    if (sc.lat == null || sc.lng == null) continue;
    const km = distanceKm(p, { lat: sc.lat, lng: sc.lng });
    if (!best || km < best.km) best = { id: sc.id, name: sc.name, km };
  }
  return best;
}
