import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Map as MLMap, Marker as MLMarker, StyleSpecification, GeoJSONSource, LngLatBoundsLike, MapGeoJSONFeature } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { county, subCountyById, wardById } from '@/shared/config/county';
import type { PublicProject, WardStat } from '@/shared/api/types';
import { usePrefs } from '@/shared/state/prefs';
import { aggregateBySubCounty, metricValue, subMetricValue } from './aggregate';
import { bboxOf, centroidOf, type Bbox, type LngLat, type WardCollection } from './geo';
import { breaks, colorFor, inkOn, projectColors, type Metric } from './palette';
import { MapFallback } from './MapFallback';

export type MapSelection = { type: 'ward'; id: string } | { type: 'subcounty'; id: string } | null;

export type CountyMapHandle = {
  fitCounty: () => void;
  flyTo: (p: LngLat, zoom?: number) => void;
  locate: () => Promise<LngLat | null>;
  getCenter: () => LngLat | null;
};

export type CountyMapProps = {
  className?: string;
  ariaLabel: string;
  metric?: Metric;
  stats?: WardStat[];
  geometry?: WardCollection | null;
  projects?: PublicProject[];
  selection?: MapSelection;
  onSelect?: (s: MapSelection) => void;
  onSelectProject?: (slug: string) => void;
  /** Pin-drop mode: the map pans under a fixed centre pin and reports where it stops. */
  onCenterChange?: (p: LngLat) => void;
  interactive?: boolean;
  padding?: { top: number; right: number; bottom: number; left: number };
  labels: { zoomIn: string; zoomOut: string; recenter: string; locate: string; attribution: string; issues: (n: number) => string };
  /** Text shown if WebGL is unavailable. */
  fallback?: React.ReactNode;
};

const TILE_URL = (import.meta.env.VITE_TILE_URL as string | undefined) ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// Drain most of OSM's colour so our data reads first; keep roads and water legible.
const baseTone = (dark: boolean): Record<string, number> =>
  dark
    ? { 'raster-saturation': -0.85, 'raster-contrast': 0.1, 'raster-brightness-min': 0.02, 'raster-brightness-max': 0.5 }
    : { 'raster-saturation': -0.72, 'raster-contrast': -0.04, 'raster-brightness-min': 0.1, 'raster-brightness-max': 1 };

function baseStyle(dark: boolean, attribution: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      base: { type: 'raster', tiles: [TILE_URL.replace('{s}', 'a')], tileSize: 256, maxzoom: 19, attribution },
    },
    layers: [{ id: 'base', type: 'raster', source: 'base', paint: baseTone(dark) }],
  };
}

const paddedBounds = (bbox: number[], pad: number): LngLatBoundsLike => [
  [(bbox[0] as number) - pad, (bbox[1] as number) - pad],
  [(bbox[2] as number) + pad, (bbox[3] as number) + pad],
];

export const CountyMap = forwardRef<CountyMapHandle, CountyMapProps>(function CountyMap(props, ref) {
  const { className, ariaLabel, metric = 'open', stats, geometry, projects, selection, onSelect, onSelectProject, onCenterChange, interactive = true, padding, labels, fallback } = props;

  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const libRef = useRef<typeof import('maplibre-gl') | null>(null);
  const markers = useRef<MLMarker[]>([]);
  const youMarker = useRef<MLMarker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const theme = usePrefs((s) => s.theme);
  const contrast = usePrefs((s) => s.highContrast);
  const dark = useMemo(() => contrast || theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches), [theme, contrast]);

  // keep the latest callbacks without re-creating the map
  const cb = useRef({ onSelect, onSelectProject, onCenterChange, labels });
  cb.current = { onSelect, onSelectProject, onCenterChange, labels };
  const padRef = useRef(padding);
  padRef.current = padding;

  const bbox = county.bbox as Bbox | null;

  useImperativeHandle(ref, () => ({
    fitCounty: () => {
      if (mapRef.current && bbox) mapRef.current.fitBounds(paddedBounds(bbox, 0), { padding: padRef.current ?? 24, duration: 700 });
    },
    flyTo: (p, zoom = 13.5) => mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom, duration: 800, padding: padRef.current }),
    getCenter: () => {
      const c = mapRef.current?.getCenter();
      return c ? { lat: c.lat, lng: c.lng } : null;
    },
    locate: () =>
      new Promise<LngLat | null>((resolve) => {
        const map = mapRef.current;
        const lib = libRef.current;
        if (!map || !lib || !('geolocation' in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const el = document.createElement('div');
            el.className = 'county-you';
            youMarker.current?.remove();
            youMarker.current = new lib.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
            map.flyTo({ center: [p.lng, p.lat], zoom: 14, duration: 900, padding: padRef.current });
            resolve(p);
          },
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        );
      }),
  }));

  // ---- create the map once --------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    (async () => {
      try {
        const [lib] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);
        if (cancelled || !container.current) return;
        libRef.current = lib;
        map = new lib.Map({
          container: container.current,
          style: baseStyle(dark, labels.attribution),
          center: county.center,
          zoom: 10.5,
          minZoom: 8.5,
          maxZoom: 18,
          maxBounds: bbox ? paddedBounds(bbox, 0.35) : undefined,
          attributionControl: { compact: true },
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          interactive,
          cooperativeGestures: false,
          fadeDuration: 150,
        });
        map.touchZoomRotate.disableRotation();
        if (interactive) {
          map.addControl(new lib.NavigationControl({ showCompass: false, visualizePitch: false }), 'bottom-right');
        }
        mapRef.current = map;
        // Use style.load, not load: `load` waits for basemap tiles, which never arrive when the phone
        // is offline. Our data layers must draw regardless of the basemap.
        let started = false;
        const start = () => {
          if (started || !map) return;
          started = true;
          if (bbox) map.fitBounds(paddedBounds(bbox, 0), { padding: padRef.current ?? 24, animate: false });
          setReady(true);
        };
        map.once('style.load', start);
        if (map.isStyleLoaded()) start();
        map.on('moveend', () => {
          const c = map?.getCenter();
          if (c && cb.current.onCenterChange) cb.current.onCenterChange({ lat: c.lat, lng: c.lng });
        });
        map.on('webglcontextlost', () => setFailed(true));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      youMarker.current?.remove();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // The map is created once; theme changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- theme: re-tone the basemap ---------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [k, v] of Object.entries(baseTone(dark))) map.setPaintProperty('base', k as 'raster-saturation', v);
  }, [dark, ready]);

  // ---- data: metric values, colour breaks -----------------------------------------------------------
  const view = useMemo(() => {
    const wardVals = (stats ?? []).map((s) => metricValue(metric, s)).filter((v): v is number => v != null);
    const subs = aggregateBySubCounty(stats);
    const subVals = subs.map((s) => subMetricValue(metric, s)).filter((v): v is number => v != null);
    return {
      subs,
      wardBreaks: breaks(metric, wardVals),
      subBreaks: breaks(metric, subVals),
      subMax: Math.max(1, ...subVals),
      byWard: new Map((stats ?? []).map((s) => [s.ward_id, s])),
    };
  }, [stats, metric]);

  // ---- ward polygons (when real boundaries are loaded) ---------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const hasPolys = Boolean(geometry && geometry.features.length);
    const fc = hasPolys
      ? {
          type: 'FeatureCollection' as const,
          features: geometry!.features.map((f) => {
            const s = view.byWard.get(f.properties.id);
            const v = s ? metricValue(metric, s) : null;
            return { ...f, properties: { ...f.properties, color: colorFor(metric, v, view.wardBreaks), value: v ?? -1 } };
          }),
        }
      : null;

    const src = map.getSource('wards') as GeoJSONSource | undefined;
    if (!fc) {
      if (map.getLayer('wards-line')) map.removeLayer('wards-line');
      if (map.getLayer('wards-hover')) map.removeLayer('wards-hover');
      if (map.getLayer('wards-fill')) map.removeLayer('wards-fill');
      if (src) map.removeSource('wards');
      return;
    }
    if (src) {
      src.setData(fc);
      return;
    }
    map.addSource('wards', { type: 'geojson', data: fc, promoteId: 'id' });
    map.addLayer({ id: 'wards-fill', type: 'fill', source: 'wards', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.82, ['boolean', ['feature-state', 'hover'], false], 0.74, 0.58] } });
    map.addLayer({ id: 'wards-line', type: 'line', source: 'wards', paint: { 'line-color': dark ? '#f1ecdf' : '#101c2e', 'line-opacity': 0.55, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 14, 1.6] } });
    map.addLayer({ id: 'wards-hover', type: 'line', source: 'wards', paint: { 'line-color': dark ? '#ffffff' : '#101c2e', 'line-width': 3, 'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, ['boolean', ['feature-state', 'hover'], false], 0.9, 0] } });

    let hovered: string | number | undefined;
    map.on('mousemove', 'wards-fill', (e) => {
      const f = e.features?.[0] as MapGeoJSONFeature | undefined;
      if (!f) return;
      if (hovered !== undefined && hovered !== f.id) map.setFeatureState({ source: 'wards', id: hovered }, { hover: false });
      hovered = f.id;
      if (f.id !== undefined) map.setFeatureState({ source: 'wards', id: f.id }, { hover: true });
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'wards-fill', () => {
      if (hovered !== undefined) map.setFeatureState({ source: 'wards', id: hovered }, { hover: false });
      hovered = undefined;
      map.getCanvas().style.cursor = '';
    });
    map.on('click', 'wards-fill', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) cb.current.onSelect?.({ type: 'ward', id });
    });
  }, [ready, geometry, view, metric, dark]);

  // ---- sub-county bubbles (real centroids; shown until ward polygons exist) --------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !ready) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];
    if (geometry && geometry.features.length) return; // polygons take over
    for (const sc of view.subs) {
      const v = subMetricValue(metric, sc);
      const color = colorFor(metric, v, view.subBreaks);
      const size = v == null ? 34 : 34 + Math.sqrt(Math.max(0, v) / (metric === 'trust' ? 100 : view.subMax)) * 26;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'county-bubble';
      el.style.setProperty('--size', `${Math.round(size)}px`);
      el.style.setProperty('--bg', color);
      el.style.setProperty('--fg', inkOn(color));
      const selectedSub = selection?.type === 'subcounty' ? selection.id : selection?.type === 'ward' ? wardById.get(selection.id)?.subCountyId : undefined;
      el.dataset.selected = String(selectedSub === sc.id);
      el.setAttribute('aria-label', `${sc.name}: ${metric === 'trust' ? (v ?? '–') : cb.current.labels.issues(v ?? 0)}`);
      el.innerHTML = `<span>${v == null ? '–' : Math.round(v)}</span><span class="name"></span>`;
      (el.querySelector('.name') as HTMLElement).textContent = sc.name;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        cb.current.onSelect?.({ type: 'subcounty', id: sc.id });
      });
      markers.current.push(new lib.Marker({ element: el }).setLngLat([sc.lng, sc.lat]).addTo(map));
    }
  }, [ready, geometry, view, metric, selection]);

  // ---- projects -----------------------------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || !ready) return;
    const pts = (projects ?? []).filter((p) => p.lat != null && p.lng != null);
    const fc: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: pts.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng as number, p.lat as number] }, properties: { slug: p.slug, title: p.title, status: p.status, color: projectColors[p.status] ?? '#64748b' } })),
    };
    const src = map.getSource('projects') as GeoJSONSource | undefined;
    if (src) {
      src.setData(fc);
      return;
    }
    if (!pts.length) return;
    map.addSource('projects', { type: 'geojson', data: fc });
    map.addLayer({ id: 'projects-halo', type: 'circle', source: 'projects', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 7, 15, 13], 'circle-color': '#ffffff', 'circle-opacity': 0.95 } });
    map.addLayer({ id: 'projects-dot', type: 'circle', source: 'projects', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4.5, 15, 9], 'circle-color': ['get', 'color'] } });
    const popup = new lib.Popup({ closeButton: false, closeOnClick: false, offset: 14, maxWidth: '240px' });
    map.on('mousemove', 'projects-dot', (e) => {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = 'pointer';
      popup.setLngLat((f.geometry as Point).coordinates as [number, number]).setText(String(f.properties?.title)).addTo(map);
    });
    map.on('mouseleave', 'projects-dot', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });
    map.on('click', 'projects-dot', (e) => {
      const slug = e.features?.[0]?.properties?.slug as string | undefined;
      if (slug) cb.current.onSelectProject?.(slug);
    });
  }, [ready, projects]);

  // ---- selection: highlight + camera --------------------------------------------------------------------------------
  const lastSel = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (lastSel.current && map.getSource('wards')) map.setFeatureState({ source: 'wards', id: lastSel.current }, { selected: false });
    lastSel.current = null;
    if (!selection) return;
    if (selection.type === 'ward') {
      const feat = geometry?.features.find((f) => f.properties.id === selection.id);
      if (feat && map.getSource('wards')) {
        map.setFeatureState({ source: 'wards', id: selection.id }, { selected: true });
        lastSel.current = selection.id;
        const b = bboxOf(feat.geometry);
        map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: padRef.current ?? 40, maxZoom: 15, duration: 800 });
      } else {
        // No polygon for this ward yet: centre on its sub-county's real centroid.
        const subId = wardById.get(selection.id)?.subCountyId;
        const c = subId ? subCountyById.get(subId) : undefined;
        if (c?.lat != null && c.lng != null) map.flyTo({ center: [c.lng, c.lat], zoom: 13, duration: 800, padding: padRef.current });
      }
    } else {
      const sc = subCountyById.get(selection.id);
      if (sc?.lat != null && sc.lng != null) map.flyTo({ center: [sc.lng, sc.lat], zoom: 12.6, duration: 800, padding: padRef.current });
    }
  }, [selection, ready, geometry]);

  if (failed) {
    return (
      <div className={className}>
        <MapFallback aria={ariaLabel}>{fallback}</MapFallback>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* inline style on purpose: maplibre-gl.css is unlayered and would beat Tailwind's layered utilities */}
      <div ref={container} role="application" aria-label={ariaLabel} style={{ position: 'absolute', inset: 0 }} />
      {!ready && <div aria-hidden className="skeleton absolute inset-0 rounded-none" />}
    </div>
  );
});

export { centroidOf };
