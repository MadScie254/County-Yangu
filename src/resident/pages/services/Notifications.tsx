import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { listNotifications, markAllRead } from '@/shared/api/services';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Card';

const icon = { info: Info, success: CheckCircle2, warning: TriangleAlert, error: CircleAlert } as const;
const color = { info: 'text-info', success: 'text-good', warning: 'text-warn', error: 'text-bad' } as const;

export default function Notifications() {
  const { t, relative } = useI18n();
  usePageTitle(t('services.notif.title'));
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: listNotifications, refetchInterval: 30_000 });
  const unread = q.data?.some((n) => !n.read);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('services.notif.title')}</h1>
        {unread && <Button variant="secondary" size="sm" onClick={async () => { await markAllRead(); void qc.invalidateQueries({ queryKey: ['notifications'] }); }}>{t('services.notif.markRead')}</Button>}
      </header>
      <ul className="mt-8 space-y-3">
        {q.isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-20" />)}
        {q.isSuccess && q.data.length === 0 && <li className="rounded-[1.5rem] border border-dashed border-line-strong p-10 text-center text-muted">{t('services.notif.none')}</li>}
        {q.data?.map((n) => {
          const Icon = icon[n.kind];
          const body = (
            <div className={cn('flex gap-3 rounded-[1.25rem] border bg-surface p-4', n.read ? 'border-line' : 'border-ink shadow-card')}>
              <Icon className={cn('mt-0.5 size-5 shrink-0', color[n.kind])} aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold">{n.title}</p>
                <p className="mt-0.5 text-sm text-ink-2">{n.message}</p>
                <p className="mt-1 text-xs text-muted">{relative(n.created_at)}</p>
              </div>
            </div>
          );
          return <li key={n.id}>{n.link ? <Link to={n.link}>{body}</Link> : body}</li>;
        })}
      </ul>
    </div>
  );
}
