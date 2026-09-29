// Calendar helpers for the digest jobs. Counties run on East Africa Time (UTC+3, no daylight saving).

const EAT_MS = 3 * 3600_000;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** The calendar month before `now`, as { start, end } ISO dates (inclusive), in East Africa Time. */
export function previousMonth(now: Date): { start: string; end: string } {
  const local = new Date(now.getTime() + EAT_MS);
  const first = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - 1, 1));
  const last = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 0));
  return { start: ymd(first), end: ymd(last) };
}
