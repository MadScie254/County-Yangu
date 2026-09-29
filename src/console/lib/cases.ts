import type { Tone } from '@/shared/ui/Chip';
import { openStatuses, type CaseRow, type CaseStatus } from '../api/types';

export const statusLabel: Record<CaseStatus, string> = { received: 'Received', triaged: 'Sorted', assigned: 'Assigned', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed', rejected: 'Rejected' };
export const statusTone: Record<CaseStatus, Tone> = { received: 'info', triaged: 'info', assigned: 'info', in_progress: 'warn', resolved: 'good', closed: 'neutral', rejected: 'bad' };
export const priorityTone: Record<string, Tone> = { low: 'neutral', normal: 'neutral', high: 'warn', urgent: 'bad' };
export const levelLabel = ['On track', 'Reminder sent', 'Sub-county admin told', 'Chief officer told', 'CEC and Assembly told', 'On oversight digest'];

export const isOpen = (c: Pick<CaseRow, 'status'>) => openStatuses.includes(c.status);

export type Sla = { state: 'done' | 'overdue' | 'at_risk' | 'ok' | 'none'; label: string; tone: Tone; ms: number };

/** Time to the resolve target: negative once overdue. "At risk" = under 24 hours left. */
export function sla(c: Pick<CaseRow, 'status' | 'resolve_due_at'>, now = Date.now()): Sla {
  if (!isOpen(c)) return { state: 'done', label: 'Closed', tone: 'neutral', ms: 0 };
  if (!c.resolve_due_at) return { state: 'none', label: 'No target', tone: 'neutral', ms: 0 };
  const ms = new Date(c.resolve_due_at).getTime() - now;
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor((abs % 86_400_000) / 3_600_000);
  const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h` : `${Math.max(1, Math.floor(abs / 60_000))}m`;
  if (ms < 0) return { state: 'overdue', label: `${text} overdue`, tone: 'bad', ms };
  if (ms < 86_400_000) return { state: 'at_risk', label: `${text} left`, tone: 'warn', ms };
  return { state: 'ok', label: `${text} left`, tone: 'good', ms };
}

export function ackState(c: Pick<CaseRow, 'ack_due_at' | 'acknowledged_at' | 'status'>) {
  if (c.acknowledged_at || !isOpen(c)) return null;
  if (!c.ack_due_at) return null;
  return new Date(c.ack_due_at).getTime() < Date.now() ? 'Acknowledgement overdue' : 'Awaiting acknowledgement';
}
