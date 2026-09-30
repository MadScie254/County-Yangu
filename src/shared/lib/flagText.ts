// Flags are written in English by the database. For Kiswahili, the same flag is rendered from a fixed template plus the
// numbers the database attached to it, so the wording is reviewed once and never machine-translated on the fly.
import type { MessageKey, Vars } from '@/shared/i18n';
import type { ProcurementFlag } from '@/shared/api/types';

const n = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));

export function flagVars(f: ProcurementFlag): Vars {
  const m = f.metrics ?? {};
  const pct = (a: unknown, b: unknown) => (n(b) > 0 ? Math.round((100 * n(a)) / n(b)) : 0);
  return {
    name: f.subject_label,
    share: n(m.share_value ?? m.top3_share ?? m.share ?? m.share_count ?? (m.awarded ? Math.round((1000 * n(m.single_bid)) / n(m.awarded)) / 10 : 0)),
    wins: n(m.wins),
    nonopen: n(m.non_open),
    count: n(m.single_bid ?? m.short_tenders ?? m.awards),
    pct: m.award !== undefined ? pct(m.award, m.estimate) : pct(m.spent, m.budget),
    days: m.expected_at ? Math.max(0, Math.round((Date.now() - new Date(String(m.expected_at)).getTime()) / 86_400_000)) : 0,
  };
}

/** The flag's title and reason in the reader's language. English keeps the database's own wording. */
export function flagText(f: ProcurementFlag, locale: string, t: (key: MessageKey, vars?: Vars) => string): { title: string; why: string } {
  if (locale === 'en') return { title: f.title, why: f.detail };
  const vars = flagVars(f);
  const title = t(`loop.flags.${f.code}.title` as MessageKey, vars);
  // an unknown code comes back as its own key: fall back to the English text
  if (title.startsWith('loop.flags.')) return { title: f.title, why: f.detail };
  return { title, why: t(`loop.flags.${f.code}.why` as MessageKey, vars) };
}
