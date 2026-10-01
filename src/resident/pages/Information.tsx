import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileQuestion, LogIn, Send, Siren } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { useInfoRequests, useIsDemo, useMyInfoRequests } from '@/shared/api/hooks';
import { fileInfoRequest, infoDeadline, infoOpen, infoOverdue } from '@/shared/api/rights';
import type { InfoRequest } from '@/shared/api/types';
import { useAuth } from '@/shared/state/auth';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Field, TextArea, TextInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';

const DAY = 86_400_000;
export const infoTone: Record<InfoRequest['status'], Tone> = { submitted: 'info', extended: 'warn', answered: 'good', partly_answered: 'good', refused: 'bad', withdrawn: 'neutral' };
type Filter = 'all' | 'open' | 'overdue' | 'answered' | 'refused';

export function InfoRow({ r, now }: { r: InfoRequest; now: number }) {
  const { t, date, number } = useI18n();
  const late = infoOverdue(r, now);
  const left = Math.ceil((Date.parse(infoDeadline(r)) - now) / DAY);
  return (
    <li>
      <Link to={`/information/${r.reference}`} className="block rounded-[1.5rem] border border-line bg-surface p-5 shadow-card transition-colors hover:border-line-strong">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={late ? 'bad' : infoTone[r.status]}>{t(`rights.info.status.${r.status}` as MessageKey)}</Chip>
          {r.urgent && <Chip tone="bad"><Siren className="size-3.5" aria-hidden />{t('rights.info.urgentTag')}</Chip>}
          {infoOpen(r) && <span className={cn('text-xs font-semibold', late ? 'text-bad' : 'text-muted')}>{late ? t('rights.info.late', { days: number(Math.max(1, -left)) }) : t('rights.info.dueIn', { days: number(Math.max(0, left)) })}</span>}
          <span className="ml-auto font-data text-xs text-muted">{r.reference}</span>
        </div>
        <h3 className="mt-2 font-display text-lg font-bold leading-snug">{r.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink-2">{r.body}</p>
        <p className="mt-2 text-xs text-muted">{t('rights.info.asked', { name: r.requester_name || t('rights.info.aResident') })} · {date(r.created_at, { dateStyle: 'medium' })}</p>
      </Link>
    </li>
  );
}

function AskForm() {
  const { t, date } = useI18n();
  const qc = useQueryClient();
  const [f, setF] = useState({ title: '', body: '', requester_name: '', is_public: true, urgent: false, urgent_reason: '' });
  const [sent, setSent] = useState<{ reference: string; due_at: string } | null>(null);
  const send = useMutation({
    mutationFn: () => fileInfoRequest({ ...f, title: f.title.trim(), body: f.body.trim(), requester_name: f.requester_name.trim() }),
    onSuccess: (r) => { setSent(r); void qc.invalidateQueries({ queryKey: ['info-requests'] }); void qc.invalidateQueries({ queryKey: ['my-info-requests'] }); },
    onError: () => toast({ tone: 'bad', title: t('rights.info.error') }),
  });
  if (sent) return <p className="rounded-2xl bg-good-soft p-4 text-sm font-semibold text-good">{t('rights.info.sent', { reference: sent.reference, date: date(sent.due_at, { dateStyle: 'medium', timeStyle: 'short' }) })} <Link className="underline" to={`/information/${sent.reference}`}>{sent.reference}</Link></p>;
  const valid = f.title.trim().length >= 8 && f.body.trim().length >= 20 && (!f.urgent || f.urgent_reason.trim().length > 3);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) send.mutate(); }}>
      <Field label={t('rights.info.form.title')} hint={t('rights.info.form.titleHint')}>{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} maxLength={160} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />}</Field>
      <Field label={t('rights.info.form.body')} hint={t('rights.info.form.bodyHint')}>{({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} className="min-h-28" maxLength={4000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
      <Field label={t('rights.info.form.name')} hint={t('rights.info.form.nameHint')}>{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} maxLength={80} value={f.requester_name} onChange={(e) => setF({ ...f, requester_name: e.target.value })} />}</Field>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4" checked={f.is_public} onChange={(e) => setF({ ...f, is_public: e.target.checked })} /><span><b>{t('rights.info.form.public')}</b><span className="block text-muted">{t('rights.info.form.publicHint')}</span></span></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4" checked={f.urgent} onChange={(e) => setF({ ...f, urgent: e.target.checked })} /><b>{t('rights.info.form.urgent')}</b></label>
      {f.urgent && <Field label={t('rights.info.form.urgentReason')}>{({ id }) => <TextInput id={id} maxLength={500} value={f.urgent_reason} onChange={(e) => setF({ ...f, urgent_reason: e.target.value })} />}</Field>}
      <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={send.isPending} disabled={!valid}>{t('rights.info.form.send')}</Button>
    </form>
  );
}

export default function Information() {
  const { t } = useI18n();
  const loc = useLocation();
  const q = useInfoRequests();
  const demo = useIsDemo();
  const signedIn = useAuth((s) => s.status === 'in');
  const mine = useMyInfoRequests(signedIn);
  const [filter, setFilter] = useState<Filter>('all');
  const [now] = useState(() => Date.now());
  usePageTitle(t('rights.info.title'));
  const all = useMemo(() => q.data ?? [], [q.data]);
  const list = all.filter((r) => filter === 'all' || (filter === 'open' && infoOpen(r) && !infoOverdue(r, now)) || (filter === 'overdue' && infoOverdue(r, now))
    || (filter === 'answered' && (r.status === 'answered' || r.status === 'partly_answered')) || (filter === 'refused' && r.status === 'refused'));
  const count = (f: Filter) => all.filter((r) => f === 'all' || (f === 'open' && infoOpen(r) && !infoOverdue(r, now)) || (f === 'overdue' && infoOverdue(r, now)) || (f === 'answered' && (r.status === 'answered' || r.status === 'partly_answered')) || (f === 'refused' && r.status === 'refused')).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('rights.info.title')}</h1>
      <p className="mt-3 max-w-3xl text-[1.05rem] text-ink-2">{t('rights.info.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="ask">
          <h2 id="ask" className="flex items-center gap-2 font-display text-xl font-bold"><FileQuestion className="size-5" aria-hidden />{t('rights.info.ask')}</h2>
          <div className="mt-4">
            {signedIn || demo ? <AskForm /> : (
              <>
                <p className="text-sm text-ink-2">{t('rights.info.signInWhy')}</p>
                <ButtonLink className="mt-4" to={`/services/account?next=${encodeURIComponent(loc.pathname)}`} icon={<LogIn className="size-4" aria-hidden />}>{t('rights.info.signIn')}</ButtonLink>
              </>
            )}
          </div>
        </section>
        <section className="rounded-[1.75rem] bg-brand-soft p-5 sm:p-6" aria-labelledby="rules">
          <h2 id="rules" className="font-display text-xl font-bold">{t('rights.info.rules.t')}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
            {(['a', 'b', 'c', 'd'] as const).map((k) => <li key={k}>{t(`rights.info.rules.${k}`)}</li>)}
          </ol>
          <a href="https://www.ombudsman.go.ke/" target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">{t('rights.info.appealLink')}</a>
        </section>
      </div>

      {(mine.data?.length ?? 0) > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">{t('rights.info.mine')}</h2>
          <ul className="mt-4 space-y-3">{mine.data!.map((r) => <InfoRow key={r.id} r={r} now={now} />)}</ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">{t('rights.info.all')}</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('rights.info.all')}>
          {(['all', 'open', 'overdue', 'answered', 'refused'] as Filter[]).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
              className={cn('h-9 rounded-full border px-4 text-sm font-semibold', filter === f ? 'border-ink bg-ink text-bg' : 'border-line-strong bg-surface hover:bg-bg-2')}>
              {t(`rights.info.filter.${f}`)} <span className="opacity-70">{count(f)}</span>
            </button>
          ))}
        </div>
        {q.isLoading ? <Skeleton className="mt-6 h-64" /> : all.length === 0 ? <p className="mt-6 text-sm text-muted">{t('rights.info.none')}</p>
          : list.length === 0 ? <p className="mt-6 text-sm text-muted">{t('rights.info.noneFilter')}</p>
          : <ul className="mt-6 space-y-3">{list.map((r) => <InfoRow key={r.id} r={r} now={now} />)}</ul>}
      </section>
    </div>
  );
}
