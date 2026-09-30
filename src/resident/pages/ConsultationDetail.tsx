import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, LogIn, Send } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useConsultationComments, useConsultations, useConsultationTally, useIsDemo } from '@/shared/api/hooks';
import { addConsultationComment, consultationOpen } from '@/shared/api/rights';
import type { Stance } from '@/shared/api/types';
import { useAuth } from '@/shared/state/auth';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Field, SelectInput, TextArea, TextInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { ShareListen } from '@/shared/ui/ShareListen';
import { toast } from '@/shared/ui/Toast';

const stances: Stance[] = ['support', 'oppose', 'amend', 'comment'];
const stanceTone: Record<Stance, Tone> = { support: 'good', oppose: 'bad', amend: 'warn', comment: 'neutral' };
const stanceBar: Record<Stance, string> = { support: 'bg-good', oppose: 'bg-bad', amend: 'bg-warn', comment: 'bg-line-strong' };
const wardName = new Map(wards.map((w) => [w.id, w.name]));
const sortedWards = [...wards].sort((a, b) => a.name.localeCompare(b.name));

export default function ConsultationDetail() {
  const { slug = '' } = useParams();
  const { t, locale, date, number, relative } = useI18n();
  const loc = useLocation();
  const qc = useQueryClient();
  const list = useConsultations();
  const c = (list.data ?? []).find((x) => x.slug === slug) ?? null;
  const comments = useConsultationComments(c?.id ?? null);
  const tally = useConsultationTally(c ? slug : null);
  const demo = useIsDemo();
  const signedIn = useAuth((s) => s.status === 'in');
  const [now] = useState(() => Date.now());
  const [part, setPart] = useState<number | 'all'>('all');
  const [f, setF] = useState<{ stance: Stance; body: string; question: string; ward_id: string; author_name: string }>({ stance: 'support', body: '', question: '', ward_id: '', author_name: '' });
  const [sent, setSent] = useState(false);
  usePageTitle(c ? (locale === 'sw' && c.title_sw ? c.title_sw : c.title) : t('rights.say.title'));
  const send = useMutation({
    mutationFn: () => addConsultationComment({ consultation_id: c!.id, stance: f.stance, body: f.body.trim(), question: f.question === '' ? null : Number(f.question), ward_id: f.ward_id || null, author_name: f.author_name.trim() }),
    onSuccess: () => { setSent(true); void qc.invalidateQueries({ queryKey: ['consultation-comments', c!.id] }); void qc.invalidateQueries({ queryKey: ['consultation-tally', slug] }); },
    onError: () => toast({ tone: 'bad', title: t('rights.say.error') }),
  });

  if (list.isLoading) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-10"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;
  if (!c) return <div className="mx-auto max-w-md px-4 py-24 text-center"><h1 className="font-display text-2xl font-extrabold">{t('rights.say.notFound')}</h1><Link to="/have-your-say" className="mt-6 inline-block font-semibold underline">{t('rights.say.back')}</Link></div>;
  const open = consultationOpen(c, now);
  const title = locale === 'sw' && c.title_sw ? c.title_sw : c.title;
  const summary = locale === 'sw' && c.summary_sw ? c.summary_sw : c.summary;
  const tl = tally.data;
  const shown = (comments.data ?? []).filter((x) => part === 'all' || x.question === part);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link to="/have-your-say" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{t('rights.say.back')}</Link>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip tone="vote">{t(`rights.say.kind.${c.kind}` as MessageKey)}</Chip>
        <Chip>{c.ward_id ? wardName.get(c.ward_id) ?? c.ward_id : t('loop.notices.countyWide')}</Chip>
        <Chip tone={open ? 'good' : 'neutral'}>{open ? t('rights.say.closes', { date: date(c.closes_at, { dateStyle: 'medium' }) }) : t('rights.say.closedOn', { date: date(c.closes_at, { dateStyle: 'medium' }) })}</Chip>
      </div>
      <h1 className="mt-3 font-display text-[clamp(1.6rem,5vw,2.4rem)] font-extrabold leading-tight">{title}</h1>
      {demo && <p className="mt-1 text-xs font-semibold text-muted">{t('common.demoData')}</p>}
      <p className="mt-4 whitespace-pre-line text-[1.05rem] text-ink-2">{summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {c.document_url && <a href={c.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"><ExternalLink className="size-4" aria-hidden />{t('rights.say.document')}</a>}
        <ShareListen text={title} speak={`${title}. ${summary}`} />
      </div>

      {c.questions.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-lg font-bold">{t('rights.say.questions')}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5">{c.questions.map((q) => <li key={q}>{q}</li>)}</ol>
        </section>
      )}

      {c.report ? (
        <section className="mt-8 rounded-[1.5rem] border border-info/40 bg-info-soft p-5">
          <h2 className="font-display text-xl font-bold">{t('rights.say.report')}</h2>
          {c.report_at && <p className="text-xs text-muted">{date(c.report_at, { dateStyle: 'long' })}</p>}
          <p className="mt-2 whitespace-pre-line">{c.report}</p>
          {c.report_url && <a href={c.report_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"><ExternalLink className="size-4" aria-hidden />{t('rights.say.reportDoc')}</a>}
        </section>
      ) : !open && <p className="mt-8 rounded-2xl bg-warn-soft p-4 text-sm font-semibold">{t('rights.say.reportPending')}</p>}

      {tl && tl.comments > 0 && (
        <section className="mt-8">
          <p className="text-sm font-semibold">{t('rights.say.people', { count: number(tl.people) })} · {t('rights.say.comments', { count: number(tl.comments) })} · {t('rights.say.wards', { count: number(tl.wards) })}</p>
          <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-bg-2" role="img" aria-label={stances.map((s) => `${t(`rights.say.stance.${s}`)}: ${tl.by_stance[s] ?? 0}`).join(', ')}>
            {stances.map((s) => (tl.by_stance[s] ?? 0) > 0 && <span key={s} className={cn('h-full border-r-2 border-surface last:border-r-0', stanceBar[s])} style={{ width: `${(100 * (tl.by_stance[s] ?? 0)) / tl.comments}%` }} />)}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {stances.map((s) => <li key={s} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn('size-2.5 rounded-full', stanceBar[s])} />{t(`rights.say.stance.${s}`)} {number(tl.by_stance[s] ?? 0)}</li>)}
          </ul>
        </section>
      )}

      {open && (
        <section className="mt-8 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="say">
          <h2 id="say" className="font-display text-xl font-bold">{t('rights.say.form.title')}</h2>
          {sent ? <p className="mt-3 rounded-2xl bg-good-soft p-4 text-sm font-semibold text-good">{t('rights.say.sent')}</p> : signedIn || demo ? (
            <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (f.body.trim().length >= 5) send.mutate(); }}>
              <fieldset>
                <legend className="text-sm font-semibold">{t('rights.say.form.stance')}</legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {stances.map((s) => (
                    <button key={s} type="button" aria-pressed={f.stance === s} onClick={() => setF({ ...f, stance: s })}
                      className={cn('h-10 rounded-full border px-4 text-sm font-semibold', f.stance === s ? 'border-ink bg-ink text-bg' : 'border-line-strong bg-surface hover:bg-bg-2')}>{t(`rights.say.stance.${s}`)}</button>
                  ))}
                </div>
              </fieldset>
              {c.questions.length > 0 && (
                <Field label={t('rights.say.form.about')}>{({ id }) => <SelectInput id={id} value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })}><option value="">{t('rights.say.form.general')}</option>{c.questions.map((q, i) => <option key={q} value={i}>{q}</option>)}</SelectInput>}</Field>
              )}
              <Field label={t('rights.say.form.body')} hint={t('rights.say.form.bodyHint')}>{({ id, describedBy }) => <TextArea id={id} aria-describedby={describedBy} className="min-h-28" maxLength={2000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('rights.say.form.ward')} optionalLabel={t('common.optional')}>{({ id }) => <SelectInput id={id} value={f.ward_id} onChange={(e) => setF({ ...f, ward_id: e.target.value })}><option value="">-</option>{sortedWards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>}</Field>
                <Field label={t('rights.say.form.name')} hint={t('rights.say.form.nameHint')}>{({ id, describedBy }) => <TextInput id={id} aria-describedby={describedBy} maxLength={80} value={f.author_name} onChange={(e) => setF({ ...f, author_name: e.target.value })} />}</Field>
              </div>
              <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={send.isPending} disabled={f.body.trim().length < 5}>{t('rights.say.form.send')}</Button>
            </form>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-2">{t('rights.say.signInWhy')}</p>
              <ButtonLink className="mt-4" to={`/services/account?next=${encodeURIComponent(loc.pathname)}`} icon={<LogIn className="size-4" aria-hidden />}>{t('rights.say.signIn')}</ButtonLink>
            </>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold">{t('rights.say.what')}</h2>
        {c.questions.length > 0 && (
          <div className="mt-3 max-w-xs"><SelectInput aria-label={t('rights.say.form.about')} value={part === 'all' ? '' : String(part)} onChange={(e) => setPart(e.target.value === '' ? 'all' : Number(e.target.value))}>
            <option value="">{t('rights.say.filterAll')}</option>
            {c.questions.map((q, i) => <option key={q} value={i}>{q}</option>)}
          </SelectInput></div>
        )}
        {comments.isLoading ? <Skeleton className="mt-4 h-40" /> : shown.length === 0 ? <p className="mt-3 text-sm text-muted">{t('rights.say.noComments')}</p> : (
          <ul className="mt-4 space-y-3">
            {shown.map((x) => (
              <li key={x.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Chip tone={stanceTone[x.stance]}>{t(`rights.say.stance.${x.stance}`)}</Chip>
                  {x.question !== null && c.questions[x.question] && <Chip>{c.questions[x.question]}</Chip>}
                  <span className="text-muted">{x.author_name || t('rights.say.anon')}{x.ward_id ? `, ${wardName.get(x.ward_id) ?? x.ward_id}` : ''} · {relative(x.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm">{x.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
