import { Link } from 'react-router-dom';
import { BarChart3, CheckCircle2, Flag, Megaphone, Siren } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useLiveActivity } from '@/shared/api/hooks';
import type { LiveItem } from '@/shared/api/engage';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui/Card';

/** What is happening across the county right now. Categories and wards only: never what a resident wrote. */
export function LiveFeed({ limit = 8, className }: { limit?: number; className?: string }) {
  const { t, locale, relative } = useI18n();
  const q = useLiveActivity(limit);
  const sw = locale === 'sw';
  const line = (x: LiveItem) => {
    switch (x.kind) {
      case 'report': return { icon: Megaphone, tone: 'text-warn', to: `/ward/${x.ward_id}`, text: t('live.report', { category: (sw && x.category_sw) || x.category, ward: x.ward }) };
      case 'resolved': return { icon: CheckCircle2, tone: 'text-good', to: `/case/${x.reference}`, text: x.days === 0 ? t('live.fixedSameDay', { category: (sw && x.category_sw) || x.category, ward: x.ward }) : t('live.fixed', { category: (sw && x.category_sw) || x.category, ward: x.ward, count: x.days }) };
      case 'milestone': return { icon: Flag, tone: 'text-info', to: `/projects/${x.slug}`, text: t('live.milestone', { title: x.title, project: x.project }) };
      case 'poll': return { icon: BarChart3, tone: 'text-brand-strong', to: `/polls#${x.slug}`, text: t('live.poll', { title: x.title }) };
      case 'notice': return { icon: Siren, tone: 'text-bad', to: '/notices', text: x.ward ? t('live.notice', { title: x.title, ward: x.ward }) : x.title };
    }
  };
  return (
    <section className={cn('rounded-[1.5rem] border border-line bg-surface p-5 shadow-card', className)} aria-labelledby="live-title">
      <h3 id="live-title" className="flex items-center gap-2 font-display text-lg font-bold">
        <span aria-hidden className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-bad opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-bad" /></span>
        {t('live.title')}
      </h3>
      {q.isLoading ? <Skeleton className="mt-3 h-40" /> : (q.data ?? []).length === 0 ? <p className="mt-3 text-sm text-muted">{t('live.quiet')}</p> : (
        <ul className="mt-3 divide-y divide-line" aria-live="polite">
          {(q.data ?? []).map((x, i) => {
            const l = line(x);
            return (
              <li key={`${x.kind}-${x.at}-${i}`}>
                <Link to={l.to} className="flex items-start gap-3 py-2.5 text-sm hover:bg-bg-2/60">
                  <l.icon className={cn('mt-0.5 size-4 shrink-0', l.tone)} aria-hidden />
                  <span className="min-w-0 flex-1">{l.text}</span>
                  <span className="shrink-0 text-xs text-muted">{relative(x.at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
