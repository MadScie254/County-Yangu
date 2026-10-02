import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, LogIn, MapPin, Send } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wardById, wards } from '@/shared/config/county';
import { useIsDemo, useMyPollVotes, usePollResults, usePolls } from '@/shared/api/hooks';
import { votePoll } from '@/shared/api/civic2';
import type { Poll } from '@/shared/api/types';
import { useAuth } from '@/shared/state/auth';
import { usePrefs } from '@/shared/state/prefs';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { SelectInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';

type Phase = 'open' | 'upcoming' | 'closed';
const phaseOf = (p: Poll, now: number): Phase => (Date.parse(p.opens_at) > now ? 'upcoming' : Date.parse(p.closes_at) <= now ? 'closed' : 'open');
const rank: Record<Phase, number> = { open: 0, upcoming: 1, closed: 2 };
const sortedWards = [...wards].sort((a, b) => a.name.localeCompare(b.name));

/** Short questions from the county, one answer per person, results by ward. After UNICEF's U-Report. */
export default function Polls() {
  const { t } = useI18n();
  const q = usePolls();
  const demo = useIsDemo();
  const signedIn = useAuth((s) => s.status === 'in');
  const mine = useMyPollVotes(signedIn);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [now] = useState(() => Date.now());
  usePageTitle(t('polls.title'));
  const list = useMemo(() => (q.data ?? []).map((p) => ({ p, phase: phaseOf(p, now) })).sort((a, b) =>
    rank[a.phase] - rank[b.phase] || (a.phase === 'closed' ? Date.parse(b.p.closes_at) - Date.parse(a.p.closes_at) : Date.parse(a.p.closes_at) - Date.parse(b.p.closes_at))), [q.data, now]);

  // Arriving from a notification (/polls#slug): scroll to that poll once the list is on screen.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && list.length) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, [list.length]);

  const votes = { ...(mine.data ?? {}), ...local };
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('polls.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('polls.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      {q.isLoading ? <Skeleton className="mt-8 h-64" /> : list.length === 0 ? <p className="mt-8 rounded-2xl bg-bg-2 p-5 text-sm">{t('polls.none')}</p> : (
        <ul className="mt-8 space-y-5">
          {list.map(({ p, phase }) => <PollCard key={p.id} poll={p} phase={phase} chosen={votes[p.id] ?? null} onVoted={(o) => setLocal((s) => ({ ...s, [p.id]: o }))} />)}
        </ul>
      )}
    </div>
  );
}

function PollCard({ poll, phase, chosen, onVoted }: { poll: Poll; phase: Phase; chosen: string | null; onVoted: (optionId: string) => void }) {
  const { t, locale, number, date } = useI18n();
  const loc = useLocation();
  const qc = useQueryClient();
  const demo = useIsDemo();
  const signedIn = useAuth((s) => s.status === 'in');
  const prefWard = usePrefs((s) => s.wardId);
  const results = usePollResults(phase === 'upcoming' ? null : poll.slug);
  const [pick, setPick] = useState<string | null>(null);
  const [ward, setWard] = useState(poll.ward_id ?? (prefWard && wardById.has(prefWard) ? prefWard : ''));
  const sw = locale === 'sw';
  const canVote = phase === 'open' && !chosen && (signedIn || demo);
  const showResults = phase !== 'upcoming' && (Boolean(chosen) || phase === 'closed' || !canVote);
  const vote = useMutation({
    mutationFn: () => votePoll(poll.id, pick!, poll.ward_id ?? (ward || null)),
    onSuccess: () => {
      onVoted(pick!);
      toast({ tone: 'good', title: t('polls.thanks') });
      void qc.invalidateQueries({ queryKey: ['my-poll-votes'] });
      void qc.invalidateQueries({ queryKey: ['poll-results', poll.slug] });
    },
    onError: (e) => toast({ tone: 'bad', title: (e as { code?: string }).code === '23505' ? t('polls.already') : t('polls.error') }),
  });
  const total = results.data?.total ?? 0;
  const byOption = results.data?.by_option ?? {};
  const label = (o: Poll['options'][number]) => (sw && o.label_sw ? o.label_sw : o.label);
  const byWard = useMemo(() => {
    const m = new Map<string, { n: number; top: string; topN: number }>();
    for (const r of results.data?.by_ward ?? []) {
      const cur = m.get(r.ward_id) ?? { n: 0, top: r.option_id, topN: 0 };
      cur.n += r.n;
      if (r.n > cur.topN) { cur.top = r.option_id; cur.topN = r.n; }
      m.set(r.ward_id, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [results.data]);
  const optLabel = new Map(poll.options.map((o) => [o.id, label(o)]));

  return (
    <li id={poll.slug} className="scroll-mt-24 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={phase === 'open' ? 'good' : phase === 'upcoming' ? 'info' : 'neutral'}>{t(`polls.phase.${phase}`)}</Chip>
        <span className="text-xs text-muted">{phase === 'upcoming' ? t('polls.opens', { date: date(poll.opens_at) }) : phase === 'open' ? t('polls.closes', { date: date(poll.closes_at) }) : t('polls.closed', { date: date(poll.closes_at) })}</span>
        {poll.ward_id && <Chip tone="info"><MapPin className="size-3" aria-hidden />{wardById.get(poll.ward_id)?.name ?? poll.ward_id}</Chip>}
      </div>
      <h2 className="mt-3 font-display text-xl font-bold leading-snug">{sw && poll.question_sw ? poll.question_sw : poll.question}</h2>

      <fieldset className="mt-4" disabled={!canVote}>
        <legend className="sr-only">{t('polls.choose')}</legend>
        <div className="grid gap-2">
          {poll.options.map((o) => {
            const n = byOption[o.id] ?? 0;
            const pct = total ? Math.round((100 * n) / total) : 0;
            const selected = canVote ? pick === o.id : chosen === o.id;
            return (
              <label key={o.id} className={cn('relative block overflow-hidden rounded-2xl border px-4 py-3 text-sm transition-colors',
                selected ? 'border-ink bg-bg-2' : 'border-line', canVote && 'cursor-pointer hover:bg-bg-2/60')}>
                {showResults && <span aria-hidden className="absolute inset-y-0 left-0 bg-brand-soft transition-[width] duration-700" style={{ width: `${pct}%` }} />}
                <span className="relative flex items-center gap-3">
                  {canVote && <input type="radio" name={`poll-${poll.id}`} value={o.id} checked={pick === o.id} onChange={() => setPick(o.id)} className="size-4 accent-[var(--brand)]" />}
                  <span className="min-w-0 flex-1 font-semibold">{label(o)}{chosen === o.id && <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-good"><Check className="size-3.5" aria-hidden />{t('polls.yours')}</span>}</span>
                  {showResults && <span className="font-data text-xs">{pct}% <span className="text-muted">({number(n)})</span></span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {canVote && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {!poll.ward_id && (
            <label className="text-sm font-semibold">{t('polls.ward')}
              <SelectInput className="mt-1.5" value={ward} onChange={(e) => setWard(e.target.value)}>
                <option value="">{t('polls.wardSkip')}</option>
                {sortedWards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </SelectInput>
            </label>
          )}
          <Button icon={<Send className="size-4" aria-hidden />} disabled={!pick} loading={vote.isPending} onClick={() => vote.mutate()}>{t('polls.send')}</Button>
        </div>
      )}
      {phase === 'open' && !chosen && !signedIn && !demo && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-bg-2 p-4 text-sm">
          <span className="flex-1">{t('polls.signInWhy')}</span>
          <ButtonLink size="sm" to={`/services/account?next=${encodeURIComponent(`${loc.pathname}#${poll.slug}`)}`} icon={<LogIn className="size-4" aria-hidden />}>{t('polls.signIn')}</ButtonLink>
        </div>
      )}

      {showResults && (
        <div className="mt-4 text-xs text-muted">
          <p>{t('polls.total', { count: total })}</p>
          {byWard.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold text-ink">{t('polls.byWard')}</summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {byWard.map(([w, r]) => (
                  <li key={w} className="flex justify-between gap-3 rounded-lg bg-bg-2/60 px-3 py-1.5 text-sm text-ink">
                    <Link to={`/ward/${w}`} className="truncate hover:underline">{wardById.get(w)?.name ?? w}</Link>
                    <span className="shrink-0 text-xs text-muted">{optLabel.get(r.top) ?? r.top} · {number(r.n)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </li>
  );
}
