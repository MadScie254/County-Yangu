import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, ExternalLink, FileText, Search, ShieldCheck, Smartphone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { listServices } from '@/shared/api/services';
import type { ServiceCategory } from '@/shared/api/services-types';
import { county } from '@/shared/config/county';
import { useAuth } from '@/shared/state/auth';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip } from '@/shared/ui/Chip';
import { Skeleton } from '@/shared/ui/Card';
import { TextInput } from '@/shared/ui/Field';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

export default function Services() {
  const { t, kes, locale } = useI18n();
  usePageTitle(t('services.title'));
  const status = useAuth((s) => s.status);
  const q = useQuery({ queryKey: ['services'], queryFn: listServices, staleTime: 5 * 60_000 });
  const [cat, setCat] = useState<ServiceCategory | 'all'>('all');
  const [term, setTerm] = useState('');
  const list = q.data ?? [];
  const cats = useMemo(() => [...new Set(list.map((s) => s.category))], [list]);
  const shown = useMemo(() => list.filter((s) => (cat === 'all' || s.category === cat) && (!term || norm(`${s.name} ${s.name_sw ?? ''} ${s.description ?? ''}`).includes(norm(term)))), [list, cat, term]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('services.title')}</h1>
          <p className="mt-3 text-[1.05rem] text-ink-2">{t('services.intro')}</p>
        </div>
        <nav className="flex gap-2" aria-label={t('services.title')}>
          <Link to="/services/applications" className="tap inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-bg-2"><FileText className="size-4" aria-hidden />{t('services.myApplications')}</Link>
          {status === 'in' && <Link to="/services/notifications" aria-label={t('services.notifications')} className="tap grid size-11 place-items-center rounded-full border border-line-strong bg-surface hover:bg-bg-2"><Bell className="size-4" aria-hidden /></Link>}
        </nav>
      </header>

      {county.code === 47 && (
        <aside className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-bg-2/60 p-4 text-sm">
          <Smartphone className="size-5 shrink-0 text-brand" aria-hidden />
          <p className="min-w-0 flex-1">{t('services.pay.text')}</p>
          <a href="https://nairobiservices.go.ke" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4">{t('services.pay.link')}<ExternalLink className="size-3.5" aria-hidden /></a>
        </aside>
      )}

      <div className="relative mt-8">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-[1.1rem] -translate-y-1/2 text-muted" />
        <TextInput aria-label={t('services.search')} placeholder={t('services.search')} value={term} onChange={(e) => setTerm(e.target.value)} className="rounded-full pl-11" />
      </div>
      <div role="radiogroup" aria-label={t('services.title')} className="mt-4 flex flex-wrap gap-2">
        {(['all', ...cats] as const).map((c) => (
          <button key={c} type="button" role="radio" aria-checked={cat === c} onClick={() => setCat(c)} className={cn('tap rounded-full border px-4 text-sm font-semibold transition', cat === c ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-line-strong')}>
            {c === 'all' ? t('services.all') : t(`services.categories.${c}` as MessageKey)}
          </button>
        ))}
      </div>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {q.isLoading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}
        {shown.map((s) => (
          <li key={s.id}>
            <Link to={`/services/${s.slug}/apply`} className="group flex h-full flex-col rounded-[1.5rem] border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
              <div className="flex items-start justify-between gap-2">
                <Chip tone="brand">{t(`services.categories.${s.category}` as MessageKey)}</Chip>
                {s.requires_kra_pin && <Chip tone="info"><ShieldCheck className="size-3.5" aria-hidden />{t('services.needsPin')}</Chip>}
              </div>
              <h2 className="mt-3 font-display text-xl font-bold leading-snug">{locale === 'sw' && s.name_sw ? s.name_sw : s.name}</h2>
              {s.description && <p className="mt-1.5 flex-1 text-sm text-ink-2">{s.description}</p>}
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <div>
                  <p className="font-data text-lg font-medium">{s.fee > 0 ? kes(s.fee) : t('services.free')}</p>
                  <p className="text-xs text-muted">{t('services.sla', { days: s.sla_working_days })}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold">{t('services.apply')} <ArrowRight className="size-4 transition group-hover:translate-x-1" aria-hidden /></span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {q.isSuccess && shown.length === 0 && <p className="mt-8 text-center text-muted">{t('services.noResults')}</p>}
    </div>
  );
}
