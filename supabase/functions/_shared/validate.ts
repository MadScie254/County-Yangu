// Small input validators. A request that does not fit is refused with 422 and the name of the field, never guessed at.
import { HttpError } from './http.ts';

type Obj = Record<string, unknown>;

const bad = (field: string) => new HttpError(422, 'invalid_request', { field });

export function str(o: Obj, key: string, min: number, max: number): string {
  const v = o[key];
  if (typeof v !== 'string') throw bad(key);
  const t = v.trim();
  if (t.length < min || t.length > max) throw bad(key);
  return t;
}

export function optStr(o: Obj, key: string, max: number): string | null {
  const v = o[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || v.trim().length > max) throw bad(key);
  return v.trim();
}

export function oneOf<T extends string>(o: Obj, key: string, allowed: readonly T[]): T {
  const v = o[key];
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw bad(key);
  return v as T;
}

export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export function uuid(o: Obj, key: string): string {
  const v = o[key];
  if (!isUuid(v)) throw bad(key);
  return v.toLowerCase();
}

export function optNum(o: Obj, key: string, min: number, max: number): number | null {
  const v = o[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw bad(key);
  return v;
}

/** A slug-like id from a database table (ward, cycle, option, category). */
export function slug(o: Obj, key: string): string {
  const v = o[key];
  if (typeof v !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(v)) throw bad(key);
  return v;
}

export function optSlug(o: Obj, key: string): string | null {
  const v = o[key];
  if (v === undefined || v === null || v === '') return null;
  return slug(o, key);
}
