import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertForm } from "@/components/forms/alert-form";
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
    title: messages.alerts.title,
    description: messages.alerts.intro,
  };
}

export default async function AlertsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
      <SectionHeader title={messages.alerts.title}>{messages.alerts.intro}</SectionHeader>
      <AlertForm />
    </div>
  );
}
