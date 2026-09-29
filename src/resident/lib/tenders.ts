import type { PublicTender } from '@/shared/api/types';

/** Contractors who won more than `limit` tenders. A prompt for scrutiny, not a finding. */
export function flaggedContractors(tenders: PublicTender[], limit = 2) {
  const counts = new Map<string, { name: string; won: number; value: number }>();
  for (const t of tenders) {
    if (t.status !== 'awarded' || !t.awarded_to) continue;
    const c = counts.get(t.awarded_to) ?? { name: t.awarded_to, won: 0, value: 0 };
    c.won += 1;
    c.value += t.estimated_budget;
    counts.set(t.awarded_to, c);
  }
  return [...counts.values()].filter((c) => c.won > limit).sort((a, b) => b.won - a.won);
}

export const openTenders = (tenders: PublicTender[]) => tenders.filter((t) => t.status === 'open' || t.status === 'evaluating');
