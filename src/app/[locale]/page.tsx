import { ArrowRight, FileSearch, MessageSquareWarning, Vote } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { LiveTicker } from "@/components/live-ticker";
import { WardMosaic } from "@/components/ward-mosaic";
import { countyTotals, dataSources, wards } from "@/lib/data";
import { isLocale, type Locale } from "@/lib/locales";
import { getMessages } from "@/lib/messages";
import { formatCurrency } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const messages = getMessages(locale);
  return {
    title: messages.home.title,
    description: messages.home.intro,
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam as Locale;
  const messages = getMessages(locale);
  const home = messages.home;

  const entryPoints = [
    { label: home.voteCta, href: `/${locale}/vote`, icon: Vote },
    { label: home.reportCta, href: `/${locale}/report`, icon: MessageSquareWarning },
    { label: home.trackCta, href: `/${locale}/track`, icon: FileSearch },
  ];

  return (
    <div>
      <section className="mx-auto grid min-h-[calc(100svh-8.5rem)] w-full max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-10">
        <div>
          <SectionHeader eyebrow={home.eyebrow} title={home.title}>
            {home.intro}
          </SectionHeader>
          <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {entryPoints.map((item) => {
              const Icon = item.icon;
              return (
                <ButtonLink href={item.href} key={item.href} variant={item.href.endsWith("vote") ? "primary" : "secondary"}>
                  <Icon aria-hidden="true" size={18} />
                  {item.label}
                </ButtonLink>
              );
            })}
          </div>
          <div className="mt-7">
            <LiveTicker
              labels={{
                votes: home.votes,
                reports: home.reports,
                milestones: home.milestones,
              }}
              locale={locale}
            />
          </div>
        </div>

        <div>
          <div className="mb-4 max-w-2xl">
            <h2 className="font-display text-3xl text-[var(--color-charcoal)]">{home.mosaicTitle}</h2>
            <p className="mt-2 text-base leading-7 text-[var(--color-muted)]">{home.mosaicIntro}</p>
          </div>
          <WardMosaic wards={wards} layer="trust" />
        </div>
      </section>

      <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-3">
          {[
            { title: home.parityTitle, body: home.parityBody },
            { title: home.trustTitle, body: home.trustBody },
            { title: home.budgetTitle, body: home.budgetBody },
          ].map((item) => (
            <article className="rounded-md border border-[var(--color-line)] bg-[var(--color-bg)] p-4" key={item.title}>
              <h3 className="text-lg font-black">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_0.7fr]">
        <div className="rounded-md bg-[var(--color-charcoal)] p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--color-maize)]">
            Public evidence
          </p>
          <h2 className="mt-2 font-display text-4xl text-white">
            {formatCurrency(countyTotals.projectBudget, locale)} tracked in demo projects
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-white/78">
            Every public number shown here is built from the same vote, project, and report records used by the oversight view.
          </p>
          <ButtonLink className="mt-5 bg-white text-[var(--color-charcoal)] hover:bg-[var(--color-maize)]" href={`/${locale}/pulse`}>
            County Pulse
            <ArrowRight aria-hidden="true" size={18} />
          </ButtonLink>
        </div>
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <h2 className="font-black">Data notes</h2>
          <div className="mt-4 grid gap-3">
            {dataSources.map((source) => (
              <a className="rounded-md border border-[var(--color-line)] p-3 text-sm font-bold underline-offset-4 hover:underline" href={source.url} key={source.url}>
                {source.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
