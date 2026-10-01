import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, TriangleAlert } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useLegalDeadlines } from '@/shared/api/hooks';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from './Card';

type Row = { label: string; law: string; to: string; done: number; onTime: number; lateNow: number; unit: string };

/**
 * Does the county keep the time limits the law (or its own rules) sets? Counted in the database (legal_deadlines),
 * so the county cannot mark its own homework. Used on Open County and on the staff overview.
 */
export function DeadlinesBoard({ links = 'resident' }: { links?: 'resident' | 'console' }) {
  const { t, number } = useI18n();
  const q = useLegalDeadlines();
  const d = q.data;
  if (q.isLoading) return <Skeleton className="h-48" />;
  if (!d) return null;
  const rows: Row[] = [
    { label: t('rights.board.info'), law: t('rights.board.infoLaw'), to: links === 'console' ? '/information' : '/information', done: d.info.decided, onTime: d.info.on_time, lateNow: d.info.late_now, unit: t('rights.board.requests') },
    { label: t('rights.board.petitions'), law: t('rights.board.petitionsLaw'), to: '/ideas', done: d.petitions.answered_on_time + d.petitions.answered_late, onTime: d.petitions.answered_on_time, lateNow: d.petitions.late_now, unit: t('rights.board.petitionsUnit') },
    { label: t('rights.board.consultations'), law: t('rights.board.consultationsLaw'), to: links === 'console' ? '/consultations' : '/have-your-say', done: d.consultations.closed, onTime: d.consultations.reported, lateNow: d.consultations.report_owed, unit: t('rights.board.consultationsUnit') },
    { label: t('rights.board.erasure'), law: t('rights.board.erasureLaw'), to: links === 'console' ? '/admin' : '/me', done: d.erasure.done, onTime: d.erasure.on_time, lateNow: d.erasure.late_now, unit: t('rights.board.requests') },
  ];
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-line bg-surface">
      <ul className="divide-y divide-line">
        {rows.map((r) => {
          const pct = r.done ? Math.round((100 * r.onTime) / r.done) : null;
          return (
            <li key={r.label} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <Link to={r.to} className="font-semibold hover:underline">{r.label}</Link>
                <p className="text-xs text-muted">{r.law}</p>
              </div>
              <div>
                {pct === null ? <p className="text-sm text-muted">{t('rights.board.noneYet')}</p> : (
                  <>
                    <div className="h-2 overflow-hidden rounded-full bg-bg-2"><div className={cn('h-full rounded-full', pct >= 90 ? 'bg-good' : pct >= 60 ? 'bg-warn' : 'bg-bad')} style={{ width: `${pct}%` }} /></div>
                    <p className="mt-1 text-xs font-semibold">{t('rights.board.onTime', { pct, on: number(r.onTime), total: number(r.done), unit: r.unit })}</p>
                  </>
                )}
              </div>
              <p className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', r.lateNow ? 'text-bad' : 'text-good')}>
                {r.lateNow ? <TriangleAlert className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
                {r.lateNow ? t('rights.board.lateNow', { count: number(r.lateNow) }) : t('rights.board.noneLate')}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-1.5 border-t border-line bg-bg-2/60 px-4 py-2 text-xs text-muted"><Clock className="size-3.5" aria-hidden />{t('rights.board.how')}</p>
    </div>
  );
}
