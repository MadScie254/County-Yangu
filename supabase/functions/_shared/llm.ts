// Language-model adapter. The AI gateway is the only caller. Providers:
//   cloudflare  Workers AI over REST (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_TOKEN): cheap, used by default when configured
//   anthropic   Claude over REST (ANTHROPIC_API_KEY): used for staff-side drafting when configured
//   mock        no network; returns a fixed, obviously-labelled answer so the whole flow can be exercised offline
// The provider is chosen by AI_PROVIDER, else the first one that has credentials.
import { env } from './env.ts';
import type { Fetch } from './sms.ts';

export type LlmRequest = { system: string; user: string; maxTokens?: number; json?: boolean };
export type LlmResponse = { text: string; tokensIn: number; tokensOut: number; model: string };

export function llmProvider(): 'anthropic' | 'cloudflare' | 'mock' {
  const chosen = env('AI_PROVIDER');
  if (chosen === 'anthropic' || chosen === 'cloudflare' || chosen === 'mock') return chosen;
  if (env('ANTHROPIC_API_KEY')) return 'anthropic';
  if (env('CLOUDFLARE_AI_TOKEN') && env('CLOUDFLARE_ACCOUNT_ID')) return 'cloudflare';
  return 'mock';
}

/**
 * Approximate price in Kenya shillings per million tokens (input, output). These drive the departmental spend cap, not
 * billing: override with AI_KES_PER_MTOK_IN / AI_KES_PER_MTOK_OUT if the provider's price changes.
 */
export function pricePerMillion(provider: ReturnType<typeof llmProvider>): { in: number; out: number } {
  const o = { in: Number(env('AI_KES_PER_MTOK_IN')), out: Number(env('AI_KES_PER_MTOK_OUT')) };
  const d = provider === 'anthropic' ? { in: 130, out: 650 } : provider === 'cloudflare' ? { in: 40, out: 110 } : { in: 0, out: 0 };
  return { in: Number.isFinite(o.in) && o.in > 0 ? o.in : d.in, out: Number.isFinite(o.out) && o.out > 0 ? o.out : d.out };
}

export const costKes = (provider: ReturnType<typeof llmProvider>, tokensIn: number, tokensOut: number): number => {
  const p = pricePerMillion(provider);
  return Math.round(((tokensIn * p.in + tokensOut * p.out) / 1_000_000) * 10_000) / 10_000;
};

export async function complete(req: LlmRequest, fetchImpl: Fetch = fetch): Promise<LlmResponse> {
  const provider = llmProvider();
  const max = Math.min(req.maxTokens ?? 500, 1000);
  if (provider === 'mock') {
    return { text: req.json ? '{"tool":"none"}' : 'Thank you for your report. It has been passed to the responsible team and we will update you here as work progresses.', tokensIn: 0, tokensOut: 0, model: 'mock' };
  }

  if (provider === 'anthropic') {
    const model = env('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: max, system: req.system, messages: [{ role: 'user', content: req.user }] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`anthropic-${res.status}`);
    const d = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
    const text = (d.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
    return { text, tokensIn: d.usage?.input_tokens ?? 0, tokensOut: d.usage?.output_tokens ?? 0, model };
  }

  const model = env('CLOUDFLARE_AI_MODEL') ?? '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${env('CLOUDFLARE_ACCOUNT_ID')}/ai/run/${model}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env('CLOUDFLARE_AI_TOKEN')}`, 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'system', content: req.system }, { role: 'user', content: req.user }], max_tokens: max }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`cloudflare-${res.status}`);
  const d = (await res.json()) as { success?: boolean; result?: { response?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } } };
  if (d.success === false || typeof d.result?.response !== 'string') throw new Error('cloudflare-bad-response');
  return { text: d.result.response, tokensIn: d.result.usage?.prompt_tokens ?? 0, tokensOut: d.result.usage?.completion_tokens ?? 0, model };
}

/** Pull the first JSON object out of a model reply, which may wrap it in prose or a code fence. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
