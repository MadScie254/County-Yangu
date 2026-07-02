"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { Search } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { WardMapClient } from "@/components/maps/ward-map-client";
import { projects, projectStatusLabel, wards, getWard } from "@/lib/data";
import { formatCurrency } from "@/lib/utils";
import type { Locale } from "@/lib/locales";

export function ProjectExplorer() {
  const t = useTranslations("track");
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return projects;
    return projects.filter((project) => {
      const ward = getWard(project.wardId);
      return [project.title, project.sector, project.contractor, project.status, ward?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(text));
    });
  }, [query]);

  return (
    <div className="grid gap-5">
      <label className="relative block">
        <span className="sr-only">{t("search")}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden="true" />
        <input
          className="min-h-12 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-11 text-base font-semibold outline-none focus-visible:border-[var(--color-bead-red)] focus-visible:ring-3 focus-visible:ring-[var(--color-bead-red)]/25"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("search")}
          value={query}
        />
      </label>

      <Tabs.Root defaultValue="list">
        <Tabs.List className="inline-flex rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-1" aria-label="Project views">
          <Tabs.Trigger className="min-h-11 rounded px-4 text-sm font-black data-[state=active]:bg-[var(--color-charcoal)] data-[state=active]:text-white" value="list">
            {t("list")}
          </Tabs.Trigger>
          <Tabs.Trigger className="min-h-11 rounded px-4 text-sm font-black data-[state=active]:bg-[var(--color-charcoal)] data-[state=active]:text-white" value="map">
            {t("map")}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content className="mt-4" value="list">
          <div className="grid gap-4">
            {filtered.map((project) => {
              const ward = getWard(project.wardId);
              return (
                <Link
                  className="grid gap-4 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-cane)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-[var(--color-bead-red)] md:grid-cols-[1fr_auto]"
                  href={`/${locale}/track/${project.slug}`}
                  key={project.id}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[var(--color-maize-soft)] px-2 py-1 text-xs font-black">
                        {ward?.name}
                      </span>
                      <span className="rounded bg-[var(--color-bg)] px-2 py-1 text-xs font-black capitalize">
                        {projectStatusLabel(project.status)}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-black">{project.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                      {project.sector} · {project.contractor}
                    </p>
                  </div>
                  <div className="font-data text-lg font-black">
                    {formatCurrency(project.budget, locale)}
                  </div>
                </Link>
              );
            })}
          </div>
        </Tabs.Content>
        <Tabs.Content className="mt-4" value="map">
          <WardMapClient wards={wards} layer="trust" />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
