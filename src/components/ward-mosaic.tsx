"use client";

import { scaleLinear } from "d3-scale";
import { interpolateRgb } from "d3-interpolate";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { Ward } from "@/lib/data";
import { useCountyStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const rows = [5, 7, 8, 9, 8, 6, 2];

function getTiles(wards: Ward[]) {
  let index = 0;
  return rows.flatMap((count, row) => {
    const offset = (9 - count) / 2;
    return Array.from({ length: count }, (_, col) => {
      const ward = wards[index++];
      return {
        ward,
        x: (offset + col) * 10.4 + (row % 2) * 0.9,
        y: row * 9.2,
        width: 9.6,
        height: 8.4,
      };
    });
  });
}

export function WardMosaic({
  wards,
  layer = "trust",
  className,
}: {
  wards: Ward[];
  layer?: "trust" | "participation";
  className?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const selectedWardId = useCountyStore((state) => state.selectedWardId);
  const setSelectedWard = useCountyStore((state) => state.setSelectedWard);
  const reduceMotion = useReducedMotion();
  const tiles = useMemo(() => getTiles(wards), [wards]);
  const color = useMemo(
    () =>
      scaleLinear<string>()
        .domain(layer === "trust" ? [45, 70, 95] : [28, 52, 76])
        .range(["#dce7d6", "#f2b33d", "#b93336"])
        .interpolate(interpolateRgb),
    [layer],
  );

  const activeWard = wards.find((ward) => ward.id === (hovered ?? selectedWardId));

  return (
    <div className={cn("rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3", className)}>
      <svg
        role="img"
        aria-label={`Bungoma ward mosaic showing ${layer === "trust" ? "trust index" : "participation rate"} for 45 wards`}
        viewBox="0 0 96 67"
        className="aspect-[1.43] w-full"
      >
        <defs>
          <pattern id="bead-lines" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 0 4 L 4 0" stroke="rgba(23,33,28,0.18)" strokeWidth="0.35" />
          </pattern>
        </defs>
        {tiles.map(({ ward, x, y, width, height }, index) => {
          const value = layer === "trust" ? ward.trustIndex : ward.participationRate;
          const isSelected = ward.id === selectedWardId;
          return (
            <motion.rect
              animate={reduceMotion ? undefined : { opacity: [0.82, 1, 0.9] }}
              aria-label={`${ward.name}: ${value}%`}
              className="cursor-pointer focus:outline-none"
              fill={color(value)}
              height={height}
              initial={reduceMotion ? undefined : { opacity: 0, y: y + 2 }}
              key={ward.id}
              onClick={() => setSelectedWard(ward.id)}
              onFocus={() => setHovered(ward.id)}
              onMouseEnter={() => setHovered(ward.id)}
              onMouseLeave={() => setHovered(null)}
              rx="1.2"
              stroke={isSelected ? "#17211c" : "rgba(23,33,28,0.36)"}
              strokeWidth={isSelected ? 1.25 : 0.45}
              tabIndex={0}
              transition={{
                delay: index * 0.015,
                duration: 0.55,
                repeat: isSelected ? Infinity : 0,
                repeatDelay: 2.4,
              }}
              width={width}
              x={x}
              y={y}
            />
          );
        })}
        <rect fill="url(#bead-lines)" height="67" opacity="0.24" width="96" />
      </svg>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-muted)]">
            {layer === "trust" ? "Ward Trust Index" : "Participation rate"}
          </p>
          <p className="text-lg font-black">
            {activeWard?.name ?? "Choose a ward"}
          </p>
        </div>
        <div className="rounded-md bg-[var(--color-charcoal)] px-3 py-2 font-data text-xl font-black text-white">
          {activeWard
            ? `${layer === "trust" ? activeWard.trustIndex : activeWard.participationRate}%`
            : "--"}
        </div>
      </div>
    </div>
  );
}
