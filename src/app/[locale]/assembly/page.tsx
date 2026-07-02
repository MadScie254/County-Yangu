import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { getWard, projects, reports, wards } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/locales";
import { getMessages } from "@/lib/messages";
import { formatCurrency, formatNumber } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const messages = getMessages(locale);
  return {
    title: messages.assembly.title,
    description: messages.assembly.intro,
  };
}

export default async function AssemblyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const messages = getMessages(locale);
  const topWards = wards.slice(0, 12);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <SectionHeader title={messages.assembly.title}>{messages.assembly.intro}</SectionHeader>
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <p className="text-sm font-black">{messages.assembly.compliance}</p>
          <Button className="mt-3" type="button">
            <FileText aria-hidden="true" size={18} />
            {messages.assembly.export}
          </Button>
        </div>
      </div>

      <section className="mt-8 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-black">{messages.assembly.comparison}</h2>
          <Button variant="secondary" type="button">
            <Download aria-hidden="true" size={18} />
            CSV
          </Button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)]">
                <th className="py-3 pr-4">Ward</th>
                <th className="py-3 pr-4">Allocated</th>
                <th className="py-3 pr-4">Spent</th>
                <th className="py-3 pr-4">Completion</th>
                <th className="py-3 pr-4">Open reports</th>
                <th className="py-3 pr-4">Avg resolution</th>
              </tr>
            </thead>
            <tbody>
              {topWards.map((ward, index) => {
                const allocated = 12_000_000 + index * 1_150_000;
                const spent = allocated * (0.46 + (index % 5) * 0.08);
                return (
                  <tr className="border-b border-[var(--color-line)] last:border-0" key={ward.id}>
                    <td className="py-3 pr-4 font-black">{ward.name}</td>
                    <td className="py-3 pr-4 font-data">{formatCurrency(allocated, locale)}</td>
                    <td className="py-3 pr-4 font-data">{formatCurrency(spent, locale)}</td>
                    <td className="py-3 pr-4 font-data">{formatNumber(42 + (index * 7) % 51, locale)}%</td>
                    <td className="py-3 pr-4 font-data">{ward.openReports}</td>
                    <td className="py-3 pr-4 font-data">{18 + (index % 7) * 5}h</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <h2 className="text-2xl font-black">{messages.assembly.queue}</h2>
          <div className="mt-4 grid gap-3">
            {reports.map((report) => (
              <article className="rounded-md bg-[var(--color-bg)] p-4" key={report.reference}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-data font-black">{report.reference}</p>
                    <p className="text-sm font-bold text-[var(--color-muted)]">
                      {getWard(report.wardId)?.name} · {report.category} · {report.channel.toUpperCase()}
                    </p>
                  </div>
                  <span className="rounded bg-[var(--color-maize-soft)] px-2 py-1 text-xs font-black capitalize">
                    {report.status.replace(/_/g, " ")}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <h2 className="text-2xl font-black">Project delivery risk</h2>
          <div className="mt-4 grid gap-3">
            {projects.map((project) => (
              <div className="rounded-md bg-[var(--color-bg)] p-4" key={project.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black">{project.title}</p>
                  <span className="font-data text-sm font-black">{Math.round((project.spent / project.budget) * 100)}%</span>
                </div>
                <div className="mt-3 h-3 rounded-full bg-black/10">
                  <div className="h-3 rounded-full bg-[var(--color-cane)]" style={{ width: `${Math.min(100, (project.spent / project.budget) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
