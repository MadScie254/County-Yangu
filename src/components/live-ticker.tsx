"use client";

import { Activity, CheckCircle2, MessageCircleWarning, Vote } from "lucide-react";
import { useEffect, useState } from "react";
import { countyTotals } from "@/lib/data";
import { formatNumber } from "@/lib/utils";
import type { Locale } from "@/lib/locales";

export function LiveTicker({
  labels,
  locale,
}: {
  labels: { votes: string; reports: string; milestones: string };
  locale: Locale;
}) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setPulse((value) => value + 1), 3200);
    return () => window.clearInterval(timer);
  }, []);

  const metrics = [
    {
      label: labels.votes,
      value: countyTotals.votesCast + pulse * 3,
      icon: Vote,
    },
    {
      label: labels.reports,
      value: countyTotals.reportsFiled + pulse,
      icon: MessageCircleWarning,
    },
    {
      label: labels.milestones,
      value: countyTotals.milestonesHit,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-sm" role="status">
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--color-bead-red)]">
        <Activity aria-hidden="true" size={18} />
        Live now
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="rounded-md bg-[var(--color-bg)] p-3" key={metric.label}>
              <div className="flex items-center gap-2 text-xs font-bold uppercase text-[var(--color-muted)]">
                <Icon aria-hidden="true" size={15} />
                {metric.label}
              </div>
              <div className="mt-2 font-data text-2xl font-black">
                {formatNumber(metric.value, locale)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
