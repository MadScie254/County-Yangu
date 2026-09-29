// Personal-detail scrubbing. Used in two places:
//   1. on a resident's report / idea before it is stored, so a phone number typed into the description does not
//      undo the anonymity of an anonymous report;
//   2. on anything sent to an AI provider.
//
// It catches what can be caught reliably by pattern: phone numbers, emails, KRA PINs and ID numbers that are labelled
// as such. It does NOT try to find names, and it says so: a name written in free text will pass through.
// That is why reports are never shown publicly except by status, and why the AI gateway also limits what it sends.

type Sub = (match: string, group1: string) => string;

const RULES: { re: RegExp; sub: Sub }[] = [
  // +254 712 345 678, 0712-345-678, 0112345678, 254712345678
  { re: /(?<![\d])(?:\+?254[\s.-]?|0)[17](?:[\s.-]?\d){8}(?!\d)/g, sub: () => '[phone]' },
  { re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, sub: () => '[email]' },
  // KRA PIN: letter, nine digits, letter
  { re: /\b[AP]\d{9}[A-Z]\b/gi, sub: () => '[pin]' },
  // "ID 12345678", "national ID no: 12345678", "I.D number 1234567": keep the label, drop the number
  { re: /\b((?:national\s+)?(?:id|i\.d\.?|identity)(?:\s*(?:no\.?|number|card))?\s*[:#-]?\s*)\d{7,9}\b/gi, sub: (_m, label) => `${label}[id number]` },
];

export type Scrubbed = { text: string; redactions: number };

export function scrub(input: string): Scrubbed {
  let text = input;
  let redactions = 0;
  for (const { re, sub } of RULES) {
    text = text.replace(re, (m: string, g1: string) => {
      redactions++;
      return sub(m, g1);
    });
  }
  return { text, redactions };
}
