// KRA PIN and tax-compliance checks (GavaConnect).
//
// What works today: the PIN FORMAT check (a letter, nine digits, a letter), which catches typos before anything is sent.
// What is deliberately not guessed: the live lookup. GavaConnect access needs credentials issued through KRA's developer
// portal (developer.kra.go.ke) and its request/response shapes are only in that portal's documentation. Until a county has
// credentials and the mapping in `lookupPin` is completed against those docs, the answer is "unknown", never a made-up
// "compliant". A contractor is only shown as tax compliant if KRA actually said so.
import { env } from './env.ts';

export const PIN_FORMAT = /^[AP]\d{9}[A-Z]$/;

export type KraStatus = 'compliant' | 'non_compliant' | 'unknown';
export type KraResult = { pin_format_valid: boolean; status: KraStatus; source: 'format-only' | 'gavaconnect' };

export const normalisePin = (pin: string): string => pin.trim().toUpperCase().replace(/\s+/g, '');

/** Live lookup. Not implemented until credentials and the documented response mapping exist. */
export async function lookupPin(_pin: string): Promise<KraStatus> {
  throw new Error('kra_live_lookup_not_implemented');
}

export async function checkPin(input: string): Promise<KraResult> {
  const pin = normalisePin(input);
  const valid = PIN_FORMAT.test(pin);
  if (!valid) return { pin_format_valid: false, status: 'non_compliant', source: 'format-only' };
  if (env('KRA_MODE') !== 'live') return { pin_format_valid: true, status: 'unknown', source: 'format-only' };
  return { pin_format_valid: true, status: await lookupPin(pin), source: 'gavaconnect' };
}
