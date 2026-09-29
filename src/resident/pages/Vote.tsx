import { useEffect, useMemo, useState } from 'react';
import { Check, CalendarClock, Landmark, Smartphone } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { county, wardById, wardsBySubCounty } from '@/shared/config/county';
import { useVoteData } from '@/shared/api/hooks';
import type { ProjectOption } from '@/shared/api/types';
import { useQueue } from '@/shared/state/queue';
import { usePrefs } from '@/shared/state/prefs';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { Field, SelectInput } from '@/shared/ui/Field';
import { Meter } from '@/shared/ui/Meter';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Card';
import { PhoneVerify } from '../components/PhoneVerify';

export default function Vote() {
  const { t, kes, relative, number } = useI18n();
  usePageTitle(t('vote.title'));
  const wardId = usePrefs((s) => s.wardId);
  const setWardId = usePrefs((s) => s.setWardId);
  const voted = usePrefs((s) => s.votedCycles);
  const markVoted = usePrefs((s) => s.markVoted);
  const enqueueVote = useQueue((s) => s.enqueueVote);

  const data = useVoteData(wardId && wardById.has(wardId) ? wardId : null);
  const [choice, setChoice] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [stage, setStage] = useState<'verify' | 'confirm' | 'done'>('verify');
  const [token, setToken] = useState<string | null>(null);
  const [voteId, setVoteId] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const item = useQueue((s) => s.items.find((i) => i.id === voteId));
  const cycle = data.data?.cycle ?? null;
  const open = cycle?.status === 'open' && new Date(cycle.ends_at) > new Date();
  const alreadyVoted = cycle ? voted.includes(cycle.id) : false;
  const options = data.data?.options ?? [];
  const tally = data.data?.tally ?? {};
  const totalVotes = useMemo(() => Object.values(tally).reduce((a, b) => a + b, 0), [tally]);
  const chosen: ProjectOption | undefined = options.find((o) => o.id === choice);
  const groups = useMemo(() => wardsBySubCounty(), []);

  const start = () => {
    setStage(token ? 'confirm' : 'verify');
    setFailed(null);
    setSheet(true);
  };

  const confirm = async () => {
    if (!chosen || !cycle || !token || !wardId) return;
    setFailed(null);
    const it = await enqueueVote({ token, cycle_id: cycle.id, ward_id: wardId, option_id: chosen.id });
    setVoteId(it.id);
    setStage('done');
  };

  // reflect the queue outcome (an effect, never work during render)
  const outcome = item?.status;
  const itemError = item?.error;
  useEffect(() => {
    if (stage !== 'done') return;
    if (outcome === 'sent' && cycle) markVoted(cycle.id);
    if (outcome === 'failed') setFailed(itemError ?? 'failed');
  }, [stage, outcome, itemError, cycle, markVoted]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 sm:py-12">
      <header>
        <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('vote.title')}</h1>
        <p className="mt-3 text-[1.05rem] text-ink-2">{t('vote.intro')}</p>
      </header>

      <Field className="mt-8" label={t('vote.chooseWard')}>
        {({ id }) => (
          <SelectInput id={id} value={wardId ?? ''} onChange={(e) => { setWardId(e.target.value || null); setChoice(null); }}>
            <option value="">{t('vote.pickWard')}</option>
            {groups.map((g) => (
              <optgroup key={g.subCounty.id} label={g.subCounty.name}>
                {g.wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </optgroup>
            ))}
          </SelectInput>
        )}
      </Field>

      {wardId && data.isLoading && <div className="mt-8 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>}

      {wardId && data.isSuccess && !cycle && (
        <p className="mt-8 rounded-[1.5rem] border border-dashed border-line-strong p-8 text-center text-ink-2">{t('vote.noCycle')}</p>
      )}

      {cycle && (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] bg-ink p-5 text-bg">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-bg/70">{t('vote.cycle')}</p>
              <p className="mt-0.5 font-display text-xl font-bold">{cycle.title}</p>
            </div>
            <div className="text-right text-sm">
              <p className="inline-flex items-center gap-1.5 font-semibold text-brand"><CalendarClock className="size-4" aria-hidden />{open ? t('vote.closesIn', { when: relative(cycle.ends_at) }) : t('vote.closed')}</p>
              {data.data?.envelope != null && <p className="mt-0.5 text-bg/80">{t('vote.envelope')}: <b className="font-data text-bg">{kes(data.data.envelope, { compact: true })}</b></p>}
            </div>
          </div>

          <h2 className="mt-10 font-display text-2xl font-bold">{t('vote.options')}</h2>
          {options.length === 0 ? (
            <p className="mt-4 text-muted">{t('vote.noOptions')}</p>
          ) : (
            <div role="radiogroup" aria-label={t('vote.options')} className="mt-4 space-y-3">
              {options.map((o) => {
                const votes = tally[o.id] ?? 0;
                const pct = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                const on = choice === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!open || alreadyVoted}
                    onClick={() => setChoice(o.id)}
                    className={cn('block w-full rounded-[1.5rem] border p-5 text-left transition active:scale-[0.995] disabled:cursor-default', on ? 'border-ink bg-brand-soft ring-2 ring-ink shadow-card' : 'border-line bg-surface hover:border-line-strong')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Chip tone="vote">{o.sector}</Chip>
                        <h3 className="mt-2 font-display text-xl font-bold leading-snug">{o.title}</h3>
                      </div>
                      <span className={cn('mt-1 grid size-7 shrink-0 place-items-center rounded-full border-2', on ? 'border-ink bg-ink text-bg' : 'border-line-strong')}>{on && <Check className="size-4" aria-hidden strokeWidth={3} />}</span>
                    </div>
                    {o.description && <p className="mt-2 text-sm text-ink-2">{o.description}</p>}
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <b className="font-data">{kes(o.amount, { compact: true })}</b>
                      <span className="text-muted">{t('vote.votes', { count: votes })} · {t('vote.share', { pct })}</span>
                    </div>
                    <Meter value={votes} max={Math.max(1, totalVotes)} label={t('vote.share', { pct })} tone="info" className="mt-2 !h-2" />
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-xs text-muted">{number(totalVotes)} {t('home.votes').toLowerCase()}</p>

          {alreadyVoted && <p className="mt-6 flex items-center gap-2 rounded-2xl bg-good-soft p-4 font-semibold text-good"><Check className="size-5" aria-hidden />{t('vote.alreadyVoted')}</p>}

          <p className="mt-8 flex items-center gap-2 text-sm text-muted"><Smartphone className="size-4" aria-hidden />{t('vote.ussd', { code: county.ussdCode })}</p>
        </>
      )}

      {open && !alreadyVoted && options.length > 0 && (
        <div className="glass fixed inset-x-3 bottom-24 z-30 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-full border border-line p-2 pl-5 shadow-float lg:bottom-6">
          <p className="min-w-0 truncate text-sm font-semibold">{chosen ? chosen.title : t('vote.options')}</p>
          <Button disabled={!chosen} onClick={start} size="lg" icon={<Landmark className="size-4" aria-hidden />}>{t('vote.castVote')}</Button>
        </div>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title={stage === 'done' ? t('vote.doneTitle') : stage === 'confirm' ? t('vote.confirmTitle') : t('vote.confirmTitle')} closeLabel={t('common.close')}>
        {stage === 'verify' && <PhoneVerify purpose="vote" onVerified={(tok) => { setToken(tok); setStage('confirm'); }} />}
        {stage === 'confirm' && chosen && (
          <div>
            <p className="text-ink-2">{t('vote.confirmBody', { option: chosen.title, ward: wardById.get(wardId ?? '')?.name ?? '' })}</p>
            <Button block size="lg" className="mt-5" onClick={() => void confirm()}>{t('vote.confirm')}</Button>
          </div>
        )}
        {stage === 'done' && (
          <div className="text-center">
            {outcome === 'sent' && <><div className="mx-auto grid size-16 place-items-center rounded-full bg-good-soft text-good"><Check className="size-8" aria-hidden strokeWidth={3} /></div><p className="mt-4 font-semibold">{t('vote.doneTitle')}</p></>}
            {outcome !== 'sent' && outcome !== 'failed' && <p className="text-ink-2">{t('vote.doneQueued')}</p>}
            {outcome === 'failed' && <p role="alert" className="font-semibold text-bad">{failed === 'already_voted' ? t('vote.alreadyVotedServer') : t('vote.failed')}</p>}
            <Button variant="secondary" className="mt-5" onClick={() => { setSheet(false); void data.refetch(); }}>{t('common.close')}</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
