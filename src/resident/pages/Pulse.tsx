import { useMemo, useState } from 'react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { useCountySummary, useIsDemo, useProjects, usePulse, useWardStats } from '@/shared/api/hooks';
import { usePageTitle } from '@/shared/lib/hooks';
import { aggregateBySubCounty } from '@/shared/map/aggregate';
import { LineChart } from '@/shared/charts/LineChart';
import { BarList } from '@/shared/charts/BarList';
import { StackedBar } from '@/shared/charts/StackedBar';
import { Sparkline } from '@/shared/charts/Sparkline';
import { ChartCard, Legend } from '@/shared/charts/ChartCard';
import { Segmented } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { Ring } from '@/shared/ui/Meter';
import { cn } from '@/shared/lib/utils';
import { countyTrust, sectorMoney, trustLeague, weekLabel } from '../lib/pulse';

const channelOrder = ['web', 'ussd', 'sms', 'ivr', 'voice'] as const;
const channelColor = { web: 'var(--series-1)', ussd: 'var(--series-2)', sms: 'var(--series-3)', ivr: 'var(--series-4)', voice: 'var(--series-5)' };

function Tile({ label, value, hint, trend, tone, trendLabel }: { label: string; value: string; hint?: string; trend?: number[]; tone?: 'bad' | 'good'; trendLabel?: string }) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-surface p-5 shadow-card">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className={cn('font-display text-[2rem] font-extrabold leading-none tracking-tight', tone === 'bad' && 'text-bad', tone === 'good' && 'text-good')}>{value}</p>
        {trend && <Sparkline values={trend} label={trendLabel ?? label} color={tone === 'bad' ? 'var(--bad)' : 'var(--series-1)'} />}
      </div>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function Pulse() {
  const { t, number, compact, locale, kes } = useI18n();
  usePageTitle(t('pulse.title'));
  const stats = useWardStats();
  const summary = useCountySummary();
  const pulse = usePulse();
  const projects = useProjects();
  const demo = useIsDemo();
  const [league, setLeague] = useState<'low' | 'high'>('low');
  const intl = locale === 'sw' ? 'sw-KE' : 'en-KE';

  const trust = useMemo(() => countyTrust(stats.data ?? []), [stats.data]);
  const leagueRows = useMemo(() => trustLeague(stats.data ?? [], league), [stats.data, league]);
  const subs = useMemo(() => aggregateBySubCounty(stats.data).sort((a, b) => b.open - a.open), [stats.data]);
  const sectors = useMemo(() => sectorMoney(projects.data ?? []), [projects.data]);
  const p = pulse.data;
  const filedTrend = p?.weekly.map((w) => w.filed) ?? [];
  const fixedTrend = p?.weekly.map((w) => w.resolved) ?? [];
  const filed90 = filedTrend.slice(-12).reduce((a, b) => a + b, 0);
  const catTotal = p?.by_category.reduce((a, c) => a + c.total, 0) ?? 0;
  const channelTotal = p ? Object.values(p.by_channel).reduce((a, b) => a + b, 0) : 0;
  const tableLabels = { chart: t('pulse.viewChart'), table: t('pulse.viewTable') };
  const loading = stats.isLoading || pulse.isLoading;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="grid items-end gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="max-w-2xl">
          <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('pulse.title')}</h1>
          <p className="mt-3 text-[1.05rem] text-ink-2">{t('pulse.intro')}</p>
          {demo && <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm font-medium text-warn">{t('pulse.demoNote')}</p>}
        </div>
        {/* the one hero figure */}
        <div className="flex items-center gap-6 rounded-[1.75rem] border border-line bg-surface p-6 shadow-card">
          <Ring value={(trust.value ?? 0) / 100} size={116} stroke={12} tone={trust.value == null ? 'brand' : trust.value >= 65 ? 'good' : trust.value >= 45 ? 'warn' : 'bad'} label={`${t('pulse.trustHero')}: ${trust.value ?? t('pulse.noData')}`}>
            <span className="font-display text-[2.6rem] font-extrabold leading-none">{trust.value == null ? '–' : Math.round(trust.value)}</span>
          </Ring>
          <div>
            <p className="font-display text-xl font-bold leading-tight">{t('pulse.trustHero')}</p>
            <p className="mt-1 text-sm text-muted">{t('pulse.wardsScored', { count: trust.scored })}</p>
            <p className="mt-2 text-xs text-muted">{t('pulse.trustFormula')}</p>
          </div>
        </div>
      </header>

      <section aria-label={t('pulse.title')} className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {loading ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />) : (
          <>
            <Tile label={t('pulse.filed')} value={compact(filed90 || summary.data?.reports_filed || 0)} trend={filedTrend} />
            <Tile label={t('pulse.fixed')} value={compact(summary.data?.reports_resolved ?? 0)} trend={fixedTrend} tone="good" />
            <Tile label={t('pulse.overdue')} value={number(summary.data?.reports_overdue ?? 0)} tone={summary.data && summary.data.reports_overdue > 0 ? 'bad' : undefined} />
            <Tile label={t('pulse.medianAck')} value={p?.median_ack_hours != null ? t('pulse.hours', { n: number(p.median_ack_hours) }) : '–'} hint={p?.median_ack_hours == null ? t('pulse.noData') : undefined} />
            <Tile label={t('pulse.medianFix')} value={p?.median_resolve_days != null ? t('pulse.days', { n: number(p.median_resolve_days) }) : '–'} hint={p?.median_resolve_days == null ? t('pulse.noData') : undefined} />
          </>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {p && (
          <ChartCard className="lg:col-span-2" title={t('pulse.trendTitle')} subtitle={t('pulse.trendSub')} chartLabel={tableLabels.chart} tableLabel={tableLabels.table}
            legend={<Legend items={[{ label: t('pulse.filedSeries'), color: 'var(--series-1)', value: number(filedTrend.at(-1) ?? 0) }, { label: t('pulse.fixedSeries'), color: 'var(--series-3)', value: number(fixedTrend.at(-1) ?? 0) }]} />}
            table={{ head: [t('pulse.week'), t('pulse.filedSeries'), t('pulse.fixedSeries')], rows: p.weekly.map((w) => [weekLabel(w.week, intl), number(w.filed), number(w.resolved)]) }}>
            <LineChart ariaLabel={t('pulse.trendTitle')} labels={p.weekly.map((w) => weekLabel(w.week, intl))} format={(n) => number(n)}
              series={[{ key: 'filed', label: t('pulse.filedSeries'), color: 'var(--series-1)', values: filedTrend, area: true }, { key: 'fixed', label: t('pulse.fixedSeries'), color: 'var(--series-3)', values: fixedTrend }]} />
          </ChartCard>
        )}

        {stats.data && (
          <ChartCard title={t('pulse.leagueTitle')} subtitle={t('pulse.leagueSub')} chartLabel={tableLabels.chart} tableLabel={tableLabels.table}
            legend={<Segmented<'low' | 'high'> label={t('pulse.leagueTitle')} value={league} onChange={setLeague} options={[{ value: 'low', label: t('pulse.needsAttention') }, { value: 'high', label: t('pulse.leading') }]} />}
            table={{ head: [t('pulse.ward'), t('pulse.leagueTitle')], rows: trustLeague(stats.data, league, 85).map((s) => [s.name, s.trust_index ?? '–']) }}>
            <BarList ariaLabel={t('pulse.leagueTitle')} max={100} rows={leagueRows.map((s) => ({ key: s.ward_id, label: s.name, segments: [{ value: s.trust_index ?? 0, color: 'var(--series-1)', label: t('pulse.leagueTitle') }] }))} format={(n) => String(Math.round(n))} />
          </ChartCard>
        )}

        {stats.data && (
          <ChartCard title={t('pulse.subCountyTitle')} subtitle={t('pulse.subCountySub')} chartLabel={tableLabels.chart} tableLabel={tableLabels.table}
            legend={<Legend items={[{ label: t('pulse.open'), color: 'var(--series-1)' }, { label: t('pulse.overdueSeries'), color: 'var(--bad)' }]} />}
            table={{ head: [t('pulse.subCounty'), t('pulse.open'), t('pulse.overdueSeries')], rows: subs.map((s) => [s.name, s.open, s.overdue]) }}>
            <BarList ariaLabel={t('pulse.subCountyTitle')} rows={subs.map((s) => ({ key: s.id, label: s.name, segments: [{ value: Math.max(0, s.open - s.overdue), color: 'var(--series-1)', label: t('pulse.open') }, { value: s.overdue, color: 'var(--bad)', label: t('pulse.overdueSeries') }] }))} format={(n) => number(n)} />
          </ChartCard>
        )}

        {p && (
          <ChartCard title={t('pulse.categoryTitle')} subtitle={t('pulse.categorySub')} chartLabel={tableLabels.chart} tableLabel={tableLabels.table}
            table={{ head: [t('report.category'), t('pulse.count'), t('pulse.share')], rows: p.by_category.map((c) => [t(`categories.${c.category_id}` as MessageKey), number(c.total), `${Math.round((c.total / (catTotal || 1)) * 100)}%`]) }}>
            <BarList ariaLabel={t('pulse.categoryTitle')} labelWidth={210} rows={p.by_category.slice(0, 10).map((c) => ({ key: c.category_id, label: t(`categories.${c.category_id}` as MessageKey), segments: [{ value: c.total, color: 'var(--series-1)', label: t('pulse.count') }] }))} format={(n) => number(n)} />
          </ChartCard>
        )}

        {p && (
          <ChartCard title={t('pulse.channelTitle')} subtitle={t('pulse.channelSub')} chartLabel={tableLabels.chart} tableLabel={tableLabels.table}
            legend={<Legend items={channelOrder.filter((c) => (p.by_channel[c] ?? 0) > 0).map((c) => ({ label: t(`pulse.channels.${c}`), color: channelColor[c], value: `${Math.round(((p.by_channel[c] ?? 0) / (channelTotal || 1)) * 100)}%` }))} />}
            table={{ head: [t('common.channel'), t('pulse.count'), t('pulse.share')], rows: channelOrder.map((c) => [t(`pulse.channels.${c}`), number(p.by_channel[c] ?? 0), `${Math.round(((p.by_channel[c] ?? 0) / (channelTotal || 1)) * 100)}%`]) }}>
            <div className="py-6">
              <StackedBar ariaLabel={t('pulse.channelTitle')} parts={channelOrder.map((c) => ({ key: c, label: t(`pulse.channels.${c}`), value: p.by_channel[c] ?? 0, color: channelColor[c] }))} />
            </div>
          </ChartCard>
        )}

        {sectors.length > 0 && (
          <ChartCard className="lg:col-span-2" title={t('pulse.sectorTitle')} subtitle={t('pulse.sectorSub')} chartLabel={tableLabels.chart} tableLabel={tableLabels.table}
            legend={<Legend items={[{ label: t('pulse.spentSeries'), color: 'var(--series-1)' }, { label: t('pulse.remainingSeries'), color: 'var(--seq-soft)' }, { label: t('pulse.overSeries'), color: 'var(--bad)' }]} />}
            table={{ head: [t('projects.sector'), t('pulse.spentSeries'), t('pulse.remainingSeries'), t('pulse.overSeries')], rows: sectors.map((s) => [s.sector, kes(s.spent), kes(s.remaining), kes(s.over)]) }}>
            <BarList ariaLabel={t('pulse.sectorTitle')} labelWidth={110} rows={sectors.map((s) => ({ key: s.sector, label: s.sector, segments: [{ value: s.spent, color: 'var(--series-1)', label: t('pulse.spentSeries') }, { value: s.over, color: 'var(--bad)', label: t('pulse.overSeries') }, { value: s.remaining, color: 'var(--seq-soft)', label: t('pulse.remainingSeries') }] }))} format={(n) => kes(n, { compact: true })} />
          </ChartCard>
        )}
      </div>
      <p className="mt-8 text-center text-xs text-muted">{t('pulse.updated')}</p>
    </div>
  );
}
