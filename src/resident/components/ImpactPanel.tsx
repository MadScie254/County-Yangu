import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Award, CheckCircle2, HeartHandshake, Lock, ShieldCheck, Sparkles, Vote, Wrench } from 'lucide-react';
import { useI18n, type MessageKey } from '@/shared/i18n';
import { getCaseStatus } from '@/shared/api/public';
import { useMyChampion } from '@/shared/api/hooks';
import { useAuth } from '@/shared/state/auth';
import { useMyReports } from '@/shared/state/myreports';
import { usePrefs } from '@/shared/state/prefs';
import { cn } from '@/shared/lib/utils';
import { ShareCardButton } from '@/shared/ui/ShareCardButton';

type Badge = { key: string; icon: typeof Award; earned: boolean };

/**
 * What your actions changed. Built from the report numbers kept on this phone (reports carry no name on the server)
 * and your own votes. Badges are only for outcomes someone can check: a fix, neighbours backing you, a vote counted.
 */
export function ImpactPanel() {
  const { t, number } = useI18n();
  const saved = useMyReports((s) => s.items);
  const voted = usePrefs((s) => s.votedCycles);
  const user = useAuth((s) => s.user);
  const champ = useMyChampion(user?.id);
  const cases = useQueries({ queries: saved.map((r) => ({ queryKey: ['case', r.reference], queryFn: () => getCaseStatus(r.reference), staleTime: 60_000 })) });
  const data = cases.map((c) => c.data).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const fixed = data.filter((c) => c.status === 'resolved' || c.status === 'closed');
  const backers = data.reduce((n, c) => n + (c.supporters ?? 0), 0);
  const fast = fixed.filter((c) => c.resolve_due_at && Date.parse(c.updated_at) <= Date.parse(c.resolve_due_at)).length;

  const badges: Badge[] = [
    { key: 'firstFix', icon: Wrench, earned: fixed.length >= 1 },
    { key: 'fiveFixed', icon: Award, earned: fixed.length >= 5 },
    { key: 'onTime', icon: CheckCircle2, earned: fast >= 3 },
    { key: 'backed', icon: HeartHandshake, earned: backers >= 10 },
    { key: 'voter', icon: Vote, earned: voted.length >= 1 },
    { key: 'champion', icon: ShieldCheck, earned: champ.data?.status === 'active' },
  ];
  const earned = badges.filter((b) => b.earned).length;

  return (
    <section aria-labelledby="impact" className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="impact" className="flex items-center gap-2 font-display text-xl font-bold"><Sparkles className="size-5 text-brand" aria-hidden />{t('impact.title')}</h2>
        {fixed.length > 0 && <ShareCardButton path="/" text={t('impact.shareText', { count: fixed.length })}
          card={{ kicker: t('impact.title'), title: t('impact.cardTitle'), stat: number(fixed.length), statLabel: t('impact.fixedLabel', { count: fixed.length }), tone: 'good', lines: backers ? [t('impact.backers', { count: backers })] : [] }} />}
      </div>
      {saved.length === 0 && voted.length === 0 ? (
        <p className="mt-3 text-sm text-ink-2">{t('impact.empty')} <Link to="/report" className="font-semibold underline">{t('impact.start')}</Link></p>
      ) : (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['reports', saved.length], ['fixed', fixed.length], ['backers', backers], ['votes', voted.length]].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-bg-2/70 p-4">
              <dt className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted">{t(`impact.stat.${k}` as MessageKey)}</dt>
              <dd className={cn('mt-1 font-display text-3xl font-extrabold', k === 'fixed' && Number(v) > 0 && 'text-good')}>{number(Number(v))}</dd>
            </div>
          ))}
        </dl>
      )}
      <h3 className="mt-5 text-sm font-semibold">{t('impact.badges', { earned, of: badges.length })}</h3>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {badges.map((b) => (
          <li key={b.key} className={cn('flex items-center gap-2.5 rounded-xl border p-3 text-sm', b.earned ? 'border-good/40 bg-good-soft' : 'border-dashed border-line text-muted')}>
            {b.earned ? <b.icon className="size-5 shrink-0 text-good" aria-hidden /> : <Lock className="size-4 shrink-0" aria-hidden />}
            <span><b className={cn(b.earned && 'text-ink')}>{t(`impact.badge.${b.key}` as MessageKey)}</b><br /><span className="text-xs">{t(`impact.how.${b.key}` as MessageKey)}</span></span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{t('impact.privacy')}</p>
    </section>
  );
}
