import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Medal, TrendingUp } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useIsDemo, useWardLeague } from '@/shared/api/hooks';
import type { LeagueRow } from '@/shared/api/engage';
import { usePrefs } from '@/shared/state/prefs';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Segmented } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { ShareCardButton } from '@/shared/ui/ShareCardButton';

const medal = ['text-[#c9a227]', 'text-[#9aa3ad]', 'text-[#b0703c]'];

/** Wards, never people, ranked on fixing on time, answering on time and residents taking part. */
export default function League() {
  const { t, number } = useI18n();
  const [days, setDays] = useState<'30' | '90'>('30');
  const q = useWardLeague(Number(days));
  const demo = useIsDemo();
  const myWard = usePrefs((s) => s.wardId);
  usePageTitle(t('league.title'));
  const rows = q.data?.wards ?? [];
  const ranked = rows.filter((r) => r.score !== null);
  const unranked = rows.filter((r) => r.score === null);
  const improved = useMemo(() => [...ranked].filter((r) => (r.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0] ?? null, [ranked]);
  const rankOf = (id: string) => ranked.findIndex((r) => r.ward_id === id) + 1;

  const share = (r: LeagueRow) => (
    <ShareCardButton path={`/league#${r.ward_id}`} text={t('league.shareText', { ward: r.name, rank: rankOf(r.ward_id), of: ranked.length })}
      card={{ kicker: t('league.title'), title: r.name, stat: `#${rankOf(r.ward_id)}`, statLabel: t('league.ofWards', { count: ranked.length }),
        tone: 'brand', lines: [t('league.scoreLine', { score: r.score ?? 0, fixed: r.fixed_on_time, due: r.due })] }} />
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('league.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('league.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}
      <div className="mt-6"><Segmented value={days} onChange={(v) => setDays(v as '30' | '90')} label={t('league.window')} options={[{ value: '30', label: t('league.days', { count: 30 }) }, { value: '90', label: t('league.days', { count: 90 }) }]} /></div>

      {q.isLoading ? <Skeleton className="mt-8 h-96" /> : ranked.length === 0 ? <p className="mt-8 rounded-2xl bg-bg-2 p-5 text-sm">{t('league.none')}</p> : (
        <>
          {improved && (
            <p className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-good-soft p-4 text-sm font-semibold text-good">
              <TrendingUp className="size-5" aria-hidden />{t('league.improved', { ward: improved.name, points: improved.change ?? 0 })}
            </p>
          )}
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {ranked.slice(0, 3).map((r, i) => (
              <li key={r.ward_id} className="rounded-[1.5rem] border border-line bg-surface p-5 text-center shadow-card">
                <Medal className={cn('mx-auto size-9', medal[i])} aria-hidden />
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">#{i + 1}</p>
                <Link to={`/ward/${r.ward_id}`} className="font-display text-xl font-bold hover:underline">{r.name}</Link>
                <p className="mt-1 font-display text-3xl font-extrabold">{r.score}</p>
              </li>
            ))}
          </ol>

          <div className="relative mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="border-b border-line bg-bg-2/60 text-left text-xs uppercase tracking-[0.06em] text-muted">
                <th scope="col" className="px-3 py-2.5">#</th><th scope="col" className="px-3 py-2.5">{t('league.ward')}</th><th scope="col" className="px-3 py-2.5">{t('league.score')}</th>
                <th scope="col" className="px-3 py-2.5">{t('league.change')}</th><th scope="col" className="px-3 py-2.5 text-right">{t('league.onTime')}</th>
                <th scope="col" className="px-3 py-2.5 text-right">{t('league.median')}</th><th scope="col" className="px-3 py-2.5 text-right">{t('league.taking')}</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {ranked.map((r, i) => (
                  <tr key={r.ward_id} id={r.ward_id} className={cn('scroll-mt-24', r.ward_id === myWard && 'bg-brand-soft font-semibold')}>
                    <td className="px-3 py-2 font-data text-muted">{i + 1}</td>
                    <th scope="row" className="px-3 py-2 text-left"><Link to={`/ward/${r.ward_id}`} className="hover:underline">{r.name}</Link></th>
                    <td className="px-3 py-2"><span className="flex items-center gap-2"><span className="h-1.5 w-20 overflow-hidden rounded-full bg-bg-2"><span className="block h-full rounded-full bg-brand" style={{ width: `${r.score}%` }} /></span><span className="font-data">{r.score}</span></span></td>
                    <td className="px-3 py-2">{r.change === null ? <span className="text-muted">-</span> : <span className={cn('inline-flex items-center gap-0.5 font-data', r.change > 0 ? 'text-good' : r.change < 0 ? 'text-bad' : 'text-muted')}>{r.change > 0 ? <ArrowUp className="size-3.5" aria-hidden /> : r.change < 0 ? <ArrowDown className="size-3.5" aria-hidden /> : null}{Math.abs(r.change)}</span>}</td>
                    <td className="px-3 py-2 text-right font-data">{r.due ? `${r.fixed_on_time}/${r.due}` : '-'}</td>
                    <td className="px-3 py-2 text-right font-data">{r.median_days === null ? '-' : t('league.daysShort', { n: r.median_days })}</td>
                    <td className="px-3 py-2 text-right font-data">{number(r.taking_part)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(() => {
            const mine = ranked.find((r) => r.ward_id === myWard) ?? ranked[0]!;
            return <div className="mt-4 flex flex-wrap items-center gap-3 text-sm"><span className="text-muted">{t('league.shareHint', { ward: mine.name })}</span>{share(mine)}</div>;
          })()}

          <section className="mt-8 rounded-2xl bg-bg-2 p-5 text-sm text-ink-2">
            <h2 className="font-semibold text-ink">{t('league.howTitle')}</h2>
            <p className="mt-1">{t('league.how')}</p>
            {unranked.length > 0 && <p className="mt-2">{t('league.unranked', { count: unranked.length })}</p>}
          </section>
        </>
      )}
    </div>
  );
}
