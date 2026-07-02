"use client";

import { ResponsiveBar } from "@nivo/bar";
import { statusFunnel } from "@/lib/data";

export function StatusFunnel() {
  return (
    <div className="h-72" aria-label="Project status funnel chart">
      <ResponsiveBar
        data={statusFunnel}
        keys={["count"]}
        indexBy="status"
        layout="horizontal"
        margin={{ top: 10, right: 24, bottom: 42, left: 92 }}
        padding={0.26}
        colors={["#425466"]}
        borderRadius={3}
        enableGridX
        enableGridY={false}
        labelTextColor="#fffdf5"
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        theme={{
          fontFamily: "var(--font-public)",
          text: { fill: "#17211c" },
          grid: { line: { stroke: "#d8d2bf", strokeDasharray: "4 6" } },
        }}
      />
    </div>
  );
}
