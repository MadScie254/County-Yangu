"use client";

import { scaleLinear } from "d3-scale";
import { interpolateRgb } from "d3-interpolate";
import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";
import type { FeatureCollection, Polygon } from "geojson";
import type { Ward } from "@/lib/data";

function wardFeatures(wards: Ward[], layer: "trust" | "participation"): FeatureCollection<Polygon> {
  const color = scaleLinear<string>()
    .domain(layer === "trust" ? [45, 70, 95] : [28, 52, 76])
    .range(["#dce7d6", "#f2b33d", "#b93336"])
    .interpolate(interpolateRgb);

  const centerLng = 34.56;
  const centerLat = 0.64;
  const cols = 9;
  const cellLng = 0.058;
  const cellLat = 0.045;

  return {
    type: "FeatureCollection",
    features: wards.map((ward, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const lng = centerLng + (col - 4) * cellLng + (row % 2) * 0.016;
      const lat = centerLat + (2 - row) * cellLat;
      const value = layer === "trust" ? ward.trustIndex : ward.participationRate;

      return {
        type: "Feature",
        properties: {
          id: ward.id,
          name: ward.name,
          value,
          fill: color(value),
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [lng - cellLng * 0.42, lat - cellLat * 0.42],
              [lng + cellLng * 0.42, lat - cellLat * 0.42],
              [lng + cellLng * 0.42, lat + cellLat * 0.42],
              [lng - cellLng * 0.42, lat + cellLat * 0.42],
              [lng - cellLng * 0.42, lat - cellLat * 0.42],
            ],
          ],
        },
      };
    }),
  };
}

export function WardMapClient({
  wards,
  layer = "trust",
}: {
  wards: Ward[];
  layer?: "trust" | "participation";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const data = useMemo(() => wardFeatures(wards, layer), [wards, layer]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [34.56, 0.64],
      zoom: 8.4,
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
            paint: { "raster-opacity": 0.24 },
          },
        ],
      },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      map.addSource("wards", { type: "geojson", data });
      map.addLayer({
        id: "ward-fill",
        type: "fill",
        source: "wards",
        paint: {
          "fill-color": ["get", "fill"],
          "fill-opacity": 0.84,
        },
      });
      map.addLayer({
        id: "ward-line",
        type: "line",
        source: "wards",
        paint: {
          "line-color": "#17211c",
          "line-opacity": 0.46,
          "line-width": 1,
        },
      });
      map.on("mousemove", "ward-fill", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        map.getCanvas().style.cursor = "pointer";
        const coordinates = event.lngLat;
        new maplibregl.Popup({ closeButton: false, closeOnClick: false })
          .setLngLat(coordinates)
          .setHTML(`<strong>${feature.properties?.name}</strong><br/>${feature.properties?.value}%`)
          .addTo(map);
      });
      map.on("mouseleave", "ward-fill", () => {
        map.getCanvas().style.cursor = "";
        document.querySelectorAll(".maplibregl-popup").forEach((node) => node.remove());
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource("wards") as maplibregl.GeoJSONSource | undefined;
    source?.setData(data);
  }, [data]);

  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]">
      <div ref={containerRef} className="h-[420px] min-h-[320px] w-full" aria-label="Interactive MapLibre ward map" />
    </div>
  );
}
