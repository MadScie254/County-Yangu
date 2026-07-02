import type { Locale } from "@/lib/locales";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatCurrency(value: number, locale: Locale = "en") {
  return new Intl.NumberFormat(locale === "sw" ? "sw-KE" : "en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, locale: Locale = "en") {
  return new Intl.NumberFormat(locale === "sw" ? "sw-KE" : "en-KE").format(
    value,
  );
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
