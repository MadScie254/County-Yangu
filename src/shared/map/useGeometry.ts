import { useQuery } from '@tanstack/react-query';
import { county } from '@/shared/config/county';
import type { WardCollection } from './geo';

/**
 * Ward boundary polygons for this county, from /geo/<county>-wards.geojson (built by
 * scripts/load-boundaries.mjs from IEBC/OSM data). Returns null until real boundaries are loaded;
 * the map then shows sub-county markers instead of inventing shapes.
 */
export function useWardGeometry() {
  return useQuery({
    queryKey: ['ward-geometry', county.slug],
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<WardCollection | null> => {
      const res = await fetch(`/geo/${county.slug}-wards.geojson`, { headers: { accept: 'application/geo+json, application/json' } });
      if (!res.ok || !(res.headers.get('content-type') ?? '').match(/json/)) return null;
      const fc = (await res.json()) as WardCollection;
      return fc?.type === 'FeatureCollection' && fc.features.length > 0 ? fc : null;
    },
  });
}
