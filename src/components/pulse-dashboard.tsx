"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { BudgetFlow } from "@/components/charts/budget-flow";
import { ChannelChart } from "@/components/charts/channel-chart";
import { ReportTrends } from "@/components/charts/report-trends";
import { StatusFunnel } from "@/components/charts/status-funnel";
import { WardMapClient } from "@/components/maps/ward-map-client";
import { Button } from "@/components/ui/button";
import { WardMosaic } from "@/components/ward-mosaic";
import { wards } from "@/lib/data";
import type { Locale } from "@/lib/locales";

export function PulseDashboard({
  locale,
  labels,
}: {
  locale: Locale;
  labels: {
    participation: string;
    trust: string;
    formula: string;
    budgetFlow: string;
    channels: string;
    funnel: string;
    trends: string;
    snapshot: string;
  };
}) {
  const [layer, setLayer] = useState<"trust" | "participation">("trust");

  return (
    <div className="grid gap-6">
      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <Tabs.Root
            value={layer}
            onValueChange={(value) => setLayer(value as "trust" | "participation")}
          >
            <Tabs.List className="mb-4 inline-flex rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-1">
              <Tabs.Trigger className="min-h-11 rounded px-4 text-sm font-black data-[state=active]:bg-[var(--color-charcoal)] data-[state=active]:text-white" value="trust">
                {labels.trust}
              </Tabs.Trigger>
              <Tabs.Trigger className="min-h-11 rounded px-4 text-sm font-black data-[state=active]:bg-[var(--color-charcoal)] data-[state=active]:text-white" value="participation">
                {labels.participation}
              </Tabs.Trigger>
            </Tabs.List>
            <WardMosaic wards={wards} layer={layer} />
          </Tabs.Root>
          <p className="mt-3 rounded-md bg-[var(--color-maize-soft)] p-3 text-sm font-bold leading-6">
            {labels.formula}
          </p>
        </div>
        <WardMapClient wards={wards} layer={layer} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black">{labels.budgetFlow}</h2>
            <Button
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.set("snapshot", "public");
                void navigator.clipboard?.writeText(url.toString());
              }}
              variant="secondary"
            >
              <Share2 aria-hidden="true" size={18} />
              {labels.snapshot}
            </Button>
          </div>
          <BudgetFlow locale={locale} />
        </div>
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <h2 className="text-2xl font-black">{labels.channels}</h2>
          <ChannelChart />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <h2 className="text-2xl font-black">{labels.funnel}</h2>
          <StatusFunnel />
        </div>
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <h2 className="text-2xl font-black">{labels.trends}</h2>
          <ReportTrends />
        </div>
      </section>
    </div>
  );
}
