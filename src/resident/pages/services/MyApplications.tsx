import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FilePlus2 } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { listMyApplications, listServices } from '@/shared/api/services';
import type { ApplicationStatus } from '@/shared/api/services-types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { ButtonLink } from '@/shared/ui/Button';

export const appTone: Record<ApplicationStatus, Tone> = { draft: 'neutral', awaiting_payment: 'warn', submitted: 'info', under_review: 'info', changes_requested: 'warn', approved: 'good', rejected: 'bad', withdrawn: 'neutral' };

export default function MyApplications() {
  const { t, kes, date, locale } = useI18n();
  usePageTitle(t('services.app.title'));
  const apps = useQuery({ queryKey: ['applications'], queryFn: listMyApplications });
  const services = useQuery({ queryKey: ['services'], queryFn: listServices, staleTime: 5 * 60_000 });
  const name = (id: string) => {
    const s = services.data?.find((x) => x.id === id);
    return s ? (locale === 'sw' && s.name_sw ? s.name_sw : s.name) : '';
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('services.app.title')}</h1>
        <ButtonLink to="/services" icon={<FilePlus2 className="size-4" aria-hidden />}>{t('services.app.browse')}</ButtonLink>
      </header>
      <ul className="mt-8 space-y-3">
        {apps.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
        {apps.isSuccess && apps.data.length === 0 && <li className="rounded-[1.5rem] border border-dashed border-line-strong p-10 text-center text-muted">{t('services.app.none')}</li>}
        {apps.data?.map((a) => (
          <li key={a.id}>
            <Link to={`/services/applications/${a.id}`} className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-line bg-surface p-5 shadow-card transition hover:shadow-float">
              <div className="min-w-0">
                <p className="font-data text-xs text-muted">{a.reference}</p>
                <p className="mt-0.5 truncate font-display text-lg font-bold">{name(a.service_id)}</p>
                <p className="mt-1 text-sm text-muted">{date(a.created_at)} · {a.amount > 0 ? kes(a.amount) : t('services.free')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Chip tone={appTone[a.status]}>{t(`services.app.statuses.${a.status}` as MessageKey)}</Chip>
                <ArrowRight className="size-4 text-muted" aria-hidden />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
