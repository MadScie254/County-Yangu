import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectExplorer } from "@/components/project-explorer";
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
    title: messages.track.title,
    description: messages.track.intro,
  };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionHeader title={messages.track.title}>{messages.track.intro}</SectionHeader>
      <div className="mt-7">
        <ProjectExplorer />
      </div>
    </div>
  );
}
