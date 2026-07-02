"use client";

import { ResponsivePie } from "@nivo/pie";
import { channels } from "@/lib/data";

const colors = ["#285a3a", "#f2b33d", "#b93336"];

export function ChannelChart() {
  return (
    <div className="h-72" aria-label="Participation by channel chart">
      <ResponsivePie
        data={channels.map((channel) => ({
          id: channel.label,
          label: channel.label,
          value: channel.value,
        }))}
        margin={{ top: 18, right: 18, bottom: 56, left: 18 }}
        innerRadius={0.58}
        padAngle={1}
        cornerRadius={3}
        colors={colors}
        borderWidth={2}
        borderColor="#fffdf5"
        enableArcLinkLabels={false}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor="#17211c"
        legends={[
          {
            anchor: "bottom",
            direction: "row",
            translateY: 44,
            itemWidth: 72,
            itemHeight: 18,
            symbolShape: "circle",
          },
        ]}
      />
    </div>
  );
}
