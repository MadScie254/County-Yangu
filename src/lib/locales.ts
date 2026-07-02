export const locales = ["en", "sw"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export const localeLabels: Record<Locale, string> = {
  en: "English",
  sw: "Kiswahili",
};

export function localizePath(pathname: string, locale: Locale) {
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segments = cleanPath.split("/").filter(Boolean);

  if (segments.length > 0 && isLocale(segments[0])) {
    segments[0] = locale;
    return `/${segments.join("/")}`;
  }

  return `/${locale}${cleanPath === "/" ? "" : cleanPath}`;
}
