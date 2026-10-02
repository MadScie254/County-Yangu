import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertOctagon, LogIn, Send } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { useConcerns, useTenders } from '@/shared/api/hooks';
import { concernLate, fileConcern, updateConcern } from '@/shared/api/civic2';
import type { ConcernKind, TenderConcern } from '@/shared/api/types';
import { useAuth } from '@/shared/state/auth';
import { cn } from '@/shared/lib/utils';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea } from '@/shared/ui/Field';
import { Sheet } from '@/shared/ui/Sheet';
import { toast } from '@/shared/ui/Toast';
import { FlagButton } from './FlagButton';

const kinds: ConcernKind[] = ['specs_tailored', 'short_deadline', 'single_bid', 'price_inflated', 'conflict_of_interest', 'not_delivered', 'other'];
const tone: Record<TenderConcern['status'], Tone> = { submitted: 'info', answered: 'neutral', fixed: 'good', dismissed: 'bad', escalated: 'warn' };

/** "Raise a concern" for one tender: answered in public within 14 days, or escalated. After Ukraine's DOZORRO. */
export function RaiseConcern({ tenderId, label }: { tenderId: string; label: string }) {
  const { t } = useI18n();
  const loc = useLocation();
  const qc = useQueryClient();
  const signedIn = useAuth((s) => s.status === 'in');
  const demo = useAuth((s) => s.demo);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ kind: ConcernKind; body: string }>({ kind: 'single_bid', body: '' });
  const send = useMutation({
    mutationFn: () => fileConcern({ tender_id: tenderId, kind: f.kind, body: f.body.trim() }),
    onSuccess: (r) => { setOpen(false); setF({ kind: 'single_bid', body: '' }); toast({ tone: 'good', title: t('concerns.sent', { reference: r?.reference ?? '' }) }); void qc.invalidateQueries({ queryKey: ['concerns'] }); },
    onError: () => toast({ tone: 'bad', title: t('concerns.error') }),
  });
  return (
    <>
      <Button variant="ghost" size="sm" icon={<AlertOctagon className="size-4" aria-hidden />} onClick={() => setOpen(true)}>{t('concerns.raise')}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('concerns.raiseTitle')} closeLabel={t('common.close')}>
        <p className="text-sm text-ink-2"><b>{label}</b></p>
        <p className="mt-1 text-sm text-ink-2">{t('concerns.raiseIntro')}</p>
        {!signedIn && !demo ? (
          <ButtonLink className="mt-4" to={`/services/account?next=${encodeURIComponent(loc.pathname)}`} icon={<LogIn className="size-4" aria-hidden />}>{t('concerns.signIn')}</ButtonLink>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (f.body.trim().length >= 20) send.mutate(); }}>
            <Field label={t('concerns.kind')}>{({ id }) => <SelectInput id={id} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as ConcernKind })}>{kinds.map((k) => <option key={k} value={k}>{t(`concerns.kinds.${k}` as MessageKey)}</option>)}</SelectInput>}</Field>
            <Field label={t('concerns.body')} hint={t('concerns.bodyHint')}>{({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} className="min-h-28" maxLength={3000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
            <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={send.isPending} disabled={f.body.trim().length < 20}>{t('concerns.send')}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}

/** Every concern raised, with its answer, so the public can see what happened. */
export function ConcernsPanel() {
  const { t, date, number } = useI18n();
  const qc = useQueryClient();
  const q = useConcerns();
  const tenders = useTenders();
  const [now] = useState(() => Date.now());
  const title = new Map((tenders.data ?? []).map((x) => [x.id, `${x.reference}: ${x.title}`]));
  const list = q.data ?? [];
  const fixed = list.filter((c) => c.status === 'fixed').length;
  const escalate = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => updateConcern(id, { status: 'escalated', escalated_to: to }),
    onSuccess: () => { toast({ tone: 'good', title: t('concerns.escalated') }); void qc.invalidateQueries({ queryKey: ['concerns'] }); },
    onError: () => toast({ tone: 'bad', title: t('concerns.escalateError') }),
  });
  return (
    <section id="concerns" className="mt-10 scroll-mt-24 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-7" aria-labelledby="concerns-h">
      <h2 id="concerns-h" className="font-display text-xl font-bold">{t('concerns.title')}</h2>
      <p className="mt-1 text-sm text-ink-2">{t('concerns.intro')}</p>
      {list.length > 0 && <p className="mt-3 text-sm font-semibold">{t('concerns.score', { total: number(list.length), fixed: number(fixed) })}</p>}
      {list.length === 0 ? <p className="mt-4 text-sm text-muted">{t('concerns.none')}</p> : (
        <ul className="mt-4 space-y-3">
          {list.map((c) => {
            const late = concernLate(c, now);
            return (
              <li key={c.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={late ? 'bad' : tone[c.status]}>{late ? t('concerns.late') : t(`concerns.status.${c.status}` as MessageKey)}</Chip>
                  <Chip>{t(`concerns.kinds.${c.kind}` as MessageKey)}</Chip>
                  <span className="ml-auto font-data text-xs text-muted">{c.reference}</span>
                </div>
                {title.get(c.tender_id) && <p className="mt-2 text-xs font-semibold text-muted">{title.get(c.tender_id)}</p>}
                <p className="mt-1 text-sm">{c.body}</p>
                {c.response && <p className={cn('mt-2 rounded-xl p-3 text-sm', c.status === 'fixed' ? 'bg-good-soft' : 'bg-bg-2')}><b>{t('concerns.answer')}.</b> {c.response}</p>}
                {c.escalated_to && <p className="mt-2 text-sm font-semibold text-warn">{t('concerns.escalatedTo', { to: c.escalated_to })}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>{c.status === 'submitted' ? t('concerns.due', { date: date(c.due_at, { dateStyle: 'medium' }) }) : c.answered_at ? t('concerns.answeredOn', { date: date(c.answered_at, { dateStyle: 'medium' }) }) : null}</span>
                  {(late || c.status === 'dismissed') && !c.escalated_to && (
                    <span className="inline-flex flex-wrap items-center gap-1.5">{t('concerns.youRaised')}
                      {(['PPRA', 'EACC', 'Auditor-General'] as const).map((to) => <button key={to} type="button" className="rounded-full border border-line-strong px-2 py-0.5 font-semibold text-ink hover:bg-bg-2" onClick={() => escalate.mutate({ id: c.id, to })}>{to}</button>)}
                    </span>
                  )}
                  <span className="ml-auto"><FlagButton kind="concern" id={c.id} /></span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
