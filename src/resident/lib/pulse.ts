import type { WardStat, PublicProject } from '@/shared/api/types';

export function countyTrust(stats: WardStat[]) {
  const scored = stats.filter((s) => s.trust_index != null);
  if (!scored.length) return { value: null as number | null, scored: 0 };
  return { value: Math.round((scored.reduce((a, s) => a + (s.trust_index as number), 0) / scored.length) * 10) / 10, scored: scored.length };
}

/** Lowest (needs attention) or highest (leading) `n` wards by trust index. */
export function trustLeague(stats: WardStat[], mode: 'low' | 'high', n = 10) {
  const scored = stats.filter((s) => s.trust_index != null);
  return scored.sort((a, b) => (mode === 'low' ? (a.trust_index as number) - (b.trust_index as number) : (b.trust_index as number) - (a.trust_index as number))).slice(0, n);
}

export function sectorMoney(projects: PublicProject[]) {
  const by = new Map<string, { sector: string; spent: number; remaining: number; over: number }>();
  for (const p of projects) {
    const row = by.get(p.sector) ?? { sector: p.sector, spent: 0, remaining: 0, over: 0 };
    row.spent += Math.min(p.spent, p.budget);
    row.over += Math.max(0, p.spent - p.budget);
    row.remaining += Math.max(0, p.budget - p.spent);
    by.set(p.sector, row);
  }
  return [...by.values()].sort((a, b) => b.spent + b.over + b.remaining - (a.spent + a.over + a.remaining));
}

export const weekLabel = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(iso));
