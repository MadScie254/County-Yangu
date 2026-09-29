import { describe, it, expect } from 'vitest';
import en from '../../src/shared/i18n/messages/en.json';
import sw from '../../src/shared/i18n/messages/sw.json';

const flat = (o: unknown, p = ''): string[] =>
  typeof o === 'object' && o !== null ? Object.entries(o).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k)) : [p];
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const get = (o: unknown, path: string) => path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], o);

describe('translations', () => {
  const keys = flat(en);
  it('Kiswahili has every English key and no extras', () => {
    const swKeys = new Set(flat(sw));
    expect(keys.filter((k) => !swKeys.has(k))).toEqual([]);
    expect([...swKeys].filter((k) => !keys.includes(k))).toEqual([]);
  });
  it('placeholders match in both languages', () => {
    const bad = keys.filter((k) => { const a = get(en, k), b = get(sw, k); return typeof a === 'string' && typeof b === 'string' && placeholders(a) !== placeholders(b); });
    expect(bad).toEqual([]);
  });
  it('no empty strings', () => {
    expect(keys.filter((k) => get(en, k) === '' || get(sw, k) === '')).toEqual([]);
  });
});
