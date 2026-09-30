import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useI18n } from '@/shared/i18n';
import { useProjectChecks } from '@/shared/api/hooks';
import { sendProjectCheck, SubmitError } from '@/shared/api/submit';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/Button';
import { TextArea } from '@/shared/ui/Field';

/** Community monitoring: residents near a project say whether it looks as published. Totals and comments are public. */
export function ProjectCheck({ slug }: { slug: string }) {
  const { t, relative, number } = useI18n();
  const qc = useQueryClient();
  const q = useProjectChecks(slug);
  const key = `cy-pcheck-${slug}`;
  const [verdict, setVerdict] = useState<'as_shown' | 'not_as_shown' | null>(null);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState<null | 'sent' | 'already'>(() => { try { return localStorage.getItem(key) ? 'already' : null; } catch { return null; } });
  const send = useMutation({
    mutationFn: () => sendProjectCheck({ slug, verdict: verdict!, comment: comment.trim() || undefined }),
    onSuccess: () => { setDone('sent'); try { localStorage.setItem(key, '1'); } catch { /* ignore */ } void qc.invalidateQueries({ queryKey: ['project-checks', slug] }); },
    onError: (e) => { if (e instanceof SubmitError && e.code === 'already_answered') { setDone('already'); try { localStorage.setItem(key, '1'); } catch { /* ignore */ } } },
  });
  const c = q.data;
  const total = c ? c.as_shown + c.not_as_shown : 0;
  const yesPct = total ? Math.round((100 * (c?.as_shown ?? 0)) / total) : 0;

  return (
    <section className="mt-10 rounded-[1.75rem] border border-line bg-surface p-5 shadow-card sm:p-6" aria-labelledby="pcheck">
      <h2 id="pcheck" className="font-display text-xl font-bold">{t('loop.pcheck.title')}</h2>
      <p className="mt-1 text-sm text-ink-2">{t('loop.pcheck.intro')}</p>

      {c && total > 0 ? (
        <div className="mt-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-bg-2" aria-hidden>
            <div className="h-full bg-good" style={{ width: `${yesPct}%` }} />
            <div className="h-full bg-bad" style={{ width: `${100 - yesPct}%` }} />
          </div>
          <p className="mt-2 text-sm font-semibold">{t('loop.pcheck.tally', { yes: number(c.as_shown), no: number(c.not_as_shown) })}</p>
        </div>
      ) : <p className="mt-4 text-sm text-muted">{t('loop.pcheck.none')}</p>}

      {done ? (
        <p className="mt-4 rounded-xl bg-good-soft p-3 text-sm font-semibold" aria-live="polite">{done === 'sent' ? t('loop.pcheck.thanks') : t('loop.pcheck.already')}</p>
      ) : (
        <div className="mt-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant={verdict === 'as_shown' ? 'primary' : 'secondary'} aria-pressed={verdict === 'as_shown'} icon={<ThumbsUp className="size-4" aria-hidden />} onClick={() => setVerdict('as_shown')}>{t('loop.pcheck.yes')}</Button>
            <Button variant={verdict === 'not_as_shown' ? 'danger' : 'secondary'} aria-pressed={verdict === 'not_as_shown'} icon={<ThumbsDown className="size-4" aria-hidden />} onClick={() => setVerdict('not_as_shown')}>{t('loop.pcheck.no')}</Button>
          </div>
          {verdict && (
            <div className="mt-3 space-y-2">
              <label className="block text-sm font-semibold">
                {t('loop.pcheck.commentLabel')}
                <TextArea className="mt-1.5 min-h-20" maxLength={400} value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
              <p className="text-xs text-muted">{t('loop.feedback.commentHint')}</p>
              {send.isError && !(send.error instanceof SubmitError && send.error.code === 'already_answered') && <p role="alert" className="text-sm font-medium text-bad">{t('loop.pcheck.error')}</p>}
              <Button loading={send.isPending} onClick={() => send.mutate()}>{t('loop.pcheck.send')}</Button>
            </div>
          )}
        </div>
      )}

      {c && c.comments.length > 0 && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{t('loop.pcheck.said')}</p>
          <ul className="mt-2 space-y-2">
            {c.comments.map((x, i) => (
              <li key={i} className={cn('rounded-xl border-l-4 bg-bg-2/60 p-3 text-sm', x.verdict === 'as_shown' ? 'border-l-good' : 'border-l-bad')}>
                <p>{x.comment}</p>
                <p className="mt-1 text-xs text-muted">{relative(x.at)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
