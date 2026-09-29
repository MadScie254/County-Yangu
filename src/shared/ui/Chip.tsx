import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

export type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'info' | 'vote' | 'brand';

const tones: Record<Tone, string> = {
  neutral: 'bg-bg-2 text-ink-2',
  good: 'bg-good-soft text-good',
  bad: 'bg-bad-soft text-bad',
  warn: 'bg-warn-soft text-warn',
  info: 'bg-info-soft text-info',
  vote: 'bg-vote-soft text-vote',
  brand: 'bg-brand-soft text-ink',
};

export function Chip({ tone = 'neutral', className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none', tones[tone], className)} {...rest}>
      {children}
    </span>
  );
}

export function Dot({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  const c: Record<Tone, string> = { neutral: 'bg-muted', good: 'bg-good', bad: 'bg-bad', warn: 'bg-warn', info: 'bg-info', vote: 'bg-vote', brand: 'bg-brand' };
  return <span aria-hidden className={cn('inline-block size-2 rounded-full', c[tone], className)} />;
}

export const reportTone = (s: string): Tone =>
  ({ received: 'info', triaged: 'info', assigned: 'info', in_progress: 'warn', resolved: 'good', closed: 'neutral', rejected: 'bad' } as Record<string, Tone>)[s] ?? 'neutral';

export const projectTone = (s: string): Tone =>
  ({ planned: 'neutral', procurement: 'info', in_progress: 'warn', stalled: 'bad', completed: 'good' } as Record<string, Tone>)[s] ?? 'neutral';

export const tenderTone = (s: string): Tone =>
  ({ open: 'good', evaluating: 'warn', awarded: 'info', cancelled: 'neutral' } as Record<string, Tone>)[s] ?? 'neutral';
