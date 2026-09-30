import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, CircleDot, Clock, Flag, Landmark, Megaphone, MessageSquare, RotateCcw, ThumbsUp, TriangleAlert, ArrowRight } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { useCaseStatus } from '@/shared/api/hooks';
import { referenceRegex } from '@/shared/lib/schemas';
import { usePageTitle } from '@/shared/lib/hooks';
import { categoryMeta, type CategoryId } from '@/shared/data/categories';
import { daysBetween, cn } from '@/shared/lib/utils';
import { Chip, reportTone } from '@/shared/ui/Chip';
import { Ring } from '@/shared/ui/Meter';
import { Skeleton } from '@/shared/ui/Card';
import { ButtonLink } from '@/shared/ui/Button';
import { CaseFeedback } from '../components/CaseFeedback';

const eventIcon: Record<string, typeof CircleDot> = { created: Megaphone, status: CheckCircle2, public_message: MessageSquare, reminder: Clock, escalated: Flag, feedback: ThumbsUp, reopened: RotateCcw };

export default function CaseDetail() {
  const { reference = '' } = useParams();
  const { t, locale, date, relative } = useI18n();
  const ref = reference.toUpperCase();
  const valid = referenceRegex.test(ref);
  const q = useCaseStatus(valid ? ref : null);
  const [now] = useState(() => Date.now());
  usePageTitle(valid ? ref : t('status.title'));

  if (!valid || (q.isSuccess && !q.data)) return <NotFound />;
  if (q.isLoading || !q.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-44" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const c = q.data;
  const done = c.status === 'resolved' || c.status === 'closed' || c.status === 'rejected';
  const created = new Date(c.created_at).getTime();
  const due = c.resolve_due_at ? new Date(c.resolve_due_at).getTime() : null;
  const overdueDays = due && !done && now > due ? Math.max(1, daysBetween(new Date(due), new Date(now))) : 0;
  const progress = done ? 1 : due ? Math.min(1, Math.max(0, (now - created) / (due - created))) : 0;
  const categoryId = c.category_id as CategoryId | null | undefined;
  const sensitive = categoryId ? categoryMeta[categoryId].sensitive : false;
  const categoryName = (locale === 'sw' ? c.category_sw : c.category) ?? '';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{t('report.reference')}</p>
      <h1 className="mt-1 break-all font-data text-3xl font-medium tracking-wide">{c.reference}</h1>

      <div className="mt-6 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-7">
        <div className="flex items-center gap-5">
          <Ring value={progress} size={96} stroke={10} tone={done ? 'good' : overdueDays ? 'bad' : 'brand'} label={overdueDays ? t('status.overdueBy', { count: overdueDays }) : done ? t(`statuses.${c.status}` as MessageKey) : t('status.onTrack')}>
            <span className="font-display text-2xl font-extrabold leading-none">{done ? '✓' : overdueDays ? `+${overdueDays}` : `${Math.round(progress * 100)}%`}</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2">
              <Chip tone={reportTone(c.status)}>{t(`statuses.${c.status}` as MessageKey)}</Chip>
              {(c.reopened_count ?? 0) > 0 && <Chip tone="warn"><RotateCcw className="size-3.5" aria-hidden />{t('loop.feedback.reopened', { count: c.reopened_count ?? 0 })}</Chip>}
            </div>
            <p className="mt-2 font-display text-xl font-bold leading-tight">{categoryName}</p>
            <p className="text-sm text-muted">{c.ward}</p>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm">
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{t('status.reported')}</dt>
            <dd className="mt-0.5 font-semibold">{date(c.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{t('status.due')}</dt>
            <dd className={cn('mt-0.5 font-semibold', overdueDays > 0 && 'text-bad')}>
              {c.resolve_due_at ? date(c.resolve_due_at) : '-'}
              {overdueDays > 0 && <span className="ml-2 inline-flex items-center gap-1 text-xs"><TriangleAlert className="size-3.5" aria-hidden />{t('status.overdueBy', { count: overdueDays })}</span>}
            </dd>
          </div>
        </dl>
        {sensitive && <p className="mt-4 flex items-center gap-2 rounded-xl bg-info-soft px-3 py-2 text-sm font-medium text-info"><Landmark className="size-4" aria-hidden /> {t('status.sensitive')}</p>}
      </div>

      {(c.status === 'resolved' || c.status === 'closed') && !c.feedback_given && <CaseFeedback reference={c.reference} />}

      <section className="mt-10" aria-labelledby="timeline">
        <h2 id="timeline" className="font-display text-xl font-bold">{t('status.timeline')}</h2>
        {c.events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t('status.noUpdates')}</p>
        ) : (
          <ol className="relative mt-5 space-y-6 border-l-2 border-line pl-6">
            {[...c.events].reverse().map((e, i) => {
              const Icon = eventIcon[e.kind] ?? CircleDot;
              const alarm = e.kind === 'escalated';
              return (
                <li key={`${e.at}-${i}`} className="relative">
                  <span className={cn('absolute -left-[2.15rem] grid size-8 place-items-center rounded-full border-4 border-bg', alarm ? 'bg-bad text-bg' : i === 0 ? 'bg-brand text-brand-ink' : 'bg-bg-2 text-ink-2')}>
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <p className="font-semibold">{e.message}</p>
                  <p className="text-sm text-muted" title={date(e.at, { dateStyle: 'medium', timeStyle: 'short' })}>{relative(e.at)}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {c.project_slug && (
        <Link to={`/projects/${c.project_slug}`} className="mt-10 flex items-center justify-between rounded-[1.5rem] border border-line bg-surface p-5 shadow-card hover:shadow-float">
          <span className="font-semibold">{t('status.linkedProject')}</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">{t('status.viewProject')} <ArrowRight className="size-4" aria-hidden /></span>
        </Link>
      )}
    </div>
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-extrabold">{t('status.notFound')}</h1>
      <ButtonLink to="/case" className="mt-8">{t('status.title')}</ButtonLink>
    </div>
  );
}
