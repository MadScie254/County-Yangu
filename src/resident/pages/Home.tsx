import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Megaphone, FolderKanban, Vote, ShieldCheck, Smartphone, Route, Eye, Wrench, Radio } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { county, wards } from '@/shared/config/county';
import { useCountySummary, useProjects, useWardStats } from '@/shared/api/hooks';
import { CountyMap, type CountyMapHandle, type MapSelection } from '@/shared/map/CountyMap';
import { useWardGeometry } from '@/shared/map/useGeometry';
import { MapLegend } from '@/shared/map/MapLegend';
import { aggregateBySubCounty } from '@/shared/map/aggregate';
import { inBbox, nearestSubCounty, wardAtPoint } from '@/shared/map/geo';
import type { Metric } from '@/shared/map/palette';
import { ButtonLink } from '@/shared/ui/Button';
import { Segmented } from '@/shared/ui/Field';
import { Stat, Skeleton, SectionTitle } from '@/shared/ui/Card';
import { cn } from '@/shared/lib/utils';
import { Meter } from '@/shared/ui/Meter';
import { Chip, projectTone } from '@/shared/ui/Chip';
import { toast } from '@/shared/ui/Toast';
import { useMediaQuery, usePageTitle } from '@/shared/lib/hooks';
import { WardSearch } from '../components/WardSearch';
import { WardCard } from '../components/WardCard';

function Kpis({ className }: { className?: string }) {
  const { t, number } = useI18n();
  const summary = useCountySummary();
  return (
    <dl className={cn('grid-cols-3 gap-3', className)}>
      {summary.isLoading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)
      ) : (
        <>
          <Stat label={t('home.openIssues')} value={summary.data ? number(Math.max(0, summary.data.reports_filed - summary.data.reports_resolved)) : '–'} />
          <Stat label={t('home.resolved')} value={summary.data ? number(summary.data.reports_resolved) : '–'} tone="good" />
          <Stat label={t('home.overdue')} value={summary.data ? number(summary.data.reports_overdue) : '–'} tone={summary.data && summary.data.reports_overdue > 0 ? 'bad' : undefined} />
        </>
      )}
    </dl>
  );
}

export default function Home() {
  const { t, kes } = useI18n();
  usePageTitle('');
  const desktop = useMediaQuery('(min-width: 768px)');
  const stats = useWardStats();
  const geometry = useWardGeometry();
  const projects = useProjects();

  const [metric, setMetric] = useState<Metric>('open');
  const [selection, setSelection] = useState<MapSelection>(null);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<CountyMapHandle>(null);

  const subStats = useMemo(() => aggregateBySubCounty(stats.data), [stats.data]);
  const hasPolys = Boolean(geometry.data);

  const locate = async () => {
    setLocating(true);
    const p = await mapRef.current?.locate();
    setLocating(false);
    if (!p) return toast({ tone: 'bad', title: t('errors.generic') });
    if (!inBbox(p, county.bbox, 0.02)) return toast({ tone: 'info', title: t('map.outsideCounty', { county: county.name }) });
    const w = wardAtPoint(geometry.data ?? null, p);
    if (w) setSelection({ type: 'ward', id: w });
    else {
      const sc = nearestSubCounty(p);
      if (sc) setSelection({ type: 'subcounty', id: sc.id });
    }
  };

  const legendLow = metric === 'trust' ? t('home.legendLow') : t('home.legendFew');
  const legendHigh = metric === 'trust' ? t('home.legendHigh') : t('home.legendMore');

  const topProjects = (projects.data ?? []).filter((p) => p.status === 'in_progress' || p.status === 'completed').slice(0, 4);

  return (
    <>
      {/* ---------- Hero: the county as a real map ---------- */}
      <section aria-labelledby="hero-title" className="relative md:h-[min(88dvh,900px)] md:min-h-[640px]">
        <div className="relative z-10 px-4 pb-4 pt-6 sm:px-6 md:pointer-events-none md:absolute md:inset-y-0 md:left-0 md:w-[30rem] md:px-8 md:pb-8 md:pt-10">
          <div className="md:pointer-events-auto md:glass md:rounded-[2rem] md:border md:border-line/70 md:p-7 md:shadow-pop">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-ink">
              <Radio className="size-3.5 text-brand-strong" aria-hidden /> {t('home.eyebrow', { county: county.name, wards: wards.length })}
            </p>
            <h1 id="hero-title" className="font-display text-[clamp(2rem,7vw,3.4rem)] font-extrabold leading-[0.98]">
              {t('home.title')}
            </h1>
            <p className="mt-3 hidden text-[1.05rem] text-ink-2 sm:block">{t('home.intro')}</p>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row md:flex-col">
              <ButtonLink to="/report" size="lg" icon={<Megaphone className="size-5" aria-hidden />} iconRight={<ArrowRight className="size-5" aria-hidden />} className="justify-between sm:flex-1 md:flex-none">
                {t('home.reportCta')}
              </ButtonLink>
              <div className="grid grid-cols-2 gap-2.5 sm:flex-1 md:flex-none">
                <ButtonLink to="/projects" variant="secondary" icon={<FolderKanban className="size-4" aria-hidden />}>
                  {t('home.trackCta')}
                </ButtonLink>
                <ButtonLink to="/vote" variant="soft" icon={<Vote className="size-4" aria-hidden />}>
                  {t('home.voteCta')}
                </ButtonLink>
              </div>
            </div>

            <div className="mt-4 md:mt-6">
              <WardSearch onPick={(id) => setSelection({ type: 'ward', id })} onLocate={locate} locating={locating} />
            </div>

            <Kpis className="mt-6 hidden border-t border-line pt-5 md:grid" />
          </div>
        </div>

        <div className="relative h-[68dvh] min-h-[440px] overflow-hidden md:absolute md:inset-0 md:h-auto">
          <CountyMap
            ref={mapRef}
            className="absolute inset-0"
            ariaLabel={`${county.name} County map. Use the ward search for a keyboard-friendly alternative.`}
            metric={metric}
            stats={stats.data}
            geometry={geometry.data ?? null}
            projects={undefined}
            selection={selection}
            onSelect={setSelection}
            padding={desktop ? { top: 40, right: 40, bottom: 40, left: 500 } : { top: 70, right: 16, bottom: selection ? 300 : 30, left: 16 }}
            labels={{ zoomIn: t('map.zoomIn'), zoomOut: t('map.zoomOut'), recenter: t('map.recenter'), locate: t('map.locate'), attribution: t('map.attribution'), issues: (n) => t('map.issues', { count: n }) }}
            fallback={<Link to="/report" className="font-semibold underline">{t('home.reportCta')}</Link>}
          />

          {/* metric switch + legend */}
          <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col items-start gap-2 md:inset-x-auto md:right-4 md:top-4 md:items-end">
            <Segmented<Metric>
              label={t('home.mapMetric')}
              value={metric}
              onChange={setMetric}
              className="pointer-events-auto glass shadow-float"
              options={[
                { value: 'open', label: t('home.metricOpen') },
                { value: 'overdue', label: t('home.metricOverdue') },
                { value: 'trust', label: t('home.metricTrust') },
              ]}
            />
            <div className="pointer-events-auto glass hidden rounded-full px-4 py-2 shadow-float sm:block">
              <MapLegend metric={metric} low={legendLow} high={legendHigh} noData={t('home.noData')} />
            </div>
          </div>

          {!hasPolys && !geometry.isLoading && <p className="pointer-events-none absolute bottom-9 left-3 hidden max-w-xs rounded-xl bg-surface/90 px-3 py-2 text-[0.7rem] text-muted shadow-card md:block md:left-[31rem]">{t('map.boundariesNote')}</p>}

          {selection && stats.data && (
            <div className="absolute inset-x-3 bottom-3 z-20 max-h-[62%] md:inset-x-auto md:bottom-6 md:right-6 md:max-h-[calc(100%-9rem)] md:w-[22rem]">
              <WardCard selection={selection} stats={stats.data} subStats={subStats} onSelect={setSelection} onClose={() => setSelection(null)} />
            </div>
          )}
        </div>
      </section>

      <Kpis className="mx-auto grid max-w-7xl px-4 py-6 sm:px-6 md:hidden" />

      {/* ---------- The accountability loop ---------- */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionTitle title={t('home.loopTitle')} intro={t('home.loopBody')} />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Megaphone, k: 'report' as const },
              { icon: Route, k: 'route' as const },
              { icon: Wrench, k: 'fix' as const },
              { icon: Eye, k: 'see' as const },
            ].map(({ icon: Icon, k }, i) => (
              <li key={k} className="relative rounded-[1.5rem] border border-line bg-bg p-5">
                <span className="font-display text-5xl font-extrabold text-brand/70">{i + 1}</span>
                <Icon className="mt-4 size-6 text-ink" aria-hidden />
                <p className="mt-2 font-display text-lg font-bold leading-tight">{t(`home.steps.${k}`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Follow the shilling ---------- */}
      {topProjects.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionTitle title={t('home.moneyTitle')} intro={t('home.moneyBody')} />
            <ButtonLink to="/projects" variant="secondary" iconRight={<ArrowRight className="size-4" aria-hidden />}>
              {t('common.viewAll')}
            </ButtonLink>
          </div>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {topProjects.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.slug}`} className="block rounded-[1.5rem] border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{p.ward_name} · {p.sector}</p>
                      <h3 className="mt-1 font-display text-xl font-bold leading-snug">{p.title}</h3>
                    </div>
                    <Chip tone={projectTone(p.status)}>{t(`projectStatus.${p.status}`)}</Chip>
                  </div>
                  <Meter value={p.spent} max={p.budget} label={`${t('common.spent')}: ${kes(p.spent)}`} tone={p.status === 'stalled' ? 'bad' : 'brand'} className="mt-5" />
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-muted">
                      {t('common.spent')} <b className="font-data text-ink">{kes(p.spent, { compact: true })}</b>
                    </span>
                    <span className="text-muted">
                      {t('common.budget')} <b className="font-data text-ink">{kes(p.budget, { compact: true })}</b>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Feature phones + privacy ---------- */}
      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-20 sm:px-6 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink p-8 text-bg sm:p-10">
          <div aria-hidden className="paper-grain absolute inset-0 opacity-30" />
          <Smartphone className="relative size-8 text-brand" aria-hidden />
          <h2 className="relative mt-5 font-display text-3xl font-extrabold">{t('home.phoneTitle')}</h2>
          <p className="relative mt-3 max-w-md text-bg/80">{t('home.phoneBody', { code: county.ussdCode })}</p>
          <p className="relative mt-7 inline-flex items-baseline gap-3 rounded-2xl bg-bg/10 px-5 py-3 ring-1 ring-bg/20">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-bg/70">{t('home.dialLabel')}</span>
            <span className="font-data text-3xl font-medium text-brand">{county.ussdCode}</span>
          </p>
        </div>
        <div className="rounded-[2rem] border border-line bg-surface p-8 sm:p-10">
          <ShieldCheck className="size-8 text-good" aria-hidden />
          <h2 className="mt-5 font-display text-3xl font-extrabold">{t('home.trustTitle')}</h2>
          <p className="mt-3 max-w-md text-ink-2">{t('home.trustBody')}</p>
          <Link to="/how-it-works#privacy" className="mt-6 inline-flex items-center gap-2 font-semibold underline decoration-brand decoration-2 underline-offset-4">
            {t('footer.privacy')} <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
