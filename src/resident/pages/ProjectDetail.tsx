import { FollowButton } from '@/shared/ui/FollowButton';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Circle, Megaphone, Share2, TriangleAlert, Hammer } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useProjects } from '@/shared/api/hooks';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip, projectTone } from '@/shared/ui/Chip';
import { Meter } from '@/shared/ui/Meter';
import { Skeleton } from '@/shared/ui/Card';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { isOverBudget, milestoneProgress, projectPhotoUrl, spentPct } from '../lib/projects';

export default function ProjectDetail() {
  const { slug } = useParams();
  const { t, kes, date } = useI18n();
  const projects = useProjects();
  const p = projects.data?.find((x) => x.slug === slug);
  usePageTitle(p?.title ?? t('projects.title'));

  if (projects.isLoading) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-10"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-52" /><Skeleton className="h-64" /></div>;
  if (!p) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-extrabold">{t('errors.notFoundTitle')}</h1>
        <ButtonLink to="/projects" className="mt-8">{t('projects.title')}</ButtonLink>
      </div>
    );
  }

  const ms = milestoneProgress(p);
  const over = isOverBudget(p);
  const share = async () => {
    const url = location.href;
    if (navigator.share) await navigator.share({ title: p.title, url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url);
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> {t('projects.back')}</Link>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={projectTone(p.status)}>{t(`projectStatus.${p.status}`)}</Chip>
          <span className="text-sm font-semibold text-muted">{p.ward_name} · {p.sector}</span>
        </div>
        <h1 className="mt-3 font-display text-[clamp(1.9rem,5.5vw,2.8rem)] font-extrabold leading-[1.05]">{p.title}</h1>
        <div className="mt-4"><FollowButton kind="project" id={p.id} label={p.title} /></div>
        {p.description && <p className="mt-4 text-[1.05rem] text-ink-2">{p.description}</p>}
      </header>

      <section aria-labelledby="money" className="mt-8 rounded-[1.75rem] border border-line bg-surface p-6 shadow-card">
        <h2 id="money" className="sr-only">{t('common.budget')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{t('common.budget')}</p>
            <p className="mt-1 font-data text-2xl font-medium">{kes(p.budget)}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{t('common.spent')}</p>
            <p className={cn('mt-1 font-data text-2xl font-medium', over && 'text-bad')}>{kes(p.spent)}</p>
          </div>
        </div>
        <Meter value={p.spent} max={p.budget} label={`${t('common.spent')}: ${spentPct(p)}%`} tone={over ? 'bad' : p.status === 'completed' ? 'good' : 'brand'} className="mt-5 !h-3.5" />
        <div className="mt-2 flex justify-between text-sm">
          <span className="font-semibold">{spentPct(p)}%</span>
          {over && <span className="inline-flex items-center gap-1 font-bold text-bad"><TriangleAlert className="size-4" aria-hidden />{t('projects.overBudget')}</span>}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 text-sm sm:grid-cols-3">
          <div><dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{t('common.contractor')}</dt><dd className="mt-0.5 font-semibold">{p.contractor ?? t('projects.notAwarded')}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{t('projects.started')}</dt><dd className="mt-0.5 font-semibold">{p.started_at ? date(p.started_at) : '-'}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{p.completed_at ? t('projects.completed') : t('projects.expected')}</dt><dd className="mt-0.5 font-semibold">{p.completed_at ? date(p.completed_at) : p.expected_at ? date(p.expected_at) : '-'}</dd></div>
        </dl>
      </section>

      {p.milestones.length > 0 && (
        <section aria-labelledby="ms" className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 id="ms" className="font-display text-xl font-bold">{t('projects.milestones')}</h2>
            <span className="text-sm font-semibold text-muted">{ms.done}/{ms.total}</span>
          </div>
          <ol className="mt-5 space-y-5 border-l-2 border-line pl-6">
            {p.milestones.map((m) => (
              <li key={m.title} className="relative">
                <span className={cn('absolute -left-[2.1rem] grid size-7 place-items-center rounded-full border-4 border-bg', m.done ? 'bg-good text-bg' : 'bg-bg-2 text-muted')}>
                  {m.done ? <Check className="size-3.5" aria-hidden strokeWidth={3} /> : <Circle className="size-2.5" aria-hidden />}
                </span>
                <p className={cn('font-semibold', !m.done && 'text-ink-2')}>{m.title}</p>
                {m.due && <p className="text-sm text-muted">{m.done ? t('projects.done') : t('projects.due')} · {date(m.due)}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {p.photos.length > 0 && (
        <section aria-labelledby="ph" className="mt-10">
          <h2 id="ph" className="font-display text-xl font-bold">{t('projects.photos')}</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {p.photos.map((ph) => (
              <li key={ph.path}><img src={projectPhotoUrl(ph.path)} alt={ph.caption ?? ''} loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover" /></li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-col gap-3 rounded-[1.75rem] bg-brand-soft p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-bold"><Hammer className="size-5" aria-hidden />{t('projects.seenSomething')}</p>
          <p className="mt-1 text-sm text-ink-2">{t('projects.seenSomethingBody')}</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink to={`/report?ward=${p.ward_id}&category=abandoned`} icon={<Megaphone className="size-4" aria-hidden />}>{t('nav.report')}</ButtonLink>
          <Button variant="secondary" onClick={share} icon={<Share2 className="size-4" aria-hidden />}>{t('common.share')}</Button>
        </div>
      </div>
    </article>
  );
}
