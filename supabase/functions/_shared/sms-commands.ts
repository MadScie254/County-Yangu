// What a text message sent to the county's number is asking for.

export function replyFor(text: string): { kind: 'stop' } | { kind: 'status'; reference: string } | { kind: 'help' } {
  const t = text.trim().toUpperCase();
  if (/^(STOP|ACHA|UNSUBSCRIBE|CANCEL)\b/.test(t)) return { kind: 'stop' };
  const m = /^(?:STATUS|HALI)\s+([A-Z0-9-]{6,24})\b/.exec(t);
  if (m) return { kind: 'status', reference: m[1]! };
  return { kind: 'help' };
}
