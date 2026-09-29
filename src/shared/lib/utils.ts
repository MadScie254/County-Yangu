import { clsx, type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Whole days between two dates (b - a), rounded toward zero. */
export function daysBetween(a: Date | string, b: Date | string) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.trunc(ms / 86_400_000);
}

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** A UUID that works on insecure origins and old browsers (the offline queue needs one per action). */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}

/** Normalise a Kenyan mobile number to E.164 (+2547XXXXXXXX). Returns null if it is not one. */
export function toE164Kenya(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  const m = /^(?:\+?254|0)?([71]\d{8})$/.exec(digits);
  return m ? `+254${m[1]}` : null;
}

export function maskPhone(e164: string) {
  return e164.length > 6 ? `${e164.slice(0, 4)} ••• ••${e164.slice(-3)}` : e164;
}
