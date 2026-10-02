import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowBigUp, LogIn, MessageCircleQuestion, Send } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { wardById, wards } from '@/shared/config/county';
import { useIsDemo, useMcaScoreboard, useMyQuestionVotes, useQuestions } from '@/shared/api/hooks';
import { askQuestion, voteQuestion } from '@/shared/api/engage';
import { useAuth } from '@/shared/state/auth';
import { usePrefs } from '@/shared/state/prefs';
import { usePageTitle } from '@/shared/lib/hooks';
import { cn } from '@/shared/lib/utils';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { SelectInput, TextArea } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { FlagButton } from '../components/FlagButton';

const sortedWards = [...wards].sort((a, b) => a.name.localeCompare(b.name));

/** Public questions to the ward's MCA. Residents upvote; the MCA answers in public; answer rates are on show. */
export default function Ask() {
  const { t, relative, number } = useI18n();
  const loc = useLocation();
  const qc = useQueryClient();
  const demo = useIsDemo();
  const signedIn = useAuth((s) => s.status === 'in');
  const prefWard = usePrefs((s) => s.wardId);
  const [ward, setWard] = useState(prefWard && wardById.has(prefWard) ? prefWard : '');
  const [body, setBody] = useState('');
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const q = useQuestions(ward || null);
  const mine = useMyQuestionVotes(signedIn);
  const board = useMcaScoreboard();
  usePageTitle(t('ask.title'));

  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && q.data?.length) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
  }, [q.data?.length]);

  const voted = (id: string) => local[id] ?? (mine.data ?? []).includes(id);
  const vote = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => voteQuestion(id, on),
    onMutate: ({ id, on }) => setLocal((s) => ({ ...s, [id]: on })),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['questions'] }); void qc.invalidateQueries({ queryKey: ['my-question-votes'] }); },
    onError: (_e, { id }) => { setLocal((s) => { const c = { ...s }; delete c[id]; return c; }); toast({ tone: 'bad', title: t('ask.error') }); },
  });
  const ask = useMutation({
    mutationFn: () => askQuestion(ward, body),
    onSuccess: () => { setBody(''); toast({ tone: 'good', title: t('ask.sent') }); void qc.invalidateQueries({ queryKey: ['questions'] }); },
    onError: (e) => toast({ tone: 'bad', title: (e as { code?: string }).code === '54000' ? t('ask.limit') : t('ask.error') }),
  });

  const score = useMemo(() => (board.data ?? []).find((b) => b.ward_id === ward) ?? null, [board.data, ward]);
  const list = q.data ?? [];
  const top = useMemo(() => [...(board.data ?? [])].filter((b) => b.asked >= 3).sort((a, b) => b.answered / b.asked - a.answered / a.asked).slice(0, 5), [board.data]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] font-extrabold leading-tight">{t('ask.title')}</h1>
      <p className="mt-3 max-w-2xl text-[1.05rem] text-ink-2">{t('ask.intro')}</p>
      {demo && <p className="mt-2 text-xs font-semibold text-muted">{t('common.demoData')}</p>}

      <label className="mt-6 block max-w-sm text-sm font-semibold">{t('ask.ward')}
        <SelectInput className="mt-1.5" value={ward} onChange={(e) => setWard(e.target.value)}><option value="">{t('ask.allWards')}</option>{sortedWards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectInput>
      </label>

      {ward && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[['asked', score?.asked ?? 0], ['answered', score?.answered ?? 0], ['onTime', score?.on_time ?? 0]].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-muted">{t(`ask.stat.${k}` as 'ask.stat.asked')}</p>
              <p className="mt-1 font-display text-2xl font-extrabold">{number(Number(v))}</p>
            </div>
          ))}
        </div>
      )}

      <section className="mt-6 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="askform">
        <h2 id="askform" className="flex items-center gap-2 font-display text-xl font-bold"><MessageCircleQuestion className="size-5" aria-hidden />{t('ask.formTitle')}</h2>
        {signedIn || demo ? (
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); if (ward && body.trim().length >= 10) ask.mutate(); }}>
            <TextArea aria-label={t('ask.formTitle')} className="min-h-24" maxLength={600} value={body} placeholder={t('ask.placeholder')} onChange={(e) => setBody(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" icon={<Send className="size-4" aria-hidden />} loading={ask.isPending} disabled={!ward || body.trim().length < 10}>{t('ask.send')}</Button>
              {!ward && <span className="text-sm text-muted">{t('ask.pickWard')}</span>}
              <span className="text-xs text-muted">{t('ask.rules')}</span>
            </div>
          </form>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span className="flex-1">{t('ask.signInWhy')}</span>
            <ButtonLink size="sm" to={`/services/account?next=${encodeURIComponent(loc.pathname)}`} icon={<LogIn className="size-4" aria-hidden />}>{t('ask.signIn')}</ButtonLink></div>
        )}
      </section>

      {q.isLoading ? <Skeleton className="mt-8 h-64" /> : list.length === 0 ? <p className="mt-8 text-sm text-muted">{t('ask.none')}</p> : (
        <ul className="mt-8 space-y-3">
          {list.map((x) => (
            <li key={x.id} id={x.id} className="flex scroll-mt-24 gap-4 rounded-[1.5rem] border border-line bg-surface p-5">
              <button type="button" aria-pressed={voted(x.id)} aria-label={t('ask.upvote')} disabled={!signedIn && !demo}
                onClick={() => vote.mutate({ id: x.id, on: !voted(x.id) })}
                className={cn('flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border text-sm font-bold transition', voted(x.id) ? 'border-brand bg-brand-soft' : 'border-line hover:bg-bg-2')}>
                <ArrowBigUp className="size-5" aria-hidden />{number(x.votes + (local[x.id] === true && !(mine.data ?? []).includes(x.id) ? 1 : local[x.id] === false && (mine.data ?? []).includes(x.id) ? -1 : 0))}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Chip tone={x.status === 'answered' ? 'good' : 'warn'}>{x.status === 'answered' ? t('ask.answered') : t('ask.waiting')}</Chip>
                  <Link to={`/ward/${x.ward_id}`} className="font-semibold hover:underline">{wardById.get(x.ward_id)?.name ?? x.ward_id}</Link>
                  <span className="text-muted">{relative(x.created_at)}</span>
                </div>
                <p className="mt-2 font-semibold">{x.body}</p>
                {x.answer && <p className="mt-3 rounded-xl bg-good-soft p-3 text-sm"><b>{t('ask.mcaSays')}</b> {x.answer}</p>}
                <div className="mt-2 text-right"><FlagButton kind="mca_question" id={x.id} /></div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {top.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">{t('ask.best')}</h2>
          <ol className="mt-3 space-y-1 text-sm">{top.map((b, i) => <li key={b.ward_id}>{i + 1}. {wardById.get(b.ward_id)?.name ?? b.ward_id}: {t('ask.rate', { answered: b.answered, asked: b.asked })}</li>)}</ol>
        </section>
      )}
    </div>
  );
}
