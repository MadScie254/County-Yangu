import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportForm } from "@/components/forms/report-form";
import { SectionHeader } from "@/components/ui/section-header";
import { isLocale } from "@/lib/locales";
import { getMessages } from "@/lib/messages";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const messages = getMessages(locale);
  return {
    title: messages.report.title,
    description: messages.report.intro,
  };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const report = messages.report;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.82fr_1.18fr]">
      <div>
        <SectionHeader title={report.title}>{report.intro}</SectionHeader>
        <div className="mt-6 grid gap-3">
          {(report.privacyBullets as string[]).map((item) => (
            <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 font-bold" key={item}>
              {item}
            </div>
          ))}
        </div>
      </div>
      <ReportForm />
    </div>
  );
}
