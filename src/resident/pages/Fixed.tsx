import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { useFixedGallery, useIsDemo } from '@/shared/api/hooks';
import { usePageTitle } from '@/shared/lib/hooks';
import { Skeleton } from '@/shared/ui/Card';
import { BeforeAfter } from '../components/BeforeAfter';

/** Proof of work: resolved cases with the photo staff took after fixing them. */
export default function Fixed() {
  const { t, date } = useI18n();
  const q = useFixedGallery(48);
  const demo = useIsDemo();
  usePageTitle(t('fixed.title'));
  const list = q.data ?? [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('fixed.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('fixed.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}
      {q.isLoading ? <Skeleton className="mt-8 h-72" /> : list.length === 0 ? <p className="mt-8 rounded-2xl bg-bg-2 p-5 text-sm">{t('fixed.none')}</p> : (
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {list.map((f) => (
            <li key={f.reference} className="rounded-[1.5rem] border border-line bg-surface p-4 shadow-card">
              <BeforeAfter before={f.before} after={f.after} compact />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{t(`categories.${f.category_id}` as MessageKey)} · {f.ward}</p>
                <Link to={`/case/${f.reference}`} className="font-data text-xs text-muted underline-offset-4 hover:underline">{f.reference}</Link>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-good"><CheckCircle2 className="size-4" aria-hidden />{t('fixed.when', { reported: date(f.reported_at, { dateStyle: 'medium' }), fixed: date(f.resolved_at, { dateStyle: 'medium' }) })}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
