// Request plumbing shared by every function: CORS, JSON in/out, and one place where errors become responses.
// Nothing internal ever leaves through an error: unexpected failures are logged and the caller sees `server_error`.
import { env } from './env.ts';

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, readonly extra: Record<string, unknown> = {}) {
    super(code);
  }
}

/** Set ALLOWED_ORIGINS (comma separated) in production. Unset means "any origin", which is only right for development. */
export function corsHeaders(req: Request): Record<string, string> {
  const allowed = (env('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get('origin');
  const h: Record<string, string> = {
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'access-control-max-age': '600',
    vary: 'origin',
  };
  if (allowed.length === 0) h['access-control-allow-origin'] = '*';
  else if (origin && allowed.includes(origin)) h['access-control-allow-origin'] = origin;
  return h;
}

const respond = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

/**
 * Wrap a function's logic. `fn` returns either a Response (for redirects, plain text, gifs) or a JSON-able object.
 * Only the listed methods are accepted.
 */
export function handler(name: string, fn: (req: Request) => Promise<Response | Record<string, unknown>>, methods: string[] = ['POST']) {
  return async (req: Request): Promise<Response> => {
    const cors = corsHeaders(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!methods.includes(req.method)) return respond(405, { error: 'method_not_allowed', code: 'method_not_allowed' }, cors);
    try {
      const out = await fn(req);
      if (out instanceof Response) {
        const headers = new Headers(out.headers);
        for (const [k, v] of Object.entries(cors)) headers.set(k, v);
        return new Response(out.body, { status: out.status, headers });
      }
      return respond(200, out, cors);
    } catch (e) {
      if (e instanceof HttpError) return respond(e.status, { error: e.code, code: e.code, ...e.extra }, cors);
      console.error(`[${name}]`, e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      return respond(500, { error: 'server_error', code: 'server_error' }, cors);
    }
  };
}

export async function readJson(req: Request, maxBytes = 32_768): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new HttpError(413, 'too_large');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large');
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'bad_json');
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new HttpError(400, 'bad_json');
  return v as Record<string, unknown>;
}

/** The caller's address, for rate limiting only. It is hashed before it is stored anywhere. */
export function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export const bearer = (req: Request): string | null => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '');
  return m?.[1] ?? null;
};
