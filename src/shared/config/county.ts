import nairobi from '@/shared/data/reference.nairobi.json';
import bungoma from '@/shared/data/reference.bungoma.json';

export type Ward = { id: string; code: number; name: string; subCountyId: string | null };
export type SubCounty = { id: string; name: string; lat: number | null; lng: number | null; areaKm2: number | null };
export type Reference = {
  county: { slug: string; name: string; code: number; centroid: { lat: number; lng: number } | null; bbox: number[] | null; population2019: number | null };
  subCounties: SubCounty[];
  wards: Ward[];
};

const BUNDLED: Record<string, Reference> = { nairobi: nairobi as Reference, bungoma: bungoma as Reference };

const slug = (import.meta.env.VITE_COUNTY as string | undefined)?.toLowerCase() ?? 'nairobi';
export const reference: Reference = BUNDLED[slug] ?? (nairobi as Reference);

export const county = {
  ...reference.county,
  ussdCode: (import.meta.env.VITE_USSD_CODE as string | undefined) ?? '*384*47#',
  smsShortcode: (import.meta.env.VITE_SMS_SHORTCODE as string | undefined) ?? '22047',
  paybill: (import.meta.env.VITE_PAYBILL as string | undefined) ?? null,
  domain: (import.meta.env.VITE_COUNTY_DOMAIN as string | undefined) ?? `yangu.${reference.county.slug}.go.ke`,
  /** Fallback map view (lng/lat) used before the bbox is known. */
  center: [reference.county.centroid?.lng ?? 36.8, reference.county.centroid?.lat ?? -1.29] as [number, number],
};

export const wards = reference.wards;
export const subCounties = reference.subCounties;
export const wardById = new Map(wards.map((w) => [w.id, w]));
export const subCountyById = new Map(subCounties.map((s) => [s.id, s]));

export function wardLabel(id: string | null | undefined) {
  return (id && wardById.get(id)?.name) || id || '';
}

/** Wards grouped by sub-county, in the county's own order, for grouped pickers. */
export function wardsBySubCounty() {
  return subCounties
    .map((sc) => ({ subCounty: sc, wards: wards.filter((w) => w.subCountyId === sc.id).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.wards.length > 0);
}
