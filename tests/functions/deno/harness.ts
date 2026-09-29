// Runs the real function handlers in-process: it captures whatever each index.ts passes to Deno.serve.
// deno-lint-ignore-file no-explicit-any
import { state } from './state.ts';

const env = {
  SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key', SUPABASE_ANON_KEY: 'anon-key',
  COUNTY_HMAC_SECRET: 'test-secret-test-secret-test-secret-123456', COUNTY_NAME: 'Nairobi', CRON_SECRET: 'cron-secret-cron-secret-1234',
  MPESA_ENV: 'sandbox', MPESA_CONSUMER_KEY: 'ck', MPESA_CONSUMER_SECRET: 'cs', MPESA_SHORTCODE: '174379', MPESA_PASSKEY: 'pk',
  MPESA_CALLBACK_TOKEN: 'payhook-token-1234567890abcd', USSD_CALLBACK_TOKEN: 'ussd-callback-token-1234567890', SMS_CALLBACK_TOKEN: 'sms-callback-token-1234567890',
  SEND_SMS_HOOK_SECRET: 'v1,whsec_' + btoa('a-32-byte-long-secret-for-tests!'), MOCK_LOG_BODY: 'true', CONSOLE_URL: 'https://console.example',
};
for (const [k, v] of Object.entries(env)) Deno.env.set(k, v);

state.tables = {
  report_categories: [{ id: 'pothole', name: 'Pothole', name_sw: 'Shimo barabarani' }, { id: 'drainage', name: 'Drainage', name_sw: 'Mifereji' }],
  wards: [
    { id: 'kileleshwa', name: 'Kileleshwa', sub_county_id: 'dagoretti', centroid_lat: -1.2864, centroid_lng: 36.7822, bbox: null, geojson: null },
    { id: 'karura', name: 'Karura', sub_county_id: 'kasarani', centroid_lat: -1.2409, centroid_lng: 36.8351, bbox: null, geojson: null },
  ],
  sub_counties: [{ id: 'dagoretti', name: 'Dagoretti' }, { id: 'kasarani', name: 'Kasarani' }],
  county: [{ bbox: [36.6, -1.5, 37.1, -1.1], name: 'Nairobi' }],
  budget_cycles: [{ id: 'fy1', title: 'FY 2026/27' }],
  project_options: [{ id: 'o1', title: 'Borehole', amount: 1500000 }],
};

const handlers = new Map<string, (req: Request) => Promise<Response>>();
let captured: ((req: Request) => Promise<Response>) | null = null;
(Deno as any).serve = (h: (req: Request) => Promise<Response>) => { captured = h; return { finished: Promise.resolve(), shutdown() {} }; };

async function load(name: string) {
  if (!handlers.has(name)) {
    captured = null;
    await import(`../../../supabase/functions/${name}/index.ts`);
    if (!captured) throw new Error(`${name} did not call Deno.serve`);
    handlers.set(name, captured);
  }
  return handlers.get(name)!;
}

export async function call(name: string, init: { method?: string; json?: unknown; form?: FormData; headers?: Record<string, string>; query?: string; body?: string } = {}) {
  const h = await load(name);
  const headers = new Headers(init.headers);
  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) { body = JSON.stringify(init.json); headers.set('content-type', 'application/json'); }
  if (init.form) body = init.form;
  const req = new Request(`http://localhost/${name}${init.query ?? ''}`, { method: init.method ?? 'POST', headers, body });
  return h(req);
}

/** Collect console.log lines while `fn` runs (the mock SMS logs the message text in tests). */
export async function withLogs<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string[] }> {
  const logs: string[] = [];
  const orig = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.join(' ')); };
  try { return { result: await fn(), logs }; } finally { console.log = orig; }
}

/** Replace global fetch for the duration of `fn`; records every call in state.fetches. */
export async function withFetch<T>(respond: (url: string, init: RequestInit) => Response | Promise<Response>, fn: () => Promise<T>): Promise<T> {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    state.fetches.push({ url, init });
    return respond(url, init);
  }) as typeof fetch;
  try { return await fn(); } finally { globalThis.fetch = orig; }
}

export const okRateLimit = () => { state.rpc.svc_rate_limit = () => true; };
