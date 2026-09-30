import { useMemo, useState } from 'react';
import { AlertOctagon, Download, Eye, Info, Scale, ShieldQuestion } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { useProcurementWatch, useProjects, useTenders } from '@/shared/api/hooks';
import type { FlagSeverity, FlagStatus, ProcurementFlag } from '@/shared/api/types';
import { downloadCsv } from '@/shared/lib/csv';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Chip, type Tone } from '@/shared/ui/Chip';
import { Segmented } from '@/shared/ui/Field';
import { Skeleton, Stat } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { ChartCard } from '@/shared/charts/ChartCard';
import { StackedBar } from '@/shared/charts/StackedBar';
import { FollowButton } from '@/shared/ui/FollowButton';
import { flagText } from '@/shared/lib/flagText';
import { isOverBudget } from '../lib/projects';

const severityTone: Record<FlagSeverity, Tone> = { high: 'bad', watch: 'warn', info: 'info' };
const severityBorder: Record<FlagSeverity, string> = { high: 'border-l-bad', watch: 'border-l-warn', info: 'border-l-info' };
const statusTone: Record<FlagStatus, Tone> = { open: 'neutral', reviewing: 'info', explained: 'good', referred: 'vote', cleared: 'neutral' };
const methodColor: Record<string, string> = {
  open_tender: 'var(--series-1)',
  request_for_quotation: 'var(--series-3)',
  framework: 'var(--series-5)',
  restricted: 'var(--series-4)',
  direct: 'var(--series-2)',
};

function ShareBar({ pct, tone }: { pct: number; tone: 'bad' | 'warn' | 'info' }) {
  const bg = { bad: 'bg-bad', warn: 'bg-warn', info: 'bg-info' }[tone];
  return (
    <div className="h-3.5 flex-1 overflow-hidden rounded-r-md bg-bg-2" aria-hidden>
      <div className={cn('h-full rounded-r-md transition-[width] duration-700 ease-out', bg)} style={{ width: `${Math.min(100, pct)}%`, minWidth: pct > 0 ? 6 : 0 }} />
    </div>
  );
}

function HhiGauge({ value, label }: { value: number; label: string }) {
  const max = 5000;
  const pos = Math.min(1, value / max) * 100;
  return (
    <div role="img" aria-label={label} className="relative pt-5">
      <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ gap: 2 }}>
        <span className="bg-good" style={{ flex: 1500 }} />
        <span className="bg-warn" style={{ flex: 1000 }} />
        <span className="bg-bad" style={{ flex: 2500 }} />
      </div>
      <span aria-hidden className="absolute top-0 -translate-x-1/2 transition-[left] duration-700" style={{ left: `${pos}%` }}>
        <span className="block rounded-md bg-ink px-1.5 py-0.5 font-data text-xs font-medium text-bg">{Math.round(value).toLocaleString('en-US')}</span>
        <span className="mx-auto block h-2 w-0.5 bg-ink" />
      </span>
    </div>
  );
}

function FlagCard({ f }: { f: ProcurementFlag }) {
  const { t, relative, locale } = useI18n();
  const text = flagText(f, locale, t);
  const followKind = f.subject_kind === 'contractor' ? 'supplier' : f.subject_kind === 'project' ? 'project' : null;
  const Icon = f.severity === 'high' ? AlertOctagon : f.severity === 'watch' ? Eye : Info;
  return (
    <li className={cn('rounded-2xl border border-l-4 border-line bg-surface p-4 shadow-card sm:p-5', severityBorder[f.severity])}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={severityTone[f.severity]}><Icon className="size-3.5" aria-hidden />{t(`open.watch.severity.${f.severity}` as MessageKey)}</Chip>
        <Chip tone={statusTone[f.status]}>{t(`open.watch.status.${f.status}` as MessageKey)}</Chip>
        {f.first_seen && <span className="text-xs text-muted">{t('open.watch.firstSeen', { when: relative(f.first_seen) })}</span>}
      </div>
      <h3 className="mt-2 font-display text-lg font-bold leading-snug">{text.title}</h3>
      <p className="mt-1 text-[0.95rem] text-ink-2">{text.why}</p>
      {followKind && <div className="mt-3"><FollowButton kind={followKind} id={f.subject_key.split(':')[0]!} label={f.subject_label} /></div>}
      {f.response && (
        <div className="mt-3 rounded-xl bg-good-soft p-3.5">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-good">{t('open.watch.response')}</p>
          <p className="mt-1 text-sm text-ink">{f.response}</p>
        </div>
      )}
    </li>
  );
}

export default function OpenCounty() {
  const { t, kes, number, list } = useI18n();
  usePageTitle(t('open.title'));
  const q = useProcurementWatch();
  const tenders = useTenders();
  const projects = useProjects();
  const [filter, setFilter] = useState<'all' | FlagSeverity>('all');
  const [all, setAll] = useState(false);

  const w = q.data;
  const flags = useMemo(() => (w?.flags ?? []).filter((f) => f.status !== 'cleared' && (filter === 'all' || f.severity === filter)), [w, filter]);
  const shown = all ? flags : flags.slice(0, 6);
  const has = (w?.summary.awarded_count ?? 0) > 0;

  const delivery = useMemo(() => {
    const list = projects.data ?? [];
    const today = new Date().toISOString().slice(0, 10);
    const over = list.filter((p) => isOverBudget(p) && p.spent > p.budget * 1.1).length;
    const stalled = list.filter((p) => p.status === 'stalled').length;
    const late = list.filter((p) => p.status !== 'completed' && p.status !== 'stalled' && p.expected_at && p.expected_at < today).length;
    return { total: list.length, over, stalled, late, ok: Math.max(0, list.length - over - stalled - late) };
  }, [projects.data]);

  const top = (w?.contractors ?? []).slice(0, 10);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-3xl">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em]"><Scale className="size-3.5" aria-hidden />{t('nav.open')}</p>
        <h1 className="font-display text-[clamp(2.2rem,6vw,3.4rem)] font-extrabold leading-[1.02]">{t('open.title')}</h1>
        <p className="mt-4 text-[1.08rem] text-ink-2">{t('open.intro')}</p>
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-5 rounded-[1.75rem] border border-line bg-surface p-6 shadow-card sm:grid-cols-5">
        {q.isLoading ? (
          [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)
        ) : (
          <>
            <Stat label={t('open.stats.awarded')} value={number(w?.summary.awarded_count ?? 0)} />
            <Stat label={t('open.stats.value')} value={kes(w?.summary.awarded_value ?? 0, { compact: true })} />
            <Stat label={t('open.stats.suppliers')} value={number(w?.summary.suppliers ?? 0)} />
            <Stat label={t('open.stats.bids')} value={w?.summary.avg_bids == null ? '-' : String(w.summary.avg_bids)} />
            <Stat label={t('open.stats.flags')} value={number((w?.flags ?? []).filter((f) => f.severity !== 'info').length)} tone={(w?.flags ?? []).some((f) => f.severity === 'high') ? 'bad' : undefined} />
          </>
        )}
      </dl>

      {q.isLoading && <Skeleton className="mt-8 h-72" />}

      {w && has && (
        <>
          {/* ---------- Who wins ---------- */}
          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <ChartCard
              title={t('open.who.title')}
              subtitle={t('open.who.intro')}
              chartLabel={t('pulse.viewChart')}
              tableLabel={t('pulse.viewTable')}
              table={{ head: [t('common.contractor'), t('open.stats.awarded'), t('open.stats.value'), '%'], rows: top.map((c) => [c.name, c.wins, kes(c.value), c.share_value]) }}
            >
              <ul className="space-y-3.5">
                {top.map((c) => {
                  const tone = c.share_value >= 40 ? 'bad' : c.share_value >= 25 ? 'warn' : 'info';
                  return (
                    <li key={c.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-semibold">{c.name}</span>
                        <span className="shrink-0 text-xs text-muted">{t('open.who.wins', { count: c.wins })}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3">
                        <ShareBar pct={c.share_value} tone={tone} />
                        <span className="shrink-0 whitespace-nowrap text-right font-data text-sm font-medium">{t('open.who.share', { share: c.share_value })}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <p className="font-data text-xs text-muted">{kes(c.value, { compact: true })}</p>
                        <FollowButton kind="supplier" id={String(c.id)} label={c.name} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ChartCard>

            <section className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="conc">
              <h2 id="conc" className="font-display text-xl font-bold">{t('open.conc.title')}</h2>
              <p className="mt-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-muted">{t('open.conc.index')}</span>
                <Chip tone={w.summary.hhi_band === 'high' ? 'bad' : w.summary.hhi_band === 'moderate' ? 'warn' : 'good'}>{t(`open.conc.band.${w.summary.hhi_band}` as MessageKey)}</Chip>
              </p>
              <HhiGauge value={w.summary.hhi} label={`${t('open.conc.index')}: ${w.summary.hhi}`} />
              <dl className="mt-6 grid grid-cols-3 gap-3">
                <Stat label={t('open.conc.top1')} value={`${w.summary.top1_share}%`} />
                <Stat label={t('open.conc.top3')} value={`${w.summary.top3_share}%`} />
                <Stat label={t('open.conc.top5')} value={`${w.summary.top5_share}%`} />
              </dl>
              <p className="mt-5 text-xs text-muted">{t('open.conc.hint')}</p>
            </section>
          </div>

          {/* ---------- How ---------- */}
          <section className="mt-6 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-7" aria-labelledby="how">
            <h2 id="how" className="font-display text-xl font-bold">{t('open.how.title')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{t('open.how.intro')}</p>
            <div className="mt-6">
              <StackedBar
                ariaLabel={t('open.how.title')}
                parts={w.methods.map((m) => ({ key: m.method, label: t(`open.how.methods.${m.method}` as MessageKey), value: m.value, color: methodColor[m.method] ?? 'var(--series-1)' }))}
              />
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-2">
                {w.methods.map((m) => (
                  <li key={m.method} className="inline-flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full" style={{ background: methodColor[m.method] }} />{t(`open.how.methods.${m.method}` as MessageKey)} <b className="font-data text-ink">{m.awards}</b></li>
                ))}
              </ul>
            </div>
            <dl className="mt-7 grid gap-5 sm:grid-cols-3">
              <Stat label={t('open.how.single')} value={`${w.summary.single_bid_share}%`} tone={w.summary.single_bid_share >= 25 ? 'warn' : undefined} />
              <Stat label={t('open.how.avgDays')} value={w.summary.avg_tender_days == null ? '-' : t('open.how.days', { n: Math.round(w.summary.avg_tender_days) })} />
              <Stat label={t('open.how.nonComp')} value={`${w.summary.non_competitive_share}%`} tone={w.summary.non_competitive_share >= 30 ? 'warn' : undefined} />
            </dl>
          </section>
        </>
      )}

      {w && !has && <p className="mt-8 rounded-[1.5rem] border border-dashed border-line-strong p-10 text-center text-muted">{t('open.who.none')}</p>}

      {/* ---------- Watch ---------- */}
      {w && (
        <section className="mt-10" aria-labelledby="watch">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 id="watch" className="font-display text-[clamp(1.6rem,4vw,2.3rem)] font-extrabold">{t('open.watch.title')}</h2>
              <p className="mt-2 text-ink-2">{t('open.watch.intro')}</p>
            </div>
            <Segmented<'all' | FlagSeverity>
              label={t('open.watch.title')}
              value={filter}
              onChange={(v) => { setFilter(v); setAll(false); }}
              options={[{ value: 'all', label: t('open.watch.filterAll') }, { value: 'high', label: t('open.watch.severity.high') }, { value: 'watch', label: t('open.watch.severity.watch') }, { value: 'info', label: t('open.watch.severity.info') }]}
            />
          </div>
          {flags.length === 0 ? (
            <p className="mt-5 rounded-[1.5rem] bg-good-soft p-6 text-center font-semibold text-good">{t('open.watch.none')}</p>
          ) : (
            <>
              <ul className="mt-5 space-y-3">{shown.map((f) => <FlagCard key={`${f.code}|${f.subject_key}`} f={f} />)}</ul>
              {flags.length > shown.length && <Button variant="secondary" className="mt-4" onClick={() => setAll(true)}>{t('open.watch.more', { count: flags.length })}</Button>}
            </>
          )}
          <p className="mt-5 flex gap-2 rounded-2xl bg-bg-2 p-4 text-sm text-ink-2"><ShieldQuestion className="mt-0.5 size-5 shrink-0" aria-hidden />{t('open.method.disclaimer')}</p>
        </section>
      )}

      {/* ---------- Delivery ---------- */}
      {delivery.total > 0 && (
        <section className="mt-10 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-7" aria-labelledby="delivery">
          <h2 id="delivery" className="font-display text-xl font-bold">{t('open.delivery.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('open.delivery.of', { total: delivery.total })}</p>
          <div className="mt-5">
            <StackedBar
              ariaLabel={t('open.delivery.title')}
              parts={[
                { key: 'ok', label: t('open.delivery.ok'), value: delivery.ok, color: 'var(--series-3)' },
                { key: 'late', label: t('open.delivery.late'), value: delivery.late, color: 'var(--series-4)' },
                { key: 'stalled', label: t('open.delivery.stalled'), value: delivery.stalled, color: 'var(--series-2)' },
                { key: 'over', label: t('open.delivery.over'), value: delivery.over, color: 'var(--series-5)' },
              ]}
            />
            <ul className="mt-3 grid gap-2 text-sm text-ink-2 sm:grid-cols-4">
              {([['ok', 'var(--series-3)'], ['late', 'var(--series-4)'], ['stalled', 'var(--series-2)'], ['over', 'var(--series-5)']] as const).map(([k, color]) => (
                <li key={k} className="inline-flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />{t(`open.delivery.${k}`)} <b className="font-data text-ink">{delivery[k]}</b></li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- Method + data ---------- */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-7" aria-labelledby="method">
          <h2 id="method" className="font-display text-xl font-bold">{t('open.method.title')}</h2>
          <p className="mt-2 text-sm text-ink-2">{t('open.method.intro')}</p>
          <ol className="mt-4 space-y-2.5 text-sm text-ink-2">
            {list('open.method.rules').map((r, i) => (
              <li key={r} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-bg-2 font-data text-xs font-medium text-ink">{i + 1}</span><span>{r}</span></li>
            ))}
          </ol>
        </section>

        <section className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-7" aria-labelledby="data">
          <h2 id="data" className="font-display text-xl font-bold">{t('open.data.title')}</h2>
          <p className="mt-2 text-sm text-ink-2">{t('open.data.intro')}</p>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
            <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} disabled={!tenders.data?.length}
              onClick={() => downloadCsv('tenders.csv', (tenders.data ?? []).map((x) => ({ ...x })), ['reference', 'title', 'ward_name', 'sector', 'status', 'procurement_method', 'estimated_budget', 'award_amount', 'applicants_count', 'awarded_to', 'published_at', 'closes_at', 'awarded_at']) }>
              {t('open.data.tenders')}
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} disabled={!projects.data?.length}
              onClick={() => downloadCsv('projects.csv', (projects.data ?? []).map((p) => ({ ...p, milestones: p.milestones.length, photos: p.photos.length })), ['slug', 'title', 'ward_name', 'sector', 'status', 'budget', 'spent', 'contractor', 'started_at', 'expected_at', 'completed_at'])}>
              {t('open.data.projects')}
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} disabled={!w?.contractors.length}
              onClick={() => downloadCsv('suppliers.csv', (w?.contractors ?? []).map((c) => ({ ...c })), ['name', 'wins', 'value', 'share_value', 'share_count', 'non_open', 'single_bid', 'last_award'])}>
              {t('open.data.suppliers')}
            </Button>
            <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} disabled={!w?.flags.length}
              onClick={() => downloadCsv('flags.csv', (w?.flags ?? []).map((f) => ({ ...f, metrics: JSON.stringify(f.metrics) })), ['code', 'severity', 'subject_kind', 'subject_label', 'title', 'detail', 'status', 'response', 'first_seen'])}>
              {t('open.data.flags')}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
