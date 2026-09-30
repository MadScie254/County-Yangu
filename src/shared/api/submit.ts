// Write-side API for anonymous residents. Every public write goes to an Edge Function (which
// validates, rate-limits, strips metadata, scrubs personal details and writes with the service role).
// The browser never writes to a table directly.
import { backendConfigured, functionsUrl } from './client';
import type { ReportPayload } from '@/shared/lib/schemas';
import { sleep } from '@/shared/lib/utils';
import { county } from '@/shared/config/county';

export class SubmitError extends Error {
  constructor(
    message: string,
    /** true = retrying cannot help (validation failed, rate limited); false = network/server, retry later */
    readonly permanent: boolean,
    readonly code?: string,
  ) {
    super(message);
  }
}

const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const headers = (): Record<string, string> => (key ? { apikey: key } : {});

async function post<T>(fn: string, body: BodyInit, json = true): Promise<T> {
  if (!functionsUrl) throw new SubmitError('no-backend', false);
  let res: Response;
  try {
    res = await fetch(`${functionsUrl}/${fn}`, { method: 'POST', body, headers: { ...headers(), ...(json ? { 'content-type': 'application/json' } : {}) } });
  } catch {
    throw new SubmitError('network', false);
  }
  if (res.ok) return (await res.json()) as T;
  let detail: { error?: string; code?: string } = {};
  try {
    detail = await res.json();
  } catch {
    /* non-JSON error */
  }
  // 4xx (except 408/429 which are retryable) means the request itself is wrong
  const permanent = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
  throw new SubmitError(detail.error ?? `http-${res.status}`, permanent, detail.code);
}

export type ReportResult = { reference: string; ward_id: string; status: string };

export async function sendReport(payload: ReportPayload, photos: Blob[]): Promise<ReportResult> {
  if (!backendConfigured) {
    // Demo mode: pretend the county answered, so the whole flow can be explored offline.
    await sleep(700);
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return { reference: `${county.slug.slice(0, 3).toUpperCase()}-R${rand}`, ward_id: payload.ward_id, status: 'received' };
  }
  const form = new FormData();
  form.set('payload', JSON.stringify(payload));
  photos.slice(0, 3).forEach((p, i) => form.append('photo', p, `photo-${i}.${p.type === 'image/webp' ? 'webp' : 'jpg'}`));
  return post<ReportResult>('report-intake', form, false);
}

export type SimpleResult = { ok: true };

export const requestOtp = (phone: string, purpose: 'vote' | 'alerts' | 'petition') =>
  backendConfigured
    ? post<{ ok: true; expires_in: number }>('otp-request', JSON.stringify({ phone, purpose }))
    : sleep(500).then(() => ({ ok: true as const, expires_in: 300 }));

export const verifyOtp = (phone: string, code: string, purpose: 'vote' | 'alerts' | 'petition') =>
  backendConfigured
    ? post<{ token: string }>('otp-verify', JSON.stringify({ phone, code, purpose }))
    : sleep(400).then(() => {
        if (code !== '123456') throw new SubmitError('invalid-code', true, 'invalid_code');
        return { token: 'demo-token' };
      });

export const castVote = (body: { token: string; cycle_id: string; ward_id: string; option_id: string; client_key: string }) =>
  backendConfigured ? post<SimpleResult>('vote', JSON.stringify(body)) : sleep(500).then(() => ({ ok: true as const }));

export const sendCaseFeedback = (body: { reference: string; fixed: boolean; comment?: string }) =>
  backendConfigured ? post<{ ok: true; reopened: boolean }>('case-feedback', JSON.stringify(body)) : sleep(500).then(() => ({ ok: true as const, reopened: !body.fixed }));

export const subscribeAlerts = (body: { token: string; ward_id: string; frequency: string }) =>
  backendConfigured ? post<SimpleResult>('alerts-subscribe', JSON.stringify(body)) : sleep(500).then(() => ({ ok: true as const }));

export const submitProposal = (body: { token: string; ward_id: string | null; kind: 'proposal' | 'petition'; title: string; body: string }) =>
  backendConfigured ? post<SimpleResult>('proposal-submit', JSON.stringify(body)) : sleep(600).then(() => ({ ok: true as const }));

export const supportProposal = (body: { token: string; proposal_id: string }) =>
  backendConfigured ? post<SimpleResult>('proposal-support', JSON.stringify(body)) : sleep(400).then(() => ({ ok: true as const }));
