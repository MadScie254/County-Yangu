import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProposeForm } from "@/components/forms/propose-form";
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
    title: messages.propose.title,
    description: messages.propose.intro,
  };
}

export default async function ProposePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const messages = getMessages(locale);
  const propose = messages.propose;

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <SectionHeader title={propose.title}>
          {propose.intro}
        </SectionHeader>
        <div className="mt-6 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-sm leading-relaxed text-[var(--color-charcoal)]">
          <h2 className="font-display text-lg font-black text-[var(--color-charcoal)]">Why Propose?</h2>
          <p className="mt-2">
            The best ideas for the county come directly from you. If you see a missing infrastructure piece, a broken road, or a potential community project, submit it here.
          </p>
          <p className="mt-4">
            Once submitted, your proposal instantly joins the community tracker and can be viewed by your Ward Representatives and neighbors.
          </p>
        </div>
      </div>
      <ProposeForm />
    </div>
  );
}
