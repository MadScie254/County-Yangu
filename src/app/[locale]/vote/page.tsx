import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VoteForm } from "@/components/forms/vote-form";
import { SectionHeader } from "@/components/ui/section-header";
import { currentCycle, projectOptions, getVoteTotals } from "@/lib/data";
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
    title: messages.vote.title,
    description: messages.vote.intro,
  };
}

export default async function VotePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const messages = getMessages(locale);
  const vote = messages.vote;
  const totalVotes = projectOptions.reduce((sum, option) => sum + getVoteTotals(option), 0);

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <SectionHeader eyebrow={vote.cycle} title={vote.title}>
          {vote.intro}
        </SectionHeader>
        <div className="mt-6 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-[var(--color-bead-red)]">
            {currentCycle.title}
          </p>
          <dl className="mt-4 grid gap-3">
            <div className="flex justify-between gap-4">
              <dt className="font-bold text-[var(--color-muted)]">Envelope</dt>
              <dd className="font-data font-black">{formatCurrency(currentCycle.totalEnvelope, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-bold text-[var(--color-muted)]">{vote.liveTally}</dt>
              <dd className="font-data font-black">{formatNumber(totalVotes, locale)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-bold text-[var(--color-muted)]">Closes</dt>
              <dd className="font-data font-black">15 Jul 2026</dd>
            </div>
          </dl>
        </div>
        <div className="mt-6 rounded-md bg-[var(--color-maize-soft)] p-4">
          <h2 className="font-black">{vote.pastResults}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            FY 2025/26: 61% of votes arrived by USSD or IVR, and 14 ward projects were funded from public priorities.
          </p>
        </div>
      </div>
      <VoteForm locale={locale} />
    </div>
  );
}
