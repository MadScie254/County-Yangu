/** Kenyan mobile numbers only (Safaricom, Airtel, Telkom: 07xx and 01xx). Returns +254XXXXXXXXX or null. */
export function toE164Kenya(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  const m = /^(?:\+?254|0)?([71]\d{8})$/.exec(digits);
  return m ? `+254${m[1]}` : null;
}

/** +254712345678 -> +2547•• ••• 678, for logs. */
export const maskPhone = (e164: string): string => (e164.length > 6 ? `${e164.slice(0, 5)}•• ••• ${e164.slice(-3)}` : '•••');

export const last4 = (e164: string): string => e164.slice(-4);

/** Daraja wants 2547XXXXXXXX with no plus sign. */
export const toMsisdn = (e164: string): string => e164.replace(/^\+/, '');
