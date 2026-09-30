// Keeps the public data a resident has already seen on their phone, so the app opens with last known numbers when there
// is no signal. Only public, aggregate queries are stored (never a session, a report or anything about the person).
import type { QueryClient, QueryKey } from '@tanstack/react-query';

const STORE = 'cy-public-cache-v1';
const MAX_BYTES = 1_500_000;
const KEEP = new Set(['ward-stats', 'county-summary', 'projects', 'tenders', 'procurement-watch', 'pulse', 'proposals', 'budget-results', 'assembly', 'fix-stats', 'scorecard']);

type Saved = Record<string, { key: QueryKey; data: unknown; at: number }>;

const read = (): Saved => {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved; } catch { return {}; }
};

export function persistPublicQueries(client: QueryClient): void {
  if (typeof window === 'undefined') return;
  for (const { key, data, at } of Object.values(read())) {
    if (client.getQueryData(key) === undefined) client.setQueryData(key, data, { updatedAt: at });
  }
  let timer: number | undefined;
  client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    const key = event.query.queryKey;
    if (!KEEP.has(String(key[0]))) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const saved = read();
      saved[JSON.stringify(key)] = { key, data: event.query.state.data, at: Date.now() };
      try {
        const text = JSON.stringify(saved);
        if (text.length <= MAX_BYTES) localStorage.setItem(STORE, text);
      } catch { /* storage full or blocked: the app simply works online only */ }
    }, 800);
  });
}
