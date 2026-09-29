import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import en from './messages/en.json';
import sw from './messages/sw.json';
import { usePrefs } from '@/shared/state/prefs';

export type Locale = 'en' | 'sw';
export const locales: { code: Locale; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'sw', label: 'Kiswahili', short: 'SW' },
];

type Messages = typeof en;

// "a.b.c" for every string leaf; plural variants (x_one / x_other) collapse to "x".
type Leaves<T, P extends string = ''> = T extends string
  ? P
  : T extends readonly unknown[]
    ? never
    : { [K in keyof T & string]: Leaves<T[K], P extends '' ? K : `${P}.${K}`> }[keyof T & string];
type StripPlural<K extends string> = K extends `${infer B}_${'one' | 'other'}` ? B : K;
export type MessageKey = StripPlural<Leaves<Messages>>;

type ListLeaves<T, P extends string = ''> = T extends readonly string[]
  ? P
  : T extends string
    ? never
    : { [K in keyof T & string]: ListLeaves<T[K], P extends '' ? K : `${P}.${K}`> }[keyof T & string];
export type ListKey = ListLeaves<Messages>;

const dictionaries: Record<Locale, unknown> = { en, sw };

function lookup(dict: unknown, key: string): unknown {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>)) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return node;
}

export type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (name in vars ? String(vars[name]) : `{${name}}`));
}

/** Translate outside React (queue errors, edge cases). Falls back to English, then to the key. */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  let k: string = key;
  if (vars && typeof vars.count === 'number') {
    const rule = new Intl.PluralRules(locale).select(vars.count) === 'one' ? 'one' : 'other';
    const candidate = `${key}_${rule}`;
    if (typeof lookup(dictionaries[locale], candidate) === 'string' || typeof lookup(dictionaries.en, candidate) === 'string') k = candidate;
  }
  const hit = lookup(dictionaries[locale], k);
  if (typeof hit === 'string') return interpolate(hit, vars);
  const fallback = lookup(dictionaries.en, k);
  return typeof fallback === 'string' ? interpolate(fallback, vars) : key;
}

export function translateList(locale: Locale, key: ListKey): string[] {
  const hit = lookup(dictionaries[locale], key);
  if (Array.isArray(hit)) return hit as string[];
  const fallback = lookup(dictionaries.en, key);
  return Array.isArray(fallback) ? (fallback as string[]) : [];
}

type I18n = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  list: (key: ListKey) => string[];
  number: (n: number, opts?: Intl.NumberFormatOptions) => string;
  compact: (n: number) => string;
  kes: (n: number, opts?: { compact?: boolean }) => string;
  date: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;
  relative: (d: Date | string | number) => string;
};

const Ctx = createContext<I18n | null>(null);
const intlLocale = (l: Locale) => (l === 'sw' ? 'sw-KE' : 'en-KE');

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = usePrefs((s) => s.locale);
  const setLocale = usePrefs((s) => s.setLocale);

  const value = useMemo<I18n>(() => {
    const loc = intlLocale(locale);
    return {
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      list: (key) => translateList(locale, key),
      number: (n, opts) => new Intl.NumberFormat(loc, opts).format(n),
      compact: (n) => new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 }).format(n),
      kes: (n, opts) =>
        new Intl.NumberFormat(loc, {
          style: 'currency',
          currency: 'KES',
          currencyDisplay: 'code',
          notation: opts?.compact ? 'compact' : 'standard',
          maximumFractionDigits: opts?.compact ? 1 : 0,
        })
          .format(n)
          .replace(/\s?KES\s?/, 'KES ')
          .trim(),
      date: (d, opts) => new Intl.DateTimeFormat(loc, opts ?? { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d)),
      relative: (d) => {
        const diff = (new Date(d).getTime() - Date.now()) / 1000;
        const rtf = new Intl.RelativeTimeFormat(loc, { numeric: 'auto' });
        const abs = Math.abs(diff);
        if (abs < 60) return rtf.format(Math.round(diff), 'second');
        if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
        if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
        if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
        return rtf.format(Math.round(diff / (86400 * 30)), 'month');
      },
    };
  }, [locale, setLocale]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}

/** For tests and non-React callers that need the same formatting without a provider. */
export const useT = () => useCallback((key: MessageKey, vars?: Vars) => translate(usePrefs.getState().locale, key, vars), []);
