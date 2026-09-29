// Which ward is this point in? Pure geometry, no I/O.
//
// The resident picks a ward, and may also drop a pin. The pin is more precise than the picker, so once real ward
// boundaries are loaded (wards.geojson) the pin decides the ward. Until then the pin is only sanity-checked, and a
// pin that is nowhere near the chosen ward is discarded rather than stored.

export type Ring = number[][]; // [lng, lat][]
export type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

export type WardGeo = {
  id: string;
  sub_county_id: string | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  bbox: number[] | null; // [minLng, minLat, maxLng, maxLat]
  geojson: Geometry | null;
};

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > y !== yj! > y && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}

/** Point in polygon with holes: inside the outer ring and not inside any hole. */
function inPolygon(x: number, y: number, rings: Ring[]): boolean {
  const [outer, ...holes] = rings;
  if (!outer || !inRing(x, y, outer)) return false;
  return !holes.some((h) => inRing(x, y, h));
}

export function pointInGeometry(lng: number, lat: number, g: Geometry): boolean {
  return g.type === 'Polygon' ? inPolygon(lng, lat, g.coordinates) : g.coordinates.some((p) => inPolygon(lng, lat, p));
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export type WardResolution = {
  ward_id: string;
  lat: number | null;
  lng: number | null;
  /** why the answer is what it is, for the case timeline / logs */
  reason: 'no_pin' | 'pin_in_ward' | 'pin_moved_ward' | 'pin_plausible' | 'pin_outside_county' | 'pin_far_from_ward';
};

const MAX_FROM_CENTROID_KM = 20;

/**
 * @param county   the county's bounding box [minLng, minLat, maxLng, maxLat], if known
 * @param claimed  the ward the resident chose
 */
export function resolveWard(wards: WardGeo[], claimed: string, lat: number | null, lng: number | null, county: number[] | null): WardResolution {
  if (lat === null || lng === null) return { ward_id: claimed, lat: null, lng: null, reason: 'no_pin' };
  if (county && (lng < county[0]! || lng > county[2]! || lat < county[1]! || lat > county[3]!)) {
    return { ward_id: claimed, lat: null, lng: null, reason: 'pin_outside_county' };
  }

  const withShape = wards.filter((w) => w.geojson);
  if (withShape.length > 0) {
    const hit = withShape.find((w) => (!w.bbox || (lng >= w.bbox[0]! && lng <= w.bbox[2]! && lat >= w.bbox[1]! && lat <= w.bbox[3]!)) && pointInGeometry(lng, lat, w.geojson!));
    if (hit) return { ward_id: hit.id, lat, lng, reason: hit.id === claimed ? 'pin_in_ward' : 'pin_moved_ward' };
  }

  const w = wards.find((x) => x.id === claimed);
  if (w?.centroid_lat != null && w.centroid_lng != null && distanceKm(lat, lng, w.centroid_lat, w.centroid_lng) > MAX_FROM_CENTROID_KM) {
    return { ward_id: claimed, lat: null, lng: null, reason: 'pin_far_from_ward' };
  }
  return { ward_id: claimed, lat, lng, reason: 'pin_plausible' };
}
