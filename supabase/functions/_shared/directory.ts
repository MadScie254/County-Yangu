// Reference data the functions need (wards, categories, the open budget round), cached in the isolate for a few minutes:
// it changes rarely, and every USSD keypress would otherwise be a database round trip.
import { serviceClient } from './db.ts';
import type { WardGeo } from './geo.ts';

type Cached<T> = { at: number; value: T };
const TTL_MS = 5 * 60_000;
const cache = new Map<string, Cached<unknown>>();

async function cached<T>(key: string, load: () => Promise<T>, ttl = TTL_MS): Promise<T> {
  const hit = cache.get(key) as Cached<T> | undefined;
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
  if (r.error || r.data === null) throw new Error(r.error?.message ?? 'no data');
  return r.data;
};

export type Category = { id: string; name: string; name_sw: string | null };
export type Ward = { id: string; name: string; sub_county_id: string | null };

export const categories = () =>
  cached('categories', async () => must(await serviceClient().from('report_categories').select('id, name, name_sw').eq('active', true).order('sort').order('name')) as Category[]);

export const subCounties = () =>
  cached('sub_counties', async () => must(await serviceClient().from('sub_counties').select('id, name').order('name')) as { id: string; name: string }[]);

export const wardsLight = () =>
  cached('wards', async () => must(await serviceClient().from('wards').select('id, name, sub_county_id').order('name')) as Ward[]);

/** Ward boundaries are big, so they are only loaded when a resident dropped a pin, and kept for an hour. */
export const wardShapes = () =>
  cached(
    'ward_shapes',
    async () => must(await serviceClient().from('wards').select('id, sub_county_id, centroid_lat, centroid_lng, bbox, geojson')) as WardGeo[],
    60 * 60_000,
  );

export const countyBbox = () =>
  cached('county_bbox', async () => {
    const { data } = await serviceClient().from('county').select('bbox').maybeSingle();
    return ((data as { bbox: number[] | null } | null)?.bbox ?? null) as number[] | null;
  });

export type Cycle = { id: string; title: string };
export const openCycle = () =>
  cached(
    'open_cycle',
    async () => {
      const now = new Date().toISOString();
      const { data } = await serviceClient().from('budget_cycles').select('id, title').eq('status', 'open').lte('starts_at', now).gte('ends_at', now).order('starts_at', { ascending: false }).limit(1).maybeSingle();
      return (data as Cycle | null) ?? null;
    },
    60_000,
  );

export type Option = { id: string; title: string; amount: number };
export const cycleOptions = async (cycleId: string, wardId: string): Promise<Option[]> =>
  must(await serviceClient().from('project_options').select('id, title, amount').eq('cycle_id', cycleId).eq('ward_id', wardId).order('amount', { ascending: false })) as Option[];

export const countyName = () => cached('county_name', async () => {
  const { data } = await serviceClient().from('county').select('name').maybeSingle();
  return ((data as { name: string } | null)?.name ?? 'County') as string;
});
