import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Scale } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { useInfoRequest, useIsDemo } from '@/shared/api/hooks';
import { infoDeadline, infoOpen, infoOverdue } from '@/shared/api/rights';
import { usePageTitle } from '@/shared/lib/hooks';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { ShareListen } from '@/shared/ui/ShareListen';
import { infoTone } from './Information';

export default function InformationDetail() {
  const { reference = '' } = useParams();
  const { t, date } = useI18n();
  const q = useInfoRequest(reference);
  const demo = useIsDemo();
  const [now] = useState(() => Date.now());
  const r = q.data;
  usePageTitle(r ? r.title : t('rights.info.title'));

  if (q.isLoading) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-10"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;
  if (!r) return <div className="mx-auto max-w-md px-4 py-24 text-center"><h1 className="font-display text-2xl font-extrabold">{t('rights.info.notFound')}</h1><Link to="/information" className="mt-6 inline-block font-semibold underline">{t('rights.info.back')}</Link></div>;
  const late = infoOverdue(r, now);
  const showAppeal = r.status === 'refused' || r.status === 'partly_answered' || late;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link to="/information" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{t('rights.info.back')}</Link>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip tone={late ? 'bad' : infoTone[r.status]}>{t(`rights.info.status.${r.status}` as MessageKey)}</Chip>
        {r.urgent && <Chip tone="bad">{t('rights.info.urgentTag')}</Chip>}
        <span className="font-data text-xs text-muted">{r.reference}</span>
      </div>
      <h1 className="mt-3 font-display text-[clamp(1.6rem,5vw,2.4rem)] font-extrabold leading-tight">{r.title}</h1>
      <p className="mt-2 text-sm text-muted">{t('rights.info.asked', { name: r.requester_name || t('rights.info.aResident') })} · {date(r.created_at, { dateStyle: 'long' })}</p>
      {demo && <p className="mt-1 text-xs font-semibold text-muted">{t('common.demoData')}</p>}
      <p className="mt-5 whitespace-pre-line rounded-2xl bg-bg-2/70 p-4">{r.body}</p>

      {infoOpen(r) && <p className={late ? 'mt-5 font-semibold text-bad' : 'mt-5 font-semibold'}>{t('rights.info.due', { date: date(infoDeadline(r), { dateStyle: 'long', timeStyle: r.urgent ? 'short' : undefined }) })}</p>}
      {r.extended_to && r.extension_reason && <p className="mt-3 rounded-2xl bg-warn-soft p-4 text-sm">{t('rights.info.extended', { reason: r.extension_reason })}</p>}
      {late && <p className="mt-3 rounded-2xl bg-bad-soft p-4 text-sm font-semibold">{t('rights.info.lateNote')}</p>}

      {(r.response || r.response_url) && (
        <section className="mt-6 rounded-[1.5rem] border border-good/40 bg-good-soft p-5">
          <h2 className="font-display text-lg font-bold">{t('rights.info.answer')}</h2>
          {r.answered_at && <p className="text-xs text-muted">{date(r.answered_at, { dateStyle: 'long' })}</p>}
          {r.response && <p className="mt-2 whitespace-pre-line">{r.response}</p>}
          {r.response_url && <a href={r.response_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-semibold underline underline-offset-4"><ExternalLink className="size-4" aria-hidden />{t('rights.info.documents')}</a>}
        </section>
      )}
      {r.refusal_reason && (
        <section className="mt-6 rounded-[1.5rem] border border-bad/40 bg-bad-soft p-5">
          <h2 className="font-display text-lg font-bold">{t('rights.info.refusal')}</h2>
          <p className="mt-2 whitespace-pre-line">{r.refusal_reason}</p>
        </section>
      )}
      {showAppeal && (
        <p className="mt-6 flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
          <Scale className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>{t('rights.info.appeal')} <a href="https://www.ombudsman.go.ke/" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">{t('rights.info.appealLink')}</a></span>
        </p>
      )}
      <ShareListen className="mt-6" text={r.title} speak={[r.title, r.body, r.response, r.refusal_reason].filter(Boolean).join('. ')} />
    </article>
  );
}
