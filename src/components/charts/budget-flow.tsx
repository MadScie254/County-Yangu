"use client";

import { scaleLinear, scaleSqrt } from "d3-scale";
import { useMemo, useState } from "react";
import { budgetLinks, budgetNodes } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import type { Locale } from "@/lib/locales";

const positions: Record<string, { x: number; y: number }> = {
  county: { x: 8, y: 50 },
  water: { x: 31, y: 18 },
  roads: { x: 31, y: 40 },
  education: { x: 31, y: 62 },
  health: { x: 31, y: 84 },
  "kimilili-ward": { x: 58, y: 18 },
  "kabuchai-ward": { x: 58, y: 40 },
  "lwandanyi-ward": { x: 58, y: 62 },
  "naitiri-ward": { x: 58, y: 84 },
  "project-water": { x: 88, y: 18 },
  "project-drain": { x: 88, y: 40 },
  "project-classroom": { x: 88, y: 62 },
  "project-solar": { x: 88, y: 84 },
};

export function BudgetFlow({ locale }: { locale: Locale }) {
  const [activeId, setActiveId] = useState("county");
  const nodeById = useMemo(
    () => new Map(budgetNodes.map((node) => [node.id, node])),
    [],
  );
  const width = scaleSqrt().domain([3_000_000, 190_000_000]).range([2, 12]);
  const alpha = scaleLinear().domain([3_000_000, 190_000_000]).range([0.35, 0.92]);
  const activeNode = nodeById.get(activeId);

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <svg
        role="img"
        aria-label="Budget flow from county envelope to sectors, wards, and projects"
        className="aspect-[1.55] w-full"
        viewBox="0 0 100 100"
      >
        <defs>
          <linearGradient id="linkGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-cane)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-maize)" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="activeLinkGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-cane)" />
            <stop offset="100%" stopColor="var(--color-bead-red)" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {budgetLinks.map((link) => {
          const start = positions[link.source];
          const end = positions[link.target];
          const isActive = activeId === link.source || activeId === link.target;
          return (
            <path
              d={`M ${start.x + 4} ${start.y} C ${(start.x + end.x) / 2} ${start.y}, ${(start.x + end.x) / 2} ${end.y}, ${end.x - 4} ${end.y}`}
              fill="none"
              key={`${link.source}-${link.target}`}
              opacity={isActive ? 1 : alpha(link.amount)}
              stroke={isActive ? "url(#activeLinkGradient)" : "url(#linkGradient)"}
              strokeLinecap="round"
              strokeWidth={width(link.amount)}
              className="transition-all duration-500"
            />
          );
        })}
        {budgetNodes.map((node) => {
          const position = positions[node.id];
          const isActive = activeId === node.id;
          return (
            <g
              className="cursor-pointer focus:outline-none"
              key={node.id}
              onClick={() => setActiveId(node.id)}
              tabIndex={0}
              aria-label={`${node.label}: ${formatCurrency(node.amount, locale)}`}
            >
              <circle
                cx={position.x}
                cy={position.y}
                fill={isActive ? "var(--color-bead-red)" : node.kind === "project" ? "var(--color-maize)" : "var(--color-cane)"}
                r={node.kind === "county" ? 6.5 : node.kind === "project" ? 4.1 : 5.2}
                stroke="var(--color-surface)"
                strokeWidth={isActive ? "2" : "1.2"}
                filter={isActive ? "url(#glow)" : undefined}
                className="transition-all duration-300"
              />
              <text
                fill="var(--color-charcoal)"
                fontSize="3.1"
                fontWeight="800"
                textAnchor={position.x > 74 ? "end" : "start"}
                x={position.x > 74 ? position.x - 5 : position.x + 5}
                y={position.y - 1}
              >
                <title>{node.label}</title>
                {node.label.length > 13 ? node.label.slice(0, 12) + "…" : node.label}
              </text>
              <text
                fill="var(--color-muted)"
                fontFamily="var(--font-roboto-mono)"
                fontSize="2.6"
                textAnchor={position.x > 74 ? "end" : "start"}
                x={position.x > 74 ? position.x - 5 : position.x + 5}
                y={position.y + 3}
              >
                <title>{formatCurrency(node.amount, locale)}</title>
                {formatCurrency(node.amount, locale).replace("Ksh", "KES").length > 15
                  ? formatCurrency(node.amount, locale).replace("Ksh", "KES").slice(0, 14) + "…"
                  : formatCurrency(node.amount, locale).replace("Ksh", "KES")}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 rounded-md bg-[var(--color-bg)] p-3">
        <p className="text-xs font-black uppercase text-[var(--color-muted)]">
          Selected flow
        </p>
        <p className="font-black">{activeNode?.label}</p>
        <p className="font-data text-lg">{activeNode ? formatCurrency(activeNode.amount, locale) : null}</p>
      </div>
    </div>
  );
}
