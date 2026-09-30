import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { getApplication, listServices } from '@/shared/api/services';
import { usePageTitle } from '@/shared/lib/hooks';
import { wardById } from '@/shared/config/county';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { PayWithMpesa } from '../../components/PayWithMpesa';
import { appTone } from './MyApplications';

export default function ApplicationDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { t, kes, date, locale } = useI18n();
  const q = useQuery({ queryKey: ['application', id], queryFn: () => getApplication(id), refetchInterval: (query) => (query.state.data?.app.status === 'awaiting_payment' ? 8000 : false) });
  const services = useQuery({ queryKey: ['services'], queryFn: listServices, staleTime: 5 * 60_000 });
  const app = q.data?.app;
  const service = services.data?.find((s) => s.id === app?.service_id);
  usePageTitle(app?.reference ?? t('services.app.title'));

  if (q.isLoading) return <div className="mx-auto max-w-2xl space-y-4 px-4 py-12"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-56" /></div>;
  if (!app) return <div className="mx-auto max-w-md px-4 py-24 text-center"><h1 className="font-display text-3xl font-extrabold">{t('services.app.notFound')}</h1><ButtonLink to="/services/applications" className="mt-6">{t('services.app.back')}</ButtonLink></div>;

  const pick = (b?: { en: string; sw?: string }) => (b ? (locale === 'sw' && b.sw ? b.sw : b.en) : '');
  const rows = (service?.form_schema ?? []).map((f) => {
    const raw = app.form_data?.[f.key] ?? '';
    const shown = f.type === 'select' ? pick(f.options?.find((o) => o.value === raw)?.label) || raw : f.type === 'ward' ? (wardById.get(raw)?.name ?? raw) : raw;
    return { label: pick(f.label), value: shown };
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/services/applications" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{t('services.app.back')}</Link>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-muted">{t('services.app.reference')}</p>
      <h1 className="mt-1 break-all font-data text-2xl font-medium tracking-wide">{app.reference}</h1>
      <p className="mt-2 font-display text-xl font-bold">{service ? (locale === 'sw' && service.name_sw ? service.name_sw : service.name) : ''}</p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Chip tone={appTone[app.status]}>{t(`services.app.statuses.${app.status}` as MessageKey)}</Chip>
        <span className="text-sm text-muted">{t('services.app.submitted')} {date(app.created_at)}</span>
      </div>

      {app.decision_note && <div className="mt-6 rounded-2xl bg-info-soft p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-info">{t('services.app.note')}</p><p className="mt-1">{app.decision_note}</p></div>}

      <dl className="mt-6 divide-y divide-line overflow-hidden rounded-[1.5rem] border border-line bg-surface">
        {app.business_name && <div className="flex justify-between gap-4 p-4"><dt className="text-muted">{t('services.apply_.businessName')}</dt><dd className="font-semibold">{app.business_name}</dd></div>}
        {rows.map((r) => <div key={r.label} className="flex justify-between gap-4 p-4"><dt className="text-muted">{r.label}</dt><dd className="max-w-[60%] text-right font-semibold">{r.value || '-'}</dd></div>)}
        <div className="flex justify-between gap-4 p-4"><dt className="text-muted">{t('services.app.amount')}</dt><dd className="font-data font-medium">{app.amount > 0 ? kes(app.amount) : t('services.free')}</dd></div>
        {app.due_at && <div className="flex justify-between gap-4 p-4"><dt className="text-muted">{t('services.app.due')}</dt><dd className="font-semibold">{date(app.due_at)}</dd></div>}
      </dl>

      {q.data && q.data.docs.length > 0 && (
        <section className="mt-8"><h2 className="font-display text-lg font-bold">{t('services.app.docs')}</h2>
          <ul className="mt-3 space-y-2">{q.data.docs.map((d) => <li key={d.id} className="flex items-center gap-2 text-sm"><FileText className="size-4 text-muted" aria-hidden />{t(`services.docs.${d.kind}` as MessageKey)}</li>)}</ul>
        </section>
      )}

      {app.status === 'awaiting_payment' && <div className="mt-8"><PayWithMpesa app={app} onPaid={() => { void qc.invalidateQueries({ queryKey: ['application', id] }); void qc.invalidateQueries({ queryKey: ['applications'] }); }} /></div>}
      {(app.status === 'draft' || app.status === 'changes_requested') && service && <Button className="mt-8" size="lg" onClick={() => nav(`/services/${service.slug}/apply?draft=${app.id}`)}>{t('services.app.continue')}</Button>}
    </div>
  );
}
