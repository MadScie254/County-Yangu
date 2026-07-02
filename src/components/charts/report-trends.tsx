"use client";

import { ResponsiveLine } from "@nivo/line";
import { reportTrends } from "@/lib/data";

const keys = ["Water", "Roads", "Education", "Health"] as const;
const colors = ["#285a3a", "#425466", "#b93336", "#f2b33d"];

export function ReportTrends() {
  const data = keys.map((key) => ({
    id: key,
    data: reportTrends.map((point) => ({
      x: point.month,
      y: point[key],
    })),
  }));

  return (
    <div className="h-80" aria-label="Report trend line chart">
      <ResponsiveLine
        data={data}
        margin={{ top: 16, right: 24, bottom: 52, left: 48 }}
        colors={colors}
        lineWidth={3}
        pointSize={7}
        pointBorderWidth={2}
        pointBorderColor="#fffdf5"
        useMesh
        enableSlices="x"
        axisBottom={{ tickSize: 0, tickPadding: 8 }}
        axisLeft={{ tickSize: 0, tickPadding: 8 }}
        theme={{
          fontFamily: "var(--font-public)",
          text: { fill: "#17211c" },
          grid: { line: { stroke: "#d8d2bf", strokeDasharray: "4 6" } },
        }}
        legends={[
          {
            anchor: "bottom",
            direction: "row",
            translateY: 46,
            itemWidth: 90,
            itemHeight: 18,
            symbolSize: 10,
          },
        ]}
      />
    </div>
  );
}
