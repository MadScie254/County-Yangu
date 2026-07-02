import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
    title: messages.how.title,
    description: messages.how.intro,
  };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const how = messages.how;
  const paths = [
    { title: how.web, body: how.webBody, steps: ["Open link", "Choose ward", "Vote, report, track, or subscribe"] },
    { title: how.ussd, body: how.ussdBody, steps: ["Dial county code", "Use keypad menu", "Receive SMS reference"] },
    { title: how.ivr, body: how.ivrBody, steps: ["Call the line", "Listen in chosen language", "Use keypad or voice"] },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionHeader title={how.title}>{how.intro}</SectionHeader>
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {paths.map((path) => (
          <article className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5" key={path.title}>
            <h2 className="font-display text-4xl">{path.title}</h2>
            <p className="mt-3 leading-7 text-[var(--color-muted)]">{path.body}</p>
            <ol className="mt-5 grid gap-3">
              {path.steps.map((step, index) => (
                <li className="flex items-center gap-3 rounded-md bg-[var(--color-bg)] p-3 font-bold" key={step}>
                  <span className="grid size-8 shrink-0 place-items-center rounded bg-[var(--color-charcoal)] font-data text-sm text-white">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
      <p className="mt-6 rounded-md bg-[var(--color-maize-soft)] p-4 text-lg font-black">
        {how.proof}
      </p>
    </div>
  );
}
