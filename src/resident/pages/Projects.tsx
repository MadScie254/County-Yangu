import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, TriangleAlert } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wards } from '@/shared/config/county';
import { useProjects } from '@/shared/api/hooks';
import type { ProjectStatus } from '@/shared/api/types';
import { LazyCountyMap as CountyMap } from '@/shared/map/LazyCountyMap';
import { useWardGeometry } from '@/shared/map/useGeometry';
import { projectColors } from '@/shared/map/palette';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip, projectTone } from '@/shared/ui/Chip';
import { Meter } from '@/shared/ui/Meter';
import { Skeleton } from '@/shared/ui/Card';
import { Segmented, SelectInput, TextInput } from '@/shared/ui/Field';
import { filterProjects, isOverBudget, spendUnknown, type ProjectFilters } from '../lib/projects';

const statuses: (ProjectStatus | 'all')[] = ['all', 'in_progress', 'procurement', 'planned', 'stalled', 'completed'];

export default function Projects() {
  const { t, kes } = useI18n();
  usePageTitle(t('projects.title'));
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const projects = useProjects();
  const geometry = useWardGeometry();
  const [view, setView] = useState<'list' | 'map'>('list');
  const [active, setActive] = useState<string | null>(null);

  const filters: ProjectFilters = {
    q: params.get('q') ?? '',
    status: (params.get('status') as ProjectStatus | null) ?? 'all',
    sector: params.get('sector') ?? 'all',
    ward: params.get('ward') ?? 'all',
  };
  const set = (k: keyof ProjectFilters, v: string) => {
    const next = new URLSearchParams(params);
    if (!v || v === 'all') next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const all = projects.data ?? [];
  const sectors = useMemo(() => [...new Set(all.map((p) => p.sector))].sort(), [all]);
  const shown = useMemo(() => filterProjects(all, filters), [all, filters.q, filters.status, filters.sector, filters.ward]); // eslint-disable-line react-hooks/exhaustive-deps
  const totals = useMemo(() => ({ budget: shown.reduce((a, p) => a + p.budget, 0), spent: shown.reduce((a, p) => a + p.spent, 0) }), [shown]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('projects.title')}</h1>
          <p className="mt-3 text-[1.05rem] text-ink-2">{t('projects.intro')}</p>
        </div>
        <div className="lg:hidden">
          <Segmented<'list' | 'map'> label={t('projects.view')} value={view} onChange={setView} options={[{ value: 'list', label: t('projects.list') }, { value: 'map', label: t('projects.map') }]} />
        </div>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-[1.1rem] -translate-y-1/2 text-muted" />
          <TextInput aria-label={t('projects.search')} placeholder={t('projects.search')} value={filters.q} onChange={(e) => set('q', e.target.value)} className="rounded-full pl-11" />
        </div>
        <SelectInput aria-label={t('common.ward')} value={filters.ward} onChange={(e) => set('ward', e.target.value)} className="rounded-full">
          <option value="all">{t('common.ward')}: {t('common.all')}</option>
          {[...wards].sort((a, b) => a.name.localeCompare(b.name)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </SelectInput>
        <SelectInput aria-label={t('projects.sector')} value={filters.sector} onChange={(e) => set('sector', e.target.value)} className="rounded-full">
          <option value="all">{t('projects.sector')}: {t('common.all')}</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectInput>
        <SelectInput aria-label={t('common.status')} value={filters.status} onChange={(e) => set('status', e.target.value)} className="rounded-full">
          {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? `${t('common.status')}: ${t('common.all')}` : t(`projectStatus.${s}`)}</option>)}
        </SelectInput>
      </div>

      <p className="mt-4 text-sm text-muted" aria-live="polite">
        {t('projects.count', { count: shown.length })} · {t('common.budget')} <b className="font-data text-ink">{kes(totals.budget, { compact: true })}</b> · {t('common.spent')} <b className="font-data text-ink">{kes(totals.spent, { compact: true })}</b>
      </p>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className={cn(view === 'map' && 'hidden lg:block')}>
          {projects.isLoading ? (
            <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
          ) : shown.length === 0 ? (
            <p className="rounded-[1.5rem] border border-dashed border-line-strong p-10 text-center text-muted">{t('projects.none')}</p>
          ) : (
            <ul className="space-y-3">
              {shown.map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.slug}`}
                    onMouseEnter={() => setActive(p.slug)}
                    onMouseLeave={() => setActive(null)}
                    className={cn('block rounded-[1.5rem] border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-float', active === p.slug ? 'border-ink' : 'border-line')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{p.ward_name} · {p.sector}</p>
                        <h2 className="mt-1 font-display text-lg font-bold leading-snug">{p.title}</h2>
                      </div>
                      <Chip tone={projectTone(p.status)} className="shrink-0">{t(`projectStatus.${p.status}`)}</Chip>
                    </div>
                    <Meter value={p.spent} max={p.budget} label={`${t('common.spent')}: ${kes(p.spent)}`} tone={isOverBudget(p) || p.status === 'stalled' ? 'bad' : p.status === 'completed' ? 'good' : 'brand'} className="mt-4" />
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-muted">{t('common.spent')} <b className="font-data text-ink">{spendUnknown(p) ? t('projects.spendUnknown') : kes(p.spent, { compact: true })}</b></span>
                      {isOverBudget(p) && <span className="inline-flex items-center gap-1 text-xs font-bold text-bad"><TriangleAlert className="size-3.5" aria-hidden />{t('projects.overBudget')}</span>}
                      <span className="text-muted">{t('common.budget')} <b className="font-data text-ink">{kes(p.budget, { compact: true })}</b></span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn('lg:sticky lg:top-24 lg:block lg:self-start', view === 'list' && 'hidden')}>
          <div className="relative h-[70dvh] min-h-[420px] overflow-hidden rounded-[1.75rem] border border-line shadow-card lg:h-[calc(100dvh-8rem)]">
            {view === 'map' || typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches ? (
              <CountyMap
                className="absolute inset-0"
                ariaLabel={t('projects.mapLabel')}
                geometry={geometry.data ?? null}
                showBubbles={false}
                projects={shown}
                fitToProjects
                onSelectProject={(slug) => nav(`/projects/${slug}`)}
                padding={{ top: 20, right: 20, bottom: 50, left: 20 }}
                labels={{ zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), recenter: t('map.recenter'), locate: t('map.locate'), attribution: t('map.attribution'), issues: (n) => t('map.issues', { count: n }) }}
              />
            ) : null}
            <ul className="glass pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1 rounded-2xl px-3 py-2 text-[0.72rem] font-semibold shadow-float">
              {(['in_progress', 'completed', 'stalled', 'procurement', 'planned'] as ProjectStatus[]).map((s) => (
                <li key={s} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full ring-2 ring-white" style={{ background: projectColors[s] }} />
                  {t(`projectStatus.${s}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
