import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogIn, Plus, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useIsDemo, useMyStatementVotes, useStatementResults } from '@/shared/api/hooks';
import { addStatement, opinionGroups, voteStatement } from '@/shared/api/civic2';
import type { StatementResult } from '@/shared/api/types';
import { useAuth } from '@/shared/state/auth';
import { cn } from '@/shared/lib/utils';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { TextInput } from '@/shared/ui/Field';
import { Skeleton } from '@/shared/ui/Card';
import { toast } from '@/shared/ui/Toast';
import { FlagButton } from './FlagButton';

type V = -1 | 0 | 1;
const share = (s: StatementResult) => (s.agree + s.disagree ? s.agree / (s.agree + s.disagree) : 0.5);
const enough = (s: StatementResult) => s.agree + s.disagree >= 3;

/**
 * Short statements residents agree or disagree with, after Pol.is and vTaiwan: it shows where people already agree
 * and where opinion splits, instead of a pile of comments nobody reads.
 */
export function Statements({ slug, consultationId, open }: { slug: string; consultationId: string; open: boolean }) {
  const { t, number } = useI18n();
  const loc = useLocation();
  const qc = useQueryClient();
  const demo = useIsDemo();
  const signedIn = useAuth((s) => s.status === 'in');
  const q = useStatementResults(slug);
  const mine = useMyStatementVotes(signedIn);
  const [local, setLocal] = useState<Record<number, V>>({});
  const [draft, setDraft] = useState('');
  const voted = { ...(mine.data ?? {}), ...local };
  const all = useMemo(() => q.data?.statements ?? [], [q.data]);
  const next = all.find((s) => voted[s.id] === undefined) ?? null;
  const left = all.filter((s) => voted[s.id] === undefined).length;
  const canAct = open && (signedIn || demo);

  const vote = useMutation({
    mutationFn: ({ id, v }: { id: number; v: V }) => voteStatement(id, v),
    onMutate: ({ id, v }) => setLocal((s) => ({ ...s, [id]: v })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['statements', slug] }),
    onError: (_e, { id }) => { setLocal((s) => { const c = { ...s }; delete c[id]; return c; }); toast({ tone: 'bad', title: t('statements.error') }); },
  });
  const add = useMutation({
    mutationFn: () => addStatement(consultationId, draft),
    onSuccess: () => { setDraft(''); toast({ tone: 'good', title: t('statements.added') }); void qc.invalidateQueries({ queryKey: ['statements', slug] }); },
    onError: (e) => toast({ tone: 'bad', title: (e as { code?: string }).code === '54000' ? t('statements.limit') : t('statements.addError') }),
  });

  const consensus = all.filter((s) => enough(s) && share(s) >= 0.7).sort((a, b) => share(b) - share(a)).slice(0, 4);
  const divided = all.filter((s) => enough(s) && share(s) > 0.35 && share(s) < 0.65).sort((a, b) => Math.abs(share(a) - 0.5) - Math.abs(share(b) - 0.5)).slice(0, 4);
  const groups = useMemo(() => (q.data ? opinionGroups(q.data.votes, all.map((s) => s.id)) : null), [q.data, all]);
  const splits = groups ? all.map((s) => ({ s, a: groups.groups[0]!.mean[s.id] ?? 0, b: groups.groups[1]!.mean[s.id] ?? 0 })).filter((x) => Math.abs(x.a - x.b) >= 0.8).sort((x, y) => Math.abs(y.a - y.b) - Math.abs(x.a - x.b)).slice(0, 3) : [];
  const lean = (m: number) => (m >= 0.3 ? t('statements.mostlyAgree') : m <= -0.3 ? t('statements.mostlyDisagree') : t('statements.split'));

  const row = (s: StatementResult) => {
    const n = s.agree + s.disagree + s.pass || 1;
    return (
      <li key={s.id} className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold">{s.body}</p>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-bg-2" role="img" aria-label={t('statements.counts', { agree: s.agree, disagree: s.disagree, pass: s.pass })}>
          <span className="h-full bg-good" style={{ width: `${(100 * s.agree) / n}%` }} />
          <span className="h-full bg-bad" style={{ width: `${(100 * s.disagree) / n}%` }} />
          <span className="h-full bg-line-strong" style={{ width: `${(100 * s.pass) / n}%` }} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{t('statements.counts', { agree: number(s.agree), disagree: number(s.disagree), pass: number(s.pass) })}</span>
          <FlagButton kind="statement" id={s.id} />
        </div>
      </li>
    );
  };

  if (q.isLoading) return <Skeleton className="mt-8 h-40" />;
  if (!open && all.length === 0) return null;
  return (
    <section className="mt-8 rounded-[1.75rem] bg-brand-soft p-5 sm:p-6" aria-labelledby="statements">
      <h2 id="statements" className="font-display text-xl font-bold">{t('statements.title')}</h2>
      <p className="mt-1 text-sm text-ink-2">{t('statements.intro')}</p>
      {q.data && q.data.participants > 0 && <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold"><Users className="size-3.5" aria-hidden />{t('statements.people', { count: q.data.participants })}</p>}

      {open && (canAct ? (
        next ? (
          <div className="mt-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
            <p className="text-xs font-semibold text-muted">{t('statements.left', { count: left })}</p>
            <p className="mt-2 font-display text-lg font-bold leading-snug">{next.body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button icon={<ThumbsUp className="size-4" aria-hidden />} onClick={() => vote.mutate({ id: next.id, v: 1 })}>{t('statements.agree')}</Button>
              <Button variant="secondary" icon={<ThumbsDown className="size-4" aria-hidden />} onClick={() => vote.mutate({ id: next.id, v: -1 })}>{t('statements.disagree')}</Button>
              <Button variant="ghost" onClick={() => vote.mutate({ id: next.id, v: 0 })}>{t('statements.pass')}</Button>
            </div>
          </div>
        ) : all.length > 0 && <p className="mt-4 rounded-2xl bg-good-soft p-4 text-sm font-semibold text-good">{t('statements.allDone')}</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-4 text-sm">
          <span className="flex-1">{t('statements.signInWhy')}</span>
          <ButtonLink size="sm" to={`/services/account?next=${encodeURIComponent(loc.pathname)}`} icon={<LogIn className="size-4" aria-hidden />}>{t('statements.signIn')}</ButtonLink>
        </div>
      ))}

      {canAct && (
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim().length >= 10) add.mutate(); }}>
          <label className="min-w-0 flex-1 text-sm font-semibold">{t('statements.add')}
            <TextInput className="mt-1.5" maxLength={160} value={draft} placeholder={t('statements.addHint')} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <Button type="submit" variant="secondary" icon={<Plus className="size-4" aria-hidden />} loading={add.isPending} disabled={draft.trim().length < 10}>{t('statements.addSend')}</Button>
        </form>
      )}

      {all.length > 0 && (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">{t('statements.consensus')}</h3>
            {consensus.length ? <ul className="mt-2 space-y-2">{consensus.map(row)}</ul> : <p className="mt-2 text-sm text-muted">{t('statements.notYet')}</p>}
          </div>
          <div>
            <h3 className="font-semibold">{t('statements.divided')}</h3>
            {divided.length ? <ul className="mt-2 space-y-2">{divided.map(row)}</ul> : <p className="mt-2 text-sm text-muted">{t('statements.notYet')}</p>}
          </div>
        </div>
      )}

      {groups && splits.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold">{t('statements.groups')}</h3>
          <p className="mt-1 text-xs text-muted">{t('statements.groupsHelp', { a: groups.groups[0]!.size, b: groups.groups[1]!.size })}</p>
          <ul className="mt-2 space-y-2">
            {splits.map(({ s, a, b }) => (
              <li key={s.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
                <p className="font-semibold">{s.body}</p>
                <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span className={cn(a >= 0.3 ? 'text-good' : a <= -0.3 ? 'text-bad' : 'text-muted')}>{t('statements.groupA')}: {lean(a)}</span>
                  <span className={cn(b >= 0.3 ? 'text-good' : b <= -0.3 ? 'text-bad' : 'text-muted')}>{t('statements.groupB')}: {lean(b)}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {all.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-semibold">{t('statements.every', { count: all.length })}</summary>
          <ul className="mt-2 space-y-2">{all.map(row)}</ul>
        </details>
      )}
    </section>
  );
}
