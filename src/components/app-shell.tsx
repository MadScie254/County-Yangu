"use client";

import * as Switch from "@radix-ui/react-switch";
import {
  Bell,
  Briefcase,
  ChartNoAxesCombined,
  FileSearch,
  Home,
  Languages,
  Menu,
  MessageSquareWarning,
  PanelTop,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { localeLabels, locales, type Locale, localizePath } from "@/lib/locales";
import { useCountyStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const icons = {
  home: Home,
  vote: Vote,
  report: MessageSquareWarning,
  track: FileSearch,
  tenders: Briefcase,
  pulse: ChartNoAxesCombined,
  alerts: Bell,
  how: PanelTop,
};

function Toggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-[var(--color-charcoal)]">
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 rounded-full border border-[var(--color-line)] bg-[var(--color-elgon)] outline-none data-[state=checked]:bg-[var(--color-cane)] focus-visible:ring-3 focus-visible:ring-[var(--color-bead-red)]/30"
      >
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-5" />
      </Switch.Root>
      <span>{label}</span>
    </label>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const simpleMode = useCountyStore((state) => state.simpleMode);
  const highContrast = useCountyStore((state) => state.highContrast);
  const textScale = useCountyStore((state) => state.textScale);
  const votesCastCount = useCountyStore((state) => state.votesCastCount);
  const reportsSubmittedCount = useCountyStore((state) => state.reportsSubmittedCount);
  const toggleSimpleMode = useCountyStore((state) => state.toggleSimpleMode);
  const toggleHighContrast = useCountyStore((state) => state.toggleHighContrast);
  const setTextScale = useCountyStore((state) => state.setTextScale);

  const navItems = [
    { key: "home", href: `/${locale}`, icon: icons.home },
    { key: "vote", href: `/${locale}/vote`, icon: icons.vote },
    { key: "report", href: `/${locale}/report`, icon: icons.report },
    { key: "track", href: `/${locale}/track`, icon: icons.track },
    { key: "tenders", href: `/${locale}/tenders`, icon: icons.tenders },
    { key: "pulse", href: `/${locale}/pulse`, icon: icons.pulse },
    { key: "alerts", href: `/${locale}/alerts`, icon: icons.alerts },
    { key: "how", href: `/${locale}/how-it-works`, icon: icons.how },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-charcoal)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:font-bold"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-white/20 bg-[var(--color-bg)]/60 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link className="flex items-center gap-3" href={`/${locale}`} aria-label="County Yangu home">
            <span className="grid size-11 place-items-center rounded-md bg-[var(--color-charcoal)] font-display text-xl text-[var(--color-maize)]">
              CY
            </span>
            <span className="hidden sm:block">
              <span className="block font-display text-xl leading-none">County Yangu</span>
              <span className="block text-xs font-bold text-[var(--color-muted)]">
                {tCommon("tagline")}
              </span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Primary">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-bold text-[var(--color-muted)] transition-all duration-300 hover:bg-black/5 hover:text-[var(--color-charcoal)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-[var(--color-bead-red)]",
                    active && "bg-[var(--color-maize-soft)] text-[var(--color-charcoal)] shadow-sm",
                    simpleMode && "px-4 text-base",
                  )}
                  href={item.href}
                  key={item.key}
                  onClick={() => setOpen(false)}
                >
                  <Icon aria-hidden="true" size={18} />
                  {tNav(item.key)}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 xl:flex">
            {locales.map((targetLocale) => (
              <Link
                className={cn(
                  "inline-flex min-h-10 items-center gap-1 rounded-md px-3 text-xs font-black",
                  targetLocale === locale
                    ? "bg-[var(--color-charcoal)] text-white"
                    : "border border-[var(--color-line)] bg-[var(--color-surface)]",
                )}
                href={localizePath(pathname, targetLocale)}
                key={targetLocale}
              >
                <Languages aria-hidden="true" size={14} />
                {localeLabels[targetLocale]}
              </Link>
            ))}
            {votesCastCount > 0 && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-maize)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--color-charcoal)]" title="You have voted!">🏅 Voter</span>}
            {reportsSubmittedCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-cane)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white" title="You have submitted a report!">🛡️ Watcher</span>}
          </div>

          <button
            className="ml-auto grid size-11 place-items-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Open menu"
          >
            <Menu aria-hidden="true" />
          </button>
        </div>

        <div className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-2 sm:px-6">
            <Toggle label={tCommon("simpleMode")} checked={simpleMode} onCheckedChange={toggleSimpleMode} />
            <Toggle label={tCommon("highContrast")} checked={highContrast} onCheckedChange={toggleHighContrast} />
            <label className="flex min-h-11 items-center gap-2 text-xs font-bold">
              {tCommon("textSize")}
              <input
                aria-label={tCommon("textSize")}
                className="accent-[var(--color-bead-red)]"
                max="1.25"
                min="0.95"
                onChange={(event) => setTextScale(Number(event.target.value))}
                step="0.05"
                type="range"
                value={textScale}
              />
            </label>
            <ButtonLink className="ml-auto hidden sm:inline-flex" href={`/${locale}/assembly`} variant="quiet">
              {tNav("assembly")}
            </ButtonLink>
          </div>
        </div>

        {open ? (
          <nav id="mobile-menu" className="grid gap-1 border-t border-[var(--color-line)] bg-[var(--color-bg)] p-3 lg:hidden" aria-label="Mobile" key={pathname}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  className="flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-black hover:bg-[var(--color-maize-soft)]"
                  href={item.href}
                  key={item.key}
                  onClick={() => setOpen(false)}
                >
                  <Icon aria-hidden="true" />
                  {tNav(item.key)}
                </Link>
              );
            })}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {locales.map((targetLocale) => (
                <Link
                  className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 text-center text-sm font-black"
                  href={localizePath(pathname, targetLocale)}
                  key={targetLocale}
                  onClick={() => setOpen(false)}
                >
                  {localeLabels[targetLocale]}
                </Link>
              ))}
            </div>
            {(votesCastCount > 0 || reportsSubmittedCount > 0) && (
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-line)] pt-3">
                {votesCastCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-maize)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[var(--color-charcoal)]">🏅 Voter</span>}
                {reportsSubmittedCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-cane)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">🛡️ Watcher</span>}
              </div>
            )}
          </nav>
        ) : null}
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
