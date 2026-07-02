import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { getReport, getWard, reports } from "@/lib/data";
import { isLocale } from "@/lib/locales";
import { getMessages } from "@/lib/messages";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}): Promise<Metadata> {
  const { locale, reference } = await params;
  if (!isLocale(locale)) return {};
  const report = getReport(reference);
  return {
    title: report ? `Report ${report.reference}` : "Report status",
    description: "Anonymous County Yangu report status lookup.",
  };
}

export function generateStaticParams() {
  return reports.flatMap((report) => [
    { locale: "en", reference: report.reference },
    { locale: "sw", reference: report.reference },
  ]);
}

export default async function ReportStatusPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const report = getReport(reference);
  if (!report) notFound();
  const ward = getWard(report.wardId);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link className="text-sm font-bold underline" href={`/${locale}/report`}>
        Back to report
      </Link>
      <section className="mt-5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--color-bead-red)]">
          {messages.report.reference}
        </p>
        <h1 className="mt-2 font-data text-3xl font-black">{report.reference}</h1>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-bold text-[var(--color-muted)]">{messages.common.ward}</dt>
            <dd className="mt-1 font-black">{ward?.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[var(--color-muted)]">{messages.common.status}</dt>
            <dd className="mt-1 font-black capitalize">{report.status.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[var(--color-muted)]">{messages.common.channel}</dt>
            <dd className="mt-1 font-black uppercase">{report.channel}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-[var(--color-muted)]">Updated</dt>
            <dd className="mt-1 font-data font-black">{new Date(report.updatedAt).toLocaleDateString("en-KE")}</dd>
          </div>
        </dl>
        <div className="mt-6 rounded-md bg-[var(--color-maize-soft)] p-4">
          <p className="font-black">Privacy check</p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            This public lookup shows case status only. It does not expose report text, phone numbers, phone hashes, or any re-identifying field.
          </p>
        </div>
        <ButtonLink className="mt-5" href={`/${locale}/track`}>
          Track linked projects
        </ButtonLink>
      </section>
    </div>
  );
}
