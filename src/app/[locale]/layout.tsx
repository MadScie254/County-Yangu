import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { OfflineQueueBanner } from "@/components/offline-queue-banner";
import { isLocale, locales, type Locale } from "@/lib/locales";
import { getMessages } from "@/lib/messages";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <NextIntlClientProvider locale={locale} messages={getMessages(locale as Locale)}>
      <AppShell>{children}</AppShell>
      <OfflineQueueBanner />
    </NextIntlClientProvider>
  );
}
