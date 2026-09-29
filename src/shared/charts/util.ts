import { useEffect, useRef, useState } from 'react';

/** Round a maximum up to a clean tick step: 0 / 50 / 100 rather than 0 / 43 / 86. */
export function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: 1, step: 1, ticks: [0, 1] };
  const rough = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const top = Math.ceil(max / unit) * unit;
  return { max: top, step: unit, ticks: Array.from({ length: Math.round(top / unit) + 1 }, (_, i) => i * unit) };
}

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export const compact = (n: number, locale = 'en-KE') => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
