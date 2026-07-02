import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LiveTicker } from "@/components/live-ticker";
import { PulseDashboard } from "@/components/pulse-dashboard";
import { SectionHeader } from "@/components/ui/section-header";
import { isLocale, type Locale } from "@/lib/locales";
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
    title: messages.pulse.title,
    description: messages.pulse.intro,
  };
}

export default async function PulsePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const messages = getMessages(locale);
  const pulse = messages.pulse;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
        <SectionHeader title={pulse.title}>{pulse.intro}</SectionHeader>
        <LiveTicker
          labels={{
            votes: messages.home.votes,
            reports: messages.home.reports,
            milestones: messages.home.milestones,
          }}
          locale={locale}
        />
      </div>
      <div className="mt-8">
        <PulseDashboard
          labels={{
            participation: pulse.participation,
            trust: pulse.trust,
            formula: pulse.formula,
            budgetFlow: pulse.budgetFlow,
            channels: pulse.channels,
            funnel: pulse.funnel,
            trends: pulse.trends,
            snapshot: pulse.snapshot,
          }}
          locale={locale}
        />
      </div>
    </div>
  );
}
