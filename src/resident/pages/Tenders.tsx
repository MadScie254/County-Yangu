import { useMemo, useState } from 'react';
import { Flag } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useTenders } from '@/shared/api/hooks';
import type { TenderStatus } from '@/shared/api/types';
import { usePageTitle } from '@/shared/lib/hooks';
import { Chip, tenderTone } from '@/shared/ui/Chip';
import { Segmented } from '@/shared/ui/Field';
import { Skeleton, Stat } from '@/shared/ui/Card';
import { flaggedContractors, openTenders } from '../lib/tenders';

type Filter = 'all' | TenderStatus;

export default function Tenders() {
  const { t, kes, date, number } = useI18n();
  usePageTitle(t('tenders.title'));
  const q = useTenders();
  const [filter, setFilter] = useState<Filter>('all');
  const all = q.data ?? [];
  const shown = useMemo(() => all.filter((x) => filter === 'all' || x.status === filter), [all, filter]);
  const flagged = useMemo(() => flaggedContractors(all), [all]);
  const active = openTenders(all);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="max-w-2xl">
        <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold">{t('tenders.title')}</h1>
        <p className="mt-3 text-[1.05rem] text-ink-2">{t('tenders.intro')}</p>
      </header>

      <dl className="mt-8 grid grid-cols-3 gap-4 rounded-[1.75rem] border border-line bg-surface p-6 shadow-card">
        <Stat label={t('tenders.active')} value={number(active.length)} />
        <Stat label={t('tenders.value')} value={kes(active.reduce((a, x) => a + x.estimated_budget, 0), { compact: true })} />
        <Stat label={t('tenders.flagged')} value={number(flagged.length)} tone={flagged.length ? 'bad' : undefined} />
      </dl>

      {flagged.length > 0 && (
        <section aria-labelledby="flags" className="mt-8 rounded-[1.75rem] border border-bad/30 bg-bad-soft p-6">
          <h2 id="flags" className="flex items-center gap-2 font-display text-xl font-bold text-bad"><Flag className="size-5" aria-hidden />{t('tenders.redFlagsTitle')}</h2>
          <p className="mt-1 text-sm text-ink-2">{t('tenders.redFlagsIntro')}</p>
          <ul className="mt-4 divide-y divide-bad/20">
            {flagged.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-semibold">{c.name}</span>
                <span className="text-sm text-ink-2">{t('tenders.tendersWon', { count: c.won })} · <b className="font-data">{kes(c.value, { compact: true })}</b></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Segmented<Filter>
        className="mt-8 max-w-full overflow-x-auto"
        label={t('tenders.filter')}
        value={filter}
        onChange={setFilter}
        options={[{ value: 'all', label: t('tenders.allStatuses') }, { value: 'open', label: t('tenderStatus.open') }, { value: 'evaluating', label: t('tenderStatus.evaluating') }, { value: 'awarded', label: t('tenderStatus.awarded') }]}
      />

      <ul className="mt-5 space-y-3">
        {q.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        {q.isSuccess && shown.length === 0 && <li className="rounded-[1.5rem] border border-dashed border-line-strong p-10 text-center text-muted">{t('tenders.none')}</li>}
        {shown.map((x) => (
          <li key={x.id} className="rounded-[1.5rem] border border-line bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-data text-xs text-muted">{x.reference} · {x.ward_name ?? '—'} · {x.sector}</p>
                <h2 className="mt-1 font-display text-lg font-bold leading-snug">{x.title}</h2>
              </div>
              <Chip tone={tenderTone(x.status)}>{t(`tenderStatus.${x.status}`)}</Chip>
            </div>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div><dt className="sr-only">{t('common.budget')}</dt><dd className="font-data text-lg font-medium">{kes(x.estimated_budget, { compact: true })}</dd></div>
              <div><dt className="inline text-muted">{t('tenders.closes')}: </dt><dd className="inline font-semibold">{x.closes_at ? date(x.closes_at) : '–'}</dd></div>
              <div><dd className="font-semibold text-muted">{t('tenders.applicants', { count: x.applicants_count })}</dd></div>
              {x.awarded_to && <div><dt className="inline text-muted">{t('tenders.awardedTo')}: </dt><dd className="inline font-semibold">{x.awarded_to}</dd></div>}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
