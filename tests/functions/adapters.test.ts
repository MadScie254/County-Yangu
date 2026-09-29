// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { sendSms, smsProvider } from '../../supabase/functions/_shared/sms.ts';
import { sendEmail } from '../../supabase/functions/_shared/email.ts';
import { complete, costKes, extractJson, llmProvider } from '../../supabase/functions/_shared/llm.ts';
import { callbackAuthorized, parseC2B, parseStkCallback, stkPassword, timestamp, darajaBase } from '../../supabase/functions/_shared/mpesa.ts';
import { verifyStandardWebhook } from '../../supabase/functions/_shared/webhook.ts';

const KEYS = ['SMS_PROVIDER', 'AT_USERNAME', 'AT_API_KEY', 'AT_SENDER_ID', 'MOCK_LOG_BODY', 'RESEND_API_KEY', 'EMAIL_FROM', 'AI_PROVIDER', 'ANTHROPIC_API_KEY', 'CLOUDFLARE_AI_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'MPESA_CALLBACK_TOKEN', 'MPESA_ALLOWED_IPS', 'MPESA_ENV', 'AI_KES_PER_MTOK_IN', 'AI_KES_PER_MTOK_OUT'];
const saved: Record<string, string | undefined> = {};
beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } });
afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } vi.restoreAllMocks(); });

const fakeFetch = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('SMS', () => {
  it('uses the mock unless Africa’s Talking is configured, and never logs a code by default', async () => {
    expect(smsProvider()).toBe('mock');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await sendSms('+254712345678', 'Your code is 481516')).toEqual({ ok: true, id: 'mock' });
    expect(log.mock.calls.flat().join(' ')).not.toContain('481516');
    expect(log.mock.calls.flat().join(' ')).not.toContain('12345');
    process.env.MOCK_LOG_BODY = 'true';
    await sendSms('+254712345678', 'Your code is 481516');
    expect(log.mock.calls.flat().join(' ')).toContain('481516');
  });

  it('sends through Africa’s Talking with the key in a header and reads the delivery status', async () => {
    process.env.AT_USERNAME = 'countyapp';
    process.env.AT_API_KEY = 'secret-key';
    process.env.AT_SENDER_ID = 'NAIROBI';
    const f = fakeFetch(201, { SMSMessageData: { Recipients: [{ statusCode: 101, status: 'Success', messageId: 'ATXid_1' }] } });
    expect(smsProvider()).toBe('africastalking');
    expect(await sendSms('+254712345678', 'hello', f as unknown as typeof fetch)).toEqual({ ok: true, id: 'ATXid_1' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.africastalking.com/version1/messaging');
    expect((init.headers as Record<string, string>).apiKey).toBe('secret-key');
    expect(String(init.body)).not.toContain('secret-key');
    expect(new URLSearchParams(String(init.body)).get('from')).toBe('NAIROBI');
  });

  it('uses the sandbox host for the sandbox account and reports rejections and outages', async () => {
    process.env.AT_USERNAME = 'sandbox';
    process.env.AT_API_KEY = 'k';
    const sandbox = fakeFetch(201, { SMSMessageData: { Recipients: [{ statusCode: 100 }] } });
    await sendSms('+254712345678', 'x', sandbox as unknown as typeof fetch);
    expect((sandbox.mock.calls[0] as unknown as [string])[0]).toContain('api.sandbox.africastalking.com');
    expect(await sendSms('+254712345678', 'x', fakeFetch(201, { SMSMessageData: { Recipients: [{ statusCode: 403, status: 'InvalidPhoneNumber' }] } }) as unknown as typeof fetch)).toEqual({ ok: false, error: 'InvalidPhoneNumber' });
    expect(await sendSms('+254712345678', 'x', fakeFetch(500, {}) as unknown as typeof fetch)).toEqual({ ok: false, error: 'http-500' });
    const down = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    expect((await sendSms('+254712345678', 'x', down as unknown as typeof fetch)).ok).toBe(false);
  });
});

describe('email', () => {
  it('does nothing but log when no provider is configured, and posts to Resend when it is', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect((await sendEmail('a@b.co', 'Subject', 'Body')).id).toBe('mock');
    process.env.RESEND_API_KEY = 're_key';
    process.env.EMAIL_FROM = 'CountyConnect <noreply@county.example>';
    const f = fakeFetch(200, { id: 'em_1' });
    expect(await sendEmail('a@b.co', 'Subject', 'Body', f as unknown as typeof fetch)).toEqual({ ok: true, id: 'em_1' });
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(JSON.parse(String(init.body))).toMatchObject({ to: ['a@b.co'], subject: 'Subject' });
    expect(await sendEmail('a@b.co', 's', 'b', fakeFetch(422, {}) as unknown as typeof fetch)).toEqual({ ok: false, error: 'http-422' });
  });
});

describe('language model adapter', () => {
  it('picks a provider from what is configured', () => {
    expect(llmProvider()).toBe('mock');
    process.env.CLOUDFLARE_AI_TOKEN = 't';
    expect(llmProvider()).toBe('mock'); // token without an account id is not enough
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    expect(llmProvider()).toBe('cloudflare');
    process.env.ANTHROPIC_API_KEY = 'k';
    expect(llmProvider()).toBe('anthropic');
    process.env.AI_PROVIDER = 'cloudflare';
    expect(llmProvider()).toBe('cloudflare');
  });

  it('calls Workers AI and reads text and usage', async () => {
    process.env.AI_PROVIDER = 'cloudflare';
    process.env.CLOUDFLARE_AI_TOKEN = 'cf-token';
    process.env.CLOUDFLARE_ACCOUNT_ID = 'acct';
    const f = fakeFetch(200, { success: true, result: { response: 'Hello', usage: { prompt_tokens: 12, completion_tokens: 3 } } });
    const r = await complete({ system: 's', user: 'u' }, f as unknown as typeof fetch);
    expect(r).toMatchObject({ text: 'Hello', tokensIn: 12, tokensOut: 3 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/accounts/acct/ai/run/');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer cf-token');
    await expect(complete({ system: 's', user: 'u' }, fakeFetch(500, {}) as unknown as typeof fetch)).rejects.toThrow('cloudflare-500');
    await expect(complete({ system: 's', user: 'u' }, fakeFetch(200, { success: false }) as unknown as typeof fetch)).rejects.toThrow('bad-response');
  });

  it('calls Claude and joins the text blocks', async () => {
    process.env.AI_PROVIDER = 'anthropic';
    process.env.ANTHROPIC_API_KEY = 'ak';
    const f = fakeFetch(200, { content: [{ type: 'text', text: 'Part one. ' }, { type: 'text', text: 'Part two.' }], usage: { input_tokens: 100, output_tokens: 20 } });
    const r = await complete({ system: 's', user: 'u', maxTokens: 5000 }, f as unknown as typeof fetch);
    expect(r).toMatchObject({ text: 'Part one. Part two.', tokensIn: 100, tokensOut: 20 });
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('ak');
    expect(JSON.parse(String(init.body)).max_tokens).toBe(1000); // capped
  });

  it('prices a call from token counts and pulls JSON out of a chatty reply', () => {
    expect(costKes('mock', 1000, 1000)).toBe(0);
    expect(costKes('anthropic', 1_000_000, 0)).toBe(130);
    process.env.AI_KES_PER_MTOK_IN = '200';
    expect(costKes('anthropic', 1_000_000, 0)).toBe(200);
    expect(extractJson('Sure! ```json\n{"tool":"cases_by_ward","args":{"limit":5}}\n``` hope that helps')).toEqual({ tool: 'cases_by_ward', args: { limit: 5 } });
    expect(extractJson('no json here')).toBeNull();
    expect(extractJson('{broken')).toBeNull();
  });
});

describe('M-Pesa', () => {
  it('formats the STK password and timestamp the way Daraja expects', () => {
    expect(timestamp(new Date('2026-09-29T10:11:12Z'))).toBe('20260929101112');
    expect(stkPassword('174379', 'pass', '20260929101112')).toBe(Buffer.from('174379pass20260929101112').toString('base64'));
    expect(darajaBase()).toContain('sandbox');
    process.env.MPESA_ENV = 'production';
    expect(darajaBase()).toBe('https://api.safaricom.co.ke');
  });

  it('parses a successful STK callback and keeps only the last four digits of the phone', () => {
    const cb = { Body: { stkCallback: { MerchantRequestID: 'm', CheckoutRequestID: 'ws_CO_1', ResultCode: 0, ResultDesc: 'ok', CallbackMetadata: { Item: [{ Name: 'Amount', Value: 5000 }, { Name: 'MpesaReceiptNumber', Value: 'SIM1ABC' }, { Name: 'PhoneNumber', Value: 254712345678 }] } } } };
    expect(parseStkCallback(cb)).toEqual({ checkoutRequestId: 'ws_CO_1', resultCode: 0, receipt: 'SIM1ABC', amount: 5000, last4: '5678' });
  });

  it('parses a cancelled prompt and refuses anything else', () => {
    expect(parseStkCallback({ Body: { stkCallback: { CheckoutRequestID: 'ws_CO_2', ResultCode: 1032, ResultDesc: 'cancelled' } } })).toEqual({ checkoutRequestId: 'ws_CO_2', resultCode: 1032, receipt: null, amount: null, last4: null });
    expect(parseStkCallback(null)).toBeNull();
    expect(parseStkCallback({ Body: {} })).toBeNull();
    expect(parseStkCallback({ Body: { stkCallback: { CheckoutRequestID: 5, ResultCode: 0 } } })).toBeNull();
  });

  it('parses a paybill confirmation', () => {
    const c = parseC2B({ TransID: 'RKTQDM7W6S', TransAmount: '2500.00', BillRefNumber: 'NAI-A1B2C3D4E5', FirstName: 'JOHN', LastName: 'DOE', TransTime: '20260929101112' });
    expect(c).toMatchObject({ transId: 'RKTQDM7W6S', amount: 2500, billRef: 'NAI-A1B2C3D4E5', payerName: 'JOHN DOE' });
    expect(c!.time.toISOString()).toBe('2026-09-29T07:11:12.000Z'); // East Africa Time
    expect(parseC2B({ TransID: 'X', TransAmount: '-5' })).toBeNull();
    expect(parseC2B({})).toBeNull();
  });

  it('authorises callbacks by secret token, fails closed, and optionally by source address', () => {
    const url = (t: string) => new URL(`https://x.test/mpesa-webhook?token=${t}`);
    expect(callbackAuthorized(url('anything'), '1.2.3.4')).toBe(false); // nothing configured
    process.env.MPESA_CALLBACK_TOKEN = 'short';
    expect(callbackAuthorized(url('short'), '1.2.3.4')).toBe(false); // too weak to count
    process.env.MPESA_CALLBACK_TOKEN = 't'.repeat(32);
    expect(callbackAuthorized(url('t'.repeat(32)), '1.2.3.4')).toBe(true);
    expect(callbackAuthorized(url('t'.repeat(31) + 'x'), '1.2.3.4')).toBe(false);
    expect(callbackAuthorized(new URL('https://x.test/mpesa-webhook'), '1.2.3.4')).toBe(false);
    process.env.MPESA_ALLOWED_IPS = '196.201.214.200, 196.201.214.206';
    expect(callbackAuthorized(url('t'.repeat(32)), '1.2.3.4')).toBe(false);
    expect(callbackAuthorized(url('t'.repeat(32)), '196.201.214.206')).toBe(true);
  });
});

describe('Standard Webhooks (Supabase Auth hooks)', () => {
  const key = Buffer.from('a-32-byte-long-secret-for-tests!');
  const secret = `v1,whsec_${key.toString('base64')}`;
  const body = '{"user":{"phone":"254712345678"},"sms":{"otp":"123456"}}';
  const now = 1_780_000_000_000;
  const sign = (id: string, ts: number, b: string) => 'v1,' + createHmac('sha256', key).update(`${id}.${ts}.${b}`).digest('base64');
  const headers = (id: string, ts: number, sig: string) => new Headers({ 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': sig });
  const ts = Math.floor(now / 1000);

  it('accepts a genuine signature, including one of several during key rotation', async () => {
    expect(await verifyStandardWebhook(secret, headers('msg_1', ts, sign('msg_1', ts, body)), body, now)).toBe(true);
    expect(await verifyStandardWebhook(secret, headers('msg_1', ts, `v1,AAAA ${sign('msg_1', ts, body)}`), body, now)).toBe(true);
  });

  it('rejects a changed body, a stale timestamp, a wrong secret and missing headers', async () => {
    const good = sign('msg_1', ts, body);
    expect(await verifyStandardWebhook(secret, headers('msg_1', ts, good), body.replace('123456', '654321'), now)).toBe(false);
    expect(await verifyStandardWebhook(secret, headers('msg_1', ts - 3600, sign('msg_1', ts - 3600, body)), body, now)).toBe(false);
    expect(await verifyStandardWebhook(`v1,whsec_${Buffer.from('another-secret-another-secret-00').toString('base64')}`, headers('msg_1', ts, good), body, now)).toBe(false);
    expect(await verifyStandardWebhook(secret, new Headers(), body, now)).toBe(false);
    expect(await verifyStandardWebhook('not base64 at all!!', headers('msg_1', ts, good), body, now)).toBe(false);
  });
});
