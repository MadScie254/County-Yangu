import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useChampionChecks, useMyChampion } from '@/shared/api/hooks';
import { postChampionCheck } from '@/shared/api/civic2';
import { useAuth } from '@/shared/state/auth';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { TextArea } from '@/shared/ui/Field';
import { toast } from '@/shared/ui/Toast';

/** Named checks by verified ward champions, shown above the anonymous resident tally. */
export function ChampionChecks({ slug, projectId, wardId }: { slug: string; projectId: string; wardId: string }) {
  const { t, relative } = useI18n();
  const qc = useQueryClient();
  const q = useChampionChecks(slug);
  const user = useAuth((s) => s.user);
  const mine = useMyChampion(user?.id);
  const canCheck = mine.data?.status === 'active' && mine.data.ward_id === wardId;
  const [verdict, setVerdict] = useState<'as_shown' | 'not_as_shown' | null>(null);
  const [comment, setComment] = useState('');
  const send = useMutation({
    mutationFn: () => postChampionCheck(projectId, verdict!, comment),
    onSuccess: () => { setVerdict(null); setComment(''); toast({ tone: 'good', title: t('champions.checkSent') }); void qc.invalidateQueries({ queryKey: ['champion-checks', slug] }); },
    onError: () => toast({ tone: 'bad', title: t('champions.checkError') }),
  });
  const list = q.data ?? [];
  if (!list.length && !canCheck) return null;
  return (
    <section className="mt-10 rounded-[1.75rem] border border-good/40 bg-surface p-5 shadow-card sm:p-6" aria-labelledby="champ">
      <h2 id="champ" className="flex items-center gap-2 font-display text-xl font-bold"><BadgeCheck className="size-5 text-good" aria-hidden />{t('champions.checksTitle')}</h2>
      <p className="mt-1 text-sm text-ink-2">{t('champions.checksIntro')} <Link to="/champions" className="font-semibold underline underline-offset-4">{t('champions.learn')}</Link></p>
      {canCheck && (
        <form className="mt-4 space-y-2 rounded-2xl bg-bg-2/70 p-4" onSubmit={(e) => { e.preventDefault(); if (verdict) send.mutate(); }}>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={verdict === 'as_shown' ? 'primary' : 'secondary'} icon={<ThumbsUp className="size-4" aria-hidden />} onClick={() => setVerdict('as_shown')}>{t('loop.pcheck.yes')}</Button>
            <Button size="sm" variant={verdict === 'not_as_shown' ? 'danger' : 'secondary'} icon={<ThumbsDown className="size-4" aria-hidden />} onClick={() => setVerdict('not_as_shown')}>{t('loop.pcheck.no')}</Button>
          </div>
          <TextArea aria-label={t('loop.pcheck.commentLabel')} className="min-h-16" maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button type="submit" size="sm" loading={send.isPending} disabled={!verdict}>{t('champions.post')}</Button>
        </form>
      )}
      {list.length > 0 && (
        <ul className="mt-4 space-y-2">
          {list.map((c, i) => (
            <li key={i} className={cn('rounded-xl border-l-4 bg-bg-2/60 p-3 text-sm', c.verdict === 'as_shown' ? 'border-good' : 'border-bad')}>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted"><b className="text-ink">{c.champion}</b><span>{c.verdict === 'as_shown' ? t('loop.pcheck.yes') : t('loop.pcheck.no')}</span><span>· {relative(c.at)}</span></p>
              {c.comment && <p className="mt-1">{c.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
