// Map colour scales. Sequential for counts (light to dark = more), diverging for the trust index.
// Chosen to stay distinguishable for the common colour-vision deficiencies and to read on the
// desaturated OSM basemap. The same arrays drive the map fill, the bubbles and the legend.
export type Metric = 'open' | 'overdue' | 'trust';

export const scales: Record<Metric, string[]> = {
  open: ['#fbe9b5', '#f7cd6b', '#f2a100', '#d8662a', '#a4321c'],
  overdue: ['#f6e1dc', '#ebb5a6', '#d9806a', '#b23a21', '#74210f'],
  trust: ['#b23a21', '#e08a3c', '#f0d068', '#8fcf9b', '#12704f'],
};

export const NO_DATA = '#b9b3a6';

/** Class breaks for a metric over the data. */
export function breaks(metric: Metric, values: number[]): number[] {
  if (metric === 'trust') return [20, 40, 60, 80]; // fixed 0-100 scale
  const max = Math.max(1, ...values);
  return [0.2, 0.4, 0.6, 0.8].map((f) => Math.max(1, Math.round(max * f)));
}

export function colorFor(metric: Metric, value: number | null | undefined, brk: number[]): string {
  if (value == null) return NO_DATA;
  const s = scales[metric];
  let i = 0;
  while (i < brk.length && value >= (brk[i] as number)) i++;
  return s[Math.min(i, s.length - 1)] as string;
}

/** Legible text colour on a fill. */
export function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.36 ? '#101c2e' : '#ffffff';
}

export const projectColors: Record<string, string> = {
  planned: '#64748b',
  procurement: '#1f5fa6',
  in_progress: '#f2a100',
  stalled: '#b23a21',
  completed: '#12704f',
};
